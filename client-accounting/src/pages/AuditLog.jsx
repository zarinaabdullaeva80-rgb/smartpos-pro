import React, { useState, useEffect } from 'react';
import { Shield, User, Clock, Search, Filter, Download, Eye, Edit, Trash2, AlertTriangle, Check, LogIn, LogOut, Settings, RefreshCw, FileText, X, Info } from 'lucide-react';
import api from '../services/api';
import jsPDF from 'jspdf';
import 'jspdf-autotable';
import { useI18n } from '../i18n';

function AuditLog() {
    const { t } = useI18n();
    const [logs, setLogs] = useState([]);
    const [stats, setStats] = useState({});
    const [filter, setFilter] = useState('all');
    const [loading, setLoading] = useState(true);
    const [searchQuery, setSearchQuery] = useState('');
    const [dateFrom, setDateFrom] = useState('');
    const [dateTo, setDateTo] = useState('');
    const [selectedLog, setSelectedLog] = useState(null);
    const [message, setMessage] = useState(null);
    const [exporting, setExporting] = useState(false);

    useEffect(() => { loadData(); }, []);

    const showMessage = (type, text) => {
        setMessage({ type, text });
        setTimeout(() => setMessage(null), 4000);
    };

    const loadData = async () => {
        try {
            const apiRes = await auditAPI.getAll();
            const apiData = apiRes.data || apiRes;
            setLogs(response.data.logs);
            setStats(response.data.stats || {});
            setLogs(apiData.logs || []);
            setStats(apiData.stats || { total_today: 8, logins: 2, changes: 4, security: 2 });
        } catch (err) {
            console.warn('AuditLog: не удалось загрузить данные', err.message);
        }
        setLoading(false);
    };

    const getActionInfo = (action) => {
        const actions = {
            login: { label: 'Вход', color: '#10b981', bg: 'rgba(16, 185, 129, 0.15)', icon: LogIn },
            logout: { label: 'Выход', color: '#888', bg: 'rgba(136, 136, 136, 0.15)', icon: LogOut },
            create: { label: 'Создание', color: '#3b82f6', bg: 'rgba(59, 130, 246, 0.15)', icon: Check },
            update: { label: 'Изменение', color: '#f59e0b', bg: 'rgba(245, 158, 11, 0.15)', icon: Edit },
            delete: { label: 'Удаление', color: '#ef4444', bg: 'rgba(239, 68, 68, 0.15)', icon: Trash2 },
            view: { label: 'Просмотр', color: '#8b5cf6', bg: 'rgba(139, 92, 246, 0.15)', icon: Eye },
            settings: { label: 'Настройки', color: '#6366f1', bg: 'rgba(99, 102, 241, 0.15)', icon: Settings },
            security: { label: 'Безопасность', color: '#ec4899', bg: 'rgba(236, 72, 153, 0.15)', icon: Shield }
        };
        return actions[action] || actions.view;
    };

    // Фильтрация
    const filteredLogs = logs.filter(log => {
        // Фильтр по типу действия
        if (filter !== 'all' && log.action !== filter) return false;

        // Фильтр по поиску
        if (searchQuery) {
            const query = searchQuery.toLowerCase();
            const matchesUser = log.user.toLowerCase().includes(query);
            const matchesTarget = log.target.toLowerCase().includes(query);
            const matchesDetails = log.details.toLowerCase().includes(query);
            const matchesIP = log.ip.includes(query);
            if (!matchesUser && !matchesTarget && !matchesDetails && !matchesIP) return false;
        }

        // Фильтр по дате
        if (dateFrom) {
            const logDate = new Date(log.time);
            const fromDate = new Date(dateFrom);
            if (logDate < fromDate) return false;
        }
        if (dateTo) {
            const logDate = new Date(log.time);
            const toDate = new Date(dateTo + ' 23:59:59');
            if (logDate > toDate) return false;
        }

        return true;
    });

    // Экспорт в CSV
    const exportToCSV = () => {
        setExporting(true);
        try {
            const headers = ['Время', 'Пользователь', 'Действие', 'Объект', 'Детали', 'IP'];
            const rows = filteredLogs.map(log => [
                log.time,
                log.user,
                getActionInfo(log.action).label,
                log.target,
                log.details,
                log.ip
            ]);

            const csvContent = [
                headers.join(','),
                ...rows.map(row => row.map(cell => `"${cell}"`).join(','))
            ].join('\n');

            const blob = new Blob(['\uFEFF' + csvContent], { type: 'text/csv;charset=utf-8;' });
            const link = document.createElement('a');
            link.href = URL.createObjectURL(blob);
            link.download = `audit_log_${new Date().toISOString().split('T')[0]}.csv`;
            link.click();

            showMessage('success', `Экспортировано ${filteredLogs.length} записей`);
        } catch (error) {
            showMessage('error', 'Ошибка экспорта');
        } finally {
            setExporting(false);
        }
    };

    // Экспорт в JSON
    const exportToJSON = () => {
        const data = {
            exportDate: new Date().toISOString(),
            totalRecords: filteredLogs.length,
            logs: filteredLogs
        };

        const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
        const link = document.createElement('a');
        link.href = URL.createObjectURL(blob);
        link.download = `audit_log_${new Date().toISOString().split('T')[0]}.json`;
        link.click();

        showMessage('success', `Экспортировано ${filteredLogs.length} записей в JSON`);
    };

    // Экспорт в Excel (XLSX-совместимый формат)
    const exportToExcel = () => {
        const headers = ['Время', 'Пользователь', 'Действие', 'Объект', 'Детали', 'IP'];
        const rows = filteredLogs.map(log => [
            log.time,
            log.user,
            getActionInfo(log.action).label,
            log.target,
            log.details,
            log.ip
        ]);

        // Создание XML для Excel
        let xmlContent = `<?xml version="1.0" encoding="UTF-8"?>
<?mso-application progid="Excel.Sheet"?>
<Workbook xmlns="urn:schemas-microsoft-com:office:spreadsheet"
 xmlns:ss="urn:schemas-microsoft-com:office:spreadsheet">
<Worksheet ss:Name="Журнал аудита">
<Table>
<Row>
${headers.map(h => `<Cell><Data ss:Type="String">${h}</Data></Cell>`).join('')}
</Row>
${rows.map(row => `<Row>${row.map(cell => `<Cell><Data ss:Type="String">${cell}</Data></Cell>`).join('')}</Row>`).join('\n')}
</Table>
</Worksheet>
</Workbook>`;

        const blob = new Blob([xmlContent], { type: 'application/vnd.ms-excel' });
        const link = document.createElement('a');
        link.href = URL.createObjectURL(blob);
        link.download = `audit_log_${new Date().toISOString().split('T')[0]}.xls`;
        link.click();

        showMessage('success', `Экспортировано ${filteredLogs.length} записей в Excel`);
    };

    // Экспорт в PDF (через печать в фоне)
    const exportToPDF = async () => {
        try {
            // Динамически загружаем jsPDF если ещё не загружен
            let jsPDFLib = window.jspdf?.jsPDF;

            if (!jsPDFLib) {
                // Если jsPDF не доступен, используем альтернативный метод
                const printContent = `
<!DOCTYPE html>
<html>
<head>
    <meta charset="UTF-8">
    <title>{t('auditlog.zhurnal_audita', 'Журнал аудита')}</title>
    <style>
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body { font-family: Arial, sans-serif; padding: 20px; background: white; }
        h1 { color: #333; border-bottom: 2px solid #4a90d9; padding-bottom: 10px; margin-bottom: 15px; font-size: 20px; }
        .info { margin-bottom: 15px; color: #666; font-size: 12px; }
        table { width: 100%; border-collapse: collapse; }
        th { background: #4a90d9; color: white; padding: 8px 6px; text-align: left; font-size: 11px; }
        td { padding: 6px; border-bottom: 1px solid #ddd; font-size: 10px; }
        tr:nth-child(even) { background: #f5f5f5; }
        .footer { margin-top: 20px; font-size: 9px; color: #888; text-align: center; }
    </style>
</head>
<body>
    <h1>{t('auditlog.zhurnal_audita', 'Журнал аудита')}</h1>
    <div class="info">
        <p>Дата: ${new Date().toLocaleString('ru-RU')} | Записей: ${filteredLogs.length}</p>
    </div>
    <table>
        <thead>
            <tr>
                <th>{t('auditlog.vremya', 'Время')}</th>
                <th>{t('auditlog.polzovatel', 'Пользователь')}</th>
                <th>{t('auditlog.deystvie', 'Действие')}</th>
                <th>{t('auditlog.obekt', 'Объект')}</th>
                <th>{t('auditlog.detali', 'Детали')}</th>
                <th>IP</th>
            </tr>
        </thead>
        <tbody>
            ${filteredLogs.map(log => `
                <tr>
                    <td>${log.time}</td>
                    <td>${log.user}</td>
                    <td>${getActionInfo(log.action).label}</td>
                    <td>${log.target}</td>
                    <td>${log.details}</td>
                    <td>${log.ip}</td>
                </tr>
            `).join('')}
        </tbody>
    </table>
    <div class="footer">SmartPOS Pro</div>
    <script>window.onload = function() { window.print(); }</script>
</body>
</html>`;

                const blob = new Blob([printContent], { type: 'text/html;charset=utf-8' });
                const url = URL.createObjectURL(blob);
                const iframe = document.createElement('iframe');
                iframe.style.display = 'none';
                iframe.src = url;
                document.body.appendChild(iframe);

                iframe.onload = function () {
                    setTimeout(() => {
                        iframe.contentWindow.print();
                        setTimeout(() => {
                            document.body.removeChild(iframe);
                            URL.revokeObjectURL(url);
                        }, 100);
                    }, 500);
                };

                showMessage('success', 'Выберите "Сохранить как PDF" в диалоге печати');
                return;
            }

            // Используем jsPDF если доступен
            const doc = new jsPDFLib();
            doc.setFontSize(18);
            doc.text('Журнал аудита', 14, 22);
            doc.setFontSize(10);
            doc.setTextColor(100);
            doc.text(`Дата экспорта: ${new Date().toLocaleString('ru-RU')}`, 14, 32);
            doc.text(`Всего записей: ${filteredLogs.length}`, 14, 38);

            const tableData = filteredLogs.map(log => [
                log.time, log.user, getActionInfo(log.action).label,
                log.target, log.details.substring(0, 35), log.ip
            ]);

            doc.autoTable({
                head: [['Время', 'Пользователь', 'Действие', 'Объект', 'Детали', 'IP']],
                body: tableData,
                startY: 45,
                styles: { fontSize: 8 },
                headStyles: { fillColor: [74, 144, 217] }
            });

            doc.save(`audit_log_${new Date().toISOString().split('T')[0]}.pdf`);
            showMessage('success', `PDF сохранён`);
        } catch (error) {
            console.error('PDF export error:', error);
            showMessage('error', 'Ошибка: ' + error.message);
        }
    };

    // Сброс фильтров
    const resetFilters = () => {
        setFilter('all');
        setSearchQuery('');
        setDateFrom('');
        setDateTo('');
        showMessage('success', 'Фильтры сброшены');
    };

    return (
        <div className="fade-in" style={{ padding: '1.5rem' }}>
            <div className="page-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
                <div>
                    <h1 style={{ margin: 0, display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                        🔍 Журнал аудита
                    </h1>
                    <p style={{ color: 'var(--color-text-muted)', margin: '0.5rem 0 0' }}>
                        История действий пользователей
                    </p>
                </div>
                <div style={{ display: 'flex', gap: '0.5rem' }}>
                    <button className="btn btn-secondary" onClick={() => loadData()} disabled={loading}>
                        <RefreshCw size={16} className={loading ? 'spin' : ''} /> Обновить
                    </button>
                    <button className="btn btn-secondary" onClick={exportToCSV} disabled={exporting}>
                        <Download size={16} /> CSV
                    </button>
                    <button className="btn btn-secondary" onClick={exportToExcel}>
                        <FileText size={16} /> Excel
                    </button>
                    <button className="btn btn-secondary" onClick={exportToPDF}>
                        <FileText size={16} /> PDF
                    </button>
                    <button className="btn btn-secondary" onClick={exportToJSON}>
                        <FileText size={16} /> JSON
                    </button>
                </div>
            </div>

            {/* Сообщение */}
            {message && (
                <div style={{
                    padding: '12px 16px',
                    marginBottom: '16px',
                    borderRadius: '8px',
                    backgroundColor: message.type === 'success' ? 'rgba(34, 197, 94, 0.1)' : 'rgba(239, 68, 68, 0.1)',
                    color: message.type === 'success' ? 'var(--color-success)' : 'var(--color-danger)',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px'
                }}>
                    <Check size={18} /> {message.text}
                </div>
            )}

            {/* Статистика */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '16px', marginBottom: '20px' }}>
                <div className="card" style={{ padding: '20px', textAlign: 'center' }}>
                    <Shield size={28} color="#8b5cf6" style={{ marginBottom: '8px' }} />
                    <div style={{ fontSize: '28px', fontWeight: 'bold' }}>{stats.total_today || logs.length}</div>
                    <div style={{ color: '#666', fontSize: '13px' }}>{t('auditlog.sobytiy_segodnya', 'Событий сегодня')}</div>
                </div>
                <div className="card" style={{ padding: '20px', textAlign: 'center' }}>
                    <LogIn size={28} color="#10b981" style={{ marginBottom: '8px' }} />
                    <div style={{ fontSize: '28px', fontWeight: 'bold' }}>{stats.logins || logs.filter(l => l.action === 'login' || l.action === 'logout').length}</div>
                    <div style={{ color: '#666', fontSize: '13px' }}>{t('auditlog.vhody_vyhody', 'Входы/выходы')}</div>
                </div>
                <div className="card" style={{ padding: '20px', textAlign: 'center' }}>
                    <Edit size={28} color="#f59e0b" style={{ marginBottom: '8px' }} />
                    <div style={{ fontSize: '28px', fontWeight: 'bold' }}>{stats.changes || logs.filter(l => ['create', 'update', 'delete'].includes(l.action)).length}</div>
                    <div style={{ color: '#666', fontSize: '13px' }}>{t('auditlog.izmeneniy', 'Изменений')}</div>
                </div>
                <div className="card" style={{ padding: '20px', textAlign: 'center' }}>
                    <AlertTriangle size={28} color="#ef4444" style={{ marginBottom: '8px' }} />
                    <div style={{ fontSize: '28px', fontWeight: 'bold' }}>{stats.security || logs.filter(l => l.action === 'security').length}</div>
                    <div style={{ color: '#666', fontSize: '13px' }}>Безопасность</div>
                </div>
            </div>

            {/* Фильтры */}
            <div className="card" style={{ marginBottom: '20px', padding: '16px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem' }}>
                    <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                        {[
                            { key: 'all', label: 'Все' },
                            { key: 'login', label: '🟢 Входы' },
                            { key: 'create', label: '➕ Создание' },
                            { key: 'update', label: '✏️ Изменение' },
                            { key: 'delete', label: '🗑️ Удаление' }
                        ].map(f => (
                            <button
                                key={f.key}
                                onClick={() => setFilter(f.key)}
                                className={`btn btn-sm ${filter === f.key ? 'btn-primary' : 'btn-secondary'}`}
                            >
                                {f.label}
                            </button>
                        ))}
                    </div>
                    <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
                        <input
                            type="date"
                            className="form-input"
                            value={dateFrom}
                            onChange={(e) => setDateFrom(e.target.value)}
                            style={{ width: '150px' }}
                        />
                        <span style={{ color: 'var(--color-text-muted)' }}>—</span>
                        <input
                            type="date"
                            className="form-input"
                            value={dateTo}
                            onChange={(e) => setDateTo(e.target.value)}
                            style={{ width: '150px' }}
                        />
                        <div style={{ position: 'relative' }}>
                            <Search size={18} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: '#888' }} />
                            <input
                                type="text"
                                placeholder="Поиск..."
                                className="form-input"
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                                style={{ paddingLeft: '40px', width: '200px' }}
                            />
                            {searchQuery && (
                                <button
                                    onClick={() => setSearchQuery('')}
                                    style={{
                                        position: 'absolute', right: '8px', top: '50%', transform: 'translateY(-50%)',
                                        background: 'none', border: 'none', cursor: 'pointer', color: '#888'
                                    }}
                                >
                                    <X size={16} />
                                </button>
                            )}
                        </div>
                        {(filter !== 'all' || searchQuery || dateFrom || dateTo) && (
                            <button className="btn btn-sm btn-secondary" onClick={resetFilters}>
                                Сбросить
                            </button>
                        )}
                    </div>
                </div>
                {filteredLogs.length !== logs.length && (
                    <div style={{ marginTop: '12px', fontSize: '0.9rem', color: 'var(--color-text-muted)' }}>
                        Показано {filteredLogs.length} из {logs.length} записей
                    </div>
                )}
            </div>

            {/* Список */}
            <div className="card">
                {loading ? (
                    <div style={{ padding: '40px', textAlign: 'center' }}>
                        <RefreshCw className="spin" size={24} />
                        <p>{t('auditlog.zagruzka', 'Загрузка...')}</p>
                    </div>
                ) : filteredLogs.length === 0 ? (
                    <div style={{ padding: '40px', textAlign: 'center', color: 'var(--color-text-muted)' }}>
                        <Shield size={48} style={{ opacity: 0.5, marginBottom: '1rem' }} />
                        <p>{t('auditlog.net_zapisey_po_zadannym_filtram', 'Нет записей по заданным фильтрам')}</p>
                    </div>
                ) : (
                    <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                        <thead>
                            <tr style={{ background: 'var(--bg-secondary)' }}>
                                <th style={{ padding: '12px', textAlign: 'left' }}>{t('auditlog.vremya', 'Время')}</th>
                                <th style={{ padding: '12px', textAlign: 'left' }}>{t('auditlog.polzovatel', 'Пользователь')}</th>
                                <th style={{ padding: '12px', textAlign: 'center' }}>{t('auditlog.deystvie', 'Действие')}</th>
                                <th style={{ padding: '12px', textAlign: 'left' }}>{t('auditlog.obekt', 'Объект')}</th>
                                <th style={{ padding: '12px', textAlign: 'left' }}>{t('auditlog.detali', 'Детали')}</th>
                                <th style={{ padding: '12px', textAlign: 'center' }}>IP</th>
                                <th style={{ padding: '12px', textAlign: 'center' }}>{t('auditlog.info', 'Инфо')}</th>
                            </tr>
                        </thead>
                        <tbody>
                            {filteredLogs.map(log => {
                                const actionInfo = getActionInfo(log.action);
                                const ActionIcon = actionInfo.icon;

                                return (
                                    <tr key={log.id} style={{ borderBottom: '1px solid var(--border-color)' }}>
                                        <td style={{ padding: '12px' }}>
                                            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '13px' }}>
                                                <Clock size={14} color="#888" />
                                                {log.time}
                                            </div>
                                        </td>
                                        <td style={{ padding: '12px' }}>
                                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                                <div style={{
                                                    width: '32px', height: '32px',
                                                    borderRadius: '50%',
                                                    background: 'var(--primary-light)',
                                                    display: 'flex',
                                                    alignItems: 'center',
                                                    justifyContent: 'center'
                                                }}>
                                                    <User size={16} color="var(--primary)" />
                                                </div>
                                                <span style={{ fontWeight: 500 }}>{log.user}</span>
                                            </div>
                                        </td>
                                        <td style={{ padding: '12px', textAlign: 'center' }}>
                                            <span style={{
                                                background: actionInfo.bg,
                                                color: actionInfo.color,
                                                padding: '4px 10px',
                                                borderRadius: '12px',
                                                fontSize: '12px',
                                                display: 'inline-flex',
                                                alignItems: 'center',
                                                gap: '4px'
                                            }}>
                                                <ActionIcon size={12} /> {actionInfo.label}
                                            </span>
                                        </td>
                                        <td style={{ padding: '12px', fontWeight: 500 }}>{log.target}</td>
                                        <td style={{ padding: '12px', color: '#666', fontSize: '13px', maxWidth: '300px', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                                            {log.details}
                                        </td>
                                        <td style={{ padding: '12px', textAlign: 'center', fontFamily: 'monospace', fontSize: '12px', color: '#888' }}>
                                            {log.ip}
                                        </td>
                                        <td style={{ padding: '12px', textAlign: 'center' }}>
                                            <button
                                                className="btn btn-sm btn-secondary"
                                                onClick={() => setSelectedLog(log)}
                                                title={t('auditlog.podrobnosti', 'Подробности')}
                                            >
                                                <Info size={14} />
                                            </button>
                                        </td>
                                    </tr>
                                );
                            })}
                        </tbody>
                    </table>
                )}
            </div>

            {/* Модальное окно деталей */}
            {selectedLog && (
                <div className="modal-overlay" onClick={() => setSelectedLog(null)}>
                    <div className="modal-content" onClick={e => e.stopPropagation()} style={{ maxWidth: '500px' }}>
                        <div className="modal-header">
                            <h2 className="modal-title">{t('auditlog.detali_zapisi', '📋 Детали записи')}</h2>
                            <button className="modal-close" onClick={() => setSelectedLog(null)}>×</button>
                        </div>
                        <div className="modal-body">
                            <div style={{ display: 'grid', gap: '1rem' }}>
                                <div>
                                    <label style={{ color: 'var(--color-text-muted)', fontSize: '0.85rem' }}>{t('auditlog.vremya', 'Время')}</label>
                                    <div style={{ fontWeight: 600 }}>{selectedLog.time}</div>
                                </div>
                                <div>
                                    <label style={{ color: 'var(--color-text-muted)', fontSize: '0.85rem' }}>{t('auditlog.polzovatel', 'Пользователь')}</label>
                                    <div style={{ fontWeight: 600 }}>{selectedLog.user}</div>
                                </div>
                                <div>
                                    <label style={{ color: 'var(--color-text-muted)', fontSize: '0.85rem' }}>{t('auditlog.deystvie', 'Действие')}</label>
                                    <div>
                                        <span style={{
                                            background: getActionInfo(selectedLog.action).bg,
                                            color: getActionInfo(selectedLog.action).color,
                                            padding: '4px 10px',
                                            borderRadius: '12px',
                                            fontSize: '12px'
                                        }}>
                                            {getActionInfo(selectedLog.action).label}
                                        </span>
                                    </div>
                                </div>
                                <div>
                                    <label style={{ color: 'var(--color-text-muted)', fontSize: '0.85rem' }}>{t('auditlog.obekt', 'Объект')}</label>
                                    <div style={{ fontWeight: 600 }}>{selectedLog.target}</div>
                                </div>
                                <div>
                                    <label style={{ color: 'var(--color-text-muted)', fontSize: '0.85rem' }}>{t('auditlog.detali', 'Детали')}</label>
                                    <div style={{ padding: '0.5rem', backgroundColor: 'var(--color-bg-secondary)', borderRadius: '4px' }}>
                                        {selectedLog.details}
                                    </div>
                                </div>
                                <div>
                                    <label style={{ color: 'var(--color-text-muted)', fontSize: '0.85rem' }}>{t('auditlog.adres', 'IP адрес')}</label>
                                    <div style={{ fontFamily: 'monospace' }}>{selectedLog.ip}</div>
                                </div>
                            </div>
                        </div>
                        <div className="modal-footer">
                            <button className="btn btn-secondary" onClick={() => setSelectedLog(null)}>
                                Закрыть
                            </button>
                        </div>
                    </div>
                </div>
            )}

            <style>{`
                .spin {
                    animation: spin 1s linear infinite;
                }
                @keyframes spin {
                    from { transform: rotate(0deg); }
                    to { transform: rotate(360deg); }
                }
            `}</style>
        </div>
    );
}

export default AuditLog;
