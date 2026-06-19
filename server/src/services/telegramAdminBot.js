import pool from '../config/database.js';
import {
    createLicenseInternal,
    extendLicenseInternal,
    updateLicenseStatusInternal,
    updateLicenseFieldsInternal
} from './licensingService.js';
import fetch from 'node-fetch';
import crypto from 'crypto';

const TELEGRAM_BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
const TELEGRAM_API_URL = TELEGRAM_BOT_TOKEN
    ? `https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}`
    : null;

// Хранилище временного состояния диалогов
const userStates = {};

/**
 * Проверка, является ли пользователь авторизованным админом
 */
async function getAdminUser(chatId) {
    try {
        const result = await pool.query(
            `SELECT ta.user_id, u.username, u.full_name 
             FROM telegram_admins ta
             JOIN users u ON ta.user_id = u.id
             WHERE ta.chat_id = $1 AND ta.is_active = true`,
            [chatId.toString()]
        );
        return result.rows[0] || null;
    } catch (err) {
        console.error('[TELEGRAM-BOT] Error checking admin status:', err);
        return null;
    }
}

/**
 * Отправка сообщения в Telegram
 */
async function sendMessage(chatId, text, extra = {}) {
    if (!TELEGRAM_API_URL) return;
    try {
        await fetch(`${TELEGRAM_API_URL}/sendMessage`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                chat_id: chatId,
                text,
                parse_mode: 'HTML',
                ...extra
            })
        });
    } catch (err) {
        console.error('[TELEGRAM-BOT] Send message error:', err.message);
    }
}

/**
 * Ответ на callback_query (убирает крутилку часов в Telegram)
 */
async function answerCallbackQuery(callbackQueryId, text = '') {
    if (!TELEGRAM_API_URL) return;
    try {
        await fetch(`${TELEGRAM_API_URL}/answerCallbackQuery`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                callback_query_id: callbackQueryId,
                text
            })
        });
    } catch (err) {
        console.error('[TELEGRAM-BOT] Answer callback query error:', err.message);
    }
}

/**
 * Главный обработчик обновлений от Telegram
 */
export async function handleTelegramUpdate(update) {
    if (!TELEGRAM_API_URL) return;

    try {
        if (update.message) {
            await handleMessage(update.message);
        } else if (update.callback_query) {
            await handleCallbackQuery(update.callback_query);
        }
    } catch (err) {
        console.error('[TELEGRAM-BOT] General update handler error:', err);
    }
}

/**
 * Обработка входящих текстовых сообщений
 */
async function handleMessage(message) {
    const chatId = message.chat.id;
    const text = message.text?.trim() || '';
    const username = message.chat.username || '';

    // 1. Проверяем авторизацию
    const admin = await getAdminUser(chatId);

    // Если не авторизован, разрешаем только /start и /login
    if (!admin) {
        if (text.startsWith('/start')) {
            const startMsg = 
                `👋 <b>Добро пожаловать в SmartPOS Pro Admin Bot!</b>\n\n` +
                `Этот бот позволяет безопасно создавать и управлять лицензиями клиентов из любой точки мира.\n\n` +
                `🔑 Чтобы начать работу, пожалуйста, авторизуйтесь с помощью команды:\n` +
                `<code>/login логин пароль</code>\n\n` +
                `<i>Пример: /login admin SuperSecurePassword</i>`;
            await sendMessage(chatId, startMsg);
            return;
        }

        if (text.startsWith('/login')) {
            const parts = text.split(/\s+/);
            if (parts.length < 3) {
                await sendMessage(chatId, '⚠️ Неверный формат. Используйте: <code>/login логин пароль</code>');
                return;
            }

            const inputUsername = parts[1];
            const inputPassword = parts.slice(2).join(' '); // Пароль может содержать пробелы

            try {
                // Ищем пользователя с правами Администратор
                const userResult = await pool.query(
                    `SELECT u.* FROM users u 
                     WHERE LOWER(u.username) = LOWER($1) AND u.is_active = true`,
                    [inputUsername]
                );

                if (userResult.rows.length === 0) {
                    await sendMessage(chatId, '❌ Пользователь не найден или деактивирован.');
                    return;
                }

                const user = userResult.rows[0];
                
                // Проверяем роль
                if (user.role !== 'Администратор' && user.role !== 'admin') {
                    await sendMessage(chatId, '🚫 Доступ запрещен. Требуются права Администратора.');
                    return;
                }

                // Проверяем пароль
                const bcryptModule = await import('bcrypt');
                const bcrypt = bcryptModule.default || bcryptModule;
                const isMatch = await bcrypt.compare(inputPassword, user.password_hash);

                if (!isMatch) {
                    await sendMessage(chatId, '❌ Неверный пароль.');
                    return;
                }

                // Успешный вход — привязываем Chat ID
                await pool.query(
                    `INSERT INTO telegram_admins (user_id, chat_id, username, is_active)
                     VALUES ($1, $2, $3, true)
                     ON CONFLICT (chat_id) 
                     DO UPDATE SET user_id = $1, username = $3, is_active = true`,
                    [user.id, chatId.toString(), username]
                );

                const successMsg = 
                    `✅ <b>Успешная авторизация!</b>\n` +
                    `Рады вас видеть, <b>${user.full_name || user.username}</b>.\n\n` +
                    `Доступные команды:\n` +
                    `🏢 /newlicense - Создать новую лицензию\n` +
                    `📋 /licenses - Список последних 10 лицензий\n` +
                    `🔍 /license <code>KEY</code> - Информация о лицензии\n` +
                    `✍️ /editlicense <code>KEY</code> <code>ПОЛЕ</code> <code>ЗНАЧЕНИЕ</code> - Изменить поле лицензии\n` +
                    `➕ /extend <code>KEY</code> <code>ДНИ</code> - Продлить лицензию\n` +
                    `🔴 /suspend <code>KEY</code> - Заблокировать лицензию\n` +
                    `🟢 /activate <code>KEY</code> - Активировать лицензию\n` +
                    `🚪 /logout - Выйти из панели управления`;
                
                await sendMessage(chatId, successMsg);
            } catch (authErr) {
                console.error('[TELEGRAM-BOT] Login error:', authErr);
                await sendMessage(chatId, '💥 Произошла ошибка при авторизации: ' + authErr.message);
            }
            return;
        }

        await sendMessage(chatId, '🔒 Вы не авторизованы. Используйте команду: <code>/login логин пароль</code>');
        return;
    }

    // 2. Пользователь авторизован как Админ — Обрабатываем команды
    if (text.startsWith('/logout')) {
        await pool.query('UPDATE telegram_admins SET is_active = false WHERE chat_id = $1', [chatId.toString()]);
        delete userStates[chatId];
        await sendMessage(chatId, '🚪 Вы успешно вышли из панели администрирования бота.');
        return;
    }

    if (text.startsWith('/licenses')) {
        try {
            const result = await pool.query(
                `SELECT license_key, company_name, customer_name, license_type, status, expires_at 
                 FROM licenses ORDER BY created_at DESC LIMIT 10`
            );

            if (result.rows.length === 0) {
                await sendMessage(chatId, '📋 Список лицензий пуст.');
                return;
            }

            let responseMsg = `📋 <b>Последние 10 лицензий:</b>\n\n`;
            for (const row of result.rows) {
                const statusEmoji = row.status === 'active' ? '🟢' : (row.status === 'suspended' ? '🟡' : '🔴');
                const expDate = row.expires_at ? new Date(row.expires_at).toLocaleDateString('ru-RU') : 'Бессрочно';
                const orgName = row.company_name || row.customer_name || 'Без названия';
                
                responseMsg += 
                    `${statusEmoji} <code>${row.license_key}</code>\n` +
                    `🏢 ${orgName} (${row.license_type})\n` +
                    `📅 До: ${expDate}\n\n`;
            }

            await sendMessage(chatId, responseMsg);
        } catch (err) {
            await sendMessage(chatId, '❌ Ошибка загрузки списка: ' + err.message);
        }
        return;
    }

    if (text.startsWith('/license ')) {
        const key = text.substring(9).trim();
        await showLicenseDetails(chatId, key);
        return;
    }

    if (text.startsWith('/extend ')) {
        const parts = text.substring(8).trim().split(/\s+/);
        if (parts.length < 2) {
            await sendMessage(chatId, '⚠️ Неверный формат. Используйте: <code>/extend KEY ДНИ</code>');
            return;
        }
        const key = parts[0];
        const days = parseInt(parts[1]);
        
        if (isNaN(days) || days <= 0) {
            await sendMessage(chatId, '⚠️ Количество дней должно быть положительным числом.');
            return;
        }

        const result = await extendLicenseInternal(key, days);
        if (result.error) {
            await sendMessage(chatId, '❌ Ошибка продления: ' + result.error);
        } else {
            await sendMessage(chatId, `🎉 <b>Успешно!</b>\n${result.message}\nОблако: ${result.cloud_synced ? '✅ Синхронизировано' : '⚠️ В очереди'}`);
        }
        return;
    }

    if (text.startsWith('/suspend ')) {
        const key = text.substring(9).trim();
        const result = await updateLicenseStatusInternal(key, 'suspended');
        if (result.error) {
            await sendMessage(chatId, '❌ Ошибка блокировки: ' + result.error);
        } else {
            await sendMessage(chatId, `🔒 <b>Лицензия приостановлена!</b>\n${result.message}`);
        }
        return;
    }

    if (text.startsWith('/activate ')) {
        const key = text.substring(10).trim();
        const result = await updateLicenseStatusInternal(key, 'active');
        if (result.error) {
            await sendMessage(chatId, '❌ Ошибка активации: ' + result.error);
        } else {
            await sendMessage(chatId, `🔓 <b>Лицензия активирована!</b>\n${result.message}`);
        }
        return;
    }

    if (text.startsWith('/editlicense')) {
        const parts = text.split(/\s+/);
        if (parts.length < 4) {
            await sendMessage(
                chatId, 
                `⚠️ <b>Неверный формат!</b> Используйте:\n` +
                `<code>/editlicense KEY ПОЛЕ ЗНАЧЕНИЕ</code>\n\n` +
                `<b>Доступные поля:</b>\n` +
                `• <code>expires</code> (дата в формате YYYY-MM-DD или lifetime)\n` +
                `• <code>devices</code> (макс. устройств)\n` +
                `• <code>users</code> (макс. пользователей)\n` +
                `• <code>status</code> (active или suspended)\n` +
                `• <code>company</code> (название организации в кавычках или без)\n\n` +
                `<i>Пример: /editlicense B5F3-87E6-20F4-7B7A expires 2028-05-02</i>`
            );
            return;
        }

        const key = parts[1];
        const field = parts[2].toLowerCase();
        const value = parts.slice(3).join(' ').replace(/^["']|["']$/g, ''); // убираем внешние кавычки

        const allowedFieldsMap = {
            expires: 'expires_at',
            expires_at: 'expires_at',
            devices: 'max_devices',
            max_devices: 'max_devices',
            users: 'max_users',
            max_users: 'max_users',
            company: 'company_name',
            company_name: 'company_name',
            status: 'status',
            type: 'license_type',
            license_type: 'license_type'
        };

        if (!allowedFieldsMap[field]) {
            await sendMessage(chatId, `⚠️ Неизвестное поле <code>${field}</code>. Доступные поля: expires, devices, users, status, company.`);
            return;
        }

        const dbField = allowedFieldsMap[field];
        const updatePayload = { [dbField]: value };

        await sendMessage(chatId, '⏳ <i>Обновляем данные лицензии и синхронизируем облако...</i>');
        const result = await updateLicenseFieldsInternal(key, updatePayload);
        
        if (result.error) {
            await sendMessage(chatId, `❌ <b>Ошибка обновления:</b>\n${result.error}`);
        } else {
            const syncStatus = result.cloud_synced ? '✅ Успешно синхронизировано с облаком' : '⚠️ Ошибка синхронизации с облаком';
            await sendMessage(
                chatId, 
                `🎉 <b>Лицензия успешно обновлена!</b>\n` +
                `Ключ: <code>${result.license.license_key}</code>\n` +
                `Изменено поле: <b>${field}</b> → <code>${value}</code>\n\n` +
                `☁️ ${syncStatus}`
            );
        }
        return;
    }

    // --- ИНТЕРАКТИВНЫЙ ВОРКФЛОУ: СОЗДАНИЕ ЛИЦЕНЗИИ ---
    if (text === '/newlicense') {
        userStates[chatId] = { step: 'awaiting_org_name' };
        await sendMessage(chatId, '🏢 <b>Шаг 1 из 3:</b>\nВведите название организации (клиента):');
        return;
    }

    // Обработка ответов в интерактивном режиме
    const state = userStates[chatId];
    if (state) {
        if (state.step === 'awaiting_org_name') {
            if (text.length < 2) {
                await sendMessage(chatId, '⚠️ Слишком короткое название. Пожалуйста, введите корректное имя:');
                return;
            }

            state.company_name = text;
            state.step = 'awaiting_license_type';

            // Показываем кнопки выбора тарифа
            const inlineKeyboard = {
                inline_keyboard: [
                    [
                        { text: '🎁 Пробная (7 дней)', callback_data: 'new_trial' },
                        { text: '📅 Месяц', callback_data: 'new_monthly' }
                    ],
                    [
                        { text: '📅 Год', callback_data: 'new_yearly' },
                        { text: '💎 Бессрочная', callback_data: 'new_lifetime' }
                    ]
                ]
            };

            await sendMessage(
                chatId, 
                `🏢 Организация: <b>${state.company_name}</b>\n\n` +
                `💳 <b>Шаг 2 из 3:</b> Выберите тип лицензии:`,
                { reply_markup: inlineKeyboard }
            );
            return;
        }

        if (state.step === 'awaiting_devices') {
            const devices = parseInt(text);
            if (isNaN(devices) || devices <= 0) {
                await sendMessage(chatId, '⚠️ Пожалуйста, введите положительное число (количество устройств):');
                return;
            }

            state.max_devices = devices;
            
            // Начинаем автоматическую генерацию лицензии
            await sendMessage(chatId, '⏳ <i>Создаем лицензию, разворачиваем структуру и синхронизируем облако...</i>');
            
            // Генерируем уникальный логин для администратора клиента
            const cleanName = transliterate(state.company_name)
                .toLowerCase()
                .replace(/[^a-z0-9]/g, '');
            const randomSuffix = crypto.randomInt(100, 999);
            const customer_username = `${cleanName || 'client'}_${randomSuffix}`;
            
            // Генерируем надежный случайный пароль
            const customer_password = crypto.randomBytes(6).toString('hex');

            const result = await createLicenseInternal({
                customer_name: state.company_name + ' Admin',
                customer_username,
                customer_password,
                company_name: state.company_name,
                license_type: state.license_type,
                trial_days: state.license_type === 'trial' ? 7 : 0,
                max_devices: state.max_devices,
                created_by: admin.user_id
            });

            if (result.error) {
                await sendMessage(chatId, '❌ <b>Ошибка при создании:</b>\n' + result.error);
            } else {
                const expStr = result.license.expires_at 
                    ? new Date(result.license.expires_at).toLocaleDateString('ru-RU')
                    : 'Бессрочно';

                const cardMsg = 
                    `🎉 <b>Лицензия успешно создана!</b>\n\n` +
                    `🔑 <b>Ключ:</b> <code>${result.license.license_key}</code>\n` +
                    `🏢 <b>Организация:</b> ${state.company_name}\n` +
                    `💳 <b>Тариф:</b> ${state.license_type.toUpperCase()}\n` +
                    `📱 <b>Устройств:</b> ${state.max_devices}\n` +
                    `📅 <b>Истекает:</b> ${expStr}\n\n` +
                    `👤 <b>ДОСТУП КЛИЕНТА (SmartPOS App):</b>\n` +
                    `• Логин: <code>${customer_username}</code>\n` +
                    `• Пароль: <code>${customer_password}</code>\n\n` +
                    `☁️ <b>Синхронизация в облаке:</b> ${result.cloud_synced ? '✅ Успешно' : '⚠️ В очереди'}\n\n` +
                    `<i>Скопируйте и отправьте эти учетные данные клиенту.</i>`;

                await sendMessage(chatId, cardMsg);
            }

            delete userStates[chatId];
            return;
        }
    }

    // Если команда не распознана и мы не в режиме ввода данных
    await sendMessage(
        chatId, 
        `❓ Неизвестная команда или ввод.\n` +
        `Отправьте /newlicense, чтобы запустить создание новой лицензии.`
    );
}

/**
 * Обработка нажатий на инлайн-кнопки
 */
async function handleCallbackQuery(callbackQuery) {
    const chatId = callbackQuery.message.chat.id;
    const data = callbackQuery.data;
    const messageId = callbackQuery.message.message_id;

    const state = userStates[chatId];
    if (!state || state.step !== 'awaiting_license_type') {
        await answerCallbackQuery(callbackQuery.id, '❌ Сессия устарела. Начните сначала: /newlicense');
        return;
    }

    if (data.startsWith('new_')) {
        const type = data.substring(4);
        state.license_type = type;
        state.step = 'awaiting_devices';

        await answerCallbackQuery(callbackQuery.id);
        
        await sendMessage(
            chatId,
            `💳 Выбран тариф: <b>${type.toUpperCase()}</b>\n\n` +
            `📱 <b>Шаг 3 из 3:</b> Введите максимальное количество устройств (касс) для клиента:\n` +
            `<i>(Обычно 1, 2 или 3)</i>`
        );
    }
}

/**
 * Просмотр полной информации о лицензии
 */
async function showLicenseDetails(chatId, key) {
    try {
        const cleanedKey = key.replace(/[^A-Z0-9]/g, '').toUpperCase();
        const result = await pool.query(
            `SELECT * FROM licenses WHERE REPLACE(license_key, '-', '') = $1`,
            [cleanedKey]
        );

        if (result.rows.length === 0) {
            await sendMessage(chatId, '❌ Лицензия с таким ключом не найдена.');
            return;
        }

        const l = result.rows[0];
        const statusEmoji = l.status === 'active' ? '🟢' : (l.status === 'suspended' ? '🟡' : '🔴');
        const expDate = l.expires_at ? new Date(l.expires_at).toLocaleString('ru-RU') : 'Бессрочно';
        const createdDate = new Date(l.created_at).toLocaleString('ru-RU');

        const details = 
            `${statusEmoji} <b>ЛИЦЕНЗИЯ:</b> <code>${l.license_key}</code>\n\n` +
            `🏢 <b>Компания:</b> ${l.company_name || 'Не указана'}\n` +
            `👤 <b>Имя клиента:</b> ${l.customer_name}\n` +
            `📞 <b>Телефон:</b> ${l.customer_phone || '-'}\n` +
            `✉️ <b>Email:</b> ${l.customer_email || '-'}\n` +
            `🔑 <b>Логин входа:</b> <code>${l.customer_username}</code>\n` +
            `💳 <b>Тип:</b> ${l.license_type.toUpperCase()}\n` +
            `📱 <b>Макс. устройств:</b> ${l.max_devices}\n` +
            `👥 <b>Макс. пользователей:</b> ${l.max_users}\n` +
            `⚙️ <b>Тип сервера:</b> ${l.server_type}\n` +
            `📅 <b>Создана:</b> ${createdDate}\n` +
            `📅 <b>Истекает:</b> ${expDate}\n\n` +
            `🔧 <i>Для управления используйте команды:</i>\n` +
            `• <code>/extend ${l.license_key} 30</code>\n` +
            `• <code>/suspend ${l.license_key}</code>\n` +
            `• <code>/activate ${l.license_key}</code>\n` +
            `• <code>/editlicense ${l.license_key} expires 2028-05-02</code>\n` +
            `• <code>/editlicense ${l.license_key} devices 10</code>`;

        await sendMessage(chatId, details);
    } catch (err) {
        await sendMessage(chatId, '❌ Ошибка поиска лицензии: ' + err.message);
    }
}

/**
 * Вспомогательная транслитерация для создания красивых логинов на английском
 */
function transliterate(word) {
    const answer = [];
    const converter = {
        'а': 'a', 'б': 'b', 'в': 'v', 'г': 'g', 'д': 'd', 'е': 'e', 'ё': 'e', 'ж': 'zh',
        'з': 'z', 'и': 'i', 'й': 'y', 'к': 'k', 'л': 'l', 'м': 'm', 'н': 'n', 'о': 'o',
        'п': 'p', 'р': 'r', 'с': 's', 'т': 't', 'у': 'u', 'ф': 'f', 'х': 'h', 'ц': 'c',
        'ч': 'ch', 'ш': 'sh', 'щ': 'sch', 'ь': '', 'ы': 'y', 'ъ': '', 'э': 'e', 'ю': 'yu',
        'я': 'ya',
        'А': 'A', 'Б': 'B', 'В': 'V', 'Г': 'G', 'Д': 'D', 'Е': 'E', 'Ё': 'E', 'Ж': 'Zh',
        'З': 'Z', 'И': 'I', 'Й': 'Y', 'К': 'K', 'Л': 'L', 'М': 'M', 'Н': 'N', 'О': 'O',
        'П': 'P', 'Р': 'R', 'С': 'S', 'Т': 'T', 'У': 'U', 'Ф': 'F', 'Х': 'H', 'Ц': 'C',
        'Ч': 'Ch', 'Ш': 'Sh', 'Щ': 'Sch', 'Ь': '', 'Ы': 'Y', 'Ъ': '', 'Э': 'E', 'Ю': 'Yu',
        'Я': 'Ya'
    };
    for (let i = 0; i < word.length; ++i) {
        if (converter[word[i]] === undefined) {
            answer.push(word[i]);
        } else {
            answer.push(converter[word[i]]);
        }
    }
    return answer.join('');
}

/**
 * Инициализация Telegram-бота администрирования
 */
export async function initTelegramAdminBot() {
    if (!TELEGRAM_BOT_TOKEN) {
        console.log('[TELEGRAM-BOT] ⚠️ TELEGRAM_BOT_TOKEN не задан. Бот администрирования отключен.');
        return;
    }

    const isCloud = process.env.RAILWAY_ENVIRONMENT || process.env.RAILWAY_PROJECT_ID;
    const serverUrl = process.env.PUBLIC_URL || 
        (process.env.RAILWAY_STATIC_URL ? `https://${process.env.RAILWAY_STATIC_URL}` : 'https://smartpos-pro-production.up.railway.app');

    if (isCloud && serverUrl) {
        const webhookUrl = `${serverUrl}/api/telegram/webhook/admin`;
        console.log(`[TELEGRAM-BOT] 🚀 Обнаружено облачное окружение. Настройка Webhook: ${webhookUrl}`);
        try {
            const res = await fetch(`${TELEGRAM_API_URL}/setWebhook?url=${webhookUrl}`);
            if (res.ok) {
                const data = await res.json();
                console.log('[TELEGRAM-BOT] Webhook setup response:', data);
            } else {
                console.error('[TELEGRAM-BOT] Failed to set Webhook:', res.statusText);
            }
        } catch (err) {
            console.error('[TELEGRAM-BOT] Webhook registration error:', err.message);
        }
    } else {
        console.log('[TELEGRAM-BOT] 🔌 Обнаружено локальное окружение. Запуск Long Polling...');
        startLongPolling();
    }
}

/**
 * Функция фонового опроса (Long Polling) для локальной разработки
 */
async function startLongPolling() {
    let offset = 0;
    while (true) {
        try {
            const response = await fetch(`${TELEGRAM_API_URL}/getUpdates?offset=${offset}&timeout=30`);
            if (response.ok) {
                const data = await response.json();
                if (data.ok && data.result) {
                    for (const update of data.result) {
                        offset = update.update_id + 1;
                        await handleTelegramUpdate(update);
                    }
                }
            } else {
                console.error('[TELEGRAM-BOT] Polling error response:', response.statusText);
                await new Promise(resolve => setTimeout(resolve, 10000));
            }
        } catch (err) {
            console.warn('[TELEGRAM-BOT] Polling connection error:', err.message);
            await new Promise(resolve => setTimeout(resolve, 10000));
        }
    }
}
