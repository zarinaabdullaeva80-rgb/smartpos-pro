import React, { useState } from 'react';
import { View, StyleSheet, ScrollView } from 'react-native';
import { Button, Card, Title, Paragraph, Chip } from 'react-native-paper';
import axios from 'axios';
import { API_CONFIG } from '../config/settings';

export default function ConnectionTestScreen() {
    const [testResults, setTestResults] = useState([]);
    const [testing, setTesting] = useState(false);

    const addResult = (test, status, message) => {
        setTestResults(prev => [...prev, { test, status, message, time: new Date().toLocaleTimeString() }]);
    };

    const runTests = async () => {
        setTestResults([]);
        setTesting(true);

        try {
            // Тест 1: Проверка конфигурации
            addResult('Конфигурация', 'info', `API URL: ${API_CONFIG.BASE_URL}`);

            // Тест 2: Базовое подключение
            try {
                addResult('Базовое подключение', 'testing', 'Проверка...');
                const baseUrl = API_CONFIG.BASE_URL.replace('/api', '');
                await axios.get(baseUrl, { timeout: 5000 });
                addResult('Базовое подключение', 'success', 'Сервер доступен');
            } catch (error) {
                addResult('Базовое подключение', 'error', error.message);
            }

            // Тест 3: Login endpoint
            try {
                addResult('Login API', 'testing', 'Тестирование авторизации...');
                const response = await axios.post(
                    `${API_CONFIG.BASE_URL}/auth/login`,
                    { username: 'admin', password: 'admin123' },
                    {
                        headers: { 'Content-Type': 'application/json' },
                        timeout: 10000
                    }
                );
                addResult('Login API', 'success', `Успешно! Пользователь: ${response.data.user.username}`);
            } catch (error) {
                if (error.response) {
                    addResult('Login API', 'error', `${error.response.status}: ${error.response.data?.error || error.message}`);
                } else if (error.code === 'ECONNABORTED') {
                    addResult('Login API', 'error', 'Timeout - сервер не ответил за 10 сек');
                } else {
                    addResult('Login API', 'error', `${error.code || error.message}`);
                }
            }

            // Тест 4: Network info
            addResult('Сетевая информация', 'info', 'Проверьте, что телефон и сервер в одной WiFi сети');

        } catch (error) {
            addResult('Критическая ошибка', 'error', error.message);
        } finally {
            setTesting(false);
        }
    };

    const getStatusColor = (status) => {
        switch (status) {
            case 'success': return '#10b981';
            case 'error': return '#ef4444';
            case 'testing': return '#f59e0b';
            case 'info': return '#3b82f6';
            default: return '#6b7280';
        }
    };

    const getStatusIcon = (status) => {
        switch (status) {
            case 'success': return 'check-circle';
            case 'error': return 'alert-circle';
            case 'testing': return 'loading';
            case 'info': return 'information';
            default: return 'help-circle';
        }
    };

    return (
        <ScrollView style={styles.container}>
            <Card style={styles.card}>
                <Card.Content>
                    <Title>Диагностика подключения</Title>
                    <Paragraph>
                        Этот инструмент поможет определить проблемы с подключением к API серверу.
                    </Paragraph>
                </Card.Content>
            </Card>

            <View style={styles.buttonContainer}>
                <Button
                    mode="contained"
                    onPress={runTests}
                    loading={testing}
                    disabled={testing}
                    style={styles.button}
                >
                    Запустить тесты
                </Button>
            </View>

            {testResults.map((result, index) => (
                <Card key={index} style={[styles.resultCard, { borderLeftColor: getStatusColor(result.status) }]}>
                    <Card.Content>
                        <View style={styles.resultHeader}>
                            <Chip
                                icon={getStatusIcon(result.status)}
                                style={{ backgroundColor: getStatusColor(result.status) + '30' }}
                                textStyle={{ color: getStatusColor(result.status) }}
                            >
                                {result.test}
                            </Chip>
                            <Paragraph style={styles.time}>{result.time}</Paragraph>
                        </View>
                        <Paragraph style={styles.message}>{result.message}</Paragraph>
                    </Card.Content>
                </Card>
            ))}

            {testResults.length > 0 && (
                <Card style={styles.helpCard}>
                    <Card.Content>
                        <Title>Возможные решения</Title>
                        <Paragraph style={styles.helpText}>
                            • Убедитесь, что сервер запущен: npm start
                        </Paragraph>
                        <Paragraph style={styles.helpText}>
                            • Проверьте IP адрес в src/config/settings.js
                        </Paragraph>
                        <Paragraph style={styles.helpText}>
                            • Телефон и компьютер должны быть в одной WiFi сети
                        </Paragraph>
                        <Paragraph style={styles.helpText}>
                            • Проверьте файрвол Windows (порт 5000)
                        </Paragraph>
                        <Paragraph style={styles.helpText}>
                            • Попробуйте использовать ngrok для удаленного доступа
                        </Paragraph>
                    </Card.Content>
                </Card>
            )}
        </ScrollView>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#0f172a',
        padding: 16,
    },
    card: {
        marginBottom: 16,
        backgroundColor: '#1e293b',
    },
    buttonContainer: {
        marginBottom: 24,
    },
    button: {
        marginVertical: 8,
    },
    resultCard: {
        marginBottom: 12,
        backgroundColor: '#1e293b',
        borderLeftWidth: 4,
    },
    resultHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 8,
    },
    time: {
        fontSize: 12,
        color: '#94a3b8',
    },
    message: {
        color: '#cbd5e1',
        fontSize: 14,
    },
    helpCard: {
        marginTop: 16,
        marginBottom: 32,
        backgroundColor: '#1e293b',
        borderWidth: 1,
        borderColor: '#3b82f6',
    },
    helpText: {
        color: '#cbd5e1',
        fontSize: 14,
        marginBottom: 4,
    },
});
