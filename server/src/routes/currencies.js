/**
 * Currency Rates Route - Курсы валют от ЦБУ Узбекистана
 * GET /api/currencies/rates - получить актуальные курсы
 */
import express from 'express';
import https from 'https';
import http from 'http';
import pool from '../config/database.js';

const router = express.Router();

// Кэш курсов от ЦБУ (обновляется раз в час на сервере)
let ratesCache = null;
let cacheTime = null;
const CACHE_TTL = 60 * 60 * 1000; // 1 час

// Ручные курсы (USD/EUR/RUB → UZS), хранятся в памяти + БД
let manualRatesCache = { USD: 12650, EUR: 14000, RUB: 142 };
let manualRatesLoaded = false;

// Запрос к ЦБУ через Node.js http
function fetchFromCBU() {
    return new Promise((resolve, reject) => {
        const url = 'https://cbu.uz/uz/arkhiv-kursov-valyut/json/';
        https.get(url, { timeout: 10000 }, (res) => {
            let data = '';
            res.on('data', chunk => data += chunk);
            res.on('end', () => {
                try {
                    resolve(JSON.parse(data));
                } catch (e) {
                    reject(new Error('Invalid JSON from CBU'));
                }
            });
        }).on('error', reject).on('timeout', () => reject(new Error('CBU timeout')));
    });
}

/**
 * GET /api/currencies/rates
 * Возвращает курсы валют от ЦБУ Узбекистана
 * Кэшируется на сервере 1 час
 */
router.get('/rates', async (req, res) => {
    try {
        const now = Date.now();
        const forceRefresh = req.query.refresh === 'true';

        // Проверяем кэш
        if (!forceRefresh && ratesCache && cacheTime && (now - cacheTime) < CACHE_TTL) {
            return res.json({
                success: true,
                source: 'cache',
                cached_at: new Date(cacheTime).toISOString(),
                rates: ratesCache
            });
        }

        // Загружаем от ЦБУ
        console.log('[Currencies] Fetching rates from CBU...');
        const cbuData = await fetchFromCBU();

        // Преобразуем в удобный формат
        const rates = {};
        for (const item of cbuData) {
            const rate = parseFloat(item.Rate);
            const nominal = parseInt(item.Nominal) || 1;
            rates[item.Ccy] = {
                code: item.Ccy,
                name: item.CcyNm_RU || item.CcyNm_UZ,
                rate: Math.round((rate / nominal) * 10) / 10, // курс за 1 единицу
                nominal,
                date: item.Date,
                diff: parseFloat(item.Diff) || 0
            };
        }

        // Сохраняем кэш
        ratesCache = rates;
        cacheTime = now;

        console.log(`[Currencies] Loaded ${Object.keys(rates).length} currencies from CBU`);

        return res.json({
            success: true,
            source: 'cbu',
            fetched_at: new Date().toISOString(),
            rates
        });

    } catch (error) {
        console.error('[Currencies] Error fetching rates:', error.message);

        // Если есть кэш — вернём старый
        if (ratesCache) {
            return res.json({
                success: true,
                source: 'cache_fallback',
                cached_at: new Date(cacheTime).toISOString(),
                rates: ratesCache,
                warning: 'Using cached data: ' + error.message
            });
        }

        return res.status(503).json({
            success: false,
            error: 'Cannot fetch currency rates: ' + error.message
        });
    }
});


/**
 * GET /api/currencies/manual-rates
 * Возвращает ручные курсы валют (USD/EUR/RUB → UZS)
 */
router.get('/manual-rates', async (req, res) => {
    // Загружаем из БД при первом запросе
    if (!manualRatesLoaded) {
        try {
            const dbRes = await pool.query(
                `SELECT value FROM app_settings WHERE key = 'manual_currency_rates' LIMIT 1`
            );
            if (dbRes.rows.length > 0) {
                manualRatesCache = { ...manualRatesCache, ...JSON.parse(dbRes.rows[0].value) };
            }
            manualRatesLoaded = true;
        } catch (e) {
            console.warn('[Currencies] Cannot load manual rates from DB:', e.message);
        }
    }
    return res.json({ success: true, rates: manualRatesCache });
});

/**
 * POST /api/currencies/manual-rates
 * Сохраняет ручные курсы валют { rates: { USD: 12650, EUR: 14000, RUB: 142 } }
 */
router.post('/manual-rates', async (req, res) => {
    const { rates } = req.body;
    if (!rates || typeof rates !== 'object') {
        return res.status(400).json({ error: 'Поле rates обязательно' });
    }

    // Обновляем только известные валюты
    const allowed = ['USD', 'EUR', 'UZS', 'RUB'];
    for (const key of allowed) {
        if (rates[key] !== undefined && !isNaN(parseFloat(rates[key]))) {
            manualRatesCache[key] = parseFloat(rates[key]);
        }
    }

    // Сохраняем в БД
    try {
        await pool.query(
            `INSERT INTO app_settings (key, value, updated_at)
             VALUES ('manual_currency_rates', $1, NOW())
             ON CONFLICT (key) DO UPDATE SET value = $1, updated_at = NOW()`,
            [JSON.stringify(manualRatesCache)]
        );
    } catch (e) {
        console.warn('[Currencies] Cannot save manual rates to DB:', e.message);
    }

    return res.json({ success: true, rates: manualRatesCache });
});

export default router;
