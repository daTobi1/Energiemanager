"""
User-Modell — Benutzer fuer JWT-Authentifizierung.
"""

from sqlalchemy import String
from sqlalchemy.orm import Mapped, mapped_column

from app.models.base import Base, TimestampMixin


class User(Base, TimestampMixin):
    """System-Benutzer."""
    __tablename__ = "users"

    username: Mapped[str] = mapped_column(String(100), primary_key=True)
    password_hash: Mapped[str] = mapped_column(String(200))
    role: Mapped[str] = mapped_column(String(20), default="admin")  # admin, viewer
