import pool from '../src/config/database.js';
import { handleTelegramUpdate } from '../src/services/telegramAdminBot.js';

// Символический Chat ID для тестов
const TEST_CHAT_ID = 1234567890;
const TEST_USERNAME = 'test_admin_user';

// Mock-функция для отслеживания отправляемых сообщений в консоль
const originalFetch = global.fetch;
global.fetch = async (url, options) => {
    if (url.includes('api.telegram.org')) {
        const body = JSON.parse(options.body);
        console.log(`[BOT-MOCK-OUT] 📤 To: ${body.chat_id} | Text:\n${body.text}\n`);
        
        // Return standard Telegram API success response
        return {
            ok: true,
            json: async () => ({ ok: true, result: { message_id: 999 } })
        };
    }
    return originalFetch ? originalFetch(url, options) : { ok: true, json: async () => ({}) };
};

async function runTests() {
    console.log('🧪 Запуск диагностического тестирования Telegram Admin Bot...');
    console.log('='.repeat(60));

    try {
        // Очистим тестовую сессию в БД перед началом
        await pool.query('DELETE FROM telegram_admins WHERE chat_id = $1', [TEST_CHAT_ID.toString()]);
        
        // 1. Тест /start без авторизации
        console.log('🔹 Тест 1: Отправка /start неавторизованным пользователем');
        await handleTelegramUpdate({
            message: {
                chat: { id: TEST_CHAT_ID, username: TEST_USERNAME },
                text: '/start'
            }
        });

        // 2. Тест команды без авторизации
        console.log('🔹 Тест 2: Отправка произвольного текста неавторизованным пользователем');
        await handleTelegramUpdate({
            message: {
                chat: { id: TEST_CHAT_ID, username: TEST_USERNAME },
                text: '/licenses'
            }
        });

        // 3. Тест авторизации (используем пользователя admin, пароль admin123)
        console.log('🔹 Тест 3: Авторизация с правильными реквизитами');
        await handleTelegramUpdate({
            message: {
                chat: { id: TEST_CHAT_ID, username: TEST_USERNAME },
                text: '/login admin admin123'
            }
        });

        // Дадим полсекунды на bcrypt
        await new Promise(resolve => setTimeout(resolve, 500));

        // Проверим, что сессия добавилась в БД
        const checkSession = await pool.query('SELECT * FROM telegram_admins WHERE chat_id = $1', [TEST_CHAT_ID.toString()]);
        if (checkSession.rows.length > 0 && checkSession.rows[0].is_active) {
            console.log('✅ Сессия успешно создана в базе данных!');
        } else {
            throw new Error('❌ Ошибка: Сессия не найдена в базе данных!');
        }

        // 4. Тест команды /licenses в авторизованном состоянии
        console.log('🔹 Тест 4: Запрос списка лицензий');
        await handleTelegramUpdate({
            message: {
                chat: { id: TEST_CHAT_ID, username: TEST_USERNAME },
                text: '/licenses'
            }
        });

        // 5. Тест интерактивного создания лицензии
        console.log('🔹 Тест 5: Запуск интерактивного создания лицензии (/newlicense)');
        await handleTelegramUpdate({
            message: {
                chat: { id: TEST_CHAT_ID, username: TEST_USERNAME },
                text: '/newlicense'
            }
        });

        console.log('🔹 Тест 6: Шаг 1 - ввод названия организации');
        await handleTelegramUpdate({
            message: {
                chat: { id: TEST_CHAT_ID, username: TEST_USERNAME },
                text: 'Тестовая Фирма ООО'
            }
        });

        console.log('🔹 Тест 7: Шаг 2 - выбор тарифа (callback_query)');
        await handleTelegramUpdate({
            callback_query: {
                id: '12345',
                message: {
                    chat: { id: TEST_CHAT_ID },
                    message_id: 999
                },
                data: 'new_monthly'
            }
        });

        console.log('🔹 Тест 8: Шаг 3 - ввод количества устройств (касс)');
        await handleTelegramUpdate({
            message: {
                chat: { id: TEST_CHAT_ID, username: TEST_USERNAME },
                text: '2'
            }
        });

        // Ждем завершения создания лицензии
        await new Promise(resolve => setTimeout(resolve, 1000));

        // Проверим, что лицензия создана в базе данных
        const checkLicense = await pool.query(
            "SELECT * FROM licenses WHERE company_name = 'Тестовая Фирма ООО' ORDER BY created_at DESC LIMIT 1"
        );
        if (checkLicense.rows.length > 0) {
            const l = checkLicense.rows[0];
            console.log(`✅ Лицензия успешно создана в БД! Ключ: ${l.license_key}`);
            
            // Проверим также организацию
            const checkOrg = await pool.query("SELECT * FROM organizations WHERE license_key = $1", [l.license_key]);
            if (checkOrg.rows.length > 0) {
                console.log(`✅ Организация "${checkOrg.rows[0].name}" создана!`);
            } else {
                console.warn('⚠️ Организация не найдена для созданного ключа!');
            }

            // Продлим её на 30 дней
            console.log('🔹 Тест 9: Команда продления лицензии (/extend)');
            await handleTelegramUpdate({
                message: {
                    chat: { id: TEST_CHAT_ID, username: TEST_USERNAME },
                    text: `/extend ${l.license_key} 30`
                }
            });

            // Посмотрим детали
            console.log('🔹 Тест 10: Просмотр деталей лицензии (/license)');
            await handleTelegramUpdate({
                message: {
                    chat: { id: TEST_CHAT_ID, username: TEST_USERNAME },
                    text: `/license ${l.license_key}`
                }
            });
        } else {
            throw new Error('❌ Ошибка: Лицензия не найдена в базе данных!');
        }

        // Очистим созданную тестовую лицензию и сессию
        if (checkLicense.rows.length > 0) {
            const l = checkLicense.rows[0];
            await pool.query('UPDATE organizations SET license_key = NULL WHERE id = $1', [l.organization_id]);
            await pool.query('UPDATE licenses SET organization_id = NULL WHERE id = $1', [l.id]);
            await pool.query('DELETE FROM users WHERE license_id = $1', [l.id]);
            await pool.query('DELETE FROM warehouses WHERE organization_id = $1', [l.organization_id]);
            await pool.query('DELETE FROM license_history WHERE license_id = $1', [l.id]);
            await pool.query('DELETE FROM licenses WHERE id = $1', [l.id]);
            await pool.query('DELETE FROM organizations WHERE id = $1', [l.organization_id]);
            console.log('🧹 Очистка тестовых данных лицензии завершена.');
        }
        await pool.query('DELETE FROM telegram_admins WHERE chat_id = $1', [TEST_CHAT_ID.toString()]);
        console.log('🧹 Очистка тестовой сессии завершена.');

        console.log('='.repeat(60));
        console.log('🎉 Все тесты завершены УСПЕШНО!');

    } catch (err) {
        console.error('❌ Ошибка при выполнении тестов:', err);
    } finally {
        // Закрываем пул соединений
        await pool.end();
        process.exit(0);
    }
}

runTests();
