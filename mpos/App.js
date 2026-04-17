import 'react-native-gesture-handler';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import React, { useState, useEffect, useRef, useCallback } from 'react';
import { StyleSheet, View, StatusBar, AppState } from 'react-native';
import { Provider as PaperProvider, MD3DarkTheme, MD3LightTheme } from 'react-native-paper';
import { NavigationContainer, DarkTheme, DefaultTheme } from '@react-navigation/native';
import { createStackNavigator } from '@react-navigation/stack';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import AsyncStorage from '@react-native-async-storage/async-storage';

// Screens
import LoginScreen from './src/screens/LoginScreen';
import ServerSetupScreen from './src/screens/ServerSetupScreen';
import HomeScreen from './src/screens/HomeScreen';
import ProductsScreen from './src/screens/ProductsScreen';
import CartScreen from './src/screens/CartScreen';
import SalesHistoryScreen from './src/screens/SalesHistoryScreen';
import SaleDetailsScreen from './src/screens/SaleDetailsScreen';
import BarcodeScannerScreen from './src/screens/BarcodeScannerScreen';
import PaymentMethodsScreen from './src/screens/PaymentMethodsScreen';
import ReturnsScreen from './src/screens/ReturnsScreen';
import ReturnsHistoryScreen from './src/screens/ReturnsHistoryScreen';
import ShiftManagementScreen from './src/screens/ShiftManagementScreen';
import SettingsScreen from './src/screens/SettingsScreen';
import ReportsScreen from './src/screens/ReportsScreen';
import CustomersScreen from './src/screens/CustomersScreen';
import InventoryScreen from './src/screens/InventoryScreen';
import QRPaymentScreen from './src/screens/QRPaymentScreen';
import CashierSwitchScreen from './src/screens/CashierSwitchScreen';
import ServerSettingsScreen from './src/screens/ServerSettingsScreen';
import SyncScreen from './src/screens/SyncScreen';
import LoyaltyScreen from './src/screens/LoyaltyScreen';
import NotificationsScreen from './src/screens/NotificationsScreen';

// Context & Services
import { ThemeProvider, useTheme, COLORS } from './src/context/ThemeContext';
import SettingsService, { THEMES } from './src/services/settings';
import ErrorReporter from './src/services/errorReporter';
import ErrorBoundary from './src/components/ErrorBoundary';
import UpdateChecker from './src/components/UpdateChecker';
import { setApiUrl, initSettings } from './src/config/settings';
import SocketService from './src/services/socketService';
import Sync1CService from './src/services/sync1c';
import { I18nProvider } from './src/i18n';
import { ConnectionProvider } from './src/context/ConnectionContext';
import OfflineBanner from './src/components/OfflineBanner';

// 🚀 EXTREME EARLY LOGGING (RAUND 7)
// Перехватываем консоль сразу, чтобы поймать ошибки до отрисовки
// Console error logging (non-recursive, won't trigger ErrorReporter)
const originalConsoleError = console.error;
console.error = (...args) => {
    // Just log, don't send to ErrorReporter to avoid infinite loop
    originalConsoleError.apply(console, args);
};

// Инициализируем логгер НЕМЕДЛЕННО (без setTimeout)
try {
    ErrorReporter.init();
} catch (e) {
    console.warn('[App] ErrorReporter init failed:', e.message);
}

const Stack = createStackNavigator();

// Темы Material Design
const createPaperTheme = (isDark) => {
    const base = isDark ? MD3DarkTheme : MD3LightTheme;
    const colors = isDark ? COLORS.dark : COLORS.light;

    return {
        ...base,
        colors: {
            ...base.colors,
            primary: colors.primary,
            secondary: colors.secondary,
            background: colors.background,
            surface: colors.surface,
            error: colors.error,
            onSurface: colors.text,
            onBackground: colors.text,
        },
    };
};

function AppNavigator({ onLogout }) {
    const { theme, colors, isDark, setTheme } = useTheme();
    const [isAuthenticated, setIsAuthenticated] = useState(false);
    const [serverConfigured, setServerConfigured] = useState(false);
    const [loading, setLoading] = useState(true);
    const appState = useRef(AppState.currentState);

    useEffect(() => {
        checkAuth();

        // Фоновый синхронизатор: запускать при возврате из фона
        const sub = AppState.addEventListener('change', (nextState) => {
            if (appState.current.match(/inactive|background/) && nextState === 'active') {
                Sync1CService.backgroundSync().catch(() => {});
            }
            appState.current = nextState;
        });

        return () => sub.remove();
    }, []);

    const checkAuth = async () => {
        try {
            // Инициализировать настройки
            await initSettings();

            // Проверка сохранённого URL сервера
            const savedServerUrl = await AsyncStorage.getItem('server_url');
            if (!savedServerUrl) {
                console.log('[App] No server configured, showing ServerSetupScreen');
                setServerConfigured(false);
                setLoading(false);
                return;
            }
            setServerConfigured(true);
            const apiUrl = savedServerUrl.endsWith('/api') ? savedServerUrl : `${savedServerUrl}/api`;
            setApiUrl(apiUrl);
            console.log('[App] Server URL restored:', apiUrl);

            const token = await AsyncStorage.getItem('token');
            if (token) {
                console.log('[App] Token found, user is authenticated');
            } else {
                console.log('[App] No token found');
            }
            setIsAuthenticated(!!token);
        } catch (error) {
            console.error('Auth check error:', error);
        } finally {
            setLoading(false);
        }
    };

    const handleLogin = () => {
        setIsAuthenticated(true);
        // Подключить Socket.IO и запустить фоновую синхронизацию после входа
        setTimeout(() => {
            try { SocketService.connect(); } catch (e) { /* non-critical */ }
            Sync1CService.backgroundSync().catch(() => {});
        }, 1000);
    };

    const handleLogout = async () => {
        await AsyncStorage.removeItem('token');
        await AsyncStorage.removeItem('user');
        SocketService.disconnect();
        setIsAuthenticated(false);
    };

    if (loading) return null;

    const navTheme = isDark ? DarkTheme : DefaultTheme;
    const paperTheme = createPaperTheme(isDark);

    return (
        <PaperProvider theme={paperTheme}>
            <StatusBar
                barStyle={isDark ? 'light-content' : 'dark-content'}
                backgroundColor={colors.background}
            />
            <UpdateChecker>
                <NavigationContainer theme={navTheme}>
                    <View style={{flex: 1}}>
                        <OfflineBanner />
                        <Stack.Navigator
                            screenOptions={{
                                headerStyle: { backgroundColor: colors.surface },
                                headerTintColor: colors.text,
                                headerTitleStyle: { fontWeight: 'bold' },
                                cardStyle: { backgroundColor: colors.background },
                            }}
                        >
                        {!serverConfigured ? (
                            <Stack.Screen name="ServerSetup" options={{ headerShown: false }}>
                                {(props) => <ServerSetupScreen {...props} onConnected={() => {
                                    setServerConfigured(true);
                                    checkAuth();
                                }} />}
                            </Stack.Screen>
                        ) : !isAuthenticated ? (
                            <Stack.Screen name="Login" options={{ headerShown: false }}>
                                {(props) => <LoginScreen {...props} onLogin={handleLogin} onChangeServer={() => {
                                    setServerConfigured(false);
                                    setIsAuthenticated(false);
                                }} />}
                            </Stack.Screen>
                            ) : (
                                <>
                                    <Stack.Screen name="Home" options={{ title: 'SmartPOS Pro' }}>
                                        {(props) => <HomeScreen {...props} onLogout={handleLogout} />}
                                    </Stack.Screen>
                                    <Stack.Screen name="Products" component={ProductsScreen} options={{ title: 'Каталог' }} />
                                    <Stack.Screen name="Cart" component={CartScreen} options={{ title: 'Корзина' }} />
                                    <Stack.Screen name="SalesHistory" component={SalesHistoryScreen} options={{ title: 'История' }} />
                                    <Stack.Screen name="SaleDetails" component={SaleDetailsScreen} options={{ title: 'Детали' }} />
                                    <Stack.Screen name="Scanner" component={BarcodeScannerScreen} options={{ headerShown: false }} />
                                    <Stack.Screen name="PaymentMethods" component={PaymentMethodsScreen} options={{ title: 'Оплата' }} />
                                    <Stack.Screen name="Returns" component={ReturnsScreen} options={{ title: 'Возвраты' }} />
                                    <Stack.Screen name="ReturnsHistory" component={ReturnsHistoryScreen} options={{ title: 'История возвратов' }} />
                                    <Stack.Screen name="ShiftManagement" component={ShiftManagementScreen} options={{ title: 'Смена' }} />
                                    <Stack.Screen name="Settings" options={{ title: 'Настройки' }}>
                                        {(props) => <SettingsScreen {...props} onThemeChange={setTheme} />}
                                    </Stack.Screen>
                                    <Stack.Screen name="Reports" component={ReportsScreen} options={{ title: 'Отчёты' }} />
                                    <Stack.Screen name="Customers" component={CustomersScreen} options={{ title: 'Клиенты' }} />
                                    <Stack.Screen name="Inventory" component={InventoryScreen} options={{ title: 'Инвентаризация' }} />
                                    <Stack.Screen name="QRPayment" component={QRPaymentScreen} options={{ title: 'QR-оплата' }} />
                                    <Stack.Screen name="CashierSwitch" component={CashierSwitchScreen} options={{ title: 'Кассиры' }} />
                                    <Stack.Screen name="ServerSettings" component={ServerSettingsScreen} options={{ title: 'Сервер' }} />
                                    <Stack.Screen name="Sync" component={SyncScreen} options={{ title: 'Синхронизация' }} />
                                    <Stack.Screen name="Loyalty" component={LoyaltyScreen} options={{ title: 'Лояльность' }} />
                                    <Stack.Screen name="Notifications" component={NotificationsScreen} options={{ title: 'Уведомления' }} />
                                </>
                            )}
                        </Stack.Navigator>
                    </View>
                </NavigationContainer>
            </UpdateChecker>
        </PaperProvider>
    );
}

export default function App() {
    return (
        <GestureHandlerRootView style={{ flex: 1 }}>
            <SafeAreaProvider>
                <ErrorBoundary>
                    <I18nProvider>
                        <ThemeProvider>
                            <ConnectionProvider>
                                <AppNavigator />
                            </ConnectionProvider>
                        </ThemeProvider>
                    </I18nProvider>
                </ErrorBoundary>
            </SafeAreaProvider>
        </GestureHandlerRootView>
    );
}
