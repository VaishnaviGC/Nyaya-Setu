"""
Database models.

User        - one account per person. Logs in with phone_number + password.
              case_number is OPTIONAL: not everyone has a court case yet -
              someone using "I have a legal problem" (Nyaya AI) may never
              get one, while someone using LitiTrack will. They can add or
              update it any time from their profile.

History     - one row per AI interaction (rights explained, complaint
              generated, etc). This is what powers "how has the app helped
              me over time" - a running record tied to the user's account,
              not just stuck on one device like the old localStorage/
              AsyncStorage-only version.
"""

from datetime import datetime, timezone
from sqlalchemy import Column, Integer, String, DateTime, ForeignKey, Text
from sqlalchemy.orm import relationship
from database import Base


class User(Base):
    __tablename__ = "users"

    id = Column(Integer, primary_key=True, index=True)
    phone_number = Column(String(20), unique=True, nullable=False, index=True)
    password_hash = Column(String(255), nullable=False)
    case_number = Column(String(50), unique=True, nullable=True, index=True)
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc))

    history = relationship("History", back_populates="user", cascade="all, delete-orphan")


class History(Base):
    __tablename__ = "history"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False, index=True)
    # e.g. "rights_explained" or "complaint_generated" - lets the summary
    # endpoint break down "how the app helped you" by what kind of help it was.
    interaction_type = Column(String(30), nullable=False)
    category = Column(String(50), nullable=True)  # Land Dispute, Labour Issue, etc.
    input_text = Column(Text, nullable=True)  # what the user originally described
    result_summary = Column(Text, nullable=True)  # short summary of what the AI produced
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc))

    user = relationship("User", back_populates="history")
