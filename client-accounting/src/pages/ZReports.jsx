import React, { useState, useEffect } from 'react';
import { FileText, Calendar, Printer, Download, DollarSign, TrendingUp, Package, Clock } from 'lucide-react';
import { formatCurrency } from '../utils/formatters';
import api from '../services/api';
import { useToast } from '../components/ToastProvider';
import { useI18n } from '../i18n';
// jsPDF, autoTable и timesNewRomanFont загружаются динамически в downloadPDF()

function ZReports() {
    const { t } = useI18n();
    const toast = useToast();
    const [reports, setReports] = useState([]);
    const [shifts, setShifts] = useState([]);
    const [loading, setLoading] = useState(true);
    const [selectedReport, setSelectedReport] = useState(null);
    const [generating, setGenerating] = useState(false);
    const [filter, setFilter] = useState({
        startDate: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
        endDate: new Date().toISOString().split('T')[0]
    });

    useEffect(() => {
        loadData();
    }, [filter]);

    const loadData = async () => {
        setLoading(true);
        try {
            // Загружаем закрытые смены за период
            const shiftsRes = await api.get('/shifts', {
                params: {
                    status: 'closed',
                    start_date: filter.startDate,
                    end_date: filter.endDate
                }
            });
            setShifts(shiftsRes.data.shifts || []);
        } catch (error) {
            console.error('Ошибка загрузки данных:', error);
        } finally {
            setLoading(false);
        }
    };

    const generateZReport = async (shift) => {
        setGenerating(true);
        try {
            console.log('Генерация Z-отчёта для смены:', shift);

            // Получить детальную статистику
            const statsRes = await api.get(`/shifts/${shift.id}/stats`);
            console.log('Статистика смены получена:', statsRes.data);

            if (!statsRes.data || !statsRes.data.stats) {
                throw new Error('Сервер не вернул статистику смены');
            }

            const stats = statsRes.data.stats;

            const reportData = {
                shift_id: shift.id,
                shift_number: shift.id,
                date: shift.closed_at || shift.opened_at,
                cashier: shift.username || 'N/A',
                opened_at: shift.opened_at,
                closed_at: shift.closed_at,
                opening_cash: shift.opening_cash || 0,
                closing_cash: shift.closing_cash || 0,
                sales_count: stats.salesCount || 0,
                total_sales: stats.totalSales || 0,
                cash_sales: stats.cashSales || 0,
                card_sales: stats.cardSales || 0,
                returns_count: stats.returnsCount || 0,
                returns_amount: stats.totalReturns || 0,
                cash_deposits: shift.cash_deposits || 0,
                cash_withdrawals: shift.cash_withdrawals || 0,
                top_products: stats.topProducts || []
            };

            console.log('Z-отчёт сформирован:', reportData);
            setSelectedReport(reportData);
        } catch (error) {
            console.error('Ошибка генерации отчёта:', error);
            console.error('Детали ошибки:', error.response?.data || error.message);

            let errorMessage = 'Ошибка генерации Z-отчёта';
            if (error.response?.status === 404) {
                errorMessage = 'Смена не найдена';
            } else if (error.response?.status === 401) {
                errorMessage = 'Требуется авторизация';
            } else if (error.response?.data?.error) {
                errorMessage = `Ошибка: ${error.response.data.error}`;
            } else if (error.message) {
                errorMessage = `Ошибка: ${error.message}`;
            }

            toast.info(errorMessage);
        } finally {
            setGenerating(false);
        }
    };

    const printReport = () => {
        window.print();
    };

    const downloadPDF = async (report) => {
        try {
            // Динамическая загрузка PDF-библиотек (снижает размер основного чанка)
            const [{ default: jsPDF }, { default: autoTable }, { timesNewRomanFont }] = await Promise.all([
                import('jspdf'),
                import('jspdf-autotable'),
                import('../fonts/timesNewRoman')
            ]);

            const doc = new jsPDF();

            // Register Times New Roman font for Cyrillic support
            doc.addFileToVFS('TimesNewRoman.ttf', timesNewRomanFont);
            doc.addFont('TimesNewRoman.ttf', 'TimesNewRoman', 'normal');
            doc.setFont('TimesNewRoman');

            // Helper function to safely format dates
            const formatDate = (dateValue) => {
                if (!dateValue) return '—';
                try {
                    const date = new Date(dateValue);
                    if (isNaN(date.getTime())) return '—';
                    return date.toLocaleString('ru-RU');
                } catch {
                    return '—';
                }
            };

            const formatDateShort = (dateValue) => {
                if (!dateValue) return '—';
                try {
                    const date = new Date(dateValue);
                    if (isNaN(date.getTime())) return '—';
                    return date.toLocaleDateString('ru-RU');
                } catch {
                    return '—';
                }
            };

            // Header - Full Cyrillic with Store Info
            doc.setFontSize(10);
            doc.text('SmartPOS Pro', 105, 12, { align: 'center' });

            doc.setFontSize(18);
            doc.text('Z-ОТЧЁТ', 105, 22, { align: 'center' });

            doc.setFontSize(12);
            doc.text(`Смена #${report.shift_number || 'N/A'}`, 105, 32, { align: 'center' });
            doc.text(`Дата: ${formatDate(report.date)}`, 105, 39, { align: 'center' });
            doc.text(`Кассир: ${report.cashier || 'N/A'}`, 105, 46, { align: 'center' });

            // Shift Information
            doc.setFontSize(10);
            let yPos = 58;
            doc.text('ИНФОРМАЦИЯ О СМЕНЕ', 14, yPos);
            yPos += 7;

            const shiftInfo = [
                ['Открытие смены', formatDate(report.opened_at)],
                ['Закрытие смены', formatDate(report.closed_at)],
                ['Начальная сумма', formatCurrency(report.opening_cash || 0)],
                ['Конечная сумма', formatCurrency(report.closing_cash || 0)]
            ];

            autoTable(doc, {
                startY: yPos,
                head: [],
                body: shiftInfo,
                theme: 'grid',
                styles: { fontSize: 10, font: 'TimesNewRoman' }
            });

            yPos = doc.lastAutoTable.finalY + 10;

            // Financial Summary
            doc.text('ФИНАНСОВЫЕ ПОКАЗАТЕЛИ', 14, yPos);
            yPos += 7;

            const financialData = [
                ['Количество продаж', (report.sales_count || 0).toString()],
                ['Общая выручка', formatCurrency(report.total_sales || 0)],
                ['Наличные', formatCurrency(report.cash_sales || 0)],
                ['Безналичные', formatCurrency(report.card_sales || 0)],
                ['Возвраты (кол-во)', (report.returns_count || 0).toString()],
                ['Возвраты (сумма)', formatCurrency(report.returns_amount || 0)],
                ['Внесения в кассу', formatCurrency(report.cash_deposits || 0)],
                ['Изъятия из кассы', formatCurrency(report.cash_withdrawals || 0)]
            ];

            autoTable(doc, {
                startY: yPos,
                head: [],
                body: financialData,
                theme: 'grid',
                styles: { fontSize: 10, font: 'TimesNewRoman' }
            });

            yPos = doc.lastAutoTable.finalY + 10;

            // Top Products
            if (report.top_products && report.top_products.length > 0) {
                doc.text('ТОП ТОВАРОВ', 14, yPos);
                yPos += 7;

                const productsData = report.top_products.map(p => [
                    p.name || 'N/A',
                    Math.round(p.count || 0).toString(),
                    formatCurrency(p.revenue || 0)
                ]);

                autoTable(doc, {
                    startY: yPos,
                    head: [['Товар', 'Кол-во', 'Выручка']],
                    body: productsData,
                    theme: 'striped',
                    styles: { fontSize: 9, font: 'TimesNewRoman' }
                });

                yPos = doc.lastAutoTable.finalY + 10;
            }

            // Final Cash Amount - keep TimesNewRoman font for Cyrillic
            doc.setFontSize(12);
            doc.setFont('TimesNewRoman', 'normal');

            const finalCash = (report.closing_cash || 0) + (report.cash_deposits || 0) - (report.cash_withdrawals || 0);
            doc.text('------------------------------------------', 105, yPos, { align: 'center' });
            yPos += 8;
            doc.text(`ИТОГО В КАССЕ: ${formatCurrency(finalCash)}`, 105, yPos, { align: 'center' });
            yPos += 10;
            doc.setFontSize(8);
            doc.text(`Отчёт сформирован: ${new Date().toLocaleString('ru-RU')}`, 105, yPos, { align: 'center' });

            // Save to exports/zreports folder
            const filename = `Z-Report_${report.shift_number || 'N_A'}_${formatDateShort(report.date).replace(/\./g, '-')}.pdf`;

            // Get PDF as base64
            const pdfBase64 = doc.output('datauristring').split(',')[1];

            // Save using Electron IPC
            if (window.electron && window.electron.saveFile) {
                const result = await window.electron.saveFile({
                    folder: 'zreports',
                    filename: filename,
                    data: pdfBase64,
                    encoding: 'base64'
                });

                if (result.success) {
                    const openFolder = confirm(`PDF сохранён:\n${result.path}\n\nОткрыть папку?`);
                    if (openFolder) {
                        // Get folder path (remove filename from full path)
                        const folderPath = result.path.substring(0, result.path.lastIndexOf('\\'));
                        window.electron.openFolder(folderPath);
                    }
                } else {
                    toast.error(`Ошибка сохранения: ${result.error}`);
                }
            } else {
                // Fallback for browser
                doc.save(filename);
            }
        } catch (error) {
            console.error('PDF creation error:', error);
            console.error('Error stack:', error.stack);
            console.error('Error message:', error.message);
            toast.error(`PDF creation error:\n\n${error.message}\n\nCheck console for details.`);
        }
    };

    return (
        <div className="z-reports-page fade-in">
            <div className="page-header">
                <div>
                    <h1>{t('zreports.otchyoty', 'Z-отчёты')}</h1>
                    <p className="text-muted">{t('zreports.otchyoty_zakrytiya_kassovyh_smen', 'Отчёты закрытия кассовых смен')}</p>
                </div>
                <button className="btn btn-secondary" onClick={() => loadData()}>
                    🔄 Обновить
                </button>
            </div>

            {/* Фильтры */}
            <div className="card" style={{ marginBottom: '20px' }}>
                <div className="form-row">
                    <div className="form-group">
                        <label>{t('zreports.data_s', 'Дата с')}</label>
                        <input
                            type="date"
                            value={filter.startDate}
                            onChange={e => setFilter({ ...filter, startDate: e.target.value })}
                        />
                    </div>
                    <div className="form-group">
                        <label>{t('zreports.data_po', 'Дата по')}</label>
                        <input
                            type="date"
                            value={filter.endDate}
                            onChange={e => setFilter({ ...filter, endDate: e.target.value })}
                        />
                    </div>
                    <div className="form-group" style={{ display: 'flex', alignItems: 'flex-end' }}>
                        <button className="btn btn-primary" onClick={loadData}>
                            Применить фильтр
                        </button>
                    </div>
                </div>
            </div>

            {/* Список смен */}
            <div className="card">
                {loading ? (
                    <div className="loading-container">
                        <div className="spinner"></div>
                    </div>
                ) : shifts.length === 0 ? (
                    <div className="empty-state">
                        <FileText size={64} className="text-muted" />
                        <h3>{t('zreports.zakrytye_smeny_ne_naydeny', 'Закрытые смены не найдены')}</h3>
                        <p className="text-muted">{t('zreports.za_vybrannyy_period_net_zakrytyh_smen', 'За выбранный период нет закрытых смен')}</p>
                    </div>
                ) : (
                    <table>
                        <thead>
                            <tr>
                                <th>{t('zreports.smena', 'Смена')}</th>
                                <th>{t('zreports.kassir', 'Кассир')}</th>
                                <th>{t('zreports.data_zakrytiya', 'Дата закрытия')}</th>
                                <th>{t('zreports.prodazh', 'Продаж')}</th>
                                <th>{t('zreports.vyruchka', 'Выручка')}</th>
                                <th>{t('zreports.deystviya', 'Действия')}</th>
                            </tr>
                        </thead>
                        <tbody>
                            {shifts.map((shift) => (
                                <tr key={shift.id}>
                                    <td><strong>#{shift.id}</strong></td>
                                    <td>{shift.username || '—'}</td>
                                    <td>{new Date(shift.closed_at).toLocaleString('ru-RU')}</td>
                                    <td>{shift.sales_count || 0}</td>
                                    <td><strong>{formatCurrency(shift.total_sales || 0)}</strong></td>
                                    <td>
                                        <button
                                            className="btn btn-primary btn-sm"
                                            onClick={() => generateZReport(shift)}
                                            disabled={generating}
                                        >
                                            <FileText size={16} />
                                            Сформировать Z-отчёт
                                        </button>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                )}
            </div>

            {/* Modal Z-отчёта */}
            {selectedReport && (
                <div className="modal-overlay" onClick={() => setSelectedReport(null)}>
                    <div className="modal-content z-report-modal" onClick={e => e.stopPropagation()} style={{ maxWidth: '900px' }}>
                        <div className="modal-header">
                            <h2>Z-отчёт #{selectedReport.shift_number}</h2>
                            <button onClick={() => setSelectedReport(null)} className="btn-close">×</button>
                        </div>

                        <div className="modal-body z-report-content">
                            {/* Шапка отчёта */}
                            <div style={{ textAlign: 'center', marginBottom: '30px', borderBottom: '2px solid #e5e7eb', paddingBottom: '20px' }}>
                                <h1 style={{ fontSize: '28px', margin: '0 0 10px 0' }}>{t('zreports.otchyot', 'Z-ОТЧЁТ')}</h1>
                                <p style={{ margin: '5px 0', fontSize: '14px', color: '#6b7280' }}>
                                    Смена #{selectedReport.shift_number} | {new Date(selectedReport.date).toLocaleDateString('ru-RU')}
                                </p>
                                <p style={{ margin: '5px 0', fontSize: '14px' }}>
                                    <strong>{t('zreports.kassir', 'Кассир:')}</strong> {selectedReport.cashier}
                                </p>
                            </div>

                            {/* Информация о смене */}
                            <div style={{ marginBottom: '25px' }}>
                                <h3 style={{ fontSize: '16px', marginBottom: '12px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                                    <Clock size={18} />
                                    Информация о смене
                                </h3>
                                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px', background: '#f9fafb', padding: '15px', borderRadius: '8px' }}>
                                    <div>
                                        <span style={{ color: '#6b7280', fontSize: '13px' }}>{t('zreports.otkrytie', 'Открытие:')}</span>
                                        <p style={{ margin: '3px 0 0 0', fontWeight: '500' }}>
                                            {new Date(selectedReport.opened_at).toLocaleString('ru-RU')}
                                        </p>
                                    </div>
                                    <div>
                                        <span style={{ color: '#6b7280', fontSize: '13px' }}>{t('zreports.zakrytie', 'Закрытие:')}</span>
                                        <p style={{ margin: '3px 0 0 0', fontWeight: '500' }}>
                                            {selectedReport.closed_at ? new Date(selectedReport.closed_at).toLocaleString('ru-RU') : '—'}
                                        </p>
                                    </div>
                                    <div>
                                        <span style={{ color: '#6b7280', fontSize: '13px' }}>{t('zreports.nachalnaya_summa', 'Начальная сумма:')}</span>
                                        <p style={{ margin: '3px 0 0 0', fontWeight: '600', color: '#10b981' }}>
                                            {formatCurrency(selectedReport.opening_cash)}
                                        </p>
                                    </div>
                                    <div>
                                        <span style={{ color: '#6b7280', fontSize: '13px' }}>{t('zreports.konechnaya_summa', 'Конечная сумма:')}</span>
                                        <p style={{ margin: '3px 0 0 0', fontWeight: '600', color: '#10b981' }}>
                                            {formatCurrency(selectedReport.closing_cash)}
                                        </p>
                                    </div>
                                </div>
                            </div>

                            {/* Финансовые показатели */}
                            <div style={{ marginBottom: '25px' }}>
                                <h3 style={{ fontSize: '16px', marginBottom: '12px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                                    <DollarSign size={18} />
                                    Финансовые показатели
                                </h3>

                                {/* Карточки показателей */}
                                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '15px', marginBottom: '15px' }}>
                                    <div style={{ background: '#ecfdf5', padding: '15px', borderRadius: '8px', border: '1px solid #10b981' }}>
                                        <div style={{ fontSize: '13px', color: '#047857', marginBottom: '5px' }}>{t('zreports.obschaya_vyruchka', 'Общая выручка')}</div>
                                        <div style={{ fontSize: '24px', fontWeight: 'bold', color: '#059669' }}>
                                            {formatCurrency(selectedReport.total_sales)}
                                        </div>
                                        <div style={{ fontSize: '12px', color: '#6b7280', marginTop: '5px' }}>
                                            Продаж: {selectedReport.sales_count}
                                        </div>
                                    </div>

                                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                                        <div style={{ background: '#f0fdf4', padding: '12px', borderRadius: '8px', border: '1px solid #bbf7d0' }}>
                                            <div style={{ fontSize: '12px', color: '#15803d' }}>{t('zreports.nalichnye', 'Наличные')}</div>
                                            <div style={{ fontSize: '16px', fontWeight: '600', color: '#16a34a' }}>
                                                {formatCurrency(selectedReport.cash_sales)}
                                            </div>
                                        </div>
                                        <div style={{ background: '#eff6ff', padding: '12px', borderRadius: '8px', border: '1px solid #bfdbfe' }}>
                                            <div style={{ fontSize: '12px', color: '#1e40af' }}>{t('zreports.karta', 'Карта')}</div>
                                            <div style={{ fontSize: '16px', fontWeight: '600', color: '#2563eb' }}>
                                                {formatCurrency(selectedReport.card_sales)}
                                            </div>
                                        </div>
                                    </div>
                                </div>

                                {/* Таблица деталей */}
                                <table style={{ width: '100%', fontSize: '14px' }}>
                                    <tbody>
                                        <tr style={{ borderTop: '1px solid #e5e7eb' }}>
                                            <td style={{ padding: '10px 0', color: '#6b7280' }}>{t('zreports.vozvraty_kolichestvo', 'Возвраты (количество)')}</td>
                                            <td style={{ padding: '10px 0', textAlign: 'right', fontWeight: '500' }}>
                                                {selectedReport.returns_count}
                                            </td>
                                        </tr>
                                        <tr style={{ borderTop: '1px solid #e5e7eb' }}>
                                            <td style={{ padding: '10px 0', color: '#6b7280' }}>{t('zreports.vozvraty_summa', 'Возвраты (сумма)')}</td>
                                            <td style={{ padding: '10px 0', textAlign: 'right', fontWeight: '500', color: '#ef4444' }}>
                                                -{formatCurrency(selectedReport.returns_amount)}
                                            </td>
                                        </tr>
                                        <tr style={{ borderTop: '1px solid #e5e7eb' }}>
                                            <td style={{ padding: '10px 0', color: '#6b7280' }}>{t('zreports.vneseniya_v_kassu', 'Внесения в кассу')}</td>
                                            <td style={{ padding: '10px 0', textAlign: 'right', fontWeight: '500', color: '#10b981' }}>
                                                +{formatCurrency(selectedReport.cash_deposits)}
                                            </td>
                                        </tr>
                                        <tr style={{ borderTop: '1px solid #e5e7eb' }}>
                                            <td style={{ padding: '10px 0', color: '#6b7280' }}>{t('zreports.izyatiya_iz_kassy', 'Изъятия из кассы')}</td>
                                            <td style={{ padding: '10px 0', textAlign: 'right', fontWeight: '500', color: '#ef4444' }}>
                                                -{formatCurrency(selectedReport.cash_withdrawals)}
                                            </td>
                                        </tr>
                                    </tbody>
                                </table>
                            </div>

                            {/* Топ товаров */}
                            {selectedReport.top_products && selectedReport.top_products.length > 0 && (
                                <div style={{ marginBottom: '25px' }}>
                                    <h3 style={{ fontSize: '16px', marginBottom: '12px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                                        <TrendingUp size={18} />
                                        Топ товаров смены
                                    </h3>
                                    <table style={{ width: '100%', fontSize: '13px' }}>
                                        <thead>
                                            <tr style={{ background: '#f9fafb', borderBottom: '2px solid #e5e7eb' }}>
                                                <th style={{ padding: '10px', textAlign: 'left' }}>{t('zreports.tovar', 'Товар')}</th>
                                                <th style={{ padding: '10px', textAlign: 'center' }}>{t('zreports.kol_vo', 'Кол-во')}</th>
                                                <th style={{ padding: '10px', textAlign: 'right' }}>{t('zreports.vyruchka', 'Выручка')}</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {selectedReport.top_products.map((product, idx) => (
                                                <tr key={idx} style={{ borderBottom: '1px solid #f3f4f6' }}>
                                                    <td style={{ padding: '10px' }}>{product.name}</td>
                                                    <td style={{ padding: '10px', textAlign: 'center', fontWeight: '500' }}>
                                                        {Math.round(product.count)}
                                                    </td>
                                                    <td style={{ padding: '10px', textAlign: 'right', fontWeight: '600' }}>
                                                        {formatCurrency(product.revenue || 0)}
                                                    </td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            )}

                            {/* Итоговая сумма */}
                            <div style={{
                                background: 'linear-gradient(135deg, #10b981, #059669)',
                                color: 'white',
                                padding: '20px',
                                borderRadius: '12px',
                                textAlign: 'center'
                            }}>
                                <div style={{ fontSize: '14px', marginBottom: '8px', opacity: 0.9 }}>{t('zreports.itogo_v_kasse', 'ИТОГО В КАССЕ')}</div>
                                <div style={{ fontSize: '32px', fontWeight: 'bold' }}>
                                    {formatCurrency(
                                        selectedReport.closing_cash +
                                        selectedReport.cash_deposits -
                                        selectedReport.cash_withdrawals
                                    )}
                                </div>
                            </div>

                            <div style={{ marginTop: '20px', padding: '15px', background: '#f9fafb', borderRadius: '8px', fontSize: '12px', color: '#6b7280', textAlign: 'center' }}>
                                Дата формирования отчёта: {new Date().toLocaleString('ru-RU')}
                            </div>
                        </div>

                        <div className="modal-footer" style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end' }}>
                            <button onClick={() => setSelectedReport(null)} className="btn btn-secondary">
                                Закрыть
                            </button>
                            <button onClick={printReport} className="btn btn-primary">
                                <Printer size={16} />
                                Печать
                            </button>
                            <button onClick={() => downloadPDF(selectedReport)} className="btn btn-success">
                                <Download size={16} />
                                Скачать PDF
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}

export default ZReports;
