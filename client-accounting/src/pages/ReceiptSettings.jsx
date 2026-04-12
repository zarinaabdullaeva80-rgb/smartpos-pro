import React, { useState, useEffect } from 'react';
import { Printer, Eye, FileText, Save, Check, Plus, Trash2, Store, Edit2, MapPin, Phone, Globe, Building2 } from 'lucide-react';
import api from '../services/api';
import { useI18n } from '../i18n';

function ReceiptSettings() {
    const { t } = useI18n();
    const [settings, setSettings] = useState({});
    const [stores, setStores] = useState([]);
    const [selectedStore, setSelectedStore] = useState(null);
    const [templates, setTemplates] = useState([]);
    const [loading, setLoading] = useState(true);
    const [showStoreModal, setShowStoreModal] = useState(false);
    const [editingStore, setEditingStore] = useState(null);
    const [message, setMessage] = useState(null);
    const [activeTab, setActiveTab] = useState('general'); // general, stores

    useEffect(() => { loadData(); }, []);

    const loadData = async () => {
        // Load settings
        try {
            const receiptRes = await api.get('/settings/receipt/config');
            if (receiptRes.data) {
                setSettings(receiptRes.data);
                localStorage.setItem('receiptSettings', JSON.stringify(receiptRes.data));
            }
        } catch (err) {
            console.warn('ReceiptSettings: API недоступен, используем локальные данные');
            const saved = localStorage.getItem('receiptSettings');
            setSettings(saved ? JSON.parse(saved) : getDefaultSettings());
        }

        // Load stores
        try {
            const storesRes = await api.get('/settings/stores');
            if (storesRes.data?.stores) {
                setStores(storesRes.data.stores);
                localStorage.setItem('storeLocations', JSON.stringify(storesRes.data.stores));
            }
        } catch (err) {
            const savedStores = localStorage.getItem('storeLocations');
            if (savedStores) setStores(JSON.parse(savedStores));
        }

        // Templates
        setTemplates([
            { id: 1, name: 'Стандартный', is_default: true },
            { id: 2, name: 'Компактный', is_default: false },
            { id: 3, name: 'Детальный + QR', is_default: false }
        ]);

        setLoading(false);
    };

    const getDefaultSettings = () => ({
        paper_width: 80,
        header_enabled: true,
        header_logo: true,
        header_company_name: '',
        header_address: '',
        header_phone: '',
        header_inn: '',
        header_website: '',
        header_org_type: 'ООО',
        body_show_sku: true,
        body_show_barcode: false,
        body_show_discount: true,
        body_show_tax: true,
        body_font_size: 'medium',
        footer_enabled: true,
        footer_text: 'Спасибо за покупку!\nЖдём вас снова! 🎉',
        footer_show_datetime: true,
        footer_show_cashier: true,
        footer_show_receipt_number: true,
        footer_qr_enabled: true,
        footer_qr_type: 'fiscal',
        kkm_serial: '',
        copies: 1,
        auto_print: true,
        auto_open_drawer: true,
        cut_paper: true,
        beep_on_print: true
    });

    const handleSave = async () => {
        try {
            // Сохранить локально
            localStorage.setItem('receiptSettings', JSON.stringify(settings));

            // Сохранить на сервер
            await api.put('/settings/receipt/config', settings);

            setMessage({ type: 'success', text: '✅ Настройки чека сохранены!' });
        } catch (error) {
            // Сохранили локально, сервер недоступен
            setMessage({ type: 'warning', text: '⚠️ Сохранено локально (сервер недоступен)' });
        }
        setTimeout(() => setMessage(null), 3000);
    };

    const handleSaveStores = async () => {
        try {
            localStorage.setItem('storeLocations', JSON.stringify(stores));
            await api.put('/settings/stores', { stores });
            setMessage({ type: 'success', text: '✅ Торговые точки сохранены!' });
        } catch (error) {
            setMessage({ type: 'warning', text: '⚠️ Сохранено локально' });
        }
        setTimeout(() => setMessage(null), 3000);
    };

    const handleAddStore = () => {
        setEditingStore({
            id: `store_${Date.now()}`,
            name: '',
            address: '',
            phone: '',
            inn: '',
            org_type: 'ООО',
            website: '',
            kkm_serial: '',
            is_default: stores.length === 0
        });
        setShowStoreModal(true);
    };

    const handleEditStore = (store) => {
        setEditingStore({ ...store });
        setShowStoreModal(true);
    };

    const handleSaveStore = () => {
        if (!editingStore.name) {
            setMessage({ type: 'error', text: 'Введите название точки' });
            return;
        }

        const exists = stores.find(s => s.id === editingStore.id);
        if (exists) {
            setStores(stores.map(s => s.id === editingStore.id ? editingStore : s));
        } else {
            setStores([...stores, editingStore]);
        }
        setShowStoreModal(false);
        setEditingStore(null);
    };

    const handleDeleteStore = (storeId) => {
        if (confirm('Удалить торговую точку?')) {
            setStores(stores.filter(s => s.id !== storeId));
        }
    };

    const handleSetDefault = (storeId) => {
        setStores(stores.map(s => ({ ...s, is_default: s.id === storeId })));
    };

    const formatReceiptPreview = () => {
        const s = selectedStore ? { ...settings, ...selectedStore } : settings;
        return `
┌────────────────────────────┐
│   ${s.header_org_type || 'ООО'} "${s.header_company_name || s.name || 'Компания'}"   │
│   📍 ${s.header_address || s.address || 'Адрес не указан'}   │
│   📞 ${s.header_phone || s.phone || ''}   │
│   ИНН: ${s.header_inn || s.inn || ''}   │
${s.header_website || s.website ? `│   🌐 ${s.header_website || s.website}   │\n` : ''}├────────────────────────────┤
│ Чек №: 00152              │
│ Дата: ${new Date().toLocaleDateString('ru')} ${new Date().toLocaleTimeString('ru', { hour: '2-digit', minute: '2-digit' })}    │
│ Кассир: ${JSON.parse(localStorage.getItem('user') || '{}').full_name || 'Кассир'}         │
${s.kkm_serial ? `│ ККМ: ${s.kkm_serial}       │\n` : ''}├────────────────────────────┤
│ Товар 1           x1      │
│         100,000 сум       │
${settings.body_show_discount ? '│ Скидка:      -10,000 сум  │\n' : ''}├────────────────────────────┤
│ ИТОГО:        90,000 сум  │
${settings.body_show_tax ? '│ в т.ч. НДС:   13,500 сум  │\n' : ''}├────────────────────────────┤
${settings.footer_qr_enabled ? '│      [██████QR██████]      │\n' : ''}│   ${settings.footer_text?.split('\n')[0] || 'Спасибо за покупку!'}   │
└────────────────────────────┘
        `;
    };

    if (loading) return <div className="loading-spinner">{t('receiptsettings.zagruzka', 'Загрузка...')}</div>;

    return (
        <div className="receipt-settings-page fade-in">
            <div className="page-header">
                <div>
                    <h1>{t('receiptsettings.nastroyka_chekov', '🧾 Настройка чеков')}</h1>
                    <p className="text-muted">{t('receiptsettings.vneshniy_vid_chekov_i_torgovye_tochki', 'Внешний вид чеков и торговые точки')}</p>
                </div>
                <div style={{ display: 'flex', gap: '12px' }}>
                    <button className="btn btn-primary" onClick={activeTab === 'stores' ? handleSaveStores : handleSave}>
                        <Save size={18} /> Сохранить
                    </button>
                </div>
            </div>

            {message && (
                <div className={`alert alert-${message.type}`} style={{ marginBottom: '16px' }}>
                    {message.text}
                </div>
            )}

            {/* Tabs */}
            <div style={{ display: 'flex', gap: '8px', marginBottom: '20px' }}>
                <button
                    className={`btn ${activeTab === 'general' ? 'btn-primary' : 'btn-secondary'}`}
                    onClick={() => setActiveTab('general')}
                >
                    <FileText size={16} /> Общие настройки
                </button>
                <button
                    className={`btn ${activeTab === 'stores' ? 'btn-primary' : 'btn-secondary'}`}
                    onClick={() => setActiveTab('stores')}
                >
                    <Store size={16} /> Торговые точки ({stores.length})
                </button>
            </div>

            {activeTab === 'general' && (
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 350px', gap: '20px' }}>
                    {/* Настройки */}
                    <div>
                        {/* Шапка */}
                        <div className="card" style={{ marginBottom: '20px' }}>
                            <div style={{ padding: '16px', borderBottom: '1px solid var(--border-color)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                <h3 style={{ margin: 0 }}>{t('receiptsettings.shapka_cheka_po_umolchaniyu', '📄 Шапка чека (по умолчанию)')}</h3>
                                <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer' }}>
                                    <input type="checkbox" checked={settings.header_enabled} onChange={(e) => setSettings({ ...settings, header_enabled: e.target.checked })} />
                                    Включить
                                </label>
                            </div>
                            <div style={{ padding: '16px', display: 'grid', gap: '12px' }}>
                                <div style={{ display: 'grid', gridTemplateColumns: '120px 1fr', gap: '12px' }}>
                                    <div className="form-group" style={{ margin: 0 }}>
                                        <label>{t('receiptsettings.tip_org', 'Тип орг.')}</label>
                                        <select value={settings.header_org_type || 'ООО'} onChange={(e) => setSettings({ ...settings, header_org_type: e.target.value })}>
                                            <option value="ООО">{t('receiptsettings.ooo', 'ООО')}</option>
                                            <option value="ИП">{t('receiptsettings.ip', 'ИП')}</option>
                                            <option value="АО">{t('receiptsettings.ao', 'АО')}</option>
                                            <option value="ЧП">{t('receiptsettings.chp', 'ЧП')}</option>
                                        </select>
                                    </div>
                                    <div className="form-group" style={{ margin: 0 }}>
                                        <label>{t('receiptsettings.nazvanie_kompanii', 'Название компании')}</label>
                                        <input type="text" value={settings.header_company_name || ''} onChange={(e) => setSettings({ ...settings, header_company_name: e.target.value })} placeholder="Название компании" />
                                    </div>
                                </div>
                                <div className="form-group" style={{ margin: 0 }}>
                                    <label>{t('receiptsettings.adres', '📍 Адрес')}</label>
                                    <input type="text" value={settings.header_address || ''} onChange={(e) => setSettings({ ...settings, header_address: e.target.value })} placeholder="г. Ташкент, ул. Навои, 25" />
                                </div>
                                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                                    <div className="form-group" style={{ margin: 0 }}>
                                        <label>{t('receiptsettings.telefon', '📞 Телефон')}</label>
                                        <input type="text" value={settings.header_phone || ''} onChange={(e) => setSettings({ ...settings, header_phone: e.target.value })} placeholder="+998 71 123-45-67" />
                                    </div>
                                    <div className="form-group" style={{ margin: 0 }}>
                                        <label>{t('receiptsettings.inn', 'ИНН')}</label>
                                        <input type="text" value={settings.header_inn || ''} onChange={(e) => setSettings({ ...settings, header_inn: e.target.value })} placeholder="123456789" />
                                    </div>
                                </div>
                                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                                    <div className="form-group" style={{ margin: 0 }}>
                                        <label>{t('receiptsettings.sayt', '🌐 Сайт')}</label>
                                        <input type="text" value={settings.header_website || ''} onChange={(e) => setSettings({ ...settings, header_website: e.target.value })} placeholder="example.uz" />
                                    </div>
                                    <div className="form-group" style={{ margin: 0 }}>
                                        <label>{t('receiptsettings.kkm_seriynyy_num', 'ККМ серийный №')}</label>
                                        <input type="text" value={settings.kkm_serial || ''} onChange={(e) => setSettings({ ...settings, kkm_serial: e.target.value })} placeholder="KKM-001234567" />
                                    </div>
                                </div>
                                <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer' }}>
                                    <input type="checkbox" checked={settings.header_logo} onChange={(e) => setSettings({ ...settings, header_logo: e.target.checked })} />
                                    Показывать логотип
                                </label>
                            </div>
                        </div>

                        {/* Тело чека */}
                        <div className="card" style={{ marginBottom: '20px' }}>
                            <div style={{ padding: '16px', borderBottom: '1px solid var(--border-color)' }}>
                                <h3 style={{ margin: 0 }}>{t('receiptsettings.soderzhimoe_cheka', '📋 Содержимое чека')}</h3>
                            </div>
                            <div style={{ padding: '16px', display: 'grid', gap: '12px' }}>
                                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                                    <div className="form-group" style={{ margin: 0 }}>
                                        <label>{t('receiptsettings.shirina_bumagi', 'Ширина бумаги')}</label>
                                        <select value={settings.paper_width} onChange={(e) => setSettings({ ...settings, paper_width: parseInt(e.target.value) })}>
                                            <option value="58">{t('receiptsettings.mm', '58 мм')}</option>
                                            <option value="80">{t('receiptsettings.mm', '80 мм')}</option>
                                        </select>
                                    </div>
                                    <div className="form-group" style={{ margin: 0 }}>
                                        <label>{t('receiptsettings.razmer_shrifta', 'Размер шрифта')}</label>
                                        <select value={settings.body_font_size} onChange={(e) => setSettings({ ...settings, body_font_size: e.target.value })}>
                                            <option value="small">{t('receiptsettings.melkiy', 'Мелкий')}</option>
                                            <option value="medium">{t('receiptsettings.sredniy', 'Средний')}</option>
                                            <option value="large">{t('receiptsettings.krupnyy', 'Крупный')}</option>
                                        </select>
                                    </div>
                                </div>
                                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '16px' }}>
                                    <label style={{ display: 'flex', alignItems: 'center', gap: '6px', cursor: 'pointer' }}>
                                        <input type="checkbox" checked={settings.body_show_sku} onChange={(e) => setSettings({ ...settings, body_show_sku: e.target.checked })} />
                                        Артикул
                                    </label>
                                    <label style={{ display: 'flex', alignItems: 'center', gap: '6px', cursor: 'pointer' }}>
                                        <input type="checkbox" checked={settings.body_show_barcode} onChange={(e) => setSettings({ ...settings, body_show_barcode: e.target.checked })} />
                                        Штрих-код
                                    </label>
                                    <label style={{ display: 'flex', alignItems: 'center', gap: '6px', cursor: 'pointer' }}>
                                        <input type="checkbox" checked={settings.body_show_discount} onChange={(e) => setSettings({ ...settings, body_show_discount: e.target.checked })} />
                                        Скидки
                                    </label>
                                    <label style={{ display: 'flex', alignItems: 'center', gap: '6px', cursor: 'pointer' }}>
                                        <input type="checkbox" checked={settings.body_show_tax} onChange={(e) => setSettings({ ...settings, body_show_tax: e.target.checked })} />
                                        НДС
                                    </label>
                                </div>
                            </div>
                        </div>

                        {/* Подвал */}
                        <div className="card" style={{ marginBottom: '20px' }}>
                            <div style={{ padding: '16px', borderBottom: '1px solid var(--border-color)' }}>
                                <h3 style={{ margin: 0 }}>{t('receiptsettings.podval_cheka', '📌 Подвал чека')}</h3>
                            </div>
                            <div style={{ padding: '16px', display: 'grid', gap: '12px' }}>
                                <div className="form-group" style={{ margin: 0 }}>
                                    <label>{t('receiptsettings.tekst_blagodarnosti', 'Текст благодарности')}</label>
                                    <textarea value={settings.footer_text || ''} onChange={(e) => setSettings({ ...settings, footer_text: e.target.value })} rows={2} />
                                </div>
                                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '16px' }}>
                                    <label style={{ display: 'flex', alignItems: 'center', gap: '6px', cursor: 'pointer' }}>
                                        <input type="checkbox" checked={settings.footer_qr_enabled} onChange={(e) => setSettings({ ...settings, footer_qr_enabled: e.target.checked })} />
                                        QR-код
                                    </label>
                                    {settings.footer_qr_enabled && (
                                        <select value={settings.footer_qr_type} onChange={(e) => setSettings({ ...settings, footer_qr_type: e.target.value })} style={{ width: '150px' }}>
                                            <option value="fiscal">{t('receiptsettings.fiskalnyy', 'Фискальный')}</option>
                                            <option value="payment">{t('receiptsettings.dlya_oplaty', 'Для оплаты')}</option>
                                            <option value="review">{t('receiptsettings.na_otzyv', 'На отзыв')}</option>
                                        </select>
                                    )}
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Предпросмотр */}
                    <div>
                        <div className="card" style={{ marginBottom: '20px' }}>
                            <div style={{ padding: '16px', borderBottom: '1px solid var(--border-color)' }}>
                                <h3 style={{ margin: 0 }}>{t('receiptsettings.shablony', '📑 Шаблоны')}</h3>
                            </div>
                            <div>
                                {templates.map(tpl => (
                                    <div key={tpl.id} style={{
                                        padding: '12px 16px',
                                        borderBottom: '1px solid var(--border-color)',
                                        display: 'flex',
                                        alignItems: 'center',
                                        gap: '12px',
                                        cursor: 'pointer',
                                        background: tpl.is_default ? 'var(--primary-light)' : 'transparent'
                                    }}>
                                        <FileText size={18} />
                                        <span style={{ flex: 1 }}>{tpl.name}</span>
                                        {tpl.is_default && <Check size={16} color="var(--primary)" />}
                                    </div>
                                ))}
                            </div>
                        </div>

                        <div className="card" style={{ background: '#1a1a1a', color: '#eee' }}>
                            <div style={{ padding: '16px', borderBottom: '1px solid #333' }}>
                                <h3 style={{ margin: 0, color: 'white' }}>{t('receiptsettings.predprosmotr', '👁️ Предпросмотр')}</h3>
                            </div>
                            <div style={{ padding: '16px' }}>
                                <pre style={{ fontFamily: 'monospace', fontSize: '10px', lineHeight: '1.3', whiteSpace: 'pre', margin: 0, overflowX: 'auto' }}>
                                    {formatReceiptPreview()}
                                </pre>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {activeTab === 'stores' && (
                <div>
                    {/* Инфо */}
                    <div className="card" style={{ marginBottom: '20px', padding: '16px', background: 'linear-gradient(135deg, #dbeafe 0%, #e0e7ff 100%)' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
                            <Store size={32} color="#3b82f6" />
                            <div>
                                <h3 style={{ margin: '0 0 4px' }}>{t('receiptsettings.torgovye_tochki', 'Торговые точки')}</h3>
                                <p style={{ margin: 0, color: '#666' }}>
                                    Настройте адреса и данные для каждой точки продаж. Эти данные будут использоваться при печати чеков.
                                </p>
                            </div>
                        </div>
                    </div>

                    {/* Кнопка добавить */}
                    <button className="btn btn-primary" onClick={handleAddStore} style={{ marginBottom: '20px' }}>
                        <Plus size={18} /> Добавить точку
                    </button>

                    {/* Список точек */}
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(350px, 1fr))', gap: '16px' }}>
                        {stores.map(store => (
                            <div key={store.id} className="card" style={{ padding: 0, border: store.is_default ? '2px solid var(--primary)' : undefined }}>
                                <div style={{ padding: '16px' }}>
                                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'start', marginBottom: '12px' }}>
                                        <div>
                                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                                <Building2 size={20} />
                                                <strong>{store.org_type} "{store.name}"</strong>
                                                {store.is_default && <span className="badge badge-success">{t('receiptsettings.po_umolchaniyu', 'По умолчанию')}</span>}
                                            </div>
                                        </div>
                                        <div style={{ display: 'flex', gap: '8px' }}>
                                            <button className="btn btn-small btn-secondary" onClick={() => handleEditStore(store)}>
                                                <Edit2 size={14} />
                                            </button>
                                            <button className="btn btn-small btn-danger" onClick={() => handleDeleteStore(store.id)}>
                                                <Trash2 size={14} />
                                            </button>
                                        </div>
                                    </div>

                                    {store.address && (
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px', color: '#666' }}>
                                            <MapPin size={16} /> {store.address}
                                        </div>
                                    )}
                                    {store.phone && (
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px', color: '#666' }}>
                                            <Phone size={16} /> {store.phone}
                                        </div>
                                    )}
                                    {store.website && (
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px', color: '#666' }}>
                                            <Globe size={16} /> {store.website}
                                        </div>
                                    )}
                                    <div style={{ fontSize: '12px', color: '#888' }}>
                                        ИНН: {store.inn || 'не указан'} • ККМ: {store.kkm_serial || 'не указан'}
                                    </div>
                                </div>
                                {!store.is_default && (
                                    <div style={{ padding: '12px 16px', borderTop: '1px solid var(--border-color)', background: 'var(--bg-secondary)' }}>
                                        <button className="btn btn-small btn-secondary" onClick={() => handleSetDefault(store.id)}>
                                            Сделать по умолчанию
                                        </button>
                                    </div>
                                )}
                            </div>
                        ))}

                        {stores.length === 0 && (
                            <div className="card" style={{ padding: '40px', textAlign: 'center', color: '#888' }}>
                                <Store size={48} style={{ opacity: 0.3, marginBottom: '16px' }} />
                                <p>{t('receiptsettings.net_torgovyh_tochek', 'Нет торговых точек')}</p>
                                <p style={{ fontSize: '14px' }}>{t('receiptsettings.dobavte_pervuyu_tochku_dlya_nastroyki_cheko', 'Добавьте первую точку для настройки чеков')}</p>
                            </div>
                        )}
                    </div>
                </div>
            )}

            {/* Modal для редактирования точки */}
            {showStoreModal && editingStore && (
                <div className="modal-overlay" onClick={() => setShowStoreModal(false)}>
                    <div className="modal glass" onClick={e => e.stopPropagation()} style={{ maxWidth: '500px' }}>
                        <div className="modal-header">
                            <h2>{editingStore.name ? 'Редактировать точку' : 'Новая торговая точка'}</h2>
                            <button onClick={() => setShowStoreModal(false)} className="btn-close">×</button>
                        </div>
                        <div className="modal-body">
                            <div style={{ display: 'grid', gap: '16px' }}>
                                <div style={{ display: 'grid', gridTemplateColumns: '100px 1fr', gap: '12px' }}>
                                    <div className="form-group" style={{ margin: 0 }}>
                                        <label>{t('receiptsettings.tip', 'Тип')}</label>
                                        <select value={editingStore.org_type} onChange={(e) => setEditingStore({ ...editingStore, org_type: e.target.value })}>
                                            <option value="ООО">{t('receiptsettings.ooo', 'ООО')}</option>
                                            <option value="ИП">{t('receiptsettings.ip', 'ИП')}</option>
                                            <option value="АО">{t('receiptsettings.ao', 'АО')}</option>
                                            <option value="ЧП">{t('receiptsettings.chp', 'ЧП')}</option>
                                        </select>
                                    </div>
                                    <div className="form-group" style={{ margin: 0 }}>
                                        <label>{t('receiptsettings.nazvanie', 'Название *')}</label>
                                        <input
                                            type="text"
                                            value={editingStore.name}
                                            onChange={(e) => setEditingStore({ ...editingStore, name: e.target.value })}
                                            placeholder="Название филиала"
                                        />
                                    </div>
                                </div>
                                <div className="form-group" style={{ margin: 0 }}>
                                    <label>{t('receiptsettings.adres', '📍 Адрес')}</label>
                                    <input
                                        type="text"
                                        value={editingStore.address}
                                        onChange={(e) => setEditingStore({ ...editingStore, address: e.target.value })}
                                        placeholder="г. Ташкент, ул. Навои, 25"
                                    />
                                </div>
                                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                                    <div className="form-group" style={{ margin: 0 }}>
                                        <label>{t('receiptsettings.telefon', '📞 Телефон')}</label>
                                        <input
                                            type="text"
                                            value={editingStore.phone}
                                            onChange={(e) => setEditingStore({ ...editingStore, phone: e.target.value })}
                                            placeholder="+998 71 123-45-67"
                                        />
                                    </div>
                                    <div className="form-group" style={{ margin: 0 }}>
                                        <label>{t('receiptsettings.inn', 'ИНН')}</label>
                                        <input
                                            type="text"
                                            value={editingStore.inn}
                                            onChange={(e) => setEditingStore({ ...editingStore, inn: e.target.value })}
                                            placeholder="123456789"
                                        />
                                    </div>
                                </div>
                                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                                    <div className="form-group" style={{ margin: 0 }}>
                                        <label>{t('receiptsettings.sayt', '🌐 Сайт')}</label>
                                        <input
                                            type="text"
                                            value={editingStore.website}
                                            onChange={(e) => setEditingStore({ ...editingStore, website: e.target.value })}
                                            placeholder="example.uz"
                                        />
                                    </div>
                                    <div className="form-group" style={{ margin: 0 }}>
                                        <label>{t('receiptsettings.kkm_seriynyy_num', 'ККМ серийный №')}</label>
                                        <input
                                            type="text"
                                            value={editingStore.kkm_serial}
                                            onChange={(e) => setEditingStore({ ...editingStore, kkm_serial: e.target.value })}
                                            placeholder="KKM-001234567"
                                        />
                                    </div>
                                </div>
                                <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer' }}>
                                    <input
                                        type="checkbox"
                                        checked={editingStore.is_default}
                                        onChange={(e) => setEditingStore({ ...editingStore, is_default: e.target.checked })}
                                    />
                                    Использовать по умолчанию
                                </label>
                            </div>
                        </div>
                        <div className="modal-footer">
                            <button className="btn btn-secondary" onClick={() => setShowStoreModal(false)}>{t('receiptsettings.otmena', 'Отмена')}</button>
                            <button className="btn btn-primary" onClick={handleSaveStore}>
                                <Save size={16} /> Сохранить
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}

export default ReceiptSettings;
