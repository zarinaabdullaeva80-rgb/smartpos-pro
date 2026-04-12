// Централизованная обработка ошибок
export const handleApiError = (error, context = '') => {
    console.error(`[ERROR] ${context}:`, error);

    if (error.response) {
        // Сервер ответил с ошибкой
        const message = error.response.data?.error || error.response.data?.message || 'Ошибка сервера';
        console.error('Response error:', {
            status: error.response.status,
            data: error.response.data,
            headers: error.response.headers
        });
        return message;
    } else if (error.request) {
        // Запрос был отправлен, но ответа не получено
        console.error('No response received:', error.request);
        return 'Сервер не отвечает. Проверьте подключение.';
    } else {
        // Ошибка при настройке запроса
        console.error('Request setup error:', error.message);
        return `Ошибка: ${error.message}`;
    }
};

// Показать уведомление об ошибке
export const showError = (message) => {
    console.error('[USER ERROR]:', message);
    alert(message);
};

// Показать успешное уведомление
export const showSuccess = (message) => {
    console.log('[SUCCESS]:', message);
    alert(message);
};

// Логирование действий пользователя
export const logAction = (action, data = {}) => {
    console.log(`[ACTION] ${action}:`, data);
};
