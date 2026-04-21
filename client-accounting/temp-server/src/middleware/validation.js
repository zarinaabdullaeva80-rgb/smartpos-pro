import Joi from 'joi';

/**
 * Middleware для валидации тела запроса
 */
export const validate = (schema) => {
    return (req, res, next) => {
        const { error, value } = schema.validate(req.body, {
            abortEarly: false,
            stripUnknown: true
        });

        if (error) {
            const errors = error.details.map(detail => ({
                field: detail.path.join('.'),
                message: detail.message
            }));

            return res.status(400).json({
                error: 'Validation failed',
                details: errors
            });
        }

        req.body = value;
        next();
    };
};

/**
 * Валидация query параметров
 */
export const validateQuery = (schema) => {
    return (req, res, next) => {
        const { error, value } = schema.validate(req.query, {
            abortEarly: false,
            stripUnknown: true
        });

        if (error) {
            const errors = error.details.map(detail => ({
                field: detail.path.join('.'),
                message: detail.message
            }));

            return res.status(400).json({
                error: 'Query validation failed',
                details: errors
            });
        }

        req.query = value;
        next();
    };
};

// Схемы валидации для разных сущностей

export const schemas = {
    // Продукт
    product: Joi.object({
        name: Joi.string().min(1).max(255).required().messages({
            'string.empty': 'Название не может быть пустым',
            'string.max': 'Название слишком длинное (макс 255 символов)',
            'any.required': 'Название обязательно'
        }),
        barcode: Joi.string().allow('', null).max(50),
        article: Joi.string().allow('', null).max(50),
        category_id: Joi.number().integer().positive().allow(null),
        unit: Joi.string().max(20).default('шт'),
        price: Joi.number().min(0).precision(2).required(),
        cost_price: Joi.number().min(0).precision(2).allow(null),
        description: Joi.string().allow('', null).max(1000),
        is_active: Joi.boolean().default(true)
    }),

    // Продажа
    sale: Joi.object({
        customer_id: Joi.number().integer().positive().allow(null),
        warehouse_id: Joi.number().integer().positive().required(),
        document_date: Joi.date().iso().required(),
        notes: Joi.string().allow('', null).max(500),
        items: Joi.array().items(
            Joi.object({
                product_id: Joi.number().integer().positive().required(),
                quantity: Joi.number().positive().required(),
                price: Joi.number().min(0).required(),
                discount_percent: Joi.number().min(0).max(100).default(0)
            })
        ).min(1).required().messages({
            'array.min': 'Должен быть хотя бы один товар'
        })
    }),

    // Контрагент
    counterparty: Joi.object({
        name: Joi.string().min(1).max(255).required(),
        type: Joi.string().valid('customer', 'supplier', 'both').required(),
        phone: Joi.string().pattern(/^\+?\d{10,15}$/).allow('', null).messages({
            'string.pattern.base': 'Неверный формат телефона'
        }),
        email: Joi.string().email().allow('', null).messages({
            'string.email': 'Неверный формат email'
        }),
        address: Joi.string().allow('', null).max(500),
        inn: Joi.string().pattern(/^\d{10}$|^\d{12}$/).allow('', null).messages({
            'string.pattern.base': 'ИНН должен быть 10 или 12 цифр'
        }),
        notes: Joi.string().allow('', null).max(1000)
    }),

    // Пользователь
    user: Joi.object({
        username: Joi.string().alphanum().min(3).max(50).required(),
        password: Joi.string().min(6).max(100).required().messages({
            'string.min': 'Пароль должен быть минимум 6 символов'
        }),
        full_name: Joi.string().min(1).max(255).required(),
        email: Joi.string().email().required(),
        is_active: Joi.boolean().default(true)
    }),

    // Логин
    login: Joi.object({
        username: Joi.string().required(),
        password: Joi.string().required()
    }),

    // Инвентаризация
    inventory: Joi.object({
        warehouse_id: Joi.number().integer().positive().required(),
        inventory_date: Joi.date().iso().required(),
        notes: Joi.string().allow('', null).max(500),
        items: Joi.array().items(
            Joi.object({
                product_id: Joi.number().integer().positive().required(),
                actual_quantity: Joi.number().min(0).required()
            })
        ).min(1).required()
    }),

    // Email кампания
    emailCampaign: Joi.object({
        name: Joi.string().min(1).max(255).required(),
        subject: Joi.string().min(1).max(255).required(),
        body: Joi.string().min(1).required(),
        segment_code: Joi.string().allow('', null).max(50),
        scheduled_at: Joi.date().iso().allow(null)
    }),

    // Сделка
    deal: Joi.object({
        title: Joi.string().min(1).max(255).required(),
        customer_id: Joi.number().integer().positive().required(),
        stage_id: Joi.number().integer().positive().required(),
        amount: Joi.number().min(0).precision(2).required(),
        probability: Joi.number().min(0).max(100).default(50),
        expected_close_date: Joi.date().iso().allow(null),
        description: Joi.string().allow('', null).max(1000)
    }),

    // Настройки синхронизации 1С
    sync1cSettings: Joi.object({
        '1c_api_url': Joi.string().uri().required(),
        '1c_username': Joi.string().required(),
        '1c_password': Joi.string().required(),
        'sync_enabled': Joi.string().valid('true', 'false').required(),
        'sync_interval_minutes': Joi.number().integer().min(5).max(1440)
    }),

    // Pagination
    pagination: Joi.object({
        page: Joi.number().integer().min(1).default(1),
        limit: Joi.number().integer().min(1).max(1000).default(50),
        sort_by: Joi.string().allow(''),
        order: Joi.string().valid('asc', 'desc').default('desc')
    })
};

export default { validate, validateQuery, schemas };
