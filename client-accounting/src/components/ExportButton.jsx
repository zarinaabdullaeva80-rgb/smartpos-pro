import React, { useState, useRef, useEffect } from 'react';
import * as XLSX from 'xlsx';
import { Download, FileSpreadsheet, FileText, FileJson, FolderOpen } from 'lucide-react';
import { useToast } from '../components/ToastProvider';

/**
 * Универсальная кнопка экспорта данных в Excel/CSV/JSON
 * @param {Array} data - Массив данных для экспорта
 * @param {string} filename - Имя файла без расширения
 * @param {string} sheetName - Имя листа Excel
 * @param {Object} columns - Маппинг колонок {key: label} для красивых заголовков
 * @param {string} folder - Папка для сохранения (products, sales, etc.)
 */
const ExportButton = ({
    data,
    filename = 'export',
    sheetName = 'Данные',
    columns = null,
    disabled = false,
    folder = 'exports'  // Папка по умолчанию
}) => {
    const toast = useToast();
    const [isOpen, setIsOpen] = useState(false);
    const [lastSavedPath, setLastSavedPath] = useState(null);
    const menuRef = useRef(null);

    // Закрытие меню при клике вне него
    useEffect(() => {
        const handleClickOutside = (event) => {
            if (menuRef.current && !menuRef.current.contains(event.target)) {
                setIsOpen(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    // Преобразует данные с красивыми заголовками
    const prepareData = () => {
        if (!data || data.length === 0) return [];

        if (!columns) return data;

        return data.map(row => {
            const newRow = {};
            Object.entries(columns).forEach(([key, label]) => {
                newRow[label] = row[key] ?? '';
            });
            return newRow;
        });
    };

    // Генерирует имя файла с датой
    const getFilenameWithDate = (extension) => {
        const date = new Date().toISOString().split('T')[0];
        return `${filename}_${date}.${extension}`;
    };

    // Сохраняет файл через Electron IPC или fallback
    const saveFile = async (content, extension, mimeType) => {
        const fullFilename = getFilenameWithDate(extension);

        // Проверяем наличие Electron API
        if (window.electron && window.electron.saveFile) {
            try {
                // Для бинарных файлов используем base64
                let fileData = content;
                let encoding = 'utf8';

                if (content instanceof ArrayBuffer || content instanceof Uint8Array) {
                    // Конвертируем ArrayBuffer в base64
                    const bytes = new Uint8Array(content);
                    let binary = '';
                    for (let i = 0; i < bytes.byteLength; i++) {
                        binary += String.fromCharCode(bytes[i]);
                    }
                    fileData = btoa(binary);
                    encoding = 'base64';
                }

                const result = await window.electron.saveFile({
                    folder: folder,
                    filename: fullFilename,
                    data: fileData,
                    encoding: encoding
                });

                if (result.success) {
                    setLastSavedPath(result.path);
                    const openFolder = confirm(`Файл сохранён:\n${result.path}\n\nОткрыть папку?`);
                    if (openFolder) {
                        const folderPath = result.path.substring(0, result.path.lastIndexOf('\\'));
                        window.electron.openFolder(folderPath);
                    }
                    return true;
                } else {
                    toast.error(`Ошибка сохранения: ${result.error}`);
                    return false;
                }
            } catch (error) {
                console.error('Electron save error:', error);
                // Fallback to browser download
            }
        }

        // Fallback: браузерная загрузка
        const blob = new Blob([content], { type: mimeType });
        const link = document.createElement('a');
        link.href = URL.createObjectURL(blob);
        link.download = fullFilename;
        link.click();
        URL.revokeObjectURL(link.href);
        return true;
    };

    const exportToExcel = async () => {
        try {
            const exportData = prepareData();
            if (exportData.length === 0) {
                toast.info('Нет данных для экспорта');
                return;
            }

            const worksheet = XLSX.utils.json_to_sheet(exportData);
            const workbook = XLSX.utils.book_new();

            // Auto-size columns
            const colWidths = Object.keys(exportData[0]).map(key => ({
                wch: Math.max(key.length, ...exportData.map(row => String(row[key] || '').length))
            }));
            worksheet['!cols'] = colWidths;

            XLSX.utils.book_append_sheet(workbook, worksheet, sheetName);

            // Получаем файл как ArrayBuffer
            const excelBuffer = XLSX.write(workbook, { bookType: 'xlsx', type: 'array' });

            await saveFile(
                excelBuffer,
                'xlsx',
                'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
            );
            setIsOpen(false);
        } catch (error) {
            console.error('Ошибка экспорта Excel:', error);
            toast.info('Ошибка экспорта Excel: ' + error.message);
        }
    };

    const exportToCSV = async () => {
        try {
            const exportData = prepareData();
            if (exportData.length === 0) {
                toast.info('Нет данных для экспорта');
                return;
            }

            const worksheet = XLSX.utils.json_to_sheet(exportData);
            const csv = XLSX.utils.sheet_to_csv(worksheet);

            // Добавляем BOM для корректного отображения кириллицы
            const csvWithBom = '\ufeff' + csv;

            await saveFile(csvWithBom, 'csv', 'text/csv;charset=utf-8;');
            setIsOpen(false);
        } catch (error) {
            console.error('Ошибка экспорта CSV:', error);
            toast.info('Ошибка экспорта CSV: ' + error.message);
        }
    };

    const exportToJSON = async () => {
        try {
            const exportData = prepareData();
            if (exportData.length === 0) {
                toast.info('Нет данных для экспорта');
                return;
            }

            const json = JSON.stringify(exportData, null, 2);

            await saveFile(json, 'json', 'application/json');
            setIsOpen(false);
        } catch (error) {
            console.error('Ошибка экспорта JSON:', error);
            toast.info('Ошибка экспорта JSON: ' + error.message);
        }
    };

    const openLastFolder = () => {
        if (lastSavedPath && window.electron && window.electron.openFolder) {
            const folderPath = lastSavedPath.substring(0, lastSavedPath.lastIndexOf('\\'));
            window.electron.openFolder(folderPath);
        }
    };

    const isDisabled = disabled || !data || data.length === 0;

    return (
        <div className="export-button-container" ref={menuRef} style={{ position: 'relative' }}>
            <button
                className="btn btn-secondary"
                onClick={() => setIsOpen(!isOpen)}
                disabled={isDisabled}
                style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px',
                    padding: '8px 14px',
                    borderColor: '#22c55e',
                    color: '#22c55e',
                    background: 'transparent',
                    opacity: isDisabled ? 0.5 : 1,
                    cursor: isDisabled ? 'not-allowed' : 'pointer'
                }}
            >
                <Download size={18} />
                Экспорт
            </button>

            {isOpen && (
                <div
                    className="export-menu"
                    style={{
                        position: 'absolute',
                        top: '100%',
                        left: 0,
                        marginTop: '4px',
                        minWidth: '200px',
                        background: '#1e293b',
                        borderRadius: '8px',
                        boxShadow: '0 8px 24px rgba(0,0,0,0.4)',
                        border: '1px solid #334155',
                        zIndex: 1000,
                        overflow: 'hidden'
                    }}
                >
                    <button
                        onClick={exportToExcel}
                        style={{
                            width: '100%',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '10px',
                            padding: '12px 16px',
                            background: 'transparent',
                            border: 'none',
                            color: '#e2e8f0',
                            cursor: 'pointer',
                            textAlign: 'left',
                            fontSize: '14px'
                        }}
                        onMouseEnter={(e) => e.target.style.background = '#334155'}
                        onMouseLeave={(e) => e.target.style.background = 'transparent'}
                    >
                        <FileSpreadsheet size={18} color="#22c55e" />
                        Excel (.xlsx)
                    </button>
                    <button
                        onClick={exportToCSV}
                        style={{
                            width: '100%',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '10px',
                            padding: '12px 16px',
                            background: 'transparent',
                            border: 'none',
                            color: '#e2e8f0',
                            cursor: 'pointer',
                            textAlign: 'left',
                            fontSize: '14px'
                        }}
                        onMouseEnter={(e) => e.target.style.background = '#334155'}
                        onMouseLeave={(e) => e.target.style.background = 'transparent'}
                    >
                        <FileText size={18} color="#3b82f6" />
                        CSV (.csv)
                    </button>
                    <button
                        onClick={exportToJSON}
                        style={{
                            width: '100%',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '10px',
                            padding: '12px 16px',
                            background: 'transparent',
                            border: 'none',
                            color: '#e2e8f0',
                            cursor: 'pointer',
                            textAlign: 'left',
                            fontSize: '14px'
                        }}
                        onMouseEnter={(e) => e.target.style.background = '#334155'}
                        onMouseLeave={(e) => e.target.style.background = 'transparent'}
                    >
                        <FileJson size={18} color="#f59e0b" />
                        JSON (.json)
                    </button>

                    {lastSavedPath && (
                        <>
                            <div style={{ borderTop: '1px solid #334155', margin: '4px 0' }} />
                            <button
                                onClick={openLastFolder}
                                style={{
                                    width: '100%',
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: '10px',
                                    padding: '12px 16px',
                                    background: 'transparent',
                                    border: 'none',
                                    color: '#94a3b8',
                                    cursor: 'pointer',
                                    textAlign: 'left',
                                    fontSize: '13px'
                                }}
                                onMouseEnter={(e) => e.target.style.background = '#334155'}
                                onMouseLeave={(e) => e.target.style.background = 'transparent'}
                            >
                                <FolderOpen size={16} color="#94a3b8" />
                                Открыть папку экспорта
                            </button>
                        </>
                    )}
                </div>
            )}
        </div>
    );
};

export default ExportButton;
