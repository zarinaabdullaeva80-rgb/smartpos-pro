import { describe, it, expect, beforeAll, afterAll } from '@jest/globals';
import request from 'supertest';
import pool from '../src/config/database.js';
import app from '../src/index.js'; // Нужно будет экспортировать app

describe('API Tests', () => {
    let authToken;
    let testUserId;

    beforeAll(async () => {
        // Создать тестового пользователя
        const result = await pool.query(`
            INSERT INTO users (username, password, full_name, email, is_active)
            VALUES ('testuser', '$2b$10$test', 'Test User', 'test@test.com', true)
            RETURNING id
        `);
        testUserId = result.rows[0].id;

        // Получить токен
        const loginRes = await request(app)
            .post('/api/auth/login')
            .send({
                username: 'testuser',
                password: 'test123'
            });

        authToken = loginRes.body.token;
    });

    afterAll(async () => {
        // Очистить тестовые данные
        await pool.query('DELETE FROM users WHERE id = $1', [testUserId]);
        await pool.end();
    });

    describe('Health Check', () => {
        it('should return health status', async () => {
            const res = await request(app).get('/api/health');
            expect(res.statusCode).toBe(200);
            expect(res.body.message).toBe('OK');
            expect(res.body.database).toBe('connected');
        });
    });

    describe('Authentication', () => {
        it('should reject invalid credentials', async () => {
            const res = await request(app)
                .post('/api/auth/login')
                .send({
                    username: 'invalid',
                    password: 'wrong'
                });

            expect(res.statusCode).toBe(401);
        });

        it('should accept valid credentials', async () => {
            const res = await request(app)
                .post('/api/auth/login')
                .send({
                    username: 'testuser',
                    password: 'test123'
                });

            expect(res.statusCode).toBe(200);
            expect(res.body).toHaveProperty('token');
        });
    });

    describe('Products API', () => {
        it('should require authentication', async () => {
            const res = await request(app).get('/api/products');
            expect(res.statusCode).toBe(401);
        });

        it('should get products list', async () => {
            const res = await request(app)
                .get('/api/products')
                .set('Authorization', `Bearer ${authToken}`);

            expect(res.statusCode).toBe(200);
            expect(Array.isArray(res.body)).toBe(true);
        });

        it('should validate product creation', async () => {
            const res = await request(app)
                .post('/api/products')
                .set('Authorization', `Bearer ${authToken}`)
                .send({
                    name: '', // Invalid: empty name
                    price: -10 // Invalid: negative price
                });

            expect(res.statusCode).toBe(400);
            expect(res.body.error).toBe('Validation failed');
        });
    });

    describe('Rate Limiting', () => {
        it('should enforce rate limits', async () => {
            const requests = [];

            // Отправить 110 запросов (лимит 100)
            for (let i = 0; i < 110; i++) {
                requests.push(
                    request(app).get('/api/health')
                );
            }

            const responses = await Promise.all(requests);
            const tooManyRequests = responses.filter(r => r.statusCode === 429);

            expect(tooManyRequests.length).toBeGreaterThan(0);
        });
    });

    describe('Validation', () => {
        it('should validate email format', async () => {
            const res = await request(app)
                .post('/api/counterparties')
                .set('Authorization', `Bearer ${authToken}`)
                .send({
                    name: 'Test Customer',
                    type: 'customer',
                    email: 'invalid-email' // Invalid
                });

            expect(res.statusCode).toBe(400);
            expect(res.body.details[0].field).toBe('email');
        });

        it('should validate phone format', async () => {
            const res = await request(app)
                .post('/api/counterparties')
                .set('Authorization', `Bearer ${authToken}`)
                .send({
                    name: 'Test Customer',
                    type: 'customer',
                    phone: '123' // Invalid
                });

            expect(res.statusCode).toBe(400);
        });
    });
});
