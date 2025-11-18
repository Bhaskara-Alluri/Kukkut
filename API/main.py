from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from pathlib import Path
from passlib.hash import bcrypt
import mysql.connector
from dotenv import load_dotenv
import os
from typing import Optional

BASE_DIR = Path(__file__).resolve().parent
ENV_PATH = BASE_DIR / ".env"

load_dotenv(dotenv_path=ENV_PATH)

print("DB_HOST from env:", os.getenv("DB_HOST"))
print("DB_PORT from env:", os.getenv("DB_PORT"))

app = FastAPI()

origins = [
    "http://localhost",
    "http://127.0.0.1",
    "http://localhost:3000",
    "http://127.0.0.1:3000",
    "http://localhost:5173",
    "http://127.0.0.1:5173",
    "http://localhost:5500",
    "http://127.0.0.1:5500",
]

app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

def get_connection():
    return mysql.connector.connect(
        host=os.getenv("DB_HOST"),
        port=int(os.getenv("DB_PORT", "3306")),
        user=os.getenv("DB_USER"),
        password=os.getenv("DB_PASSWORD"),
        database=os.getenv("DB_NAME"),
    )

class LoginRequest(BaseModel):
    username: str
    password: str
    
class UserOut(BaseModel):
    id: int
    username: str
    firstname: Optional[str] = None
    lastname: Optional[str] = None

class LoginResponse(BaseModel):
    success: bool
    message: str
    access_token: str
    token_type: str = "bearer"
    user: UserOut

@app.post("/auth/login", response_model=LoginResponse)

def login(data: LoginRequest):
    conn = get_connection()
    cursor = conn.cursor(dictionary=True)

    cursor.execute(
        "SELECT id, username, password, firstname, lastname FROM users WHERE username = %s",
        (data.username,),
    )
    user = cursor.fetchone()

    cursor.close()
    conn.close()

    if not user:
        raise HTTPException(status_code=401, detail="Invalid username or password")

    if not bcrypt.verify(data.password, user["password"]):
        raise HTTPException(status_code=401, detail="Invalid username or password")

    payload = {
        "sub": str(user["id"]),
        "username": user["username"],
    }

    return LoginResponse(
        success=True,
        message=f"Welcome {user['firstname'] or user['username']}!",
        access_token="dummy-token-for-now",
        user=UserOut(
            id=user["id"],
            username=user["username"],
            firstname=user.get("firstname"),
            lastname=user.get("lastname"),
        ),
    )
