// ============================================================
// 简历管理
// ============================================================
const userName = '';
// onlineResumes: 用户创建的在线简历列表，每份有独立 id、name、data、lastModified
onlineResumes = [];
// 兼容旧逻辑: masterResumeDeleted 已废弃，用 onlineResumes.length===0 代替
masterResumeDeleted = true; // 保留供遗留引用，实际由 onlineResumes 决定
customResumes = [];

// 当前编辑在线简历的 id（null 表示没有，或 editingResumeId 为 custom id）
// 在线简历用 onlineResumes 数组中的 id，个性化定制版用 customResumes 数组中的 id

function emptyOnlineResumeData() { return emptyResumeData(); }

// 获取在线简历 resumeData（根据 editingResumeId 判断是在线还是定制）
function getOnlineResumeById(id) { return onlineResumes.find(r => r.id === id); }

function calcRate(u, i) { return u ? Math.round(i/u*100)+'%' : '0%'; }
function getRateClass(r) { const v=parseInt(r); return v>=50?'rate-high':v>=30?'rate-medium':'rate-low'; }

function renderResumeMgr() {
    renderMasterCard();
    renderResumeGrid();
}

function renderMasterCard() {
    const container = document.getElementById('masterResumeCard');
    if (onlineResumes.length === 0) {
        container.innerHTML = `
            <div class="master-resume-card" style="justify-content:center;align-items:center;flex-direction:column;padding:48px 24px;text-align:center;">
                <i data-lucide="file-x" style="width:48px;height:48px;color:var(--gray-300);margin-bottom:12px;"></i>
                <div style="font-size:15px;color:var(--gray-500);margin-bottom:16px;">暂无在线简历</div>
                <button class="btn btn-primary" id="goCreateResumeBtn"><i data-lucide="plus" style="width:15px;height:15px;"></i>去创建</button>
            </div>`;
        document.getElementById('goCreateResumeBtn')?.addEventListener('click', openCreateOnlineResumeDialog);
        initLucideIcons();
        return;
    }

    // 渲染所有在线简历卡片
    const cardsHtml = onlineResumes.map(res => {
        const rd = res.data;
        const usageCount = deliveries.filter(d => d.resumeName === res.name).length;
        const interviewCount = deliveries.filter(d => d.resumeName === res.name && (
            isInterviewStage(d.stage) ||
            (d.history && d.history.some(h => isInterviewStage(h.to) || isInterviewStage(h.from)))
        )).length;
        const rate = calcRate(usageCount, interviewCount);
        const rc = getRateClass(rate);
        const sections = [
            rd.basic.name ? 20 : 0,
            rd.education.filter(i=>!i.hidden).length ? 20 : 0,
            rd.work.filter(i=>!i.hidden).length ? 20 : 0,
            rd.project.filter(i=>!i.hidden).length ? 20 : 0,
            rd.other.filter(i=>!i.hidden).length ? 20 : 0
        ];
        const completeness = sections.reduce((a,b)=>a+b,0);
        const avatarHtml = rd.basic.avatarBase64
            ? `<img src="${rd.basic.avatarBase64}" class="master-resume-icon" style="object-fit:cover;border-radius:var(--radius-lg);">`
            : `<div class="master-resume-icon"><i data-lucide="user"></i></div>`;
        return `
        <div class="master-resume-card" style="margin-bottom:14px;" data-online-id="${res.id}">
            <div class="master-resume-left">
                ${avatarHtml}
                <div>
                    <div class="master-resume-name">${escapeHtml(res.name)}</div>
                    <div class="master-resume-meta">
                        <span><i data-lucide="clock"></i>最后更新 ${res.lastModified||'—'}</span>
                        <span><i data-lucide="send"></i>已投递 ${usageCount} 次</span>
                        ${rd.basic.jobTarget ? `<span><i data-lucide="target"></i>${escapeHtml(rd.basic.jobTarget)}</span>` : ''}
                    </div>
                    <div class="completeness-bar" style="width:260px;margin-top:12px;">
                        <div class="completeness-label"><span>简历完整度</span><span>${completeness}%</span></div>
                        <div class="completeness-track"><div class="completeness-fill" style="width:${completeness}%"></div></div>
                    </div>
                </div>
            </div>
            <div class="master-resume-stats">
                <div class="master-stat">
                    <div class="master-stat-num ${rc}">${rate}</div>
                    <div class="master-stat-label">面试邀请率</div>
                </div>
                <div class="master-stat">
                    <div class="master-stat-num">${interviewCount}</div>
                    <div class="master-stat-label">获得面试</div>
                </div>
            </div>
            <div class="master-resume-actions">
                <button class="btn btn-outline online-ai-btn" data-id="${res.id}">
                    <i data-lucide="sparkles" style="width:15px;height:15px;"></i>AI优化
                </button>
                <button class="btn btn-outline online-delete-btn" data-id="${res.id}" style="color:var(--error-600);border-color:var(--error-200);"><i data-lucide="trash-2" style="width:15px;height:15px;"></i>删除</button>
                <button class="btn btn-outline online-export-btn" data-id="${res.id}"><i data-lucide="download" style="width:15px;height:15px;"></i>导出PDF</button>
                <button class="btn btn-primary online-edit-btn" data-id="${res.id}"><i data-lucide="edit-3" style="width:15px;height:15px;"></i>编辑</button>
            </div>
        </div>`;
    }).join('');

    container.innerHTML = cardsHtml + `
        <div style="margin-top:8px;display:flex;justify-content:center;">
            <button class="btn btn-outline" id="addMoreOnlineResumeBtn" style="gap:6px;"><i data-lucide="plus" style="width:14px;height:14px;"></i>创建新的在线简历</button>
        </div>`;

    document.getElementById('addMoreOnlineResumeBtn')?.addEventListener('click', openCreateOnlineResumeDialog);

    container.querySelectorAll('.online-edit-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            const id = btn.dataset.id;
            const res = onlineResumes.find(r => r.id === id);
            if (!res) return;
            editingOnlineResumeId = id;
            editingResumeId = null; // 不是定制版
            resumeData = res.data;
            document.getElementById('editorTitleBadge').textContent = res.name;
            navigateTo('resume-editor');
        });
    });

    container.querySelectorAll('.online-export-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            const id = btn.dataset.id;
            const res = onlineResumes.find(r => r.id === id);
            if (!res) return;
            resumeData = res.data;
            exportResumePdf();
        });
    });

    container.querySelectorAll('.online-delete-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            const id = btn.dataset.id;
            const res = onlineResumes.find(r => r.id === id);
            if (!res) return;
            if (confirm(`确定删除在线简历「${res.name}」吗？删除后数据将彻底清除。`)) {
                onlineResumes = onlineResumes.filter(r => r.id !== id);
                persist();
                // 若当前编辑的就是这份，清除 resumeData
                if (editingOnlineResumeId === id) {
                    editingOnlineResumeId = null;
                    resumeData = emptyResumeData();
                }
                // 从 localStorage 清除
                try { localStorage.removeItem('online_resume_' + id); } catch(e) {}
                renderMasterCard();
                showToast(`已删除「${res.name}」`);
            }
        });
    });

    container.querySelectorAll('.online-ai-btn').forEach(btn => {
        btn.addEventListener('click', () => openAiWorkspace(btn.dataset.id));
    });

    initLucideIcons();
}

// 创建在线简历的命名对话框
function openCreateOnlineResumeDialog() {
    const overlay = document.createElement('div');
    overlay.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,0.5);z-index:9999;display:flex;align-items:center;justify-content:center;backdrop-filter:blur(4px);';
    overlay.innerHTML = `<div style="background:#fff;border-radius:20px;width:min(420px,92vw);padding:28px;box-shadow:0 20px 40px rgba(0,0,0,0.15);">
        <h3 style="font-size:1.1rem;font-weight:700;margin-bottom:6px;">新建在线简历</h3>
        <p style="color:#6b7280;font-size:0.85rem;margin-bottom:20px;">为这份简历起一个名称，方便区分不同版本</p>
        <label style="display:block;font-size:0.8rem;font-weight:500;color:#374151;margin-bottom:6px;">简历名称</label>
        <input id="onlineResumeNameInput" type="text" value="" placeholder="例如：我的前端简历、社招版、校招版" style="width:100%;padding:10px 14px;border:1px solid #d1d5db;border-radius:12px;font-size:0.9rem;outline:none;margin-bottom:4px;" />
        <div id="onlineResumeNameError" style="font-size:12px;color:#ef4444;min-height:18px;margin-bottom:12px;"></div>
        <div style="display:flex;gap:10px;justify-content:flex-end;">
            <button id="onlineResumeCancelBtn" style="padding:8px 20px;border:1px solid #d1d5db;border-radius:10px;background:#fff;cursor:pointer;font-size:0.9rem;">取消</button>
            <button id="onlineResumeConfirmBtn" style="padding:8px 20px;border:none;border-radius:10px;background:#2563eb;color:#fff;cursor:pointer;font-size:0.9rem;font-weight:500;">创建并编辑</button>
        </div>
    </div>`;
    document.body.appendChild(overlay);
    const input = overlay.querySelector('#onlineResumeNameInput');
    const errorEl = overlay.querySelector('#onlineResumeNameError');
    input.focus();
    overlay.querySelector('#onlineResumeCancelBtn').addEventListener('click', () => overlay.remove());
    overlay.querySelector('#onlineResumeConfirmBtn').addEventListener('click', () => {
        const name = input.value.trim();
        if (!name) { input.style.borderColor='#ef4444'; errorEl.textContent='请输入简历名称'; return; }
        const allNames = [...onlineResumes.map(r => r.name), ...customResumes.map(r => r.name)];
        if (allNames.includes(name)) { input.style.borderColor='#ef4444'; errorEl.textContent='该名称已被其他简历使用，请换一个'; return; }
        const newId = 'online_' + Date.now();
        const now = new Date().toISOString().slice(0,10);
        const newRes = { id: newId, name, lastModified: now, data: emptyResumeData() };
        onlineResumes.unshift(newRes);
        persist();
        overlay.remove();
        // 进入编辑器
        editingOnlineResumeId = newId;
        editingResumeId = null;
        resumeData = newRes.data;
        document.getElementById('editorTitleBadge').textContent = name;
        navigateTo('resume-editor');
        showToast(`已创建「${name}」，请填写简历内容`);
    });
    input.addEventListener('input', () => { input.style.borderColor='#d1d5db'; errorEl.textContent=''; });
    overlay.addEventListener('click', e => { if (e.target === overlay) overlay.remove(); });
    input.addEventListener('keydown', e => { if (e.key === 'Enter') overlay.querySelector('#onlineResumeConfirmBtn').click(); });
}

function exportResumePdf() {
    saveBasicData();
    const b = resumeData.basic;
    const edu = resumeData.education.filter(i => !i.hidden);
    const work = resumeData.work.filter(i => !i.hidden);
    const proj = resumeData.project.filter(i => !i.hidden);
    const other = resumeData.other.filter(i => !i.hidden);
    const skills = other.filter(i => i.type === 'skill');
    const certs = other.filter(i => i.type !== 'skill');

    // 头像
    const avatarHtml = b.avatarBase64
        ? `<div class="pdf-avatar-wrap"><img src="${b.avatarBase64}" alt=""></div>`
        : `<div class="pdf-avatar-wrap">${escapeHtml((b.name||'?')[0])}</div>`;

    // 年龄计算
    function calcAge(birthStr) {
        if (!birthStr) return '';
        var birth = new Date(birthStr);
        var today = new Date();
        var age = today.getFullYear() - birth.getFullYear();
        var m = today.getMonth() - birth.getMonth();
        if (m < 0 || (m === 0 && today.getDate() < birth.getDate())) age--;
        return age + ' 岁';
    }

    function fmtDate(d) { if (!d) return ''; if (/^\d{4}-01$/.test(d)) return d.slice(0,4); return d; }
    function esc(v) { return escapeHtml(v||''); }

    // SVG 图标
    var icEdu = '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M22 10v6M2 10l10-5 10 5-10 5z"/><path d="M6 12v5c0 1.1 2.7 2 6 2s6-.9 6-2v-5"/></svg>';
    var icWork = '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="2" y="7" width="20" height="14" rx="2"/><path d="M16 7V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v2"/></svg>';
    var icProj = '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 2L2 7l10 5 10-5-10-5z"/><path d="M2 17l10 5 10-5"/><path d="M2 12l10 5 10-5"/></svg>';
    var icCert = '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="8" r="6"/><path d="M15.477 12.89 17 22l-5-3-5 3 1.523-9.11"/></svg>';

    var html = '';

    // 基本信息
    html += '<div class="pdf-basic-info">' + avatarHtml + '<div class="pdf-basic-body">';
    html += '<div class="pdf-name-row">' + esc(b.name||'—');
    if (b.jobTarget) html += '<span class="pdf-job">求职意向：' + esc(b.jobTarget) + '</span>';
    html += '</div>';
    html += '<div class="pdf-info-grid">';
    html += '<span><span class="lbl">性别：</span>' + esc(b.gender) + '</span>';
    html += '<span><span class="lbl">手机：</span>' + esc(b.phone) + '</span>';
    html += '<span><span class="lbl">籍贯：</span>' + esc(b.hometown||'') + '</span>';
    html += '<span><span class="lbl">工作年限：</span>' + esc(b.workYears) + '</span>';
    html += '<span><span class="lbl">年龄：</span>' + calcAge(b.birth) + '</span>';
    html += '<span style="white-space:nowrap;"><span class="lbl">邮箱：</span>' + esc(b.email) + '</span>';
    html += '<span><span class="lbl">现居地：</span>' + esc(b.residence||'') + '</span>';
    html += '<span><span class="lbl">求职状态：</span>' + esc(b.status) + '</span>';
    html += '</div></div></div>';

    // 教育背景
    if (edu.length) {
        html += '<div class="pdf-sec"><div class="pdf-sec-hd">' + icEdu + '<span class="pdf-sec-title">教育背景</span></div>';
        edu.forEach(function(i) {
            var titleParts = [esc(i.school), esc(i.degreeName||i.degree||''), esc(i.major)].filter(Boolean).join(' <span class="sub">·</span> ');
            html += '<div class="pdf-card"><div class="pdf-card-head"><span class="pdf-card-title">' + titleParts + '</span><span class="pdf-card-date">' + (fmtDate(i.startDate)||'') + ' — ' + (fmtDate(i.endDate)||'') + '</span></div>';
            var meta = [];
            if (i.gpa) meta.push('<strong>GPA：</strong>' + esc(i.gpa));
            if (i.courses) meta.push('<strong>主修课程：</strong>' + esc(i.courses));
            if (meta.length) html += '<div class="pdf-card-body">' + meta.join(' &nbsp;&nbsp; ') + '</div>';
            html += '</div>';
        });
        html += '</div>';
    }

    // 工作经历
    if (work.length) {
        html += '<div class="pdf-sec"><div class="pdf-sec-hd">' + icWork + '<span class="pdf-sec-title">工作经历</span></div>';
        work.forEach(function(i) {
            html += '<div class="pdf-card"><div class="pdf-card-head"><span class="pdf-card-title">' + esc(i.company) + '<span class="sub"> · ' + esc(i.position) + '</span>' + (i.intern ? '<span class="pdf-intern-tag">实习</span>' : '') + '</span><span class="pdf-card-date">' + (i.startDate||'') + ' — ' + (i.endDate||'') + '</span></div>';
            var content = i.workContent || (i.duties ? i.duties + (i.achievements ? '\n' + i.achievements : '') : '');
            if (content) {
                var lines = content.split('\n').filter(function(l) { return l.trim(); });
                html += '<div class="pdf-card-body"><ul>' + lines.map(function(l) { return '<li>' + esc(l.trim()) + '</li>'; }).join('') + '</ul></div>';
            }
            html += '</div>';
        });
        html += '</div>';
    }

    // 项目经历
    if (proj.length) {
        html += '<div class="pdf-sec"><div class="pdf-sec-hd">' + icProj + '<span class="pdf-sec-title">项目经历</span></div>';
        proj.forEach(function(i) {
            html += '<div class="pdf-card"><div class="pdf-card-head"><span class="pdf-card-title">' + esc(i.name) + '<span class="sub"> · ' + esc(i.role) + '</span></span><span class="pdf-card-date">' + (i.startDate||'') + ' — ' + (i.endDate||'') + '</span></div>';
            var parts = [];
            if (i.description) parts.push('<p><strong>项目描述：</strong>' + esc(i.description) + '</p>');
            if (i.responsibility) parts.push('<p><strong>个人职责：</strong>' + esc(i.responsibility) + '</p>');
            if (i.result) parts.push('<p><strong>项目成果：</strong>' + esc(i.result) + '</p>');
            if (parts.length) html += '<div class="pdf-card-body">' + parts.join('') + '</div>';
            html += '</div>';
        });
        html += '</div>';
    }

    // 证书 & 技能
    if (skills.length || certs.length) {
        html += '<div class="pdf-sec"><div class="pdf-sec-hd">' + icCert + '<span class="pdf-sec-title">证书 &amp; 技能</span></div>';
        if (skills.length) {
            html += '<div class="pdf-card"><div class="pdf-card-head"><span class="pdf-card-title">技能</span></div><div class="pdf-skill-row">';
            skills.forEach(function(s) {
                html += '<span class="pdf-skill-tag">' + esc(s.title) + '</span>';
            });
            html += '</div></div>';
        }
        certs.forEach(function(c) {
            html += '<div class="pdf-card"><div class="pdf-card-head"><span class="pdf-card-title">' + esc(c.title) + '</span>' + (c.date ? '<span class="pdf-card-date">' + esc(c.date) + '</span>' : '') + '</div></div>';
        });
        html += '</div>';
    }

    document.getElementById('pdf-print-page').innerHTML = html;
    window.print();
}

function renderResumeGrid() {
    const grid = document.getElementById('resumeGrid');
    // 从投递数据更新每个简历的使用统计
    customResumes.forEach(res => {
        const matched = deliveries.filter(d => d.resumeName === res.name);
        res.usageCount = matched.length;
        res.interviewCount = matched.filter(d =>
            isInterviewStage(d.stage) ||
            (d.history && d.history.some(h => isInterviewStage(h.to) || isInterviewStage(h.from)))
        ).length;
        res.best = false;
    });
    // 标记邀请率最高的为最佳
    const withRate = customResumes.filter(r => r.usageCount > 0);
    if (withRate.length) {
        withRate.sort((a, b) => (b.interviewCount/b.usageCount) - (a.interviewCount/a.usageCount));
        withRate[0].best = true;
    }

    if (!customResumes.length) {
        grid.innerHTML = `<div class="empty-state" style="grid-column:1/-1;padding:48px 20px;">
            <i data-lucide="file-plus" style="width:48px;height:48px;color:var(--gray-300);display:block;margin:0 auto 12px;"></i>
            <div style="color:var(--gray-500);font-size:14px;">暂无个性化简历</div>
            <div style="color:var(--gray-400);font-size:13px;margin-top:4px;">从在线简历新建定制版，或上传PDF文件</div>
        </div>`;
        initLucideIcons();
        return;
    }
    const sorted = [...customResumes].sort((a,b) => new Date(b.createdAt) - new Date(a.createdAt));
    grid.innerHTML = sorted.map(res => {
        const rate = calcRate(res.usageCount, res.interviewCount);
        const rc = getRateClass(rate);
        const isCustom = res.type === 'custom';
        // 操作按钮：custom 有预览+编辑+删除，upload 只有预览+删除
        const actionBtns = isCustom
            ? `<button class="rc-btn edit" onclick="editCustomResume('${res.id}')"><i data-lucide="edit-3"></i>编辑</button>
               <button class="rc-btn delete" onclick="deleteCustomResume('${res.id}')"><i data-lucide="trash-2"></i>删除</button>`
            : `<button class="rc-btn" onclick="previewResume('${res.id}')"><i data-lucide="eye"></i>预览</button>
               <button class="rc-btn delete" onclick="deleteCustomResume('${res.id}')"><i data-lucide="trash-2"></i>删除</button>`;
        return `
        <div class="resume-card" data-id="${res.id}">
            ${res.best ? '<span class="resume-card-best">最佳</span>' : ''}
            <div class="resume-card-top">
                <div class="resume-card-icon ${isCustom ? 'custom' : 'upload'}">
                    <i data-lucide="${isCustom ? 'file-text' : 'file'}"></i>
                </div>
                <div class="resume-card-info">
                    <div class="resume-card-name" title="${escapeHtml(res.name)}">${escapeHtml(res.name)}</div>
                    <div class="resume-card-source">${isCustom ? '源自在线简历' : '上传文件'} · ${res.createdAt}</div>
                </div>
            </div>
            <div class="resume-card-stats">
                <div class="resume-card-stat">
                    <div class="resume-card-stat-num">${res.usageCount}</div>
                    <div class="resume-card-stat-label">投递次数</div>
                </div>
                <div class="resume-card-stat">
                    <div class="resume-card-stat-num">${res.interviewCount}</div>
                    <div class="resume-card-stat-label">获得面试</div>
                </div>
                <div class="resume-card-stat">
                    <div class="resume-card-stat-num ${rc}">${rate}</div>
                    <div class="resume-card-stat-label">邀请率</div>
                </div>
            </div>
            <div class="resume-card-actions">${actionBtns}</div>
        </div>`;
    }).join('');
    initLucideIcons();
}

// 当前编辑的定制版简历ID（null = 不是定制版）
let editingResumeId = null;
// 当前编辑的在线简历ID（null = 不是在线简历）
let editingOnlineResumeId = null;

function editCustomResume(id) {
    const res = customResumes.find(r => r.id === id);
    if (!res) return;
    editingResumeId = id;
    editingOnlineResumeId = null;
    if (!res.data) res.data = emptyResumeData();
    resumeData = res.data;
    document.getElementById('editorTitleBadge').textContent = res.name;
    navigateTo('resume-editor');
}

function previewResume(id) {
    const res = customResumes.find(r => r.id === id);
    if (!res) return;
    if (res.type === 'upload') {
        if (!res.fileUrl) { showToast('PDF文件不可用，请重新上传', 'error'); return; }
        const overlay = document.createElement('div');
        overlay.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,0.6);z-index:9999;display:flex;align-items:center;justify-content:center;backdrop-filter:blur(4px);';
        overlay.innerHTML = `<div style="background:#fff;border-radius:20px;width:min(800px,95vw);height:85vh;display:flex;flex-direction:column;position:relative;overflow:hidden;">
            <div style="display:flex;align-items:center;justify-content:space-between;padding:16px 24px;border-bottom:1px solid #e5e7eb;">
                <h3 style="font-size:1.1rem;font-weight:700;margin:0;">${escapeHtml(res.name)}</h3>
                <button class="pdf-preview-close-btn" style="background:none;border:none;font-size:24px;cursor:pointer;color:#6b7280;line-height:1;">&times;</button>
            </div>
            <iframe src="${res.fileUrl}" style="flex:1;border:none;width:100%;"></iframe>
        </div>`;
        document.body.appendChild(overlay);
        overlay.querySelector('.pdf-preview-close-btn').addEventListener('click', () => overlay.remove());
        overlay.addEventListener('click', e => { if (e.target === overlay) overlay.remove(); });
        return;
    }
}

function showSaveAsDialog(source) {
    // 检查是否有在线简历可供复制
    if (onlineResumes.length === 0) {
        showToast('请先创建在线简历，再新建定制版', 'error');
        return;
    }
    // 选择基于哪份在线简历
    const overlay = document.createElement('div');
    overlay.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,0.5);z-index:9999;display:flex;align-items:center;justify-content:center;backdrop-filter:blur(4px);';
    const onlineOptions = onlineResumes.map(r => `<option value="${r.id}">${escapeHtml(r.name)}</option>`).join('');
    overlay.innerHTML = `<div style="background:#fff;border-radius:20px;width:min(420px,92vw);padding:28px;box-shadow:0 20px 40px rgba(0,0,0,0.15);">
        <h3 style="font-size:1.1rem;font-weight:700;margin-bottom:6px;">新建定制版简历</h3>
        <p style="color:#6b7280;font-size:0.85rem;margin-bottom:20px;">基于在线简历创建，可独立编辑</p>
        <label style="display:block;font-size:0.8rem;font-weight:500;color:#374151;margin-bottom:6px;">基于哪份在线简历</label>
        <select id="saveAsSourceSelect" style="width:100%;padding:10px 14px;border:1px solid #d1d5db;border-radius:12px;font-size:0.9rem;margin-bottom:16px;">${onlineOptions}</select>
        <label style="display:block;font-size:0.8rem;font-weight:500;color:#374151;margin-bottom:6px;">简历名称</label>
        <input id="saveAsNameInput" type="text" value="" placeholder="请输入简历名称" style="width:100%;padding:10px 14px;border:1px solid #d1d5db;border-radius:12px;font-size:0.9rem;outline:none;margin-bottom:4px;" />
        <div id="saveAsNameError" style="font-size:12px;color:#ef4444;min-height:18px;margin-bottom:12px;"></div>
        <div style="display:flex;gap:10px;justify-content:flex-end;">
            <button id="saveAsCancelBtn" style="padding:8px 20px;border:1px solid #d1d5db;border-radius:10px;background:#fff;cursor:pointer;font-size:0.9rem;">取消</button>
            <button id="saveAsConfirmBtn" style="padding:8px 20px;border:none;border-radius:10px;background:#2563eb;color:#fff;cursor:pointer;font-size:0.9rem;font-weight:500;">创建并编辑</button>
        </div>
    </div>`;
    document.body.appendChild(overlay);
    const input = overlay.querySelector('#saveAsNameInput');
    const errorEl = overlay.querySelector('#saveAsNameError');
    input.focus();
    overlay.querySelector('#saveAsCancelBtn').addEventListener('click', () => overlay.remove());
    overlay.querySelector('#saveAsConfirmBtn').addEventListener('click', () => {
        const name = input.value.trim();
        if (!name) { input.style.borderColor='#ef4444'; errorEl.textContent='请输入简历名称'; return; }
        const isDuplicate = [...onlineResumes.map(r => r.name), ...customResumes.map(r => r.name)].includes(name);
        if (isDuplicate) { input.style.borderColor='#ef4444'; errorEl.textContent='该名称已被其他简历使用，请换一个'; return; }
        const sourceId = overlay.querySelector('#saveAsSourceSelect')?.value;
        const sourceRes = onlineResumes.find(r => r.id === sourceId);
        const newId = 'cust_' + Date.now();
        const now = new Date().toISOString().slice(0,10);
        // 深拷贝在线简历数据作为定制版初始内容
        const copiedData = sourceRes ? JSON.parse(JSON.stringify(sourceRes.data)) : emptyResumeData();
        customResumes.unshift({ id:newId, name, type:'custom', source:'源自在线简历', usageCount:0, interviewCount:0, best:false, createdAt:now, data: copiedData });
        persist();
        overlay.remove();
        editingResumeId = newId;
        editingOnlineResumeId = null;
        resumeData = customResumes[0].data;
        document.getElementById('editorTitleBadge').textContent = name;
        navigateTo('resume-editor');
        showToast(`已创建「${name}」，请编辑内容`);
    });
    input.addEventListener('input', () => { input.style.borderColor='#d1d5db'; errorEl.textContent=''; });
    overlay.addEventListener('click', e => { if (e.target === overlay) overlay.remove(); });
    input.addEventListener('keydown', e => { if (e.key === 'Enter') overlay.querySelector('#saveAsConfirmBtn').click(); });
}

function deleteCustomResume(id) {
    const res = customResumes.find(r => r.id === id);
    if (!res) return;
    if (confirm('确定删除该个性化简历？')) {
        customResumes = customResumes.filter(r => r.id !== id);
        persist();
        // 若当前正在编辑该简历，重置 resumeData
        if (editingResumeId === id) {
            editingResumeId = null;
            resumeData = emptyResumeData();
        }
        renderResumeGrid();
        showToast('已删除');
    }
}

document.getElementById('createCustomBtn').addEventListener('click', () => {
    showSaveAsDialog(null);
});

// 简历文件上传
const uploadPdfArea = document.getElementById('uploadPdfArea');
const resumeFileInput = document.getElementById('resumeFileInput');
uploadPdfArea.addEventListener('click', () => resumeFileInput.click());
uploadPdfArea.addEventListener('dragover', e => { e.preventDefault(); uploadPdfArea.style.borderColor='#2563eb'; });
uploadPdfArea.addEventListener('dragleave', () => { uploadPdfArea.style.borderColor='#cbd5e1'; });
uploadPdfArea.addEventListener('drop', e => { e.preventDefault(); uploadPdfArea.style.borderColor='#cbd5e1'; if(e.dataTransfer.files[0]) handleResumeUpload(e.dataTransfer.files[0]); });
resumeFileInput.addEventListener('change', e => { if(e.target.files[0]) handleResumeUpload(e.target.files[0]); resumeFileInput.value=''; });

function handleResumeUpload(file) {
    if (file.type !== 'application/pdf') { showToast('仅支持上传 PDF 格式文件', 'error'); return; }
    const newId = 'upload_'+Date.now();
    const now = new Date().toISOString().slice(0,10);
    const fileUrl = URL.createObjectURL(file);
    customResumes.unshift({ id:newId, name:file.name, type:'upload', source:`上传文件 (${now})`, usageCount:0, interviewCount:0, best:false, createdAt:now, fileUrl:fileUrl, fileBlob:file });
    persist();
    renderResumeGrid();
    showToast(`已上传「${file.name}」`);
}

async function extractPdfToResume(id) {
    const res = customResumes.find(r => r.id === id);
    if (!res || !res.fileBlob) { showToast('PDF文件不可用，请重新上传', 'error'); return; }
    showToast('正在提取PDF内容...');
    try {
        const arrayBuffer = await res.fileBlob.arrayBuffer();
        pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';
        const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
        let fullText = '';
        for (let i = 1; i <= pdf.numPages; i++) {
            const page = await pdf.getPage(i);
            const content = await page.getTextContent();
            const pageText = content.items.map(item => item.str).join(' ');
            fullText += pageText + '\n';
        }
        if (!fullText.trim()) { showToast('未能从PDF中提取到文本内容', 'error'); return; }
        const parsed = parsePdfText(fullText);
        if (parsed.name) resumeData.basic.name = parsed.name;
        if (parsed.phone) resumeData.basic.phone = parsed.phone;
        if (parsed.email) resumeData.basic.email = parsed.email;
        if (parsed.gender) resumeData.basic.gender = parsed.gender;
        if (parsed.jobTarget) resumeData.basic.jobTarget = parsed.jobTarget;
        if (parsed.education.length) resumeData.education = parsed.education;
        if (parsed.work.length) resumeData.work = parsed.work;
        if (parsed.project.length) resumeData.project = parsed.project;
        // 将提取数据保存为新的在线简历
        const newId = 'online_' + Date.now();
        const now = new Date().toISOString().slice(0,10);
        const pdfResumeName = res.name.replace(/\.pdf$/i, '') || 'PDF导入简历';
        const newOnline = { id: newId, name: pdfResumeName, lastModified: now, data: resumeData };
        onlineResumes.unshift(newOnline);
        editingOnlineResumeId = newId;
        editingResumeId = null;
        resumeData = newOnline.data;
        document.getElementById('editorTitleBadge').textContent = pdfResumeName;
        navigateTo('resume-editor');
        renderBasic(); renderEducation(); renderWork(); renderProject(); renderCert();
        showToast('PDF内容已提取并填充到在线简历');
    } catch(e) {
        console.error('PDF extraction error:', e);
        showToast('PDF解析失败，请确认文件格式正确', 'error');
    }
}

function parsePdfText(text) {
    const result = { name:'', phone:'', email:'', gender:'', jobTarget:'', education:[], work:[], project:[] };
    const phoneMatch = text.match(/1[3-9]\d{9}/);
    if (phoneMatch) result.phone = phoneMatch[0];
    const emailMatch = text.match(/[\w.-]+@[\w.-]+\.\w+/);
    if (emailMatch) result.email = emailMatch[0];
    const genderMatch = text.match(/[男女]/);
    if (genderMatch) result.gender = genderMatch[0];
    const lines = text.split(/\n/).map(l => l.trim()).filter(l => l);
    if (lines.length > 0) {
        const firstLine = lines[0].replace(/\s+/g, ' ').trim();
        const nameCandidate = firstLine.split(/[\s|·,，]/)[0];
        if (nameCandidate && nameCandidate.length >= 2 && nameCandidate.length <= 5 && /^[一-龥]+$/.test(nameCandidate)) {
            result.name = nameCandidate;
        }
    }
    const jobKeywords = ['求职意向', '应聘岗位', '目标岗位', '期望职位'];
    for (const line of lines) {
        for (const kw of jobKeywords) {
            if (line.includes(kw)) {
                const val = line.replace(new RegExp(`.*${kw}[：:]*\\s*`), '').trim();
                if (val) result.jobTarget = val;
                break;
            }
        }
    }
    const eduKeywords = ['教育经历', '教育背景', '学历'];
    const workKeywords = ['工作经历', '工作经验', '实习经历'];
    const projKeywords = ['项目经历', '项目经验'];
    const sectionBreakers = [...eduKeywords, ...workKeywords, ...projKeywords, '技能', '证书', '荣誉', '自我评价', '个人优势'];
    let currentSection = '';
    let sectionLines = [];
    for (const line of lines) {
        let matched = false;
        for (const kw of eduKeywords) { if (line.includes(kw)) { flushSection(currentSection, sectionLines, result); currentSection = 'edu'; sectionLines = []; matched = true; break; } }
        if (matched) continue;
        for (const kw of workKeywords) { if (line.includes(kw)) { flushSection(currentSection, sectionLines, result); currentSection = 'work'; sectionLines = []; matched = true; break; } }
        if (matched) continue;
        for (const kw of projKeywords) { if (line.includes(kw)) { flushSection(currentSection, sectionLines, result); currentSection = 'proj'; sectionLines = []; matched = true; break; } }
        if (matched) continue;
        for (const kw of sectionBreakers) { if (line.includes(kw) && !['edu','work','proj'].includes(currentSection)) { flushSection(currentSection, sectionLines, result); currentSection = 'other'; sectionLines = []; matched = true; break; } }
        if (!matched && currentSection) sectionLines.push(line);
    }
    flushSection(currentSection, sectionLines, result);
    return result;
}

function flushSection(section, lines, result) {
    if (!section || !lines.length) return;
    const datePattern = /(\d{4})[.\-/年](\d{1,2})[.\-/月]?\s*[-–—~至到]\s*(\d{4})?[.\-/年]?(\d{1,2})?[.\-/月]?|(\d{4})[.\-/年](\d{1,2})[.\-/月]?\s*[-–—~至到]\s*(至今|今|现在)/;
    if (section === 'edu') {
        let current = null;
        for (const line of lines) {
            const dm = line.match(datePattern);
            if (dm || /大学|学院|University|College|本科|硕士|博士|学士/.test(line)) {
                if (current) result.education.push(current);
                current = { id: guid(), school: '', degree: '', major: '', startDate: '', endDate: '', hidden: false };
                const parts = line.replace(datePattern, '').trim().split(/[\s|·,，]+/).filter(p => p);
                if (parts[0]) current.school = parts[0];
                if (parts[1]) current.major = parts[1];
                if (parts[2]) current.degree = parts[2];
                if (!current.degree) {
                    if (/硕士|研究生/.test(line)) current.degree = '硕士';
                    else if (/博士/.test(line)) current.degree = '博士';
                    else current.degree = '本科';
                }
            } else if (current) {
                if (!current.major && line.length < 20) current.major = line;
            }
        }
        if (current) result.education.push(current);
    } else if (section === 'work') {
        let current = null;
        for (const line of lines) {
            const dm = line.match(datePattern);
            if (dm) {
                if (current) result.work.push(current);
                current = { id: guid(), company: '', position: '', startDate: '', endDate: '', desc: '', hidden: false };
                const parts = line.replace(datePattern, '').trim().split(/[\s|·,，]+/).filter(p => p);
                if (parts[0]) current.company = parts[0];
                if (parts[1]) current.position = parts[1];
            } else if (current) {
                current.desc = current.desc ? current.desc + '\n' + line : line;
            }
        }
        if (current) result.work.push(current);
    } else if (section === 'proj') {
        let current = null;
        for (const line of lines) {
            const dm = line.match(datePattern);
            if (dm || (line.length < 30 && !current)) {
                if (current) result.project.push(current);
                current = { id: guid(), name: '', role: '', startDate: '', endDate: '', desc: '', hidden: false };
                const parts = line.replace(datePattern, '').trim().split(/[\s|·,，]+/).filter(p => p);
                if (parts[0]) current.name = parts[0];
                if (parts[1]) current.role = parts[1];
            } else if (current) {
                current.desc = current.desc ? current.desc + '\n' + line : line;
            }
        }
        if (current) result.project.push(current);
    }
}

// ============================================================
// 在线简历编辑器
// ============================================================
const ethnicityList = ['汉族','壮族','回族','满族','维吾尔族','苗族','彝族','土家族','藏族','蒙古族','侗族','布依族','瑶族','白族','朝鲜族','哈尼族','黎族','哈萨克族','傣族','畲族','傈僳族','东乡族','仡佬族','拉祜族','佤族','水族','纳西族','羌族','土族','仫佬族','锡伯族','柯尔克孜族','景颇族','达斡尔族','撒拉族','布朗族','毛南族','塔吉克族','普米族','阿昌族','怒族','鄂温克族','京族','基诺族','德昂族','保安族','俄罗斯族','裕固族','乌孜别克族','门巴族','鄂伦春族','独龙族','赫哲族','高山族','珞巴族','塔塔尔族'];
const politicalStatusList = ['群众','中共党员','中共预备党员','共青团员','民主党派','无党派人士'];

const emptyResumeData = () => ({
    basic:{name:'',gender:'',birth:'',hometown:'',residence:'',phone:'',email:'',jobTarget:'',workYears:'',status:'',ethnicity:'',politicalStatus:'',avatarBase64:null},
    education:[],
    work:[],
    project:[],
    other:[]
});
let resumeData = emptyResumeData();

function guid() { return Date.now()+'-'+Math.random().toString(36).substr(2,6); }

// Limit year to 4 digits for date/month inputs to prevent overflow (e.g. typing "202506")
function clampDateYear(input) {
    const val = input.value;
    if (!val) return;
    const parts = val.split('-');
    if (parts[0] && parts[0].length > 4) {
        parts[0] = parts[0].slice(0, 4);
        input.value = parts.join('-');
    }
}
function initDateYearClamp() {
    document.querySelectorAll('input[type="date"], input[type="month"]').forEach(input => {
        if (input.dataset.yearClamped) return;
        input.dataset.yearClamped = '1';
        input.setAttribute('max', input.type === 'date' ? '9999-12-31' : '9999-12');
        input.setAttribute('min', input.type === 'date' ? '1900-01-01' : '1900-01');
        input.addEventListener('input', () => clampDateYear(input));
        input.addEventListener('change', () => clampDateYear(input));
    });
}

function validatePhone(input) {
    const hint = document.getElementById('phoneHint');
    if (!hint) return;
    const v = (input.value || '').replace(/\D/g, '');
    input.value = v.slice(0, 11);
    if (v.length > 0 && (v.length !== 11 || !/^1[3-9]\d{9}$/.test(v))) {
        hint.style.display = 'block';
        input.style.borderColor = 'var(--error-500)';
    } else {
        hint.style.display = 'none';
        input.style.borderColor = '';
    }
}

function renderBasic() {
    const b=resumeData.basic;
    const genderOpts = ['','男','女','其他'].map(g => `<option value="${g}" ${b.gender===g?'selected':''}>${g||'请选择'}</option>`).join('');
    const workYearsOpts = ['','应届生','1-3年','3-5年','5-10年','10年以上'].map(w => `<option value="${w}" ${b.workYears===w?'selected':''}>${w||'请选择'}</option>`).join('');
    const statusOpts = ['','在职-看机会','离职-可随时到岗','在校学生'].map(s => `<option value="${s}" ${b.status===s?'selected':''}>${s||'请选择'}</option>`).join('');
    const ethnicityOpts = [''].concat(ethnicityList).map(e => `<option value="${e}" ${b.ethnicity===e?'selected':''}>${e||'请选择'}</option>`).join('');
    const politicalOpts = [''].concat(politicalStatusList).map(p => `<option value="${p}" ${b.politicalStatus===p?'selected':''}>${p||'请选择'}</option>`).join('');
    document.getElementById('basicInfoForm').innerHTML=`
        <div class="form-row-inline" style="grid-template-columns:1fr 1fr 1fr 1fr;">
            <div class="form-field"><label>姓名 *</label><input type="text" id="basicName" value="${escapeHtml(b.name)}" placeholder="请输入姓名"></div>
            <div class="form-field"><label>性别</label><select id="basicGender">${genderOpts}</select></div>
            <div class="form-field"><label>民族</label><select id="basicEthnicity">${ethnicityOpts}</select></div>
            <div class="form-field"><label>政治面貌</label><select id="basicPoliticalStatus">${politicalOpts}</select></div>
        </div>
        <div class="form-row-inline" style="grid-template-columns:1fr 1fr 1fr;">
            <div class="form-field"><label>出生日期</label><input type="date" id="basicBirth" value="${escapeHtml(b.birth || new Date().toISOString().slice(0,10))}"></div>
            <div class="form-field"><label>手机号 *</label><input type="tel" id="basicPhone" value="${escapeHtml(b.phone)}" placeholder="请输入11位手机号" maxlength="11" oninput="this.value=this.value.replace(/\\D/g,'').slice(0,11)" onblur="validatePhone(this)"><div class="field-hint" id="phoneHint" style="font-size:11px;color:var(--error-500);margin-top:3px;display:none;">请输入以1开头的11位手机号</div></div>
            <div class="form-field"><label>邮箱 *</label><input type="email" id="basicEmail" value="${escapeHtml(b.email)}" placeholder="请输入邮箱"></div>
        </div>
        <div class="form-row-inline" style="grid-template-columns:1fr 1fr;">
            <div class="form-field"><label>籍贯</label><input type="text" id="basicHometown" value="${escapeHtml(b.hometown||'')}" placeholder="例如：浙江杭州"></div>
            <div class="form-field"><label>现居地</label><input type="text" id="basicResidence" value="${escapeHtml(b.residence||'')}" placeholder="例如：上海"></div>
        </div>
        <div class="form-row-inline" style="grid-template-columns:2fr 1fr 1fr;">
            <div class="form-field"><label>求职意向</label><input type="text" id="basicJobTarget" value="${escapeHtml(b.jobTarget)}" placeholder="例如：产品经理、数据分析师"></div>
            <div class="form-field"><label>工作年限</label><select id="basicWorkYears">${workYearsOpts}</select></div>
            <div class="form-field"><label>当前状态</label><select id="basicStatus">${statusOpts}</select></div>
        </div>`;
    if(b.avatarBase64) document.getElementById('avatarImg').src=b.avatarBase64;
}

function sortByDate(items){ return [...items].sort((a,b)=>{const as=a.startDate||a.date||'',bs=b.startDate||b.date||'';const cmp=bs.localeCompare(as);if(cmp!==0)return cmp;const ae=a.endDate||'',be=b.endDate||'';return be.localeCompare(ae);}); }

function renderEducation() {
    // Display yyyy-mm as-is; strip -01 only if it was stored as year-only placeholder
    function fmtEduDate(d) {
        if (!d) return '';
        // yyyy-01 stored as year-only placeholder → show year only
        if (/^\d{4}-01$/.test(d)) return d.slice(0,4);
        // yyyy-mm → show as-is (e.g. 2020-09)
        if (/^\d{4}-\d{2}$/.test(d)) return d;
        return d;
    }
    document.getElementById('educationList').innerHTML=sortByDate(resumeData.education).map(item=>{
        const eduTypeLabel = item.eduType || '';
        const degreeLabel  = item.degreeName || item.degree || '';
        const titleStr = [item.school, eduTypeLabel, degreeLabel].filter(Boolean).join(' · ');
        return `
        <div class="item-card" data-id="${item.id}">
            <div class="item-header">
                <div>
                    <div class="item-title">${escapeHtml(titleStr)}</div>
                    <div class="item-meta">${escapeHtml(item.major)} &nbsp;·&nbsp; ${fmtEduDate(item.startDate)||''} — ${fmtEduDate(item.endDate)||''}</div>
                </div>
                <div class="card-actions">
                    <button class="card-action-btn edit-edu" data-id="${item.id}"><i data-lucide="pencil"></i>编辑</button>
                    <button class="card-action-btn hide-edu" data-id="${item.id}"><i data-lucide="${item.hidden?'eye':'eye-off'}"></i>${item.hidden?'显示':'隐藏'}</button>
                    <button class="card-action-btn danger del-edu" data-id="${item.id}"><i data-lucide="trash-2"></i>删除</button>
                </div>
            </div>
            <div class="detail-row" style="display:flex;flex-wrap:wrap;gap:12px 24px;align-items:baseline;">
                ${item.gpa?`<span style="white-space:nowrap;flex-shrink:0;"><strong>GPA：</strong>${escapeHtml(item.gpa)}</span>`:''}
                ${item.courses?`<span style="flex:1;min-width:140px;"><strong>主修课程：</strong>${escapeHtml(item.courses)}</span>`:''}
                ${item.experience?`<span style="flex:1 1 100%;"><strong>在校经历：</strong>${escapeHtml(item.experience)}</span>`:''}
            </div>
            ${item.hidden?'<div class="hidden-badge"><i data-lucide="eye-off" style="width:11px;height:11px;"></i>此条目已隐藏</div>':''}
        </div>`;
    }).join('');
    initLucideIcons();
    document.querySelectorAll('.edit-edu').forEach(b=>b.addEventListener('click',()=>editItem('education',b.dataset.id)));
    document.querySelectorAll('.hide-edu').forEach(b=>b.addEventListener('click',()=>{const it=resumeData.education.find(i=>i.id===b.dataset.id);if(it){it.hidden=!it.hidden;markDirty();renderEducation();showToast(it.hidden?'已隐藏':'已显示');}}));
    document.querySelectorAll('.del-edu').forEach(b=>b.addEventListener('click',()=>{if(confirm('确定删除？')){resumeData.education=resumeData.education.filter(i=>i.id!==b.dataset.id);markDirty();renderEducation();showToast('已删除');}}));
}

function renderWork() {
    document.getElementById('workList').innerHTML=sortByDate(resumeData.work).map(item=>`
        <div class="item-card" data-id="${item.id}">
            <div class="item-header">
                <div>
                    <div class="item-title">${escapeHtml(item.company)} · ${escapeHtml(item.position)}${item.intern?'<span class="intern-badge">实习</span>':''}</div>
                    <div class="item-meta">${item.startDate||''} — ${item.endDate||''}</div>
                </div>
                <div class="card-actions">
                    <button class="card-action-btn edit-work" data-id="${item.id}"><i data-lucide="pencil"></i>编辑</button>
                    <button class="card-action-btn ai-work-btn" data-id="${item.id}"><i data-lucide="sparkles"></i>AI优化</button>
                    <button class="card-action-btn hide-work" data-id="${item.id}"><i data-lucide="${item.hidden?'eye':'eye-off'}"></i>${item.hidden?'显示':'隐藏'}</button>
                    <button class="card-action-btn danger del-work" data-id="${item.id}"><i data-lucide="trash-2"></i>删除</button>
                </div>
            </div>
            <div class="detail-row"><strong>工作内容：</strong>${escapeHtml(item.workContent||item.duties||'')}</div>
            ${item.hidden?'<div class="hidden-badge"><i data-lucide="eye-off" style="width:11px;height:11px;"></i>此条目已隐藏</div>':''}
        </div>`).join('');
    initLucideIcons();
    document.querySelectorAll('.edit-work').forEach(b=>b.addEventListener('click',()=>editItem('work',b.dataset.id)));
    document.querySelectorAll('.ai-work-btn').forEach(b =>
        b.addEventListener('click', () => openAiInline('work', b.dataset.id))
    );
    document.querySelectorAll('.hide-work').forEach(b=>b.addEventListener('click',()=>{const it=resumeData.work.find(i=>i.id===b.dataset.id);if(it){it.hidden=!it.hidden;markDirty();renderWork();showToast(it.hidden?'已隐藏':'已显示');}}));
    document.querySelectorAll('.del-work').forEach(b=>b.addEventListener('click',()=>{if(confirm('确定删除？')){resumeData.work=resumeData.work.filter(i=>i.id!==b.dataset.id);markDirty();renderWork();showToast('已删除');}}));
}

function renderProject() {
    document.getElementById('projectList').innerHTML=sortByDate(resumeData.project).map(item=>`
        <div class="item-card" data-id="${item.id}">
            <div class="item-header">
                <div>
                    <div class="item-title">${escapeHtml(item.name)}</div>
                    <div class="item-meta">${escapeHtml(item.role)} &nbsp;·&nbsp; ${item.startDate||''} — ${item.endDate||''}</div>
                </div>
                <div class="card-actions">
                    <button class="card-action-btn edit-proj" data-id="${item.id}"><i data-lucide="pencil"></i>编辑</button>
                    <button class="card-action-btn ai-proj-btn" data-id="${item.id}"><i data-lucide="sparkles"></i>AI优化</button>
                    <button class="card-action-btn hide-proj" data-id="${item.id}"><i data-lucide="${item.hidden?'eye':'eye-off'}"></i>${item.hidden?'显示':'隐藏'}</button>
                    <button class="card-action-btn danger del-proj" data-id="${item.id}"><i data-lucide="trash-2"></i>删除</button>
                </div>
            </div>
            <div class="detail-row"><strong>项目描述：</strong>${escapeHtml(item.description)}<br><strong>个人职责：</strong>${escapeHtml(item.responsibility)}<br><strong>项目成果：</strong>${escapeHtml(item.result)}</div>
            ${item.hidden?'<div class="hidden-badge"><i data-lucide="eye-off" style="width:11px;height:11px;"></i>此条目已隐藏</div>':''}
        </div>`).join('');
    initLucideIcons();
    document.querySelectorAll('.edit-proj').forEach(b=>b.addEventListener('click',()=>editItem('project',b.dataset.id)));
    document.querySelectorAll('.ai-proj-btn').forEach(b =>
        b.addEventListener('click', () => openAiInline('project', b.dataset.id))
    );
    document.querySelectorAll('.hide-proj').forEach(b=>b.addEventListener('click',()=>{const it=resumeData.project.find(i=>i.id===b.dataset.id);if(it){it.hidden=!it.hidden;markDirty();renderProject();showToast(it.hidden?'已隐藏':'已显示');}}));
    document.querySelectorAll('.del-proj').forEach(b=>b.addEventListener('click',()=>{if(confirm('确定删除？')){resumeData.project=resumeData.project.filter(i=>i.id!==b.dataset.id);markDirty();renderProject();showToast('已删除');}}));
}

function renderCert() {
    const skills = resumeData.other.filter(i => i.type === 'skill');
    const certs = sortByDate(resumeData.other.filter(i => i.type !== 'skill'));

    var html = '';

    // 技能标签区
    if (skills.length) {
        html += '<div class="item-card" style="border-style:dashed;"><div class="item-header"><div class="item-title">技能</div></div>';
        html += '<div style="display:flex;flex-wrap:wrap;gap:6px;margin-top:8px;">';
        skills.forEach(function(s) {
            html += '<span class="skill-tag-inline">' + escapeHtml(s.title)
                + '<span style="margin-left:6px;display:inline-flex;gap:2px;">'
                + '<i data-lucide="pencil" style="width:11px;height:11px;cursor:pointer;color:#9ca3af;" onclick="editItem(\'other\',\'' + s.id + '\')"></i>'
                + (s.hidden ? '<i data-lucide="eye" style="width:11px;height:11px;cursor:pointer;color:#9ca3af;" onclick="var it=resumeData.other.find(function(i){return i.id===\'' + s.id + '\'});if(it){it.hidden=false;markDirty();renderCert();}"></i>' : '<i data-lucide="eye-off" style="width:11px;height:11px;cursor:pointer;color:#9ca3af;" onclick="var it=resumeData.other.find(function(i){return i.id===\'' + s.id + '\'});if(it){it.hidden=true;markDirty();renderCert();}"></i>')
                + '<i data-lucide="trash-2" style="width:11px;height:11px;cursor:pointer;color:#ef4444;" onclick="if(confirm(\'确定删除？\')){resumeData.other=resumeData.other.filter(function(i){return i.id!==\'' + s.id + '\'});markDirty();renderCert();}"></i>'
                + '</span></span>';
        });
        html += '</div>';
        if (skills.some(function(s) { return s.hidden; })) html += '<div class="hidden-badge" style="margin-top:6px;"><i data-lucide="eye-off" style="width:11px;height:11px;"></i>部分条目已隐藏</div>';
        html += '</div>';
    }

    // 证书列表
    certs.forEach(function(item) {
        html += '<div class="item-card" data-id="' + item.id + '">'
            + '<div class="item-header"><div>'
            + '<div class="item-title">' + escapeHtml(item.title) + '</div>'
            + (item.date ? '<div class="item-meta">' + item.date + '</div>' : '')
            + '</div><div class="card-actions">'
            + '<button class="card-action-btn edit-cert" data-id="' + item.id + '"><i data-lucide="pencil"></i>编辑</button>'
            + '<button class="card-action-btn hide-cert" data-id="' + item.id + '"><i data-lucide="' + (item.hidden ? 'eye' : 'eye-off') + '"></i>' + (item.hidden ? '显示' : '隐藏') + '</button>'
            + '<button class="card-action-btn danger del-cert" data-id="' + item.id + '"><i data-lucide="trash-2"></i>删除</button>'
            + '</div></div>'
            + (item.hidden ? '<div class="hidden-badge"><i data-lucide="eye-off" style="width:11px;height:11px;"></i>此条目已隐藏</div>' : '')
            + '</div>';
    });

    if (!skills.length && !certs.length) {
        html = '<div class="empty-state" style="padding:36px 20px;text-align:center;">'
            + '<i data-lucide="award" style="width:40px;height:40px;color:var(--gray-300);display:block;margin:0 auto 10px;"></i>'
            + '<div style="color:var(--gray-500);font-size:13px;">暂未添加证书或技能</div></div>';
    }

    document.getElementById('otherList').innerHTML = html;
    initLucideIcons();

    // 绑定证书卡片的事件
    document.querySelectorAll('.edit-cert').forEach(function(b) { b.addEventListener('click', function() { editItem('other', b.dataset.id); }); });
    document.querySelectorAll('.hide-cert').forEach(function(b) { b.addEventListener('click', function() { var it = resumeData.other.find(function(i) { return i.id === b.dataset.id; }); if (it) { it.hidden = !it.hidden; markDirty(); renderCert(); showToast(it.hidden ? '已隐藏' : '已显示'); } }); });
    document.querySelectorAll('.del-cert').forEach(function(b) { b.addEventListener('click', function() { if (confirm('确定删除？')) { resumeData.other = resumeData.other.filter(function(i) { return i.id !== b.dataset.id; }); markDirty(); renderCert(); showToast('已删除'); } }); });
}

function renderAllEditor() { renderBasic(); renderEducation(); renderWork(); renderProject(); renderCert(); initDateYearClamp(); }

let currentEditType=null, currentEditId=null;
let modalConfirmHandler=null;

function editItem(type, id) {
    currentEditType=type; currentEditId=id;
    const item=resumeData[type].find(i=>i.id===id); if(!item) return;
    showEditorModal(type, item);
}

// ── 学历保存 + 保存后提醒逻辑 ──
function _doSaveEdu(item, isEdit, school, major, savedEduType, savedDegreeName, startMonth, endMonth) {
    const modal = document.getElementById('resumeEditorModal');
    const degreeVal = savedDegreeName || savedEduType;
    const newItem = {
        id: item ? item.id : guid(),
        school, major,
        eduType: savedEduType,
        degreeName: savedDegreeName,
        degree: degreeVal,
        startDate: startMonth,   // yyyy-mm  (native month input)
        endDate: endMonth,
        courses: document.getElementById('mCourses') ? document.getElementById('mCourses').value : (item ? item.courses : ''),
        gpa:     document.getElementById('mGpa')     ? document.getElementById('mGpa').value     : (item ? item.gpa : ''),
        experience: document.getElementById('mExperience') ? document.getElementById('mExperience').value : (item ? item.experience : ''),
        hidden: item ? item.hidden : false
    };
    if (isEdit) Object.assign(item, newItem); else resumeData.education.push(newItem);
    markDirty(); renderEducation(); modal.classList.remove('active');
    showToast(isEdit ? '修改成功' : '添加成功');
    // 新增时：若为硕/博，询问是否补录前置学历
    if (!isEdit) {
        if (savedEduType === '硕士研究生' && !resumeData.education.find(i => i.eduType === '本科')) {
            _showEduFollowPrompt('是否同时添加本科学历？', '您刚刚添加了硕士研究生学历，补充本科学历可让简历更加完整。', '添加本科学历', '本科');
        } else if (savedEduType === '博士研究生' && !resumeData.education.find(i => i.eduType === '硕士研究生')) {
            _showEduFollowPrompt('是否同时添加硕士研究生学历？', '您刚刚添加了博士研究生学历，补充硕士研究生学历可让简历更加完整。', '添加硕士学历', '硕士研究生');
        }
    }
}
function _showEduFollowPrompt(heading, body, confirmLabel, presetType) {
    setTimeout(() => {
        const ov = document.createElement('div');
        ov.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,0.45);z-index:10000;display:flex;align-items:center;justify-content:center;backdrop-filter:blur(4px);';
        ov.innerHTML = `<div style="background:#fff;border-radius:18px;width:min(420px,92vw);padding:28px 24px;box-shadow:0 20px 40px rgba(0,0,0,0.15);">
            <div style="font-size:24px;margin-bottom:12px;">🎓</div>
            <h3 style="font-size:1rem;font-weight:700;margin-bottom:10px;color:#1f2937;">${heading}</h3>
            <p style="font-size:13px;color:#6b7280;margin-bottom:22px;line-height:1.6;">${body}</p>
            <div style="display:flex;gap:10px;justify-content:flex-end;">
                <button id="_fpCancel" style="padding:9px 20px;border:1px solid #d1d5db;border-radius:10px;background:#fff;cursor:pointer;font-size:0.875rem;color:#374151;">暂不添加</button>
                <button id="_fpConfirm" style="padding:9px 20px;border:none;border-radius:10px;background:#2563eb;color:#fff;cursor:pointer;font-size:0.875rem;font-weight:600;">${confirmLabel}</button>
            </div>
        </div>`;
        document.body.appendChild(ov);
        ov.querySelector('#_fpCancel').addEventListener('click', () => ov.remove());
        ov.querySelector('#_fpConfirm').addEventListener('click', () => { ov.remove(); showEditorModal('education', null, presetType); });
    }, 350);
}

function showEditorModal(type, item=null, presetEduType='') {
    const modal=document.getElementById('resumeEditorModal');
    const title=document.getElementById('resumeModalTitle');
    const body=document.getElementById('resumeModalBody');
    const isEdit=!!item;
    if(type==='education') {
        title.innerText=isEdit?'编辑学历':'添加学历';
        const eduTypeOptions = ['本科','硕士研究生','博士研究生','其他'];
        const eduTypeOpts = `<option value="">请选择</option>` + eduTypeOptions.map(d => `<option value="${d}" ${(item ? item.eduType : presetEduType)===d?'selected':''}>${d}</option>`).join('');
        const currentDegreeName = item ? escapeHtml(item.degreeName||item.degree||'') : '';
        const rawStart = item ? (item.startDate||'') : '';
        const rawEnd   = item ? (item.endDate||'')   : '';
        // Normalise legacy yyyy-01 (year-only placeholder) → empty so month picker is blank
        const normStart = rawStart && /^\d{4}-01$/.test(rawStart) ? '' : rawStart;
        const normEnd   = rawEnd   && /^\d{4}-01$/.test(rawEnd)   ? '' : rawEnd;
        body.innerHTML=`
            <style>.edu-field-error{border-color:var(--error-500)!important}.edu-hint{font-size:11px;color:var(--error-500);margin-top:3px;display:none}</style>
            <div class="modal-form-group">
                <label>学校 <span style="color:var(--error-500)">*</span></label>
                <input id="mSchool" value="${item?escapeHtml(item.school):''}">
                <div class="edu-hint" id="hSchool">请填写学校名称</div>
            </div>
            <div class="modal-form-group">
                <label>专业 <span style="color:var(--error-500)">*</span></label>
                <input id="mMajor" value="${item?escapeHtml(item.major):''}">
                <div class="edu-hint" id="hMajor">请填写专业名称</div>
            </div>
            <div class="modal-form-group">
                <label>学历 <span style="color:var(--error-500)">*</span></label>
                <select id="mEduType">${eduTypeOpts}</select>
                <div class="edu-hint" id="hEduType">请选择学历类型</div>
            </div>
            <div class="modal-form-group">
                <label>学位 <span style="color:var(--error-500)">*</span></label>
                <input id="mDegreeName" value="${currentDegreeName}" placeholder="例如：工学硕士、理学学士">
                <div class="edu-hint" id="hDegreeName">请填写学位名称</div>
            </div>
            <div class="modal-form-group">
                <label>就读时间 <span style="color:var(--error-500)">*</span></label>
                <div style="display:flex;gap:8px;align-items:center;">
                    <input id="mStartMonth" type="month" value="${normStart}" style="flex:1;">
                    <span style="color:var(--gray-400);font-size:13px;flex-shrink:0;">—</span>
                    <input id="mEndMonth" type="month" value="${normEnd}" style="flex:1;">
                </div>
                <div class="edu-hint" id="hMonths">请填写完整的起止年月</div>
            </div>
            <div class="modal-form-group"><label>GPA / 绩点</label><input id="mGpa" value="${item?escapeHtml(item.gpa):''}" placeholder="例如：3.8 / 4.0"></div>
            <div style="height:20px;"></div>
            <div class="modal-form-group"><label>主修课程</label><textarea id="mCourses" style="resize:vertical;min-height:64px;">${item?escapeHtml(item.courses):''}</textarea></div>
            <div class="modal-form-group"><label>在校经历</label><textarea id="mExperience">${item?escapeHtml(item.experience):''}</textarea></div>`;
        // Clear error hints on input
        ['mSchool','mMajor','mDegreeName'].forEach(fid => {
            document.getElementById(fid).addEventListener('input', () => {
                document.getElementById(fid).classList.remove('edu-field-error');
                const hid = {mSchool:'hSchool',mMajor:'hMajor',mDegreeName:'hDegreeName'}[fid];
                document.getElementById(hid).style.display='none';
            });
        });
        document.getElementById('mEduType').addEventListener('change', () => {
            document.getElementById('mEduType').classList.remove('edu-field-error');
            document.getElementById('hEduType').style.display='none';
        });
        ['mStartMonth','mEndMonth'].forEach(fid => {
            document.getElementById(fid).addEventListener('change', () => {
                document.getElementById('mStartMonth').classList.remove('edu-field-error');
                document.getElementById('mEndMonth').classList.remove('edu-field-error');
                document.getElementById('hMonths').style.display='none';
            });
        });
        modalConfirmHandler=()=>{
            // ── 必填校验 ──
            let valid = true;
            const school        = document.getElementById('mSchool').value.trim();
            const major         = document.getElementById('mMajor').value.trim();
            const savedEduType  = document.getElementById('mEduType').value;
            const savedDegreeName = document.getElementById('mDegreeName').value.trim();
            const startMonth    = document.getElementById('mStartMonth').value;
            const endMonth      = document.getElementById('mEndMonth').value;
            if (!school)         { document.getElementById('mSchool').classList.add('edu-field-error'); document.getElementById('hSchool').style.display='block'; valid=false; }
            if (!major)          { document.getElementById('mMajor').classList.add('edu-field-error'); document.getElementById('hMajor').style.display='block'; valid=false; }
            if (!savedEduType)   { document.getElementById('mEduType').classList.add('edu-field-error'); document.getElementById('hEduType').style.display='block'; valid=false; }
            if (!savedDegreeName){ document.getElementById('mDegreeName').classList.add('edu-field-error'); document.getElementById('hDegreeName').style.display='block'; valid=false; }
            if (!startMonth || !endMonth) {
                if (!startMonth) document.getElementById('mStartMonth').classList.add('edu-field-error');
                if (!endMonth)   document.getElementById('mEndMonth').classList.add('edu-field-error');
                document.getElementById('hMonths').style.display='block'; valid=false;
            }
            if (!valid) return;
            // ── 唯一性约束（本科/硕士/博士各限一条，"其他"不限）──
            const limitedTypes = ['本科','硕士研究生','博士研究生'];
            if (limitedTypes.includes(savedEduType)) {
                const duplicate = resumeData.education.find(i => i.eduType === savedEduType && (!item || i.id !== item.id));
                if (duplicate) {
                    const ovOverlay = document.createElement('div');
                    ovOverlay.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,0.45);z-index:10000;display:flex;align-items:center;justify-content:center;backdrop-filter:blur(4px);';
                    ovOverlay.innerHTML = `<div style="background:#fff;border-radius:18px;width:min(400px,92vw);padding:28px 24px;box-shadow:0 20px 40px rgba(0,0,0,0.15);">
                        <div style="font-size:22px;margin-bottom:12px;">⚠️</div>
                        <h3 style="font-size:1rem;font-weight:700;margin-bottom:10px;color:#1f2937;">已存在「${savedEduType}」学历</h3>
                        <p style="font-size:13px;color:#6b7280;margin-bottom:20px;line-height:1.6;">每种学历类型只能保留一条记录。<br>确认后，原「${escapeHtml(duplicate.school)}」将被当前记录替换。</p>
                        <div style="display:flex;gap:10px;justify-content:flex-end;">
                            <button id="_ovCancel" style="padding:9px 20px;border:1px solid #d1d5db;border-radius:10px;background:#fff;cursor:pointer;font-size:0.875rem;color:#374151;">取消</button>
                            <button id="_ovConfirm" style="padding:9px 20px;border:none;border-radius:10px;background:#ef4444;color:#fff;cursor:pointer;font-size:0.875rem;font-weight:600;">覆盖原记录</button>
                        </div>
                    </div>`;
                    document.body.appendChild(ovOverlay);
                    ovOverlay.querySelector('#_ovCancel').addEventListener('click', () => ovOverlay.remove());
                    ovOverlay.querySelector('#_ovConfirm').addEventListener('click', () => {
                        ovOverlay.remove();
                        resumeData.education = resumeData.education.filter(i => i.id !== duplicate.id);
                        _doSaveEdu(item, isEdit, school, major, savedEduType, savedDegreeName, startMonth, endMonth);
                    });
                    return;
                }
            }
            _doSaveEdu(item, isEdit, school, major, savedEduType, savedDegreeName, startMonth, endMonth);
        };
    } else if(type==='work') {
        title.innerText=isEdit?'编辑工作经历':'添加工作经历';
        body.innerHTML=`
            <div class="modal-form-group"><label>公司名称 *</label><input id="mCompany" value="${item?escapeHtml(item.company):''}"></div>
            <div class="modal-form-group"><label>岗位 *</label><input id="mPosition" value="${item?escapeHtml(item.position):''}"></div>
            <div class="modal-form-group"><label>工作时间</label><div style="display:flex;gap:8px;"><input id="mStartDate" type="month" value="${item?item.startDate||'':''}"><input id="mEndDate" type="month" value="${item?item.endDate||'':''}"></div></div>
            <div class="modal-form-group"><label style="display:flex;align-items:center;gap:8px;cursor:pointer;"><input type="checkbox" id="mIntern" ${item&&item.intern?'checked':''} style="width:auto;"> 实习经历</label></div>
            <div class="modal-form-group"><label>工作内容</label><textarea id="mWorkContent" style="min-height:120px;"></textarea></div>`;
        if(item) document.getElementById('mWorkContent').value=item.workContent||(item.duties?(item.duties+(item.achievements?'\n\n'+item.achievements:'')):'');
        modalConfirmHandler=()=>{
            const newItem={id:item?item.id:guid(),company:document.getElementById('mCompany').value,position:document.getElementById('mPosition').value,startDate:document.getElementById('mStartDate').value,endDate:document.getElementById('mEndDate').value,intern:document.getElementById('mIntern').checked,workContent:document.getElementById('mWorkContent').value,hidden:item?item.hidden:false};
            if(isEdit)Object.assign(item,newItem); else resumeData.work.push(newItem);
            markDirty(); renderWork(); modal.classList.remove('active'); showToast(isEdit?'修改成功':'添加成功');
        };
    } else if(type==='project') {
        title.innerText=isEdit?'编辑项目经历':'添加项目经历';
        body.innerHTML=`
            <div class="modal-form-group"><label>项目名称 *</label><input id="mName" value="${item?escapeHtml(item.name):''}"></div>
            <div class="modal-form-group"><label>角色 *</label><input id="mRole" value="${item?escapeHtml(item.role):''}"></div>
            <div class="modal-form-group"><label>项目时间</label><div style="display:flex;gap:8px;"><input id="mStartDate" type="month" value="${item?item.startDate||'':''}"><input id="mEndDate" type="month" value="${item?item.endDate||'':''}"></div></div>
            <div class="modal-form-group"><label>项目描述</label><textarea id="mDescription">${item?escapeHtml(item.description):''}</textarea></div>
            <div class="modal-form-group"><label>个人职责</label><textarea id="mResponsibility">${item?escapeHtml(item.responsibility):''}</textarea></div>
            <div class="modal-form-group"><label>项目成果</label><textarea id="mResult">${item?escapeHtml(item.result):''}</textarea></div>`;
        modalConfirmHandler=()=>{
            const newItem={id:item?item.id:guid(),name:document.getElementById('mName').value,role:document.getElementById('mRole').value,startDate:document.getElementById('mStartDate').value,endDate:document.getElementById('mEndDate').value,description:document.getElementById('mDescription').value,responsibility:document.getElementById('mResponsibility').value,result:document.getElementById('mResult').value,hidden:item?item.hidden:false};
            if(isEdit)Object.assign(item,newItem); else resumeData.project.push(newItem);
            markDirty(); renderProject(); modal.classList.remove('active'); showToast(isEdit?'修改成功':'添加成功');
        };
    } else if(type==='other') {
        const currentType = item ? (item.type || 'cert') : 'cert';
        title.innerText=isEdit?'编辑':'添加';
        body.innerHTML=`
            <div class="modal-form-group"><label>类型</label><select id="mCertType"><option value="cert" ${currentType==='cert'?'selected':''}>证书</option><option value="skill" ${currentType==='skill'?'selected':''}>技能</option></select></div>
            <div class="modal-form-group"><label>名称 *</label><input id="mCertTitle" value="${item?escapeHtml(item.title):''}" placeholder="${currentType==='skill'?'例如：TypeScript、React':'例如：英语 CET-6'}"></div>
            <div class="modal-form-group" id="mCertDateGroup" style="${currentType==='skill'?'display:none':''}"><label>获得时间</label><input id="mCertDate" type="month" value="${item?item.date||'':''}"></div>`;
        // 类型切换显隐日期
        setTimeout(() => {
            document.getElementById('mCertType').addEventListener('change', function() {
                document.getElementById('mCertDateGroup').style.display = this.value === 'skill' ? 'none' : '';
            });
        }, 0);
        modalConfirmHandler=()=>{
            const itemType = document.getElementById('mCertType').value;
            const newItem={id:item?item.id:guid(),type:itemType,title:document.getElementById('mCertTitle').value,date:itemType==='skill'?'':document.getElementById('mCertDate').value,hidden:item?item.hidden:false};
            if(isEdit)Object.assign(item,newItem); else resumeData.other.push(newItem);
            markDirty(); renderCert(); modal.classList.remove('active'); showToast(isEdit?'修改成功':'添加成功');
        };
    }
    modal.classList.add('active');
    initDateYearClamp();
}
let editorDirty = false;
let _resumeSnapshot = null; // deep copy of resumeData at editor entry, for discard
let _editorSkipReset = false; // AI 工作区完毕后跳过 initEditor 重置
function markDirty() { editorDirty = true; }

// 离开编辑器时的保存确认
let _pendingBackAction = null;
function promptSaveBeforeLeave(onContinue) {
    if (!editorDirty) { onContinue(); return; }
    _pendingBackAction = onContinue;
    document.getElementById('savePromptModal').classList.add('active');
}
document.getElementById('savePromptSave').addEventListener('click', () => {
    document.getElementById('savePromptModal').classList.remove('active');
    saveBasicData();
    // 保存到对应简历对象
    if (editingOnlineResumeId) {
        const res = onlineResumes.find(r => r.id === editingOnlineResumeId);
        if (res) { res.data = resumeData; res.lastModified = new Date().toISOString().slice(0,10); }
        try { localStorage.setItem('online_resume_' + editingOnlineResumeId, JSON.stringify(resumeData)); } catch(e) {}
    } else if (editingResumeId) {
        const res = customResumes.find(r => r.id === editingResumeId);
        if (res) { res.data = resumeData; }
    }
    editorDirty = false;
    _resumeSnapshot = JSON.stringify(resumeData);
    persist();
    showToast('已保存');
    if (_pendingBackAction) { _pendingBackAction(); _pendingBackAction = null; }
});
document.getElementById('savePromptDiscard').addEventListener('click', () => {
    document.getElementById('savePromptModal').classList.remove('active');
    // Restore original data from snapshot to discard all unsaved changes
    if (_resumeSnapshot) {
        const restored = JSON.parse(_resumeSnapshot);
        if (editingOnlineResumeId) {
            const res = onlineResumes.find(r => r.id === editingOnlineResumeId);
            if (res) res.data = restored;
        } else if (editingResumeId) {
            const res = customResumes.find(r => r.id === editingResumeId);
            if (res) res.data = restored;
        }
        resumeData = restored;
        // Also revert localStorage for online resumes
        if (editingOnlineResumeId) {
            try { localStorage.setItem('online_resume_' + editingOnlineResumeId, JSON.stringify(restored)); } catch(e) {}
        }
    }
    editorDirty = false;
    _resumeSnapshot = null;
    if (_pendingBackAction) { _pendingBackAction(); _pendingBackAction = null; }
});
// 取消 — 关闭弹窗，留在编辑器
document.getElementById('savePromptCancel').addEventListener('click', () => {
    document.getElementById('savePromptModal').classList.remove('active');
    _pendingBackAction = null;
});
// 点击遮罩层外部 → 等同于取消
document.getElementById('savePromptModal').addEventListener('click', (e) => {
    if (e.target === document.getElementById('savePromptModal')) {
        document.getElementById('savePromptModal').classList.remove('active');
        _pendingBackAction = null;
    }
});
// ESC 关闭
document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && document.getElementById('savePromptModal').classList.contains('active')) {
        document.getElementById('savePromptModal').classList.remove('active');
        _pendingBackAction = null;
    }
});

function saveBasicData() {
    const b=resumeData.basic;
    b.name=document.getElementById('basicName')?.value||'';
    b.gender=document.getElementById('basicGender')?.value||'';
    b.birth=document.getElementById('basicBirth')?.value||'';
    b.hometown=document.getElementById('basicHometown')?.value||'';
    b.residence=document.getElementById('basicResidence')?.value||'';
    b.phone=document.getElementById('basicPhone')?.value||'';
    b.email=document.getElementById('basicEmail')?.value||'';
    b.jobTarget=document.getElementById('basicJobTarget')?.value||'';
    b.workYears=document.getElementById('basicWorkYears')?.value||'';
    b.status=document.getElementById('basicStatus')?.value||'';
    b.ethnicity=document.getElementById('basicEthnicity')?.value||'';
    b.politicalStatus=document.getElementById('basicPoliticalStatus')?.value||'';
}

// 编辑器按钮
document.getElementById('editorBackBtn').addEventListener('click', () => {
    promptSaveBeforeLeave(() => {
        editingResumeId = null;
        editingOnlineResumeId = null;
        navigateTo('resume-mgr');
    });
});

// 简历重命名
document.getElementById('editorRenameBtn').addEventListener('click', () => {
    // 判断当前编辑的是哪种简历
    let currentRes = null;
    let resType = null;
    if (editingOnlineResumeId) {
        currentRes = onlineResumes.find(r => r.id === editingOnlineResumeId);
        resType = 'online';
    } else if (editingResumeId) {
        currentRes = customResumes.find(r => r.id === editingResumeId);
        resType = 'custom';
    }
    if (!currentRes) return;

    const overlay = document.createElement('div');
    overlay.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,0.45);z-index:9999;display:flex;align-items:center;justify-content:center;backdrop-filter:blur(4px);';
    overlay.innerHTML = `<div style="background:#fff;border-radius:18px;width:min(380px,92vw);padding:24px;box-shadow:0 20px 40px rgba(0,0,0,0.15);">
        <h3 style="font-size:1rem;font-weight:700;margin-bottom:14px;">重命名简历</h3>
        <input id="renameInput" type="text" value="${escapeHtml(currentRes.name)}" style="width:100%;padding:10px 14px;border:1.5px solid #d1d5db;border-radius:10px;font-size:0.9rem;outline:none;margin-bottom:4px;" />
        <div id="renameError" style="font-size:12px;color:#ef4444;min-height:16px;margin-bottom:14px;"></div>
        <div style="display:flex;gap:10px;justify-content:flex-end;">
            <button id="renameCancelBtn" style="padding:8px 18px;border:1px solid #d1d5db;border-radius:9px;background:#fff;cursor:pointer;font-size:0.875rem;">取消</button>
            <button id="renameConfirmBtn" style="padding:8px 18px;border:none;border-radius:9px;background:#2563eb;color:#fff;cursor:pointer;font-size:0.875rem;font-weight:500;">确认</button>
        </div>
    </div>`;
    document.body.appendChild(overlay);
    const input = overlay.querySelector('#renameInput');
    const errorEl = overlay.querySelector('#renameError');
    input.focus();
    input.select();

    overlay.querySelector('#renameCancelBtn').addEventListener('click', () => overlay.remove());
    overlay.querySelector('#renameConfirmBtn').addEventListener('click', () => {
        const newName = input.value.trim();
        if (!newName) { input.style.borderColor='#ef4444'; errorEl.textContent='名称不能为空'; return; }
        if (newName === currentRes.name) { overlay.remove(); return; }
        // 检查全局重名（在线简历 + 定制版简历）
        const allNames = [...onlineResumes.map(r => r.name), ...customResumes.map(r => r.name)];
        if (allNames.includes(newName)) { input.style.borderColor='#ef4444'; errorEl.textContent='该名称已被其他简历使用，请换一个'; return; }
        // 更新名称
        currentRes.name = newName;
        document.getElementById('editorTitleBadge').textContent = newName;
        overlay.remove();
        showToast(`已重命名为「${newName}」`);
    });
    input.addEventListener('input', () => { input.style.borderColor='#d1d5db'; errorEl.textContent=''; });
    overlay.addEventListener('click', e => { if (e.target === overlay) overlay.remove(); });
    input.addEventListener('keydown', e => { if (e.key === 'Enter') overlay.querySelector('#renameConfirmBtn').click(); if (e.key === 'Escape') overlay.remove(); });
});
document.getElementById('addEduBtn').addEventListener('click', () => showEditorModal('education', null));
document.getElementById('addWorkBtn').addEventListener('click', () => showEditorModal('work', null));
document.getElementById('addProjectBtn').addEventListener('click', () => showEditorModal('project', null));
document.getElementById('addCertBtn').addEventListener('click', () => showEditorModal('other', null));
document.getElementById('saveAllBtn').addEventListener('click', () => {
    saveBasicData();
    if (editingOnlineResumeId) {
        const res = onlineResumes.find(r => r.id === editingOnlineResumeId);
        if (res) { res.data = resumeData; res.lastModified = new Date().toISOString().slice(0,10); }
        try { localStorage.setItem('online_resume_' + editingOnlineResumeId, JSON.stringify(resumeData)); } catch(e) {}
    } else if (editingResumeId) {
        const res = customResumes.find(r => r.id === editingResumeId);
        if (res) res.data = resumeData;
    }
    editorDirty = false;
    _resumeSnapshot = JSON.stringify(resumeData); // update snapshot to saved state
    showToast('全部数据已保存');
});
document.getElementById('exportEditorPdfBtn').addEventListener('click', () => exportResumePdf());
document.getElementById('uploadAvatarBtn').addEventListener('click', () => document.getElementById('avatarUpload').click());
document.getElementById('avatarUpload').addEventListener('change', e => {
    if(e.target.files&&e.target.files[0]){const r=new FileReader();r.onload=ev=>{document.getElementById('avatarImg').src=ev.target.result;resumeData.basic.avatarBase64=ev.target.result;};r.readAsDataURL(e.target.files[0]);}
});
document.getElementById('clearAvatarBtn').addEventListener('click', () => { document.getElementById('avatarImg').src="data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='120' height='120' viewBox='0 0 24 24' fill='%239ca3af'%3E%3Cpath d='M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z'/%3E%3C/svg%3E"; resumeData.basic.avatarBase64=null; });
document.querySelectorAll('.outline-nav a').forEach(link => {
    link.addEventListener('click', e => { e.preventDefault(); const sec=document.getElementById(link.dataset.section); if(sec){const panel=document.getElementById('editorContentPanel');panel.scrollTo({top:sec.offsetTop-20,behavior:'smooth'});} });
});
document.getElementById('resumeModalCancelBtn').addEventListener('click', () => document.getElementById('resumeEditorModal').classList.remove('active'));
document.getElementById('resumeModalConfirmBtn').addEventListener('click', () => { if(modalConfirmHandler) modalConfirmHandler(); });
document.getElementById('resumeEditorModal').addEventListener('click', e => { if(e.target===document.getElementById('resumeEditorModal')) document.getElementById('resumeEditorModal').classList.remove('active'); });

// 初始化编辑器数据（读取localStorage）
function initEditor() {
    if (_editorSkipReset) {
        _editorSkipReset = false;
        if (editingOnlineResumeId) {
            const res = onlineResumes.find(r => r.id === editingOnlineResumeId);
            if (res) document.getElementById('editorTitleBadge').textContent = res.name;
        }
        renderAllEditor();
        return;
    }
    editorDirty = false;
    if (editingOnlineResumeId) {
        // 编辑在线简历
        const res = onlineResumes.find(r => r.id === editingOnlineResumeId);
        if (res) {
            resumeData = JSON.parse(JSON.stringify(res.data));
            res.data = resumeData;
            document.getElementById('editorTitleBadge').textContent = res.name;
        }
    } else if (editingResumeId) {
        // 编辑定制版
        const res = customResumes.find(r => r.id === editingResumeId);
        if (res) {
            resumeData = JSON.parse(JSON.stringify(res.data || emptyResumeData()));
            res.data = resumeData;
            document.getElementById('editorTitleBadge').textContent = res.name;
        }
    } else {
        // 兜底（不应进入，但防御性保留）
        document.getElementById('editorTitleBadge').textContent = '在线简历';
    }
    // Snapshot for discard: deep copy of the original state
    _resumeSnapshot = JSON.stringify(resumeData);
    renderAllEditor();
    // 监听表单变化标记脏状态
    setTimeout(() => {
        document.querySelectorAll('#editorContentPanel input, #editorContentPanel select, #editorContentPanel textarea')
            .forEach(el => el.addEventListener('change', markDirty));
    }, 100);
}
// 当导航到编辑器时初始化
const _origNavigateTo = navigateTo;
function navigateTo(pageId) {
    document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
    const target = document.getElementById('page-' + pageId);
    if (target) target.classList.add('active');
    document.querySelectorAll('.nav-links a').forEach(a => {
        a.classList.toggle('active', a.dataset.page === pageId);
    });
    // 清除导航高亮（编辑器子页）
    if (pageId === 'resume-editor') {
        document.querySelectorAll('.nav-links a').forEach(a=>a.classList.remove('active'));
        document.querySelector('.nav-links a[data-page="resume-mgr"]').classList.add('active');
    }
    currentPage = pageId;
    if (pageId === 'home') renderHome();
    if (pageId === 'resume-mgr') renderResumeMgr();
    if (pageId === 'delivery') renderDeliveryView();
    if (pageId === 'calendar') { renderCalendar(); updateTodayReminders(); }
    if (pageId === 'resume-editor') initEditor();
}

// 编辑器顶部「AI优化」按钮
document.getElementById('editorAiOptBtn').addEventListener('click', () => {
    if (!editingOnlineResumeId) { showToast('请先打开一份在线简历', 'error'); return; }
    openAiWorkspace(editingOnlineResumeId);
});

