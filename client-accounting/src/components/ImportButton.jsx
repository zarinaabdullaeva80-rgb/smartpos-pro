import React, { useRef, useState, useEffect } from 'react';
import { Upload, AlertCircle, CheckCircle, X, FileSpreadsheet, Loader } from 'lucide-react';
import { getApiUrl } from '../config/settings';

/**
 * ImportButton - Импорт данных из Excel файла с живыми логами
 */
function ImportButton({ onImport, buttonText = 'Импорт', endpoint = '/import/products/auto' }) {
    const fileInputRef = useRef(null);
    const logsEndRef = useRef(null);

    const [showModal, setShowModal] = useState(false);
    const [importing, setImporting] = useState(false);
    const [done, setDone] = useState(false);
    const [progress, setProgress] = useState(0);
    const [logs, setLogs] = useState([]);
    const [result, setResult] = useState(null);
    const [error, setError] = useState(null);
    const [fileName, setFileName] = useState('');
    const [fileSize, setFileSize] = useState(0);

    // Прокрутка логов вниз при новых сообщениях
    useEffect(() => {
        if (logsEndRef.current) {
            logsEndRef.current.scrollIntoView({ behavior: 'smooth' });
        }
    }, [logs]);

    const addLog = (msg, type = 'info') => {
        const time = new Date().toLocaleTimeString('ru-RU');
        setLogs(prev => [...prev, { time, msg, type }]);
    };

    const handleFileSelect = async (event) => {
        const file = event.target.files[0];
        if (!file) return;

        // Сброс состояния
        setLogs([]);
        setResult(null);
        setError(null);
        setProgress(0);
        setDone(false);
        setFileName(file.name);
        setFileSize((file.size / 1024).toFixed(1));
        setShowModal(true);
        setImporting(true);

        addLog(`📂 Файл выбран: ${file.name} (${(file.size / 1024).toFixed(1)} KB)`, 'info');
        addLog('🔌 Подключение к серверу...', 'info');

        // Симуляция прогресса пока сервер обрабатывает файл
        let simulatedProgress = 0;
        const progressInterval = setInterval(() => {
            simulatedProgress += Math.random() * 3 + 0.5;
            if (simulatedProgress >= 90) {
                simulatedProgress = 90;
                clearInterval(progressInterval);
            }
            setProgress(Math.round(simulatedProgress));
        }, 300);

        // Живые лог-сообщения во время ожидания
        const logMessages = [
            [800,  '📊 Чтение Excel файла...', 'info'],
            [1600, '🔍 Анализ структуры колонок...', 'info'],
            [2400, '✅ Структура распознана', 'success'],
            [3200, '📦 Начало обработки строк...', 'info'],
            [5000, '⚙️ Валидация данных...', 'info'],
            [7000, '💾 Сохранение в базу данных...', 'info'],
            [9000, '🔄 Обработка дубликатов...', 'info'],
            [12000, '📈 Обновление остатков...', 'info'],
        ];

        const timers = logMessages.map(([delay, msg, type]) =>
            setTimeout(() => addLog(msg, type), delay)
        );

        try {
            const formData = new FormData();
            formData.append('file', file);

            const token = localStorage.getItem('token');
            const API_BASE = getApiUrl();

            addLog(`📡 Отправка на сервер: ${endpoint}`, 'info');

            const response = await fetch(`${API_BASE}${endpoint}`, {
                method: 'POST',
                headers: token ? { Authorization: `Bearer ${token}` } : {},
                body: formData,
            });

            // Очищаем таймеры симуляции
            timers.forEach(t => clearTimeout(t));
            clearInterval(progressInterval);
            setProgress(100);

            const data = await response.json();

            if (!response.ok) {
                throw new Error(data.error || `Ошибка сервера: ${response.status}`);
            }

            addLog('─────────────────────────────', 'separator');
            addLog(`✅ Импортировано новых: ${data.imported || 0}`, 'success');
            addLog(`🔄 Обновлено: ${data.updated || 0}`, 'success');
            if (data.errorsCount > 0) {
                addLog(`⚠️ Строк с ошибками: ${data.errorsCount}`, 'warning');
                if (data.errors && data.errors.length > 0) {
                    data.errors.slice(0, 10).forEach(err => {
                        addLog(`   ❌ ${err}`, 'error');
                    });
                    if (data.errors.length > 10) {
                        addLog(`   ... и ещё ${data.errors.length - 10} ошибок`, 'warning');
                    }
                }
            }
            addLog('─────────────────────────────', 'separator');
            addLog('🎉 Импорт завершён!', 'success');

            setResult(data);
            setDone(true);

            if (onImport) {
                await onImport(data);
            }

        } catch (err) {
            timers.forEach(t => clearTimeout(t));
            clearInterval(progressInterval);
            setProgress(100);
            addLog('─────────────────────────────', 'separator');
            addLog(`❌ Ошибка: ${err.message}`, 'error');
            setError(err.message);
            setDone(true);
        } finally {
            setImporting(false);
            event.target.value = '';
        }
    };

    const handleClose = () => {
        if (importing) return;
        setShowModal(false);
    };

    const logColor = {
        info: 'var(--color-text-secondary, #c9b0e8)',
        success: '#00ff88',
        warning: '#ff9500',
        error: '#ff4466',
        separator: 'rgba(123,47,247,0.4)',
    };

    return (
        <>
            <input
                ref={fileInputRef}
                type="file"
                accept=".xlsx,.xls,.csv"
                onChange={handleFileSelect}
                style={{ display: 'none' }}
            />

            <button
                className="btn btn-success"
                onClick={() => fileInputRef.current?.click()}
                disabled={importing}
                title="Импортировать данные из Excel/CSV"
            >
                <Upload size={18} />
                {importing ? 'Импорт...' : buttonText}
            </button>

            {/* Модальное окно с прогрессом */}
            {showModal && (
                <div
                    style={{
                        position: 'fixed', inset: 0,
                        background: 'rgba(5, 0, 15, 0.88)',
                        backdropFilter: 'blur(8px)',
                        zIndex: 9999,
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                    }}
                    onClick={done ? handleClose : undefined}
                >
                    <div
                        style={{
                            background: 'rgba(14, 0, 28, 0.97)',
                            border: '1px solid rgba(123, 47, 247, 0.4)',
                            borderRadius: '16px',
                            padding: '28px',
                            width: '580px',
                            maxWidth: '95vw',
                            boxShadow: '0 0 40px rgba(123,47,247,0.3), 0 0 80px rgba(255,0,128,0.1)',
                        }}
                        onClick={e => e.stopPropagation()}
                    >
                        {/* Заголовок */}
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                                <FileSpreadsheet size={22} color="#7b2ff7" />
                                <div>
                                    <div style={{ fontWeight: 700, fontSize: '15px', color: '#f0e6ff' }}>
                                        Импорт товаров
                                    </div>
                                    <div style={{ fontSize: '12px', color: '#8a6aad', marginTop: '2px' }}>
                                        {fileName} ({fileSize} KB)
                                    </div>
                                </div>
                            </div>
                            {done && (
                                <button
                                    onClick={handleClose}
                                    style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#8a6aad', padding: '4px' }}
                                >
                                    <X size={20} />
                                </button>
                            )}
                        </div>

                        {/* Прогресс-бар */}
                        <div style={{ marginBottom: '16px' }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px', color: '#8a6aad', marginBottom: '6px' }}>
                                <span>{done ? (error ? '❌ Ошибка' : '✅ Завершено') : '⏳ Обработка...'}</span>
                                <span>{progress}%</span>
                            </div>
                            <div style={{ height: '6px', background: 'rgba(123,47,247,0.15)', borderRadius: '99px', overflow: 'hidden' }}>
                                <div style={{
                                    height: '100%',
                                    width: `${progress}%`,
                                    borderRadius: '99px',
                                    background: error
                                        ? 'linear-gradient(90deg, #ff003c, #cc0030)'
                                        : 'linear-gradient(90deg, #ff0080, #7b2ff7, #0066ff)',
                                    transition: 'width 0.4s ease',
                                    boxShadow: error ? '0 0 10px rgba(255,0,60,0.5)' : '0 0 10px rgba(255,0,128,0.4)',
                                }} />
                            </div>
                        </div>

                        {/* Бегущая строка логов */}
                        <div style={{
                            background: 'rgba(0,0,0,0.4)',
                            border: '1px solid rgba(123,47,247,0.2)',
                            borderRadius: '10px',
                            padding: '12px 14px',
                            height: '240px',
                            overflowY: 'auto',
                            fontFamily: "'Courier New', monospace",
                            fontSize: '12px',
                            lineHeight: '1.7',
                        }}>
                            {logs.map((log, i) => (
                                <div key={i} style={{ color: logColor[log.type] || '#ccc', display: 'flex', gap: '8px' }}>
                                    {log.type !== 'separator' && (
                                        <span style={{ color: 'rgba(123,47,247,0.5)', flexShrink: 0 }}>{log.time}</span>
                                    )}
                                    <span style={log.type === 'separator' ? { color: 'rgba(123,47,247,0.3)', width: '100%' } : {}}>
                                        {log.msg}
                                    </span>
                                </div>
                            ))}
                            {!done && (
                                <div style={{ display: 'flex', alignItems: 'center', gap: '6px', color: '#7b2ff7', marginTop: '4px' }}>
                                    <Loader size={12} style={{ animation: 'spin 1s linear infinite' }} />
                                    <span style={{ animation: 'pulse 1.2s ease-in-out infinite' }}>Обработка данных...</span>
                                </div>
                            )}
                            <div ref={logsEndRef} />
                        </div>

                        {/* Итог */}
                        {done && result && !error && (
                            <div style={{
                                marginTop: '14px',
                                display: 'flex', gap: '12px',
                                padding: '12px 16px',
                                background: 'rgba(0,255,136,0.08)',
                                border: '1px solid rgba(0,255,136,0.25)',
                                borderRadius: '10px',
                            }}>
                                <CheckCircle size={18} color="#00ff88" style={{ flexShrink: 0, marginTop: '1px' }} />
                                <div style={{ fontSize: '13px', color: '#f0e6ff' }}>
                                    <strong>Импорт завершён:</strong>{' '}
                                    добавлено {result.imported || 0},{' '}
                                    обновлено {result.updated || 0}
                                    {result.errorsCount > 0 && `, ошибок ${result.errorsCount}`}
                                </div>
                            </div>
                        )}

                        {done && error && (
                            <div style={{
                                marginTop: '14px',
                                display: 'flex', gap: '12px',
                                padding: '12px 16px',
                                background: 'rgba(255,0,60,0.08)',
                                border: '1px solid rgba(255,0,60,0.25)',
                                borderRadius: '10px',
                            }}>
                                <AlertCircle size={18} color="#ff4466" style={{ flexShrink: 0, marginTop: '1px' }} />
                                <div style={{ fontSize: '13px', color: '#f0e6ff' }}>{error}</div>
                            </div>
                        )}

                        {done && (
                            <button
                                className="btn btn-primary"
                                onClick={handleClose}
                                style={{ marginTop: '16px', width: '100%', justifyContent: 'center' }}
                            >
                                Закрыть
                            </button>
                        )}
                    </div>
                </div>
            )}
        </>
    );
}

export default ImportButton;
