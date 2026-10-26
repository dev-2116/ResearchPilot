"""
Authentication API – Register / Login / Me
"""
import secrets
import uuid
from datetime import datetime, timedelta
from typing import Optional

import bcrypt
from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from jose import JWTError, jwt

from app.core.config import settings
from app.db.database import DB
from app.models.schemas import LoginRequest, RegisterRequest, TokenResponse, UserResponse

# ── Config ────────────────────────────────────────────────────────────────────
ALGORITHM = settings.JWT_ALGORITHM
ACCESS_TOKEN_EXPIRE_HOURS = 24

# Populated lazily when JWT_SECRET_KEY is not configured (see _jwt_secret).
_ephemeral_jwt_secret: Optional[str] = None


def _jwt_secret() -> str:
    """Return the JWT signing secret.

    Prefers JWT_SECRET_KEY from the environment (.env supported). When it is
    not configured, a strong random key is generated once per process so
    local development keeps working; a clear notice is printed and sessions
    reset on restart. The secret value itself is never printed or logged.
    """
    global _ephemeral_jwt_secret
    if settings.JWT_SECRET_KEY:
        return settings.JWT_SECRET_KEY
    if _ephemeral_jwt_secret is None:
        _ephemeral_jwt_secret = secrets.token_urlsafe(48)
        print(
            "[config] JWT_SECRET_KEY is not set - generated a random ephemeral "
            "signing key for this process only. Login sessions will be "
            "invalidated on restart. For persistent sessions set JWT_SECRET_KEY "
            "(see Backend/.env.example)."
        )
    return _ephemeral_jwt_secret

# ── Helpers ───────────────────────────────────────────────────────────────────
bearer_scheme = HTTPBearer(auto_error=False)

router = APIRouter(prefix="/auth", tags=["Authentication"])


def _hash_password(plain: str) -> str:
    pwd_bytes = plain.encode("utf-8")[:72]
    salt = bcrypt.gensalt()
    return bcrypt.hashpw(pwd_bytes, salt).decode("utf-8")


def _verify_password(plain: str, hashed: str) -> bool:
    pwd_bytes = plain.encode("utf-8")[:72]
    try:
        return bcrypt.checkpw(pwd_bytes, hashed.encode("utf-8"))
    except Exception:
        return False


def _create_access_token(user_id: str, email: str) -> str:
    expire = datetime.utcnow() + timedelta(hours=ACCESS_TOKEN_EXPIRE_HOURS)
    payload = {"sub": user_id, "email": email, "exp": expire}
    return jwt.encode(payload, _jwt_secret(), algorithm=ALGORITHM)


def get_current_user(credentials: Optional[HTTPAuthorizationCredentials] = Depends(bearer_scheme)):
    """Dependency that extracts and validates the JWT from the Authorization header."""
    if not credentials:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Not authenticated")
    token = credentials.credentials
    try:
        payload = jwt.decode(token, _jwt_secret(), algorithms=[ALGORITHM])
        user_id: str = payload.get("sub")
        if not user_id:
            raise HTTPException(status_code=401, detail="Invalid token")
    except JWTError:
        raise HTTPException(status_code=401, detail="Invalid or expired token")

    user = DB.get_user_by_id(user_id)
    if not user:
        raise HTTPException(status_code=401, detail="User not found")
    return user


# ── Endpoints ─────────────────────────────────────────────────────────────────

@router.post("/register", response_model=TokenResponse, status_code=status.HTTP_201_CREATED)
def register(req: RegisterRequest):
    """Register a new user. Returns a JWT on success."""
    existing = DB.get_user_by_email(req.email.lower())
    if existing:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="An account with this email already exists. Please log in."
        )

    user_id = f"user_{uuid.uuid4().hex[:12]}"
    hashed = _hash_password(req.password)
    user = DB.create_user(
        user_id=user_id,
        full_name=req.full_name.strip(),
        email=req.email.lower().strip(),
        hashed_password=hashed,
        role=req.role or "researcher",
    )

    token = _create_access_token(user["id"], user["email"])
    return TokenResponse(
        access_token=token,
        user_id=user["id"],
        full_name=user["full_name"],
        email=user["email"],
        role=user["role"],
    )


@router.post("/login", response_model=TokenResponse)
def login(req: LoginRequest):
    """Authenticate an existing user and return a JWT."""
    user = DB.get_user_by_email(req.email.lower())
    if not user or not _verify_password(req.password, user["hashed_password"]):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid email or password."
        )

    token = _create_access_token(user["id"], user["email"])
    return TokenResponse(
        access_token=token,
        user_id=user["id"],
        full_name=user["full_name"],
        email=user["email"],
        role=user["role"],
    )


@router.get("/me", response_model=UserResponse)
def get_me(current_user: dict = Depends(get_current_user)):
    """Return the profile of the currently authenticated user."""
    return UserResponse(
        id=current_user["id"],
        full_name=current_user["full_name"],
        email=current_user["email"],
        role=current_user["role"],
        created_at=current_user["created_at"],
    )
