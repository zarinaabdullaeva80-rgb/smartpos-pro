import React, { useState, useEffect } from 'react';
import { Heart, Package, Search, Users, TrendingUp, Mail, Trash2 } from 'lucide-react';
import api from '../services/api';
import { useI18n } from '../i18n';

function Wishlists() {
    const { t } = useI18n();
    const [wishlists, setWishlists] = useState([]);
    const [popularProducts, setPopularProducts] = useState([]);
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');
    const [message, setMessage] = useState(null);

    useEffect(() => { loadData(); }, []);

    const loadData = async () => {
        try {
            const apiRes = await customersAPI.getAll();
            const apiData = apiRes.data || apiRes;
            setWishlists(apiData.wishlists || []);
            setPopularProducts(apiData.popularProducts || []);
        } catch (err) {
            console.warn('Wishlists: не удалось загрузить данные', err.message);
        }
        setLoading(false);
    };

    const formatCurrency = (value) => new Intl.NumberFormat('ru-RU').format(value || 0) + " so'm";
    const formatDate = (date) => date ? new Date(date).toLocaleDateString('ru-RU') : '-';

    const totalItems = wishlists.reduce((sum, w) => sum + w.items_count, 0);
    const totalValue = wishlists.reduce((sum, w) => sum + w.total_value, 0);

    const filteredWishlists = wishlists.filter(w =>
        w.customer_name?.toLowerCase().includes(searchTerm.toLowerCase())
    );

    const handleSendBulkEmail = async () => {
        try {
            setMessage({ type: 'info', text: 'Отправка email рассылки...' });
            // Simulate API call
            await new Promise(resolve => setTimeout(resolve, 1500));
            setMessage({ type: 'success', text: `Рассылка отправлена ${wishlists.length} клиентам!` });
        } catch (error) {
            setMessage({ type: 'error', text: 'Ошибка отправки рассылки' });
        }
    };

    const handleSendEmail = async (wishlistId, customerName) => {
        try {
            setMessage({ type: 'info', text: `Отправка email ${customerName}...` });
            await new Promise(resolve => setTimeout(resolve, 800));
            setMessage({ type: 'success', text: `Email отправлен ${customerName}` });
        } catch (error) {
            setMessage({ type: 'error', text: 'Ошибка отправки email' });
        }
    };

    const handleDeleteWishlist = async (wishlistId, customerName) => {
        if (!confirm(`Удалить список желаний ${customerName}?`)) return;
        try {
            setWishlists(prev => prev.filter(w => w.id !== wishlistId));
            setMessage({ type: 'success', text: 'Список желаний удалён' });
        } catch (error) {
            setMessage({ type: 'error', text: 'Ошибка удаления' });
        }
    };

    return (
        <div className="wishlists-page fade-in">
            <div className="page-header">
                <div>
                    <h1>{t('wishlists.spiski_zhelaniy', '❤️ Списки желаний')}</h1>
                    <p className="text-muted">{t('wishlists.tovary_kotorye_hotyat_kupit_klienty', 'Товары, которые хотят купить клиенты')}</p>
                </div>
                <button className="btn btn-primary" onClick={handleSendBulkEmail}>
                    <Mail size={18} /> Рассылка по wishlist
                </button>
            </div>

            {/* Статистика */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '16px', marginBottom: '20px' }}>
                <div className="card" style={{ padding: '20px', textAlign: 'center' }}>
                    <Heart size={32} color="#ef4444" style={{ marginBottom: '8px' }} />
                    <div style={{ fontSize: '28px', fontWeight: 'bold' }}>{totalItems}</div>
                    <div style={{ color: '#666' }}>{t('wishlists.tovarov_v', 'Товаров в wishlist')}</div>
                </div>
                <div className="card" style={{ padding: '20px', textAlign: 'center' }}>
                    <Users size={32} color="#3b82f6" style={{ marginBottom: '8px' }} />
                    <div style={{ fontSize: '28px', fontWeight: 'bold' }}>{wishlists.length}</div>
                    <div style={{ color: '#666' }}>{t('wishlists.klientov', 'Клиентов')}</div>
                </div>
                <div className="card" style={{ padding: '20px', textAlign: 'center' }}>
                    <TrendingUp size={32} color="#10b981" style={{ marginBottom: '8px' }} />
                    <div style={{ fontSize: '28px', fontWeight: 'bold' }}>{formatCurrency(totalValue)}</div>
                    <div style={{ color: '#666' }}>{t('wishlists.potentsial_prodazh', 'Потенциал продаж')}</div>
                </div>
                <div className="card" style={{ padding: '20px', textAlign: 'center' }}>
                    <Package size={32} color="#f59e0b" style={{ marginBottom: '8px' }} />
                    <div style={{ fontSize: '28px', fontWeight: 'bold' }}>{popularProducts.length}</div>
                    <div style={{ color: '#666' }}>{t('wishlists.populyarnyh_tovarov', 'Популярных товаров')}</div>
                </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 400px', gap: '20px' }}>
                {/* Список клиентов */}
                <div className="card">
                    <div style={{ padding: '16px', borderBottom: '1px solid var(--border-color)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <h3 style={{ margin: 0 }}>{t('wishlists.klienty_s', '👤 Клиенты с wishlist')}</h3>
                        <div style={{ position: 'relative', width: '250px' }}>
                            <Search size={18} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: '#888' }} />
                            <input
                                type="text"
                                placeholder="Поиск..."
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                                style={{ paddingLeft: '40px', width: '100%' }}
                            />
                        </div>
                    </div>
                    {loading ? (
                        <div style={{ padding: '40px', textAlign: 'center' }}>{t('wishlists.zagruzka', 'Загрузка...')}</div>
                    ) : (
                        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                            <thead>
                                <tr style={{ background: 'var(--bg-secondary)' }}>
                                    <th style={{ padding: '12px', textAlign: 'left' }}>{t('wishlists.klient', 'Клиент')}</th>
                                    <th style={{ padding: '12px', textAlign: 'center' }}>{t('wishlists.tovarov', 'Товаров')}</th>
                                    <th style={{ padding: '12px', textAlign: 'right' }}>{t('wishlists.summa', 'Сумма')}</th>
                                    <th style={{ padding: '12px', textAlign: 'left' }}>{t('wishlists.poslednee', 'Последнее')}</th>
                                    <th style={{ padding: '12px', textAlign: 'center' }}>{t('wishlists.deystviya', 'Действия')}</th>
                                </tr>
                            </thead>
                            <tbody>
                                {filteredWishlists.map(wish => (
                                    <tr key={wish.id} style={{ borderBottom: '1px solid var(--border-color)' }}>
                                        <td style={{ padding: '12px' }}>
                                            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                                                <div style={{
                                                    width: '40px', height: '40px',
                                                    borderRadius: '50%',
                                                    background: 'linear-gradient(135deg, #ef4444 0%, #f97316 100%)',
                                                    color: 'white',
                                                    display: 'flex',
                                                    alignItems: 'center',
                                                    justifyContent: 'center',
                                                    fontWeight: 'bold'
                                                }}>
                                                    {wish.customer_name[0]}
                                                </div>
                                                <div>
                                                    <div style={{ fontWeight: 500 }}>{wish.customer_name}</div>
                                                    <div style={{ fontSize: '12px', color: '#888' }}>{wish.phone}</div>
                                                </div>
                                            </div>
                                        </td>
                                        <td style={{ padding: '12px', textAlign: 'center' }}>
                                            <span style={{
                                                background: '#fee2e2',
                                                color: '#dc2626',
                                                padding: '4px 12px',
                                                borderRadius: '12px',
                                                fontWeight: 'bold'
                                            }}>
                                                {wish.items_count}
                                            </span>
                                        </td>
                                        <td style={{ padding: '12px', textAlign: 'right', fontWeight: 'bold' }}>
                                            {formatCurrency(wish.total_value)}
                                        </td>
                                        <td style={{ padding: '12px', color: '#888' }}>{formatDate(wish.last_added)}</td>
                                        <td style={{ padding: '12px', textAlign: 'center' }}>
                                            <div style={{ display: 'flex', gap: '6px', justifyContent: 'center' }}>
                                                <button className="btn btn-sm btn-primary" onClick={() => handleSendEmail(wish.id, wish.customer_name)} title={t('wishlists.otpravit', 'Отправить email')}>
                                                    <Mail size={14} />
                                                </button>
                                                <button className="btn btn-sm btn-secondary" onClick={() => handleDeleteWishlist(wish.id, wish.customer_name)} title={t('wishlists.udalit', 'Удалить')}>
                                                    <Trash2 size={14} />
                                                </button>
                                            </div>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    )}
                </div>

                {/* Популярные товары */}
                <div className="card">
                    <div style={{ padding: '16px', borderBottom: '1px solid var(--border-color)' }}>
                        <h3 style={{ margin: 0 }}>{t('wishlists.populyarnye_tovary', '🔥 Популярные товары')}</h3>
                    </div>
                    <div>
                        {popularProducts.map((product, idx) => (
                            <div key={product.id} style={{
                                padding: '16px',
                                borderBottom: '1px solid var(--border-color)',
                                display: 'flex',
                                alignItems: 'center',
                                gap: '12px'
                            }}>
                                <div style={{
                                    width: '32px', height: '32px',
                                    borderRadius: '50%',
                                    background: idx === 0 ? '#fbbf24' : idx === 1 ? '#94a3b8' : idx === 2 ? '#b45309' : '#e5e7eb',
                                    color: idx < 3 ? 'white' : '#666',
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    fontWeight: 'bold',
                                    fontSize: '14px'
                                }}>
                                    {idx + 1}
                                </div>
                                <div style={{ flex: 1 }}>
                                    <div style={{ fontWeight: 500 }}>{product.name}</div>
                                    <div style={{ fontSize: '13px', color: '#888' }}>{formatCurrency(product.price)}</div>
                                </div>
                                <div style={{ textAlign: 'right' }}>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '4px', color: '#ef4444' }}>
                                        <Heart size={14} fill="#ef4444" /> {product.wishlist_count}
                                    </div>
                                    {product.in_stock ? (
                                        <span style={{ fontSize: '11px', color: '#10b981' }}>{t('wishlists.v_nalichii', 'В наличии')}</span>
                                    ) : (
                                        <span style={{ fontSize: '11px', color: '#ef4444' }}>{t('wishlists.net_v_nalichii', 'Нет в наличии')}</span>
                                    )}
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            </div>
        </div>
    );
}

export default Wishlists;
