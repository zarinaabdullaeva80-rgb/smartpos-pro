import React, { useState, useEffect } from 'react';
import { Outlet, Link, useLocation, useNavigate } from 'react-router-dom';
import { LayoutDashboard, Package, ShoppingCart, ShoppingBag, Users2, Wallet, Warehouse, Users, FileText, Target, BarChart3, LogOut, Settings as SettingsIcon, TrendingUp, Gift, MapPin, Clock, Mail, Zap, TestTube, CreditCard, Search, X, ChevronDown, ChevronRight, PanelLeftClose, PanelLeft, Globe } from 'lucide-react';
import Notifications from './Notifications';
import SyncIndicator from './SyncIndicator';
import { useKeyboardShortcuts } from '../hooks/useKeyboardShortcuts';
import ShortcutsOverlay from './ShortcutsOverlay';
import { useI18n } from '../i18n';
import '../styles/Layout.css';

function Layout({ onLogout }) {
    const location = useLocation();
    const navigate = useNavigate();
    const user = JSON.parse(localStorage.getItem('user') || '{}');
    const [searchQuery, setSearchQuery] = useState('');
    const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
    const [expandedCategories, setExpandedCategories] = useState(['main']);
    const searchInputRef = React.useRef(null);
    const { t, lang, switchLanguage, languages } = useI18n();

    // Определяем мобильное/PWA устройство (только телефоны/планшеты)
    const isMobile = /iPhone|iPad|iPod|Android/i.test(navigator.userAgent) || 
        window.matchMedia('(display-mode: standalone)').matches ||
        window.navigator.standalone === true;

    // Мобильное меню — только кассовые функции
    const mobileNavItems = [
        { name: 'Продажи', path: '/sales', icon: ShoppingCart },
        { name: 'Товары', path: '/products', icon: Package },
        { name: 'Смены', path: '/shifts', icon: Clock },
        { name: 'Возвраты', path: '/returns', icon: ShoppingBag },
        { name: 'Выход', path: '/logout', icon: LogOut },
    ];

    // Глобальные горячие клавиши
    useKeyboardShortcuts();

    // Load sidebar state from localStorage
    useEffect(() => {
        const saved = localStorage.getItem('sidebarCollapsed');
        if (saved) setSidebarCollapsed(JSON.parse(saved));
        const savedCategories = localStorage.getItem('expandedCategories');
        if (savedCategories) setExpandedCategories(JSON.parse(savedCategories));
    }, []);

    // Save sidebar state
    const toggleSidebar = () => {
        const newState = !sidebarCollapsed;
        setSidebarCollapsed(newState);
        localStorage.setItem('sidebarCollapsed', JSON.stringify(newState));
    };

    const toggleCategory = (category) => {
        setExpandedCategories(prev => {
            const newState = prev.includes(category)
                ? prev.filter(c => c !== category)
                : [...prev, category];
            localStorage.setItem('expandedCategories', JSON.stringify(newState));
            return newState;
        });
    };

    // Define roles that can access each category
    // undefined = everyone can access
    // Organized navigation with categories
    const categories = [
        {
            id: 'main',
            name: t('nav.catMain'),
            icon: LayoutDashboard,
            allowedRoles: null, // All roles
            items: [
                { name: t('nav.dashboard'), path: '/', icon: LayoutDashboard },
                { name: t('nav.products'), path: '/products', icon: Package, allowedRoles: ['Администратор', 'Менеджер', 'client_admin'] },
                { name: t('nav.sales'), path: '/sales', icon: ShoppingCart },
                { name: t('nav.purchases'), path: '/purchases', icon: ShoppingBag, allowedRoles: ['Администратор', 'Менеджер', 'client_admin'] },
                { name: t('nav.counterparties'), path: '/counterparties', icon: Users2, allowedRoles: ['Администратор', 'Менеджер', 'Бухгалтер', 'client_admin'] },
                { name: t('nav.finance'), path: '/finance', icon: Wallet, allowedRoles: ['Администратор', 'Бухгалтер', 'client_admin'] },
                { name: t('nav.warehouse'), path: '/warehouse', icon: Warehouse, allowedRoles: ['Администратор', 'Кладовщик', 'client_admin'] },
                { name: t('nav.employees'), path: '/employees', icon: Users, allowedRoles: ['Администратор', 'client_admin'] },
            ]
        },
        {
            id: 'pos',
            name: t('nav.catPos'),
            icon: CreditCard,
            allowedRoles: null,
            items: [
                { name: t('nav.shifts'), path: '/shifts', icon: LayoutDashboard },
                { name: t('nav.cashDrawer'), path: '/cash-drawer', icon: CreditCard },
                { name: t('nav.returns'), path: '/returns', icon: ShoppingCart },
                { name: t('nav.zReports'), path: '/z-reports', icon: FileText, allowedRoles: ['Администратор', 'Менеджер', 'client_admin'] },
                { name: t('nav.fiscalReports'), path: '/fiscal-reports', icon: FileText, allowedRoles: ['Администратор', 'Менеджер', 'client_admin'] },
                { name: t('nav.cashOperations'), path: '/cash-operations', icon: CreditCard },
            ]
        },
        {
            id: 'reports',
            name: t('nav.catReports'),
            icon: BarChart3,
            allowedRoles: ['Администратор', 'Менеджер', 'Бухгалтер', 'client_admin'],
            items: [
                { name: t('nav.reports'), path: '/reports', icon: BarChart3 },
                { name: t('nav.profitLoss'), path: '/profit-loss', icon: TrendingUp },
                { name: t('nav.taxReports'), path: '/tax-reports', icon: FileText },
                { name: t('nav.conversionFunnel'), path: '/conversion-funnel', icon: TrendingUp },
                { name: t('nav.cohortAnalysis'), path: '/cohort-analysis', icon: BarChart3 },
                { name: t('nav.salesHeatmap'), path: '/sales-heatmap', icon: BarChart3 },
                { name: t('nav.analytics'), path: '/analytics', icon: BarChart3 },
            ]
        },
        {
            id: '1c',
            name: t('nav.cat1c'),
            icon: SettingsIcon,
            allowedRoles: ['Администратор', 'client_admin', 'super_admin'],
            items: [
                { name: t('nav.sync1c'), path: '/sync1c-settings', icon: SettingsIcon },
                { name: t('nav.implementation'), path: '/implementation', icon: SettingsIcon },
                { name: t('nav.configSettings'), path: '/configuration-settings', icon: SettingsIcon },
                { name: t('nav.development'), path: '/development', icon: Package },
                { name: t('nav.dataMigration'), path: '/data-migration', icon: Package },
            ]
        },
        {
            id: 'warehouse',
            name: t('nav.catWarehouse'),
            icon: Warehouse,
            allowedRoles: ['Администратор', 'Кладовщик', 'Менеджер', 'client_admin'],
            items: [
                { name: t('nav.stockManagement'), path: '/stock-management', icon: Package },
                { name: t('nav.inventory'), path: '/inventory', icon: Package },
                { name: t('nav.batches'), path: '/batches', icon: Package },
                { name: t('nav.stockTransfers'), path: '/stock-transfers', icon: Package },
                { name: t('nav.warehouseMap'), path: '/warehouse-map', icon: MapPin },
                { name: t('nav.minimumStock'), path: '/minimum-stock', icon: Package },
                { name: t('nav.goodsReceiving'), path: '/goods-receiving', icon: Package },
                { name: t('nav.inventoryValuation'), path: '/inventory-valuation', icon: Package },
            ]
        },
        {
            id: 'crm',
            name: t('nav.catCrm'),
            icon: Target,
            allowedRoles: ['Администратор', 'Менеджер', 'client_admin'],
            items: [
                { name: t('nav.crm'), path: '/crm', icon: Target },
                { name: t('nav.salesPipeline'), path: '/sales-pipeline', icon: TrendingUp },
                { name: t('nav.deliveries'), path: '/deliveries', icon: Package },
                { name: t('nav.loyalty'), path: '/loyalty', icon: Gift },
                { name: t('nav.loyaltyCards'), path: '/loyalty-cards', icon: CreditCard },
                { name: t('nav.loyaltySettings'), path: '/loyalty-settings', icon: SettingsIcon },
                { name: t('nav.giftCertificates'), path: '/gift-certificates', icon: Gift },
                { name: t('nav.promotions'), path: '/promotions', icon: Gift },
                { name: t('nav.smsCampaigns'), path: '/sms-campaigns', icon: Mail },
                { name: t('nav.emailCampaigns'), path: '/email-campaigns', icon: Mail },
            ]
        },
        {
            id: 'hr',
            name: t('nav.catHr'),
            icon: Users,
            allowedRoles: ['Администратор', 'client_admin'],
            items: [
                { name: t('nav.payroll'), path: '/payroll', icon: CreditCard },
                { name: t('nav.workSchedule'), path: '/work-schedule', icon: Clock },
                { name: t('nav.employeeKpi'), path: '/employee-kpi', icon: TrendingUp },
                { name: t('nav.timeTracking'), path: '/time-tracking', icon: Clock },
            ]
        },
        {
            id: 'finance',
            name: t('nav.catFinance'),
            icon: Wallet,
            allowedRoles: ['Администратор', 'Бухгалтер', 'client_admin'],
            items: [
                { name: t('nav.invoices'), path: '/invoices', icon: FileText },
                { name: t('nav.bankIntegration'), path: '/bank-integration', icon: CreditCard },
                { name: t('nav.accountingEntries'), path: '/accounting-entries', icon: FileText },
                { name: t('nav.balanceSheet'), path: '/balance-sheet', icon: BarChart3 },
                { name: t('nav.receivables', 'Дебиторская задолженность'), path: '/receivables', icon: CreditCard },
                { name: t('nav.payables', 'Кредиторская задолженность'), path: '/payables', icon: CreditCard },
                { name: t('nav.currencies', 'Мультивалютность'), path: '/currencies', icon: CreditCard },
            ]
        },
        {
            id: 'docs',
            name: t('nav.catDocs', 'Документооборот'),
            icon: FileText,
            allowedRoles: ['Администратор', 'Менеджер', 'Бухгалтер', 'client_admin'],
            items: [
                { name: t('nav.waybills', 'Накладные'), path: '/waybills', icon: FileText },
                { name: t('nav.contracts', 'Договоры'), path: '/contracts', icon: FileText },
                { name: t('nav.reconciliation', 'Акт сверки'), path: '/reconciliation-act', icon: FileText },
                { name: t('nav.digitalSignature', 'ЭЦП подписание'), path: '/digital-signature', icon: SettingsIcon },
                { name: t('nav.importExport'), path: '/import-export', icon: Package },
            ]
        },
        {
            id: 'settings',
            name: t('nav.settings'),
            icon: SettingsIcon,
            allowedRoles: ['Администратор', 'client_admin'],
            items: [
                { name: t('nav.admin'), path: '/administration', icon: SettingsIcon, allowedRoles: ['Администратор', 'client_admin', 'super_admin'] },
                { name: t('nav.staffManagement', 'Управление сотрудниками'), path: '/staff-management', icon: Users },
                { name: t('nav.generalSettings', 'Общие настройки'), path: '/settings', icon: SettingsIcon },
                { name: t('nav.googleSheets'), path: '/google-sheets', icon: BarChart3 },
                { name: t('nav.notifications'), path: '/notifications', icon: Mail },
                { name: t('nav.telegram'), path: '/telegram-settings', icon: Mail },
                { name: t('nav.qrPayments', 'QR-платежи'), path: '/payment-settings', icon: CreditCard },
                { name: t('nav.permissionsManagement', 'Управление правами'), path: '/permissions', icon: SettingsIcon },
                { name: t('nav.auditLog'), path: '/audit-log', icon: FileText },
                { name: t('nav.twoFactorAuth', '2FA авторизация'), path: '/two-factor-auth', icon: SettingsIcon },
                { name: t('nav.backups', 'Резервные копии'), path: '/backups', icon: SettingsIcon },
            ]
        }
    ];

    // Check if user role has access to a category/item
    const userRole = user.role || 'Кассир';
    const userType = user.user_type || 'employee';

    const hasAccess = (allowedRoles) => {
        if (!allowedRoles) return true; // null means all roles
        if (userType === 'super_admin' || userType === 'client_admin') return true;
        return allowedRoles.includes(userRole) || allowedRoles.includes(userType);
    };


    const handleLogout = () => {
        localStorage.removeItem('token');
        localStorage.removeItem('user');
        // Всегда возвращаемся на экран логина (не закрываем приложение)
        onLogout();
    };

    // Filter items based on search AND role permissions
    const filteredCategories = categories
        .filter(cat => hasAccess(cat.allowedRoles)) // Filter categories by role
        .map(cat => ({
            ...cat,
            items: (cat.items || []).filter(item => {
                // Check role permission for item
                if (!hasAccess(item.allowedRoles)) return false;
                // Check search query
                if (searchQuery.trim() && !item.name.toLowerCase().includes(searchQuery.toLowerCase())) {
                    return false;
                }
                return true;
            })
        }))
        .filter(cat => (cat.items?.length || 0) > 0); // Remove empty categories

    // === МОБИЛЬНЫЙ LAYOUT ===
    if (isMobile) {
        return (
            <div className="layout-mobile">
                {/* Мобильный хедер */}
                <header className="mobile-header">
                    <div className="mobile-header-left">
                        <img src="/smartpos-logo.png" alt="SmartPOS" style={{ width: 28, height: 28, borderRadius: 6 }} />
                        <span style={{ fontWeight: 700, fontSize: '1rem' }}>SmartPOS</span>
                    </div>
                    <div className="mobile-header-right">
                        <span style={{ fontSize: '0.8rem', color: 'var(--color-text-muted)' }}>
                            {user.fullName || user.username}
                        </span>
                    </div>
                </header>

                {/* Контент */}
                <main className="mobile-content">
                    <Outlet />
                </main>

                {/* Нижняя навигация */}
                <nav className="mobile-bottom-nav">
                    {mobileNavItems.map((item) => {
                        const Icon = item.icon;
                        const isActive = location.pathname === item.path;
                        const isLogout = item.path === '/logout';
                        return (
                            <button
                                key={item.path}
                                className={`mobile-nav-btn ${isActive ? 'active' : ''} ${isLogout ? 'logout' : ''}`}
                                onClick={() => isLogout ? handleLogout() : navigate(item.path)}
                            >
                                <Icon size={20} />
                                <span>{item.name}</span>
                            </button>
                        );
                    })}
                </nav>
            </div>
        );
    }

    // === ДЕСКТОПНЫЙ LAYOUT ===
    return (
        <div className={`layout ${sidebarCollapsed ? 'sidebar-collapsed' : ''}`}>
            <aside className={`sidebar glass ${sidebarCollapsed ? 'collapsed' : ''}`}>
                <div className="sidebar-header">
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', width: '100%' }}>
                        <div className="logo">
                            <img src="/smartpos-logo.png" alt="SmartPOS" style={{ width: '32px', height: '32px', borderRadius: '6px', objectFit: 'cover' }} />
                            {!sidebarCollapsed && <span>SmartPOS Pro</span>}
                        </div>
                        <button
                            onClick={toggleSidebar}
                            className="sidebar-toggle"
                            title={sidebarCollapsed ? 'Развернуть меню' : 'Свернуть меню'}
                        >
                            {sidebarCollapsed ? <PanelLeft size={20} /> : <PanelLeftClose size={20} />}
                        </button>
                    </div>
                    {!sidebarCollapsed && (
                        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginTop: '12px', width: '100%' }}>
                            <SyncIndicator />
                            <Notifications />
                        </div>
                    )}
                </div>

                {/* Search Box */}
                {!sidebarCollapsed && (
                    <div style={{ padding: '12px', borderBottom: '1px solid var(--border-color)' }}>
                        <div style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: '8px',
                            background: 'var(--bg-secondary)',
                            borderRadius: '8px',
                            padding: '8px 12px'
                        }}>
                            <Search size={16} color="#888" />
                            <input
                                type="text"
                                placeholder="Поиск меню..."
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                                style={{
                                    flex: 1,
                                    border: 'none',
                                    background: 'transparent',
                                    outline: 'none',
                                    fontSize: '13px',
                                    color: 'var(--text-color)'
                                }}
                            />
                            {searchQuery && (
                                <button
                                    onClick={() => setSearchQuery('')}
                                    style={{
                                        background: 'transparent',
                                        border: 'none',
                                        cursor: 'pointer',
                                        padding: 0,
                                        display: 'flex'
                                    }}
                                >
                                    <X size={14} color="#888" />
                                </button>
                            )}
                        </div>
                    </div>
                )}

                <nav className="sidebar-nav">
                    {filteredCategories.map((category) => {
                        const CategoryIcon = category.icon;
                        const isExpanded = expandedCategories.includes(category.id) || searchQuery.trim();
                        const hasActiveItem = category.items.some(item => location.pathname === item.path);

                        return (
                            <div key={category.id} className="nav-category">
                                <button
                                    type="button"
                                    className={`category-header ${hasActiveItem ? 'has-active' : ''}`}
                                    onClick={(e) => {
                                        e.preventDefault();
                                        e.stopPropagation();
                                        toggleCategory(category.id);
                                    }}
                                    title={sidebarCollapsed ? category.name : undefined}
                                >
                                    <CategoryIcon size={18} style={{ pointerEvents: 'none' }} />
                                    {!sidebarCollapsed && (
                                        <>
                                            <span className="category-name">{category.name}</span>
                                            <span className="category-chevron">
                                                {isExpanded ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
                                            </span>
                                        </>
                                    )}
                                </button>
                                {!sidebarCollapsed && isExpanded && (
                                    <div className="category-items">
                                        {category.items.map((item) => {
                                            const Icon = item.icon;
                                            const isActive = location.pathname === item.path;

                                            return (
                                                <Link
                                                    key={item.path}
                                                    to={item.path}
                                                    className={`nav-item ${isActive ? 'active' : ''}`}
                                                >
                                                    <Icon size={16} />
                                                    <span>{item.name}</span>
                                                </Link>
                                            );
                                        })}
                                    </div>
                                )}
                            </div>
                        );
                    })}
                </nav>

                <div className="sidebar-footer">
                    {!sidebarCollapsed && (
                        <div className="user-info">
                            <div className="user-avatar">
                                {user.fullName?.[0] || user.username?.[0] || 'U'}
                            </div>
                            <div className="user-details">
                                <div className="user-name">{user.fullName || user.username}</div>
                                <div className="user-role">{user.role || 'Пользователь'}</div>
                            </div>
                        </div>
                    )}
                    {!sidebarCollapsed && (
                        <div style={{ display: 'flex', gap: '4px', marginBottom: '8px' }}>
                            {languages.map(l => (
                                <button
                                    key={l.code}
                                    onClick={() => switchLanguage(l.code)}
                                    className={`btn btn-sm ${lang === l.code ? 'btn-primary' : 'btn-secondary'}`}
                                    style={{ flex: 1, fontSize: '12px', padding: '6px 8px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '4px' }}
                                    title={l.name}
                                >
                                    <span>{l.flag}</span> {l.name}
                                </button>
                            ))}
                        </div>
                    )}
                    <button onClick={handleLogout} className="btn btn-secondary btn-sm w-full" title={t('nav.logout')}>
                        <LogOut size={16} />
                        {!sidebarCollapsed && t('nav.logout')}
                    </button>
                </div>
            </aside>

            <main className="main-content">
                <Outlet />
            </main>

            {/* Keyboard Shortcuts Overlay (Ctrl+/) */}
            <ShortcutsOverlay />
        </div>
    );
}

export default Layout;
