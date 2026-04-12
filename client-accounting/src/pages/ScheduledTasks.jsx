import React, { useState, useEffect } from 'react';
import { Clock, Play, Pause, CheckCircle, XCircle, Calendar } from 'lucide-react';
import { schedulerAPI } from '../services/api';
import '../styles/Common.css';
import { useToast } from '../components/ToastProvider';
import { useI18n } from '../i18n';

const ScheduledTasks = () => {
    const toast = useToast();
    const { t } = useI18n();
    const [tasks, setTasks] = useState([]);
    const [taskTypes, setTaskTypes] = useState([]);
    const [executionLog, setExecutionLog] = useState([]);
    const [selectedTask, setSelectedTask] = useState(null);
    const [loading, setLoading] = useState(false);

    useEffect(() => {
        loadData();
    }, []);

    const loadData = async () => {
        try {
            const apiRes = await schedulerAPI.getAll();
            const apiData = apiRes.data || apiRes;
            setTaskTypes(apiData.taskTypes || []);
            setExecutionLog(apiData.executionLog || []);
        } catch (err) {
            console.warn('ScheduledTasks: не удалось загрузить данные', err.message);
        }
        setLoading(false);
    };

    const parseCronSchedule = (cron) => {
        // Упрощённый парсер cron
        const descriptions = {
            '0 2 * * *': 'Каждый день в 2:00',
            '0 3 * * 0': 'Каждое воскресенье в 3:00',
            '0 1 * * *': 'Каждый день в 1:00',
            '0 10 * * *': 'Каждый день в 10:00',
            '0 9 * * 1': 'Каждый понедельник в 9:00',
            '*/15 * * * *': 'Каждые 15 минут',
            '0 4 * * 0': 'Каждое воскресенье в 4:00'
        };
        return descriptions[cron] || cron;
    };

    const getStatusBadge = (status) => {
        const statuses = {
            'success': { icon: CheckCircle, label: 'Успешно', color: '#28a745' },
            'failed': { icon: XCircle, label: 'Ошибка', color: '#dc3545' },
            'running': { icon: Play, label: 'Выполняется', color: '#17a2b8' }
        };
        const s = statuses[status] || statuses.success;
        const Icon = s.icon;

        return (
            <span style={{
                background: s.color,
                color: 'white',
                padding: '4px 12px',
                borderRadius: '12px',
                fontSize: '13px',
                fontWeight: 600,
                display: 'inline-flex',
                alignItems: 'center',
                gap: '6px'
            }}>
                <Icon size={14} />
                {s.label}
            </span>
        );
    };

    const formatDuration = (started, finished) => {
        const diff = new Date(finished) - new Date(started);
        const seconds = Math.floor(diff / 1000);
        if (seconds < 60) return `${seconds}с`;
        const minutes = Math.floor(seconds / 60);
        return `${minutes}м ${seconds % 60}с`;
    };

    return (
        <div className="page-container fade-in">
            <div className="page-header">
                <div>
                    <h1><Clock size={32} /> {t('scheduler.title', 'Автоматические задачи')}</h1>
                    <p>{t('scheduler.subtitle', 'Планировщик задач и история выполнения')}</p>
                </div>
            </div>

            {/* Статистика */}
            <div className="stats-grid">
                <div className="stat-card">
                    <div className="stat-icon" style={{ background: '#4472C4' }}>
                        <Calendar size={24} />
                    </div>
                    <div className="stat-details">
                        <div className="stat-value">{taskTypes.length}</div>
                        <div className="stat-label">{t('scheduler.taskTypes', 'Типов задач')}</div>
                    </div>
                </div>
                <div className="stat-card">
                    <div className="stat-icon" style={{ background: '#28a745' }}>
                        <CheckCircle size={24} />
                    </div>
                    <div className="stat-details">
                        <div className="stat-value">
                            {executionLog.filter(l => l.status === 'success').length}
                        </div>
                        <div className="stat-label">{t('common.success', 'Успешно')}</div>
                    </div>
                </div>
                <div className="stat-card">
                    <div className="stat-icon" style={{ background: '#dc3545' }}>
                        <XCircle size={24} />
                    </div>
                    <div className="stat-details">
                        <div className="stat-value">
                            {executionLog.filter(l => l.status === 'failed').length}
                        </div>
                        <div className="stat-label">{t('scheduler.errors', 'Ошибок')}</div>
                    </div>
                </div>
            </div>

            {/* Список задач */}
            <div className="card">
                <h3>{t('scheduler.scheduledTasks', 'Запланированные задачи')}</h3>
                <table className="data-table">
                    <thead>
                        <tr>
                            <th>{t('scheduledtasks.zadacha', 'Задача')}</th>
                            <th>{t('scheduledtasks.raspisanie', 'Расписание')}</th>
                            <th>{t('scheduledtasks.kod', 'Код')}</th>
                            <th>{t('scheduledtasks.status', 'Статус')}</th>
                            <th>{t('scheduledtasks.deystviya', 'Действия')}</th>
                        </tr>
                    </thead>
                    <tbody>
                        {taskTypes.map(task => (
                            <tr key={task.code}>
                                <td><strong>{task.name}</strong></td>
                                <td>{parseCronSchedule(task.schedule)}</td>
                                <td><code>{task.schedule}</code></td>
                                <td>
                                    <span style={{
                                        background: '#28a745',
                                        color: 'white',
                                        padding: '4px 12px',
                                        borderRadius: '12px',
                                        fontSize: '13px',
                                        fontWeight: 600
                                    }}>
                                        Активна
                                    </span>
                                </td>
                                <td>
                                    <button className="btn btn-sm btn-secondary" onClick={() => toast.info(`Запуск задачи: ${task.name}`)}>
                                        Запустить сейчас
                                    </button>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>

            {/* История выполнения */}
            <div className="card">
                <h3>{t('scheduler.executionHistory', 'История выполнения')}</h3>
                <table className="data-table">
                    <thead>
                        <tr>
                            <th>{t('scheduledtasks.zadacha', 'Задача')}</th>
                            <th>{t('scheduledtasks.nachalo', 'Начало')}</th>
                            <th>{t('scheduledtasks.zavershenie', 'Завершение')}</th>
                            <th>{t('scheduledtasks.dlitelnost', 'Длительность')}</th>
                            <th>{t('scheduledtasks.status', 'Статус')}</th>
                            <th>{t('scheduledtasks.soobschenie', 'Сообщение')}</th>
                        </tr>
                    </thead>
                    <tbody>
                        {executionLog.map(log => (
                            <tr key={log.id}>
                                <td><strong>{log.task_name}</strong></td>
                                <td>{new Date(log.started_at).toLocaleString('ru-RU')}</td>
                                <td>{new Date(log.finished_at).toLocaleString('ru-RU')}</td>
                                <td>{formatDuration(log.started_at, log.finished_at)}</td>
                                <td>{getStatusBadge(log.status)}</td>
                                <td style={{ fontSize: '13px' }}>{log.message}</td>
                            </tr>
                        ))}
                        {executionLog.length === 0 && (
                            <tr>
                                <td colSpan="6" style={{ textAlign: 'center', padding: '40px' }}>
                                    Нет записей о выполнении задач
                                </td>
                            </tr>
                        )}
                    </tbody>
                </table>
            </div>

            {/* Информация */}
            <div className="card" style={{ background: '#e7f3ff', border: '1px solid #b3d9ff' }}>
                <h4>{t('scheduledtasks.informatsiya_o_planirovschike', '📝 Информация о планировщике')}</h4>
                <p>
                    Автоматические задачи выполняются по расписанию в фоновом режиме.
                    Для настройки собственного расписания используйте формат cron:
                </p>
                <ul style={{ marginTop: '12px', paddingLeft: '20px' }}>
                    <li><code>*/15 * * * *</code> {t('scheduledtasks.kazhdye_minut', '- каждые 15 минут')}</li>
                    <li><code>0 2 * * *</code> {t('scheduledtasks.kazhdyy_den_v', '- каждый день в 2:00')}</li>
                    <li><code>0 9 * * 1</code> {t('scheduledtasks.kazhdyy_ponedelnik_v', '- каждый понедельник в 9:00')}</li>
                    <li><code>0 0 1 * *</code> {t('scheduledtasks.pervoe_chislo_kazhdogo_mesyatsa_v', '- первое число каждого месяца в 00:00')}</li>
                </ul>
            </div>
        </div>
    );
};

export default ScheduledTasks;
