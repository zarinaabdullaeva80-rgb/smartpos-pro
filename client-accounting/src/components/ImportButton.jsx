import React, { useRef, useState } from 'react';
import * as XLSX from 'xlsx';
import { Upload, AlertCircle, CheckCircle } from 'lucide-react';

/**
 * ImportButton - Component for importing data from Excel files
 * 
 * @param {Function} onImport - Callback with imported data array
 * @param {Function} validateRow - Optional row validation function
 * @param {String} acceptedColumns - Array of expected column names
 * @param {String} buttonText - Button label
 */
function ImportButton({ onImport, validateRow, acceptedColumns, buttonText = 'Импорт из Excel' }) {
    const fileInputRef = useRef(null);
    const [importing, setImporting] = useState(false);
    const [error, setError] = useState(null);
    const [success, setSuccess] = useState(false);

    const handleFileSelect = async (event) => {
        const file = event.target.files[0];
        if (!file) return;

        setImporting(true);
        setError(null);
        setSuccess(false);

        try {
            const data = await parseExcelFile(file);

            if (data.length === 0) {
                throw new Error('Файл пуст или не содержит данных');
            }

            // Validate data if validator provided
            if (validateRow) {
                const errors = [];
                data.forEach((row, index) => {
                    const validation = validateRow(row, index);
                    if (!validation.valid) {
                        errors.push(`Строка ${index + 2}: ${validation.error}`);
                    }
                });

                if (errors.length > 0) {
                    throw new Error(`Ошибки валидации:\n${errors.slice(0, 5).join('\n')}${errors.length > 5 ? `\n...и ещё ${errors.length - 5}` : ''}`);
                }
            }

            // Call import callback
            await onImport(data);
            setSuccess(true);
            setTimeout(() => setSuccess(false), 3000);

        } catch (err) {
            console.error('Import error:', err);
            setError(err.message || 'Ошибка импорта файла');
        } finally {
            setImporting(false);
            // Reset file input
            event.target.value = '';
        }
    };

    const parseExcelFile = (file) => {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();

            reader.onload = (e) => {
                try {
                    const data = new Uint8Array(e.target.result);
                    const workbook = XLSX.read(data, { type: 'array' });

                    // Get first sheet
                    const sheetName = workbook.SheetNames[0];
                    const worksheet = workbook.Sheets[sheetName];

                    // Convert to JSON
                    const jsonData = XLSX.utils.sheet_to_json(worksheet, {
                        raw: false, // Keep as strings
                        defval: '' // Default value for empty cells
                    });

                    resolve(jsonData);
                } catch (error) {
                    reject(new Error('Не удалось прочитать Excel файл'));
                }
            };

            reader.onerror = () => reject(new Error('Ошибка чтения файла'));
            reader.readAsArrayBuffer(file);
        });
    };

    return (
        <div style={{ display: 'inline-block', position: 'relative' }}>
            <input
                ref={fileInputRef}
                type="file"
                accept=".xlsx,.xls"
                onChange={handleFileSelect}
                style={{ display: 'none' }}
            />

            <button
                className="btn btn-success"
                onClick={() => fileInputRef.current?.click()}
                disabled={importing}
                title="Импортировать данные из Excel"
            >
                <Upload size={18} />
                {importing ? 'Импорт...' : buttonText}
            </button>

            {error && (
                <div style={{
                    position: 'absolute',
                    top: '100%',
                    left: 0,
                    marginTop: '8px',
                    padding: '12px',
                    backgroundColor: '#f44336',
                    color: 'white',
                    borderRadius: '4px',
                    maxWidth: '400px',
                    zIndex: 1000,
                    whiteSpace: 'pre-wrap',
                    fontSize: '13px'
                }}>
                    <AlertCircle size={16} style={{ marginRight: '8px', verticalAlign: 'middle' }} />
                    {error}
                </div>
            )}

            {success && (
                <div style={{
                    position: 'absolute',
                    top: '100%',
                    left: 0,
                    marginTop: '8px',
                    padding: '12px',
                    backgroundColor: '#4caf50',
                    color: 'white',
                    borderRadius: '4px',
                    zIndex: 1000
                }}>
                    <CheckCircle size={16} style={{ marginRight: '8px', verticalAlign: 'middle' }} />
                    Импорт завершён успешно!
                </div>
            )}
        </div>
    );
}

export default ImportButton;
