import { describe, it, expect, vi } from 'vitest'

describe('Финансы (Finance)', () => {
    describe('Кассовые операции', () => {
        const createCashOperation = (type, amount, description) => ({
            id: Date.now(),
            type, // 'income' | 'expense'
            amount,
            description,
            date: new Date().toISOString(),
            created_at: new Date().toISOString()
        })

        it('создание приходной операции', () => {
            const op = createCashOperation('income', 500000, 'Продажа товаров')
            expect(op.type).toBe('income')
            expect(op.amount).toBe(500000)
            expect(op.description).toBe('Продажа товаров')
            expect(op.id).toBeDefined()
        })

        it('создание расходной операции', () => {
            const op = createCashOperation('expense', 200000, 'Оплата поставщику')
            expect(op.type).toBe('expense')
            expect(op.amount).toBe(200000)
        })
    })

    describe('Баланс счетов', () => {
        const calculateBalance = (transactions) => {
            return transactions.reduce((balance, tx) => {
                if (tx.type === 'income' || tx.type === 'sale') {
                    return balance + tx.amount
                } else if (tx.type === 'expense' || tx.type === 'purchase' || tx.type === 'return') {
                    return balance - tx.amount
                }
                return balance
            }, 0)
        }

        it('расчёт баланса с разными типами', () => {
            const transactions = [
                { type: 'income', amount: 1000000 },
                { type: 'expense', amount: 300000 },
                { type: 'sale', amount: 500000 },
                { type: 'purchase', amount: 200000 }
            ]
            expect(calculateBalance(transactions)).toBe(1000000)
        })

        it('пустой список транзакций', () => {
            expect(calculateBalance([])).toBe(0)
        })

        it('только расходы', () => {
            const transactions = [
                { type: 'expense', amount: 100000 },
                { type: 'expense', amount: 200000 }
            ]
            expect(calculateBalance(transactions)).toBe(-300000)
        })

        it('учёт возвратов', () => {
            const transactions = [
                { type: 'sale', amount: 500000 },
                { type: 'return', amount: 50000 }
            ]
            expect(calculateBalance(transactions)).toBe(450000)
        })
    })

    describe('Z-отчёт', () => {
        const generateZReport = (shifts) => {
            const totalSales = shifts.reduce((sum, s) => sum + (s.total_sales || 0), 0)
            const totalReturns = shifts.reduce((sum, s) => sum + (s.total_returns || 0), 0)
            const totalCash = shifts.reduce((sum, s) => sum + (s.cash_amount || 0), 0)
            const totalCard = shifts.reduce((sum, s) => sum + (s.card_amount || 0), 0)
            const receiptsCount = shifts.reduce((sum, s) => sum + (s.receipts_count || 0), 0)

            return {
                totalSales,
                totalReturns,
                netSales: totalSales - totalReturns,
                totalCash,
                totalCard,
                receiptsCount,
                averageReceipt: receiptsCount > 0 ? Math.round(totalSales / receiptsCount) : 0
            }
        }

        it('Z-отчёт за одну смену', () => {
            const shifts = [{
                total_sales: 2500000,
                total_returns: 100000,
                cash_amount: 1500000,
                card_amount: 900000,
                receipts_count: 45
            }]

            const report = generateZReport(shifts)
            expect(report.totalSales).toBe(2500000)
            expect(report.totalReturns).toBe(100000)
            expect(report.netSales).toBe(2400000)
            expect(report.totalCash).toBe(1500000)
            expect(report.totalCard).toBe(900000)
            expect(report.receiptsCount).toBe(45)
            expect(report.averageReceipt).toBe(55556)
        })

        it('Z-отчёт за несколько смен', () => {
            const shifts = [
                { total_sales: 1000000, total_returns: 50000, cash_amount: 600000, card_amount: 350000, receipts_count: 20 },
                { total_sales: 1500000, total_returns: 80000, cash_amount: 900000, card_amount: 520000, receipts_count: 30 }
            ]

            const report = generateZReport(shifts)
            expect(report.totalSales).toBe(2500000)
            expect(report.netSales).toBe(2370000)
            expect(report.receiptsCount).toBe(50)
        })

        it('пустой Z-отчёт', () => {
            const report = generateZReport([])
            expect(report.totalSales).toBe(0)
            expect(report.averageReceipt).toBe(0)
        })
    })

    describe('НДС', () => {
        const calculateVAT = (amount, rate = 12) => {
            const vatAmount = Math.round(amount * rate / (100 + rate))
            return {
                net: amount - vatAmount,
                vat: vatAmount,
                gross: amount,
                rate
            }
        }

        it('НДС 12% (Узбекистан)', () => {
            const result = calculateVAT(112000, 12)
            expect(result.vat).toBe(12000)
            expect(result.net).toBe(100000)
            expect(result.gross).toBe(112000)
        })

        it('НДС 15%', () => {
            const result = calculateVAT(115000, 15)
            expect(result.vat).toBe(15000)
            expect(result.net).toBe(100000)
        })

        it('нулевая сумма', () => {
            const result = calculateVAT(0)
            expect(result.vat).toBe(0)
            expect(result.net).toBe(0)
        })
    })

    describe('Прибыль и убытки', () => {
        const calculateProfitLoss = (sales, costs) => {
            const revenue = sales.reduce((s, sale) => s + sale.amount, 0)
            const costTotal = costs.reduce((s, cost) => s + cost.amount, 0)
            const profit = revenue - costTotal
            const margin = revenue > 0 ? (profit / revenue * 100).toFixed(1) : 0

            return { revenue, costTotal, profit, margin: parseFloat(margin) }
        }

        it('прибыльный период', () => {
            const sales = [{ amount: 1000000 }, { amount: 500000 }]
            const costs = [{ amount: 600000 }, { amount: 200000 }]

            const result = calculateProfitLoss(sales, costs)
            expect(result.revenue).toBe(1500000)
            expect(result.costTotal).toBe(800000)
            expect(result.profit).toBe(700000)
            expect(result.margin).toBe(46.7)
        })

        it('убыточный период', () => {
            const sales = [{ amount: 300000 }]
            const costs = [{ amount: 500000 }]

            const result = calculateProfitLoss(sales, costs)
            expect(result.profit).toBe(-200000)
            expect(result.margin).toBe(-66.7)
        })

        it('нулевая выручка', () => {
            const result = calculateProfitLoss([], [{ amount: 100000 }])
            expect(result.revenue).toBe(0)
            expect(result.profit).toBe(-100000)
            expect(result.margin).toBe(0)
        })
    })

    describe('Дебиторская задолженность', () => {
        const getOverdueDebts = (debts, now = new Date()) => {
            return debts.filter(d => {
                const due = new Date(d.due_date)
                return due < now && d.status !== 'paid'
            })
        }

        it('просроченные долги', () => {
            const debts = [
                { id: 1, amount: 100000, due_date: '2025-01-01', status: 'pending' },
                { id: 2, amount: 200000, due_date: '2030-01-01', status: 'pending' },
                { id: 3, amount: 50000, due_date: '2025-06-01', status: 'paid' }
            ]

            const overdue = getOverdueDebts(debts)
            expect(overdue).toHaveLength(1)
            expect(overdue[0].id).toBe(1)
        })

        it('нет просроченных', () => {
            const debts = [
                { id: 1, amount: 100000, due_date: '2030-01-01', status: 'pending' }
            ]
            expect(getOverdueDebts(debts)).toHaveLength(0)
        })
    })
})
