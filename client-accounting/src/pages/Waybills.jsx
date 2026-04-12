import React, { useState, useEffect } from 'react';
import { FileText, Plus, Search, Printer, Download, Truck, Package, Check, Clock, ArrowRight, ArrowLeft, X } from 'lucide-react';
import useActionHandler from '../hooks/useActionHandler';
import { deliveriesAPI,  salesAPI } from '../services/api';
import { useI18n } from '../i18n';

function WaybillsPage() {
    const { t } = useI18n();
    const [waybills, setWaybills] = useState([]);
    const [loading, setLoading] = useState(true);
    const [showModal, setShowModal] = useState(null); // 'in' or 'out'
    const [newWaybill, setNewWaybill] = useState({
        counterparty: '',
        driver: ''
    });

    const { handleSuccess, handleError, handlePrint, handleExport } = useActionHandler();

    useEffect(() => { loadData(); }, []);

    const loadData = async () => {
        try {
            const apiRes = await salesAPI.getAll();
            const apiData = apiRes.data || apiRes;
            console.log('Waybills.jsx: данные загружены с сервера', apiData);
        } catch (err) {
            console.warn('Waybills: не удалось загрузить данные', err.message);
        }
        setLoading(false);
    };

    const formatCurrency = (value) => new Intl.NumberFormat('ru-RU').format(value || 0) + " so'm";

    const getStatusInfo = (status) => {
        const statuses = {
            pending: { label: 'Ожидает', color: '#f59e0b', bg: '#fef3c7' },
            signed: { label: 'Подписана', color: '#3b82f6', bg: '#dbeafe' },
            delivered: { label: 'Доставлена', color: '#10b981', bg: '#dcfce7' },
            received: { label: 'Принята', color: '#10b981', bg: '#dcfce7' }
        };
        return statuses[status] || statuses.pending;
    };

    // Action handlers
    const handleCreateWaybill = (type) => {
        setShowModal(type); // 'in' for incoming, 'out' for outgoing
    };

    const handleSaveWaybill = () => {
        if (!newWaybill.counterparty) {
            handleError('Укажите контрагента');
            return;
        }
        const type = showModal;
        const prefix = type === 'in' ? 'ПН' : 'РН';
        const newId = `${prefix}-${String(waybills.length + 50).padStart(3, '0')}`;
        const waybill = {
            id: newId,
            date: new Date().toISOString().split('T')[0],
            type: type,
            counterparty: newWaybill.counterparty,
            items: 0,
            total: 0,
            status: 'pending',
            driver: newWaybill.driver || null
        };
        setWaybills([waybill, ...waybills]);
        setShowModal(null);
        setNewWaybill({ counterparty: '', driver: '' });
        handleSuccess(`${type === 'in' ? 'Приходная' : 'Расходная'} накладная ${newId} создана`);
    };

    const handlePrintWaybill = (wb) => {
        const printContent = `
            <div style="font-family: Arial; padding: 20px;">
                <h1>Накладная ${wb.id}</h1>
                <p><strong>{t('waybills.tip', 'Тип:')}</strong> ${wb.type === 'in' ? 'Приходная' : 'Расходная'}</p>
                <p><strong>{t('waybills.data', 'Дата:')}</strong> ${wb.date}</p>
                <p><strong>{t('waybills.kontragent', 'Контрагент:')}</strong> ${wb.counterparty}</p>
                <p><strong>{t('waybills.pozitsiy', 'Позиций:')}</strong> ${wb.items}</p>
                <p><strong>{t('waybills.summa', 'Сумма:')}</strong> ${formatCurrency(wb.total)}</p>
                ${wb.driver ? `<p><strong>{t('waybills.voditel', 'Водитель:')}</strong> ${wb.driver}</p>` : ''}
            </div>
        `;
        handlePrint(printContent, { title: `Накладная ${wb.id}` });
    };

    const handleDownloadWaybill = (wb) => {
        handleExport(wb, `waybill_${wb.id}.json`);
        handleSuccess(`Накладная ${wb.id} скачана`);
    };

    return (
        <div className="waybills-page fade-in">
            <div className="page-header">
                <div>
                    <h1>{t('waybills.nakladnye', '📄 Накладные')}</h1>
                    <p className="text-muted">{t('waybills.torg_prihodnye_i_rashodnye_nakladnye', 'ТОРГ-12, приходные и расходные накладные')}</p>
                </div>
                <div style={{ display: 'flex', gap: '12px' }}>
                    <button className="btn btn-secondary" onClick={() => handleCreateWaybill('in')}>
                        <ArrowLeft size={18} /> Приходная
                    </button>
                    <button className="btn btn-primary" onClick={() => handleCreateWaybill('out')}>
                        <ArrowRight size={18} /> Расходная
                    </button>
                </div>
            </div>

            {/* Фильтры */}
            <div className="card" style={{ marginBottom: '20px', padding: '16px' }}>
                <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
                    <select>
                        <option>{t('waybills.vse_tipy', 'Все типы')}</option>
                        <option>{t('waybills.prihodnye', 'Приходные')}</option>
                        <option>{t('waybills.rashodnye', 'Расходные')}</option>
                    </select>
                    <select>
                        <option>{t('waybills.vse_statusy', 'Все статусы')}</option>
                        <option>Ожидает</option>
                        <option>Подписана</option>
                        <option>Доставлена</option>
                    </select>
                    <div style={{ position: 'relative', flex: 1 }}>
                        <Search size={18} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: '#888' }} />
                        <input type="text" placeholder="Поиск по номеру или контрагенту..." style={{ paddingLeft: '40px', width: '100%' }} />
                    </div>
                    <input type="date" defaultValue="2026-01-01" />
                    <input type="date" defaultValue="2026-01-16" />
                </div>
            </div>

            {/* Таблица */}
            <div className="card">
                {loading ? (
                    <div style={{ padding: '40px', textAlign: 'center' }}>{t('waybills.zagruzka', 'Загрузка...')}</div>
                ) : (
                    <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                        <thead>
                            <tr style={{ background: 'var(--bg-secondary)' }}>
                                <th style={{ padding: '12px', textAlign: 'left' }}>{t('waybills.num_nakladnoy', '№ Накладной')}</th>
                                <th style={{ padding: '12px', textAlign: 'center' }}>{t('waybills.tip', 'Тип')}</th>
                                <th style={{ padding: '12px', textAlign: 'left' }}>{t('waybills.data', 'Дата')}</th>
                                <th style={{ padding: '12px', textAlign: 'left' }}>{t('waybills.kontragent', 'Контрагент')}</th>
                                <th style={{ padding: '12px', textAlign: 'center' }}>{t('waybills.pozitsiy', 'Позиций')}</th>
                                <th style={{ padding: '12px', textAlign: 'right' }}>{t('waybills.summa', 'Сумма')}</th>
                                <th style={{ padding: '12px', textAlign: 'center' }}>{t('waybills.status', 'Статус')}</th>
                                <th style={{ padding: '12px', textAlign: 'center' }}>{t('waybills.deystviya', 'Действия')}</th>
                            </tr>
                        </thead>
                        <tbody>
                            {waybills.map(wb => {
                                const statusInfo = getStatusInfo(wb.status);

                                return (
                                    <tr key={wb.id} style={{ borderBottom: '1px solid var(--border-color)' }}>
                                        <td style={{ padding: '12px' }}>
                                            <span style={{
                                                fontWeight: 500,
                                                color: 'var(--primary)'
                                            }}>
                                                {wb.id}
                                            </span>
                                        </td>
                                        <td style={{ padding: '12px', textAlign: 'center' }}>
                                            {wb.type === 'in' ? (
                                                <span style={{
                                                    background: '#dcfce7',
                                                    color: '#10b981',
                                                    padding: '4px 8px',
                                                    borderRadius: '6px',
                                                    fontSize: '12px',
                                                    display: 'inline-flex',
                                                    alignItems: 'center',
                                                    gap: '4px'
                                                }}>
                                                    <ArrowLeft size={12} /> Приход
                                                </span>
                                            ) : (
                                                <span style={{
                                                    background: '#dbeafe',
                                                    color: '#3b82f6',
                                                    padding: '4px 8px',
                                                    borderRadius: '6px',
                                                    fontSize: '12px',
                                                    display: 'inline-flex',
                                                    alignItems: 'center',
                                                    gap: '4px'
                                                }}>
                                                    <ArrowRight size={12} /> Расход
                                                </span>
                                            )}
                                        </td>
                                        <td style={{ padding: '12px' }}>{wb.date}</td>
                                        <td style={{ padding: '12px' }}>
                                            <div style={{ fontWeight: 500 }}>{wb.counterparty}</div>
                                            {wb.driver && (
                                                <div style={{ fontSize: '12px', color: '#888' }}>
                                                    <Truck size={12} style={{ marginRight: '4px' }} />{wb.driver}
                                                </div>
                                            )}
                                        </td>
                                        <td style={{ padding: '12px', textAlign: 'center' }}>{wb.items}</td>
                                        <td style={{ padding: '12px', textAlign: 'right', fontWeight: 'bold' }}>{formatCurrency(wb.total)}</td>
                                        <td style={{ padding: '12px', textAlign: 'center' }}>
                                            <span style={{
                                                background: statusInfo.bg,
                                                color: statusInfo.color,
                                                padding: '4px 12px',
                                                borderRadius: '12px',
                                                fontSize: '12px'
                                            }}>
                                                {statusInfo.label}
                                            </span>
                                        </td>
                                        <td style={{ padding: '12px', textAlign: 'center' }}>
                                            <div style={{ display: 'flex', gap: '4px', justifyContent: 'center' }}>
                                                <button className="btn btn-sm btn-secondary" title={t('waybills.pechat', 'Печать')} onClick={() => handlePrintWaybill(wb)}>
                                                    <Printer size={14} />
                                                </button>
                                                <button className="btn btn-sm btn-secondary" title={t('waybills.skachat', 'Скачать')} onClick={() => handleDownloadWaybill(wb)}>
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

            {/* Modal для создания накладной */}
            {showModal && (
                <div className="modal-overlay" style={{
                    position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
                    background: 'rgba(0,0,0,0.5)', display: 'flex',
                    alignItems: 'center', justifyContent: 'center', zIndex: 1000
                }}>
                    <div className="modal-content" style={{
                        background: 'var(--bg-primary)', borderRadius: '12px',
                        padding: '24px', width: '500px', maxWidth: '90vw'
                    }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '20px' }}>
                            <h2>{showModal === 'in' ? 'Приходная' : 'Расходная'} накладная</h2>
                            <button className="btn btn-secondary" onClick={() => setShowModal(null)}>
                                <X size={18} />
                            </button>
                        </div>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                            <div>
                                <label style={{ display: 'block', marginBottom: '6px', fontWeight: 500 }}>
                                    {showModal === 'in' ? 'Поставщик' : 'Получатель'}
                                </label>
                                <input
                                    type="text"
                                    value={newWaybill.counterparty}
                                    onChange={(e) => setNewWaybill({ ...newWaybill, counterparty: e.target.value })}
                                    placeholder="Введите название контрагента"
                                    style={{ width: '100%', padding: '10px', borderRadius: '8px', border: '1px solid var(--border-color)' }}
                                />
                            </div>
                            {showModal === 'out' && (
                                <div>
                                    <label style={{ display: 'block', marginBottom: '6px', fontWeight: 500 }}>{t('waybills.voditel', 'Водитель')}</label>
                                    <input
                                        type="text"
                                        value={newWaybill.driver}
                                        onChange={(e) => setNewWaybill({ ...newWaybill, driver: e.target.value })}
                                        placeholder="ФИО водителя (необязательно)"
                                        style={{ width: '100%', padding: '10px', borderRadius: '8px', border: '1px solid var(--border-color)' }}
                                    />
                                </div>
                            )}
                            <div style={{ display: 'flex', gap: '12px', justifyContent: 'flex-end', marginTop: '12px' }}>
                                <button className="btn btn-secondary" onClick={() => setShowModal(null)}>{t('waybills.otmena', 'Отмена')}</button>
                                <button className="btn btn-primary" onClick={handleSaveWaybill}>
                                    {showModal === 'in' ? <ArrowLeft size={16} /> : <ArrowRight size={16} />}
                                    Создать накладную
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}

export default WaybillsPage;
