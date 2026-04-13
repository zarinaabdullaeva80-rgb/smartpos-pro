import React, { useState, useEffect, useCallback } from 'react';
import { RefreshCw, TrendingUp, TrendingDown, Plus, Clock } from 'lucide-react';
import { useToast } from '../components/ToastProvider';
import { useI18n } from '../i18n';
import axios from 'axios';

const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:5000/api';
const CACHE_KEY = 'cbu_rates_cache';
const CACHE_TTL = 24 * 60 * 60 * 1000; // 24 часа

// Символы валют
const SYMBOLS = {
    USD: '$', EUR: '€', RUB: '₽', GBP: '£', CNY: '¥',
    KZT: '₸', JPY: '¥', UZS: "so'm", CHF: '₣', CAD: 'C$',
    AUD: 'A$', TRY: '₺', KRW: '₩', SAR: '﷼', AED: 'د.إ'
};

// Дефолтные валюты (до загрузки с сервера)
const DEFAULT_CURRENCIES = [
    { code: 'UZS', name: 'Узбекский сум', symbol: "so'm", is_base: true, rate: 1, enabled: true },
    { code: 'USD', name: 'Доллар США', symbol: '$', is_base: false, rate: 12650, enabled: true },
    { code: 'EUR', name: 'Евро', symbol: '€', is_base: false, rate: 13780, enabled: true },
    { code: 'RUB', name: 'Российский рубль', symbol: '₽', is_base: false, rate: 142, enabled: true },
    { code: 'GBP', name: 'Британский фунт', symbol: '£', is_base: false, rate: 16050, enabled: false },
    { code: 'CNY', name: 'Китайский юань', symbol: '¥', is_base: false, rate: 1750, enabled: false },
    { code: 'KZT', name: 'Казахстанский тенге', symbol: '₸', is_base: false, rate: 27.5, enabled: false },
];

function Currencies() {
    const { t } = useI18n();
    const toast = useToast();

    const [currencies, setCurrencies] = useState(() => {
        const saved = localStorage.getItem('currencies');
        return saved ? JSON.parse(saved) : DEFAULT_CURRENCIES;
    });
    const [rates, setRates] = useState({});
    const [loading, setLoading] = useState(false);
    const [lastUpdate, setLastUpdate] = useState('');
    const [cbuSource, setCbuSource] = useState('');

    // Калькулятор
    const [calcAmount, setCalcAmount] = useState(1000000);
    const [calcFrom, setCalcFrom] = useState('UZS');
    const [calcTo, setCalcTo] = useState('USD');

    // Модал добавления
    const [showAddCurrency, setShowAddCurrency] = useState(false);
    const [newCurrency, setNewCurrency] = useState({ code: '', name: '', symbol: '', rate: 1 });

    // Сохраняем в localStorage при изменении
    useEffect(() => {
        localStorage.setItem('currencies', JSON.stringify(currencies));
    }, [currencies]);

    // Загрузка курсов от ЦБУ через наш API
    const fetchRates = useCallback(async (forceRefresh = false) => {
        try {
            setLoading(true);

            // Проверяем кэш
            if (!forceRefresh) {
                const cached = localStorage.getItem(CACHE_KEY);
                if (cached) {
                    const { data, timestamp } = JSON.parse(cached);
                    if (Date.now() - timestamp < CACHE_TTL) {
                        applyRates(data, new Date(timestamp), 'cache');
                        return;
                    }
                }
            }

            // Запрашиваем с сервера
            const token = localStorage.getItem('token');
            const response = await axios.get(`${API_BASE}/currencies/rates${forceRefresh ? '?refresh=true' : ''}`, {
                headers: token ? { Authorization: `Bearer ${token}` } : {},
                timeout: 15000
            });

            if (response.data.success) {
                // Кэшируем
                localStorage.setItem(CACHE_KEY, JSON.stringify({
                    data: response.data.rates,
                    timestamp: Date.now()
                }));
                applyRates(response.data.rates, new Date(), response.data.source);
                if (forceRefresh) toast.success('Курсы обновлены от ЦБУ Узбекистана');
            }
        } catch (error) {
            console.warn('[Currencies] Failed to fetch rates:', error.message);
            if (forceRefresh) toast.error('Не удалось получить курсы: ' + error.message);
        } finally {
            setLoading(false);
        }
    }, [toast]);

    // Применяем курсы из ЦБУ к нашим валютам
    const applyRates = (cbuRates, date, source) => {
        setLastUpdate(date.toLocaleString('ru-RU'));
        setCbuSource(source === 'cbu' ? '🌐 ЦБУ' : source === 'cache' ? '💾 Кэш' : '📦 Кэш (резерв)');

        // Обновляем курсы для display (USD, EUR, RUB)
        const displayRates = {};
        ['USD', 'EUR', 'RUB'].forEach(code => {
            if (cbuRates[code]) {
                const r = cbuRates[code];
                displayRates[code] = {
                    current: r.rate,
                    prev: parseFloat((r.rate - r.diff).toFixed(2)),
                    change: r.diff !== 0 ? parseFloat(((r.diff / (r.rate - r.diff)) * 100).toFixed(2)) : 0,
                    name: r.name
                };
            }
        });
        setRates(displayRates);

        // Обновляем курсы в нашем списке валют (не трогаем enabled/базовые)
        setCurrencies(prev => prev.map(c => {
            if (c.is_base) return c;
            const cbu = cbuRates[c.code];
            if (cbu) {
                return { ...c, rate: cbu.rate };
            }
            return c;
        }));
    };

    // Загружаем при старте
    useEffect(() => {
        fetchRates(false);
    }, []);

    const formatRate = (rate) => new Intl.NumberFormat('ru-RU').format(rate);

    const toggleCurrency = (code) => {
        setCurrencies(currencies.map(c =>
            c.code === code ? { ...c, enabled: !c.enabled } : c
        ));
    };

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
            symbol: newCurrency.symbol || SYMBOLS[newCurrency.code.toUpperCase()] || newCurrency.code.toUpperCase(),
            is_base: false,
            rate: parseFloat(newCurrency.rate),
            enabled: true
        }]);
        setNewCurrency({ code: '', name: '', symbol: '', rate: 1 });
        setShowAddCurrency(false);
        toast.success('Валюта добавлена');
    };

    const convert = () => {
        const fromCurrency = currencies.find(c => c.code === calcFrom);
        const toCurrency = currencies.find(c => c.code === calcTo);
        if (!fromCurrency || !toCurrency) return 0;
        const inUZS = calcAmount * (fromCurrency.is_base ? 1 : fromCurrency.rate);
        return inUZS / (toCurrency.is_base ? 1 : toCurrency.rate);
    };

    return (
        <div className="currencies-page fade-in">
            <div className="page-header">
                <div>
                    <h1>{t('currencies.multivalyutnost', '💱 Мультивалютность')}</h1>
                    <p className="text-muted">{t('currencies.kursy_valyut_i_nastroyki_konvertatsii', 'Курсы валют и настройки конвертации')}</p>
                </div>
                <div style={{ display: 'flex', gap: '12px' }}>
                    <button className="btn btn-secondary" onClick={() => fetchRates(true)} disabled={loading}>
                        <RefreshCw size={18} className={loading ? 'spinning' : ''} />
                        {loading ? 'Загрузка...' : 'Обновить курсы'}
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
                                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                                        color: 'white', fontWeight: 'bold', fontSize: '14px'
                                    }}>
                                        {code}
                                    </div>
                                    <div>
                                        <div style={{ fontWeight: 'bold', fontSize: '18px' }}>1 {code}</div>
                                        <div style={{ color: '#888', fontSize: '12px' }}>
                                            {data.name || currencies.find(c => c.code === code)?.name}
                                        </div>
                                    </div>
                                </div>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '4px', color: isUp ? '#10b981' : '#ef4444', fontSize: '13px' }}>
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
                            {lastUpdate ? `Обновлено: ${lastUpdate}` : 'Загрузка...'} {cbuSource && <span style={{ color: '#10b981' }}>{cbuSource}</span>}
                        </div>
                    </div>
                    <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                        <thead>
                            <tr style={{ background: 'var(--bg-secondary)' }}>
                                <th style={{ padding: '12px', textAlign: 'left' }}>Валюта</th>
                                <th style={{ padding: '12px', textAlign: 'left' }}>Код</th>
                                <th style={{ padding: '12px', textAlign: 'right' }}>Курс к UZS</th>
                                <th style={{ padding: '12px', textAlign: 'center' }}>Статус</th>
                                <th style={{ padding: '12px', textAlign: 'center' }}>Вкл</th>
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
                        <h3 style={{ margin: 0 }}>🧮 Калькулятор</h3>
                    </div>
                    <div style={{ padding: '16px' }}>
                        <div className="form-group">
                            <label>Сумма</label>
                            <input
                                type="number"
                                value={calcAmount}
                                onChange={e => setCalcAmount(parseFloat(e.target.value) || 0)}
                            />
                        </div>
                        <div className="form-group">
                            <label>Из валюты</label>
                            <select value={calcFrom} onChange={e => setCalcFrom(e.target.value)}>
                                {currencies.filter(c => c.enabled).map(c => (
                                    <option key={c.code} value={c.code}>{c.name} ({c.code})</option>
                                ))}
                            </select>
                        </div>
                        <div className="form-group">
                            <label>В валюту</label>
                            <select value={calcTo} onChange={e => setCalcTo(e.target.value)}>
                                {currencies.filter(c => c.enabled).map(c => (
                                    <option key={c.code} value={c.code}>{c.name} ({c.code})</option>
                                ))}
                            </select>
                        </div>
                        <div style={{
                            padding: '20px',
                            background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                            borderRadius: '12px', color: 'white', textAlign: 'center', marginTop: '16px'
                        }}>
                            <div style={{ fontSize: '12px', opacity: 0.8 }}>Результат</div>
                            <div style={{ fontSize: '28px', fontWeight: 'bold' }}>
                                {currencies.find(c => c.code === calcTo)?.symbol}{formatRate(convert().toFixed(2))}
                            </div>
                            <div style={{ fontSize: '11px', opacity: 0.7, marginTop: '4px' }}>
                                {formatRate(calcAmount)} {calcFrom} = {formatRate(convert().toFixed(2))} {calcTo}
                            </div>
                        </div>
                        <div style={{ marginTop: '12px', padding: '8px', background: 'var(--bg-secondary)', borderRadius: '8px', fontSize: '11px', color: '#888', textAlign: 'center' }}>
                            Курсы: ЦБУ Узбекистана • Обновляются каждые 24ч
                        </div>
                    </div>
                </div>
            </div>

            {/* Модал добавления валюты */}
            {showAddCurrency && (
                <div className="modal-overlay" onClick={() => setShowAddCurrency(false)}>
                    <div className="modal" onClick={e => e.stopPropagation()} style={{ maxWidth: '400px' }}>
                        <div className="modal-header">
                            <h2>➕ Новая валюта</h2>
                        </div>
                        <div className="modal-body">
                            <div className="form-group">
                                <label>Код валюты (3 буквы)</label>
                                <input type="text" maxLength={3}
                                    value={newCurrency.code}
                                    onChange={e => setNewCurrency({ ...newCurrency, code: e.target.value.toUpperCase() })}
                                    placeholder="JPY" />
                            </div>
                            <div className="form-group">
                                <label>Название</label>
                                <input type="text"
                                    value={newCurrency.name}
                                    onChange={e => setNewCurrency({ ...newCurrency, name: e.target.value })}
                                    placeholder="Японская йена" />
                            </div>
                            <div className="form-group">
                                <label>Символ</label>
                                <input type="text" maxLength={3}
                                    value={newCurrency.symbol}
                                    onChange={e => setNewCurrency({ ...newCurrency, symbol: e.target.value })}
                                    placeholder="¥" />
                            </div>
                            <div className="form-group">
                                <label>Курс к UZS (или 0 для авто)</label>
                                <input type="number" step="0.01"
                                    value={newCurrency.rate}
                                    onChange={e => setNewCurrency({ ...newCurrency, rate: e.target.value })} />
                            </div>
                        </div>
                        <div className="modal-footer">
                            <button className="btn btn-secondary" onClick={() => setShowAddCurrency(false)}>Отмена</button>
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
