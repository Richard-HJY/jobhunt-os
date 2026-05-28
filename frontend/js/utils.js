// ============================================================
// 全局工具
// ============================================================
if (typeof pdfjsLib !== 'undefined') {
    pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';
}

function showToast(msg, type = 'success') {
    const toast = document.getElementById('toastMsg');
    toast.textContent = msg;
    toast.className = 'toast-msg show ' + type;
    setTimeout(() => toast.classList.remove('show'), 2200);
}

// ============================================================
// 移动端菜单控制
// ============================================================
const mobileMenuBtn = document.getElementById('mobileMenuBtn');
const mobileMenu = document.getElementById('mobileMenu');
const mobileMenuOverlay = document.getElementById('mobileMenuOverlay');
const mobileMenuClose = document.getElementById('mobileMenuClose');

function openMobileMenu() {
    mobileMenu.classList.add('active');
    mobileMenuOverlay.classList.add('active');
    document.body.style.overflow = 'hidden';
}

function closeMobileMenu() {
    mobileMenu.classList.remove('active');
    mobileMenuOverlay.classList.remove('active');
    document.body.style.overflow = '';
}

if (mobileMenuBtn) {
    mobileMenuBtn.addEventListener('click', openMobileMenu);
}

if (mobileMenuClose) {
    mobileMenuClose.addEventListener('click', closeMobileMenu);
}

if (mobileMenuOverlay) {
    mobileMenuOverlay.addEventListener('click', closeMobileMenu);
}

// 移动端菜单导航
document.querySelectorAll('.mobile-nav-links a').forEach(a => {
    a.addEventListener('click', () => {
        navigateTo(a.dataset.page);
        closeMobileMenu();
        // 更新移动端菜单激活状态
        document.querySelectorAll('.mobile-nav-links a').forEach(link => {
            link.classList.toggle('active', link.dataset.page === a.dataset.page);
        });
    });
});

function escapeHtml(str) {
    if (!str) return '';
    return str.replace(/[&<>]/g, m => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' }[m]));
}

// ============================================================
// 鲁棒 JSON 解析 — 兼容各种 LLM API 输出
// 处理：代码围栏、前后说明文字、思考前缀、被 max_tokens 截断
// ============================================================

function _stripFences(text) {
    let s = String(text).replace(/^﻿/, '').replace(/[​‌‍⁠﻿]/g, '');
    for (let i = 0; i < 3; i++) {
        s = s.replace(/^```(?:json)?\s*/im, '').replace(/\s*```\s*$/im, '');
    }
    return s.trim();
}

function _findMatchingBrace(text, start) {
    let depth = 0, inStr = false, esc = false;
    for (let i = start; i < text.length; i++) {
        const c = text[i];
        if (inStr) {
            if (esc) { esc = false; continue; }
            if (c === '\\') { esc = true; continue; }
            if (c === '"') inStr = false;
            continue;
        }
        if (c === '"') inStr = true;
        else if (c === '{') depth++;
        else if (c === '}') { depth--; if (depth === 0) return i; }
    }
    return -1;
}

function _recoverByTrimming(text, start) {
    for (let i = text.length - 1; i > start; i--) {
        if (text[i] === '}') {
            try { return JSON.parse(text.slice(start, i + 1)); }
            catch { continue; }
        }
    }
    return null;
}

function _recoverByClosing(text, start) {
    let base = text.slice(start);
    // 关闭未闭合的字符串
    let inStr = false, esc = false;
    for (let i = 0; i < base.length; i++) {
        const c = base[i];
        if (inStr) {
            if (esc) { esc = false; continue; }
            if (c === '\\') { esc = true; continue; }
            if (c === '"') inStr = false;
        } else if (c === '"') inStr = true;
    }
    if (inStr) base += '"';

    // 逐层关闭未闭合的括号
    const stack = [];
    inStr = false; esc = false;
    for (let i = 0; i < base.length; i++) {
        const c = base[i];
        if (inStr) {
            if (esc) { esc = false; continue; }
            if (c === '\\') { esc = true; continue; }
            if (c === '"') inStr = false;
            continue;
        }
        if (c === '"') inStr = true;
        else if (c === '[' || c === '{') stack.push(c === '[' ? ']' : '}');
        else if (c === ']' || c === '}') {
            if (stack.length && stack[stack.length - 1] === c) stack.pop();
        }
    }
    base = base.replace(/,\s*$/, '').replace(/:\s*$/, '');
    while (stack.length) base += stack.pop();

    try { return JSON.parse(base); }
    catch { return null; }
}

function _recoverResults(text, start) {
    const resultsMatch = text.slice(start).match(/"results"\s*:\s*\[/);
    if (!resultsMatch) return null;

    const arrStart = start + resultsMatch.index + resultsMatch[0].length;
    const itemRegex = /\{\s*"id"\s*:/g;
    const items = [];
    let m;
    while ((m = itemRegex.exec(text.slice(arrStart))) !== null) {
        const itemStart = arrStart + m.index;
        const itemEnd = _findMatchingBrace(text, itemStart);
        if (itemEnd !== -1) {
            try { items.push(JSON.parse(text.slice(itemStart, itemEnd + 1))); }
            catch { /* skip */ }
        }
    }
    return items.length > 0 ? { results: items } : null;
}

function parseAiJson(text) {
    if (!text) throw new Error('AI 返回为空');
    const s = _stripFences(text);

    const start = s.indexOf('{');
    if (start === -1) {
        throw new Error('未找到 JSON 对象。AI 原文：' + s.slice(0, 300));
    }

    // 正常闭合
    const end = _findMatchingBrace(s, start);
    if (end !== -1) {
        try { return JSON.parse(s.slice(start, end + 1)); }
        catch (e) { throw new Error('JSON 格式错误：' + e.message + '。原文片段：' + s.slice(start, start + 200)); }
    }

    // 截断恢复：3 种策略逐个尝试
    const trimmed = _recoverByTrimming(s, start);
    if (trimmed) return trimmed;

    const closed = _recoverByClosing(s, start);
    if (closed) return closed;

    const results = _recoverResults(s, start);
    if (results) return results;

    throw new Error('JSON 被截断且无法修复。AI 原文末尾：' + s.slice(-300));
}

// ============================================================
// AI 优化结果 — 共享渲染工具（批量 / 单条共用）
// ============================================================
function buildDiffHtml(original, changes) {
    if (!original) return '';
    if (!changes || changes.length === 0) {
        return `<span class="diff-unchanged">${escapeHtml(original)}</span>`;
    }
    const validChanges = changes
        .filter(c => c.original_fragment && original.includes(c.original_fragment))
        .sort((a, b) => original.indexOf(a.original_fragment) - original.indexOf(b.original_fragment));

    if (validChanges.length === 0) {
        return `<span class="diff-unchanged">${escapeHtml(original)}</span>`;
    }

    const parts = [];
    let lastIndex = 0;
    for (const change of validChanges) {
        const idx = original.indexOf(change.original_fragment, lastIndex);
        if (idx === -1 || idx < lastIndex) continue;
        if (idx > lastIndex) {
            parts.push(`<span class="diff-unchanged">${escapeHtml(original.slice(lastIndex, idx))}</span>`);
        }
        parts.push(
            `<span class="diff-change-wrap" title="${escapeHtml(change.reason || '点击查看详情')}">` +
            `<span class="diff-deleted">${escapeHtml(change.original_fragment)}</span>` +
            `<span class="diff-added">${escapeHtml(change.optimized_fragment || '')}</span>` +
            `</span>`
        );
        lastIndex = idx + change.original_fragment.length;
    }
    if (lastIndex < original.length) {
        parts.push(`<span class="diff-unchanged">${escapeHtml(original.slice(lastIndex))}</span>`);
    }
    return parts.join('');
}

function switchDiffView(btn, view) {
    const fieldDiv = btn.closest('.ai-result-field');
    if (!fieldDiv) return;
    fieldDiv.querySelectorAll('.diff-tab').forEach(t => t.classList.remove('active'));
    btn.classList.add('active');
    fieldDiv.querySelectorAll('.diff-panel').forEach(p => p.style.display = 'none');
    const target = fieldDiv.querySelector(`.diff-panel-${view}`);
    if (target) target.style.display = '';
}

function renderDiffFieldBlock({ field, fieldLabel, original, optimized, changes }) {
    const changeCount = (changes || []).length;
    const diffHtml = buildDiffHtml(original, changes);
    return `<div class="ai-result-field" data-field="${field}">
        <div class="diff-field-header">
            <span class="diff-field-label">${fieldLabel}</span>
            <span class="diff-change-count">${changeCount} 处改动</span>
        </div>
        <div class="diff-view-tabs">
            <button class="diff-tab active" onclick="switchDiffView(this,'diff')">改动对比</button>
            <button class="diff-tab" onclick="switchDiffView(this,'result')">优化结果</button>
        </div>
        <div class="diff-panel diff-panel-diff active">
            <div class="diff-legend">
                <span class="legend-deleted">■ 删除</span>
                <span class="legend-added">■ 新增</span>
                <span style="font-size:11px;color:var(--gray-400);">鼠标悬停查看改动理由</span>
            </div>
            <div class="diff-content">${diffHtml}</div>
        </div>
        <div class="diff-panel diff-panel-result" style="display:none;">
            <div class="diff-content optimized-text">${escapeHtml(optimized || '')}</div>
        </div>
        <div style="display:flex;justify-content:flex-end;gap:8px;margin-top:10px;">
            <button class="btn-outline btn-sm ai-reject-btn">放弃</button>
            <button class="btn-apply btn-sm ai-apply-btn">应用此条</button>
        </div>
    </div>`;
}

// 详细内容查看：长文本折叠 + 弹窗查看完整内容
window.__textViewerStore = window.__textViewerStore || {};
function renderClampedText(text, opts = {}) {
    if (!text) return '';
    const {
        title = '详细内容',
        lines = 2,
        textStyle = 'font-size:13px;color:var(--gray-600);line-height:1.6;',
        wrapStyle = ''
    } = opts;
    const id = 'tv_' + Date.now().toString(36) + '_' + Math.random().toString(36).slice(2, 7);
    window.__textViewerStore[id] = { text: String(text), title };
    const clampClass = lines === 1 ? 'clamp-text single-line' : 'clamp-text';
    const lineClampStyle = lines !== 1 && lines !== 2 ? `-webkit-line-clamp:${lines};line-clamp:${lines};` : '';
    return `<div class="clamp-text-wrap" data-tv-id="${id}" style="${wrapStyle}">
        <div class="${clampClass}" style="${textStyle}${lineClampStyle}">${escapeHtml(text)}</div>
        <button type="button" class="clamp-view-btn" onclick="openTextViewer('${id}')">
            <i data-lucide="maximize-2"></i>查看详细内容
        </button>
    </div>`;
}

function openTextViewer(id) {
    const data = window.__textViewerStore[id];
    if (!data) return;
    document.getElementById('textViewerTitle').textContent = data.title || '详细内容';
    document.getElementById('textViewerContent').textContent = data.text;
    document.getElementById('textViewerModal').classList.add('active');
    if (typeof initLucideIcons === 'function') initLucideIcons();
}

// 仅当文本被截断时才显示「查看详细内容」按钮
function refreshClampButtons(root) {
    const scope = root || document;
    scope.querySelectorAll('.clamp-text-wrap').forEach(wrap => {
        const txt = wrap.querySelector('.clamp-text');
        const btn = wrap.querySelector('.clamp-view-btn');
        if (!txt || !btn) return;
        const overflowed = txt.scrollHeight - txt.clientHeight > 1;
        btn.style.display = overflowed ? 'inline-flex' : 'none';
    });
}

function closeTextViewer() {
    document.getElementById('textViewerModal').classList.remove('active');
}

document.addEventListener('DOMContentLoaded', () => {
    const closeBtn = document.getElementById('closeTextViewerBtn');
    const okBtn = document.getElementById('textViewerOkBtn');
    const overlay = document.getElementById('textViewerModal');
    if (closeBtn) closeBtn.addEventListener('click', closeTextViewer);
    if (okBtn) okBtn.addEventListener('click', closeTextViewer);
    if (overlay) overlay.addEventListener('click', e => { if (e.target === overlay) closeTextViewer(); });
});

