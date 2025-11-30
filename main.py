"""
FastAPI application entrypoint.

 Serves static UI files under `/ui` from the `UI/` directory
- Serves `login.html` at `/`
- Implements `/auth/login` using MySQL + bcrypt
- Loads environment values from `.env`
"""

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, EmailStr, Field
from pathlib import Path
from passlib.hash import bcrypt
import mysql.connector
from dotenv import load_dotenv
import os
from typing import Optional, List, Any, Dict
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse, JSONResponse
from fastapi import Depends, Request
import mimetypes
from jose import jwt, JWTError
from datetime import datetime, timedelta, timezone
from decimal import Decimal

BASE_DIR = Path(__file__).resolve().parent
ENV_PATH = BASE_DIR / ".env"
load_dotenv(dotenv_path=ENV_PATH)

JWT_SECRET = os.getenv("JWT_SECRET", "dev-secret-change-me")
JWT_ALG = os.getenv("JWT_ALG", "HS256")
JWT_EXP_MIN = int(os.getenv("JWT_EXP_MIN", "15"))
REFRESH_EXP_MIN = int(os.getenv("REFRESH_EXP_MIN", "1440"))

app = FastAPI()

# Static UI setup
UI_DIR = BASE_DIR / "UI"
mimetypes.add_type('application/javascript', '.js')
mimetypes.add_type('text/css', '.css')
app.mount("/ui", StaticFiles(directory=UI_DIR), name="ui")

@app.get("/")
def login_page():
    return FileResponse(UI_DIR / "login.html")

origins = ["http://127.0.0.1:5500", "http://localhost:5500"]
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

def create_access_token(user: dict) -> str:
    now = datetime.now(timezone.utc)
    exp = now + timedelta(minutes=JWT_EXP_MIN)
    claims = {
        "sub": str(user["id"]),
        "username": user["username"],
        "iat": int(now.timestamp()),
        "exp": int(exp.timestamp()),
    }
    return jwt.encode(claims, JWT_SECRET, algorithm=JWT_ALG)

def decode_access_token(token: str) -> dict:
    return jwt.decode(token, JWT_SECRET, algorithms=[JWT_ALG])

def create_refresh_token(user: dict) -> str:
    now = datetime.now(timezone.utc)
    exp = now + timedelta(minutes=REFRESH_EXP_MIN)
    claims = {
        "sub": str(user["id"]),
        "type": "refresh",
        "iat": int(now.timestamp()),
        "exp": int(exp.timestamp()),
    }
    return jwt.encode(claims, JWT_SECRET, algorithm=JWT_ALG)

def decode_refresh_token(token: str) -> dict:
    claims = jwt.decode(token, JWT_SECRET, algorithms=[JWT_ALG])
    if claims.get("type") != "refresh":
        raise JWTError("Invalid refresh token")
    return claims

def auth_required(request: Request):
    auth = request.headers.get("authorization") or request.headers.get("Authorization")
    if not auth or not auth.lower().startswith("bearer "):
        raise HTTPException(status_code=401, detail="Missing bearer token")
    token = auth.split(" ", 1)[1].strip()
    try:
        claims = decode_access_token(token)
        return claims
    except JWTError:
        raise HTTPException(status_code=401, detail="Invalid or expired token")

@app.post("/auth/login", response_model=LoginResponse)
def login(data: LoginRequest):
    """Authenticate a user and return a simple bearer token.

    NOTE: Replace the dummy token with a real JWT in production.
    """
    conn = get_connection()
    cursor = conn.cursor(dictionary=True)

    cursor.execute(
        "SELECT id, username, password, firstname, lastname FROM users WHERE username = %s",
        (data.username,),
    )
    user_row = cursor.fetchone()
    user = dict(user_row) if user_row else None

    cursor.close()
    conn.close()

    # No user found for the provided username
    if not user:
        raise HTTPException(status_code=401, detail="Invalid username or password")

    # Verify plaintext password against stored bcrypt hash
    if not bcrypt.verify(data.password, user["password"]):
        raise HTTPException(status_code=401, detail="Invalid username or password")

    # Successful authentication
    # Issue a signed JWT access token
    access_token = create_access_token(user)
    refresh_token = create_refresh_token(user)

    # Set HttpOnly refresh token cookie
    resp = JSONResponse(
        content={
            "success": True,
            "message": f"Welcome {user['firstname'] or user['username']}!",
            "access_token": access_token,
            "token_type": "bearer",
            "user": {
                "id": user["id"],
                "username": user["username"],
                "firstname": user.get("firstname"),
                "lastname": user.get("lastname"),
            },
        }
    )
    resp.set_cookie(
        key="refresh_token",
        value=refresh_token,
        httponly=True,
        secure=False,  # set True in production with HTTPS
        samesite="strict",
        max_age=REFRESH_EXP_MIN * 60,
        path="/",
    )
    return resp

# Example protected route
@app.get("/auth/me")
def me(claims: dict = Depends(auth_required)):
    """Return authenticated user basic profile including first/last name.

    Uses id from token claims to look up current firstname/lastname so that
    any later updates to the users table are reflected without re-login.
    """
    user_id = int(claims.get("sub", 0))
    conn = get_connection()
    cur = conn.cursor()  # standard cursor returns tuple
    cur.execute(
        "SELECT id, username, firstname, lastname FROM users WHERE id = %s",
        (user_id,)
    )
    row = cur.fetchone()
    cur.close(); conn.close()
    if not row:
        raise HTTPException(status_code=404, detail="User not found")
    # row tuple ordering matches SELECT fields
    user_id, username, firstname, lastname = row
    return {
        "id": user_id,
        "username": username,
        "firstname": firstname,
        "lastname": lastname,
    }

@app.post("/auth/refresh")
def refresh(request: Request):
    cookie = request.cookies.get("refresh_token")
    if not cookie:
        raise HTTPException(status_code=401, detail="Missing refresh token")
    try:
        claims = decode_refresh_token(cookie)
        user_stub = {"id": int(claims.get("sub", 0)), "username": claims.get("username", "")}
        access = create_access_token(user_stub)
        return {"access_token": access, "token_type": "bearer"}
    except JWTError:
        raise HTTPException(status_code=401, detail="Invalid or expired refresh token")

@app.post("/auth/logout")
def logout():
    # Clear refresh cookie client-side by setting an expired cookie
    resp = JSONResponse(content={"success": True})
    resp.set_cookie(
        key="refresh_token",
        value="",
        httponly=True,
        secure=False,
        samesite="strict",
        max_age=0,
        path="/",
    )
    return resp

# --- Farmer registration ---

class FarmerIn(BaseModel):
    first_name: str = Field(..., min_length=2, max_length=25, pattern=r"^[A-Za-z]+$")
    middle_name: Optional[str] = Field(None, min_length=2, max_length=25, pattern=r"^[A-Za-z]+$")
    last_name: str = Field(..., min_length=2, max_length=25, pattern=r"^[A-Za-z]+$")
    gender: str = Field(..., pattern=r"^(Male|Female)$")
    street: str = Field(..., min_length=1, max_length=100, pattern=r"^[A-Za-z ,/\-]+$")
    city: str = Field(..., min_length=1, max_length=100)
    state_code: str = Field(..., min_length=2, max_length=2)
    pin: str = Field(..., pattern=r"^\d{6}$")
    phone: str = Field(..., pattern=r"^\+\d{11,15}$")  # e.g. +919876543210
    email: EmailStr

class FarmerOut(BaseModel):
    id: int

@app.post("/farmer/register", response_model=FarmerOut)
def register_farmer(data: FarmerIn, claims: dict = Depends(auth_required)):
    """Insert a new farmer row using validated input. Requires auth.

    Performs simple uniqueness checks on email and phone. Creates the table
    if it does not yet exist (first run convenience). Returns the new id.
    """
    conn = get_connection()
    cursor = conn.cursor()
    # Ensure table exists (minimal schema; run once)
    cursor.execute(
        """
        CREATE TABLE IF NOT EXISTS farmers (
            id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
            first_name VARCHAR(25) NOT NULL,
            middle_name VARCHAR(25) NULL,
            last_name VARCHAR(25) NOT NULL,
            gender ENUM('Male','Female') NOT NULL,
            street VARCHAR(100) NOT NULL,
            city VARCHAR(100) NOT NULL,
            state_code CHAR(2) NOT NULL,
            pin CHAR(6) NOT NULL,
            phone VARCHAR(20) NOT NULL,
            email VARCHAR(255) NOT NULL,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
            UNIQUE KEY uq_farmers_email (email),
            UNIQUE KEY uq_farmers_phone (phone),
            INDEX idx_farmers_state (state_code),
            INDEX idx_farmers_pin (pin)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
        """
    )
    # Uniqueness check
    cursor.execute("SELECT id FROM farmers WHERE email=%s OR phone=%s", (data.email, data.phone))
    if cursor.fetchone():
        cursor.close(); conn.close()
        raise HTTPException(status_code=400, detail="Email or phone already registered")
    # Insert
    cursor.execute(
        """
        INSERT INTO farmers
        (first_name, middle_name, last_name, gender, street, city, state_code, pin, phone, email)
        VALUES (%s,%s,%s,%s,%s,%s,%s,%s,%s,%s)
        """,
        (
            data.first_name,
            data.middle_name or None,
            data.last_name,
            data.gender,
            data.street,
            data.city,
            data.state_code,
            data.pin,
            data.phone,
            data.email,
        ),
    )
    conn.commit()
    new_id = cursor.lastrowid
    cursor.close(); conn.close()
    return {"id": new_id}

# --- Farmers listing ---

class FarmerListItem(BaseModel):
    id: int
    first_name: str
    middle_name: Optional[str]
    last_name: str
    gender: str
    phone: str
    email: EmailStr
    city: str
    state_code: str
    pin: str
    created_at: datetime

class FarmerListResponse(BaseModel):
    page: int
    page_size: int
    total: int
    total_pages: int
    items: List[FarmerListItem]

# --- Users listing ---
class UserListItem(BaseModel):
    id: int
    username: str
    firstname: Optional[str] = None
    lastname: Optional[str] = None
    email: Optional[str] = None
    phone: Optional[str] = None
    street: Optional[str] = None
    city: Optional[str] = None
    state_code: Optional[str] = None
    pin: Optional[str] = None
    created_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None

class UserListResponse(BaseModel):
    page: int
    page_size: int
    total: int
    total_pages: int
    items: List[UserListItem]

class FarmerDetail(BaseModel):
    id: int
    first_name: str
    middle_name: Optional[str]
    last_name: str
    street: str
    city: str
    state_code: str
    pin: str

@app.get("/farmer/{farmer_id}", response_model=FarmerDetail)
def get_farmer(farmer_id: int, claims: dict = Depends(auth_required)):
    """Return a single farmer's core details including address, or 404 if not found."""
    conn = get_connection(); cursor = conn.cursor()
    cursor.execute(
        """
        SELECT id, first_name, middle_name, last_name, street, city, state_code, pin
        FROM farmers WHERE id=%s
        """,
        (farmer_id,)
    )
    row = cursor.fetchone()
    cursor.close(); conn.close()
    if not row:
        raise HTTPException(status_code=404, detail="Farmer not found")
    (rid, first_name, middle_name, last_name, street, city, state_code, pin) = row
    return {
        "id": rid,
        "first_name": first_name,
        "middle_name": middle_name,
        "last_name": last_name,
        "street": street,
        "city": city,
        "state_code": state_code,
        "pin": pin,
    }

# --- Farms creation ---

class FarmAddress(BaseModel):
    street: str = Field(..., min_length=1, max_length=100, pattern=r"^[A-Za-z ,/\-]+$")
    city: str = Field(..., min_length=1, max_length=100)
    state_code: str = Field(..., min_length=2, max_length=2)
    pin: str = Field(..., pattern=r"^\d{6}$")

class FarmIn(BaseModel):
    farmer_id: int
    farm_name: str = Field(..., min_length=1, max_length=100)
    farm_size: Optional[float] = None
    shed_count: Optional[int] = 0
    address: FarmAddress

class FarmOut(BaseModel):
    id: int

@app.post("/farms", response_model=FarmOut)
def create_farm(payload: FarmIn, claims: dict = Depends(auth_required)):
    """Create a farm linked to a farmer. Ensures tables exist and foreign key is valid."""
    conn = get_connection(); cursor = conn.cursor()
    # Ensure farms table exists
    cursor.execute(
        """
        CREATE TABLE IF NOT EXISTS farms (
          id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
          farmer_id INT UNSIGNED NOT NULL,
          farm_name VARCHAR(100) NOT NULL,
          street VARCHAR(100) NOT NULL,
          city VARCHAR(100) NOT NULL,
          state_code CHAR(2) NOT NULL,
          pin CHAR(6) NOT NULL,
          farm_size DECIMAL(10,2) NULL,
          shed_count INT UNSIGNED DEFAULT 0,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
          INDEX idx_farms_farmer (farmer_id),
          INDEX idx_farms_state (state_code),
          INDEX idx_farms_pin (pin)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
        """
    )
    # Validate farmer exists
    cursor.execute("SELECT id FROM farmers WHERE id=%s", (payload.farmer_id,))
    if not cursor.fetchone():
        cursor.close(); conn.close()
        raise HTTPException(status_code=404, detail="Farmer not found")
    # Insert farm
    cursor.execute(
        """
        INSERT INTO farms (farmer_id, farm_name, street, city, state_code, pin, farm_size, shed_count)
        VALUES (%s,%s,%s,%s,%s,%s,%s,%s)
        """,
        (
            payload.farmer_id,
            payload.farm_name,
            payload.address.street,
            payload.address.city,
            payload.address.state_code,
            payload.address.pin,
            payload.farm_size,
            payload.shed_count or 0,
        ),
    )
    conn.commit()
    new_id = cursor.lastrowid
    cursor.close(); conn.close()
    return {"id": new_id}

class FarmListItem(BaseModel):
    id: int
    farmer_id: int
    farm_name: str
    street: str
    city: str
    state_code: str
    pin: str
    farm_size: Optional[float]
    shed_count: Optional[int]
    created_at: datetime

class FarmListResponse(BaseModel):
    page: int
    page_size: int
    total: int
    total_pages: int
    items: List[FarmListItem]

# (Old sheds schema removed; using new sheds implementation above)

# --- Sheds: models and list endpoint ---
class ShedListItem(BaseModel):
    id: int
    farm_id: int
    total_sqft: Optional[int] = None
    chick_capacity: Optional[int] = None
    feedbag_capacity: Optional[int] = None
    created_at: datetime

class ShedListResponse(BaseModel):
    page: int
    page_size: int
    total: int
    total_pages: int
    items: List[ShedListItem]

class ShedCreate(BaseModel):
    farm_id: int
    total_sqft: int = Field(..., ge=1)
    chick_capacity: int = Field(..., ge=1)
    feedbag_capacity: int = Field(..., ge=1)

class ShedCreated(BaseModel):
    id: int

def ensure_sheds_table(cursor):
    cursor.execute(
        """
        CREATE TABLE IF NOT EXISTS sheds (
          id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
          farm_id INT UNSIGNED NOT NULL,
                    farmer_id INT UNSIGNED NOT NULL,
          total_sqft INT UNSIGNED NULL,
          chick_capacity INT UNSIGNED NULL,
          feedbag_capacity INT UNSIGNED NULL,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
          INDEX idx_sheds_farm (farm_id)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
        """
    )

@app.get("/sheds", response_model=ShedListResponse)
def list_sheds(
    page: int = 1,
    page_size: int = 10,
    farm_id: Optional[int] = None,
    claims: dict = Depends(auth_required),
):
    if page < 1:
        raise HTTPException(status_code=400, detail="page must be >= 1")
    if page_size < 1 or page_size > 100:
        raise HTTPException(status_code=400, detail="page_size must be 1..100")

    conn = get_connection(); cursor = conn.cursor()
    ensure_sheds_table(cursor)
    where = ""
    params: List[Any] = []
    if farm_id is not None:
        where = "WHERE farm_id = %s"
        params.append(farm_id)

    # total
    count_cursor = conn.cursor()
    count_cursor.execute(f"SELECT COUNT(*) FROM sheds {where}", params)
    total_row = count_cursor.fetchone(); count_cursor.close()
    total = int(total_row[0]) if total_row else 0
    total_pages = (total + page_size - 1) // page_size if total else 0
    offset = (page - 1) * page_size

    # rows
    cursor.execute(
        f"""
        SELECT id, farm_id, total_sqft, chick_capacity, feedbag_capacity, created_at
        FROM sheds
        {where}
        ORDER BY created_at DESC
        LIMIT %s OFFSET %s
        """,
        params + [page_size, offset],
    )
    rows = cursor.fetchall()
    items: List[dict] = []
    for r in rows:
        (rid, fid, tsqft, cc, fbc, created) = r
        items.append({
            "id": int(rid),
            "farm_id": int(fid),
            "total_sqft": int(tsqft) if tsqft is not None else None,
            "chick_capacity": int(cc) if cc is not None else None,
            "feedbag_capacity": int(fbc) if fbc is not None else None,
            "created_at": created,
        })
    cursor.close(); conn.close()
    return {"page": page, "page_size": page_size, "total": total, "total_pages": total_pages, "items": items}

@app.post("/sheds", response_model=ShedCreated)
def create_shed(data: ShedCreate, claims: dict = Depends(auth_required)):
    """Insert a new shed row for a given farm_id."""
    conn = get_connection(); cursor = conn.cursor()
    ensure_sheds_table(cursor)
    # Validate farm exists
    cursor.execute("SELECT id, farmer_id FROM farms WHERE id=%s", (data.farm_id,))
    farm_row = cursor.fetchone()
    if not farm_row:
        cursor.close(); conn.close()
        raise HTTPException(status_code=404, detail="Farm not found")
    farmer_id = farm_row[1] if len(farm_row) > 1 else None
    if not farmer_id:
        cursor.close(); conn.close()
        raise HTTPException(status_code=400, detail="Farm has no associated farmer_id")
    # Insert shed
    cursor.execute(
        """
        INSERT INTO sheds (farm_id, farmer_id, total_sqft, chick_capacity, feedbag_capacity)
        VALUES (%s, %s, %s, %s, %s)
        """,
        (data.farm_id, farmer_id, data.total_sqft, data.chick_capacity, data.feedbag_capacity)
    )
    conn.commit()
    new_id = cursor.lastrowid
    # Optionally update farm shed_count if column exists
    try:
        cursor.execute("UPDATE farms SET shed_count = COALESCE(shed_count,0)+1 WHERE id=%s", (data.farm_id,))
        conn.commit()
    except Exception:
        pass  # ignore if shed_count column not present
    cursor.close(); conn.close()
    return {"id": new_id}

@app.get("/farms", response_model=FarmListResponse)
def list_farms(
    page: int = 1,
    page_size: int = 10,
    search: Optional[str] = None,
    farmer_id: Optional[int] = None,
    claims: dict = Depends(auth_required),
):
    """Paginated farms list, optional search by name/city/state/pin and filter by farmer_id."""
    if page < 1:
        raise HTTPException(status_code=400, detail="page must be >= 1")
    if page_size < 1 or page_size > 100:
        raise HTTPException(status_code=400, detail="page_size must be 1..100")

    conn = get_connection(); cursor = conn.cursor()
    where_parts = []
    params: List[Any] = []
    if search:
        like = f"%{search}%"
        where_parts.append("(farm_name LIKE %s OR city LIKE %s OR state_code LIKE %s OR pin LIKE %s)")
        params.extend([like, like, like, like])
    if farmer_id is not None:
        where_parts.append("farmer_id = %s")
        params.append(farmer_id)
    where = ("WHERE " + " AND ".join(where_parts)) if where_parts else ""

    count_cursor = conn.cursor()
    count_cursor.execute(f"SELECT COUNT(*) FROM farms {where}", params)
    count_row = count_cursor.fetchone()
    total = int(count_row[0]) if count_row else 0
    count_cursor.close()
    total_pages = (total + page_size - 1) // page_size if total else 0
    offset = (page - 1) * page_size

    cursor.execute(
        f"""
        SELECT id, farmer_id, farm_name, street, city, state_code, pin, farm_size, shed_count, created_at
        FROM farms
        {where}
        ORDER BY created_at DESC
        LIMIT %s OFFSET %s
        """,
        params + [page_size, offset],
    )
    rows = cursor.fetchall()
    items = []
    for r in rows:
        (rid, fid, name, street, city, sc, pin, size, sheds, created) = r
        # Ensure types compatible with Pydantic models
        size_val = float(size) if isinstance(size, (int, float, Decimal)) else None
        sheds_val = int(sheds) if isinstance(sheds, (int, float, Decimal)) else None
        items.append({
            "id": int(rid), "farmer_id": int(fid), "farm_name": str(name), "street": str(street),
            "city": str(city), "state_code": str(sc), "pin": str(pin), "farm_size": size_val,
            "shed_count": sheds_val, "created_at": created,
        })
    cursor.close(); conn.close()
    return {"page": page, "page_size": page_size, "total": total, "total_pages": total_pages, "items": items}

@app.get("/farmers", response_model=FarmerListResponse)
def list_farmers(
    page: int = 1,
    page_size: int = 10,
    search: Optional[str] = None,
    claims: dict = Depends(auth_required),
):
    """Paginated list of farmers with optional text search across name/email/phone/city.

    Requires authentication. Page numbering starts at 1. Max page_size capped at 100.
    """
    if page < 1:
        raise HTTPException(status_code=400, detail="page must be >= 1")
    if page_size < 1 or page_size > 100:
        raise HTTPException(status_code=400, detail="page_size must be 1..100")

    conn = get_connection()
    cursor = conn.cursor()

    where = ""
    params: List[Any] = []
    if search:
        like = f"%{search}%"
        where = (
            "WHERE first_name LIKE %s OR middle_name LIKE %s OR last_name LIKE %s OR "
            "email LIKE %s OR phone LIKE %s OR city LIKE %s"
        )
        params.extend([like] * 6)

    # total count
    count_cursor = conn.cursor()
    count_cursor.execute(f"SELECT COUNT(*) FROM farmers {where}", params)
    total_row = count_cursor.fetchone()
    total = int(total_row[0]) if total_row else 0
    count_cursor.close()
    total_pages = (total + page_size - 1) // page_size if total else 0
    offset = (page - 1) * page_size

    cursor.execute(
        f"""
        SELECT id, first_name, middle_name, last_name, gender, phone, email, city, state_code, pin, created_at
        FROM farmers
        {where}
        ORDER BY created_at DESC
        LIMIT %s OFFSET %s
        """,
        params + [page_size, offset],
    )
    rows = cursor.fetchall()
    items = []
    for r in rows:
        (rid, first_name, middle_name, last_name, gender, phone, email, city, state_code, pin, created_at) = r
        items.append(
            {
                "id": int(rid),
                "first_name": str(first_name),
                "middle_name": middle_name,
                "last_name": str(last_name),
                "gender": str(gender),
                "phone": str(phone),
                "email": str(email),
                "city": str(city),
                "state_code": str(state_code),
                "pin": str(pin),
                "created_at": created_at,
            }
        )
    cursor.close(); conn.close()
    return {
        "page": page,
        "page_size": page_size,
        "total": total,
        "total_pages": total_pages,
        "items": items,
    }

@app.get("/users", response_model=UserListResponse)
def list_users(
    page: int = 1,
    page_size: int = 10,
    search: Optional[str] = None,
    claims: dict = Depends(auth_required),
):
    if page < 1:
        raise HTTPException(status_code=400, detail="page must be >= 1")
    if page_size < 1 or page_size > 100:
        raise HTTPException(status_code=400, detail="page_size must be 1..100")

    conn = get_connection()
    cursor = conn.cursor()

    where = ""
    params: List[Any] = []
    if search:
        like = f"%{search}%"
        where = (
            "WHERE username LIKE %s OR firstname LIKE %s OR lastname LIKE %s OR "
            "email LIKE %s OR phone LIKE %s OR city LIKE %s OR state_code LIKE %s OR pin LIKE %s"
        )
        params.extend([like, like, like, like, like, like, like, like])

    count_cursor = conn.cursor()
    count_cursor.execute(f"SELECT COUNT(*) FROM users {where}", params)
    total_row = count_cursor.fetchone()
    total = int(total_row[0]) if total_row else 0
    count_cursor.close()
    total_pages = (total + page_size - 1) // page_size if total else 0
    offset = (page - 1) * page_size

    cursor.execute(
        f"""
        SELECT id, username, firstname, lastname, email, phone, street, city, state_code, pin, created_at, updated_at
        FROM users
        {where}
        ORDER BY created_at DESC
        LIMIT %s OFFSET %s
        """,
        params + [page_size, offset],
    )
    rows = cursor.fetchall()
    items: List[Dict[str, Any]] = []
    for r in rows:
        (
            rid, username, firstname, lastname, email, phone, street, city, state_code, pin, created_at, updated_at
        ) = r
        items.append({
            "id": int(rid),
            "username": str(username),
            "firstname": firstname,
            "lastname": lastname,
            "email": email,
            "phone": phone,
            "street": street,
            "city": city,
            "state_code": state_code,
            "pin": pin,
            "created_at": created_at,
            "updated_at": updated_at,
        })
    cursor.close(); conn.close()
    return {"page": page, "page_size": page_size, "total": total, "total_pages": total_pages, "items": items}
