import React, { useState, useEffect } from 'react';
import { Clock } from 'lucide-react';

const LicenseTimer = ({ expiryDate, showDate = true, showTime = true, compact = false }) => {
    const [timeLeft, setTimeLeft] = useState({ days: 0, hours: 0, minutes: 0, seconds: 0, expired: false });

    useEffect(() => {
        if (!expiryDate) return;

        const calculateTimeLeft = () => {
            const exp = new Date(expiryDate);
            const now = new Date();
            const diff = exp - now;

            if (diff <= 0) {
                return { days: 0, hours: 0, minutes: 0, seconds: 0, expired: true };
            }

            return {
                days: Math.floor(diff / (1000 * 60 * 60 * 24)),
                hours: Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60)),
                minutes: Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60)),
                seconds: Math.floor((diff % (1000 * 60)) / 1000),
                expired: false
            };
        };

        const timer = setInterval(() => {
            setTimeLeft(calculateTimeLeft());
        }, 1000);

        setTimeLeft(calculateTimeLeft());

        return () => clearInterval(timer);
    }, [expiryDate]);

    if (!expiryDate) return null;

    const { days, hours, minutes, seconds, expired } = timeLeft;
    const expDate = new Date(expiryDate);
    const isWarning = !expired && days < 3;

    if (compact) {
        return (
            <span style={{ 
                color: expired ? '#ff3355' : isWarning ? '#ff9500' : '#00ff88',
                fontWeight: 'bold',
                fontFamily: 'monospace'
            }}>
                {expired ? 'ИСТЕКЛА' : `${days > 0 ? `${days}д ` : ''}${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`}
            </span>
        );
    }

    return (
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '4px' }}>
            {showDate && (
                <div style={{ color: expired ? '#ff3355' : isWarning ? '#ff9500' : '#f0e6ff', fontWeight: 'bold', fontSize: '14px' }}>
                    {expDate.toLocaleDateString('ru-RU')}
                </div>
            )}
            {showTime && (
                <div style={{ color: expired ? '#ff3355' : isWarning ? '#ff9500' : '#c9b0e8', fontSize: '12px', fontFamily: 'monospace', fontWeight: 500 }}>
                    {expDate.toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                </div>
            )}
            <div style={{
                fontSize: '12px', marginTop: '4px',
                padding: '4px 12px', borderRadius: '12px', display: 'inline-flex', alignItems: 'center', gap: '5px',
                background: expired ? 'rgba(255,51,85,0.15)' : isWarning ? 'rgba(255,149,0,0.15)' : 'rgba(0,255,136,0.1)',
                color: expired ? '#ff3355' : isWarning ? '#ff9500' : '#00ff88',
                border: `1px solid ${expired ? 'rgba(255,51,85,0.4)' : isWarning ? 'rgba(255,149,0,0.4)' : 'rgba(0,255,136,0.3)'}`,
                boxShadow: expired ? '0 0 12px rgba(255,51,85,0.2)' : isWarning ? '0 0 12px rgba(255,149,0,0.2)' : '0 0 12px rgba(0,255,136,0.15)',
                fontFamily: 'monospace', fontWeight: 'bold'
            }}>
                {expired ? (
                    <><span>⛔</span> Истекла</>
                ) : (
                    <>
                        <Clock size={12} />
                        <span>
                            {days > 0 ? `${days}д ` : ''}{String(hours).padStart(2, '0')}:{String(minutes).padStart(2, '0')}:{String(seconds).padStart(2, '0')}
                        </span>
                    </>
                )}
            </div>
        </div>
    );
};

export default LicenseTimer;
