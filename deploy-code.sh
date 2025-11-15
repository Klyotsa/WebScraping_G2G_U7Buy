#!/bin/bash

# Скрипт для загрузки обновленного кода на сервер
# Использование: ./deploy-code.sh

set -e

SERVER="root@64.227.35.29"
SERVER_DIR="/opt/g2g-scraper"

echo "🚀 Загрузка обновленного кода на сервер $SERVER..."

# Проверяем наличие sshpass и переменной окружения SSHPASS
USE_SSHPASS=false
if command -v sshpass &> /dev/null; then
    if [ -n "$SSHPASS" ]; then
        USE_SSHPASS=true
        echo "🔑 Используется sshpass с паролем из переменной окружения SSHPASS"
    fi
fi

# Функция для выполнения команды
run_cmd() {
    if [ "$USE_SSHPASS" = true ]; then
        sshpass -e "$@"
    else
        "$@"
    fi
}

# Функция для копирования файлов
copy_files() {
    if [ "$USE_SSHPASS" = true ]; then
        sshpass -e scp "$@"
    else
        scp "$@"
    fi
}

echo ""
echo "📦 Загрузка файлов..."

# Загружаем обновленный код
echo "  → Загрузка src/services/trello-service.js..."
copy_files src/services/trello-service.js "$SERVER:$SERVER_DIR/src/services/trello-service.js"

echo "  → Загрузка src/scraper/g2g-scraper.js..."
copy_files src/scraper/g2g-scraper.js "$SERVER:$SERVER_DIR/src/scraper/g2g-scraper.js"

echo "  → Загрузка index.js..."
copy_files index.js "$SERVER:$SERVER_DIR/index.js"

echo "  → Загрузка public/login.html..."
copy_files public/login.html "$SERVER:$SERVER_DIR/public/login.html"

echo ""
echo "🔄 Перезапуск сервиса на сервере..."

# Перезапускаем сервис
run_cmd ssh "$SERVER" << 'ENDSSH'
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



