/**
 * PM2 process file — запускає обидва сервіси з кореня репозиторію:
 *   pm2 start ecosystem.config.js
 *
 * Перед першим запуском обидва застосунки мають бути зібрані:
 *   backend:  npm run build  -> dist/
 *   frontend: npm run build  -> .next/
 * Секрети бекенд читає з backend/.env (@nestjs/config), фронтенд бере
 * NEXT_PUBLIC_API_URL із frontend/.env.production під час збірки.
 */
module.exports = {
  apps: [
    {
      name: 'veles-backend',
      cwd: './backend',
      script: 'dist/main.js',
      instances: 1,
      autorestart: true,
      max_restarts: 10,
      restart_delay: 3000,
      max_memory_restart: '512M',
      env: {
        NODE_ENV: 'production',
        PORT: 7001,
      },
      out_file: './logs/backend-out.log',
      error_file: './logs/backend-error.log',
      merge_logs: true,
      time: true,
    },
    {
      name: 'veles-frontend',
      cwd: './frontend',
      script: 'node_modules/next/dist/bin/next',
      args: 'start -p 7002',
      instances: 1,
      autorestart: true,
      max_restarts: 10,
      restart_delay: 3000,
      max_memory_restart: '768M',
      env: {
        NODE_ENV: 'production',
      },
      out_file: './logs/frontend-out.log',
      error_file: './logs/frontend-error.log',
      merge_logs: true,
      time: true,
    },
  ],
};
