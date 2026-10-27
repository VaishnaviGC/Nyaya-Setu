"""
Nyaya AI backend - FastAPI app.

Main flow:
  POST /analyze-voice   recorded audio (base64) -> transcript in its own script
  POST /analyze-text    text -> category, rights, next steps, documents, follow-up questions,
                        all written in the language the person used (login optional: saves history)
  POST /generate-complaint, /generate-complaint/pdf
  POST /auth/register, /auth/login, GET/PATCH /auth/me
  GET  /history, /history/summary
  GET  /health

If a LIVE Gemini call fails, the API answers HTTP 503 with a readable message
(rate limit, wrong model name, bad key, ...) instead of returning fake text.

Run:  uvicorn main:app --reload --host 0.0.0.0 --port 8000
"""

import base64
import json
import logging
import os
import urllib.error
import urllib.request
from io import BytesIO
from contextlib import asynccontextmanager
from dotenv import load_dotenv
import base64
import binascii
from io import BytesIO
from pypdf import PdfReader
from pydantic import BaseModel

load_dotenv()  # must run BEFORE importing gemini_service, which reads env vars at import time

from fastapi import FastAPI, HTTPException, Depends, Request, UploadFile, File
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import Response, JSONResponse
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session

import gemini_service as gemini
from pdf_service import letter_to_pdf_bytes
from database import get_db, init_db
from models import User, History,SavedCase
from auth import (
    hash_password,
    verify_password,
    create_access_token,
    get_current_user,
    get_optional_user,
)

logging.basicConfig(level=logging.INFO)


@asynccontextmanager
async def lifespan(app: FastAPI):
    init_db()
    yield


app = FastAPI(
    title="Nyaya AI API",
    description="Voice-to-rights legal assistant backend for Nyaya Setu",
    version="1.3.0",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.exception_handler(gemini.GeminiUnavailable)
async def gemini_unavailable_handler(request: Request, exc: gemini.GeminiUnavailable):
    return JSONResponse(status_code=503, content={"detail": exc.user_message})


# ---------------------------------------------------------------------------
# Models
# ---------------------------------------------------------------------------

class AnalyzeVoiceRequest(BaseModel):
    audio_base64: str = Field(..., min_length=1)
    mime_type: str = "audio/m4a"


class AnalyzeVoiceResponse(BaseModel):
    transcript: str
    category: str
    explanation: str
    confidence: str


class RightItem(BaseModel):
    law: str
    explanation: str


class AnalyzeTextRequest(BaseModel):
    text: str = Field(..., min_length=1)
    reply_language: str = "auto"  # "auto" | "en-IN" | "hi-IN" | "kn-IN"


class AnalyzeTextResponse(BaseModel):
    category: str
    confidence: str = "medium"
    language: str = "en-IN"
    understood: str = ""
    summary: str = ""
    rights: list[RightItem] = []
    next_steps: list[str] = []
    documents: list[str] = []
    questions: list[str] = []
    disclaimer: str = ""


class DetectProblemRequest(BaseModel):
    text: str = Field(..., min_length=1)


class DetectProblemResponse(BaseModel):
    category: str
    explanation: str
    confidence: str


class ExplainRightsRequest(BaseModel):
    category: str
    text: str = Field(..., min_length=1)


class ExplainRightsResponse(BaseModel):
    summary: str
    rights: list[RightItem]
    next_steps: list[str]


class GenerateComplaintRequest(BaseModel):
    category: str
    text: str = Field(..., min_length=1)
    user_name: str = ""
    authority: str = ""


class GenerateComplaintResponse(BaseModel):
    letter_text: str


class SimplifyOrderRequest(BaseModel):
    order_text: str = Field(..., min_length=1)


class SimplifyOrderResponse(BaseModel):
    simplified_text: str


class RegisterRequest(BaseModel):
    phone_number: str = Field(..., min_length=6, max_length=20)
    password: str = Field(..., min_length=6)
    case_number: str | None = None


class LoginRequest(BaseModel):
    phone_number: str
    password: str


class AuthResponse(BaseModel):
    access_token: str
    user_id: int
    phone_number: str
    case_number: str | None = None


class UpdateProfileRequest(BaseModel):
    case_number: str | None = None


class ProfileResponse(BaseModel):
    user_id: int
    phone_number: str
    case_number: str | None = None
    member_since: str


class HistoryItem(BaseModel):
    id: int
    interaction_type: str
    category: str | None
    input_text: str | None
    result_summary: str | None
    created_at: str


class HistorySummaryResponse(BaseModel):
    total_interactions: int
    complaints_generated: int
    rights_explained: int
    categories: dict
    first_interaction: str | None
    latest_interaction: str | None




class SaveCaseRequest(BaseModel):
    cnr: str = Field(..., min_length=16, max_length=16)
    nickname: str | None = Field(default=None, max_length=100)


class SavedCaseResponse(BaseModel):
    id: int
    cnr: str
    nickname: str | None = None
    created_at: str


class SimplifyPdfRequest(BaseModel):
    filename: str = "court-order.pdf"
    pdf_base64: str

# ---------------------------------------------------------------------------
# Health
# ---------------------------------------------------------------------------

@app.get("/health")
def health():
    return {
        "status": "ok",
        "gemini_mode": "MOCK (no GEMINI_API_KEY set)" if gemini.MOCK_MODE else "LIVE",
        "model": gemini.GEMINI_MODEL,
    }


# ---------------------------------------------------------------------------
# Voice + text analysis
# ---------------------------------------------------------------------------

@app.post("/analyze-voice", response_model=AnalyzeVoiceResponse)
def analyze_voice(req: AnalyzeVoiceRequest):
    try:
        audio_bytes = base64.b64decode(req.audio_base64)
    except Exception:
        raise HTTPException(status_code=400, detail="Invalid base64 audio data")
    if len(audio_bytes) == 0:
        raise HTTPException(status_code=400, detail="Empty audio data")
    return gemini.transcribe_and_detect(audio_bytes, req.mime_type)


@app.post("/analyze-text", response_model=AnalyzeTextResponse)
def analyze_text(
    req: AnalyzeTextRequest,
    current_user: User | None = Depends(get_optional_user),
    db: Session = Depends(get_db),
):
    result = gemini.analyze_text(req.text, req.reply_language)

    if current_user:
        db.add(
            History(
                user_id=current_user.id,
                interaction_type="rights_explained",
                category=result["category"],
                input_text=req.text,
                result_summary=result["summary"],
            )
        )
        db.commit()

    return result


# ---------------------------------------------------------------------------
# Auth
# ---------------------------------------------------------------------------

@app.post("/auth/register", response_model=AuthResponse)
def register(req: RegisterRequest, db: Session = Depends(get_db)):
    if db.query(User).filter(User.phone_number == req.phone_number).first():
        raise HTTPException(status_code=400, detail="An account with this phone number already exists")

    if req.case_number and db.query(User).filter(User.case_number == req.case_number).first():
        raise HTTPException(status_code=400, detail="This case number is already linked to another account")

    user = User(
        phone_number=req.phone_number,
        password_hash=hash_password(req.password),
        case_number=req.case_number or None,
    )
    db.add(user)
    db.commit()
    db.refresh(user)

    return AuthResponse(
        access_token=create_access_token(user.id),
        user_id=user.id,
        phone_number=user.phone_number,
        case_number=user.case_number,
    )


@app.post("/auth/login", response_model=AuthResponse)
def login(req: LoginRequest, db: Session = Depends(get_db)):
    user = db.query(User).filter(User.phone_number == req.phone_number).first()
    if not user or not verify_password(req.password, user.password_hash):
        raise HTTPException(status_code=401, detail="Incorrect phone number or password")

    return AuthResponse(
        access_token=create_access_token(user.id),
        user_id=user.id,
        phone_number=user.phone_number,
        case_number=user.case_number,
    )


@app.get("/auth/me", response_model=ProfileResponse)
def get_profile(current_user: User = Depends(get_current_user)):
    return ProfileResponse(
        user_id=current_user.id,
        phone_number=current_user.phone_number,
        case_number=current_user.case_number,
        member_since=current_user.created_at.isoformat(),
    )


@app.patch("/auth/me", response_model=ProfileResponse)
def update_profile(
    req: UpdateProfileRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    if req.case_number:
        taken = db.query(User).filter(User.case_number == req.case_number, User.id != current_user.id).first()
        if taken:
            raise HTTPException(status_code=400, detail="This case number is already linked to another account")
        current_user.case_number = req.case_number
        db.commit()
        db.refresh(current_user)

    return ProfileResponse(
        user_id=current_user.id,
        phone_number=current_user.phone_number,
        case_number=current_user.case_number,
        member_since=current_user.created_at.isoformat(),
    )


# ---------------------------------------------------------------------------
# Older two-step endpoints (kept for compatibility)
# ---------------------------------------------------------------------------

@app.post("/detect-problem", response_model=DetectProblemResponse)
def detect_problem(req: DetectProblemRequest):
    return gemini.detect_problem(req.text)


@app.post("/explain-rights", response_model=ExplainRightsResponse)
def explain_rights(
    req: ExplainRightsRequest,
    current_user: User | None = Depends(get_optional_user),
    db: Session = Depends(get_db),
):
    result = gemini.explain_rights(req.category, req.text)
    if current_user:
        db.add(
            History(
                user_id=current_user.id,
                interaction_type="rights_explained",
                category=req.category,
                input_text=req.text,
                result_summary=result.get("summary", ""),
            )
        )
        db.commit()
    return result


# ---------------------------------------------------------------------------
# Complaint letter
# ---------------------------------------------------------------------------

@app.post("/generate-complaint", response_model=GenerateComplaintResponse)
def generate_complaint(
    req: GenerateComplaintRequest,
    current_user: User | None = Depends(get_optional_user),
    db: Session = Depends(get_db),
):
    result = gemini.generate_complaint(req.category, req.text, req.user_name, req.authority)
    if current_user:
        db.add(
            History(
                user_id=current_user.id,
                interaction_type="complaint_generated",
                category=req.category,
                input_text=req.text,
                result_summary=result["letter_text"][:300],
            )
        )
        db.commit()
    return result


@app.post("/generate-complaint/pdf")
def generate_complaint_pdf(req: GenerateComplaintRequest):
    result = gemini.generate_complaint(req.category, req.text, req.user_name, req.authority)
    pdf_bytes = letter_to_pdf_bytes(result["letter_text"], title=f"Complaint - {req.category}")
    return Response(
        content=pdf_bytes,
        media_type="application/pdf",
        headers={"Content-Disposition": "attachment; filename=complaint_letter.pdf"},
    )


@app.post("/simplify-order", response_model=SimplifyOrderResponse)
def simplify_order(req: SimplifyOrderRequest):
    return gemini.simplify_court_order(req.order_text)



@app.post("/simplify-order-pdf")
async def simplify_order_pdf(
    req: SimplifyPdfRequest,
    current_user: User = Depends(get_current_user),
):
    try:
        pdf_bytes = base64.b64decode(
            req.pdf_base64,
            validate=True,
        )

        if len(pdf_bytes) > 10 * 1024 * 1024:
            raise HTTPException(
                status_code=413,
                detail="PDF must be smaller than 10 MB.",
            )

        if not pdf_bytes.startswith(b"%PDF-"):
            raise HTTPException(
                status_code=400,
                detail="The uploaded file is not a valid PDF.",
            )

        reader = PdfReader(BytesIO(pdf_bytes))
        order_text = "\n".join(
            page.extract_text() or ""
            for page in reader.pages
        ).strip()

        if not order_text:
            raise HTTPException(
                status_code=422,
                detail="No readable text found. This PDF may need OCR.",
            )

        return gemini.simplify_court_order(order_text)

    except HTTPException:
        raise
    except (ValueError, binascii.Error):
        raise HTTPException(
            status_code=400,
            detail="Unable to decode the uploaded PDF.",
        )
    except Exception:
        raise HTTPException(
            status_code=500,
            detail="Unable to process this PDF. Please try another file.",
        )



# ---------------------------------------------------------------------------
# History
# ---------------------------------------------------------------------------

@app.get("/history", response_model=list[HistoryItem])
def get_history(current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    rows = (
        db.query(History)
        .filter(History.user_id == current_user.id)
        .order_by(History.created_at.desc())
        .all()
    )
    return [
        HistoryItem(
            id=r.id,
            interaction_type=r.interaction_type,
            category=r.category,
            input_text=r.input_text,
            result_summary=r.result_summary,
            created_at=r.created_at.isoformat(),
        )
        for r in rows
    ]


@app.get("/history/summary", response_model=HistorySummaryResponse)
def get_history_summary(current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    rows = db.query(History).filter(History.user_id == current_user.id).all()
    categories: dict[str, int] = {}
    for r in rows:
        if r.category:
            categories[r.category] = categories.get(r.category, 0) + 1
    timestamps = sorted(r.created_at for r in rows)
    return HistorySummaryResponse(
        total_interactions=len(rows),
        complaints_generated=sum(1 for r in rows if r.interaction_type == "complaint_generated"),
        rights_explained=sum(1 for r in rows if r.interaction_type == "rights_explained"),
        categories=categories,
        first_interaction=timestamps[0].isoformat() if timestamps else None,
        latest_interaction=timestamps[-1].isoformat() if timestamps else None,
    )



# ---------------------------------------------------------------------------

# LitiTrack - saved court cases
# ---------------------------------------------------------------------------

import re


@app.get("/lititrack/cases", response_model=list[SavedCaseResponse])
def list_saved_cases(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    cases = (
        db.query(SavedCase)
        .filter(SavedCase.user_id == current_user.id)
        .order_by(SavedCase.created_at.desc())
        .all()
    )

    return [
        SavedCaseResponse(
            id=case.id,
            cnr=case.cnr,
            nickname=case.nickname,
            created_at=case.created_at.isoformat(),
        )
        for case in cases
    ]


@app.post("/lititrack/cases", response_model=SavedCaseResponse, status_code=201)
def save_case(
    req: SaveCaseRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    cnr = req.cnr.strip().upper()

    if not re.fullmatch(r"[A-Z0-9]{16}", cnr):
        raise HTTPException(
            status_code=400,
            detail="CNR must contain exactly 16 letters and digits.",
        )

    existing = (
        db.query(SavedCase)
        .filter(
            SavedCase.user_id == current_user.id,
            SavedCase.cnr == cnr,
        )
        .first()
    )

    if existing:
        raise HTTPException(
            status_code=409,
            detail="This case is already saved.",
        )

    nickname = (req.nickname or "").strip() or None

    case = SavedCase(
        user_id=current_user.id,
        cnr=cnr,
        nickname=nickname,
    )

    db.add(case)
    db.commit()
    db.refresh(case)

    return SavedCaseResponse(
        id=case.id,
        cnr=case.cnr,
        nickname=case.nickname,
        created_at=case.created_at.isoformat(),
    )


@app.delete("/lititrack/cases/{case_id}")
def delete_saved_case(
    case_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    case = (
        db.query(SavedCase)
        .filter(
            SavedCase.id == case_id,
            SavedCase.user_id == current_user.id,
        )
        .first()
    )

    if not case:
        raise HTTPException(
            status_code=404,
            detail="Saved case not found.",
        )

    db.delete(case)
    db.commit()

    return {"deleted": True}


# ---------------------------------------------------------------------------
# LitiTrack - optional live case lookup (eCourtsIndia partner API)
# The token stays on the backend; the mobile app never receives it.
# ---------------------------------------------------------------------------

@app.get("/lititrack/live-case/{cnr}")
def get_live_case(
    cnr: str,
    current_user: User = Depends(get_current_user),
):
    api_key = os.getenv("ECOURTSINDIA_API_KEY", "").strip()
    if not api_key:
        raise HTTPException(
            status_code=503,
            detail="Live case lookup is not configured yet. Add ECOURTSINDIA_API_KEY to the backend .env file.",
        )

    normalized_cnr = cnr.strip().upper()
    # eCourtsIndia documentation specifies four letters followed by 12 digits.
    if not re.fullmatch(r"[A-Z]{4}\d{12}", normalized_cnr):
        raise HTTPException(
            status_code=400,
            detail="For live lookup, enter a valid 16-character CNR: 4 letters followed by 12 digits.",
        )

    url = f"https://webapi.ecourtsindia.com/api/partner/case/{normalized_cnr}"
    request = urllib.request.Request(
        url,
        headers={"Authorization": f"Bearer {api_key}", "Accept": "application/json"},
        method="GET",
    )

    try:
        with urllib.request.urlopen(request, timeout=25) as response:
            payload = json.loads(response.read().decode("utf-8"))
            return payload
    except urllib.error.HTTPError as exc:
        response_body = exc.read().decode("utf-8", errors="replace")
        if exc.code in (401, 403):
            raise HTTPException(status_code=502, detail="eCourtsIndia rejected the API token. Check ECOURTSINDIA_API_KEY in the backend .env file.")
        if exc.code == 404:
            raise HTTPException(status_code=404, detail="No case details were found for this CNR in the API.")
        if exc.code == 402:
            raise HTTPException(status_code=402, detail="The eCourtsIndia API reports insufficient credits. Check your API Usage dashboard.")
        if exc.code == 429:
            raise HTTPException(status_code=429, detail="The eCourtsIndia API rate limit was reached. Please wait and try again.")
        logging.warning("eCourtsIndia API returned HTTP %s: %s", exc.code, response_body[:500])
        raise HTTPException(status_code=502, detail=f"eCourtsIndia API request failed (HTTP {exc.code}). Please try again later.")
    except urllib.error.URLError:
        raise HTTPException(status_code=502, detail="Could not connect to eCourtsIndia. Please try again later.")
    except (TimeoutError, json.JSONDecodeError):
        raise HTTPException(status_code=502, detail="eCourtsIndia took too long to respond or returned invalid data.")
