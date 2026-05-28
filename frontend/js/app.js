// ============================================================
// 初始化
// ============================================================
function initLucideIcons() {
    if (typeof lucide !== 'undefined') {
        lucide.createIcons();
    } else {
        setTimeout(initLucideIcons, 50);
    }
}

// ── 写操作自动持久化 ─────────────────────────────────────────────────────────
function _withPersist(fn) {
    return function (...args) {
        const result = fn.apply(this, args);
        persist();
        return result;
    };
}

window.saveNewDelivery    = _withPersist(saveNewDelivery);
window.addFollowupRecord  = _withPersist(addFollowupRecord);
window.applyTerminalStage = _withPersist(applyTerminalStage);
window.saveCalEvent       = _withPersist(saveCalEvent);
window.deleteCalEvent     = _withPersist(deleteCalEvent);
window.toggleCalComplete  = _withPersist(toggleCalComplete);

// 其他写操作（内联 onclick 绑定的按钮）
document.getElementById('cancelEventFromDetailBtn').addEventListener('click', persist);
document.getElementById('batchDeleteConfirmBtn').addEventListener('click', persist);
document.getElementById('saveAllBtn').addEventListener('click', persist, true);

// ── 启动 ────────────────────────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', function() {
    initDateYearClamp();
    function waitForLucideAndStart() {
        if (typeof lucide !== 'undefined') {
            lucide.createIcons();
            loadFromServer();
        } else {
            setTimeout(waitForLucideAndStart, 30);
        }
    }
    waitForLucideAndStart();
});
