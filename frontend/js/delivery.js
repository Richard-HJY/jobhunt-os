// ============================================================
// 投递看板
// ============================================================
let selectedIds = new Set();
let currentPage_d = 1;
const pageSize_d = 10;
let filters = { company:'', stage:'all', status:'all', channel:'all', dateRange:'30' };
let currentOpDelivery = null;
let deliveryView = 'kanban'; // 'kanban' | 'list'

// 看板列定义（可动态增删）
let KANBAN_COLS = [];

// 固定初始看板列（不可删除）
const FIXED_KANBAN_COLS = [
    { key:'初筛',  label:'初筛',  color:'#f59e0b', defaultStage:'初筛',  match: s => s==='初筛'||s==='简历初筛'||s==='简历投递', builtin:true },
    { key:'笔试',  label:'笔试',  color:'#0ea5e9', defaultStage:'笔试',  match: s => s==='笔试'||s==='测评', builtin:true },
    { key:'一面',  label:'一面',  color:'#ec4899', defaultStage:'一面',  match: s => s==='一面', builtin:true },
    { key:'二面',  label:'二面',  color:'#8b5cf6', defaultStage:'二面',  match: s => s==='二面', builtin:true },
    { key:'三面',  label:'三面',  color:'#f97316', defaultStage:'三面',  match: s => s==='三面'||s==='四面'||s==='HR面', builtin:true },
    { key:'Offer', label:'Offer', color:'#10b981', defaultStage:'offer', match: s => s==='offer'||s==='Offer', builtin:true },
];

// 固定列始终全部显示，保留用户排序
function buildKanbanColsFromDeliveries() {
    const existingKeys = new Set(KANBAN_COLS.map(c => c.key));
    // 确保所有固定列都存在（可能被意外移除）
    FIXED_KANBAN_COLS.forEach(fc => {
        if (!existingKeys.has(fc.key)) {
            KANBAN_COLS.push(fc);
        }
    });
}

// 自定义列颜色池
const COL_COLORS = ['#6366f1','#14b8a6','#f43f5e','#84cc16','#a855f7','#06b6d4','#fb923c'];

function addKanbanCol(label) {
    const key = 'custom_' + Date.now();
    const color = COL_COLORS[KANBAN_COLS.filter(c=>!c.builtin).length % COL_COLORS.length];
    KANBAN_COLS.push({ key, label, color, defaultStage: label, match: s => s === label, builtin: false });
    persist();
    syncFilterStageOptions();
    renderKanban();
}

function deleteKanbanCol(key) {
    const col = KANBAN_COLS.find(c => c.key === key);
    if (!col || col.builtin) return;
    deliveries.forEach(d => { if (d.stage === col.defaultStage) d.stage = '初筛'; });
    KANBAN_COLS = KANBAN_COLS.filter(c => c.key !== key);
    persist();
    syncFilterStageOptions();
    renderKanban();
}

function syncFilterStageOptions() {
    buildKanbanColsFromDeliveries();
    const sel = document.getElementById('filterStage');
    const cur = sel.value;
    sel.innerHTML = '<option value="all">全部阶段</option>' +
        KANBAN_COLS.map(c => `<option value="${c.key}">${c.label}</option>`).join('');
    sel.value = cur;
    if (!sel.value) sel.value = 'all';
}

// 终止阶段对应的最后活跃列（用于拖拽和显示）
function getLastActiveColKey(delivery) {
    if (!delivery.history || delivery.history.length === 0) return KANBAN_COLS.length ? KANBAN_COLS[0].key : '';
    for (let i = delivery.history.length - 1; i >= 0; i--) {
        const to = delivery.history[i].to;
        if (!TERMINAL_STAGES.includes(to)) {
            const col = KANBAN_COLS.find(c => c.match(to));
            if (col) return col.key;
        }
    }
    for (let i = delivery.history.length - 1; i >= 0; i--) {
        const from = delivery.history[i].from;
        if (!TERMINAL_STAGES.includes(from) && from !== '新建') {
            const col = KANBAN_COLS.find(c => c.match(from));
            if (col) return col.key;
        }
    }
    return KANBAN_COLS.length ? KANBAN_COLS[0].key : '';
}

function getCardStatusClass(delivery) {
    if (delivery.stage === '已拒绝') return 'card-rejected';
    if (delivery.stage === '已淘汰') return 'card-eliminated';
    if (delivery.stage === '已接受') return 'card-accepted';
    if (delivery.stage === 'offer')  return 'card-offer';
    return 'card-active';
}

function getCardStatusLabel(delivery) {
    if (delivery.stage === '已拒绝') return { cls:'status-rejected',  text:'已拒绝' };
    if (delivery.stage === '已淘汰') return { cls:'status-eliminated', text:'已淘汰' };
    if (delivery.stage === '已接受') return { cls:'status-accepted',  text:'已接受' };
    if (delivery.stage === 'offer')  return { cls:'status-offer',      text:'已Offer' };
    return { cls:'status-active', text:'进行中' };
}

// 详情弹窗用：状态只显示4种
function getDetailStatusLabel(delivery) {
    if (delivery.stage === '已拒绝') return { cls:'status-rejected', text:'已拒绝' };
    if (delivery.stage === '已淘汰') return { cls:'status-eliminated', text:'已淘汰' };
    if (delivery.stage === '已接受') return { cls:'status-accepted', text:'已接受' };
    if (delivery.stage === 'offer') return { cls:'status-offer', text:'已Offer' };
    return { cls:'status-active', text:'进行中' };
}

// 详情弹窗用：阶段显示对应列名
function getDetailStageLabel(delivery) {
    const col = getColForDelivery(delivery);
    return col ? col.label : delivery.stage;
}

function getColForDelivery(delivery) {
    if (!KANBAN_COLS.length) return { key:'', label:'', match: ()=>false };
    if (TERMINAL_STAGES.includes(delivery.stage)) {
        const lastKey = getLastActiveColKey(delivery);
        return KANBAN_COLS.find(c => c.key === lastKey) || KANBAN_COLS[0];
    }
    return KANBAN_COLS.find(c => c.match(delivery.stage)) || KANBAN_COLS[0];
}

function daysSince(dateStr) {
    if (!dateStr) return 0;
    return Math.floor((Date.now() - new Date(dateStr).getTime()) / 86400000);
}

// 获取投递关联的最近日程信息
function getCardEventInfo(delivery) {
    const now = new Date();
    const events = calendarEvents.filter(ev => ev.deliveryId === delivery.id && !ev.cancelled && !ev.completed);
    const upcoming = events.filter(ev => {
        const d = ev.date instanceof Date ? ev.date : new Date(ev.date);
        return d >= new Date(now.getFullYear(), now.getMonth(), now.getDate());
    }).sort((a,b) => (a.date instanceof Date ? a.date : new Date(a.date)) - (b.date instanceof Date ? b.date : new Date(b.date)));
    if (!upcoming.length) return '';
    const next = upcoming[0];
    const d = next.date instanceof Date ? next.date : new Date(next.date);
    const dateStr = `${d.getMonth()+1}/${d.getDate()}`;
    return `<div class="kanban-card-event"><i data-lucide="clock" style="width:10px;height:10px;vertical-align:-1px;"></i> ${dateStr} ${next.startTime} ${escapeHtml(next.title)}</div>`;
}

// 详情弹窗：显示关联日程列表
function getDetailEventSection(delivery) {
    const events = calendarEvents.filter(ev => ev.deliveryId === delivery.id && !ev.cancelled);
    if (!events.length) return '';
    const sorted = events.sort((a,b) => {
        const da = a.date instanceof Date ? a.date : new Date(a.date);
        const db = b.date instanceof Date ? b.date : new Date(b.date);
        return da - db;
    });
    const evHtml = sorted.map(ev => {
        const d = ev.date instanceof Date ? ev.date : new Date(ev.date);
        const dateStr = `${d.getMonth()+1}月${d.getDate()}日`;
        const typeColors = { '笔试':'#f59e0b', '一面':'#3b82f6', '二面':'#6366f1', '三面':'#8b5cf6', 'Offer':'#10b981', '面试':'#3b82f6', '其他':'#6b7280' };
        const typeColor = typeColors[ev.type] || '#6b7280';
        const statusStr = ev.completed ? '<span style="font-size:10px;background:var(--success-50);color:var(--success-600);padding:2px 6px;border-radius:4px;margin-left:6px;font-weight:600;">已完成</span>' : '';
        return `<div style="padding:12px;background:linear-gradient(135deg, ${typeColor}08, ${typeColor}05);border-left:3px solid ${typeColor};border-radius:8px;margin-bottom:8px;transition:all 0.2s;cursor:pointer;" onmouseover="this.style.background='linear-gradient(135deg, ${typeColor}15, ${typeColor}08)'" onmouseout="this.style.background='linear-gradient(135deg, ${typeColor}08, ${typeColor}05)'">
            <div style="display:flex;align-items:center;gap:8px;margin-bottom:6px;">
                <span style="background:${typeColor};color:white;padding:2px 8px;border-radius:6px;font-size:11px;font-weight:700;">${ev.type}</span>
                <div style="font-size:13px;font-weight:700;color:var(--gray-800);flex:1;">${escapeHtml(ev.title)}</div>
                ${statusStr}
            </div>
            <div style="display:flex;align-items:center;gap:12px;font-size:12px;color:var(--gray-600);">
                <span style="display:flex;align-items:center;gap:4px;"><i data-lucide="calendar" style="width:12px;height:12px;"></i>${dateStr}</span>
                <span style="display:flex;align-items:center;gap:4px;"><i data-lucide="clock" style="width:12px;height:12px;"></i>${ev.startTime}${ev.endTime?'-'+ev.endTime:''}</span>
            </div>
        </div>`;
    }).join('');
    return `<div style="margin-bottom:20px;">
        <div style="font-size:13px;font-weight:700;color:var(--gray-700);display:flex;align-items:center;gap:6px;margin-bottom:12px;padding-bottom:8px;border-bottom:2px solid var(--gray-100);"><i data-lucide="calendar-check" style="width:16px;height:16px;color:var(--primary-500);"></i>关联日程</div>
        ${evHtml}
    </div>`;
}

function renderDeliveryView() {
    // 动态填充渠道筛选选项（来自投递记录）
    const channelSelect = document.getElementById('filterChannel');
    if (channelSelect && channelSelect.options.length <= 1) {
        const channels = [...new Set(deliveries.map(d => d.channel).filter(Boolean))];
        channels.forEach(c => { const o = document.createElement('option'); o.value = c; o.textContent = c; channelSelect.appendChild(o); });
    }
    // 动态填充阶段筛选选项
    syncFilterStageOptions();

    const colHeadersEl = document.getElementById('kanbanColHeaders');
    if (deliveryView === 'kanban') {
        document.getElementById('kanbanView').style.display = '';
        document.getElementById('listView').style.display = 'none';
        if (colHeadersEl) colHeadersEl.style.display = '';
        renderKanban();
    } else {
        document.getElementById('kanbanView').style.display = 'none';
        document.getElementById('listView').style.display = '';
        if (colHeadersEl) colHeadersEl.style.display = 'none';
        renderListView();
    }
}

function renderKanban() {
    buildKanbanColsFromDeliveries();
    const filtered = filterDeliveries();
    const board = document.getElementById('kanbanBoard');
    const colHeadersEl = document.getElementById('kanbanColHeaders');

    // 隐藏固定列标题行
    if (colHeadersEl) colHeadersEl.style.display = 'none';

    // 渲染看板列（包含标题）
    board.innerHTML = KANBAN_COLS.map(col => {
        const cards = filtered.filter(d => getColForDelivery(d).key === col.key);
        const cardsHtml = cards.length ? cards.map(d => {
            const lastStageDate = d.history && d.history.length > 0 ? d.history[d.history.length - 1].time : d.postDate;
            const days = daysSince(lastStageDate);
            const urgClass = days >= 14 ? 'urgent' : days >= 7 ? 'warn' : 'ok';
            const urgLabel = days >= 14 ? `${days}天 ⚠` : `${days}天`;
            const colColor = getColForDelivery(d).color;
            const statusInfo = getCardStatusLabel(d);
            const locationStr = d.location ? `<div class="kanban-card-location"><i data-lucide="map-pin" style="width:10px;height:10px;vertical-align:-1px;"></i> ${escapeHtml(d.location)}</div>` : '';
            const eventStr = getCardEventInfo(d);
            const termBgMap = {
                'status-rejected':   'var(--error-50)',
                'status-eliminated': '#fffbeb',
                'status-accepted':   '#f5f3ff',
                'status-offer':      'var(--success-50)',
            };
            const termBg = termBgMap[statusInfo.cls] ? `background:${termBgMap[statusInfo.cls]};` : '';
            return `<div class="kanban-card" data-id="${d.id}" draggable="${d.status === '进行中' ? 'true' : 'false'}" style="border-left-color:${colColor};${termBg}">
                <div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:3px;">
                    <div class="kanban-card-company">${escapeHtml(d.company)}</div>
                    <span class="status-badge ${statusInfo.cls}" style="font-size:10px;padding:1px 6px;flex-shrink:0;margin-left:4px;">${statusInfo.text}</span>
                </div>
                <div class="kanban-card-job">${escapeHtml(d.jobTitle)}</div>
                ${locationStr}
                <div class="kanban-card-date"><i data-lucide="calendar" style="width:10px;height:10px;vertical-align:-1px;"></i> ${d.postDate}</div>
                ${eventStr}
                <div class="kanban-card-footer">
                    <span class="kanban-card-channel">${escapeHtml(d.channel)}</span>
                    <span class="kanban-card-days ${urgClass}">${urgLabel}</span>
                </div>
                <div class="kanban-card-actions">
                    <button class="kanban-action-btn kn-detail" data-id="${d.id}"><i data-lucide="file-text"></i>详情</button>
                    <button class="kanban-action-btn kn-followup" data-id="${d.id}"><i data-lucide="edit-3"></i>跟进</button>
                </div>
            </div>`;
        }).join('') : `<div class="kanban-empty">暂无</div>`;

        return `<div class="kanban-col" data-col-key="${col.key}" draggable="true">
            <div class="kanban-col-header">
                <div class="kanban-col-title"><span class="kanban-col-dot" style="background:${col.color};"></span>${col.label}</div>
                <div style="display:flex;align-items:center;gap:4px;">
                    <span class="kanban-col-count">${cards.length}</span>
                    ${!col.builtin ? `<button class="kanban-col-del-btn" data-col-key="${col.key}" title="删除此阶段">×</button>` : ''}
                </div>
            </div>
            <div class="kanban-cards" data-col-key="${col.key}">${cardsHtml}</div>
        </div>`;
    }).join('') + `<div class="kanban-add-col">
        <button class="kanban-add-btn" id="addColBtn" title="添加阶段"><i data-lucide="plus" style="width:16px;height:16px;"></i></button>
    </div>`;

    initLucideIcons();

    // 左右导航按钮控制横向滚动
    const scrollWrap = document.getElementById('kanbanScrollWrap');
    const navLeft = document.getElementById('kanbanNavLeft');
    const navRight = document.getElementById('kanbanNavRight');

    // 更新按钮状态（禁用/启用）
    function updateNavButtons() {
        if (!scrollWrap || !navLeft || !navRight) return;

        const scrollLeft = scrollWrap.scrollLeft;
        const scrollWidth = scrollWrap.scrollWidth;
        const clientWidth = scrollWrap.clientWidth;

        // 判断是否需要显示按钮（内容宽度大于容器宽度）
        const needScroll = scrollWidth > clientWidth;

        if (!needScroll) {
            navLeft.style.display = 'none';
            navRight.style.display = 'none';
            return;
        } else {
            navLeft.style.display = 'flex';
            navRight.style.display = 'flex';
        }

        // 左按钮：滚动到最左侧时禁用
        navLeft.disabled = scrollLeft <= 0;
        // 右按钮：滚动到最右侧时禁用
        navRight.disabled = scrollLeft + clientWidth >= scrollWidth - 1;
    }

    if (scrollWrap) {
        scrollWrap.onscroll = () => {
            updateNavButtons();
        };
    }

    if (navLeft && scrollWrap) {
        navLeft.onclick = () => {
            const colW = 220 + 12; // 列宽 + gap
            scrollWrap.scrollBy({ left: -colW * 2, behavior:'smooth' });
        };
    }

    if (navRight && scrollWrap) {
        navRight.onclick = () => {
            const colW = 220 + 12; // 列宽 + gap
            scrollWrap.scrollBy({ left: colW * 2, behavior:'smooth' });
        };
    }

    // 初始化按钮状态
    updateNavButtons();

    // 监听窗口大小变化
    window.addEventListener('resize', updateNavButtons);

    // 添加阶段（看板内）
    const addColBtn = board.querySelector('#addColBtn');
    if (addColBtn) addColBtn.addEventListener('click', () => {
        const label = prompt('请输入新阶段名称（如：HR面、终面）');
        if (label && label.trim()) addKanbanCol(label.trim());
    });

    // 删除自定义阶段（看板内）
    board.querySelectorAll('.kanban-col-del-btn').forEach(btn => {
        btn.addEventListener('click', e => {
            e.stopPropagation();
            const key = btn.dataset.colKey;
            const col = KANBAN_COLS.find(c => c.key === key);
            if (col && confirm(`确定删除「${col.label}」阶段？该阶段的投递将移回初筛列。`)) deleteKanbanCol(key);
        });
    });

    // 点击事件
    board.querySelectorAll('.kn-detail').forEach(b => b.addEventListener('click', e => { e.stopPropagation(); showDeliveryDetail(b.dataset.id); }));
    board.querySelectorAll('.kn-followup').forEach(b => b.addEventListener('click', e => { e.stopPropagation(); openFollowupModal(b.dataset.id); }));
    board.querySelectorAll('.kanban-card').forEach(card => card.addEventListener('click', () => showDeliveryDetail(card.dataset.id)));

    // 拖拽事件
    let draggingCardId = null;
    let draggingColKey = null;

    // 卡片拖拽
    board.querySelectorAll('.kanban-card').forEach(card => {
        card.addEventListener('dragstart', e => {
            draggingCardId = card.dataset.id;
            draggingColKey = null;
            e.dataTransfer.setData('text/plain', 'card:' + card.dataset.id);
            e.dataTransfer.effectAllowed = 'move';
            setTimeout(() => card.classList.add('dragging'), 0);
        });
        card.addEventListener('dragend', () => {
            draggingCardId = null;
            card.classList.remove('dragging');
            board.querySelectorAll('.kanban-cards').forEach(c => c.classList.remove('drag-over'));
        });
    });

    // 列拖拽排序
    board.querySelectorAll('.kanban-col').forEach(col => {
        col.addEventListener('dragstart', e => {
            if (e.target.closest('.kanban-card')) return; // 卡片拖拽优先
            draggingColKey = col.dataset.colKey;
            draggingCardId = null;
            e.dataTransfer.setData('text/plain', 'col:' + col.dataset.colKey);
            e.dataTransfer.effectAllowed = 'move';
            setTimeout(() => col.classList.add('col-dragging'), 0);
        });
        col.addEventListener('dragend', () => {
            draggingColKey = null;
            col.classList.remove('col-dragging');
            board.querySelectorAll('.kanban-col').forEach(c => c.classList.remove('col-drag-over'));
        });
        col.addEventListener('dragover', e => {
            e.preventDefault();
            if (!draggingColKey) return;
            if (col.dataset.colKey === draggingColKey) return;
            board.querySelectorAll('.kanban-col').forEach(c => c.classList.remove('col-drag-over'));
            col.classList.add('col-drag-over');
        });
        col.addEventListener('dragleave', e => {
            if (!col.contains(e.relatedTarget)) col.classList.remove('col-drag-over');
        });
        col.addEventListener('drop', e => {
            e.preventDefault();
            col.classList.remove('col-drag-over');
            const raw = e.dataTransfer.getData('text/plain');
            if (!raw.startsWith('col:')) return;
            const fromKey = raw.slice(4);
            const toKey = col.dataset.colKey;
            if (fromKey === toKey) return;
            const fromIdx = KANBAN_COLS.findIndex(c => c.key === fromKey);
            const toIdx   = KANBAN_COLS.findIndex(c => c.key === toKey);
            if (fromIdx === -1 || toIdx === -1) return;
            const [moved] = KANBAN_COLS.splice(fromIdx, 1);
            KANBAN_COLS.splice(toIdx, 0, moved);
            syncFilterStageOptions();
            renderKanban();
        });
    });

    board.querySelectorAll('.kanban-cards').forEach(zone => {
        zone.addEventListener('dragover', e => {
            if (draggingColKey) return; // 列拖拽时不触发卡片放置高亮
            e.preventDefault();
            e.dataTransfer.dropEffect = 'move';
            zone.classList.add('drag-over');
        });
        zone.addEventListener('dragleave', e => {
            if (!zone.contains(e.relatedTarget)) zone.classList.remove('drag-over');
        });
        zone.addEventListener('drop', e => {
            e.preventDefault();
            zone.classList.remove('drag-over');
            const raw = e.dataTransfer.getData('text/plain');
            if (!raw.startsWith('card:')) return;
            const id = raw.slice(5);
            const delivery = deliveries.find(d => d.id === id);
            if (!delivery) return;
            const targetColKey = zone.dataset.colKey;
            const currentColKey = getColForDelivery(delivery).key;
            if (currentColKey === targetColKey) return;
            const targetCol = KANBAN_COLS.find(c => c.key === targetColKey);
            if (!targetCol) return;

            // 查找该投递当前阶段未完成的日程
            const pendingEvents = calendarEvents.filter(ev =>
                ev.deliveryId === delivery.id && !ev.completed && !ev.cancelled
            );

            const doStageChange = () => {
                const oldStage = delivery.stage;
                delivery.stage = targetCol.defaultStage;
                const isTerminal = TERMINAL_STAGES.includes(targetCol.defaultStage);
                delivery.status = targetCol.defaultStage === 'offer' ? '已Offer' : isTerminal ? targetCol.defaultStage : '进行中';
                if (!delivery.history) delivery.history = [];
                delivery.history.push({ from:oldStage, to:targetCol.defaultStage, time:new Date().toISOString().slice(0,10), log:'' });
                delivery.lastFollowupDate = new Date().toISOString().slice(0,10);

                // 已拒绝/已淘汰：自动取消所有未完成日程
                if (isTerminal) {
                    calendarEvents.forEach(ev => {
                        if (ev.deliveryId === delivery.id && !ev.completed && !ev.cancelled) {
                            ev.cancelled = true;
                        }
                    });
                    renderKanban();
                    renderCalendar && renderCalendar();
                    updateTodayReminders && updateTodayReminders();
                    showToast(`已标记为${targetCol.defaultStage}，相关日程已自动取消`);
                } else {
                    renderKanban();
                    // 弹新建日程界面
                    setTimeout(() => openAutoEventModal(delivery, { type: targetCol.defaultStage, title: targetCol.label }), 100);
                }
            };

            if (pendingEvents.length > 0 && !TERMINAL_STAGES.includes(targetCol.defaultStage)) {
                // 询问是否完成当前阶段日程
                const eventNames = pendingEvents.map(ev => `「${ev.title}」(${ev.startTime})`).join('、');
                const confirmMsg = `检测到当前阶段有未完成的日程：${eventNames}\n\n是否标记为已完成？`;
                if (confirm(confirmMsg)) {
                    pendingEvents.forEach(ev => { ev.completed = true; });
                    showToast('日程已标记为完成');
                }
                doStageChange();
            } else {
                doStageChange();
            }
        });
    });
}

function getStageClass(s) {
    if(s==='简历投递') return 'stage-resume';
    if(s==='简历初筛') return 'stage-screening';
    if(s==='测评') return 'stage-assessment';
    if(s==='笔试') return 'stage-exam';
    if(isInterviewStage(s)) return 'stage-interview';
    if(s==='offer') return 'stage-offer';
    if(s==='已拒绝'||s==='已淘汰') return 'stage-reject';
    return 'stage-terminated';
}
function getStatusClass(s) {
    if(s==='进行中') return 'status-active';
    if(s==='已结束') return 'status-ended';
    if(s==='已拒绝') return 'status-rejected';
    if(s==='已淘汰') return 'status-eliminated';
    return 'status-active';
}
function filterDeliveries() {
    let f = [...deliveries];
    if(filters.company) f=f.filter(d=>d.company.toLowerCase().includes(filters.company.toLowerCase()));
    if(filters.stage!=='all') {
        const col = KANBAN_COLS.find(c=>c.key===filters.stage);
        if(col) f=f.filter(d=>col.match(d.stage));
        else f=f.filter(d=>d.stage===filters.stage); // terminal stages (已拒绝/已淘汰)
    }
    if(filters.status!=='all') {
        if (filters.status === '已offer') f=f.filter(d=>d.stage==='offer');
        else if (filters.status === '已接受') f=f.filter(d=>d.stage==='已接受'||d.status==='已接受');
        else f=f.filter(d=>d.status===filters.status);
    }
    if(filters.channel!=='all') f=f.filter(d=>d.channel===filters.channel);
    if(filters.dateRange!=='all') { const days=parseInt(filters.dateRange); const cut=new Date(); cut.setDate(cut.getDate()-days); f=f.filter(d=>new Date(d.postDate)>=cut); }
    return f;
}
function renderListView() {
    const filtered = filterDeliveries();
    const total = filtered.length;
    const totalPages = Math.ceil(total/pageSize_d);
    const start = (currentPage_d-1)*pageSize_d;
    const pageData = filtered.slice(start, start+pageSize_d);
    const tbody = document.getElementById('deliveryTableBody');
    if (!pageData.length) {
        tbody.innerHTML = '<tr><td colspan="7" style="text-align:center;padding:48px;color:var(--gray-400);">暂无投递记录</td></tr>';
    } else {
        tbody.innerHTML = pageData.map(d => {
            const colLabel = getDetailStageLabel(d);
            const statusLabel = getDetailStatusLabel(d);
            return `<tr data-id="${d.id}">
            <td class="checkbox-col"><input type="checkbox" class="delivery-checkbox" data-id="${d.id}" ${selectedIds.has(d.id)?'checked':''}></td>
            <td><div class="company-cell">${escapeHtml(d.company)}</div><div class="job-cell">${escapeHtml(d.jobTitle)}</div></td>
            <td class="date-cell">${d.location||'-'}</td>
            <td class="date-cell">${d.postDate}</td>
            <td><span class="stage-badge ${getStageClass(d.stage)}">${colLabel}</span></td>
            <td><span class="status-badge ${statusLabel.cls}">${statusLabel.text}</span></td>
            <td><span class="channel-badge">${d.channel}</span></td>
            <td><div class="action-btns">
                <button class="action-btn detail-btn" data-id="${d.id}"><i data-lucide="file-text"></i>详情</button>
                <button class="action-btn followup-btn-d" data-id="${d.id}"><i data-lucide="edit-3"></i>跟进</button>
            </div></td>
        </tr>`; }).join('');
    }
    document.getElementById('paginationInfo').innerHTML = `共 ${total} 条  第 ${currentPage_d}/${totalPages||1} 页`;
    renderPagination(totalPages);
    bindDeliveryCheckboxes();
    bindDeliveryActions();
    initLucideIcons();
}

function renderPagination(total) {
    const c = document.getElementById('paginationButtons');
    if (total <= 1) { c.innerHTML=''; return; }
    let html = `<button class="page-btn" data-p="${currentPage_d-1}" ${currentPage_d===1?'disabled':''}>上一页</button>`;
    for (let i=1;i<=Math.min(total,5);i++) html += `<button class="page-btn ${i===currentPage_d?'active':''}" data-p="${i}">${i}</button>`;
    html += `<button class="page-btn" data-p="${currentPage_d+1}" ${currentPage_d===total?'disabled':''}>下一页</button>`;
    c.innerHTML = html;
    c.querySelectorAll('.page-btn').forEach(btn => {
        btn.addEventListener('click', () => { const p=parseInt(btn.dataset.p); if(!isNaN(p)&&p>=1&&p<=total){currentPage_d=p;renderListView();} });
    });
}

function bindDeliveryCheckboxes() {
    document.querySelectorAll('.delivery-checkbox').forEach(cb => {
        cb.addEventListener('change', () => { if(cb.checked) selectedIds.add(cb.dataset.id); else selectedIds.delete(cb.dataset.id); updateBatchBar(); });
    });
    const sa = document.getElementById('selectAllCheckbox');
    if (sa) sa.addEventListener('change', e => {
        const ids = filterDeliveries().slice((currentPage_d-1)*pageSize_d, currentPage_d*pageSize_d).map(d=>d.id);
        ids.forEach(id => { if(e.target.checked) selectedIds.add(id); else selectedIds.delete(id); });
        renderListView(); updateBatchBar();
    });
}

function updateBatchBar() {
    const bar = document.getElementById('batchBar');
    document.getElementById('selectedCount').innerText = selectedIds.size;
    if (selectedIds.size > 0) bar.classList.add('show'); else bar.classList.remove('show');
}

function bindDeliveryActions() {
    document.querySelectorAll('.detail-btn').forEach(btn => btn.addEventListener('click', () => showDeliveryDetail(btn.dataset.id)));
    document.querySelectorAll('.followup-btn-d').forEach(btn => btn.addEventListener('click', () => openFollowupModal(btn.dataset.id)));
}

function showDeliveryDetail(id) {
    const d = deliveries.find(x=>x.id===id); if (!d) return;
    document.getElementById('modalCompanyName').textContent = d.company;
    document.getElementById('modalJobTitle').textContent = d.jobTitle;
    const statusInfo = getDetailStatusLabel(d);
    const stageLabel = getDetailStageLabel(d);

    // 关联日程（按日期排列）
    const events = calendarEvents.filter(ev => ev.deliveryId === d.id && !ev.cancelled);
    events.sort((a,b) => {
        const da = a.date instanceof Date ? a.date : new Date(a.date);
        const db = b.date instanceof Date ? b.date : new Date(b.date);
        return db - da; // 倒序
    });

    // 跟进记录
    const followups = [...(d.followups||[])].sort((a,b) => b.time.localeCompare(a.time));

    // 按阶段分组：每个阶段一个独立模块，包含日程事件 + 该阶段的跟进记录
    const groups = [];
    const typeColors = { '笔试':'#f59e0b', '一面':'#ec4899', '二面':'#8b5cf6', '三面':'#f97316', 'Offer':'#10b981', 'offer':'#10b981', '已接受':'#059669', '面试':'#3b82f6', '投递':'#6b7280', '简历初筛':'#6b7280', '简历投递':'#6b7280', '已拒绝':'#ef4444', '已淘汰':'#ef4444', '其他':'#6b7280' };

    const normalizeStage = s => (s === 'offer' ? 'Offer' : s);

    // 收集所有出现过的阶段（从 events 和 followups 中）
    const stageSet = new Set();
    events.forEach(ev => stageSet.add(normalizeStage(ev.type)));
    followups.forEach(f => { if (f.stage) stageSet.add(normalizeStage(f.stage)); });

    // 按 STAGE_ORDER 排序（倒序，最新阶段在前）
    // 终止阶段（已接受/已拒绝/已淘汰）排在 offer 之上
    const DETAIL_STAGE_ORDER = ['简历投递','简历初筛','测评','笔试','一面','二面','三面','四面','Offer','已拒绝','已淘汰','已接受'];
    const stageList = [...stageSet].sort((a,b) => {
        const ia = DETAIL_STAGE_ORDER.indexOf(a), ib = DETAIL_STAGE_ORDER.indexOf(b);
        return (ib === -1 ? -1 : ib) - (ia === -1 ? -1 : ia);
    });

    stageList.forEach(stage => {
        const stageEvents = events.filter(ev => normalizeStage(ev.type) === stage);
        const stageFus = followups.filter(f => normalizeStage(f.stage) === stage);
        if (stageEvents.length || stageFus.length) {
            groups.push({ stage, events: stageEvents, followups: stageFus });
        }
    });

    // 没有 stage 标记的旧 followup，归入最早阶段或单独显示
    const untaggedFus = followups.filter(f => !f.stage);
    if (untaggedFus.length) {
        if (groups.length > 0) {
            groups[groups.length - 1].followups.push(...untaggedFus);
        } else {
            groups.push({ stage: '投递', events: [], followups: untaggedFus });
        }
    }

    function renderStageGroup(group, isLast) {
        const typeColor = typeColors[group.stage] || '#6b7280';
        const eventsHtml = group.events.map(ev => {
            const evDate = ev.date instanceof Date ? ev.date : new Date(ev.date);
            const fullDateLabel = `${evDate.getFullYear()}-${String(evDate.getMonth()+1).padStart(2,'0')}-${String(evDate.getDate()).padStart(2,'0')} ${ev.startTime||''}`;
            const completedBadge = ev.completed ? `<span style="font-size:11px;color:var(--success-600);font-weight:600;margin-left:8px;">✓ 已完成</span>` : '';
            const hasLink = ev.location && ev.location.startsWith('http');
            return `<div style="margin-left:22px;background:white;border:1px solid var(--gray-200);border-radius:10px;padding:14px 16px;margin-bottom:10px;">
                <div style="font-size:12px;color:var(--gray-400);margin-bottom:6px;">${fullDateLabel}</div>
                <div style="font-size:15px;font-weight:700;color:var(--gray-800);margin-bottom:8px;display:flex;align-items:center;gap:8px;">
                    ${escapeHtml(ev.company||d.company) + '  ' + escapeHtml(ev.job||d.jobTitle)}${completedBadge}
                </div>
                ${ev.startTime ? `<div style="display:flex;align-items:center;gap:8px;font-size:13px;color:var(--gray-500);margin-bottom:${ev.location||ev.notes?'8':'0'}px;">
                    ${ev.startTime}${ev.endTime?' – '+ev.endTime:''}${hasLink ? `&nbsp;&nbsp;<a href="${escapeHtml(ev.location)}" target="_blank" style="color:var(--primary-600);text-decoration:none;font-size:12px;">${escapeHtml(ev.location)}</a>` : ''}
                </div>` : ''}
                ${ev.location && !hasLink ? `<div style="font-size:12px;color:var(--gray-500);display:flex;align-items:center;gap:5px;margin-bottom:${ev.notes?'8':'0'}px;">
                    <i data-lucide="map-pin" style="width:12px;height:12px;flex-shrink:0;"></i>${escapeHtml(ev.location)}
                </div>` : ''}
                ${ev.notes ? renderClampedText(ev.notes, { title:'事件备注', lines:2, textStyle:'font-size:13px;color:var(--gray-600);line-height:1.5;' }) : ''}
            </div>`;
        }).join('');

        const fusHtml = group.followups.length ? group.followups.map((f, idx) => `<div style="margin-left:22px;${idx>0?'margin-top:14px;':''}">
    <div style="font-size:12px;color:var(--gray-400);margin-bottom:5px;">${f.time}</div>
    ${renderClampedText(f.text, { title:'跟进日志', lines:2, textStyle:'font-size:13px;color:var(--gray-600);line-height:1.6;' })}
</div>`).join('') : '';

        return `<div style="padding:16px 0;${!isLast?'border-bottom:1px solid var(--gray-100);':''}">
            <div style="display:flex;align-items:center;gap:10px;margin-bottom:10px;">
                <div style="width:10px;height:10px;border-radius:50%;background:${typeColor};flex-shrink:0;box-shadow:0 0 0 3px ${typeColor}30;"></div>
                <span style="background:${typeColor};color:white;padding:2px 10px;border-radius:5px;font-size:12px;font-weight:700;">${group.stage}</span>
            </div>
            ${eventsHtml}
            ${fusHtml ? `<div style="margin-top:${group.events.length?'4':'0'}px;">${fusHtml}</div>` : ''}
        </div>`;
    }

    let timelineHtml = '';
    if (groups.length === 0) {
        timelineHtml = "<div style='color:var(--gray-400);font-size:13px;padding:20px 0;text-align:center;'>暂无记录</div>";
    } else {
        groups.forEach((g, i) => {
            const isLast = i === groups.length - 1;
            timelineHtml += renderStageGroup(g, isLast);
        });
    }

    const tHtml = d.tags?.length ? d.tags.map(t=>`<span class="tag-item" style="font-size:12px;padding:3px 10px;">${escapeHtml(t)}</span>`).join('') : '';
    document.getElementById('detailModalBody').innerHTML = `
        <div style="display:flex;flex-wrap:wrap;gap:8px;margin-bottom:16px;padding-bottom:16px;border-bottom:1px solid var(--gray-100);align-items:center;">
            <span class="status-badge ${statusInfo.cls}" style="display:flex;align-items:center;gap:4px;"><i data-lucide="circle-dot" style="width:11px;height:11px;"></i>${statusInfo.text}</span>
            <span class="stage-badge ${getStageClass(d.stage)}">${stageLabel}</span>
            <div style="flex:1;"></div>
            ${tHtml}
        </div>
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;margin-bottom:20px;">
            <div><div style="font-size:11px;color:var(--gray-400);font-weight:600;text-transform:uppercase;letter-spacing:0.05em;margin-bottom:3px;">投递日期</div><div style="font-size:13px;color:var(--gray-700);display:flex;align-items:center;gap:5px;"><i data-lucide="calendar" style="width:13px;height:13px;color:var(--gray-400);"></i>${d.postDate}</div></div>
            <div><div style="font-size:11px;color:var(--gray-400);font-weight:600;text-transform:uppercase;letter-spacing:0.05em;margin-bottom:3px;">工作地点</div><div style="font-size:13px;color:var(--gray-700);display:flex;align-items:center;gap:5px;"><i data-lucide="map-pin" style="width:13px;height:13px;color:var(--gray-400);"></i>${d.location||'未填写'}</div></div>
            <div><div style="font-size:11px;color:var(--gray-400);font-weight:600;text-transform:uppercase;letter-spacing:0.05em;margin-bottom:3px;">渠道</div><div style="font-size:13px;color:var(--gray-700);display:flex;align-items:center;gap:5px;"><i data-lucide="send" style="width:13px;height:13px;color:var(--gray-400);"></i>${escapeHtml(d.channel)}</div></div>
            <div><div style="font-size:11px;color:var(--gray-400);font-weight:600;text-transform:uppercase;letter-spacing:0.05em;margin-bottom:3px;">期望薪资</div><div style="font-size:13px;color:var(--gray-700);display:flex;align-items:center;gap:5px;"><i data-lucide="banknote" style="width:13px;height:13px;color:var(--gray-400);"></i>${d.expectedSalary||'未填写'}</div></div>
            <div><div style="font-size:11px;color:var(--gray-400);font-weight:600;text-transform:uppercase;letter-spacing:0.05em;margin-bottom:3px;">关联简历</div><div style="font-size:13px;color:var(--gray-700);display:flex;align-items:center;gap:5px;"><i data-lucide="file-text" style="width:13px;height:13px;color:var(--gray-400);"></i>${escapeHtml(d.resumeName)}</div></div>
            ${d.url?`<div><div style="font-size:11px;color:var(--gray-400);font-weight:600;text-transform:uppercase;letter-spacing:0.05em;margin-bottom:3px;">职位链接</div><a href="${d.url}" target="_blank" style="font-size:13px;color:var(--primary-600);display:flex;align-items:center;gap:5px;text-decoration:none;"><i data-lucide="external-link" style="width:13px;height:13px;"></i>查看职位</a></div>`:''}
        </div>
        <div>
            <div style="font-size:14px;font-weight:700;color:var(--gray-700);display:flex;align-items:center;gap:6px;margin-bottom:16px;padding-bottom:10px;border-bottom:2px solid var(--gray-100);"><i data-lucide="activity" style="width:17px;height:17px;color:var(--primary-500);"></i>进展记录</div>
            <div style="max-height:400px;overflow-y:auto;padding-left:4px;">${timelineHtml}</div>
        </div>`;
    document.getElementById('detailModal').classList.add('active');
    initLucideIcons();
    refreshClampButtons(document.getElementById('detailModalBody'));
}

// 格式化日程日期显示
function formatEventDate(date) {
    const d = date instanceof Date ? date : new Date(date);
    return `${d.getMonth()+1}-${String(d.getDate()).padStart(2,'0')}`;
}

function openFollowupModal(id, _unused) {
    const d = deliveries.find(x=>x.id===id); if(!d) return;
    currentOpDelivery = d;
    document.getElementById('followupCompanyName').innerText = d.company;
    document.getElementById('followupJobTitle').innerText = d.jobTitle;
    // 显示当前阶段
    const currentColLabel = getDetailStageLabel(d);
    document.getElementById('followupCurrentStage').innerText = currentColLabel;

    // 终止按钮：根据阶段显示不同选项
    const isTerminal = TERMINAL_STAGES.includes(d.stage) || d.stage === '已接受';
    const isOffer = d.stage === 'offer';
    const btnsWrap = document.getElementById('terminalBtnsWrap');
    if (btnsWrap) {
        if (isTerminal) {
            btnsWrap.style.display = 'none';
        } else if (isOffer) {
            btnsWrap.style.display = '';
            btnsWrap.innerHTML = `<button class="btn btn-outline" onclick="applyTerminalStage('已接受')" style="font-size:12px;padding:7px 12px;color:var(--success-600);border-color:var(--success-200);display:inline-flex;align-items:center;justify-content:center;gap:4px;"><i data-lucide="check-circle" style="width:13px;height:13px;"></i>已接受</button>
                <button class="btn btn-outline" onclick="applyTerminalStage('已拒绝')" style="font-size:12px;padding:7px 12px;color:var(--error-600);border-color:var(--error-200);display:inline-flex;align-items:center;justify-content:center;gap:4px;"><i data-lucide="x-circle" style="width:13px;height:13px;"></i>已拒绝</button>`;
            initLucideIcons();
        } else {
            btnsWrap.style.display = '';
            btnsWrap.innerHTML = `<button class="btn btn-outline" id="markRejectedBtn" style="font-size:12px;padding:7px 12px;color:var(--error-600);border-color:var(--error-200);display:inline-flex;align-items:center;justify-content:center;gap:4px;"><i data-lucide="x-circle" style="width:13px;height:13px;"></i>已拒绝</button>
                <button class="btn btn-outline" id="markEliminatedBtn" style="font-size:12px;padding:7px 12px;color:#92400e;border-color:#fde68a;display:inline-flex;align-items:center;justify-content:center;gap:4px;"><i data-lucide="alert-circle" style="width:13px;height:13px;"></i>已淘汰</button>`;
            initLucideIcons();
            document.getElementById('markRejectedBtn').addEventListener('click', () => applyTerminalStage('已拒绝'));
            document.getElementById('markEliminatedBtn').addEventListener('click', () => applyTerminalStage('已淘汰'));
        }
    }

    document.getElementById('followupText').value = '';
    document.getElementById('followupText').style.borderColor = '';
    document.getElementById('followupText').placeholder = isTerminal ? '流程已结束，记录补充信息...' : '记录面试情况、沟通内容、下一步计划...';
    document.getElementById('followupModal').classList.add('active');
    initLucideIcons();
}

function applyTerminalStage(terminalStage) {
    if (!currentOpDelivery) return;
    const text = document.getElementById('followupText').value.trim();
    const old = currentOpDelivery.stage;
    currentOpDelivery.stage = terminalStage;
    if (!currentOpDelivery.history) currentOpDelivery.history = [];
    currentOpDelivery.history.push({ from:old, to:terminalStage, time:new Date().toISOString().slice(0,10), log:text||'—' });
    if (terminalStage === '已接受') {
        currentOpDelivery.status = '已接受';
    } else if (terminalStage === '已拒绝') {
        currentOpDelivery.status = '已拒绝';
    } else {
        currentOpDelivery.status = '已淘汰';
    }
    addFollowupRecord(currentOpDelivery, text || terminalStage);
    document.getElementById('followupModal').classList.remove('active');
    showToast('已标记为：' + terminalStage);
    renderDeliveryView();
}

// 判断阶段变更是否需要自动建立日程
function shouldAutoCreateEvent(newStage) {
    if (newStage === '笔试' || newStage === '测评') return { type:'笔试', title:'笔试' };
    if (isInterviewStage(newStage) || newStage.includes('面')) return { type:'面试', title:newStage };
    if (newStage === 'offer') return { type:'Offer', title:'Offer 签约确认' };
    return null;
}

function openAutoEventModal(delivery, eventHint) {
    const today = new Date();
    const y = today.getFullYear(), m = String(today.getMonth()+1).padStart(2,'0'), d = String(today.getDate()).padStart(2,'0');
    const startH = String(today.getHours()).padStart(2,'0'), startM = String(today.getMinutes()).padStart(2,'0');
    const endDate = new Date(today.getTime() + 30*60*1000);
    const endH = String(endDate.getHours()).padStart(2,'0'), endM = String(endDate.getMinutes()).padStart(2,'0');
    currentEditingEventId = null;
    document.getElementById('eventModalTitle').innerText = '新建日程';
    const stageToType = { '笔试':'笔试', '测评':'笔试', '一面':'一面', '二面':'二面', '三面':'三面', '四面':'三面', 'HR面':'一面', 'offer':'Offer', 'Offer':'Offer' };
    const eType = stageToType[eventHint.type] || stageToType[eventHint.title] || '一面';
    document.getElementById('eventType').value = eType;
    document.getElementById('eventTitle').value = `${delivery.company} ${eventHint.title}`;
    document.getElementById('eventDate').value = `${y}-${m}-${d}`;
    document.getElementById('eventStartTime').value = `${startH}:${startM}`;
    document.getElementById('eventEndTime').value = `${endH}:${endM}`;
    document.getElementById('eventLocation').value = '';
    document.getElementById('eventReminder').value = '15';
    document.getElementById('eventNotes').value = '';
    document.getElementById('modeOnline').checked = true;
    document.getElementById('eventDeliveryId').innerHTML = buildDeliveryOptions(delivery.id);
    setupInterviewModeToggle();
    document.getElementById('eventModal').classList.add('active');
}

function saveFollowup() {
    if(!currentOpDelivery) return;
    const text = document.getElementById('followupText').value.trim();
    if (!text) {
        showToast('请填写跟进日志', 'error');
        document.getElementById('followupText').focus();
        return;
    }
    addFollowupRecord(currentOpDelivery, text);
    document.getElementById('followupModal').classList.remove('active');
}

function addFollowupRecord(d, text) {
    const now = new Date();
    const t = now.toISOString().slice(0,10)+' '+now.toTimeString().slice(0,5);
    if(!d.followups) d.followups=[];
    d.followups.push({ time:t, text, stage:d.stage });
    d.lastFollowupDate = now.toISOString().slice(0,10);
    if(d.status==='无回应') d.status='进行中';
    showToast('跟进记录已添加');
    renderDeliveryView();
}

function openDeliveryForm() {
    document.getElementById('formCompany').value='';
    document.getElementById('formJobTitle').value='';
    document.getElementById('formPostDate').value=new Date().toISOString().slice(0,10);
    document.getElementById('formLocation').value='';
    document.getElementById('formChannel').value='';
    document.getElementById('formSalary').value='';
    document.getElementById('formUrl').value='';
    document.getElementById('formTags').value='';
    document.getElementById('formFollowup').value='';
    // 动态填充简历选项：在线简历（按自定义名称）+ 个性化简历
    const sel = document.getElementById('formResume');
    let opts = '<option value="">-- 请选择简历 --</option>';
    if (onlineResumes.length > 0) {
        opts += `<optgroup label="在线简历">${onlineResumes.map(r=>`<option value="${escapeHtml(r.name)}">${escapeHtml(r.name)}</option>`).join('')}</optgroup>`;
    }
    const customList = customResumes.filter(r => r.type === 'custom');
    const uploadList = customResumes.filter(r => r.type === 'upload');
    if (customList.length) {
        opts += `<optgroup label="定制版简历">${customList.map(r=>`<option value="${escapeHtml(r.name)}">${escapeHtml(r.name)}</option>`).join('')}</optgroup>`;
    }
    if (uploadList.length) {
        opts += `<optgroup label="上传简历">${uploadList.map(r=>`<option value="${escapeHtml(r.name)}">${escapeHtml(r.name)}</option>`).join('')}</optgroup>`;
    }
    sel.innerHTML = opts;
    document.getElementById('deliveryFormModal').classList.add('active');
    initDateYearClamp();
}

function saveNewDelivery() {
    const company = document.getElementById('formCompany').value.trim();
    const jobTitle = document.getElementById('formJobTitle').value.trim();
    if (!company||!jobTitle) { showToast('请填写公司名称和岗位','error'); return; }
    const nd = {
        id:'del_'+Date.now(), company, jobTitle,
        postDate:document.getElementById('formPostDate').value,
        location:document.getElementById('formLocation').value.trim()||'',
        channel:document.getElementById('formChannel').value.trim()||'未填写',
        stage:'简历初筛', status:'进行中',
        url:document.getElementById('formUrl').value,
        expectedSalary:document.getElementById('formSalary').value,
        resumeName:document.getElementById('formResume').value,
        tags:document.getElementById('formTags').value.split(',').map(s=>s.trim()).filter(s=>s),
        followups:[], history:[], lastFollowupDate:null
    };
    const firstFU = document.getElementById('formFollowup').value.trim();
    if (firstFU) { const t=new Date(); nd.followups.push({time:t.toISOString().slice(0,10)+' '+t.toTimeString().slice(0,5),text:firstFU,stage:'简历初筛'}); nd.lastFollowupDate=t.toISOString().slice(0,10); }
    nd.history.push({ from:'简历投递', to:'简历初筛', time:new Date().toISOString().slice(0,10), log:'新建投递' });
    deliveries.unshift(nd);
    showToast('投递记录已添加');
    document.getElementById('deliveryFormModal').classList.remove('active');
    renderDeliveryView();
}

// 投递事件绑定
document.getElementById('newDeliveryBtn').addEventListener('click', openDeliveryForm);
// 视图切换
document.querySelectorAll('#deliveryViewToggle .view-toggle-btn').forEach(btn => {
    btn.addEventListener('click', () => {
        deliveryView = btn.dataset.view;
        document.querySelectorAll('#deliveryViewToggle .view-toggle-btn').forEach(b => b.classList.toggle('active', b === btn));
        renderDeliveryView();
    });
});
document.getElementById('batchDeleteConfirmBtn').addEventListener('click', () => {
    if(selectedIds.size===0) return;
    const toDelete = deliveries.filter(d => selectedIds.has(d.id));
    const relatedEvents = calendarEvents.filter(ev => selectedIds.has(ev.deliveryId));
    let msg = `确定删除 ${selectedIds.size} 条投递记录吗？`;
    if (relatedEvents.length > 0) {
        msg += `\n\n将同时删除 ${relatedEvents.length} 条关联日程。`;
    }
    if(confirm(msg)) {
        if (relatedEvents.length > 0) {
            calendarEvents = calendarEvents.filter(ev => !selectedIds.has(ev.deliveryId));
        }
        deliveries = deliveries.filter(d => !selectedIds.has(d.id));
        selectedIds.clear();
        const sa = document.getElementById('selectAllCheckbox'); if(sa) sa.checked = false;
        showToast('删除成功');
        renderDeliveryView();
        updateBatchBar();
    }
});
document.getElementById('cancelBatchBtn').addEventListener('click', () => { selectedIds.clear(); const sa = document.getElementById('selectAllCheckbox'); if(sa) sa.checked = false; renderDeliveryView(); updateBatchBar(); });
document.getElementById('applyFilterBtn').addEventListener('click', () => {
    filters.company=document.getElementById('filterCompany').value;
    filters.stage=document.getElementById('filterStage').value;
    filters.status=document.getElementById('filterStatus').value;
    filters.channel=document.getElementById('filterChannel').value;
    filters.dateRange=document.getElementById('filterDateRange').value;
    currentPage_d=1; selectedIds.clear(); renderDeliveryView();
});
document.getElementById('resetFilterBtn').addEventListener('click', () => {
    ['filterCompany','filterStage','filterStatus','filterChannel','filterDateRange'].forEach(id=>{ const el=document.getElementById(id); if(el.tagName==='INPUT')el.value=''; else el.value=el.id==='filterDateRange'?'30':'all'; });
    filters={company:'',stage:'all',status:'all',channel:'all',dateRange:'30'};
    currentPage_d=1; selectedIds.clear(); renderDeliveryView();
});
document.getElementById('closeModalBtn').addEventListener('click', () => document.getElementById('detailModal').classList.remove('active'));
document.getElementById('closeFollowupModalBtn').addEventListener('click', () => document.getElementById('followupModal').classList.remove('active'));
document.getElementById('cancelFollowupBtn').addEventListener('click', () => document.getElementById('followupModal').classList.remove('active'));
document.getElementById('saveFollowupBtn').addEventListener('click', saveFollowup);
function closeDeliveryFormWithConfirm() {
    const hasInput = ['formCompany','formJobTitle','formChannel','formLocation','formSalary','formUrl','formFollowup'].some(id => {
        const el = document.getElementById(id); return el && el.value.trim();
    });
    if (hasInput) {
        if (confirm('有未保存的内容，确定关闭吗？')) document.getElementById('deliveryFormModal').classList.remove('active');
    } else {
        document.getElementById('deliveryFormModal').classList.remove('active');
    }
}
document.getElementById('closeFormModalBtn').addEventListener('click', closeDeliveryFormWithConfirm);
document.getElementById('cancelFormBtn').addEventListener('click', closeDeliveryFormWithConfirm);
document.getElementById('confirmFormBtn').addEventListener('click', saveNewDelivery);
['detailModal','followupModal'].forEach(mid => {
    document.getElementById(mid).addEventListener('click', e => { if(e.target===document.getElementById(mid)) document.getElementById(mid).classList.remove('active'); });
});
// 投递表单：点背景需确认后才关闭
document.getElementById('deliveryFormModal').addEventListener('click', e => {
    if (e.target !== document.getElementById('deliveryFormModal')) return;
    closeDeliveryFormWithConfirm();
});

