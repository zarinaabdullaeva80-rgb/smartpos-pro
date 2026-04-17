import React, { useState, useRef, useEffect } from 'react';
import { Search, Package, Plus } from 'lucide-react';

/**
 * ProductSearchInput — autocomplete-поиск товаров
 * Показывает dropdown с ценой и остатком при вводе текста.
 * При клике на товар — вызывает onSelect(product).
 */
function ProductSearchInput({ products, onSelect, placeholder, warehouseId }) {
    const [query, setQuery] = useState('');
    const [open, setOpen] = useState(false);
    const [highlightIndex, setHighlightIndex] = useState(-1);
    const inputRef = useRef(null);
    const dropdownRef = useRef(null);

    // Фильтрация товаров
    const filtered = query.trim().length > 0
        ? products.filter(p => {
            const q = query.toLowerCase();
            return (
                (p.name && p.name.toLowerCase().includes(q)) ||
                (p.code && p.code.toLowerCase().includes(q)) ||
                (p.barcode && p.barcode.toLowerCase().includes(q))
            );
        }).slice(0, 15)
        : products.slice(0, 20); // показать первые 20 при пустом поиске

    // Закрыть dropdown при клике вне
    useEffect(() => {
        const handleClickOutside = (e) => {
            if (
                dropdownRef.current && !dropdownRef.current.contains(e.target) &&
                inputRef.current && !inputRef.current.contains(e.target)
            ) {
                setOpen(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    // Сброс highlight при смене фильтра
    useEffect(() => {
        setHighlightIndex(-1);
    }, [query]);

    const handleKeyDown = (e) => {
        if (!open) return;

        if (e.key === 'ArrowDown') {
            e.preventDefault();
            setHighlightIndex(prev => Math.min(prev + 1, filtered.length - 1));
        } else if (e.key === 'ArrowUp') {
            e.preventDefault();
            setHighlightIndex(prev => Math.max(prev - 1, 0));
        } else if (e.key === 'Enter') {
            e.preventDefault();
            if (highlightIndex >= 0 && filtered[highlightIndex]) {
                handleSelect(filtered[highlightIndex]);
            }
        } else if (e.key === 'Escape') {
            setOpen(false);
        }
    };

    const handleSelect = (product) => {
        onSelect(product);
        setQuery('');
        setOpen(false);
        // Re-focus для следующего ввода
        setTimeout(() => inputRef.current?.focus(), 50);
    };

    const getStock = (product) => {
        // Попробовать найти остаток
        const qty = product.available_quantity ?? product.quantity ?? product.stock ?? null;
        return qty;
    };

    const formatPrice = (val) => {
        if (!val && val !== 0) return '—';
        return Math.round(val).toLocaleString('ru-RU');
    };

    return (
        <div style={{ position: 'relative' }}>
            <div style={{ position: 'relative' }}>
                <Search
                    size={16}
                    style={{
                        position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)',
                        color: 'var(--text-muted)', pointerEvents: 'none', zIndex: 1
                    }}
                />
                <input
                    ref={inputRef}
                    type="text"
                    value={query}
                    onChange={e => { setQuery(e.target.value); setOpen(true); }}
                    onFocus={() => setOpen(true)}
                    onKeyDown={handleKeyDown}
                    placeholder={placeholder || '🔍 Поиск товара по названию, коду или штрихкоду...'}
                    autoComplete="off"
                    style={{
                        width: '100%',
                        paddingLeft: '34px',
                        height: '38px',
                        fontSize: '14px',
                        borderRadius: '8px',
                        border: '1.5px solid var(--border-color, #d1d5db)',
                        background: 'var(--bg-primary, #fff)',
                        color: 'var(--text-primary, #1e293b)',
                        outline: 'none',
                        transition: 'border-color 0.2s',
                    }}
                />
            </div>

            {open && filtered.length > 0 && (
                <div
                    ref={dropdownRef}
                    style={{
                        position: 'absolute',
                        top: '100%', left: 0, right: 0,
                        zIndex: 1000,
                        background: 'var(--bg-primary, #fff)',
                        border: '1px solid var(--border-color, #e2e8f0)',
                        borderRadius: '10px',
                        boxShadow: '0 8px 32px rgba(0,0,0,0.15)',
                        maxHeight: '320px',
                        overflowY: 'auto',
                        marginTop: '4px',
                    }}
                >
                    {filtered.map((product, idx) => {
                        const stock = getStock(product);
                        const isLow = stock !== null && stock <= 0;
                        const isHighlighted = idx === highlightIndex;

                        return (
                            <div
                                key={product.id}
                                onClick={() => handleSelect(product)}
                                onMouseEnter={() => setHighlightIndex(idx)}
                                style={{
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: '10px',
                                    padding: '8px 12px',
                                    cursor: 'pointer',
                                    background: isHighlighted ? 'var(--bg-hover, #f1f5f9)' : 'transparent',
                                    borderBottom: idx < filtered.length - 1 ? '1px solid var(--border-color, #f1f5f9)' : 'none',
                                    transition: 'background 0.1s',
                                    opacity: isLow ? 0.5 : 1,
                                }}
                            >
                                {/* Иконка */}
                                <div style={{
                                    width: '32px', height: '32px', borderRadius: '8px',
                                    background: 'var(--bg-secondary, #f1f5f9)',
                                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                                    flexShrink: 0,
                                }}>
                                    <Package size={16} style={{ color: 'var(--text-muted, #94a3b8)' }} />
                                </div>

                                {/* Название + код */}
                                <div style={{ flex: 1, minWidth: 0 }}>
                                    <div style={{
                                        fontSize: '13px', fontWeight: 500,
                                        color: 'var(--text-primary, #1e293b)',
                                        whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis'
                                    }}>
                                        {product.name}
                                    </div>
                                    <div style={{
                                        fontSize: '11px', color: 'var(--text-muted, #94a3b8)',
                                    }}>
                                        {product.code || product.barcode || ''}
                                    </div>
                                </div>

                                {/* Остаток */}
                                <div style={{
                                    fontSize: '12px', textAlign: 'right', minWidth: '50px',
                                    color: isLow ? '#ef4444' : 'var(--text-muted, #64748b)',
                                }}>
                                    {stock !== null ? (
                                        <>{stock} <span style={{ fontSize: '10px' }}>{product.unit || 'шт'}</span></>
                                    ) : '—'}
                                </div>

                                {/* Цена */}
                                <div style={{
                                    fontSize: '13px', fontWeight: 600, textAlign: 'right', minWidth: '80px',
                                    color: 'var(--text-primary, #1e293b)',
                                }}>
                                    {formatPrice(product.price_sale || product.price)} <span style={{ fontSize: '10px', fontWeight: 400 }}>сум</span>
                                </div>

                                {/* Кнопка "+" */}
                                <div style={{
                                    width: '28px', height: '28px', borderRadius: '6px',
                                    background: 'var(--accent, #3b82f6)', color: '#fff',
                                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                                    flexShrink: 0,
                                }}>
                                    <Plus size={14} />
                                </div>
                            </div>
                        );
                    })}
                </div>
            )}

            {open && query.trim().length > 0 && filtered.length === 0 && (
                <div
                    ref={dropdownRef}
                    style={{
                        position: 'absolute', top: '100%', left: 0, right: 0,
                        zIndex: 1000, background: 'var(--bg-primary, #fff)',
                        border: '1px solid var(--border-color, #e2e8f0)',
                        borderRadius: '10px', boxShadow: '0 4px 16px rgba(0,0,0,0.1)',
                        padding: '20px', textAlign: 'center', marginTop: '4px',
                        color: 'var(--text-muted, #94a3b8)', fontSize: '14px',
                    }}
                >
                    Товар «{query}» не найден
                </div>
            )}
        </div>
    );
}

export default ProductSearchInput;
