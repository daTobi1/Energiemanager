"""
Authentifizierung — JWT Bearer Token + Benutzer-Verwaltung.

Einfache JWT-basierte Auth fuer den Produktiv-Betrieb:
- Erster Benutzer wird bei Erststart automatisch angelegt
- Bearer Token im Authorization-Header
- Access Token (1h) + Refresh Token (7d)
- Optionaler Auth-Bypass fuer lokale Entwicklung

Konfiguration ueber Umgebungsvariablen:
  AUTH_ENABLED=true/false  (Default: false fuer Entwicklung)
  SECRET_KEY=...           (Fuer JWT-Signierung)
"""

import logging
from datetime import datetime, timedelta, timezone
from typing import Annotated

from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
import bcrypt
from jose import JWTError, jwt
from sqlalchemy import select

from app.config import settings
from app.core.database import async_session

logger = logging.getLogger(__name__)

# JWT-Konfiguration
ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_MINUTES = 60
REFRESH_TOKEN_EXPIRE_DAYS = 7

# Bearer-Token Extraktion (optional)
bearer_scheme = HTTPBearer(auto_error=False)


def hash_password(password: str) -> str:
    """Hasht ein Passwort mit bcrypt."""
    salt = bcrypt.gensalt()
    return bcrypt.hashpw(password.encode("utf-8"), salt).decode("utf-8")


def verify_password(plain: str, hashed: str) -> bool:
    """Prueft ein Passwort gegen den Hash."""
    return bcrypt.checkpw(plain.encode("utf-8"), hashed.encode("utf-8"))


def create_access_token(username: str) -> str:
    """Erstellt einen JWT Access Token."""
    expire = datetime.now(timezone.utc) + timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)
    return jwt.encode(
        {"sub": username, "exp": expire, "type": "access"},
        settings.secret_key,
        algorithm=ALGORITHM,
    )


def create_refresh_token(username: str) -> str:
    """Erstellt einen JWT Refresh Token."""
    expire = datetime.now(timezone.utc) + timedelta(days=REFRESH_TOKEN_EXPIRE_DAYS)
    return jwt.encode(
        {"sub": username, "exp": expire, "type": "refresh"},
        settings.secret_key,
        algorithm=ALGORITHM,
    )


def decode_token(token: str) -> dict | None:
    """Dekodiert und validiert einen JWT Token."""
    try:
        payload = jwt.decode(token, settings.secret_key, algorithms=[ALGORITHM])
        return payload
    except JWTError:
        return None


async def authenticate_user(username: str, password: str) -> dict | None:
    """Authentifiziert einen Benutzer gegen die DB."""
    from app.models.user import User

    async with async_session() as db:
        result = await db.execute(select(User).where(User.username == username))
        user = result.scalar_one_or_none()

        if not user or not verify_password(password, user.password_hash):
            return None

        return {"username": user.username, "role": user.role}


def _is_auth_enabled() -> bool:
    """Prueft ob Auth aktiviert ist (Default: aus fuer Entwicklung)."""
    import os
    return os.environ.get("AUTH_ENABLED", "false").lower() in ("true", "1", "yes")


async def get_current_user(
    credentials: Annotated[HTTPAuthorizationCredentials | None, Depends(bearer_scheme)],
) -> dict | None:
    """
    Dependency fuer geschuetzte Endpoints.

    Wenn AUTH_ENABLED=false: gibt None zurueck (kein Schutz).
    Wenn AUTH_ENABLED=true: validiert den Bearer Token.
    """
    if not _is_auth_enabled():
        return None  # Auth deaktiviert — alles erlaubt

    if not credentials:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Bearer Token fehlt",
            headers={"WWW-Authenticate": "Bearer"},
        )

    payload = decode_token(credentials.credentials)
    if not payload or payload.get("type") != "access":
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Token ungueltig oder abgelaufen",
            headers={"WWW-Authenticate": "Bearer"},
        )

    return {"username": payload.get("sub", ""), "role": "admin"}
