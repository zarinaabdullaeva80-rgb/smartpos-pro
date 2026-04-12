import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Upload, Download, FileText, Check, AlertCircle, Clock, X, ArrowRight, RefreshCw, FileSpreadsheet, Trash2, Eye, ChevronDown, ChevronRight, Link2, Unlink } from 'lucide-react';
import axios from 'axios';

const API = axios.create({ baseURL: '/api' });
API.interceptors.request.use(cfg => {
    const token = localStorage.getItem('token');
    if (token) cfg.headers.Authorization = `Bearer ${token}`;
    return cfg;
});
import { useI18n } from '../i18n';

function ImportExport() {
    const { t } = useI18n();
    // Tabs
    const [activeTab, setActiveTab] = useState('import'); // 'import', 'export', 'history'

    // Import state
    const [importType, setImportType] = useState('products');
    const [file, setFile] = useState(null);
    const [isDragging, setIsDragging] = useState(false);
    const [previewData, setPreviewData] = useState(null);
    const [columnMapping, setColumnMapping] = useState({});
    const [importing, setImporting] = useState(false);
    const [importResult, setImportResult] = useState(null);
    const [previewLoading, setPreviewLoading] = useState(false);
    const [error, setError] = useState(null);

    // Export state
    const [exportLoading, setExportLoading] = useState({});

    // History
    const [logs, setLogs] = useState([]);
    const [logsLoading, setLogsLoading] = useState(false);

    const fileInputRef = useRef(null);

    // Загрузка истории
    const loadLogs = useCallback(async () => {
        setLogsLoading(true);
        try {
            const res = await API.get('/import/logs');
            setLogs(res.data || []);
        } catch (err) {
            console.warn('Не удалось загрузить историю:', err.message);
        } finally {
            setLogsLoading(false);
        }
    }, []);

    useEffect(() => { if (activeTab === 'history') loadLogs(); }, [activeTab, loadLogs]);

    // Drag & Drop
    const handleDragOver = (e) => { e.preventDefault(); setIsDragging(true); };
    const handleDragLeave = () => setIsDragging(false);
    const handleDrop = (e) => {
        e.preventDefault();
        setIsDragging(false);
        const droppedFile = e.dataTransfer.files[0];
        if (droppedFile) selectFile(droppedFile);
    };

    const selectFile = (f) => {
        setFile(f);
        setPreviewData(null);
        setColumnMapping({});
        setImportResult(null);
        setError(null);
    };

    const handleFileInput = (e) => {
        if (e.target.files[0]) selectFile(e.target.files[0]);
    };

    // Предпросмотр файла
    const handlePreview = async () => {
        if (!file) return;
        setPreviewLoading(true);
        setError(null);
        try {
            const formData = new FormData();
            formData.append('file', file);
            formData.append('type', importType);

            const res = await API.post('/import/preview', formData, {
                headers: { 'Content-Type': 'multipart/form-data' }
            });

            setPreviewData(res.data);
            setColumnMapping(res.data.suggestedMapping || {});
        } catch (err) {
            setError(err.response?.data?.error || err.message);
        } finally {
            setPreviewLoading(false);
        }
    };

    // Выполнить импорт
    const handleImport = async () => {
        if (!file || !previewData) return;
        setImporting(true);
        setError(null);
        try {
            const formData = new FormData();
            formData.append('file', file);
            formData.append('type', importType);
            formData.append('mapping', JSON.stringify(columnMapping));
            formData.append('filePath', previewData.filePath || '');

            const res = await API.post('/import/execute', formData, {
                headers: { 'Content-Type': 'multipart/form-data' }
            });

            setImportResult(res.data);
        } catch (err) {
            setError(err.response?.data?.error || err.message);
        } finally {
            setImporting(false);
        }
    };

    // Скачать шаблон
    const downloadTemplate = async (type) => {
        try {
            const res = await API.get(`/import/template/${type}`, { responseType: 'blob' });
            const url = URL.createObjectURL(res.data);
            const a = document.createElement('a');
            a.href = url;
            a.download = `шаблон_${type}.xlsx`;
            a.click();
            URL.revokeObjectURL(url);
        } catch (err) {
            alert('Ошибка скачивания шаблона: ' + (err.response?.data?.error || err.message));
        }
    };

    // Экспорт данных
    const handleExport = async (type) => {
        setExportLoading(prev => ({ ...prev, [type]: true }));
        try {
            const res = await API.get(`/export/${type}/excel`, { responseType: 'blob' });
            const url = URL.createObjectURL(res.data);
            const a = document.createElement('a');
            a.href = url;
            a.download = `${type}_${new Date().toISOString().split('T')[0]}.xlsx`;
            a.click();
            URL.revokeObjectURL(url);
        } catch (err) {
            alert('Ошибка экспорта: ' + (err.response?.data?.error || err.message));
        } finally {
            setExportLoading(prev => ({ ...prev, [type]: false }));
        }
    };

    // Сброс
    const resetImport = () => {
        setFile(null);
        setPreviewData(null);
        setColumnMapping({});
        setImportResult(null);
        setError(null);
        if (fileInputRef.current) fileInputRef.current.value = '';
    };

    // Обновить маппинг
    const updateMapping = (fileCol, dbField) => {
        setColumnMapping(prev => {
            const next = { ...prev };
            if (dbField === '') {
                delete next[fileCol];
            } else {
                next[fileCol] = dbField;
            }
            return next;
        });
    };

    const importTypes = [
        { id: 'products', label: 'Товары', icon: '📦', description: 'Каталог товаров с ценами' },
        { id: 'categories', label: 'Категории', icon: '📂', description: 'Категории товаров' },
        { id: 'customers', label: 'Клиенты', icon: '👥', description: 'База клиентов' },
    ];

    const exportOptions = [
        { id: 'products', name: 'Товары', icon: '📦', description: 'Все товары с ценами и остатками' },
        { id: 'sales', name: 'Продажи', icon: '💰', description: 'История продаж за период' },
        { id: 'inventory', name: 'Инвентаризация', icon: '📋', description: 'Текущие остатки по складам' },
    ];

    const mappedFieldsCount = Object.keys(columnMapping).length;
    const totalHeaders = previewData?.fileHeaders?.length || 0;

    return (
        <div className="import-export-page fade-in">
            <div className="page-header">
                <div>
                    <h1>📤 {t('importExport.title')}</h1>
                    <p className="text-muted">{t('importExport.loadAndExport', 'Загрузка и выгрузка данных • Миграция из других систем')}</p>
                </div>
            </div>

            {/* Tabs */}
            <div style={{ display: 'flex', gap: '0', marginBottom: '24px', borderBottom: '2px solid var(--border-color)' }}>
                {[
                    { id: 'import', label: `📥 ${t('importExport.importData')}`, desc: t('importExport.uploadFromFile', 'Загрузить из файла') },
                    { id: 'export', label: `📤 ${t('importExport.exportData')}`, desc: t('importExport.downloadExcel', 'Выгрузить в Excel') },
                    { id: 'history', label: `📋 ${t('importExport.history')}`, desc: t('importExport.operationsLog', 'Журнал операций') },
                ].map(tab => (
                    <button
                        key={tab.id}
                        onClick={() => setActiveTab(tab.id)}
                        style={{
                            padding: '14px 28px',
                            background: activeTab === tab.id ? 'var(--primary)' : 'transparent',
                            color: activeTab === tab.id ? 'white' : 'var(--text-secondary)',
                            border: 'none',
                            cursor: 'pointer',
                            fontSize: '14px',
                            fontWeight: activeTab === tab.id ? 600 : 400,
                            borderRadius: '8px 8px 0 0',
                            transition: 'all 0.2s',
                            display: 'flex',
                            flexDirection: 'column',
                            alignItems: 'center',
                            gap: '2px',
                        }}
                    >
                        <span>{tab.label}</span>
                        <span style={{ fontSize: '11px', opacity: 0.7 }}>{tab.desc}</span>
                    </button>
                ))}
            </div>

            {/* ========== IMPORT TAB ========== */}
            {activeTab === 'import' && (
                <div>
                    {/* Шаг 0: Если есть результат — показать его */}
                    {importResult && (
                        <div className="card" style={{ padding: '30px', marginBottom: '20px' }}>
                            <div style={{ textAlign: 'center', marginBottom: '24px' }}>
                                <div style={{
                                    width: '64px', height: '64px', borderRadius: '50%',
                                    background: importResult.errorsCount === 0 ? '#dcfce7' : '#fef3c7',
                                    display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                                    marginBottom: '16px'
                                }}>
                                    {importResult.errorsCount === 0 ? <Check size={32} color="#16a34a" /> : <AlertCircle size={32} color="#d97706" />}
                                </div>
                                <h2 style={{ margin: 0 }}>{t('importexport.import_zavershyon', 'Импорт завершён!')}</h2>
                            </div>

                            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '16px', marginBottom: '24px' }}>
                                <StatCard label="Всего строк" value={importResult.totalRows} color="#6366f1" />
                                <StatCard label="Добавлено" value={importResult.imported} color="#16a34a" />
                                <StatCard label="Обновлено" value={importResult.updated} color="#3b82f6" />
                                <StatCard label="Ошибок" value={importResult.errorsCount} color={importResult.errorsCount > 0 ? '#dc2626' : '#888'} />
                            </div>

                            {importResult.errors?.length > 0 && (
                                <div style={{ maxHeight: '200px', overflow: 'auto', background: '#fef2f2', borderRadius: '8px', padding: '12px' }}>
                                    <strong style={{ color: '#dc2626' }}>{t('importexport.oshibki', 'Ошибки:')}</strong>
                                    {importResult.errors.map((err, i) => (
                                        <div key={i} style={{ fontSize: '12px', color: '#991b1b', padding: '4px 0', borderBottom: '1px solid #fecaca' }}>
                                            Строка {err.row}: {err.error}
                                        </div>
                                    ))}
                                </div>
                            )}

                            <div style={{ textAlign: 'center', marginTop: '20px' }}>
                                <button className="btn btn-primary" onClick={resetImport}>
                                    <RefreshCw size={16} /> Новый импорт
                                </button>
                            </div>
                        </div>
                    )}

                    {/* Шаг 1: Выбор типа + файл */}
                    {!importResult && (
                        <>
                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 2fr', gap: '20px', marginBottom: '20px' }}>
                                {/* Тип данных */}
                                <div className="card" style={{ padding: '20px' }}>
                                    <h3 style={{ margin: '0 0 16px', fontSize: '15px' }}>{t('importexport.tip_dannyh', '1. Тип данных')}</h3>
                                    {importTypes.map(t => (
                                        <div
                                            key={t.id}
                                            onClick={() => { setImportType(t.id); setPreviewData(null); setColumnMapping({}); }}
                                            style={{
                                                padding: '12px 16px',
                                                borderRadius: '8px',
                                                cursor: 'pointer',
                                                marginBottom: '8px',
                                                border: `2px solid ${importType === t.id ? 'var(--primary)' : 'var(--border-color)'}`,
                                                background: importType === t.id ? 'rgba(99,102,241,0.08)' : 'transparent',
                                                transition: 'all 0.2s',
                                            }}
                                        >
                                            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                                                <span style={{ fontSize: '24px' }}>{t.icon}</span>
                                                <div>
                                                    <div style={{ fontWeight: 600, fontSize: '14px' }}>{t.label}</div>
                                                    <div style={{ fontSize: '12px', color: '#888' }}>{t.description}</div>
                                                </div>
                                            </div>
                                        </div>
                                    ))}

                                    <div style={{ borderTop: '1px solid var(--border-color)', paddingTop: '16px', marginTop: '8px' }}>
                                        <div style={{ fontSize: '12px', color: '#888', marginBottom: '8px' }}>{t('importexport.shablony_dlya_zapolneniya', '📄 Шаблоны для заполнения:')}</div>
                                        {importTypes.map(t => (
                                            <button
                                                key={t.id}
                                                onClick={() => downloadTemplate(t.id)}
                                                className="btn btn-secondary"
                                                style={{ display: 'flex', alignItems: 'center', gap: '6px', width: '100%', marginBottom: '6px', fontSize: '12px', justifyContent: 'flex-start' }}
                                            >
                                                <Download size={14} /> Шаблон: {t.label}
                                            </button>
                                        ))}
                                    </div>
                                </div>

                                {/* Загрузка файла */}
                                <div className="card" style={{ padding: '20px' }}>
                                    <h3 style={{ margin: '0 0 16px', fontSize: '15px' }}>{t('importexport.zagruzite_fayl', '2. Загрузите файл')}</h3>

                                    <div
                                        onDragOver={handleDragOver}
                                        onDragLeave={handleDragLeave}
                                        onDrop={handleDrop}
                                        onClick={() => fileInputRef.current?.click()}
                                        style={{
                                            border: `2px dashed ${isDragging ? 'var(--primary)' : file ? '#16a34a' : 'var(--border-color)'}`,
                                            borderRadius: '12px',
                                            padding: '40px 20px',
                                            textAlign: 'center',
                                            cursor: 'pointer',
                                            background: isDragging ? 'rgba(99,102,241,0.05)' : file ? 'rgba(22,163,106,0.05)' : 'transparent',
                                            transition: 'all 0.3s',
                                            marginBottom: '16px',
                                        }}
                                    >
                                        {file ? (
                                            <>
                                                <FileSpreadsheet size={40} color="#16a34a" style={{ marginBottom: '12px' }} />
                                                <div style={{ fontWeight: 600, fontSize: '16px', marginBottom: '4px' }}>{file.name}</div>
                                                <div style={{ fontSize: '13px', color: '#888' }}>{(file.size / 1024).toFixed(1)} КБ</div>
                                                <button
                                                    className="btn btn-secondary"
                                                    onClick={(e) => { e.stopPropagation(); resetImport(); }}
                                                    style={{ marginTop: '12px', fontSize: '12px' }}
                                                >
                                                    <X size={14} /> Удалить
                                                </button>
                                            </>
                                        ) : (
                                            <>
                                                <Upload size={40} color="var(--primary)" style={{ marginBottom: '12px' }} />
                                                <div style={{ fontWeight: 500, marginBottom: '4px' }}>
                                                    Перетащите файл сюда или нажмите для выбора
                                                </div>
                                                <div style={{ fontSize: '13px', color: '#888' }}>
                                                    Поддерживаются: .xlsx, .xls, .csv, .json
                                                </div>
                                            </>
                                        )}
                                        <input
                                            ref={fileInputRef}
                                            type="file"
                                            accept=".xlsx,.xls,.csv,.json"
                                            style={{ display: 'none' }}
                                            onChange={handleFileInput}
                                        />
                                    </div>

                                    {file && !previewData && (
                                        <button
                                            className="btn btn-primary"
                                            onClick={handlePreview}
                                            disabled={previewLoading}
                                            style={{ width: '100%', padding: '14px' }}
                                        >
                                            {previewLoading ? (
                                                <><RefreshCw size={16} className="spin" /> {t('importexport.analiz_fayla', 'Анализ файла...')}</>
                                            ) : (
                                                <><Eye size={16} /> {t('importexport.predprosmotr_i_mapping_kolonok', 'Предпросмотр и маппинг колонок')}</>
                                            )}
                                        </button>
                                    )}
                                </div>
                            </div>

                            {/* Ошибка */}
                            {error && (
                                <div className="card" style={{ padding: '16px', background: '#fef2f2', border: '1px solid #fecaca', marginBottom: '20px' }}>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#dc2626' }}>
                                        <AlertCircle size={20} />
                                        <strong>{t('importexport.oshibka', 'Ошибка:')}</strong> {error}
                                    </div>
                                </div>
                            )}

                            {/* Шаг 3: Маппинг колонок */}
                            {previewData && (
                                <div className="card" style={{ padding: '20px', marginBottom: '20px' }}>
                                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
                                        <div>
                                            <h3 style={{ margin: '0 0 4px', fontSize: '15px' }}>{t('importexport.sopostavlenie_kolonok', '3. Сопоставление колонок')}</h3>
                                            <p style={{ margin: 0, fontSize: '13px', color: '#888' }}>
                                                Файл: <strong>{previewData.fileName}</strong> • {previewData.totalRows} строк •
                                                Сопоставлено: <strong style={{ color: mappedFieldsCount > 0 ? '#16a34a' : '#888' }}>{mappedFieldsCount}</strong> из {totalHeaders}
                                            </p>
                                        </div>
                                        <div style={{ display: 'flex', gap: '8px' }}>
                                            <span style={{
                                                background: mappedFieldsCount > 0 ? '#dcfce7' : '#fef3c7',
                                                color: mappedFieldsCount > 0 ? '#16a34a' : '#d97706',
                                                padding: '6px 14px',
                                                borderRadius: '20px',
                                                fontSize: '13px',
                                                fontWeight: 600,
                                            }}>
                                                <Link2 size={14} style={{ verticalAlign: 'middle', marginRight: '4px' }} />
                                                {mappedFieldsCount} / {totalHeaders}
                                            </span>
                                        </div>
                                    </div>

                                    {/* Column mapping UI */}
                                    <div style={{
                                        display: 'grid',
                                        gridTemplateColumns: '1fr 40px 1fr',
                                        gap: '8px',
                                        alignItems: 'center',
                                        marginBottom: '20px',
                                    }}>
                                        {/* Header row */}
                                        <div style={{ fontWeight: 600, fontSize: '12px', color: '#888', textTransform: 'uppercase', padding: '8px 12px' }}>
                                            Колонка в файле
                                        </div>
                                        <div></div>
                                        <div style={{ fontWeight: 600, fontSize: '12px', color: '#888', textTransform: 'uppercase', padding: '8px 12px' }}>
                                            Поле в системе
                                        </div>

                                        {previewData.fileHeaders.map((header, idx) => {
                                            const mapped = columnMapping[header];
                                            const fieldInfo = mapped && previewData.availableFields?.[mapped];
                                            return (
                                                <React.Fragment key={header}>
                                                    {/* File column */}
                                                    <div style={{
                                                        padding: '10px 14px',
                                                        borderRadius: '8px',
                                                        background: mapped ? 'rgba(22,163,106,0.08)' : 'rgba(255,255,255,0.05)',
                                                        border: `1px solid ${mapped ? '#bbf7d0' : 'var(--border-color)'}`,
                                                        fontSize: '14px',
                                                        fontWeight: 500,
                                                        display: 'flex',
                                                        alignItems: 'center',
                                                        gap: '8px',
                                                    }}>
                                                        <FileText size={14} color={mapped ? '#16a34a' : '#888'} />
                                                        {header}
                                                        <span style={{ fontSize: '11px', color: '#888', marginLeft: 'auto' }}>
                                                            пр: {previewData.previewRows?.[0]?.[header] ?? '—'}
                                                        </span>
                                                    </div>

                                                    {/* Arrow */}
                                                    <div style={{ textAlign: 'center' }}>
                                                        {mapped ? (
                                                            <Link2 size={18} color="#16a34a" />
                                                        ) : (
                                                            <Unlink size={18} color="#ccc" />
                                                        )}
                                                    </div>

                                                    {/* DB field select */}
                                                    <div>
                                                        <select
                                                            value={mapped || ''}
                                                            onChange={(e) => updateMapping(header, e.target.value)}
                                                            style={{
                                                                width: '100%',
                                                                padding: '10px 14px',
                                                                borderRadius: '8px',
                                                                border: `1px solid ${mapped ? '#bbf7d0' : 'var(--border-color)'}`,
                                                                background: mapped ? 'rgba(22,163,106,0.08)' : 'var(--card-bg, white)',
                                                                fontSize: '14px',
                                                                color: mapped ? 'var(--text-primary)' : '#888',
                                                                cursor: 'pointer',
                                                                outline: 'none',
                                                            }}
                                                        >
                                                            <option value="">{t('importexport.propustit', '— пропустить —')}</option>
                                                            {previewData.availableFields && Object.entries(previewData.availableFields).map(([key, info]) => (
                                                                <option key={key} value={key}>
                                                                    {info.label} {info.required ? '*' : ''}
                                                                </option>
                                                            ))}
                                                        </select>
                                                    </div>
                                                </React.Fragment>
                                            );
                                        })}
                                    </div>

                                    {/* Preview table */}
                                    <div style={{ marginBottom: '20px' }}>
                                        <h4 style={{ margin: '0 0 12px', fontSize: '14px' }}>Предпросмотр данных (первые {previewData.previewRows?.length || 0} строк)</h4>
                                        <div style={{ overflow: 'auto', maxHeight: '300px', borderRadius: '8px', border: '1px solid var(--border-color)' }}>
                                            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
                                                <thead>
                                                    <tr>
                                                        <th style={thStyle}>#</th>
                                                        {previewData.fileHeaders
                                                            .filter(h => columnMapping[h])
                                                            .map(h => (
                                                                <th key={h} style={thStyle}>
                                                                    <div style={{ fontSize: '11px', color: '#888' }}>{h}</div>
                                                                    <div style={{ color: '#16a34a', fontWeight: 600 }}>
                                                                        → {previewData.availableFields?.[columnMapping[h]]?.label || columnMapping[h]}
                                                                    </div>
                                                                </th>
                                                            ))}
                                                    </tr>
                                                </thead>
                                                <tbody>
                                                    {previewData.previewRows?.map((row, i) => (
                                                        <tr key={i}>
                                                            <td style={tdStyle}>{i + 1}</td>
                                                            {previewData.fileHeaders
                                                                .filter(h => columnMapping[h])
                                                                .map(h => (
                                                                    <td key={h} style={tdStyle}>{row[h] ?? ''}</td>
                                                                ))}
                                                        </tr>
                                                    ))}
                                                </tbody>
                                            </table>
                                        </div>
                                    </div>

                                    {/* Import button */}
                                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                        <button className="btn btn-secondary" onClick={resetImport}>
                                            <X size={16} /> Отмена
                                        </button>
                                        <button
                                            className="btn btn-primary"
                                            onClick={handleImport}
                                            disabled={importing || mappedFieldsCount === 0}
                                            style={{ padding: '14px 32px', fontSize: '15px' }}
                                        >
                                            {importing ? (
                                                <><RefreshCw size={16} className="spin" /> Импортируем {previewData.totalRows} записей...</>
                                            ) : (
                                                <><Upload size={16} /> Импортировать {previewData.totalRows} записей</>
                                            )}
                                        </button>
                                    </div>
                                </div>
                            )}
                        </>
                    )}
                </div>
            )}

            {/* ========== EXPORT TAB ========== */}
            {activeTab === 'export' && (
                <div>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '16px', marginBottom: '20px' }}>
                        {exportOptions.map(opt => (
                            <div key={opt.id} className="card" style={{ padding: '24px', textAlign: 'center' }}>
                                <div style={{ fontSize: '40px', marginBottom: '12px' }}>{opt.icon}</div>
                                <h3 style={{ margin: '0 0 8px', fontSize: '16px' }}>{opt.name}</h3>
                                <p style={{ color: '#888', fontSize: '13px', margin: '0 0 16px' }}>{opt.description}</p>
                                <button
                                    className="btn btn-primary"
                                    onClick={() => handleExport(opt.id)}
                                    disabled={exportLoading[opt.id]}
                                    style={{ width: '100%' }}
                                >
                                    {exportLoading[opt.id] ? (
                                        <><RefreshCw size={14} className="spin" /> {t('importexport.eksport', 'Экспорт...')}</>
                                    ) : (
                                        <><Download size={14} /> {t('importexport.skachat', 'Скачать XLSX')}</>
                                    )}
                                </button>
                            </div>
                        ))}
                    </div>

                    <div className="card" style={{ padding: '20px' }}>
                        <h3 style={{ margin: '0 0 16px' }}>{t('importexport.shablony_dlya_importa', '📄 Шаблоны для импорта')}</h3>
                        <p style={{ color: '#888', fontSize: '13px', marginBottom: '16px' }}>
                            Скачайте пустой шаблон Excel, заполните данными и импортируйте через вкладку "Импорт данных"
                        </p>
                        <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
                            {importTypes.map(t => (
                                <button
                                    key={t.id}
                                    className="btn btn-secondary"
                                    onClick={() => downloadTemplate(t.id)}
                                    style={{ display: 'flex', alignItems: 'center', gap: '8px' }}
                                >
                                    <FileSpreadsheet size={16} /> Шаблон: {t.label}
                                </button>
                            ))}
                        </div>
                    </div>
                </div>
            )}

            {/* ========== HISTORY TAB ========== */}
            {activeTab === 'history' && (
                <div className="card">
                    <div style={{ padding: '16px', borderBottom: '1px solid var(--border-color)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <h3 style={{ margin: 0 }}>{t('importexport.istoriya_importov', '📋 История импортов')}</h3>
                        <button className="btn btn-secondary" onClick={loadLogs} disabled={logsLoading} style={{ fontSize: '12px' }}>
                            <RefreshCw size={14} /> Обновить
                        </button>
                    </div>

                    {logsLoading ? (
                        <div style={{ padding: '40px', textAlign: 'center', color: '#888' }}>{t('importexport.zagruzka', 'Загрузка...')}</div>
                    ) : logs.length === 0 ? (
                        <div style={{ padding: '40px', textAlign: 'center', color: '#888' }}>
                            <FileText size={40} style={{ marginBottom: '12px', opacity: 0.3 }} />
                            <div>{t('importexport.importy_eschyo_ne_vypolnyalis', 'Импорты ещё не выполнялись')}</div>
                        </div>
                    ) : (
                        logs.map((log, idx) => (
                            <div key={log.id || idx} style={{
                                padding: '16px',
                                borderBottom: '1px solid var(--border-color)',
                                display: 'flex',
                                alignItems: 'center',
                                gap: '16px',
                            }}>
                                <div style={{
                                    width: '40px', height: '40px',
                                    borderRadius: '8px',
                                    background: log.type === 'products' ? '#6366f1' : log.type === 'categories' ? '#f59e0b' : '#3b82f6',
                                    color: 'white',
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    fontSize: '18px',
                                    flexShrink: 0,
                                }}>
                                    {log.type === 'products' ? '📦' : log.type === 'categories' ? '📂' : '👥'}
                                </div>
                                <div style={{ flex: 1 }}>
                                    <div style={{ fontWeight: 600, fontSize: '14px' }}>
                                        {log.type === 'products' ? 'Товары' : log.type === 'categories' ? 'Категории' : 'Клиенты'}
                                    </div>
                                    <div style={{ fontSize: '12px', color: '#888' }}>
                                        {log.filename} • {log.user_name || 'Система'}
                                    </div>
                                </div>
                                <div style={{ display: 'flex', gap: '12px', fontSize: '13px' }}>
                                    <span style={{ color: '#16a34a' }}>+{log.imported}</span>
                                    <span style={{ color: '#3b82f6' }}>↻{log.updated}</span>
                                    {(log.errors?.length > 0 || (typeof log.errors === 'string' && JSON.parse(log.errors || '[]').length > 0)) && (
                                        <span style={{ color: '#dc2626' }}>✗{typeof log.errors === 'string' ? JSON.parse(log.errors).length : log.errors.length}</span>
                                    )}
                                </div>
                                <div style={{ fontSize: '12px', color: '#888', minWidth: '100px', textAlign: 'right' }}>
                                    {new Date(log.created_at).toLocaleString('ru-RU')}
                                </div>
                            </div>
                        ))
                    )}
                </div>
            )}
        </div>
    );
}

// Stat card component
function StatCard({ label, value, color }) {
    return (
        <div style={{
            padding: '16px',
            borderRadius: '12px',
            background: `${color}10`,
            border: `1px solid ${color}30`,
            textAlign: 'center',
        }}>
            <div style={{ fontSize: '28px', fontWeight: 700, color }}>{value}</div>
            <div style={{ fontSize: '12px', color: '#888', marginTop: '4px' }}>{label}</div>
        </div>
    );
}

// Table styles
const thStyle = {
    padding: '10px 12px',
    textAlign: 'left',
    background: 'var(--bg-secondary, #f8fafc)',
    borderBottom: '2px solid var(--border-color)',
    fontSize: '12px',
    fontWeight: 600,
    position: 'sticky',
    top: 0,
    zIndex: 1,
};

const tdStyle = {
    padding: '8px 12px',
    borderBottom: '1px solid var(--border-color)',
    fontSize: '13px',
};

export default ImportExport;
