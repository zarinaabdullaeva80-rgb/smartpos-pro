import React, { useState, useEffect, useRef } from 'react';
import { Search, CreditCard, Printer, QrCode, Download, User, Star, Gift, History, Settings, Plus, Trash2 } from 'lucide-react';
import QRCode from 'react-qr-code';
import { crmAPI, loyaltyAPI } from '../services/api';
import { useToast } from '../components/ToastProvider';
import { useI18n } from '../i18n';

function LoyaltyCards() {
    const { t } = useI18n();
    const toast = useToast();
    // Загрузка карт из localStorage
    const [cards, setCards] = useState(() => {
        const saved = localStorage.getItem('loyalty_cards');
        return saved ? JSON.parse(saved) : [];
    });
    const [customers, setCustomers] = useState([]);
    const [selectedCustomer, setSelectedCustomer] = useState(null);
    const [searchTerm, setSearchTerm] = useState('');
    const [cardData, setCardData] = useState(null);
    const [transactions, setTransactions] = useState([]);
    const [settings, setSettings] = useState({ cashback_percent: 2 });
    const [loading, setLoading] = useState(true);
    const [showSettings, setShowSettings] = useState(false);
    const [showCreateCard, setShowCreateCard] = useState(false);
    const [showBatchPrint, setShowBatchPrint] = useState(false);
    const [newCard, setNewCard] = useState({ name: '', phone: '', email: '' });
    const [batchCount, setBatchCount] = useState(10);
    const printRef = useRef();
    const [barcodeImage, setBarcodeImage] = useState(null);

    // Списание баллов
    const [showSpendModal, setShowSpendModal] = useState(false);
    const [spendAmount, setSpendAmount] = useState('');
    const [spendDescription, setSpendDescription] = useState('');

    // Сохранение карт в localStorage
    useEffect(() => {
        localStorage.setItem('loyalty_cards', JSON.stringify(cards));
    }, [cards]);

    useEffect(() => {
        loadCustomers();
        loadSettings();
    }, []);

    const loadCustomers = async () => {
        try {
            const response = await crmAPI.getCustomers();
            setCustomers(response.data?.customers || []);
        } catch (error) {
            console.error('Error loading customers:', error);
        } finally {
            setLoading(false);
        }
    };

    const loadSettings = async () => {
        try {
            const response = await loyaltyAPI.getProgram();
            setSettings(response.data?.settings || response.data || {});
        } catch (error) {
            console.error('Error loading settings:', error);
        }
    };

    // Генерация номера карты
    const generateCardNumber = () => {
        const prefix = '9999';
        const random = Math.floor(Math.random() * 1000000000000).toString().padStart(12, '0');
        return prefix + random;
    };

    // Создание новой карты
    const createCard = () => {
        if (!newCard.name || !newCard.phone) {
            toast.info('Заполните имя и телефон');
            return;
        }

        const card = {
            id: Date.now(),
            number: generateCardNumber(),
            name: newCard.name,
            phone: newCard.phone,
            email: newCard.email,
            level: 'Standard',
            balance: 0,
            earnedTotal: 0,
            spentTotal: 0,
            created_at: new Date().toISOString()
        };

        setCards([...cards, card]);
        setNewCard({ name: '', phone: '', email: '' });
        setShowCreateCard(false);
        toast.success(`Карта ${card.number} создана!`);
    };

    // Генерация пакета баркодов
    const generateBatchBarcodes = () => {
        const newCards = [];
        for (let i = 0; i < batchCount; i++) {
            newCards.push({
                id: Date.now() + i,
                number: generateCardNumber(),
                name: '',
                phone: '',
                email: '',
                level: 'Standard',
                balance: 0,
                earnedTotal: 0,
                spentTotal: 0,
                created_at: new Date().toISOString(),
                is_blank: true  // Пустая карта для печати
            });
        }
        setCards([...cards, ...newCards]);
        return newCards;
    };

    // Печать пакета карт
    const printBatchCards = (cardsToprint) => {
        const printWindow = window.open('', '', 'width=800,height=600');
        printWindow.document.write(`
            <html>
            <head>
                <title>${t('loyaltycards.karty_loyalnosti', 'Карты лояльности - SmartPOS Pro')}</title>
                <style>
                    @page { size: A4; margin: 10mm; }
                    body { font-family: 'Segoe UI', Arial, sans-serif; margin: 0; padding: 10mm; }
                    h2 { text-align: center; color: #1e3a5f; margin-bottom: 8mm; }
                    .cards-grid { display: grid; grid-template-columns: repeat(2, 1fr); gap: 8mm; }
                    .card-item {
                        width: 85.6mm; height: 53.98mm;
                        background: linear-gradient(135deg, #1e3a5f 0%, #2d5a87 50%, #1e3a5f 100%);
                        border-radius: 10px;
                        padding: 6mm 8mm;
                        box-sizing: border-box;
                        color: white;
                        position: relative;
                        page-break-inside: avoid;
                        overflow: hidden;
                    }
                    .card-logo { font-size: 14px; font-weight: bold; }
                    .card-logo span { color: #ffd700; }
                    .card-number { font-size: 12px; font-family: monospace; letter-spacing: 2px; margin: 4mm 0 2mm; }
                    .card-owner { font-size: 10px; text-transform: uppercase; opacity: 0.9; }
                    .card-level { font-size: 9px; color: #ffd700; margin-top: 1mm; }
                    .card-balance { position: absolute; bottom: 5mm; left: 8mm; font-size: 9px; opacity: 0.7; }
                    .card-cashback { position: absolute; bottom: 5mm; right: 8mm; background: rgba(255,215,0,0.2); padding: 1mm 3mm; border-radius: 3px; font-size: 9px; color: #ffd700; }
                </style>
            </head>
            <body>
                <h2>${t('loyaltycards.karty_loyalnosti', 'Карты лояльности — SmartPOS Pro')}</h2>
                <div class="cards-grid">
                    ${cardsToprint.map(c => `
                        <div class="card-item">
                            <div class="card-logo">SmartPOS <span>${t('loyaltycards.bonus', 'Бонус')}</span></div>
                            <div class="card-number">${c.number.replace(/(.{4})/g, '$1 ')}</div>
                            <div class="card-owner">${c.name || '____________________'}</div>
                            <div class="card-level">${c.level}</div>
                            <div class="card-balance">Баланс: ${new Intl.NumberFormat('ru-RU').format(c.balance || 0)} баллов</div>
                            <div class="card-cashback">Кэшбек ${settings.cashback_percent || 2}%</div>
                        </div>
                    `).join('')}
                </div>
            </body>
            </html>
        `);
        printWindow.document.close();
        setTimeout(() => printWindow.print(), 300);
    };

    const selectCustomer = async (customer) => {
        setSelectedCustomer(customer);
        setBarcodeImage(null);
        try {
            // Загрузить данные карты
            const cardResponse = await loyaltyAPI.getCardById(customer.id);
            setCardData(cardResponse.data?.card || cardResponse.data);

            // Загрузить barcode
            try {
                const barcodeRes = await loyaltyAPI.getBarcode(customer.id);
                if (barcodeRes.data?.barcode) {
                    setBarcodeImage(barcodeRes.data.barcode);
                }
            } catch (bErr) {
                console.warn('Barcode load failed:', bErr);
            }

            // Загрузить транзакции
            const txResponse = await loyaltyAPI.getCardById(customer.id);
            setTransactions(txResponse.data?.transactions || []);
        } catch (error) {
            console.error('Error loading card data:', error);
        }
    };

    const handleSpendPoints = async () => {
        const points = parseInt(spendAmount);
        if (!points || isNaN(points) || points <= 0) {
            toast.info('Введите корректное количество баллов');
            return;
        }
        if (points > (cardData?.balance || 0)) {
            toast.info(`Недостаточно баллов. Баланс: ${cardData?.balance || 0}`);
            return;
        }
        try {
            await loyaltyAPI.spendPoints(selectedCustomer.id, points, spendDescription || 'Списание баллов');
            toast.success(`✅ Успешно списано ${points} баллов`);
            setShowSpendModal(false);
            setSpendAmount('');
            setSpendDescription('');
            selectCustomer(selectedCustomer); // Обновить данные
        } catch (error) {
            toast.error('❌ ' + (error.response?.data?.error || 'Ошибка списания баллов'));
        }
    };

    const printCard = () => {
        const balance = cardData?.balance || 0;
        const cashback = settings.cashback_percent || 2;
        const printWindow = window.open('', '', 'width=600,height=400');
        printWindow.document.write(`
            <html>
            <head>
                <title>Карта лояльности - ${selectedCustomer?.name}</title>
                <style>
                    @page { size: 85.6mm 53.98mm; margin: 0; }
                    body { margin: 0; padding: 0; font-family: 'Segoe UI', Arial, sans-serif; }
                    .card {
                        width: 85.6mm; height: 53.98mm;
                        background: linear-gradient(135deg, #0f172a 0%, #1e3a5f 40%, #2d5a87 70%, #1e3a5f 100%);
                        color: white;
                        border-radius: 10px;
                        padding: 5mm 7mm;
                        box-sizing: border-box;
                        position: relative;
                        overflow: hidden;
                    }
                    .card::before {
                        content: '';
                        position: absolute;
                        top: -20mm; right: -20mm;
                        width: 50mm; height: 50mm;
                        background: rgba(255,215,0,0.05);
                        border-radius: 50%;
                    }
                    .logo { font-size: 14px; font-weight: bold; }
                    .logo span { color: #ffd700; }
                    .card-number { font-size: 12px; letter-spacing: 2px; margin: 2mm 0 1mm; font-family: 'Courier New', monospace; }
                    .customer-name { font-size: 9px; text-transform: uppercase; letter-spacing: 0.5px; }
                    .level { font-size: 8px; color: #ffd700; margin-top: 1mm; }
                    .barcode-box { background: white; padding: 2mm 4mm; border-radius: 4px; margin-top: 2mm; text-align: center; }
                    .barcode-box img { width: 100%; max-height: 12mm; object-fit: contain; }
                    .balance-row { display: flex; justify-content: space-between; align-items: center; margin-top: 2mm; }
                    .balance { font-size: 9px; }
                    .balance strong { font-size: 11px; color: #4ade80; }
                    .cashback-badge { background: rgba(255,215,0,0.2); padding: 1mm 3mm; border-radius: 3px; font-size: 8px; color: #ffd700; font-weight: bold; }
                </style>
            </head>
            <body>
                <div class="card">
                    <div class="logo">SmartPOS <span>${t('loyaltycards.bonus', 'Бонус')}</span></div>
                    <div class="card-number">${formatCardNumber(cardData?.number || '')}</div>
                    <div class="customer-name">${selectedCustomer?.name}</div>
                    <div class="level">★ ${cardData?.level || 'Standard'}</div>
                    <div class="barcode-box">
                        ${barcodeImage ? `<img src="${barcodeImage}" alt="barcode" />` : '<div style="height:10mm;color:#999;font-size:8px">Barcode</div>'}
                    </div>
                    <div class="balance-row">
                        <div class="balance">${t('loyaltycards.balans', 'Баланс:')} <strong>${new Intl.NumberFormat('ru-RU').format(balance)}</strong> ${t('loyaltycards.b', 'б.')}</div>
                        <div class="cashback-badge">Кэшбек ${cashback}%</div>
                    </div>
                </div>
            </body>
            </html>
        `);
        printWindow.document.close();
        setTimeout(() => printWindow.print(), 500);
    };

    const formatCardNumber = (num) => {
        return num?.replace(/(.{4})/g, '$1 ').trim() || '';
    };

    const formatCurrency = (value) => {
        return new Intl.NumberFormat('ru-RU').format(value || 0) + " so'm";
    };

    const filteredCustomers = customers.filter(c =>
        c.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        c.phone?.includes(searchTerm) ||
        c.card_number?.includes(searchTerm)
    );

    return (
        <div className="loyalty-cards-page fade-in">
            <div className="page-header">
                <div>
                    <h1>{t('loyaltycards.nakopitelnye_karty', '🎴 Накопительные карты')}</h1>
                    <p className="text-muted">Управление картами лояльности клиентов ({cards.length} карт)</p>
                </div>
                <div style={{ display: 'flex', gap: '10px' }}>
                    <button className="btn btn-secondary" onClick={() => setShowBatchPrint(true)}>
                        <Printer size={18} /> Генерация баркодов
                    </button>
                    <button className="btn btn-primary" onClick={() => setShowCreateCard(true)}>
                        <Plus size={18} /> Новая карта
                    </button>
                    <button className="btn btn-secondary" onClick={() => setShowSettings(true)}>
                        <Settings size={18} /> Настройки
                    </button>
                </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '350px 1fr', gap: '20px' }}>
                {/* Список клиентов */}
                <div className="card">
                    <div style={{ padding: '16px', borderBottom: '1px solid var(--border-color)' }}>
                        <div className="search-box" style={{ position: 'relative' }}>
                            <Search size={18} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: '#888' }} />
                            <input
                                type="text"
                                placeholder="Поиск по имени, телефону, карте..."
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                                style={{ paddingLeft: '40px', width: '100%' }}
                            />
                        </div>
                    </div>
                    <div style={{ maxHeight: '500px', overflowY: 'auto' }}>
                        {loading ? (
                            <div style={{ padding: '20px', textAlign: 'center' }}>{t('loyaltycards.zagruzka', 'Загрузка...')}</div>
                        ) : filteredCustomers.length === 0 ? (
                            <div style={{ padding: '20px', textAlign: 'center', color: '#888' }}>
                                Клиенты не найдены
                            </div>
                        ) : (
                            filteredCustomers.map(customer => (
                                <div
                                    key={customer.id}
                                    onClick={() => selectCustomer(customer)}
                                    style={{
                                        padding: '12px 16px',
                                        borderBottom: '1px solid var(--border-color)',
                                        cursor: 'pointer',
                                        background: selectedCustomer?.id === customer.id ? 'var(--primary-light)' : 'transparent',
                                        display: 'flex',
                                        alignItems: 'center',
                                        gap: '12px'
                                    }}
                                >
                                    <div style={{
                                        width: '40px', height: '40px', borderRadius: '50%',
                                        background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                                        color: 'white', fontWeight: 'bold'
                                    }}>
                                        {customer.name?.[0]?.toUpperCase() || '?'}
                                    </div>
                                    <div style={{ flex: 1 }}>
                                        <div style={{ fontWeight: 500 }}>{customer.name}</div>
                                        <div style={{ fontSize: '12px', color: '#888' }}>{customer.phone}</div>
                                    </div>
                                    <div style={{ fontSize: '12px', color: '#10b981' }}>
                                        {formatCurrency(customer.loyalty_points || 0)}
                                    </div>
                                </div>
                            ))
                        )}
                    </div>
                </div>

                {/* Детали карты */}
                <div>
                    {selectedCustomer && cardData ? (
                        <>
                            {/* Превью карты */}
                            <div className="card" style={{ marginBottom: '20px', padding: '20px' }}>
                                <div style={{ display: 'flex', gap: '20px', alignItems: 'flex-start' }}>
                                    {/* Карта */}
                                    <div style={{
                                        width: '320px', height: '200px',
                                        background: 'linear-gradient(135deg, #1e3a5f 0%, #2d5a87 50%, #1e3a5f 100%)',
                                        borderRadius: '16px',
                                        padding: '24px',
                                        color: 'white',
                                        position: 'relative',
                                        boxShadow: '0 10px 40px rgba(0,0,0,0.3)'
                                    }}>
                                        <div style={{ fontSize: '20px', fontWeight: 'bold' }}>
                                            SmartPOS <span style={{ color: '#ffd700' }}>{t('loyaltycards.bonus', 'Бонус')}</span>
                                        </div>
                                        <div style={{
                                            fontSize: '18px', letterSpacing: '3px',
                                            fontFamily: 'monospace', marginTop: '30px'
                                        }}>
                                            {formatCardNumber(cardData.number)}
                                        </div>
                                        <div style={{ fontSize: '14px', textTransform: 'uppercase', marginTop: '8px' }}>
                                            {selectedCustomer.name}
                                        </div>
                                        <div style={{ fontSize: '12px', color: '#ffd700', marginTop: '4px' }}>
                                            {cardData.level}
                                        </div>
                                        <div ref={printRef} style={{
                                            position: 'absolute', bottom: '16px', left: '24px', right: '24px',
                                            background: 'white', padding: '6px 10px', borderRadius: '6px',
                                            textAlign: 'center'
                                        }}>
                                            {barcodeImage ? (
                                                <img src={barcodeImage} alt="barcode" style={{ width: '100%', maxHeight: '40px', objectFit: 'contain' }} />
                                            ) : (
                                                <div style={{ color: '#999', fontSize: '11px', padding: '8px 0' }}>{t('loyaltycards.zagruzka', 'Загрузка barcode...')}</div>
                                            )}
                                        </div>
                                    </div>

                                    {/* Статистика */}
                                    <div style={{ flex: 1 }}>
                                        <h3 style={{ marginTop: 0 }}>{t('loyaltycards.statistika', 'Статистика')}</h3>
                                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '12px' }}>
                                            <div style={{ background: 'var(--success-light)', padding: '16px', borderRadius: '12px', textAlign: 'center' }}>
                                                <div style={{ fontSize: '24px', fontWeight: 'bold', color: 'var(--success)' }}>
                                                    {formatCurrency(cardData.balance)}
                                                </div>
                                                <div style={{ fontSize: '12px', color: '#666' }}>{t('loyaltycards.tekuschiy_balans', 'Текущий баланс')}</div>
                                            </div>
                                            <div style={{ background: 'var(--primary-light)', padding: '16px', borderRadius: '12px', textAlign: 'center' }}>
                                                <div style={{ fontSize: '24px', fontWeight: 'bold', color: 'var(--primary)' }}>
                                                    {formatCurrency(cardData.earnedTotal)}
                                                </div>
                                                <div style={{ fontSize: '12px', color: '#666' }}>{t('loyaltycards.vsego_nachisleno', 'Всего начислено')}</div>
                                            </div>
                                            <div style={{ background: 'var(--warning-light)', padding: '16px', borderRadius: '12px', textAlign: 'center' }}>
                                                <div style={{ fontSize: '24px', fontWeight: 'bold', color: 'var(--warning)' }}>
                                                    {formatCurrency(cardData.spentTotal)}
                                                </div>
                                                <div style={{ fontSize: '12px', color: '#666' }}>{t('loyaltycards.vsego_potracheno', 'Всего потрачено')}</div>
                                            </div>
                                        </div>

                                        <div style={{ marginTop: '20px', display: 'flex', gap: '10px' }}>
                                            <button className="btn btn-primary" onClick={printCard}>
                                                <Printer size={18} /> Печать карты
                                            </button>
                                            <button className="btn btn-warning" style={{ color: '#fff' }} onClick={() => setShowSpendModal(true)}>
                                                ➖ Списать баллы
                                            </button>
                                            <button className="btn btn-secondary" onClick={() => toast.info('Скачивание PDF карты...')}>
                                                <Download size={18} /> Скачать PDF
                                            </button>
                                        </div>
                                    </div>
                                </div>
                            </div>

                            {/* История транзакций */}
                            <div className="card">
                                <div style={{ padding: '16px', borderBottom: '1px solid var(--border-color)', display: 'flex', alignItems: 'center', gap: '8px' }}>
                                    <History size={18} />
                                    <h3 style={{ margin: 0 }}>{t('loyaltycards.istoriya_operatsiy', 'История операций')}</h3>
                                </div>
                                <div style={{ maxHeight: '300px', overflowY: 'auto' }}>
                                    {transactions.length === 0 ? (
                                        <div style={{ padding: '40px', textAlign: 'center', color: '#888' }}>
                                            Нет операций
                                        </div>
                                    ) : (
                                        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                                            <thead>
                                                <tr style={{ background: 'var(--bg-secondary)' }}>
                                                    <th style={{ padding: '12px', textAlign: 'left' }}>{t('loyaltycards.data', 'Дата')}</th>
                                                    <th style={{ padding: '12px', textAlign: 'left' }}>{t('loyaltycards.tip', 'Тип')}</th>
                                                    <th style={{ padding: '12px', textAlign: 'right' }}>{t('loyaltycards.summa', 'Сумма')}</th>
                                                    <th style={{ padding: '12px', textAlign: 'right' }}>{t('loyaltycards.bally', 'Баллы')}</th>
                                                    <th style={{ padding: '12px', textAlign: 'left' }}>{t('loyaltycards.opisanie', 'Описание')}</th>
                                                </tr>
                                            </thead>
                                            <tbody>
                                                {transactions.map((tx, i) => (
                                                    <tr key={i} style={{ borderBottom: '1px solid var(--border-color)' }}>
                                                        <td style={{ padding: '12px' }}>
                                                            {new Date(tx.created_at).toLocaleDateString('ru-RU')}
                                                        </td>
                                                        <td style={{ padding: '12px' }}>
                                                            {tx.type === 'earn' ? (
                                                                <span style={{ color: '#10b981' }}>{t('loyaltycards.nachislenie', '➕ Начисление')}</span>
                                                            ) : (
                                                                <span style={{ color: '#ef4444' }}>{t('loyaltycards.spisanie', '➖ Списание')}</span>
                                                            )}
                                                        </td>
                                                        <td style={{ padding: '12px', textAlign: 'right' }}>
                                                            {tx.amount ? formatCurrency(tx.amount) : '-'}
                                                        </td>
                                                        <td style={{
                                                            padding: '12px', textAlign: 'right', fontWeight: 'bold',
                                                            color: tx.points > 0 ? '#10b981' : '#ef4444'
                                                        }}>
                                                            {tx.points > 0 ? '+' : ''}{tx.points}
                                                        </td>
                                                        <td style={{ padding: '12px', color: '#666' }}>{tx.description}</td>
                                                    </tr>
                                                ))}
                                            </tbody>
                                        </table>
                                    )}
                                </div>
                            </div>
                        </>
                    ) : (
                        <div className="card" style={{ padding: '60px', textAlign: 'center' }}>
                            <CreditCard size={64} style={{ color: '#ccc', marginBottom: '20px' }} />
                            <h3>{t('loyaltycards.vyberite_klienta', 'Выберите клиента')}</h3>
                            <p className="text-muted">{t('loyaltycards.vyberite_klienta_iz_spiska_sleva_dlya_pro', 'Выберите клиента из списка слева для просмотра и печати его накопительной карты')}</p>
                        </div>
                    )}
                </div>
            </div>

            {/* Модал настроек */}
            {showSettings && (
                <div className="modal-overlay" onClick={() => setShowSettings(false)}>
                    <div className="modal" onClick={e => e.stopPropagation()} style={{ maxWidth: '500px' }}>
                        <div className="modal-header">
                            <h2>{t('loyaltycards.nastroyki_programmy_loyalnosti', '⚙️ Настройки программы лояльности')}</h2>
                        </div>
                        <div className="modal-body">
                            <div className="form-group">
                                <label>{t('loyaltycards.keshbek_pct', 'Кэшбек (%)')}</label>
                                <input type="number" value={settings.cashback_percent} onChange={e => setSettings({ ...settings, cashback_percent: e.target.value })} />
                            </div>
                            <div className="form-group">
                                <label>{t('loyaltycards.minimalnaya_pokupka_dlya_nachisleniya', 'Минимальная покупка для начисления')}</label>
                                <input type="number" value={settings.min_purchase || 10000} onChange={e => setSettings({ ...settings, min_purchase: e.target.value })} />
                            </div>
                            <div className="form-group">
                                <label>{t('loyaltycards.privetstvennyy_bonus', 'Приветственный бонус')}</label>
                                <input type="number" value={settings.welcome_bonus || 1000} onChange={e => setSettings({ ...settings, welcome_bonus: e.target.value })} />
                            </div>
                            <div className="form-group">
                                <label>{t('loyaltycards.bonus_na_den_rozhdeniya', 'Бонус на день рождения')}</label>
                                <input type="number" value={settings.birthday_bonus || 5000} onChange={e => setSettings({ ...settings, birthday_bonus: e.target.value })} />
                            </div>
                        </div>
                        <div className="modal-footer">
                            <button className="btn btn-secondary" onClick={() => setShowSettings(false)}>{t('loyaltycards.otmena', 'Отмена')}</button>
                            <button className="btn btn-primary" onClick={() => { /* save settings */ setShowSettings(false); }}>
                                Сохранить
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Модал создания карты */}
            {showCreateCard && (
                <div className="modal-overlay" onClick={() => setShowCreateCard(false)}>
                    <div className="modal" onClick={e => e.stopPropagation()} style={{ maxWidth: '450px' }}>
                        <div className="modal-header">
                            <h2>{t('loyaltycards.novaya_karta_loyalnosti', '➕ Новая карта лояльности')}</h2>
                        </div>
                        <div className="modal-body">
                            <div className="form-group">
                                <label>{t('loyaltycards.fio_klienta', 'ФИО клиента *')}</label>
                                <input
                                    type="text"
                                    value={newCard.name}
                                    onChange={e => setNewCard({ ...newCard, name: e.target.value })}
                                    placeholder="Иванов Иван Иванович"
                                />
                            </div>
                            <div className="form-group">
                                <label>{t('loyaltycards.telefon', 'Телефон *')}</label>
                                <input
                                    type="tel"
                                    value={newCard.phone}
                                    onChange={e => setNewCard({ ...newCard, phone: e.target.value })}
                                    placeholder="+998 90 123 45 67"
                                />
                            </div>
                            <div className="form-group">
                                <label>Email</label>
                                <input
                                    type="email"
                                    value={newCard.email}
                                    onChange={e => setNewCard({ ...newCard, email: e.target.value })}
                                    placeholder="email@example.com"
                                />
                            </div>
                        </div>
                        <div className="modal-footer">
                            <button className="btn btn-secondary" onClick={() => setShowCreateCard(false)}>{t('loyaltycards.otmena', 'Отмена')}</button>
                            <button className="btn btn-primary" onClick={createCard}>
                                <Plus size={16} /> Создать карту
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Модал генерации баркодов */}
            {showBatchPrint && (
                <div className="modal-overlay" onClick={() => setShowBatchPrint(false)}>
                    <div className="modal" onClick={e => e.stopPropagation()} style={{ maxWidth: '450px' }}>
                        <div className="modal-header">
                            <h2>{t('loyaltycards.generatsiya_barkodov_dlya_pechati', '🖨️ Генерация баркодов для печати')}</h2>
                        </div>
                        <div className="modal-body">
                            <p>{t('loyaltycards.sozdayte_pustye_karty_s_unikalnymi_nome', 'Создайте пустые карты с уникальными номерами для печати и последующей выдачи клиентам.')}</p>
                            <div className="form-group">
                                <label>{t('loyaltycards.kolichestvo_kart', 'Количество карт')}</label>
                                <input
                                    type="number"
                                    min="1"
                                    max="100"
                                    value={batchCount}
                                    onChange={e => setBatchCount(parseInt(e.target.value) || 10)}
                                />
                            </div>
                            <div style={{ background: 'var(--bg-secondary)', padding: '12px', borderRadius: '8px', marginTop: '16px' }}>
                                <strong>{t('loyaltycards.suschestvuyuschie_karty', 'Существующие карты:')}</strong> {cards.length}<br />
                                <strong>{t('loyaltycards.budet_sozdano', 'Будет создано:')}</strong> {batchCount} новых карт
                            </div>
                        </div>
                        <div className="modal-footer">
                            <button className="btn btn-secondary" onClick={() => setShowBatchPrint(false)}>{t('loyaltycards.otmena', 'Отмена')}</button>
                            <button className="btn btn-primary" onClick={() => {
                                const newCards = generateBatchBarcodes();
                                printBatchCards(newCards);
                                setShowBatchPrint(false);
                            }}>
                                <Printer size={16} /> Создать и распечатать
                            </button>
                        </div>
                    </div>
                </div>
            )}
            {/* Модал списания баллов */}
            {showSpendModal && (
                <div className="modal-overlay" onClick={() => setShowSpendModal(false)}>
                    <div className="modal" onClick={e => e.stopPropagation()} style={{ maxWidth: '450px' }}>
                        <div className="modal-header">
                            <h2>{t('loyaltycards.spisanie_ballov', '➖ Списание баллов')}</h2>
                        </div>
                        <div className="modal-body">
                            <div style={{ background: 'var(--success-light)', padding: '16px', borderRadius: '12px', textAlign: 'center', marginBottom: '16px' }}>
                                <div style={{ fontSize: '14px', color: '#666' }}>{t('loyaltycards.tekuschiy_balans', 'Текущий баланс')}</div>
                                <div style={{ fontSize: '28px', fontWeight: 'bold', color: 'var(--success)' }}>
                                    {formatCurrency(cardData?.balance || 0)}
                                </div>
                                <div style={{ fontSize: '12px', color: '#888' }}>{selectedCustomer?.name}</div>
                            </div>
                            <div className="form-group">
                                <label>{t('loyaltycards.kolichestvo_ballov_dlya_spisaniya', 'Количество баллов для списания')}</label>
                                <input
                                    type="number"
                                    min="1"
                                    max={cardData?.balance || 0}
                                    value={spendAmount}
                                    onChange={e => setSpendAmount(e.target.value)}
                                    placeholder="Введите количество"
                                />
                            </div>
                            <div className="form-group">
                                <label>{t('loyaltycards.opisanie', 'Описание')}</label>
                                <input
                                    type="text"
                                    value={spendDescription}
                                    onChange={e => setSpendDescription(e.target.value)}
                                    placeholder="Оплата баллами, скидка..."
                                />
                            </div>
                        </div>
                        <div className="modal-footer">
                            <button className="btn btn-secondary" onClick={() => setShowSpendModal(false)}>{t('loyaltycards.otmena', 'Отмена')}</button>
                            <button className="btn btn-warning" style={{ color: '#fff' }} onClick={handleSpendPoints}>
                                ➖ Списать
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}

export default LoyaltyCards;
