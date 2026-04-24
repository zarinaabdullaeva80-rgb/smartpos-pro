import React, { useState, useEffect } from 'react';
import { FileText, Download, Check, X, Clock, Eye, Shield, Send, ShieldCheck, ShieldX } from 'lucide-react';
import { edsAPI } from '../../services/api';
import { useI18n } from '../../i18n';

const statusMap = (t) => ({
    sent: { label: t('eds.statusSent'), color: '#3b82f6', bg: '#dbeafe', icon: Send },
    delivered: { label: t('eds.statusDelivered'), color: '#8b5cf6', bg: '#ede9fe', icon: Check },
    viewed: { label: t('eds.statusViewed'), color: '#f59e0b', bg: '#fef3c7', icon: Eye },
    accepted: { label: t('eds.statusAccepted'), color: '#10b981', bg: '#dcfce7', icon: Check },
    rejected: { label: t('eds.statusRejected'), color: '#ef4444', bg: '#fee2e2', icon: X },
});

export default function OutgoingDocs() {
    const { t } = useI18n();
    const [docs, setDocs] = useState([]);
    const [loading, setLoading] = useState(true);

    const load = async () => {
        setLoading(true);
        try {
            const res = await edsAPI.getOutgoing();
            setDocs((res.data || res).documents || []);
        } catch { setDocs([]); }
        setLoading(false);
    };

    useEffect(() => { load(); }, []);

    const handleDownload = async (id, name) => {
        try {
            const res = await edsAPI.downloadDocument(id);
            const url = URL.createObjectURL(res.data);
            const a = document.createElement('a'); a.href = url; a.download = name; a.click();
            URL.revokeObjectURL(url);
        } catch { /* skip */ }
    };

    const sm = statusMap(t);

    if (loading) return <div style={{ padding: '40px', textAlign: 'center' }}>{t('eds.loading')}</div>;

    return (
        <div className="card">
            <div style={{ padding: '16px', borderBottom: '1px solid var(--border-color)' }}>
                <h3 style={{ margin: 0 }}>{t('eds.tabOutgoing')}</h3>
            </div>
            {docs.length === 0 ? (
                <div style={{ padding: '40px', textAlign: 'center', color: '#888' }}>
                    <Send size={32} style={{ opacity: 0.3, marginBottom: 8 }} />
                    <div>{t('eds.outgoingEmpty')}</div>
                </div>
            ) : (
                <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                    <thead>
                        <tr style={{ background: 'var(--bg-secondary)' }}>
                            <th style={{ padding: '12px', textAlign: 'left' }}>{t('eds.tableDoc')}</th>
                            <th style={{ padding: '12px', textAlign: 'left' }}>{t('eds.recipient')}</th>
                            <th style={{ padding: '12px', textAlign: 'center' }}>{t('eds.tableDate')}</th>
                            <th style={{ padding: '12px', textAlign: 'center' }}>{t('eds.senderSig')}</th>
                            <th style={{ padding: '12px', textAlign: 'center' }}>{t('eds.recipientSig')}</th>
                            <th style={{ padding: '12px', textAlign: 'center' }}>{t('eds.tableStatus')}</th>
                            <th style={{ padding: '12px', textAlign: 'center' }}>{t('eds.tableActions')}</th>
                        </tr>
                    </thead>
                    <tbody>
                        {docs.map(doc => {
                            const s = sm[doc.status] || sm.sent;
                            const SI = s.icon;
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
                                        <div style={{ fontWeight: 500 }}>{doc.recipient_name || doc.recipient_tin}</div>
                                        <div style={{ fontSize: 11, color: '#888' }}>{t('eds.tin')}: {doc.recipient_tin}</div>
                                    </td>
                                    <td style={{ padding: '12px', textAlign: 'center', fontSize: 13 }}>
                                        {doc.sent_at ? new Date(doc.sent_at).toLocaleString('ru-RU') : ''}
                                    </td>
                                    {/* Подпись отправителя */}
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
                                    {/* Подпись получателя */}
                                    <td style={{ padding: '12px', textAlign: 'center' }}>
                                        <span style={{
                                            padding: '3px 8px', borderRadius: 8, fontSize: 11,
                                            background: doc.recipient_signed ? '#dcfce7' : '#fef3c7',
                                            color: doc.recipient_signed ? '#166534' : '#92400e',
                                            display: 'inline-flex', alignItems: 'center', gap: 3
                                        }}>
                                            {doc.recipient_signed ? (
                                                <><ShieldCheck size={12} /> {t('eds.recipientSignedYes')}</>
                                            ) : (
                                                <><Clock size={12} /> {t('eds.recipientSignedNo')}</>
                                            )}
                                        </span>
                                        {doc.recipient_signed && doc.recipient_signer_name && (
                                            <div style={{ fontSize: 10, color: '#888', marginTop: 2 }}>
                                                {doc.recipient_signer_name}
                                            </div>
                                        )}
                                        {doc.recipient_signed_at && (
                                            <div style={{ fontSize: 10, color: '#888' }}>
                                                {new Date(doc.recipient_signed_at).toLocaleString('ru-RU')}
                                            </div>
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
                                        <button className="btn btn-sm btn-secondary" onClick={() => handleDownload(doc.id, doc.document_name)}>
                                            <Download size={14} />
                                        </button>
                                    </td>
                                </tr>
                            );
                        })}
                    </tbody>
                </table>
            )}
        </div>
    );
}
