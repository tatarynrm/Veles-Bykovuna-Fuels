#!/usr/bin/env bash
# Оновлення на сервері: git pull -> install -> build -> pm2 reload.
# Запуск: ./deploy.sh (з кореня репозиторію)
set -euo pipefail
cd "$(dirname "$0")"

echo "==> Отримання останніх змін"
git pull --ff-only

echo "==> Backend: залежності та збірка"
(cd backend && npm ci && npm run build)

echo "==> Frontend: залежності та збірка"
# next build не можна запускати поверх запущеного dev-сервера (.next спільний)
(cd frontend && npm ci && rm -rf .next && npm run build)

echo "==> PM2 reload"
pm2 startOrReload ecosystem.config.js
pm2 save

echo "==> Готово"
pm2 status
