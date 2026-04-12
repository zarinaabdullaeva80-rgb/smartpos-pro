import React, { useState, useEffect } from 'react';
import { Truck, Package, ArrowRight, Clock, CheckCircle, AlertTriangle, MapPin, RefreshCw } from 'lucide-react';
import { warehousesAPI } from '../services/api';
import { useToast } from '../components/ToastProvider';
import { useI18n } from '../i18n';

function CrossDocking() {
    const { t } = useI18n();
    const toast = useToast();
    const [transfers, setTransfers] = useState([]);
    const [stats, setStats] = useState({});
    const [loading, setLoading] = useState(true);

    useEffect(() => { loadData(); }, []);

    const loadData = async () => {
        try {
            const apiRes = await warehousesAPI.getAll();
            const apiData = apiRes.data || apiRes;
            setTransfers(apiData.transfers || []);
            setStats(apiData.stats || {});
        } catch (err) {
            console.warn('CrossDocking: не удалось загрузить данные', err.message);
        }
        setLoading(false);
    };

    const formatCurrency = (value) => new Intl.NumberFormat('ru-RU').format(value || 0) + " so'm";
    const formatDate = (date) => date ? new Date(date).toLocaleString('ru-RU') : '-';

    const getStatusInfo = (status) => {
        const statuses = {
            awaiting_receipt: { label: 'Ожидает приёмки', color: '#f59e0b', bg: '#fef3c7', icon: Clock },
            in_transit: { label: 'В пути', color: '#3b82f6', bg: '#dbeafe', icon: Truck },
            processing: { label: 'Обработка', color: '#8b5cf6', bg: '#ede9fe', icon: RefreshCw },
            completed: { label: 'Завершён', color: '#10b981', bg: '#dcfce7', icon: CheckCircle }
        };
        return statuses[status] || statuses.processing;
    };

    return (
        <div className="cross-docking-page fade-in">
            <div className="page-header">
                <div>
                    <h1>{t('crossdocking.kross_doking', '🚚 Кросс-докинг')}</h1>
                    <p className="text-muted">{t('crossdocking.tranzitnaya_dostavka_ot_postavschika_v_maga', 'Транзитная доставка от поставщика в магазин')}</p>
                </div>
                <button className="btn btn-primary" onClick={() => toast.success('Создание новой доставки...')}>
                    <Truck size={18} /> Новая доставка
                </button>
            </div>

            {/* Статистика */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '16px', marginBottom: '20px' }}>
                <div className="card" style={{ padding: '20px', textAlign: 'center' }}>
                    <Truck size={32} color="#3b82f6" style={{ marginBottom: '8px' }} />
                    <div style={{ fontSize: '28px', fontWeight: 'bold' }}>{stats.active}</div>
                    <div style={{ color: '#666' }}>{t('crossdocking.aktivnyh_dostavok', 'Активных доставок')}</div>
                </div>
                <div className="card" style={{ padding: '20px', textAlign: 'center' }}>
                    <CheckCircle size={32} color="#10b981" style={{ marginBottom: '8px' }} />
                    <div style={{ fontSize: '28px', fontWeight: 'bold' }}>{stats.completed_today}</div>
                    <div style={{ color: '#666' }}>{t('crossdocking.zaversheno_segodnya', 'Завершено сегодня')}</div>
                </div>
                <div className="card" style={{ padding: '20px', textAlign: 'center' }}>
                    <Package size={32} color="#f59e0b" style={{ marginBottom: '8px' }} />
                    <div style={{ fontSize: '28px', fontWeight: 'bold' }}>{stats.items_today}</div>
                    <div style={{ color: '#666' }}>{t('crossdocking.edinits_tovara', 'Единиц товара')}</div>
                </div>
                <div className="card" style={{ padding: '20px', textAlign: 'center' }}>
                    <Clock size={32} color="#8b5cf6" style={{ marginBottom: '8px' }} />
                    <div style={{ fontSize: '28px', fontWeight: 'bold' }}>{stats.avg_time}</div>
                    <div style={{ color: '#666' }}>{t('crossdocking.srednee_vremya', 'Среднее время')}</div>
                </div>
            </div>

            {/* Список доставок */}
            <div className="card">
                <div style={{ padding: '16px', borderBottom: '1px solid var(--border-color)' }}>
                    <h3 style={{ margin: 0 }}>{t('crossdocking.tranzitnye_dostavki', '📦 Транзитные доставки')}</h3>
                </div>
                {loading ? (
                    <div style={{ padding: '40px', textAlign: 'center' }}>{t('crossdocking.zagruzka', 'Загрузка...')}</div>
                ) : (
                    <div style={{ padding: '16px', display: 'grid', gap: '16px' }}>
                        {transfers.map(transfer => {
                            const statusInfo = getStatusInfo(transfer.status);
                            const StatusIcon = statusInfo.icon;

                            return (
                                <div key={transfer.id} style={{
                                    border: '1px solid var(--border-color)',
                                    borderRadius: '12px',
                                    padding: '20px',
                                    borderLeft: `4px solid ${statusInfo.color}`
                                }}>
                                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '16px' }}>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '16px', flex: 1 }}>
                                            <div style={{ textAlign: 'center' }}>
                                                <div style={{ fontSize: '12px', color: '#888' }}>{t('crossdocking.ot', 'ОТ')}</div>
                                                <div style={{ fontWeight: 'bold' }}>{transfer.from_supplier}</div>
                                            </div>
                                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: statusInfo.color }}>
                                                <div style={{ width: '60px', height: '2px', background: statusInfo.color }} />
                                                <Truck size={24} />
                                                <div style={{ width: '60px', height: '2px', background: statusInfo.color }} />
                                                <ArrowRight size={20} />
                                            </div>
                                            <div style={{ textAlign: 'center' }}>
                                                <div style={{ fontSize: '12px', color: '#888' }}>В</div>
                                                <div style={{ fontWeight: 'bold' }}>{transfer.to_store}</div>
                                            </div>
                                        </div>
                                        <span style={{
                                            background: statusInfo.bg,
                                            color: statusInfo.color,
                                            padding: '6px 12px',
                                            borderRadius: '12px',
                                            fontSize: '13px',
                                            display: 'flex',
                                            alignItems: 'center',
                                            gap: '6px'
                                        }}>
                                            <StatusIcon size={14} /> {statusInfo.label}
                                        </span>
                                    </div>
                                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '16px' }}>
                                        <div>
                                            <div style={{ fontSize: '12px', color: '#888' }}>{t('crossdocking.tovarov', 'Товаров')}</div>
                                            <div style={{ fontWeight: 'bold' }}>{transfer.items_count} ед.</div>
                                        </div>
                                        <div>
                                            <div style={{ fontSize: '12px', color: '#888' }}>{t('crossdocking.summa', 'Сумма')}</div>
                                            <div style={{ fontWeight: 'bold' }}>{formatCurrency(transfer.total_value)}</div>
                                        </div>
                                        <div>
                                            <div style={{ fontSize: '12px', color: '#888' }}>{t('crossdocking.sozdano', 'Создано')}</div>
                                            <div>{formatDate(transfer.created_at)}</div>
                                        </div>
                                        <div>
                                            <div style={{ fontSize: '12px', color: '#888' }}>
                                                {transfer.status === 'completed' ? 'Завершено' : 'Ожидаемое время'}
                                            </div>
                                            <div style={{ fontWeight: 'bold', color: statusInfo.color }}>
                                                {transfer.status === 'completed' ? formatDate(transfer.completed_at) : formatDate(transfer.eta)}
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                )}
            </div>

            {/* Инструкция */}
            <div className="card" style={{ marginTop: '20px', padding: '20px', background: 'linear-gradient(135deg, #dbeafe 0%, #e0e7ff 100%)' }}>
                <h3 style={{ margin: '0 0 12px' }}>{t('crossdocking.kak_rabotaet_kross_doking', '💡 Как работает кросс-докинг')}</h3>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '16px' }}>
                    <div style={{ textAlign: 'center' }}>
                        <div style={{ fontSize: '32px', marginBottom: '8px' }}>1️⃣</div>
                        <div style={{ fontWeight: 500 }}>{t('crossdocking.zakaz_postavschiku', 'Заказ поставщику')}</div>
                        <div style={{ fontSize: '13px', color: '#666' }}>{t('crossdocking.sozdayotsya_zakaz_s_ukazaniem_magazina_naz', 'Создаётся заказ с указанием магазина назначения')}</div>
                    </div>
                    <div style={{ textAlign: 'center' }}>
                        <div style={{ fontSize: '32px', marginBottom: '8px' }}>2️⃣</div>
                        <div style={{ fontWeight: 500 }}>{t('crossdocking.dostavka_na_sklad', 'Доставка на склад')}</div>
                        <div style={{ fontSize: '13px', color: '#666' }}>{t('crossdocking.tovar_postupaet_na_promezhutochnyy_sklad', 'Товар поступает на промежуточный склад')}</div>
                    </div>
                    <div style={{ textAlign: 'center' }}>
                        <div style={{ fontSize: '32px', marginBottom: '8px' }}>3️⃣</div>
                        <div style={{ fontWeight: 500 }}>{t('crossdocking.sortirovka', 'Сортировка')}</div>
                        <div style={{ fontSize: '13px', color: '#666' }}>{t('crossdocking.tovar_sortiruetsya_bez_hraneniya', 'Товар сортируется без хранения')}</div>
                    </div>
                    <div style={{ textAlign: 'center' }}>
                        <div style={{ fontSize: '32px', marginBottom: '8px' }}>4️⃣</div>
                        <div style={{ fontWeight: 500 }}>{t('crossdocking.dostavka_v_magazin', 'Доставка в магазин')}</div>
                        <div style={{ fontSize: '13px', color: '#666' }}>{t('crossdocking.tovar_dostavlyaetsya_napryamuyu_v_magazin', 'Товар доставляется напрямую в магазин')}</div>
                    </div>
                </div>
            </div>
        </div>
    );
}

export default CrossDocking;
