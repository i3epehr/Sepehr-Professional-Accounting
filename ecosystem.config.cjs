/**
 * پیکربندی اجرای پس‌زمینه نرم‌افزار حسابداری سپهر از طریق PM2
 * بدون باز ماندن پنجره سیاه ترمینال (Silent Daemon Background Process)
 */

module.exports = {
  apps: [
    {
      name: 'sepehr-accounting',
      script: 'node_modules/tsx/dist/cli.mjs',
      args: 'server.ts',
      cwd: './',
      autorestart: true,
      watch: false,
      max_memory_restart: '1G',
      env: {
        NODE_ENV: 'production',
        PORT: 3000,
      },
    },
  ],
};
