#!/bin/bash

# Скрипт для синхронизации данных браузера с хостинга
# Использование: ./sync-browser-data.sh [SERVER_USER@SERVER_IP]

set -e

SERVER="${1:-root@64.227.35.29}"
SERVER_DIR="/opt/g2g-scraper"
LOCAL_DIR="./user-data"
TEMP_ARCHIVE="/tmp/g2g-browser-data.tar.gz"

echo "📦 Архивирование данных браузера..."

# Создаем архив, исключая временные файлы и логи
tar -czf "$TEMP_ARCHIVE" \
    --exclude="*.log" \
    --exclude="*.LOG" \
    --exclude="LOG.old" \
    --exclude="*.log.old" \
    --exclude="DevToolsActivePort" \
    --exclude="Singleton*" \
    --exclude="RunningChromeVersion" \
    --exclude="BrowserMetrics*" \
    --exclude="GrShaderCache" \
    --exclude="GraphiteDawnCache" \
    --exclude="ShaderCache" \
    --exclude="component_crx_cache" \
    --exclude="NativeMessagingHosts" \
    --exclude="Safe Browsing" \
    -C "$(dirname "$LOCAL_DIR")" \
    "$(basename "$LOCAL_DIR")"

ARCHIVE_SIZE=$(du -h "$TEMP_ARCHIVE" | cut -f1)
echo "✅ Архив создан: $TEMP_ARCHIVE ($ARCHIVE_SIZE)"

echo ""
echo "🚀 Копирование на сервер $SERVER..."

# Проверяем наличие sshpass и переменной окружения SSHPASS
USE_SSHPASS=false
if command -v sshpass &> /dev/null; then
    if [ -n "$SSHPASS" ]; then
        USE_SSHPASS=true
        echo "🔑 Используется sshpass с паролем из переменной окружения SSHPASS"
    else
        echo "💡 Подсказка: можно установить переменную SSHPASS для автоматической аутентификации"
        echo "   export SSHPASS='your_password'"
    fi
fi

# Пробуем скопировать файл
if [ "$USE_SSHPASS" = true ]; then
    sshpass -e scp "$TEMP_ARCHIVE" "$SERVER:$TEMP_ARCHIVE" || {
        echo "❌ Ошибка копирования с sshpass"
        exit 1
    }
else
    scp "$TEMP_ARCHIVE" "$SERVER:$TEMP_ARCHIVE" || {
        echo "❌ Ошибка копирования. Попробуйте один из вариантов:"
        echo "   1. Настроить SSH ключи для беспарольного доступа"
        echo "   2. Использовать sshpass: export SSHPASS='password' && ./sync-browser-data.sh"
        echo "   3. Скопировать вручную: scp $TEMP_ARCHIVE $SERVER:$TEMP_ARCHIVE"
        exit 1
    }
fi

echo ""
echo "📂 Распаковка на сервере..."

# Используем sshpass если доступен и настроен
if [ "$USE_SSHPASS" = true ]; then
    sshpass -e ssh "$SERVER" << 'ENDSSH'
    cd /opt/g2g-scraper
    
    # Останавливаем сервис если запущен
    if systemctl is-active --quiet g2g-scraper.service; then
        echo "⏸️  Останавливаем сервис g2g-scraper..."
        sudo systemctl stop g2g-scraper.service
    fi
    
    # Создаем резервную копию старой директории если существует
    if [ -d "user-data" ]; then
        echo "💾 Создание резервной копии старой директории..."
        mv user-data "user-data.backup.$(date +%Y%m%d_%H%M%S)"
    fi
    
    # Распаковываем архив
    echo "📦 Распаковка данных браузера..."
    tar -xzf /tmp/g2g-browser-data.tar.gz
    
    # Устанавливаем правильные права доступа
    chown -R $(whoami):$(whoami) user-data
    chmod -R 700 user-data/Default
    
    # Удаляем временный архив
    rm -f /tmp/g2g-browser-data.tar.gz
    
    echo "✅ Данные браузера успешно распакованы"
    
    # Перезапускаем сервис если был запущен
    if systemctl list-unit-files | grep -q g2g-scraper.service; then
        echo "🔄 Перезапуск сервиса g2g-scraper..."
        sudo systemctl start g2g-scraper.service
        sleep 2
        sudo systemctl status g2g-scraper.service --no-pager | head -5
    fi
ENDSSH
else
    ssh "$SERVER" << 'ENDSSH'
    cd /opt/g2g-scraper
    
    # Останавливаем сервис если запущен
    if systemctl is-active --quiet g2g-scraper.service; then
        echo "⏸️  Останавливаем сервис g2g-scraper..."
        sudo systemctl stop g2g-scraper.service
    fi
    
    # Создаем резервную копию старой директории если существует
    if [ -d "user-data" ]; then
        echo "💾 Создание резервной копии старой директории..."
        mv user-data "user-data.backup.$(date +%Y%m%d_%H%M%S)"
    fi
    
    # Распаковываем архив
    echo "📦 Распаковка данных браузера..."
    tar -xzf /tmp/g2g-browser-data.tar.gz
    
    # Устанавливаем правильные права доступа
    chown -R $(whoami):$(whoami) user-data
    chmod -R 700 user-data/Default
    
    # Удаляем временный архив
    rm -f /tmp/g2g-browser-data.tar.gz
    
    echo "✅ Данные браузера успешно распакованы"
    
    # Перезапускаем сервис если был запущен
    if systemctl list-unit-files | grep -q g2g-scraper.service; then
        echo "🔄 Перезапуск сервиса g2g-scraper..."
        sudo systemctl start g2g-scraper.service
        sleep 2
        sudo systemctl status g2g-scraper.service --no-pager | head -5
    fi
ENDSSH
fi

# Удаляем локальный архив
rm -f "$TEMP_ARCHIVE"

echo ""
echo "✅ Синхронизация завершена!"
echo "📋 Данные браузера успешно перенесены на сервер $SERVER"

