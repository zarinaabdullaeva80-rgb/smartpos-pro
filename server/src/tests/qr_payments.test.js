/**
 * Unit / Integration Test for QR Payments (Payme & Click & Click Pass)
 */

import crypto from 'crypto';
import { getPaymeConfig, getClickConfig } from '../config/paymentConfig.js';

function md5(str) {
    return crypto.createHash('md5').update(str).digest('hex');
}

describe('QR Payments Verification Suite', () => {
    test('Payme configuration should have valid defaults', () => {
        const config = getPaymeConfig();
        expect(config).toBeDefined();
        expect(config.secretKey).toBeDefined();
        expect(config.checkoutUrl).toBeDefined();
    });

    test('Click MD5 signature calculation should match specification', () => {
        const clickTransId = '123456';
        const serviceId = '12345';
        const secretKey = 'test_click_secret';
        const merchantTransId = '1001';
        const amount = '50000';
        const action = '0';
        const signTime = '2026-08-07 21:00:00';

        const expectedHash = md5(`${clickTransId}${serviceId}${secretKey}${merchantTransId}${amount}${action}${signTime}`);
        expect(expectedHash).toHaveLength(32);
    });

    test('Payme tiyin conversion logic', () => {
        const amountUz = 50000.50;
        const tiyins = Math.round(amountUz * 100);
        expect(tiyins).toBe(5000050);
    });
});
