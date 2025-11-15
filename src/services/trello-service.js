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
     * Извлекает все услуги из названия продукта
     * Возвращает массив объектов {service, console, quantity, category}
     */
    extractServicesFromProductName(productName) {
        if (!productName) return [];
        
        const services = [];
        const productNameUpper = productName.toUpperCase();
        
        // Определяем консоль
        let console = 'UNKNOWN';
        if (productNameUpper.includes('XBOX XS') || productNameUpper.includes('XBOX SERIES')) {
            console = 'XBOX XS';
        } else if (productNameUpper.includes('XBOX ONE')) {
            console = 'XBOX ONE';
        } else if (productNameUpper.includes('PS5') || productNameUpper.includes('PLAYSTATION 5')) {
            console = 'PS5';
        } else if (productNameUpper.includes('PS4') || productNameUpper.includes('PLAYSTATION 4')) {
            console = 'PS4';
        }
        
        // 1. GTA 5 PACKAGE
        if (productNameUpper.includes('GTA 5 PACKAGE') || productNameUpper.includes('GTA5 PACKAGE')) {
            services.push({
                service: 'GTA 5 PACKAGE',
                console: console,
                quantity: '',
                category: 'GTA 5 PACKAGE'
            });
        }
        
        // 2. MODDED OUTFITS / OUTFITS (но не если уже есть GTA 5 PACKAGE)
        const outfitsMatch = productNameUpper.match(/([A-Z\s]+?)\s*(MODDED\s+)?OUTFITS?/i);
        if (outfitsMatch && !productNameUpper.includes('GTA 5 PACKAGE')) {
            const fullMatch = productNameUpper.match(/(.+?)\s*(MODDED\s+)?OUTFITS?/i);
            if (fullMatch) {
                let wordsBefore = fullMatch[1].trim();
                const outfitWord = productNameUpper.match(/OUTFITS?/i)?.[0]?.toUpperCase() || 'OUTFITS';
                
                wordsBefore = wordsBefore
                    .replace(/^\[?PS5\]?\s*/i, '')
                    .replace(/^\[?PS4\]?\s*/i, '')
                    .replace(/^\[?XBOX\s+XS\]?\s*/i, '')
                    .replace(/^\[?XBOX\s+ONE\]?\s*/i, '')
                    .replace(/^\[?XBOX\s+SERIES\]?\s*/i, '')
                    .replace(/^TRIO\s+OF\s+/i, 'TRIO OF ')
                    .replace(/^MODDED\s+/i, '')
                    .trim();
                
                let category = wordsBefore && wordsBefore.length > 0 
                    ? `${wordsBefore.toUpperCase()} ${outfitWord}`
                    : `MODDED ${outfitWord}`;
                
                services.push({
                    service: category,
                    console: console,
                    quantity: '',
                    category: category
                });
            }
        }
        
        // 3. MODDED CARS / CARS (но НЕ CASH + CARS)
        const isCashAndCars = productNameUpper.includes('CASH') && productNameUpper.includes('CARS');
        if (!isCashAndCars) {
            const carsMatch = productNameUpper.match(/([A-Z\s]+?)\s*(MODDED\s+)?CARS?/i);
            if (carsMatch) {
                const fullMatch = productNameUpper.match(/(.+?)\s*(MODDED\s+)?CARS?/i);
                if (fullMatch) {
                    let wordsBefore = fullMatch[1].trim();
                    const carWord = productNameUpper.match(/CARS?/i)?.[0]?.toUpperCase() || 'CARS';
                    
                    wordsBefore = wordsBefore
                        .replace(/^\[?PS5\]?\s*/i, '')
                        .replace(/^\[?PS4\]?\s*/i, '')
                        .replace(/^\[?XBOX\s+XS\]?\s*/i, '')
                        .replace(/^\[?XBOX\s+ONE\]?\s*/i, '')
                        .replace(/^\[?XBOX\s+SERIES\]?\s*/i, '')
                        .replace(/^MODDED\s+/i, '')
                        .trim();
                    
                    let category = wordsBefore && wordsBefore.length > 0 
                        ? `${wordsBefore.toUpperCase()} ${carWord}`
                        : `MODDED ${carWord}`;
                    
                    services.push({
                        service: category,
                        console: console,
                        quantity: '',
                        category: category
                    });
                }
            }
        }
        
        // 4. FULL BUNKER UNLOCK
        if (productNameUpper.includes('FULL BUNKER UNLOCK') || productNameUpper.includes('BUNKER UNLOCK')) {
            services.push({
                service: 'FULL BUNKER UNLOCK',
                console: console,
                quantity: '',
                category: 'FULL BUNKER UNLOCK'
            });
        }
        
        // 5. Rank / RANK BOOST
        const hasRank = productNameUpper.includes('RANK') || productNameUpper.includes('RANK BOOST');
        if (hasRank) {
            let quantity = '';
            const rankRangeMatch = productNameUpper.match(/(\d+)\s*[–-]\s*(\d+)\s*(RANK|BOOST)/i) || 
                                   productNameUpper.match(/(RANK|BOOST)\s*(\d+)\s*[–-]\s*(\d+)/i);
            if (rankRangeMatch) {
                if (rankRangeMatch[3] && rankRangeMatch[1] && rankRangeMatch[2]) {
                    quantity = rankRangeMatch[1] === 'RANK' || rankRangeMatch[1] === 'BOOST' 
                        ? `${rankRangeMatch[2]}-${rankRangeMatch[3]}`
                        : `${rankRangeMatch[1]}-${rankRangeMatch[2]}`;
                } else {
                    quantity = `${rankRangeMatch[1]}-${rankRangeMatch[2]}`;
                }
            } else {
                const rankQtyMatch = productNameUpper.match(/(\d+)\s*(RANK|BOOST)/i) || 
                                     productNameUpper.match(/(RANK|BOOST)\s*(\d+)/i);
                if (rankQtyMatch) {
                    quantity = rankQtyMatch[1] === 'RANK' || rankQtyMatch[1] === 'BOOST' 
                        ? rankQtyMatch[2] 
                        : rankQtyMatch[1];
                }
            }
            
            if (quantity) {
                services.push({
                    service: `Rank ${quantity}`,
                    console: console,
                    quantity: quantity,
                    category: 'Rank'
                });
            }
        }
        
        // 6. LVL / LEVEL
        const hasLVL = productNameUpper.includes('LVL') || productNameUpper.includes('LEVEL');
        if (hasLVL) {
            let quantity = '';
            const lvlQtyMatch = productNameUpper.match(/(\d+)\s*(LVL|LEVEL)/i) || 
                               productNameUpper.match(/(LVL|LEVEL)\s*(\d+)/i);
            if (lvlQtyMatch) {
                quantity = lvlQtyMatch[1] === 'LVL' || lvlQtyMatch[1] === 'LEVEL' 
                    ? lvlQtyMatch[2] 
                    : lvlQtyMatch[1];
            }
            
            if (quantity) {
                services.push({
                    service: `LVL ${quantity}`,
                    console: console,
                    quantity: quantity,
                    category: 'LVL'
                });
            }
        }
        
        // 7. CASH + CARS или ONLY CASH
        if (productNameUpper.includes('CASH')) {
            let quantity = '';
            const qtyMatch = productNameUpper.match(/(\d+[MK]?)\s*M/i);
            if (qtyMatch) {
                quantity = qtyMatch[1];
            } else {
                const altQtyMatch = productNameUpper.match(/(\d+[MK]?)\s*(CASH|MONEY)/i);
                if (altQtyMatch) {
                    quantity = altQtyMatch[1];
                } else {
                    const numberMatch = productNameUpper.match(/(\d+)\s*(CASH|CARS)/i);
                    if (numberMatch) {
                        quantity = numberMatch[1];
                    }
                }
            }
            
            if (quantity && !quantity.toUpperCase().endsWith('M') && !quantity.toUpperCase().endsWith('K')) {
                quantity = quantity + 'M';
            }
            
            if (quantity) {
                if (productNameUpper.includes('CASH') && productNameUpper.includes('CARS')) {
                    services.push({
                        service: `CASH + CARS`,
                        console: console,
                        quantity: quantity,
                        category: 'CASH + CARS'
                    });
                } else if (productNameUpper.includes('CASH') && !productNameUpper.includes('CARS')) {
                    services.push({
                        service: `ONLY CASH`,
                        console: console,
                        quantity: quantity,
                        category: 'ONLY CASH'
                    });
                }
            }
        }
        
        // Если не найдено ни одной услуги, возвращаем одну услугу с оригинальным названием
        if (services.length === 0) {
            services.push({
                service: productName,
                console: console,
                quantity: '',
                category: 'UNKNOWN'
            });
        }
        
        return services;
    }

    /**
     * Создает карточку в Trello из заказа
     * Если в заказе несколько услуг, создает отдельную карточку для каждой
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
            
            // Извлекаем все услуги из названия продукта
            const services = this.extractServicesFromProductName(order.productName);
            console.log(`🔍 [TRELLO] Найдено услуг в заказе №${order.orderId}: ${services.length}`);
            
            let allCardsCreated = true;
            
            // Создаем карточку для каждой услуги
            for (let i = 0; i < services.length; i++) {
                const service = services[i];
                const serviceOrderId = services.length > 1 ? `${order.orderId}-${i + 1}` : order.orderId;
                
                console.log(`📝 [TRELLO] Обработка услуги ${i + 1}/${services.length} для заказа №${order.orderId}: ${service.service}`);
                
                // Проверяем, есть ли уже карточка для этой услуги
                // Сначала ищем по serviceOrderId, затем по оригинальному orderId + услуге
                let existingCard = await this.findCardByOrderId(serviceOrderId);
                
                // Если не нашли по serviceOrderId и это заказ с несколькими услугами, ищем по оригинальному orderId + услуге
                if (!existingCard && services.length > 1) {
                    existingCard = await this.findCardByOrderIdAndService(order.orderId, service);
                }
            
            if (existingCard) {
                    console.log(`✅ [TRELLO] Карточка для услуги ${service.service} заказа №${order.orderId} уже существует, обновляем...`);
                    const updateResult = await this.updateExistingCard(existingCard.id, order, service);
                    if (!updateResult) {
                        allCardsCreated = false;
                    }
            } else {
                    // Проверяем статус заказа - создаем карточки только для статуса "Delivering"
                    const orderStatus = (order.status || '').toUpperCase();
                    const allowedStatuses = ['DELIVERING'];
                    const forbiddenStatuses = ['COMPLETED', 'DELIVERED', 'ISSUES', 'CANCELLED', 'CANCEL REQUESTED', 'CANCEL REQUEST'];
                    
                    // Проверяем, является ли статус запрещенным
                    const isForbiddenStatus = forbiddenStatuses.some(status => orderStatus.includes(status));
                    // Проверяем, является ли статус разрешенным
                    const isAllowedStatus = allowedStatuses.some(status => orderStatus.includes(status));
                    
                    if (isForbiddenStatus || (!isAllowedStatus && orderStatus)) {
                        console.log(`⚠️ [TRELLO] Карточка для услуги ${service.service} заказа №${order.orderId} не будет создана. Статус "${order.status}" не позволяет создавать новые карточки. Создание карточек разрешено только для статуса "Delivering".`);
                        allCardsCreated = false;
                        continue; // Пропускаем создание карточки для этого статуса
                    }
                    
                    // Создаем новую карточку для услуги (только для статуса Delivering)
                    const cardTitle = this.buildCardTitleFromService(service);
                    console.log(`   - Название карточки: ${cardTitle}`);
                console.log(`   - Список ID: ${this.listId}`);
                console.log(`   - Статус: ${order.status || 'UNKNOWN'}`);

                const cardData = {
                        name: cardTitle,
                    idList: this.listId,
                        desc: this.buildCardDescription(order, service, serviceOrderId),
                    key: this.apiKey,
                    token: this.apiToken
                };

                console.log(`📤 [TRELLO] Отправка запроса на создание карточки в Trello...`);
                const response = await axios.post(`${this.baseUrl}/cards`, cardData);

                if (response.status === 200 || response.status === 201) {
                        console.log(`✅ [TRELLO] Карточка Trello создана успешно для услуги ${service.service} заказа №${order.orderId}`);
                    console.log(`   - ID карточки: ${response.data.id}`);
                    console.log(`   - Название: ${response.data.name}`);
                        
                        // Присваиваем метку по статусу заказа
                        if (order.status) {
                            await this.assignLabelToCardByStatus(response.data.id, order.status);
                        }
                } else {
                        console.error(`❌ [TRELLO] Ошибка создания карточки Trello для услуги ${service.service} заказа №${order.orderId}: статус ${response.status}`);
                        allCardsCreated = false;
                    }
                }
            }
            
            return allCardsCreated;

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
     * Строит название карточки из услуги
     */
    buildCardTitleFromService(service) {
        if (!service || service.console === 'UNKNOWN') {
            return service?.service || 'UNKNOWN';
        }
        
        if (service.category === 'Rank' || service.category === 'LVL') {
            return `[${service.console}] ${service.quantity} ${service.category}`;
        }
        
        // Для FULL BUNKER UNLOCK и других услуг без количества
        if (service.category === 'FULL BUNKER UNLOCK' || service.category === 'GTA 5 PACKAGE') {
            return `[${service.console}] ${service.category}`;
        }
        
        if (service.quantity) {
            return `[${service.console}] ${service.quantity} ${service.category}`;
        }
        
        return `[${service.console}] ${service.category}`;
    }

        /**
         * Строит название карточки в формате [CONSOLE] QUANTITY CATEGORY
         * @deprecated Используйте buildCardTitleFromService для работы с отдельными услугами
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
        buildCardDescription(order, service = null, serviceOrderId = null) {
            let desc = `Источник: G2G\n`;
            desc += `ID заказа: ${serviceOrderId || order.orderId || 'UNKNOWN'}\n`;
            
            // Если это одна из нескольких услуг, указываем это
            if (service) {
                desc += `Услуга: ${service.service}\n`;
                if (serviceOrderId && serviceOrderId !== order.orderId) {
                    desc += `Оригинальный ID заказа: ${order.orderId}\n`;
                }
            }
            
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
     * Удаляет все старые метки статуса и добавляет новую
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
            
            // Получаем все метки статуса на доске
            const allStatusLabels = await this.getBoardLabels();
            const statusLabelNames = ['DELIVERING', 'CANCEL REQUESTED', 'DELIVERED', 'COMPLETED', 'CANCELLED'];
            const statusLabelIds = allStatusLabels
                .filter(l => statusLabelNames.includes(l.name))
                .map(l => l.id);
            
            // Удаляем все старые метки статуса (оставляем только не-статусные метки)
            const nonStatusLabelIds = currentLabelIds.filter(id => !statusLabelIds.includes(id));
            
            // Формируем новый список меток: не-статусные метки + новая метка статуса
            const newLabelIds = [...nonStatusLabelIds, label.id];
            
            // Проверяем текущие метки статуса
            const currentStatusLabelIds = currentLabelIds.filter(id => statusLabelIds.includes(id));
            
            // ВСЕГДА обновляем метки, если:
            // 1. Нет нужной метки статуса
            // 2. Есть несколько меток статуса (должна быть только одна)
            // 3. Текущая метка статуса отличается от нужной
            // 4. Есть хотя бы одна метка статуса, которая не является нужной
            const hasWrongStatusLabel = currentStatusLabelIds.some(id => id !== label.id);
            const needsUpdate = !currentStatusLabelIds.includes(label.id) || 
                               currentStatusLabelIds.length > 1 || 
                               hasWrongStatusLabel;
            
            if (needsUpdate) {
                // ВСЕГДА обновляем метки: удаляем все старые метки статуса, добавляем новую
                console.log(`🔄 [TRELLO] Обновление меток для карточки ${cardId}: удаление ${currentStatusLabelIds.length} старых меток, установка "${labelName}"`);
                
                const updateResponse = await axios.put(`${this.baseUrl}/cards/${cardId}/idLabels`, null, {
                    params: {
                        key: this.apiKey,
                        token: this.apiToken,
                        value: newLabelIds.join(',')
                    }
                });

                if (updateResponse.status === 200) {
                    if (currentStatusLabelIds.length > 1) {
                        console.log(`✅ [TRELLO] Удалены ${currentStatusLabelIds.length} старых меток статуса, установлена "${labelName}" для карточки ${cardId}`);
                    } else if (!currentStatusLabelIds.includes(label.id)) {
                        console.log(`✅ [TRELLO] Заменена метка статуса на "${labelName}" для карточки ${cardId}`);
                    } else {
                        console.log(`✅ [TRELLO] Обновлена метка статуса "${labelName}" для карточки ${cardId}`);
                    }
                    return true;
                } else {
                    console.error(`❌ [TRELLO] Ошибка обновления метки "${labelName}": статус ${updateResponse.status}`);
                    return false;
                }
            } else {
                // Метка уже правильная и единственная
                console.log(`✅ [TRELLO] Метка "${labelName}" уже установлена и единственная для карточки ${cardId}`);
                return true;
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
     * Ищет по всей доске Trello, а не только в одном списке
     */
    async findCardByOrderId(orderId) {
        if (!this.isConfigured()) {
            return null;
        }

        try {
            // Получаем все карточки на доске (не только в одном списке)
            const response = await axios.get(`${this.baseUrl}/boards/${this.boardId}/cards`, {
                params: {
                    key: this.apiKey,
                    token: this.apiToken,
                    fields: 'id,name,desc,idList'
                }
            });

            if (response.status === 200) {
                // Ищем карточку с нужным ID заказа в описании
                const cards = response.data;
                for (const card of cards) {
                    if (card.desc) {
                        // Ищем по точному совпадению "ID заказа: orderId"
                        if (card.desc.includes(`ID заказа: ${orderId}`)) {
                            console.log(`🔍 Найдена существующая карточка для заказа ${orderId} на всей доске: ${card.id} (список: ${card.idList})`);
                            return card;
                        }
                        // Также ищем по "Оригинальный ID заказа: orderId" для заказов с несколькими услугами
                        if (card.desc.includes(`Оригинальный ID заказа: ${orderId}`)) {
                            console.log(`🔍 Найдена существующая карточка для заказа ${orderId} (по оригинальному ID) на всей доске: ${card.id} (список: ${card.idList})`);
                            return card;
                        }
                    }
                }
            }
        } catch (error) {
            console.error('❌ Ошибка поиска карточки по всей доске:', error.message);
        }
        
        return null;
    }

    /**
     * Находит существующую карточку по оригинальному ID заказа и услуге
     * Ищет по всей доске Trello, а не только в одном списке
     */
    async findCardByOrderIdAndService(orderId, service) {
        if (!this.isConfigured()) {
            return null;
        }

        try {
            // Получаем все карточки на доске (не только в одном списке)
            const response = await axios.get(`${this.baseUrl}/boards/${this.boardId}/cards`, {
                params: {
                    key: this.apiKey,
                    token: this.apiToken,
                    fields: 'id,name,desc,idList'
                }
            });

            if (response.status === 200) {
                const cards = response.data;
                const serviceTitle = this.buildCardTitleFromService(service);
                
                for (const card of cards) {
                    if (card.desc) {
                        // Проверяем, что карточка относится к этому заказу
                        const hasOrderId = card.desc.includes(`Оригинальный ID заказа: ${orderId}`) || 
                                          card.desc.includes(`ID заказа: ${orderId}`);
                        
                        // Проверяем, что название карточки совпадает с названием услуги
                        const hasServiceTitle = card.name === serviceTitle;
                        
                        if (hasOrderId && hasServiceTitle) {
                            console.log(`🔍 Найдена существующая карточка для заказа ${orderId} и услуги "${service.service}" на всей доске: ${card.id} (список: ${card.idList})`);
                            return card;
                        }
                    }
                }
            }
        } catch (error) {
            console.error('❌ Ошибка поиска карточки по заказу и услуге на всей доске:', error.message);
        }
        
        return null;
    }

    /**
     * Обновляет существующую карточку
     */
    async updateExistingCard(cardId, order, service = null) {
        if (!this.isConfigured()) {
            return false;
        }

        try {
            console.log('📝 Обновление существующей карточки Trello:', cardId);

            // Если есть услуга, используем её для построения названия
            let cardName, cardDescription;
            if (service) {
                cardName = this.buildCardTitleFromService(service);
                const serviceOrderId = order.orderId; // Можно улучшить, если нужно
                cardDescription = this.buildCardDescription(order, service, serviceOrderId);
            } else {
                cardName = this.buildCardTitle(order);
                cardDescription = this.buildCardDescription(order);
            }

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
                
                // ВСЕГДА обновляем метку по статусу заказа при обновлении карточки
                if (order.status) {
                    console.log(`🏷️ [TRELLO] Обновление метки статуса для карточки ${cardId}: ${order.status}`);
                    await this.assignLabelToCardByStatus(cardId, order.status);
                } else {
                    console.log(`⚠️ [TRELLO] Статус заказа не указан для карточки ${cardId}`);
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
