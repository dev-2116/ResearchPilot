"""
Authentication API – Register / Login / Me
"""
import uuid
from datetime import datetime, timedelta
from typing import Optional

import bcrypt
from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from jose import JWTError, jwt

from app.db.database import DB
from app.models.schemas import LoginRequest, RegisterRequest, TokenResponse, UserResponse

# ── Config ────────────────────────────────────────────────────────────────────
SECRET_KEY = "researchpilot-super-secret-jwt-key-2024"  # change in production
ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_HOURS = 24

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
    return jwt.encode(payload, SECRET_KEY, algorithm=ALGORITHM)


def get_current_user(credentials: Optional[HTTPAuthorizationCredentials] = Depends(bearer_scheme)):
    """Dependency that extracts and validates the JWT from the Authorization header."""
    if not credentials:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Not authenticated")
    token = credentials.credentials
    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
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
