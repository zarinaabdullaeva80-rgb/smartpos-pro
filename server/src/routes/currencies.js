/**
 * Currency Rates Route - Курсы валют от ЦБУ Узбекистана
 * GET /api/currencies/rates - получить актуальные курсы
 */
import express from 'express';
import https from 'https';
import http from 'http';

const router = express.Router();

// Кэш курсов (обновляется раз в час на сервере)
let ratesCache = null;
let cacheTime = null;
const CACHE_TTL = 60 * 60 * 1000; // 1 час

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

export default router;
