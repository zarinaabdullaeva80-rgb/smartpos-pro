import fetch from 'node-fetch';

const CLOUD_URLS = [
    'https://smartpos-pro-production.up.railway.app',
    'https://smartpos-pro-production-f885.up.railway.app'
];

async function main() {
    for (const url of CLOUD_URLS) {
        console.log(`\n--- ${url} ---`);
        try {
            const res = await fetch(`${url}/index.html`, {
                headers: {
                    'Cache-Control': 'no-cache',
                    'Pragma': 'no-cache'
                }
            });
            console.log(`Status: ${res.status}`);
            console.log(`Headers:`);
            for (const [k, v] of res.headers.entries()) {
                console.log(`  ${k}: ${v}`);
            }
            const text = await res.text();
            const match = text.match(/src=".*?assets\/index-.*?.js"/g);
            console.log(`Asset links:`, match);
        } catch (err) {
            console.error(`Error:`, err.message);
        }
    }
}

main();
