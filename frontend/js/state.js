// ============================================================
// 路由 / 导航
// ============================================================
let currentPage = 'home';

function navigateTo(pageId) {
    // 隐藏所有页
    document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
    // 激活目标页
    const target = document.getElementById('page-' + pageId);
    if (target) target.classList.add('active');
    // 更新 nav 高亮
    document.querySelectorAll('.nav-links a').forEach(a => {
        a.classList.toggle('active', a.dataset.page === pageId);
    });
    currentPage = pageId;
    // 按需初始化
    if (pageId === 'home') renderHome();
    if (pageId === 'resume-mgr') renderResumeMgr();
    if (pageId === 'delivery') renderDeliveryView();
    if (pageId === 'calendar') { renderCalendar(); updateTodayReminders(); }
}

document.querySelectorAll('.nav-links a').forEach(a => {
    a.addEventListener('click', () => navigateTo(a.dataset.page));
});

// ============================================================
// 共享数据
// ============================================================
const STAGE_ORDER = ['简历投递','简历初筛','测评','笔试','一面','二面','三面','四面','offer'];
const TERMINAL_STAGES = ['已拒绝','已淘汰','已接受'];

// 投递数据（共享）
let deliveries = [];

// 日历事件数据（共享）
let calendarEvents = [];
const _today = new Date();
const _cy = _today.getFullYear(), _cm = _today.getMonth();
function mkDate(y,m,d,h=9,min=0) { return new Date(y,m,d,h,min); }

// 简历数据（共享）
let onlineResumes = [];
let masterResumeDeleted = true;
let customResumes = [];

// 面试阶段：固定列 一面/二面/三面（含其 match 覆盖的阶段）+ 所有用户自定义列
const BASE_INTERVIEW_COLS = ['一面','二面','三面'];
function isInterviewStage(stage) {
    if (!stage) return false;
    // 匹配固定面试列（一面/二面/三面的 match 覆盖 四面/HR面 等）
    const cols = KANBAN_COLS.length > 0 ? KANBAN_COLS : [];
    if (cols.some(c => BASE_INTERVIEW_COLS.includes(c.key) && c.match(stage))) return true;
    // 用户自定义列全部视为面试阶段
    if (cols.some(c => !c.builtin && c.match(stage))) return true;
    // 兜底：KANBAN_COLS 为空时用基础阶段判断
    if (cols.length === 0 && BASE_INTERVIEW_COLS.includes(stage)) return true;
    return false;
}
