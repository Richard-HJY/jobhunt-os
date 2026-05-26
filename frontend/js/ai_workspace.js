// ============================================================
// AI 批量优化工作区
// ============================================================
let _wsResumeId = null;
let _workspaceApplied = false;
let _wsFromEditor = false;  // 是否从编辑器内打开

async function openAiWorkspace(resumeId) {
    const configured = await checkAiConfigured();
    if (!configured) { openSettingsPanel(); showToast('请先配置 AI 服务', 'error'); return; }

    _wsResumeId = resumeId;
    const res  = onlineResumes.find(r => r.id === resumeId);
    if (!res) return;
    const rd   = res.data || {};

    document.getElementById('aiWorkspaceResumeName').textContent = `— ${res.name}`;
    _workspaceApplied = false;

    // 是否从编辑器内打开：resumeData 已指向这份简历的数据
    _wsFromEditor = !!(editingOnlineResumeId === resumeId && resumeData === res.data);
    if (!_wsFromEditor) {
        // 从简历卡片打开：加载数据到编辑器工作区，拍快照作为放弃基准
        editingOnlineResumeId = resumeId;
        editingResumeId = null;
        resumeData = JSON.parse(JSON.stringify(rd));
        document.getElementById('editorTitleBadge').textContent = res.name;
        editorDirty = false;
        _resumeSnapshot = JSON.stringify(resumeData);
    }
    // 从编辑器内打开时，resumeData / _resumeSnapshot / editorDirty 保持原状

    // 构建范围勾选列表
    const scopeList = document.getElementById('aiScopeList');
    const items = [];
    (rd.work || []).forEach(w => items.push({ type:'work', id: w.id, label: `${w.company} · ${w.position}` }));
    (rd.project || []).forEach(p => items.push({ type:'project', id: p.id, label: p.name }));
    scopeList.innerHTML = items.map(it => `
        <label style="display:flex;align-items:center;gap:5px;font-size:13px;cursor:pointer;
               background:var(--gray-50);border:1px solid var(--gray-200);border-radius:var(--radius-md);
               padding:4px 10px;">
            <input type="checkbox" class="ws-scope-chk" data-type="${it.type}" data-id="${it.id}" checked>
            <span>${escapeHtml(it.label)}</span>
        </label>`).join('');

    updateOriginalPreview(rd);

    // 全选联动
    document.getElementById('scopeAll').checked = true;
    document.getElementById('scopeAll').onchange = function() {
        document.querySelectorAll('.ws-scope-chk').forEach(c => c.checked = this.checked);
        updateOriginalPreview(rd);
    };
    document.querySelectorAll('.ws-scope-chk').forEach(c =>
        c.addEventListener('change', () => {
            updateOriginalPreview(rd);
            const allChecked = [...document.querySelectorAll('.ws-scope-chk')].every(ch => ch.checked);
            document.getElementById('scopeAll').checked = allChecked;
        }));

    // 清空结果区
    document.getElementById('aiResultArea').innerHTML = `
        <div style="color:var(--gray-400);font-size:13px;text-align:center;padding:40px 0;">
            <i data-lucide="sparkles" style="width:32px;height:32px;display:block;margin:0 auto 12px;opacity:.3;"></i>
            勾选条目并点击「开始优化」</div>`;
    document.getElementById('applyAllAiBtn').style.display = 'none';

    document.getElementById('aiWorkspacePanel').classList.add('active');
    lucide.createIcons();
}

function updateOriginalPreview(rd) {
    const checked = [...document.querySelectorAll('.ws-scope-chk:checked')];
    let html = '';
    checked.forEach(c => {
        if (c.dataset.type === 'work') {
            const w = (rd.work||[]).find(x => x.id === c.dataset.id);
            if (w) html += `<div class="preview-block"><strong>${escapeHtml(w.company)} · ${escapeHtml(w.position)}</strong><br>${escapeHtml((w.workContent||w.duties||'').replace(/\n/g, '<br>'))}</div>`;
        } else {
            const p = (rd.project||[]).find(x => x.id === c.dataset.id);
            if (p) {
                html += `<div class="preview-block"><strong>${escapeHtml(p.name)}</strong>`;
                if (p.description)   html += `<br><span style="color:var(--gray-400);font-size:12px;">项目描述</span><br>${escapeHtml(p.description).replace(/\n/g, '<br>')}`;
                if (p.responsibility) html += `<br><span style="color:var(--gray-400);font-size:12px;">个人职责</span><br>${escapeHtml(p.responsibility).replace(/\n/g, '<br>')}`;
                if (p.result)         html += `<br><span style="color:var(--gray-400);font-size:12px;">项目成果</span><br>${escapeHtml(p.result).replace(/\n/g, '<br>')}`;
                html += `</div>`;
            }
        }
    });
    document.getElementById('aiOriginalPreview').innerHTML = html || '<span style="color:var(--gray-400);font-size:13px;">未选中任何条目</span>';
}

// Tab 切换
document.querySelectorAll('#aiModeTabGroup .tab-btn').forEach(btn => {
    btn.addEventListener('click', () => {
        document.querySelectorAll('#aiModeTabGroup .tab-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        const isJd = btn.dataset.mode === 'jd';
        document.getElementById('aiCustomInstruction').style.display = isJd ? 'none' : '';
        document.getElementById('aiJdInput').style.display = isJd ? '' : 'none';
    });
});

// 关闭
function closeAiWorkspace() {
    document.getElementById('aiWorkspacePanel').classList.remove('active');
    document.getElementById('aiCustomInstruction').value = '';
    document.getElementById('aiJdInput').value = '';
    // 从卡片进入且有修改 → 跳转到编辑器，保留 dirty 状态让用户审阅保存
    if (!_wsFromEditor && _workspaceApplied) {
        const res = onlineResumes.find(r => r.id === _wsResumeId);
        if (res) {
            res.data = resumeData;
            res.lastModified = new Date().toISOString().slice(0, 10);
        }
        _editorSkipReset = true;
        navigateTo('resume-editor');
    }
}
document.getElementById('closeAiWorkspaceBtn').addEventListener('click', closeAiWorkspace);
document.getElementById('aiWorkspacePanel').addEventListener('click', (e) => {
    if (e.target === document.getElementById('aiWorkspacePanel')) closeAiWorkspace();
});

// 开始优化
document.getElementById('startAiOptimizeBtn').addEventListener('click', async () => {
    const res   = onlineResumes.find(r => r.id === _wsResumeId);
    if (!res) return;
    const rd    = res.data || {};
    const mode  = document.querySelector('#aiModeTabGroup .tab-btn.active').dataset.mode;
    const extra = mode === 'jd'
        ? document.getElementById('aiJdInput').value.trim()
        : document.getElementById('aiCustomInstruction').value.trim();
    const checked = [...document.querySelectorAll('.ws-scope-chk:checked')];
    if (!checked.length) { showToast('请至少勾选一个条目', 'error'); return; }

    const blocks = [];
    checked.forEach(c => {
        if (c.dataset.type === 'work') {
            const w = (rd.work||[]).find(x => x.id === c.dataset.id);
            if (w) blocks.push({ section:'work', id: w.id, label:`${w.company} · ${w.position}`, field:'workContent', original: w.workContent||w.duties||'' });
        } else {
            const p = (rd.project||[]).find(x => x.id === c.dataset.id);
            if (p) blocks.push(
                { section:'project', id: p.id, label: p.name, field:'description',   original: p.description||'' },
                { section:'project', id: p.id, label: p.name, field:'responsibility', original: p.responsibility||'' },
                { section:'project', id: p.id, label: p.name, field:'result',         original: p.result||'' }
            );
        }
    });

    const systemPrompt = `你是一名专业的简历优化顾问。用户将提供若干简历条目，请逐条给出优化后的文本。
严格按照以下 JSON 格式返回，不要任何额外说明：
{"results":[{"id":"...", "field":"...", "optimized":"..."},...]}
其中 id 和 field 与输入完全对应。${mode==='jd' ? '请结合以下岗位描述进行优化：\n'+extra : (extra ? '用户指令：'+extra : '')}`;

    const userContent = blocks.map(b =>
        `{"id":"${b.id}","field":"${b.field}","label":"${b.label}","original":${JSON.stringify(b.original)}}`
    ).join('\n');

    const resultArea = document.getElementById('aiResultArea');
    resultArea.innerHTML = `<div style="text-align:center;padding:40px 0;color:var(--gray-400);">
        <i data-lucide="loader-circle" style="width:24px;height:24px;display:block;margin:0 auto 12px;animation:spin 1s linear infinite;"></i>
        AI 优化中…</div>`;
    lucide.createIcons();

    try {
        const r = await fetch('http://localhost:8000/api/ai/complete', {
            method: 'POST',
            headers: {'Content-Type':'application/json'},
            body: JSON.stringify({ messages: [
                { role:'system', content: systemPrompt },
                { role:'user',   content: userContent }
            ], max_tokens: 3000 })
        });
        const d = await r.json();
        if (!d.ok) { showToast('AI 返回错误：'+d.error, 'error'); return; }
        const parsed = JSON.parse(d.content.replace(/```json|```/g,'').trim());
        renderAiResults(parsed.results, blocks, rd);
    } catch(e) {
        resultArea.innerHTML = `<div style="color:var(--error-600);padding:20px;">解析失败：${e.message}</div>`;
    }
});

function renderAiResults(results, blocks, rd) {
    const resultArea = document.getElementById('aiResultArea');
    const groupMap = {};
    results.forEach(r => {
        const block = blocks.find(b => b.id === r.id && b.field === r.field);
        if (!block) return;
        const key = block.section + '_' + r.id;
        if (!groupMap[key]) groupMap[key] = { section: block.section, id: r.id, label: block.label, fields: [] };
        groupMap[key].fields.push({ field: r.field, optimized: r.optimized, applied: false });
    });

    let html = '';
    Object.values(groupMap).forEach(g => {
        html += `<div class="ai-result-card" data-key="${g.section}_${g.id}">
            <div class="ai-result-card-header">
                <span class="ai-result-tag">${g.section==='work'?'工作经历':'项目经历'}</span>
                <strong>${escapeHtml(g.label)}</strong>
            </div>`;
        g.fields.forEach(f => {
            const fieldLabel = { workContent:'工作内容', description:'项目描述', responsibility:'个人职责', result:'项目成果' }[f.field] || f.field;
            html += `<div class="ai-result-field" data-field="${f.field}">
                <div style="font-size:11px;color:var(--gray-400);margin-bottom:4px;">${fieldLabel}</div>
                <div class="ai-result-text">${escapeHtml(f.optimized)}</div>
                <div style="display:flex;justify-content:flex-end;margin-top:10px;">
                    <button class="btn-apply btn-sm ai-apply-btn" style="padding:5px 16px;font-size:13px;">应用</button>
                </div>
            </div>`;
        });
        html += `</div>`;
    });
    resultArea.innerHTML = html;
    document.getElementById('applyAllAiBtn').style.display = '';

    // 绑定「应用」→ 写入 resumeData（编辑器工作区），不直接改 onlineResumes
    resultArea.querySelectorAll('.ai-apply-btn').forEach(btn => {
        btn.addEventListener('click', function applyHandler() {
            const fieldDiv  = btn.closest('.ai-result-field');
            const cardDiv   = btn.closest('.ai-result-card');
            const [sec, id] = cardDiv.dataset.key.split('_');
            const field     = fieldDiv.dataset.field;
            const optimized = fieldDiv.querySelector('.ai-result-text').textContent;
            if (sec === 'work') {
                const w = (resumeData.work||[]).find(x => x.id === id);
                if (w) { w[field] = optimized; w.workContent = optimized; }
            } else {
                const p = (resumeData.project||[]).find(x => x.id === id);
                if (p) p[field] = optimized;
            }
            markDirty();
            _workspaceApplied = true;
            // 若在编辑器内打开，实时刷新列表
            if (_wsFromEditor) {
                if (sec === 'work') renderWork(); else renderProject();
            }
            btn.textContent = '已应用';
            btn.classList.add('applied');
            btn.removeEventListener('click', applyHandler);
        });
    });

    // 全部应用 → 跳转编辑器
    document.getElementById('applyAllAiBtn').onclick = () => {
        resultArea.querySelectorAll('.ai-apply-btn:not(.applied)').forEach(b => b.click());
        closeAiWorkspace();
    };

    lucide.createIcons();
}
