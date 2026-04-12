/**
 * RefreshableList - список с Pull-to-Refresh
 */

import React, { useState, useCallback } from 'react';
import { FlatList, RefreshControl, StyleSheet, View } from 'react-native';
import { EmptyStatePreset } from './EmptyState';
import { ListSkeleton } from './Skeleton';

// Цвета для refresh indicator
const refreshColors = ['#6366f1', '#8b5cf6', '#a78bfa'];

export function RefreshableList({
    data = [],
    renderItem,
    onRefresh,
    loading = false,
    emptyPreset = 'products',
    emptyAction,
    emptyActionLabel,
    keyExtractor = (item, index) => item.id?.toString() || index.toString(),
    ListHeaderComponent,
    ListFooterComponent,
    ...props
}) {
    const [refreshing, setRefreshing] = useState(false);

    const handleRefresh = useCallback(async () => {
        if (!onRefresh) return;
        setRefreshing(true);
        try {
            await onRefresh();
        } finally {
            setRefreshing(false);
        }
    }, [onRefresh]);

    // Loading state
    if (loading && !data.length) {
        return (
            <View style={styles.container}>
                <ListSkeleton count={6} />
            </View>
        );
    }

    return (
        <FlatList
            data={data}
            renderItem={renderItem}
            keyExtractor={keyExtractor}
            refreshControl={
                onRefresh ? (
                    <RefreshControl
                        refreshing={refreshing}
                        onRefresh={handleRefresh}
                        colors={refreshColors}
                        tintColor="#6366f1"
                        progressBackgroundColor="#1e1e3f"
                    />
                ) : undefined
            }
            ListEmptyComponent={
                <EmptyStatePreset
                    preset={emptyPreset}
                    actionLabel={emptyActionLabel}
                    onAction={emptyAction}
                />
            }
            ListHeaderComponent={ListHeaderComponent}
            ListFooterComponent={ListFooterComponent}
            contentContainerStyle={[
                styles.content,
                !data.length && styles.emptyContent
            ]}
            showsVerticalScrollIndicator={false}
            {...props}
        />
    );
}

// Секционный список с refresh
export function RefreshableSectionList({
    sections = [],
    renderItem,
    renderSectionHeader,
    onRefresh,
    loading = false,
    emptyPreset = 'products',
    ...props
}) {
    const [refreshing, setRefreshing] = useState(false);

    const handleRefresh = useCallback(async () => {
        if (!onRefresh) return;
        setRefreshing(true);
        try {
            await onRefresh();
        } finally {
            setRefreshing(false);
        }
    }, [onRefresh]);

    if (loading && !sections.length) {
        return <ListSkeleton count={6} />;
    }

    // Convert to FlatList format for simplicity
    const flatData = sections.flatMap(section => [
        { type: 'header', title: section.title, key: `header-${section.title}` },
        ...section.data.map((item, idx) => ({
            type: 'item',
            data: item,
            key: `item-${section.title}-${idx}`
        }))
    ]);

    return (
        <FlatList
            data={flatData}
            renderItem={({ item }) => {
                if (item.type === 'header') {
                    return renderSectionHeader?.({ section: { title: item.title } });
                }
                return renderItem?.({ item: item.data });
            }}
            keyExtractor={item => item.key}
            refreshControl={
                onRefresh ? (
                    <RefreshControl
                        refreshing={refreshing}
                        onRefresh={handleRefresh}
                        colors={refreshColors}
                        tintColor="#6366f1"
                    />
                ) : undefined
            }
            ListEmptyComponent={<EmptyStatePreset preset={emptyPreset} />}
            showsVerticalScrollIndicator={false}
            {...props}
        />
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1
    },
    content: {
        paddingHorizontal: 16,
        paddingBottom: 24
    },
    emptyContent: {
        flexGrow: 1
    }
});

export default RefreshableList;
