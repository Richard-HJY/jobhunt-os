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

