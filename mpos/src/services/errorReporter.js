/**
 * ErrorReporter Service
 * Sends errors from mobile app to the central error monitoring system
 */

import AsyncStorage from '@react-native-async-storage/async-storage';
import { getApiUrl } from '../config/settings';
import { Platform } from 'react-native';

let Constants = null;
try {
    Constants = require('expo-constants').default;
} catch (e) {
    console.warn('[ErrorReporter] expo-constants not available');
}

class ErrorReporter {
    static isInitialized = false;
    static userId = null;
    static deviceInfo = null;
    static errorQueue = [];
    static isSending = false;
    static failureCount = 0;
    static maxFailures = 5;
    static lastReportTime = 0;
    static reportCooldown = 10000; // 10 seconds between reports

    /**
     * Initialize the error reporter
     */
    static async init() {
        if (this.isInitialized) return;

        try {
            // Get device info
            this.deviceInfo = {
                platform: Platform.OS,
                version: Platform.Version,
                appVersion: Constants?.expoConfig?.version || '2.3.0',
                deviceModel: Constants?.platform?.android?.model || Constants?.platform?.ios?.model || 'unknown'
            };

            // Get user ID if logged in
            const userStr = await AsyncStorage.getItem('user');
            if (userStr) {
                const user = JSON.parse(userStr);
                this.userId = user.id;
            }

            // Set up global error handler
            this.setupGlobalErrorHandler();

            // Process queued errors
            await this.processQueue();

            this.isInitialized = true;
            console.log('[ErrorReporter] Initialized');
        } catch (error) {
            console.error('[ErrorReporter] Init failed:', error);
        }
    }

    /**
     * Set up global error handler for unhandled errors
     */
    static setupGlobalErrorHandler() {
        // Handle unhandled promise rejections
        const originalHandler = global.ErrorUtils?.getGlobalHandler();

        global.ErrorUtils?.setGlobalHandler((error, isFatal) => {
            this.report({
                severity: isFatal ? 'critical' : 'error',
                message: error.message || 'Unknown error',
                stack_trace: error.stack,
                component: 'GlobalErrorHandler',
                metadata: { isFatal }
            });

            // Call original handler
            if (originalHandler) {
                originalHandler(error, isFatal);
            }
        });
    }

    /**
     * Report an error to the server
     * @param {Object} errorData - Error details
     */
    static async report(errorData) {
        // Rate limiting: skip if too many failures or too frequent
        const now = Date.now();
        if (this.failureCount >= this.maxFailures) {
            return false; // Silently skip until server is back
        }
        if (now - this.lastReportTime < this.reportCooldown) {
            return false; // Cooldown period
        }
        this.lastReportTime = now;

        const payload = {
            type: 'mobile',
            severity: errorData.severity || 'error',
            message: errorData.message,
            stack_trace: errorData.stack_trace || null,
            component: errorData.component || 'MobileApp',
            url: errorData.screen || 'mobile-pos',
            metadata: {
                ...errorData.metadata,
                device: this.deviceInfo,
                userId: this.userId
            }
        };

        try {
            const apiUrl = getApiUrl();
            const token = await AsyncStorage.getItem('token');

            const response = await fetch(`${apiUrl}/errors`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    ...(token ? { 'Authorization': `Bearer ${token}` } : {})
                },
                body: JSON.stringify(payload)
            });

            if (!response.ok) {
                throw new Error(`HTTP ${response.status}`);
            }

            this.failureCount = 0; // Reset on success
            return true;
        } catch (sendError) {
            this.failureCount++;
            if (this.failureCount >= this.maxFailures) {
                console.warn('[ErrorReporter] Server unreachable, pausing reports');
            }
            this.queueError(payload);
            return false;
        }
    }

    /**
     * Queue error for later sending (offline support)
     */
    static async queueError(payload) {
        try {
            const queueStr = await AsyncStorage.getItem('error_queue');
            const queue = queueStr ? JSON.parse(queueStr) : [];
            queue.push({ ...payload, queuedAt: new Date().toISOString() });

            // Keep only last 50 errors
            const trimmedQueue = queue.slice(-50);
            await AsyncStorage.setItem('error_queue', JSON.stringify(trimmedQueue));
        } catch (e) {
            console.error('[ErrorReporter] Queue failed:', e);
        }
    }

    /**
     * Process queued errors when online
     */
    static async processQueue() {
        if (this.isSending) return;
        this.isSending = true;

        try {
            const queueStr = await AsyncStorage.getItem('error_queue');
            if (!queueStr) {
                this.isSending = false;
                return;
            }

            const queue = JSON.parse(queueStr);
            if (queue.length === 0) {
                this.isSending = false;
                return;
            }

            const apiUrl = getApiUrl();
            const token = await AsyncStorage.getItem('token');
            const successfulIds = [];

            for (let i = 0; i < queue.length; i++) {
                try {
                    const response = await fetch(`${apiUrl}/errors`, {
                        method: 'POST',
                        headers: {
                            'Content-Type': 'application/json',
                            ...(token ? { 'Authorization': `Bearer ${token}` } : {})
                        },
                        body: JSON.stringify(queue[i])
                    });

                    if (response.ok) {
                        successfulIds.push(i);
                    }
                } catch (e) {
                    // Stop processing if offline
                    break;
                }
            }

            // Remove sent errors from queue
            if (successfulIds.length > 0) {
                const remaining = queue.filter((_, idx) => !successfulIds.includes(idx));
                await AsyncStorage.setItem('error_queue', JSON.stringify(remaining));
                console.log(`[ErrorReporter] Processed ${successfulIds.length} queued errors`);
            }
        } catch (e) {
            console.error('[ErrorReporter] Process queue error:', e);
        } finally {
            this.isSending = false;
        }
    }

    /**
     * Report a caught exception
     */
    static catch(error, component = 'Unknown') {
        return this.report({
            severity: 'error',
            message: error.message || String(error),
            stack_trace: error.stack,
            component
        });
    }

    /**
     * Report a warning
     */
    static warn(message, component = 'Unknown', metadata = {}) {
        return this.report({
            severity: 'warning',
            message,
            component,
            metadata
        });
    }

    /**
     * Report a critical error
     */
    static critical(message, component = 'Unknown', metadata = {}) {
        return this.report({
            severity: 'critical',
            message,
            component,
            metadata
        });
    }

    /**
     * Update user ID after login
     */
    static setUserId(userId) {
        this.userId = userId;
    }

    /**
     * Clear user ID after logout
     */
    static clearUser() {
        this.userId = null;
    }
}

export default ErrorReporter;
