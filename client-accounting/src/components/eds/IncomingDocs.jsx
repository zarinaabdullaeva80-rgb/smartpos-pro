import React, { useState, useEffect, useCallback } from 'react';
import { FileText, Download, Check, X, Clock, Eye, Shield, Inbox, Send, Key, ShieldCheck, RefreshCw } from 'lucide-react';
import { edsAPI } from '../../services/api';
import EImzoService from '../../services/eimzo';
import { useToast } from '../ToastProvider';
import { useI18n } from '../../i18n';

const statusMap = (t) => ({
    sent: { label: t('eds.statusSent'), color: '#3b82f6', bg: '#dbeafe', icon: Send },
    delivered: { label: t('eds.statusDelivered'), color: '#8b5cf6', bg: '#ede9fe', icon: Check },
    viewed: { label: t('eds.statusViewed'), color: '#f59e0b', bg: '#fef3c7', icon: Eye },
    accepted: { label: t('eds.statusAccepted'), color: '#10b981', bg: '#dcfce7', icon: Check },
    rejected: { label: t('eds.statusRejected'), color: '#ef4444', bg: '#fee2e2', icon: X },
});

export default function IncomingDocs() {
    const { t } = useI18n();
    const toast = useToast();
    const [docs, setDocs] = useState([]);
    const [loading, setLoading] = useState(true);
    const [signingId, setSigningId] = useState(null);
    const [eimzoKeys, setEimzoKeys] = useState([]);
    const [eimzoConnected, setEimzoConnected] = useState(false);
    const [showSignModal, setShowSignModal] = useState(null);
    const [selectedKey, setSelectedKey] = useState('');

    const load = async () => {
        setLoading(true);
        try {
            const res = await edsAPI.getIncoming();
            setDocs((res.data || res).documents || []);
        } catch { setDocs([]); }
        setLoading(false);
    };

    useEffect(() => { load(); }, []);

    // Подключение E-IMZO для подписания
    const connectAndLoadKeys = async () => {
        try {
            await EImzoService.connect();
            setEimzoConnected(true);
            const keys = await EImzoService.listKeys();
            setEimzoKeys(keys);
        } catch { setEimzoConnected(false); }
    };

    const handleDownload = async (id, name) => {
        try {
            const res = await edsAPI.downloadDocument(id);
            const url = URL.createObjectURL(res.data);
            const a = document.createElement('a'); a.href = url; a.download = name; a.click();
            URL.revokeObjectURL(url);
        } catch { toast.error(t('eds.downloadError')); }
    };

    const handleAccept = async (id) => {
        try {
            await edsAPI.acceptDocument(id);
            toast.success(t('eds.acceptSuccess'));
            load();
        } catch { toast.error(t('common.error')); }
    };

    const handleReject = async (id) => {
        const reason = prompt(t('eds.rejectReason'));
        if (reason === null) return;
        try {
            await edsAPI.rejectDocument(id, reason);
            toast.success(t('eds.rejectSuccess'));
            load();
        } catch { toast.error(t('common.error')); }
    };

    // Подписать документ ЭЦП получателя
    const handleCounterSign = async (docId) => {
        if (!eimzoConnected) {
            await connectAndLoadKeys();
        }
        setShowSignModal(docId);
    };

    const doSign = async () => {
        if (!selectedKey) return toast.error(t('eds.selectKey'));
        const doc = docs.find(d => d.id === showSignModal);
        if (!doc) return;

        setSigningId(showSignModal);
        try {
            const keyObj = eimzoKeys.find(k => k.serialNumber === selectedKey);
            if (!keyObj) throw new Error('Key not found');

            toast.info(t('eds.enterPassword'));
            const keyId = await EImzoService.loadKey(keyObj);

            // Подписываем хэш документа
            const hashToSign = doc.document_hash || 'no-hash';
            toast.info(t('eds.signingDoc'));
            const pkcs7 = await EImzoService.signHash(keyId, hashToSign);

            await edsAPI.counterSignDocument(showSignModal, {
                pkcs7,
                signer_name: keyObj.CN || keyObj.O || '',
                signer_tin: keyObj.TIN || keyObj.PINFL || ''
            });

            toast.success(t('eds.counterSignSuccess'));
            setShowSignModal(null);
            load();
        } catch (err) {
            toast.error(t('eds.signError').replace('{error}', err.message));
        }
        setSigningId(null);
    };

    const sm = statusMap(t);

    if (loading) return <div style={{ padding: '40px', textAlign: 'center' }}>{t('eds.loading')}</div>;

    const ov = { position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 9999 };

    return (
        <div className="card">
            <div style={{ padding: '16px', borderBottom: '1px solid var(--border-color)' }}>
                <h3 style={{ margin: 0 }}>{t('eds.tabIncoming')}</h3>
            </div>
            {docs.length === 0 ? (
                <div style={{ padding: '40px', textAlign: 'center', color: '#888' }}>
                    <Inbox size={32} style={{ opacity: 0.3, marginBottom: 8 }} />
                    <div>{t('eds.incomingEmpty')}</div>
                </div>
            ) : (
                <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                    <thead>
                        <tr style={{ background: 'var(--bg-secondary)' }}>
                            <th style={{ padding: '12px', textAlign: 'left' }}>{t('eds.tableDoc')}</th>
                            <th style={{ padding: '12px', textAlign: 'left' }}>{t('eds.sender')}</th>
                            <th style={{ padding: '12px', textAlign: 'center' }}>{t('eds.tableDate')}</th>
                            <th style={{ padding: '12px', textAlign: 'center' }}>{t('eds.senderSig')}</th>
                            <th style={{ padding: '12px', textAlign: 'center' }}>{t('eds.mySig')}</th>
                            <th style={{ padding: '12px', textAlign: 'center' }}>{t('eds.tableStatus')}</th>
                            <th style={{ padding: '12px', textAlign: 'center' }}>{t('eds.tableActions')}</th>
                        </tr>
                    </thead>
                    <tbody>
                        {docs.map(doc => {
                            const s = sm[doc.status] || sm.delivered;
                            const SI = s.icon;
                            const canAct = ['delivered', 'viewed'].includes(doc.status);
                            return (
                                <tr key={doc.id} style={{ borderBottom: '1px solid var(--border-color)' }}>
                                    <td style={{ padding: '12px' }}>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                                            <FileText size={16} color="var(--primary)" />
                                            <div>
                                                <div style={{ fontWeight: 500 }}>{doc.document_name}</div>
                                                {doc.comment && <div style={{ fontSize: 11, color: '#888' }}>{doc.comment}</div>}
                                            </div>
                                        </div>
                                    </td>
                                    <td style={{ padding: '12px' }}>
                                        <div style={{ fontWeight: 500 }}>{doc.sender_name || doc.sender_tin}</div>
                                        {doc.sender_tin && <div style={{ fontSize: 11, color: '#888' }}>{t('eds.tin')}: {doc.sender_tin}</div>}
                                    </td>
                                    <td style={{ padding: '12px', textAlign: 'center', fontSize: 13 }}>
                                        {doc.sent_at ? new Date(doc.sent_at).toLocaleString('ru-RU') : ''}
                                    </td>
                                    <td style={{ padding: '12px', textAlign: 'center' }}>
                                        <span style={{
                                            padding: '3px 8px', borderRadius: 8, fontSize: 11,
                                            background: doc.is_signed ? '#dcfce7' : '#f3f4f6',
                                            color: doc.is_signed ? '#166534' : '#6b7280',
                                            display: 'inline-flex', alignItems: 'center', gap: 3
                                        }}>
                                            {doc.is_signed ? <><ShieldCheck size={12} /> {t('eds.signed')}</> : t('eds.unsigned')}
                                        </span>
                                    </td>
                                    <td style={{ padding: '12px', textAlign: 'center' }}>
                                        {doc.recipient_signed ? (
                                            <span style={{ padding: '3px 8px', borderRadius: 8, fontSize: 11, background: '#dcfce7', color: '#166534', display: 'inline-flex', alignItems: 'center', gap: 3 }}>
                                                <ShieldCheck size={12} /> {t('eds.signed')}
                                            </span>
                                        ) : (
                                            <button className="btn btn-sm" onClick={() => handleCounterSign(doc.id)}
                                                style={{ fontSize: 11, background: '#eef2ff', color: '#4338ca', border: '1px solid #c7d2fe', display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                                                <Key size={12} /> {t('eds.signEds')}
                                            </button>
                                        )}
                                    </td>
                                    <td style={{ padding: '12px', textAlign: 'center' }}>
                                        <span style={{
                                            background: s.bg, color: s.color,
                                            padding: '4px 10px', borderRadius: 12, fontSize: 11,
                                            display: 'inline-flex', alignItems: 'center', gap: 4
                                        }}>
                                            <SI size={12} /> {s.label}
                                        </span>
                                    </td>
                                    <td style={{ padding: '12px', textAlign: 'center' }}>
                                        <div style={{ display: 'flex', gap: 4, justifyContent: 'center' }}>
                                            <button className="btn btn-sm btn-secondary" title={t('eds.download')} onClick={() => handleDownload(doc.id, doc.document_name)}>
                                                <Download size={14} />
                                            </button>
                                            {canAct && (
                                                <>
                                                    <button className="btn btn-sm" title={t('eds.accept')} onClick={() => handleAccept(doc.id)} style={{ background: '#10b981', color: '#fff', border: 'none' }}>
                                                        <Check size={14} />
                                                    </button>
                                                    <button className="btn btn-sm btn-secondary" title={t('eds.reject')} onClick={() => handleReject(doc.id)} style={{ color: '#ef4444' }}>
                                                        <X size={14} />
                                                    </button>
                                                </>
                                            )}
                                        </div>
                                    </td>
                                </tr>
                            );
                        })}
                    </tbody>
                </table>
            )}

            {/* Модалка подписания */}
            {showSignModal && (
                <div style={ov} onClick={() => setShowSignModal(null)}>
                    <div onClick={e => e.stopPropagation()} style={{ background: 'var(--bg-primary, #fff)', borderRadius: 12, padding: 24, width: 440, maxWidth: '90vw', boxShadow: '0 20px 60px rgba(0,0,0,0.3)' }}>
                        <h3 style={{ margin: '0 0 16px' }}>{t('eds.counterSignTitle')}</h3>
                        {!eimzoConnected ? (
                            <div>
                                <p style={{ color: '#888', fontSize: 13 }}>{t('eds.statusDisconnected')}</p>
                                <button className="btn btn-primary" onClick={connectAndLoadKeys}>
                                    <RefreshCw size={14} /> {t('eds.connect')}
                                </button>
                            </div>
                        ) : (
                            <div>
                                <label style={{ fontWeight: 500, fontSize: 13, marginBottom: 6, display: 'block' }}>{t('eds.selectKey')}</label>
                                <select value={selectedKey} onChange={e => setSelectedKey(e.target.value)} className="form-input" style={{ width: '100%', marginBottom: 16, fontSize: '13px' }}>
                                    <option value="">{t('eds.placeholderSelectKey')}</option>
                                    {eimzoKeys.map((k, i) => (
                                        <option key={i} value={k.serialNumber}>
                                            [{k.plugin?.toUpperCase() || 'PFX'}] {k.CN || k.O} ({k.TIN || k.PINFL})
                                        </option>
                                    ))}
                                </select>
                                <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
                                    <button className="btn btn-secondary" onClick={() => setShowSignModal(null)}>{t('eds.cancel')}</button>
                                    <button className="btn btn-primary" onClick={doSign} disabled={signingId || !selectedKey}>
                                        {signingId ? <><RefreshCw size={14} className="spin" /> {t('eds.signing')}</> : <><Key size={14} /> {t('eds.signEds')}</>}
                                    </button>
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            )}
        </div>
    );
}
