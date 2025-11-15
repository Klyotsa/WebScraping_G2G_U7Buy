const express = require('express');
const cors = require('cors');
const G2GScraper = require('./src/scraper/g2g-scraper');
const TrelloService = require('./src/services/trello-service');
require('dotenv').config();

const app = express();
const port = process.env.PORT || 3000;

// Middleware
app.use(express.json());
app.use(cors());

// Services
const g2gScraper = new G2GScraper();
const trelloService = new TrelloService();

// Routes
app.get('/', (req, res) => {
    res.json({
        message: 'G2G Trello Scraper API',
        version: '1.0.0',
            endpoints: {
                'POST /g2g/process-orders': 'Process all orders (PREPARING -> DELIVERING -> Trello cards)',
                'GET /status': 'Get scraper status',
                'POST /g2g/open-login': 'Open G2G login page',
                'POST /g2g/open-orders': 'Open G2G orders page',
        'POST /g2g/open-delivering': 'Open G2G delivering orders page',
        'POST /g2g/open-boosting-preparing': 'Open G2G boosting preparing orders page',
        'POST /g2g/open-boosting-delivering': 'Open G2G boosting delivering orders page',
        'GET /g2g/check-login': 'Check if logged in',
        'POST /g2g/scrape': 'Scrape orders',
        'POST /g2g/scrape-delivering': 'Scrape delivering orders',
        'POST /g2g/scrape-boosting-preparing': 'Scrape boosting preparing orders',
        'POST /g2g/scrape-boosting-delivering': 'Scrape boosting delivering orders',
        'POST /g2g/scrape-and-create-cards': 'Scrape and create Trello cards',
        'POST /g2g/scrape-delivering-and-create-cards': 'Scrape delivering orders and create Trello cards',
        'POST /g2g/scrape-boosting-preparing-and-create-cards': 'Scrape boosting preparing orders and create Trello cards',
        'POST /g2g/scrape-boosting-delivering-and-create-cards': 'Scrape boosting delivering orders and create Trello cards',
        'POST /g2g/scrape-all-and-create-cards': 'Scrape all orders (boosting preparing, boosting delivering) and create Trello cards',
                'POST /g2g/clear-processed': 'Clear processed orders list',
                'POST /g2g/start-delivery/:orderId': 'Start delivery for specific order',
                'POST /g2g/extract-chat-data': 'Extract account data from chat',
                'GET /trello/test': 'Test Trello connection',
                'POST /trello/create-labels': 'Create status labels on Trello board',
                'POST /trello/update-all-cards': 'Update all cards with new title format'
            }
    });
});

// Основной эндпоинт для обработки всех заказов
app.post('/g2g/process-orders', async (req, res) => {
    try {
        console.log('📋 [ENDPOINT] Начало обработки всех заказов...');
        
        // Проверяем настройки Trello
        if (!trelloService.isConfigured()) {
            console.error('❌ [ENDPOINT] Trello API не настроен!');
            return res.status(500).json({
                status: 'error',
                message: 'Trello API не настроен. Проверьте переменные окружения: TRELLO_API_KEY, TRELLO_API_TOKEN, TRELLO_BOARD_ID, TRELLO_LIST_ID'
            });
        }
        
        let cardsCreated = 0;
        let cardsSkipped = 0;
        const allOrders = [];
        
        // Обрабатываем все заказы с callback для создания карточек
        const processedOrders = await g2gScraper.processAllOrders(async (order) => {
            try {
                if (!order || !order.orderId || order.orderId === 'UNKNOWN') {
                    console.log(`⚠️ [ENDPOINT] Пропускаем заказ без orderId:`, order);
                    cardsSkipped++;
                    return false;
                }
                
                console.log(`📝 [ENDPOINT] Создание карточки для заказа №${order.orderId}...`);
                const result = await trelloService.createCardFromOrder(order);
                if (result) {
                    cardsCreated++;
                    console.log(`✅ [ENDPOINT] Карточка создана для заказа №${order.orderId}`);
                } else {
                    cardsSkipped++;
                    console.log(`⚠️ [ENDPOINT] Не удалось создать карточку для заказа №${order.orderId}`);
                }
                allOrders.push(order);
                return result;
            } catch (orderError) {
                console.error(`❌ [ENDPOINT] Ошибка создания карточки для заказа №${order?.orderId || 'UNKNOWN'}:`, orderError.message);
                cardsSkipped++;
                allOrders.push(order);
                return false;
            }
        });
        
        console.log(`📊 [ENDPOINT] Итого: обработано ${allOrders.length}, создано ${cardsCreated}, пропущено ${cardsSkipped}`);
        
        res.json({
            status: 'success',
            message: 'Обработка заказов завершена',
            ordersProcessed: allOrders.length,
            cardsCreated,
            cardsSkipped,
            orders: allOrders
        });
    } catch (error) {
        console.error(`❌ [ENDPOINT] Ошибка:`, error.message);
        res.status(500).json({
            status: 'error',
            message: error.message
        });
    }
});

// G2G Scraper Routes
app.post('/g2g/open-login', async (req, res) => {
    try {
        await g2gScraper.openLoginPage();
        res.json({
            status: 'success',
            message: 'Страница логина открыта. Войдите в G2G и вызовите /g2g/check-login'
        });
    } catch (error) {
        res.status(500).json({
            status: 'error',
            message: error.message
        });
    }
});

app.post('/g2g/open-orders', async (req, res) => {
    try {
        await g2gScraper.openOrdersPage();
        res.json({
            status: 'success',
            message: 'Страница заказов открыта. Вызовите /g2g/check-login для проверки'
        });
    } catch (error) {
        res.status(500).json({
            status: 'error',
            message: error.message
        });
    }
});


app.post('/g2g/open-delivering', async (req, res) => {
    try {
        await g2gScraper.openDeliveringPage();
        res.json({
            status: 'success',
            message: 'Страница Delivering заказов открыта. Вызовите /g2g/check-login для проверки'
        });
    } catch (error) {
        res.status(500).json({
            status: 'error',
            message: error.message
        });
    }
});

app.post('/g2g/open-boosting-preparing', async (req, res) => {
    try {
        await g2gScraper.openBoostingPreparingPage();
        res.json({
            status: 'success',
            message: 'Страница Boosting Preparing заказов открыта. Вызовите /g2g/check-login для проверки'
        });
    } catch (error) {
        res.status(500).json({
            status: 'error',
            message: error.message
        });
    }
});

app.post('/g2g/open-boosting-delivering', async (req, res) => {
    try {
        await g2gScraper.openBoostingDeliveringPage();
        res.json({
            status: 'success',
            message: 'Страница Boosting Delivering заказов открыта. Вызовите /g2g/check-login для проверки'
        });
    } catch (error) {
        res.status(500).json({
            status: 'error',
            message: error.message
        });
    }
});

app.get('/g2g/check-login', async (req, res) => {
    try {
        const isLoggedIn = await g2gScraper.checkIfLoggedIn();
        res.json({
            status: 'success',
            message: isLoggedIn ? 'Пользователь залогинен' : 'Требуется вход',
            isLoggedIn
        });
    } catch (error) {
        res.status(500).json({
            status: 'error',
            message: error.message
        });
    }
});

app.post('/g2g/scrape', async (req, res) => {
    try {
        const orders = await g2gScraper.scrapeOrders();
        res.json({
            status: 'success',
            message: 'Парсинг заказов завершен',
            ordersFound: orders.length,
            orders
        });
    } catch (error) {
        res.status(500).json({
            status: 'error',
            message: error.message
        });
    }
});


app.post('/g2g/scrape-delivering', async (req, res) => {
    try {
        const deliveringOrders = await g2gScraper.scrapeDeliveringOrders();
        res.json({
            status: 'success',
            message: 'Парсинг Delivering заказов завершен',
            ordersFound: deliveringOrders.length,
            orders: deliveringOrders
        });
    } catch (error) {
        res.status(500).json({
            status: 'error',
            message: error.message
        });
    }
});

app.post('/g2g/scrape-and-create-cards', async (req, res) => {
    try {
        const orders = await g2gScraper.scrapeOrders();
        let cardsCreated = 0;
        
        for (const order of orders) {
            if (await trelloService.createCardFromOrder(order)) {
                cardsCreated++;
            }
        }
        
        res.json({
            status: 'success',
            message: 'Парсинг и создание карточек завершено',
            ordersFound: orders.length,
            cardsCreated,
            orders
        });
    } catch (error) {
        res.status(500).json({
            status: 'error',
            message: error.message
        });
    }
});


app.post('/g2g/scrape-delivering-and-create-cards', async (req, res) => {
        try {
            const deliveringOrders = await g2gScraper.scrapeDeliveringOrders();
            let cardsCreated = 0;
            
            for (const order of deliveringOrders) {
                if (await trelloService.createCardFromOrder(order)) {
                    cardsCreated++;
                }
            }
            
            res.json({
                status: 'success',
                message: 'Парсинг Delivering заказов и создание карточек завершено',
                ordersFound: deliveringOrders.length,
                cardsCreated,
                orders: deliveringOrders
            });
        } catch (error) {
            res.status(500).json({
                status: 'error',
                message: error.message
            });
        }
    });

app.post('/g2g/scrape-boosting-preparing', async (req, res) => {
    try {
        const boostingPreparingOrders = await g2gScraper.scrapeBoostingPreparingOrders();
        res.json({
            status: 'success',
            message: 'Парсинг Boosting Preparing заказов завершен',
            ordersFound: boostingPreparingOrders.length,
            orders: boostingPreparingOrders
        });
    } catch (error) {
        res.status(500).json({
            status: 'error',
            message: error.message
        });
    }
});

app.post('/g2g/scrape-boosting-delivering', async (req, res) => {
    try {
        const boostingDeliveringOrders = await g2gScraper.scrapeBoostingDeliveringOrders();
        res.json({
            status: 'success',
            message: 'Парсинг Boosting Delivering заказов завершен',
            ordersFound: boostingDeliveringOrders.length,
            orders: boostingDeliveringOrders
        });
    } catch (error) {
        res.status(500).json({
            status: 'error',
            message: error.message
        });
    }
});

app.post('/g2g/scrape-boosting-preparing-and-create-cards', async (req, res) => {
        try {
            console.log('📋 [ENDPOINT] Начало парсинга Boosting Preparing заказов и создания карточек...');
            
            // Проверяем настройки Trello
            if (!trelloService.isConfigured()) {
                console.error('❌ [ENDPOINT] Trello API не настроен! Пропускаем создание карточек.');
                return res.status(500).json({
                    status: 'error',
                    message: 'Trello API не настроен. Проверьте переменные окружения: TRELLO_API_KEY, TRELLO_API_TOKEN, TRELLO_BOARD_ID, TRELLO_LIST_ID',
                    ordersFound: 0,
                    cardsCreated: 0
                });
            }
            
            let cardsCreated = 0;
            let cardsSkipped = 0;
            const allOrders = [];
            
            // Парсим заказы и создаем карточки сразу после парсинга каждого заказа
            const boostingPreparingOrders = await g2gScraper.scrapeBoostingPreparingOrders({
                onOrderParsed: async (order) => {
                    try {
                        if (!order || !order.orderId || order.orderId === 'UNKNOWN') {
                            console.log(`⚠️ [ENDPOINT] Пропускаем заказ без orderId:`, order);
                            cardsSkipped++;
                            return false;
                        }
                        
                        console.log(`📝 [ENDPOINT] Создание карточки для заказа №${order.orderId}...`);
                        const result = await trelloService.createCardFromOrder(order);
                        if (result) {
                    cardsCreated++;
                            console.log(`✅ [ENDPOINT] Карточка создана для заказа №${order.orderId}`);
                } else {
                            cardsSkipped++;
                            console.log(`⚠️ [ENDPOINT] Не удалось создать карточку для заказа №${order.orderId}`);
                        }
                        allOrders.push(order);
                        return result;
                    } catch (orderError) {
                        console.error(`❌ [ENDPOINT] Ошибка создания карточки для заказа №${order?.orderId || 'UNKNOWN'}:`, orderError.message);
                        cardsSkipped++;
                        allOrders.push(order);
                        return false;
                    }
                }
            });
            
            // Добавляем заказы, которые могли быть обработаны без callback
            for (const order of boostingPreparingOrders) {
                if (!allOrders.find(o => o.orderId === order.orderId)) {
                    allOrders.push(order);
                }
            }
            
            console.log(`📊 [ENDPOINT] Итого: найдено ${allOrders.length}, создано ${cardsCreated}, пропущено ${cardsSkipped}`);
            
            res.json({
                status: 'success',
                message: 'Парсинг Boosting Preparing заказов и создание карточек завершено',
                ordersFound: allOrders.length,
                cardsCreated,
                cardsSkipped,
                orders: allOrders
            });
        } catch (error) {
            console.error(`❌ [ENDPOINT] Ошибка:`, error.message);
            res.status(500).json({
                status: 'error',
                message: error.message
            });
        }
    });

app.post('/g2g/scrape-boosting-delivering-and-create-cards', async (req, res) => {
        try {
            console.log('📋 [ENDPOINT] Начало парсинга Boosting Delivering заказов и создания карточек...');
            
            // Проверяем настройки Trello
            if (!trelloService.isConfigured()) {
                console.error('❌ [ENDPOINT] Trello API не настроен! Пропускаем создание карточек.');
                return res.status(500).json({
                status: 'error',
                    message: 'Trello API не настроен. Проверьте переменные окружения: TRELLO_API_KEY, TRELLO_API_TOKEN, TRELLO_BOARD_ID, TRELLO_LIST_ID',
                    ordersFound: 0,
                    cardsCreated: 0
            });
        }

        let cardsCreated = 0;
            let cardsSkipped = 0;
            const allOrders = [];
            
            // Парсим заказы и создаем карточки сразу после парсинга каждого заказа
            const boostingDeliveringOrders = await g2gScraper.scrapeBoostingDeliveringOrders({
                onOrderParsed: async (order) => {
                    try {
                        if (!order || !order.orderId || order.orderId === 'UNKNOWN') {
                            console.log(`⚠️ [ENDPOINT] Пропускаем заказ без orderId:`, order);
                            cardsSkipped++;
                            return false;
                        }
                        
                        console.log(`📝 [ENDPOINT] Создание карточки для заказа №${order.orderId}...`);
                        const result = await trelloService.createCardFromOrder(order);
                        if (result) {
                    cardsCreated++;
                            console.log(`✅ [ENDPOINT] Карточка создана для заказа №${order.orderId}`);
                } else {
                            cardsSkipped++;
                            console.log(`⚠️ [ENDPOINT] Не удалось создать карточку для заказа №${order.orderId}`);
                        }
                        allOrders.push(order);
                        return result;
                    } catch (orderError) {
                        console.error(`❌ [ENDPOINT] Ошибка создания карточки для заказа №${order?.orderId || 'UNKNOWN'}:`, orderError.message);
                        cardsSkipped++;
                        allOrders.push(order);
                        return false;
                    }
                }
            });
            
            // Добавляем заказы, которые могли быть обработаны без callback
            for (const order of boostingDeliveringOrders) {
                if (!allOrders.find(o => o.orderId === order.orderId)) {
                    allOrders.push(order);
                }
            }
            
            console.log(`📊 [ENDPOINT] Итого: найдено ${allOrders.length}, создано ${cardsCreated}, пропущено ${cardsSkipped}`);
        
        res.json({
            status: 'success',
                message: 'Парсинг Boosting Delivering заказов и создание карточек завершено',
                ordersFound: allOrders.length,
            cardsCreated,
                cardsSkipped,
                orders: allOrders
        });
    } catch (error) {
            console.error(`❌ [ENDPOINT] Ошибка:`, error.message);
        res.status(500).json({
            status: 'error',
            message: error.message
        });
    }
});

app.get('/g2g/status', async (req, res) => {
        try {
            const status = await g2gScraper.getStatus();
            res.json(status);
        } catch (error) {
            res.status(500).json({
                status: 'error',
                message: error.message
            });
        }
    });

app.post('/g2g/clear-processed', async (req, res) => {
        try {
            g2gScraper.clearProcessedOrders();
            res.json({
                status: 'success',
                message: 'Список обработанных заказов очищен'
            });
        } catch (error) {
            res.status(500).json({
                status: 'error',
                message: error.message
            });
        }
    });

app.post('/g2g/start-delivery/:orderId', async (req, res) => {
        try {
            const orderId = req.params.orderId;
            if (!orderId) {
                return res.status(400).json({
                    status: 'error',
                    message: 'ID заказа не указан'
                });
            }

            const success = await g2gScraper.startDeliveryForOrder(orderId);
            if (success) {
                res.json({
                    status: 'success',
                    message: `Доставка запущена для заказа ${orderId}`,
                    orderId: orderId
                });
            } else {
                res.status(400).json({
                    status: 'error',
                    message: `Не удалось запустить доставку для заказа ${orderId}`
                });
            }
        } catch (error) {
            res.status(500).json({
                status: 'error',
                message: error.message
            });
        }
    });

app.post('/g2g/extract-chat-data', async (req, res) => {
        try {
            const { chatUrl } = req.body;
            if (!chatUrl) {
                return res.status(400).json({
                    status: 'error',
                    message: 'URL чата не указан'
                });
            }

            const accountData = await g2gScraper.extractAccountDataFromChat(chatUrl);
            if (accountData) {
                res.json({
                    status: 'success',
                    message: 'Данные аккаунта извлечены из чата',
                    accountData: accountData
                });
            } else {
                res.status(400).json({
                    status: 'error',
                    message: 'Не удалось извлечь данные аккаунта из чата'
                });
            }
        } catch (error) {
            res.status(500).json({
                status: 'error',
                message: error.message
            });
        }
    });

// Trello Routes
// Обновление всех карточек по новым правилам названия
app.post('/trello/update-all-cards', async (req, res) => {
    try {
        console.log('📋 [ENDPOINT] Обновление всех карточек по новым правилам...');
        
        if (!trelloService.isConfigured()) {
            return res.status(500).json({
                status: 'error',
                message: 'Trello API не настроен. Проверьте переменные окружения: TRELLO_API_KEY, TRELLO_API_TOKEN, TRELLO_BOARD_ID, TRELLO_LIST_ID'
            });
        }

        const results = await trelloService.updateAllCardsWithNewTitleFormat();
        
        if (results.success) {
            res.json({
                status: 'success',
                message: 'Карточки обновлены успешно',
                results: results
            });
        } else {
            res.status(500).json({
                status: 'error',
                message: 'Ошибка при обновлении карточек',
                results: results
            });
        }
    } catch (error) {
        console.error(`❌ [ENDPOINT] Ошибка обновления карточек:`, error.message);
        res.status(500).json({
            status: 'error',
            message: error.message
        });
    }
});

// Создание меток на доске Trello
app.post('/trello/create-labels', async (req, res) => {
    try {
        console.log('📋 [ENDPOINT] Создание меток на доске Trello...');
        
        if (!trelloService.isConfigured()) {
            return res.status(500).json({
            status: 'error',
                message: 'Trello API не настроен. Проверьте переменные окружения: TRELLO_API_KEY, TRELLO_API_TOKEN, TRELLO_BOARD_ID, TRELLO_LIST_ID'
            });
        }

        const results = await trelloService.createStatusLabels();
        
        if (results.success) {
            res.json({
                status: 'success',
                message: 'Метки созданы успешно',
                results: results
            });
        } else {
            res.status(500).json({
                status: 'error',
                message: 'Ошибка при создании меток',
                results: results
            });
        }
    } catch (error) {
        console.error(`❌ [ENDPOINT] Ошибка создания меток:`, error.message);
        res.status(500).json({
            status: 'error',
            message: error.message
        });
    }
});

app.get('/trello/test', async (req, res) => {
    try {
        const isConnected = await trelloService.testConnection();
        res.json({
            status: 'success',
            message: isConnected ? 'Подключение к Trello API успешно' : 'Trello API не настроен',
            connected: isConnected
        });
    } catch (error) {
        res.status(500).json({
            status: 'error',
            message: error.message
        });
    }
});

// Тестовый эндпоинт для создания карточки из одного заказа (для отладки)
app.post('/g2g/test-create-card/:orderId', async (req, res) => {
    try {
        const orderId = req.params.orderId;
        console.log(`🧪 [TEST] Тест создания карточки для заказа №${orderId}...`);
        
        // Создаем тестовый объект заказа
        const testOrder = {
            orderId: orderId,
            source: 'G2G',
            console: 'PS5',
            quantity: '100M',
            category: 'CASH',
            price: 50.00,
            orderDate: new Date().toLocaleDateString('ru-RU'),
            status: 'Delivering',
            details: 'Test order'
        };
        
        console.log(`📝 [TEST] Данные заказа:`, JSON.stringify(testOrder, null, 2));
        
        if (!trelloService.isConfigured()) {
            return res.status(500).json({
                status: 'error',
                message: 'Trello API не настроен'
            });
        }
        
        const result = await trelloService.createCardFromOrder(testOrder);
            
            res.json({
            status: result ? 'success' : 'error',
            message: result ? `Карточка создана для заказа №${orderId}` : `Не удалось создать карточку для заказа №${orderId}`,
            orderId: orderId,
            cardCreated: result
        });
    } catch (error) {
        res.status(500).json({
            status: 'error',
            message: error.message
        });
    }
});

// Парсинг заказов из категорий Boosting
app.post('/g2g/scrape-all-and-create-cards', async (req, res) => {
    try {
        await g2gScraper.init();

        // Парсим Boosting Preparing заказы
        console.log('🚀 Парсинг Boosting Preparing заказов...');
        const boostingPreparingOrders = await g2gScraper.scrapeBoostingPreparingOrders();

        // Парсим Boosting Delivering заказы
        console.log('🚚 Парсинг Boosting Delivering заказов...');
        const boostingDeliveringOrders = await g2gScraper.scrapeBoostingDeliveringOrders();

        // Объединяем все заказы
        const allOrders = [...boostingPreparingOrders, ...boostingDeliveringOrders];
        
        // Создаем карточки Trello
        let cardsCreated = 0;
        for (const order of allOrders) {
            if (await trelloService.createCardFromOrder(order)) {
                cardsCreated++;
            }
        }

        res.json({
            status: 'success',
            message: 'Парсинг всех заказов и создание карточек завершено',
            boostingPreparingOrders: boostingPreparingOrders.length,
            boostingDeliveringOrders: boostingDeliveringOrders.length,
            totalOrders: allOrders.length,
            cardsCreated,
            orders: allOrders
        });
    } catch (error) {
        res.status(500).json({
            status: 'error',
            message: error.message
        });
    }
});

// Start server
const server = app.listen(port, () => {
    console.log(`🚀 G2G Trello Scraper запущен на порту ${port}`);
    console.log(`📋 API доступно по адресу: http://localhost:${port}`);
    console.log(`📖 Документация: http://localhost:${port}`);
    
    // Автоматический запуск обработки заказов каждые 2 минуты
    if (process.env.AUTO_PROCESS_ORDERS !== 'false') {
        console.log('🔄 Автоматическая обработка заказов включена (каждые 2 минуты)');
        
        // Запускаем первую обработку через 30 секунд после старта (чтобы сервер успел запуститься)
        setTimeout(async () => {
            try {
                console.log('⏰ [АВТО] Первый запуск автоматической обработки заказов...');
                if (!trelloService.isConfigured()) {
                    console.log('⚠️ [АВТО] Trello API не настроен, пропускаем обработку');
            return;
        }

        let cardsCreated = 0;
                const processedOrders = await g2gScraper.processAllOrders(async (order) => {
                    try {
                        if (!order || !order.orderId || order.orderId === 'UNKNOWN') {
                            return false;
                        }
                        const result = await trelloService.createCardFromOrder(order);
                        if (result) {
                        cardsCreated++;
                        }
                        return result;
                    } catch (error) {
                        console.error(`❌ [АВТО] Ошибка создания карточки для заказа №${order?.orderId}:`, error.message);
                        return false;
                    }
                });
                
                console.log(`✅ [АВТО] Обработка завершена: обработано ${processedOrders.length}, создано карточек ${cardsCreated}`);
    } catch (error) {
                console.error(`❌ [АВТО] Ошибка автоматической обработки:`, error.message);
            }
        }, 30000); // 30 секунд
        
        // Затем каждые 2 минуты
        setInterval(async () => {
            try {
                console.log('⏰ [АВТО] Начало автоматической обработки заказов...');
                if (!trelloService.isConfigured()) {
                    console.log('⚠️ [АВТО] Trello API не настроен, пропускаем обработку');
        return;
    }

                let cardsCreated = 0;
                const processedOrders = await g2gScraper.processAllOrders(async (order) => {
                    try {
                        if (!order || !order.orderId || order.orderId === 'UNKNOWN') {
                            return false;
                        }
                        const result = await trelloService.createCardFromOrder(order);
                        if (result) {
                            cardsCreated++;
                        }
                        return result;
                    } catch (error) {
                        console.error(`❌ [АВТО] Ошибка создания карточки для заказа №${order?.orderId}:`, error.message);
                        return false;
                    }
                });
                
                console.log(`✅ [АВТО] Обработка завершена: обработано ${processedOrders.length}, создано карточек ${cardsCreated}`);
            } catch (error) {
                console.error(`❌ [АВТО] Ошибка автоматической обработки:`, error.message);
            }
        }, 2 * 60 * 1000); // 2 минуты
    }
});

// Обработка сигналов для корректного закрытия
process.on('SIGINT', async () => {
    console.log('\n🛑 Получен сигнал SIGINT, закрываем сервер...');
    await g2gScraper.close();
    server.close(() => {
        console.log('✅ Сервер закрыт');
        process.exit(0);
    });
});

process.on('SIGTERM', async () => {
    console.log('\n🛑 Получен сигнал SIGTERM, закрываем сервер...');
    await g2gScraper.close();
    server.close(() => {
        console.log('✅ Сервер закрыт');
        process.exit(0);
    });
});

process.on('uncaughtException', async (error) => {
    console.error('❌ Необработанное исключение:', error);
    await g2gScraper.close();
    process.exit(1);
});

process.on('unhandledRejection', async (reason, promise) => {
    console.error('❌ Необработанное отклонение промиса:', reason);
    await g2gScraper.close();
    process.exit(1);
});
