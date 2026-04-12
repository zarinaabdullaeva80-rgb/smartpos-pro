import React, { useState, useEffect } from 'react';
import { Clock, TrendingUp, DollarSign, Package, Play, Square, Printer, X, Check } from 'lucide-react';
import { formatCurrency } from '../utils/formatters';
import api from '../services/api';
import ExportButton from '../components/ExportButton';
import { useI18n } from '../i18n';

function Shifts() {
    const { t } = useI18n();
    const [shifts, setShifts] = useState([]);
    const [loading, setLoading] = useState(true);
    const [selectedShift, setSelectedShift] = useState(null);
    const [stats, setStats] = useState(null);
    const [currentShift, setCurrentShift] = useState(null);
    const [showOpenModal, setShowOpenModal] = useState(false);
    const [showCloseModal, setShowCloseModal] = useState(false);
    const [openingCash, setOpeningCash] = useState('');
    const [closingCash, setClosingCash] = useState('');
    const [message, setMessage] = useState(null);

    useEffect(() => {
        loadShifts();
        checkCurrentShift();
    }, []);

    const loadShifts = async () => {
        try {
            const response = await api.get('/shifts');
            setShifts(response.data.shifts || []);
        } catch (error) {
            console.error('Ошибка загрузки смен:', error);
        } finally {
            setLoading(false);
        }
    };

    const checkCurrentShift = async () => {
        try {
            const response = await api.get('/shifts/current');
            if (response.data.shift) {
                setCurrentShift(response.data.shift);
            }
        } catch (error) {
            // No current shift or endpoint not implemented
            console.log('No current shift');
        }
    };

    const loadShiftStats = async (shiftId) => {
        try {
            const response = await api.get(`/shifts/${shiftId}/stats`);
            setStats(response.data.stats);
        } catch (error) {
            console.error('Ошибка загрузки статистики:', error);
        }
    };

    const handleViewShift = async (shift) => {
        setSelectedShift(shift);
        await loadShiftStats(shift.id);
    };

    const handleOpenShift = async () => {
        if (!openingCash || parseFloat(openingCash) < 0) {
            setMessage({ type: 'error', text: 'Введите начальную сумму в кассе' });
            return;
        }
        try {
            const response = await api.post('/shifts/open', {
                opening_cash: parseFloat(openingCash)
            });
            setCurrentShift(response.data.shift);
            setMessage({ type: 'success', text: 'Смена открыта успешно' });
            setShowOpenModal(false);
            setOpeningCash('');
            loadShifts();
        } catch (error) {
            console.error('Ошибка открытия смены:', error);
            setMessage({ type: 'error', text: error.response?.data?.error || 'Ошибка открытия смены' });
        }
    };

    const handleCloseShift = async () => {
        if (!currentShift || !currentShift.id) {
            setMessage({ type: 'error', text: 'Нет открытой смены' });
            return;
        }
        if (!closingCash || parseFloat(closingCash) < 0) {
            setMessage({ type: 'error', text: 'Введите конечную сумму в кассе' });
            return;
        }
        try {
            await api.post(`/shifts/${currentShift.id}/close`, {
                closing_cash: parseFloat(closingCash)
            });
            setMessage({ type: 'success', text: 'Смена закрыта. Z-отчёт сформирован.' });
            setCurrentShift(null);
            setShowCloseModal(false);
            setClosingCash('');
            loadShifts();
        } catch (error) {
            console.error('Ошибка закрытия смены:', error);
            setMessage({ type: 'error', text: error.response?.data?.error || 'Ошибка закрытия смены' });
        }
    };

    const handlePrintZReport = async (shiftId) => {
        try {
            // Get shift details first
            const shiftResponse = await api.get(`/shifts`);
            const shift = shiftResponse.data.shifts.find(s => s.id === shiftId);

            if (!shift) {
                throw new Error('Смена не найдена');
            }

            // Get shift statistics
            const statsResponse = await api.get(`/shifts/${shiftId}/stats`);
            const stats = statsResponse.data.stats;

            // Open print window with report data
            const printWindow = window.open('', '_blank');
            printWindow.document.write(`
                <html>
                <head>
                    <title>Z-отчёт #${shiftId}</title>
                    <style>
                        body { font-family: 'Courier New', monospace; padding: 20px; max-width: 400px; margin: 0 auto; }
                        h2 { text-align: center; border-bottom: 2px dashed #000; }
                        .row { display: flex; justify-content: space-between; margin: 8px 0; }
                        .divider { border-top: 1px dashed #000; margin: 15px 0; }
                        .total { font-size: 18px; font-weight: bold; }
                    </style>
                </head>
                <body>
                    <h2>Z-ОТЧЁТ #${shiftId}</h2>
                    <div class="row"><span>{t('shifts.data', 'Дата:')}</span><span>${new Date(shift.closed_at || shift.opened_at).toLocaleString('ru-RU')}</span></div>
                    <div class="row"><span>{t('shifts.kassir', 'Кассир:')}</span><span>${shift.username || 'N/A'}</span></div>
                    <div class="divider"></div>
                    <div class="row"><span>{t('shifts.otkrytie', 'Открытие:')}</span><span>${new Date(shift.opened_at).toLocaleString('ru-RU')}</span></div>
                    <div class="row"><span>{t('shifts.zakrytie', 'Закрытие:')}</span><span>${shift.closed_at ? new Date(shift.closed_at).toLocaleString('ru-RU') : '—'}</span></div>
                    <div class="divider"></div>
                    <div class="row"><span>{t('shifts.prodazh', 'Продаж:')}</span><span>${stats.salesCount || 0}</span></div>
                    <div class="row"><span>{t('shifts.vyruchka', 'Выручка:')}</span><span>${formatCurrency(stats.totalSales || 0)}</span></div>
                    <div class="row"><span>{t('shifts.nalichnye', 'Наличные:')}</span><span>${formatCurrency(stats.cashSales || 0)}</span></div>
                    <div class="row"><span>{t('shifts.beznalichnye', 'Безналичные:')}</span><span>${formatCurrency(stats.cardSales || 0)}</span></div>
                    <div class="row"><span>{t('shifts.vozvraty', 'Возвраты:')}</span><span>${formatCurrency(stats.totalReturns || 0)}</span></div>
                    <div class="divider"></div>
                    <div class="row"><span>{t('shifts.nachalnaya_summa', 'Начальная сумма:')}</span><span>${formatCurrency(shift.opening_cash || 0)}</span></div>
                    <div class="row"><span>{t('shifts.konechnaya_summa', 'Конечная сумма:')}</span><span>${formatCurrency(shift.closing_cash || 0)}</span></div>
                    <div class="divider"></div>
                    <div class="row total"><span>{t('shifts.itogo', 'ИТОГО:')}</span><span>${formatCurrency(stats.netSales || 0)}</span></div>
                </body>
                </html>
            `);
            printWindow.document.close();
            setTimeout(() => {
                printWindow.print();
            }, 250);
        } catch (error) {
            console.error('Ошибка печати Z-отчёта:', error);
            setMessage({ type: 'error', text: error.message || 'Ошибка печати Z-отчёта' });
        }
    };

    const formatDuration = (open, close) => {
        const start = new Date(open);
        const end = close ? new Date(close) : new Date();
        const diff = end - start;
        const hours = Math.floor(diff / (1000 * 60 * 60));
        const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
        return `${hours}ч ${minutes}м`;
    };

    const getStatusBadge = (status) => {
        return status === 'open'
            ? <span className="badge badge-success">{t('shifts.otkryta', 'Открыта')}</span>
            : <span className="badge badge-secondary">{t('shifts.zakryta', 'Закрыта')}</span>;
    };

    return (
        <div className="shifts-page fade-in">
            <div className="page-header">
                <div>
                    <h1>{t('shifts.smeny_kassirov', 'Смены кассиров')}</h1>
                    <p className="text-muted">{t('shifts.istoriya_raboty_kassy', 'История работы кассы')}</p>
                </div>
                <div style={{ display: 'flex', gap: '10px' }}>
                    <ExportButton
                        data={shifts}
                        filename="Смены"
                        sheetName="Смены"
                        folder="shifts"
                        columns={{
                            username: 'Кассир',
                            opened_at: 'Открыта',
                            closed_at: 'Закрыта',
                            sales_count: 'Продаж',
                            total_sales: 'Выручка',
                            opening_cash: 'Нач. сумма',
                            closing_cash: 'Кон. сумма',
                            status: 'Статус'
                        }}
                    />
                    <button
                        className="btn btn-secondary"
                        onClick={() => loadShifts()}
                        title={t('shifts.obnovit_spisok', 'Обновить список')}
                    >
                        🔄 Обновить
                    </button>
                    {currentShift ? (
                        <button
                            className="btn btn-danger"
                            onClick={() => setShowCloseModal(true)}
                        >
                            <Square size={18} /> Закрыть смену
                        </button>
                    ) : (
                        <button
                            className="btn btn-primary"
                            onClick={() => setShowOpenModal(true)}
                        >
                            <Play size={18} /> Открыть смену
                        </button>
                    )}
                </div>
            </div>

            {message && (
                <div className={`alert ${message.type === 'success' ? 'alert-success' : 'alert-danger'}`} style={{ marginBottom: '16px' }}>
                    {message.type === 'success' ? <Check size={18} /> : <X size={18} />}
                    {message.text}
                    <button onClick={() => setMessage(null)} style={{ marginLeft: 'auto', background: 'none', border: 'none', cursor: 'pointer', color: 'inherit' }}>
                        <X size={16} />
                    </button>
                </div>
            )}

            {/* Текущая смена */}
            {currentShift && (
                <div className="card" style={{ marginBottom: '20px', background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)', color: 'white' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <div>
                            <h3 style={{ margin: 0 }}>{t('shifts.smena_otkryta', '🟢 Смена открыта')}</h3>
                            <p style={{ margin: '8px 0 0', opacity: 0.9 }}>
                                Начало: {new Date(currentShift.opened_at).toLocaleString('ru-RU')} |
                                Длительность: {formatDuration(currentShift.opened_at, null)}
                            </p>
                        </div>
                        <div style={{ textAlign: 'right' }}>
                            <div style={{ fontSize: '24px', fontWeight: 'bold' }}>
                                {formatCurrency(currentShift.total_sales || 0)}
                            </div>
                            <div style={{ opacity: 0.8, fontSize: '14px' }}>
                                Продаж: {currentShift.sales_count || 0}
                            </div>
                        </div>
                    </div>
                </div>
            )}

            <div className="card">
                {loading ? (
                    <div className="loading-container">
                        <div className="spinner"></div>
                    </div>
                ) : shifts.length === 0 ? (
                    <div className="empty-state">
                        <Clock size={64} className="text-muted" />
                        <h3>{t('shifts.smeny_ne_naydeny', 'Смены не найдены')}</h3>
                        <p className="text-muted">{t('shifts.otkroyte_pervuyu_smenu_chtoby_nachat_rabo', 'Откройте первую смену, чтобы начать работу')}</p>
                    </div>
                ) : (
                    <table>
                        <thead>
                            <tr>
                                <th>Кассир</th>
                                <th>{t('shifts.otkryta', 'Открыта')}</th>
                                <th>{t('shifts.zakryta', 'Закрыта')}</th>
                                <th>{t('shifts.dlitelnost', 'Длительность')}</th>
                                <th>{t('shifts.prodazh', 'Продаж')}</th>
                                <th>{t('shifts.vyruchka', 'Выручка')}</th>
                                <th>{t('shifts.status', 'Статус')}</th>
                                <th>{t('shifts.deystviya', 'Действия')}</th>
                            </tr>
                        </thead>
                        <tbody>
                            {shifts.map((shift) => (
                                <tr key={shift.id}>
                                    <td>{shift.username || 'Не указан'}</td>
                                    <td>{new Date(shift.opened_at).toLocaleString('ru-RU')}</td>
                                    <td>{shift.closed_at ? new Date(shift.closed_at).toLocaleString('ru-RU') : '—'}</td>
                                    <td>{formatDuration(shift.opened_at, shift.closed_at)}</td>
                                    <td><strong>{shift.sales_count || 0}</strong></td>
                                    <td><strong>{formatCurrency(shift.total_sales || 0)}</strong></td>
                                    <td>{getStatusBadge(shift.status)}</td>
                                    <td>
                                        <div style={{ display: 'flex', gap: '8px' }}>
                                            <button
                                                className="btn btn-primary btn-sm"
                                                onClick={() => handleViewShift(shift)}
                                                title={t('shifts.prosmotr_detalno', 'Просмотр детально')}
                                            >
                                                👁️ Детали
                                            </button>
                                            {shift.status === 'closed' && (
                                                <button
                                                    className="btn btn-secondary btn-sm"
                                                    onClick={() => handlePrintZReport(shift.id)}
                                                    title={t('shifts.pechat_otchyota', 'Печать Z-отчёта')}
                                                >
                                                    <Printer size={14} />
                                                </button>
                                            )}
                                        </div>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                )}
            </div>

            {/* Open Shift Modal */}
            {showOpenModal && (
                <div className="modal-overlay" onClick={() => setShowOpenModal(false)}>
                    <div className="modal-content" onClick={e => e.stopPropagation()} style={{ maxWidth: '400px' }}>
                        <div className="modal-header">
                            <h2>{t('shifts.otkrytie_smeny', 'Открытие смены')}</h2>
                            <button onClick={() => setShowOpenModal(false)} className="btn-close">×</button>
                        </div>
                        <div className="modal-body">
                            <div className="form-group">
                                <label>{t('shifts.nachalnaya_summa_v_kasse', 'Начальная сумма в кассе')}</label>
                                <input
                                    type="number"
                                    value={openingCash}
                                    onChange={e => setOpeningCash(e.target.value)}
                                    placeholder="0"
                                    autoFocus
                                />
                            </div>
                        </div>
                        <div className="modal-footer">
                            <button onClick={() => setShowOpenModal(false)} className="btn btn-secondary">{t('shifts.otmena', 'Отмена')}</button>
                            <button onClick={handleOpenShift} className="btn btn-primary">
                                <Play size={16} /> Открыть смену
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Close Shift Modal */}
            {showCloseModal && (
                <div className="modal-overlay" onClick={() => setShowCloseModal(false)}>
                    <div className="modal-content" onClick={e => e.stopPropagation()} style={{ maxWidth: '400px' }}>
                        <div className="modal-header">
                            <h2>{t('shifts.zakrytie_smeny', 'Закрытие смены')}</h2>
                            <button onClick={() => setShowCloseModal(false)} className="btn-close">×</button>
                        </div>
                        <div className="modal-body">
                            {currentShift && (
                                <div style={{ marginBottom: '20px', padding: '16px', background: 'var(--color-bg-tertiary)', borderRadius: '8px' }}>
                                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
                                        <span>{t('shifts.vyruchka_za_smenu', 'Выручка за смену:')}</span>
                                        <strong>{formatCurrency(currentShift.total_sales || 0)}</strong>
                                    </div>
                                    <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                                        <span>{t('shifts.kolichestvo_prodazh', 'Количество продаж:')}</span>
                                        <strong>{currentShift.sales_count || 0}</strong>
                                    </div>
                                </div>
                            )}
                            <div className="form-group">
                                <label>{t('shifts.konechnaya_summa_v_kasse_podschitayte_nali', 'Конечная сумма в кассе (подсчитайте наличные)')}</label>
                                <input
                                    type="number"
                                    value={closingCash}
                                    onChange={e => setClosingCash(e.target.value)}
                                    placeholder="0"
                                    min="0"
                                    step="0.01"
                                    disabled={false}
                                    autoFocus
                                    style={{ cursor: 'text' }}
                                />
                            </div>
                        </div>
                        <div className="modal-footer">
                            <button onClick={() => setShowCloseModal(false)} className="btn btn-secondary">{t('shifts.otmena', 'Отмена')}</button>
                            <button onClick={handleCloseShift} className="btn btn-danger">
                                <Square size={16} /> Закрыть смену
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Modal с деталями смены */}
            {selectedShift && (
                <div className="modal-overlay" onClick={() => setSelectedShift(null)}>
                    <div className="modal-content" onClick={e => e.stopPropagation()} style={{ maxWidth: '800px' }}>
                        <div className="modal-header">
                            <h2>Детали смены #{selectedShift.id}</h2>
                            <button onClick={() => setSelectedShift(null)} className="btn-close">×</button>
                        </div>

                        <div className="modal-body">
                            {/* Основная информация */}
                            <div className="info-grid" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px', marginBottom: '20px' }}>
                                <div>
                                    <label className="text-muted">Кассир</label>
                                    <p><strong>{selectedShift.username}</strong></p>
                                </div>
                                <div>
                                    <label className="text-muted">{t('shifts.status', 'Статус')}</label>
                                    <p>{getStatusBadge(selectedShift.status)}</p>
                                </div>
                                <div>
                                    <label className="text-muted">{t('shifts.otkryta', 'Открыта')}</label>
                                    <p>{new Date(selectedShift.opened_at).toLocaleString('ru-RU')}</p>
                                </div>
                                <div>
                                    <label className="text-muted">{t('shifts.zakryta', 'Закрыта')}</label>
                                    <p>{selectedShift.closed_at ? new Date(selectedShift.closed_at).toLocaleString('ru-RU') : '—'}</p>
                                </div>
                                <div>
                                    <label className="text-muted">{t('shifts.nachalnaya_summa', 'Начальная сумма')}</label>
                                    <p><strong>{formatCurrency(selectedShift.opening_cash || 0)}</strong></p>
                                </div>
                                <div>
                                    <label className="text-muted">{t('shifts.konechnaya_summa', 'Конечная сумма')}</label>
                                    <p><strong>{formatCurrency(selectedShift.closing_cash || 0)}</strong></p>
                                </div>
                            </div>

                            {/* Статистика продаж */}
                            {stats && (
                                <>
                                    <h3 style={{ marginTop: '20px' }}>{t('shifts.statistika_prodazh', 'Статистика продаж')}</h3>
                                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '15px', marginTop: '15px' }}>
                                        <div className="stat-card">
                                            <div className="stat-icon" style={{ background: '#3b82f6' }}>
                                                <TrendingUp size={24} />
                                            </div>
                                            <div className="stat-content">
                                                <div className="stat-value">{stats.salesCount || 0}</div>
                                                <div className="stat-label">{t('shifts.prodazh', 'Продаж')}</div>
                                            </div>
                                        </div>
                                        <div className="stat-card">
                                            <div className="stat-icon" style={{ background: '#10b981' }}>
                                                <DollarSign size={24} />
                                            </div>
                                            <div className="stat-content">
                                                <div className="stat-value">{formatCurrency(stats.totalSales || 0)}</div>
                                                <div className="stat-label">{t('shifts.vyruchka', 'Выручка')}</div>
                                            </div>
                                        </div>
                                        <div className="stat-card">
                                            <div className="stat-icon" style={{ background: '#f59e0b' }}>
                                                <Package size={24} />
                                            </div>
                                            <div className="stat-content">
                                                <div className="stat-value">{formatCurrency(stats.averageCheck || 0)}</div>
                                                <div className="stat-label">{t('shifts.sredniy_chek', 'Средний чек')}</div>
                                            </div>
                                        </div>
                                    </div>

                                    {/* Топ товаров */}
                                    {stats.topProducts && stats.topProducts.length > 0 && (
                                        <div style={{ marginTop: '20px' }}>
                                            <h4>{t('shifts.top_tovarov', 'Топ товаров')}</h4>
                                            <table style={{ marginTop: '10px' }}>
                                                <thead>
                                                    <tr>
                                                        <th>{t('shifts.nazvanie', 'Название')}</th>
                                                        <th style={{ textAlign: 'right' }}>{t('shifts.kolichestvo', 'Количество')}</th>
                                                    </tr>
                                                </thead>
                                                <tbody>
                                                    {stats.topProducts.map((product, idx) => (
                                                        <tr key={idx}>
                                                            <td>{product.name}</td>
                                                            <td style={{ textAlign: 'right' }}><strong>{Math.round(product.count)}</strong></td>
                                                        </tr>
                                                    ))}
                                                </tbody>
                                            </table>
                                        </div>
                                    )}
                                </>
                            )}

                            {selectedShift.notes && (
                                <div style={{ marginTop: '20px' }}>
                                    <label className="text-muted">{t('shifts.primechaniya', 'Примечания')}</label>
                                    <p>{selectedShift.notes}</p>
                                </div>
                            )}
                        </div>

                        <div className="modal-footer">
                            {selectedShift.status === 'closed' && (
                                <button onClick={() => handlePrintZReport(selectedShift.id)} className="btn btn-info">
                                    <Printer size={16} /> Печать Z-отчёта
                                </button>
                            )}
                            <button onClick={() => setSelectedShift(null)} className="btn btn-secondary">{t('shifts.zakryt', 'Закрыть')}</button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}

export default Shifts;
