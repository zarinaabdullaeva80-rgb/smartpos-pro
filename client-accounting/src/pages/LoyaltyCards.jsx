import React, { useState, useEffect, useRef } from 'react';
import { Search, CreditCard, Printer, QrCode, Download, User, Star, Gift, History, Settings, Plus, Trash2, CheckSquare, Square, FileSpreadsheet, Upload } from 'lucide-react';
import QRCode from 'react-qr-code';
import * as XLSX from 'xlsx';
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
    const [generatingBatch, setGeneratingBatch] = useState(false);
    const printRef = useRef();

    // Групповое удаление карт
    const [selectedCards, setSelectedCards] = useState(new Set());
    const [showDeleteModal, setShowDeleteModal] = useState(false);
    // Прикрепление клиента
    const [attachModal, setAttachModal] = useState(null); // { cardId, cardNumber }
    const [attachSearch, setAttachSearch] = useState('');
    const [barcodeImage, setBarcodeImage] = useState(null);

    // Списание баллов
    const [showSpendModal, setShowSpendModal] = useState(false);
    const [spendAmount, setSpendAmount] = useState('');
    const [spendDescription, setSpendDescription] = useState('');

    // История всех действий
    const [showAllHistory, setShowAllHistory] = useState(false);
    const [allTransactions, setAllTransactions] = useState([]);
    const [historyLoading, setHistoryLoading] = useState(false);
    const [historySearch, setHistorySearch] = useState('');
    const fileInputRef = useRef(null);

    // Сохранение карт в localStorage
    useEffect(() => {
        localStorage.setItem('loyalty_cards', JSON.stringify(cards));
    }, [cards]);

    useEffect(() => {
        loadCustomers();
        loadSettings();
    }, []);

    const loadAllHistory = async () => {
        setHistoryLoading(true);
        try {
            const res = await loyaltyAPI.getAllTransactions({ limit: 200 });
            setAllTransactions(res.data?.transactions || []);
        } catch (err) {
            console.error('Load all transactions error:', err);
            toast.error('Не удалось загрузить историю действий');
        } finally {
            setHistoryLoading(false);
        }
    };

    useEffect(() => {
        if (showAllHistory) {
            loadAllHistory();
        }
    }, [showAllHistory]);

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
            // Загружаем из /settings — там гарантированно есть card_logo, card_phone, card_text
            const response = await loyaltyAPI.getSettings();
            const s = response.data?.settings || response.data || {};
            // Дополним из /program для остальных полей (cashback_percent и т.д.)
            try {
                const progRes = await loyaltyAPI.getProgram();
                const prog = progRes.data?.settings || progRes.data || {};
                setSettings({ ...prog, ...s });
            } catch {
                setSettings(s);
            }
        } catch (error) {
            console.error('Error loading settings:', error);
            // Fallback
            try {
                const response = await loyaltyAPI.getProgram();
                setSettings(response.data?.settings || response.data || {});
            } catch (e) {
                console.error('Error loading program:', e);
            }
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
                    @page { size: A4; margin: 8mm; }
                    * { -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; color-adjust: exact !important; }
                    body { font-family: 'Segoe UI', Arial, sans-serif; margin: 0; padding: 0; }
                    .cards-grid { display: grid; grid-template-columns: repeat(2, 1fr); gap: 6mm; justify-content: center; }
                    .card-item {
                        width: 85.6mm; height: 53.98mm;
                        background: ${settings.card_logo ? `url(${settings.card_logo}) no-repeat center center / cover` : 'linear-gradient(135deg, #1e3a5f 0%, #2d5a87 50%, #1e3a5f 100%)'};
                        border-radius: 10px;
                        padding: 4mm 6mm;
                        box-sizing: border-box;
                        color: white;
                        position: relative;
                        page-break-inside: avoid;
                        overflow: hidden;
                        display: flex;
                        flex-direction: column;
                        justify-content: space-between;
                    }
                    .card-logo { font-size: 13px; font-weight: bold; }
                    .card-logo span { color: #ffd700; }
                    .card-number { font-size: 12px; font-family: monospace; letter-spacing: 2px; margin-top: 2mm; }
                    .card-owner { font-size: 9px; text-transform: uppercase; opacity: 0.9; }
                    .card-level { font-size: 8px; color: #ffd700; }
                    .barcode-box { background: white; padding: 0.5mm 1mm; border-radius: 4px; margin-top: 1mm; text-align: center; display: flex; justify-content: center; align-items: center; }
                    .barcode-box img { width: 100%; max-height: 12mm; object-fit: contain; }
                    .card-footer-row { display: flex; justify-content: space-between; align-items: center; font-size: 8px; opacity: 0.9; margin-top: 1mm; }
                    .card-cashback { background: rgba(255,215,0,0.2); padding: 0.5mm 2mm; border-radius: 2px; color: #ffd700; font-weight: bold; }
                </style>
            </head>
            <body>
                <div class="cards-grid">
                    ${cardsToprint.map(c => `
                        <div class="card-item">
                            <div>
                                <div style="display: flex; justify-content: space-between; align-items: center;">
                                    ${settings.card_logo ? 
                                        `<div></div>` : 
                                        `<div class="card-logo">SmartPOS <span>${t('loyaltycards.bonus', 'Бонус')}</span></div>`
                                    }
                                    <div class="card-level">${c.level}</div>
                                </div>
                                <div style="display: flex; justify-content: space-between; align-items: flex-end; margin-top: 1mm;">
                                    <div class="card-number">${c.number.replace(/(.{4})/g, '$1 ')}</div>
                                    ${settings.card_phone ? `<div style="font-size: 8px; opacity: 0.9;">📞 ${settings.card_phone}</div>` : ''}
                                </div>
                                <div style="display: flex; justify-content: space-between; align-items: flex-end; margin-top: 1.5mm;">
                                    <div class="card-owner">${c.name || '____________________'}</div>
                                    ${settings.card_text ? `<div style="font-size: 8px; opacity: 0.8; max-width: 40mm; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">${settings.card_text}</div>` : ''}
                                </div>
                            </div>
                            
                            <div class="barcode-box" style="margin-top: 2.5mm;">
                                ${c.barcode ? `<img src="${c.barcode}" alt="barcode" />` : '<div style="height:10mm;color:#999;font-size:8px">Barcode</div>'}
                            </div>

                            <div class="card-footer-row">
                                <div>Баланс: ${new Intl.NumberFormat('ru-RU').format(c.balance || 0)} баллов</div>
                                <div class="card-cashback">Кэшбек ${settings.cashback_percent || 2}%</div>
                            </div>
                        </div>
                    `).join('')}
                </div>
            </body>
            </html>
        `);
        printWindow.document.close();
        setTimeout(() => printWindow.print(), 500);
    };

    const selectCustomer = async (customer) => {
        setSelectedCustomer(customer);
        setBarcodeImage(null);
        try {
            // Загрузить данные карты
            const cardResponse = await loyaltyAPI.getCard(customer.id);
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

            // Загрузить транзакции с товарами
            const txResponse = await loyaltyAPI.getTransactions(customer.id);
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
                    * { -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; color-adjust: exact !important; }
                    body { margin: 0; padding: 0; font-family: 'Segoe UI', Arial, sans-serif; }
                    .card {
                        width: 85.6mm; height: 53.98mm;
                        background: ${settings.card_logo ? `url(${settings.card_logo}) no-repeat center center / cover` : 'linear-gradient(135deg, #0f172a 0%, #1e3a5f 40%, #2d5a87 70%, #1e3a5f 100%)'};
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
                        background: ${settings.card_logo ? 'transparent' : 'rgba(255,215,0,0.05)'};
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
                    <div style="display: flex; justify-content: space-between; align-items: center;">
                        ${settings.card_logo ? 
                            `<div></div>` : 
                            `<div class="logo">SmartPOS <span>${t('loyaltycards.bonus', 'Бонус')}</span></div>`
                        }
                        ${settings.card_phone ? `<div style="font-size: 8px; opacity: 0.9;">📞 ${settings.card_phone}</div>` : ''}
                    </div>
                    <div class="card-number">${formatCardNumber(cardData?.number || '')}</div>
                    <div style="display: flex; justify-content: space-between; align-items: flex-end;">
                        <div class="customer-name">${selectedCustomer?.name}</div>
                        ${settings.card_text ? `<div style="font-size: 8px; opacity: 0.8; max-width: 40mm; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">${settings.card_text}</div>` : ''}
                    </div>
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

    // Групповое удаление
    const toggleSelectCard = (id) => {
        setSelectedCards(prev => {
            const next = new Set(prev);
            if (next.has(id)) next.delete(id);
            else next.add(id);
            return next;
        });
    };

    const toggleSelectAll = () => {
        if (selectedCards.size === cards.length) {
            setSelectedCards(new Set());
        } else {
            setSelectedCards(new Set(cards.map(c => c.id)));
        }
    };

    const deleteSelectedCards = () => {
        setCards(prev => prev.filter(c => !selectedCards.has(c.id)));
        setSelectedCards(new Set());
        setShowDeleteModal(false);
        toast.success(`Удалено ${selectedCards.size} карт(ы)`);
    };

    const handleAttachCustomer = (customer) => {
        if (!attachModal) return;
        setCards(prev => prev.map(c =>
            c.id === attachModal.cardId
                ? { ...c, name: customer.name, phone: customer.phone || '', is_blank: false }
                : c
        ));
        toast.success(`Карта ${attachModal.cardNumber} прикреплена к ${customer.name}`);
        setAttachModal(null);
        setAttachSearch('');
    };

    const handleExportExcel = () => {
        try {
            // Экспортируем список карт из localStorage (cards), так как там находятся сгенерированные и привязанные карты
            const dataToExport = cards.map((c, idx) => ({
                '№': idx + 1,
                'Номер карты': c.number || '',
                'ФИО клиента': c.name || '—',
                'Телефон': c.phone || '—',
                'Email': c.email || '—',
                'Баллы (Баланс)': c.balance || 0,
                'Статус': c.is_blank ? 'Пустая' : 'Активная',
                'Дата создания': c.created_at ? new Date(c.created_at).toLocaleDateString('ru-RU') : ''
            }));

            // Если список карт в localStorage пуст, экспортируем клиентов с картами из CRM
            if (dataToExport.length === 0 && customers.length > 0) {
                const customersWithCards = customers.filter(cust => cust.card_number);
                customersWithCards.forEach((c, idx) => {
                    dataToExport.push({
                        '№': idx + 1,
                        'Номер карты': c.card_number || '',
                        'ФИО клиента': c.name || '',
                        'Телефон': c.phone || '',
                        'Email': c.email || '',
                        'Баллы (Баланс)': c.loyalty_points || 0,
                        'Статус': 'Активная',
                        'Дата создания': c.created_at ? new Date(c.created_at).toLocaleDateString('ru-RU') : ''
                    });
                });
            }

            if (dataToExport.length === 0) {
                toast.info('Нет данных для экспорта');
                return;
            }

            const worksheet = XLSX.utils.json_to_sheet(dataToExport);
            const workbook = XLSX.utils.book_new();
            XLSX.utils.book_append_sheet(workbook, worksheet, 'Карты лояльности');


            // Auto column width
            const maxLens = {};
            dataToExport.forEach(row => {
                Object.keys(row).forEach(key => {
                    const len = String(row[key] || '').length;
                    maxLens[key] = Math.max(maxLens[key] || 10, len);
                });
            });
            worksheet['!cols'] = Object.keys(maxLens).map(key => ({ wch: maxLens[key] + 3 }));

            // Save file
            const excelBuffer = XLSX.write(workbook, { bookType: 'xlsx', type: 'array' });
            const blob = new Blob([excelBuffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });

            const date = new Date().toISOString().split('T')[0];
            const fullFilename = `LoyaltyCards_${date}.xlsx`;

            if (window.electron && window.electron.saveFile) {
                const bytes = new Uint8Array(excelBuffer);
                let binary = '';
                for (let i = 0; i < bytes.byteLength; i++) {
                    binary += String.fromCharCode(bytes[i]);
                }
                const fileData = btoa(binary);
                window.electron.saveFile({
                    folder: 'exports',
                    filename: fullFilename,
                    data: fileData,
                    encoding: 'base64'
                }).then(res => {
                    if (res.success) {
                        const openFolder = confirm(`Файл сохранён:\n${res.path}\n\nОткрыть папку?`);
                        if (openFolder) {
                            const folderPath = res.path.substring(0, res.path.lastIndexOf('\\'));
                            window.electron.openFolder(folderPath);
                        }
                    } else {
                        toast.error(`Ошибка сохранения: ${res.error}`);
                    }
                });
            } else {
                const link = document.createElement('a');
                link.href = URL.createObjectURL(blob);
                link.download = fullFilename;
                link.click();
                URL.revokeObjectURL(link.href);
                toast.success('Экспорт завершён!');
            }
        } catch (err) {
            console.error('Export error:', err);
            toast.error('Ошибка экспорта Excel: ' + err.message);
        }
    };

    const handleImportExcel = (event) => {
        const file = event.target.files[0];
        if (!file) return;

        const reader = new FileReader();
        reader.onload = async (e) => {
            try {
                const data = new Uint8Array(e.target.result);
                const workbook = XLSX.read(data, { type: 'array' });
                const firstSheetName = workbook.SheetNames[0];
                const worksheet = workbook.Sheets[firstSheetName];
                const json = XLSX.utils.sheet_to_json(worksheet);

                if (json.length === 0) {
                    toast.info('Файл Excel пуст');
                    return;
                }

                const clientItems = [];
                const blankCards = [];

                json.forEach(row => {
                    const name = row['ФИО клиента'] || row['ФИО'] || row['Имя'] || row['name'] || row['Name'] || '';
                    const phone = row['Телефон'] || row['Телефонный номер'] || row['phone'] || row['Phone'] || '';
                    const email = row['Email'] || row['Почта'] || row['email'] || '';
                    const card_number = row['Номер карты'] || row['Карта'] || row['card_number'] || row['card'] || row['Штрих-код'] || row['Штрихкод'] || row['barcode'] || row['Barcode'] || '';
                    const points = row['Баллы (Баланс)'] || row['Баллы'] || row['Баланс'] || row['points'] || row['balance'] || 0;

                    const numStr = String(card_number).trim();

                    if (name && phone) {
                        clientItems.push({ name, phone, email, card_number: numStr, points });
                    } else if (numStr) {
                        blankCards.push({
                            id: Date.now() + Math.random(),
                            number: numStr,
                            name: '',
                            phone: '',
                            email: '',
                            level: 'Standard',
                            balance: 0,
                            earnedTotal: 0,
                            spentTotal: 0,
                            created_at: new Date().toISOString(),
                            is_blank: true
                        });
                    }
                });

                if (clientItems.length === 0 && blankCards.length === 0) {
                    toast.info('Не найдено подходящих данных (ФИО+Телефон для клиентов или Номер карты для пустых заготовок)');
                    return;
                }

                if (blankCards.length > 0) {
                    setCards(prev => {
                        const existingNumbers = new Set(prev.map(c => c.number));
                        const uniqueNew = blankCards.filter(c => !existingNumbers.has(c.number));
                        return [...prev, ...uniqueNew];
                    });
                    toast.success(`Импортировано пустых заготовок: ${blankCards.length}`);
                }

                if (clientItems.length > 0) {
                    toast.info(`Отправка ${clientItems.length} карт клиентов на сервер...`);
                    const response = await loyaltyAPI.importCards({ items: clientItems });

                    if (response.data?.success) {
                        toast.success(`Импорт карт клиентов завершён! Добавлено: ${response.data.imported || 0}, Обновлено: ${response.data.updated || 0}`);
                        loadCustomers();
                    } else {
                        toast.error('Ошибка импорта на сервере: ' + (response.data?.error || 'Неизвестная ошибка'));
                    }
                }
            } catch (err) {
                console.error('Import excel error:', err);
                toast.error('Ошибка чтения Excel: ' + err.message);
            }
        };
        reader.readAsArrayBuffer(file);
        event.target.value = '';
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
                <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
                    <input
                        ref={fileInputRef}
                        type="file"
                        accept=".xlsx,.xls"
                        onChange={handleImportExcel}
                        style={{ display: 'none' }}
                    />
                    <button className="btn btn-secondary" style={{ borderColor: '#10b981', color: '#10b981', background: 'transparent' }} onClick={() => fileInputRef.current?.click()}>
                        <Upload size={18} /> Импорт
                    </button>
                    <button className="btn btn-secondary" style={{ borderColor: '#3b82f6', color: '#3b82f6', background: 'transparent' }} onClick={handleExportExcel}>
                        <FileSpreadsheet size={18} /> Экспорт
                    </button>
                    <button className="btn btn-secondary" onClick={() => setShowAllHistory(true)}>
                        <History size={18} /> История действий
                    </button>
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
                                        background: settings.card_logo ? `url(${settings.card_logo}) no-repeat center center / cover` : 'linear-gradient(135deg, #1e3a5f 0%, #2d5a87 50%, #1e3a5f 100%)',
                                        borderRadius: '16px',
                                        padding: '24px',
                                        color: 'white',
                                        position: 'relative',
                                        boxShadow: '0 10px 40px rgba(0,0,0,0.3)',
                                        display: 'flex',
                                        flexDirection: 'column',
                                        justifyContent: 'space-between'
                                    }}>
                                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                            {!settings.card_logo ? (
                                                <div style={{ fontSize: '20px', fontWeight: 'bold' }}>
                                                    SmartPOS <span style={{ color: '#ffd700' }}>{t('loyaltycards.bonus', 'Бонус')}</span>
                                                </div>
                                            ) : (
                                                <div></div>
                                            )}
                                            {settings.card_phone && (
                                                <div style={{ fontSize: '11px', opacity: 0.9 }}>
                                                    📞 {settings.card_phone}
                                                </div>
                                            )}
                                        </div>
                                        <div style={{
                                            fontSize: '18px', letterSpacing: '3px',
                                            fontFamily: 'monospace', marginTop: '20px'
                                        }}>
                                            {formatCardNumber(cardData.number)}
                                        </div>
                                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', marginTop: '8px' }}>
                                            <div style={{ fontSize: '14px', textTransform: 'uppercase' }}>
                                                {selectedCustomer.name}
                                            </div>
                                            {settings.card_text && (
                                                <div style={{ fontSize: '11px', opacity: 0.8, maxWidth: '140px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                                    {settings.card_text}
                                                </div>
                                            )}
                                        </div>
                                        <div style={{ fontSize: '12px', color: '#ffd700', marginTop: '4px' }}>
                                            {cardData.level}
                                        </div>
                                        <div ref={printRef} style={{
                                            position: 'absolute', bottom: '16px', left: '16px', right: '16px',
                                            background: 'white', padding: '4px 6px', borderRadius: '6px',
                                            textAlign: 'center'
                                        }}>
                                            {barcodeImage ? (
                                                <img src={barcodeImage} alt="barcode" style={{ width: '100%', maxHeight: '45px', objectFit: 'contain' }} />
                                            ) : (
                                                <div style={{ color: '#999', fontSize: '11px', padding: '8px 0' }}>{t('loyaltycards.zagruzka', 'Загрузка barcode...')}</div>
                                            )}
                                        </div>
                                    </div>

                                    {/* Данные клиента на карте */}
                                    <div style={{ flex: 1 }}>
                                        <h3 style={{ marginTop: 0 }}>Данные карты</h3>
                                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px', marginBottom: '16px' }}>
                                            <div style={{ background: 'var(--bg-secondary)', padding: '12px', borderRadius: '10px' }}>
                                                <div style={{ fontSize: '11px', color: '#888' }}>ФИО</div>
                                                <div style={{ fontWeight: 600 }}>{selectedCustomer.name}</div>
                                            </div>
                                            <div style={{ background: 'var(--bg-secondary)', padding: '12px', borderRadius: '10px' }}>
                                                <div style={{ fontSize: '11px', color: '#888' }}>Телефон</div>
                                                <div style={{ fontWeight: 600 }}>{selectedCustomer.phone || '-'}</div>
                                            </div>
                                            <div style={{ background: 'var(--bg-secondary)', padding: '12px', borderRadius: '10px' }}>
                                                <div style={{ fontSize: '11px', color: '#888' }}>Номер карты</div>
                                                <div style={{ fontWeight: 600, fontFamily: 'monospace' }}>{formatCardNumber(cardData.number)}</div>
                                            </div>
                                            <div style={{ background: 'var(--bg-secondary)', padding: '12px', borderRadius: '10px' }}>
                                                <div style={{ fontSize: '11px', color: '#888' }}>Кэшбек</div>
                                                <div style={{ fontWeight: 600, color: '#ffd700' }}>{cardData.cashbackPercent || settings.cashback_percent || 2}%</div>
                                            </div>
                                        </div>
                                        <h3>{t('loyaltycards.statistika', 'Статистика')}</h3>
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
                                                    <th style={{ padding: '12px', textAlign: 'left' }}>Товары</th>
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
                                                                <span style={{ color: '#10b981' }}>{t('loyaltycards.nachislenie', '+ Начисление')}</span>
                                                            ) : (
                                                                <span style={{ color: '#ef4444' }}>{t('loyaltycards.spisanie', '- Списание')}</span>
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
                                                        <td style={{ padding: '12px', fontSize: '11px', color: '#888' }}>
                                                            {tx.sale_items && tx.sale_items.length > 0 ? (
                                                                <div>{tx.sale_items.map((si, j) => (
                                                                    <div key={j}>{si.product_name} x{si.quantity}</div>
                                                                ))}</div>
                                                            ) : '-'}
                                                        </td>
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

            {/* Модал генерации баркодов — полностью переделанный */}
            {showBatchPrint && (
                <div className="modal-overlay" onClick={() => { setShowBatchPrint(false); setSelectedCards(new Set()); }}>
                    <div className="modal" onClick={e => e.stopPropagation()} style={{ maxWidth: '700px', width: '95vw', display: 'flex', flexDirection: 'column', maxHeight: '90vh' }}>
                        <div className="modal-header">
                            <h2>🖨️ Генерация баркодов для печати</h2>
                        </div>

                        <div className="modal-body" style={{ overflowY: 'auto', flex: 1 }}>
                            {/* Инфо-блок */}
                            <div style={{ display: 'flex', gap: '12px', marginBottom: '16px', flexWrap: 'wrap' }}>
                                <div style={{ flex: 1, minWidth: '180px' }}>
                                    <label style={{ fontSize: '13px', color: 'var(--text-secondary)', display: 'block', marginBottom: '6px' }}>
                                        Количество новых карт для создания
                                    </label>
                                    <input
                                        type="number" min="1" max="100"
                                        value={batchCount}
                                        onChange={e => setBatchCount(parseInt(e.target.value) || 10)}
                                        style={{ width: '100%' }}
                                    />
                                </div>
                                <div style={{ background: 'var(--bg-secondary)', borderRadius: '8px', padding: '12px 16px', fontSize: '13px', display: 'flex', gap: '20px', alignItems: 'center', flex: 2 }}>
                                    <div><span style={{ color: '#888' }}>Всего карт:</span> <strong>{cards.length}</strong></div>
                                    <div><span style={{ color: '#888' }}>Выбрано:</span> <strong style={{ color: selectedCards.size > 0 ? '#e879f9' : 'inherit' }}>{selectedCards.size}</strong></div>
                                    <div><span style={{ color: '#888' }}>Будет создано:</span> <strong style={{ color: '#10b981' }}>{batchCount}</strong></div>
                                </div>
                            </div>

                            {/* Таблица */}
                            {cards.length > 0 && (
                                <div>
                                    {/* Топбар таблицы */}
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px', flexWrap: 'wrap' }}>
                                        <strong style={{ fontSize: '13px' }}>📋 Список баркодов:</strong>
                                        <div style={{ marginLeft: 'auto', display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
                                            {/* Выбрать все / снять */}
                                            <button
                                                className="btn btn-secondary"
                                                style={{ padding: '5px 12px', fontSize: '12px', display: 'flex', alignItems: 'center', gap: '4px' }}
                                                onClick={toggleSelectAll}
                                            >
                                                {selectedCards.size === cards.length
                                                    ? <><Square size={13} /> Снять всё</>
                                                    : <><CheckSquare size={13} /> Выбрать все</>}
                                            </button>
                                            {/* Печать выбранные */}
                                            <button
                                                className="btn"
                                                style={{
                                                    padding: '5px 12px', fontSize: '12px',
                                                    background: selectedCards.size > 0 ? '#10b981' : 'var(--bg-secondary)',
                                                    color: selectedCards.size > 0 ? 'white' : '#888',
                                                    display: 'flex', alignItems: 'center', gap: '4px',
                                                    cursor: selectedCards.size > 0 ? 'pointer' : 'not-allowed'
                                                }}
                                                disabled={generatingBatch || selectedCards.size === 0}
                                                onClick={async () => {
                                                    if (selectedCards.size === 0) return;
                                                    setGeneratingBatch(true);
                                                    try {
                                                        const toPrint = cards.filter(c => selectedCards.has(c.id));
                                                        const loaded = await Promise.all(toPrint.map(async c => {
                                                            try {
                                                                const res = await loyaltyAPI.generateBarcode(c.number);
                                                                return { ...c, barcode: res.data?.barcode };
                                                            } catch { return c; }
                                                        }));
                                                        printBatchCards(loaded);
                                                    } catch { toast.error('Ошибка печати'); }
                                                    finally { setGeneratingBatch(false); }
                                                }}
                                            >
                                                <Printer size={13} /> {selectedCards.size > 0 ? `Печать (${selectedCards.size})` : 'Печать выбранные'}
                                            </button>
                                            {/* Удалить выбранные */}
                                            <button
                                                className="btn"
                                                style={{
                                                    padding: '5px 12px', fontSize: '12px',
                                                    background: selectedCards.size > 0 ? '#ef4444' : 'var(--bg-secondary)',
                                                    color: selectedCards.size > 0 ? 'white' : '#888',
                                                    display: 'flex', alignItems: 'center', gap: '4px',
                                                    cursor: selectedCards.size > 0 ? 'pointer' : 'not-allowed'
                                                }}
                                                disabled={selectedCards.size === 0}
                                                onClick={() => selectedCards.size > 0 && setShowDeleteModal(true)}
                                            >
                                                <Trash2 size={13} /> {selectedCards.size > 0 ? `Удалить (${selectedCards.size})` : 'Удалить выбранные'}
                                            </button>
                                        </div>
                                    </div>

                                    {/* Таблица карт */}
                                    <div style={{ borderRadius: '8px', border: '1px solid rgba(255,255,255,0.08)', overflow: 'hidden' }}>
                                        <div style={{ maxHeight: '300px', overflowY: 'auto' }}>
                                            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
                                                <thead>
                                                    <tr style={{ position: 'sticky', top: 0, background: 'var(--bg-tertiary, #1e1e2e)', zIndex: 1 }}>
                                                        <th style={{ padding: '10px 12px', textAlign: 'center', borderBottom: '1px solid rgba(255,255,255,0.1)', width: '40px' }}>
                                                            <input
                                                                type="checkbox"
                                                                checked={selectedCards.size === cards.length && cards.length > 0}
                                                                onChange={toggleSelectAll}
                                                                style={{ cursor: 'pointer', width: '15px', height: '15px', accentColor: '#e879f9' }}
                                                            />
                                                        </th>
                                                        <th style={{ padding: '10px 8px', textAlign: 'left', borderBottom: '1px solid rgba(255,255,255,0.1)', color: '#aaa', fontWeight: 600, fontSize: '12px' }}>№</th>
                                                        <th style={{ padding: '10px 8px', textAlign: 'left', borderBottom: '1px solid rgba(255,255,255,0.1)', color: '#aaa', fontWeight: 600, fontSize: '12px' }}>НОМЕР КАРТЫ</th>
                                                        <th style={{ padding: '10px 8px', textAlign: 'left', borderBottom: '1px solid rgba(255,255,255,0.1)', color: '#aaa', fontWeight: 600, fontSize: '12px' }}>КЛИЕНТ</th>
                                                        <th style={{ padding: '10px 8px', textAlign: 'center', borderBottom: '1px solid rgba(255,255,255,0.1)', color: '#aaa', fontWeight: 600, fontSize: '12px' }}>ТИП</th>
                                                        <th style={{ padding: '10px 8px', textAlign: 'center', borderBottom: '1px solid rgba(255,255,255,0.1)', color: '#aaa', fontWeight: 600, fontSize: '12px' }}>ДЕЙСТВИЕ</th>
                                                    </tr>
                                                </thead>
                                                <tbody>
                                                    {cards.map((card, idx) => (
                                                        <tr
                                                            key={card.id || idx}
                                                            onClick={() => toggleSelectCard(card.id)}
                                                            style={{
                                                                borderBottom: '1px solid rgba(255,255,255,0.04)',
                                                                cursor: 'pointer',
                                                                background: selectedCards.has(card.id)
                                                                    ? 'rgba(232,121,249,0.08)'
                                                                    : idx % 2 === 0 ? 'rgba(255,255,255,0.01)' : 'transparent',
                                                                transition: 'background 0.1s'
                                                            }}
                                                        >
                                                            <td style={{ padding: '8px 12px', textAlign: 'center' }}>
                                                                <input
                                                                    type="checkbox"
                                                                    checked={selectedCards.has(card.id)}
                                                                    onChange={() => toggleSelectCard(card.id)}
                                                                    onClick={e => e.stopPropagation()}
                                                                    style={{ cursor: 'pointer', width: '15px', height: '15px', accentColor: '#e879f9' }}
                                                                />
                                                            </td>
                                                            <td style={{ padding: '8px 8px', color: '#666', fontSize: '12px' }}>{idx + 1}</td>
                                                            <td style={{ padding: '8px 8px', fontFamily: 'monospace', fontWeight: 700, color: '#e879f9', letterSpacing: '1px', fontSize: '12px' }}>
                                                                {card.number}
                                                            </td>
                                                            <td style={{ padding: '8px 8px' }}>
                                                                {card.name ? (
                                                                    <span style={{ color: '#ddd', fontSize: '12px' }}>{card.name}</span>
                                                                ) : (
                                                                    <span style={{ color: '#555', fontSize: '12px', fontStyle: 'italic' }}>не прикреплена</span>
                                                                )}
                                                            </td>
                                                            <td style={{ padding: '8px 8px', textAlign: 'center' }}>
                                                                <span style={{
                                                                    padding: '2px 8px', borderRadius: '4px', fontSize: '11px', fontWeight: 600,
                                                                    background: card.is_blank ? 'rgba(251,191,36,0.15)' : 'rgba(16,185,129,0.15)',
                                                                    color: card.is_blank ? '#fbbf24' : '#10b981'
                                                                }}>
                                                                    {card.is_blank ? 'Пустая' : 'Активная'}
                                                                </span>
                                                            </td>
                                                            <td style={{ padding: '8px 8px', textAlign: 'center' }} onClick={e => e.stopPropagation()}>
                                                                <button
                                                                    style={{
                                                                        padding: '3px 10px', borderRadius: '6px', fontSize: '11px',
                                                                        background: 'rgba(99,102,241,0.15)', color: '#818cf8',
                                                                        border: '1px solid rgba(99,102,241,0.3)', cursor: 'pointer',
                                                                        display: 'flex', alignItems: 'center', gap: '4px', whiteSpace: 'nowrap'
                                                                    }}
                                                                    onClick={() => {
                                                                        setAttachModal({ cardId: card.id, cardNumber: card.number });
                                                                        setAttachSearch('');
                                                                    }}
                                                                >
                                                                    <User size={11} /> {card.name ? 'Изменить' : 'Прикрепить'}
                                                                </button>
                                                            </td>
                                                        </tr>
                                                    ))}
                                                </tbody>
                                            </table>
                                        </div>
                                    </div>

                                    {/* Подсказка о выбранных */}
                                    {selectedCards.size > 0 && (
                                        <div style={{ marginTop: '8px', fontSize: '12px', color: '#e879f9', display: 'flex', alignItems: 'center', gap: '6px' }}>
                                            <CheckSquare size={13} /> Выбрано: {selectedCards.size} из {cards.length}
                                        </div>
                                    )}
                                </div>
                            )}
                        </div>

                        {/* Футер — всегда виден */}
                        <div className="modal-footer" style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', borderTop: '1px solid rgba(255,255,255,0.08)', paddingTop: '12px' }}>
                            <button className="btn btn-secondary" onClick={() => { setShowBatchPrint(false); setSelectedCards(new Set()); }} disabled={generatingBatch}>
                                Отмена
                            </button>

                            {/* Удалить выбранные — всегда виден, но дизейблирован если нет выбора */}
                            <button
                                className="btn"
                                style={{
                                    background: selectedCards.size > 0 ? '#ef4444' : 'rgba(239,68,68,0.15)',
                                    color: selectedCards.size > 0 ? 'white' : '#ef4444',
                                    border: '1px solid rgba(239,68,68,0.3)',
                                    opacity: selectedCards.size > 0 ? 1 : 0.5,
                                    display: 'flex', alignItems: 'center', gap: '6px'
                                }}
                                disabled={selectedCards.size === 0}
                                onClick={() => selectedCards.size > 0 && setShowDeleteModal(true)}
                            >
                                <Trash2 size={16} />
                                {selectedCards.size > 0 ? `Удалить выбранные (${selectedCards.size})` : 'Удалить выбранные'}
                            </button>

                            {/* Печать все существующие */}
                            {cards.length > 0 && (
                                <button
                                    className="btn"
                                    style={{ background: '#10b981', color: 'white', display: 'flex', alignItems: 'center', gap: '6px' }}
                                    disabled={generatingBatch}
                                    onClick={async () => {
                                        setGeneratingBatch(true);
                                        try {
                                            const toPrint = selectedCards.size > 0
                                                ? cards.filter(c => selectedCards.has(c.id))
                                                : cards;
                                            const loaded = await Promise.all(toPrint.map(async c => {
                                                try {
                                                    const res = await loyaltyAPI.generateBarcode(c.number);
                                                    return { ...c, barcode: res.data?.barcode };
                                                } catch { return c; }
                                            }));
                                            printBatchCards(loaded);
                                        } catch { toast.error('Ошибка печати'); }
                                        finally { setGeneratingBatch(false); }
                                    }}
                                >
                                    <Printer size={16} />
                                    {generatingBatch ? 'Загрузка...' : selectedCards.size > 0
                                        ? `Печать выбранные (${selectedCards.size})`
                                        : `Печать все (${cards.length})`}
                                </button>
                            )}

                            {/* Создать и распечатать новые */}
                            <button
                                className="btn btn-primary"
                                style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: '6px' }}
                                disabled={generatingBatch}
                                onClick={async () => {
                                    setGeneratingBatch(true);
                                    try {
                                        const newCards = generateBatchBarcodes();
                                        const loaded = await Promise.all(newCards.map(async c => {
                                            try {
                                                const res = await loyaltyAPI.generateBarcode(c.number);
                                                return { ...c, barcode: res.data?.barcode };
                                            } catch { return c; }
                                        }));
                                        printBatchCards(loaded);
                                        setShowBatchPrint(false);
                                    } catch { toast.error('Ошибка генерации'); }
                                    finally { setGeneratingBatch(false); }
                                }}
                            >
                                <Printer size={16} />
                                {generatingBatch ? 'Генерация...' : `Создать +${batchCount} и распечатать`}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Модал прикрепления клиента к карте */}
            {attachModal && (
                <div className="modal-overlay" onClick={() => { setAttachModal(null); setAttachSearch(''); }}>
                    <div className="modal" onClick={e => e.stopPropagation()} style={{ maxWidth: '460px' }}>
                        <div className="modal-header">
                            <div>
                                <h2><User size={18} style={{ verticalAlign: 'middle', marginRight: '8px' }} />Прикрепить клиента</h2>
                                <div style={{ fontSize: '12px', color: '#aaa', marginTop: '4px' }}>
                                    Карта: <span style={{ fontFamily: 'monospace', color: '#e879f9' }}>{attachModal.cardNumber}</span>
                                </div>
                            </div>
                        </div>
                        <div className="modal-body">
                            <div style={{ position: 'relative', marginBottom: '12px' }}>
                                <Search size={16} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: '#888' }} />
                                <input
                                    type="text"
                                    placeholder="Поиск по имени или телефону..."
                                    value={attachSearch}
                                    onChange={e => setAttachSearch(e.target.value)}
                                    autoFocus
                                    style={{ width: '100%', paddingLeft: '38px' }}
                                />
                            </div>
                            <div style={{ maxHeight: '320px', overflowY: 'auto', borderRadius: '8px', border: '1px solid rgba(255,255,255,0.08)' }}>
                                {customers
                                    .filter(c =>
                                        !attachSearch ||
                                        c.name?.toLowerCase().includes(attachSearch.toLowerCase()) ||
                                        c.phone?.includes(attachSearch)
                                    )
                                    .slice(0, 50)
                                    .map(c => (
                                        <div
                                            key={c.id}
                                            onClick={() => handleAttachCustomer(c)}
                                            style={{
                                                padding: '12px 16px',
                                                borderBottom: '1px solid rgba(255,255,255,0.05)',
                                                cursor: 'pointer',
                                                display: 'flex', alignItems: 'center', gap: '12px',
                                                transition: 'background 0.1s'
                                            }}
                                            onMouseEnter={e => e.currentTarget.style.background = 'rgba(255,255,255,0.05)'}
                                            onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                                        >
                                            <div style={{
                                                width: '36px', height: '36px', borderRadius: '50%',
                                                background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                                                display: 'flex', alignItems: 'center', justifyContent: 'center',
                                                color: 'white', fontWeight: 'bold', fontSize: '14px', flexShrink: 0
                                            }}>
                                                {c.name?.[0]?.toUpperCase() || '?'}
                                            </div>
                                            <div style={{ flex: 1 }}>
                                                <div style={{ fontWeight: 600, fontSize: '14px' }}>{c.name}</div>
                                                <div style={{ fontSize: '12px', color: '#888' }}>{c.phone || '—'}</div>
                                            </div>
                                            <div style={{ fontSize: '12px', color: '#10b981' }}>
                                                {c.loyalty_points ? `${c.loyalty_points} б.` : ''}
                                            </div>
                                        </div>
                                    ))
                                }
                                {customers.filter(c =>
                                    !attachSearch ||
                                    c.name?.toLowerCase().includes(attachSearch.toLowerCase()) ||
                                    c.phone?.includes(attachSearch)
                                ).length === 0 && (
                                    <div style={{ padding: '30px', textAlign: 'center', color: '#666' }}>
                                        Клиенты не найдены
                                    </div>
                                )}
                            </div>
                        </div>
                        <div className="modal-footer">
                            <button className="btn btn-secondary" onClick={() => { setAttachModal(null); setAttachSearch(''); }}>Отмена</button>
                        </div>
                    </div>
                </div>
            )}
            {/* Модал подтверждения удаления */}
            {showDeleteModal && (
                <div className="modal-overlay" onClick={() => setShowDeleteModal(false)}>
                    <div className="modal" onClick={e => e.stopPropagation()} style={{ maxWidth: '400px' }}>
                        <div className="modal-header" style={{ background: 'rgba(239,68,68,0.1)', borderBottom: '1px solid rgba(239,68,68,0.2)' }}>
                            <h2 style={{ color: '#ef4444' }}>🗑️ Удаление карт</h2>
                        </div>
                        <div className="modal-body">
                            <p style={{ fontSize: '15px', marginBottom: '12px' }}>
                                Вы уверены, что хотите удалить <strong style={{ color: '#ef4444' }}>{selectedCards.size}</strong> карт(ы)?
                            </p>
                            <div style={{ background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.2)', borderRadius: '8px', padding: '12px', fontSize: '13px', color: '#f87171' }}>
                                ⚠️ Это действие удалит выбранные карты из локального хранилища. Восстановить их будет невозможно.
                                Карты клиентов в базе данных не затрагиваются — удаляются только заготовки для печати.
                            </div>
                        </div>
                        <div className="modal-footer">
                            <button className="btn btn-secondary" onClick={() => setShowDeleteModal(false)}>Отмена</button>
                            <button
                                className="btn"
                                style={{ background: '#ef4444', color: 'white' }}
                                onClick={deleteSelectedCards}
                            >
                                <Trash2 size={16} /> Удалить {selectedCards.size} карт(ы)
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
            {/* Модал истории всех действий */}
            {showAllHistory && (
                <div className="modal-overlay" onClick={() => setShowAllHistory(false)}>
                    <div className="modal" onClick={e => e.stopPropagation()} style={{ maxWidth: '850px', width: '95vw', maxHeight: '85vh', display: 'flex', flexDirection: 'column' }}>
                        <div className="modal-header">
                            <h2>📜 История действий по картам лояльности</h2>
                        </div>
                        <div className="modal-body" style={{ flex: 1, overflowY: 'auto' }}>
                            <div style={{ display: 'flex', gap: '10px', marginBottom: '16px', alignItems: 'center' }}>
                                <div style={{ position: 'relative', flex: 1 }}>
                                    <Search size={16} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: '#888' }} />
                                    <input
                                        type="text"
                                        placeholder="Поиск по имени клиента, телефону или карте..."
                                        value={historySearch}
                                        onChange={e => setHistorySearch(e.target.value)}
                                        style={{ paddingLeft: '38px', width: '100%' }}
                                    />
                                </div>
                                <button className="btn btn-secondary" onClick={loadAllHistory} disabled={historyLoading}>
                                    Обновить
                                </button>
                            </div>

                            {historyLoading ? (
                                <div style={{ padding: '60px', textAlign: 'center', color: '#888' }}>
                                    Загрузка истории операций...
                                </div>
                            ) : allTransactions.length === 0 ? (
                                <div style={{ padding: '60px', textAlign: 'center', color: '#888' }}>
                                    История операций пуста
                                </div>
                            ) : (
                                <div style={{ border: '1px solid rgba(255,255,255,0.08)', borderRadius: '8px', overflow: 'hidden' }}>
                                    <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
                                        <thead>
                                            <tr style={{ background: 'var(--bg-secondary)', borderBottom: '1px solid rgba(255,255,255,0.1)' }}>
                                                <th style={{ padding: '12px 16px', textAlign: 'left' }}>Дата</th>
                                                <th style={{ padding: '12px 16px', textAlign: 'left' }}>Клиент</th>
                                                <th style={{ padding: '12px 16px', textAlign: 'left' }}>Карта</th>
                                                <th style={{ padding: '12px 16px', textAlign: 'left' }}>Тип</th>
                                                <th style={{ padding: '12px 16px', textAlign: 'right' }}>Баллы</th>
                                                <th style={{ padding: '12px 16px', textAlign: 'left' }}>Описание</th>
                                                <th style={{ padding: '12px 16px', textAlign: 'left' }}>Оператор</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {allTransactions
                                                .filter(tx => {
                                                    const s = historySearch.toLowerCase();
                                                    return !s ||
                                                        tx.customer_name?.toLowerCase().includes(s) ||
                                                        tx.customer_phone?.includes(s) ||
                                                        tx.card_number?.includes(s) ||
                                                        tx.description?.toLowerCase().includes(s);
                                                })
                                                .map((tx, idx) => (
                                                    <tr key={idx} style={{ borderBottom: '1px solid rgba(255,255,255,0.04)', background: idx % 2 === 0 ? 'rgba(255,255,255,0.01)' : 'transparent' }}>
                                                        <td style={{ padding: '12px 16px', whiteSpace: 'nowrap' }}>
                                                            {new Date(tx.created_at).toLocaleString('ru-RU')}
                                                        </td>
                                                        <td style={{ padding: '12px 16px' }}>
                                                            <div style={{ fontWeight: 600 }}>{tx.customer_name}</div>
                                                            <div style={{ fontSize: '11px', color: '#888' }}>{tx.customer_phone}</div>
                                                        </td>
                                                        <td style={{ padding: '12px 16px', fontFamily: 'monospace' }}>
                                                            {tx.card_number ? formatCardNumber(tx.card_number) : '—'}
                                                        </td>
                                                        <td style={{ padding: '12px 16px' }}>
                                                            {tx.transaction_type === 'earn' ? (
                                                                <span style={{ color: '#10b981', background: 'rgba(16,185,129,0.12)', padding: '2px 8px', borderRadius: '4px', fontSize: '11px', fontWeight: 600 }}>
                                                                    Начисление
                                                                </span>
                                                            ) : (
                                                                <span style={{ color: '#ef4444', background: 'rgba(239,68,68,0.12)', padding: '2px 8px', borderRadius: '4px', fontSize: '11px', fontWeight: 600 }}>
                                                                    Списание
                                                                </span>
                                                            )}
                                                        </td>
                                                        <td style={{ padding: '12px 16px', textAlign: 'right', fontWeight: 'bold', color: tx.points > 0 ? '#10b981' : '#ef4444' }}>
                                                            {tx.points > 0 ? `+${tx.points}` : tx.points}
                                                        </td>
                                                        <td style={{ padding: '12px 16px', color: '#ccc' }}>
                                                            {tx.description}
                                                            {tx.sale_items && tx.sale_items.length > 0 && (
                                                                <div style={{ fontSize: '11px', color: '#888', marginTop: '4px' }}>
                                                                    {tx.sale_items.map((it, i) => `${it.product_name} x${it.quantity}`).join(', ')}
                                                                </div>
                                                            )}
                                                        </td>
                                                        <td style={{ padding: '12px 16px', color: '#888' }}>
                                                            {tx.created_by_name || 'Система'}
                                                        </td>
                                                    </tr>
                                                ))
                                            }
                                        </tbody>
                                    </table>
                                </div>
                            )}
                        </div>
                        <div className="modal-overlay-footer" style={{ display: 'flex', justifyContent: 'flex-end', padding: '12px 20px', borderTop: '1px solid rgba(255,255,255,0.08)' }}>
                            <button className="btn btn-secondary" onClick={() => setShowAllHistory(false)}>Закрыть</button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}

export default LoyaltyCards;
