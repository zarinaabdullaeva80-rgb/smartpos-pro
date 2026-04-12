import React, { useState, useEffect, Suspense } from 'react';
import { HashRouter, Routes, Route, Navigate } from 'react-router-dom';
import './index.css';
import ErrorBoundary from './components/ErrorBoundary';
import { ToastProvider } from './components/ToastProvider';
import { ConfirmProvider } from './components/ConfirmDialog';
import LoadingSpinner from './components/LoadingSpinner';
import { I18nProvider } from './i18n';

// Components
import Login from './pages/Login';
import Layout from './components/Layout';
import Dashboard from './pages/Dashboard';
import LicenseExpired from './components/LicenseExpired';

// Lazy-loaded pages (code-splitting)
const Products = React.lazy(() => import('./pages/Products'));
const Sales = React.lazy(() => import('./pages/Sales'));
const Purchases = React.lazy(() => import('./pages/Purchases'));
const Counterparties = React.lazy(() => import('./pages/Counterparties'));
const Reports = React.lazy(() => import('./pages/Reports'));
const Finance = React.lazy(() => import('./pages/Finance'));
const Warehouse = React.lazy(() => import('./pages/Warehouse'));
const Employees = React.lazy(() => import('./pages/Employees'));
const Invoices = React.lazy(() => import('./pages/Invoices'));
const CRM = React.lazy(() => import('./pages/CRM'));
const Settings = React.lazy(() => import('./pages/Settings'));
const ConfigurationSelector = React.lazy(() => import('./pages/ConfigurationSelector'));
const Categories = React.lazy(() => import('./pages/Categories'));
const Shifts = React.lazy(() => import('./pages/Shifts'));
const Returns = React.lazy(() => import('./pages/Returns'));
const ZReports = React.lazy(() => import('./pages/ZReports'));
const Implementation = React.lazy(() => import('./pages/Implementation'));
const ConfigurationSettings = React.lazy(() => import('./pages/ConfigurationSettings'));
const Development = React.lazy(() => import('./pages/Development'));
const Integrations = React.lazy(() => import('./pages/Integrations'));
const Administration = React.lazy(() => import('./pages/Administration'));
const Support = React.lazy(() => import('./pages/Support'));
const Updates = React.lazy(() => import('./pages/Updates'));
const Automation = React.lazy(() => import('./pages/Automation'));
const Testing = React.lazy(() => import('./pages/Testing'));
const DataMigration = React.lazy(() => import('./pages/DataMigration'));
const PermissionsManagement = React.lazy(() => import('./pages/PermissionsManagement'));
const AuditLog = React.lazy(() => import('./pages/AuditLog'));
const Analytics = React.lazy(() => import('./pages/Analytics'));
const Inventory = React.lazy(() => import('./pages/Inventory'));
const Batches = React.lazy(() => import('./pages/Batches'));
const SalesPipeline = React.lazy(() => import('./pages/SalesPipeline'));
const LoyaltyProgram = React.lazy(() => import('./pages/LoyaltyProgram'));
const RFMAnalysis = React.lazy(() => import('./pages/RFMAnalysis'));
const EmailCampaigns = React.lazy(() => import('./pages/EmailCampaigns'));
const WarehouseMap = React.lazy(() => import('./pages/WarehouseMap'));
const ScheduledTasks = React.lazy(() => import('./pages/ScheduledTasks'));
const Sync1CSettings = React.lazy(() => import('./pages/Sync1CSettings'));
const TelegramSettings = React.lazy(() => import('./pages/TelegramSettings'));
const PaymentSettings = React.lazy(() => import('./pages/PaymentSettings'));
const LoyaltyCards = React.lazy(() => import('./pages/LoyaltyCards'));
const LoyaltySettings = React.lazy(() => import('./pages/LoyaltySettings'));
const GiftCertificates = React.lazy(() => import('./pages/GiftCertificates'));
const Installments = React.lazy(() => import('./pages/Installments'));
const SMSCampaigns = React.lazy(() => import('./pages/SMSCampaigns'));
const WorkSchedule = React.lazy(() => import('./pages/WorkSchedule'));
const ReferralProgram = React.lazy(() => import('./pages/ReferralProgram'));
const Preorders = React.lazy(() => import('./pages/Preorders'));
const Backups = React.lazy(() => import('./pages/Backups'));
const SerialNumbers = React.lazy(() => import('./pages/SerialNumbers'));
const ExpiryTracking = React.lazy(() => import('./pages/ExpiryTracking'));
const ProductBundles = React.lazy(() => import('./pages/ProductBundles'));
const CustomerReviews = React.lazy(() => import('./pages/CustomerReviews'));
const Equipment = React.lazy(() => import('./pages/Equipment'));
const AIForecasting = React.lazy(() => import('./pages/AIForecasting'));
const CustomerDeposits = React.lazy(() => import('./pages/CustomerDeposits'));
const TipsReport = React.lazy(() => import('./pages/TipsReport'));
const Achievements = React.lazy(() => import('./pages/Achievements'));
const Wishlists = React.lazy(() => import('./pages/Wishlists'));
const ProductModifiers = React.lazy(() => import('./pages/ProductModifiers'));
const BirthdayCampaigns = React.lazy(() => import('./pages/BirthdayCampaigns'));
const CustomerLevels = React.lazy(() => import('./pages/CustomerLevels'));
const SplitPayments = React.lazy(() => import('./pages/SplitPayments'));
const TrainingVideos = React.lazy(() => import('./pages/TrainingVideos'));
const KeyboardShortcuts = React.lazy(() => import('./pages/KeyboardShortcuts'));
const CardRefunds = React.lazy(() => import('./pages/CardRefunds'));
const PriceTagPrinter = React.lazy(() => import('./pages/PriceTagPrinter'));
const CrossDocking = React.lazy(() => import('./pages/CrossDocking'));
const OfflineSettings = React.lazy(() => import('./pages/OfflineSettings'));
const ReceiptSettings = React.lazy(() => import('./pages/ReceiptSettings'));
const Notifications = React.lazy(() => import('./pages/Notifications'));
const ABCXYZAnalysis = React.lazy(() => import('./pages/ABCXYZAnalysis'));
const Currencies = React.lazy(() => import('./pages/Currencies'));
const ImportExport = React.lazy(() => import('./pages/ImportExport'));
const DashboardSettings = React.lazy(() => import('./pages/DashboardSettings'));
const StockTransfers = React.lazy(() => import('./pages/StockTransfers'));
const PriceHistory = React.lazy(() => import('./pages/PriceHistory'));
const SupplierContracts = React.lazy(() => import('./pages/SupplierContracts'));
const FiscalReports = React.lazy(() => import('./pages/FiscalReports'));
const BankIntegration = React.lazy(() => import('./pages/BankIntegration'));
const TimeTracking = React.lazy(() => import('./pages/TimeTracking'));
const CashOperations = React.lazy(() => import('./pages/CashOperations'));
const ProductLabels = React.lazy(() => import('./pages/ProductLabels'));
const Deliveries = React.lazy(() => import('./pages/Deliveries'));
const Promotions = React.lazy(() => import('./pages/Promotions'));
const Quotations = React.lazy(() => import('./pages/Quotations'));
const ProfitLoss = React.lazy(() => import('./pages/ProfitLoss'));
const Permissions = React.lazy(() => import('./pages/Permissions'));
const CustomerSegments = React.lazy(() => import('./pages/CustomerSegments'));
const SupplierRatings = React.lazy(() => import('./pages/SupplierRatings'));
const SalesForecast = React.lazy(() => import('./pages/SalesForecast'));
const PurchasePlanning = React.lazy(() => import('./pages/PurchasePlanning'));
const AutoOrder = React.lazy(() => import('./pages/AutoOrder'));
const MinimumStock = React.lazy(() => import('./pages/MinimumStock'));
const Payroll = React.lazy(() => import('./pages/Payroll'));
const EmployeeKPI = React.lazy(() => import('./pages/EmployeeKPI'));
const Marketplaces = React.lazy(() => import('./pages/Marketplaces'));
const APIDocumentation = React.lazy(() => import('./pages/APIDocumentation'));
const PushNotifications = React.lazy(() => import('./pages/PushNotifications'));
const TargetedOffers = React.lazy(() => import('./pages/TargetedOffers'));
const OrderTracking = React.lazy(() => import('./pages/OrderTracking'));
const CustomerPortal = React.lazy(() => import('./pages/CustomerPortal'));
const ConversionFunnel = React.lazy(() => import('./pages/ConversionFunnel'));
const CohortAnalysis = React.lazy(() => import('./pages/CohortAnalysis'));
const SalesHeatmap = React.lazy(() => import('./pages/SalesHeatmap'));
const TaxReports = React.lazy(() => import('./pages/TaxReports'));
const GoodsReceiving = React.lazy(() => import('./pages/GoodsReceiving'));
const CashDrawer = React.lazy(() => import('./pages/CashDrawer'));
const InventoryValuation = React.lazy(() => import('./pages/InventoryValuation'));
const AccountingEntries = React.lazy(() => import('./pages/AccountingEntries'));
const BalanceSheet = React.lazy(() => import('./pages/BalanceSheet'));
const Receivables = React.lazy(() => import('./pages/Receivables'));
const Payables = React.lazy(() => import('./pages/Payables'));
const ReconciliationAct = React.lazy(() => import('./pages/ReconciliationAct'));
const Waybills = React.lazy(() => import('./pages/Waybills'));
const Contracts = React.lazy(() => import('./pages/Contracts'));
const DigitalSignature = React.lazy(() => import('./pages/DigitalSignature'));
const BOMRecipes = React.lazy(() => import('./pages/BOMRecipes'));
const ProductionOrders = React.lazy(() => import('./pages/ProductionOrders'));
const CostCalculation = React.lazy(() => import('./pages/CostCalculation'));
const DeliveryRoutes = React.lazy(() => import('./pages/DeliveryRoutes'));
const GPSTracking = React.lazy(() => import('./pages/GPSTracking'));
const DeliveryZones = React.lazy(() => import('./pages/DeliveryZones'));
const TwoFactorAuth = React.lazy(() => import('./pages/TwoFactorAuth'));
const IPWhitelist = React.lazy(() => import('./pages/IPWhitelist'));
const UserSessions = React.lazy(() => import('./pages/UserSessions'));
const ThemeSettings = React.lazy(() => import('./pages/ThemeSettings'));
const DashboardWidgets = React.lazy(() => import('./pages/DashboardWidgets'));
const QuickActions = React.lazy(() => import('./pages/QuickActions'));
const StaffManagement = React.lazy(() => import('./pages/StaffManagement'));
const GoogleSheetsSettings = React.lazy(() => import('./pages/GoogleSheetsSettings'));
const StockManagement = React.lazy(() => import('./pages/StockManagement'));
// 1C Professional Features
// Склад
// HR
// Интеграции и маркетинг
// Мобильное
// Маркетинг и Аналитика
// Финансы и Склад
// Финансовый учёт
// Документооборот
// Производство
// Логистика
// Безопасность
// UX
function App() {
    const [isAuthenticated, setIsAuthenticated] = useState(false);
    const [loading, setLoading] = useState(true);
    const [licenseExpired, setLicenseExpired] = useState(false);
    const [licenseExpiryDate, setLicenseExpiryDate] = useState(null);

    // Проверка лицензии
    const checkLicense = async () => {
        try {
            const licenseInfo = JSON.parse(localStorage.getItem('license_info') || 'null');
            const user = JSON.parse(localStorage.getItem('user') || 'null');

            // Если нет лицензии (super_admin) — пропускаем
            if (!licenseInfo && (!user || user.user_type === 'super_admin')) return;

            // Локальная проверка expires_at
            if (licenseInfo && licenseInfo.expires_at) {
                const expiresAt = new Date(licenseInfo.expires_at);
                if (expiresAt < new Date()) {
                    setLicenseExpired(true);
                    setLicenseExpiryDate(licenseInfo.expires_at);
                    return;
                }
            }

            // Проверка через сервер (если есть токен)
            const token = localStorage.getItem('token');
            if (token && licenseInfo && licenseInfo.id) {
                try {
                    const apiUrl = localStorage.getItem('server_url') || 'http://localhost:5000';
                    const resp = await fetch(`${apiUrl}/api/license/check-expiry`, {
                        headers: { 'Authorization': `Bearer ${token}` }
                    });
                    if (resp.ok) {
                        const data = await resp.json();
                        if (data.expired) {
                            setLicenseExpired(true);
                            setLicenseExpiryDate(data.expires_at);
                            return;
                        }
                        // Обновить локальные данные лицензии
                        if (data.license) {
                            localStorage.setItem('license_info', JSON.stringify(data.license));
                        }
                    }
                } catch (e) {
                    // Сервер недоступен — полагаемся на локальную проверку
                }
            }
        } catch (e) {
            console.error('License check error:', e);
        }
    };

    useEffect(() => {
        const token = localStorage.getItem('token');
        setIsAuthenticated(!!token);
        setLoading(false);

        // Проверка лицензии при загрузке
        if (token) checkLicense();

        // Периодическая проверка каждые 5 минут
        const interval = setInterval(() => {
            if (localStorage.getItem('token')) checkLicense();
        }, 5 * 60 * 1000);

        return () => clearInterval(interval);
    }, []);

    // Повторная проверка при логине
    useEffect(() => {
        if (isAuthenticated) checkLicense();
    }, [isAuthenticated]);

    if (loading) {
        return (
            <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh' }}>
                <div className="spinner"></div>
            </div>
        );
    }

    // Блокировка при истечении лицензии
    if (licenseExpired) {
        return <LicenseExpired expiryDate={licenseExpiryDate} />;
    }

    return (
        <I18nProvider>
        <ErrorBoundary>
            <ConfirmProvider>
                <ToastProvider>
                    <HashRouter>
                        <Suspense fallback={<LoadingSpinner />}>
                            <Routes>
                                <Route path="/login" element={
                                    isAuthenticated ? <Navigate to="/" /> : <Login onLogin={() => setIsAuthenticated(true)} />
                                } />

                                <Route path="/" element={
                                    isAuthenticated ? <Layout onLogout={() => setIsAuthenticated(false)} /> : <Navigate to="/login" />
                                }>
                                    <Route index element={<Dashboard />} />
                                    <Route path="products" element={<Products />} />
                                    <Route path="sales" element={<Sales />} />
                                    <Route path="purchases" element={<Purchases />} />
                                    <Route path="counterparties" element={<Counterparties />} />
                                    <Route path="finance" element={<Finance />} />
                                    <Route path="warehouse" element={<Warehouse />} />
                                    <Route path="employees" element={<Employees />} />
                                    <Route path="invoices" element={<Invoices />} />
                                    <Route path="crm" element={<CRM />} />
                                    <Route path="reports" element={<Reports />} />
                                    <Route path="settings" element={<Settings />} />
                                    <Route path="categories" element={<Categories />} />
                                    <Route path="shifts" element={<Shifts />} />
                                    <Route path="returns" element={<Returns />} />
                                    <Route path="z-reports" element={<ZReports />} />
                                    <Route path="configure" element={<ConfigurationSelector />} />

                                    {/* 1C Professional Features */}
                                    <Route path="implementation" element={<Implementation />} />
                                    <Route path="configuration-settings" element={<ConfigurationSettings />} />
                                    <Route path="development" element={<Development />} />
                                    <Route path="integrations" element={<Integrations />} />
                                    <Route path="administration" element={<Administration />} />
                                    <Route path="support" element={<Support />} />
                                    <Route path="updates" element={<Updates />} />
                                    <Route path="automation" element={<Automation />} />
                                    <Route path="testing" element={<Testing />} />
                                    <Route path="data-migration" element={<DataMigration />} />

                                    {/* Security & Audit */}
                                    <Route path="analytics" element={<Analytics />} />
                                    <Route path="permissions" element={<PermissionsManagement />} />
                                    <Route path="audit-log" element={<AuditLog />} />

                                    {/* WMS */}
                                    <Route path="inventory" element={<Inventory />} />
                                    <Route path="batches" element={<Batches />} />
                                    <Route path="stock-management" element={<StockManagement />} />

                                    {/* CRM */}
                                    <Route path="sales-pipeline" element={<SalesPipeline />} />
                                    <Route path="loyalty" element={<LoyaltyProgram />} />
                                    <Route path="rfm-analysis" element={<RFMAnalysis />} />
                                    <Route path="email-campaigns" element={<EmailCampaigns />} />
                                    <Route path="loyalty-settings" element={<LoyaltySettings />} />

                                    {/* Settings */}
                                    <Route path="warehouse-map" element={<WarehouseMap />} />
                                    <Route path="scheduled-tasks" element={<ScheduledTasks />} />
                                    <Route path="sync1c-settings" element={<Sync1CSettings />} />
                                    <Route path="telegram-settings" element={<TelegramSettings />} />
                                    <Route path="payment-settings" element={<PaymentSettings />} />
                                    <Route path="loyalty-cards" element={<LoyaltyCards />} />
                                    <Route path="gift-certificates" element={<GiftCertificates />} />
                                    <Route path="installments" element={<Installments />} />
                                    <Route path="sms-campaigns" element={<SMSCampaigns />} />
                                    <Route path="work-schedule" element={<WorkSchedule />} />
                                    <Route path="referrals" element={<ReferralProgram />} />
                                    <Route path="preorders" element={<Preorders />} />
                                    <Route path="backups" element={<Backups />} />
                                    <Route path="serial-numbers" element={<SerialNumbers />} />
                                    <Route path="expiry-tracking" element={<ExpiryTracking />} />
                                    <Route path="product-bundles" element={<ProductBundles />} />
                                    <Route path="reviews" element={<CustomerReviews />} />
                                    <Route path="equipment" element={<Equipment />} />
                                    <Route path="ai-forecasting" element={<AIForecasting />} />
                                    <Route path="deposits" element={<CustomerDeposits />} />
                                    <Route path="tips" element={<TipsReport />} />
                                    <Route path="achievements" element={<Achievements />} />
                                    <Route path="wishlists" element={<Wishlists />} />
                                    <Route path="modifiers" element={<ProductModifiers />} />
                                    <Route path="birthday-campaigns" element={<BirthdayCampaigns />} />
                                    <Route path="customer-levels" element={<CustomerLevels />} />
                                    <Route path="split-payments" element={<SplitPayments />} />
                                    <Route path="training" element={<TrainingVideos />} />
                                    <Route path="shortcuts" element={<KeyboardShortcuts />} />
                                    <Route path="card-refunds" element={<CardRefunds />} />
                                    <Route path="price-tags" element={<PriceTagPrinter />} />
                                    <Route path="cross-docking" element={<CrossDocking />} />
                                    <Route path="offline" element={<OfflineSettings />} />
                                    <Route path="receipt-settings" element={<ReceiptSettings />} />
                                    <Route path="notifications" element={<Notifications />} />
                                    <Route path="staff-management" element={<StaffManagement />} />
                                    <Route path="abc-xyz" element={<ABCXYZAnalysis />} />
                                    <Route path="currencies" element={<Currencies />} />
                                    <Route path="import-export" element={<ImportExport />} />
                                    <Route path="dashboard-settings" element={<DashboardSettings />} />
                                    <Route path="stock-transfers" element={<StockTransfers />} />
                                    <Route path="price-history" element={<PriceHistory />} />
                                    <Route path="supplier-contracts" element={<SupplierContracts />} />
                                    <Route path="returns" element={<Returns />} />
                                    <Route path="fiscal-reports" element={<FiscalReports />} />
                                    <Route path="bank-integration" element={<BankIntegration />} />
                                    <Route path="time-tracking" element={<TimeTracking />} />
                                    <Route path="cash-operations" element={<CashOperations />} />
                                    <Route path="product-labels" element={<ProductLabels />} />
                                    <Route path="deliveries" element={<Deliveries />} />
                                    <Route path="promotions" element={<Promotions />} />
                                    <Route path="quotations" element={<Quotations />} />
                                    <Route path="profit-loss" element={<ProfitLoss />} />
                                    <Route path="audit-log" element={<AuditLog />} />
                                    <Route path="permissions" element={<Permissions />} />
                                    <Route path="customer-segments" element={<CustomerSegments />} />
                                    <Route path="supplier-ratings" element={<SupplierRatings />} />
                                    <Route path="sales-forecast" element={<SalesForecast />} />
                                    <Route path="purchase-planning" element={<PurchasePlanning />} />
                                    <Route path="auto-order" element={<AutoOrder />} />
                                    <Route path="minimum-stock" element={<MinimumStock />} />
                                    <Route path="payroll" element={<Payroll />} />
                                    <Route path="work-schedule" element={<WorkSchedule />} />
                                    <Route path="employee-kpi" element={<EmployeeKPI />} />
                                    <Route path="marketplaces" element={<Marketplaces />} />
                                    <Route path="api-docs" element={<APIDocumentation />} />
                                    <Route path="push-notifications" element={<PushNotifications />} />
                                    <Route path="targeted-offers" element={<TargetedOffers />} />
                                    <Route path="order-tracking" element={<OrderTracking />} />
                                    <Route path="customer-portal" element={<CustomerPortal />} />
                                    <Route path="email-campaigns" element={<EmailCampaigns />} />
                                    <Route path="conversion-funnel" element={<ConversionFunnel />} />
                                    <Route path="cohort-analysis" element={<CohortAnalysis />} />
                                    <Route path="sales-heatmap" element={<SalesHeatmap />} />
                                    <Route path="tax-reports" element={<TaxReports />} />
                                    <Route path="goods-receiving" element={<GoodsReceiving />} />
                                    <Route path="cash-drawer" element={<CashDrawer />} />
                                    <Route path="inventory-valuation" element={<InventoryValuation />} />
                                    {/* Финансовый учёт */}
                                    <Route path="accounting-entries" element={<AccountingEntries />} />
                                    <Route path="balance-sheet" element={<BalanceSheet />} />
                                    <Route path="receivables" element={<Receivables />} />
                                    <Route path="payables" element={<Payables />} />
                                    <Route path="reconciliation-act" element={<ReconciliationAct />} />
                                    {/* Документооборот */}
                                    <Route path="invoices" element={<Invoices />} />
                                    <Route path="waybills" element={<Waybills />} />
                                    <Route path="contracts" element={<Contracts />} />
                                    <Route path="digital-signature" element={<DigitalSignature />} />
                                    {/* Производство */}
                                    <Route path="bom-recipes" element={<BOMRecipes />} />
                                    <Route path="production-orders" element={<ProductionOrders />} />
                                    <Route path="cost-calculation" element={<CostCalculation />} />
                                    {/* Логистика */}
                                    <Route path="delivery-routes" element={<DeliveryRoutes />} />
                                    <Route path="gps-tracking" element={<GPSTracking />} />
                                    <Route path="delivery-zones" element={<DeliveryZones />} />
                                    {/* Безопасность */}
                                    <Route path="two-factor-auth" element={<TwoFactorAuth />} />
                                    <Route path="ip-whitelist" element={<IPWhitelist />} />
                                    <Route path="user-sessions" element={<UserSessions />} />
                                    {/* UX */}
                                    <Route path="theme-settings" element={<ThemeSettings />} />
                                    <Route path="dashboard-widgets" element={<DashboardWidgets />} />
                                    <Route path="quick-actions" element={<QuickActions />} />
                                    {/* Синхронизация */}
                                    <Route path="google-sheets" element={<GoogleSheetsSettings />} />
                                </Route>
                            </Routes>
                        </Suspense>
                    </HashRouter>
                </ToastProvider>
            </ConfirmProvider>
        </ErrorBoundary>
        </I18nProvider>
    );
}

export default App;
