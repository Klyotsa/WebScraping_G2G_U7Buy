const axios = require('axios');

/**
 * Trello Service for API integration
 */
class TrelloService {
    constructor() {
        this.apiKey = process.env.TRELLO_API_KEY;
        this.apiToken = process.env.TRELLO_API_TOKEN;
        this.boardId = process.env.TRELLO_BOARD_ID;
        this.listId = process.env.TRELLO_LIST_ID;
        
        this.baseUrl = 'https://api.trello.com/1';
    }

    /**
     * Проверяет настроен ли Trello API
     */
    isConfigured() {
        return this.apiKey && this.apiToken && this.boardId && this.listId;
    }

    /**
     * Создает карточку в Trello из заказа
     */
    async createCardFromOrder(order) {
        if (!this.isConfigured()) {
            console.log('⚠️ [TRELLO] Trello API не настроен. Пропускаем создание карточки для:', order?.orderId || 'UNKNOWN');
            return false;
        }

        try {
            if (!order || !order.orderId || order.orderId === 'UNKNOWN') {
                console.log('⚠️ [TRELLO] Некорректные данные заказа:', order);
                return false;
            }
            
            console.log(`🔍 [TRELLO] Проверка существования карточки для заказа №${order.orderId}...`);
            // Сначала проверяем, есть ли уже карточка с таким ID заказа
            const existingCard = await this.findCardByOrderId(order.orderId);
            
            if (existingCard) {
                console.log(`✅ [TRELLO] Карточка для заказа №${order.orderId} уже существует (ID: ${existingCard.id}), обновляем...`);
                // Обновляем существующую карточку
                const updateResult = await this.updateExistingCard(existingCard.id, order);
                if (updateResult) {
                    console.log(`✅ [TRELLO] Карточка для заказа №${order.orderId} успешно обновлена`);
                } else {
                    console.log(`⚠️ [TRELLO] Не удалось обновить карточку для заказа №${order.orderId}`);
                }
                return updateResult;
            } else {
                // Создаем новую карточку
                console.log(`📝 [TRELLO] Карточка для заказа №${order.orderId} не найдена, создаем новую...`);
                console.log(`   - Название: ${this.buildCardTitle(order)}`);
                console.log(`   - Список ID: ${this.listId}`);
                console.log(`   - Статус: ${order.status || 'UNKNOWN'}`);

                const cardData = {
                    name: this.buildCardTitle(order),
                    idList: this.listId,
                    desc: this.buildCardDescription(order),
                    key: this.apiKey,
                    token: this.apiToken
                };

                console.log(`📤 [TRELLO] Отправка запроса на создание карточки в Trello...`);
                const response = await axios.post(`${this.baseUrl}/cards`, cardData);

                if (response.status === 200 || response.status === 201) {
                    console.log(`✅ [TRELLO] Карточка Trello создана успешно для заказа №${order.orderId}`);
                    console.log(`   - ID карточки: ${response.data.id}`);
                    console.log(`   - Название: ${response.data.name}`);
                    
                    // Присваиваем метку по статусу заказа
                    if (order.status) {
                        await this.assignLabelToCardByStatus(response.data.id, order.status);
                    }
                    
                    return true;
                } else {
                    console.error(`❌ [TRELLO] Ошибка создания карточки Trello для заказа №${order.orderId}: статус ${response.status}`);
                    return false;
                }
            }

        } catch (error) {
            console.error(`❌ [TRELLO] Исключение при работе с карточкой Trello для заказа №${order?.orderId || 'UNKNOWN'}:`, error.message);
            if (error.response) {
                console.error(`   - Статус ответа: ${error.response.status}`);
                console.error(`   - Данные ответа:`, JSON.stringify(error.response.data));
            }
            return false;
        }
    }

        /**
         * Строит название карточки в формате [CONSOLE] QUANTITY CATEGORY
         */
        buildCardTitle(order) {
            // Используем название продукта из парсированных данных
            if (order.productName) {
                // Извлекаем консоль, количество и категорию из названия
                const productName = order.productName.toUpperCase();
                let console = 'UNKNOWN';
                let quantity = '';
                let category = '';

                // Определяем консоль
                if (productName.includes('XBOX XS') || productName.includes('XBOX SERIES')) {
                    console = 'XBOX XS';
                } else if (productName.includes('XBOX ONE')) {
                    console = 'XBOX ONE';
                } else if (productName.includes('PS5') || productName.includes('PLAYSTATION 5')) {
                    console = 'PS5';
                } else if (productName.includes('PS4') || productName.includes('PLAYSTATION 4')) {
                    console = 'PS4';
                }

                // Приоритетный фильтр 1: GTA 5 PACKAGE
                if (productName.includes('GTA 5 PACKAGE') || productName.includes('GTA5 PACKAGE')) {
                    category = 'GTA 5 PACKAGE';
                    quantity = ''; // Не нужно количество
                    if (console !== 'UNKNOWN' && category) {
                        return `[${console}] ${category}`;
                    }
                }

                // Приоритетный фильтр 2: MODDED OUTFITS или просто OUTFITS
                const outfitsMatch = productName.match(/([A-Z\s]+?)\s*(MODDED\s+)?OUTFITS?/i);
                if (outfitsMatch) {
                    // Извлекаем слова перед OUTFIT/OUTFITS
                    const fullMatch = productName.match(/(.+?)\s*(MODDED\s+)?OUTFITS?/i);
                    if (fullMatch) {
                        let wordsBefore = fullMatch[1].trim();
                        const outfitWord = productName.match(/OUTFITS?/i)?.[0]?.toUpperCase() || 'OUTFITS';
                        
                        // Убираем название консоли из начала
                        wordsBefore = wordsBefore
                            .replace(/^\[?PS5\]?\s*/i, '')
                            .replace(/^\[?PS4\]?\s*/i, '')
                            .replace(/^\[?XBOX\s+XS\]?\s*/i, '')
                            .replace(/^\[?XBOX\s+ONE\]?\s*/i, '')
                            .replace(/^\[?XBOX\s+SERIES\]?\s*/i, '')
                            .trim();
                        
                        // Очищаем от лишних слов в начале
                        wordsBefore = wordsBefore
                            .replace(/^TRIO\s+OF\s+/i, 'TRIO OF ')
                            .replace(/^MODDED\s+/i, '')
                            .trim();
                        
                        if (wordsBefore && wordsBefore.length > 0) {
                            category = `${wordsBefore.toUpperCase()} ${outfitWord}`;
                        } else {
                            category = `MODDED ${outfitWord}`;
                        }
                        quantity = ''; // Не нужно количество
                        if (console !== 'UNKNOWN' && category) {
                            return `[${console}] ${category}`;
                        }
                    }
                }

                // Приоритетный фильтр 3: MODDED CARS или просто CARS (но НЕ CASH + CARS)
                // Проверяем, что это НЕ CASH + CARS заказ перед применением фильтра MODDED CARS
                const isCashAndCars = productName.includes('CASH') && productName.includes('CARS');
                if (!isCashAndCars) {
                    const carsMatch = productName.match(/([A-Z\s]+?)\s*(MODDED\s+)?CARS?/i);
                    if (carsMatch) {
                        // Извлекаем слова перед CAR/CARS
                        const fullMatch = productName.match(/(.+?)\s*(MODDED\s+)?CARS?/i);
                        if (fullMatch) {
                            let wordsBefore = fullMatch[1].trim();
                            const carWord = productName.match(/CARS?/i)?.[0]?.toUpperCase() || 'CARS';
                            
                            // Убираем название консоли из начала
                            wordsBefore = wordsBefore
                                .replace(/^\[?PS5\]?\s*/i, '')
                                .replace(/^\[?PS4\]?\s*/i, '')
                                .replace(/^\[?XBOX\s+XS\]?\s*/i, '')
                                .replace(/^\[?XBOX\s+ONE\]?\s*/i, '')
                                .replace(/^\[?XBOX\s+SERIES\]?\s*/i, '')
                                .trim();
                            
                            // Очищаем от лишних слов в начале
                            wordsBefore = wordsBefore
                                .replace(/^MODDED\s+/i, '')
                                .trim();
                            
                            if (wordsBefore && wordsBefore.length > 0) {
                                category = `${wordsBefore.toUpperCase()} ${carWord}`;
                            } else {
                                category = `MODDED ${carWord}`;
                            }
                            quantity = ''; // Не нужно количество
                            if (console !== 'UNKNOWN' && category) {
                                return `[${console}] ${category}`;
                            }
                        }
                    }
                }

                // Проверяем наличие Rank или LVL в названии (приоритетный фильтр)
                const hasRank = productName.includes('RANK') || productName.includes('RANK BOOST');
                const hasLVL = productName.includes('LVL') || productName.includes('LEVEL');
                
                if (hasRank || hasLVL) {
                    // Если есть Rank или LVL - используем их как категорию, количество БЕЗ M
                    if (hasRank) {
                        category = 'Rank';
                        // Ищем количество для Rank (может быть "Rank 0-120", "0-120 Rank", "RANK 0–120" и т.д.)
                        // Сначала ищем диапазон с тире или дефисом
                        const rankRangeMatch = productName.match(/(\d+)\s*[–-]\s*(\d+)\s*(RANK|BOOST)/i) || 
                                               productName.match(/(RANK|BOOST)\s*(\d+)\s*[–-]\s*(\d+)/i);
                        if (rankRangeMatch) {
                            // Если нашли диапазон
                            if (rankRangeMatch[3] && rankRangeMatch[1] && rankRangeMatch[2]) {
                                // Формат: "0-120 RANK" или "RANK 0-120"
                                quantity = rankRangeMatch[1] === 'RANK' || rankRangeMatch[1] === 'BOOST' 
                                    ? `${rankRangeMatch[2]}-${rankRangeMatch[3]}`
                                    : `${rankRangeMatch[1]}-${rankRangeMatch[2]}`;
                            } else {
                                quantity = `${rankRangeMatch[1]}-${rankRangeMatch[2]}`;
                            }
                        } else {
                            // Ищем просто число перед или после RANK
                            const rankQtyMatch = productName.match(/(\d+)\s*(RANK|BOOST)/i) || 
                                                  productName.match(/(RANK|BOOST)\s*(\d+)/i);
                            if (rankQtyMatch) {
                                quantity = rankQtyMatch[1] === 'RANK' || rankQtyMatch[1] === 'BOOST' 
                                    ? rankQtyMatch[2] 
                                    : rankQtyMatch[1];
                            }
                        }
                    } else if (hasLVL) {
                        category = 'LVL';
                        // Ищем количество для LVL
                        const lvlQtyMatch = productName.match(/(\d+)\s*(LVL|LEVEL)/i) || 
                                            productName.match(/(LVL|LEVEL)\s*(\d+)/i);
                        if (lvlQtyMatch) {
                            quantity = lvlQtyMatch[1] === 'LVL' || lvlQtyMatch[1] === 'LEVEL' 
                                ? lvlQtyMatch[2] 
                                : lvlQtyMatch[1];
                        }
                    }
                    
                    // Для Rank и LVL НЕ добавляем M к количеству
                } else {
                    // Определяем количество для CASH заказов (ищем паттерн типа "15M", "100M", "250M" и т.д.)
                    const qtyMatch = productName.match(/(\d+[MK]?)\s*M/i);
                    if (qtyMatch) {
                        quantity = qtyMatch[1];
                    } else {
                        // Альтернативный поиск количества
                        const altQtyMatch = productName.match(/(\d+[MK]?)\s*(CASH|MONEY)/i);
                        if (altQtyMatch) {
                            quantity = altQtyMatch[1];
                        } else {
                            // Ищем просто число перед словами CASH, CARS и т.д.
                            const numberMatch = productName.match(/(\d+)\s*(CASH|CARS)/i);
                            if (numberMatch) {
                                quantity = numberMatch[1];
                            }
                        }
                    }
                    
                    // Обязательно добавляем "M" после количества для CASH заказов, если его нет
                    if (quantity && !quantity.toUpperCase().endsWith('M') && !quantity.toUpperCase().endsWith('K')) {
                        quantity = quantity + 'M';
                    }

                    // Определяем категорию для CASH заказов
                    if (productName.includes('CASH') && productName.includes('CARS')) {
                        // Если есть CASH + CARS - используем "CASH + CARS"
                        category = 'CASH + CARS';
                    } else if (productName.includes('CASH') && !productName.includes('CARS')) {
                        // Если есть CASH но нет CARS - используем "ONLY CASH"
                        category = 'ONLY CASH';
                    }
                }

                // Формируем название карточки
                if (console !== 'UNKNOWN' && quantity && category) {
                    // Для Rank и LVL - строгий формат без дополнительного текста
                    if (category === 'Rank' || category === 'LVL') {
                        return `[${console}] ${quantity} ${category}`;
                    }
                    // Для CASH заказов
                    return `[${console}] ${quantity} ${category}`;
                }

                // Fallback - используем первые 50 символов названия
                return order.productName.substring(0, 50);
            }
            
            // Fallback если нет названия
            return `Заказ №${order.orderId || 'UNKNOWN'}`;
        }

    /**
     * Строит описание карточки
     */
        buildCardDescription(order) {
            let desc = `Источник: G2G\n`;
            desc += `ID заказа: ${order.orderId || 'UNKNOWN'}\n`;
            
            if (order.purchaseOrderId) {
                desc += `Purchase Order ID: ${order.purchaseOrderId}\n`;
            }
            
            // Статус
            if (order.status) {
                desc += `Статус: ${order.status}\n`;
            }
            
            // Дата заказа
            if (order.orderDate) {
                desc += `Дата заказа: ${order.orderDate}\n`;
            }
            
            // Название продукта
            if (order.productName) {
                desc += `\nНазвание: ${order.productName}\n`;
            }
            
            // Данные из таблицы
            if (order.productsId) {
                desc += `Products ID: ${order.productsId}\n`;
            }
            
            if (order.type) {
                desc += `Тип: ${order.type}\n`;
            }
            
            if (order.quantity) {
                desc += `Количество: ${order.quantity}\n`;
            }
            
            if (order.pricePerUnit) {
                desc += `Цена за единицу: ${order.pricePerUnit}\n`;
            }
            
            if (order.amount) {
                desc += `Сумма: ${order.amount}\n`;
            }
            
            if (order.commissionFee) {
                desc += `Комиссия: ${order.commissionFee}\n`;
            }
            
            if (order.toBeEarned) {
                desc += `To be earned: ${order.toBeEarned}\n`;
            }
            
            // Информация о покупателе
            if (order.buyerName) {
                desc += `\nПокупатель: ${order.buyerName}`;
                if (order.buyerUrl) {
                    desc += ` (${order.buyerUrl})`;
                }
            }
            
            // Game info
            if (order.game) {
                desc += `\n\nИгра: ${order.game}`;
            }
            
            if (order.platform) {
                desc += `\nПлатформа: ${order.platform}`;
            }
            
            if (order.serviceType) {
                desc += `\nТип услуги: ${order.serviceType}`;
            }
            
            // Chat URL
            if (order.chatUrl) {
                desc += `\n\nЧат: ${order.chatUrl}`;
            }

            return desc;
        }

    /**
     * Получает информацию о доске Trello
     */
    async getBoardInfo() {
        if (!this.isConfigured()) {
            console.log('⚠️ Trello API не настроен');
            return null;
        }

        try {
            const response = await axios.get(`${this.baseUrl}/boards/${this.boardId}`, {
                params: {
                    key: this.apiKey,
                    token: this.apiToken
                }
            });

            return response.data;
        } catch (error) {
            console.error('❌ Ошибка получения информации о доске:', error.message);
            return null;
        }
    }

    /**
     * Получает все метки на доске
     */
    async getBoardLabels() {
        if (!this.isConfigured()) {
            return [];
        }

        try {
            const response = await axios.get(`${this.baseUrl}/boards/${this.boardId}/labels`, {
                params: {
                    key: this.apiKey,
                    token: this.apiToken
                }
            });

            return response.data || [];
        } catch (error) {
            console.error('❌ Ошибка получения меток доски:', error.message);
            return [];
        }
    }

    /**
     * Находит метку по названию
     */
    async findLabelByName(labelName) {
        if (!this.isConfigured()) {
            return null;
        }

        try {
            const labels = await this.getBoardLabels();
            const label = labels.find(l => 
                l.name && l.name.toUpperCase() === labelName.toUpperCase()
            );
            return label || null;
        } catch (error) {
            console.error(`❌ Ошибка поиска метки "${labelName}":`, error.message);
            return null;
        }
    }

    /**
     * Маппинг статуса G2G на название метки Trello
     */
    mapStatusToLabelName(status) {
        if (!status) return null;
        
        const statusUpper = status.toUpperCase();
        
        // Маппинг статусов G2G на метки Trello
        if (statusUpper.includes('DELIVERING')) {
            return 'DELIVERING';
        } else if (statusUpper.includes('CANCEL REQUESTED') || statusUpper.includes('CANCEL REQUEST')) {
            return 'CANCEL REQUESTED';
        } else if (statusUpper.includes('DELIVERED')) {
            return 'DELIVERED';
        } else if (statusUpper.includes('COMPLETED')) {
            return 'COMPLETED';
        } else if (statusUpper.includes('CANCELLED') || statusUpper.includes('CANCELED')) {
            return 'CANCELLED';
        }
        
        return null;
    }

    /**
     * Присваивает метку карточке по статусу заказа
     */
    async assignLabelToCardByStatus(cardId, orderStatus) {
        if (!this.isConfigured() || !cardId) {
            return false;
        }

        try {
            // Определяем название метки по статусу
            const labelName = this.mapStatusToLabelName(orderStatus);
            if (!labelName) {
                console.log(`⚠️ [TRELLO] Не удалось определить метку для статуса: ${orderStatus}`);
                return false;
            }

            // Находим метку на доске
            const label = await this.findLabelByName(labelName);
            if (!label) {
                console.log(`⚠️ [TRELLO] Метка "${labelName}" не найдена на доске`);
                return false;
            }

            // Получаем текущие метки карточки
            const cardResponse = await axios.get(`${this.baseUrl}/cards/${cardId}`, {
                params: {
                    key: this.apiKey,
                    token: this.apiToken,
                    fields: 'idLabels'
                }
            });

            const currentLabelIds = cardResponse.data.idLabels || [];
            
            // Проверяем, не присвоена ли уже эта метка
            if (currentLabelIds.includes(label.id)) {
                console.log(`✅ [TRELLO] Метка "${labelName}" уже присвоена карточке ${cardId}`);
                return true;
            }

            // Добавляем новую метку к существующим
            const newLabelIds = [...currentLabelIds, label.id];

            // Обновляем метки карточки
            const updateResponse = await axios.put(`${this.baseUrl}/cards/${cardId}/idLabels`, null, {
                params: {
                    key: this.apiKey,
                    token: this.apiToken,
                    value: newLabelIds.join(',')
                }
            });

            if (updateResponse.status === 200) {
                console.log(`✅ [TRELLO] Метка "${labelName}" успешно присвоена карточке ${cardId}`);
                return true;
            } else {
                console.error(`❌ [TRELLO] Ошибка присвоения метки "${labelName}": статус ${updateResponse.status}`);
                return false;
            }
        } catch (error) {
            console.error(`❌ [TRELLO] Ошибка присвоения метки карточке ${cardId}:`, error.message);
            if (error.response) {
                console.error(`   - Статус: ${error.response.status}`);
                console.error(`   - Данные:`, JSON.stringify(error.response.data));
            }
            return false;
        }
    }

    /**
     * Создает метку на доске
     */
    async createLabel(name, color = null) {
        if (!this.isConfigured()) {
            console.log('⚠️ Trello API не настроен');
            return null;
        }

        try {
            // Проверяем, существует ли уже метка с таким именем
            const existingLabels = await this.getBoardLabels();
            const existingLabel = existingLabels.find(label => 
                label.name && label.name.toLowerCase() === name.toLowerCase()
            );

            if (existingLabel) {
                console.log(`✅ Метка "${name}" уже существует (ID: ${existingLabel.id})`);
                return existingLabel;
            }

            // Создаем новую метку
            const labelData = {
                name: name,
                idBoard: this.boardId,
                key: this.apiKey,
                token: this.apiToken
            };

            // Добавляем цвет, если указан
            if (color) {
                labelData.color = color;
            }

            const response = await axios.post(`${this.baseUrl}/labels`, labelData);

            if (response.status === 200 || response.status === 201) {
                console.log(`✅ Метка "${name}" создана успешно (ID: ${response.data.id})`);
                return response.data;
            } else {
                console.error(`❌ Ошибка создания метки "${name}": статус ${response.status}`);
            return null;
            }
        } catch (error) {
            console.error(`❌ Ошибка создания метки "${name}":`, error.message);
            if (error.response) {
                console.error(`   - Статус: ${error.response.status}`);
                console.error(`   - Данные:`, JSON.stringify(error.response.data));
            }
            return null;
        }
    }

    /**
     * Создает все необходимые метки на доске
     */
    async createStatusLabels() {
        if (!this.isConfigured()) {
            console.log('⚠️ Trello API не настроен');
            return { success: false, message: 'Trello API не настроен' };
        }

        const labels = [
            { name: 'DELIVERING', color: 'blue' },
            { name: 'CANCEL REQUESTED', color: 'orange' },
            { name: 'DELIVERED', color: 'green' },
            { name: 'COMPLETED', color: 'purple' },
            { name: 'CANCELLED', color: 'red' }
        ];

        const results = {
            success: true,
            created: [],
            existing: [],
            errors: []
        };

        console.log('📋 Создание меток на доске Trello...');

        for (const label of labels) {
            try {
                const result = await this.createLabel(label.name, label.color);
                if (result) {
                    if (result.id) {
                        results.created.push({ name: label.name, id: result.id });
                    } else {
                        results.existing.push({ name: label.name });
                    }
                } else {
                    results.errors.push({ name: label.name });
                }
            } catch (error) {
                console.error(`❌ Ошибка при создании метки "${label.name}":`, error.message);
                results.errors.push({ name: label.name, error: error.message });
            }
        }

        console.log(`✅ Создание меток завершено:`);
        console.log(`   - Создано: ${results.created.length}`);
        console.log(`   - Уже существовало: ${results.existing.length}`);
        console.log(`   - Ошибок: ${results.errors.length}`);

        if (results.errors.length > 0) {
            results.success = false;
        }

        return results;
    }

    /**
     * Находит существующую карточку по ID заказа
     */
    async findCardByOrderId(orderId) {
        if (!this.isConfigured()) {
            return null;
        }

        try {
            // Получаем все карточки в списке
            const response = await axios.get(`https://api.trello.com/1/lists/${this.listId}/cards`, {
                params: {
                    key: this.apiKey,
                    token: this.apiToken
                }
            });

            if (response.status === 200) {
                // Ищем карточку с нужным ID заказа в описании
                const cards = response.data;
                for (const card of cards) {
                    if (card.desc && card.desc.includes(`ID заказа: ${orderId}`)) {
                        console.log(`🔍 Найдена существующая карточка для заказа ${orderId}: ${card.id}`);
                        return card;
                    }
                }
            }
        } catch (error) {
            console.error('❌ Ошибка поиска карточки:', error.message);
        }
        
        return null;
    }

    /**
     * Обновляет существующую карточку
     */
    async updateExistingCard(cardId, order) {
        if (!this.isConfigured()) {
            return false;
        }

        try {
            console.log('📝 Обновление существующей карточки Trello:', cardId);

            const cardName = this.buildCardTitle(order);
            const cardDescription = this.buildCardDescription(order);

            const response = await axios.put(`https://api.trello.com/1/cards/${cardId}`, null, {
                params: {
                    key: this.apiKey,
                    token: this.apiToken,
                    name: cardName,
                    desc: cardDescription,
                    urlSource: order.screenshotUrl || undefined
                }
            });

            if (response.status === 200) {
                console.log('✅ Карточка Trello обновлена успешно:', cardId);
                
                // Присваиваем метку по статусу заказа
                if (order.status) {
                    await this.assignLabelToCardByStatus(cardId, order.status);
                }
                
                return true;
            } else {
                console.error('❌ Ошибка обновления карточки Trello:', response.status, response.statusText);
                return false;
            }
        } catch (error) {
            console.error('❌ Исключение при обновлении карточки Trello:', error.message);
            return false;
        }
    }

    /**
     * Извлекает данные заказа из описания карточки Trello
     */
    parseOrderFromCardDescription(card) {
        if (!card || !card.desc) {
            return null;
        }

        const order = {};
        const desc = card.desc;

        // Извлекаем orderId
        const orderIdMatch = desc.match(/ID заказа:\s*(\d+)/);
        if (orderIdMatch) {
            order.orderId = orderIdMatch[1];
        }

        // Извлекаем purchaseOrderId
        const purchaseOrderIdMatch = desc.match(/Purchase Order ID:\s*(\d+)/);
        if (purchaseOrderIdMatch) {
            order.purchaseOrderId = purchaseOrderIdMatch[1];
        }

        // Извлекаем название продукта
        const productNameMatch = desc.match(/Название:\s*([^\n]+)/);
        if (productNameMatch) {
            order.productName = productNameMatch[1].trim();
        }

        // Извлекаем статус
        const statusMatch = desc.match(/Статус:\s*([^\n]+)/);
        if (statusMatch) {
            order.status = statusMatch[1].trim();
        }

        // Извлекаем дату заказа
        const dateMatch = desc.match(/Дата заказа:\s*([^\n]+)/);
        if (dateMatch) {
            order.orderDate = dateMatch[1].trim();
        }

        // Извлекаем другие данные
        const toBeEarnedMatch = desc.match(/To be earned:\s*([^\n]+)/);
        if (toBeEarnedMatch) {
            order.toBeEarned = toBeEarnedMatch[1].trim();
        }

        const buyerMatch = desc.match(/Покупатель:\s*([^\n]+)/);
        if (buyerMatch) {
            order.buyerName = buyerMatch[1].trim();
        }

        return order.orderId ? order : null;
    }

    /**
     * Обновляет все карточки в списке по новым правилам названия
     */
    async updateAllCardsWithNewTitleFormat() {
        if (!this.isConfigured()) {
            return { success: false, message: 'Trello API не настроен' };
        }

        try {
            console.log('📋 Получение всех карточек из списка...');
            
            // Получаем все карточки в списке
            const response = await axios.get(`https://api.trello.com/1/lists/${this.listId}/cards`, {
                params: {
                    key: this.apiKey,
                    token: this.apiToken
                }
            });

            if (response.status !== 200) {
                return { success: false, message: 'Не удалось получить карточки' };
            }

            const cards = response.data;
            console.log(`📊 Найдено карточек: ${cards.length}`);

            const results = {
                success: true,
                total: cards.length,
                updated: 0,
                skipped: 0,
                errors: []
            };

            for (const card of cards) {
                try {
                    // Извлекаем данные заказа из описания карточки
                    const order = this.parseOrderFromCardDescription(card);
                    
                    if (!order || !order.orderId) {
                        console.log(`⚠️ Не удалось извлечь данные заказа из карточки ${card.id}, пропускаем`);
                        console.log(`   Текущее название: ${card.name}`);
                        console.log(`   Описание: ${card.desc ? card.desc.substring(0, 100) + '...' : 'нет'}`);
                        results.skipped++;
                        continue;
                    }

                    if (!order.productName) {
                        console.log(`⚠️ Не удалось извлечь название продукта из карточки ${card.id}, пропускаем`);
                        console.log(`   Текущее название: ${card.name}`);
                        results.skipped++;
                        continue;
                    }

                    // Строим новое название по новым правилам
                    const newTitle = this.buildCardTitle(order);
                    
                    // Если название не изменилось, пропускаем
                    if (card.name === newTitle) {
                        console.log(`✅ Название карточки ${card.id} уже актуально: ${newTitle}`);
                        results.skipped++;
                        continue;
                    }

                    // Обновляем карточку
                    console.log(`🔄 Обновление карточки ${card.id}:`);
                    console.log(`   Старое: ${card.name}`);
                    console.log(`   Новое: ${newTitle}`);

                    const updateResponse = await axios.put(`https://api.trello.com/1/cards/${card.id}`, null, {
                        params: {
                            key: this.apiKey,
                            token: this.apiToken,
                            name: newTitle
                        }
                    });

                    if (updateResponse.status === 200) {
                        console.log(`✅ Карточка ${card.id} обновлена успешно`);
                        
                        // Присваиваем метку по статусу заказа
                        if (order.status) {
                            await this.assignLabelToCardByStatus(card.id, order.status);
                        }
                        
                        results.updated++;
                    } else {
                        console.error(`❌ Ошибка обновления карточки ${card.id}: статус ${updateResponse.status}`);
                        results.errors.push({ cardId: card.id, error: `Статус ${updateResponse.status}` });
                    }

                    // Небольшая задержка между обновлениями
                    await new Promise(resolve => setTimeout(resolve, 500));

                } catch (error) {
                    console.error(`❌ Ошибка обработки карточки ${card.id}:`, error.message);
                    results.errors.push({ cardId: card.id, error: error.message });
                }
            }

            console.log(`✅ Обновление карточек завершено:`);
            console.log(`   - Всего: ${results.total}`);
            console.log(`   - Обновлено: ${results.updated}`);
            console.log(`   - Пропущено: ${results.skipped}`);
            console.log(`   - Ошибок: ${results.errors.length}`);

            if (results.errors.length > 0) {
                results.success = false;
            }

            return results;
        } catch (error) {
            console.error('❌ Ошибка обновления карточек:', error.message);
            return { success: false, message: error.message };
        }
    }

    /**
     * Тестирует подключение к Trello API
     */
    async testConnection() {
        if (!this.isConfigured()) {
            console.log('⚠️ Trello API не настроен. Проверьте переменные окружения');
            return false;
        }

        try {
            const boardInfo = await this.getBoardInfo();
            if (boardInfo) {
                console.log('✅ Подключение к Trello API успешно');
                return true;
            } else {
                console.log('❌ Не удалось подключиться к Trello API');
                return false;
            }
        } catch (error) {
            console.error('❌ Ошибка тестирования подключения к Trello:', error.message);
            return false;
        }
    }
}

module.exports = TrelloService;
