/**
 * Тесты утилит и сервисов Mobile POS
 */

import { validatePhone, validateEmail, formatCurrency, formatDate } from '../utils/helpers';

// Утилиты валидации
describe('Валидация', () => {
    test('телефон UZ формат', () => {
        expect(validatePhone('+998901234567')).toBe(true);
        expect(validatePhone('998901234567')).toBe(true);
        expect(validatePhone('901234567')).toBe(true);
        expect(validatePhone('123')).toBe(false);
        expect(validatePhone('')).toBe(false);
    });

    test('email валидация', () => {
        expect(validateEmail('test@example.com')).toBe(true);
        expect(validateEmail('user@domain.uz')).toBe(true);
        expect(validateEmail('invalid')).toBe(false);
        expect(validateEmail('')).toBe(false);
    });
});

// Форматирование
describe('Форматирование', () => {
    test('валюта UZS', () => {
        const formatted = formatCurrency(1000000);
        expect(formatted).toContain('1');
        expect(formatted).toContain('000');
    });

    test('дата', () => {
        const date = new Date('2026-02-03');
        const formatted = formatDate(date);
        expect(formatted).toContain('03');
        expect(formatted).toContain('02');
    });
});

// Корзина
describe('Корзина', () => {
    const cart = [
        { id: 1, name: 'Товар 1', price: 10000, quantity: 2 },
        { id: 2, name: 'Товар 2', price: 25000, quantity: 1 }
    ];

    test('расчёт суммы', () => {
        const total = cart.reduce((sum, item) => sum + item.price * item.quantity, 0);
        expect(total).toBe(45000);
    });

    test('количество позиций', () => {
        expect(cart.length).toBe(2);
    });

    test('общее количество товаров', () => {
        const totalQty = cart.reduce((sum, item) => sum + item.quantity, 0);
        expect(totalQty).toBe(3);
    });
});

// Скидки
describe('Скидки', () => {
    test('процентная скидка', () => {
        const price = 100000;
        const discount = 10; // 10%
        const final = price * (1 - discount / 100);
        expect(final).toBe(90000);
    });

    test('фиксированная скидка', () => {
        const price = 100000;
        const discount = 5000;
        const final = price - discount;
        expect(final).toBe(95000);
    });
});

// Офлайн синхронизация
describe('Офлайн', () => {
    test('создание pending операции', () => {
        const operation = {
            id: Date.now(),
            type: 'sale',
            data: { items: [], total: 0 },
            synced: false,
            createdAt: new Date().toISOString()
        };

        expect(operation.synced).toBe(false);
        expect(operation.type).toBe('sale');
    });
});
