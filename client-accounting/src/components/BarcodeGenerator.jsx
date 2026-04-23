import React, { useRef, useEffect, useState } from 'react';
import { useReactToPrint } from 'react-to-print';
import JsBarcode from 'jsbarcode';
import QRCode from 'qrcode';
import { Printer, X, Download, QrCode, Barcode } from 'lucide-react';

/**
 * BarcodeGenerator - компонент для генерации и печати штрихкодов
 * Поддерживает: EAN-13, EAN-8, Code128, QR-код
 * Печать: обычные принтеры (A4), термопринтеры (57mm, 80mm)
 */
function BarcodeGenerator({ product, onClose, isOpen }) {
    const printRef = useRef();
    const barcodeRef = useRef();
    const qrRef = useRef();

    const [barcodeType, setBarcodeType] = useState('CODE128');
    const [labelSize, setLabelSize] = useState('thermal57'); // thermal57, thermal80, a4
    const [showPrice, setShowPrice] = useState(true);
    const [showName, setShowName] = useState(true);
    const [copies, setCopies] = useState(1);
    const [qrDataUrl, setQrDataUrl] = useState('');
    const [barcodeDataUrl, setBarcodeDataUrl] = useState('');

    // Размеры этикеток
    const labelSizes = {
        thermal30x20: { width: '30mm', height: '20mm', name: 'Термо 30×20мм' },
        thermal40x25: { width: '40mm', height: '25mm', name: 'Термо 40×25мм' },
        thermal40x30: { width: '40mm', height: '30mm', name: 'Термо 40×30мм' },
        thermal43x25: { width: '43mm', height: '25mm', name: 'Термо 43×25мм' },
        thermal47x25: { width: '47mm', height: '25mm', name: 'Термо 47×25мм' },
        thermal57: { width: '57mm', height: '30mm', name: 'Термо 57×30мм' },
        thermal57x40: { width: '57mm', height: '40mm', name: 'Термо 57×40мм' },
        thermal58x30: { width: '58mm', height: '30mm', name: 'Термо 58×30мм' },
        thermal58x40: { width: '58mm', height: '40mm', name: 'Термо 58×40мм' },
        thermal60x40: { width: '60mm', height: '40mm', name: 'Термо 60×40мм' },
        thermal60x60: { width: '60mm', height: '60mm', name: 'Термо 60×60мм' },
        thermal80: { width: '80mm', height: '40mm', name: 'Термо 80×40мм' },
        thermal80x50: { width: '80mm', height: '50mm', name: 'Термо 80×50мм' },
        thermal80x60: { width: '80mm', height: '60mm', name: 'Термо 80×60мм' },
        thermal100x50: { width: '100mm', height: '50mm', name: 'Термо 100×50мм' },
        thermal100x70: { width: '100mm', height: '70mm', name: 'Термо 100×70мм' },
        thermal100x150: { width: '100mm', height: '150mm', name: 'Термо 100×150мм (доставка)' },
        a4: { width: '57mm', height: '30mm', name: 'A4 (57×30мм сетка)' },
        a4_landscape: { width: '70mm', height: '42mm', name: 'A4 (70×42мм сетка)' }
    };

    // Генерация штрихкода как Data URL
    useEffect(() => {
        if (product?.barcode || product?.code) {
            const canvas = document.createElement('canvas');
            try {
                JsBarcode(canvas, product.barcode || product.code, {
                    format: barcodeType,
                    width: 2,
                    height: 50,
                    displayValue: true,
                    fontSize: 12,
                    margin: 5,
                    background: '#ffffff',
                    lineColor: '#000000'
                });
                setBarcodeDataUrl(canvas.toDataURL('image/png'));
            } catch (error) {
                console.error('Ошибка генерации штрихкода:', error);
                // Fallback to CODE128 if format fails
                try {
                    JsBarcode(canvas, product.barcode || product.code, {
                        format: 'CODE128',
                        width: 2,
                        height: 50,
                        displayValue: true,
                        fontSize: 12,
                        margin: 5
                    });
                    setBarcodeDataUrl(canvas.toDataURL('image/png'));
                } catch (e) {
                    console.error('Fallback также не удался:', e);
                    setBarcodeDataUrl('');
                }
            }
        }
    }, [product, barcodeType]);

    // Генерация QR-кода
    useEffect(() => {
        if (product) {
            const qrData = JSON.stringify({
                code: product.code,
                name: product.name,
                price: product.price_sale || product.price_retail || 0,
                barcode: product.barcode
            });

            QRCode.toDataURL(qrData, {
                width: 100,
                margin: 1,
                color: { dark: '#000000', light: '#ffffff' }
            }).then(url => {
                setQrDataUrl(url);
            }).catch(err => console.error('QR Error:', err));
        }
    }, [product]);

    // Размер этикетки для печати (всегда 57x30mm для A4)
    const getLabelSizeForPrint = () => {
        return { width: '57mm', height: '30mm' };
    };

    // Печать
    const handlePrint = useReactToPrint({
        contentRef: printRef,
        documentTitle: `Этикетка_${product?.code}`,
        pageStyle: `
            @page {
                size: ${labelSize === 'a4' ? 'A4 portrait' : labelSizes[labelSize].width + ' ' + labelSizes[labelSize].height};
                margin: ${labelSize === 'a4' ? '5mm' : '0'};
            }
            @media print {
                html, body {
                    margin: 0 !important;
                    padding: 0 !important;
                    -webkit-print-color-adjust: exact !important;
                    print-color-adjust: exact !important;
                }
                .print-wrapper {
                    display: flex !important;
                    flex-wrap: wrap !important;
                    gap: 2mm !important;
                    justify-content: flex-start !important;
                    align-content: flex-start !important;
                }
                .label-container {
                    width: 57mm !important;
                    height: 30mm !important;
                    page-break-inside: avoid !important;
                    break-inside: avoid !important;
                    box-sizing: border-box !important;
                }
            }
        `
    });

    // Экспорт как PNG
    const handleExportPng = () => {
        if (barcodeDataUrl) {
            const link = document.createElement('a');
            link.download = `barcode_${product?.code}.png`;
            link.href = barcodeDataUrl;
            link.click();
        }
    };

    if (!isOpen || !product) return null;

    const currentSize = labelSizes[labelSize];

    return (
        <div className="modal-overlay" onClick={onClose}>
            <div className="modal glass" onClick={e => e.stopPropagation()} style={{ maxWidth: '600px' }}>
                <div className="modal-header">
                    <h2>🏷️ Печать штрихкода</h2>
                    <button onClick={onClose} className="btn-close">
                        <X size={20} />
                    </button>
                </div>

                <div className="modal-body">
                    {/* Настройки */}
                    <div className="grid grid-2" style={{ gap: '15px', marginBottom: '20px' }}>
                        <div className="form-group">
                            <label>Тип штрихкода</label>
                            <select
                                value={barcodeType}
                                onChange={e => setBarcodeType(e.target.value)}
                            >
                                <option value="CODE128">Code 128 (универсальный)</option>
                                <option value="EAN13">EAN-13 (13 цифр)</option>
                                <option value="EAN8">EAN-8 (8 цифр)</option>
                                <option value="UPC">UPC (12 цифр)</option>
                            </select>
                        </div>
                        <div className="form-group">
                            <label>Размер этикетки</label>
                            <select
                                value={labelSize}
                                onChange={e => setLabelSize(e.target.value)}
                            >
                                {Object.entries(labelSizes).map(([key, val]) => (
                                    <option key={key} value={key}>{val.name}</option>
                                ))}
                            </select>
                        </div>
                    </div>

                    <div className="grid grid-3" style={{ gap: '15px', marginBottom: '20px' }}>
                        <div className="form-group">
                            <label style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                <input
                                    type="checkbox"
                                    checked={showPrice}
                                    onChange={e => setShowPrice(e.target.checked)}
                                />
                                Показать цену
                            </label>
                        </div>
                        <div className="form-group">
                            <label style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                <input
                                    type="checkbox"
                                    checked={showName}
                                    onChange={e => setShowName(e.target.checked)}
                                />
                                Показать название
                            </label>
                        </div>
                        <div className="form-group">
                            <label>Копий</label>
                            <input
                                type="number"
                                min="1"
                                max="100"
                                value={copies}
                                onChange={e => setCopies(parseInt(e.target.value) || 1)}
                            />
                        </div>
                    </div>

                    {/* Предпросмотр */}
                    <div style={{
                        background: '#f5f5f5',
                        padding: '20px',
                        borderRadius: '8px',
                        display: 'flex',
                        justifyContent: 'center',
                        marginBottom: '20px',
                        overflowY: 'auto',
                        maxHeight: '400px'
                    }}>
                        <div ref={printRef} className="print-wrapper" style={{
                            display: 'flex',
                            flexWrap: 'wrap',
                            gap: '10px',
                            justifyContent: 'center'
                        }}>
                            {[...Array(copies)].map((_, i) => (
                                <div
                                    key={i}
                                    className="label-container"
                                    style={{
                                        width: currentSize.width,
                                        minHeight: currentSize.height,
                                        background: 'white',
                                        padding: '5px',
                                        boxSizing: 'border-box',
                                        display: 'flex',
                                        flexDirection: 'column',
                                        alignItems: 'center',
                                        justifyContent: 'center',
                                        border: '1px dashed #ccc'
                                    }}
                                >
                                    {showName && (
                                        <div style={{
                                            fontSize: '10px',
                                            fontWeight: 'bold',
                                            textAlign: 'center',
                                            maxWidth: '100%',
                                            overflow: 'hidden',
                                            textOverflow: 'ellipsis',
                                            whiteSpace: 'nowrap',
                                            marginBottom: '3px',
                                            color: '#000'
                                        }}>
                                            {product.name}
                                        </div>
                                    )}

                                    {barcodeDataUrl && (
                                        <img
                                            src={barcodeDataUrl}
                                            alt="Barcode"
                                            style={{ maxWidth: '100%', height: 'auto' }}
                                        />
                                    )}

                                    {showPrice && (
                                        <div style={{
                                            fontSize: '14px',
                                            fontWeight: 'bold',
                                            marginTop: '3px',
                                            color: '#000'
                                        }}>
                                            {new Intl.NumberFormat('ru-RU').format(product.price_sale || product.price_retail || 0)} сум
                                        </div>
                                    )}
                                </div>
                            ))}
                        </div>
                    </div>

                    {/* QR-код секция */}
                    <div style={{
                        background: '#f0f8ff',
                        padding: '15px',
                        borderRadius: '8px',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '15px'
                    }}>
                        <QrCode size={24} />
                        <div style={{ flex: 1 }}>
                            <strong>QR-код товара</strong>
                            <p style={{ fontSize: '12px', color: '#666', margin: 0 }}>
                                Содержит: код, название, цену
                            </p>
                        </div>
                        {qrDataUrl && (
                            <img src={qrDataUrl} alt="QR Code" style={{ width: '60px', height: '60px' }} />
                        )}
                    </div>
                </div>

                <div className="modal-footer">
                    <button
                        type="button"
                        className="btn btn-secondary"
                        onClick={handleExportPng}
                    >
                        <Download size={16} /> PNG
                    </button>
                    <button
                        type="button"
                        className="btn btn-primary"
                        onClick={handlePrint}
                    >
                        <Printer size={16} /> Печать
                    </button>
                </div>
            </div>
        </div>
    );
}

export default BarcodeGenerator;
