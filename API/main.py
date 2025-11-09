# API/main.py
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from datetime import datetime, timedelta
import base64
from pydantic import BaseModel, EmailStr, Field
from typing import Optional
from fastapi import HTTPException, Header
import itertools

app = FastAPI(title="Mobile App API", version="0.1.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://127.0.0.1:5500", "http://localhost:5500"],  # add other dev ports if needed
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.get("/health")
def health():
    return {"status": "ok"}

# --- Temporary login model & route (replace with Cognito later) ---
class LoginIn(BaseModel):
    username: str
    password: str

@app.post("/auth/login")
def auth_login(body: LoginIn):
    # DEMO ONLY: accept any non-empty credentials.
    if not body.username or not body.password:
        raise HTTPException(status_code=400, detail="Missing credentials")

    # generate a simple demo token (NOT secure; just for wiring UI)
    expires = (datetime.utcnow() + timedelta(hours=8)).isoformat()
    token_payload = f"{body.username}|{expires}"
    fake_token = base64.urlsafe_b64encode(token_payload.encode()).decode()

    return {"token": fake_token, "expires": expires}

def decode_demo_token(token: str) -> dict:
    try:
        raw = base64.urlsafe_b64decode(token.encode()).decode()
        username, expires = raw.split("|", 1)
        return {"username": username, "expires": expires}
    except Exception:
        return {}

from fastapi import Header, HTTPException

@app.get("/me")
def me(authorization: str | None = Header(default=None)):
    # Expect: Authorization: Bearer <token>
    if not authorization or not authorization.lower().startswith("bearer "):
        raise HTTPException(401, "Missing bearer token")
    token = authorization.split(" ", 1)[1].strip()
    data = decode_demo_token(token)
    if not data:
        raise HTTPException(401, "Invalid token")

    # Optional: check expiry
    try:
        if datetime.utcnow() > datetime.fromisoformat(data["expires"]):
            raise HTTPException(401, "Token expired")
    except Exception:
        raise HTTPException(401, "Bad token format")

    return {"username": data["username"], "expires": data["expires"]}

# --- DEMO in-memory stores (replace with MongoDB later) ---
_admin_seq = itertools.count(1)
_farmer_seq = itertools.count(1)
ADMINS: list[dict] = []
FARMERS: list[dict] = []

# (reuse your existing token decode + /me from earlier)
# decode_demo_token() and /me route assumed present

# --- Models ---
class AdminIn(BaseModel):
  name: str = Field(min_length=2)
  email: EmailStr
  phone: str = Field(min_length=6)
  organization: Optional[str] = ""

class FarmerIn(BaseModel):
  name: str = Field(min_length=2)
  phone: str = Field(min_length=6)
  location: Optional[str] = ""
  land_size_acres: float = 0.0

def _require_auth(authorization: Optional[str]):
  if not authorization or not authorization.lower().startswith("bearer "):
    raise HTTPException(401, "Missing bearer token")
  token = authorization.split(" ", 1)[1].strip()
  user = decode_demo_token(token)
  if not user:
    raise HTTPException(401, "Invalid token")
  return user

@app.post("/admin/register")
def admin_register(body: AdminIn, authorization: Optional[str] = Header(default=None)):
  _require_auth(authorization)
  # basic duplicate check (email)
  if any(a["email"].lower() == body.email.lower() for a in ADMINS):
    raise HTTPException(409, "Admin with this email already exists")
  doc = body.dict()
  doc["id"] = next(_admin_seq)
  ADMINS.append(doc)
  return {"id": doc["id"], "message": "admin registered"}

@app.post("/farmer/register")
def farmer_register(body: FarmerIn, authorization: Optional[str] = Header(default=None)):
  _require_auth(authorization)
  doc = body.dict()
  doc["id"] = next(_farmer_seq)
  FARMERS.append(doc)
  return {"id": doc["id"], "message": "farmer registered"}