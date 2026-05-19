// ============================================================
// 初始化
// ============================================================
// 初始化Lucide图标
// ============================================================
function initLucideIcons() {
    if (typeof lucide !== 'undefined') {
        lucide.createIcons();
    } else {
        // Lucide 还未加载，等待后重试
        setTimeout(initLucideIcons, 50);
    }
}

// 页面加载完成后初始化

// 劫持写操作（在所有模块加载后执行）
const _orig_saveNewDelivery = saveNewDelivery;
window.saveNewDelivery = function() { _orig_saveNewDelivery(); persist(); };

const _orig_addFollowupRecord = addFollowupRecord;
window.addFollowupRecord = function(d, t) { _orig_addFollowupRecord(d, t); persist(); };

const _orig_applyTerminalStage = applyTerminalStage;
window.applyTerminalStage = function(s) { _orig_applyTerminalStage(s); persist(); };

const _orig_saveCalEvent = saveCalEvent;
window.saveCalEvent = function() { _orig_saveCalEvent(); persist(); };

const _orig_deleteCalEvent = deleteCalEvent;
window.deleteCalEvent = function() { _orig_deleteCalEvent(); persist(); };

const _orig_toggleCalComplete = toggleCalComplete;
window.toggleCalComplete = function() { _orig_toggleCalComplete(); persist(); };

document.getElementById('cancelEventFromDetailBtn').addEventListener('click', () => setTimeout(persist, 50));
document.getElementById('batchDeleteConfirmBtn').addEventListener('click', () => setTimeout(persist, 100));
document.getElementById('saveAllBtn').addEventListener('click', () => setTimeout(persist, 100), true);

document.addEventListener('DOMContentLoaded', function() {
    initDateYearClamp();
    populateAiOnlineResumeSelect();
    // 等 Lucide 库加载完成后再启动，避免图标渲染失败
    function waitForLucideAndStart() {
        if (typeof lucide !== 'undefined') {
            lucide.createIcons(); // 先渲染一次静态图标
            loadFromServer();     // 再加载数据（loadFromServer 内也会调 initLucideIcons）
        } else {
            setTimeout(waitForLucideAndStart, 30);
        }
    }
    waitForLucideAndStart();
});
