#!/bin/bash

# Скрипт для мониторинга и автоматического восстановления сервиса g2g-scraper
# Можно добавить в crontab для периодической проверки: */5 * * * * /opt/g2g-scraper/monitor-service.sh

SERVICE_NAME="g2g-scraper.service"
LOG_FILE="/opt/g2g-scraper/logs/monitor.log"
MAX_RESTART_ATTEMPTS=3

# Создаем директорию для логов если не существует
mkdir -p /opt/g2g-scraper/logs

# Функция логирования
log() {
    echo "[$(date '+%Y-%m-%d %H:%M:%S')] $1" | tee -a "$LOG_FILE"
}

# Проверяем статус сервиса
if ! systemctl is-active --quiet "$SERVICE_NAME"; then
    log "⚠️ Сервис $SERVICE_NAME не запущен, пытаюсь запустить..."
    
    if systemctl start "$SERVICE_NAME"; then
        sleep 5
        
        if systemctl is-active --quiet "$SERVICE_NAME"; then
            log "✅ Сервис $SERVICE_NAME успешно запущен"
        else
            log "❌ Не удалось запустить сервис $SERVICE_NAME"
            systemctl status "$SERVICE_NAME" --no-pager | tee -a "$LOG_FILE"
        fi
    else
        log "❌ Ошибка при попытке запуска сервиса $SERVICE_NAME"
        systemctl status "$SERVICE_NAME" --no-pager | tee -a "$LOG_FILE"
    fi
else
    # Сервис работает, проверяем что он отвечает на HTTP запросы
    if curl -s -f http://localhost:3000/status > /dev/null 2>&1; then
        log "✅ Сервис $SERVICE_NAME работает и отвечает на запросы"
    else
        log "⚠️ Сервис $SERVICE_NAME запущен, но не отвечает на HTTP запросы, перезапускаю..."
        systemctl restart "$SERVICE_NAME"
        sleep 5
        
        if curl -s -f http://localhost:3000/status > /dev/null 2>&1; then
            log "✅ Сервис $SERVICE_NAME восстановлен после перезапуска"
        else
            log "❌ Сервис $SERVICE_NAME не отвечает после перезапуска"
        fi
    fi
fi

