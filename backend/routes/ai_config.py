from fastapi import APIRouter
from pydantic import BaseModel
from backend.database import get_ai_config, set_ai_config, clear_ai_config, get_ai_config_for_server
import httpx, logging

router = APIRouter(prefix="/api/ai")

# ── GET /api/ai/config ──────────────────────────────────────────────────────
@router.get("/config")
def read_config():
    """返回 baseUrl / model / hasKey（无 api_key 明文）"""
    return get_ai_config()

# ── POST /api/ai/config ─────────────────────────────────────────────────────
class ConfigBody(BaseModel):
    baseUrl:  str
    apiKey:   str | None = None
    model:    str

@router.post("/config")
def write_config(body: ConfigBody):
    set_ai_config(body.baseUrl, body.apiKey, body.model)
    return {"ok": True}

# ── DELETE /api/ai/config ───────────────────────────────────────────────────
@router.delete("/config")
def delete_config():
    clear_ai_config()
    return {"ok": True}

# ── POST /api/ai/test ───────────────────────────────────────────────────────
@router.post("/test")
async def test_connection():
    """向 LLM 发送 'who are you?' 并返回完整结果"""
    cfg = get_ai_config_for_server()
    base_url = cfg.get("base_url","").rstrip("/")
    api_key  = cfg.get("api_key","")
    model    = cfg.get("model","")
    if not base_url or not api_key or not model:
        return {"ok": False, "error": "配置不完整"}
    url = f"{base_url}/chat/completions"
    payload = {"model": model, "messages": [{"role":"user","content":"who are you?"}], "max_tokens": 256}
    headers = {"Authorization": f"Bearer {api_key}", "Content-Type": "application/json"}
    try:
        async with httpx.AsyncClient(timeout=20) as client:
            resp = await client.post(url, json=payload, headers=headers)
        data = resp.json()
        reply = data["choices"][0]["message"]["content"]
        return {"ok": True, "url": url, "model": model, "reply": reply}
    except Exception as e:
        logging.getLogger("ai_test")
        return {"ok": False, "error": str(type(e).__name__)}

# ── POST /api/ai/complete ───────────────────────────────────────────────────
class CompleteBody(BaseModel):
    messages: list
    max_tokens: int = 2000

@router.post("/complete")
async def complete(body: CompleteBody):
    """通用 LLM 代理接口；前端不需要知道 api_key"""
    cfg = get_ai_config_for_server()
    base_url = cfg.get("base_url","").rstrip("/")
    api_key  = cfg.get("api_key","")
    model    = cfg.get("model","")
    if not base_url or not api_key or not model:
        return {"ok": False, "error": "AI 未配置"}
    url = f"{base_url}/chat/completions"
    payload = {"model": model, "messages": body.messages, "max_tokens": body.max_tokens}
    headers = {"Authorization": f"Bearer {api_key}", "Content-Type": "application/json"}
    try:
        async with httpx.AsyncClient(timeout=60) as client:
            resp = await client.post(url, json=payload, headers=headers)
        data = resp.json()
        return {"ok": True, "content": data["choices"][0]["message"]["content"]}
    except Exception as e:
        return {"ok": False, "error": str(type(e).__name__)}
