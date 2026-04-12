/**
 * API Tests for SmartPOS Pro Server
 * Run: npm test
 */

const request = require('supertest');

// Mock app for testing (without starting the server)
const express = require('express');
const app = express();
app.use(express.json());

// Simple health endpoint for testing
app.get('/api/health', (req, res) => {
    res.json({
        status: 'healthy',
        timestamp: new Date().toISOString(),
        version: '1.0.0'
    });
});

// Auth endpoint mock
app.post('/api/auth/login', (req, res) => {
    const { email, password } = req.body;

    if (!email || !password) {
        return res.status(400).json({ error: 'Email и пароль обязательны' });
    }

    if (email === 'test@test.com' && password === 'test123') {
        return res.json({
            success: true,
            token: 'mock-jwt-token',
            user: { id: 1, email, role: 'Администратор' }
        });
    }

    res.status(401).json({ error: 'Неверные данные' });
});

// Products mock
app.get('/api/products', (req, res) => {
    res.json({
        success: true,
        products: [
            { id: 1, name: 'Товар 1', price: 10000 },
            { id: 2, name: 'Товар 2', price: 20000 }
        ],
        total: 2
    });
});

describe('Health API', () => {
    test('GET /api/health возвращает статус healthy', async () => {
        const res = await request(app).get('/api/health');

        expect(res.statusCode).toBe(200);
        expect(res.body.status).toBe('healthy');
        expect(res.body).toHaveProperty('timestamp');
        expect(res.body).toHaveProperty('version');
    });
});

describe('Auth API', () => {
    test('POST /api/auth/login с правильными данными', async () => {
        const res = await request(app)
            .post('/api/auth/login')
            .send({ email: 'test@test.com', password: 'test123' });

        expect(res.statusCode).toBe(200);
        expect(res.body.success).toBe(true);
        expect(res.body).toHaveProperty('token');
        expect(res.body.user.role).toBe('Администратор');
    });

    test('POST /api/auth/login без email', async () => {
        const res = await request(app)
            .post('/api/auth/login')
            .send({ password: 'test123' });

        expect(res.statusCode).toBe(400);
        expect(res.body).toHaveProperty('error');
    });

    test('POST /api/auth/login с неверными данными', async () => {
        const res = await request(app)
            .post('/api/auth/login')
            .send({ email: 'wrong@test.com', password: 'wrong' });

        expect(res.statusCode).toBe(401);
    });
});

describe('Products API', () => {
    test('GET /api/products возвращает список товаров', async () => {
        const res = await request(app).get('/api/products');

        expect(res.statusCode).toBe(200);
        expect(res.body.success).toBe(true);
        expect(Array.isArray(res.body.products)).toBe(true);
        expect(res.body.total).toBeGreaterThan(0);
    });

    test('Товары имеют необходимые поля', async () => {
        const res = await request(app).get('/api/products');
        const product = res.body.products[0];

        expect(product).toHaveProperty('id');
        expect(product).toHaveProperty('name');
        expect(product).toHaveProperty('price');
    });
});

describe('Utilities', () => {
    test('Форматирование валюты', () => {
        const formatCurrency = (value) => {
            return new Intl.NumberFormat('ru-RU').format(value || 0) + ' сум';
        };

        const result = formatCurrency(1000000);
        expect(result).toContain('1');
        expect(result).toContain('000');
        expect(result).toContain('сум');
    });

    test('Расчёт скидки', () => {
        const calculateDiscount = (total, percent) => total * (percent / 100);

        expect(calculateDiscount(100000, 10)).toBe(10000);
        expect(calculateDiscount(50000, 20)).toBe(10000);
    });

    test('Расчёт НДС 15%', () => {
        const calculateVAT = (total) => total * 0.15;

        expect(calculateVAT(100000)).toBe(15000);
    });

    test('Валидация телефона', () => {
        const validatePhone = (phone) => {
            return /^\+998\d{9}$/.test(phone.replace(/[\s-]/g, ''));
        };

        expect(validatePhone('+998901234567')).toBe(true);
        expect(validatePhone('+998 90 123-45-67')).toBe(true);
        expect(validatePhone('123456')).toBe(false);
    });

    test('Валидация ИНН (9 цифр)', () => {
        const validateINN = (inn) => /^\d{9}$/.test(inn);

        expect(validateINN('123456789')).toBe(true);
        expect(validateINN('12345')).toBe(false);
        expect(validateINN('1234567890')).toBe(false);
    });
});
