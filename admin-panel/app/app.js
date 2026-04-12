// ======== STATE ========
let API_URL = '';
let TOKEN = '';
let currentTab = 'monitoring';
let refreshInterval = null;
let logFilter = 'all';
let logSearch = '';

// Search & Pagination
let userSearch = '';
let userPage = 1;
let licenseSearch = '';
let licensePage = 1;
const PAGE_SIZE = 15;

// Chart history
let cpuHistory = [];
let ramHistory = [];
const CHART_MAX_POINTS = 30;

// Alerts
let alerts = [];
let alertsPanelOpen = false;

// Theme
let darkMode = localStorage.getItem('admin_theme') !== 'light';

// Sort
let sortColumn = '';
let sortDir = 'asc';

// ======== API HELPERS ========
async function apiGet(path) {
    try {
        const res = await fetch(API_URL + '/api' + path, {
            headers: { 'Authorization': `Bearer ${TOKEN}`, 'Content-Type': 'application/json' }
        });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        return await res.json();
    } catch (e) {
        console.warn('API GET error:', path, e.message);
        return null;
    }
}

async function apiPost(path, body = {}) {
    const res = await fetch(API_URL + '/api' + path, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${TOKEN}`, 'Content-Type': 'application/json' },
        body: JSON.stringify(body)
    });
    if (!res.ok) { const err = await res.json().catch(() => ({})); throw new Error(err.error || `HTTP ${res.status}`); }
    return await res.json();
}

async function apiPut(path, body = {}) {
    const res = await fetch(API_URL + '/api' + path, {
        method: 'PUT',
        headers: { 'Authorization': `Bearer ${TOKEN}`, 'Content-Type': 'application/json' },
        body: JSON.stringify(body)
    });
    if (!res.ok) { const err = await res.json().catch(() => ({})); throw new Error(err.error || `HTTP ${res.status}`); }
    return await res.json();
}

async function apiDelete(path) {
    const res = await fetch(API_URL + '/api' + path, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${TOKEN}` }
    });
    if (!res.ok) { const err = await res.json().catch(() => ({})); throw new Error(err.error || `HTTP ${res.status}`); }
    return await res.json();
}

// ======== CONNECTION ========
async function connectToServer() {
    const url = document.getElementById('server-url').value.trim().replace(/\/+$/, '');
    const user = document.getElementById('login-user').value.trim();
    const pass = document.getElementById('login-pass').value;
    const status = document.getElementById('connect-status');

    if (!url) { status.className = 'connect-status error'; status.textContent = 'Введите адрес сервера'; return; }

    status.className = 'connect-status'; status.textContent = '⏳ Подключение...';

    try {
        const res = await fetch(url + '/api/auth/login', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ username: user, password: pass })
        });

        if (!res.ok) {
            const err = await res.json().catch(() => ({}));
            throw new Error(err.error || `Ошибка ${res.status}`);
        }

        const data = await res.json();
        TOKEN = data.token;
        API_URL = url;
        localStorage.setItem('admin_server_url', url);
        localStorage.setItem('admin_token', TOKEN);
        // Сохранить учётные данные для автологина
        localStorage.setItem('admin_user', user);
        localStorage.setItem('admin_pass', btoa(pass));

        status.className = 'connect-status success';
        status.textContent = '✅ Подключено!';

        setTimeout(() => enterPanel(url), 500);
    } catch (e) {
        status.className = 'connect-status error';
        status.textContent = '❌ ' + e.message;
    }
}

function disconnect() {
    TOKEN = ''; API_URL = '';
    localStorage.removeItem('admin_token');
    localStorage.removeItem('admin_user');
    localStorage.removeItem('admin_pass');
    stopAutoRefresh();
    document.getElementById('main-panel').style.display = 'none';
    document.getElementById('setup-screen').style.display = 'flex';
}

function enterPanel(url) {
    document.getElementById('setup-screen').style.display = 'none';
    document.getElementById('main-panel').style.display = 'flex';
    document.getElementById('server-label').textContent = url.replace(/https?:\/\//, '');
    switchTab('monitoring');
    startAutoRefresh();
}

// ======== TABS ========
function switchTab(tab) {
    currentTab = tab;
    document.querySelectorAll('.nav-item').forEach(el => el.classList.toggle('active', el.dataset.tab === tab));
    const titles = {
        monitoring: '📊 Мониторинг', users: '👥 Пользователи', sessions: '🌐 Сессии',
        backups: '💾 Резервные копии', database: '🗄️ База данных', logs: '📋 Логи',
        licenses: '🔑 Лицензии', settings: '⚙️ Настройки'
    };
    document.getElementById('page-title').textContent = titles[tab] || tab;
    closeSidebar();
    refreshData();
}

function startAutoRefresh() {
    stopAutoRefresh();
    refreshInterval = setInterval(() => { if (currentTab === 'monitoring' || currentTab === 'sessions') refreshData(); }, 10000);
}
function stopAutoRefresh() { if (refreshInterval) { clearInterval(refreshInterval); refreshInterval = null; } }

async function refreshData() {
    const area = document.getElementById('content-area');
    document.getElementById('last-update').textContent = 'Обновлено: ' + new Date().toLocaleTimeString('ru-RU');
    try {
        switch (currentTab) {
            case 'monitoring': await renderMonitoring(area); break;
            case 'users': await renderUsers(area); break;
            case 'sessions': await renderSessions(area); break;
            case 'backups': await renderBackups(area); break;
            case 'database': await renderDatabase(area); break;
            case 'logs': await renderLogs(area); break;
            case 'licenses': await renderLicenses(area); break;
            case 'settings': await renderSettings(area); break;
        }
    } catch (e) {
        console.error('Render error:', e);
    }
}

// ======== MONITORING ========
async function renderMonitoring(area) {
    const [metrics, services, connections] = await Promise.all([
        apiGet('/system/metrics'), apiGet('/system/services'), apiGet('/system/connections')
    ]);
    const m = metrics || { cpu: { usage: 0, cores: 0 }, memory: { total: 0, used: 0, usagePercent: 0 }, system: { uptime: 0, nodeVersion: '' }, process: { pid: 0, memoryUsage: { rss: 0 } }, database: { size: '—', activeConnections: 0 } };
    const s = services?.services || {};
    const conn = connections?.websocket || 0;

    // Записать в историю для графиков
    const cpuVal = m.cpu?.usage || 0;
    const ramVal = m.memory?.usagePercent || 0;
    cpuHistory.push(cpuVal);
    ramHistory.push(ramVal);
    if (cpuHistory.length > CHART_MAX_POINTS) cpuHistory.shift();
    if (ramHistory.length > CHART_MAX_POINTS) ramHistory.shift();

    // Проверить алерты
    checkAlerts(cpuVal, ramVal, m);

    area.innerHTML = `
        <div class="stats-grid">
            <div class="stat-card" style="border-left:4px solid var(--info)">
                <div class="stat-icon">🖥️</div><div class="stat-label">CPU</div>
                <div class="stat-value">${cpuVal.toFixed(1)}%</div>
                <div class="stat-sub">${m.cpu?.cores || 0} ядер</div>
                <div class="progress-bar"><div class="progress-fill" style="width:${cpuVal}%;background:${cpuVal > 80 ? 'var(--danger)' : 'var(--info)'}"></div></div>
            </div>
            <div class="stat-card" style="border-left:4px solid var(--success)">
                <div class="stat-icon">💾</div><div class="stat-label">RAM</div>
                <div class="stat-value">${ramVal.toFixed(1)}%</div>
                <div class="stat-sub">${formatBytes(m.memory?.used)} / ${formatBytes(m.memory?.total)}</div>
                <div class="progress-bar"><div class="progress-fill" style="width:${ramVal}%;background:${ramVal > 80 ? 'var(--danger)' : 'var(--success)'}"></div></div>
            </div>
            <div class="stat-card" style="border-left:4px solid var(--primary)">
                <div class="stat-icon">🗄️</div><div class="stat-label">PostgreSQL</div>
                <div class="stat-value">${m.database?.size || '—'}</div>
                <div class="stat-sub">${m.database?.activeConnections || 0} подключений</div>
            </div>
            <div class="stat-card" style="border-left:4px solid var(--warning)">
                <div class="stat-icon">⏱️</div><div class="stat-label">Uptime</div>
                <div class="stat-value">${formatUptime(m.system?.uptime)}</div>
                <div class="stat-sub">Node ${m.system?.nodeVersion || ''}</div>
            </div>
            <div class="stat-card" style="border-left:4px solid #ff0080">
                <div class="stat-icon">🌐</div><div class="stat-label">Соединения</div>
                <div class="stat-value">${conn}</div>
                <div class="stat-sub">WebSocket</div>
            </div>
        </div>
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:16px;margin-bottom:20px">
            <div class="card" style="margin-bottom:0">
                <h4 style="margin-bottom:8px;font-size:13px">📈 CPU (${CHART_MAX_POINTS} замеров)</h4>
                <div class="mini-chart"><canvas id="cpu-chart" class="chart-canvas"></canvas></div>
            </div>
            <div class="card" style="margin-bottom:0">
                <h4 style="margin-bottom:8px;font-size:13px">📊 RAM (${CHART_MAX_POINTS} замеров)</h4>
                <div class="mini-chart"><canvas id="ram-chart" class="chart-canvas"></canvas></div>
            </div>
        </div>
        <div class="card"><h3 style="margin-bottom:16px">🔌 Статус сервисов</h3>
            <div class="services-grid">
                ${Object.entries(s).map(([name, svc]) => `<div class="service-card"><div style="display:flex;align-items:center;gap:8px;margin-bottom:8px"><span class="status-dot status-${svc.status === 'online' ? 'online' : svc.status === 'offline' ? 'offline' : 'unknown'}"></span><strong style="text-transform:capitalize">${name}</strong></div><div style="font-size:12px;color:var(--text-muted);margin-bottom:8px">${svc.status === 'online' ? 'Работает (' + (svc.latency || 0) + 'ms)' : svc.status}</div><button class="btn ${svc.status === 'online' ? 'btn-danger' : 'btn-success'} btn-sm" onclick="toggleService('${name}', '${svc.status}')" style="width:100%;font-size:12px">${svc.status === 'online' ? '⏹ Остановить' : '▶ Запустить'}</button></div>`).join('')}
                <div class="service-card"><div style="display:flex;align-items:center;gap:8px;margin-bottom:8px"><span class="status-dot status-online"></span><strong>Node.js</strong></div><div style="font-size:12px;color:var(--text-muted)">PID ${m.process?.pid || 0} • RAM ${formatBytes(m.process?.memoryUsage?.rss)}</div></div>
            </div>
        </div>`;

    // Рисуем графики
    setTimeout(() => {
        drawMiniChart('cpu-chart', cpuHistory, '#00ccff', '#0066ff');
        drawMiniChart('ram-chart', ramHistory, '#00ff88', '#00cc6a');
    }, 50);
}

async function toggleService(name, currentStatus) {
    const action = currentStatus === 'online' ? 'stop' : 'start';
    const label = action === 'stop' ? 'Остановить' : 'Запустить';
    if (!confirm(`${label} сервис "${name}"?`)) return;
    try {
        await apiPost(`/system/services/${name}/${action}`);
        showToast(`Сервис "${name}" — ${action === 'stop' ? 'остановлен' : 'запущен'}`, 'success');
        refreshData();
    } catch (e) {
        showToast(`Ошибка: ${e.message || 'не удалось выполнить операцию'}`, 'error');
    }
}

// ======== USERS ========
let _roles = [];

// Sort helper
function sortData(arr, col, dir) {
    return [...arr].sort((a, b) => {
        let va = a[col] ?? '', vb = b[col] ?? '';
        if (col === 'last_login' || col === 'created_at' || col === 'expires_at') {
            va = va ? new Date(va).getTime() : 0;
            vb = vb ? new Date(vb).getTime() : 0;
        } else if (col === 'is_active' || col === 'active_devices') {
            va = Number(va) || 0; vb = Number(vb) || 0;
        } else {
            va = String(va).toLowerCase(); vb = String(vb).toLowerCase();
        }
        if (va < vb) return dir === 'asc' ? -1 : 1;
        if (va > vb) return dir === 'asc' ? 1 : -1;
        return 0;
    });
}

function bindSortHeaders() {
    document.querySelectorAll('th.sortable').forEach(th => th.addEventListener('click', function() {
        const col = this.dataset.sort;
        if (sortColumn === col) {
            sortDir = sortDir === 'asc' ? 'desc' : 'asc';
        } else {
            sortColumn = col;
            sortDir = 'asc';
        }
        refreshData();
    }));
}
async function renderUsers(area) {
    const [usersRes, rolesRes] = await Promise.all([apiGet('/users'), apiGet('/users/roles')]);
    const allUsers = Array.isArray(usersRes) ? usersRes : (usersRes?.users || []);
    _roles = Array.isArray(rolesRes) ? rolesRes : (rolesRes?.roles || []);

    // Поиск
    const q = userSearch.toLowerCase();
    let filtered = q ? allUsers.filter(u => (u.full_name || '').toLowerCase().includes(q) || (u.username || '').toLowerCase().includes(q) || (u.email || '').toLowerCase().includes(q)) : [...allUsers];

    // Сортировка
    if (sortColumn) {
        filtered = sortData(filtered, sortColumn, sortDir);
    }

    // Пагинация
    const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
    if (userPage > totalPages) userPage = totalPages;
    const start = (userPage - 1) * PAGE_SIZE;
    const users = filtered.slice(start, start + PAGE_SIZE);

    const thSort = (key, label) => `<th class="sortable ${sortColumn === key ? 'sort-' + sortDir : ''}" data-sort="${key}">${label}</th>`;

    area.innerHTML = `
        <div style="display:flex;justify-content:space-between;margin-bottom:16px;align-items:center">
            <span class="text-muted">${filtered.length} из ${allUsers.length} пользователей</span>
            <div style="display:flex;gap:8px">
                <button class="btn btn-secondary" id="btn-export-users">📥 CSV</button>
                <button class="btn btn-primary" id="btn-create-user">👤 Создать</button>
            </div>
        </div>
        <div class="search-bar">
            <input id="user-search" placeholder="🔍 Поиск по имени, логину или email..." value="${escapeHtml(userSearch)}">
        </div>
        <div class="card" style="padding:0;overflow:hidden"><table>
            <thead><tr>${thSort('full_name', 'Пользователь')}${thSort('role_name', 'Роль')}${thSort('is_active', 'Статус')}${thSort('last_login', 'Последний вход')}<th style="text-align:right">Действия</th></tr></thead>
            <tbody>
                ${users.map(u => { const roleName = u.role_name || u.role_names || '—'; return `<tr>
                    <td><div style="display:flex;align-items:center;gap:12px"><div class="avatar">${(u.full_name || u.username || '?')[0].toUpperCase()}</div><div><div style="font-weight:600">${u.full_name || u.username}</div><div style="font-size:11px;color:var(--text-muted)">${u.email || ''}</div></div></div></td>
                    <td><span class="badge ${roleName.includes('Администратор') ? 'badge-purple' : roleName.includes('Менеджер') ? 'badge-warning' : 'badge-info'}">${roleName}</span></td>
                    <td><span class="status-dot ${u.is_active !== false ? 'status-online' : 'status-offline'}"></span></td>
                    <td style="color:var(--text-muted);font-size:12px">${u.last_login ? new Date(u.last_login).toLocaleString('ru-RU') : 'Никогда'}</td>
                    <td style="text-align:right"><button class="btn btn-sm btn-secondary btn-reset-pw" data-id="${u.id}" data-name="${u.username}">🔑</button> <button class="btn btn-sm btn-secondary btn-toggle-user" data-id="${u.id}" data-active="${u.is_active !== false}">${u.is_active !== false ? '🔒' : '🔓'}</button></td>
                </tr>`; }).join('')}
                ${users.length === 0 ? '<tr><td colspan="5" style="text-align:center;padding:40px;color:var(--text-muted)">Нет результатов</td></tr>' : ''}
            </tbody>
        </table></div>
        ${renderPagination(userPage, totalPages, 'userPage')}`;

    // Bind events
    document.getElementById('btn-create-user')?.addEventListener('click', showCreateUserModal);
    document.querySelectorAll('.btn-reset-pw').forEach(btn => btn.addEventListener('click', function () { resetPassword(this.dataset.id, this.dataset.name); }));
    document.querySelectorAll('.btn-toggle-user').forEach(btn => btn.addEventListener('click', function () { toggleUser(this.dataset.id, this.dataset.active === 'true'); }));
    bindSearch('user-search', v => { userSearch = v; userPage = 1; refreshData(); });
    bindPagination('userPage');
    bindSortHeaders();
    document.getElementById('btn-export-users')?.addEventListener('click', () => {
        exportCSV(allUsers.map(u => ({ 'Логин': u.username, 'ФИО': u.full_name, 'Email': u.email || '', 'Роль': u.role_name || u.role_names || '', 'Активен': u.is_active !== false ? 'Да' : 'Нет', 'Последний вход': u.last_login ? new Date(u.last_login).toLocaleString('ru-RU') : '' })), 'users');
    });
}

async function resetPassword(id, username) {
    if (!confirm('Сбросить пароль для ' + username + '?')) return;
    try { const res = await apiPost('/users/' + id + '/reset-password'); showToast('Новый пароль: ' + (res.password || 'см. email'), 'success'); } catch (e) { showToast('Ошибка: ' + e.message, 'error'); }
}

async function toggleUser(id, isActive) {
    try { await apiPut('/users/' + id, { isActive: !isActive }); showToast(isActive ? 'Деактивирован' : 'Активирован', 'success'); refreshData(); } catch (e) { showToast('Ошибка: ' + e.message, 'error'); }
}

function showCreateUserModal() {
    showModal('👤 Новый пользователь', `
        <div class="form-group"><label>Логин *</label><input id="nu-login" placeholder="username"></div>
        <div class="form-group"><label>ФИО *</label><input id="nu-name" placeholder="Иванов Иван"></div>
        <div class="form-group"><label>Email</label><input id="nu-email" placeholder="user@company.com"></div>
        <div class="form-group"><label>Роль</label><select id="nu-role"><option value="">Выберите</option>${_roles.map(r => '<option value="' + r.id + '">' + r.name + '</option>').join('')}</select></div>
        <div style="padding:12px;background:var(--bg-tertiary);border-radius:8px;font-size:12px;color:var(--text-muted)">💡 Пароль сгенерируется автоматически</div>
    `, async () => {
        const data = { username: document.getElementById('nu-login').value, fullName: document.getElementById('nu-name').value, email: document.getElementById('nu-email').value, roleId: document.getElementById('nu-role').value };
        if (!data.username || !data.fullName) { showToast('Заполните поля', 'error'); return; }
        const res = await apiPost('/users', data);
        showToast('Создан! Пароль: ' + (res.password || 'см. email'), 'success');
        closeModal(); refreshData();
    });
}

// ======== SESSIONS ========
async function renderSessions(area) {
    const res = await apiGet('/sessions');
    const sessions = res?.sessions || [];

    area.innerHTML = `
        <div style="display:flex;justify-content:space-between;margin-bottom:16px">
            <span class="text-muted">${sessions.length} активных сессий</span>
            <button class="btn btn-sm btn-danger" id="btn-kill-all">🔌 Завершить все</button>
        </div>
        <div class="card" style="padding:0;overflow:hidden"><table>
            <thead><tr><th>Пользователь</th><th>IP / Устройство</th><th>Начало</th><th>Активность</th><th></th></tr></thead>
            <tbody>
                ${sessions.map(s => `<tr>
                    <td style="font-weight:600">${s.username || s.user_name || '—'}</td>
                    <td><div>${s.ip || '—'}</div><div style="font-size:11px;color:var(--text-muted)">${s.device || s.user_agent || ''}</div></td>
                    <td style="font-size:12px">${s.started_at ? new Date(s.started_at).toLocaleString('ru-RU') : '—'}</td>
                    <td style="font-size:12px">${s.last_activity ? new Date(s.last_activity).toLocaleTimeString('ru-RU') : '—'}</td>
                    <td><button class="btn btn-sm btn-secondary btn-kill-session" data-id="${s.id}" style="color:var(--danger)">✕</button></td>
                </tr>`).join('')}
                ${sessions.length === 0 ? '<tr><td colspan="5" style="text-align:center;padding:40px;color:var(--text-muted)">Нет активных сессий</td></tr>' : ''}
            </tbody>
        </table></div>`;

    document.getElementById('btn-kill-all')?.addEventListener('click', async () => {
        if (!confirm('Завершить ВСЕ сессии?')) return;
        try { await apiPost('/sessions/terminate-all'); showToast('Все сессии завершены', 'success'); refreshData(); } catch (e) { showToast('Ошибка: ' + (e.message || 'не удалось'), 'error'); }
    });
    document.querySelectorAll('.btn-kill-session').forEach(btn => btn.addEventListener('click', async function () {
        if (!confirm('Завершить сессию?')) return;
        try { await apiDelete('/sessions/' + this.dataset.id); showToast('Сессия завершена', 'success'); refreshData(); } catch (e) { showToast('Ошибка', 'error'); }
    }));
}

// ======== BACKUPS ========
async function renderBackups(area) {
    const res = await apiGet('/backup');
    const backups = res?.backups || [];

    area.innerHTML = `
        <div style="display:flex;justify-content:space-between;margin-bottom:16px">
            <span class="text-muted">${backups.length} копий</span>
            <button class="btn btn-primary" id="btn-create-backup">💾 Создать бэкап</button>
        </div>
        <div class="card" style="padding:0;overflow:hidden"><table>
            <thead><tr><th>Файл</th><th>Размер</th><th>Тип</th><th>Дата</th><th style="text-align:right">Действия</th></tr></thead>
            <tbody>
                ${backups.map(b => { const fname = b.name || b.filename || ''; const fid = b.id || encodeURIComponent(fname); const fsize = b.sizeHuman || b.size || '—'; const fdate = b.created_at || b.created || ''; const ftype = b.type || (fname.includes('auto') ? 'auto' : 'manual'); return `<tr>
                    <td style="font-weight:500">📦 ${fname}</td>
                    <td>${fsize}</td>
                    <td><span class="badge ${ftype === 'auto' ? 'badge-info' : 'badge-warning'}">${ftype === 'auto' ? 'Авто' : 'Ручной'}</span></td>
                    <td style="font-size:12px">${fdate ? new Date(fdate).toLocaleString('ru-RU') : '—'}</td>
                    <td style="text-align:right">
                        <button class="btn btn-sm btn-secondary btn-restore-backup" data-id="${fid}" data-name="${fname}">♻️</button>
                        <button class="btn btn-sm btn-secondary btn-delete-backup" data-id="${fid}" data-name="${fname}" style="color:var(--danger)">🗑️</button>
                    </td>
                </tr>`; }).join('')}
                ${backups.length === 0 ? '<tr><td colspan="5" style="text-align:center;padding:40px;color:var(--text-muted)">Нет бэкапов</td></tr>' : ''}
            </tbody>
        </table></div>`;

    document.getElementById('btn-create-backup')?.addEventListener('click', async () => {
        showToast('Создание...', 'info');
        try { await apiPost('/backup', { type: 'manual' }); showToast('Бэкап создан', 'success'); refreshData(); } catch (e) { showToast('Ошибка: ' + e.message, 'error'); }
    });
    document.querySelectorAll('.btn-restore-backup').forEach(btn => btn.addEventListener('click', async function () {
        if (!confirm('Восстановить из ' + this.dataset.name + '?')) return;
        try { await apiPost('/backup/' + this.dataset.id + '/restore'); showToast('Восстановление начато', 'success'); } catch (e) { showToast('Ошибка', 'error'); }
    }));
    document.querySelectorAll('.btn-delete-backup').forEach(btn => btn.addEventListener('click', async function () {
        if (!confirm('Удалить ' + this.dataset.name + '?')) return;
        try { await apiDelete('/backup/' + this.dataset.id); showToast('Удалено', 'success'); refreshData(); } catch (e) { showToast('Ошибка', 'error'); }
    }));
}

// ======== DATABASE ========
async function renderDatabase(area) {
    const res = await apiGet('/database/info');
    const db = res || { size: '—', tables: [] };
    const tables = db.tables || [];
    const totalRows = tables.reduce((sum, t) => sum + parseInt(t.rows || t.row_count || t.n_live_tup || 0), 0);
    const connInfo = db.connections || {};

    area.innerHTML = `
        <div style="display:flex;gap:16px;margin-bottom:20px;flex-wrap:wrap">
            <div class="stat-card" style="flex:1;min-width:150px;display:flex;align-items:center;gap:16px;border-left:4px solid var(--primary)">
                <div style="font-size:32px">🗄️</div><div><div class="stat-label">Размер БД</div><div class="stat-value">${db.size || '—'}</div></div>
            </div>
            <div class="stat-card" style="flex:1;min-width:150px;display:flex;align-items:center;gap:16px;border-left:4px solid var(--info)">
                <div style="font-size:32px">📊</div><div><div class="stat-label">Таблиц</div><div class="stat-value">${tables.length}</div></div>
            </div>
            <div class="stat-card" style="flex:1;min-width:150px;display:flex;align-items:center;gap:16px;border-left:4px solid var(--success)">
                <div style="font-size:32px">📝</div><div><div class="stat-label">Всего записей</div><div class="stat-value">${totalRows.toLocaleString()}</div></div>
            </div>
            <div class="stat-card" style="flex:1;min-width:150px;display:flex;align-items:center;gap:16px;border-left:4px solid var(--warning)">
                <div style="font-size:32px">🔌</div><div><div class="stat-label">Подключений</div><div class="stat-value">${connInfo.active || connInfo.total || '—'}</div></div>
            </div>
        </div>
        <div style="display:flex;gap:8px;margin-bottom:16px">
            <button class="btn btn-primary" id="btn-optimize-analyze">📊 Анализ</button>
            <button class="btn btn-secondary" id="btn-optimize-reindex">🔧 Переиндексация</button>
            <button class="btn btn-secondary" id="btn-optimize-vacuum">🧹 VACUUM</button>
        </div>
        <div class="card" style="padding:0;overflow:hidden;max-height:calc(100vh - 340px);overflow-y:auto"><table>
            <thead style="position:sticky;top:0;z-index:1"><tr><th>Таблица</th><th style="text-align:right">Записей</th><th style="text-align:right">Размер</th></tr></thead>
            <tbody>
                ${tables.map(t => { const tname = t.tablename || t.name || t.table_name || '—'; const trows = parseInt(t.rows || t.row_count || t.n_live_tup || 0); const tsize = t.size || t.total_size || '—'; return `<tr><td style="font-family:monospace">${tname}</td><td style="text-align:right">${trows.toLocaleString()}</td><td style="text-align:right;color:var(--text-muted)">${tsize}</td></tr>`; }).join('')}
                ${tables.length === 0 ? '<tr><td colspan="3" style="text-align:center;padding:40px;color:var(--text-muted)">Нет таблиц</td></tr>' : ''}
            </tbody>
        </table></div>`;

    document.getElementById('btn-optimize-analyze')?.addEventListener('click', async () => {
        if (!confirm('Запустить полный анализ БД?')) return;
        showToast('Запуск анализа...', 'info');
        try { await apiPost('/database/optimize', { type: 'analyze' }); showToast('Анализ завершён', 'success'); refreshData(); } catch (e) { showToast('Ошибка: ' + (e.message || ''), 'error'); }
    });
    document.getElementById('btn-optimize-reindex')?.addEventListener('click', async () => {
        if (!confirm('Переиндексировать все таблицы? Это может занять время.')) return;
        showToast('Переиндексация...', 'info');
        try { await apiPost('/database/optimize', { type: 'reindex' }); showToast('Переиндексация завершена', 'success'); refreshData(); } catch (e) { showToast('Ошибка: ' + (e.message || ''), 'error'); }
    });
    document.getElementById('btn-optimize-vacuum')?.addEventListener('click', async () => {
        if (!confirm('Запустить VACUUM ANALYZE?')) return;
        showToast('VACUUM...', 'info');
        try { await apiPost('/database/vacuum', { analyze: true }); showToast('VACUUM завершён', 'success'); refreshData(); } catch (e) { showToast('Ошибка: ' + (e.message || ''), 'error'); }
    });
}

// ======== LOGS ========
async function renderLogs(area) {
    const res = await apiGet('/system/logs?limit=200&type=' + logFilter);
    const allLogs = res?.logs || [];

    // Поиск по тексту
    const q = logSearch.toLowerCase();
    const logs = q ? allLogs.filter(l => (l.message || '').toLowerCase().includes(q)) : allLogs;

    area.innerHTML = `
        <div class="filter-bar">
            ${['all', 'info', 'warning', 'error'].map(t => `<button class="filter-btn ${logFilter === t ? 'active' : ''}" data-filter="${t}">${t === 'all' ? '📋 Все' : t === 'info' ? '🟢 Info' : t === 'warning' ? '🟡 Warning' : '🔴 Error'}</button>`).join('')}
        </div>
        <div class="search-bar" style="margin-bottom:12px">
            <input id="log-search" placeholder="🔍 Поиск по тексту сообщения..." value="${escapeHtml(logSearch)}">
            <span class="text-muted" style="white-space:nowrap">${logs.length} из ${allLogs.length}</span>
        </div>
        <div class="card" style="padding:0;overflow:hidden;max-height:calc(100vh - 300px);overflow-y:auto"><table>
            <thead style="position:sticky;top:0;z-index:1"><tr><th style="width:90px">Уровень</th><th>Сообщение</th><th style="width:170px;text-align:right">Время</th></tr></thead>
            <tbody>
                ${logs.map(l => { const msg = escapeHtml(l.message); const highlighted = q ? msg.replace(new RegExp('(' + q.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + ')', 'gi'), '<mark style="background:#f59e0b40;color:var(--warning);border-radius:2px;padding:0 2px">$1</mark>') : msg; return `<tr><td><span class="badge ${l.level === 'error' ? 'badge-danger' : l.level === 'warning' ? 'badge-warning' : 'badge-success'}">${l.level}</span></td><td class="log-entry">${highlighted}</td><td style="text-align:right;color:var(--text-muted);font-size:11px">${new Date(l.created_at || l.timestamp).toLocaleString('ru-RU')}</td></tr>`; }).join('')}
                ${logs.length === 0 ? '<tr><td colspan="3" style="text-align:center;padding:40px;color:var(--text-muted)">Нет логов</td></tr>' : ''}
            </tbody>
        </table></div>`;

    document.querySelectorAll('.filter-btn').forEach(btn => btn.addEventListener('click', function () {
        logFilter = this.dataset.filter;
        refreshData();
    }));
    bindSearch('log-search', v => { logSearch = v; refreshData(); });
}

// ======== LICENSES ========
async function renderLicenses(area) {
    const res = await apiGet('/license/admin/licenses');
    const allLicenses = res?.licenses || (Array.isArray(res) ? res : []);

    // Поиск
    const q = licenseSearch.toLowerCase();
    let filtered = q ? allLicenses.filter(l => (l.customer_name || '').toLowerCase().includes(q) || (l.company_name || '').toLowerCase().includes(q) || (l.customer_username || '').toLowerCase().includes(q) || (l.license_key || '').toLowerCase().includes(q) || (l.customer_email || '').toLowerCase().includes(q)) : [...allLicenses];

    // Сортировка
    if (sortColumn) { filtered = sortData(filtered, sortColumn, sortDir); }

    // Пагинация
    const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
    if (licensePage > totalPages) licensePage = totalPages;
    const start = (licensePage - 1) * PAGE_SIZE;
    const licenses = filtered.slice(start, start + PAGE_SIZE);

    const thSort = (key, label) => `<th class="sortable ${sortColumn === key ? 'sort-' + sortDir : ''}" data-sort="${key}">${label}</th>`;

    area.innerHTML = `
        <div style="display:flex;justify-content:space-between;margin-bottom:16px;align-items:center">
            <span class="text-muted">${filtered.length} из ${allLicenses.length} лицензий</span>
            <div style="display:flex;gap:8px">
                <button class="btn btn-secondary" id="btn-export-licenses">📥 CSV</button>
                <button class="btn btn-secondary" id="btn-license-history">📜 История</button>
                <button class="btn btn-primary" id="btn-create-license">🔑 Выдать лицензию</button>
            </div>
        </div>
        <div class="search-bar">
            <input id="license-search" placeholder="🔍 Поиск по клиенту, компании, логину или ключу..." value="${escapeHtml(licenseSearch)}">
        </div>
        <div class="card" style="padding:0;overflow:hidden"><table>
            <thead><tr>${thSort('customer_name', 'Клиент')}<th>Ключ</th><th>Логин</th>${thSort('license_type', 'Тип')}<th>Сервер</th>${thSort('active_devices', 'Устр.')}
${thSort('status', 'Статус')}${thSort('expires_at', 'Истекает')}<th style="text-align:right">Действия</th></tr></thead>
            <tbody>
                ${licenses.map(l => `<tr>
                    <td><div style="font-weight:600">${l.customer_name || '—'}</div><div style="font-size:11px;color:var(--text-muted)">${l.company_name || l.customer_email || ''}</div></td>
                    <td style="font-family:monospace;font-size:11px;word-break:break-all;min-width:160px">${l.license_key || '—'}</td>
                    <td style="font-size:12px">${l.customer_username || '—'}</td>
                    <td><span class="badge ${licTypeBadge(l.license_type)}">${licTypeLabel(l.license_type)}${l.license_type === 'trial' ? ' (' + (l.trial_days || '?') + 'д)' : ''}</span></td>
                    <td><span class="badge ${l.server_type === 'self_hosted' ? 'badge-info' : 'badge-purple'}">${l.server_type === 'self_hosted' ? '🖥️ Свой' : '☁️ Облако'}</span>${l.server_url ? '<div style="font-size:10px;color:var(--text-muted);max-width:100px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap" title="' + escapeHtml(l.server_url) + '">' + escapeHtml(l.server_url) + '</div>' : ''}</td>
                    <td style="text-align:center">${l.active_devices || 0}/${l.max_devices || 1}</td>
                    <td><span class="badge ${l.status === 'active' ? 'badge-success' : l.status === 'expired' ? 'badge-danger' : 'badge-warning'}">${l.status === 'active' ? 'Активна' : l.status === 'expired' ? 'Истекла' : l.status === 'suspended' ? 'Приост.' : l.status || '—'}</span></td>
                    <td style="font-size:11px;color:var(--text-muted)">${l.expires_at ? new Date(l.expires_at).toLocaleDateString('ru-RU') : '∞'}</td>
                    <td style="text-align:right;white-space:nowrap">
                        <button class="btn btn-sm btn-secondary btn-edit-license" data-id="${l.id}" data-status="${l.status}" data-devices="${l.max_devices}" data-users="${l.max_users}" data-server-type="${l.server_type || 'cloud'}" data-server-url="${l.server_url || ''}" title="Редактировать">✏️</button>
                        <button class="btn btn-sm btn-secondary btn-team" data-id="${l.id}" data-name="${l.customer_name}" data-key="${l.license_key}" title="Сотрудники">👥</button>
                        <button class="btn btn-sm btn-secondary btn-reset-creds" data-id="${l.id}" data-name="${l.customer_name}" title="Сбросить логин/пароль">🔑</button>
                        <button class="btn btn-sm btn-secondary btn-copy-key" data-key="${l.license_key}" title="Копировать ключ">📋</button>
                        <button class="btn btn-sm btn-secondary btn-delete-license" data-id="${l.id}" data-name="${l.customer_name}" data-key="${(l.license_key || '').substring(0, 12)}" style="color:var(--danger)" title="Удалить лицензию">🗑️</button>
                    </td>
                </tr>`).join('')}
                ${licenses.length === 0 ? '<tr><td colspan="9" style="text-align:center;padding:40px;color:var(--text-muted)">Нет результатов</td></tr>' : ''}
            </tbody>
        </table></div>
        ${renderPagination(licensePage, totalPages, 'licensePage')}`;

    // Bind all events
    document.getElementById('btn-create-license')?.addEventListener('click', showCreateLicenseModal);
    bindSortHeaders();

    document.querySelectorAll('.btn-edit-license').forEach(btn => btn.addEventListener('click', function () {
        const id = this.dataset.id;
        const ds = this.dataset;
        showModal('✏️ Редактировать лицензию', `
            <div class="form-group"><label>Статус</label>
                <select id="edit-status"><option value="active" ${ds.status === 'active' ? 'selected' : ''}>Активна</option><option value="suspended" ${ds.status === 'suspended' ? 'selected' : ''}>Приостановлена</option><option value="expired" ${ds.status === 'expired' ? 'selected' : ''}>Истекла</option></select>
            </div>
            <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px">
                <div class="form-group"><label>Макс. устройств</label><input id="edit-devices" type="number" value="${ds.devices || 1}" min="1" max="100"></div>
                <div class="form-group"><label>Макс. пользователей</label><input id="edit-users" type="number" value="${ds.users || 5}" min="1" max="100"></div>
            </div>
            <div class="form-group"><label>Срок действия</label><input id="edit-expires" type="date"></div>
            <hr style="border-color:var(--border);margin:16px 0">
            <h4 style="margin-bottom:12px">🖥️ Сервер клиента</h4>
            <div class="form-group"><label>Тип сервера</label>
                <select id="edit-server-type"><option value="cloud" ${ds.serverType === 'cloud' ? 'selected' : ''}>☁️ Облачный (Railway)</option><option value="self_hosted" ${ds.serverType === 'self_hosted' ? 'selected' : ''}>🖥️ Свой сервер</option></select>
            </div>
            <div class="form-group" id="edit-server-url-group" style="${ds.serverType !== 'self_hosted' ? 'display:none' : ''}"><label>URL сервера</label><input id="edit-server-url" value="${ds.serverUrl || ''}" placeholder="http://192.168.1.100:5000"></div>
        `, async () => {
            const body = {};
            const status = document.getElementById('edit-status').value;
            const devices = document.getElementById('edit-devices').value;
            const users = document.getElementById('edit-users').value;
            const expires = document.getElementById('edit-expires').value;
            const serverType = document.getElementById('edit-server-type').value;
            const serverUrl = document.getElementById('edit-server-url').value;
            if (status) body.status = status;
            if (devices) body.max_devices = parseInt(devices);
            if (users) body.max_users = parseInt(users);
            if (expires) body.expires_at = new Date(expires).toISOString();
            if (serverType) body.server_type = serverType;
            if (serverType === 'self_hosted' && serverUrl) body.server_url = serverUrl;
            await apiPut('/license/admin/licenses/' + id, body);
            showToast('Лицензия обновлена', 'success');
            closeModal(); refreshData();
        });
        // Server type toggle
        setTimeout(() => {
            document.getElementById('edit-server-type')?.addEventListener('change', function () {
                document.getElementById('edit-server-url-group').style.display = this.value === 'self_hosted' ? '' : 'none';
            });
        }, 100);
    }));

    // Delete license — TWO-STEP: export then delete
    document.querySelectorAll('.btn-delete-license').forEach(btn => btn.addEventListener('click', async function () {
        const id = this.dataset.id;
        const name = this.dataset.name;
        const key = this.dataset.key;
        
        showModal('🗑️ Удаление лицензии: ' + name, `
            <div style="background:var(--danger-bg, #fff3f3); border:1px solid var(--danger, #dc3545); border-radius:8px; padding:16px; margin-bottom:16px">
                <strong style="color:var(--danger, #dc3545)">⚠️ Внимание!</strong>
                <p style="margin:8px 0 0 0; font-size:13px">Перед удалением необходимо <strong>сохранить все данные</strong> клиента на компьютер. После экспорта кнопка удаления станет активной.</p>
            </div>
            <div id="export-status" style="margin-bottom:16px">
                <p style="color:var(--text-muted); font-size:13px">📊 Загрузка статистики данных...</p>
            </div>
            <div style="display:flex; gap:12px; flex-wrap:wrap">
                <button class="btn btn-primary" id="btn-export-license-data" style="flex:1">
                    💾 Шаг 1: Сохранить все данные клиента
                </button>
                <button class="btn btn-sm" id="btn-delete-confirmed" disabled style="flex:1; background:var(--danger, #dc3545); color:#fff; opacity:0.5; cursor:not-allowed">
                    🗑️ Шаг 2: Удалить лицензию
                </button>
            </div>
            <p id="export-result" style="margin-top:12px; font-size:12px; color:var(--text-muted)"></p>
        `);

        // Load stats
        setTimeout(async () => {
            const statusEl = document.getElementById('export-status');
            try {
                const data = await apiGet('/license/' + id + '/export');
                if (data && data.stats) {
                    const s = data.stats;
                    statusEl.innerHTML = `
                        <div style="background:var(--bg-secondary, #f8f9fa); border-radius:8px; padding:12px; font-size:13px">
                            <strong>📦 Данные лицензии "${name}":</strong>
                            <div style="display:grid; grid-template-columns:1fr 1fr; gap:4px 16px; margin-top:8px">
                                <span>👥 Сотрудников: <strong>${s.employees}</strong></span>
                                <span>📦 Товаров: <strong>${s.products}</strong></span>
                                <span>🧾 Продаж: <strong>${s.sales}</strong></span>
                                <span>📥 Закупок: <strong>${s.purchases}</strong></span>
                                <span>👤 Клиентов: <strong>${s.customers}</strong></span>
                                <span>📊 Движений: <strong>${s.inventory_movements}</strong></span>
                                <span>🏢 Складов: <strong>${s.warehouses}</strong></span>
                                <span>📱 Устройств: <strong>${s.device_activations}</strong></span>
                            </div>
                        </div>
                    `;
                }
            } catch (e) {
                statusEl.innerHTML = '<p style="color:var(--danger)">Ошибка загрузки статистики</p>';
            }
        }, 100);

        // Step 1: Export
        setTimeout(() => {
            document.getElementById('btn-export-license-data')?.addEventListener('click', async function () {
                this.disabled = true;
                this.innerHTML = '⏳ Экспорт данных...';
                const resultEl = document.getElementById('export-result');
                try {
                    const data = await apiGet('/license/' + id + '/export');
                    if (!data) throw new Error('Нет данных');
                    
                    // Скачать JSON файл
                    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
                    const url = URL.createObjectURL(blob);
                    const a = document.createElement('a');
                    a.href = url;
                    a.download = `license_backup_${name.replace(/[^a-zA-Zа-яА-Я0-9]/g, '_')}_${new Date().toISOString().split('T')[0]}.json`;
                    document.body.appendChild(a);
                    a.click();
                    document.body.removeChild(a);
                    URL.revokeObjectURL(url);

                    this.innerHTML = '✅ Данные сохранены!';
                    this.style.background = 'var(--success, #28a745)';
                    this.style.color = '#fff';
                    resultEl.innerHTML = `<span style="color:var(--success, #28a745)">✅ Файл бэкапа скачан. Теперь можно удалить лицензию.</span>`;

                    // Активировать кнопку удаления
                    const delBtn = document.getElementById('btn-delete-confirmed');
                    delBtn.disabled = false;
                    delBtn.style.opacity = '1';
                    delBtn.style.cursor = 'pointer';
                } catch (e) {
                    this.disabled = false;
                    this.innerHTML = '💾 Повторить экспорт';
                    resultEl.innerHTML = `<span style="color:var(--danger)">❌ Ошибка экспорта: ${e.message}</span>`;
                }
            });

            // Step 2: Delete (only after export)
            document.getElementById('btn-delete-confirmed')?.addEventListener('click', async function () {
                if (this.disabled) return;
                if (!confirm(`❗ ПОСЛЕДНЕЕ ПРЕДУПРЕЖДЕНИЕ!\n\nУдалить лицензию "${name}" (${key}...)?\n\nВсе товары, продажи, сотрудники и данные будут БЕЗВОЗВРАТНО удалены из базы!\n\nБэкап уже сохранён на ваш компьютер.`)) return;
                
                this.disabled = true;
                this.innerHTML = '⏳ Удаление...';
                try {
                    const result = await apiDelete('/license/' + id + '?confirmed=true');
                    showToast('✅ Лицензия удалена: ' + name, 'success');
                    closeModal();
                    refreshData();
                } catch (e) {
                    showToast('❌ Ошибка удаления: ' + e.message, 'error');
                    this.disabled = false;
                    this.innerHTML = '🗑️ Повторить удаление';
                }
            });
        }, 200);
    }));

    document.querySelectorAll('.btn-team').forEach(btn => btn.addEventListener('click', function () {
        showTeamModal(this.dataset.id, this.dataset.name, this.dataset.key);
    }));

    document.querySelectorAll('.btn-reset-creds').forEach(btn => btn.addEventListener('click', function () {
        const id = this.dataset.id;
        const name = this.dataset.name;
        showModal('🔑 Сброс данных: ' + name, `
            <div class="form-group"><label>Новый логин</label><input id="reset-login" placeholder="Оставьте пустым если не менять"></div>
            <div class="form-group"><label>Новый пароль</label><input id="reset-pass" type="password" placeholder="Минимум 6 символов"></div>
        `, async () => {
            const body = {};
            const login = document.getElementById('reset-login').value;
            const pass = document.getElementById('reset-pass').value;
            if (login) body.new_username = login;
            if (pass) body.new_password = pass;
            if (!login && !pass) { showToast('Введите данные', 'error'); return; }
            await apiPost('/license/admin/licenses/' + id + '/reset-credentials', body);
            showToast('Данные обновлены', 'success');
            closeModal(); refreshData();
        });
    }));

    document.querySelectorAll('.btn-copy-key').forEach(btn => btn.addEventListener('click', async function () {
        try { await navigator.clipboard.writeText(this.dataset.key); showToast('Ключ скопирован', 'success'); } catch { showToast('Не удалось', 'error'); }
    }));

    // Delete license — handled by two-step modal above (lines 489-599)
    // No duplicate handler needed here

    // History sub-tab button
    document.getElementById('btn-license-history')?.addEventListener('click', renderLicenseHistory);
    bindSearch('license-search', v => { licenseSearch = v; licensePage = 1; refreshData(); });
    bindPagination('licensePage');
    document.getElementById('btn-export-licenses')?.addEventListener('click', () => {
        exportCSV(allLicenses.map(l => ({ 'Клиент': l.customer_name, 'Компания': l.company_name || '', 'Логин': l.customer_username || '', 'Ключ': l.license_key, 'Тип': l.license_type, 'Статус': l.status, 'Устройств': (l.active_devices || 0) + '/' + (l.max_devices || 1), 'Истекает': l.expires_at ? new Date(l.expires_at).toLocaleDateString('ru-RU') : '∞' })), 'licenses');
    });
}

function licTypeLabel(t) {
    const m = { trial: 'Пробная', monthly: 'Месячная', yearly: 'Годовая', lifetime: 'Бессрочная' };
    return m[t] || t || '—';
}
function licTypeBadge(t) {
    const m = { trial: 'badge-warning', monthly: 'badge-info', yearly: 'badge-info', lifetime: 'badge-purple' };
    return m[t] || 'badge-info';
}

async function renderLicenseHistory() {
    const area = document.getElementById('content-area');
    const res = await apiGet('/license/admin/history');
    const history = res?.history || (Array.isArray(res) ? res : []);

    const actionLabels = {
        'created': '🆕 Создана', 'updated': '✏️ Обновлена', 'credentials_reset': '🔑 Сброс пароля',
        'device_activated': '📱 Активация', 'device_deactivated': '📴 Деактивация',
        'customer_device_registered': '📲 Регистрация', 'customer_device_removed': '🗑️ Удаление',
        'expired': '⏰ Истекла', 'suspended': '⛔ Приостановлена'
    };

    area.innerHTML = `
        <div style="display:flex;justify-content:space-between;margin-bottom:16px">
            <span class="text-muted">${history.length} записей</span>
            <button class="btn btn-secondary" id="btn-back-licenses">⬅️ Назад к лицензиям</button>
        </div>
        <div class="card" style="padding:0;overflow:hidden;max-height:calc(100vh - 260px);overflow-y:auto"><table>
            <thead style="position:sticky;top:0;z-index:1"><tr><th>Действие</th><th>Лицензия</th><th>Клиент</th><th>Кем</th><th>Детали</th><th style="text-align:right">Дата</th></tr></thead>
            <tbody>
                ${history.map(h => `<tr>
                    <td><span class="badge ${h.action === 'created' ? 'badge-success' : h.action?.includes('device') ? 'badge-info' : 'badge-warning'}">${actionLabels[h.action] || h.action}</span></td>
                    <td style="font-family:monospace;font-size:11px">${(h.license_key || '').substring(0, 12) || '—'}...</td>
                    <td style="font-size:13px">${h.customer_name || h.company_name || '—'}</td>
                    <td style="font-size:12px;color:var(--text-muted)">${h.performed_by_username || 'Система'}</td>
                    <td style="font-size:11px;color:var(--text-muted);font-family:monospace;max-width:150px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${h.details ? (typeof h.details === 'string' ? h.details.substring(0, 40) : JSON.stringify(h.details).substring(0, 40)) : '—'}</td>
                    <td style="text-align:right;font-size:12px;color:var(--text-muted)">${new Date(h.created_at).toLocaleString('ru-RU')}</td>
                </tr>`).join('')}
                ${history.length === 0 ? '<tr><td colspan="6" style="text-align:center;padding:40px;color:var(--text-muted)">История пуста</td></tr>' : ''}
            </tbody>
        </table></div>`;

    document.getElementById('btn-back-licenses')?.addEventListener('click', () => refreshData());
}

function showCreateLicenseModal() {
    showModal('🔑 Выдать лицензию', `
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px">
            <div class="form-group"><label>Имя клиента *</label><input id="lic-name" placeholder="ФИО клиента"></div>
            <div class="form-group"><label>Компания</label><input id="lic-company" placeholder="Название компании"></div>
            <div class="form-group"><label>Email</label><input id="lic-email" placeholder="email@example.com"></div>
            <div class="form-group"><label>Телефон</label><input id="lic-phone" placeholder="+998 90 123 45 67"></div>
            <div class="form-group"><label>Логин клиента *</label><input id="lic-login" placeholder="Логин для входа"></div>
            <div class="form-group"><label>Пароль клиента *</label><input id="lic-pass" type="password" placeholder="Мин. 6 символов"></div>
        </div>
        <hr style="border-color:var(--border);margin:16px 0">
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px">
            <div class="form-group"><label>Тип лицензии *</label>
                <select id="lic-type">
                    <option value="trial">🕐 Пробная (Trial)</option>
                    <option value="monthly">📅 Месячная</option>
                    <option value="yearly">📆 Годовая</option>
                    <option value="lifetime" selected>♾️ Бессрочная</option>
                </select>
            </div>
            <div class="form-group" id="trial-days-group" style="display:none">
                <label>Дней пробного периода *</label>
                <input id="lic-trial-days" type="number" value="14" min="1" max="365" placeholder="14">
            </div>
            <div class="form-group"><label>Макс. устройств</label><input id="lic-devices" type="number" value="3" min="1" max="100"></div>
            <div class="form-group"><label>Макс. пользователей</label><input id="lic-max-users" type="number" value="5" min="1" max="100"></div>
        </div>
        <hr style="border-color:var(--border);margin:16px 0">
        <h4 style="margin-bottom:12px">🖥️ Сервер клиента</h4>
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px">
            <div class="form-group"><label>Тип сервера</label>
                <select id="lic-server-type">
                    <option value="cloud">☁️ Облачный (Railway)</option>
                    <option value="self_hosted">🖥️ Свой сервер</option>
                </select>
            </div>
            <div class="form-group" id="server-url-group" style="display:none">
                <label>URL сервера *</label>
                <input id="lic-server-url" placeholder="http://192.168.1.100:5000">
            </div>
        </div>
        <div class="form-group"><label>Функции (JSON)</label><input id="lic-features" value='{"pos":true,"inventory":true,"reports":true}'></div>
    `, async () => {
        const licType = document.getElementById('lic-type').value;
        const data = {
            customer_name: document.getElementById('lic-name').value,
            company_name: document.getElementById('lic-company').value,
            customer_email: document.getElementById('lic-email').value,
            customer_phone: document.getElementById('lic-phone').value,
            customer_username: document.getElementById('lic-login').value,
            customer_password: document.getElementById('lic-pass').value,
            license_type: licType,
            max_devices: parseInt(document.getElementById('lic-devices').value) || 3,
            max_users: parseInt(document.getElementById('lic-max-users').value) || 5,
            server_type: document.getElementById('lic-server-type').value,
            features: document.getElementById('lic-features').value
        };
        // Trial days
        if (licType === 'trial') {
            data.trial_days = parseInt(document.getElementById('lic-trial-days').value) || 14;
            if (data.trial_days < 1) { showToast('Укажите дни пробного периода', 'error'); return; }
        }
        // Self-hosted URL
        if (data.server_type === 'self_hosted') {
            data.server_url = document.getElementById('lic-server-url').value;
            if (!data.server_url) { showToast('Укажите URL сервера', 'error'); return; }
        }
        if (!data.customer_name || !data.customer_username || !data.customer_password) { showToast('Заполните обязательные поля', 'error'); return; }
        if (data.customer_password.length < 6) { showToast('Пароль минимум 6 символов', 'error'); return; }
        try { data.features = JSON.parse(data.features); } catch { data.features = {}; }

        const res = await apiPost('/license/admin/licenses', data);
        const key = res.license?.license_key || '';
        showToast('Лицензия создана! Ключ: ' + key.substring(0, 16) + '...', 'success');
        closeModal(); refreshData();
    }, 'wide');

    // Toggle trial days and server URL visibility
    setTimeout(() => {
        document.getElementById('lic-type')?.addEventListener('change', function () {
            document.getElementById('trial-days-group').style.display = this.value === 'trial' ? '' : 'none';
        });
        document.getElementById('lic-server-type')?.addEventListener('change', function () {
            document.getElementById('server-url-group').style.display = this.value === 'self_hosted' ? '' : 'none';
        });
    }, 100);
}

// ======== TEAM MEMBERS (Сотрудники клиента) ========
async function showTeamModal(licenseId, customerName, licenseKey) {
    // Load existing team members for this license
    let teamHtml = '<div style="text-align:center;padding:20px;color:var(--text-muted)">Загрузка...</div>';

    showModal('👥 Сотрудники: ' + customerName, `
        <div id="team-list">${teamHtml}</div>
        <hr style="border-color:var(--border);margin:16px 0">
        <h4 style="margin-bottom:12px">➕ Добавить сотрудника</h4>
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px">
            <div class="form-group"><label>Логин *</label><input id="tm-login" placeholder="cashier1"></div>
            <div class="form-group"><label>ФИО *</label><input id="tm-name" placeholder="Иванов Иван"></div>
            <div class="form-group"><label>Email</label><input id="tm-email" placeholder="user@company.com"></div>
            <div class="form-group"><label>Пароль *</label><input id="tm-pass" type="password" placeholder="Мин. 6 символов"></div>
            <div class="form-group"><label>Роль *</label>
                <select id="tm-level">
                    <option value="shop_admin">🏪 Админ магазина</option>
                    <option value="seller" selected>🛒 Продавец/Кассир</option>
                </select>
            </div>
        </div>
        <button class="btn btn-primary" id="btn-add-team" style="width:100%;margin-top:8px">➕ Добавить сотрудника</button>
    `, null, 'wide');

    // Remove confirm button since we handle it via the add button
    setTimeout(() => {
        const confirmBtn = document.getElementById('modal-confirm-btn');
        if (confirmBtn) confirmBtn.style.display = 'none';

        // Load team members
        loadTeamMembers(licenseId, licenseKey);

        // Add team member button
        document.getElementById('btn-add-team')?.addEventListener('click', async () => {
            const data = {
                license_key: licenseKey,
                username: document.getElementById('tm-login').value,
                full_name: document.getElementById('tm-name').value,
                email: document.getElementById('tm-email').value || undefined,
                password: document.getElementById('tm-pass').value,
                user_level: document.getElementById('tm-level').value
            };
            if (!data.username || !data.full_name || !data.password) { showToast('Заполните обязательные поля', 'error'); return; }
            if (data.password.length < 6) { showToast('Пароль минимум 6 символов', 'error'); return; }
            try {
                await apiPost('/license/create-team-member', data);
                showToast('Сотрудник добавлен: ' + data.username, 'success');
                // Reset fields
                document.getElementById('tm-login').value = '';
                document.getElementById('tm-name').value = '';
                document.getElementById('tm-email').value = '';
                document.getElementById('tm-pass').value = '';
                loadTeamMembers(licenseId, licenseKey);
            } catch (e) { showToast('Ошибка: ' + e.message, 'error'); }
        });
    }, 100);
}

async function loadTeamMembers(licenseId, licenseKey) {
    const listEl = document.getElementById('team-list');
    if (!listEl) return;

    const res = await apiGet('/license/admin/licenses/' + licenseId + '/team');
    const members = res?.users || res?.team || (Array.isArray(res) ? res : []);

    if (members.length === 0) {
        listEl.innerHTML = '<div style="text-align:center;padding:20px;color:var(--text-muted)">Нет сотрудников. Добавьте первого ниже.</div>';
        return;
    }

    listEl.innerHTML = `<table>
        <thead><tr><th>Сотрудник</th><th>Логин</th><th>Роль</th><th>Статус</th></tr></thead>
        <tbody>
            ${members.map(m => `<tr>
                <td><div style="display:flex;align-items:center;gap:8px"><div class="avatar" style="width:28px;height:28px;font-size:11px">${(m.full_name || m.username || '?')[0].toUpperCase()}</div><span style="font-weight:500">${m.full_name || m.username}</span></div></td>
                <td style="font-family:monospace;font-size:12px">${m.username}</td>
                <td><span class="badge ${m.user_level === 'shop_admin' ? 'badge-warning' : 'badge-info'}">${m.user_level === 'shop_admin' ? '🏪 Админ' : m.user_level === 'seller' ? '🛒 Продавец' : m.role || m.user_level}</span></td>
                <td><span class="status-dot ${m.is_active !== false ? 'status-online' : 'status-offline'}"></span></td>
            </tr>`).join('')}
        </tbody>
    </table>`;
}

// ======== SETTINGS ========
async function renderSettings(area) {
    const healthData = await apiGet('/health');
    const serverVersion = healthData?.version || '3.0.0';

    area.innerHTML = `
        <div class="card"><h3 style="margin-bottom:16px">🔗 Подключение</h3>
            <div style="display:grid;grid-template-columns:1fr 1fr;gap:16px">
                <div style="padding:12px;background:var(--bg-tertiary);border-radius:8px"><div style="font-size:12px;color:var(--text-muted)">Сервер</div><div style="font-weight:600;margin-top:4px">${API_URL}</div></div>
                <div style="padding:12px;background:var(--bg-tertiary);border-radius:8px"><div style="font-size:12px;color:var(--text-muted)">Статус</div><div style="font-weight:600;margin-top:4px;color:var(--success)">🟢 Подключено</div></div>
            </div>
        </div>
        <div class="card" style="margin-top:16px"><h3 style="margin-bottom:16px">ℹ️ О системе</h3>
            <div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:16px">
                <div style="padding:12px;background:var(--bg-tertiary);border-radius:8px"><div style="font-size:12px;color:var(--text-muted)">SmartPOS Pro</div><div style="font-weight:600;margin-top:4px">v${serverVersion}</div></div>
                <div style="padding:12px;background:var(--bg-tertiary);border-radius:8px"><div style="font-size:12px;color:var(--text-muted)">Админ-панель</div><div style="font-weight:600;margin-top:4px">v3.2.0</div></div>
                <div style="padding:12px;background:var(--bg-tertiary);border-radius:8px"><div style="font-size:12px;color:var(--text-muted)">Платформа</div><div style="font-weight:600;margin-top:4px">${window.electronAPI?.platform || navigator.platform}</div></div>
            </div>
        </div>
        <div class="card" style="margin-top:16px"><h3 style="margin-bottom:16px">🔐 Безопасность</h3>
            <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px">
                <div class="form-group"><label>Текущий пароль</label><input type="password" id="set-old-pass" placeholder="••••••"></div>
                <div class="form-group"><label>Новый пароль</label><input type="password" id="set-new-pass" placeholder="Мин. 6 символов"></div>
            </div>
            <button class="btn btn-primary" id="btn-change-pass" style="margin-top:8px">🔑 Сменить пароль</button>
        </div>
        <div class="card" style="margin-top:16px"><h3 style="margin-bottom:16px">🧹 Обслуживание</h3>
            <div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:12px">
                <button class="btn btn-secondary" id="btn-cleanup-30">🗑️ Логи > 30 дней</button>
                <button class="btn btn-secondary" id="btn-cleanup-90">🗑️ Логи > 90 дней</button>
                <button class="btn btn-secondary" id="btn-clear-alerts">🔔 Очистить алерты</button>
            </div>
        </div>
        <div class="card" style="margin-top:16px"><h3 style="margin-bottom:16px">🎨 Оформление</h3>
            <div style="display:flex;align-items:center;justify-content:space-between">
                <div><div style="font-weight:500">Тема интерфейса</div><div style="font-size:12px;color:var(--text-muted);margin-top:4px">${darkMode ? '🌙 Тёмная тема' : '☀️ Светлая тема'}</div></div>
                <button class="btn btn-secondary" id="btn-toggle-theme">${darkMode ? '☀️ Светлая' : '🌙 Тёмная'}</button>
            </div>
        </div>
        <div class="card" style="margin-top:16px"><h3 style="margin-bottom:16px">🔌 Действия</h3>
            <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px">
                <button class="btn btn-secondary" id="btn-clear-saved">🗑️ Удалить сохранённый логин</button>
                <button class="btn btn-danger" id="btn-logout" style="color:white">🚪 Выйти и забыть</button>
            </div>
        </div>`;

    document.getElementById('btn-change-pass')?.addEventListener('click', async () => {
        const old_password = document.getElementById('set-old-pass').value;
        const new_password = document.getElementById('set-new-pass').value;
        if (!old_password || !new_password) { showToast('Заполните оба поля', 'error'); return; }
        if (new_password.length < 6) { showToast('Мин. 6 символов', 'error'); return; }
        try {
            await apiPost('/auth/change-password', { old_password, new_password });
            showToast('Пароль изменён!', 'success');
            // Обновить сохранённый пароль
            localStorage.setItem('admin_pass', btoa(new_password));
            document.getElementById('set-old-pass').value = '';
            document.getElementById('set-new-pass').value = '';
        } catch (e) { showToast('Ошибка: ' + e.message, 'error'); }
    });
    document.getElementById('btn-cleanup-30')?.addEventListener('click', async () => {
        if (!confirm('Удалить логи старше 30 дней?')) return;
        showToast('Очистка...', 'info');
        try { const r = await apiPost('/database/cleanup', { older_than_days: 30 }); showToast(r.message || 'Очистка завершена', 'success'); } catch (e) { showToast('Ошибка: ' + (e.message || ''), 'error'); }
    });
    document.getElementById('btn-cleanup-90')?.addEventListener('click', async () => {
        if (!confirm('Удалить логи старше 90 дней?')) return;
        showToast('Очистка...', 'info');
        try { const r = await apiPost('/database/cleanup', { older_than_days: 90 }); showToast(r.message || 'Очистка завершена', 'success'); } catch (e) { showToast('Ошибка: ' + (e.message || ''), 'error'); }
    });
    document.getElementById('btn-clear-alerts')?.addEventListener('click', () => { alerts = []; updateNotifBell(); showToast('Алерты очищены', 'success'); });
    document.getElementById('btn-clear-saved')?.addEventListener('click', () => { localStorage.removeItem('admin_user'); localStorage.removeItem('admin_pass'); showToast('Логин/пароль удалены', 'success'); });
    document.getElementById('btn-logout')?.addEventListener('click', () => { disconnect(); });
    document.getElementById('btn-toggle-theme')?.addEventListener('click', () => { toggleTheme(); refreshData(); });
}

// ======== MODAL SYSTEM ========
function showModal(title, bodyHtml, onConfirm, cssClass = '') {
    closeModal();
    const overlay = document.createElement('div');
    overlay.className = 'modal-overlay';
    overlay.id = 'active-modal';
    overlay.innerHTML = `
        <div class="modal ${cssClass === 'wide' ? 'modal-wide' : ''}">
            <div class="modal-header"><h2>${title}</h2><button class="modal-close" id="modal-close-btn">✕</button></div>
            <div class="modal-body">${bodyHtml}</div>
            <div class="modal-footer">
                <button class="btn btn-secondary" id="modal-cancel-btn">Отмена</button>
                <button class="btn btn-primary" id="modal-confirm-btn">Подтвердить</button>
            </div>
        </div>`;
    document.body.appendChild(overlay);

    document.getElementById('modal-close-btn').addEventListener('click', closeModal);
    document.getElementById('modal-cancel-btn').addEventListener('click', closeModal);
    if (onConfirm) {
        document.getElementById('modal-confirm-btn').addEventListener('click', async () => {
            try { await onConfirm(); } catch (e) { showToast('Ошибка: ' + e.message, 'error'); }
        });
    } else {
        document.getElementById('modal-confirm-btn').style.display = 'none';
    }
    overlay.addEventListener('click', (e) => { if (e.target === overlay) closeModal(); });
}

function closeModal() {
    document.getElementById('active-modal')?.remove();
}

// ======== HELPERS ========
function formatBytes(b) {
    if (!b) return '0 B';
    const s = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(b) / Math.log(1024));
    return (b / Math.pow(1024, i)).toFixed(1) + ' ' + s[i];
}

function formatUptime(sec) {
    if (!sec) return '0с';
    const d = Math.floor(sec / 86400), h = Math.floor((sec % 86400) / 3600), m = Math.floor((sec % 3600) / 60);
    return d > 0 ? d + 'д ' + h + 'ч' : h > 0 ? h + 'ч ' + m + 'м' : m + 'м';
}

function escapeHtml(str) {
    if (!str) return '';
    return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

// ======== SEARCH + PAGINATION HELPERS ========
function bindSearch(id, callback) {
    let timer;
    document.getElementById(id)?.addEventListener('input', function () {
        clearTimeout(timer);
        const val = this.value;
        timer = setTimeout(() => callback(val), 300);
    });
}

function renderPagination(page, totalPages, varName) {
    if (totalPages <= 1) return '';
    let btns = '';
    btns += `<button ${page <= 1 ? 'disabled' : ''} data-page="${page - 1}" data-var="${varName}">◀</button>`;
    const range = 2;
    for (let i = 1; i <= totalPages; i++) {
        if (i === 1 || i === totalPages || Math.abs(i - page) <= range) {
            btns += `<button class="${i === page ? 'active' : ''}" data-page="${i}" data-var="${varName}">${i}</button>`;
        } else if (i === 2 && page > range + 2) {
            btns += '<span class="page-info">...</span>';
        } else if (i === totalPages - 1 && page < totalPages - range - 1) {
            btns += '<span class="page-info">...</span>';
        }
    }
    btns += `<button ${page >= totalPages ? 'disabled' : ''} data-page="${page + 1}" data-var="${varName}">▶</button>`;
    return `<div class="pagination">${btns}</div>`;
}

function bindPagination(varName) {
    document.querySelectorAll(`.pagination button[data-var="${varName}"]`).forEach(btn => {
        btn.addEventListener('click', function () {
            if (this.disabled) return;
            const p = parseInt(this.dataset.page);
            if (varName === 'userPage') userPage = p;
            else if (varName === 'licensePage') licensePage = p;
            refreshData();
        });
    });
}

// ======== CHART DRAWING ========
function drawMiniChart(canvasId, data, color, gradientEnd) {
    const canvas = document.getElementById(canvasId);
    if (!canvas || data.length < 2) return;
    const ctx = canvas.getContext('2d');
    const dpr = window.devicePixelRatio || 1;
    canvas.width = canvas.offsetWidth * dpr;
    canvas.height = canvas.offsetHeight * dpr;
    ctx.scale(dpr, dpr);
    const w = canvas.offsetWidth, h = canvas.offsetHeight;
    const max = Math.max(100, ...data);
    const padTop = 8, padBot = 4;
    const drawH = h - padTop - padBot;

    // Gradient fill
    const grad = ctx.createLinearGradient(0, 0, 0, h);
    grad.addColorStop(0, color + '40');
    grad.addColorStop(1, gradientEnd + '05');

    // Build path
    const step = w / (CHART_MAX_POINTS - 1);
    ctx.beginPath();
    data.forEach((v, i) => {
        const x = i * step;
        const y = padTop + drawH - (v / max) * drawH;
        if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
    });

    // Fill area
    const lastX = (data.length - 1) * step;
    ctx.lineTo(lastX, h); ctx.lineTo(0, h); ctx.closePath();
    ctx.fillStyle = grad; ctx.fill();

    // Stroke line
    ctx.beginPath();
    data.forEach((v, i) => {
        const x = i * step;
        const y = padTop + drawH - (v / max) * drawH;
        if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
    });
    ctx.strokeStyle = color; ctx.lineWidth = 2; ctx.lineJoin = 'round'; ctx.stroke();

    // Current value dot
    const lastV = data[data.length - 1];
    const lx = (data.length - 1) * step;
    const ly = padTop + drawH - (lastV / max) * drawH;
    ctx.beginPath(); ctx.arc(lx, ly, 4, 0, Math.PI * 2);
    ctx.fillStyle = color; ctx.fill();
    ctx.strokeStyle = '#0a0010'; ctx.lineWidth = 2; ctx.stroke();

    // Value label
    ctx.font = '11px Inter, sans-serif'; ctx.fillStyle = color;
    ctx.textAlign = 'right'; ctx.fillText(lastV.toFixed(1) + '%', w - 6, 16);

    // Threshold line at 80%
    const thY = padTop + drawH - (80 / max) * drawH;
    ctx.beginPath(); ctx.moveTo(0, thY); ctx.lineTo(w, thY);
    ctx.strokeStyle = '#ff003c40'; ctx.lineWidth = 1;
    ctx.setLineDash([4, 4]); ctx.stroke(); ctx.setLineDash([]);
}

// ======== ALERTS / NOTIFICATIONS ========
function checkAlerts(cpu, ram, metrics) {
    const now = new Date();
    if (cpu > 85) {
        addAlert('🔴', 'Высокая нагрузка CPU', `CPU: ${cpu.toFixed(1)}% (порог 85%)`, now);
    }
    if (ram > 85) {
        addAlert('🟠', 'Высокое потребление RAM', `RAM: ${ram.toFixed(1)}% (порог 85%)`, now);
    }
    if (metrics.database?.activeConnections > 50) {
        addAlert('🟡', 'Много подключений к БД', `${metrics.database.activeConnections} подключений`, now);
    }
}

function addAlert(icon, title, text, time) {
    // Дедупликация за последние 60 секунд
    const recent = alerts.find(a => a.title === title && (time - a.time) < 60000);
    if (recent) return;
    alerts.unshift({ icon, title, text, time });
    if (alerts.length > 50) alerts.pop();
    updateNotifBell();
}

function updateNotifBell() {
    const countEl = document.getElementById('notif-count');
    if (countEl) {
        countEl.textContent = alerts.length;
        countEl.style.display = alerts.length > 0 ? 'flex' : 'none';
    }
}

function toggleAlertsPanel() {
    alertsPanelOpen = !alertsPanelOpen;
    let panel = document.getElementById('alerts-panel');
    if (!panel) {
        panel = document.createElement('div');
        panel.id = 'alerts-panel';
        panel.className = 'alerts-panel';
        document.body.appendChild(panel);
    }
    if (alertsPanelOpen) {
        panel.classList.add('visible');
        if (alerts.length === 0) {
            panel.innerHTML = '<div style="padding:24px;text-align:center;color:var(--text-muted)">✅ Нет уведомлений</div>';
        } else {
            panel.innerHTML = `<div style="padding:12px 16px;border-bottom:1px solid var(--border);display:flex;justify-content:space-between;align-items:center">
                <strong style="font-size:13px">🔔 Уведомления (${alerts.length})</strong>
                <button class="btn btn-sm btn-secondary" onclick="alerts=[];updateNotifBell();toggleAlertsPanel();toggleAlertsPanel();">Очистить</button>
            </div>` + alerts.map(a => `<div class="alert-item">
                <span class="alert-icon">${a.icon}</span>
                <div class="alert-text"><strong>${a.title}</strong>${a.text}</div>
                <span class="alert-time">${a.time.toLocaleTimeString('ru-RU')}</span>
            </div>`).join('');
        }
    } else {
        panel.classList.remove('visible');
    }
}

// ======== CSV EXPORT ========
function exportCSV(rows, filename) {
    if (!rows.length) { showToast('Нет данных для экспорта', 'error'); return; }
    const headers = Object.keys(rows[0]);
    const csv = '\uFEFF' + headers.join(';') + '\n' + rows.map(r => headers.map(h => {
        let v = String(r[h] ?? '').replace(/"/g, '""');
        if (v.includes(';') || v.includes('"') || v.includes('\n')) v = '"' + v + '"';
        return v;
    }).join(';')).join('\n');

    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${filename}_${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    showToast(`Экспортировано ${rows.length} записей`, 'success');
}

// ======== THEME ========
function toggleTheme() {
    darkMode = !darkMode;
    localStorage.setItem('admin_theme', darkMode ? 'dark' : 'light');
    applyTheme();
}

function applyTheme() {
    const root = document.documentElement;
    if (darkMode) {
        // Neon dark theme
        root.style.setProperty('--bg-primary', '#0a0010');
        root.style.setProperty('--bg-secondary', '#120020');
        root.style.setProperty('--bg-tertiary', 'rgba(26, 0, 48, 0.8)');
        root.style.setProperty('--surface', 'rgba(20, 0, 40, 0.6)');
        root.style.setProperty('--text', '#f0e6ff');
        root.style.setProperty('--text-primary', '#f0e6ff');
        root.style.setProperty('--text-secondary', '#c9b0e8');
        root.style.setProperty('--text-muted', '#8a6aad');
        root.style.setProperty('--border', 'rgba(123, 47, 247, 0.2)');
        root.style.setProperty('--sidebar-bg', '#120020');
        document.body.style.background = '#0a0010';
        document.body.style.color = '#f0e6ff';
    } else {
        // Light theme
        root.style.setProperty('--bg-primary', '#f0f2f5');
        root.style.setProperty('--bg-secondary', '#ffffff');
        root.style.setProperty('--bg-tertiary', '#e8ecf1');
        root.style.setProperty('--surface', '#ffffff');
        root.style.setProperty('--text', '#1e293b');
        root.style.setProperty('--text-primary', '#1e293b');
        root.style.setProperty('--text-secondary', '#475569');
        root.style.setProperty('--text-muted', '#94a3b8');
        root.style.setProperty('--border', '#e2e8f0');
        root.style.setProperty('--sidebar-bg', '#1e1e2e');
        document.body.style.background = '#f0f2f5';
        document.body.style.color = '#1e293b';
    }
    updateThemeButton();
}

function updateThemeButton() {
    const btn = document.getElementById('btn-theme-toggle');
    if (btn) btn.innerHTML = darkMode ? '☀️ Светлая' : '🌙 Тёмная';
}

// ======== SIDEBAR TOGGLE (responsive) ========
function toggleSidebar() {
    const sidebar = document.querySelector('.sidebar');
    const isOpen = sidebar?.classList.toggle('sidebar-open');
    let backdrop = document.getElementById('sidebar-backdrop');
    if (isOpen) {
        if (!backdrop) {
            backdrop = document.createElement('div');
            backdrop.id = 'sidebar-backdrop';
            backdrop.className = 'sidebar-backdrop';
            backdrop.style.display = 'block';
            backdrop.addEventListener('click', closeSidebar);
            document.body.appendChild(backdrop);
        } else {
            backdrop.style.display = 'block';
        }
    } else {
        if (backdrop) backdrop.style.display = 'none';
    }
}

function closeSidebar() {
    const sidebar = document.querySelector('.sidebar');
    sidebar?.classList.remove('sidebar-open');
    const backdrop = document.getElementById('sidebar-backdrop');
    if (backdrop) backdrop.style.display = 'none';
}

function showToast(msg, type = 'info') {
    const c = document.getElementById('toast-container');
    const t = document.createElement('div');
    t.className = 'toast toast-' + type;
    t.textContent = msg;
    c.appendChild(t);
    setTimeout(() => t.remove(), 4000);
}

// ======== INIT ========
window.addEventListener('DOMContentLoaded', async () => {
    applyTheme();
    const savedUrl = localStorage.getItem('admin_server_url');
    const savedToken = localStorage.getItem('admin_token');
    const savedUser = localStorage.getItem('admin_user');
    const savedPass = localStorage.getItem('admin_pass');

    if (savedUrl) document.getElementById('server-url').value = savedUrl;
    if (savedUser) document.getElementById('login-user').value = savedUser;
    if (savedPass) document.getElementById('login-pass').value = atob(savedPass);

    // Автологин: пробуем сохранённый токен
    if (savedUrl && savedToken) {
        const status = document.getElementById('connect-status');
        status.className = 'connect-status'; status.textContent = '⏳ Автовход...';

        try {
            const res = await fetch(savedUrl + '/api/health', {
                headers: { 'Authorization': `Bearer ${savedToken}` }
            });

            if (res.ok) {
                // Проверка что токен рабочий — запрос к защищённому эндпоинту
                const testRes = await fetch(savedUrl + '/api/system/metrics', {
                    headers: { 'Authorization': `Bearer ${savedToken}`, 'Content-Type': 'application/json' }
                });

                if (testRes.ok) {
                    TOKEN = savedToken;
                    API_URL = savedUrl;
                    status.className = 'connect-status success';
                    status.textContent = '✅ Автовход!';
                    setTimeout(() => enterPanel(savedUrl), 300);
                    return;
                }
            }
        } catch (e) {
            console.log('[AutoLogin] Token check failed:', e.message);
        }

        // Токен протух — пробуем ре-логин с сохранёнными данными
        if (savedUser && savedPass) {
            status.textContent = '⏳ Повторный вход...';
            try {
                const res = await fetch(savedUrl + '/api/auth/login', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ username: savedUser, password: atob(savedPass) })
                });
                if (res.ok) {
                    const data = await res.json();
                    TOKEN = data.token;
                    API_URL = savedUrl;
                    localStorage.setItem('admin_token', TOKEN);
                    status.className = 'connect-status success';
                    status.textContent = '✅ Подключено!';
                    setTimeout(() => enterPanel(savedUrl), 300);
                    return;
                }
            } catch (e) {
                console.log('[AutoLogin] Re-login failed:', e.message);
            }
        }

        status.className = 'connect-status';
        status.textContent = '';
    }

    // Закрытие панели алертов при клике вне её
    document.addEventListener('click', (e) => {
        if (alertsPanelOpen && !e.target.closest('.alerts-panel') && !e.target.closest('.notif-bell')) {
            toggleAlertsPanel();
        }
    });

    // Enter на форме логина
    document.getElementById('login-pass')?.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') connectToServer();
    });
    document.getElementById('login-user')?.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') document.getElementById('login-pass').focus();
    });
});
