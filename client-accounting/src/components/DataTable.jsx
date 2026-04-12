/**
 * DataTable - компонент таблицы данных
 * С сортировкой, поиском, пагинацией
 */

import React, { useState, useMemo } from 'react';
import { ChevronUp, ChevronDown, Search, ChevronLeft, ChevronRight } from 'lucide-react';

export function DataTable({
    data = [],
    columns = [],
    pageSize = 10,
    searchable = true,
    sortable = true,
    onRowClick = null,
    emptyMessage = 'Нет данных',
    loading = false
}) {
    const [search, setSearch] = useState('');
    const [sortConfig, setSortConfig] = useState({ key: null, direction: 'asc' });
    const [currentPage, setCurrentPage] = useState(1);

    // Фильтрация по поиску
    const filteredData = useMemo(() => {
        if (!search.trim()) return data;

        const searchLower = search.toLowerCase();
        return data.filter(row =>
            columns.some(col => {
                const value = row[col.key];
                return value?.toString().toLowerCase().includes(searchLower);
            })
        );
    }, [data, search, columns]);

    // Сортировка
    const sortedData = useMemo(() => {
        if (!sortConfig.key) return filteredData;

        return [...filteredData].sort((a, b) => {
            const aVal = a[sortConfig.key];
            const bVal = b[sortConfig.key];

            if (aVal === null || aVal === undefined) return 1;
            if (bVal === null || bVal === undefined) return -1;

            const comparison = aVal < bVal ? -1 : aVal > bVal ? 1 : 0;
            return sortConfig.direction === 'asc' ? comparison : -comparison;
        });
    }, [filteredData, sortConfig]);

    // Пагинация
    const totalPages = Math.ceil(sortedData.length / pageSize);
    const paginatedData = useMemo(() => {
        const start = (currentPage - 1) * pageSize;
        return sortedData.slice(start, start + pageSize);
    }, [sortedData, currentPage, pageSize]);

    // Обработка сортировки
    const handleSort = (key) => {
        if (!sortable) return;
        setSortConfig(prev => ({
            key,
            direction: prev.key === key && prev.direction === 'asc' ? 'desc' : 'asc'
        }));
    };

    // Сброс на первую страницу при поиске
    React.useEffect(() => {
        setCurrentPage(1);
    }, [search]);

    return (
        <div style={{ background: '#1e1e3f', borderRadius: '16px', overflow: 'hidden' }}>
            {/* Search */}
            {searchable && (
                <div style={{ padding: '16px', borderBottom: '1px solid rgba(255,255,255,0.1)' }}>
                    <div style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '10px',
                        background: 'rgba(255,255,255,0.05)',
                        borderRadius: '10px',
                        padding: '10px 16px'
                    }}>
                        <Search size={18} color="#6366f1" />
                        <input
                            type="text"
                            placeholder="Поиск..."
                            value={search}
                            onChange={(e) => setSearch(e.target.value)}
                            style={{
                                background: 'transparent',
                                border: 'none',
                                outline: 'none',
                                color: 'white',
                                fontSize: '14px',
                                width: '100%'
                            }}
                        />
                    </div>
                </div>
            )}

            {/* Table */}
            <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                    <thead>
                        <tr>
                            {columns.map(col => (
                                <th
                                    key={col.key}
                                    onClick={() => handleSort(col.key)}
                                    style={{
                                        padding: '14px 16px',
                                        textAlign: 'left',
                                        color: '#a0aec0',
                                        fontWeight: 600,
                                        fontSize: '12px',
                                        textTransform: 'uppercase',
                                        letterSpacing: '0.5px',
                                        borderBottom: '1px solid rgba(255,255,255,0.1)',
                                        cursor: sortable ? 'pointer' : 'default',
                                        userSelect: 'none',
                                        whiteSpace: 'nowrap'
                                    }}
                                >
                                    <span style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                                        {col.label}
                                        {sortable && sortConfig.key === col.key && (
                                            sortConfig.direction === 'asc'
                                                ? <ChevronUp size={14} />
                                                : <ChevronDown size={14} />
                                        )}
                                    </span>
                                </th>
                            ))}
                        </tr>
                    </thead>
                    <tbody>
                        {loading ? (
                            <tr>
                                <td colSpan={columns.length} style={{ padding: '40px', textAlign: 'center', color: '#a0aec0' }}>
                                    Загрузка...
                                </td>
                            </tr>
                        ) : paginatedData.length === 0 ? (
                            <tr>
                                <td colSpan={columns.length} style={{ padding: '40px', textAlign: 'center', color: '#a0aec0' }}>
                                    {emptyMessage}
                                </td>
                            </tr>
                        ) : (
                            paginatedData.map((row, idx) => (
                                <tr
                                    key={row.id || idx}
                                    onClick={() => onRowClick?.(row)}
                                    style={{
                                        cursor: onRowClick ? 'pointer' : 'default',
                                        borderBottom: '1px solid rgba(255,255,255,0.05)',
                                        transition: 'background 0.2s'
                                    }}
                                    onMouseOver={(e) => e.currentTarget.style.background = 'rgba(99, 102, 241, 0.1)'}
                                    onMouseOut={(e) => e.currentTarget.style.background = 'transparent'}
                                >
                                    {columns.map(col => (
                                        <td
                                            key={col.key}
                                            style={{
                                                padding: '14px 16px',
                                                color: 'white',
                                                fontSize: '14px'
                                            }}
                                        >
                                            {col.render ? col.render(row[col.key], row) : row[col.key]}
                                        </td>
                                    ))}
                                </tr>
                            ))
                        )}
                    </tbody>
                </table>
            </div>

            {/* Pagination */}
            {totalPages > 1 && (
                <div style={{
                    padding: '16px',
                    borderTop: '1px solid rgba(255,255,255,0.1)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between'
                }}>
                    <span style={{ color: '#a0aec0', fontSize: '14px' }}>
                        Показано {(currentPage - 1) * pageSize + 1} - {Math.min(currentPage * pageSize, sortedData.length)} из {sortedData.length}
                    </span>
                    <div style={{ display: 'flex', gap: '8px' }}>
                        <button
                            onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                            disabled={currentPage === 1}
                            style={{
                                padding: '8px 12px',
                                borderRadius: '8px',
                                border: 'none',
                                background: currentPage === 1 ? 'rgba(255,255,255,0.05)' : 'rgba(99, 102, 241, 0.2)',
                                color: currentPage === 1 ? '#666' : '#6366f1',
                                cursor: currentPage === 1 ? 'not-allowed' : 'pointer',
                                display: 'flex',
                                alignItems: 'center'
                            }}
                        >
                            <ChevronLeft size={18} />
                        </button>
                        <span style={{
                            padding: '8px 16px',
                            background: 'rgba(99, 102, 241, 0.2)',
                            borderRadius: '8px',
                            color: '#6366f1',
                            fontWeight: 600
                        }}>
                            {currentPage} / {totalPages}
                        </span>
                        <button
                            onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                            disabled={currentPage === totalPages}
                            style={{
                                padding: '8px 12px',
                                borderRadius: '8px',
                                border: 'none',
                                background: currentPage === totalPages ? 'rgba(255,255,255,0.05)' : 'rgba(99, 102, 241, 0.2)',
                                color: currentPage === totalPages ? '#666' : '#6366f1',
                                cursor: currentPage === totalPages ? 'not-allowed' : 'pointer',
                                display: 'flex',
                                alignItems: 'center'
                            }}
                        >
                            <ChevronRight size={18} />
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
}

export default DataTable;
