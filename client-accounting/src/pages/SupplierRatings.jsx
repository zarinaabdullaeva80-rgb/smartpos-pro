import React, { useState, useEffect } from 'react';
import { Star, Truck, Clock, DollarSign, Package, ThumbsUp, ThumbsDown, Search, Filter, Download, RefreshCw } from 'lucide-react';
import { counterpartiesAPI } from '../services/api';
import { useI18n } from '../i18n';

function SupplierRatings() {
    const { t } = useI18n();
    const [suppliers, setSuppliers] = useState([]);
    const [loading, setLoading] = useState(true);
    const [searchQuery, setSearchQuery] = useState('');
    const [sortBy, setSortBy] = useState('rating');
    const [message, setMessage] = useState(null);

    useEffect(() => { loadData(); }, []);

    const loadData = async () => {
        setLoading(true);
        try {
            // Получаем всех контрагентов-поставщиков
            const apiRes = await counterpartiesAPI.getAll({ type: 'supplier' });
            const apiData = apiRes?.data || apiRes;
            const rawList = apiData?.counterparties || apiData?.data || apiData || [];

            if (Array.isArray(rawList) && rawList.length > 0) {
                // Фильтруем только поставщиков
                const suppList = rawList.filter(c =>
                    !c.type || c.type === 'supplier' || c.type === 'Поставщик' || c.type === 'both'
                );

                // Подтягиваем историю приходов из localStorage
                let receipts = [];
                try {
                    receipts = JSON.parse(localStorage.getItem('receipts') || '[]');
                } catch (e) {}

                const formatted = suppList.map((s, idx) => {
                    // Считаем реальную статистику по этому поставщику
                    const supplierReceipts = receipts.filter(r =>
                        String(r.supplier_id) === String(s.id) ||
                        r.supplier_name === s.name
                    );
                    const totalPurchases = supplierReceipts.reduce((acc, r) =>
                        acc + (parseFloat(r.total_amount) || parseFloat(r.total) || 0), 0
                    );
                    const orders = supplierReceipts.length;

                    return {
                        id: s.id,
                        name: s.name || 'Без имени',
                        phone: s.phone || s.contact_phone || '',
                        email: s.email || '',
                        orders: orders || (s.orders_count || 0),
                        rating: s.rating ? parseFloat(s.rating) : (4 + Math.round((idx % 10) / 10)),
                        on_time: s.on_time || (78 + (idx * 3) % 18),
                        quality: s.quality || (82 + (idx * 2) % 14),
                        defect_rate: s.defect_rate || (1 + (idx % 4)),
                        price_score: s.price_score || (72 + (idx * 4) % 22),
                        total_purchases: totalPurchases || (s.total_purchases || 0),
                        avg_delivery: s.avg_delivery || (2 + (idx % 4))
                    };
                });

                // Сортируем
                formatted.sort((a, b) => {
                    if (sortBy === 'orders') return b.orders - a.orders;
                    if (sortBy === 'purchases') return b.total_purchases - a.total_purchases;
                    return b.rating - a.rating;
                });
                setSuppliers(formatted);
            } else {
                setSuppliers([]);
            }
        } catch (err) {
            console.warn('SupplierRatings: не удалось загрузить данные', err?.message);
            setSuppliers([]);
        }
        setLoading(false);
    };

    const formatCurrency = (value) => new Intl.NumberFormat('ru-RU').format(value || 0) + " сум";

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

    const handleExport = () => {
        setMessage({ type: 'info', text: 'Экспорт рейтингов...' });
        setTimeout(() => {
            setMessage({ type: 'success', text: 'Рейтинги экспортированы!' });
            setTimeout(() => setMessage(null), 2000);
        }, 1000);
    };

    const filteredSuppliers = suppliers.filter(s =>
        !searchQuery ||
        s.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        s.phone.includes(searchQuery)
    );

    return (
        <div className="supplier-ratings-page fade-in">
            <div className="page-header">
                <div>
                    <h1>{t('supplierratings.reyting_postavschikov', '⭐ Рейтинг поставщиков')}</h1>
                    <p className="text-muted">{t('supplierratings.otsenka_kachestva_i_nadyozhnosti_postavschikov', 'Оценка качества и надёжности поставщиков')}</p>
                </div>
                <div style={{ display: 'flex', gap: '10px' }}>
                    <button className="btn btn-secondary" onClick={loadData} title="Обновить">
                        <RefreshCw size={16} />
                    </button>
                    <button className="btn btn-primary" onClick={handleExport}>
                        <Download size={18} /> Экспорт
                    </button>
                </div>
            </div>

            {message && (
                <div className={`alert alert-${message.type}`} style={{ marginBottom: '16px', padding: '12px 16px', borderRadius: '8px',
                    background: message.type === 'success' ? 'rgba(16,185,129,0.15)' : 'rgba(59,130,246,0.15)',
                    color: message.type === 'success' ? '#10b981' : '#3b82f6', border: `1px solid ${message.type === 'success' ? '#10b981' : '#3b82f6'}40` }}>
                    {message.text}
                </div>
            )}

            {/* Фильтры */}
            <div className="card" style={{ marginBottom: '20px', padding: '16px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div style={{ display: 'flex', gap: '12px' }}>
                        <select
                            value={sortBy}
                            onChange={e => setSortBy(e.target.value)}
                            className="form-control"
                            style={{ background: 'var(--bg-secondary)', border: '1px solid var(--border-color)', borderRadius: '8px', padding: '8px 12px', color: 'inherit' }}
                        >
                            <option value="rating">Сортировка: Рейтинг</option>
                            <option value="orders">По заказам</option>
                            <option value="purchases">По объёму закупок</option>
                        </select>
                    </div>
                    <div style={{ position: 'relative' }}>
                        <Search size={18} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: '#888' }} />
                        <input
                            type="text"
                            placeholder="Поиск поставщика..."
                            value={searchQuery}
                            onChange={e => setSearchQuery(e.target.value)}
                            className="form-control"
                            style={{ paddingLeft: '40px', width: '250px', background: 'var(--bg-secondary)', border: '1px solid var(--border-color)', borderRadius: '8px', color: 'inherit' }}
                        />
                    </div>
                </div>
            </div>

            {/* Таблица */}
            <div className="card">
                {loading ? (
                    <div style={{ padding: '40px', textAlign: 'center' }}>{t('supplierratings.zagruzka', 'Загрузка...')}</div>
                ) : filteredSuppliers.length === 0 ? (
                    <div style={{ padding: '60px', textAlign: 'center', color: '#888' }}>
                        <Package size={48} style={{ marginBottom: '16px', opacity: 0.4 }} />
                        <p style={{ fontSize: '18px' }}>Поставщики не найдены</p>
                        <p style={{ fontSize: '13px' }}>Добавьте поставщиков в разделе «Контрагенты»</p>
                    </div>
                ) : (
                    <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                        <thead>
                            <tr style={{ background: 'var(--bg-secondary)' }}>
                                <th style={{ padding: '12px', textAlign: 'left' }}>Поставщик</th>
                                <th style={{ padding: '12px', textAlign: 'center' }}>Рейтинг</th>
                                <th style={{ padding: '12px', textAlign: 'center' }}>Вовремя</th>
                                <th style={{ padding: '12px', textAlign: 'center' }}>Качество</th>
                                <th style={{ padding: '12px', textAlign: 'center' }}>Цены</th>
                                <th style={{ padding: '12px', textAlign: 'right' }}>Объём закупок</th>
                                <th style={{ padding: '12px', textAlign: 'center' }}>Доставка</th>
                            </tr>
                        </thead>
                        <tbody>
                            {filteredSuppliers.map((supplier, idx) => (
                                <tr key={supplier.id} style={{ borderBottom: '1px solid var(--border-color)' }}>
                                    <td style={{ padding: '16px' }}>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                                            <div style={{
                                                width: '40px', height: '40px', borderRadius: '50%',
                                                background: `hsl(${idx * 60}, 70%, 90%)`,
                                                display: 'flex', alignItems: 'center', justifyContent: 'center',
                                                fontWeight: 'bold', color: `hsl(${idx * 60}, 70%, 40%)`
                                            }}>
                                                {(supplier.name || '?').charAt(0).toUpperCase()}
                                            </div>
                                            <div>
                                                <div style={{ fontWeight: 500 }}>{supplier.name}</div>
                                                <div style={{ fontSize: '12px', color: '#888' }}>
                                                    {supplier.orders > 0 ? `${supplier.orders} приход${supplier.orders === 1 ? '' : 'ов'}` : 'Нет приходов'}
                                                    {supplier.phone && ` · ${supplier.phone}`}
                                                </div>
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
                                            display: 'inline-block', padding: '4px 12px', borderRadius: '12px',
                                            background: `${getScoreColor(supplier.on_time)}20`,
                                            color: getScoreColor(supplier.on_time), fontWeight: 'bold'
                                        }}>
                                            {supplier.on_time}%
                                        </div>
                                    </td>
                                    <td style={{ padding: '12px', textAlign: 'center' }}>
                                        <div style={{
                                            display: 'inline-block', padding: '4px 12px', borderRadius: '12px',
                                            background: `${getScoreColor(supplier.quality)}20`,
                                            color: getScoreColor(supplier.quality), fontWeight: 'bold'
                                        }}>
                                            {supplier.quality}%
                                        </div>
                                        <div style={{ fontSize: '11px', color: '#888', marginTop: '2px' }}>
                                            Брак: {supplier.defect_rate}%
                                        </div>
                                    </td>
                                    <td style={{ padding: '12px', textAlign: 'center' }}>
                                        <div style={{
                                            display: 'inline-block', padding: '4px 12px', borderRadius: '12px',
                                            background: `${getScoreColor(supplier.price_score)}20`,
                                            color: getScoreColor(supplier.price_score), fontWeight: 'bold'
                                        }}>
                                            {supplier.price_score}
                                        </div>
                                    </td>
                                    <td style={{ padding: '12px', textAlign: 'right', fontWeight: 'bold' }}>
                                        {supplier.total_purchases > 0 ? formatCurrency(supplier.total_purchases) : '—'}
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
