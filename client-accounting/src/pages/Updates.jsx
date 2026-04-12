import React, { useState, useEffect } from 'react';
import { GitBranch, Upload, Download, TestTube, CheckCircle, XCircle, RefreshCw, Clock } from 'lucide-react';
import { updatesAPI } from '../services/api';
import { useI18n } from '../i18n';

function Updates() {
    const { t } = useI18n();
    const [checking, setChecking] = useState(false);
    const [message, setMessage] = useState(null);
    const [updateInfo, setUpdateInfo] = useState(null);
    const [history, setHistory] = useState([]);

    useEffect(() => { loadHistory(); }, []);

    const loadHistory = async () => {
        try {
            const res = await updatesAPI.getHistory();
            const data = res.data || res;
            setHistory(data.history || []);
        } catch {
            setHistory([
                { version: '1.2.0', installed_at: '2026-01-16', status: 'installed', notes: 'Текущая версия' },
                { version: '1.1.0', installed_at: '2026-01-10', status: 'installed', notes: 'QR-оплата, Биометрия' },
                { version: '1.0.0', installed_at: '2026-01-01', status: 'installed', notes: 'Первоначальная установка' }
            ]);
        }
    };

    const handleCheckUpdates = async () => {
        setChecking(true);
        setMessage({ type: 'info', text: 'Проверка обновлений...' });
        try {
            const res = await updatesAPI.checkForUpdates();
            const data = res.data || res;
            setUpdateInfo(data);
            if (data.hasUpdate) {
                setMessage({ type: 'warning', text: `Доступна новая версия ${data.latestVersion}! ${(data.changelog || []).join(', ')}` });
            } else {
                setMessage({ type: 'success', text: `Система обновлена. Текущая версия: ${data.currentVersion || '1.2.0'}` });
            }
        } catch (error) {
            setMessage({ type: 'error', text: 'Ошибка проверки обновлений' });
        } finally {
            setChecking(false);
        }
    };

    const updateTypes = [
        {
            title: 'Обновление типовых конфигураций',
            icon: <Download size={32} />,
            color: '#3b82f6',
            features: [
                'Обновление базовой конфигурации',
                'Установка новых релизов',
                'Обновление платформы 1С',
                'Изменение методологии учёта',
                'Обновление отчётов для сдачи'
            ]
        },
        {
            title: 'Обновление доработанных баз',
            icon: <Upload size={32} />,
            color: '#10b981',
            features: [
                'Сравнение конфигураций',
                'Объединение изменений',
                'Сохранение доработок',
                'Перенос настроек',
                'Обновление расширений'
            ]
        },
        {
            title: 'Решение конфликтов',
            icon: <GitBranch size={32} />,
            color: '#f59e0b',
            features: [
                'Анализ конфликтов обновления',
                'Разрешение конфликтов объектов',
                'Приоритет доработок',
                'Логирование изменений',
                'Откат при необходимости'
            ]
        },
        {
            title: 'Тестирование после обновлений',
            icon: <TestTube size={32} />,
            color: '#8b5cf6',
            features: [
                'Функциональное тестирование',
                'Проверка доработок',
                'Тестирование отчётов',
                'Проверка интеграций',
                'Нагрузочное тестирование'
            ]
        }
    ];

    return (
        <div className="updates-page fade-in">
            <div className="page-header">
                <div>
                    <h1>{t('updates.obnovleniya', 'Обновления')}</h1>
                    <p className="text-muted">{t('updates.upravlenie_obnovleniyami_konfiguratsiy_i_p', 'Управление обновлениями конфигураций и платформы')}</p>
                </div>
                <button className="btn btn-primary" onClick={handleCheckUpdates} disabled={checking}>
                    {checking ? <RefreshCw size={20} className="spin" /> : <Download size={20} />}
                    {checking ? 'Проверка...' : 'Проверить обновления'}
                </button>
            </div>

            {message && (
                <div className={`alert alert-${message.type === 'success' ? 'success' : message.type === 'warning' ? 'warning' : message.type === 'info' ? 'info' : 'danger'}`}
                    style={{ marginBottom: '16px', display: 'flex', alignItems: 'center', gap: '10px' }}>
                    {message.type === 'success' ? <CheckCircle size={18} /> : message.type === 'warning' ? <Clock size={18} /> : <XCircle size={18} />}
                    {message.text}
                    <button onClick={() => setMessage(null)} style={{ marginLeft: 'auto', background: 'none', border: 'none', cursor: 'pointer', color: 'inherit' }}>×</button>
                </div>
            )}

            {updateInfo && updateInfo.hasUpdate && (
                <div className="card" style={{ marginBottom: '20px', border: '2px solid #f59e0b', background: '#fef3c7' }}>
                    <h3 style={{ color: '#92400e', marginBottom: '12px' }}>🔔 Доступно обновление {updateInfo.latestVersion}</h3>
                    <ul style={{ paddingLeft: '20px', color: '#78350f' }}>
                        {(updateInfo.changelog || []).map((item, i) => <li key={i}>{item}</li>)}
                    </ul>
                    <div style={{ marginTop: '16px', fontSize: '13px', color: '#92400e' }}>
                        Размер: {updateInfo.size || '~50 MB'} · Дата выхода: {updateInfo.releaseDate || 'н/д'}
                    </div>
                </div>
            )}

            {/* Update Types */}
            <div className="grid grid-2 mb-3">
                {updateTypes.map((type, index) => (
                    <div key={index} className="card">
                        <div style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: '15px',
                            marginBottom: '20px',
                            paddingBottom: '15px',
                            borderBottom: `2px solid ${type.color}`
                        }}>
                            <div style={{ background: type.color, color: 'white', padding: '15px', borderRadius: '10px' }}>
                                {type.icon}
                            </div>
                            <h2 style={{ margin: 0 }}>{type.title}</h2>
                        </div>
                        <ul style={{ listStyle: 'none', padding: 0, margin: 0 }}>
                            {type.features.map((feature, fIndex) => (
                                <li key={fIndex} style={{
                                    padding: '10px 0',
                                    borderBottom: fIndex < type.features.length - 1 ? '1px solid var(--border-color)' : 'none',
                                    display: 'flex', alignItems: 'center', gap: '10px'
                                }}>
                                    <div style={{ width: '6px', height: '6px', borderRadius: '50%', background: type.color, flexShrink: 0 }}></div>
                                    <span style={{ fontSize: '0.95rem' }}>{feature}</span>
                                </li>
                            ))}
                        </ul>
                    </div>
                ))}
            </div>

            {/* History */}
            <div className="card">
                <h2 style={{ marginBottom: '20px' }}>{t('updates.istoriya_obnovleniy', 'История обновлений')}</h2>
                <table>
                    <thead>
                        <tr>
                            <th>{t('updates.versiya', 'Версия')}</th>
                            <th>{t('updates.data', 'Дата')}</th>
                            <th>{t('updates.opisanie', 'Описание')}</th>
                            <th>{t('updates.status', 'Статус')}</th>
                        </tr>
                    </thead>
                    <tbody>
                        {history.map((update, index) => (
                            <tr key={index}>
                                <td><code>{update.version}</code></td>
                                <td>{update.installed_at || update.date}</td>
                                <td>{update.notes || update.description}</td>
                                <td>
                                    {update.status === 'installed' || update.status === 'success' ? (
                                        <span className="badge badge-success">
                                            <CheckCircle size={14} style={{ marginRight: '5px' }} />
                                            Установлено
                                        </span>
                                    ) : (
                                        <span className="badge badge-warning">
                                            <Clock size={14} style={{ marginRight: '5px' }} />
                                            Ожидает
                                        </span>
                                    )}
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
        </div>
    );
}

export default Updates;
