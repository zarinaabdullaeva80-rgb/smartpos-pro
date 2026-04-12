import React, { useState, useEffect } from 'react';
import { Gift, Plus, Search, CreditCard, Calendar, User, Phone, Mail, Printer, QrCode, Check, X } from 'lucide-react';
import QRCode from 'react-qr-code';
import { giftCertificatesAPI } from '../services/api';
import { useToast } from '../components/ToastProvider';
import { useI18n } from '../i18n';

function GiftCertificates() {
    const { t } = useI18n();
    const toast = useToast();

    // Загрузка из localStorage
    const [certificates, setCertificates] = useState(() => {
        const saved = localStorage.getItem('gift_certificates');
        return saved ? JSON.parse(saved) : [];
    });
    const [showCreate, setShowCreate] = useState(false);
    const [showRedeem, setShowRedeem] = useState(false);
    const [searchTerm, setSearchTerm] = useState('');
    const [loading, setLoading] = useState(false);

    const [newCert, setNewCert] = useState({
        value: 100000,
        recipient_name: '',
        recipient_phone: '',
        message: 'С наилучшими пожеланиями!',
        expires_days: 365
    });

    const [redeemCode, setRedeemCode] = useState('');
    const [redeemAmount, setRedeemAmount] = useState(0);

    // Сохранение в localStorage
    useEffect(() => {
        localStorage.setItem('gift_certificates', JSON.stringify(certificates));
    }, [certificates]);

    // Генерация кода сертификата
    const generateCode = () => {
        const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
        let code = '';
        for (let i = 0; i < 12; i++) {
            if (i > 0 && i % 4 === 0) code += '-';
            code += chars[Math.floor(Math.random() * chars.length)];
        }
        return code;
    };

    useEffect(() => { loadCertificates(); }, []);

    const loadCertificates = async () => {
        try {
            const apiRes = await giftCertificatesAPI.getAll();
            const apiData = apiRes.data || apiRes;
            const list = apiData.certificates || apiData || [];
            if (Array.isArray(list) && list.length > 0) {
                setCertificates(list);
            }
        } catch (err) {
            console.warn('GiftCertificates: не удалось загрузить данные', err.message);
        }
        setLoading(false);
    };

    const createCertificate = async () => {
        try {
            const response = await giftCertificatesAPI.create(newCert);
            if (response.data?.success || response.data?.certificate) {
                setCertificates([response.data.certificate, ...certificates]);
                setShowCreate(false);
                setNewCert({ value: 100000, recipient_name: '', recipient_phone: '', message: '', expires_days: 365 });
                toast.success('Сертификат создан!');
            } else {
                throw new Error('API error');
            }
        } catch (error) {
            console.warn('GiftCertificates: не удалось загрузить данные', error.message);
        }
    };

    const redeemCertificate = async () => {
        try {
            const response = await giftCertificatesAPI.redeem(redeemCode, redeemAmount, null);
            if (response.data?.success) {
                toast.info(`Погашено: ${formatCurrency(response.data.redeemed)}\nОстаток: ${formatCurrency(response.data.remaining)}`);
                loadCertificates();
                setShowRedeem(false);
            } else {
                toast.info(response.data?.error || 'Ошибка');
            }
        } catch (error) {
            toast.error('Ошибка погашения');
        }
    };

    const formatCurrency = (value) => new Intl.NumberFormat('ru-RU').format(value || 0) + " so'm";
    const formatDate = (date) => date ? new Date(date).toLocaleDateString('ru-RU') : '-';

    const filteredCerts = certificates.filter(c =>
        c.code?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        c.recipient_name?.toLowerCase().includes(searchTerm.toLowerCase())
    );

    return (
        <div className="gift-certificates-page fade-in">
            <div className="page-header">
                <div>
                    <h1>{t('giftcertificates.podarochnye_sertifikaty', '🎁 Подарочные сертификаты')}</h1>
                    <p className="text-muted">{t('giftcertificates.sozdanie_i_upravlenie_podarochnymi_sertif', 'Создание и управление подарочными сертификатами')}</p>
                </div>
                <div style={{ display: 'flex', gap: '10px' }}>
                    <button className="btn btn-secondary" onClick={() => setShowRedeem(true)}>
                        <QrCode size={18} /> Погасить
                    </button>
                    <button className="btn btn-primary" onClick={() => setShowCreate(true)}>
                        <Plus size={18} /> Создать сертификат
                    </button>
                </div>
            </div>

            {/* Статистика */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '16px', marginBottom: '20px' }}>
                <div className="card" style={{ padding: '20px', textAlign: 'center' }}>
                    <div style={{ fontSize: '28px', fontWeight: 'bold', color: 'var(--primary)' }}>
                        {certificates.length}
                    </div>
                    <div style={{ color: '#666' }}>{t('giftcertificates.vsego_sertifikatov', 'Всего сертификатов')}</div>
                </div>
                <div className="card" style={{ padding: '20px', textAlign: 'center' }}>
                    <div style={{ fontSize: '28px', fontWeight: 'bold', color: '#10b981' }}>
                        {certificates.filter(c => c.is_active).length}
                    </div>
                    <div style={{ color: '#666' }}>{t('giftcertificates.aktivnyh', 'Активных')}</div>
                </div>
                <div className="card" style={{ padding: '20px', textAlign: 'center' }}>
                    <div style={{ fontSize: '28px', fontWeight: 'bold', color: '#3b82f6' }}>
                        {formatCurrency(certificates.reduce((sum, c) => sum + parseFloat(c.initial_value || 0), 0))}
                    </div>
                    <div style={{ color: '#666' }}>{t('giftcertificates.vypuscheno', 'Выпущено')}</div>
                </div>
                <div className="card" style={{ padding: '20px', textAlign: 'center' }}>
                    <div style={{ fontSize: '28px', fontWeight: 'bold', color: '#f59e0b' }}>
                        {formatCurrency(certificates.reduce((sum, c) => sum + parseFloat(c.current_value || 0), 0))}
                    </div>
                    <div style={{ color: '#666' }}>{t('giftcertificates.ostatok', 'Остаток')}</div>
                </div>
            </div>

            {/* Поиск */}
            <div className="card" style={{ marginBottom: '20px', padding: '16px' }}>
                <div style={{ position: 'relative' }}>
                    <Search size={18} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: '#888' }} />
                    <input
                        type="text"
                        placeholder="Поиск по коду или получателю..."
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        style={{ paddingLeft: '40px', width: '100%' }}
                    />
                </div>
            </div>

            {/* Список сертификатов */}
            <div className="card">
                <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                    <thead>
                        <tr style={{ background: 'var(--bg-secondary)' }}>
                            <th style={{ padding: '12px', textAlign: 'left' }}>{t('giftcertificates.kod', 'Код')}</th>
                            <th style={{ padding: '12px', textAlign: 'left' }}>{t('giftcertificates.poluchatel', 'Получатель')}</th>
                            <th style={{ padding: '12px', textAlign: 'right' }}>{t('giftcertificates.nominal', 'Номинал')}</th>
                            <th style={{ padding: '12px', textAlign: 'right' }}>{t('giftcertificates.ostatok', 'Остаток')}</th>
                            <th style={{ padding: '12px', textAlign: 'center' }}>{t('giftcertificates.status', 'Статус')}</th>
                            <th style={{ padding: '12px', textAlign: 'left' }}>{t('giftcertificates.deystvuet_do', 'Действует до')}</th>
                            <th style={{ padding: '12px', textAlign: 'center' }}>{t('giftcertificates.deystviya', 'Действия')}</th>
                        </tr>
                    </thead>
                    <tbody>
                        {loading ? (
                            <tr><td colSpan="7" style={{ padding: '40px', textAlign: 'center' }}>{t('giftcertificates.zagruzka', 'Загрузка...')}</td></tr>
                        ) : filteredCerts.length === 0 ? (
                            <tr><td colSpan="7" style={{ padding: '40px', textAlign: 'center', color: '#888' }}>{t('giftcertificates.sertifikaty_ne_naydeny', 'Сертификаты не найдены')}</td></tr>
                        ) : (
                            filteredCerts.map(cert => (
                                <tr key={cert.id} style={{ borderBottom: '1px solid var(--border-color)' }}>
                                    <td style={{ padding: '12px', fontFamily: 'monospace', fontWeight: 'bold' }}>
                                        {cert.code}
                                    </td>
                                    <td style={{ padding: '12px' }}>
                                        <div>{cert.recipient_name || '-'}</div>
                                        <div style={{ fontSize: '12px', color: '#888' }}>{cert.recipient_phone}</div>
                                    </td>
                                    <td style={{ padding: '12px', textAlign: 'right' }}>{formatCurrency(cert.initial_value)}</td>
                                    <td style={{ padding: '12px', textAlign: 'right', fontWeight: 'bold', color: parseFloat(cert.current_value) > 0 ? '#10b981' : '#888' }}>
                                        {formatCurrency(cert.current_value)}
                                    </td>
                                    <td style={{ padding: '12px', textAlign: 'center' }}>
                                        {cert.is_active ? (
                                            <span style={{ background: '#dcfce7', color: '#16a34a', padding: '4px 12px', borderRadius: '12px', fontSize: '12px' }}>
                                                Активен
                                            </span>
                                        ) : (
                                            <span style={{ background: '#f3f4f6', color: '#6b7280', padding: '4px 12px', borderRadius: '12px', fontSize: '12px' }}>
                                                Использован
                                            </span>
                                        )}
                                    </td>
                                    <td style={{ padding: '12px' }}>{formatDate(cert.expires_at)}</td>
                                    <td style={{ padding: '12px', textAlign: 'center' }}>
                                        <button className="btn btn-sm btn-secondary" title={t('giftcertificates.pechat', 'Печать')}>
                                            <Printer size={16} />
                                        </button>
                                    </td>
                                </tr>
                            ))
                        )}
                    </tbody>
                </table>
            </div>

            {/* Модал создания */}
            {showCreate && (
                <div className="modal-overlay" onClick={() => setShowCreate(false)}>
                    <div className="modal" onClick={e => e.stopPropagation()} style={{ maxWidth: '500px' }}>
                        <div className="modal-header">
                            <h2>{t('giftcertificates.novyy_sertifikat', '🎁 Новый сертификат')}</h2>
                        </div>
                        <div className="modal-body">
                            <div className="form-group">
                                <label>{t('giftcertificates.nominal_sum', 'Номинал (сум)')}</label>
                                <input
                                    type="number"
                                    value={newCert.value}
                                    onChange={(e) => setNewCert({ ...newCert, value: e.target.value })}
                                />
                            </div>
                            <div className="form-group">
                                <label>{t('giftcertificates.imya_poluchatelya', 'Имя получателя')}</label>
                                <input
                                    type="text"
                                    value={newCert.recipient_name}
                                    onChange={(e) => setNewCert({ ...newCert, recipient_name: e.target.value })}
                                    placeholder="Иван Иванов"
                                />
                            </div>
                            <div className="form-group">
                                <label>{t('giftcertificates.telefon_poluchatelya', 'Телефон получателя')}</label>
                                <input
                                    type="tel"
                                    value={newCert.recipient_phone}
                                    onChange={(e) => setNewCert({ ...newCert, recipient_phone: e.target.value })}
                                    placeholder="+998 90 123 45 67"
                                />
                            </div>
                            <div className="form-group">
                                <label>{t('giftcertificates.pozdravitelnoe_soobschenie', 'Поздравительное сообщение')}</label>
                                <textarea
                                    value={newCert.message}
                                    onChange={(e) => setNewCert({ ...newCert, message: e.target.value })}
                                    rows={3}
                                />
                            </div>
                            <div className="form-group">
                                <label>{t('giftcertificates.srok_deystviya_dney', 'Срок действия (дней)')}</label>
                                <input
                                    type="number"
                                    value={newCert.expires_days}
                                    onChange={(e) => setNewCert({ ...newCert, expires_days: e.target.value })}
                                />
                            </div>
                        </div>
                        <div className="modal-footer">
                            <button className="btn btn-secondary" onClick={() => setShowCreate(false)}>{t('giftcertificates.otmena', 'Отмена')}</button>
                            <button className="btn btn-primary" onClick={createCertificate}>
                                <Gift size={18} /> Создать
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Модал погашения */}
            {showRedeem && (
                <div className="modal-overlay" onClick={() => setShowRedeem(false)}>
                    <div className="modal" onClick={e => e.stopPropagation()} style={{ maxWidth: '400px' }}>
                        <div className="modal-header">
                            <h2>{t('giftcertificates.pogasit_sertifikat', '📷 Погасить сертификат')}</h2>
                        </div>
                        <div className="modal-body">
                            <div className="form-group">
                                <label>{t('giftcertificates.kod_sertifikata', 'Код сертификата')}</label>
                                <input
                                    type="text"
                                    value={redeemCode}
                                    onChange={(e) => setRedeemCode(e.target.value.toUpperCase())}
                                    placeholder="XXXX-XXXX-XXXX"
                                    style={{ fontFamily: 'monospace', fontSize: '18px', textAlign: 'center' }}
                                />
                            </div>
                            <div className="form-group">
                                <label>{t('giftcertificates.summa_k_spisaniyu_sum', 'Сумма к списанию (сум)')}</label>
                                <input
                                    type="number"
                                    value={redeemAmount}
                                    onChange={(e) => setRedeemAmount(e.target.value)}
                                />
                            </div>
                        </div>
                        <div className="modal-footer">
                            <button className="btn btn-secondary" onClick={() => setShowRedeem(false)}>{t('giftcertificates.otmena', 'Отмена')}</button>
                            <button className="btn btn-primary" onClick={redeemCertificate} disabled={!redeemCode || !redeemAmount}>
                                <Check size={18} /> Погасить
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}

export default GiftCertificates;
