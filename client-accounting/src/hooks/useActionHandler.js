import { useToast } from '../components/ToastProvider';

/**
 * Hook для обработки действий кнопок с Toast уведомлениями
 */
export const useActionHandler = () => {
    const toast = useToast();

    /**
     * Показать сообщение "Функция в разработке"
     */
    const handleNotImplemented = (featureName) => {
        toast.info(`${featureName || 'Функция'} в разработке`);
    };

    /**
     * Показать успешное действие
     */
    const handleSuccess = (message) => {
        toast.success(message || 'Операция выполнена успешно');
    };

    /**
     * Показать ошибку
     */
    const handleError = (message) => {
        toast.error(message || 'Произошла ошибка');
    };

    /**
     * Показать предупреждение
     */
    const handleWarning = (message) => {
        toast.warning(message || 'Внимание');
    };

    /**
     * Обработчик для печати
     */
    const handlePrint = (content, options = {}) => {
        const printWindow = window.open('', '_blank');
        if (printWindow) {
            printWindow.document.write(`
                <!DOCTYPE html>
                <html>
                <head>
                    <title>${options.title || 'Печать'}</title>
                    <style>
                        body { font-family: Arial, sans-serif; padding: 20px; }
                        table { width: 100%; border-collapse: collapse; }
                        th, td { border: 1px solid #ddd; padding: 8px; text-align: left; }
                        th { background: #f5f5f5; }
                        @media print {
                            .no-print { display: none; }
                        }
                    </style>
                </head>
                <body>
                    ${content}
                </body>
                </html>
            `);
            printWindow.document.close();
            printWindow.focus();
            printWindow.print();
            toast.success('Документ отправлен на печать');
        } else {
            toast.error('Не удалось открыть окно печати');
        }
    };

    /**
     * Скачивание данных как JSON
     */
    const handleExport = (data, filename = 'export.json') => {
        try {
            const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = filename;
            a.click();
            URL.revokeObjectURL(url);
            toast.success(`Файл ${filename} скачан`);
        } catch (err) {
            toast.error('Ошибка экспорта данных');
        }
    };

    /**
     * Подтверждение действия
     */
    const handleConfirm = (message, onConfirm) => {
        if (window.confirm(message)) {
            onConfirm();
        }
    };

    return {
        handleNotImplemented,
        handleSuccess,
        handleError,
        handleWarning,
        handlePrint,
        handleExport,
        handleConfirm,
        toast
    };
};

export default useActionHandler;
