import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Key, Shield, Check, Clock, AlertTriangle, FileText, Download, Upload, RefreshCw, Eye, Trash2, X, Wifi, WifiOff, CreditCard, Send, Inbox } from 'lucide-react';
import { edsAPI } from '../services/api';
import EImzoService from '../services/eimzo';
import { useToast } from '../components/ToastProvider';
import { useI18n } from '../i18n';
import OutgoingDocs from '../components/eds/OutgoingDocs';
import IncomingDocs from '../components/eds/IncomingDocs';
import SendDocModal from '../components/eds/SendDocModal';

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
    const [activeTab, setActiveTab] = useState('signatures');
    const [showSendModal, setShowSendModal] = useState(false);
    const [newIncoming, setNewIncoming] = useState(0);

    // Подключение к E-IMZO
    const connectEimzo = useCallback(async () => {
        setConnecting(true);
        try {
            await EImzoService.connect();
            setEimzoConnected(true);
            setEimzoVersion(EImzoService.getVersion());
            toast.success(t('eds.statusConnected'));
            // Загружаем ключи
            const keys = await EImzoService.listKeys();
            setEimzoKeys(keys);
            if (keys.length === 0) {
                toast.info(t('eds.noKeys'));
            }
        } catch (err) {
            setEimzoConnected(false);
            toast.error(err.message || t('eds.connectError', 'Не удалось подключиться к E-IMZO'));
        } finally {
            setConnecting(false);
        }
    }, [toast, t]);

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
        edsAPI.getDocStats().then(r => setNewIncoming((r.data || r).newIncoming || 0)).catch(() => {});
        return () => EImzoService.disconnect();
    }, [connectEimzo, loadSignatures]);

    // Callback для PKCS#7 подписания из SendDocModal
    const handleSignPkcs7 = async (keySerial, hashHex) => {
        const keyObj = eimzoKeys.find(k => k.serialNumber === keySerial);
        if (!keyObj) return null;
        toast.info(t('eds.enterPassword'));
        const keyId = await EImzoService.loadKey(keyObj);
        const pkcs7 = await EImzoService.signHash(keyId, hashHex);
        return pkcs7;
    };

    const handleSendClose = (sent) => {
        setShowSendModal(false);
        if (sent) edsAPI.getDocStats().then(r => setNewIncoming((r.data || r).newIncoming || 0)).catch(() => {});
    };

    // Подписание документа через E-IMZO
    const handleSign = async () => {
        const file = docFileRef.current?.files[0];
        if (!file) { toast.error(t('eds.selectDoc')); return; }
        if (selectedKeyIdx === '' || !eimzoKeys[selectedKeyIdx]) { toast.error(t('eds.selectKey')); return; }

        setSigning(true);
        try {
            const keyObj = eimzoKeys[selectedKeyIdx];
            // 1. Загружаем ключ (E-IMZO запросит пароль у пользователя)
            toast.info(t('eds.enterPassword'));
            const keyId = await EImzoService.loadKey(keyObj);
            // 2. Читаем файл
            const arrayBuffer = await file.arrayBuffer();
            // 3. Подписываем через PKCS#7
            toast.info(t('eds.signingDoc'));
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

            toast.success(t('eds.signSuccess'));
            setShowSignModal(false);
            loadSignatures();
        } catch (err) {
            toast.error(t('eds.signError', { error: err.message || t('common.error') }));
        } finally {
            setSigning(false);
        }
    };

    const handleVerify = async (id) => {
        try {
            const res = await edsAPI.verifySignature(id);
            const d = res.data || res;
            toast[d.valid ? 'success' : 'error'](d.valid ? t('eds.verifySuccess') : t('eds.verifyError'));
        } catch { toast.error(t('eds.verifyError')); }
    };

    const handleDownload = async (id, name) => {
        try {
            const res = await edsAPI.downloadSigned(id);
            const url = URL.createObjectURL(res.data);
            const a = document.createElement('a'); a.href = url; a.download = name; a.click();
            URL.revokeObjectURL(url);
        } catch { toast.error(t('eds.downloadError')); }
    };

    const refreshKeys = async () => {
        try {
            const keys = await EImzoService.listKeys();
            setEimzoKeys(keys);
            toast.success(t('eds.keysFound', { count: keys.length }));
        } catch (err) { toast.error(err.message); }
    };

    const si = (status) => ({
        valid: { label: t('eds.statusValid'), color: '#10b981', bg: '#dcfce7', icon: Check },
        active: { label: t('eds.statusActive'), color: '#10b981', bg: '#dcfce7', icon: Check },
        expired: { label: t('eds.statusExpired'), color: '#ef4444', bg: '#fee2e2', icon: AlertTriangle },
        invalid: { label: t('eds.statusInvalid'), color: '#ef4444', bg: '#fee2e2', icon: AlertTriangle }
    }[status] || { label: status, color: '#6b7280', bg: '#f3f4f6', icon: Clock });

    const modalOverlay = { position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 };
    const modalBox = { background: 'var(--card-bg, white)', borderRadius: '16px', padding: '24px', width: '600px', maxWidth: '90vw', maxHeight: '80vh', overflow: 'auto' };
    const inputStyle = { width: '100%', padding: '10px 14px', borderRadius: '8px', border: '1px solid var(--border-color)', background: 'var(--bg-secondary, #f8f9fa)', fontSize: '14px', marginBottom: '12px', boxSizing: 'border-box' };

    const tabStyle = (tab) => ({
        padding: '10px 20px', cursor: 'pointer', fontWeight: 500, fontSize: 14,
        borderBottom: activeTab === tab ? '3px solid var(--primary)' : '3px solid transparent',
        color: activeTab === tab ? 'var(--primary)' : 'var(--text-secondary)',
        background: 'none', border: 'none', display: 'flex', alignItems: 'center', gap: 6,
        position: 'relative', transition: 'all 0.2s'
    });

    return (
        <div className="digital-signature-page fade-in">
            <div className="page-header">
                <div>
                    <h1>{t('eds.title')}</h1>
                    <p className="text-muted">{t('eds.subtitle')}</p>
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
                        {eimzoConnected ? `E-IMZO v${eimzoVersion || '?'}` : t('eds.statusDisconnected')}
                    </div>
                    {!eimzoConnected && (
                        <button className="btn btn-secondary" onClick={connectEimzo} disabled={connecting}>
                            <RefreshCw size={16} className={connecting ? 'spin' : ''} />
                            {connecting ? t('eds.connecting') : t('eds.connect')}
                        </button>
                    )}
                    <button className="btn btn-primary" onClick={() => setShowSendModal(true)}>
                        <Send size={16} /> {t('eds.sendDocument')}
                    </button>
                    <button className="btn btn-secondary" onClick={() => setShowSignModal(true)} disabled={!eimzoConnected}>
                        <Key size={18} /> {t('eds.signBtn')}
                    </button>
                </div>
            </div>

            {/* Вкладки ЭДО */}
            <div style={{ display: 'flex', borderBottom: '1px solid var(--border-color)', marginBottom: 20 }}>
                <button style={tabStyle('signatures')} onClick={() => setActiveTab('signatures')}>
                    <Key size={16} /> {t('eds.tabMySignatures')}
                </button>
                <button style={tabStyle('outgoing')} onClick={() => setActiveTab('outgoing')}>
                    <Send size={16} /> {t('eds.tabOutgoing')}
                </button>
                <button style={tabStyle('incoming')} onClick={() => setActiveTab('incoming')}>
                    <Inbox size={16} /> {t('eds.tabIncoming')}
                    {newIncoming > 0 && (
                        <span style={{
                            background: '#ef4444', color: '#fff', borderRadius: '50%',
                            width: 20, height: 20, display: 'flex', alignItems: 'center',
                            justifyContent: 'center', fontSize: 11, fontWeight: 700
                        }}>{newIncoming}</span>
                    )}
                </button>
            </div>

            {activeTab === 'outgoing' && <OutgoingDocs />}
            {activeTab === 'incoming' && <IncomingDocs />}
            {activeTab === 'signatures' && (<>

            {/* Ключи ЭЦП из E-IMZO */}
            <div className="card" style={{ marginBottom: '20px' }}>
                <div style={{ padding: '16px', borderBottom: '1px solid var(--border-color)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <h3 style={{ margin: 0 }}>{t('eds.keysTitle')}</h3>
                    {eimzoConnected && (
                        <button className="btn btn-sm btn-secondary" onClick={refreshKeys}>
                            <RefreshCw size={14} /> {t('eds.refresh')}
                        </button>
                    )}
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(350px, 1fr))', gap: '16px', padding: '16px' }}>
                    {!eimzoConnected && (
                        <div style={{ padding: '30px', color: '#888', gridColumn: '1 / -1', textAlign: 'center' }}>
                            <WifiOff size={32} style={{ marginBottom: '8px', opacity: 0.5 }} />
                            <div>{t('eds.noEimzo')}</div>
                            <div style={{ fontSize: '12px', marginTop: '8px' }}>
                                <a href="https://e-imzo.uz/main/downloads/" target="_blank" rel="noreferrer" style={{ color: 'var(--primary)' }}>
                                    {t('eds.downloadEimzo')}
                                </a>
                            </div>
                        </div>
                    )}
                    {eimzoConnected && eimzoKeys.length === 0 && (
                        <div style={{ padding: '20px', color: '#888', gridColumn: '1 / -1', textAlign: 'center' }}>
                            {t('eds.noKeys')}
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
                                        <div style={{ display: 'flex', gap: '8px', alignItems: 'center', marginTop: '2px' }}>
                                            <span style={{ 
                                                background: 'var(--bg-secondary)', 
                                                border: '1px solid var(--border-color)',
                                                padding: '1px 6px', 
                                                borderRadius: '4px', 
                                                fontSize: '10px',
                                                color: 'var(--text-secondary)'
                                            }}>
                                                {info.storageType}
                                            </span>
                                            {info.subtitle && <div style={{ fontSize: '12px', color: '#888' }}>{info.subtitle}</div>}
                                        </div>
                                    </div>
                                    <span style={{
                                        background: isExpired ? '#fee2e2' : '#dcfce7',
                                        color: isExpired ? '#ef4444' : '#10b981',
                                        padding: '4px 10px', borderRadius: '12px', fontSize: '11px'
                                    }}>
                                        {isExpired ? t('eds.expired') : t('eds.active')}
                                    </span>
                                </div>
                                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '6px', fontSize: '12px', color: '#666' }}>
                                    {info.tin && <div><strong>{t('eds.tin')}:</strong> {info.tin}</div>}
                                    {info.pinfl && <div><strong>{t('eds.pinfl')}:</strong> {info.pinfl}</div>}
                                    <div><strong>{t('eds.validFrom')}:</strong> {info.validFrom || '—'}</div>
                                    <div><strong>{t('eds.validTo')}:</strong> {info.validTo || '—'}</div>
                                    {info.serialNumber && <div style={{ gridColumn: '1/-1' }}><strong>{t('eds.serial')}:</strong> {info.serialNumber}</div>}
                                </div>
                            </div>
                        );
                    })}
                </div>
            </div>

            {/* История подписей */}
            <div className="card">
                <div style={{ padding: '16px', borderBottom: '1px solid var(--border-color)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <h3 style={{ margin: 0 }}>{t('eds.historyTitle')}</h3>
                    <button className="btn btn-sm btn-secondary" onClick={loadSignatures}><RefreshCw size={14} /> {t('eds.refresh')}</button>
                </div>
                {loading ? (
                    <div style={{ padding: '40px', textAlign: 'center' }}>{t('eds.loading')}</div>
                ) : (
                    <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                        <thead>
                            <tr style={{ background: 'var(--bg-secondary)' }}>
                                <th style={{ padding: '12px', textAlign: 'left' }}>{t('eds.tableDoc')}</th>
                                <th style={{ padding: '12px', textAlign: 'left' }}>{t('eds.tableSigner')}</th>
                                <th style={{ padding: '12px', textAlign: 'center' }}>{t('eds.tableDate')}</th>
                                <th style={{ padding: '12px', textAlign: 'center' }}>{t('eds.tableHash')}</th>
                                <th style={{ padding: '12px', textAlign: 'center' }}>{t('eds.tableStatus')}</th>
                                <th style={{ padding: '12px', textAlign: 'center' }}>{t('eds.tableActions')}</th>
                            </tr>
                        </thead>
                        <tbody>
                            {signatures.length === 0 && (
                                <tr><td colSpan="6" style={{ padding: '20px', textAlign: 'center', color: '#888' }}>{t('eds.noSignatures')}</td></tr>
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
                                        <td style={{ padding: '12px', textAlign: 'center', fontSize: '13px' }}>{sig.signed_at ? new Date(sig.signed_at).toLocaleString(t('lang') === 'uz' ? 'uz-UZ' : 'ru-RU') : ''}</td>
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
                                                <button className="btn btn-sm btn-secondary" title={t('eds.verify')} onClick={() => handleVerify(sig.id)}><Eye size={14} /></button>
                                                <button className="btn btn-sm btn-secondary" title={t('eds.download')} onClick={() => handleDownload(sig.id, sig.document_name)}><Download size={14} /></button>
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
                            <h3 style={{ margin: 0 }}>{t('eds.modalTitle')}</h3>
                            <button className="btn btn-sm btn-secondary" onClick={() => setShowSignModal(false)}><X size={16} /></button>
                        </div>

                        <label style={{ fontSize: '13px', color: '#888', marginBottom: '4px', display: 'block' }}>{t('eds.selectDoc')}</label>
                        <input ref={docFileRef} type="file" accept=".pdf,.xlsx,.docx,.xml,.json,.txt" style={inputStyle} />

                        <label style={{ fontSize: '13px', color: '#888', marginBottom: '4px', display: 'block' }}>{t('eds.selectKey')}</label>
                        {eimzoKeys.length === 0 ? (
                            <div style={{ padding: '16px', background: '#fef3c7', borderRadius: '8px', marginBottom: '12px', fontSize: '13px', color: '#92400e' }}>
                                {t('eds.noKeys')}
                                <button className="btn btn-sm btn-secondary" onClick={refreshKeys} style={{ marginLeft: '8px' }}>
                                    <RefreshCw size={12} /> {t('eds.refresh')}
                                </button>
                            </div>
                        ) : (
                            <select value={selectedKeyIdx} onChange={e => setSelectedKeyIdx(e.target.value)} style={inputStyle}>
                                <option value="">{t('eds.placeholderSelectKey')}</option>
                                {eimzoKeys.map((key, idx) => {
                                    const info = EImzoService.formatKeyInfo(key);
                                    return <option key={idx} value={idx}>{info.title} {info.tin ? `(${t('eds.tin')}: ${info.tin})` : ''} {info.subtitle ? `— ${info.subtitle}` : ''}</option>;
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
                                        {info.tin && <span>{t('eds.tin')}: {info.tin} </span>}
                                        {info.pinfl && <span>{t('eds.pinfl')}: {info.pinfl} </span>}
                                        <span>{t('common.period', 'Срок')}: {info.validFrom} — {info.validTo}</span>
                                    </div>
                                </div>
                            );
                        })()}

                        <div style={{ background: '#eff6ff', padding: '12px', borderRadius: '8px', marginBottom: '16px', fontSize: '12px', color: '#1e40af' }}>
                            {t('eds.modalInfo')}
                        </div>

                        <div style={{ display: 'flex', gap: '12px', justifyContent: 'flex-end' }}>
                            <button className="btn btn-secondary" onClick={() => setShowSignModal(false)}>{t('eds.cancel')}</button>
                            <button className="btn btn-primary" onClick={handleSign} disabled={signing || eimzoKeys.length === 0}>
                                {signing ? <><RefreshCw size={14} className="spin" /> {t('eds.signing')}</> : <><Key size={14} /> {t('eds.signEds')}</>}
                            </button>
                        </div>
                    </div>
                </div>
            )}
            </>)}

            <SendDocModal
                show={showSendModal}
                onClose={handleSendClose}
                eimzoKeys={eimzoKeys}
                eimzoConnected={eimzoConnected}
                onSignPkcs7={handleSignPkcs7}
            />
        </div>
    );
}

export default DigitalSignature;
