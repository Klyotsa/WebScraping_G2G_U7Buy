#!/bin/bash

# Открывает потоковое отображение логов проекта на сервере.

SERVER_HOST="64.227.35.29"
SERVER_USER="root"
SERVER_PASSWORD="dimoN777___123f"
REMOTE_LOG_PATH="/opt/g2g-scraper/logs/activity.log"

echo "Подключение к ${SERVER_USER}@${SERVER_HOST} и показ файла ${REMOTE_LOG_PATH}..."
echo "Нажмите Ctrl+C для остановки просмотра."

exec sshpass -p "${SERVER_PASSWORD}" ssh -o StrictHostKeyChecking=no "${SERVER_USER}@${SERVER_HOST}" "tail -f ${REMOTE_LOG_PATH}"

