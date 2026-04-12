/**
 * useExport - хук для экспорта данных в различные форматы
 * Поддерживает: Excel, CSV, PDF, печать
 */

import { useCallback } from 'react';

export function useExport() {

    // Экспорт в CSV
    const exportToCSV = useCallback((data, filename = 'export') => {
        if (!data || !data.length) {
            console.warn('No data to export');
            return;
        }

        const headers = Object.keys(data[0]);
        const csvContent = [
            headers.join(';'),
            ...data.map(row =>
                headers.map(h => {
                    let cell = row[h] ?? '';
                    // Экранирование кавычек
                    if (typeof cell === 'string' && (cell.includes(';') || cell.includes('"'))) {
                        cell = `"${cell.replace(/"/g, '""')}"`;
                    }
                    return cell;
                }).join(';')
            )
        ].join('\n');

        // BOM для корректного отображения кириллицы в Excel
        const bom = '\uFEFF';
        const blob = new Blob([bom + csvContent], { type: 'text/csv;charset=utf-8;' });
        downloadBlob(blob, `${filename}.csv`);
    }, []);

    // Экспорт в JSON
    const exportToJSON = useCallback((data, filename = 'export') => {
        const jsonContent = JSON.stringify(data, null, 2);
        const blob = new Blob([jsonContent], { type: 'application/json' });
        downloadBlob(blob, `${filename}.json`);
    }, []);

    // Экспорт в Excel (через API)
    const exportToExcel = useCallback(async (endpoint, params = {}, filename = 'export') => {
        try {
            const queryString = new URLSearchParams(params).toString();
            const url = `${endpoint}?${queryString}&format=xlsx`;

            const response = await fetch(url, {
                headers: {
                    'Authorization': `Bearer ${localStorage.getItem('token')}`
                }
            });

            if (!response.ok) throw new Error('Export failed');

            const blob = await response.blob();
            downloadBlob(blob, `${filename}.xlsx`);
            return true;
        } catch (error) {
            console.error('Excel export error:', error);
            return false;
        }
    }, []);

    // Печать таблицы
    const printTable = useCallback((data, title = 'Отчёт', columns = null) => {
        if (!data || !data.length) return;

        const headers = columns || Object.keys(data[0]);

        const printWindow = window.open('', '_blank');
        printWindow.document.write(`
            <!DOCTYPE html>
            <html>
            <head>
                <title>${title}</title>
                <style>
                    body { font-family: Arial, sans-serif; padding: 20px; }
                    h1 { text-align: center; color: #333; }
                    table { width: 100%; border-collapse: collapse; margin-top: 20px; }
                    th, td { border: 1px solid #ddd; padding: 8px; text-align: left; }
                    th { background: #f5f5f5; font-weight: bold; }
                    tr:nth-child(even) { background: #fafafa; }
                    .footer { margin-top: 20px; text-align: center; color: #666; font-size: 12px; }
                    @media print {
                        body { padding: 0; }
                        .no-print { display: none; }
                    }
                </style>
            </head>
            <body>
                <h1>${title}</h1>
                <table>
                    <thead>
                        <tr>${headers.map(h => `<th>${h}</th>`).join('')}</tr>
                    </thead>
                    <tbody>
                        ${data.map(row => `
                            <tr>${headers.map(h => `<td>${row[h] ?? ''}</td>`).join('')}</tr>
                        `).join('')}
                    </tbody>
                </table>
                <div class="footer">
                    SmartPOS Pro | ${new Date().toLocaleString('ru-RU')}
                </div>
            </body>
            </html>
        `);
        printWindow.document.close();
        printWindow.print();
    }, []);

    // Форматирование данных для экспорта
    const formatForExport = useCallback((data, columnMap = {}) => {
        return data.map(row => {
            const formatted = {};
            for (const [key, value] of Object.entries(row)) {
                const label = columnMap[key] || key;
                formatted[label] = formatValue(value);
            }
            return formatted;
        });
    }, []);

    return {
        exportToCSV,
        exportToJSON,
        exportToExcel,
        printTable,
        formatForExport
    };
}

// Хелпер: скачивание Blob
function downloadBlob(blob, filename) {
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
}

// Хелпер: форматирование значений
function formatValue(value) {
    if (value === null || value === undefined) return '';
    if (value instanceof Date) return value.toLocaleDateString('ru-RU');
    if (typeof value === 'boolean') return value ? 'Да' : 'Нет';
    if (typeof value === 'number') {
        return new Intl.NumberFormat('ru-RU').format(value);
    }
    return String(value);
}

export default useExport;
