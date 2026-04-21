const pool = require('../config/database');

// Get all configurations
const getAllConfigurations = async (req, res) => {
    try {
        const result = await pool.query(`
            SELECT 
                c.id,
                c.code,
                c.name,
                c.category,
                c.description,
                c.icon,
                c.is_active,
                COUNT(cm.id) as modules_count
            FROM configurations c
            LEFT JOIN configuration_modules cm ON c.id = cm.configuration_id
            WHERE c.is_active = true
            GROUP BY c.id
            ORDER BY c.category, c.name
        `);

        res.json(result.rows);
    } catch (error) {
        console.error('Error fetching configurations:', error);
        res.status(500).json({ error: 'Ошибка при получении конфигураций' });
    }
};

// Get configuration by ID
const getConfigurationById = async (req, res) => {
    try {
        const { id } = req.params;

        const result = await pool.query(`
            SELECT * FROM configurations WHERE id = $1
        `, [id]);

        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'Конфигурация не найдена' });
        }

        res.json(result.rows[0]);
    } catch (error) {
        console.error('Error fetching configuration:', error);
        res.status(500).json({ error: 'Ошибка при получении конфигурации' });
    }
};

// Get modules for a configuration
const getConfigurationModules = async (req, res) => {
    try {
        const { id } = req.params;

        const result = await pool.query(`
            SELECT 
                cm.id,
                cm.module_code,
                cm.module_name,
                cm.is_enabled,
                cm.sort_order
            FROM configuration_modules cm
            WHERE cm.configuration_id = $1 AND cm.is_enabled = true
            ORDER BY cm.sort_order
        `, [id]);

        res.json(result.rows);
    } catch (error) {
        console.error('Error fetching configuration modules:', error);
        res.status(500).json({ error: 'Ошибка при получении модулей конфигурации' });
    }
};

// Get user's configuration
const getUserConfiguration = async (req, res) => {
    try {
        const userId = req.user.id;

        const result = await pool.query(`
            SELECT 
                c.id,
                c.code,
                c.name,
                c.category,
                c.description,
                c.icon,
                uc.created_at as selected_at
            FROM user_configurations uc
            JOIN configurations c ON uc.configuration_id = c.id
            WHERE uc.user_id = $1 AND uc.is_active = true
        `, [userId]);

        if (result.rows.length === 0) {
            return res.json(null);
        }

        res.json(result.rows[0]);
    } catch (error) {
        console.error('Error fetching user configuration:', error);
        res.status(500).json({ error: 'Ошибка при получении конфигурации пользователя' });
    }
};

// Get user's active modules
const getUserModules = async (req, res) => {
    try {
        const userId = req.user.id;

        const result = await pool.query(`
            SELECT 
                cm.module_code,
                cm.module_name,
                cm.sort_order
            FROM user_configurations uc
            JOIN configuration_modules cm ON uc.configuration_id = cm.configuration_id
            WHERE uc.user_id = $1 AND uc.is_active = true AND cm.is_enabled = true
            ORDER BY cm.sort_order
        `, [userId]);

        res.json(result.rows);
    } catch (error) {
        console.error('Error fetching user modules:', error);
        res.status(500).json({ error: 'Ошибка при получении модулей пользователя' });
    }
};

// Set user's configuration
const setUserConfiguration = async (req, res) => {
    const client = await pool.connect();

    try {
        const userId = req.user.id;
        const { configurationId } = req.body;

        if (!configurationId) {
            return res.status(400).json({ error: 'Не указана конфигурация' });
        }

        await client.query('BEGIN');

        // Check if configuration exists
        const configCheck = await client.query(
            'SELECT id FROM configurations WHERE id = $1 AND is_active = true',
            [configurationId]
        );

        if (configCheck.rows.length === 0) {
            await client.query('ROLLBACK');
            return res.status(404).json({ error: 'Конфигурация не найдена' });
        }

        // Deactivate all previous configurations for this user
        await client.query(`
            UPDATE user_configurations 
            SET is_active = false 
            WHERE user_id = $1
        `, [userId]);

        // Check if user already has this configuration (reactivate it)
        const existingConfig = await client.query(`
            SELECT id FROM user_configurations 
            WHERE user_id = $1 AND configuration_id = $2
        `, [userId, configurationId]);

        if (existingConfig.rows.length > 0) {
            // Reactivate existing configuration
            await client.query(`
                UPDATE user_configurations 
                SET is_active = true, updated_at = CURRENT_TIMESTAMP
                WHERE id = $1
            `, [existingConfig.rows[0].id]);
        } else {
            // Insert new configuration
            await client.query(`
                INSERT INTO user_configurations (user_id, configuration_id, is_active)
                VALUES ($1, $2, true)
            `, [userId, configurationId]);
        }

        await client.query('COMMIT');

        // Fetch and return the updated configuration
        const result = await pool.query(`
            SELECT 
                c.id,
                c.code,
                c.name,
                c.category,
                c.description,
                c.icon
            FROM user_configurations uc
            JOIN configurations c ON uc.configuration_id = c.id
            WHERE uc.user_id = $1 AND uc.is_active = true
        `, [userId]);

        res.json(result.rows[0]);
    } catch (error) {
        await client.query('ROLLBACK');
        console.error('Error setting user configuration:', error);
        res.status(500).json({ error: 'Ошибка при установке конфигурации' });
    } finally {
        client.release();
    }
};

// Get configurations grouped by category
const getConfigurationsByCategory = async (req, res) => {
    try {
        const result = await pool.query(`
            SELECT 
                c.id,
                c.code,
                c.name,
                c.category,
                c.description,
                c.icon,
                COUNT(cm.id) as modules_count
            FROM configurations c
            LEFT JOIN configuration_modules cm ON c.id = cm.configuration_id
            WHERE c.is_active = true
            GROUP BY c.id
            ORDER BY c.category, c.name
        `);

        // Group by category
        const groupedConfigs = result.rows.reduce((acc, config) => {
            if (!acc[config.category]) {
                acc[config.category] = [];
            }
            acc[config.category].push(config);
            return acc;
        }, {});

        res.json(groupedConfigs);
    } catch (error) {
        console.error('Error fetching configurations by category:', error);
        res.status(500).json({ error: 'Ошибка при получении конфигураций' });
    }
};

module.exports = {
    getAllConfigurations,
    getConfigurationById,
    getConfigurationModules,
    getUserConfiguration,
    getUserModules,
    setUserConfiguration,
    getConfigurationsByCategory
};
