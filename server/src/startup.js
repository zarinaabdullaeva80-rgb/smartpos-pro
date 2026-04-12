// Startup wrapper with error logging for Railway debugging
console.log('=== Server startup begin ===');
console.log('Node version:', process.version);
console.log('ENV:', process.env.NODE_ENV);
console.log('PORT:', process.env.PORT);

process.on('uncaughtException', (error) => {
    console.error('UNCAUGHT EXCEPTION:', error);
    process.exit(1);
});

process.on('unhandledRejection', (reason, promise) => {
    console.error('UNHANDLED REJECTION at:', promise, 'reason:', reason);
});

console.log('Loading index.js...');

import('./index.js')
    .then(() => {
        console.log('=== Index.js loaded successfully ===');
    })
    .catch((error) => {
        console.error('=== FAILED TO LOAD INDEX.JS ===');
        console.error('Error:', error.message);
        console.error('Stack:', error.stack);
        process.exit(1);
    });
