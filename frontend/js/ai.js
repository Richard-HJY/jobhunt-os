// ============================================================
// AI 优化模态框
// ============================================================
let aiSelectedFile=null;

function populateAiOnlineResumeSelect() {
    const sel = document.getElementById('onlineResumeSelect');
    if (!sel) return;
    if (onlineResumes.length === 0) {
        sel.innerHTML = '<option value="">暂无在线简历</option>';
    } else {
        sel.innerHTML = onlineResumes.map(r => `<option value="${escapeHtml(r.id)}">${escapeHtml(r.name)}</option>`).join('');
    }
}

document.querySelectorAll('input[name="resumeSource"]').forEach(radio => {
    radio.addEventListener('change', e => {
        document.getElementById('onlineResumeSelectArea').style.display=e.target.value==='online'?'block':'none';
        document.getElementById('uploadResumeArea').style.display=e.target.value==='upload'?'block':'none';
        if (e.target.value === 'online') populateAiOnlineResumeSelect();
    });
});
document.getElementById('aiUploadArea').addEventListener('click', ()=>document.getElementById('aiResumeFile').click());
document.getElementById('aiResumeFile').addEventListener('change', e => {
    if(e.target.files[0]){aiSelectedFile=e.target.files[0]; document.getElementById('aiUploadPreview').textContent='✅ 已选择：'+aiSelectedFile.name;}
});
document.getElementById('closeAiModalBtn').addEventListener('click', ()=>document.getElementById('aiModal').classList.remove('active'));
document.getElementById('cancelAiBtn').addEventListener('click', ()=>document.getElementById('aiModal').classList.remove('active'));
document.getElementById('startAnalyzeBtn').addEventListener('click', ()=>{
    const src=document.querySelector('input[name="resumeSource"]:checked').value;
    const jd=document.getElementById('jobDescription').value.trim();
    if(!jd){showToast('请填写目标岗位信息','error');return;}
    if(src==='upload'&&!aiSelectedFile){showToast('请先上传简历文件','error');return;}
    showToast('✨ AI分析中（演示）');
    document.getElementById('aiModal').classList.remove('active');
});

