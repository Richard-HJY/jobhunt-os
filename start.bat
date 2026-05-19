@echo off
pip install fastapi uvicorn pydantic python-multipart -q
cd /d "%~dp0"
python -m uvicorn backend.main:app --host 0.0.0.0 --port 8000 --no-use-colors
pause
