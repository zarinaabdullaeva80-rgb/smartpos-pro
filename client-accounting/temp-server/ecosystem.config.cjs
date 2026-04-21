module.exports = {
    apps: [
        {
            name: 'smartpos-server',
            script: 'src/index.js',
            cwd: 'c:\\Users\\user\\Desktop\\1С бухгалтерия\\server',
            interpreter: 'node',
            watch: false,
            autorestart: true,
            restart_delay: 5000,
            max_restarts: 10,
            env: {
                NODE_ENV: 'production',
                PORT: 5000
            },
            log_date_format: 'YYYY-MM-DD HH:mm:ss',
            error_file: 'c:\\SmartPOS-Logs\\server-error.log',
            out_file: 'c:\\SmartPOS-Logs\\server-out.log',
            merge_logs: true
        }
    ]
};
