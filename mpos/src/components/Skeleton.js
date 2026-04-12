/**
 * Skeleton - компонент загрузки для React Native
 */

import React, { useEffect, useRef } from 'react';
import { View, Animated, StyleSheet } from 'react-native';

// Базовый Skeleton
export function Skeleton({ width = '100%', height = 20, borderRadius = 8, style }) {
    const animatedValue = useRef(new Animated.Value(0)).current;

    useEffect(() => {
        const animation = Animated.loop(
            Animated.sequence([
                Animated.timing(animatedValue, {
                    toValue: 1,
                    duration: 1000,
                    useNativeDriver: true
                }),
                Animated.timing(animatedValue, {
                    toValue: 0,
                    duration: 1000,
                    useNativeDriver: true
                })
            ])
        );
        animation.start();
        return () => animation.stop();
    }, []);

    const opacity = animatedValue.interpolate({
        inputRange: [0, 1],
        outputRange: [0.3, 0.7]
    });

    return (
        <Animated.View
            style={[
                styles.skeleton,
                { width, height, borderRadius, opacity },
                style
            ]}
        />
    );
}

// Skeleton для карточки товара
export function ProductCardSkeleton() {
    return (
        <View style={styles.productCard}>
            <Skeleton width={80} height={80} borderRadius={12} />
            <View style={styles.productInfo}>
                <Skeleton width="70%" height={16} />
                <Skeleton width="40%" height={14} style={{ marginTop: 8 }} />
                <Skeleton width="50%" height={18} style={{ marginTop: 8 }} />
            </View>
        </View>
    );
}

// Skeleton для списка
export function ListSkeleton({ count = 5 }) {
    return (
        <View style={styles.list}>
            {Array(count).fill(0).map((_, i) => (
                <View key={i} style={styles.listItem}>
                    <Skeleton width={50} height={50} borderRadius={25} />
                    <View style={styles.listItemContent}>
                        <Skeleton width="60%" height={16} />
                        <Skeleton width="80%" height={14} style={{ marginTop: 6 }} />
                    </View>
                </View>
            ))}
        </View>
    );
}

// Skeleton для продаж
export function SaleSkeleton() {
    return (
        <View style={styles.saleCard}>
            <View style={styles.saleHeader}>
                <Skeleton width={100} height={16} />
                <Skeleton width={80} height={14} />
            </View>
            <Skeleton width="100%" height={1} style={{ marginVertical: 12 }} />
            <View style={styles.saleItems}>
                <Skeleton width="70%" height={14} />
                <Skeleton width="30%" height={14} />
            </View>
            <View style={styles.saleItems}>
                <Skeleton width="50%" height={14} />
                <Skeleton width="25%" height={14} />
            </View>
            <Skeleton width="100%" height={1} style={{ marginVertical: 12 }} />
            <View style={styles.saleFooter}>
                <Skeleton width={60} height={20} />
                <Skeleton width={100} height={24} />
            </View>
        </View>
    );
}

const styles = StyleSheet.create({
    skeleton: {
        backgroundColor: '#3a3a5a'
    },
    productCard: {
        flexDirection: 'row',
        padding: 16,
        backgroundColor: '#1e1e3f',
        borderRadius: 16,
        marginBottom: 12
    },
    productInfo: {
        flex: 1,
        marginLeft: 16,
        justifyContent: 'center'
    },
    list: {
        padding: 16
    },
    listItem: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: 16
    },
    listItemContent: {
        flex: 1,
        marginLeft: 12
    },
    saleCard: {
        backgroundColor: '#1e1e3f',
        borderRadius: 16,
        padding: 16,
        marginBottom: 12
    },
    saleHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between'
    },
    saleItems: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        marginTop: 8
    },
    saleFooter: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center'
    }
});

export default Skeleton;
