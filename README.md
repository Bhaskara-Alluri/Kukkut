# Kukkut

## Setup
- Copy `.env.example` to `.env` and fill DB creds:
	- `DB_HOST`, `DB_PORT`, `DB_USER`, `DB_PASSWORD`, `DB_NAME`
- Create and activate virtual environment (optional if already present):
	- Windows PowerShell:
		- `python -m venv .venv`
		- `.\.venv\Scripts\activate`
- Install dependencies:
	- `pip install -r requirements.txt`

## Run (FastAPI + UI)
- Start the API using the project venv:
	- `.\.venv\Scripts\python.exe -m uvicorn main:app --reload`
- Open the app:
	- `http://127.0.0.1:8000/` serves `UI/login.html`
	- Static assets are under `http://127.0.0.1:8000/ui/...`

## Notes
- Secrets: `.env` is git-ignored; do not commit real credentials.
- Login seeds: passwords in DB must be bcrypt hashes.
	- Generate: `python -c "from passlib.hash import bcrypt; print(bcrypt.hash('YourPass'))"`
- Do not use `python -m http.server` for the UI; it breaks absolute `/ui/...` paths.
