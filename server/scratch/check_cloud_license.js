import fetch from 'node-fetch';

const key = 'B5F3-87E6-20F4-7B7A';
const urls = [
    'https://smartpos-pro-production.up.railway.app',
    'https://smartpos-pro-production-f885.up.railway.app'
];

async function main() {
    for (const url of urls) {
        console.log(`\nChecking ${url}...`);
        try {
            const res = await fetch(`${url}/api/license/resolve?key=${key}`);
            console.log(`Status: ${res.status}`);
            const data = await res.json();
            console.log(data);
        } catch (e) {
            console.error(e.message);
        }
    }
}
main();
