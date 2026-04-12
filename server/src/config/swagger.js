import swaggerJsDoc from 'swagger-jsdoc';
import swaggerUi from 'swagger-ui-express';

const swaggerOptions = {
    definition: {
        openapi: '3.0.0',
        info: {
            title: '1C Accounting API',
            version: '2.0.0',
            description: 'Modern accounting system with WMS, CRM, and 1C integration',
            contact: {
                name: 'API Support',
                email: 'support@example.com'
            },
            license: {
                name: 'MIT',
                url: 'https://opensource.org/licenses/MIT'
            }
        },
        servers: [
            {
                url: 'http://localhost:5000',
                description: 'Development server'
            },
            {
                url: 'https://api.example.com',
                description: 'Production server'
            }
        ],
        components: {
            securitySchemes: {
                bearerAuth: {
                    type: 'http',
                    scheme: 'bearer',
                    bearerFormat: 'JWT'
                }
            },
            schemas: {
                Product: {
                    type: 'object',
                    required: ['name', 'price'],
                    properties: {
                        id: { type: 'integer', example: 1 },
                        name: { type: 'string', example: 'Товар 1' },
                        barcode: { type: 'string', example: '1234567890123' },
                        article: { type: 'string', example: 'ART-001' },
                        category_id: { type: 'integer', example: 1 },
                        unit: { type: 'string', example: 'шт', default: 'шт' },
                        price: { type: 'number', format: 'decimal', example: 100.00 },
                        cost_price: { type: 'number', format: 'decimal', example: 80.00 },
                        is_active: { type: 'boolean', default: true }
                    }
                },
                Sale: {
                    type: 'object',
                    required: ['warehouse_id', 'document_date', 'items'],
                    properties: {
                        id: { type: 'integer' },
                        customer_id: { type: 'integer' },
                        warehouse_id: { type: 'integer' },
                        document_number: { type: 'string' },
                        document_date: { type: 'string', format: 'date' },
                        total_amount: { type: 'number', format: 'decimal' },
                        status: { type: 'string', enum: ['draft', 'confirmed', 'cancelled'] }
                    }
                },
                Error: {
                    type: 'object',
                    properties: {
                        error: { type: 'string' },
                        details: { type: 'array', items: { type: 'object' } }
                    }
                },
                HealthCheck: {
                    type: 'object',
                    properties: {
                        uptime: { type: 'number' },
                        message: { type: 'string' },
                        timestamp: { type: 'string', format: 'date-time' },
                        database: { type: 'string' }
                    }
                }
            }
        },
        security: [
            {
                bearerAuth: []
            }
        ]
    },
    apis: ['./src/routes/*.js'] // Путь к файлам с API документацией
};

const swaggerDocs = swaggerJsDoc(swaggerOptions);

export const setupSwagger = (app) => {
    app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(swaggerDocs, {
        explorer: true,
        customCss: '.swagger-ui .topbar { display: none }',
        customSiteTitle: '1C Accounting API Documentation'
    }));

    // JSON endpoint
    app.get('/api-docs.json', (req, res) => {
        res.setHeader('Content-Type', 'application/json');
        res.send(swaggerDocs);
    });

    console.log('✓ Swagger documentation available at /api-docs');
};

export default swaggerDocs;
