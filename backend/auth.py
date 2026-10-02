"""
Authentication: password hashing + JWT tokens.

Flow:
  1. /auth/register or /auth/login returns a signed JWT "access token".
  2. The frontend stores that token and sends it as
     `Authorization: Bearer <token>` on every request after that.
  3. get_current_user() (a FastAPI dependency) decodes the token and loads
     the matching User row from the database.
  4. get_optional_user() is the same but returns None instead of raising an
     error when there's no token - used on endpoints that work for both
     logged-in and logged-out users (e.g. explain-rights still works
     without an account, it just won't be saved to History).
"""

import os
import bcrypt
import jwt
from datetime import datetime, timedelta, timezone
from fastapi import Depends, HTTPException, Header
from sqlalchemy.orm import Session

from database import get_db
from models import User

# In a real deployment, set JWT_SECRET_KEY to a long random value via
# environment variable / .env - never commit a real secret to git.
JWT_SECRET_KEY = os.environ.get("JWT_SECRET_KEY", "dev-secret-change-me-before-deploying")
JWT_ALGORITHM = "HS256"
JWT_EXPIRY_HOURS = 24 * 30  # 30 days - fine for a student project demo


def hash_password(password: str) -> str:
    return bcrypt.hashpw(password.encode("utf-8"), bcrypt.gensalt()).decode("utf-8")


def verify_password(password: str, password_hash: str) -> bool:
    return bcrypt.checkpw(password.encode("utf-8"), password_hash.encode("utf-8"))


def create_access_token(user_id: int) -> str:
    payload = {
        "sub": str(user_id),
        "exp": datetime.now(timezone.utc) + timedelta(hours=JWT_EXPIRY_HOURS),
    }
    return jwt.encode(payload, JWT_SECRET_KEY, algorithm=JWT_ALGORITHM)


def _decode_token(token: str) -> int:
    try:
        payload = jwt.decode(token, JWT_SECRET_KEY, algorithms=[JWT_ALGORITHM])
        return int(payload["sub"])
    except jwt.ExpiredSignatureError:
        raise HTTPException(status_code=401, detail="Session expired, please log in again")
    except (jwt.InvalidTokenError, KeyError, ValueError):
        raise HTTPException(status_code=401, detail="Invalid authentication token")


def _extract_token(authorization: str | None) -> str | None:
    if not authorization:
        return None
    parts = authorization.split(" ", 1)
    if len(parts) != 2 or parts[0].lower() != "bearer":
        return None
    return parts[1]


def get_current_user(
    authorization: str | None = Header(default=None), db: Session = Depends(get_db)
) -> User:
    """Use as a dependency on endpoints that REQUIRE login."""
    token = _extract_token(authorization)
    if not token:
        raise HTTPException(status_code=401, detail="Not logged in")
    user_id = _decode_token(token)
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=401, detail="User not found")
    return user


def get_optional_user(
    authorization: str | None = Header(default=None), db: Session = Depends(get_db)
) -> User | None:
    """Use as a dependency on endpoints where login is OPTIONAL."""
    token = _extract_token(authorization)
    if not token:
        return None
    try:
        user_id = _decode_token(token)
    except HTTPException:
        return None  # bad/expired token on an optional endpoint - just proceed as logged out
    return db.query(User).filter(User.id == user_id).first()
