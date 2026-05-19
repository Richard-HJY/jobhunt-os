// ============================================================
// 日程看板
// ============================================================
let currentDisplayYear = _cy;
let currentDisplayMonth = _cm;
let currentDisplayWeekStart = null; // 当前周的周一 Date 对象
let calendarView = 'week'; // 'week' | 'month'
let currentEditingEventId = null;
let currentDetailEventId = null;

function getWeekStart(date) {
    const d = new Date(date);
    const day = d.getDay(); // 0=周日
    const diff = day === 0 ? -6 : 1 - day; // 调整到周一
    d.setDate(d.getDate() + diff);
    d.setHours(0,0,0,0);
    return d;
}

// 根据日程创建时锁定的阶段获取看板列颜色
function getStageColorForEvent(ev) {
    if (!ev.stageAtCreation) return null;
    const col = KANBAN_COLS.find(c => c.match(ev.stageAtCreation));
    return col ? col.color : null;
}

// 预定义阶段颜色映射（亮色背景 + 深色文字）
const STAGE_STYLE = {
    '#f59e0b': { bg:'#fffbeb', text:'#78350f' }, // amber
    '#0ea5e9': { bg:'#f0f9ff', text:'#0c4a6e' }, // sky
    '#ec4899': { bg:'#fdf2f8', text:'#831843' }, // pink
    '#8b5cf6': { bg:'#f5f3ff', text:'#4c1d95' }, // purple
    '#f97316': { bg:'#fff7ed', text:'#7c2d12' }, // orange
    '#10b981': { bg:'#ecfdf5', text:'#064e3b' }, // green
};

function renderCalendar() {
    if (calendarView === 'week') renderWeekView();
    else renderMonthView();
}

function renderWeekView() {
    if (!currentDisplayWeekStart) currentDisplayWeekStart = getWeekStart(new Date());
    const ws = currentDisplayWeekStart;
    const days = Array.from({length:7}, (_,i) => { const d=new Date(ws); d.setDate(ws.getDate()+i); return d; });
    const today = new Date(); today.setHours(0,0,0,0);
    const HOURS = Array.from({length:14}, (_,i) => i+8); // 8:00 - 21:00

    const dayNames = ['周一','周二','周三','周四','周五','周六','周日'];
    const monthLabel = ws.getMonth() === days[6].getMonth()
        ? `${ws.getFullYear()}年 ${ws.getMonth()+1}月`
        : `${ws.getFullYear()}年 ${ws.getMonth()+1}月 — ${days[6].getMonth()+1}月`;

    const wrapper = document.getElementById('calendarWrapper');
    wrapper.innerHTML = `<div class="week-view">
        <div class="cal-toolbar">
            <div class="cal-nav-group">
                <button class="cal-nav-btn" id="calPrev" title="上一周"><i data-lucide="chevron-left"></i></button>
                <button class="cal-today-btn" id="calToday">今天</button>
                <button class="cal-nav-btn" id="calNext" title="下一周"><i data-lucide="chevron-right"></i></button>
            </div>
            <div class="cal-period-label">${monthLabel}</div>
            <div style="width:80px;"></div>
        </div>
        <div class="week-header">
            <div class="week-header-cell" style="background:var(--gray-50);"></div>
            ${days.map((d,i) => {
                const isToday = d.getTime() === today.getTime();
                return `<div class="week-header-cell${isToday?' today-col':''}">
                    <div class="week-day-name">${dayNames[i]}</div>
                    <div class="week-day-num${isToday?' today':''}">${d.getDate()}</div>
                </div>`;
            }).join('')}
        </div>
        <div class="week-body" id="weekBody">
            <div class="week-time-col">
                ${HOURS.map(h => `<div class="week-time-slot">${h}:00</div>`).join('')}
            </div>
            ${days.map((d,di) => {
                const dayKey = `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
                const dayEvs = calendarEvents.filter(ev => {
                    const ed = ev.date;
                    return ed.getFullYear()===d.getFullYear() && ed.getMonth()===d.getMonth() && ed.getDate()===d.getDate();
                }).sort((a,b)=>a.startTime.localeCompare(b.startTime));
                const hourCells = HOURS.map(h => `<div class="week-hour-cell" data-year="${d.getFullYear()}" data-month="${d.getMonth()}" data-day="${d.getDate()}" data-hour="${h}"></div>`).join('');
                const eventBlocks = dayEvs.map(ev => {
                    const [sh,sm] = ev.startTime.split(':').map(Number);
                    const [eh,em] = ev.endTime ? ev.endTime.split(':').map(Number) : [sh+1,sm];
                    const clampedSh = Math.max(sh, 8), clampedSm = sh < 8 ? 0 : sm;
                    const top = (clampedSh - 8 + clampedSm/60) * 56;
                    const durationMin = (eh*60+em) - (sh*60+sm);
                    const height = Math.max(durationMin/60 * 56, 44);
                    const cc = ev.completed ? ' completed' : ev.cancelled ? ' cancelled' : '';
                    const stageColor = getStageColorForEvent(ev);
                    const ss = stageColor ? STAGE_STYLE[stageColor] : null;
                    const evStyle = ss ? `top:${top}px;height:${height}px;background:${ss.bg};color:${ss.text};border-left-color:${stageColor};` : `top:${top}px;height:${height}px;`;
                    const modeTag = ev.isOffline
                        ? `<span class="week-mode-tag offline" style="${ss?`color:${ss.text};opacity:0.7`:'color:#92400e'}">线下</span>`
                        : `<span class="week-mode-tag online" style="${ss?`color:${ss.text};opacity:0.7`:'color:#1d4ed8'}">线上</span>`;
                    return `<div class="week-event${cc}" data-event-id="${ev.id}" style="${evStyle}">
                        <div class="week-event-title">${escapeHtml(ev.title)}</div>
                        <div class="week-event-time">${ev.startTime}${ev.endTime?'–'+ev.endTime:''} ${modeTag}</div>
                    </div>`;
                }).join('');
                return `<div class="week-day-col${d.getTime()===today.getTime()?' today-col':''}" data-col="${di}">${hourCells}${eventBlocks}</div>`;
            }).join('')}
        </div>
    </div>`;

    initLucideIcons();
    // 导航
    wrapper.querySelector('#calPrev').addEventListener('click', () => {
        currentDisplayWeekStart = new Date(currentDisplayWeekStart);
        currentDisplayWeekStart.setDate(currentDisplayWeekStart.getDate()-7);
        renderCalendar(); updateTodayReminders();
    });
    wrapper.querySelector('#calNext').addEventListener('click', () => {
        currentDisplayWeekStart = new Date(currentDisplayWeekStart);
        currentDisplayWeekStart.setDate(currentDisplayWeekStart.getDate()+7);
        renderCalendar(); updateTodayReminders();
    });
    wrapper.querySelector('#calToday').addEventListener('click', () => {
        currentDisplayWeekStart = getWeekStart(new Date());
        renderCalendar(); updateTodayReminders();
    });
    // 点击时间格新建事件
    wrapper.querySelectorAll('.week-hour-cell').forEach(cell => {
        cell.addEventListener('click', () => {
            const d = new Date(parseInt(cell.dataset.year), parseInt(cell.dataset.month), parseInt(cell.dataset.day), parseInt(cell.dataset.hour));
            openNewEventModal(d);
        });
    });
    // 点击事件
    wrapper.querySelectorAll('.week-event').forEach(el => {
        el.addEventListener('click', e => { e.stopPropagation(); openCalDetail(el.dataset.eventId); });
    });
}

function renderMonthView() {
    const year = currentDisplayYear, month = currentDisplayMonth;
    const firstDay = new Date(year, month, 1);
    const startWeekday = (firstDay.getDay()+6)%7; // 调整为周一开始
    const daysInMonth = new Date(year, month+1, 0).getDate();
    const prevMonthDays = new Date(year, month, 0).getDate();
    const todayObj = new Date();
    const isCurrentMonth = (year===todayObj.getFullYear()&&month===todayObj.getMonth());
    const todayNum = isCurrentMonth ? todayObj.getDate() : -1;

    const wrapper = document.getElementById('calendarWrapper');
    wrapper.innerHTML = `<div class="month-view">
        <div class="cal-toolbar">
            <div class="cal-nav-group">
                <button class="cal-nav-btn" id="calPrev"><i data-lucide="chevron-left"></i></button>
                <button class="cal-today-btn" id="calToday">今天</button>
                <button class="cal-nav-btn" id="calNext"><i data-lucide="chevron-right"></i></button>
            </div>
            <div class="cal-period-label">${year}年 ${month+1}月</div>
            <div style="width:80px;"></div>
        </div>
        <div class="weekdays"><div class="weekday">周一</div><div class="weekday">周二</div><div class="weekday">周三</div><div class="weekday">周四</div><div class="weekday">周五</div><div class="weekday">周六</div><div class="weekday">周日</div></div>
        <div class="calendar-grid" id="calendarGrid"></div>
    </div>`;

    initLucideIcons();
    const grid = document.getElementById('calendarGrid');
    const eventsByDate = new Map();
    calendarEvents.forEach(ev => {
        const d = ev.date;
        const key = `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
        if (!eventsByDate.has(key)) eventsByDate.set(key, []);
        eventsByDate.get(key).push(ev);
    });

    for (let i=0; i<42; i++) {
        let cellDay, isThisMonth=true, displayYear=year, displayMonth=month;
        if (i<startWeekday) { cellDay=prevMonthDays-(startWeekday-i)+1; isThisMonth=false; displayMonth=month-1; if(displayMonth<0){displayMonth=11;displayYear=year-1;} }
        else if (i>=startWeekday+daysInMonth) { cellDay=i-(startWeekday+daysInMonth)+1; isThisMonth=false; displayMonth=month+1; if(displayMonth>11){displayMonth=0;displayYear=year+1;} }
        else { cellDay=i-startWeekday+1; }
        const isToday = isThisMonth && cellDay===todayNum;
        const cellKey = `${displayYear}-${displayMonth}-${cellDay}`;
        const dayEvents = (eventsByDate.get(cellKey)||[]).sort((a,b)=>a.startTime.localeCompare(b.startTime));
        const evHtml = dayEvents.map(ev => {
            const cc = ev.completed ? ' completed' : ev.cancelled ? ' cancelled' : '';
            const stageColor = getStageColorForEvent(ev);
            const ss = stageColor ? STAGE_STYLE[stageColor] : null;
            const evStyle = ss ? `background:${ss.bg};color:${ss.text};border-left:2px solid ${stageColor};` : '';
            const modeTag = ev.isOffline
                ? `<span class="cal-mode-tag offline" style="${ss?`color:${ss.text};opacity:0.7`:'color:#92400e'}">线下</span>`
                : `<span class="cal-mode-tag online" style="${ss?`color:${ss.text};opacity:0.7`:'color:#1d4ed8'}">线上</span>`;
            return `<div class="cal-event-item${cc}" data-event-id="${ev.id}" style="${evStyle}"><span class="event-time-sm">${ev.startTime}</span><span class="event-title-sm">${escapeHtml(ev.title)} ${modeTag}</span></div>`;
        }).join('');
        const cls = `cal-day${!isThisMonth?' other-month':''}${isToday?' today':''}`;
        grid.insertAdjacentHTML('beforeend', `<div class="${cls}" data-year="${displayYear}" data-month="${displayMonth}" data-day="${cellDay}"><div class="day-number">${cellDay}</div>${evHtml}</div>`);
    }

    grid.querySelectorAll('.cal-event-item').forEach(el => el.addEventListener('click', e => { e.stopPropagation(); openCalDetail(el.dataset.eventId); }));
    grid.querySelectorAll('.cal-day').forEach(d => d.addEventListener('click', e => {
        if (e.target.closest('.cal-event-item')) return;
        openNewEventModal(new Date(parseInt(d.dataset.year), parseInt(d.dataset.month), parseInt(d.dataset.day)));
    }));
    wrapper.querySelector('#calPrev').addEventListener('click', () => { currentDisplayMonth--; if(currentDisplayMonth<0){currentDisplayMonth=11;currentDisplayYear--;} renderCalendar(); updateTodayReminders(); });
    wrapper.querySelector('#calNext').addEventListener('click', () => { currentDisplayMonth++; if(currentDisplayMonth>11){currentDisplayMonth=0;currentDisplayYear++;} renderCalendar(); updateTodayReminders(); });
    wrapper.querySelector('#calToday').addEventListener('click', () => { currentDisplayYear=_cy; currentDisplayMonth=_cm; renderCalendar(); updateTodayReminders(); });
}

function updateTodayReminders() {
    const t=new Date(); const ty=t.getFullYear(),tm=t.getMonth(),td=t.getDate();
    const todayEvs = calendarEvents.filter(ev=>ev.date.getFullYear()===ty&&ev.date.getMonth()===tm&&ev.date.getDate()===td).sort((a,b)=>a.startTime.localeCompare(b.startTime));
    const c = document.getElementById('reminderList');
    if (!todayEvs.length) { c.innerHTML="<div style='color:var(--gray-400);padding:12px;text-align:center;font-size:13px;'>今日暂无日程安排</div>"; return; }
    c.innerHTML = todayEvs.map(ev => {
        const stageColor = getStageColorForEvent(ev);
        const dotStyle = stageColor ? `background:${stageColor};` : '';
        const statusLabel = ev.completed
            ? '<span class="reminder-status completed">已完成</span>'
            : ev.cancelled
            ? '<span class="reminder-status cancelled">已取消</span>'
            : '<span class="reminder-status pending">待完成</span>';
        const isFinal = ev.completed || ev.cancelled;
        const stageName = ev.stageAtCreation || '';
        const modeTag = ev.isOffline ? '<span class="reminder-mode-tag offline">线下</span>' : '<span class="reminder-mode-tag online">线上</span>';
        const infoLine = [
            ev.company ? escapeHtml(ev.company) : '',
            ev.job ? escapeHtml(ev.job) : '',
            stageName ? escapeHtml(stageName) : ''
        ].filter(Boolean).join(' · ');
        return `<div class="reminder-item ${ev.completed?'completed':''} ${ev.cancelled?'cancelled':''}">
            <span class="reminder-dot" style="${dotStyle}"></span>
            <div class="reminder-time">${ev.startTime}</div>
            <div class="reminder-body">
                <div class="reminder-title">${escapeHtml(ev.title)} ${modeTag}</div>
                <div class="reminder-company">${infoLine}${statusLabel}</div>
            </div>
            ${ev.location&&!isFinal?`<button class="reminder-link" data-id="${ev.id}" data-type="join">加入</button>`:''}
            <button class="reminder-link" data-id="${ev.id}" data-type="detail">详情</button>
            ${!isFinal?`<button class="reminder-link" data-id="${ev.id}" data-type="complete">完成</button>`:''}
        </div>`;
    }).join('');
    c.querySelectorAll('.reminder-link').forEach(btn => {
        btn.addEventListener('click', () => {
            const ev = calendarEvents.find(e=>e.id===btn.dataset.id);
            if(btn.dataset.type==='join'&&ev?.location) window.open(ev.location,'_blank');
            else if(btn.dataset.type==='detail') openCalDetail(btn.dataset.id);
            else if(btn.dataset.type==='complete') {
                if(ev){
                    ev.completed=!ev.completed;
                    if(ev.completed) ev.cancelled = false;
                    renderCalendar(); updateTodayReminders();
                    showToast(ev.completed?'已标记为完成':'已取消完成标记');
                }
            }
        });
    });
}

function buildDeliveryOptions(preSelectId) {
    // 优先显示进行中阶段变更但未建立日程的投递
    const hasRecentStageChange = d => {
        if (!d.history || d.history.length === 0) return false;
        const lastH = d.history[d.history.length - 1];
        const daysAgo = (Date.now() - new Date(lastH.time).getTime()) / 86400000;
        if (daysAgo > 7) return false;
        const hasEvent = calendarEvents.some(ev => ev.deliveryId === d.id && !ev.cancelled);
        return !hasEvent;
    };
    const prioritized = deliveries.filter(d => !TERMINAL_STAGES.includes(d.stage) && hasRecentStageChange(d));
    const others = deliveries.filter(d => !prioritized.includes(d));
    let opts = '<option value="">-- 请选择投递 --</option>';
    if (prioritized.length) {
        opts += `<optgroup label="推荐关联（近期阶段变更）">${prioritized.map(d=>`<option value="${d.id}" ${d.id===preSelectId?'selected':''}>${escapeHtml(d.company)} - ${escapeHtml(d.jobTitle)}</option>`).join('')}</optgroup>`;
    }
    opts += `<optgroup label="全部投递">${others.map(d=>`<option value="${d.id}" ${d.id===preSelectId?'selected':''}>${escapeHtml(d.company)} - ${escapeHtml(d.jobTitle)}</option>`).join('')}</optgroup>`;
    return opts;
}

function setupInterviewModeToggle() {
    const radios = document.querySelectorAll('input[name="interviewMode"]');
    const locLabel = document.getElementById('eventLocationLabel');
    const locInput = document.getElementById('eventLocation');
    function updateMode() {
        const mode = document.querySelector('input[name="interviewMode"]:checked')?.value || 'online';
        if (mode === 'online') {
            locLabel.textContent = '面试链接';
            locInput.placeholder = '会议链接（如腾讯会议、Zoom）';
        } else {
            locLabel.textContent = '面试地点';
            locInput.placeholder = '线下地址（如：北京市朝阳区望京街10号）';
        }
    }
    radios.forEach(r => r.addEventListener('change', updateMode));
    updateMode();
    // 关联投递联动日程类型
    const deliverySelect = document.getElementById('eventDeliveryId');
    const typeSelect = document.getElementById('eventType');
    if (deliverySelect && typeSelect) {
        deliverySelect.addEventListener('change', () => {
            const did = deliverySelect.value;
            if (!did) return;
            const delivery = deliveries.find(d => d.id === did);
            if (!delivery) return;
            const stageToType = { '笔试':'笔试','测评':'笔试','一面':'一面','二面':'二面','三面':'三面','四面':'三面','HR面':'一面','offer':'Offer','Offer':'Offer','初筛':'一面','简历初筛':'一面','简历投递':'一面' };
            const mapped = stageToType[delivery.stage];
            if (mapped) typeSelect.value = mapped;
        });
    }
}

function openNewEventModal(defaultDate=null) {
    currentEditingEventId = null;
    document.getElementById('eventModalTitle').innerText = '新建日程';
    const now = new Date();
    // 如果 defaultDate 含小时信息（从格子点击传来），使用格子的时间；否则用当前时间
    const date = defaultDate || now;
    const useHour = defaultDate ? date.getHours() : now.getHours();
    const useMin  = defaultDate ? 0 : now.getMinutes();
    const y=date.getFullYear(), m=String(date.getMonth()+1).padStart(2,'0'), d=String(date.getDate()).padStart(2,'0');
    document.getElementById('eventDate').value=`${y}-${m}-${d}`;
    const startH = String(useHour).padStart(2,'0'), startM = String(useMin).padStart(2,'0');
    const endHour = useHour + 1 < 24 ? useHour + 1 : 23;
    const endH = String(endHour).padStart(2,'0'), endM = String(useMin).padStart(2,'0');
    document.getElementById('eventStartTime').value=`${startH}:${startM}`;
    document.getElementById('eventEndTime').value=`${endH}:${endM}`;
    document.getElementById('eventType').value='';
    document.getElementById('eventTitle').value='';
    document.getElementById('eventLocation').value='';
    document.getElementById('eventReminder').value='15';
    document.getElementById('eventNotes').value='';
    document.getElementById('modeOnline').checked = true;
    document.getElementById('eventDeliveryId').innerHTML = buildDeliveryOptions('');
    setupInterviewModeToggle();
    document.getElementById('eventModal').classList.add('active');
}

function openCalDetail(eventId) {
    const ev = calendarEvents.find(e=>e.id===eventId); if(!ev) return;
    currentDetailEventId = eventId;
    const di = ev.deliveryId ? `${escapeHtml(ev.company)} · ${escapeHtml(ev.job)}` : '未关联';
    const dateStr = `${ev.date.getFullYear()}-${String(ev.date.getMonth()+1).padStart(2,'0')}-${String(ev.date.getDate()).padStart(2,'0')}`;
    const typeColors = { '笔试':'#d1fae5:#065f46', '一面':'#dbeafe:#1e40af', '二面':'#e0e7ff:#3730a3', '三面':'#fce7f3:#9d174d', 'Offer':'#fef3c7:#92400e', '面试':'#dbeafe:#1e40af', '其他':'#e9d5ff:#6b21a5' };
    const [bg,fg] = (typeColors[ev.type]||'#f3f4f6:#374151').split(':');
    const cancelledBadge = ev.cancelled ? `<span style="background:#fee2e2;color:#b91c1c;padding:3px 10px;border-radius:var(--radius-full);font-size:12px;font-weight:600;display:flex;align-items:center;gap:4px;"><i data-lucide="x-circle" style="width:11px;height:11px;"></i>已取消</span>` : '';
    document.getElementById('calDetailBody').innerHTML = `
        <div style="display:flex;align-items:center;gap:8px;margin-bottom:14px;">
            <span style="background:${bg};color:${fg};padding:3px 10px;border-radius:var(--radius-full);font-size:12px;font-weight:600;">${ev.type}</span>
            ${ev.completed?'<span style="background:var(--success-50);color:var(--success-600);padding:3px 10px;border-radius:var(--radius-full);font-size:12px;font-weight:600;display:flex;align-items:center;gap:4px;"><i data-lucide="check-circle-2" style="width:11px;height:11px;"></i>已完成</span>':''}
            ${cancelledBadge}
        </div>
        <div style="font-size:16px;font-weight:700;color:var(--gray-900);margin-bottom:14px;">${escapeHtml(ev.title)}</div>
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-bottom:14px;">
            <div style="display:flex;align-items:center;gap:7px;color:var(--gray-600);font-size:13px;">
                <i data-lucide="calendar" style="width:14px;height:14px;color:var(--gray-400);flex-shrink:0;"></i>${dateStr}
            </div>
            <div style="display:flex;align-items:center;gap:7px;color:var(--gray-600);font-size:13px;">
                <i data-lucide="clock" style="width:14px;height:14px;color:var(--gray-400);flex-shrink:0;"></i>${ev.startTime}${ev.endTime?' – '+ev.endTime:''}
            </div>
            <div style="display:flex;align-items:center;gap:7px;color:var(--gray-600);font-size:13px;">
                ${ev.isOffline
                    ? `<i data-lucide="map-pin" style="width:14px;height:14px;color:var(--gray-400);flex-shrink:0;"></i>${ev.location ? escapeHtml(ev.location) : '未填写地点'}`
                    : `<i data-lucide="link-2" style="width:14px;height:14px;color:var(--gray-400);flex-shrink:0;"></i>${ev.location ? `<a href="${ev.location}" target="_blank" style="color:var(--primary-600);text-decoration:none;">查看链接</a>` : '未填写链接'}`
                }
            </div>
            <div style="display:flex;align-items:center;gap:7px;color:var(--gray-600);font-size:13px;">
                <i data-lucide="briefcase" style="width:14px;height:14px;color:var(--gray-400);flex-shrink:0;"></i>${di}
            </div>
        </div>
        ${ev.notes?`<div style="background:var(--gray-50);border-radius:var(--radius-sm);padding:10px 12px;">${renderClampedText(ev.notes, { title:'事件备注', lines:2, textStyle:'font-size:13px;color:var(--gray-600);line-height:1.6;' })}</div>`:''}`;
    // 控制按钮状态
    const editBtn = document.getElementById('editEventFromDetailBtn');
    const completeBtn = document.getElementById('toggleCompleteBtn');
    const cancelBtn = document.getElementById('cancelEventFromDetailBtn');
    if (ev.completed) {
        editBtn.style.display = 'none';
        completeBtn.style.display = 'none';
        cancelBtn.style.display = 'none';
    } else if (ev.cancelled) {
        editBtn.style.display = 'none';
        completeBtn.style.display = 'none';
        cancelBtn.style.display = '';
        cancelBtn.style.color = 'var(--success-600)';
        cancelBtn.innerHTML = '<i data-lucide="rotate-ccw" style="width:13px;height:13px;"></i>恢复事件';
    } else {
        editBtn.disabled = false; editBtn.style.opacity = '';
        completeBtn.style.display = '';
        cancelBtn.style.display = ''; cancelBtn.style.color = 'var(--gray-500)';
        cancelBtn.textContent = '';
        cancelBtn.innerHTML = '<i data-lucide="x-circle" style="width:13px;height:13px;"></i>取消事件';
    }
    document.getElementById('calDetailModal').classList.add('active');
    initLucideIcons();
    refreshClampButtons(document.getElementById('calDetailBody'));
}

function saveCalEvent() {
    const type=document.getElementById('eventType').value;
    const title=document.getElementById('eventTitle').value.trim();
    const dateStr=document.getElementById('eventDate').value;
    const startTime=document.getElementById('eventStartTime').value;
    let endTime=document.getElementById('eventEndTime').value||startTime;
    const location=document.getElementById('eventLocation').value;
    const reminder=parseInt(document.getElementById('eventReminder').value)||0;
    const notes=document.getElementById('eventNotes').value;
    const deliveryId=document.getElementById('eventDeliveryId').value;
    if(!title||!dateStr||!startTime){showToast('请填写标题、日期和开始时间','error');return;}
    const eventDate=new Date(dateStr);
    if(isNaN(eventDate.getTime())){showToast('无效日期','error');return;}

    // 时间冲突检测
    const toMins = t => { const [h,m]=(t||'00:00').split(':').map(Number); return h*60+m; };
    const newStart = toMins(startTime), newEnd = toMins(endTime||startTime);
    const conflicts = calendarEvents.filter(ev => {
        if (ev.id === currentEditingEventId) return false;
        if (ev.cancelled) return false;
        const evDate = ev.date instanceof Date ? ev.date : new Date(ev.date);
        if (evDate.toDateString() !== eventDate.toDateString()) return false;
        const evStart = toMins(ev.startTime), evEnd = toMins(ev.endTime||ev.startTime);
        return newStart < evEnd && newEnd > evStart;
    });
    if (conflicts.length > 0) {
        const names = conflicts.map(e => `「${e.title}」(${e.startTime}–${e.endTime})`).join('、');
        if (!confirm(`与已有日程时间冲突：${names}\n\n是否仍要保存？`)) return;
    }

    let dCo='',dJob='',dStage='';
    if(deliveryId){const d=deliveries.find(d=>d.id===deliveryId);if(d){dCo=d.company;dJob=d.jobTitle;dStage=d.stage;}}
    const isOffline = document.querySelector('input[name="interviewMode"]:checked')?.value === 'offline';
    const oldEv = currentEditingEventId ? calendarEvents.find(e=>e.id===currentEditingEventId) : null;
    const newEv = { id:currentEditingEventId||'evt_'+Date.now(), title, type, deliveryId:deliveryId||null, company:dCo, job:dJob, date:eventDate, startTime, endTime, location, reminder, notes, isOffline, completed: oldEv ? oldEv.completed : false, cancelled: oldEv ? oldEv.cancelled : false, stageAtCreation: dStage || (oldEv ? oldEv.stageAtCreation : '') };

    // 如果关联了投递，自动更新投递阶段
    if(deliveryId && !currentEditingEventId) {
        const delivery = deliveries.find(d => d.id === deliveryId);
        if(delivery) {
            const eventTypeToStage = {
                '笔试': '笔试',
                '一面': '一面',
                '二面': '二面',
                '三面': '三面',
                'Offer': 'offer'
            };
            const newStage = eventTypeToStage[type];
            if(newStage && delivery.stage !== newStage) {
                const oldStage = delivery.stage;
                delivery.stage = newStage;
                if(!delivery.history) delivery.history = [];
                delivery.history.push({
                    from: oldStage,
                    to: newStage,
                    time: new Date().toISOString().slice(0,10),
                    log: `系统自动更新：创建${type}日程`
                });
                if(delivery.status === '无回应') delivery.status = '进行中';
            }
        }
    }

    if(currentEditingEventId){const idx=calendarEvents.findIndex(e=>e.id===currentEditingEventId);if(idx!==-1)calendarEvents[idx]=newEv;showToast('事件已更新');}
    else{calendarEvents.push(newEv);showToast('事件已添加');}
    document.getElementById('eventModal').classList.remove('active');
    renderCalendar(); updateTodayReminders();
    // 如果更新了投递阶段，刷新投递看板
    if(deliveryId && !currentEditingEventId) {
        renderDeliveryView();
    }
}

function deleteCalEvent() {
    if(!currentDetailEventId) return;
    if(confirm('确定删除此事件吗？')){calendarEvents=calendarEvents.filter(e=>e.id!==currentDetailEventId);renderCalendar();document.getElementById('calDetailModal').classList.remove('active');showToast('已删除');updateTodayReminders();}
}

function toggleCalComplete() {
    if(!currentDetailEventId) return;
    const ev=calendarEvents.find(e=>e.id===currentDetailEventId);
    if(ev){
        ev.completed=!ev.completed;
        if(ev.completed) ev.cancelled = false;
        renderCalendar(); updateTodayReminders();
        showToast(ev.completed?'已标记为完成':'已取消完成标记');
        openCalDetail(currentDetailEventId); // 刷新详情弹窗按钮状态
    }
}

function editCalFromDetail() {
    const ev=calendarEvents.find(e=>e.id===currentDetailEventId); if(!ev) return;
    if (ev.completed) { showToast('已完成的事件不可编辑', 'error'); return; }
    if (ev.cancelled) { showToast('已取消的事件不可编辑', 'error'); return; }
    document.getElementById('calDetailModal').classList.remove('active');
    currentEditingEventId=ev.id;
    document.getElementById('eventModalTitle').innerText='编辑事件';
    // Map legacy types
    const typeMap = { '面试':'一面', '笔试':'笔试', 'Offer':'Offer', '其他':'一面' };
    const mappedType = (ev.type==='一面'||ev.type==='二面'||ev.type==='三面'||ev.type==='笔试'||ev.type==='Offer') ? ev.type : (typeMap[ev.type]||'一面');
    document.getElementById('eventType').value=mappedType;
    document.getElementById('eventTitle').value=ev.title;
    const y=ev.date.getFullYear(),m=String(ev.date.getMonth()+1).padStart(2,'0'),d=String(ev.date.getDate()).padStart(2,'0');
    document.getElementById('eventDate').value=`${y}-${m}-${d}`;
    document.getElementById('eventStartTime').value=ev.startTime;
    document.getElementById('eventEndTime').value=ev.endTime||'';
    document.getElementById('eventLocation').value=ev.location||'';
    document.getElementById('eventReminder').value=ev.reminder||15;
    document.getElementById('eventNotes').value=ev.notes||'';
    if (ev.isOffline) document.getElementById('modeOffline').checked = true;
    else document.getElementById('modeOnline').checked = true;
    document.getElementById('eventDeliveryId').innerHTML = buildDeliveryOptions(ev.deliveryId||'');
    setupInterviewModeToggle();
    document.getElementById('eventModal').classList.add('active');
}

document.getElementById('newEventBtn').addEventListener('click', () => openNewEventModal());
// 日历视图切换
document.querySelectorAll('#calViewToggle .view-toggle-btn').forEach(btn => {
    btn.addEventListener('click', () => {
        calendarView = btn.dataset.view;
        document.querySelectorAll('#calViewToggle .view-toggle-btn').forEach(b => b.classList.toggle('active', b === btn));
        renderCalendar(); updateTodayReminders();
    });
});
function closeEventModalWithConfirm() {
    const hasInput = document.getElementById('eventTitle').value.trim() || document.getElementById('eventNotes').value.trim();
    if (hasInput) {
        if (confirm('有未保存的内容，确定关闭吗？')) document.getElementById('eventModal').classList.remove('active');
    } else {
        document.getElementById('eventModal').classList.remove('active');
    }
}
document.getElementById('closeEventModalBtn').addEventListener('click', closeEventModalWithConfirm);
document.getElementById('cancelEventBtn').addEventListener('click', closeEventModalWithConfirm);
document.getElementById('saveEventBtn').addEventListener('click', saveCalEvent);
document.getElementById('closeCalDetailBtn').addEventListener('click', () => document.getElementById('calDetailModal').classList.remove('active'));
document.getElementById('editEventFromDetailBtn').addEventListener('click', editCalFromDetail);
document.getElementById('toggleCompleteBtn').addEventListener('click', toggleCalComplete);
document.getElementById('cancelEventFromDetailBtn').addEventListener('click', () => {
    if(!currentDetailEventId) return;
    const ev = calendarEvents.find(e=>e.id===currentDetailEventId);
    if(ev){
        if (ev.cancelled) {
            // 恢复事件
            ev.cancelled = false;
            renderCalendar(); updateTodayReminders(); showToast('事件已恢复');
        } else {
            ev.completed = false; ev.cancelled = true;
            renderCalendar(); updateTodayReminders(); showToast('事件已取消');
        }
        document.getElementById('calDetailModal').classList.remove('active');
    }
});
document.getElementById('calDetailModal').addEventListener('click', e => { if(e.target===document.getElementById('calDetailModal')) document.getElementById('calDetailModal').classList.remove('active'); });
// 日程表单：点背景需确认
document.getElementById('eventModal').addEventListener('click', e => {
    if (e.target !== document.getElementById('eventModal')) return;
    closeEventModalWithConfirm();
});

