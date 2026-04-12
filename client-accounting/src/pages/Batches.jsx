import React, { useState, useEffect } from 'react';
import { Package, AlertCircle, Calendar, MapPin } from 'lucide-react';
import '../styles/Common.css';
import { batchesAPI } from '../services/api';
import { useI18n } from '../i18n';

const Batches = () => {
    const { t } = useI18n();
    const [batches, setBatches] = useState([]);
    const [expiringBatches, setExpiringBatches] = useState([]);
    const [products, setProducts] = useState([]);
    const [filter, setFilter] = useState({ status: 'active', expiring_days: null });
    const [loading, setLoading] = useState(false);

    useEffect(() => {
        loadBatches();
        loadExpiringBatches();
    }, [filter]);

    const loadBatches = async () => {
        setLoading(true);
        try {
            const params = {
                status: filter.status || undefined,
                product_id: filter.product_id || undefined
            };
            const response = await batchesAPI.getAll(params);
            setBatches(response.data?.batches || response.data || []);
        } catch (error) {
            console.error('Error loading batches:', error);
            setBatches([]);
        } finally {
            setLoading(false);
        }
    };

    const loadExpiringBatches = async () => {
        try {
            const response = await batchesAPI.getExpiring(30);
            setExpiringBatches(response.data?.batches || response.data || []);
        } catch (error) {
            console.error('Error loading expiring batches:', error);
        }
    };

    const getExpiryColor = (expiryStatus) => {
        const colors = {
            'Просрочено': '#dc3545',
            'Критично (< 7 дней)': '#dc3545',
            'Предупреждение (< 30 дней)': '#ffc107',
            'Нормально': '#28a745'
        };
        return colors[expiryStatus] || '#6c757d';
    };

    const getDaysUntilExpiry = (expiryDate) => {
        if (!expiryDate) return null;
        const days = Math.ceil((new Date(expiryDate) - new Date()) / (1000 * 60 * 60 * 24));
        return days;
    };

    return (
        <div className="page-container fade-in">
            <div className="page-header">
                <div>
                    <h1><Package size={32} /> {t('batches.partionnyy_uchyot', 'Партионный учёт')}</h1>
                    <p>{t('batches.upravlenie_partiyami_tovarov_i_kontrol_s', 'Управление партиями товаров и контроль сроков годности')}</p>
                </div>
            </div>

            {/* Предупреждения об истекающих сроках */}
            {expiringBatches.length > 0 && (
                <div className="alert alert-warning">
                    <AlertCircle size={24} />
                    <div>
                        <strong>{t('batches.vnimanie_istekayuschie_sroki_godnosti', 'Внимание! Истекающие сроки годности')}</strong>
                        <p>{expiringBatches.length} партий требуют внимания в ближайшие 30 дней</p>
                    </div>
                </div>
            )}

            {/* Фильтры */}
            <div className="card filters">
                <div className="filter-group">
                    <label>{t('batches.status', 'Статус:')}</label>
                    <select
                        value={filter.status}
                        onChange={e => setFilter({ ...filter, status: e.target.value })}
                    >
                        <option value="">{t('batches.vse', 'Все')}</option>
                        <option value="active">{t('batches.aktivnye', 'Активные')}</option>
                        <option value="sold_out">{t('batches.rasprodany', 'Распроданы')}</option>
                        <option value="expired">{t('batches.prosrocheny', 'Просрочены')}</option>
                    </select>
                </div>
            </div>

            {/* Таблица партий */}
            <div className="card">
                <h3>{t('batches.partii_tovarov', 'Партии товаров')}</h3>
                {loading && <div>{t('batches.zagruzka', 'Загрузка...')}</div>}
                <table className="data-table">
                    <thead>
                        <tr>
                            <th>{t('batches.num_partii', '№ Партии')}</th>
                            <th>{t('batches.tovar', 'Товар')}</th>
                            <th>{t('batches.artikul', 'Артикул')}</th>
                            <th>{t('batches.nachalnoe_kol_vo', 'Начальное кол-во')}</th>
                            <th>{t('batches.ostatok', 'Остаток')}</th>
                            <th>{t('batches.tsena_zakupki', 'Цена закупки')}</th>
                            <th>{t('batches.stoimost_ostatka', 'Стоимость остатка')}</th>
                            <th>{t('batches.data_proizvodstva', 'Дата производства')}</th>
                            <th>{t('batches.srok_godnosti', 'Срок годности')}</th>
                            <th>{t('batches.status_sroka', 'Статус срока')}</th>
                            <th>{t('batches.sklad', 'Склад')}</th>
                            <th>{t('batches.postavschik', 'Поставщик')}</th>
                        </tr>
                    </thead>
                    <tbody>
                        {batches.map(batch => {
                            const daysLeft = getDaysUntilExpiry(batch.expiry_date);
                            return (
                                <tr key={batch.id}>
                                    <td>
                                        <strong>{batch.batch_number}</strong>
                                        {batch.batch_barcode && (
                                            <div className="barcode-small">{batch.batch_barcode}</div>
                                        )}
                                    </td>
                                    <td>{batch.product_name}</td>
                                    <td>{batch.sku}</td>
                                    <td>{batch.initial_quantity}</td>
                                    <td><strong>{batch.remaining_quantity}</strong></td>
                                    <td>{parseFloat(batch.purchase_price).toFixed(2)} ₽</td>
                                    <td><strong>{parseFloat(batch.total_value).toFixed(2)} ₽</strong></td>
                                    <td>
                                        {batch.production_date ? (
                                            <div className="date-cell">
                                                <Calendar size={14} />
                                                {new Date(batch.production_date).toLocaleDateString()}
                                            </div>
                                        ) : '-'}
                                    </td>
                                    <td>
                                        {batch.expiry_date ? (
                                            <div className="date-cell">
                                                <Calendar size={14} />
                                                {new Date(batch.expiry_date).toLocaleDateString()}
                                                {daysLeft !== null && daysLeft >= 0 && (
                                                    <div className="days-left">Осталось: {daysLeft} дн.</div>
                                                )}
                                            </div>
                                        ) : '-'}
                                    </td>
                                    <td>
                                        {batch.expiry_status && (
                                            <span
                                                className="badge"
                                                style={{ background: getExpiryColor(batch.expiry_status) }}
                                            >
                                                {batch.expiry_status}
                                            </span>
                                        )}
                                    </td>
                                    <td>
                                        {batch.warehouse_name && (
                                            <div className="location-cell">
                                                <MapPin size={14} />
                                                {batch.warehouse_name}
                                            </div>
                                        )}
                                    </td>
                                    <td>{batch.supplier_name || '-'}</td>
                                </tr>
                            );
                        })}
                    </tbody>
                </table>
            </div>

            {/* Таблица истекающих партий */}
            {expiringBatches.length > 0 && (
                <div className="card expiring-batches">
                    <h3>{t('batches.istekayuschie_sroki_godnosti_dney', '⚠️ Истекающие сроки годности (30 дней)')}</h3>
                    <table className="data-table">
                        <thead>
                            <tr>
                                <th>{t('batches.num_partii', '№ Партии')}</th>
                                <th>{t('batches.tovar', 'Товар')}</th>
                                <th>{t('batches.ostatok', 'Остаток')}</th>
                                <th>{t('batches.srok_godnosti', 'Срок годности')}</th>
                                <th>{t('batches.dney_do_istecheniya', 'Дней до истечения')}</th>
                            </tr>
                        </thead>
                        <tbody>
                            {expiringBatches.map(batch => (
                                <tr key={batch.batch_id} className="expiring-row">
                                    <td><strong>{batch.batch_number}</strong></td>
                                    <td>{batch.product_name}</td>
                                    <td><strong>{batch.remaining_quantity}</strong></td>
                                    <td>{new Date(batch.expiry_date).toLocaleDateString()}</td>
                                    <td>
                                        <span
                                            className="badge"
                                            style={{
                                                background: batch.days_until_expiry <= 7 ? '#dc3545' : '#ffc107'
                                            }}
                                        >
                                            {batch.days_until_expiry} дней
                                        </span>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            )}

            <style jsx>{`
                .alert {
                    display: flex;
                    align-items: center;
                    gap: 15px;
                    padding: 15px 20px;
                    border-radius: 8px;
                    margin-bottom: 20px;
                }

                .alert-warning {
                    background: rgba(255, 193, 7, 0.1);
                    border: 1px solid #ffc107;
                    color: #ffc107;
                }

                .filters {
                    display: flex;
                    gap: 15px;
                    margin-bottom: 20px;
                    padding: 15px;
                }

                .filter-group {
                    display: flex;
                    align-items: center;
                    gap: 10px;
                }

                .filter-group label {
                    font-weight: 500;
                }

                .barcode-small {
                    font-size: 11px;
                    font-family: monospace;
                    color: var(--primary-color);
                    margin-top: 4px;
                }

                .date-cell {
                    display: flex;
                    align-items: center;
                    gap: 6px;
                }

                .days-left {
                    font-size: 11px;
                    opacity: 0.7;
                    margin-top: 2px;
                }

                .location-cell {
                    display: flex;
                    align-items: center;
                    gap: 6px;
                }

                .expiring-batches {
                    border: 2px solid #ffc107;
                }

                .expiring-row {
                    background: rgba(255, 193, 7, 0.05);
                }
            `}</style>
        </div>
    );
};

export default Batches;
