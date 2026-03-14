"""
Auth API — Login, Token-Refresh und Benutzer-Verwaltung.

Endpoints:
- POST /auth/login          — Login mit Username/Passwort → Tokens
- POST /auth/refresh         — Neuen Access Token mit Refresh Token holen
- POST /auth/setup           — Ersten Benutzer anlegen (nur wenn noch keiner existiert)
- GET  /auth/me              — Aktuellen Benutzer anzeigen
- GET  /auth/status          — Auth-Konfiguration anzeigen
"""

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from sqlalchemy import select, func

from app.core.auth import (
    authenticate_user,
    create_access_token,
    create_refresh_token,
    decode_token,
    hash_password,
    _is_auth_enabled,
)
from app.core.database import async_session
from app.models.user import User

router = APIRouter()


class LoginRequest(BaseModel):
    username: str
    password: str


class SetupRequest(BaseModel):
    username: str
    password: str


@router.post("/login")
async def login(body: LoginRequest):
    """Login mit Username und Passwort. Gibt Access + Refresh Token zurueck."""
    user = await authenticate_user(body.username, body.password)
    if not user:
        raise HTTPException(status_code=401, detail="Falsche Anmeldedaten")

    return {
        "access_token": create_access_token(user["username"]),
        "refresh_token": create_refresh_token(user["username"]),
        "token_type": "bearer",
        "username": user["username"],
        "role": user["role"],
    }


@router.post("/refresh")
async def refresh_token(refresh_token: str):
    """Erneuert den Access Token mit einem gueltigen Refresh Token."""
    payload = decode_token(refresh_token)
    if not payload or payload.get("type") != "refresh":
        raise HTTPException(status_code=401, detail="Refresh Token ungueltig oder abgelaufen")

    username = payload.get("sub", "")
    return {
        "access_token": create_access_token(username),
        "token_type": "bearer",
    }


@router.post("/setup")
async def initial_setup(body: SetupRequest):
    """
    Erstellt den ersten Benutzer (nur wenn noch keiner existiert).
    Wird beim Erststart aufgerufen.
    """
    async with async_session() as db:
        result = await db.execute(select(func.count()).select_from(User))
        count = result.scalar() or 0

        if count > 0:
            raise HTTPException(status_code=409, detail="Setup bereits abgeschlossen. Benutzer existiert bereits.")

        user = User(
            username=body.username,
            password_hash=hash_password(body.password),
            role="admin",
        )
        db.add(user)
        await db.commit()

    return {
        "success": True,
        "username": body.username,
        "message": "Erster Benutzer angelegt. Auth kann jetzt mit AUTH_ENABLED=true aktiviert werden.",
    }


@router.get("/me")
async def get_current_user_info():
    """Gibt Informationen zum aktuellen Benutzer zurueck."""
    if not _is_auth_enabled():
        return {"auth_enabled": False, "message": "Auth ist deaktiviert. Alle Anfragen sind erlaubt."}

    return {"auth_enabled": True, "message": "Auth aktiv — Bearer Token im Authorization-Header senden."}


@router.get("/status")
async def auth_status():
    """Zeigt den Auth-Status und ob ein Setup noetig ist."""
    async with async_session() as db:
        result = await db.execute(select(func.count()).select_from(User))
        user_count = result.scalar() or 0

    return {
        "auth_enabled": _is_auth_enabled(),
        "user_count": user_count,
        "setup_required": user_count == 0,
    }
