import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'

// Простые утилитарные тесты
describe('Утилиты', () => {
    it('форматирование валюты', () => {
        const formatCurrency = (value) => {
            return new Intl.NumberFormat('ru-RU').format(value || 0) + ' сум'
        }

        expect(formatCurrency(1000)).toContain('1')
        expect(formatCurrency(1000)).toContain('000')
        expect(formatCurrency(1000)).toContain('сум')
        expect(formatCurrency(0)).toContain('0')
    })

    it('форматирование даты', () => {
        const formatDate = (dateStr) => {
            const date = new Date(dateStr)
            return date.toLocaleDateString('ru-RU')
        }

        expect(formatDate('2026-02-03')).toContain('03')
        expect(formatDate('2026-02-03')).toContain('02')
    })

    it('генерация ID', () => {
        const generateId = () => `id_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`
        const id1 = generateId()
        const id2 = generateId()

        expect(id1).toMatch(/^id_\d+_[a-z0-9]+$/)
        expect(id2).toMatch(/^id_\d+_[a-z0-9]+$/)
        expect(id1).not.toBe(id2)
    })
})

describe('LocalStorage', () => {
    it('сохранение и чтение настроек', () => {
        const settings = { theme: 'dark', language: 'ru' }
        localStorage.setItem('testSettings', JSON.stringify(settings))

        const saved = JSON.parse(localStorage.getItem('testSettings'))
        expect(saved.theme).toBe('dark')
        expect(saved.language).toBe('ru')
    })

    it('работа с пустым значением', () => {
        const result = localStorage.getItem('nonexistent')
        expect(result).toBeNull()
    })
})

describe('Вычисления продаж', () => {
    const calculateTotal = (items) => {
        return items.reduce((sum, item) => sum + (item.price * item.quantity), 0)
    }

    const calculateDiscount = (total, discountPercent) => {
        return total * (discountPercent / 100)
    }

    const calculateVAT = (total, vatPercent = 15) => {
        return total * (vatPercent / 100)
    }

    it('расчёт суммы корзины', () => {
        const items = [
            { name: 'Товар 1', price: 100000, quantity: 2 },
            { name: 'Товар 2', price: 50000, quantity: 1 }
        ]
        expect(calculateTotal(items)).toBe(250000)
    })

    it('расчёт скидки', () => {
        expect(calculateDiscount(100000, 10)).toBe(10000)
        expect(calculateDiscount(200000, 15)).toBe(30000)
    })

    it('расчёт НДС', () => {
        expect(calculateVAT(100000)).toBe(15000)
        expect(calculateVAT(100000, 12)).toBe(12000)
    })

    it('пустая корзина', () => {
        expect(calculateTotal([])).toBe(0)
    })
})

describe('Валидация', () => {
    const validatePhone = (phone) => {
        const pattern = /^\+998\s?\d{2}\s?\d{3}[-\s]?\d{2}[-\s]?\d{2}$/
        return pattern.test(phone)
    }

    const validateINN = (inn) => {
        return /^\d{9}$/.test(inn)
    }

    it('проверка телефона', () => {
        expect(validatePhone('+998 90 123-45-67')).toBe(true)
        expect(validatePhone('+998901234567')).toBe(true)
        expect(validatePhone('123456')).toBe(false)
    })

    it('проверка ИНН', () => {
        expect(validateINN('123456789')).toBe(true)
        expect(validateINN('12345')).toBe(false)
        expect(validateINN('1234567890')).toBe(false)
    })
})
