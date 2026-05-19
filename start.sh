#!/bin/bash
set -e

echo ">>> 安装依赖..."
pip install fastapi uvicorn pydantic python-multipart -q

echo ">>> 启动 JobHunt OS..."
cd "$(dirname "$0")"
python -m uvicorn backend.main:app --host 0.0.0.0 --port 8000

echo ">>> 打开浏览器访问 http://localhost:8000"
