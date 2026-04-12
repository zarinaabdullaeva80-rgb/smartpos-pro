/**
 * FormInputs - компоненты ввода для форм
 * Input, Select, Checkbox, DatePicker
 */

import React from 'react';

// Базовые стили
const baseInputStyle = {
    width: '100%',
    padding: '12px 16px',
    background: 'rgba(255,255,255,0.05)',
    border: '1px solid rgba(255,255,255,0.1)',
    borderRadius: '10px',
    color: 'white',
    fontSize: '14px',
    outline: 'none',
    transition: 'border-color 0.2s, box-shadow 0.2s'
};

const labelStyle = {
    display: 'block',
    marginBottom: '8px',
    color: '#a0aec0',
    fontSize: '13px',
    fontWeight: 500
};

const errorStyle = {
    color: '#ef4444',
    fontSize: '12px',
    marginTop: '4px'
};

// Text Input
export function Input({
    label,
    error,
    icon: Icon,
    ...props
}) {
    return (
        <div style={{ marginBottom: '16px' }}>
            {label && <label style={labelStyle}>{label}</label>}
            <div style={{ position: 'relative' }}>
                {Icon && (
                    <Icon
                        size={18}
                        color="#6366f1"
                        style={{
                            position: 'absolute',
                            left: '14px',
                            top: '50%',
                            transform: 'translateY(-50%)'
                        }}
                    />
                )}
                <input
                    style={{
                        ...baseInputStyle,
                        paddingLeft: Icon ? '44px' : '16px',
                        borderColor: error ? '#ef4444' : 'rgba(255,255,255,0.1)'
                    }}
                    onFocus={(e) => {
                        e.target.style.borderColor = error ? '#ef4444' : '#6366f1';
                        e.target.style.boxShadow = `0 0 0 3px ${error ? 'rgba(239,68,68,0.2)' : 'rgba(99,102,241,0.2)'}`;
                    }}
                    onBlur={(e) => {
                        e.target.style.borderColor = error ? '#ef4444' : 'rgba(255,255,255,0.1)';
                        e.target.style.boxShadow = 'none';
                    }}
                    {...props}
                />
            </div>
            {error && <div style={errorStyle}>{error}</div>}
        </div>
    );
}

// Textarea
export function Textarea({
    label,
    error,
    rows = 4,
    ...props
}) {
    return (
        <div style={{ marginBottom: '16px' }}>
            {label && <label style={labelStyle}>{label}</label>}
            <textarea
                rows={rows}
                style={{
                    ...baseInputStyle,
                    resize: 'vertical',
                    minHeight: '100px',
                    borderColor: error ? '#ef4444' : 'rgba(255,255,255,0.1)'
                }}
                onFocus={(e) => {
                    e.target.style.borderColor = error ? '#ef4444' : '#6366f1';
                }}
                onBlur={(e) => {
                    e.target.style.borderColor = error ? '#ef4444' : 'rgba(255,255,255,0.1)';
                }}
                {...props}
            />
            {error && <div style={errorStyle}>{error}</div>}
        </div>
    );
}

// Select
export function Select({
    label,
    error,
    options = [],
    placeholder = 'Выберите...',
    ...props
}) {
    return (
        <div style={{ marginBottom: '16px' }}>
            {label && <label style={labelStyle}>{label}</label>}
            <select
                style={{
                    ...baseInputStyle,
                    cursor: 'pointer',
                    borderColor: error ? '#ef4444' : 'rgba(255,255,255,0.1)'
                }}
                {...props}
            >
                <option value="" style={{ background: '#1e1e3f' }}>{placeholder}</option>
                {options.map(opt => (
                    <option
                        key={opt.value}
                        value={opt.value}
                        style={{ background: '#1e1e3f' }}
                    >
                        {opt.label}
                    </option>
                ))}
            </select>
            {error && <div style={errorStyle}>{error}</div>}
        </div>
    );
}

// Checkbox
export function Checkbox({
    label,
    checked,
    onChange,
    ...props
}) {
    return (
        <label style={{
            display: 'flex',
            alignItems: 'center',
            gap: '10px',
            cursor: 'pointer',
            marginBottom: '12px'
        }}>
            <div style={{
                width: '20px',
                height: '20px',
                borderRadius: '6px',
                border: `2px solid ${checked ? '#6366f1' : 'rgba(255,255,255,0.3)'}`,
                background: checked ? '#6366f1' : 'transparent',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                transition: 'all 0.2s'
            }}>
                {checked && (
                    <svg width="12" height="10" viewBox="0 0 12 10" fill="none">
                        <path d="M1 5L4.5 8.5L11 1" stroke="white" strokeWidth="2" strokeLinecap="round" />
                    </svg>
                )}
            </div>
            <input
                type="checkbox"
                checked={checked}
                onChange={onChange}
                style={{ display: 'none' }}
                {...props}
            />
            <span style={{ color: '#e2e8f0', fontSize: '14px' }}>{label}</span>
        </label>
    );
}

// Switch Toggle
export function Switch({
    label,
    checked,
    onChange,
    ...props
}) {
    return (
        <label style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            cursor: 'pointer',
            marginBottom: '12px'
        }}>
            <span style={{ color: '#e2e8f0', fontSize: '14px' }}>{label}</span>
            <div
                style={{
                    width: '48px',
                    height: '26px',
                    borderRadius: '13px',
                    background: checked
                        ? 'linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%)'
                        : 'rgba(255,255,255,0.1)',
                    padding: '3px',
                    transition: 'all 0.3s'
                }}
                onClick={() => onChange({ target: { checked: !checked } })}
            >
                <div style={{
                    width: '20px',
                    height: '20px',
                    borderRadius: '50%',
                    background: 'white',
                    transform: checked ? 'translateX(22px)' : 'translateX(0)',
                    transition: 'transform 0.3s',
                    boxShadow: '0 2px 4px rgba(0,0,0,0.2)'
                }} />
            </div>
            <input
                type="checkbox"
                checked={checked}
                onChange={onChange}
                style={{ display: 'none' }}
                {...props}
            />
        </label>
    );
}

// Number Input with +/- buttons
export function NumberInput({
    label,
    value,
    onChange,
    min = 0,
    max = Infinity,
    step = 1,
    ...props
}) {
    const handleChange = (delta) => {
        const newValue = Math.min(max, Math.max(min, (Number(value) || 0) + delta));
        onChange({ target: { value: newValue } });
    };

    return (
        <div style={{ marginBottom: '16px' }}>
            {label && <label style={labelStyle}>{label}</label>}
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <button
                    type="button"
                    onClick={() => handleChange(-step)}
                    disabled={value <= min}
                    style={{
                        width: '40px',
                        height: '40px',
                        borderRadius: '10px',
                        border: 'none',
                        background: 'rgba(99, 102, 241, 0.2)',
                        color: '#6366f1',
                        fontSize: '20px',
                        cursor: value <= min ? 'not-allowed' : 'pointer',
                        opacity: value <= min ? 0.5 : 1
                    }}
                >
                    −
                </button>
                <input
                    type="number"
                    value={value}
                    onChange={onChange}
                    min={min}
                    max={max}
                    style={{
                        ...baseInputStyle,
                        width: '100px',
                        textAlign: 'center'
                    }}
                    {...props}
                />
                <button
                    type="button"
                    onClick={() => handleChange(step)}
                    disabled={value >= max}
                    style={{
                        width: '40px',
                        height: '40px',
                        borderRadius: '10px',
                        border: 'none',
                        background: 'rgba(99, 102, 241, 0.2)',
                        color: '#6366f1',
                        fontSize: '20px',
                        cursor: value >= max ? 'not-allowed' : 'pointer',
                        opacity: value >= max ? 0.5 : 1
                    }}
                >
                    +
                </button>
            </div>
        </div>
    );
}

export default Input;
