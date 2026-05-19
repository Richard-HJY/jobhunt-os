// ============================================================
function renderHome() {
    const now = new Date();
    const hour = now.getHours();
    const greeting = hour < 6 ? '夜深了' : hour < 12 ? '早上好' : hour < 18 ? '下午好' : '晚上好';
    document.getElementById('welcomeGreeting').textContent = greeting;

    // 今日待办统计
    const todayStr = now.toDateString();
    const todayEvs = calendarEvents.filter(e => !e.completed && e.date.toDateString() === todayStr);
    const sevenDaysAgo = new Date(now); sevenDaysAgo.setDate(now.getDate() - 7);
    const pendingFollowups = deliveries.filter(d => {
        if (d.status !== '进行中') return false;
        const last = d.lastFollowupDate ? new Date(d.lastFollowupDate) : new Date(d.postDate);
        return last < sevenDaysAgo;
    });
    const subEl = document.getElementById('welcomeSub');
    if (subEl) subEl.remove();

    // 统计卡片
    const total = deliveries.length;
    const interviews = deliveries.filter(d => d.history && d.history.some(h => isInterviewStage(h.to))).length;
    const offers = deliveries.filter(d => d.stage === 'offer' || d.stage === '已接受' || (d.history && d.history.some(h => h.to === 'offer' || h.from === 'offer'))).length;
    const interviewRate = total > 0 ? Math.round(interviews / total * 100) : 0;
    const offerRate = total > 0 ? Math.round(offers / total * 100) : 0;

    // 平均响应天数：从投递日期到第一次阶段推进的天数
    const responseTimes = deliveries
        .filter(d => d.history && d.history.length > 0)
        .map(d => {
            const first = d.history[0];
            const start = new Date(d.postDate);
            const resp = new Date(first.time);
            return Math.max(0, Math.round((resp - start) / 86400000));
        });
    const avgResponseDays = responseTimes.length > 0
        ? (responseTimes.reduce((a,b)=>a+b,0) / responseTimes.length).toFixed(1)
        : '—';
    const avgResponse = avgResponseDays === '—' ? '—' : avgResponseDays + '天';

    // 趋势计算：本周 vs 上周
    const weekAgo = new Date(now); weekAgo.setDate(now.getDate() - 7);
    const twoWeeksAgo = new Date(now); twoWeeksAgo.setDate(now.getDate() - 14);
    const thisWeekDeliveries = deliveries.filter(d => new Date(d.postDate) >= weekAgo);
    const lastWeekDeliveries = deliveries.filter(d => { const pd = new Date(d.postDate); return pd >= twoWeeksAgo && pd < weekAgo; });
    const thisWeekCount = thisWeekDeliveries.length;
    const lastWeekCount = lastWeekDeliveries.length;
    const countDiff = thisWeekCount - lastWeekCount;

    const thisWeekInterviews = thisWeekDeliveries.filter(d => d.history && d.history.some(h => isInterviewStage(h.to))).length;
    const lastWeekInterviews = lastWeekDeliveries.filter(d => d.history && d.history.some(h => isInterviewStage(h.to))).length;
    const thisWeekRate = thisWeekCount > 0 ? Math.round(thisWeekInterviews / thisWeekCount * 100) : 0;
    const lastWeekRate = lastWeekCount > 0 ? Math.round(lastWeekInterviews / lastWeekCount * 100) : 0;
    const rateDiff = thisWeekRate - lastWeekRate;

    const thisWeekOffers = thisWeekDeliveries.filter(d => d.stage === 'offer' || d.stage === '已接受').length;
    const lastWeekOffers = lastWeekDeliveries.filter(d => d.stage === 'offer' || d.stage === '已接受').length;
    const thisWeekOfferRate = thisWeekCount > 0 ? Math.round(thisWeekOffers / thisWeekCount * 100) : 0;
    const lastWeekOfferRate = lastWeekCount > 0 ? Math.round(lastWeekOffers / lastWeekCount * 100) : 0;
    const offerDiff = thisWeekOfferRate - lastWeekOfferRate;

    const lastWeekResponseTimes = lastWeekDeliveries.filter(d => d.history && d.history.length > 0).map(d => { const start = new Date(d.postDate); const resp = new Date(d.history[0].time); return Math.max(0, Math.round((resp - start) / 86400000)); });
    const lastWeekAvg = lastWeekResponseTimes.length > 0 ? lastWeekResponseTimes.reduce((a,b)=>a+b,0) / lastWeekResponseTimes.length : 0;
    const currentAvg = avgResponseDays === '—' ? 0 : parseFloat(avgResponseDays);
    const respDiff = lastWeekAvg > 0 ? (currentAvg - lastWeekAvg).toFixed(1) : 0;

    function trendInfo(diff, suffix) {
        if (diff > 0) return { trend:'up', val:'+'+diff+suffix };
        if (diff < 0) return { trend:'down', val:diff+suffix };
        return { trend:'flat', val:'持平' };
    }
    const countTrend = trendInfo(countDiff, ' 本周');
    const rateTrend = trendInfo(rateDiff, '%');
    const offerTrend = trendInfo(offerDiff, '%');
    const respTrend = respDiff == 0 ? { trend:'flat', val:'持平' } : respDiff > 0 ? { trend:'up', val:'+'+respDiff+'天' } : { trend:'down', val:respDiff+'天' };

    const cards = [
        { theme:'blue',   icon:'send',          label:'总投递数',   value:total,            trend:countTrend.trend, trendVal:countTrend.val, page:null },
        { theme:'green',  icon:'calendar-check', label:'面试邀请率', value:interviewRate+'%', trend:rateTrend.trend,  trendVal:rateTrend.val,  page:null },
        { theme:'amber',  icon:'trophy',         label:'Offer率',   value:offerRate+'%',     trend:offerTrend.trend, trendVal:offerTrend.val, page:null },
        { theme:'purple', icon:'clock',          label:'平均响应',  value:avgResponse,       trend:respTrend.trend,  trendVal:respTrend.val,  page:null },
    ];
    document.getElementById('homeStatsGrid').innerHTML = cards.map(c => `
        <div class="stat-card theme-${c.theme}" ${c.page ? `onclick="navigateTo('${c.page}')"` : ''} style="${!c.page ? 'cursor:default;' : ''}">
            <div class="stat-header">
                <span class="stat-label">${c.label}</span>
                <div class="stat-icon-wrap"><i data-lucide="${c.icon}"></i></div>
            </div>
            <div class="stat-number">${c.value}</div>
            <div style="display:flex;align-items:center;gap:8px;margin-top:8px;">
                <span class="stat-trend ${c.trend}">
                    <i data-lucide="${c.trend === 'up' ? 'trending-up' : c.trend === 'down' ? 'trending-down' : 'minus'}"></i>
                    ${c.trendVal}
                </span>
            </div>
        </div>`).join('');

    // 近期日程（当前时间之后3天内，由近到远）
    const maxDate = new Date(now); maxDate.setDate(now.getDate() + 3);
    const upcoming = calendarEvents.filter(e => {
        if (e.completed || e.cancelled) return false;
        const d = e.date instanceof Date ? e.date : new Date(e.date);
        const [h, m] = (e.startTime || '00:00').split(':').map(Number);
        const evDateTime = new Date(d.getFullYear(), d.getMonth(), d.getDate(), h, m);
        return evDateTime >= now && evDateTime <= maxDate;
    }).sort((a, b) => {
        const da = new Date(a.date.getFullYear(), a.date.getMonth(), a.date.getDate(), ...(a.startTime||'00:00').split(':').map(Number));
        const db = new Date(b.date.getFullYear(), b.date.getMonth(), b.date.getDate(), ...(b.startTime||'00:00').split(':').map(Number));
        return da - db;
    });
    const evContainer = document.getElementById('homeUpcomingEvents');
    if (!upcoming.length) {
        evContainer.innerHTML = `<div class="empty-state" style="padding:40px 20px;">
            <i data-lucide="calendar-x" style="width:44px;height:44px;color:var(--gray-300);display:block;margin:0 auto 10px;"></i>
            <div style="color:var(--gray-500);font-size:14px;">未来3天暂无日程</div>
        </div>`;
    } else {
        const BADGE = { '面试':'badge-interview','笔试':'badge-exam','Offer':'badge-assessment','其他':'badge-other' };
        evContainer.innerHTML = upcoming.map((ev, idx) => {
            const d = ev.date;
            const diffH = (d - now) / 3600000;
            const isToday = d.toDateString() === now.toDateString();
            const isTomorrow = d.toDateString() === new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1).toDateString();
            const dotClass = isToday ? 'today' : isTomorrow ? 'tomorrow' : '';
            let countdown = '', countdownClass = '';
            if (diffH < 2)       { countdown = '即将开始'; countdownClass = 'urgent'; }
            else if (diffH < 24) { countdown = `${Math.round(diffH)}小时后`; countdownClass = 'soon'; }
            else if (isToday)    { countdown = '今天'; countdownClass = 'soon'; }
            else if (isTomorrow) { countdown = '明天'; }
            else                 { countdown = `${Math.ceil(diffH/24)}天后`; }
            const hasLink = ev.location && ev.location.startsWith('http');
            const isLast = idx === upcoming.length - 1;
            const locationType = ev.isOffline ? '线下' : '线上';
            const locationDisplay = ev.location || '未设置';
            return `<div class="event-tl-item" onclick="navigateTo('calendar')">
                <div class="event-tl-time">
                    <div class="event-tl-date">${d.getMonth()+1}/${d.getDate()}</div>
                    <div class="event-tl-clock">${ev.startTime}</div>
                </div>
                <div class="event-tl-dot-col">
                    <div class="event-tl-dot ${dotClass}"></div>
                    ${!isLast ? '<div class="event-tl-line"></div>' : ''}
                </div>
                <div class="event-tl-body">
                    <div class="event-tl-title">${escapeHtml(ev.company || '')} · ${escapeHtml(ev.job || '')}</div>
                    <div class="event-tl-meta">
                        <span class="event-tl-badge ${BADGE[ev.type]||'badge-other'}">${ev.type}</span>
                        <span style="font-size:11px;color:var(--gray-500);">${locationType} · ${escapeHtml(locationDisplay)}</span>
                    </div>
                    <div class="event-tl-meta" style="margin-top:3px;">
                        <span style="font-size:11px;color:var(--gray-500);">${ev.startTime}~${ev.endTime||''}</span>
                        <span class="event-tl-countdown ${countdownClass}">${countdown}</span>
                    </div>
                </div>
                ${hasLink ? `<button class="event-tl-link" onclick="event.stopPropagation();window.open('${ev.location}','_blank')"><i data-lucide="external-link" style="width:14px;height:14px;"></i></button>` : ''}
            </div>`;
        }).join('');
    }

    // 待跟进（按紧急程度排序）
    const followups = pendingFollowups.map(d => {
        const last = d.lastFollowupDate ? new Date(d.lastFollowupDate) : new Date(d.postDate);
        const days = Math.floor((now - last) / 86400000);
        return { ...d, daysSince: days };
    }).sort((a, b) => b.daysSince - a.daysSince);

    const flContainer = document.getElementById('homeFollowupList');
    if (!followups.length) {
        flContainer.innerHTML = `<div class="empty-state" style="padding:40px 20px;">
            <i data-lucide="check-circle-2" style="width:44px;height:44px;color:var(--success-400);display:block;margin:0 auto 10px;"></i>
            <div style="color:var(--gray-500);font-size:14px;">暂无待跟进的投递</div>
        </div>`;
    } else {
        flContainer.innerHTML = followups.map(d => {
            const urgency = d.daysSince >= 14 ? 'high' : d.daysSince >= 10 ? 'medium' : 'low';
            return `<div class="followup-item-new">
                <div class="followup-urgency urgency-${urgency}"></div>
                <div class="followup-body">
                    <div class="followup-company">${escapeHtml(d.company)} · ${escapeHtml(d.jobTitle)}</div>
                    <div class="followup-meta">
                        <span>${d.stage}</span>
                        <span>·</span>
                        <span>投递于 ${d.postDate}</span>
                    </div>
                </div>
                <span class="followup-days ${urgency}">${d.daysSince}天未更新</span>
                <button class="followup-action" onclick="openFollowupModal('${d.id}')">跟进</button>
            </div>`;
        }).join('');
    }

    // 首页数据分析
    renderHomeAnalytics();

    initLucideIcons();
}

function renderHomeAnalytics() {
    const dateRange = document.getElementById('homeDataDateRange')?.value || '30';
    const jobFilter = document.getElementById('homeDataJob')?.value || 'all';
    const channelFilter = document.getElementById('homeDataChannel')?.value || 'all';

    let filtered = [...deliveries];
    if (dateRange !== 'all') {
        const days = parseInt(dateRange);
        const cut = new Date(); cut.setDate(cut.getDate() - days);
        filtered = filtered.filter(d => new Date(d.postDate) >= cut);
    }
    if (jobFilter !== 'all') filtered = filtered.filter(d => d.jobTitle === jobFilter);
    if (channelFilter !== 'all') filtered = filtered.filter(d => d.channel === channelFilter);

    const jobSelect = document.getElementById('homeDataJob');
    const channelSelect = document.getElementById('homeDataChannel');
    if (jobSelect) {
        const curJob = jobSelect.value;
        jobSelect.innerHTML = '<option value="all">全部岗位</option>';
        const jobs = [...new Set(deliveries.map(d => d.jobTitle).filter(Boolean))];
        jobs.forEach(j => { const o = document.createElement('option'); o.value = j; o.textContent = j; jobSelect.appendChild(o); });
        if (jobs.includes(curJob)) jobSelect.value = curJob;
    }
    if (channelSelect) {
        const curCh = channelSelect.value;
        channelSelect.innerHTML = '<option value="all">全部渠道</option>';
        const channels = [...new Set(deliveries.map(d => d.channel).filter(Boolean))];
        channels.forEach(c => { const o = document.createElement('option'); o.value = c; o.textContent = c; channelSelect.appendChild(o); });
        if (channels.includes(curCh)) channelSelect.value = curCh;
    }

    const offerStages = ['offer','已录用','录用','offer沟通','已接受'];
    function hasInterview(d) {
        if (isInterviewStage(d.stage)) return true;
        return d.history && d.history.some(h => isInterviewStage(h.to) || isInterviewStage(h.from));
    }
    function hasOffer(d) {
        if (offerStages.includes(d.stage)) return true;
        return d.history && d.history.some(h => offerStages.includes(h.to) || offerStages.includes(h.from));
    }

    const funnelStages = ['初筛','笔试','面试','Offer'];
    const funnelMapping = { '简历投递':'初筛','简历初筛':'初筛','初筛':'初筛','测评':'笔试','笔试':'笔试','一面':'面试','二面':'面试','三面':'面试','四面':'面试','HR面':'面试','offer':'Offer','offer沟通':'Offer','已录用':'Offer','录用':'Offer','已接受':'Offer' };
    const sc = { '初筛':new Set(), '笔试':new Set(), '面试':new Set(), 'Offer':new Set() };
    filtered.forEach(d => {
        const cur = funnelMapping[d.stage];
        if (cur) sc[cur].add(d.id);
        (d.history || []).forEach(h => {
            const hm = funnelMapping[h.to] || funnelMapping[h.from];
            if (hm) sc[hm].add(d.id);
        });
    });
    const scCount = { '初筛':sc['初筛'].size, '笔试':sc['笔试'].size, '面试':sc['面试'].size, 'Offer':sc['Offer'].size };
    const funnel = [];
    const totalDeliveries = filtered.length;
    funnelStages.forEach((s, i) => {
        const cnt = scCount[s] || 0;
        const rate = totalDeliveries > 0 ? ((cnt/totalDeliveries)*100).toFixed(0) : '0';
        funnel.push({ stage:s, count:cnt, rate:rate+'%' });
    });
    const maxC = Math.max(...funnel.map(f => f.count), 1);
    const funnelColors = ['#f59e0b','#3b82f6','#8b5cf6','#10b981'];
    const funnelIcons = ['filter','file-text','users','trophy'];
    const funnelEl = document.getElementById('homeFunnelContainer');
    if (funnelEl) {
        funnelEl.innerHTML = `<div style="font-size:13px;font-weight:600;color:var(--gray-700);margin-bottom:16px;display:flex;align-items:center;gap:8px;"><i data-lucide="filter" style="width:16px;height:16px;color:var(--primary-500);"></i>阶段转化漏斗</div>` +
            funnel.map((item, i) => {
                const w = Math.max((item.count / maxC) * 100, 6);
                const color = funnelColors[i] || '#3b82f6';
                const icon = funnelIcons[i] || 'circle';
                return `<div style="display:flex;align-items:center;gap:12px;margin-bottom:10px;">
                    <div style="width:60px;display:flex;align-items:center;gap:6px;justify-content:flex-end;">
                        <i data-lucide="${icon}" style="width:14px;height:14px;color:${color};"></i>
                        <span style="font-size:12px;font-weight:600;color:var(--gray-700);">${item.stage}</span>
                    </div>
                    <div style="flex:1;height:32px;background:var(--gray-100);border-radius:16px;overflow:hidden;box-shadow:inset 0 1px 2px rgba(0,0,0,0.05);">
                        <div style="width:${w}%;height:100%;background:linear-gradient(135deg,${color},${color}dd);border-radius:16px;display:flex;align-items:center;justify-content:flex-end;padding-right:12px;color:white;font-size:12px;font-weight:700;box-shadow:0 2px 4px rgba(0,0,0,0.1);">${w > 15 ? item.count : ''}</div>
                    </div>
                    <div style="width:40px;font-size:13px;font-weight:700;color:var(--gray-800);">${item.count}</div>
                    <div style="width:50px;font-size:12px;font-weight:700;color:${color};background:${color}15;padding:4px 8px;border-radius:8px;text-align:center;">${item.rate}</div>
                </div>`;
            }).join('');
        initLucideIcons();
    }

    const chMap = new Map();
    filtered.forEach(d => {
        if (!d.channel) return;
        if (!chMap.has(d.channel)) chMap.set(d.channel, { deliveries:0, interviews:0, offers:0 });
        const s = chMap.get(d.channel); s.deliveries++;
        if (hasInterview(d)) s.interviews++;
        if (hasOffer(d)) s.offers++;
    });
    const chArr = [...chMap.entries()].map(([ch, s]) => ({ ch, d:s.deliveries, i:s.interviews, o:s.offers, conv:s.deliveries > 0 ? (s.interviews/s.deliveries*100).toFixed(1) : '0' })).sort((a, b) => parseFloat(b.conv) - parseFloat(a.conv));
    const channelEl = document.getElementById('homeChannelTable');
    if (channelEl) {
        channelEl.innerHTML = `<table class="analytics-mini-table"><thead><tr><th>渠道</th><th>投递</th><th>面试</th><th>Offer</th><th>转化率</th></tr></thead><tbody>` +
            chArr.map((s, idx) => {
                const isTop = idx === 0 && parseFloat(s.conv) > 0;
                const rateColor = parseFloat(s.conv) >= 50 ? 'var(--success-600)' : parseFloat(s.conv) >= 30 ? 'var(--warning-600)' : 'var(--gray-500)';
                return `<tr><td style="font-weight:${isTop?700:500};">${s.ch}${isTop?' <span style="font-size:9px;background:#fef3c7;color:#92400e;padding:1px 4px;border-radius:3px;">最佳</span>':''}</td><td style="text-align:center;">${s.d}</td><td style="text-align:center;color:var(--primary-600);">${s.i}</td><td style="text-align:center;color:var(--success-600);">${s.o}</td><td style="font-weight:600;color:${rateColor};">${s.conv}%</td></tr>`;
            }).join('') + `</tbody></table>`;
    }

    const resumeNames = [...new Set(deliveries.map(d => d.resumeName).filter(Boolean))];
    const rMap = new Map(); resumeNames.forEach(n => rMap.set(n, { usage:0, interview:0 }));
    filtered.forEach(d => { if (d.resumeName && rMap.has(d.resumeName)) { const s = rMap.get(d.resumeName); s.usage++; if (hasInterview(d)) s.interview++; } });
    const rArr = [...rMap.entries()].map(([name, s]) => ({ name, usage:s.usage, interview:s.interview, rate:s.usage > 0 ? (s.interview/s.usage*100).toFixed(0) : '0' })).sort((a, b) => parseInt(b.rate) - parseInt(a.rate));
    const resumeEl = document.getElementById('homeResumeEffectTable');
    if (resumeEl) {
        resumeEl.innerHTML = `<table class="analytics-mini-table"><thead><tr><th>简历</th><th>使用</th><th>面试</th><th>邀请率</th></tr></thead><tbody>` +
            rArr.map((r, idx) => {
                const isTop = idx === 0 && parseInt(r.rate) > 0;
                const rateColor = parseInt(r.rate) >= 50 ? 'var(--success-600)' : parseInt(r.rate) >= 30 ? 'var(--warning-600)' : 'var(--gray-500)';
                return `<tr><td style="font-weight:${isTop?700:500};">${r.name}${isTop?' <span style="font-size:9px;background:#dcfce7;color:#166534;padding:1px 4px;border-radius:3px;">最佳</span>':''}</td><td style="text-align:center;">${r.usage}</td><td style="text-align:center;color:var(--primary-600);">${r.interview}</td><td style="font-weight:600;color:${rateColor};">${r.rate}%</td></tr>`;
            }).join('') + `</tbody></table>`;
    }
}

function openNewDelivery() {
    navigateTo('delivery');
    setTimeout(() => document.getElementById('newDeliveryBtn')?.click(), 100);
}

document.getElementById('homeDataDateRange').addEventListener('change', () => renderHomeAnalytics());
document.getElementById('homeDataJob').addEventListener('change', () => renderHomeAnalytics());
document.getElementById('homeDataChannel').addEventListener('change', () => renderHomeAnalytics());

