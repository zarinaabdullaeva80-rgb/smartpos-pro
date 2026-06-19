import pool from '../config/database.js';
import { syncToCloud } from './licenseSync.js';

/**
 * Создание новой лицензии (внутренняя бизнес-логика)
 */
export async function createLicenseInternal({
    customer_name,
    customer_email = null,
    customer_phone = null,
    customer_username,
    customer_password,
    company_name,
    license_type,
    max_devices = 1,
    max_users = 5,
    max_pos_terminals = 1,
    trial_days = 0,
    features = {},
    server_type = 'cloud',
    server_url = null,
    server_api_key = null,
    created_by
}, req = null) {
    try {
        // Validate customer credentials
        if (!customer_username || !customer_password) {
            return { error: 'Требуются customer_username и customer_password' };
        }

        // Validate server configuration
        if (server_type === 'self_hosted' && !server_url) {
            return { error: 'Для self_hosted требуется указать server_url' };
        }

        // Check username uniqueness
        const existingUser = await pool.query(
            'SELECT id FROM licenses WHERE customer_username = $1',
            [customer_username]
        );

        if (existingUser.rows.length > 0) {
            return { error: 'Логин уже используется другой лицензией' };
        }

        // Hash password
        const bcryptModule = await import('bcrypt');
        const bcrypt = bcryptModule.default || bcryptModule;
        const customer_password_hash = await bcrypt.hash(customer_password, 10);

        // Генерировать ключ
        const keyResult = await pool.query('SELECT generate_license_key()');
        const license_key = keyResult.rows[0].generate_license_key;

        // Вычислить срок действия
        let expires_at = null;
        if (license_type === 'trial' && trial_days > 0) {
            expires_at = new Date();
            expires_at.setDate(expires_at.getDate() + parseInt(trial_days));
            expires_at.setHours(23, 59, 59, 999);
        } else if (license_type === 'monthly') {
            expires_at = new Date();
            expires_at.setMonth(expires_at.getMonth() + 1);
            expires_at.setHours(23, 59, 59, 999);
        } else if (license_type === 'yearly') {
            expires_at = new Date();
            expires_at.setFullYear(expires_at.getFullYear() + 1);
            expires_at.setHours(23, 59, 59, 999);
        }

        const result = await pool.query(`
            INSERT INTO licenses (
                license_key, customer_name, customer_email, customer_phone,
                customer_username, customer_password_hash,
                company_name, license_type, max_devices, max_users,
                max_pos_terminals, expires_at, trial_days, features, created_by,
                server_type, server_url, server_api_key
            )
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18)
            RETURNING *
        `, [
            license_key, customer_name, customer_email, customer_phone,
            customer_username, customer_password_hash,
            company_name, license_type, max_devices, max_users,
            max_pos_terminals, expires_at, trial_days, JSON.stringify(features), created_by,
            server_type, server_url, server_api_key
        ]);

        const license = result.rows[0];

        // Логирование в историю лицензий
        await pool.query(`
            INSERT INTO license_history (license_id, action, performed_by)
            VALUES ($1, 'created', $2)
        `, [license.id, created_by]);

        // Авто-создание организации
        const licenseId = license.id;
        const orgCode = 'ORG-' + Date.now().toString(36).toUpperCase();
        const orgName = company_name || customer_name || customer_username;
        let organizationId = null;

        try {
            const orgResult = await pool.query(`
                INSERT INTO organizations (name, code, license_key, is_active)
                VALUES ($1, $2, $3, true) RETURNING id
            `, [orgName, orgCode, license_key]);
            organizationId = orgResult.rows[0].id;

            // Привязать лицензию к организации
            try {
                await pool.query('UPDATE licenses SET organization_id = $1 WHERE id = $2', [organizationId, licenseId]);
            } catch (e) { /* column may not exist */ }

            // Создать пользователя-владельца
            await pool.query(`
                INSERT INTO users (username, email, password_hash, full_name, role,
                                   license_id, organization_id, user_type, is_active)
                VALUES ($1, $2, $3, $4, 'Администратор', $5, $6, 'owner', true)
                ON CONFLICT (username) DO UPDATE SET organization_id = $6, license_id = $5
            `, [
                customer_username,
                customer_email || customer_username + '@smartpos.local',
                customer_password_hash,
                customer_name || customer_username,
                licenseId, organizationId
            ]);

            // Создать склад по умолчанию
            await pool.query(`
                INSERT INTO warehouses (name, code, is_active, organization_id)
                VALUES ('Основной склад', $1, true, $2)
            `, ['WH-' + organizationId, organizationId]);

            console.log(`[LICENSE-SERVICE] Created org #${organizationId} "${orgName}" + warehouse + owner for license #${licenseId}`);
        } catch (orgErr) {
            console.error('[LICENSE-SERVICE] Org creation error (license still created):', orgErr.message);
        }

        // Автоматическая синхронизация на Railway Cloud
        let syncResult = null;
        try {
            syncResult = await syncToCloud({
                ...license,
                customer_password_hash
            }, req);
            console.log('[LICENSE-SERVICE] Cloud sync result:', syncResult?.success ? '✅ OK' : '⚠️ ' + (syncResult?.error || 'unknown'));
        } catch (syncErr) {
            console.warn('[LICENSE-SERVICE] Cloud sync error (non-blocking):', syncErr.message);
        }

        return {
            success: true,
            license,
            organization_id: organizationId,
            cloud_synced: syncResult?.success || false,
            message: `Лицензия создана. Организация "${orgName}" создана. Передайте клиенту логин: ${customer_username}`
        };

    } catch (error) {
        console.error('[LICENSE-SERVICE] Error creating license:', error);
        return { error: error.message };
    }
}

/**
 * Продление лицензии по ключу
 */
export async function extendLicenseInternal(licenseKey, days, req = null) {
    try {
        const cleanedKey = licenseKey.replace(/[^A-Z0-9]/g, '').toUpperCase();
        
        // Найти лицензию
        const licenseResult = await pool.query(
            `SELECT * FROM licenses WHERE REPLACE(license_key, '-', '') = $1`,
            [cleanedKey]
        );

        if (licenseResult.rows.length === 0) {
            return { error: 'Лицензия с таким ключом не найдена' };
        }

        const license = licenseResult.rows[0];
        
        // Вычислить новую дату окончания
        let newExpiresAt = new Date(license.expires_at || new Date());
        // Если лицензия уже просрочена, начинаем продление с сегодняшнего дня
        if (newExpiresAt < new Date()) {
            newExpiresAt = new Date();
        }
        newExpiresAt.setDate(newExpiresAt.getDate() + parseInt(days));
        newExpiresAt.setHours(23, 59, 59, 999);

        // Обновить лицензию в БД
        const updateResult = await pool.query(
            `UPDATE licenses 
             SET expires_at = $1, status = 'active', updated_at = NOW() 
             WHERE id = $2 RETURNING *`,
            [newExpiresAt, license.id]
        );

        const updatedLicense = updateResult.rows[0];

        // Лог в историю
        const performed_by = req?.user?.id || 1; // Default to admin user id 1 if triggered by bot
        await pool.query(
            `INSERT INTO license_history (license_id, action, performed_by, details)
             VALUES ($1, 'extended', $2, $3)`,
            [license.id, performed_by, JSON.stringify({ extended_days: days, new_expires_at: newExpiresAt })]
        );

        // Синхронизация с облаком
        let syncResult = null;
        try {
            syncResult = await syncToCloud(updatedLicense, req);
        } catch (syncErr) {
            console.warn('[LICENSE-SERVICE] Cloud sync error:', syncErr.message);
        }

        return {
            success: true,
            license: updatedLicense,
            cloud_synced: syncResult?.success || false,
            message: `Лицензия ${license.license_key} успешно продлена на ${days} дней до ${newExpiresAt.toLocaleDateString('ru-RU')}`
        };

    } catch (error) {
        console.error('[LICENSE-SERVICE] Error extending license:', error);
        return { error: error.message };
    }
}

/**
 * Изменение статуса лицензии (активация / блокировка)
 */
export async function updateLicenseStatusInternal(licenseKey, status, req = null) {
    try {
        const cleanedKey = licenseKey.replace(/[^A-Z0-9]/g, '').toUpperCase();
        
        if (status !== 'active' && status !== 'suspended' && status !== 'expired') {
            return { error: 'Неверный статус лицензии' };
        }

        // Найти лицензию
        const licenseResult = await pool.query(
            `SELECT * FROM licenses WHERE REPLACE(license_key, '-', '') = $1`,
            [cleanedKey]
        );

        if (licenseResult.rows.length === 0) {
            return { error: 'Лицензия с таким ключом не найдена' };
        }

        const license = licenseResult.rows[0];

        // Обновить лицензию в БД
        const updateResult = await pool.query(
            `UPDATE licenses 
             SET status = $1, updated_at = NOW() 
             WHERE id = $2 RETURNING *`,
            [status, license.id]
        );

        const updatedLicense = updateResult.rows[0];

        // Синхронизировать активность организации
        try {
            const isOrgActive = status === 'active';
            if (updatedLicense.organization_id) {
                await pool.query(
                    'UPDATE organizations SET is_active = $1 WHERE id = $2',
                    [isOrgActive, updatedLicense.organization_id]
                );
            }
            await pool.query(
                'UPDATE organizations SET is_active = $1 WHERE license_key = $2',
                [isOrgActive, updatedLicense.license_key]
            );
        } catch (orgErr) {
            console.warn('[LICENSE-SERVICE] Failed to update organization active status:', orgErr.message);
        }

        // Лог в историю
        const performed_by = req?.user?.id || 1;
        await pool.query(
            `INSERT INTO license_history (license_id, action, performed_by, details)
             VALUES ($1, $2, $3, $4)`,
            [license.id, status === 'active' ? 'activated' : 'suspended', performed_by, JSON.stringify({ status })]
        );

        // Синхронизация с облаком
        let syncResult = null;
        try {
            syncResult = await syncToCloud(updatedLicense, req);
        } catch (syncErr) {
            console.warn('[LICENSE-SERVICE] Cloud sync error:', syncErr.message);
        }

        return {
            success: true,
            license: updatedLicense,
            cloud_synced: syncResult?.success || false,
            message: `Статус лицензии ${license.license_key} изменен на "${status}"`
        };

    } catch (error) {
        console.error('[LICENSE-SERVICE] Error updating license status:', error);
        return { error: error.message };
    }
}

/**
 * Ручное обновление полей лицензии
 */
export async function updateLicenseFieldsInternal(licenseKey, fields, req = null) {
    try {
        const cleanedKey = licenseKey.replace(/[^A-Z0-9]/g, '').toUpperCase();
        
        // Найти лицензию
        const licenseResult = await pool.query(
            `SELECT * FROM licenses WHERE REPLACE(license_key, '-', '') = $1`,
            [cleanedKey]
        );

        if (licenseResult.rows.length === 0) {
            return { error: 'Лицензия с таким ключом не найдена' };
        }

        const license = licenseResult.rows[0];
        
        // Валидация и подготовка полей для обновления
        const updateFields = [];
        const updateValues = [];
        const historyDetails = {};
        
        const allowedFields = {
            expires_at: 'expires_at',
            expires: 'expires_at',
            max_devices: 'max_devices',
            devices: 'max_devices',
            max_users: 'max_users',
            users: 'max_users',
            company_name: 'company_name',
            company: 'company_name',
            customer_name: 'customer_name',
            name: 'customer_name',
            status: 'status',
            license_type: 'license_type',
            type: 'license_type'
        };

        for (const [key, val] of Object.entries(fields)) {
            const dbField = allowedFields[key.toLowerCase()];
            if (dbField) {
                let parsedVal = val;
                if (dbField === 'expires_at') {
                    if (val === 'lifetime' || val === 'null' || val === null || val === '') {
                        parsedVal = null;
                    } else {
                        parsedVal = new Date(val);
                        if (isNaN(parsedVal.getTime())) {
                            return { error: `Неверный формат даты для expires_at: ${val}` };
                        }
                    }
                } else if (dbField === 'max_devices' || dbField === 'max_users') {
                    parsedVal = parseInt(val);
                    if (isNaN(parsedVal) || parsedVal <= 0) {
                        return { error: `Поле ${dbField} должно быть положительным числом` };
                    }
                }
                
                updateFields.push(`${dbField} = $${updateFields.length + 1}`);
                updateValues.push(parsedVal);
                historyDetails[dbField] = { old: license[dbField], new: parsedVal };
            }
        }
        
        if (updateFields.length === 0) {
            return { error: 'Не указаны корректные поля для обновления' };
        }
        
        // Добавляем ID в значения для WHERE
        updateValues.push(license.id);
        const query = `
            UPDATE licenses 
            SET ${updateFields.join(', ')}, updated_at = NOW() 
            WHERE id = $${updateValues.length} 
            RETURNING *
        `;
        
        const updateResult = await pool.query(query, updateValues);
        const updatedLicense = updateResult.rows[0];

        // Лог в историю
        const performed_by = req?.user?.id || 1;
        await pool.query(
            `INSERT INTO license_history (license_id, action, performed_by, details)
             VALUES ($1, 'manual_update', $2, $3)`,
             [license.id, performed_by, JSON.stringify(historyDetails)]
        );

        // Если обновился статус, обновляем статус организации
        if (fields.status) {
            const isOrgActive = updatedLicense.status === 'active';
            if (updatedLicense.organization_id) {
                await pool.query('UPDATE organizations SET is_active = $1 WHERE id = $2', [isOrgActive, updatedLicense.organization_id]);
            }
            await pool.query('UPDATE organizations SET name = $1 WHERE license_key = $2', [updatedLicense.company_name, updatedLicense.license_key]);
        }
        
        // Если обновилось название компании, обновим и название организации
        if (fields.company || fields.company_name) {
            if (updatedLicense.organization_id) {
                await pool.query('UPDATE organizations SET name = $1 WHERE id = $2', [updatedLicense.company_name, updatedLicense.organization_id]);
            }
        }

        // Синхронизация с облаком
        let syncResult = null;
        try {
            syncResult = await syncToCloud(updatedLicense, req);
        } catch (syncErr) {
            console.warn('[LICENSE-SERVICE] Cloud sync error:', syncErr.message);
        }

        return {
            success: true,
            license: updatedLicense,
            cloud_synced: syncResult?.success || false,
            message: `Лицензия ${license.license_key} успешно обновлена.`
        };

    } catch (error) {
        console.error('[LICENSE-SERVICE] Error updating license fields:', error);
        return { error: error.message };
    }
}

