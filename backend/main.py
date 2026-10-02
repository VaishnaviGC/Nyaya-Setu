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
import logging
from contextlib import asynccontextmanager
from dotenv import load_dotenv

load_dotenv()  # must run BEFORE importing gemini_service, which reads env vars at import time

from fastapi import FastAPI, HTTPException, Depends, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import Response, JSONResponse
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session

import gemini_service as gemini
from pdf_service import letter_to_pdf_bytes
from database import get_db, init_db
from models import User, History
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