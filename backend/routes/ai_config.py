"""
AI 路由模块（重构版）

设计目标：
  1. 支持 OpenAI 兼容协议（/v1/chat/completions，Bearer Token）
  2. 支持 Anthropic 原生协议（/v1/messages，x-api-key + anthropic-version）
  3. 配置管理与 LLM 代理职责分离（ConfigRouter / ProxyRouter）
  4. 分级超时：普通模型 60 s，推理模型（含 o1/o3/r1/mimo/deepseek）300 s
  5. 统一错误格式，前端无需关心底层协议差异
"""

from fastapi import APIRouter
from pydantic import BaseModel
import httpx
import logging

from backend.database import (
    get_ai_config,
    set_ai_config,
    clear_ai_config,
    get_ai_config_for_server,
)

logger = logging.getLogger("ai_routes")

router = APIRouter(prefix="/api/ai")


def _is_anthropic(base_url: str) -> bool:
    """根据 base_url 自动判断是否使用 Anthropic 原生协议"""
    return "anthropic" in base_url.lower()


# ── 推理模型关键词（命中任意一个 → 长超时）──────────────────────────────
_REASONING_KEYWORDS = ("o1", "o3", "r1", "r2", "mimo", "deepseek", "qwq", "think")


def _is_reasoning_model(model: str) -> bool:
    m = model.lower()
    return any(kw in m for kw in _REASONING_KEYWORDS)


def _get_timeout(model: str) -> int:
    return 300 if _is_reasoning_model(model) else 60


# ── 协议适配器 ────────────────────────────────────────────────────────────────

class _AdapterResult:
    """统一的适配器调用结果"""
    def __init__(self, ok: bool, content: str = "", error: str = ""):
        self.ok = ok
        self.content = content
        self.error = error


async def _safe_post(
    url: str,
    headers: dict,
    payload: dict,
    timeout: int,
    fmt_error: callable,
) -> tuple[httpx.Response | None, dict | None, _AdapterResult | None]:
    """
    通用 HTTP POST 包装。返回 (resp, data, error)。
    成功时 resp/data 有值，error 为 None；失败时 resp/data 为 None，error 有值。
    """
    try:
        async with httpx.AsyncClient(timeout=timeout) as client:
            resp = await client.post(url, json=payload, headers=headers)
    except httpx.ReadTimeout:
        return None, None, _AdapterResult(
            ok=False, error=f"响应超时（{timeout} 秒），请减少勾选数量后重试",
        )
    except httpx.ConnectTimeout:
        return None, None, _AdapterResult(ok=False, error="连接超时，请检查网络或 Base URL")
    except httpx.HTTPError as e:
        return None, None, _AdapterResult(ok=False, error=f"{type(e).__name__}: {e}")

    if resp.status_code >= 400:
        return None, None, _AdapterResult(ok=False, error=fmt_error(resp))

    try:
        data = resp.json()
    except Exception:
        return None, None, _AdapterResult(ok=False, error=f"非 JSON 响应：{resp.text[:300]}")

    return resp, data, None


async def _call_openai(
    base_url: str,
    api_key: str,
    model: str,
    messages: list,
    max_tokens: int,
    json_mode: bool,
    timeout: int,
) -> _AdapterResult:
    """OpenAI 兼容协议适配器。"""
    url = base_url.rstrip("/") + "/chat/completions"
    payload: dict = {"model": model, "messages": messages, "max_tokens": max_tokens}
    if json_mode and not _is_reasoning_model(model):
        payload["response_format"] = {"type": "json_object"}
    headers = {"Authorization": f"Bearer {api_key}", "Content-Type": "application/json"}

    _, data, err = await _safe_post(url, headers, payload, timeout, _fmt_openai_error)
    if err:
        return err

    if isinstance(data, dict) and "error" in data:
        return _AdapterResult(ok=False, error=_fmt_openai_error_from_data(data))

    content = _extract_openai_reply(data)
    if not content:
        return _AdapterResult(ok=False, error=f"响应中无内容：{str(data)[:300]}")
    return _AdapterResult(ok=True, content=content)


async def _call_anthropic(
    api_key: str,
    model: str,
    messages: list,
    max_tokens: int,
    timeout: int,
) -> _AdapterResult:
    """Anthropic 原生协议适配器。"""
    url = "https://api.anthropic.com/v1/messages"
    headers = {
        "x-api-key": api_key,
        "anthropic-version": "2023-06-01",
        "Content-Type": "application/json",
    }
    system_parts = [m["content"] for m in messages if m.get("role") == "system"]
    user_messages = [m for m in messages if m.get("role") != "system"]
    payload: dict = {"model": model, "max_tokens": max_tokens, "messages": user_messages}
    if system_parts:
        payload["system"] = "\n\n".join(system_parts)

    _, data, err = await _safe_post(url, headers, payload, timeout, _fmt_anthropic_error)
    if err:
        return err

    content = _extract_anthropic_reply(data)
    if not content:
        return _AdapterResult(ok=False, error=f"Anthropic 响应中无内容：{str(data)[:300]}")
    return _AdapterResult(ok=True, content=content)


# ── 内容提取工具 ──────────────────────────────────────────────────────────────

def _extract_openai_reply(data: dict) -> str:
    """从 OpenAI 兼容响应提取文本；兼容推理模型的 reasoning_content。"""
    choices = data.get("choices") or []
    if not choices:
        return ""
    msg = choices[0].get("message") or {}
    return msg.get("content") or msg.get("reasoning_content") or ""


def _extract_anthropic_reply(data: dict) -> str:
    """从 Anthropic /v1/messages 响应提取文本。"""
    content_blocks = data.get("content") or []
    texts = [b.get("text", "") for b in content_blocks if b.get("type") == "text"]
    return "".join(texts)


def _fmt_openai_error(resp: httpx.Response) -> str:
    try:
        data = resp.json()
        return _fmt_openai_error_from_data(data, resp.status_code)
    except Exception:
        pass
    return f"HTTP {resp.status_code} - {resp.text[:300]}"


def _fmt_openai_error_from_data(data: dict, status: int = 0) -> str:
    """从已解析的 OpenAI 响应 dict 提取错误信息。"""
    err = data.get("error")
    if not err:
        return f"HTTP {status} - 响应中无内容"
    if isinstance(err, dict):
        msg = err.get("message") or err.get("type") or str(err)
        code = err.get("code")
        return f"HTTP {status} - {msg}" + (f" (code={code})" if code else "")
    return f"HTTP {status} - {err}"


def _fmt_anthropic_error(resp: httpx.Response) -> str:
    try:
        data = resp.json()
        if isinstance(data, dict):
            err = data.get("error") or {}
            msg = err.get("message") if isinstance(err, dict) else str(err)
            return f"Anthropic HTTP {resp.status_code} - {msg or resp.text[:200]}"
    except Exception:
        pass
    return f"Anthropic HTTP {resp.status_code} - {resp.text[:300]}"


# ── 统一调度入口 ──────────────────────────────────────────────────────────────

async def _dispatch(
    cfg: dict,
    messages: list,
    max_tokens: int,
    json_mode: bool = False,
) -> _AdapterResult:
    """
    根据 base_url 自动判断协议并路由到对应适配器。
    cfg 来自 get_ai_config_for_server()，字段为：
      base_url / api_key / model
    """
    base_url = cfg.get("base_url", "").strip()
    api_key  = cfg.get("api_key",  "").strip()
    model    = cfg.get("model",    "").strip()
    provider = "anthropic" if _is_anthropic(base_url) else "openai"

    if not api_key or not model:
        return _AdapterResult(ok=False, error="AI 未配置（缺少 API Key 或模型名称）")

    timeout = _get_timeout(model)

    if provider == "anthropic":
        return await _call_anthropic(
            api_key=api_key,
            model=model,
            messages=messages,
            max_tokens=max_tokens,
            timeout=timeout,
        )
    else:
        # 默认 openai 兼容
        if not base_url:
            return _AdapterResult(ok=False, error="AI 未配置（缺少 Base URL）")
        return await _call_openai(
            base_url=base_url,
            api_key=api_key,
            model=model,
            messages=messages,
            max_tokens=max_tokens,
            json_mode=json_mode,
            timeout=timeout,
        )


# ── HTTP 路由 ─────────────────────────────────────────────────────────────────

# GET /api/ai/config
@router.get("/config")
def read_config():
    """返回前端安全视图（baseUrl / model / provider / hasKey）"""
    return get_ai_config()


# POST /api/ai/config
class ConfigBody(BaseModel):
    baseUrl:  str
    apiKey:   str | None = None
    model:    str


@router.post("/config")
def write_config(body: ConfigBody):
    set_ai_config(body.baseUrl, body.apiKey, body.model)
    return {"ok": True}


# DELETE /api/ai/config
@router.delete("/config")
def delete_config():
    clear_ai_config()
    return {"ok": True}


# POST /api/ai/test
@router.post("/test")
async def test_connection():
    """向 LLM 发送 'who are you?' 并返回结果，用于连通性验证"""
    cfg = get_ai_config_for_server()
    if not cfg.get("api_key", "").strip() or not cfg.get("model", "").strip():
        return {"ok": False, "error": "配置不完整"}

    result = await _dispatch(
        cfg=cfg,
        messages=[{"role": "user", "content": "who are you? reply in one sentence."}],
        max_tokens=256,
        json_mode=False,
    )

    if result.ok:
        base_url = cfg.get("base_url", "")
        model    = cfg.get("model", "")
        url_display = (
            "https://api.anthropic.com/v1/messages"
            if _is_anthropic(base_url)
            else base_url.rstrip("/") + "/chat/completions"
        )
        return {
            "ok": True,
            "url": url_display,
            "model": model,
            "provider": "anthropic" if _is_anthropic(base_url) else "openai",
            "reply": result.content,
        }
    return {"ok": False, "error": result.error}


# POST /api/ai/complete
class CompleteBody(BaseModel):
    messages:   list
    max_tokens: int  = 4000
    json_mode:  bool = False   # 替代原来的 response_format 字段


@router.post("/complete")
async def complete(body: CompleteBody):
    """
    通用 LLM 代理接口。
    前端传 messages（OpenAI 格式），后端根据 provider 自动转换协议。
    json_mode=True 时：OpenAI 侧启用 response_format，Anthropic 侧在 system
    prompt 末尾追加 JSON 输出指令（Anthropic 不支持 response_format 字段）。
    """
    cfg = get_ai_config_for_server()
    base_url = cfg.get("base_url", "").strip()

    # Anthropic json_mode：在 system message 里追加约束
    messages = list(body.messages)
    if body.json_mode and _is_anthropic(base_url):
        # 找到 system message，追加 JSON 指令
        has_system = any(m.get("role") == "system" for m in messages)
        json_instruction = (
            "\n\nIMPORTANT: Your response must be valid JSON only. "
            "Do not include any text, explanation, or markdown fences outside the JSON object."
        )
        if has_system:
            messages = [
                {**m, "content": m["content"] + json_instruction}
                if m.get("role") == "system" else m
                for m in messages
            ]
        else:
            messages.insert(0, {"role": "system", "content": json_instruction.strip()})

    result = await _dispatch(
        cfg=cfg,
        messages=messages,
        max_tokens=body.max_tokens,
        json_mode=body.json_mode,
    )

    if result.ok:
        return {"ok": True, "content": result.content}
    return {"ok": False, "error": result.error}
