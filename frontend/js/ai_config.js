// ============================================================
// AI 配置面板
// ============================================================

const _AI_API = '/api/ai';

// ── 面板开关 ──────────────────────────────────────────────────────────────────

async function openSettingsPanel() {
    const panel = document.getElementById('aiSettingsPanel');
    panel.classList.add('active');
    document.getElementById('aiTestResult').style.display = 'none';
    try {
        const r   = await fetch(`${_AI_API}/config`);
        const cfg = await r.json();
        document.getElementById('aiBaseUrl').value = cfg.baseUrl || '';
        document.getElementById('aiModel').value   = cfg.model   || '';
        document.getElementById('aiApiKey').value  = '';
        document.getElementById('aiApiKey').placeholder = cfg.hasKey
            ? '已保存（留空则不修改）' : '请输入 API Key';
    } catch (e) { showToast('加载配置失败', 'error'); }
}

document.getElementById('openSettingsBtn').addEventListener('click', openSettingsPanel);
document.getElementById('closeSettingsBtn').addEventListener('click', () =>
    document.getElementById('aiSettingsPanel').classList.remove('active'));

// ── API Key 明文/星号切换 ────────────────────────────────────────────────────

document.getElementById('toggleKeyVisBtn').addEventListener('click', () => {
    const inp  = document.getElementById('aiApiKey');
    const icon = document.getElementById('keyVisIcon');
    if (inp.type === 'password') {
        inp.type = 'text';
        icon.setAttribute('data-lucide', 'eye-off');
    } else {
        inp.type = 'password';
        icon.setAttribute('data-lucide', 'eye');
    }
    lucide.createIcons();
});

// ── 保存 ──────────────────────────────────────────────────────────────────────

document.getElementById('saveAiConfigBtn').addEventListener('click', async () => {
    const baseUrl = document.getElementById('aiBaseUrl').value.trim();
    const apiKey  = document.getElementById('aiApiKey').value;
    const model   = document.getElementById('aiModel').value.trim();

    if (!baseUrl) { showToast('请填写 Base URL', 'error'); return; }
    if (!model)   { showToast('请填写模型名称', 'error'); return; }
    const hasSavedKey = document.getElementById('aiApiKey').placeholder.includes('已保存');
    if (!apiKey && !hasSavedKey) { showToast('请填写 API Key', 'error'); return; }

    await fetch(`${_AI_API}/config`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ baseUrl, apiKey: apiKey || null, model }),
    });
    showToast('配置已保存');
    document.getElementById('aiSettingsPanel').classList.remove('active');
});

// ── 清除 ──────────────────────────────────────────────────────────────────────

document.getElementById('clearAiConfigBtn').addEventListener('click', async () => {
    if (!confirm('确定清除所有 AI 配置？')) return;
    await fetch(`${_AI_API}/config`, { method: 'DELETE' });
    document.getElementById('aiBaseUrl').value = '';
    document.getElementById('aiApiKey').value  = '';
    document.getElementById('aiModel').value   = '';
    showToast('已清除');
});

// ── 测试连接 ─────────────────────────────────────────────────────────────────

document.getElementById('testAiConnBtn').addEventListener('click', async () => {
    const box = document.getElementById('aiTestResult');
    box.style.display = 'block';
    box.innerHTML = '<i data-lucide="loader-circle" style="width:14px;height:14px;'
        + 'animation:spin 1s linear infinite;vertical-align:middle;"></i> 连接测试中…';
    lucide.createIcons();
    try {
        const r = await fetch(`${_AI_API}/test`, { method: 'POST' });
        const d = await r.json();
        if (d.ok) {
            const providerBadge = d.provider === 'anthropic'
                ? '<span style="background:var(--primary-100);color:var(--primary-700);'
                  + 'padding:1px 6px;border-radius:4px;font-size:11px;">Anthropic</span>'
                : '<span style="background:var(--gray-100);color:var(--gray-700);'
                  + 'padding:1px 6px;border-radius:4px;font-size:11px;">OpenAI 兼容</span>';
            box.innerHTML = `
                <div style="color:var(--success-600);font-weight:600;margin-bottom:6px;">
                    <i data-lucide="check-circle" style="width:14px;height:14px;vertical-align:middle;"></i>
                    连接成功 ${providerBadge}
                </div>
                <div style="color:var(--gray-500);font-size:12px;">URL：${escapeHtml(d.url)}</div>
                <div style="color:var(--gray-500);font-size:12px;">Model：${escapeHtml(d.model)}</div>
                <div style="margin-top:8px;color:var(--gray-700);">模型回答：${escapeHtml(d.reply)}</div>`;
        } else {
            box.innerHTML = `<span style="color:var(--error-600);">
                <i data-lucide="x-circle" style="width:14px;height:14px;vertical-align:middle;"></i>
                连接失败：${escapeHtml(d.error)}</span>`;
        }
    } catch (e) {
        box.innerHTML = `<span style="color:var(--error-600);">请求异常：${e.message}</span>`;
    }
    lucide.createIcons();
});

// ── 供外部调用：检查是否已配置 ───────────────────────────────────────────────

async function checkAiConfigured() {
    try {
        const r   = await fetch(`${_AI_API}/config`);
        const cfg = await r.json();
        return !!(cfg.baseUrl && cfg.hasKey && cfg.model);
    } catch { return false; }
}
