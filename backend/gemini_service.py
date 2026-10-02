import os
import re
import json
import time
import logging

from laws_reference import get_reference_for, CATEGORIES

logger = logging.getLogger("nyaya.gemini")


# ============================================================
# ENVIRONMENT
# ============================================================

GEMINI_API_KEY = os.environ.get("GEMINI_API_KEY", "").strip()
GEMINI_MODEL = os.environ.get(
    "GEMINI_MODEL",
    "gemini-3.8-flash"
).strip()

FALLBACK_MODEL = os.environ.get(
    "GEMINI_FALLBACK_MODEL",
    "gemini-3.5-flash-lite"
).strip()

GROQ_API_KEY = os.environ.get("GROQ_API_KEY", "").strip()

GROQ_MODEL = os.environ.get(
    "GROQ_MODEL",
    "openai/gpt-oss-20b"
).strip()

GROQ_STT_MODEL = os.environ.get(
    "GROQ_STT_MODEL",
    "whisper-large-v3-turbo"
).strip()


# ============================================================
# CLIENTS
# ============================================================

_groq_client = None
_gemini_client = None
_gemini_types = None

MOCK_MODE = True


# -------------------------
# Groq
# -------------------------

if GROQ_API_KEY:
    try:
        from groq import Groq

        _groq_client = Groq(
            api_key=GROQ_API_KEY
        )

        MOCK_MODE = False

        logger.info(
            "Groq client initialised: model=%s stt=%s",
            GROQ_MODEL,
            GROQ_STT_MODEL,
        )

    except Exception as exc:
        logger.warning(
            "Groq initialisation failed: %s",
            exc
        )


# -------------------------
# Gemini fallback
# -------------------------

if GEMINI_API_KEY:
    try:
        from google import genai
        from google.genai import types as genai_types

        _gemini_client = genai.Client(
            api_key=GEMINI_API_KEY
        )

        _gemini_types = genai_types

        logger.info(
            "Gemini fallback initialised: model=%s fallback=%s",
            GEMINI_MODEL,
            FALLBACK_MODEL or "none",
        )

        # Gemini can also work if Groq is unavailable.
        if _groq_client is None:
            MOCK_MODE = False

    except Exception as exc:
        logger.warning(
            "Gemini fallback initialisation failed: %s",
            exc
        )


if not _groq_client and not _gemini_client:
    logger.warning(
        "No AI API configured - running in MOCK MODE"
    )


# ============================================================
# EXCEPTION
# ============================================================

class GeminiUnavailable(Exception):
    """
    Kept with the same name so main.py does not need to change.
    """

    def __init__(self, user_message: str):
        super().__init__(user_message)
        self.user_message = user_message


# ============================================================
# CONSTANTS
# ============================================================

_RETRYABLE_CODES = {
    429,
    500,
    502,
    503,
    504,
}

_RETRY_DELAYS = [1, 3]


LANGUAGE_NAMES = {
    "en-IN": "English",
    "hi-IN": "Hindi (Devanagari script)",
    "kn-IN": "Kannada (Kannada script)",
}


_LANGUAGE_ALIASES = {
    "english": "en",
    "hindi": "hi",
    "kannada": "kn",
    "tamil": "ta",
    "telugu": "te",
    "malayalam": "ml",
    "marathi": "mr",
    "bengali": "bn",
    "gujarati": "gu",
    "punjabi": "pa",
}


# ============================================================
# ERROR HANDLING
# ============================================================

def _friendly_error(exc) -> str:

    code = getattr(exc, "code", None)
    text = str(exc)

    if code == 429 or "RESOURCE_EXHAUSTED" in text:

        return (
            "The AI service is temporarily busy. "
            "Please try again in a few seconds."
        )

    if code == 404 or "NOT_FOUND" in text:

        return (
            "The configured AI model is unavailable. "
            "Please check the backend model configuration."
        )

    if code in (401, 403):

        return (
            "The AI API key was rejected. "
            "Please check the backend API configuration."
        )

    if "API key" in text or "PERMISSION_DENIED" in text:

        return (
            "The AI API key was rejected. "
            "Please check the backend API configuration."
        )

    if code == 400:

        return (
            "The AI could not process this request. "
            "Please try again."
        )

    if code in {500, 502, 503, 504}:

        return (
            "The AI service is temporarily unavailable. "
            "Please try again in a moment."
        )

    return (
        "The AI service encountered an unexpected error. "
        "Please try again."
    )


# ============================================================
# GROQ CHAT COMPLETION
# ============================================================

def _call_groq(
    prompt: str,
    json_mode: bool = False,
) -> str:

    if not _groq_client:
        raise RuntimeError("Groq client is not configured.")

    last_error = None

    for attempt in range(len(_RETRY_DELAYS) + 1):

        try:

            kwargs = {
                "model": GROQ_MODEL,
                "messages": [
                    {
                        "role": "user",
                        "content": prompt,
                    }
                ],
                "temperature": 0.2,
            }

            if json_mode:
                kwargs["response_format"] = {
                    "type": "json_object"
                }

            response = (
                _groq_client
                .chat
                .completions
                .create(**kwargs)
            )

            text = (
                response
                .choices[0]
                .message
                .content
                or ""
            ).strip()

            if not text:
                raise RuntimeError(
                    "Groq returned an empty response."
                )

            logger.info(
                "Answered using Groq model=%s",
                GROQ_MODEL,
            )

            return text

        except Exception as exc:

            last_error = exc

            logger.warning(
                "Groq request failed attempt=%s: %s",
                attempt + 1,
                exc,
            )

            if attempt < len(_RETRY_DELAYS):

                time.sleep(
                    _RETRY_DELAYS[attempt]
                )

    raise last_error


# ============================================================
# GEMINI FALLBACK
# ============================================================

def _call_gemini_fallback(
    prompt: str,
    json_mode: bool = False,
) -> str:

    if not _gemini_client:
        raise RuntimeError(
            "Gemini fallback is not configured."
        )

    models = [
        GEMINI_MODEL
    ]

    if (
        FALLBACK_MODEL
        and FALLBACK_MODEL != GEMINI_MODEL
    ):
        models.append(FALLBACK_MODEL)

    first_error = None

    for index, model in enumerate(models):

        for attempt in range(
            len(_RETRY_DELAYS) + 1
        ):

            try:

                config = None

                if json_mode:

                    config = (
                        _gemini_types
                        .GenerateContentConfig(
                            response_mime_type="application/json"
                        )
                    )

                response = (
                    _gemini_client
                    .models
                    .generate_content(
                        model=model,
                        contents=[prompt],
                        config=config,
                    )
                )

                text = (
                    getattr(
                        response,
                        "text",
                        None
                    )
                    or ""
                ).strip()

                if text:

                    logger.warning(
                        "Gemini fallback used: %s",
                        model,
                    )

                    return text

                raise RuntimeError(
                    "Gemini returned an empty response."
                )

            except Exception as exc:

                first_error = (
                    first_error or exc
                )

                code = getattr(
                    exc,
                    "code",
                    None
                )

                text_error = str(exc)

                temporary = (
                    code in _RETRYABLE_CODES
                    or "RESOURCE_EXHAUSTED"
                    in text_error
                )

                if (
                    temporary
                    and attempt < len(_RETRY_DELAYS)
                ):

                    time.sleep(
                        _RETRY_DELAYS[attempt]
                    )

                    continue

                if (
                    temporary
                    and index < len(models) - 1
                ):

                    logger.warning(
                        "Gemini model %s unavailable. "
                        "Switching to %s.",
                        model,
                        models[index + 1],
                    )

                    break

                break

    raise first_error


# ============================================================
# UNIFIED AI CALL
# ============================================================

def _call_gemini_multimodal(
    parts: list,
    json_mode: bool = False,
) -> str:

    """
    Kept with the original function name so the rest
    of the project does not need to change.

    Priority:

        1. Groq
        2. Gemini fallback
    """

    # Convert existing prompt parts into text.
    text_parts = []

    for part in parts:

        if isinstance(part, str):
            text_parts.append(part)

    prompt = "\n".join(
        text_parts
    ).strip()

    # --------------------------------------------------------
    # GROQ PRIMARY
    # --------------------------------------------------------

    if _groq_client:

        try:

            return _call_groq(
                prompt,
                json_mode=json_mode,
            )

        except Exception as exc:

            logger.warning(
                "Groq primary failed. "
                "Trying Gemini fallback: %s",
                exc,
            )

    # --------------------------------------------------------
    # GEMINI FALLBACK
    # --------------------------------------------------------

    if _gemini_client:

        try:

            return _call_gemini_fallback(
                prompt,
                json_mode=json_mode,
            )

        except Exception as exc:

            logger.warning(
                "Gemini fallback also failed: %s",
                exc,
            )

            raise GeminiUnavailable(
                _friendly_error(exc)
            ) from exc

    raise GeminiUnavailable(
        "No AI service is configured. "
        "Please check the backend API keys."
    )


# ============================================================
# SIMPLE CALL
# ============================================================

def _call_gemini(prompt: str) -> str:

    return _call_gemini_multimodal(
        [prompt]
    )


# ============================================================
# JSON EXTRACTION
# ============================================================

def _extract_json(text: str) -> dict:

    cleaned = text.strip()

    if cleaned.startswith("```"):

        cleaned = cleaned.strip("`")

        if "\n" in cleaned:

            cleaned = cleaned.split(
                "\n",
                1
            )[1]

        if cleaned.lower().startswith(
            "json"
        ):

            cleaned = cleaned[4:]

    data = json.loads(
        cleaned.strip()
    )

    if not isinstance(data, dict):

        raise ValueError(
            "Expected a JSON object."
        )

    return data


def _call_json(parts: list) -> dict:

    raw = _call_gemini_multimodal(
        parts,
        json_mode=True,
    )

    try:

        return _extract_json(raw)

    except ValueError:

        logger.error(
            "AI returned unreadable JSON: %s",
            raw[:300],
        )

        raise GeminiUnavailable(
            "The AI returned an unreadable answer. "
            "Please try again."
        )


# ============================================================
# HELPERS
# ============================================================

def _as_str_list(value) -> list:

    if not isinstance(value, list):
        return []

    return [
        str(v).strip()
        for v in value
        if str(v).strip()
    ]


def _normalize_language(code) -> str:

    code = str(
        code or ""
    ).strip().replace(
        "_",
        "-"
    )

    base = code.split(
        "-"
    )[0].lower()

    base = _LANGUAGE_ALIASES.get(
        base,
        base,
    )

    if (
        len(base) != 2
        or not base.isalpha()
    ):

        base = "en"

    return f"{base}-IN"


# ============================================================
# ANALYZE TEXT
# ============================================================

def analyze_text(
    user_text: str,
    reply_language: str = "auto",
) -> dict:

    if MOCK_MODE:

        return _mock_analyze_text(
            user_text
        )

    if reply_language in LANGUAGE_NAMES:

        language_rule = (
            f"Write ALL user-facing text in "
            f"{LANGUAGE_NAMES[reply_language]}."
        )

    else:

        language_rule = (
            "Detect the language the person used "
            "(Kannada, Hindi, English, or a mix) "
            "and write ALL user-facing text in "
            "that same language and script. "
            "If they mixed Kannada and English, "
            "answer in Kannada. Never write "
            "Kannada or Hindi in Latin letters."
        )

    all_laws = "\n".join(
        f"### {c}\n{get_reference_for(c)}"
        for c in CATEGORIES
    )

    prompt = f"""
You are Nyaya Setu, a warm, patient legal-aid
assistant for ordinary people in India.

Talk like a kind, knowledgeable elder sibling:
simple everyday words and no unnecessary jargon.

The person's message may come from speech-to-text,
so expect typos or unusual spellings.

PERSON'S MESSAGE:
\"\"\"
{user_text}
\"\"\"

STEP 1:
Classify the problem into exactly ONE category:

{", ".join(CATEGORIES)}

STEP 2:
{language_rule}

When a legal or office term matters
(RTC, Pahani, mutation, partition suit,
sale deed, etc.), keep the term and add
the English term in brackets.

STEP 3:
Base every legal statement ONLY on the
reference laws below.

Never invent sections, courts, fees or
time limits.

If something depends on the state or facts,
clearly say that it should be confirmed
with the appropriate authority or lawyer.

REFERENCE LAWS:

{all_laws}

Be specific to THIS person's facts.

Be concise:

3-5 rights
4-6 next steps
4-6 documents
3-4 questions

Each item should be 1-2 sentences.

Respond with JSON in exactly this shape:

{{
  "category": "<one category>",
  "confidence": "<low|medium|high>",
  "language": "<kn-IN|hi-IN|en-IN>",
  "understood": "<2-3 sentences explaining the problem>",
  "summary": "<2-4 sentences explaining the situation>",
  "rights": [
    {{
      "law": "<law name and section>",
      "explanation": "<how it may help>"
    }}
  ],
  "next_steps": [
    "<concrete step>"
  ],
  "documents": [
    "<document or evidence>"
  ],
  "questions": [
    "<important follow-up question>"
  ],
  "disclaimer": "<general legal guidance disclaimer>"
}}
"""

    data = _call_json(
        [prompt]
    )

    forced = (
        reply_language
        if reply_language in LANGUAGE_NAMES
        else None
    )

    return _normalize_analysis(
        data,
        forced,
    )


# ============================================================
# NORMALIZE ANALYSIS
# ============================================================

def _normalize_analysis(
    data: dict,
    forced_language,
) -> dict:

    category = data.get(
        "category"
    )

    if category not in CATEGORIES:

        category = "Other"

    rights = []

    for item in (
        data.get("rights") or []
    ):

        if isinstance(
            item,
            dict
        ):

            law = str(
                item.get("law", "")
            ).strip()

            explanation = str(
                item.get(
                    "explanation",
                    ""
                )
            ).strip()

            if law or explanation:

                rights.append(
                    {
                        "law": law,
                        "explanation": explanation,
                    }
                )

    return {
        "category": category,

        "confidence": str(
            data.get("confidence")
            or "medium"
        ).lower(),

        "language": (
            forced_language
            or _normalize_language(
                data.get("language")
            )
        ),

        "understood": str(
            data.get("understood")
            or ""
        ).strip(),

        "summary": str(
            data.get("summary")
            or ""
        ).strip(),

        "rights": rights,

        "next_steps": _as_str_list(
            data.get("next_steps")
        ),

        "documents": _as_str_list(
            data.get("documents")
        ),

        "questions": _as_str_list(
            data.get("questions")
        ),

        "disclaimer": str(
            data.get("disclaimer")
            or ""
        ).strip(),
    }


# ============================================================
# MOCK ANALYSIS
# ============================================================

def _mock_analyze_text(
    user_text: str
) -> dict:

    base = _mock_detect_problem(
        user_text
    )

    rights = _mock_explain_rights(
        base["category"]
    )

    return {
        "category": base["category"],
        "confidence": base["confidence"],
        "language": "en-IN",
        "understood": base["explanation"],
        "summary": rights["summary"],
        "rights": rights["rights"],
        "next_steps": rights["next_steps"],
        "documents": [
            "Any written records, receipts or photos related to the problem. (mock mode)"
        ],
        "questions": [
            "Add a real AI API key to get personalised follow-up questions."
        ],
        "disclaimer": (
            "Placeholder text (mock mode) - not legal advice."
        ),
    }


# ============================================================
# VOICE TRANSCRIPTION
# ============================================================

def transcribe_and_detect(
    audio_bytes: bytes,
    mime_type: str
) -> dict:

    if not audio_bytes:

        raise GeminiUnavailable(
            "No audio was received. "
            "Please record your problem again."
        )

    # --------------------------------------------------------
    # GROQ WHISPER - PRIMARY
    # --------------------------------------------------------

    if _groq_client:

        try:

            import tempfile
            import os

            suffix = ".m4a"

            if "wav" in mime_type:
                suffix = ".wav"

            elif (
                "mp3" in mime_type
                or "mpeg" in mime_type
            ):
                suffix = ".mp3"

            elif "ogg" in mime_type:
                suffix = ".ogg"

            elif "webm" in mime_type:
                suffix = ".webm"

            temp_path = None

            try:

                with tempfile.NamedTemporaryFile(
                    suffix=suffix,
                    delete=False
                ) as f:

                    f.write(audio_bytes)
                    temp_path = f.name

                logger.info(
                    "Sending audio to Groq Whisper: "
                    "%s bytes, mime=%s",
                    len(audio_bytes),
                    mime_type,
                )

                with open(
                    temp_path,
                    "rb"
                ) as audio_file:

                    transcription = (
                        _groq_client
                        .audio
                        .transcriptions
                        .create(
                            file=audio_file,
                            model=GROQ_STT_MODEL,
                            response_format="json",
                            temperature=0,
                        )
                    )

                transcript = (
                    getattr(
                        transcription,
                        "text",
                        None
                    )
                    or ""
                ).strip()

                logger.info(
                    "Groq transcript: %r",
                    transcript,
                )

                if transcript:

                    # Determine category using
                    # the existing legal AI pipeline.
                    try:

                        analysis = analyze_text(
                            transcript,
                            "auto"
                        )

                        category = analysis[
                            "category"
                        ]

                        explanation = analysis[
                            "understood"
                        ]

                        confidence = analysis[
                            "confidence"
                        ]

                    except Exception as exc:

                        logger.warning(
                            "Could not classify "
                            "transcript immediately: %s",
                            exc,
                        )

                        category = "Other"
                        explanation = (
                            "Speech was transcribed successfully. "
                            "You can continue to analyse the problem."
                        )
                        confidence = "medium"

                    return {
                        "transcript": transcript,
                        "category": category,
                        "explanation": explanation,
                        "confidence": confidence,
                    }

            finally:

                if temp_path:

                    try:
                        os.remove(
                            temp_path
                        )
                    except Exception:
                        pass

        except Exception as exc:

            logger.exception(
                "Groq transcription failed: %s",
                exc,
            )

            # Do NOT immediately show an error.
            # Try Gemini transcription fallback below.

    # --------------------------------------------------------
    # GEMINI TRANSCRIPTION FALLBACK
    # --------------------------------------------------------

    if _gemini_client:

        try:

            prompt = f"""
You are a legal-aid assistant.

You will receive an audio recording of
someone describing a legal problem.

The person may speak:

- Kannada
- Hindi
- English
- mixed Kannada-English
- mixed Hindi-English

Transcribe the speech accurately in its
ORIGINAL language and script.

Do NOT translate.

Kannada speech must remain in Kannada script.
Hindi speech must remain in Devanagari.

Then classify the problem into exactly one:

{", ".join(CATEGORIES)}

If the audio is silent or there is no
understandable speech, return an empty
transcript.

Return JSON:

{{
  "transcript": "",
  "category": "Other",
  "explanation": "",
  "confidence": "low"
}}
"""

            if _gemini_types:

                audio_part = (
                    _gemini_types
                    .Part
                    .from_bytes(
                        data=audio_bytes,
                        mime_type=mime_type,
                    )
                )

                data = _call_gemini_multimodal(
                    [
                        prompt,
                        audio_part,
                    ],
                    json_mode=True,
                )

                parsed = _extract_json(
                    data
                )

                category = parsed.get(
                    "category",
                    "Other"
                )

                if category not in CATEGORIES:

                    category = "Other"

                return {
                    "transcript": str(
                        parsed.get(
                            "transcript"
                        )
                        or ""
                    ).strip(),

                    "category": category,

                    "explanation": str(
                        parsed.get(
                            "explanation"
                        )
                        or ""
                    ),

                    "confidence": str(
                        parsed.get(
                            "confidence"
                        )
                        or "low"
                    ),
                }

        except Exception as exc:

            logger.exception(
                "Gemini transcription fallback failed: %s",
                exc,
            )

    # --------------------------------------------------------
    # NOTHING WORKED
    # --------------------------------------------------------

    raise GeminiUnavailable(
        "Speech transcription is temporarily unavailable. "
        "Please try again or type your problem."
    )


# ============================================================
# DETECT PROBLEM
# ============================================================

def detect_problem(
    user_text: str
) -> dict:

    if MOCK_MODE:

        return _mock_detect_problem(
            user_text
        )

    prompt = f"""
You are a warm legal-aid assistant
for everyday Indians.

The text may come from speech-to-text
and contain typos.

Classify the problem into EXACTLY ONE:

{", ".join(CATEGORIES)}

Use "Other" only if there is no useful clue.

Respond with JSON:

{{
  "category": "<category>",
  "explanation": "<1-2 plain sentences>",
  "confidence": "<low|medium|high>"
}}

Problem:

\"\"\"
{user_text}
\"\"\"
"""

    data = _call_json(
        [prompt]
    )

    if data.get(
        "category"
    ) not in CATEGORIES:

        data["category"] = "Other"

    return {
        "category": data[
            "category"
        ],

        "explanation": str(
            data.get(
                "explanation"
            )
            or ""
        ),

        "confidence": str(
            data.get(
                "confidence"
            )
            or "medium"
        ),
    }


# ============================================================
# MOCK DETECT PROBLEM
# ============================================================

def _mock_detect_problem(
    user_text: str
) -> dict:

    text = user_text.lower()

    rules = [

        (
            "Domestic Violence",
            [
                "husband",
                "beat",
                "dowry",
                "abuse",
                "hit me",
                "wife",
            ],
        ),

        (
            "Labour Issue",
            [
                "salary",
                "wages",
                "fired",
                "employer",
                "job",
                "termination",
                "pf",
            ],
        ),

        (
            "Consumer Complaint",
            [
                "refund",
                "product",
                "defective",
                "warranty",
                "online order",
                "shop",
            ],
        ),

        (
            "Land Dispute",
            [
                "land",
                "property",
                "boundary",
                "encroachment",
                "plot",
                "zamin",
                "jameen",
                "inherit",
            ],
        ),

        (
            "RTI",
            [
                "rti",
                "information",
                "government office",
                "application status",
            ],
        ),
    ]

    for category, keywords in rules:

        if any(
            keyword in text
            for keyword in keywords
        ):

            return {
                "category": category,
                "explanation": (
                    f"Looks like a "
                    f"{category.lower()} case."
                ),
                "confidence": "medium",
            }

    return {
        "category": "Other",
        "explanation": (
            "Could not classify this problem."
        ),
        "confidence": "low",
    }


# ============================================================
# EXPLAIN RIGHTS
# ============================================================

def explain_rights(
    category: str,
    user_text: str
) -> dict:

    if MOCK_MODE:

        return _mock_explain_rights(
            category
        )

    prompt = f"""
You are a warm legal-aid assistant
explaining Indian law in simple
everyday language.

Category:
{category}

Situation:
\"\"\"
{user_text}
\"\"\"

Use ONLY these reference laws:

{get_reference_for(category)}

Never invent sections.

Respond with JSON:

{{
  "summary": "<2-4 specific sentences>",
  "rights": [
    {{
      "law": "<law from reference>",
      "explanation": "<how it helps>"
    }}
  ],
  "next_steps": [
    "<specific actionable step>"
  ]
}}
"""

    data = _call_json(
        [prompt]
    )

    return {
        "summary": str(
            data.get(
                "summary"
            )
            or ""
        ),

        "rights": _normalize_analysis(
            {
                "rights": data.get(
                    "rights"
                )
            },
            None,
        )["rights"],

        "next_steps": _as_str_list(
            data.get(
                "next_steps"
            )
        ),
    }


# ============================================================
# MOCK RIGHTS
# ============================================================

def _mock_explain_rights(
    category: str
) -> dict:

    reference = (
        get_reference_for(
            category
        ).split("\n")
    )

    rights = [
        {
            "law": r.lstrip("- "),
            "explanation": (
                "This law may protect "
                "you here."
            ),
        }
        for r in reference[:3]
    ]

    return {
        "summary": (
            f"For a {category.lower()} case, "
            "a few key protections usually "
            "apply under Indian law."
        ),

        "rights": rights,

        "next_steps": [
            "Note down dates, names, and evidence related to the problem.",
            "Consider filing a written complaint with the relevant authority.",
            "Reach out to a legal aid centre if you need free assistance.",
        ],
    }


# ============================================================
# GENERATE COMPLAINT
# ============================================================

def generate_complaint(
    category: str,
    user_text: str,
    user_name: str = "",
    authority: str = "",
) -> dict:

    if MOCK_MODE:

        return _mock_generate_complaint(
            category,
            user_text,
            user_name,
            authority,
        )

    prompt = f"""
Draft a formal, respectful complaint
letter in India.

Category:
{category}

Complainant:
{user_name or "[Your Name]"}

Authority:
{authority or "[Concerned Authority]"}

What happened:

\"\"\"
{user_text}
\"\"\"

Reference laws:

{get_reference_for(category)}

Write the letter in ENGLISH.

Include:

- sender placeholder
- date placeholder
- addressee
- subject
- facts
- relevant law sections
- specific request for action

Plain text only.
No markdown.
"""

    return {
        "letter_text": _call_gemini(
            prompt
        )
    }


# ============================================================
# MOCK COMPLAINT
# ============================================================

def _mock_generate_complaint(
    category: str,
    user_text: str,
    user_name: str,
    authority: str,
) -> dict:

    laws_text = "\n".join(
        get_reference_for(
            category
        ).split("\n")[:2]
    )

    letter = f"""
To,
The {authority or "Concerned Authority"},
[Office Address]

Date: [DD/MM/YYYY]

Subject: Complaint regarding a
{category.lower()} matter

Respected Sir/Madam,

I, {user_name or "[Your Name]"},
wish to bring the following matter
to your kind attention.

{user_text.strip()}

I believe this matter falls under
the following provisions of law:

{laws_text}

I request you to kindly look into
this matter and take appropriate
action at the earliest.

Thanking you,

Yours faithfully,

{user_name or "[Your Name]"}

[Contact Number]
[Address]
"""

    return {
        "letter_text": letter
    }


# ============================================================
# LITITRACK - SIMPLIFY COURT ORDER
# ============================================================

def simplify_court_order(
    order_text: str
) -> dict:

    if MOCK_MODE:

        return {
            "simplified_text": (
                "Please configure an AI API key "
                "to simplify this court order."
            )
        }

    prompt = f"""
Translate the following Indian court
order into simple everyday language.

Stay factually accurate.

Do not add information that is
not present in the original.

Plain text only.

Original order:

\"\"\"
{order_text}
\"\"\"
"""

    return {
        "simplified_text": _call_gemini(
            prompt
        )
    }