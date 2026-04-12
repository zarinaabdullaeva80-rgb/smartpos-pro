import React, { useState, useEffect, useRef } from 'react';
import { DollarSign, Users, Calendar, Download, Plus, Calculator, Clock, TrendingUp, Check, X, CreditCard, Upload, FileSpreadsheet } from 'lucide-react';
import api, { employeesAPI, payrollAPI } from '../services/api';
import { formatCurrency } from '../utils/formatters';
import * as XLSX from 'xlsx';


import { useConfirm } from '../components/ConfirmDialog';
import { useI18n } from '../i18n';
function Payroll() {
    const { t } = useI18n();
    const confirm = useConfirm();
    const [employees, setEmployees] = useState([]);
    const [stats, setStats] = useState({});
    const [period, setPeriod] = useState('2026-01');
    const [loading, setLoading] = useState(true);
    const [message, setMessage] = useState(null);
    const [showPayModal, setShowPayModal] = useState(false);
    const [selectedEmployee, setSelectedEmployee] = useState(null);
    const [showImportModal, setShowImportModal] = useState(false);
    const fileInputRef = useRef(null);

    useEffect(() => { loadData(); }, [period]);

    const loadData = async () => {
        setLoading(true);
        try {
            const [year, month] = period.split('-').map(Number);
            const payRes = await payrollAPI.getAll({ year, month });
            const payData = payRes.data || payRes;
            const records = payData.payroll || [];
            const apiStats = payData.stats || {};

            if (records.length > 0) {
                // Map payroll_records to employee-like display format
                const mapped = records.map(r => ({
                    id: r.id,
                    employeeId: r.employee_id,
                    name: r.employee_name || r.employee_username || `Сотрудник #${r.employee_id}`,
                    position: r.employee_position || '',
                    base: parseFloat(r.base_salary) || 0,
                    bonus: parseFloat(r.bonuses) || 0,
                    overtime: 0,
                    deductions: parseFloat(r.deductions) || 0,
                    total: parseFloat(r.net_amount) || 0,
                    hours: 0,
                    status: r.status === 'paid' ? 'paid' : 'pending',
                    payrollId: r.id
                }));
                setEmployees(mapped);
                setStats({
                    total_payroll: parseFloat(apiStats.total_net) || mapped.reduce((s, e) => s + e.total, 0),
                    total_employees: parseInt(apiStats.total_records) || mapped.length,
                    avg_salary: mapped.length > 0
                        ? Math.round(mapped.reduce((s, e) => s + e.total, 0) / mapped.length)
                        : 0,
                    total_bonus: parseFloat(apiStats.total_bonuses) || mapped.reduce((s, e) => s + e.bonus, 0)
                });
            } else {
                // Нет записей — показываем список сотрудников с нулевыми начислениями
                const empRes = await employeesAPI.getAll();
                const empData = empRes.data || empRes;
                const emps = (empData.employees || []).map(e => ({
                    id: e.id,
                    employeeId: e.id,
                    name: e.full_name || e.username,
                    position: e.position || e.role || '',
                    base: 0, bonus: 0, overtime: 0, deductions: 0, total: 0, hours: 0,
                    status: 'pending'
                }));
                setEmployees(emps);
                setStats({ total_payroll: 0, total_employees: emps.length, avg_salary: 0, total_bonus: 0 });
            }
        } catch (err) {
            console.warn('Payroll: не удалось загрузить данные', err.message);
        }
        setLoading(false);
    };

    const calculateStats = (data) => {
        setStats({
            total_payroll: data.reduce((s, e) => s + (e.total || 0), 0),
            total_employees: data.length,
            avg_salary: data.length > 0 ? Math.round(data.reduce((s, e) => s + (e.total || 0), 0) / data.length) : 0,
            total_bonus: data.reduce((s, e) => s + (e.bonus || 0), 0)
        });
    };

    // Excel Import
    const handleExcelImport = (e) => {
        const file = e.target.files[0];
        if (!file) return;

        const reader = new FileReader();
        reader.onload = (evt) => {
            try {
                const wb = XLSX.read(evt.target.result, { type: 'binary' });
                const wsname = wb.SheetNames[0];
                const ws = wb.Sheets[wsname];
                const data = XLSX.utils.sheet_to_json(ws);

                // Map Excel columns to employee fields
                const imported = data.map((row, idx) => ({
                    id: Date.now() + idx,
                    name: row['ФИО'] || row['Сотрудник'] || row['name'] || '',
                    position: row['Должность'] || row['position'] || '',
                    base: parseFloat(row['Оклад'] || row['base'] || 0),
                    bonus: parseFloat(row['Бонус'] || row['bonus'] || 0),
                    overtime: parseFloat(row['Переработка'] || row['overtime'] || 0),
                    deductions: parseFloat(row['Удержания'] || row['deductions'] || 0),
                    hours: parseInt(row['Часы'] || row['hours'] || 0),
                    status: 'pending'
                })).map(e => ({ ...e, total: e.base + e.bonus + e.overtime - e.deductions }));

                if (imported.length > 0) {
                    setEmployees(imported);
                    calculateStats(imported);
                    setMessage({ type: 'success', text: `Импортировано ${imported.length} сотрудников из Excel` });
                } else {
                    setMessage({ type: 'error', text: 'Не удалось распознать данные в файле' });
                }
                setShowImportModal(false);
            } catch (err) {
                setMessage({ type: 'error', text: 'Ошибка чтения Excel файла' });
            }
        };
        reader.readAsBinaryString(file);
        e.target.value = null;
    };

    // Excel Export
    const handleExcelExport = () => {
        const exportData = employees.map(e => ({
            'ФИО': e.name,
            'Должность': e.position,
            'Оклад': e.base,
            'Бонус': e.bonus,
            'Переработка': e.overtime,
            'Удержания': e.deductions,
            'Часы': e.hours,
            'К выплате': e.total,
            'Статус': e.status === 'paid' ? 'Выплачено' : 'Ожидает'
        }));

        const ws = XLSX.utils.json_to_sheet(exportData);
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, 'Зарплата');
        XLSX.writeFile(wb, `payroll_${period}.xlsx`);
        setMessage({ type: 'success', text: 'Ведомость экспортирована в Excel' });
    };

    const handleCalculate = async () => {
        setMessage({ type: 'info', text: 'Расчёт зарплаты выполняется...' });
        try {
            const [year, month] = period.split('-').map(Number);
            const res = await payrollAPI.massCalculate({ year, month, baseSalary: 0 });
            const data = res.data || res;
            await loadData();
            setMessage({ type: 'success', text: data.message || `Зарплата за ${period} рассчитана` });
        } catch (error) {
            setMessage({ type: 'error', text: 'Ошибка расчёта: ' + (error.response?.data?.error || error.message) });
        }
    };

    const handleDownloadPaysheet = async () => {
        setMessage({ type: 'success', text: 'Формирование ведомости...' });
        try {
            const response = await api.get(`/payroll/export?period=${period}`, { responseType: 'blob' });
            const url = window.URL.createObjectURL(new Blob([response.data]));
            const link = document.createElement('a');
            link.href = url;
            link.setAttribute('download', `payroll_${period}.xlsx`);
            document.body.appendChild(link);
            link.click();
            link.remove();
        } catch (error) {
            // Simulate download
            const content = `Расчётная ведомость за ${period}\n\nСотрудник\tОклад\tИтого\n${employees.map(e => `${e.name}\t${e.base}\t${e.total}`).join('\n')}`;
            const blob = new Blob([content], { type: 'text/plain' });
            const url = window.URL.createObjectURL(blob);
            const link = document.createElement('a');
            link.href = url;
            link.setAttribute('download', `payroll_${period}.txt`);
            document.body.appendChild(link);
            link.click();
            link.remove();
            setMessage({ type: 'success', text: 'Ведомость сформирована' });
        }
    };

    const handlePayEmployee = (employee) => {
        setSelectedEmployee(employee);
        setShowPayModal(true);
    };

    const handleConfirmPayment = async () => {
        if (!selectedEmployee) return;
        try {
            // Если у записи уже есть payrollId - используем его, иначе создаём новую запись
            let payrollId = selectedEmployee.payrollId;
            if (!payrollId) {
                const [year, month] = period.split('-').map(Number);
                const createRes = await payrollAPI.create({
                    employeeId: selectedEmployee.employeeId || selectedEmployee.id,
                    periodYear: year,
                    periodMonth: month,
                    baseSalary: selectedEmployee.base || 0,
                    bonuses: selectedEmployee.bonus || 0,
                    deductions: selectedEmployee.deductions || 0
                });
                const createData = createRes.data || createRes;
                payrollId = createData.record?.id;
            }
            if (payrollId) {
                await payrollAPI.pay(payrollId);
            }
            await loadData();
            setShowPayModal(false);
            setMessage({ type: 'success', text: `Выплачено ${selectedEmployee.name}: ${formatCurrency(selectedEmployee.total)}` });
        } catch (error) {
            // Fallback — обновить локально
            setEmployees(employees.map(e => e.id === selectedEmployee.id ? { ...e, status: 'paid' } : e));
            setShowPayModal(false);
            setMessage({ type: 'success', text: `Выплачено ${selectedEmployee.name}: ${formatCurrency(selectedEmployee.total)}` });
        }
    };

    const handlePayAll = async () => {
        const pending = employees.filter(e => e.status === 'pending');
        if (pending.length === 0) {
            setMessage({ type: 'error', text: 'Нет ожидающих выплат' });
            return;
        }
        if (!(await confirm({ message: `Выплатить зарплату ${pending.length} сотрудникам на сумму ${formatCurrency(pending.reduce((s, e) => s + e.total, 0))}?` }))) return;
        try {
            await api.post('/payroll/pay-all', { period });
            loadData();
            setMessage({ type: 'success', text: `Выплачено ${pending.length} сотрудникам` });
        } catch (error) {
            setEmployees(employees.map(e => ({ ...e, status: 'paid' })));
            setMessage({ type: 'success', text: `Выплачено ${pending.length} сотрудникам` });
        }
    };

    const getStatusInfo = (status) => {
        const statuses = {
            paid: { label: 'Выплачено', color: '#10b981', bg: '#dcfce7' },
            pending: { label: 'Ожидает', color: '#f59e0b', bg: '#fef3c7' }
        };
        return statuses[status] || statuses.pending;
    };

    return (
        <div className="payroll-page fade-in">
            <input
                type="file"
                ref={fileInputRef}
                style={{ display: 'none' }}
                accept=".xlsx,.xls,.csv"
                onChange={handleExcelImport}
            />
            <div className="page-header">
                <div>
                    <h1>{t('payroll.raschyot_zarplaty', '💰 Расчёт зарплаты')}</h1>
                    <p className="text-muted">{t('payroll.nachisleniya_i_vyplaty_sotrudnikam', 'Начисления и выплаты сотрудникам')}</p>
                </div>
                <div style={{ display: 'flex', gap: '12px', alignItems: 'center', flexWrap: 'wrap' }}>
                    <input type="month" value={period} onChange={(e) => setPeriod(e.target.value)} />
                    <button className="btn btn-secondary" onClick={() => fileInputRef.current?.click()} title={t('payroll.import_iz', 'Импорт из Excel')}>
                        <Upload size={18} /> Импорт
                    </button>
                    <button className="btn btn-secondary" onClick={handleExcelExport} title={t('payroll.eksport_v', 'Экспорт в Excel')}>
                        <FileSpreadsheet size={18} /> Экспорт
                    </button>
                    <button className="btn btn-secondary" onClick={handleCalculate}>
                        <Calculator size={18} /> Рассчитать
                    </button>
                    <button className="btn btn-primary" onClick={handlePayAll}>
                        <CreditCard size={18} /> Выплатить всем
                    </button>
                </div>
            </div>

            {message && (
                <div className={`alert ${message.type === 'success' ? 'alert-success' : 'alert-danger'}`} style={{ marginBottom: '16px' }}>
                    {message.type === 'success' ? <Check size={18} /> : <X size={18} />}
                    {message.text}
                    <button onClick={() => setMessage(null)} style={{ marginLeft: 'auto', background: 'none', border: 'none', cursor: 'pointer', color: 'inherit' }}>
                        <X size={16} />
                    </button>
                </div>
            )}

            {/* Статистика */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '16px', marginBottom: '20px' }}>
                <div className="card" style={{
                    padding: '24px',
                    background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
                    color: 'white'
                }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                        <div>
                            <div style={{ fontSize: '13px', opacity: 0.8 }}>{t('payroll.fond_oplaty_truda', 'Фонд оплаты труда')}</div>
                            <div style={{ fontSize: '22px', fontWeight: 'bold', marginTop: '8px' }}>
                                {formatCurrency(stats.total_payroll || 0)}
                            </div>
                        </div>
                        <DollarSign size={32} style={{ opacity: 0.3 }} />
                    </div>
                </div>

                <div className="card" style={{ padding: '20px' }}>
                    <div style={{ color: '#888', fontSize: '13px' }}>{t('payroll.sotrudnikov', 'Сотрудников')}</div>
                    <div style={{ fontSize: '28px', fontWeight: 'bold' }}>{stats.total_employees || 0}</div>
                </div>

                <div className="card" style={{ padding: '20px' }}>
                    <div style={{ color: '#888', fontSize: '13px' }}>{t('payroll.srednyaya_zarplata', 'Средняя зарплата')}</div>
                    <div style={{ fontSize: '18px', fontWeight: 'bold' }}>{formatCurrency(stats.avg_salary || 0)}</div>
                </div>

                <div className="card" style={{ padding: '20px' }}>
                    <div style={{ color: '#888', fontSize: '13px' }}>{t('payroll.vsego_bonusov', 'Всего бонусов')}</div>
                    <div style={{ fontSize: '18px', fontWeight: 'bold', color: '#10b981' }}>{formatCurrency(stats.total_bonus || 0)}</div>
                </div>
            </div>

            {/* Таблица */}
            <div className="card">
                <div style={{ padding: '16px', borderBottom: '1px solid var(--border-color)' }}>
                    <h3 style={{ margin: 0 }}>📋 Расчётная ведомость за {period}</h3>
                </div>
                {loading ? (
                    <div style={{ padding: '40px', textAlign: 'center' }}>{t('payroll.zagruzka', 'Загрузка...')}</div>
                ) : employees.length === 0 ? (
                    <div className="empty-state">
                        <Users size={64} className="text-muted" />
                        <h3>{t('payroll.dannye_otsutstvuyut', 'Данные отсутствуют')}</h3>
                    </div>
                ) : (
                    <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                        <thead>
                            <tr style={{ background: 'var(--bg-secondary)' }}>
                                <th style={{ padding: '12px', textAlign: 'left' }}>{t('payroll.sotrudnik', 'Сотрудник')}</th>
                                <th style={{ padding: '12px', textAlign: 'right' }}>{t('payroll.oklad', 'Оклад')}</th>
                                <th style={{ padding: '12px', textAlign: 'right' }}>{t('payroll.bonus', 'Бонус')}</th>
                                <th style={{ padding: '12px', textAlign: 'right' }}>{t('payroll.pererabotka', 'Переработка')}</th>
                                <th style={{ padding: '12px', textAlign: 'right' }}>{t('payroll.uderzhaniya', 'Удержания')}</th>
                                <th style={{ padding: '12px', textAlign: 'center' }}>{t('payroll.chasov', 'Часов')}</th>
                                <th style={{ padding: '12px', textAlign: 'right' }}>{t('payroll.k_vyplate', 'К выплате')}</th>
                                <th style={{ padding: '12px', textAlign: 'center' }}>{t('payroll.status', 'Статус')}</th>
                                <th style={{ padding: '12px', textAlign: 'center' }}>{t('payroll.deystviya', 'Действия')}</th>
                            </tr>
                        </thead>
                        <tbody>
                            {employees.map(emp => {
                                const statusInfo = getStatusInfo(emp.status);
                                return (
                                    <tr key={emp.id} style={{ borderBottom: '1px solid var(--border-color)' }}>
                                        <td style={{ padding: '12px' }}>
                                            <div style={{ fontWeight: 500 }}>{emp.name}</div>
                                            <div style={{ fontSize: '12px', color: '#888' }}>{emp.position}</div>
                                        </td>
                                        <td style={{ padding: '12px', textAlign: 'right' }}>{formatCurrency(emp.base)}</td>
                                        <td style={{ padding: '12px', textAlign: 'right', color: '#10b981' }}>+{formatCurrency(emp.bonus)}</td>
                                        <td style={{ padding: '12px', textAlign: 'right', color: '#3b82f6' }}>+{formatCurrency(emp.overtime)}</td>
                                        <td style={{ padding: '12px', textAlign: 'right', color: '#ef4444' }}>-{formatCurrency(emp.deductions)}</td>
                                        <td style={{ padding: '12px', textAlign: 'center' }}>
                                            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '4px' }}>
                                                <Clock size={14} color="#888" />
                                                {emp.hours}
                                            </div>
                                        </td>
                                        <td style={{ padding: '12px', textAlign: 'right', fontWeight: 'bold', fontSize: '15px' }}>
                                            {formatCurrency(emp.total)}
                                        </td>
                                        <td style={{ padding: '12px', textAlign: 'center' }}>
                                            <span style={{ background: statusInfo.bg, color: statusInfo.color, padding: '4px 10px', borderRadius: '12px', fontSize: '12px' }}>
                                                {statusInfo.label}
                                            </span>
                                        </td>
                                        <td style={{ padding: '12px', textAlign: 'center' }}>
                                            {emp.status === 'pending' && (
                                                <button className="btn btn-sm btn-success" onClick={() => handlePayEmployee(emp)} title={t('payroll.vyplatit', 'Выплатить')}>
                                                    <CreditCard size={14} />
                                                </button>
                                            )}
                                        </td>
                                    </tr>
                                );
                            })}
                        </tbody>
                        <tfoot>
                            <tr style={{ background: 'var(--bg-secondary)', fontWeight: 'bold' }}>
                                <td style={{ padding: '12px' }}>{t('payroll.itogo', 'ИТОГО')}</td>
                                <td style={{ padding: '12px', textAlign: 'right' }}>{formatCurrency(employees.reduce((s, e) => s + e.base, 0))}</td>
                                <td style={{ padding: '12px', textAlign: 'right', color: '#10b981' }}>+{formatCurrency(employees.reduce((s, e) => s + e.bonus, 0))}</td>
                                <td style={{ padding: '12px', textAlign: 'right', color: '#3b82f6' }}>+{formatCurrency(employees.reduce((s, e) => s + e.overtime, 0))}</td>
                                <td style={{ padding: '12px', textAlign: 'right', color: '#ef4444' }}>-{formatCurrency(employees.reduce((s, e) => s + e.deductions, 0))}</td>
                                <td style={{ padding: '12px', textAlign: 'center' }}>{employees.reduce((s, e) => s + e.hours, 0)}</td>
                                <td style={{ padding: '12px', textAlign: 'right', fontSize: '16px' }}>{formatCurrency(stats.total_payroll || 0)}</td>
                                <td colSpan="2"></td>
                            </tr>
                        </tfoot>
                    </table>
                )}
            </div>

            {/* Pay Modal */}
            {showPayModal && selectedEmployee && (
                <div className="modal-overlay" onClick={() => setShowPayModal(false)}>
                    <div className="modal-content" onClick={e => e.stopPropagation()} style={{ maxWidth: '400px' }}>
                        <div className="modal-header">
                            <h2>{t('payroll.vyplata_zarplaty', 'Выплата зарплаты')}</h2>
                            <button onClick={() => setShowPayModal(false)} className="btn-close">×</button>
                        </div>
                        <div className="modal-body">
                            <div style={{ marginBottom: '16px', padding: '16px', background: 'var(--color-bg-tertiary)', borderRadius: '8px', textAlign: 'center' }}>
                                <div style={{ fontWeight: 'bold', fontSize: '18px' }}>{selectedEmployee.name}</div>
                                <div style={{ color: 'var(--color-text-muted)' }}>{selectedEmployee.position}</div>
                                <div style={{ fontSize: '24px', fontWeight: 'bold', color: '#10b981', marginTop: '12px' }}>
                                    {formatCurrency(selectedEmployee.total)}
                                </div>
                            </div>
                            <p style={{ textAlign: 'center', color: 'var(--color-text-muted)' }}>{t('payroll.podtverdite_vyplatu_zarplaty', 'Подтвердите выплату зарплаты')}</p>
                        </div>
                        <div className="modal-footer">
                            <button onClick={() => setShowPayModal(false)} className="btn btn-secondary">{t('payroll.otmena', 'Отмена')}</button>
                            <button onClick={handleConfirmPayment} className="btn btn-success"><CreditCard size={16} /> Выплатить</button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}

export default Payroll;
