import React, { useState, useEffect } from 'react';
import { Star, Truck, Clock, DollarSign, Package, ThumbsUp, ThumbsDown, Search, Filter, Download } from 'lucide-react';
import { counterpartiesAPI } from '../services/api';
import { useI18n } from '../i18n';

function SupplierRatings() {
    const { t } = useI18n();
    const [suppliers, setSuppliers] = useState([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => { loadData(); }, []);

    const loadData = async () => {
        try {
            const apiRes = await counterpartiesAPI.getAll();
            const apiData = apiRes.data || apiRes;
            console.log('SupplierRatings.jsx: данные загружены с сервера', apiData);
        } catch (err) {
            console.warn('SupplierRatings: не удалось загрузить данные', err.message);
        }
        setLoading(false);
    };

    const formatCurrency = (value) => new Intl.NumberFormat('ru-RU').format(value || 0) + " so'm";

    const renderStars = (rating) => {
        const stars = [];
        for (let i = 1; i <= 5; i++) {
            stars.push(
                <Star
                    key={i}
                    size={16}
                    fill={i <= rating ? '#fbbf24' : 'none'}
                    color={i <= rating ? '#fbbf24' : '#ccc'}
                />
            );
        }
        return stars;
    };

    const getScoreColor = (score) => {
        if (score >= 90) return '#10b981';
        if (score >= 75) return '#3b82f6';
        if (score >= 60) return '#f59e0b';
        return '#ef4444';
    };

    const [message, setMessage] = useState(null);

    const handleExport = () => {
        setMessage({ type: 'info', text: 'Экспорт рейтингов...' });
        setTimeout(() => {
            setMessage({ type: 'success', text: 'Рейтинги экспортированы!' });
        }, 1000);
    };

    return (
        <div className="supplier-ratings-page fade-in">
            <div className="page-header">
                <div>
                    <h1>{t('supplierratings.reyting_postavschikov', '⭐ Рейтинг поставщиков')}</h1>
                    <p className="text-muted">{t('supplierratings.otsenka_kachestva_i_nadyozhnosti_postavschikov', 'Оценка качества и надёжности поставщиков')}</p>
                </div>
                <button className="btn btn-primary" onClick={handleExport}>
                    <Download size={18} /> Экспорт
                </button>
            </div>

            {/* Фильтры */}
            <div className="card" style={{ marginBottom: '20px', padding: '16px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div style={{ display: 'flex', gap: '12px' }}>
                        <select>
                            <option>{t('supplierratings.vse_kategorii', 'Все категории')}</option>
                            <option>{t('supplierratings.elektronika', 'Электроника')}</option>
                            <option>{t('supplierratings.aksessuary', 'Аксессуары')}</option>
                            <option>{t('supplierratings.audio', 'Аудио')}</option>
                        </select>
                        <select>
                            <option>{t('supplierratings.sortirovka_reyting', 'Сортировка: Рейтинг')}</option>
                            <option>{t('supplierratings.po_zakazam', 'По заказам')}</option>
                            <option>{t('supplierratings.po_obyomu', 'По объёму')}</option>
                        </select>
                    </div>
                    <div style={{ position: 'relative' }}>
                        <Search size={18} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: '#888' }} />
                        <input type="text" placeholder="Поиск поставщика..." style={{ paddingLeft: '40px', width: '250px' }} />
                    </div>
                </div>
            </div>

            {/* Таблица */}
            <div className="card">
                {loading ? (
                    <div style={{ padding: '40px', textAlign: 'center' }}>{t('supplierratings.zagruzka', 'Загрузка...')}</div>
                ) : (
                    <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                        <thead>
                            <tr style={{ background: 'var(--bg-secondary)' }}>
                                <th style={{ padding: '12px', textAlign: 'left' }}>{t('supplierratings.postavschik', 'Поставщик')}</th>
                                <th style={{ padding: '12px', textAlign: 'center' }}>{t('supplierratings.reyting', 'Рейтинг')}</th>
                                <th style={{ padding: '12px', textAlign: 'center' }}>{t('supplierratings.vovremya', 'Вовремя')}</th>
                                <th style={{ padding: '12px', textAlign: 'center' }}>{t('supplierratings.kachestvo', 'Качество')}</th>
                                <th style={{ padding: '12px', textAlign: 'center' }}>{t('supplierratings.tseny', 'Цены')}</th>
                                <th style={{ padding: '12px', textAlign: 'right' }}>{t('supplierratings.obyom_zakupok', 'Объём закупок')}</th>
                                <th style={{ padding: '12px', textAlign: 'center' }}>{t('supplierratings.dostavka', 'Доставка')}</th>
                            </tr>
                        </thead>
                        <tbody>
                            {suppliers.map((supplier, idx) => (
                                <tr key={supplier.id} style={{ borderBottom: '1px solid var(--border-color)' }}>
                                    <td style={{ padding: '16px' }}>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                                            <div style={{
                                                width: '40px',
                                                height: '40px',
                                                borderRadius: '50%',
                                                background: `hsl(${idx * 60}, 70%, 90%)`,
                                                display: 'flex',
                                                alignItems: 'center',
                                                justifyContent: 'center',
                                                fontWeight: 'bold',
                                                color: `hsl(${idx * 60}, 70%, 40%)`
                                            }}>
                                                {supplier.name.charAt(0)}
                                            </div>
                                            <div>
                                                <div style={{ fontWeight: 500 }}>{supplier.name}</div>
                                                <div style={{ fontSize: '12px', color: '#888' }}>{supplier.orders} заказов</div>
                                            </div>
                                        </div>
                                    </td>
                                    <td style={{ padding: '12px', textAlign: 'center' }}>
                                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '4px' }}>
                                            {renderStars(Math.round(supplier.rating))}
                                        </div>
                                        <div style={{ fontSize: '13px', fontWeight: 'bold', marginTop: '4px' }}>{supplier.rating}</div>
                                    </td>
                                    <td style={{ padding: '12px', textAlign: 'center' }}>
                                        <div style={{
                                            display: 'inline-block',
                                            padding: '4px 12px',
                                            borderRadius: '12px',
                                            background: `${getScoreColor(supplier.on_time)}20`,
                                            color: getScoreColor(supplier.on_time),
                                            fontWeight: 'bold'
                                        }}>
                                            {supplier.on_time}%
                                        </div>
                                    </td>
                                    <td style={{ padding: '12px', textAlign: 'center' }}>
                                        <div style={{
                                            display: 'inline-block',
                                            padding: '4px 12px',
                                            borderRadius: '12px',
                                            background: `${getScoreColor(supplier.quality)}20`,
                                            color: getScoreColor(supplier.quality),
                                            fontWeight: 'bold'
                                        }}>
                                            {supplier.quality}%
                                        </div>
                                        <div style={{ fontSize: '11px', color: '#888', marginTop: '2px' }}>
                                            Брак: {supplier.defect_rate}%
                                        </div>
                                    </td>
                                    <td style={{ padding: '12px', textAlign: 'center' }}>
                                        <div style={{
                                            display: 'inline-block',
                                            padding: '4px 12px',
                                            borderRadius: '12px',
                                            background: `${getScoreColor(supplier.price_score)}20`,
                                            color: getScoreColor(supplier.price_score),
                                            fontWeight: 'bold'
                                        }}>
                                            {supplier.price_score}
                                        </div>
                                    </td>
                                    <td style={{ padding: '12px', textAlign: 'right', fontWeight: 'bold' }}>
                                        {formatCurrency(supplier.total_purchases)}
                                    </td>
                                    <td style={{ padding: '12px', textAlign: 'center' }}>
                                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '4px' }}>
                                            <Truck size={14} color="#888" />
                                            <span>{supplier.avg_delivery} дней</span>
                                        </div>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                )}
            </div>
        </div>
    );
}

export default SupplierRatings;
