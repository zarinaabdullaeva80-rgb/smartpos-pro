import React, { useState, useEffect } from 'react';
import { X, Send, Shield, FileText, Search } from 'lucide-react';
import { edsAPI, counterpartiesAPI } from '../../services/api';
import { useToast } from '../ToastProvider';
import { useI18n } from '../../i18n';

export default function SendDocModal({ show, onClose, eimzoKeys, eimzoConnected, onSignPkcs7 }) {
    const { t } = useI18n();
    const toast = useToast();
    const [file, setFile] = useState(null);
    const [recipientTin, setRecipientTin] = useState('');
    const [recipientName, setRecipientName] = useState('');
    const [withSig, setWithSig] = useState(false);
    const [selectedKey, setSelectedKey] = useState('');
    const [comment, setComment] = useState('');
    const [sending, setSending] = useState(false);
    const [counterparties, setCounterparties] = useState([]);
    const [cpSearch, setCpSearch] = useState('');
    const [showCpList, setShowCpList] = useState(false);

    useEffect(() => {
        if (show) {
            counterpartiesAPI?.getAll?.({ limit: 500 })
                .then(res => setCounterparties((res.data || res).counterparties || []))
                .catch(() => setCounterparties([]));
        }
    }, [show]);

    if (!show) return null;

    const filtered = counterparties.filter(c =>
        (c.inn || '').includes(cpSearch) || (c.name || '').toLowerCase().includes(cpSearch.toLowerCase())
    ).slice(0, 10);

    const selectCp = (cp) => {
        setRecipientTin(cp.inn || '');
        setRecipientName(cp.name || '');
        setShowCpList(false);
        setCpSearch('');
    };

    const handleSend = async () => {
        if (!file) return toast.error(t('eds.selectDoc'));
        if (!recipientTin) return toast.error(t('eds.recipientTin'));

        setSending(true);
        try {
            const formData = new FormData();
            formData.append('document', file);
            formData.append('recipient_tin', recipientTin);
            formData.append('recipient_name', recipientName);
            formData.append('comment', comment);
            formData.append('with_signature', withSig ? 'true' : 'false');

            if (withSig && selectedKey && onSignPkcs7) {
                const fileBuffer = await file.arrayBuffer();
                const hash = await crypto.subtle.digest('SHA-256', fileBuffer);
                const hashHex = Array.from(new Uint8Array(hash)).map(b => b.toString(16).padStart(2, '0')).join('');
                const pkcs7 = await onSignPkcs7(selectedKey, hashHex);
                if (pkcs7) {
                    formData.append('pkcs7', pkcs7);
                    const key = (eimzoKeys || []).find(k => k.serialNumber === selectedKey);
                    formData.append('signer_name', key?.CN || key?.O || '');
                    formData.append('signer_tin', key?.TIN || key?.PINFL || '');
                }
            }

            await edsAPI.sendDocument(formData);
            toast.success(t('eds.sendSuccess'));
            onClose(true);
        } catch (err) {
            toast.error(t('eds.sendError').replace('{error}', err.message));
        }
        setSending(false);
    };

    const ov = { position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 9999 };
    const md = { background: 'var(--bg-primary, #fff)', borderRadius: 12, width: '100%', maxWidth: 520, maxHeight: '90vh', overflow: 'auto', boxShadow: '0 20px 60px rgba(0,0,0,0.3)' };

    return (
        <div style={ov} onClick={() => onClose(false)}>
            <div style={md} onClick={e => e.stopPropagation()}>
                <div style={{ padding: '16px 20px', borderBottom: '1px solid var(--border-color)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <h3 style={{ margin: 0, fontSize: 16 }}>{t('eds.sendModalTitle')}</h3>
                    <button onClick={() => onClose(false)} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 4 }}><X size={20} /></button>
                </div>
                <div style={{ padding: 20, display: 'flex', flexDirection: 'column', gap: 16 }}>
                    {/* File */}
                    <div>
                        <label style={{ fontWeight: 500, fontSize: 13, marginBottom: 6, display: 'block' }}>{t('eds.selectDoc')}</label>
                        <input type="file" onChange={e => setFile(e.target.files[0])} style={{ width: '100%' }} />
                        {file && <div style={{ fontSize: 12, color: '#888', marginTop: 4 }}><FileText size={12} /> {file.name} ({(file.size/1024).toFixed(1)} KB)</div>}
                    </div>

                    {/* Recipient TIN */}
                    <div style={{ position: 'relative' }}>
                        <label style={{ fontWeight: 500, fontSize: 13, marginBottom: 6, display: 'block' }}>{t('eds.recipientTin')}</label>
                        <input type="text" value={recipientTin} onChange={e => setRecipientTin(e.target.value)}
                            placeholder={t('eds.tinPlaceholder')} className="form-input" style={{ width: '100%' }} />
                        <div style={{ marginTop: 4 }}>
                            <button type="button" className="btn btn-sm btn-secondary"
                                onClick={() => setShowCpList(!showCpList)} style={{ fontSize: 11 }}>
                                <Search size={12} /> {t('eds.orSelectCounterparty')}
                            </button>
                        </div>
                        {showCpList && (
                            <div style={{ position: 'absolute', top: '100%', left: 0, right: 0, background: 'var(--bg-primary, #fff)', border: '1px solid var(--border-color)', borderRadius: 8, zIndex: 10, maxHeight: 200, overflow: 'auto', boxShadow: '0 4px 12px rgba(0,0,0,0.15)' }}>
                                <input type="text" value={cpSearch} onChange={e => setCpSearch(e.target.value)} placeholder="Поиск..." className="form-input" style={{ width: '100%', borderRadius: '8px 8px 0 0', border: 'none', borderBottom: '1px solid var(--border-color)' }} autoFocus />
                                {filtered.map(cp => (
                                    <div key={cp.id} onClick={() => selectCp(cp)} style={{ padding: '8px 12px', cursor: 'pointer', borderBottom: '1px solid var(--border-color)', fontSize: 13 }}
                                        onMouseOver={e => e.currentTarget.style.background='var(--bg-secondary)'} onMouseOut={e => e.currentTarget.style.background=''}>
                                        <div style={{ fontWeight: 500 }}>{cp.name}</div>
                                        <div style={{ fontSize: 11, color: '#888' }}>ИНН: {cp.inn}</div>
                                    </div>
                                ))}
                                {filtered.length === 0 && <div style={{ padding: '12px', color: '#888', fontSize: 13, textAlign: 'center' }}>Не найдено</div>}
                            </div>
                        )}
                    </div>

                    {/* Recipient Name */}
                    <div>
                        <label style={{ fontWeight: 500, fontSize: 13, marginBottom: 6, display: 'block' }}>{t('eds.recipientName')}</label>
                        <input type="text" value={recipientName} onChange={e => setRecipientName(e.target.value)} className="form-input" style={{ width: '100%' }} />
                    </div>

                    {/* Signature toggle */}
                    <div style={{ padding: 12, borderRadius: 8, background: 'var(--bg-secondary, #f5f5f5)', border: '1px solid var(--border-color)' }}>
                        <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', fontWeight: 500 }}>
                            <input type="checkbox" checked={withSig} onChange={e => setWithSig(e.target.checked)} />
                            <Shield size={16} color={withSig ? '#10b981' : '#999'} />
                            {withSig ? t('eds.withSignature') : t('eds.withoutSignature')}
                        </label>
                        {withSig && (
                            <div style={{ marginTop: 10 }}>
                                {!eimzoConnected ? (
                                    <div style={{ fontSize: 12, color: '#ef4444' }}>{t('eds.statusDisconnected')}</div>
                                ) : (
                                    <select value={selectedKey} onChange={e => setSelectedKey(e.target.value)} className="form-input" style={{ width: '100%', fontSize: '13px' }}>
                                        <option value="">{t('eds.placeholderSelectKey')}</option>
                                        {(eimzoKeys || []).map((k, i) => (
                                            <option key={i} value={k.serialNumber}>
                                                [{k.plugin?.toUpperCase() || 'PFX'}] {k.CN || k.O} ({k.TIN || k.PINFL})
                                            </option>
                                        ))}
                                    </select>
                                )}
                            </div>
                        )}
                    </div>

                    {/* Comment */}
                    <div>
                        <label style={{ fontWeight: 500, fontSize: 13, marginBottom: 6, display: 'block' }}>{t('eds.commentLabel')}</label>
                        <textarea value={comment} onChange={e => setComment(e.target.value)} rows={2} placeholder={t('eds.commentPlaceholder')} className="form-input" style={{ width: '100%', resize: 'vertical' }} />
                    </div>
                </div>
                <div style={{ padding: '16px 20px', borderTop: '1px solid var(--border-color)', display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
                    <button className="btn btn-secondary" onClick={() => onClose(false)}>{t('eds.cancel')}</button>
                    <button className="btn btn-primary" onClick={handleSend} disabled={sending || !file || !recipientTin}>
                        <Send size={14} /> {sending ? t('eds.sending') : t('eds.sendBtn')}
                    </button>
                </div>
            </div>
        </div>
    );
}
