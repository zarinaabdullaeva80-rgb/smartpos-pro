import pg from 'pg';
const { Pool } = pg;

const pool = new Pool({
    connectionString: process.env.DATABASE_URL || 'postgresql://postgres:Smash2206@localhost:5432/accounting_db'
});

async function fixUsernameConstraint() {
    const client = await pool.connect();
    try {
        // 1. Показать текущие constraints
        console.log('=== Текущие UNIQUE constraints на таблице users ===');
        const constraints = await client.query(`
            SELECT conname, pg_get_constraintdef(c.oid) as def
            FROM pg_constraint c
            JOIN pg_class t ON c.conrelid = t.oid
            WHERE t.relname = 'users' AND contype = 'u'
        `);
        console.log(constraints.rows);

        // 2. Проверить наличие колонки organization_id
        const colCheck = await client.query(`
            SELECT column_name FROM information_schema.columns 
            WHERE table_name = 'users' AND column_name = 'organization_id'
        `);
        if (colCheck.rows.length === 0) {
            console.log('⚠️ Колонка organization_id не найдена, добавляем...');
            await client.query('ALTER TABLE users ADD COLUMN IF NOT EXISTS organization_id INTEGER');
        }
        console.log('✅ Колонка organization_id существует');

        // 3. Удалить старый UNIQUE constraint на username
        for (const c of constraints.rows) {
            if (c.def.includes('username') && !c.def.includes('organization_id')) {
                console.log(`🗑️ Удаляю старый constraint: ${c.conname} → ${c.def}`);
                await client.query(`ALTER TABLE users DROP CONSTRAINT IF EXISTS "${c.conname}"`);
            }
        }

        // 4. Также удалить старый уникальный индекс если есть
        const indexes = await client.query(`
            SELECT indexname, indexdef FROM pg_indexes 
            WHERE tablename = 'users' AND indexdef ILIKE '%unique%' AND indexdef ILIKE '%username%'
        `);
        for (const idx of indexes.rows) {
            if (!idx.indexdef.includes('organization_id')) {
                console.log(`🗑️ Удаляю старый индекс: ${idx.indexname}`);
                await client.query(`DROP INDEX IF EXISTS "${idx.indexname}"`);
            }
        }

        // 5. Создать новый UNIQUE constraint (username + organization_id)
        // Используем UNIQUE INDEX вместо CONSTRAINT для поддержки COALESCE (NULL-safe)
        console.log('🔧 Создаю новый уникальный индекс: (username, COALESCE(organization_id, 0))...');
        await client.query(`
            CREATE UNIQUE INDEX IF NOT EXISTS idx_users_username_org 
            ON users (LOWER(username), COALESCE(organization_id, 0))
        `);
        console.log('✅ Новый индекс создан: idx_users_username_org');

        // 6. Проверить результат
        const newConstraints = await client.query(`
            SELECT indexname, indexdef FROM pg_indexes 
            WHERE tablename = 'users' AND indexdef ILIKE '%username%'
        `);
        console.log('\n=== Итоговые индексы ===');
        newConstraints.rows.forEach(r => console.log(`  ${r.indexname}: ${r.indexdef}`));

        console.log('\n✅ ГОТОВО! Теперь разные организации могут иметь одинаковые логины.');

    } catch (err) {
        console.error('❌ Ошибка:', err.message);
    } finally {
        client.release();
        await pool.end();
    }
}

fixUsernameConstraint();
