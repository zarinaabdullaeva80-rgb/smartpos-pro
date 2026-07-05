/**
 * РЕГРЕССИОННЫЙ ТЕСТ: Проверка лицензии в auth middleware
 * 
 * Этот тест защищает от возврата бага, при котором пользователь с активной
 * лицензией получал ошибку "лицензия истекла" из-за коллизии числовых ID.
 * 
 * История: На сервере f885 лицензия Smash22 имела organization_id=13,
 * а лицензия Nurullo262 имела id=13 (expired). Запрос
 * "WHERE id=13 OR organization_id=13" возвращал чужую просроченную лицензию.
 * 
 * Дата обнаружения бага: 2026-07-05
 * Файл с исправлением: server/src/middleware/auth.js
 */

import assert from 'assert';
import { createRequire } from 'module';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { readFileSync } from 'fs';
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Мок Pool для unit-тестирования без реальной БД
class MockPool {
    constructor(scenario) {
        this.scenario = scenario;
        this.queries = [];
    }
    async query(sql, params) {
        this.queries.push({ sql: sql.trim(), params });
        return this.scenario(sql, params);
    }
}

/**
 * Симулирует точный сценарий бага:
 * - user.license_id = 12  (активная лицензия Smash22)
 * - user.organization_id = 13 (это НЕ license.id=13!)
 * - В БД: license id=12 -> active, license id=13 -> expired
 * 
 * Старый код использовал organization_id (=13) в запросе "WHERE id=13 OR org_id=13"
 * и получал expired лицензию id=13. Новый код должен найти id=12 (active).
 */
async function testLicenseIdCollisionRegression() {
    console.log('🧪 Тест: Коллизия license.id и organization_id (регрессия Smash22)');

    // Данные теста
    const user = {
        id: 22,
        username: 'Smash22',
        user_type: 'admin',
        license_id: 12,         // Активная лицензия Smash22
        organization_id: 13     // НЕ совпадает с license_id — другой числовой ряд!
    };

    const licenseTable = {
        12: { id: 12, status: 'active', expires_at: '2028-04-24T07:00:00.000Z' },   // Smash22
        13: { id: 13, status: 'expired', expires_at: '2026-06-02T01:59:59.999Z' }   // Nurullo262
    };

    const buggyScenario = (sql, params) => {
        // Симулирует старый баг: WHERE id=$1 OR organization_id=$1
        // Если params[0] = 13 (organization_id), возвращает expired лицензию id=13
        if (sql.includes('OR organization_id')) {
            const queryId = params[0];
            // Старая логика: используется organization_id как ID лицензии
            const found = licenseTable[queryId];
            return { rows: found ? [found] : [] };
        }
        return { rows: [] };
    };

    const fixedScenario = (sql, params) => {
        // Симулирует исправленный код: сначала WHERE id=$1
        if (sql.includes('WHERE id = $1') && !sql.includes('organization_id')) {
            const found = licenseTable[params[0]];
            return { rows: found ? [found] : [] };
        }
        // Fallback по organization_id (не вызывается если license_id нашёл результат)
        if (sql.includes('WHERE organization_id = $1')) {
            // Ищем по organization_id поле (оно = 13, но в licenseTable.organization_id нет)
            return { rows: [] };
        }
        return { rows: [] };
    };

    // ===== ТЕСТ 1: Старый баг воспроизводится =====
    {
        const mockPool = new MockPool(buggyScenario);
        // Симулируем старую логику
        const licenseCheckId = user.organization_id || user.license_id; // = 13 (БАГ!)
        const licRes = await mockPool.query(
            'SELECT status, expires_at FROM licenses WHERE id = $1 OR organization_id = $1 LIMIT 1',
            [licenseCheckId]
        );
        const bugStatus = licRes.rows.length > 0 ? licRes.rows[0].status : 'not_found';
        assert.strictEqual(bugStatus, 'expired', 'БАГ должен воспроизводиться на старом коде');
        console.log('  ✅ Старый баг подтверждён: organization_id=13 → license id=13 → expired');
    }

    // ===== ТЕСТ 2: Исправление работает правильно =====
    {
        const mockPool = new MockPool(fixedScenario);
        let licRes;

        // Новая логика: сначала по license_id
        if (user.license_id) {
            licRes = await mockPool.query(
                'SELECT id, status, expires_at FROM licenses WHERE id = $1 LIMIT 1',
                [user.license_id]  // = 12 → active!
            );
        }

        // Fallback по organization_id только если license_id не нашёл
        if ((!licRes || licRes.rows.length === 0) && user.organization_id) {
            licRes = await mockPool.query(
                'SELECT id, status, expires_at FROM licenses WHERE organization_id = $1 LIMIT 1',
                [user.organization_id]
            );
        }

        assert.ok(licRes && licRes.rows.length > 0, 'Лицензия должна быть найдена');
        assert.strictEqual(licRes.rows[0].status, 'active', 'Лицензия Smash22 должна быть active!');
        assert.strictEqual(licRes.rows[0].id, 12, 'Должна быть найдена именно лицензия id=12');

        // Проверяем что organization_id=13 НЕ был использован (запрос по org_id не делался)
        const orgIdQueryMade = mockPool.queries.some(q => q.sql.includes('organization_id = $1'));
        assert.strictEqual(orgIdQueryMade, false, 'Запрос по organization_id НЕ должен делаться когда license_id найден');

        console.log('  ✅ Исправление работает: license_id=12 → active (organization_id=13 проигнорирован)');
    }

    // ===== ТЕСТ 3: Проверка файла auth.js на отсутствие запрещённого паттерна =====
    {
        const authPath = join(__dirname, '../middleware/auth.js');
        const authContent = readFileSync(authPath, 'utf8');

        const forbiddenPattern = /WHERE\s+id\s*=\s*\$\d+\s+OR\s+organization_id\s*=\s*\$\d+/i;
        const hasBug = forbiddenPattern.test(authContent);
        assert.strictEqual(hasBug, false,
            '❌ КРИТИЧНО: В auth.js обнаружен запрещённый паттерн "WHERE id=$X OR organization_id=$X"!\n' +
            'Это вызовет возврат чужой просроченной лицензии. См. .agents/AGENTS.md для деталей.'
        );
        console.log('  ✅ auth.js не содержит запрещённого паттерна смешивания ID');
    }

    console.log('\n✅ ВСЕ ТЕСТЫ ПРОЙДЕНЫ — регрессия не обнаружена\n');
}

// Запуск
testLicenseIdCollisionRegression().catch(err => {
    console.error('\n❌ ТЕСТ ПРОВАЛИЛСЯ:', err.message);
    process.exit(1);
});
