import React, { useEffect } from 'react';
import { Alert, Platform } from 'react-native';

/**
 * UpdateChecker — проверка обновлений через серверный API
 * expo-updates намеренно не используется (ENABLED=false в манифесте)
 */
export default function UpdateChecker({ children, serverUrl }) {
    useEffect(() => {
        checkForUpdates();
    }, []);

    const checkForUpdates = async () => {
        try {
            const baseUrl = serverUrl || 'https://smartpos-pro-production.up.railway.app';
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), 5000);

            const response = await fetch(
                `${baseUrl}/api/updates/check?platform=${Platform.OS}&currentVersion=2.3.0`,
                { signal: controller.signal }
            );
            clearTimeout(timeoutId);

            if (!response.ok) return;

            const data = await response.json();

            if (data.updateAvailable) {
                const version = data.latestVersion || '';
                const changelog = Array.isArray(data.changelog)
                    ? data.changelog.join('\n')
                    : '';

                Alert.alert(
                    '🔄 Доступно обновление' + (version ? ` ${version}` : ''),
                    changelog || 'Доступна новая версия приложения.',
                    [{ text: 'ОК' }]
                );
            }
        } catch (e) {
            // Нет сети или сервер недоступен — тихо игнорируем
        }
    };

    return children;
}
