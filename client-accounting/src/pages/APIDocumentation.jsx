import React, { useState, useEffect } from 'react';
import { Code, Key, Copy, RefreshCw, Check, Eye, EyeOff, Book, Shield, Clock, Activity } from 'lucide-react';
import { settingsAPI } from '../services/api';
import { useToast } from '../components/ToastProvider';
import { useI18n } from '../i18n';

function APIDocumentation() {
    const { t } = useI18n();
    const toast = useToast();
    const [apiKey, setApiKey] = useState('sk_live_abc123xyz789def456ghi');
    const [showKey, setShowKey] = useState(false);
    const [copied, setCopied] = useState(false);

    const endpoints = [
        { method: 'GET', path: '/api/v1/products', description: 'Список всех товаров', auth: true },
        { method: 'POST', path: '/api/v1/products', description: 'Создать товар', auth: true },
        { method: 'GET', path: '/api/v1/products/:id', description: 'Получить товар по ID', auth: true },
        { method: 'PUT', path: '/api/v1/products/:id', description: 'Обновить товар', auth: true },
        { method: 'DELETE', path: '/api/v1/products/:id', description: 'Удалить товар', auth: true },
        { method: 'GET', path: '/api/v1/sales', description: 'Список продаж', auth: true },
        { method: 'POST', path: '/api/v1/sales', description: 'Создать продажу', auth: true },
        { method: 'GET', path: '/api/v1/customers', description: 'Список клиентов', auth: true },
        { method: 'GET', path: '/api/v1/inventory', description: 'Остатки на складе', auth: true },
        { method: 'GET', path: '/api/v1/reports/sales', description: 'Отчёт по продажам', auth: true }
    ];

    const getMethodColor = (method) => {
        const colors = {
            GET: '#10b981',
            POST: '#3b82f6',
            PUT: '#f59e0b',
            DELETE: '#ef4444'
        };
        return colors[method] || '#888';
    };

    const copyToClipboard = (text) => {
        navigator.clipboard.writeText(text);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
    };

    return (
        <div className="api-docs-page fade-in">
            <div className="page-header">
                <div>
                    <h1>{t('apidocumentation.dokumentatsiya', '📚 API Документация')}</h1>
                    <p className="text-muted">{t('apidocumentation.dlya_integratsii_s_vneshnimi_siste', 'REST API для интеграции с внешними системами')}</p>
                </div>
            </div>

            {/* API ключ */}
            <div className="card" style={{ marginBottom: '20px', padding: '24px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                    <div>
                        <h3 style={{ margin: '0 0 8px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                            <Key size={20} color="#f59e0b" />
                            API Ключ
                        </h3>
                        <p style={{ color: '#888', fontSize: '13px', margin: '0 0 16px' }}>
                            Используйте этот ключ для авторизации запросов
                        </p>
                    </div>
                    <button className="btn btn-secondary" onClick={() => toast.info('Генерация нового API ключа...')}>
                        <RefreshCw size={16} /> Сгенерировать новый
                    </button>
                </div>

                <div style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '12px',
                    padding: '16px',
                    background: 'var(--bg-secondary)',
                    borderRadius: '8px',
                    fontFamily: 'monospace'
                }}>
                    <code style={{ flex: 1, fontSize: '14px' }}>
                        {showKey ? apiKey : '•'.repeat(apiKey.length)}
                    </code>
                    <button
                        className="btn btn-sm btn-secondary"
                        onClick={() => setShowKey(!showKey)}
                        title={showKey ? 'Скрыть' : 'Показать'}
                    >
                        {showKey ? <EyeOff size={16} /> : <Eye size={16} />}
                    </button>
                    <button
                        className="btn btn-sm btn-primary"
                        onClick={() => copyToClipboard(apiKey)}
                    >
                        {copied ? <Check size={16} /> : <Copy size={16} />}
                        {copied ? 'Скопировано' : 'Копировать'}
                    </button>
                </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 350px', gap: '20px' }}>
                {/* Endpoints */}
                <div className="card">
                    <div style={{ padding: '16px', borderBottom: '1px solid var(--border-color)' }}>
                        <h3 style={{ margin: 0 }}>🔗 Endpoints</h3>
                    </div>
                    <div>
                        {endpoints.map((ep, idx) => (
                            <div key={idx} style={{
                                padding: '16px',
                                borderBottom: '1px solid var(--border-color)',
                                display: 'flex',
                                alignItems: 'center',
                                gap: '16px'
                            }}>
                                <span style={{
                                    padding: '4px 10px',
                                    background: `${getMethodColor(ep.method)}20`,
                                    color: getMethodColor(ep.method),
                                    borderRadius: '6px',
                                    fontWeight: 'bold',
                                    fontSize: '12px',
                                    minWidth: '60px',
                                    textAlign: 'center'
                                }}>
                                    {ep.method}
                                </span>
                                <code style={{ flex: 1, color: 'var(--primary)' }}>{ep.path}</code>
                                <span style={{ color: '#888', fontSize: '13px' }}>{ep.description}</span>
                                {ep.auth && <Shield size={14} color="#f59e0b" title={t('apidocumentation.trebuet_avtorizatsiyu', 'Требует авторизацию')} />}
                            </div>
                        ))}
                    </div>
                </div>

                {/* Быстрый старт */}
                <div>
                    <div className="card" style={{ marginBottom: '20px' }}>
                        <div style={{ padding: '16px', borderBottom: '1px solid var(--border-color)' }}>
                            <h3 style={{ margin: 0 }}>{t('apidocumentation.bystryy_start', '⚡ Быстрый старт')}</h3>
                        </div>
                        <div style={{ padding: '16px' }}>
                            <p style={{ fontSize: '13px', color: '#888', margin: '0 0 12px' }}>
                                Пример запроса с cURL:
                            </p>
                            <pre style={{
                                background: '#1e1e1e',
                                color: '#9cdcfe',
                                padding: '16px',
                                borderRadius: '8px',
                                fontSize: '12px',
                                overflow: 'auto'
                            }}>
                                {`curl -X GET \\
  https://api.1c-buhgalteriya.uz/v1/products \\
  -H "Authorization: Bearer YOUR_API_KEY" \\
  -H "Content-Type: application/json"`}
                            </pre>
                        </div>
                    </div>

                    <div className="card">
                        <div style={{ padding: '16px', borderBottom: '1px solid var(--border-color)' }}>
                            <h3 style={{ margin: 0 }}>{t('apidocumentation.statistika', '📊 Статистика API')}</h3>
                        </div>
                        <div style={{ padding: '16px' }}>
                            <div style={{ display: 'grid', gap: '12px' }}>
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                    <span style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#888' }}>
                                        <Activity size={16} /> Запросов сегодня
                                    </span>
                                    <span style={{ fontWeight: 'bold' }}>1,245</span>
                                </div>
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                    <span style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#888' }}>
                                        <Clock size={16} /> Среднее время ответа
                                    </span>
                                    <span style={{ fontWeight: 'bold', color: '#10b981' }}>45ms</span>
                                </div>
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                    <span style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#888' }}>
                                        <Check size={16} /> Успешных
                                    </span>
                                    <span style={{ fontWeight: 'bold', color: '#10b981' }}>99.8%</span>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}

export default APIDocumentation;
