import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet } from 'react-native';

/**
 * Живой таймер обратного отсчёта лицензии (React Native версия)
 * Показывает дни, часы, минуты, секунды до истечения
 */
const LicenseTimer = ({ expiryDate, compact = false, style }) => {
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

        setTimeLeft(calculateTimeLeft());
        const timer = setInterval(() => {
            setTimeLeft(calculateTimeLeft());
        }, 1000);

        return () => clearInterval(timer);
    }, [expiryDate]);

    if (!expiryDate) return null;

    const { days, hours, minutes, seconds, expired } = timeLeft;
    const expDate = new Date(expiryDate);
    const isWarning = !expired && days < 3;

    const statusColor = expired ? '#ff3355' : isWarning ? '#ff9500' : '#00ff88';
    const statusBg = expired ? 'rgba(255,51,85,0.15)' : isWarning ? 'rgba(255,149,0,0.15)' : 'rgba(0,255,136,0.1)';
    const statusBorder = expired ? 'rgba(255,51,85,0.4)' : isWarning ? 'rgba(255,149,0,0.4)' : 'rgba(0,255,136,0.3)';

    const pad = (n) => String(n).padStart(2, '0');
    const timeString = expired
        ? 'ИСТЕКЛА'
        : `${days > 0 ? `${days}д ` : ''}${pad(hours)}:${pad(minutes)}:${pad(seconds)}`;

    if (compact) {
        return (
            <Text style={[styles.compactText, { color: statusColor }, style]}>
                {timeString}
            </Text>
        );
    }

    return (
        <View style={[styles.container, style]}>
            <Text style={[styles.dateText, { color: expired ? '#ff3355' : '#ccc' }]}>
                {expDate.toLocaleDateString('ru-RU')} {expDate.toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' })}
            </Text>
            <View style={[styles.badge, { backgroundColor: statusBg, borderColor: statusBorder }]}>
                <Text style={[styles.badgeIcon]}>{expired ? '⛔' : '⏱️'}</Text>
                <Text style={[styles.badgeText, { color: statusColor }]}>
                    {timeString}
                </Text>
            </View>
        </View>
    );
};

const styles = StyleSheet.create({
    container: {
        alignItems: 'center',
        gap: 6,
    },
    dateText: {
        fontSize: 13,
        fontWeight: '600',
    },
    badge: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 14,
        paddingVertical: 6,
        borderRadius: 16,
        borderWidth: 1,
        gap: 6,
    },
    badgeIcon: {
        fontSize: 13,
    },
    badgeText: {
        fontFamily: 'monospace',
        fontWeight: 'bold',
        fontSize: 14,
    },
    compactText: {
        fontFamily: 'monospace',
        fontWeight: 'bold',
        fontSize: 13,
    },
});

export default LicenseTimer;
