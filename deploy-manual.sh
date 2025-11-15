#!/bin/bash

# Ручной скрипт для загрузки обновленного кода на сервер
# Использование: ./deploy-manual.sh
# Требует ввода пароля SSH при каждом запросе

set -e

SERVER="root@64.227.35.29"
SERVER_DIR="/opt/g2g-scraper"

echo "🚀 Загрузка обновленного кода на сервер $SERVER..."
echo "⚠️  Вам будет предложено ввести пароль SSH несколько раз"
echo ""

# Загружаем обновленный код
echo "📦 Загрузка файлов..."
echo "  → Загрузка src/services/trello-service.js..."
scp src/services/trello-service.js "$SERVER:$SERVER_DIR/src/services/trello-service.js"

echo "  → Загрузка src/scraper/g2g-scraper.js..."
scp src/scraper/g2g-scraper.js "$SERVER:$SERVER_DIR/src/scraper/g2g-scraper.js"

echo "  → Загрузка index.js..."
scp index.js "$SERVER:$SERVER_DIR/index.js"

echo ""
echo "🔄 Перезапуск сервиса на сервере..."
echo "  (потребуется ввод пароля еще раз)"

# Перезапускаем сервис
ssh "$SERVER" << 'ENDSSH'
    cd /opt/g2g-scraper
    
    echo "⏸️  Останавливаем сервис..."
    systemctl stop g2g-scraper.service || true
    
    sleep 2
    
    echo "▶️  Запускаем сервис..."
    systemctl start g2g-scraper.service
    
    sleep 3
    
    echo "📊 Статус сервиса:"
    systemctl status g2g-scraper.service --no-pager | head -10
    
    echo ""
    echo "✅ Код обновлен и сервис перезапущен!"
ENDSSH

echo ""
echo "✅ Развертывание завершено!"
echo ""
echo "🌐 Откройте в браузере: http://64.227.35.29:3000/login"


