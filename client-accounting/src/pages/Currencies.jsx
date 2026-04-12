import React, { useState, useEffect } from 'react';
import { DollarSign, RefreshCw, TrendingUp, TrendingDown, Globe, Settings, Plus, Clock, Check, X } from 'lucide-react';
import { financeAPI } from '../services/api';
import { useToast } from '../components/ToastProvider';
import { useI18n } from '../i18n';

// Дефолтные валюты
const DEFAULT_CURRENCIES = [
    { code: 'UZS', name: 'Узбекский сум', symbol: "so'm", is_base: true, rate: 1, enabled: true },
    { code: 'USD', name: 'Доллар США', symbol: '$', is_base: false, rate: 12650, enabled: true },
    { code: 'EUR', name: 'Евро', symbol: '€', is_base: false, rate: 13780, enabled: true },
    { code: 'RUB', name: 'Российский рубль', symbol: '₽', is_base: false, rate: 142, enabled: true },
    { code: 'GBP', name: 'Британский фунт', symbol: '£', is_base: false, rate: 16050, enabled: false },
    { code: 'CNY', name: 'Китайский юань', symbol: '¥', is_base: false, rate: 1750, enabled: false },
    { code: 'KZT', name: 'Казахстанский тенге', symbol: '₸', is_base: false, rate: 27.5, enabled: false }
];

function Currencies() {
    const { t } = useI18n();
    const toast = useToast();
    // Загрузка из localStorage
    const [currencies, setCurrencies] = useState(() => {
        const saved = localStorage.getItem('currencies');
        return saved ? JSON.parse(saved) : DEFAULT_CURRENCIES;
    });
    const [rates, setRates] = useState({});
    const [baseCurrency, setBaseCurrency] = useState('UZS');
    const [loading, setLoading] = useState(false);
    const [lastUpdate, setLastUpdate] = useState(new Date().toLocaleString('ru-RU'));

    // Калькулятор
    const [calcAmount, setCalcAmount] = useState(1000000);
    const [calcFrom, setCalcFrom] = useState('UZS');
    const [calcTo, setCalcTo] = useState('USD');

    // Модал добавления валюты
    const [showAddCurrency, setShowAddCurrency] = useState(false);
    const [newCurrency, setNewCurrency] = useState({ code: '', name: '', symbol: '', rate: 1 });

    // Сохранение в localStorage
    useEffect(() => {
        localStorage.setItem('currencies', JSON.stringify(currencies));
    }, [currencies]);

    useEffect(() => {
        // Установить курсы для отображения
        setRates({
            USD: { current: currencies.find(c => c.code === 'USD')?.rate || 12650, prev: 12620, change: 0.24 },
            EUR: { current: currencies.find(c => c.code === 'EUR')?.rate || 13780, prev: 13820, change: -0.29 },
            RUB: { current: currencies.find(c => c.code === 'RUB')?.rate || 142, prev: 141, change: 0.71 }
        });
    }, [currencies]);

    // Конвертация
    const convert = () => {
        const fromCurrency = currencies.find(c => c.code === calcFrom);
        const toCurrency = currencies.find(c => c.code === calcTo);
        if (!fromCurrency || !toCurrency) return 0;

        // Всё конвертируем через UZS
        const inUZS = calcAmount * (fromCurrency.is_base ? 1 : fromCurrency.rate);
        const result = inUZS / (toCurrency.is_base ? 1 : toCurrency.rate);
        return result;
    };

    // Добавление валюты
    const addCurrency = () => {
        if (!newCurrency.code || !newCurrency.name || !newCurrency.rate) {
            toast.info('Заполните все поля');
            return;
        }
        if (currencies.find(c => c.code === newCurrency.code.toUpperCase())) {
            toast.info('Такая валюта уже существует');
            return;
        }
        setCurrencies([...currencies, {
            code: newCurrency.code.toUpperCase(),
            name: newCurrency.name,
            symbol: newCurrency.symbol || newCurrency.code.toUpperCase(),
            is_base: false,
            rate: parseFloat(newCurrency.rate),
            enabled: true
        }]);
        setNewCurrency({ code: '', name: '', symbol: '', rate: 1 });
        setShowAddCurrency(false);
    };

    const formatRate = (rate) => new Intl.NumberFormat('ru-RU').format(rate);

    const toggleCurrency = (code) => {
        setCurrencies(currencies.map(c =>
            c.code === code ? { ...c, enabled: !c.enabled } : c
        ));
    };

    const updateRates = () => {
        setLoading(true);
        setTimeout(() => {
            setLastUpdate(new Date().toLocaleString('ru-RU'));
            setLoading(false);
        }, 1500);
    };

    return (
        <div className="currencies-page fade-in">
            <div className="page-header">
                <div>
                    <h1>{t('currencies.multivalyutnost', '💱 Мультивалютность')}</h1>
                    <p className="text-muted">{t('currencies.kursy_valyut_i_nastroyki_konvertatsii', 'Курсы валют и настройки конвертации')}</p>
                </div>
                <div style={{ display: 'flex', gap: '12px' }}>
                    <button className="btn btn-secondary" onClick={updateRates} disabled={loading}>
                        <RefreshCw size={18} className={loading ? 'spinning' : ''} /> Обновить курсы
                    </button>
                    <button className="btn btn-primary" onClick={() => setShowAddCurrency(true)}>
                        <Plus size={18} /> Добавить валюту
                    </button>
                </div>
            </div>

            {/* Основные курсы */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '16px', marginBottom: '20px' }}>
                {Object.entries(rates).map(([code, data]) => {
                    const isUp = data.change > 0;
                    return (
                        <div key={code} className="card" style={{ padding: '20px' }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '12px' }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                                    <div style={{
                                        width: '48px', height: '48px',
                                        borderRadius: '50%',
                                        background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                                        display: 'flex',
                                        alignItems: 'center',
                                        justifyContent: 'center',
                                        color: 'white',
                                        fontWeight: 'bold',
                                        fontSize: '14px'
                                    }}>
                                        {code}
                                    </div>
                                    <div>
                                        <div style={{ fontWeight: 'bold', fontSize: '18px' }}>1 {code}</div>
                                        <div style={{ color: '#888', fontSize: '12px' }}>
                                            {currencies.find(c => c.code === code)?.name}
                                        </div>
                                    </div>
                                </div>
                                <div style={{
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: '4px',
                                    color: isUp ? '#10b981' : '#ef4444',
                                    fontSize: '13px'
                                }}>
                                    {isUp ? <TrendingUp size={16} /> : <TrendingDown size={16} />}
                                    {isUp ? '+' : ''}{data.change}%
                                </div>
                            </div>
                            <div style={{ fontSize: '28px', fontWeight: 'bold' }}>
                                {formatRate(data.current)} <span style={{ fontSize: '14px', color: '#888' }}>so'm</span>
                            </div>
                            <div style={{ fontSize: '12px', color: '#888', marginTop: '4px' }}>
                                Вчера: {formatRate(data.prev)} so'm
                            </div>
                        </div>
                    );
                })}
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 350px', gap: '20px' }}>
                {/* Список валют */}
                <div className="card">
                    <div style={{ padding: '16px', borderBottom: '1px solid var(--border-color)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <h3 style={{ margin: 0 }}>{t('currencies.valyuty', '💰 Валюты')}</h3>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#888', fontSize: '13px' }}>
                            <Clock size={14} />
                            Обновлено: {lastUpdate}
                        </div>
                    </div>
                    <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                        <thead>
                            <tr style={{ background: 'var(--bg-secondary)' }}>
                                <th style={{ padding: '12px', textAlign: 'left' }}>{t('currencies.valyuta', 'Валюта')}</th>
                                <th style={{ padding: '12px', textAlign: 'left' }}>{t('currencies.kod', 'Код')}</th>
                                <th style={{ padding: '12px', textAlign: 'right' }}>{t('currencies.kurs_k', 'Курс к UZS')}</th>
                                <th style={{ padding: '12px', textAlign: 'center' }}>{t('currencies.status', 'Статус')}</th>
                                <th style={{ padding: '12px', textAlign: 'center' }}>{t('currencies.vkl', 'Вкл')}</th>
                            </tr>
                        </thead>
                        <tbody>
                            {currencies.map(currency => (
                                <tr key={currency.code} style={{ borderBottom: '1px solid var(--border-color)', opacity: currency.enabled ? 1 : 0.5 }}>
                                    <td style={{ padding: '12px' }}>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                            <span style={{ fontSize: '18px' }}>{currency.symbol}</span>
                                            <span style={{ fontWeight: 500 }}>{currency.name}</span>
                                        </div>
                                    </td>
                                    <td style={{ padding: '12px', fontFamily: 'monospace', fontWeight: 'bold' }}>
                                        {currency.code}
                                    </td>
                                    <td style={{ padding: '12px', textAlign: 'right' }}>
                                        {currency.is_base ? '-' : formatRate(currency.rate)}
                                    </td>
                                    <td style={{ padding: '12px', textAlign: 'center' }}>
                                        {currency.is_base ? (
                                            <span style={{ background: '#dbeafe', color: '#1d4ed8', padding: '2px 8px', borderRadius: '12px', fontSize: '12px' }}>
                                                Базовая
                                            </span>
                                        ) : (
                                            <span style={{ background: '#f3f4f6', color: '#666', padding: '2px 8px', borderRadius: '12px', fontSize: '12px' }}>
                                                Дополнительная
                                            </span>
                                        )}
                                    </td>
                                    <td style={{ padding: '12px', textAlign: 'center' }}>
                                        <input
                                            type="checkbox"
                                            checked={currency.enabled}
                                            onChange={() => toggleCurrency(currency.code)}
                                            disabled={currency.is_base}
                                        />
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>

                {/* Калькулятор */}
                <div className="card">
                    <div style={{ padding: '16px', borderBottom: '1px solid var(--border-color)' }}>
                        <h3 style={{ margin: 0 }}>{t('currencies.kalkulyator', '🧮 Калькулятор')}</h3>
                    </div>
                    <div style={{ padding: '16px' }}>
                        <div className="form-group">
                            <label>{t('currencies.summa', 'Сумма')}</label>
                            <input
                                type="number"
                                value={calcAmount}
                                onChange={e => setCalcAmount(parseFloat(e.target.value) || 0)}
                            />
                        </div>
                        <div className="form-group">
                            <label>{t('currencies.iz_valyuty', 'Из валюты')}</label>
                            <select value={calcFrom} onChange={e => setCalcFrom(e.target.value)}>
                                {currencies.filter(c => c.enabled).map(c => (
                                    <option key={c.code} value={c.code}>{c.name} ({c.code})</option>
                                ))}
                            </select>
                        </div>
                        <div className="form-group">
                            <label>{t('currencies.v_valyutu', 'В валюту')}</label>
                            <select value={calcTo} onChange={e => setCalcTo(e.target.value)}>
                                {currencies.filter(c => c.enabled).map(c => (
                                    <option key={c.code} value={c.code}>{c.name} ({c.code})</option>
                                ))}
                            </select>
                        </div>
                        <div style={{
                            padding: '20px',
                            background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                            borderRadius: '12px',
                            color: 'white',
                            textAlign: 'center',
                            marginTop: '16px'
                        }}>
                            <div style={{ fontSize: '12px', opacity: 0.8 }}>{t('currencies.rezultat', 'Результат')}</div>
                            <div style={{ fontSize: '28px', fontWeight: 'bold' }}>
                                {currencies.find(c => c.code === calcTo)?.symbol}{formatRate(convert().toFixed(2))}
                            </div>
                            <div style={{ fontSize: '11px', opacity: 0.7, marginTop: '4px' }}>
                                {formatRate(calcAmount)} {calcFrom} = {formatRate(convert().toFixed(2))} {calcTo}
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            {/* Модал добавления валюты */}
            {showAddCurrency && (
                <div className="modal-overlay" onClick={() => setShowAddCurrency(false)}>
                    <div className="modal" onClick={e => e.stopPropagation()} style={{ maxWidth: '400px' }}>
                        <div className="modal-header">
                            <h2>{t('currencies.novaya_valyuta', '➕ Новая валюта')}</h2>
                        </div>
                        <div className="modal-body">
                            <div className="form-group">
                                <label>{t('currencies.kod_valyuty_bukvy', 'Код валюты (3 буквы)')}</label>
                                <input
                                    type="text"
                                    maxLength={3}
                                    value={newCurrency.code}
                                    onChange={e => setNewCurrency({ ...newCurrency, code: e.target.value.toUpperCase() })}
                                    placeholder="JPY"
                                />
                            </div>
                            <div className="form-group">
                                <label>{t('currencies.nazvanie', 'Название')}</label>
                                <input
                                    type="text"
                                    value={newCurrency.name}
                                    onChange={e => setNewCurrency({ ...newCurrency, name: e.target.value })}
                                    placeholder="Японская йена"
                                />
                            </div>
                            <div className="form-group">
                                <label>{t('currencies.simvol', 'Символ')}</label>
                                <input
                                    type="text"
                                    maxLength={3}
                                    value={newCurrency.symbol}
                                    onChange={e => setNewCurrency({ ...newCurrency, symbol: e.target.value })}
                                    placeholder="¥"
                                />
                            </div>
                            <div className="form-group">
                                <label>{t('currencies.kurs_k', 'Курс к UZS')}</label>
                                <input
                                    type="number"
                                    step="0.01"
                                    value={newCurrency.rate}
                                    onChange={e => setNewCurrency({ ...newCurrency, rate: e.target.value })}
                                />
                            </div>
                        </div>
                        <div className="modal-footer">
                            <button className="btn btn-secondary" onClick={() => setShowAddCurrency(false)}>{t('currencies.otmena', 'Отмена')}</button>
                            <button className="btn btn-primary" onClick={addCurrency}>
                                <Plus size={16} /> Добавить
                            </button>
                        </div>
                    </div>
                </div>
            )}

            <style>{`
                .spinning {
                    animation: spin 1s linear infinite;
                }
                @keyframes spin {
                    from { transform: rotate(0deg); }
                    to { transform: rotate(360deg); }
                }
            `}</style>
        </div>
    );
}

export default Currencies;
