import React, { useState, useEffect } from 'react';
import { Calendar, Users, Clock, Plus, ChevronLeft, ChevronRight, Check, X, Edit2 } from 'lucide-react';
import api from '../services/api';
import { useI18n } from '../i18n';

function WorkSchedule() {
    const { t } = useI18n();
    const [employees, setEmployees] = useState([]);
    const [currentWeekStart, setCurrentWeekStart] = useState(() => {
        // Get current Monday
        const today = new Date();
        const day = today.getDay();
        const diff = today.getDate() - day + (day === 0 ? -6 : 1);
        return new Date(today.setDate(diff));
    });
    const [viewMode, setViewMode] = useState('week'); // 'week', 'twoWeeks', 'month'
    const [loading, setLoading] = useState(true);
    const [showModal, setShowModal] = useState(false);
    const [editingShift, setEditingShift] = useState(null);
    const [message, setMessage] = useState(null);
    const [formData, setFormData] = useState({
        employeeId: '',
        dayIndex: 0,
        startTime: '09',
        endTime: '18',
        isOff: false
    });

    useEffect(() => { loadData(); }, [currentWeekStart, viewMode]);

    const loadData = async () => {
        try {
            const apiRes = await employeesAPI.getAll();
            const apiData = apiRes.data || apiRes;
            setEmployees(employeesWithSchedule);
            setEmployees(apiData.employees || []);
        } catch (err) {
            console.warn('WorkSchedule: не удалось загрузить данные', err.message);
        }
        setLoading(false);
    };

    const handlePrevPeriod = () => {
        const newDate = new Date(currentWeekStart);
        const offset = viewMode === 'month' ? 28 : viewMode === 'twoWeeks' ? 14 : 7;
        newDate.setDate(newDate.getDate() - offset);
        setCurrentWeekStart(newDate);
    };

    const handleNextPeriod = () => {
        const newDate = new Date(currentWeekStart);
        const offset = viewMode === 'month' ? 28 : viewMode === 'twoWeeks' ? 14 : 7;
        newDate.setDate(newDate.getDate() + offset);
        setCurrentWeekStart(newDate);
    };

    const getDays = () => {
        const dayNames = ['Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Вс'];
        const daysCount = viewMode === 'month' ? 28 : viewMode === 'twoWeeks' ? 14 : 7;

        return Array.from({ length: daysCount }, (_, idx) => {
            const date = new Date(currentWeekStart);
            date.setDate(date.getDate() + idx);
            const dayOfWeek = (idx % 7);
            return {
                label: `${dayNames[dayOfWeek]} ${date.getDate()}`,
                isWeekend: dayOfWeek >= 5,
                date: date
            };
        });
    };

    const getPeriodRange = () => {
        const daysCount = viewMode === 'month' ? 27 : viewMode === 'twoWeeks' ? 13 : 6;
        const endDate = new Date(currentWeekStart);
        endDate.setDate(endDate.getDate() + daysCount);
        const months = ['января', 'февраля', 'марта', 'апреля', 'мая', 'июня', 'июля', 'августа', 'сентября', 'октября', 'ноября', 'декабря'];
        return `${currentWeekStart.getDate()} ${months[currentWeekStart.getMonth()]} - ${endDate.getDate()} ${months[endDate.getMonth()]} ${endDate.getFullYear()}`;
    };

    const days = getDays();

    const getEmployeeScheduleForDays = (emp) => {
        // Extend schedule to match days count
        const schedule = [];
        for (let i = 0; i < days.length; i++) {
            const dayOfWeek = i % 7;
            schedule.push(emp.schedule[dayOfWeek] || 'выходной');
        }
        return schedule;
    };

    const getCellStyle = (value) => {
        if (value === 'выходной') {
            return { background: '#f3f4f6', color: '#888' };
        }
        return { background: '#dcfce7', color: '#166534' };
    };

    const handleOpenModal = (employeeId = '', dayIndex = 0, currentShift = null) => {
        if (currentShift && currentShift !== 'выходной') {
            const [start, end] = currentShift.split('-');
            setFormData({
                employeeId,
                dayIndex,
                startTime: start,
                endTime: end,
                isOff: false
            });
        } else if (currentShift === 'выходной') {
            setFormData({
                employeeId,
                dayIndex,
                startTime: '09',
                endTime: '18',
                isOff: true
            });
        } else {
            setFormData({
                employeeId,
                dayIndex,
                startTime: '09',
                endTime: '18',
                isOff: false
            });
        }
        setEditingShift(currentShift);
        setShowModal(true);
    };

    const handleSaveShift = async () => {
        if (!formData.employeeId) {
            setMessage({ type: 'error', text: 'Выберите сотрудника' });
            return;
        }

        try {
            const newSchedule = formData.isOff ? 'выходной' : `${formData.startTime}-${formData.endTime}`;

            // Update local state
            setEmployees(prev => prev.map(emp => {
                if (emp.id === parseInt(formData.employeeId)) {
                    const newEmpSchedule = [...emp.schedule];
                    newEmpSchedule[formData.dayIndex] = newSchedule;
                    return { ...emp, schedule: newEmpSchedule };
                }
                return emp;
            }));

            setMessage({ type: 'success', text: 'График обновлён' });
            setShowModal(false);
        } catch (error) {
            console.error('Error saving shift:', error);
            setMessage({ type: 'error', text: 'Ошибка сохранения' });
        }
    };

    const handleCellClick = (emp, dayIndex) => {
        const schedule = getEmployeeScheduleForDays(emp);
        handleOpenModal(emp.id, dayIndex % 7, schedule[dayIndex]);
    };

    return (
        <div className="work-schedule-page fade-in">
            <div className="page-header">
                <div>
                    <h1>{t('workschedule.grafik_raboty', '📅 График работы')}</h1>
                    <p className="text-muted">{t('workschedule.raspisanie_sotrudnikov', 'Расписание сотрудников')}</p>
                </div>
                <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
                    <select
                        value={viewMode}
                        onChange={e => setViewMode(e.target.value)}
                        style={{ padding: '8px 12px', borderRadius: '8px', border: '1px solid var(--border-color)' }}
                    >
                        <option value="week">{t('workschedule.nedelya', '1 неделя')}</option>
                        <option value="twoWeeks">{t('workschedule.nedeli', '2 недели')}</option>
                        <option value="month">{t('workschedule.mesyats_ned', 'Месяц (4 нед)')}</option>
                    </select>
                    <button className="btn btn-primary" onClick={() => handleOpenModal()}>
                        <Plus size={18} /> Добавить смену
                    </button>
                </div>
            </div>

            {/* Message */}
            {message && (
                <div className={`alert ${message.type === 'error' ? 'alert-error' : 'alert-success'}`} style={{ marginBottom: '16px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    {message.text}
                    <button onClick={() => setMessage(null)} style={{ background: 'none', border: 'none', cursor: 'pointer' }}>×</button>
                </div>
            )}

            {/* Навигация по периоду */}
            <div className="card" style={{ marginBottom: '20px', padding: '16px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <button className="btn btn-secondary" onClick={handlePrevPeriod}>
                        <ChevronLeft size={18} /> Назад
                    </button>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                        <Calendar size={20} color="#3b82f6" />
                        <span style={{ fontWeight: 'bold', fontSize: '18px' }}>{getPeriodRange()}</span>
                    </div>
                    <button className="btn btn-secondary" onClick={handleNextPeriod}>
                        Вперёд <ChevronRight size={18} />
                    </button>
                </div>
            </div>

            {/* График */}
            <div className="card" style={{ overflowX: 'auto' }}>
                {loading ? (
                    <div style={{ padding: '40px', textAlign: 'center' }}>{t('workschedule.zagruzka', 'Загрузка...')}</div>
                ) : (
                    <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: viewMode === 'week' ? 'auto' : '1200px' }}>
                        <thead>
                            <tr style={{ background: 'var(--bg-secondary)' }}>
                                <th style={{ padding: '12px', textAlign: 'left', width: '180px', position: 'sticky', left: 0, background: 'var(--bg-secondary)', zIndex: 10 }}>{t('workschedule.sotrudnik', 'Сотрудник')}</th>
                                {days.map((day, idx) => (
                                    <th key={idx} style={{
                                        padding: viewMode === 'week' ? '12px' : '6px',
                                        textAlign: 'center',
                                        background: day.isWeekend ? '#fef3c7' : 'var(--bg-secondary)',
                                        fontSize: viewMode === 'week' ? '14px' : '11px',
                                        minWidth: viewMode === 'week' ? '80px' : '50px'
                                    }}>
                                        {day.label}
                                    </th>
                                ))}
                                <th style={{ padding: '12px', textAlign: 'center' }}>{t('workschedule.chasov', 'Часов')}</th>
                            </tr>
                        </thead>
                        <tbody>
                            {employees.map(emp => {
                                const schedule = getEmployeeScheduleForDays(emp);
                                const totalHours = schedule.reduce((sum, s) => {
                                    if (s === 'выходной') return sum;
                                    const [start, end] = s.split('-').map(Number);
                                    return sum + (end - start);
                                }, 0);

                                return (
                                    <tr key={emp.id} style={{ borderBottom: '1px solid var(--border-color)' }}>
                                        <td style={{ padding: '12px', position: 'sticky', left: 0, background: 'white', zIndex: 10 }}>
                                            <div style={{ fontWeight: 500 }}>{emp.name}</div>
                                            <div style={{ fontSize: '12px', color: '#888' }}>{emp.position}</div>
                                        </td>
                                        {schedule.map((shift, idx) => {
                                            const style = getCellStyle(shift);
                                            const isCompact = viewMode !== 'week';
                                            return (
                                                <td
                                                    key={idx}
                                                    style={{
                                                        padding: isCompact ? '4px' : '8px',
                                                        textAlign: 'center',
                                                        ...style,
                                                        borderLeft: '1px solid var(--border-color)',
                                                        cursor: 'pointer'
                                                    }}
                                                    onClick={() => handleCellClick(emp, idx)}
                                                    title={t('workschedule.nazhmite_dlya_redaktirovaniya', 'Нажмите для редактирования')}
                                                >
                                                    <div style={{
                                                        padding: isCompact ? '2px' : '6px',
                                                        borderRadius: '6px',
                                                        fontSize: isCompact ? '10px' : '13px',
                                                        fontWeight: shift !== 'выходной' ? 500 : 400
                                                    }}>
                                                        {isCompact && shift !== 'выходной' ? shift.replace('-', '—') : shift}
                                                    </div>
                                                </td>
                                            );
                                        })}
                                        <td style={{ padding: '12px', textAlign: 'center', fontWeight: 'bold' }}>
                                            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '4px' }}>
                                                <Clock size={14} color="#3b82f6" />
                                                {totalHours}ч
                                            </div>
                                        </td>
                                    </tr>
                                );
                            })}
                        </tbody>
                    </table>
                )}
            </div>

            {/* Легенда */}
            <div style={{ marginTop: '16px', display: 'flex', gap: '24px', fontSize: '13px', color: '#666' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <div style={{ width: '20px', height: '20px', background: '#dcfce7', borderRadius: '4px' }} />
                    <span>{t('workschedule.rabochiy_den', 'Рабочий день')}</span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <div style={{ width: '20px', height: '20px', background: '#f3f4f6', borderRadius: '4px' }} />
                    <span>{t('workschedule.vyhodnoy', 'Выходной')}</span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <div style={{ width: '20px', height: '20px', background: '#fef3c7', borderRadius: '4px' }} />
                    <span>{t('workschedule.vyhodnye_dni', 'Выходные дни')}</span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginLeft: 'auto' }}>
                    <Edit2 size={14} color="#3b82f6" />
                    <span>{t('workschedule.nazhmite_na_yacheyku_dlya_redaktirovaniya', 'Нажмите на ячейку для редактирования')}</span>
                </div>
            </div>

            {/* Modal */}
            {showModal && (
                <div className="modal-overlay" onClick={() => setShowModal(false)}>
                    <div className="modal" onClick={e => e.stopPropagation()} style={{ maxWidth: '400px' }}>
                        <div className="modal-header">
                            <h2>{editingShift ? 'Редактировать смену' : 'Добавить смену'}</h2>
                            <button onClick={() => setShowModal(false)} className="btn-close">×</button>
                        </div>
                        <div className="modal-body">
                            <div className="form-group">
                                <label>{t('workschedule.sotrudnik', 'Сотрудник')}</label>
                                <select
                                    value={formData.employeeId}
                                    onChange={e => setFormData({ ...formData, employeeId: e.target.value })}
                                    required
                                >
                                    <option value="">{t('workschedule.vyberite_sotrudnika', 'Выберите сотрудника')}</option>
                                    {employees.map(emp => (
                                        <option key={emp.id} value={emp.id}>{emp.name} - {emp.position}</option>
                                    ))}
                                </select>
                            </div>
                            <div className="form-group">
                                <label>{t('workschedule.den_nedeli', 'День недели')}</label>
                                <select
                                    value={formData.dayIndex}
                                    onChange={e => setFormData({ ...formData, dayIndex: parseInt(e.target.value) })}
                                >
                                    {['Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Вс'].map((day, idx) => (
                                        <option key={idx} value={idx}>{day}</option>
                                    ))}
                                </select>
                            </div>
                            <div className="form-group">
                                <label style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                    <input
                                        type="checkbox"
                                        checked={formData.isOff}
                                        onChange={e => setFormData({ ...formData, isOff: e.target.checked })}
                                    />
                                    Выходной день
                                </label>
                            </div>
                            {!formData.isOff && (
                                <div style={{ display: 'flex', gap: '12px' }}>
                                    <div className="form-group" style={{ flex: 1 }}>
                                        <label>{t('workschedule.nachalo', 'Начало')}</label>
                                        <select
                                            value={formData.startTime}
                                            onChange={e => setFormData({ ...formData, startTime: e.target.value })}
                                        >
                                            {Array.from({ length: 15 }, (_, i) => i + 6).map(hour => (
                                                <option key={hour} value={hour < 10 ? `0${hour}` : String(hour)}>
                                                    {hour}:00
                                                </option>
                                            ))}
                                        </select>
                                    </div>
                                    <div className="form-group" style={{ flex: 1 }}>
                                        <label>{t('workschedule.konets', 'Конец')}</label>
                                        <select
                                            value={formData.endTime}
                                            onChange={e => setFormData({ ...formData, endTime: e.target.value })}
                                        >
                                            {Array.from({ length: 15 }, (_, i) => i + 10).map(hour => (
                                                <option key={hour} value={String(hour)}>
                                                    {hour}:00
                                                </option>
                                            ))}
                                        </select>
                                    </div>
                                </div>
                            )}
                        </div>
                        <div className="modal-footer">
                            <button className="btn btn-secondary" onClick={() => setShowModal(false)}>{t('workschedule.otmena', 'Отмена')}</button>
                            <button className="btn btn-primary" onClick={handleSaveShift}>
                                <Check size={16} /> Сохранить
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}

export default WorkSchedule;
