import React, { useRef, forwardRef } from 'react';
import { useReactToPrint } from 'react-to-print';
import { Printer, X } from 'lucide-react';
import { QRCodeSVG } from 'qrcode.react';

/**
 * ReceiptPrinter - компонент для печати кассового чека
 * Поддерживает: термопринтеры 57mm и 80mm
 */

// Компонент чека для печати
const ReceiptContent = forwardRef(({ sale, companyInfo, size, settings }, ref) => {
    const receiptWidth = size === 'thermal57' ? '57mm' : '80mm';

    const formatCurrency = (value) => {
        return new Intl.NumberFormat('ru-RU').format(value || 0) + ' сум';
    };

    const formatDate = (dateStr) => {
        const date = new Date(dateStr);
        return date.toLocaleString('ru-RU', {
            day: '2-digit',
            month: '2-digit',
            year: 'numeric',
            hour: '2-digit',
            minute: '2-digit'
        });
    };

    // Генерация данных для QR-кода (base64 placeholder - в реальности используйте qrcode library)
    const qrData = `CHECK:${sale?.document_number || '000'}|DATE:${sale?.document_date}|SUM:${sale?.final_amount || 0}`;

    return (
        <div
            ref={ref}
            style={{
                width: receiptWidth,
                fontFamily: 'monospace',
                fontSize: '12px',
                padding: '5mm',
                background: 'white',
                color: 'black'
            }}
        >
            {/* === ШАПКА: Информация о компании === */}
            <div style={{ textAlign: 'center', marginBottom: '10px' }}>
                {/* Логотип (если есть) */}
                {companyInfo?.logo && (
                    <div style={{ marginBottom: '5px' }}>
                        <img src={companyInfo.logo} alt="logo" style={{ maxHeight: '30px' }} />
                    </div>
                )}

                {/* Тип организации и название */}
                <div style={{ fontSize: '10px', color: '#666' }}>
                    {companyInfo?.orgType || 'ООО'}
                </div>
                <div style={{ fontSize: '14px', fontWeight: 'bold' }}>
                    {companyInfo?.name || 'Название организации'}
                </div>

                {/* Адрес */}
                <div style={{ fontSize: '10px', marginTop: '3px' }}>
                    📍 {companyInfo?.address || 'Адрес не указан'}
                </div>

                {/* ИНН / ПИНФЛ */}
                <div style={{ fontSize: '10px' }}>
                    ИНН: {companyInfo?.inn || '000000000'}
                </div>

                {/* Контакты */}
                {(companyInfo?.phone || companyInfo?.website) && (
                    <div style={{ fontSize: '10px', marginTop: '3px' }}>
                        {companyInfo?.phone && <span>📞 {companyInfo.phone}</span>}
                        {companyInfo?.phone && companyInfo?.website && <span> | </span>}
                        {companyInfo?.website && <span>🌐 {companyInfo.website}</span>}
                    </div>
                )}
            </div>

            <div style={{ borderTop: '1px dashed black', margin: '5px 0' }}></div>

            {/* === ИНФОРМАЦИЯ О ЧЕКЕ === */}
            <div style={{ fontSize: '11px', marginBottom: '5px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span><strong>Чек №:</strong></span>
                    <span>{sale?.document_number || '—'}</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span><strong>Дата:</strong></span>
                    <span>{formatDate(sale?.document_date)}</span>
                </div>

                {/* Номер смены */}
                {sale?.shift_number && (
                    <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                        <span><strong>Смена №:</strong></span>
                        <span>{sale.shift_number}</span>
                    </div>
                )}

                {/* Кассир */}
                {(sale?.cashier_name || sale?.seller_name) && (
                    <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                        <span><strong>Кассир:</strong></span>
                        <span>{sale.cashier_name || sale.seller_name}</span>
                    </div>
                )}

                {/* Покупатель */}
                {sale?.counterparty_name && (
                    <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                        <span><strong>Покупатель:</strong></span>
                        <span>{sale.counterparty_name}</span>
                    </div>
                )}
            </div>

            <div style={{ borderTop: '1px dashed black', margin: '5px 0' }}></div>

            {/* === ТОВАРЫ === */}
            <table style={{ width: '100%', fontSize: '11px', borderCollapse: 'collapse' }}>
                <tbody>
                    {(sale?.items || []).map((item, index) => (
                        <tr key={index}>
                            <td style={{ paddingBottom: '3px' }}>
                                <div style={{ fontWeight: 'bold' }}>
                                    {item.product_name || `Товар ${index + 1}`}
                                </div>
                                <div style={{ fontSize: '10px', color: '#666' }}>
                                    {item.quantity} × {formatCurrency(item.price)}
                                </div>
                            </td>
                            <td style={{ textAlign: 'right', fontWeight: 'bold', verticalAlign: 'top' }}>
                                {formatCurrency(item.quantity * item.price)}
                            </td>
                        </tr>
                    ))}
                </tbody>
            </table>

            <div style={{ borderTop: '1px dashed black', margin: '5px 0' }}></div>

            {/* === ИТОГИ === */}
            <div style={{ fontSize: '11px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span>Позиций:</span>
                    <span>{sale?.items?.length || 0}</span>
                </div>
                {sale?.discount_amount > 0 && (
                    <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                        <span>Скидка:</span>
                        <span>-{formatCurrency(sale.discount_amount)}</span>
                    </div>
                )}
                {sale?.vat_amount > 0 && (
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '10px' }}>
                        <span>В т.ч. НДС:</span>
                        <span>{formatCurrency(sale.vat_amount)}</span>
                    </div>
                )}
            </div>

            <div style={{
                borderTop: '2px solid black',
                margin: '5px 0',
                paddingTop: '5px'
            }}>
                <div style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    fontSize: '14px',
                    fontWeight: 'bold'
                }}>
                    <span>ИТОГО:</span>
                    <span>{formatCurrency(sale?.final_amount || sale?.total_amount)}</span>
                </div>
            </div>

            {/* === СПОСОБ ОПЛАТЫ === */}
            <div style={{ fontSize: '10px', marginTop: '5px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span>Оплата:</span>
                    <span style={{ fontWeight: 'bold' }}>
                        {sale?.payment_method === 'card' ? '💳 Карта' :
                            sale?.payment_method === 'transfer' ? '🏦 Перевод' : '💵 Наличные'}
                    </span>
                </div>
                {sale?.amount_received > 0 && sale?.payment_method === 'cash' && (
                    <>
                        <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                            <span>Получено:</span>
                            <span>{formatCurrency(sale.amount_received)}</span>
                        </div>
                        <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                            <span>Сдача:</span>
                            <span>{formatCurrency(sale.amount_received - (sale?.final_amount || sale?.total_amount))}</span>
                        </div>
                    </>
                )}
            </div>

            <div style={{ borderTop: '1px dashed black', margin: '10px 0' }}></div>

            {/* === СЕРИЙНЫЙ НОМЕР ККМ === */}
            {companyInfo?.kkmSerial && (
                <div style={{ fontSize: '9px', textAlign: 'center', marginBottom: '5px' }}>
                    ККМ: {companyInfo.kkmSerial}
                </div>
            )}

            {/* === QR-КОД ДЛЯ ПРОВЕРКИ === */}
            <div style={{ textAlign: 'center', margin: '10px 0' }}>
                <div style={{
                    display: 'inline-block',
                    padding: '8px',
                    background: '#f0f0f0',
                    borderRadius: '4px'
                }}>
                    {/* QR-код для проверки чека */}
                    <QRCodeSVG
                        value={qrData}
                        size={60}
                        level="M"
                        includeMargin={false}
                    />
                    <div style={{ fontSize: '8px', marginTop: '4px', color: '#666' }}>
                        Сканируйте для проверки
                    </div>
                </div>
            </div>

            {/* === ФУТЕР === */}
            <div style={{ textAlign: 'center', fontSize: '10px' }}>
                <div style={{ fontWeight: 'bold' }}>{settings?.promoText?.split('\n')[0] || 'Спасибо за покупку!'}</div>
                {settings?.promoText?.split('\n').slice(1).map((line, i) => (
                    <div key={i} style={{ fontSize: '9px' }}>{line}</div>
                ))}

                {/* Рекламный текст (настраивается клиентом) */}
                {settings?.promoText && (
                    <div style={{
                        marginTop: '8px',
                        padding: '5px',
                        background: '#f5f5f5',
                        borderRadius: '4px',
                        fontSize: '9px'
                    }}>
                        {settings.promoText}
                    </div>
                )}

                <div style={{ marginTop: '8px', color: '#666', fontSize: '9px' }}>
                    {formatDate(new Date().toISOString())}
                </div>
            </div>
        </div>
    );
});


ReceiptContent.displayName = 'ReceiptContent';

// Основной компонент
function ReceiptPrinter({ sale, onClose, isOpen, autoPrint = false }) {
    const printRef = useRef();
    const [size, setSize] = React.useState('thermal80');

    // Информация о компании (загружается из настроек)
    const [companyInfo, setCompanyInfo] = React.useState({
        orgType: 'ООО',
        name: '',
        address: '',
        inn: '',
        phone: '',
        website: '',
        kkmSerial: '',
        logo: null
    });

    // Настройки чека (настраивает клиент)
    const [receiptSettings, setReceiptSettings] = React.useState({
        promoText: '',             // Рекламный текст (пустой по умолчанию)
        showQR: true,
        showKKM: true
    });

    // Загрузка настроек из localStorage и сервера при монтировании
    React.useEffect(() => {
        let loaded = false;

        // Загрузить настройки чека из localStorage
        const savedReceiptSettings = localStorage.getItem('receiptSettings');
        if (savedReceiptSettings) {
            try {
                const parsed = JSON.parse(savedReceiptSettings);
                // Преобразовать в формат для печати
                setCompanyInfo({
                    orgType: parsed.header_org_type || 'ООО',
                    name: parsed.header_company_name || 'SmartPOS Pro',
                    address: parsed.header_address || '',
                    inn: parsed.header_inn || '',
                    phone: parsed.header_phone || '',
                    website: parsed.header_website || '',
                    kkmSerial: parsed.kkm_serial || '',
                    logo: parsed.header_logo_url || null // Используем logo_url если есть
                });
                setReceiptSettings({
                    promoText: parsed.footer_text || '',
                    showQR: parsed.footer_qr_enabled !== false,
                    showKKM: !!parsed.kkm_serial
                });
                loaded = true;
            } catch (e) { }
        }

        // Проверить торговые точки - если есть точка по умолчанию, использовать её
        const savedStores = localStorage.getItem('storeLocations');
        if (savedStores) {
            try {
                const stores = JSON.parse(savedStores);
                const defaultStore = stores.find(s => s.is_default) || stores[0];
                if (defaultStore) {
                    setCompanyInfo(prev => ({
                        ...prev,
                        orgType: defaultStore.org_type || prev.orgType,
                        name: defaultStore.name || prev.name,
                        address: defaultStore.address || prev.address,
                        inn: defaultStore.inn || prev.inn,
                        phone: defaultStore.phone || prev.phone,
                        website: defaultStore.website || prev.website,
                        kkmSerial: defaultStore.kkm_serial || prev.kkmSerial
                    }));
                    loaded = true;
                }
            } catch (e) { }
        }

        // Если localStorage пуст — загрузить с сервера
        if (!loaded) {
            const token = localStorage.getItem('token');
            if (token) {
                const apiUrl = localStorage.getItem('serverUrl') || window.__API_URL__ || '';
                const baseUrl = apiUrl || (window.location.origin + '/api');
                fetch(`${baseUrl}/settings/receipt/config`, {
                    headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' }
                })
                    .then(r => r.json())
                    .then(data => {
                        if (data && (data.header_company_name || data.header_address)) {
                            setCompanyInfo({
                                orgType: data.header_org_type || 'ООО',
                                name: data.header_company_name || '',
                                address: data.header_address || '',
                                inn: data.header_inn || '',
                                phone: data.header_phone || '',
                                website: data.header_website || '',
                                kkmSerial: data.kkm_serial || '',
                                logo: data.header_logo_url || null
                            });
                            setReceiptSettings({
                                promoText: data.footer_text || '',
                                showQR: data.footer_qr_enabled !== false,
                                showKKM: !!data.kkm_serial
                            });
                            // Cache in localStorage for future use
                            localStorage.setItem('receiptSettings', JSON.stringify(data));
                        }
                    })
                    .catch(() => { /* server unavailable, use defaults */ });
            }
        }
    }, []);

    const handlePrint = useReactToPrint({
        contentRef: printRef,
        documentTitle: `Чек_${sale?.document_number}`,
        pageStyle: `
            @page {
                size: ${size === 'thermal57' ? '57mm' : '80mm'} auto;
                margin: 0;
            }
            @media print {
                body {
                    margin: 0;
                    padding: 0;
                }
            }
        `
    });

    // Автоматическая печать
    React.useEffect(() => {
        if (autoPrint && isOpen && sale) {
            const timer = setTimeout(() => {
                handlePrint();
            }, 500);
            return () => clearTimeout(timer);
        }
    }, [autoPrint, isOpen, sale]);

    if (!isOpen || !sale) return null;

    return (
        <div className="modal-overlay" onClick={onClose}>
            <div className="modal glass" onClick={e => e.stopPropagation()} style={{ maxWidth: '450px' }}>
                <div className="modal-header">
                    <h2>🧾 Печать чека</h2>
                    <button onClick={onClose} className="btn-close">
                        <X size={20} />
                    </button>
                </div>

                <div className="modal-body">
                    {/* Настройки */}
                    <div className="form-group" style={{ marginBottom: '15px' }}>
                        <label>Размер ленты</label>
                        <select value={size} onChange={e => setSize(e.target.value)}>
                            <option value="thermal57">57mm (узкая)</option>
                            <option value="thermal80">80mm (стандарт)</option>
                        </select>
                    </div>

                    {/* Предпросмотр */}
                    <div style={{
                        background: '#f5f5f5',
                        padding: '15px',
                        borderRadius: '8px',
                        display: 'flex',
                        justifyContent: 'center',
                        maxHeight: '400px',
                        overflow: 'auto'
                    }}>
                        <ReceiptContent
                            ref={printRef}
                            sale={sale}
                            companyInfo={companyInfo}
                            size={size}
                            settings={receiptSettings}
                        />
                    </div>
                </div>

                <div className="modal-footer">
                    <button type="button" className="btn btn-secondary" onClick={onClose}>
                        Закрыть
                    </button>
                    <button type="button" className="btn btn-primary" onClick={handlePrint}>
                        <Printer size={16} /> Печать
                    </button>
                </div>
            </div>
        </div>
    );
}

export default ReceiptPrinter;
