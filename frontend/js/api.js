// ============================================================
// 后端持久化
// ============================================================
const _API = 'http://localhost:8000';

function persist() {
    const eventsToSave = calendarEvents.map(ev => ({
        ...ev,
        date: ev.date instanceof Date ? ev.date.toISOString() : ev.date
    }));
    fetch(_API + '/api/save', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            deliveries,
            calendarEvents: eventsToSave,
            onlineResumes: onlineResumes.map(r => ({ ...r, data: r.data || null })),
            customResumes: customResumes.map(r => ({ ...r, fileUrl: undefined, fileBlob: undefined }))
        })
    })
    .then(r => r.json())
    .then(() => {
    })
    .catch(e => {
        console.error('[persist]', e);
    });
}

async function loadFromServer() {
    try {
        const res = await fetch(_API + '/api/load');
        if (!res.ok) throw new Error('HTTP ' + res.status);
        const data = await res.json();

        console.log('[load] 收到数据', data);

        if (Array.isArray(data.deliveries) && data.deliveries.length > 0) {
            deliveries = data.deliveries;
            console.log('[load] deliveries:', deliveries.length);
        }
        if (Array.isArray(data.calendarEvents) && data.calendarEvents.length > 0) {
            calendarEvents = data.calendarEvents.map(ev => ({
                ...ev,
                date: new Date(ev.date)
            }));
            console.log('[load] calendarEvents:', calendarEvents.length);
        }
        if (Array.isArray(data.onlineResumes) && data.onlineResumes.length > 0) {
            onlineResumes = data.onlineResumes;
            masterResumeDeleted = false;
            console.log('[load] onlineResumes:', onlineResumes.length);
        }
        if (Array.isArray(data.customResumes) && data.customResumes.length > 0) {
            customResumes = data.customResumes;
            console.log('[load] customResumes:', customResumes.length);
        }
    } catch(e) {
        console.error('[load]', e);
    }
    buildKanbanColsFromDeliveries();
    syncFilterStageOptions();
    renderHome();
    window._appReady = true;

}

