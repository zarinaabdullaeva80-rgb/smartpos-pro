/**
 * Скрипт проверки синхронизации с 1С
 * Тестирует все аспекты интеграции
 */

const axios = require('axios');

const API_URL = 'http://localhost:5000/api';
let authToken = null;

// Авторизация
async function login() {
    try {
        const response = await axios.post(`${API_URL}/auth/login`, {
            username: 'admin',
            password: 'admin123'
        });
        authToken = response.data.token;
        console.log('✅ Авторизация успешна');
        return true;
    } catch (error) {
        console.error('❌ Ошибка авторизации:', error.message);
        return false;
    }
}

// Получить заголовки с токеном
function getHeaders() {
    return { headers: { 'Authorization': `Bearer ${authToken}` } };
}

// 1. Проверка категорий
async function checkCategories() {
    console.log('\n📁 Проверка категорий...');
    try {
        const response = await axios.get(`${API_URL}/categories`, getHeaders());
        const categories = response.data;

        const topLevel = categories.filter(c => !c.parent_id);
        const subCategories = categories.filter(c => c.parent_id);

        console.log(`   Всего категорий: ${categories.length}`);
        console.log(`   Верхнего уровня: ${topLevel.length}`);
        console.log(`   Подкатегорий: ${subCategories.length}`);

        // Показать структуру
        topLevel.forEach(cat => {
            console.log(`   - ${cat.name} (ID: ${cat.id})`);
            const subs = subCategories.filter(s => s.parent_id === cat.id);
            subs.forEach(sub => {
                console.log(`     └─ ${sub.name} (ID: ${sub.id})`);
            });
        });

        return { total: categories.length, topLevel: topLevel.length, subCategories: subCategories.length };
    } catch (error) {
        console.error('❌ Ошибка при проверке категорий:', error.message);
        return null;
    }
}

// 2. Проверка товаров
async function checkProducts() {
    console.log('\n📦 Проверка товаров...');
    try {
        const response = await axios.get(`${API_URL}/products`, getHeaders());
        const products = response.data.products || [];
        const total = response.data.total || 0;

        console.log(`   Всего товаров: ${total}`);
        console.log(`   С категориями: ${products.filter(p => p.category_id).length}`);
        console.log(`   Без категории: ${products.filter(p => !p.category_id).length}`);
        console.log(`   Активных: ${products.filter(p => p.is_active).length}`);

        // Группировка по категориям
        const byCategory = {};
        products.forEach(p => {
            const catId = p.category_id || 'Без категории';
            byCategory[catId] = (byCategory[catId] || 0) + 1;
        });

        console.log('\n   По категориям:');
        Object.entries(byCategory).slice(0, 5).forEach(([catId, count]) => {
            console.log(`     - Категория ${catId}: ${count} товаров`);
        });

        return { total, withCategory: products.filter(p => p.category_id).length };
    } catch (error) {
        console.error('❌ Ошибка при проверке товаров:', error.message);
        return null;
    }
}

// 3. Проверка продаж
async function checkSales() {
    console.log('\n💰 Проверка продаж...');
    try {
        const response = await axios.get(`${API_URL}/sales`, getHeaders());
        const sales = response.data.sales || [];
        const total = response.data.total || 0;

        const confirmed = sales.filter(s => s.status === 'confirmed').length;
        const pending = sales.filter(s => s.status === 'pending').length;
        const cancelled = sales.filter(s => s.status === 'cancelled').length;

        console.log(`   Всего продаж: ${total}`);
        console.log(`   Подтверждённых: ${confirmed}`);
        console.log(`   Ожидающих: ${pending}`);
        console.log(`   Отменённых: ${cancelled}`);

        if (sales.length > 0) {
            const lastSale = sales[0];
            console.log(`\n   Последняя продажа:`);
            console.log(`     - Дата: ${lastSale.created_at}`);
            console.log(`     - Сумма: ${lastSale.total_amount}`);
            console.log(`     - Статус: ${lastSale.status}`);
        }

        return { total, confirmed, pending, cancelled };
    } catch (error) {
        console.error('❌ Ошибка при проверке продаж:', error.message);
        return null;
    }
}

// 4. Проверка маппинга external_id
async function checkExternalMapping() {
    console.log('\n🔗 Проверка external_id_mapping...');
    try {
        // Проверка через экспорт товаров
        const response = await axios.get(`${API_URL}/sync1c/export/products?limit=10`, getHeaders());
        const products = response.data.data || [];

        const withExternalId = products.filter(p => p.external_id_1c).length;
        const withoutExternalId = products.filter(p => !p.external_id_1c).length;

        console.log(`   Товаров проверено: ${products.length}`);
        console.log(`   С external_id_1c: ${withExternalId}`);
        console.log(`   Без external_id_1c: ${withoutExternalId}`);

        if (withoutExternalId > 0) {
            console.log('   ⚠️  Не все товары имеют маппинг для 1С!');
        }

        return { total: products.length, mapped: withExternalId, unmapped: withoutExternalId };
    } catch (error) {
        console.error('❌ Ошибка при проверке маппинга:', error.message);
        return null;
    }
}

// 5. Проверка логов синхронизации
async function checkSyncLogs() {
    console.log('\n📜 Проверка логов синхронизации...');
    try {
        const response = await axios.get(`${API_URL}/sync1c/log?limit=10`, getHeaders());
        const logs = response.data || [];

        console.log(`   Всего записей в логе: ${logs.length}`);

        if (logs.length > 0) {
            console.log('\n   Последние синхронизации:');
            logs.slice(0, 5).forEach(log => {
                const duration = log.duration_ms ? `${log.duration_ms}ms` : 'N/A';
                console.log(`     - ${log.sync_type} (${log.direction}): ${log.status} [${duration}]`);
                if (log.records_total) {
                    console.log(`       Обработано: ${log.records_success}/${log.records_total} (ошибок: ${log.records_error || 0})`);
                }
            });
        } else {
            console.log('   ⚠️  Логи синхронизации пусты! Синхронизация не выполнялась.');
        }

        return { totalLogs: logs.length };
    } catch (error) {
        console.error('❌ Ошибка при проверке логов:', error.message);
        return null;
    }
}

// 6. Проверка настроек 1С
async function check1CSettings() {
    console.log('\n⚙️  Проверка настроек 1С...');
    try {
        const response = await axios.get(`${API_URL}/settings/1c/config`, getHeaders());
        const settings = response.data;

        console.log(`   Настройки 1С:`);
        console.log(`     - Настроены: ${settings ? 'Да' : 'Нет'}`);
        if (settings && settings.setting_value) {
            const config = JSON.parse(settings.setting_value);
            console.log(`     - URL: ${config.url || 'Не указан'}`);
            console.log(`     - Логин: ${config.username || 'Не указан'}`);
            console.log(`     - Включено: ${config.enabled ? 'Да' : 'Нет'}`);
        }

        return { configured: !!settings };
    } catch (error) {
        if (error.response && error.response.status === 404) {
            console.log('   ⚠️  Настройки 1С не найдены!');
            return { configured: false };
        }
        console.error('❌ Ошибка при проверке настроек:', error.message);
        return null;
    }
}

// Главная функция
async function main() {
    console.log('═══════════════════════════════════════');
    console.log('   Диагностика синхронизации с 1С');
    console.log('═══════════════════════════════════════\n');

    // Авторизация
    if (!await login()) {
        process.exit(1);
    }

    // Проверки
    const results = {
        categories: await checkCategories(),
        products: await checkProducts(),
        sales: await checkSales(),
        mapping: await checkExternalMapping(),
        logs: await checkSyncLogs(),
        settings: await check1CSettings()
    };

    // Итоговый отчёт
    console.log('\n═══════════════════════════════════════');
    console.log('   Итоговый отчёт');
    console.log('═══════════════════════════════════════\n');

    // Проблемы
    const issues = [];

    if (!results.categories || results.categories.total === 0) {
        issues.push('⚠️  Категории отсутствуют в системе');
    }

    if (!results.products || results.products.total === 0) {
        issues.push('⚠️  Товары отсутствуют в системе');
    }

    if (results.mapping && results.mapping.unmapped > 0) {
        issues.push(`⚠️  ${results.mapping.unmapped} товаров без маппинга для 1С`);
    }

    if (!results.logs || results.logs.totalLogs === 0) {
        issues.push('⚠️  Синхронизация ни разу не выполнялась');
    }

    if (!results.settings || !results.settings.configured) {
        issues.push('⚠️  Настройки 1С не настроены');
    }

    if (results.sales && results.sales.confirmed === 0) {
        issues.push('⚠️  Нет подтверждённых продаж для экспорта в 1С');
    }

    if (issues.length > 0) {
        console.log('Обнаруженные проблемы:\n');
        issues.forEach(issue => console.log(issue));
    } else {
        console.log('✅ Все проверки пройдены успешно!');
    }

    console.log('\n═══════════════════════════════════════\n');
}

// Запуск
main().catch(console.error);
