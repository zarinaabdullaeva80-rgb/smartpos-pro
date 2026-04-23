import React, { useState, useEffect, useRef } from 'react';
import { Key, Shield, Check, Clock, AlertTriangle, FileText, Download, Upload, RefreshCw, Eye, Trash2, X } from 'lucide-react';
import { edsAPI } from '../services/api';
import { useToast } from '../components/ToastProvider';
import { useI18n } from '../i18n';

function DigitalSignature() {
    const { t } = useI18n();
    const toast = useToast();
    const [signatures, setSignatures] = useState([]);
    const [certificates, setCertificates] = useState([]);
    const [loading, setLoading] = useState(true);
    const [showUploadModal, setShowUploadModal] = useState(false);
    const [showSignModal, setShowSignModal] = useState(false);
    const [uploading, setUploading] = useState(false);
    const [signing, setSigning] = useState(false);
    const [certForm, setCertForm] = useState({ name: '', owner: '', issuer: 'E-IMZO', valid_from: '', valid_to: '' });
    const [selectedCertId, setSelectedCertId] = useState('');
    const certFileRef = useRef(null);
    const docFileRef = useRef(null);

    useEffect(() => { loadData(); }, []);

    const loadData = async () => {
        try {
            setLoading(true);
            const [certRes, sigRes] = await Promise.all([
                edsAPI.getCertificates(),
                edsAPI.getSignatures()
            ]);
            setCertificates((certRes.data || certRes).certificates || []);
            setSignatures((sigRes.data || sigRes).signatures || []);
        } catch (error) {
            console.error('Ошибка загрузки ЭЦП данных:', error);
        } finally {
            setLoading(false);
        }
    };

    const handleUploadCertificate = async () => {
        const file = certFileRef.current?.files[0];
        if (!file) { toast.error('Выберите файл сертификата'); return; }
        if (!certForm.name) { toast.error('Введите название сертификата'); return; }

        setUploading(true);
        try {
            const formData = new FormData();
            formData.append('certificate', file);
            Object.entries(certForm).forEach(([k, v]) => { if (v) formData.append(k, v); });
            await edsAPI.uploadCertificate(formData);
            toast.success('Сертификат загружен');
            setShowUploadModal(false);
            setCertForm({ name: '', owner: '', issuer: 'E-IMZO', valid_from: '', valid_to: '' });
            loadData();
        } catch (err) {
            toast.error('Ошибка: ' + (err.response?.data?.error || err.message));
        } finally {
            setUploading(false);
        }
    };

    const handleDeleteCert = async (id) => {
        if (!window.confirm('Удалить сертификат?')) return;
        try {
            await edsAPI.deleteCertificate(id);
            toast.success('Сертификат удалён');
            loadData();
        } catch (err) { toast.error('Ошибка удаления'); }
    };

    const handleSignDocument = async () => {
        const file = docFileRef.current?.files[0];
        if (!file) { toast.error('Выберите документ'); return; }

        setSigning(true);
        try {
            const formData = new FormData();
            formData.append('document', file);
            if (selectedCertId) formData.append('certificate_id', selectedCertId);
            await edsAPI.signDocument(formData);
            toast.success('Документ подписан');
            setShowSignModal(false);
            setSelectedCertId('');
            loadData();
        } catch (err) {
            toast.error('Ошибка: ' + (err.response?.data?.error || err.message));
        } finally {
            setSigning(false);
        }
    };

    const handleVerify = async (id) => {
        try {
            const res = await edsAPI.verifySignature(id);
            const data = res.data || res;
            toast[data.valid ? 'success' : 'error'](data.valid ? 'Подпись действительна ✓' : 'Подпись недействительна ✗');
        } catch (err) { toast.error('Ошибка проверки'); }
    };

    const handleDownload = async (id, name) => {
        try {
            const res = await edsAPI.downloadSigned(id);
            const url = URL.createObjectURL(res.data);
            const a = document.createElement('a'); a.href = url; a.download = name; a.click();
            URL.revokeObjectURL(url);
        } catch (err) { toast.error('Ошибка скачивания'); }
    };

    const getStatusInfo = (status) => {
        const statuses = {
            active: { label: 'Активен', color: '#10b981', bg: '#dcfce7', icon: Check },
            valid: { label: 'Действительна', color: '#10b981', bg: '#dcfce7', icon: Check },
            expiring: { label: 'Истекает', color: '#f59e0b', bg: '#fef3c7', icon: Clock },
            expired: { label: 'Истёк', color: '#ef4444', bg: '#fee2e2', icon: AlertTriangle },
            invalid: { label: 'Недействительна', color: '#ef4444', bg: '#fee2e2', icon: AlertTriangle }
        };
        return statuses[status] || statuses.active;
    };

    const modalOverlay = { position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 };
    const modalBox = { background: 'var(--card-bg, white)', borderRadius: '16px', padding: '24px', width: '500px', maxWidth: '90vw' };
    const inputStyle = { width: '100%', padding: '10px 14px', borderRadius: '8px', border: '1px solid var(--border-color)', background: 'var(--bg-secondary, #f8f9fa)', fontSize: '14px', marginBottom: '12px', boxSizing: 'border-box' };

    return (
        <div className="digital-signature-page fade-in">
            <div className="page-header">
                <div>
                    <h1>{t('digitalsignature.etsp_podpisanie', '🔐 ЭЦП подписание')}</h1>
                    <p className="text-muted">{t('digitalsignature.elektronnaya_tsifrovaya_podpis_dokumentov', 'Электронная цифровая подпись документов')}</p>
                </div>
                <div style={{ display: 'flex', gap: '12px' }}>
                    <button className="btn btn-secondary" onClick={() => setShowUploadModal(true)}>
                        <Upload size={18} /> Загрузить сертификат
                    </button>
                    <button className="btn btn-primary" onClick={() => setShowSignModal(true)}>
                        <Key size={18} /> Подписать документ
                    </button>
                </div>
            </div>

            {/* Сертификаты */}
            <div className="card" style={{ marginBottom: '20px' }}>
                <div style={{ padding: '16px', borderBottom: '1px solid var(--border-color)' }}>
                    <h3 style={{ margin: 0 }}>{t('digitalsignature.sertifikaty_etsp', '🔑 Сертификаты ЭЦП')}</h3>
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '16px', padding: '16px' }}>
                    {certificates.length === 0 && !loading && (
                        <div style={{ padding: '20px', color: '#888', gridColumn: '1 / -1', textAlign: 'center' }}>
                            {t('digitalsignature.net_zagruzhennyh_sertifikatov', 'Нет загруженных сертификатов. Нажмите "Загрузить сертификат" для начала работы.')}
                        </div>
                    )}
                    {certificates.map(cert => {
                        const statusInfo = getStatusInfo(cert.status);
                        const StatusIcon = statusInfo.icon;
                        return (
                            <div key={cert.id} style={{ padding: '20px', border: '1px solid var(--border-color)', borderRadius: '12px', background: 'var(--bg-secondary)' }}>
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '12px' }}>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                                        <div style={{ width: '48px', height: '48px', borderRadius: '12px', background: 'linear-gradient(135deg, #3b82f6, #1d4ed8)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                            <Shield size={24} color="white" />
                                        </div>
                                        <div>
                                            <div style={{ fontWeight: 'bold' }}>{cert.name}</div>
                                            <div style={{ fontSize: '12px', color: '#888' }}>{cert.owner}</div>
                                        </div>
                                    </div>
                                    <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                                        <span style={{ background: statusInfo.bg, color: statusInfo.color, padding: '4px 12px', borderRadius: '12px', fontSize: '12px', display: 'flex', alignItems: 'center', gap: '4px' }}>
                                            <StatusIcon size={12} /> {statusInfo.label}
                                        </span>
                                        <button className="btn btn-sm btn-secondary" onClick={() => handleDeleteCert(cert.id)} title="Удалить" style={{ color: '#ef4444' }}>
                                            <Trash2 size={14} />
                                        </button>
                                    </div>
                                </div>
                                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '8px', fontSize: '13px' }}>
                                    <div><span style={{ color: '#888' }}>Издатель:</span> {cert.issuer}</div>
                                    <div><span style={{ color: '#888' }}>Тип:</span> {cert.cert_type === 'qualified' ? 'Квалифицированная' : cert.cert_type}</div>
                                    <div><span style={{ color: '#888' }}>С:</span> {cert.valid_from ? new Date(cert.valid_from).toLocaleDateString('ru') : '—'}</div>
                                    <div><span style={{ color: '#888' }}>До:</span> {cert.valid_to ? new Date(cert.valid_to).toLocaleDateString('ru') : '—'}</div>
                                </div>
                                {cert.thumbprint && <div style={{ fontSize: '11px', color: '#888', marginTop: '8px', fontFamily: 'monospace', wordBreak: 'break-all' }}>SHA-256: {cert.thumbprint.substring(0, 32)}...</div>}
                            </div>
                        );
                    })}
                </div>
            </div>

            {/* История подписей */}
            <div className="card">
                <div style={{ padding: '16px', borderBottom: '1px solid var(--border-color)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <h3 style={{ margin: 0 }}>📋 История подписаний</h3>
                    <button className="btn btn-sm btn-secondary" onClick={loadData}><RefreshCw size={14} /> Обновить</button>
                </div>
                {loading ? (
                    <div style={{ padding: '40px', textAlign: 'center' }}>Загрузка...</div>
                ) : (
                    <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                        <thead>
                            <tr style={{ background: 'var(--bg-secondary)' }}>
                                <th style={{ padding: '12px', textAlign: 'left' }}>Документ</th>
                                <th style={{ padding: '12px', textAlign: 'left' }}>Подписант</th>
                                <th style={{ padding: '12px', textAlign: 'center' }}>Дата/время</th>
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
                                const si = getStatusInfo(sig.status);
                                const SI = si.icon;
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
                                            <code style={{ background: 'var(--bg-secondary)', padding: '4px 8px', borderRadius: '4px', fontSize: '11px' }}>
                                                {(sig.document_hash || '').substring(0, 16)}...
                                            </code>
                                        </td>
                                        <td style={{ padding: '12px', textAlign: 'center' }}>
                                            <span style={{ background: si.bg, color: si.color, padding: '4px 12px', borderRadius: '12px', fontSize: '12px', display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                                                <SI size={12} /> {si.label}
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

            {/* Модалка загрузки сертификата */}
            {showUploadModal && (
                <div style={modalOverlay} onClick={() => setShowUploadModal(false)}>
                    <div style={modalBox} onClick={e => e.stopPropagation()}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '20px' }}>
                            <h3 style={{ margin: 0 }}>📤 Загрузить сертификат</h3>
                            <button className="btn btn-sm btn-secondary" onClick={() => setShowUploadModal(false)}><X size={16} /></button>
                        </div>
                        <div>
                            <label style={{ fontSize: '13px', color: '#888', marginBottom: '4px', display: 'block' }}>Файл сертификата (.pfx, .p12, .pem, .cer)</label>
                            <input ref={certFileRef} type="file" accept=".pfx,.p12,.pem,.cer,.crt" style={inputStyle} />
                            <label style={{ fontSize: '13px', color: '#888', marginBottom: '4px', display: 'block' }}>Название *</label>
                            <input value={certForm.name} onChange={e => setCertForm(p => ({ ...p, name: e.target.value }))} placeholder="Мой сертификат ЭЦП" style={inputStyle} />
                            <label style={{ fontSize: '13px', color: '#888', marginBottom: '4px', display: 'block' }}>Владелец</label>
                            <input value={certForm.owner} onChange={e => setCertForm(p => ({ ...p, owner: e.target.value }))} placeholder="ООО Компания / ФИО" style={inputStyle} />
                            <label style={{ fontSize: '13px', color: '#888', marginBottom: '4px', display: 'block' }}>Издатель</label>
                            <input value={certForm.issuer} onChange={e => setCertForm(p => ({ ...p, issuer: e.target.value }))} style={inputStyle} />
                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                                <div>
                                    <label style={{ fontSize: '13px', color: '#888', marginBottom: '4px', display: 'block' }}>Действует с</label>
                                    <input type="date" value={certForm.valid_from} onChange={e => setCertForm(p => ({ ...p, valid_from: e.target.value }))} style={inputStyle} />
                                </div>
                                <div>
                                    <label style={{ fontSize: '13px', color: '#888', marginBottom: '4px', display: 'block' }}>Действует до</label>
                                    <input type="date" value={certForm.valid_to} onChange={e => setCertForm(p => ({ ...p, valid_to: e.target.value }))} style={inputStyle} />
                                </div>
                            </div>
                        </div>
                        <div style={{ display: 'flex', gap: '12px', justifyContent: 'flex-end', marginTop: '16px' }}>
                            <button className="btn btn-secondary" onClick={() => setShowUploadModal(false)}>Отмена</button>
                            <button className="btn btn-primary" onClick={handleUploadCertificate} disabled={uploading}>
                                {uploading ? <><RefreshCw size={14} className="spin" /> Загрузка...</> : <><Upload size={14} /> Загрузить</>}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Модалка подписания документа */}
            {showSignModal && (
                <div style={modalOverlay} onClick={() => setShowSignModal(false)}>
                    <div style={modalBox} onClick={e => e.stopPropagation()}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '20px' }}>
                            <h3 style={{ margin: 0 }}>✍️ Подписать документ</h3>
                            <button className="btn btn-sm btn-secondary" onClick={() => setShowSignModal(false)}><X size={16} /></button>
                        </div>
                        <div>
                            <label style={{ fontSize: '13px', color: '#888', marginBottom: '4px', display: 'block' }}>Документ для подписания</label>
                            <input ref={docFileRef} type="file" accept=".pdf,.xlsx,.docx,.xml,.json" style={inputStyle} />
                            <label style={{ fontSize: '13px', color: '#888', marginBottom: '4px', display: 'block' }}>Сертификат</label>
                            <select value={selectedCertId} onChange={e => setSelectedCertId(e.target.value)} style={inputStyle}>
                                <option value="">— Без сертификата (системная подпись) —</option>
                                {certificates.filter(c => c.status === 'active').map(c => (
                                    <option key={c.id} value={c.id}>{c.name} ({c.owner})</option>
                                ))}
                            </select>
                        </div>
                        <div style={{ display: 'flex', gap: '12px', justifyContent: 'flex-end', marginTop: '16px' }}>
                            <button className="btn btn-secondary" onClick={() => setShowSignModal(false)}>Отмена</button>
                            <button className="btn btn-primary" onClick={handleSignDocument} disabled={signing}>
                                {signing ? <><RefreshCw size={14} className="spin" /> Подписание...</> : <><Key size={14} /> Подписать</>}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}

export default DigitalSignature;
