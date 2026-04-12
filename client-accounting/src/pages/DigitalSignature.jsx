import React, { useState, useEffect } from 'react';
import { Key, Shield, Check, Clock, AlertTriangle, FileText, Download, Upload, RefreshCw, Eye } from 'lucide-react';
import { documentsAPI } from '../services/api';
import { useToast } from '../components/ToastProvider';
import { useI18n } from '../i18n';

function DigitalSignature() {
    const { t } = useI18n();
    const toast = useToast();
    const [signatures, setSignatures] = useState([]);
    const [certificates, setCertificates] = useState([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => { loadData(); }, []);

    const loadData = async () => {
        try {
            setLoading(true);
            const res = await documentsAPI.getAll({ type: 'signed' });
            const data = res.data || res;

            const docs = data.documents || data || [];
            setCertificates(docs.filter(d => d.type === 'certificate').map(c => ({
                id: c.id,
                name: c.name || c.title || 'Сертификат',
                owner: c.owner || c.signer || '',
                issuer: c.issuer || 'E-IMZO',
                valid_from: c.valid_from || c.created_at?.substring(0, 10) || '',
                valid_to: c.valid_to || c.expires_at?.substring(0, 10) || '',
                status: c.status || 'active',
                type: c.cert_type || 'qualified'
            })));

            setSignatures(docs.filter(d => d.type !== 'certificate' || !d.type).map(s => ({
                id: s.id,
                document: s.name || s.title || s.document_name || 'Документ',
                signer: s.signer || s.signed_by || '',
                date: s.signed_at || s.created_at ? new Date(s.signed_at || s.created_at).toLocaleString('ru') : '',
                status: s.signature_status || s.status || 'valid',
                hash: s.hash || s.signature_hash || ''
            })));
        } catch (error) {
            console.error('Ошибка загрузки ЭЦП данных:', error);
            setCertificates([]);
            setSignatures([]);
        } finally {
            setLoading(false);
        }
    };

    const handleSignDocument = async () => {
        toast.info('Выберите документ для подписания');
    };

    const handleUploadCertificate = async () => {
        toast.info('Загрузка сертификата...');
    };

    const getStatusInfo = (status) => {
        const statuses = {
            active: { label: 'Активен', color: '#10b981', bg: '#dcfce7', icon: Check },
            valid: { label: 'Действительна', color: '#10b981', bg: '#dcfce7', icon: Check },
            expiring: { label: 'Истекает', color: '#f59e0b', bg: '#fef3c7', icon: Clock },
            expired: { label: 'Истёк', color: '#ef4444', bg: '#fee2e2', icon: AlertTriangle }
        };
        return statuses[status] || statuses.active;
    };

    return (
        <div className="digital-signature-page fade-in">
            <div className="page-header">
                <div>
                    <h1>{t('digitalsignature.etsp_podpisanie', '🔐 ЭЦП подписание')}</h1>
                    <p className="text-muted">{t('digitalsignature.elektronnaya_tsifrovaya_podpis_dokumentov', 'Электронная цифровая подпись документов')}</p>
                </div>
                <div style={{ display: 'flex', gap: '12px' }}>
                    <button className="btn btn-secondary" onClick={handleUploadCertificate}>
                        <Upload size={18} /> Загрузить сертификат
                    </button>
                    <button className="btn btn-primary" onClick={handleSignDocument}>
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
                        <div style={{ padding: '20px', color: '#888', gridColumn: '1 / -1', textAlign: 'center' }}>{t('digitalsignature.net_zagruzhennyh_sertifikatov', 'Нет загруженных сертификатов')}</div>
                    )}
                    {certificates.map(cert => {
                        const statusInfo = getStatusInfo(cert.status);
                        const StatusIcon = statusInfo.icon;

                        return (
                            <div key={cert.id} style={{
                                padding: '20px',
                                border: '1px solid var(--border-color)',
                                borderRadius: '12px',
                                background: 'var(--bg-secondary)'
                            }}>
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '12px' }}>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                                        <div style={{
                                            width: '48px', height: '48px',
                                            borderRadius: '12px',
                                            background: 'linear-gradient(135deg, #3b82f6, #1d4ed8)',
                                            display: 'flex',
                                            alignItems: 'center',
                                            justifyContent: 'center'
                                        }}>
                                            <Shield size={24} color="white" />
                                        </div>
                                        <div>
                                            <div style={{ fontWeight: 'bold' }}>{cert.name}</div>
                                            <div style={{ fontSize: '12px', color: '#888' }}>{cert.owner}</div>
                                        </div>
                                    </div>
                                    <span style={{
                                        background: statusInfo.bg,
                                        color: statusInfo.color,
                                        padding: '4px 12px',
                                        borderRadius: '12px',
                                        fontSize: '12px',
                                        display: 'flex',
                                        alignItems: 'center',
                                        gap: '4px'
                                    }}>
                                        <StatusIcon size={12} /> {statusInfo.label}
                                    </span>
                                </div>
                                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '8px', fontSize: '13px' }}>
                                    <div>
                                        <span style={{ color: '#888' }}>{t('digitalsignature.izdatel', 'Издатель:')}</span> {cert.issuer}
                                    </div>
                                    <div>
                                        <span style={{ color: '#888' }}>{t('digitalsignature.tip', 'Тип:')}</span> Квалифицированная
                                    </div>
                                    <div>
                                        <span style={{ color: '#888' }}>{t('digitalsignature.s', 'С:')}</span> {cert.valid_from}
                                    </div>
                                    <div>
                                        <span style={{ color: '#888' }}>{t('digitalsignature.do', 'До:')}</span> {cert.valid_to}
                                    </div>
                                </div>
                            </div>
                        );
                    })}
                </div>
            </div>

            {/* История подписей */}
            <div className="card">
                <div style={{ padding: '16px', borderBottom: '1px solid var(--border-color)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <h3 style={{ margin: 0 }}>{t('digitalsignature.istoriya_podpisaniy', '📋 История подписаний')}</h3>
                    <button className="btn btn-sm btn-secondary" onClick={() => loadData()}>
                        <RefreshCw size={14} /> Обновить
                    </button>
                </div>
                {loading ? (
                    <div style={{ padding: '40px', textAlign: 'center' }}>{t('digitalsignature.zagruzka', 'Загрузка...')}</div>
                ) : (
                    <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                        <thead>
                            <tr style={{ background: 'var(--bg-secondary)' }}>
                                <th style={{ padding: '12px', textAlign: 'left' }}>{t('digitalsignature.dokument', 'Документ')}</th>
                                <th style={{ padding: '12px', textAlign: 'left' }}>{t('digitalsignature.podpisant', 'Подписант')}</th>
                                <th style={{ padding: '12px', textAlign: 'center' }}>{t('digitalsignature.data_vremya', 'Дата/время')}</th>
                                <th style={{ padding: '12px', textAlign: 'center' }}>{t('digitalsignature.hesh', 'Хэш')}</th>
                                <th style={{ padding: '12px', textAlign: 'center' }}>{t('digitalsignature.status', 'Статус')}</th>
                                <th style={{ padding: '12px', textAlign: 'center' }}>{t('digitalsignature.deystviya', 'Действия')}</th>
                            </tr>
                        </thead>
                        <tbody>
                            {signatures.length === 0 && (
                                <tr><td colSpan="6" style={{ padding: '20px', textAlign: 'center', color: '#888' }}>{t('digitalsignature.net_podpisannyh_dokumentov', 'Нет подписанных документов')}</td></tr>
                            )}
                            {signatures.map(sig => {
                                const statusInfo = getStatusInfo(sig.status);
                                const StatusIcon = statusInfo.icon;

                                return (
                                    <tr key={sig.id} style={{ borderBottom: '1px solid var(--border-color)' }}>
                                        <td style={{ padding: '12px' }}>
                                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                                <FileText size={16} color="var(--primary)" />
                                                <span style={{ fontWeight: 500 }}>{sig.document}</span>
                                            </div>
                                        </td>
                                        <td style={{ padding: '12px' }}>{sig.signer}</td>
                                        <td style={{ padding: '12px', textAlign: 'center', fontSize: '13px' }}>{sig.date}</td>
                                        <td style={{ padding: '12px', textAlign: 'center' }}>
                                            <code style={{
                                                background: 'var(--bg-secondary)',
                                                padding: '4px 8px',
                                                borderRadius: '4px',
                                                fontSize: '12px'
                                            }}>
                                                {sig.hash}
                                            </code>
                                        </td>
                                        <td style={{ padding: '12px', textAlign: 'center' }}>
                                            <span style={{
                                                background: statusInfo.bg,
                                                color: statusInfo.color,
                                                padding: '4px 12px',
                                                borderRadius: '12px',
                                                fontSize: '12px',
                                                display: 'inline-flex',
                                                alignItems: 'center',
                                                gap: '4px'
                                            }}>
                                                <StatusIcon size={12} /> {statusInfo.label}
                                            </span>
                                        </td>
                                        <td style={{ padding: '12px', textAlign: 'center' }}>
                                            <div style={{ display: 'flex', gap: '4px', justifyContent: 'center' }}>
                                                <button className="btn btn-sm btn-secondary" title="Проверить" onClick={() => toast.info(`Проверка подписи: ${sig.document}`)}>
                                                    <Eye size={14} />
                                                </button>
                                                <button className="btn btn-sm btn-secondary" title="Скачать" onClick={() => toast.info(`Скачивание: ${sig.document}`)}>
                                                    <Download size={14} />
                                                </button>
                                            </div>
                                        </td>
                                    </tr>
                                );
                            })}
                        </tbody>
                    </table>
                )}
            </div>
        </div>
    );
}

export default DigitalSignature;
