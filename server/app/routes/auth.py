from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, EmailStr
from ..db import users
from ..security import hash_password, verify_password, create_token

router = APIRouter()

class RegisterRequest(BaseModel):
    name: str
    email: EmailStr
    password: str
    role: str = "VOTER"

class LoginRequest(BaseModel):
    email: EmailStr
    password: str

@router.post("/register")
def register(body: RegisterRequest):
    email = body.email.lower()
    if users.find_one({"email": email}):
        raise HTTPException(409, "Email already registered")
    role = body.role.upper()
    if role not in {"VOTER", "CANDIDATE", "ADMIN"}:
        raise HTTPException(400, "Invalid role")
    doc = {"name": body.name.strip(), "email": email, "password": hash_password(body.password), "role": role}
    result = users.insert_one(doc)
    return {"id": str(result.inserted_id), "name": doc["name"], "email": email, "role": role}

@router.post("/login")
def login(body: LoginRequest):
    user = users.find_one({"email": body.email.lower()})
    if not user or not verify_password(body.password, user["password"]):
        raise HTTPException(401, "Invalid credentials")
    return {
        "access_token": create_token(str(user["_id"]), user["role"]),
        "token_type": "bearer",
        "user": {"id": str(user["_id"]), "name": user["name"], "email": user["email"], "role": user["role"]}
    }
