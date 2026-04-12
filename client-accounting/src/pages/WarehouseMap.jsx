import React, { useState, useEffect } from 'react';
import { MapPin, Package, Grid, Plus, Edit2, Trash2 } from 'lucide-react';
import { wmsAPI } from '../services/api';
import { useConfirm } from '../components/ConfirmDialog';
import '../styles/Common.css';
import { useI18n } from '../i18n';

const WarehouseMap = () => {
    const { t } = useI18n();
    const confirm = useConfirm();

    const [locations, setLocations] = useState([]);
    const [selectedLocation, setSelectedLocation] = useState(null);
    const [showModal, setShowModal] = useState(false);
    const [loading, setLoading] = useState(false);
    const [formData, setFormData] = useState({
        zone: '',
        rack: '',
        level: '',
        cell: '',
        capacity: 100
    });

    useEffect(() => {
        loadLocations();
    }, []);

    const loadLocations = async () => {
        try {
            const apiRes = await wmsAPI.getAllLocations();
            const apiData = apiRes.data || apiRes;
            setLocations(apiData.locations || apiData || []);
        } catch (err) {
            console.warn('WarehouseMap: не удалось загрузить данные', err.message);
        }
        setLoading(false);
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        try {
            if (selectedLocation) {
                await wmsAPI.updateLocation(selectedLocation.id, formData);
            } else {
                await wmsAPI.saveLocation(formData);
            }
            setShowModal(false);
            setFormData({ zone: '', rack: '', level: '', cell: '', capacity: 100 });
            setSelectedLocation(null);
            loadLocations();
        } catch (error) {
            console.error('Error saving location:', error);
        }
    };

    const deleteLocation = async (id) => {
        if (!(await confirm({ variant: 'danger', message: 'Удалить ячейку?' }))) return;

        try {
            await wmsAPI.deleteLocation(id);
            loadLocations();
        } catch (error) {
            console.error('Error deleting location:', error);
        }
    };

    // Группировка по зонам и стеллажам
    const groupedLocations = locations.reduce((acc, loc) => {
        if (!acc[loc.zone]) acc[loc.zone] = {};
        if (!acc[loc.zone][loc.rack]) acc[loc.zone][loc.rack] = [];
        acc[loc.zone][loc.rack].push(loc);
        return acc;
    }, {});

    const getOccupancyColor = (percent) => {
        if (percent === 0) return '#94a3b8';   // Серо-голубой (пусто)
        if (percent < 50) return '#22d3ee';    // Бирюзовый (мало)
        if (percent < 80) return '#38bdf8';    // Голубой (средне)
        return '#0ea5e9';                       // Ярко-синий (заполнено)
    };

    const getTextColor = (percent) => {
        return percent === 0 ? '#1e293b' : '#0c4a6e';  // Тёмный текст
    };

    const getOccupancyText = (location) => {
        const percent = location.current_capacity
            ? Math.round((location.current_capacity / location.capacity) * 100)
            : 0;
        return `${percent}%`;
    };

    return (
        <div className="page-container fade-in">
            <div className="page-header">
                <div>
                    <h1><MapPin size={32} /> {t('warehousemap.karta_sklada', 'Карта склада')}</h1>
                    <p>{t('warehousemap.vizualizatsiya_yacheek_i_tekuschaya_zagruzka', 'Визуализация ячеек и текущая загрузка')}</p>
                </div>
                <button className="btn btn-primary" onClick={() => {
                    setSelectedLocation(null);
                    setShowModal(true);
                }}>
                    <Plus size={20} /> Добавить ячейку
                </button>
            </div>

            {/* Статистика */}
            <div className="stats-grid">
                <div className="stat-card">
                    <div className="stat-icon" style={{ background: '#4472C4' }}>
                        <Grid size={24} />
                    </div>
                    <div className="stat-details">
                        <div className="stat-value">{locations.length}</div>
                        <div className="stat-label">{t('warehousemap.vsego_yacheek', 'Всего ячеек')}</div>
                    </div>
                </div>
                <div className="stat-card">
                    <div className="stat-icon" style={{ background: '#70AD47' }}>
                        <Package size={24} />
                    </div>
                    <div className="stat-details">
                        <div className="stat-value">
                            {locations.filter(l => l.current_capacity > 0).length}
                        </div>
                        <div className="stat-label">{t('warehousemap.zanyato', 'Занято')}</div>
                    </div>
                </div>
                <div className="stat-card">
                    <div className="stat-icon" style={{ background: '#FFC000' }}>
                        <MapPin size={24} />
                    </div>
                    <div className="stat-details">
                        <div className="stat-value">
                            {Object.keys(groupedLocations).length}
                        </div>
                        <div className="stat-label">{t('warehousemap.zon', 'Зон')}</div>
                    </div>
                </div>
            </div>

            {/* Карта склада */}
            {Object.keys(groupedLocations).map(zone => (
                <div key={zone} className="card" style={{ marginBottom: '20px' }}>
                    <h3>Зона: {zone}</h3>
                    {Object.keys(groupedLocations[zone]).map(rack => (
                        <div key={rack} className="rack-container">
                            <h4>Стеллаж {rack}</h4>
                            <div className="cells-grid">
                                {groupedLocations[zone][rack]
                                    .sort((a, b) => {
                                        if (a.level !== b.level) return a.level - b.level;
                                        return a.cell.localeCompare(b.cell);
                                    })
                                    .map(location => {
                                        const percent = (location.current_capacity / location.capacity) * 100;
                                        return (
                                            <div
                                                key={location.id}
                                                className="cell-card"
                                                style={{
                                                    background: getOccupancyColor(percent),
                                                    color: getTextColor(percent),
                                                    cursor: 'pointer'
                                                }}
                                                onClick={() => setSelectedLocation(location)}
                                            >
                                                <div className="cell-header">
                                                    <strong>{location.barcode || location.cell}</strong>
                                                    <div className="cell-actions">
                                                        <button
                                                            className="icon-btn"
                                                            onClick={(e) => {
                                                                e.stopPropagation();
                                                                setSelectedLocation(location);
                                                                setFormData({
                                                                    zone: location.zone,
                                                                    rack: location.rack,
                                                                    level: location.level,
                                                                    cell: location.cell,
                                                                    capacity: location.capacity
                                                                });
                                                                setShowModal(true);
                                                            }}
                                                        >
                                                            <Edit2 size={14} />
                                                        </button>
                                                        <button
                                                            className="icon-btn"
                                                            onClick={(e) => {
                                                                e.stopPropagation();
                                                                deleteLocation(location.id);
                                                            }}
                                                        >
                                                            <Trash2 size={14} />
                                                        </button>
                                                    </div>
                                                </div>
                                                <div className="cell-info">
                                                    <div>Уровень: {location.level}</div>
                                                    <div>Загрузка: {getOccupancyText(location)}</div>
                                                    <div style={{ fontSize: '11px', opacity: 0.7 }}>
                                                        {location.current_capacity || 0} / {location.capacity}
                                                    </div>
                                                </div>
                                            </div>
                                        );
                                    })}
                            </div>
                        </div>
                    ))}
                </div>
            ))}

            {/* Модальное окно */}
            {showModal && (
                <div className="modal-overlay" onClick={() => setShowModal(false)}>
                    <div className="modal-content" onClick={e => e.stopPropagation()}>
                        <h2>{selectedLocation ? 'Редактировать' : 'Добавить'} ячейку</h2>
                        <form onSubmit={handleSubmit}>
                            <div className="form-row">
                                <div className="form-group">
                                    <label>{t('warehousemap.zona', 'Зона *')}</label>
                                    <input
                                        type="text"
                                        value={formData.zone}
                                        onChange={e => setFormData({ ...formData, zone: e.target.value })}
                                        placeholder="A, B, C..."
                                        required
                                    />
                                </div>
                                <div className="form-group">
                                    <label>{t('warehousemap.stellazh', 'Стеллаж *')}</label>
                                    <input
                                        type="text"
                                        value={formData.rack}
                                        onChange={e => setFormData({ ...formData, rack: e.target.value })}
                                        placeholder="01, 02..."
                                        required
                                    />
                                </div>
                            </div>

                            <div className="form-row">
                                <div className="form-group">
                                    <label>{t('warehousemap.uroven', 'Уровень *')}</label>
                                    <input
                                        type="number"
                                        value={formData.level}
                                        onChange={e => setFormData({ ...formData, level: e.target.value })}
                                        min="1"
                                        required
                                    />
                                </div>
                                <div className="form-group">
                                    <label>{t('warehousemap.yacheyka', 'Ячейка *')}</label>
                                    <input
                                        type="text"
                                        value={formData.cell}
                                        onChange={e => setFormData({ ...formData, cell: e.target.value })}
                                        placeholder="01, 02..."
                                        required
                                    />
                                </div>
                            </div>

                            <div className="form-group">
                                <label>{t('warehousemap.vmestimost_m_kg', 'Вместимость (м³/кг)')}</label>
                                <input
                                    type="number"
                                    value={formData.capacity}
                                    onChange={e => setFormData({ ...formData, capacity: e.target.value })}
                                    min="1"
                                />
                            </div>

                            <div className="modal-actions">
                                <button type="button" className="btn btn-secondary" onClick={() => setShowModal(false)}>
                                    Отмена
                                </button>
                                <button type="submit" className="btn btn-primary">
                                    {selectedLocation ? 'Сохранить' : 'Создать'}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            <style jsx>{`
                .rack-container {
                    margin: 20px 0;
                    padding: 16px;
                    background: var(--bg-tertiary);
                    border-radius: 8px;
                }

                .cells-grid {
                    display: grid;
                    grid-template-columns: repeat(auto-fill, minmax(150px, 1fr));
                    gap: 12px;
                    margin-top: 12px;
                }

                .cell-card {
                    border: 2px solid var(--border-color);
                    border-radius: 8px;
                    padding: 12px;
                    transition: all 0.2s;
                }

                .cell-card:hover {
                    transform: translateY(-2px);
                    box-shadow: 0 4px 12px rgba(0,0,0,0.1);
                }

                .cell-header {
                    display: flex;
                    justify-content: space-between;
                    align-items: center;
                    margin-bottom: 8px;
                }

                .cell-actions {
                    display: flex;
                    gap: 4px;
                }

                .icon-btn {
                    background: rgba(0,0,0,0.1);
                    border: none;
                    border-radius: 4px;
                    padding: 4px;
                    cursor: pointer;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                }

                .icon-btn:hover {
                    background: rgba(0,0,0,0.2);
                }

                .cell-info {
                    font-size: 13px;
                }

                .cell-info div {
                    margin: 4px 0;
                }

                .form-row {
                    display: grid;
                    grid-template-columns: 1fr 1fr;
                    gap: 16px;
                }
            `}</style>
        </div>
    );
};

export default WarehouseMap;
