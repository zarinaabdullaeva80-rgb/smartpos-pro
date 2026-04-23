import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Key, Shield, Check, Clock, AlertTriangle, FileText, Download, Upload, RefreshCw, Eye, Trash2, X, Wifi, WifiOff, CreditCard } from 'lucide-react';
import { edsAPI } from '../services/api';
import EImzoService from '../services/eimzo';
import { useToast } from '../components/ToastProvider';
import { useI18n } from '../i18n';

function DigitalSignature() {
    const { t } = useI18n();
    const toast = useToast();
    const [signatures, setSignatures] = useState([]);
    const [eimzoKeys, setEimzoKeys] = useState([]);
    const [loading, setLoading] = useState(true);
    const [eimzoConnected, setEimzoConnected] = useState(false);
    const [eimzoVersion, setEimzoVersion] = useState(null);
    const [connecting, setConnecting] = useState(false);
    const [showSignModal, setShowSignModal] = useState(false);
    const [signing, setSigning] = useState(false);
    const [selectedKeyIdx, setSelectedKeyIdx] = useState('');
    const docFileRef = useRef(null);

    // Подключение к E-IMZO
    const connectEimzo = useCallback(async () => {
        setConnecting(true);
        try {
            await EImzoService.connect();
            setEimzoConnected(true);
            setEimzoVersion(EImzoService.getVersion());
            toast.success('E-IMZO подключён');
            // Загружаем ключи
            const keys = await EImzoService.listKeys();
            setEimzoKeys(keys);
            if (keys.length === 0) {
                toast.info('ЭЦП ключи не найдены. Вставьте USB-ключ.');
            }
        } catch (err) {
            setEimzoConnected(false);
            toast.error(err.message || 'Не удалось подключиться к E-IMZO');
        } finally {
            setConnecting(false);
        }
    }, [toast]);

    // Загрузка подписей из БД
    const loadSignatures = useCallback(async () => {
        try {
            const res = await edsAPI.getSignatures();
            setSignatures((res.data || res).signatures || []);
        } catch { setSignatures([]); }
    }, []);

    useEffect(() => {
        setLoading(true);
        Promise.all([connectEimzo(), loadSignatures()]).finally(() => setLoading(false));
        return () => EImzoService.disconnect();
    }, [connectEimzo, loadSignatures]);

    // Подписание документа через E-IMZO
    const handleSign = async () => {
        const file = docFileRef.current?.files[0];
        if (!file) { toast.error('Выберите документ для подписания'); return; }
        if (selectedKeyIdx === '' || !eimzoKeys[selectedKeyIdx]) { toast.error('Выберите ключ ЭЦП'); return; }

        setSigning(true);
        try {
            const keyObj = eimzoKeys[selectedKeyIdx];
            // 1. Загружаем ключ (E-IMZO запросит пароль у пользователя)
            toast.info('E-IMZO: введите пароль ключа...');
            const keyId = await EImzoService.loadKey(keyObj);
            // 2. Читаем файл
            const arrayBuffer = await file.arrayBuffer();
            // 3. Подписываем через PKCS#7
            toast.info('Подписание документа...');
            const pkcs7_64 = await EImzoService.signFile(keyId, arrayBuffer, false);
            // 4. Сохраняем на сервер
            const formData = new FormData();
            formData.append('document', file);
            formData.append('pkcs7', pkcs7_64);
            formData.append('signer_name', keyObj.CN || keyObj.O || '');
            formData.append('signer_tin', keyObj.TIN || '');
            formData.append('signer_pinfl', keyObj.PINFL || '');
            formData.append('serial_number', keyObj.serialNumber || '');
            await edsAPI.signDocument(formData);

            toast.success('Документ успешно подписан ЭЦП!');
            setShowSignModal(false);
            loadSignatures();
        } catch (err) {
            toast.error('Ошибка: ' + (err.message || 'Не удалось подписать'));
        } finally {
            setSigning(false);
        }
    };

    const handleVerify = async (id) => {
        try {
            const res = await edsAPI.verifySignature(id);
            const d = res.data || res;
            toast[d.valid ? 'success' : 'error'](d.valid ? '✓ Подпись действительна' : '✗ Подпись недействительна');
        } catch { toast.error('Ошибка проверки'); }
    };

    const handleDownload = async (id, name) => {
        try {
            const res = await edsAPI.downloadSigned(id);
            const url = URL.createObjectURL(res.data);
            const a = document.createElement('a'); a.href = url; a.download = name; a.click();
            URL.revokeObjectURL(url);
        } catch { toast.error('Ошибка скачивания'); }
    };

    const refreshKeys = async () => {
        try {
            const keys = await EImzoService.listKeys();
            setEimzoKeys(keys);
            toast.success(`Найдено ключей: ${keys.length}`);
        } catch (err) { toast.error(err.message); }
    };

    const si = (status) => ({
        valid: { label: 'Действительна', color: '#10b981', bg: '#dcfce7', icon: Check },
        active: { label: 'Активна', color: '#10b981', bg: '#dcfce7', icon: Check },
        expired: { label: 'Истекла', color: '#ef4444', bg: '#fee2e2', icon: AlertTriangle },
        invalid: { label: 'Недействительна', color: '#ef4444', bg: '#fee2e2', icon: AlertTriangle }
    }[status] || { label: status, color: '#6b7280', bg: '#f3f4f6', icon: Clock });

    const modalOverlay = { position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 };
    const modalBox = { background: 'var(--card-bg, white)', borderRadius: '16px', padding: '24px', width: '600px', maxWidth: '90vw', maxHeight: '80vh', overflow: 'auto' };
    const inputStyle = { width: '100%', padding: '10px 14px', borderRadius: '8px', border: '1px solid var(--border-color)', background: 'var(--bg-secondary, #f8f9fa)', fontSize: '14px', marginBottom: '12px', boxSizing: 'border-box' };

    return (
        <div className="digital-signature-page fade-in">
            <div className="page-header">
                <div>
                    <h1>🔐 ЭЦП подписание (E-IMZO)</h1>
                    <p className="text-muted">Электронная цифровая подпись документов через E-IMZO</p>
                </div>
                <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
                    {/* Статус E-IMZO */}
                    <div style={{
                        display: 'flex', alignItems: 'center', gap: '8px',
                        padding: '8px 16px', borderRadius: '12px',
                        background: eimzoConnected ? '#dcfce7' : '#fee2e2',
                        color: eimzoConnected ? '#166534' : '#991b1b',
                        fontSize: '13px', fontWeight: 500
                    }}>
                        {eimzoConnected ? <Wifi size={16} /> : <WifiOff size={16} />}
                        {eimzoConnected ? `E-IMZO v${eimzoVersion || '?'}` : 'E-IMZO не подключён'}
                    </div>
                    {!eimzoConnected && (
                        <button className="btn btn-secondary" onClick={connectEimzo} disabled={connecting}>
                            <RefreshCw size={16} className={connecting ? 'spin' : ''} />
                            {connecting ? 'Подключение...' : 'Подключить'}
                        </button>
                    )}
                    <button className="btn btn-primary" onClick={() => setShowSignModal(true)} disabled={!eimzoConnected}>
                        <Key size={18} /> Подписать документ
                    </button>
                </div>
            </div>

            {/* Ключи ЭЦП из E-IMZO */}
            <div className="card" style={{ marginBottom: '20px' }}>
                <div style={{ padding: '16px', borderBottom: '1px solid var(--border-color)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <h3 style={{ margin: 0 }}>🔑 Ключи ЭЦП (E-IMZO)</h3>
                    {eimzoConnected && (
                        <button className="btn btn-sm btn-secondary" onClick={refreshKeys}>
                            <RefreshCw size={14} /> Обновить
                        </button>
                    )}
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(350px, 1fr))', gap: '16px', padding: '16px' }}>
                    {!eimzoConnected && (
                        <div style={{ padding: '30px', color: '#888', gridColumn: '1 / -1', textAlign: 'center' }}>
                            <WifiOff size={32} style={{ marginBottom: '8px', opacity: 0.5 }} />
                            <div>Подключите E-IMZO для просмотра ключей ЭЦП</div>
                            <div style={{ fontSize: '12px', marginTop: '8px' }}>
                                <a href="https://e-imzo.uz/main/downloads/" target="_blank" rel="noreferrer" style={{ color: 'var(--primary)' }}>
                                    Скачать E-IMZO
                                </a>
                            </div>
                        </div>
                    )}
                    {eimzoConnected && eimzoKeys.length === 0 && (
                        <div style={{ padding: '20px', color: '#888', gridColumn: '1 / -1', textAlign: 'center' }}>
                            ЭЦП ключи не обнаружены. Вставьте USB-ключ и нажмите «Обновить».
                        </div>
                    )}
                    {eimzoKeys.map((key, idx) => {
                        const info = EImzoService.formatKeyInfo(key);
                        const isExpired = key.validTo && new Date(key.validTo.replace(/\./g, '-')) < new Date();
                        return (
                            <div key={idx} style={{
                                padding: '20px', border: '1px solid var(--border-color)',
                                borderRadius: '12px', background: 'var(--bg-secondary)',
                                borderLeft: `4px solid ${isExpired ? '#ef4444' : '#10b981'}`
                            }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '12px' }}>
                                    <div style={{
                                        width: '48px', height: '48px', borderRadius: '12px',
                                        background: isExpired ? 'linear-gradient(135deg, #ef4444, #dc2626)' : 'linear-gradient(135deg, #3b82f6, #1d4ed8)',
                                        display: 'flex', alignItems: 'center', justifyContent: 'center'
                                    }}>
                                        <CreditCard size={24} color="white" />
                                    </div>
                                    <div style={{ flex: 1 }}>
                                        <div style={{ fontWeight: 'bold', fontSize: '14px' }}>{info.title}</div>
                                        {info.subtitle && <div style={{ fontSize: '12px', color: '#888' }}>{info.subtitle}</div>}
                                    </div>
                                    <span style={{
                                        background: isExpired ? '#fee2e2' : '#dcfce7',
                                        color: isExpired ? '#ef4444' : '#10b981',
                                        padding: '4px 10px', borderRadius: '12px', fontSize: '11px'
                                    }}>
                                        {isExpired ? 'Истёк' : 'Активен'}
                                    </span>
                                </div>
                                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '6px', fontSize: '12px', color: '#666' }}>
                                    {info.tin && <div><strong>ИНН:</strong> {info.tin}</div>}
                                    {info.pinfl && <div><strong>ПИНФЛ:</strong> {info.pinfl}</div>}
                                    <div><strong>С:</strong> {info.validFrom || '—'}</div>
                                    <div><strong>До:</strong> {info.validTo || '—'}</div>
                                    {info.serialNumber && <div style={{ gridColumn: '1/-1' }}><strong>Серия:</strong> {info.serialNumber}</div>}
                                </div>
                            </div>
                        );
                    })}
                </div>
            </div>

            {/* История подписей */}
            <div className="card">
                <div style={{ padding: '16px', borderBottom: '1px solid var(--border-color)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <h3 style={{ margin: 0 }}>📋 История подписаний</h3>
                    <button className="btn btn-sm btn-secondary" onClick={loadSignatures}><RefreshCw size={14} /> Обновить</button>
                </div>
                {loading ? (
                    <div style={{ padding: '40px', textAlign: 'center' }}>Загрузка...</div>
                ) : (
                    <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                        <thead>
                            <tr style={{ background: 'var(--bg-secondary)' }}>
                                <th style={{ padding: '12px', textAlign: 'left' }}>Документ</th>
                                <th style={{ padding: '12px', textAlign: 'left' }}>Подписант</th>
                                <th style={{ padding: '12px', textAlign: 'center' }}>Дата</th>
                                <th style={{ padding: '12px', textAlign: 'center' }}>Хэш</th>
                                <th style={{ padding: '12px', textAlign: 'center' }}>Статус</th>
                                <th style={{ padding: '12px', textAlign: 'center' }}>Действия</th>
                            </tr>
                        </thead>
                        <tbody>
                            {signatures.length === 0 && (
                                <tr><td colSpan="6" style={{ padding: '20px', textAlign: 'center', color: '#888' }}>Нет подписанных документов</td></tr>
                            )}
                            {signatures.map(sig => {
                                const s = si(sig.status);
                                const SI = s.icon;
                                return (
                                    <tr key={sig.id} style={{ borderBottom: '1px solid var(--border-color)' }}>
                                        <td style={{ padding: '12px' }}>
                                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                                <FileText size={16} color="var(--primary)" />
                                                <span style={{ fontWeight: 500 }}>{sig.document_name}</span>
                                            </div>
                                        </td>
                                        <td style={{ padding: '12px' }}>{sig.signer_name}</td>
                                        <td style={{ padding: '12px', textAlign: 'center', fontSize: '13px' }}>{sig.signed_at ? new Date(sig.signed_at).toLocaleString('ru') : ''}</td>
                                        <td style={{ padding: '12px', textAlign: 'center' }}>
                                            <code style={{ background: 'var(--bg-secondary)', padding: '3px 6px', borderRadius: '4px', fontSize: '10px' }}>
                                                {(sig.document_hash || '').substring(0, 16)}...
                                            </code>
                                        </td>
                                        <td style={{ padding: '12px', textAlign: 'center' }}>
                                            <span style={{ background: s.bg, color: s.color, padding: '4px 10px', borderRadius: '12px', fontSize: '11px', display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                                                <SI size={12} /> {s.label}
                                            </span>
                                        </td>
                                        <td style={{ padding: '12px', textAlign: 'center' }}>
                                            <div style={{ display: 'flex', gap: '4px', justifyContent: 'center' }}>
                                                <button className="btn btn-sm btn-secondary" title="Проверить" onClick={() => handleVerify(sig.id)}><Eye size={14} /></button>
                                                <button className="btn btn-sm btn-secondary" title="Скачать" onClick={() => handleDownload(sig.id, sig.document_name)}><Download size={14} /></button>
                                            </div>
                                        </td>
                                    </tr>
                                );
                            })}
                        </tbody>
                    </table>
                )}
            </div>

            {/* Модалка подписания */}
            {showSignModal && (
                <div style={modalOverlay} onClick={() => setShowSignModal(false)}>
                    <div style={modalBox} onClick={e => e.stopPropagation()}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '20px' }}>
                            <h3 style={{ margin: 0 }}>✍️ Подписать документ (E-IMZO)</h3>
                            <button className="btn btn-sm btn-secondary" onClick={() => setShowSignModal(false)}><X size={16} /></button>
                        </div>

                        <label style={{ fontSize: '13px', color: '#888', marginBottom: '4px', display: 'block' }}>Документ для подписания</label>
                        <input ref={docFileRef} type="file" accept=".pdf,.xlsx,.docx,.xml,.json,.txt" style={inputStyle} />

                        <label style={{ fontSize: '13px', color: '#888', marginBottom: '4px', display: 'block' }}>Ключ ЭЦП</label>
                        {eimzoKeys.length === 0 ? (
                            <div style={{ padding: '16px', background: '#fef3c7', borderRadius: '8px', marginBottom: '12px', fontSize: '13px', color: '#92400e' }}>
                                ⚠️ Нет доступных ключей. Вставьте USB-ключ ЭЦП и нажмите «Обновить ключи».
                                <button className="btn btn-sm btn-secondary" onClick={refreshKeys} style={{ marginLeft: '8px' }}>
                                    <RefreshCw size={12} /> Обновить
                                </button>
                            </div>
                        ) : (
                            <select value={selectedKeyIdx} onChange={e => setSelectedKeyIdx(e.target.value)} style={inputStyle}>
                                <option value="">— Выберите ключ ЭЦП —</option>
                                {eimzoKeys.map((key, idx) => {
                                    const info = EImzoService.formatKeyInfo(key);
                                    return <option key={idx} value={idx}>{info.title} {info.tin ? `(ИНН: ${info.tin})` : ''} {info.subtitle ? `— ${info.subtitle}` : ''}</option>;
                                })}
                            </select>
                        )}

                        {selectedKeyIdx !== '' && eimzoKeys[selectedKeyIdx] && (() => {
                            const info = EImzoService.formatKeyInfo(eimzoKeys[selectedKeyIdx]);
                            return (
                                <div style={{ padding: '12px', background: 'var(--bg-secondary)', borderRadius: '8px', marginBottom: '12px', fontSize: '12px' }}>
                                    <strong>{info.title}</strong>
                                    {info.subtitle && <span style={{ color: '#888' }}> — {info.subtitle}</span>}
                                    <div style={{ marginTop: '4px', color: '#666' }}>
                                        {info.tin && <span>ИНН: {info.tin} </span>}
                                        {info.pinfl && <span>ПИНФЛ: {info.pinfl} </span>}
                                        <span>Срок: {info.validFrom} — {info.validTo}</span>
                                    </div>
                                </div>
                            );
                        })()}

                        <div style={{ background: '#eff6ff', padding: '12px', borderRadius: '8px', marginBottom: '16px', fontSize: '12px', color: '#1e40af' }}>
                            ℹ️ После нажатия «Подписать», E-IMZO запросит пароль вашего ключа ЭЦП. Документ будет подписан в формате PKCS#7.
                        </div>

                        <div style={{ display: 'flex', gap: '12px', justifyContent: 'flex-end' }}>
                            <button className="btn btn-secondary" onClick={() => setShowSignModal(false)}>Отмена</button>
                            <button className="btn btn-primary" onClick={handleSign} disabled={signing || eimzoKeys.length === 0}>
                                {signing ? <><RefreshCw size={14} className="spin" /> Подписание...</> : <><Key size={14} /> Подписать ЭЦП</>}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}

export default DigitalSignature;
