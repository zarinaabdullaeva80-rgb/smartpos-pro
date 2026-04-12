import React, { useState } from 'react';
import { Trash2, Edit, Copy, Archive, CheckSquare } from 'lucide-react';
import { useToast } from '../components/ToastProvider';

/**
 * Bulk Operations Component
 * Provides multi-select functionality with bulk actions
 */
function BulkOperations({ items, onBulkDelete, onBulkEdit, onBulkArchive, itemName = 'items' }) {
    const toast = useToast();
    const [selectedItems, setSelectedItems] = useState(new Set());
    const [isProcessing, setIsProcessing] = useState(false);

    const toggleItem = (id) => {
        const newSelected = new Set(selectedItems);
        if (newSelected.has(id)) {
            newSelected.delete(id);
        } else {
            newSelected.add(id);
        }
        setSelectedItems(newSelected);
    };

    const toggleAll = () => {
        if (selectedItems.size === items.length) {
            setSelectedItems(new Set());
        } else {
            setSelectedItems(new Set(items.map(item => item.id)));
        }
    };

    const handleBulkAction = async (action) => {
        if (selectedItems.size === 0) return;

        const selectedIds = Array.from(selectedItems);

        if (!confirm(`Вы уверены? Это действие затронет ${selectedIds.length} ${itemName}`)) {
            return;
        }

        setIsProcessing(true);
        try {
            await action(selectedIds);
            setSelectedItems(new Set());
        } catch (error) {
            console.error('Bulk action error:', error);
            toast.info('Ошибка: ' + error.message);
        } finally {
            setIsProcessing(false);
        }
    };

    const isAllSelected = selectedItems.size > 0 && selectedItems.size === items.length;
    const isSomeSelected = selectedItems.size > 0 && selectedItems.size < items.length;

    return (
        <div className="bulk-operations">
            {/* Selection toolbar */}
            {selectedItems.size > 0 && (
                <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 mb-4 flex items-center justify-between">
                    <div className="flex items-center gap-2">
                        <CheckSquare className="text-blue-600" size={20} />
                        <span className="font-medium text-blue-900">
                            Выбрано: {selectedItems.size}
                        </span>
                    </div>

                    <div className="flex gap-2">
                        {onBulkDelete && (
                            <button
                                onClick={() => handleBulkAction(onBulkDelete)}
                                disabled={isProcessing}
                                className="flex items-center gap-1 px-3 py-1.5 bg-red-600 text-white rounded hover:bg-red-700 disabled:bg-gray-400 text-sm"
                                title="Удалить выбранное"
                            >
                                <Trash2 size={16} />
                                Удалить
                            </button>
                        )}

                        {onBulkArchive && (
                            <button
                                onClick={() => handleBulkAction(onBulkArchive)}
                                disabled={isProcessing}
                                className="flex items-center gap-1 px-3 py-1.5 bg-yellow-600 text-white rounded hover:bg-yellow-700 disabled:bg-gray-400 text-sm"
                                title="Архивировать выбранное"
                            >
                                <Archive size={16} />
                                В архив
                            </button>
                        )}

                        {onBulkEdit && (
                            <button
                                onClick={() => handleBulkAction(onBulkEdit)}
                                disabled={isProcessing}
                                className="flex items-center gap-1 px-3 py-1.5 bg-green-600 text-white rounded hover:bg-green-700 disabled:bg-gray-400 text-sm"
                                title="Редактировать выбранное"
                            >
                                <Edit size={16} />
                                Изменить
                            </button>
                        )}

                        <button
                            onClick={() => setSelectedItems(new Set())}
                            className="px-3 py-1.5 border border-gray-300 rounded hover:bg-gray-50 text-sm"
                        >
                            Отменить
                        </button>
                    </div>
                </div>
            )}

            {/* Select all checkbox */}
            <div className="flex items-center gap-2 mb-2">
                <label className="flex items-center gap-2 cursor-pointer">
                    <input
                        type="checkbox"
                        checked={isAllSelected}
                        ref={input => {
                            if (input) input.indeterminate = isSomeSelected;
                        }}
                        onChange={toggleAll}
                        className="w-4 h-4 cursor-pointer"
                    />
                    <span className="text-sm text-gray-600">
                        {isAllSelected ? 'Снять всё' : 'Выбрать всё'}
                    </span>
                </label>
                {items.length > 0 && (
                    <span className="text-sm text-gray-500">
                        ({items.length} всего)
                    </span>
                )}
            </div>

            {/* Return render props for items */}
            {items.map(item => (
                <div key={item.id} className="flex items-center gap-2 border-b py-2">
                    <input
                        type="checkbox"
                        checked={selectedItems.has(item.id)}
                        onChange={() => toggleItem(item.id)}
                        className="w-4 h-4 cursor-pointer"
                    />
                    {/* Item content will be rendered by parent */}
                    <div className="flex-1">
                        {/* This is placeholder - parent should provide actual content */}
                    </div>
                </div>
            ))}
        </div>
    );
}

/**
 * Hook for using bulk operations
 */
export function useBulkSelect(initialItems = []) {
    const [selectedIds, setSelectedIds] = useState(new Set());

    const toggleItem = (id) => {
        const newSet = new Set(selectedIds);
        if (newSet.has(id)) {
            newSet.delete(id);
        } else {
            newSet.add(id);
        }
        setSelectedIds(newSet);
    };

    const toggleAll = (items) => {
        if (selectedIds.size === items.length) {
            setSelectedIds(new Set());
        } else {
            setSelectedIds(new Set(items.map(item => item.id)));
        }
    };

    const clearSelection = () => setSelectedIds(new Set());

    const isSelected = (id) => selectedIds.has(id);

    const selectedCount = selectedIds.size;

    const getSelectedItems = (items) => {
        return items.filter(item => selectedIds.has(item.id));
    };

    return {
        selectedIds,
        toggleItem,
        toggleAll,
        clearSelection,
        isSelected,
        selectedCount,
        getSelectedItems
    };
}

export default BulkOperations;
