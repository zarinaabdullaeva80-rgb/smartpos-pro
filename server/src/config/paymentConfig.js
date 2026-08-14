/**
 * Payment Providers Configuration Module
 * SmartPOS Pro
 */

import dotenv from 'dotenv';
import pool from './database.js';

dotenv.config();

export async function fetchOrgPaymentSettings(organizationId) {
    if (!organizationId) return {};
    try {
        const res = await pool.query(
            'SELECT setting_key, setting_value FROM system_settings WHERE organization_id = $1',
            [organizationId]
        );
        const settings = {};
        res.rows.forEach(r => {
            let val = r.setting_value;
            if (typeof val === 'string' && (val.startsWith('"') || val.startsWith('{'))) {
                try { val = JSON.parse(val); } catch(e) {}
            }
            settings[r.setting_key] = val;
        });
        return settings;
    } catch (e) {
        console.error('Error fetching org payment settings:', e.message);
        return {};
    }
}

export function getPaymeConfig(orgSettings = {}) {
    return {
        merchantId: orgSettings.payme_merchant_id || process.env.PAYME_MERCHANT_ID || '6a7c062740e17562c3de2fb3',
        secretKey: orgSettings.payme_secret_key || process.env.PAYME_SECRET_KEY || 'GDHPD#ksEpE#nXo?7mjORbZ4cYVXVb5qWajh',
        testKey: orgSettings.payme_test_key || process.env.PAYME_TEST_KEY || 'P9WgOStP8xr5ZxC0aSCyR71tWr6579jjDo5W',
        isTest: orgSettings.payme_is_test !== undefined ? orgSettings.payme_is_test : (process.env.PAYME_IS_TEST !== 'false'),
        checkoutUrl: (orgSettings.payme_is_test !== false && process.env.PAYME_IS_TEST !== 'false')
            ? 'https://test.paycom.uz'
            : 'https://checkout.paycom.uz'
    };
}

export function getClickConfig(orgSettings = {}) {
    return {
        serviceId: orgSettings.click_service_id || process.env.CLICK_SERVICE_ID || '109579',
        merchantId: orgSettings.click_merchant_id || process.env.CLICK_MERCHANT_ID || '63646',
        secretKey: orgSettings.click_secret_key || process.env.CLICK_SECRET_KEY || 'fvy6lQSn6o0F',
        merchantUserId: orgSettings.click_merchant_user_id || process.env.CLICK_MERCHANT_USER_ID || '89491',
        isTest: orgSettings.click_is_test !== undefined ? orgSettings.click_is_test : (process.env.CLICK_IS_TEST !== 'false'),
        apiUrl: 'https://api.click.uz/v2/merchant'
    };
}
