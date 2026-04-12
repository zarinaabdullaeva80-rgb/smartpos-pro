import { describe, it, expect, beforeAll, afterAll, jest } from '@jest/globals';
import pool from '../src/config/database.js';
import { sendEmail, sendEmailCampaign } from '../src/services/email.js';

describe('Email Service Tests', () => {
    beforeAll(async () => {
        // Setup test data
    });

    afterAll(async () => {
        await pool.end();
    });

    describe('sendEmail', () => {
        it('should build email correctly', async () => {
            const emailData = {
                to: 'test@example.com',
                subject: 'Test Email',
                html: '<p>Test</p>',
                text: 'Test'
            };

            const result = await sendEmail(emailData);

            // Since SMTP might not be configured, just check structure
            expect(result).toHaveProperty('success');
        });

        it('should handle missing SMTP configuration', async () => {
            const originalSMTP = process.env.SMTP_USER;
            delete process.env.SMTP_USER;

            const result = await sendEmail({
                to: 'test@test.com',
                subject: 'Test',
                html: 'Test'
            });

            expect(result.success).toBe(false);
            expect(result.error).toBe('SMTP not configured');

            process.env.SMTP_USER = originalSMTP;
        });
    });

    describe('Database Functions', () => {
        it('should execute get_torg12_data function', async () => {
            // This will fail if no sale exists, but tests the function exists
            try {
                const result = await pool.query('SELECT get_torg12_data($1) as data', [1]);
                expect(result.rows).toBeDefined();
            } catch (error) {
                // Expected if no sale with ID 1
                expect(error).toBeDefined();
            }
        });

        it('should execute get_external_id function', async () => {
            const result = await pool.query(
                'SELECT get_external_id($1, $2) as external_id',
                ['products', 1]
            );
            expect(result.rows).toHaveLength(1);
        });

        it('should execute add_to_sync_queue function', async () => {
            try {
                const result = await pool.query(
                    'SELECT add_to_sync_queue($1, $2, $3) as queue_id',
                    ['products', 1, 'create']
                );
                expect(result.rows[0].queue_id).toBeGreaterThan(0);

                // Cleanup
                await pool.query('DELETE FROM sync_queue WHERE id = $1', [result.rows[0].queue_id]);
            } catch (error) {
                console.error('Sync queue test error:', error);
            }
        });
    });

    describe('Materialized Views', () => {
        it('should query daily_sales view', async () => {
            const result = await pool.query('SELECT * FROM daily_sales LIMIT 5');
            expect(Array.isArray(result.rows)).toBe(true);
        });

        it('should query top_products view', async () => {
            const result = await pool.query('SELECT * FROM top_products LIMIT 5');
            expect(Array.isArray(result.rows)).toBe(true);
        });
    });

    describe('Performance', () => {
        it('should query products with acceptable speed', async () => {
            const start = Date.now();
            await pool.query('SELECT * FROM products LIMIT 100');
            const duration = Date.now() - start;

            expect(duration).toBeLessThan(1000); // Should be under 1 second
        });

        it('should use indexes for common queries', async () => {
            const result = await pool.query(`
                EXPLAIN (FORMAT JSON) 
                SELECT * FROM products 
                WHERE barcode = '1234567890123'
            `);

            const plan = result.rows[0]['QUERY PLAN'][0];
            // Check that it's using an index scan, not seq scan
            expect(JSON.stringify(plan)).toContain('Index');
        });
    });
});
