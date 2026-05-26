// ============================================================
// AI 单条精修弹窗
// ============================================================
let _inlineSection = null;
let _inlineItemId  = null;

function openAiInline(section, itemId) {
    checkAiConfigured().then(ok => {
        if (!ok) { openSettingsPanel(); showToast('请先配置 AI 服务', 'error'); return; }
        _inlineSection = section;
        _inlineItemId  = itemId;

        // 拼接原文
        let original = '';
        const title  = section === 'work' ? '工作经历 AI 精修' : '项目经历 AI 精修';
        if (section === 'work') {
            const w = resumeData.work.find(x => x.id === itemId);
            if (w) original = w.workContent || w.duties || '';
        } else {
            const p = resumeData.project.find(x => x.id === itemId);
            if (p) original = [p.description, p.responsibility, p.result].filter(Boolean).join('\n\n');
        }

        document.getElementById('aiInlineTitle').textContent = title;
        document.getElementById('aiInlineOriginal').textContent = original;
        document.getElementById('aiInlineInput').value = '';
        document.getElementById('aiInlineResultWrap').style.display = 'none';
        document.getElementById('applyAiInlineBtn').style.display = 'none';
        document.getElementById('regenerateAiInlineBtn').style.display = 'none';
        document.getElementById('runAiInlineBtn').style.display = '';
        // 重置 Tab
        document.querySelectorAll('#aiInlineModeGroup .tab-btn').forEach((b,i) => b.classList.toggle('active',i===0));
        document.getElementById('aiInlineInput').placeholder = '输入优化指令…';

        document.getElementById('aiInlineModal').classList.add('active');
    });
}

// Tab 切换
document.querySelectorAll('#aiInlineModeGroup .tab-btn').forEach(btn => {
    btn.addEventListener('click', () => {
        document.querySelectorAll('#aiInlineModeGroup .tab-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        document.getElementById('aiInlineInput').placeholder =
            btn.dataset.mode === 'jd' ? '粘贴目标岗位描述（JD）…' : '输入优化指令…';
    });
});

document.getElementById('closeAiInlineBtn').addEventListener('click',  () => document.getElementById('aiInlineModal').classList.remove('active'));
document.getElementById('cancelAiInlineBtn').addEventListener('click', () => document.getElementById('aiInlineModal').classList.remove('active'));

async function runInlineOptimize() {
    const section = _inlineSection;
    const mode    = document.querySelector('#aiInlineModeGroup .tab-btn.active').dataset.mode;
    const extra   = document.getElementById('aiInlineInput').value.trim();
    const original = document.getElementById('aiInlineOriginal').textContent;

    let fields = [];
    if (section === 'work') {
        fields = [{ field:'workContent', original }];
    } else {
        const p = resumeData.project.find(x => x.id === _inlineItemId);
        if (p) fields = [
            { field:'description',   original: p.description||'' },
            { field:'responsibility', original: p.responsibility||'' },
            { field:'result',         original: p.result||'' },
        ];
    }

    const systemPrompt = `你是专业的简历优化顾问。请对以下简历字段进行优化，返回 JSON：
{"results":[{"field":"...","optimized":"..."},...]}
不要额外说明。${mode==='jd' ? '结合岗位描述：\n'+extra : (extra?'用户指令：'+extra:'')}`;

    document.getElementById('runAiInlineBtn').disabled = true;
    document.getElementById('runAiInlineBtn').innerHTML = `<i data-lucide="loader-circle" style="width:13px;height:13px;animation:spin 1s linear infinite;"></i> 优化中…`;
    lucide.createIcons();

    try {
        const r = await fetch('http://localhost:8000/api/ai/complete', {
            method: 'POST',
            headers: {'Content-Type':'application/json'},
            body: JSON.stringify({ messages: [
                { role:'system', content: systemPrompt },
                { role:'user',   content: JSON.stringify(fields) }
            ]})
        });
        const d = await r.json();
        if (!d.ok) { showToast('AI 失败：'+d.error,'error'); return; }
        const parsed = JSON.parse(d.content.replace(/```json|```/g,'').trim());

        // 展示结果（项目经历三段合并展示）
        const resultText = parsed.results.map(r => {
            const label = {workContent:'工作内容',description:'项目描述',responsibility:'个人职责',result:'项目成果'}[r.field]||r.field;
            return section==='project' ? `【${label}】\n${r.optimized}` : r.optimized;
        }).join('\n\n');

        document.getElementById('aiInlineResult').textContent = resultText;
        document.getElementById('aiInlineResultWrap').style.display = '';
        document.getElementById('applyAiInlineBtn').style.display = '';
        document.getElementById('regenerateAiInlineBtn').style.display = '';
        document.getElementById('runAiInlineBtn').style.display = 'none';

        // 存储用于应用
        document.getElementById('aiInlineModal').dataset.parsedResults = JSON.stringify(parsed.results);
    } catch(e) {
        showToast('解析失败：'+e.message,'error');
    } finally {
        document.getElementById('runAiInlineBtn').disabled = false;
        document.getElementById('runAiInlineBtn').innerHTML = `<i data-lucide="sparkles" style="width:13px;height:13px;"></i>开始优化`;
        lucide.createIcons();
    }
}

document.getElementById('runAiInlineBtn').addEventListener('click', runInlineOptimize);
document.getElementById('regenerateAiInlineBtn').addEventListener('click', runInlineOptimize);

document.getElementById('applyAiInlineBtn').addEventListener('click', () => {
    const results = JSON.parse(document.getElementById('aiInlineModal').dataset.parsedResults || '[]');
    results.forEach(r => {
        if (_inlineSection === 'work') {
            const w = resumeData.work.find(x => x.id === _inlineItemId);
            if (w) { w.workContent = r.optimized; w.duties = r.optimized; }
        } else {
            const p = resumeData.project.find(x => x.id === _inlineItemId);
            if (p) p[r.field] = r.optimized;
        }
    });
    markDirty();
    if (_inlineSection === 'work') renderWork(); else renderProject();
    document.getElementById('aiInlineModal').classList.remove('active');
    showToast('已应用优化结果');
});
