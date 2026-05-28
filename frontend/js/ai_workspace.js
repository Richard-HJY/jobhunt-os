// ============================================================
// AI 批量优化工作区（重构版）
// 变更：
//   1. POST /api/ai/complete 使用 json_mode:true 替代 response_format
//   2. max_tokens 提升至 16000（支持多条长文本批量优化）
//   3. 修复单条精修模式下项目经历字段拆分逻辑
//   4. 新增「查看发送内容」按钮（调试用）
// ============================================================

let _wsResumeId        = null;
let _workspaceApplied  = false;
let _wsFromEditor      = false;
let _wsScopeFilter     = null;   // {type:'work'|'project', id:'...'} 或 null（批量）
let _lastAiRequest     = null;   // 上次发送的完整请求体，供「查看发送内容」用

// ── 打开工作区 ────────────────────────────────────────────────────────────────

async function openAiWorkspace(resumeId, scopeFilter = null) {
    const configured = await checkAiConfigured();
    if (!configured) {
        openSettingsPanel();
        showToast('请先配置 AI 服务', 'error');
        return;
    }

    _wsResumeId     = resumeId;
    _wsScopeFilter  = scopeFilter;
    const res = onlineResumes.find(r => r.id === resumeId);
    if (!res) return;
    const rd = res.data || {};

    // 标题
    const titleEl = document.getElementById('aiWorkspaceResumeName');
    if (scopeFilter) {
        let label = '';
        if (scopeFilter.type === 'work') {
            const w = (rd.work || []).find(x => x.id === scopeFilter.id);
            if (w) label = `${w.company || ''} · ${w.position || ''}`;
        } else {
            const p = (rd.project || []).find(x => x.id === scopeFilter.id);
            if (p) label = p.name || '';
        }
        titleEl.textContent = `— ${label}`;
    } else {
        titleEl.textContent = `— ${res.name}`;
    }
    _workspaceApplied = false;

    _wsFromEditor = !!(editingOnlineResumeId === resumeId && resumeData === res.data);
    if (!_wsFromEditor) {
        editingOnlineResumeId = resumeId;
        editingResumeId = null;
        resumeData = JSON.parse(JSON.stringify(rd));
        document.getElementById('editorTitleBadge').textContent = res.name;
        editorDirty = false;
        _resumeSnapshot = JSON.stringify(resumeData);
    }

    // 构建勾选列表
    _buildScopeList(rd, scopeFilter);
    _updateOriginalPreview(rd);

    document.getElementById('aiResultArea').innerHTML = `
        <div style="color:var(--gray-400);font-size:13px;text-align:center;padding:40px 0;">
            <i data-lucide="sparkles" style="width:32px;height:32px;display:block;margin:0 auto 12px;opacity:.3;"></i>
            ${scopeFilter ? '点击「开始优化」生成改动建议' : '勾选条目并点击「开始优化」'}
        </div>`;
    document.getElementById('applyAllAiBtn').style.display    = 'none';
    document.getElementById('toggleRequestViewBtn').style.display = 'none';

    document.getElementById('aiWorkspacePanel').classList.add('active');
    lucide.createIcons();
}

// 单条精修入口（编辑器卡片上 AI 按钮）
function openAiInline(section, itemId) {
    if (!editingOnlineResumeId) {
        showToast('请先打开一份在线简历', 'error');
        return;
    }
    openAiWorkspace(editingOnlineResumeId, { type: section, id: itemId });
}

// ── 范围勾选列表 ──────────────────────────────────────────────────────────────

function _buildScopeList(rd, scopeFilter) {
    const scopeList     = document.getElementById('aiScopeList');
    const scopeAllLabel = document.getElementById('scopeAll').parentElement;
    const items = [];
    (rd.work    || []).forEach(w => items.push({ type: 'work',    id: w.id, label: `${w.company} · ${w.position}` }));
    (rd.project || []).forEach(p => items.push({ type: 'project', id: p.id, label: p.name }));

    if (scopeFilter) {
        const target = items.find(it => it.type === scopeFilter.type && it.id === scopeFilter.id);
        scopeList.innerHTML = target
            ? `<label style="display:flex;align-items:center;gap:5px;font-size:13px;
                   background:var(--primary-50);border:1px solid var(--primary-200);
                   border-radius:var(--radius-md);padding:4px 10px;color:var(--primary-700);">
                <input type="checkbox" class="ws-scope-chk"
                    data-type="${target.type}" data-id="${target.id}" checked disabled>
                <span>${escapeHtml(target.label)}</span>
              </label>`
            : '<span style="color:var(--gray-400);font-size:13px;">未找到指定条目</span>';
        scopeAllLabel.style.display = 'none';
    } else {
        scopeList.innerHTML = items.map(it => `
            <label style="display:flex;align-items:center;gap:5px;font-size:13px;cursor:pointer;
                background:var(--gray-50);border:1px solid var(--gray-200);
                border-radius:var(--radius-md);padding:4px 10px;">
                <input type="checkbox" class="ws-scope-chk"
                    data-type="${it.type}" data-id="${it.id}" checked>
                <span>${escapeHtml(it.label)}</span>
            </label>`).join('');
        scopeAllLabel.style.display = '';
    }

    // 全选联动
    document.getElementById('scopeAll').checked  = true;
    document.getElementById('scopeAll').onchange = function () {
        document.querySelectorAll('.ws-scope-chk').forEach(c => {
            if (!c.disabled) c.checked = this.checked;
        });
        const res = onlineResumes.find(r => r.id === _wsResumeId);
        if (res) _updateOriginalPreview(res.data || {});
    };
    document.querySelectorAll('.ws-scope-chk').forEach(c =>
        c.addEventListener('change', () => {
            const res = onlineResumes.find(r => r.id === _wsResumeId);
            if (res) _updateOriginalPreview(res.data || {});
            const allChecked = [...document.querySelectorAll('.ws-scope-chk')].every(ch => ch.checked);
            document.getElementById('scopeAll').checked = allChecked;
        })
    );
}

// ── 原始内容预览 ──────────────────────────────────────────────────────────────

function _updateOriginalPreview(rd) {
    const checked = [...document.querySelectorAll('.ws-scope-chk:checked')];
    let html = '';
    checked.forEach(c => {
        if (c.dataset.type === 'work') {
            const w = (rd.work || []).find(x => x.id === c.dataset.id);
            if (w) {
                html += `<div class="preview-block">
                    <strong>${escapeHtml(w.company)} · ${escapeHtml(w.position)}</strong><br>
                    ${escapeHtml((w.workContent || w.duties || '').replace(/\n/g, '<br>'))}
                </div>`;
            }
        } else {
            const p = (rd.project || []).find(x => x.id === c.dataset.id);
            if (p) {
                html += `<div class="preview-block"><strong>${escapeHtml(p.name)}</strong>`;
                if (p.description)    html += `<br><span style="color:var(--gray-400);font-size:12px;">项目描述</span><br>${escapeHtml(p.description).replace(/\n/g, '<br>')}`;
                if (p.responsibility) html += `<br><span style="color:var(--gray-400);font-size:12px;">个人职责</span><br>${escapeHtml(p.responsibility).replace(/\n/g, '<br>')}`;
                if (p.result)         html += `<br><span style="color:var(--gray-400);font-size:12px;">项目成果</span><br>${escapeHtml(p.result).replace(/\n/g, '<br>')}`;
                html += '</div>';
            }
        }
    });
    document.getElementById('aiOriginalPreview').innerHTML =
        html || '<span style="color:var(--gray-400);font-size:13px;">未选中任何条目</span>';
}

// ── Tab 切换（JD 匹配 / 自定义指令）─────────────────────────────────────────

document.querySelectorAll('#aiModeTabGroup .tab-btn').forEach(btn => {
    btn.addEventListener('click', () => {
        document.querySelectorAll('#aiModeTabGroup .tab-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        const isJd = btn.dataset.mode === 'jd';
        document.getElementById('aiCustomInstruction').style.display = isJd ? 'none' : '';
        document.getElementById('aiJdInput').style.display           = isJd ? ''     : 'none';
    });
});

// ── 关闭面板 ──────────────────────────────────────────────────────────────────

function closeAiWorkspace() {
    document.getElementById('aiWorkspacePanel').classList.remove('active');
    document.getElementById('aiCustomInstruction').value = '';
    document.getElementById('aiJdInput').value           = '';
    if (!_wsFromEditor && _workspaceApplied) {
        const res = onlineResumes.find(r => r.id === _wsResumeId);
        if (res) {
            res.data         = resumeData;
            res.lastModified = new Date().toISOString().slice(0, 10);
        }
        _editorSkipReset = true;
        navigateTo('resume-editor');
    }
}

document.getElementById('closeAiWorkspaceBtn').addEventListener('click', closeAiWorkspace);
document.getElementById('aiWorkspacePanel').addEventListener('click', e => {
    if (e.target === document.getElementById('aiWorkspacePanel')) closeAiWorkspace();
});

// ── 核心：开始优化 ────────────────────────────────────────────────────────────

document.getElementById('startAiOptimizeBtn').addEventListener('click', async () => {
    const res = onlineResumes.find(r => r.id === _wsResumeId);
    if (!res) return;
    const rd   = res.data || {};
    const mode = document.querySelector('#aiModeTabGroup .tab-btn.active').dataset.mode;
    const extra = mode === 'jd'
        ? document.getElementById('aiJdInput').value.trim()
        : document.getElementById('aiCustomInstruction').value.trim();

    const checked = [...document.querySelectorAll('.ws-scope-chk:checked')];
    if (!checked.length) { showToast('请至少勾选一个条目', 'error'); return; }

    // 构建 blocks（需要优化的字段列表）
    const blocks = [];
    checked.forEach(c => {
        if (c.dataset.type === 'work') {
            const w = (rd.work || []).find(x => x.id === c.dataset.id);
            if (w) blocks.push({
                section: 'work', id: w.id,
                label: `${w.company} · ${w.position}`,
                field: 'workContent',
                original: w.workContent || w.duties || '',
            });
        } else {
            const p = (rd.project || []).find(x => x.id === c.dataset.id);
            if (!p) return;
            // 项目经历拆 3 个字段（只推送有内容的）
            [
                { field: 'description',   label_suffix: '·项目描述'   },
                { field: 'responsibility', label_suffix: '·个人职责'   },
                { field: 'result',         label_suffix: '·项目成果'   },
            ].forEach(({ field, label_suffix }) => {
                if (p[field]) {   // 空字段不发送，节省 token
                    blocks.push({
                        section: 'project', id: p.id,
                        label: p.name + label_suffix,
                        field,
                        original: p[field],
                    });
                }
            });
        }
    });

    if (!blocks.length) {
        showToast('所选条目均无内容可优化', 'error');
        return;
    }

    // 构建 Prompt
    // id 采用 {原始id}_{field} 复合格式，确保每条唯一，避免模型按 id 合并
    const systemPrompt = _buildSystemPrompt(mode, extra);
    const userContent  = blocks.map(b =>
        JSON.stringify({ id: `${b.id}_${b.field}`, field: b.field, label: b.label, original: b.original })
    ).join('\n');

    const messages = [
        { role: 'system', content: systemPrompt },
        { role: 'user',   content: userContent  },
    ];
    // 记录完整请求供调试
    _lastAiRequest = { messages, max_tokens: 16000, json_mode: true };

    // 显示 loading
    const resultArea = document.getElementById('aiResultArea');
    resultArea.innerHTML = `
        <div style="text-align:center;padding:40px 0;color:var(--gray-400);">
            <i data-lucide="loader-circle" style="width:24px;height:24px;display:block;
                margin:0 auto 12px;animation:spin 1s linear infinite;"></i>
            AI 分析中…
        </div>`;
    lucide.createIcons();

    // 调用后端代理（json_mode 替代 response_format）
    try {
        const r = await fetch('/api/ai/complete', {
            method:  'POST',
            headers: { 'Content-Type': 'application/json' },
            body:    JSON.stringify(_lastAiRequest),
        });
        const d = await r.json();
        if (!d.ok) {
            resultArea.innerHTML = `<div style="color:var(--error-600);padding:20px;">
                AI 返回错误：${escapeHtml(d.error)}</div>`;
            return;
        }
        const parsed = parseAiJson(d.content);
        if (!parsed?.results?.length) {
            resultArea.innerHTML = `<div style="color:var(--error-600);padding:20px;">
                AI 返回结果为空，请重试</div>`;
            return;
        }
        _renderAiResults(parsed.results, blocks, rd);
    } catch (e) {
        resultArea.innerHTML = `<div style="color:var(--error-600);padding:20px;">
            解析失败：${escapeHtml(e.message)}</div>`;
    }
});

// ── Prompt 构建 ───────────────────────────────────────────────────────────────

function _buildSystemPrompt(mode, extra) {
    const basePrompt = `你是一名专业的简历优化顾问。请逐条优化用户提供的简历条目，并标注每处改动的原因。

【输出格式要求】
只返回合法 JSON，不得包含任何其他文字、注释或 markdown 代码围栏。
格式如下：
{
  "results": [
    {
      "id": "<原始 id（含 _field 后缀，原样返回）>",
      "field": "<原始 field>",
      "optimized": "优化后的完整文本（整段，可直接覆盖原文）",
      "changes": [
        {
          "original_fragment": "原文中的逐字子串",
          "optimized_fragment": "对应的优化后片段",
          "reason": "动宾短语，≤10字"
        }
      ]
    }
  ]
}

【约束规则】
1. original_fragment 必须是 original 字段的逐字精确子串（区分大小写）；若无法在原文找到精确匹配，整条 change 条目省略，禁止修改 original_fragment 来凑
2. reason 使用动宾短语，≤10字，例如："量化指标"、"精简冗余"、"强化主语"、"修正语序"
3. optimized 为完整替换段落，可直接覆盖原文
4. 若某条无需任何改动，直接省略该 result 对象，不要输出（前端会自动保留原文）
5. 每个输入条目的 id 为 {原始id}_{field} 复合格式，原样返回，不得拆分或合并
6. 项目成果字段（field="result"）：量化指标和已实现成果前置，潜力/展望描述后置
7. 修正表达不通顺或有歧义的句子，使其简洁流畅`;

    if (mode === 'jd' && extra) {
        return basePrompt + `\n\n【岗位描述（请使优化结果与以下 JD 关键词对齐）】\n${extra}`;
    }
    if (mode === 'custom' && extra) {
        return basePrompt + `\n\n【用户自定义优化指令】\n${extra}`;
    }
    return basePrompt;
}

// ── 结果渲染 ──────────────────────────────────────────────────────────────────

function _renderAiResults(results, blocks, rd) {
    const resultArea = document.getElementById('aiResultArea');

    // 将 results 建立复合 key 索引（id 为 {原始id}_{field} 格式）
    const resultMap = {};
    results.forEach(r => {
        resultMap[r.id] = r;
    });

    // 按 section_id 分组；对 AI 未返回的 block，保留原文（optimized = original, changes = []）
    const groupMap = {};
    blocks.forEach(block => {
        const compositeId = `${block.id}_${block.field}`;
        const r = resultMap[compositeId];
        const key = `${block.section}|${block.id}`;
        if (!groupMap[key]) {
            const cleanLabel = block.label.replace(/·(项目描述|个人职责|项目成果)$/, '');
            groupMap[key] = { section: block.section, id: block.id, label: cleanLabel, fields: [] };
        }
        groupMap[key].fields.push({
            field:     block.field,
            original:  block.original,
            optimized: r ? r.optimized : block.original,   // AI 省略该条 → 保留原文
            changes:   r ? (r.changes || []) : [],
            applied:   false,
        });
    });

    // 「查看发送内容」折叠区
    const requestViewHtml = `
        <div id="aiRequestView" style="display:none;margin-bottom:12px;">
            <div style="background:var(--gray-900);border-radius:var(--radius-md);
                padding:12px;max-height:400px;overflow:auto;">
                <div style="color:var(--gray-400);font-size:11px;margin-bottom:6px;">System Prompt</div>
                <pre style="color:#a5d6a7;font-size:12px;white-space:pre-wrap;
                    word-break:break-all;margin:0 0 12px;line-height:1.6;">
${escapeHtml(_lastAiRequest?.messages?.[0]?.content || '')}</pre>
                <div style="color:var(--gray-400);font-size:11px;margin-bottom:6px;">User Content</div>
                <pre style="color:#90caf9;font-size:12px;white-space:pre-wrap;
                    word-break:break-all;margin:0;line-height:1.6;">
${escapeHtml(_lastAiRequest?.messages?.[1]?.content || '')}</pre>
            </div>
        </div>`;

    // 结果卡片
    let cardsHtml = '';
    Object.values(groupMap).forEach(g => {
        cardsHtml += `<div class="ai-result-card" data-key="${g.section}|${g.id}">
            <div class="ai-result-card-header">
                <span class="ai-result-tag">${g.section === 'work' ? '工作经历' : '项目经历'}</span>
                <strong>${escapeHtml(g.label)}</strong>
            </div>`;
        g.fields.forEach(f => {
            if (!f.original && !f.optimized) return;
            const fieldLabel = {
                workContent:    '工作内容',
                description:    '项目描述',
                responsibility: '个人职责',
                result:         '项目成果',
            }[f.field] || f.field;
            cardsHtml += renderDiffFieldBlock({
                field: f.field, fieldLabel,
                original: f.original, optimized: f.optimized, changes: f.changes,
            });
        });
        cardsHtml += '</div>';
    });

    resultArea.innerHTML = requestViewHtml + cardsHtml;
    document.getElementById('applyAllAiBtn').style.display        = '';
    document.getElementById('toggleRequestViewBtn').style.display = '';

    // 「查看发送内容」折叠
    document.getElementById('toggleRequestViewBtn').onclick = () => {
        const view = document.getElementById('aiRequestView');
        view.style.display = view.style.display === 'none' ? '' : 'none';
    };

    // 绑定「应用此条」
    resultArea.querySelectorAll('.ai-apply-btn').forEach(btn => {
        btn.addEventListener('click', function () {
            const fieldDiv  = btn.closest('.ai-result-field');
            const cardDiv   = btn.closest('.ai-result-card');
            const sep = cardDiv.dataset.key.indexOf('|');
            const sec = cardDiv.dataset.key.slice(0, sep);
            const id  = cardDiv.dataset.key.slice(sep + 1);
            const field     = fieldDiv.dataset.field;
            const optimized = fieldDiv.querySelector('.optimized-text')?.textContent
                           || fieldDiv.querySelector('.diff-content')?.textContent || '';
            _applyField(sec, id, field, optimized);
            btn.textContent = '✓ 已应用';
            btn.classList.add('applied');
            btn.disabled = true;
            const rejectBtn = fieldDiv.querySelector('.ai-reject-btn');
            if (rejectBtn) rejectBtn.style.display = 'none';
        });
    });

    // 绑定「放弃」
    resultArea.querySelectorAll('.ai-reject-btn').forEach(btn => {
        btn.addEventListener('click', function () {
            const fieldDiv = btn.closest('.ai-result-field');
            fieldDiv.style.opacity       = '0.4';
            fieldDiv.style.pointerEvents = 'none';
            btn.textContent = '已放弃';
        });
    });

    // 全部应用
    document.getElementById('applyAllAiBtn').onclick = () => {
        resultArea.querySelectorAll('.ai-apply-btn:not(.applied)').forEach(b => b.click());
        closeAiWorkspace();
    };

    lucide.createIcons();
}

// ── 应用优化到 resumeData ─────────────────────────────────────────────────────

function _applyField(section, id, field, optimized) {
    if (section === 'work') {
        const w = (resumeData.work || []).find(x => x.id === id);
        if (w) { w[field] = optimized; }
    } else {
        const p = (resumeData.project || []).find(x => x.id === id);
        if (p) p[field] = optimized;
    }
    markDirty();
    _workspaceApplied = true;
    if (_wsFromEditor) {
        if (section === 'work') renderWork(); else renderProject();
    }
}
