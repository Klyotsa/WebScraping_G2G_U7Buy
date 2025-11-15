# Руководство по использованию эндпоинтов

Все эндпоинты работают без ограничений по времени и позволяют контролировать процесс создания карточек.

## Основные эндпоинты для создания карточек

### 1. Boosting Delivering заказы
```bash
curl -X POST http://64.227.35.29:3000/g2g/scrape-boosting-delivering-and-create-cards
```

Сканирует заказы в статусе DELIVERING (status=1) и создает/обновляет карточки в Trello.

**Ответ:**
```json
{
  "status": "success",
  "message": "Парсинг Boosting Delivering заказов и создание карточек завершено",
  "ordersFound": 6,
  "cardsCreated": 2,
  "cardsUpdated": 4,
  "cardsSkipped": 0,
  "orders": [...]
}
```

### 2. Boosting Preparing заказы
```bash
curl -X POST http://64.227.35.29:3000/g2g/scrape-boosting-preparing-and-create-cards
```

Сканирует заказы в статусе PREPARING (status=6) и создает/обновляет карточки.

### 3. Новые заказы (status=5)
```bash
curl -X POST http://64.227.35.29:3000/g2g/scrape-boosting-status5-and-create-cards
```

Сканирует новые заказы со страницы status=5 и создает карточки.

### 4. Все заказы
```bash
curl -X POST http://64.227.35.29:3000/g2g/scrape-all-and-create-cards
```

Сканирует все типы заказов (Preparing, Delivering, status=5) и создает карточки.

## Проверка статуса

### Проверка статуса сервиса
```bash
curl http://64.227.35.29:3000/status
```

### Тест подключения к Trello
```bash
curl http://64.227.35.29:3000/trello/test
```

## Просмотр логов

Логи доступны на сервере:
```bash
tail -f /opt/g2g-scraper/logs/activity.log
```

Или через systemd:
```bash
journalctl -u g2g-scraper.service -f
```

## Отладка

Если карточки не создаются:

1. Проверьте настройки Trello API:
```bash
curl http://64.227.35.29:3000/trello/test
```

2. Проверьте, что заказы находятся:
```bash
curl -X POST http://64.227.35.29:3000/g2g/scrape-boosting-delivering-and-create-cards
```

3. Проверьте логи на ошибки:
```bash
tail -100 /opt/g2g-scraper/logs/activity.log | grep -E "ERROR|Ошибка|TRELLO"
```

## Автоматическое сканирование

Автоматическое сканирование отключено по умолчанию для работы через эндпоинты. 

Для включения автоматического сканирования установите в `.env`:
```
AUTO_SCAN_ENABLED=true
SCAN_INTERVAL_MINUTES=5
```

Но рекомендуется использовать эндпоинты для лучшего контроля процесса.

