"""
routers/auth.py – Register and login endpoints.
"""
from fastapi import APIRouter, HTTPException, status

from auth import hash_password, verify_password, create_access_token
from database import get_db
from models import UserDoc
from schemas import RegisterRequest, LoginRequest, TokenResponse, UserOut

router = APIRouter(prefix="/api/auth", tags=["auth"])


def _user_out(doc: dict) -> UserOut:
    return UserOut(
        id=doc["id"],
        email=doc["email"],
        display_name=doc["display_name"],
        created_at=doc["created_at"],
    )


@router.post("/register", response_model=TokenResponse, status_code=201)
async def register(body: RegisterRequest):
    db = get_db()
    existing = await db.users.find_one({"email": body.email})
    if existing:
        raise HTTPException(status_code=409, detail="Email already registered")

    user = UserDoc(
        email=body.email,
        display_name=body.display_name,
        password_hash=hash_password(body.password),
    )
    await db.users.insert_one(user.model_dump())

    token = create_access_token({"sub": user.id})
    return TokenResponse(access_token=token, user=_user_out(user.model_dump()))


@router.post("/login", response_model=TokenResponse)
async def login(body: LoginRequest):
    db = get_db()
    user_doc = await db.users.find_one({"email": body.email})
    if not user_doc or not verify_password(body.password, user_doc["password_hash"]):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid email or password",
        )

    token = create_access_token({"sub": user_doc["id"]})
    return TokenResponse(access_token=token, user=_user_out(user_doc))


@router.get("/me", response_model=UserOut)
async def me(current_user: dict = __import__("fastapi").Depends(__import__("auth").get_current_user)):
    return _user_out(current_user)
