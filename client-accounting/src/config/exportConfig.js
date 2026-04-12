// Export Configuration for Multi-Tab Data Export
// Each tab has its own export settings with custom filename and columns

export const exportConfig = {
    products: {
        folder: 'products',
        filename: 'products_export',
        sheetName: 'Товары',
        columns: [
            { header: 'Код', key: 'code', width: 15 },
            { header: 'Наименование', key: 'name', width: 30 },
            { header: 'Категория', key: 'category_name', width: 20 },
            { header: 'Ед. изм.', key: 'unit', width: 10 },
            { header: 'Цена закупки', key: 'price_purchase', width: 15 },
            { header: 'Цена продажи', key: 'price_sale', width: 15 },
            { header: 'Цена розница', key: 'price_retail', width: 15 },
            { header: 'Остатки', key: 'quantity', width: 10 },
            { header: 'Штрихкод', key: 'barcode', width: 20 },
            { header: 'Статус', key: 'is_active', width: 10 }
        ]
    },

    sales: {
        folder: 'sales',
        filename: 'sales_export',
        sheetName: 'Продажи',
        columns: [
            { header: 'ID', key: 'id', width: 10 },
            { header: 'Дата', key: 'created_at', width: 20 },
            { header: 'Кассир', key: 'username', width: 20 },
            { header: 'Товаров', key: 'items_count', width: 10 },
            { header: 'Сумма', key: 'total_amount', width: 15 },
            { header: 'Скидка', key: 'discount_amount', width: 15 },
            { header: 'Итого', key: 'final_amount', width: 15 },
            { header: 'Способ оплаты', key: 'payment_method', width: 15 }
        ]
    },

    zreports: {
        folder: 'zreports',
        filename: 'zreports_export',
        sheetName: 'Z-отчёты',
        columns: [
            { header: 'Смена №', key: 'shift_number', width: 10 },
            { header: 'Дата', key: 'date', width: 20 },
            { header: 'Кассир', key: 'cashier', width: 20 },
            { header: 'Продаж', key: 'sales_count', width: 10 },
            { header: 'Выручка', key: 'total_sales', width: 15 },
            { header: 'Наличные', key: 'cash_sales', width: 15 },
            { header: 'Безнал', key: 'card_sales', width: 15 },
            { header: 'Открыт', key: 'opened_at', width: 20 },
            { header: 'Закрыт', key: 'closed_at', width: 20 }
        ]
    },

    shifts: {
        folder: 'shifts',
        filename: 'shifts_export',
        sheetName: 'Смены',
        columns: [
            { header: 'ID', key: 'id', width: 10 },
            { header: 'Кассир', key: 'username', width: 20 },
            { header: 'Открыта', key: 'opened_at', width: 20 },
            { header: 'Закрыта', key: 'closed_at', width: 20 },
            { header: 'Нач. сумма', key: 'opening_cash', width: 15 },
            { header: 'Кон. сумма', key: 'closing_cash', width: 15 },
            { header: 'Статус', key: 'status', width: 10 }
        ]
    },

    dashboard: {
        folder: 'dashboard',
        filename: 'dashboard_summary_export',
        sheetName: 'Сводка',
        columns: [
            { header: 'Метрика', key: 'metric', width: 30 },
            { header: 'Значение', key: 'value', width: 20 },
            { header: 'Период', key: 'period', width: 20 }
        ]
    }
};

// Helper function to format data for export
export const formatExportData = (data, configKey) => {
    const config = exportConfig[configKey];
    if (!config) return data;

    return data.map(row => {
        const formatted = {};
        config.columns.forEach(col => {
            formatted[col.header] = row[col.key] || '';
        });
        return formatted;
    });
};
