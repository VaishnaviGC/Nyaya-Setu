"""
Database connection setup.

Uses SQLite - a single file (nyaya_setu.db), zero server setup needed. This
is the right choice for a student project demo: it works out of the box on
any teammate's laptop with no install step, and is trivially portable (the
whole database is just one file you could even zip up and share).

If the team later needs a "real" multi-user production database, only this
file needs to change (swap DATABASE_URL for a Postgres/MySQL URL) - models.py
and auth.py don't need to know or care.
"""

import os
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker, declarative_base

DATABASE_URL = os.environ.get("DATABASE_URL", "sqlite:///./nyaya_setu.db")

# check_same_thread=False is needed because FastAPI can use a different
# thread per request; SQLite otherwise refuses connections across threads.
engine = create_engine(
    DATABASE_URL,
    connect_args={"check_same_thread": False} if DATABASE_URL.startswith("sqlite") else {},
)

SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

Base = declarative_base()


def init_db():
    """Create all tables if they don't already exist. Safe to call every startup."""
    import models  # noqa: F401 - ensures models are registered on Base before create_all

    Base.metadata.create_all(bind=engine)


def get_db():
    """FastAPI dependency - yields a DB session per-request and always closes it."""
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
