import React, { useState, useEffect } from 'react';
import { Split, Users, CreditCard, DollarSign, Calculator, Check, X } from 'lucide-react';
import { financeAPI } from '../services/api';
import { useToast } from '../components/ToastProvider';
import { useI18n } from '../i18n';

function SplitPayments() {
    const { t } = useI18n();
    const toast = useToast();
    const [pendingSplits, setPendingSplits] = useState([]);
    const [stats, setStats] = useState({});
    const [loading, setLoading] = useState(true);

    useEffect(() => { loadData(); }, []);

    const loadData = async () => {
        try {
            const apiRes = await financeAPI.getAccounts();
            const apiData = apiRes.data || apiRes;
            setPendingSplits(apiData.pendingSplits || []);
            setStats(apiData.stats || {});
        } catch (err) {
            console.warn('SplitPayments: не удалось загрузить данные', err.message);
        }
        setLoading(false);
    };

    const formatCurrency = (value) => new Intl.NumberFormat('ru-RU').format(value || 0) + " so'm";

    const getPaidPercent = (splits) => {
        const paid = splits.filter(s => s.paid).length;
        return Math.round((paid / splits.length) * 100);
    };

    return (
        <div className="split-payments-page fade-in">
            <div className="page-header">
                <div>
                    <h1>{t('splitpayments.razdelenie_schyota', '💳 Разделение счёта')}</h1>
                    <p className="text-muted">{t('splitpayments.oplata_odnogo_zakaza_neskolkimi_gostyami', 'Оплата одного заказа несколькими гостями')}</p>
                </div>
            </div>

            {/* Статистика */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '16px', marginBottom: '20px' }}>
                <div className="card" style={{ padding: '20px', textAlign: 'center' }}>
                    <Split size={32} color="#3b82f6" style={{ marginBottom: '8px' }} />
                    <div style={{ fontSize: '28px', fontWeight: 'bold' }}>{stats.today_splits}</div>
                    <div style={{ color: '#666' }}>{t('splitpayments.razdeleniy_segodnya', 'Разделений сегодня')}</div>
                </div>
                <div className="card" style={{ padding: '20px', textAlign: 'center' }}>
                    <Users size={32} color="#8b5cf6" style={{ marginBottom: '8px' }} />
                    <div style={{ fontSize: '28px', fontWeight: 'bold' }}>{stats.avg_split_size}</div>
                    <div style={{ color: '#666' }}>{t('splitpayments.sredniy_razmer_gruppy', 'Средний размер группы')}</div>
                </div>
                <div className="card" style={{ padding: '20px', textAlign: 'center' }}>
                    <DollarSign size={32} color="#10b981" style={{ marginBottom: '8px' }} />
                    <div style={{ fontSize: '28px', fontWeight: 'bold' }}>{formatCurrency(stats.total_split_amount)}</div>
                    <div style={{ color: '#666' }}>{t('splitpayments.summa_za_segodnya', 'Сумма за сегодня')}</div>
                </div>
                <div className="card" style={{ padding: '20px', textAlign: 'center' }}>
                    <Calculator size={32} color="#f59e0b" style={{ marginBottom: '8px' }} />
                    <div style={{ fontSize: '28px', fontWeight: 'bold', color: '#f59e0b' }}>{stats.pending}</div>
                    <div style={{ color: '#666' }}>{t('splitpayments.ozhidayut_oplaty', 'Ожидают оплаты')}</div>
                </div>
            </div>

            {/* Активные разделения */}
            <div className="card">
                <div style={{ padding: '16px', borderBottom: '1px solid var(--border-color)' }}>
                    <h3 style={{ margin: 0 }}>{t('splitpayments.aktivnye_razdeleniya', '⏳ Активные разделения')}</h3>
                </div>
                {loading ? (
                    <div style={{ padding: '40px', textAlign: 'center' }}>{t('splitpayments.zagruzka', 'Загрузка...')}</div>
                ) : pendingSplits.length === 0 ? (
                    <div style={{ padding: '60px', textAlign: 'center' }}>
                        <Split size={48} style={{ color: '#ccc', marginBottom: '16px' }} />
                        <p>{t('splitpayments.net_aktivnyh_razdeleniy', 'Нет активных разделений')}</p>
                    </div>
                ) : (
                    <div style={{ padding: '16px', display: 'grid', gap: '16px' }}>
                        {pendingSplits.map(split => (
                            <div key={split.id} style={{
                                border: '1px solid var(--border-color)',
                                borderRadius: '12px',
                                overflow: 'hidden'
                            }}>
                                <div style={{
                                    padding: '16px',
                                    background: 'var(--bg-secondary)',
                                    display: 'flex',
                                    justifyContent: 'space-between',
                                    alignItems: 'center'
                                }}>
                                    <div>
                                        <div style={{ fontWeight: 'bold', display: 'flex', alignItems: 'center', gap: '12px' }}>
                                            {split.order_id}
                                            <span style={{
                                                background: '#dbeafe',
                                                color: '#1d4ed8',
                                                padding: '2px 8px',
                                                borderRadius: '4px',
                                                fontSize: '12px'
                                            }}>
                                                {split.table}
                                            </span>
                                        </div>
                                        <div style={{ fontSize: '13px', color: '#888' }}>{split.created_at}</div>
                                    </div>
                                    <div style={{ textAlign: 'right' }}>
                                        <div style={{ fontSize: '20px', fontWeight: 'bold' }}>{formatCurrency(split.total)}</div>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                            <div style={{
                                                width: '100px',
                                                height: '6px',
                                                background: '#e5e7eb',
                                                borderRadius: '3px',
                                                overflow: 'hidden'
                                            }}>
                                                <div style={{
                                                    width: `${getPaidPercent(split.splits)}%`,
                                                    height: '100%',
                                                    background: '#10b981',
                                                    borderRadius: '3px'
                                                }} />
                                            </div>
                                            <span style={{ fontSize: '13px', color: '#888' }}>
                                                {getPaidPercent(split.splits)}% оплачено
                                            </span>
                                        </div>
                                    </div>
                                </div>
                                <div style={{ padding: '16px' }}>
                                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: '12px' }}>
                                        {split.splits.map((s, idx) => (
                                            <div key={idx} style={{
                                                padding: '12px',
                                                borderRadius: '8px',
                                                background: s.paid ? '#dcfce7' : '#fef3c7',
                                                border: `1px solid ${s.paid ? '#86efac' : '#fcd34d'}`
                                            }}>
                                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                                                    <span style={{ fontWeight: 500 }}>{s.person}</span>
                                                    {s.paid ? (
                                                        <Check size={18} color="#16a34a" />
                                                    ) : (
                                                        <span style={{ fontSize: '12px', color: '#d97706' }}>{t('splitpayments.ozhidanie', 'Ожидание')}</span>
                                                    )}
                                                </div>
                                                <div style={{ fontSize: '18px', fontWeight: 'bold' }}>{formatCurrency(s.amount)}</div>
                                                {s.paid && s.method && (
                                                    <div style={{ fontSize: '12px', color: '#16a34a', marginTop: '4px' }}>
                                                        Оплачено: {s.method}
                                                    </div>
                                                )}
                                                {!s.paid && (
                                                    <button className="btn btn-primary btn-sm" style={{ marginTop: '8px', width: '100%' }} onClick={() => toast.info(`Принимаем оплату от ${s.person}: ${formatCurrency(s.amount)}`)}>
                                                        <CreditCard size={14} /> Принять оплату
                                                    </button>
                                                )}
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </div>

            {/* Инструкция */}
            <div className="card" style={{ marginTop: '20px', padding: '20px', background: 'linear-gradient(135deg, #dbeafe 0%, #e0e7ff 100%)' }}>
                <h3 style={{ margin: '0 0 12px' }}>{t('splitpayments.kak_eto_rabotaet', '💡 Как это работает')}</h3>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '16px' }}>
                    <div style={{ textAlign: 'center' }}>
                        <div style={{ fontSize: '32px', marginBottom: '8px' }}>1️⃣</div>
                        <div style={{ fontWeight: 500 }}>{t('splitpayments.vyberite_zakaz', 'Выберите заказ')}</div>
                        <div style={{ fontSize: '13px', color: '#666' }}>{t('splitpayments.v_kasse_nazhmite_razdelit', 'В кассе нажмите "Разделить"')}</div>
                    </div>
                    <div style={{ textAlign: 'center' }}>
                        <div style={{ fontSize: '32px', marginBottom: '8px' }}>2️⃣</div>
                        <div style={{ fontWeight: 500 }}>{t('splitpayments.ukazhite_chasti', 'Укажите части')}</div>
                        <div style={{ fontSize: '13px', color: '#666' }}>{t('splitpayments.porovnu_ili_po_summe', 'Поровну или по сумме')}</div>
                    </div>
                    <div style={{ textAlign: 'center' }}>
                        <div style={{ fontSize: '32px', marginBottom: '8px' }}>3️⃣</div>
                        <div style={{ fontWeight: 500 }}>{t('splitpayments.prinimayte_oplatu', 'Принимайте оплату')}</div>
                        <div style={{ fontSize: '13px', color: '#666' }}>{t('splitpayments.ot_kazhdogo_gostya', 'От каждого гостя')}</div>
                    </div>
                    <div style={{ textAlign: 'center' }}>
                        <div style={{ fontSize: '32px', marginBottom: '8px' }}>4️⃣</div>
                        <div style={{ fontWeight: 500 }}>{t('splitpayments.gotovo', 'Готово!')}</div>
                        <div style={{ fontSize: '13px', color: '#666' }}>{t('splitpayments.zakaz_zakryt_avtomaticheski', 'Заказ закрыт автоматически')}</div>
                    </div>
                </div>
            </div>
        </div>
    );
}

export default SplitPayments;
