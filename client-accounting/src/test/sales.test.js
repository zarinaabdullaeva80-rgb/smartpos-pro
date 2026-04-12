import { describe, it, expect, vi, beforeEach } from 'vitest'

describe('Продажи (Sales)', () => {
    describe('Расчёт итогов', () => {
        const calculateCartTotal = (items) => {
            return items.reduce((sum, item) => {
                const itemTotal = item.price * item.quantity
                const discount = item.discount_percent
                    ? itemTotal * (item.discount_percent / 100)
                    : (item.discount_amount || 0)
                return sum + itemTotal - discount
            }, 0)
        }

        it('простая корзина без скидок', () => {
            const items = [
                { name: 'Молоко', price: 15000, quantity: 2 },
                { name: 'Хлеб', price: 8000, quantity: 1 }
            ]
            expect(calculateCartTotal(items)).toBe(38000)
        })

        it('корзина со скидкой в процентах', () => {
            const items = [
                { name: 'Товар', price: 100000, quantity: 1, discount_percent: 10 }
            ]
            expect(calculateCartTotal(items)).toBe(90000)
        })

        it('корзина со скидкой в сумме', () => {
            const items = [
                { name: 'Товар', price: 100000, quantity: 1, discount_amount: 5000 }
            ]
            expect(calculateCartTotal(items)).toBe(95000)
        })

        it('пустая корзина', () => {
            expect(calculateCartTotal([])).toBe(0)
        })

        it('большое количество товаров', () => {
            const items = [
                { name: 'A', price: 10000, quantity: 100 },
                { name: 'B', price: 25000, quantity: 50 },
                { name: 'C', price: 5000, quantity: 200 }
            ]
            expect(calculateCartTotal(items)).toBe(3250000)
        })
    })

    describe('Методы оплаты', () => {
        const validatePayment = (total, payments) => {
            const paid = payments.reduce((sum, p) => sum + p.amount, 0)
            return {
                isValid: paid >= total,
                change: Math.max(0, paid - total),
                remaining: Math.max(0, total - paid)
            }
        }

        it('точная сумма наличными', () => {
            const result = validatePayment(100000, [
                { method: 'cash', amount: 100000 }
            ])
            expect(result.isValid).toBe(true)
            expect(result.change).toBe(0)
        })

        it('сдача с наличных', () => {
            const result = validatePayment(85000, [
                { method: 'cash', amount: 100000 }
            ])
            expect(result.isValid).toBe(true)
            expect(result.change).toBe(15000)
        })

        it('сплит-оплата', () => {
            const result = validatePayment(100000, [
                { method: 'cash', amount: 50000 },
                { method: 'card', amount: 50000 }
            ])
            expect(result.isValid).toBe(true)
            expect(result.change).toBe(0)
        })

        it('недостаточно средств', () => {
            const result = validatePayment(100000, [
                { method: 'cash', amount: 80000 }
            ])
            expect(result.isValid).toBe(false)
            expect(result.remaining).toBe(20000)
        })

        it('тройная сплит-оплата', () => {
            const result = validatePayment(150000, [
                { method: 'cash', amount: 50000 },
                { method: 'card', amount: 50000 },
                { method: 'transfer', amount: 50000 }
            ])
            expect(result.isValid).toBe(true)
            expect(result.change).toBe(0)
        })
    })

    describe('Возвраты', () => {
        const processReturn = (sale, returnItems) => {
            const returnTotal = returnItems.reduce((sum, item) => {
                const origItem = sale.items.find(i => i.id === item.id)
                if (!origItem) return sum
                if (item.quantity > origItem.quantity) return sum
                return sum + (origItem.price * item.quantity)
            }, 0)

            return {
                returnTotal,
                isValid: returnTotal > 0 && returnTotal <= sale.total,
                isPartial: returnTotal < sale.total
            }
        }

        it('полный возврат', () => {
            const sale = {
                total: 100000,
                items: [{ id: 1, price: 100000, quantity: 1 }]
            }
            const result = processReturn(sale, [{ id: 1, quantity: 1 }])
            expect(result.returnTotal).toBe(100000)
            expect(result.isValid).toBe(true)
            expect(result.isPartial).toBe(false)
        })

        it('частичный возврат', () => {
            const sale = {
                total: 200000,
                items: [
                    { id: 1, price: 100000, quantity: 2 }
                ]
            }
            const result = processReturn(sale, [{ id: 1, quantity: 1 }])
            expect(result.returnTotal).toBe(100000)
            expect(result.isValid).toBe(true)
            expect(result.isPartial).toBe(true)
        })

        it('возврат несуществующего товара', () => {
            const sale = {
                total: 100000,
                items: [{ id: 1, price: 100000, quantity: 1 }]
            }
            const result = processReturn(sale, [{ id: 999, quantity: 1 }])
            expect(result.returnTotal).toBe(0)
            expect(result.isValid).toBe(false)
        })

        it('превышение количества', () => {
            const sale = {
                total: 100000,
                items: [{ id: 1, price: 100000, quantity: 1 }]
            }
            const result = processReturn(sale, [{ id: 1, quantity: 5 }])
            expect(result.returnTotal).toBe(0)
            expect(result.isValid).toBe(false)
        })
    })

    describe('Чеки и нумерация', () => {
        it('генерация номера чека', () => {
            const generateReceiptNumber = () => {
                const date = new Date()
                const prefix = date.toISOString().slice(0, 10).replace(/-/g, '')
                const seq = String(Math.floor(Math.random() * 9999) + 1).padStart(4, '0')
                return `${prefix}-${seq}`
            }

            const num = generateReceiptNumber()
            expect(num).toMatch(/^\d{8}-\d{4}$/)
        })

        it('штрихкод EAN-13 валидация', () => {
            const isValidEAN13 = (code) => {
                if (!/^\d{13}$/.test(code)) return false
                const digits = code.split('').map(Number)
                const checksum = digits.slice(0, 12).reduce((sum, d, i) => {
                    return sum + d * (i % 2 === 0 ? 1 : 3)
                }, 0)
                return (10 - (checksum % 10)) % 10 === digits[12]
            }

            expect(isValidEAN13('4607014780018')).toBe(true)
            expect(isValidEAN13('1234567890123')).toBe(false)
            expect(isValidEAN13('123')).toBe(false)
        })
    })
})
