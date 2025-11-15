const puppeteer = require('puppeteer');
const path = require('path');
const fs = require('fs').promises;

/**
 * G2G Scraper для парсинга заказов и создания карточек в Trello
 */
class G2GScraper {
    constructor() {
        this.browser = null;
        this.page = null;
        this.headless = process.env.HEADLESS !== 'false';
        this.userDataDir = process.env.USER_DATA_DIR || path.join(__dirname, '../../.browser-data');
        
            // URLs
        this.newOrderUrl = 'https://www.g2g.com/order/sellOrder?status=5'; // New order
        this.preparingUrl = 'https://www.g2g.com/order/sellOrder?status=6'; // Preparing
        this.deliveringUrl = 'https://www.g2g.com/order/sellOrder?status=1'; // Delivering
        this.deliveredUrl = 'https://www.g2g.com/order/sellOrder?status=2'; // Delivered
        this.completedUrl = 'https://www.g2g.com/order/sellOrder?status=3'; // Completed
        this.cancelledUrl = 'https://www.g2g.com/order/sellOrder?status=0'; // Cancelled
        this.orderUrlTemplate = 'https://www.g2g.com/order/sellOrder/order?oid=';
        
        // Файл для хранения обработанных заказов
        this.processedOrdersFile = path.join(__dirname, '../../processed-orders.json');
        this.processedOrders = new Set();
    }

    /**
     * Загружает список обработанных заказов из файла
     */
    async loadProcessedOrders() {
        try {
            const data = await fs.readFile(this.processedOrdersFile, 'utf8');
            const orders = JSON.parse(data);
            this.processedOrders = new Set(orders);
            console.log(`📋 Загружено ${this.processedOrders.size} обработанных заказов`);
        } catch (error) {
            if (error.code === 'ENOENT') {
                // Файл не существует, создадим его позже
                this.processedOrders = new Set();
                console.log('📋 Файл обработанных заказов не найден, начинаем с пустого списка');
            } else {
                console.error('❌ Ошибка загрузки обработанных заказов:', error.message);
                this.processedOrders = new Set();
            }
        }
    }

    /**
     * Сохраняет список обработанных заказов в файл
     */
    async saveProcessedOrders() {
        try {
            const ordersArray = Array.from(this.processedOrders);
            await fs.writeFile(this.processedOrdersFile, JSON.stringify(ordersArray, null, 2), 'utf8');
            console.log(`💾 Сохранено ${ordersArray.length} обработанных заказов`);
        } catch (error) {
            console.error('❌ Ошибка сохранения обработанных заказов:', error.message);
        }
    }

    /**
     * Добавляет заказ в список обработанных
     */
    async markOrderAsProcessed(orderId) {
        this.processedOrders.add(orderId.toString());
        await this.saveProcessedOrders();
    }

    /**
     * Проверяет, был ли заказ уже обработан
     */
    isOrderProcessed(orderId) {
        return this.processedOrders.has(orderId.toString());
    }

    /**
     * Инициализация браузера
     */
    async init() {
        if (this.browser && this.page) {
            try {
                await this.page.title();
                console.log('✅ Браузер уже запущен');
                return;
            } catch (e) {
                console.warn('⚠️ Браузер закрыт или не отвечает, перезапускаем...');
                await this.close();
            }
        }

        console.log('🚀 Запуск браузера Chrome с Puppeteer...');

                // Определяем путь к Chrome в зависимости от ОС
                let chromePath = process.env.CHROME_EXECUTABLE_PATH || process.env.CHROME_PATH;
                if (!chromePath) {
                    if (process.platform === 'darwin') {
                        chromePath = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
                    } else if (process.platform === 'linux') {
                        const { execSync } = require('child_process');
                        try {
                            chromePath = execSync('which google-chrome', { encoding: 'utf8' }).trim();
                        } catch (e) {
                            try {
                                chromePath = execSync('which chromium-browser', { encoding: 'utf8' }).trim();
                            } catch (e2) {
                        chromePath = '/usr/bin/google-chrome';
                            }
                        }
                    }
                }

        const launchOptions = {
            headless: this.headless,
            args: [
                '--disable-blink-features=AutomationControlled',
                '--window-size=1920,1080',
                '--no-sandbox',
                '--disable-dev-shm-usage',
                '--disable-gpu',
                '--remote-debugging-port=0',
                '--disable-web-security',
                '--disable-features=VizDisplayCompositor'
            ]
        };

                if (chromePath) {
                    launchOptions.executablePath = chromePath;
                    console.log(`🔧 Используется Chrome: ${chromePath}`);
                }

        if (this.userDataDir) {
            launchOptions.userDataDir = path.resolve(this.userDataDir);
        }

        this.browser = await puppeteer.launch(launchOptions);
        this.page = await this.browser.newPage();

        await this.page.setViewport({ width: 1920, height: 1080 });
        
                let userAgent;
                if (process.platform === 'darwin') {
                    userAgent = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';
                } else {
                    userAgent = 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36';
                }
                await this.page.setUserAgent(userAgent);
        
        this.page.setDefaultNavigationTimeout(60000);
        this.page.setDefaultTimeout(30000);

        await this.page.waitForTimeout(2000);
        console.log('✅ Браузер запущен успешно');
    }

    /**
     * Закрытие браузера
     */
    async close() {
        if (this.browser) {
            await this.browser.close();
            this.browser = null;
            this.page = null;
            console.log('✅ Браузер закрыт');
        }
    }

    /**
     * Получает список заказов со страницы NEW ORDER (status=5)
     * и переводит их в PREPARING, затем в DELIVERING
     * Обрабатывает только новые заказы, которые еще не были обработаны
     */
    async processNewOrders() {
            await this.init();

        try {
            console.log('📋 Переход на страницу NEW ORDER заказов...');
            await this.page.goto(this.newOrderUrl, { waitUntil: 'domcontentloaded', timeout: 60000 });
            await this.page.waitForTimeout(3000);
            
            // Ждем загрузки таблицы
            try {
                await this.page.waitForSelector('table.sales-history__table', { timeout: 10000 });
                console.log('✅ Таблица загружена');
                    } catch (error) {
                console.log('⚠️ Таблица не найдена, возможно заказов нет');
                return [];
            }

            // Получаем список заказов
            const orders = await this.page.evaluate(() => {
                const orderList = [];
                const rows = document.querySelectorAll('table.sales-history__table tbody tr');
                
                rows.forEach((row) => {
                    const orderLink = row.querySelector('a.sales-history__product-id');
                    if (orderLink) {
                        const orderText = orderLink.textContent || '';
                        const orderMatch = orderText.match(/Sold order №(\d+)/);
                        if (orderMatch) {
                            const orderId = orderMatch[1];
                            const dataUrl = row.querySelector('.clickable-row')?.getAttribute('data-url');
                            if (dataUrl) {
                                orderList.push({
                                    orderId: orderId,
                                    url: dataUrl
                                });
                            }
                        }
                    }
                });

                return orderList;
            });

            console.log(`📊 Найдено NEW ORDER заказов: ${orders.length}`);

            // Фильтруем только новые заказы (которые еще не были обработаны)
            const newOrders = orders.filter(order => !this.isOrderProcessed(order.orderId));
            console.log(`🆕 Новых заказов для обработки: ${newOrders.length}`);

            // Обрабатываем каждый новый заказ - переводим в PREPARING, затем в DELIVERING
            for (const order of newOrders) {
                try {
                    await this.processNewOrderToDelivering(order);
                    // Помечаем заказ как обработанный
                    await this.markOrderAsProcessed(order.orderId);
        } catch (error) {
                    console.error(`❌ Ошибка обработки New Order заказа №${order.orderId}:`, error.message);
                }
            }
            
            return newOrders;
                    } catch (error) {
            console.error('❌ Ошибка обработки NEW ORDER заказов:', error.message);
            throw error;
        }
    }

    /**
     * Получает список заказов со страницы PREPARING (status=6)
     * и переводит их в DELIVERING
     */
    async processPreparingOrders() {
        await this.init();

        try {
            console.log('📋 Переход на страницу PREPARING заказов...');
            await this.page.goto(this.preparingUrl, { waitUntil: 'domcontentloaded', timeout: 60000 });
            await this.page.waitForTimeout(3000);
            
            // Ждем загрузки таблицы
            try {
                await this.page.waitForSelector('table.sales-history__table', { timeout: 10000 });
                console.log('✅ Таблица загружена');
            } catch (error) {
                console.log('⚠️ Таблица не найдена, возможно заказов нет');
                return [];
            }

            // Получаем список заказов
            const orders = await this.page.evaluate(() => {
                const orderList = [];
                const rows = document.querySelectorAll('table.sales-history__table tbody tr');
                
                rows.forEach((row) => {
                    const orderLink = row.querySelector('a.sales-history__product-id');
                    if (orderLink) {
                        const orderText = orderLink.textContent || '';
                        const orderMatch = orderText.match(/Sold order №(\d+)/);
                    if (orderMatch) {
                        const orderId = orderMatch[1];
                            const dataUrl = row.querySelector('.clickable-row')?.getAttribute('data-url');
                            if (dataUrl) {
                                orderList.push({
                            orderId: orderId,
                                    url: dataUrl
                                });
                            }
                        }
                    }
                });

                return orderList;
            });

            console.log(`📊 Найдено PREPARING заказов: ${orders.length}`);

            // Обрабатываем каждый Preparing заказ - переводим в DELIVERING
            for (const order of orders) {
                try {
                    await this.processPreparingToDelivering(order);
                } catch (error) {
                    console.error(`❌ Ошибка обработки Preparing заказа №${order.orderId}:`, error.message);
                }
            }
            
                return orders;
        } catch (error) {
            console.error('❌ Ошибка обработки PREPARING заказов:', error.message);
            throw error;
        }
    }

    /**
     * Обрабатывает New Order заказ - переводит в Preparing, затем в Delivering
     */
    async processNewOrderToDelivering(order) {
        try {
            console.log(`🔄 Обработка New Order заказа №${order.orderId} - перевод в DELIVERING...`);
            
            await this.page.goto(order.url, { waitUntil: 'domcontentloaded', timeout: 60000 });
            await this.page.waitForTimeout(3000);
            
            // Ждем загрузки контента страницы
            try {
                await this.page.waitForSelector('.trade__order-status, .trade__content-dynamic, .rate, .progress_gr', { timeout: 10000 });
            } catch (e) {
                console.log(`⚠️ Элементы страницы заказа №${order.orderId} не загрузились полностью`);
            }

            // Проверяем текущий статус заказа
            let currentStatus = null;
            try {
                currentStatus = await this.page.evaluate(() => {
                    const statusElement = document.querySelector('.status--seller--4, .status--seller--1, .status--seller--2, .status--seller--5');
                    if (statusElement) {
                        return statusElement.textContent.trim();
                    }
                    return null;
                });
            } catch (e) {
                console.log(`⚠️ Не удалось определить статус заказа №${order.orderId}`);
            }
            
            console.log(`📋 Текущий статус заказа №${order.orderId}: ${currentStatus || 'не определен'}`);

            // Если статус уже "Delivering" или другой финальный, пропускаем
            if (currentStatus && (currentStatus.includes('Delivering') || currentStatus.includes('Delivered') || currentStatus.includes('Completed'))) {
                console.log(`✅ Заказ №${order.orderId} уже в статусе ${currentStatus}, пропускаем`);
                return;
            }

            // Шаг 1: Если статус "New order", нажимаем "View Delivery Details"
            if (currentStatus && currentStatus.includes('New order')) {
                console.log(`📋 Заказ №${order.orderId} в статусе "New order", нажимаем "View Delivery Details"...`);
                
                let buttonClicked = false;
                const maxRetries = 3;
                for (let attempt = 1; attempt <= maxRetries; attempt++) {
                    try {
                        await this.page.waitForTimeout(1000);
                        
                        buttonClicked = await this.page.evaluate(() => {
                            const viewDetailsButtons = Array.from(document.querySelectorAll('a.progress_gr, a[onclick*="seller_view"], .rate__btns-item a'));
                            const viewDetailsButton = viewDetailsButtons.find(btn => {
                                const text = btn.textContent.toLowerCase().trim();
                                return text.includes('view delivery details');
                            });
                            
                            if (viewDetailsButton) {
                                viewDetailsButton.click();
                                    return true;
                            }
                            return false;
                        });
                        
                        if (buttonClicked) {
                                    break;
                                }
                    } catch (e) {
                        if (e.message.includes('Navigating frame was detached') || e.message.includes('Execution context was destroyed')) {
                            console.log(`⚠️ Страница перезагрузилась при попытке ${attempt}, повторяем...`);
                            if (attempt < maxRetries) {
                                await this.page.goto(order.url, { waitUntil: 'domcontentloaded', timeout: 60000 });
                                await this.page.waitForTimeout(2000);
                                continue;
                            }
                        }
                    }
                }
                
                if (buttonClicked) {
            await this.page.waitForTimeout(3000);
                    console.log(`✅ Заказ №${order.orderId} - нажата кнопка "View Delivery Details" (New order -> Preparing)`);
                    
                    // Ждем изменения статуса на "Preparing"
                    let statusChanged = false;
                    for (let i = 0; i < 10; i++) {
                        await this.page.waitForTimeout(1000);
                        const newStatus = await this.page.evaluate(() => {
                            const statusElement = document.querySelector('.status--seller--4, .status--seller--1, .status--seller--2, .status--seller--6');
                            if (statusElement) {
                                return statusElement.textContent.trim();
                }
                return null;
            });
            
                        if (newStatus && (newStatus.includes('Preparing') || newStatus.includes('Delivering'))) {
                            statusChanged = true;
                            console.log(`✅ Статус заказа №${order.orderId} изменился на "${newStatus}"`);
                            break;
                        }
                    }
                    
                    if (!statusChanged) {
                        console.log(`⚠️ Статус заказа №${order.orderId} не изменился на "Preparing"`);
                    }
                        } else {
                    console.log(`⚠️ Кнопка "View Delivery Details" для заказа №${order.orderId} не найдена`);
                }
            }

            // Шаг 2: Если статус "Preparing", нажимаем "Start Trading" для перевода в "Delivering"
            // (или если кнопка "View Delivery Details" не была найдена, пробуем найти "Start Trading")
            await this.page.waitForTimeout(2000);

            let currentStatusAfter = null;
            try {
                currentStatusAfter = await this.page.evaluate(() => {
                    const statusElement = document.querySelector('.status--seller--4, .status--seller--1, .status--seller--2, .status--seller--6');
                    if (statusElement) {
                        return statusElement.textContent.trim();
                    }
                    return null;
                });
            } catch (e) {
                // Игнорируем ошибку
            }

            if (currentStatusAfter && (currentStatusAfter.includes('Preparing') || !currentStatusAfter.includes('Delivering'))) {
                // Ищем и нажимаем кнопку "Start Trading"
                let buttonClicked = false;
                const maxRetries = 3;
                for (let attempt = 1; attempt <= maxRetries; attempt++) {
                    try {
                        await this.page.waitForTimeout(1000);
                        
                        buttonClicked = await this.page.evaluate(() => {
                            // Ищем кнопку "Start Trading" с onclick="javascript:seller_acknowledge(...)"
                            const startTradingButtons = Array.from(document.querySelectorAll('a.progress_gr, a[onclick*="seller_acknowledge"], .rate__btns-item a'));
                            const startTradingButton = startTradingButtons.find(btn => {
                                const text = btn.textContent.toLowerCase().trim();
                                const onclick = btn.getAttribute('onclick') || '';
                                return (text.includes('start trading') || onclick.includes('seller_acknowledge'));
                            });
                            
                            if (startTradingButton) {
                                startTradingButton.click();
                                return true;
                            }
                            
                            // Если не нашли "Start Trading", ищем другие кнопки доставки
                            const buttons = Array.from(document.querySelectorAll('a.list-action__btn-default, button, a[onclick*="deliver"], a[onclick*="confirm"]'));
                            const deliverButton = buttons.find(btn => {
                                const text = btn.textContent.toLowerCase().trim();
                                const onclick = btn.getAttribute('onclick') || '';
                                return text.includes('deliver') || 
                                       text.includes('start delivery') ||
                                       text.includes('confirm deliver') ||
                                       onclick.includes('deliver') ||
                                       onclick.includes('confirm_deliver');
                            });
                            if (deliverButton) {
                                deliverButton.click();
                                return true;
                            }
                            return false;
                        });
                        
                        if (buttonClicked) {
                    break;
                        }
                    } catch (e) {
                        if (e.message.includes('Navigating frame was detached') || e.message.includes('Execution context was destroyed')) {
                            console.log(`⚠️ Страница перезагрузилась при попытке ${attempt}, повторяем...`);
                            if (attempt < maxRetries) {
                                await this.page.goto(order.url, { waitUntil: 'domcontentloaded', timeout: 60000 });
                                await this.page.waitForTimeout(2000);
                                continue;
                            }
                        }
                    }
                }
                
                if (buttonClicked) {
                    await this.page.waitForTimeout(2000);
                    console.log(`✅ Заказ №${order.orderId} - нажата кнопка "Start Trading" (Preparing -> Delivering)`);
                } else {
                    console.log(`⚠️ Кнопка "Start Trading" для заказа №${order.orderId} не найдена`);
                    console.log(`   💡 Возможно заказ уже в другом статусе или требует особой обработки`);
                }
            }
                } catch (error) {
            console.error(`❌ Ошибка обработки New Order заказа №${order.orderId}:`, error.message);
        }
    }

    /**
     * Обрабатывает Preparing заказ - переводит в Delivering
     */
    async processPreparingToDelivering(order) {
        try {
            console.log(`🔄 Обработка Preparing заказа №${order.orderId} - перевод в DELIVERING...`);
            
            await this.page.goto(order.url, { waitUntil: 'domcontentloaded', timeout: 60000 });
            await this.page.waitForTimeout(3000);
            
            // Ждем загрузки контента страницы
            try {
                await this.page.waitForSelector('.trade__order-status, .trade__content-dynamic, .rate, .progress_gr', { timeout: 10000 });
                    } catch (e) {
                console.log(`⚠️ Элементы страницы заказа №${order.orderId} не загрузились полностью`);
            }

            // Проверяем текущий статус заказа
            let currentStatus = null;
            try {
                currentStatus = await this.page.evaluate(() => {
                    const statusElement = document.querySelector('.status--seller--4, .status--seller--1, .status--seller--2');
                    if (statusElement) {
                        return statusElement.textContent.trim();
                    }
                    return null;
                });
            } catch (e) {
                console.log(`⚠️ Не удалось определить статус заказа №${order.orderId}`);
            }
            
            console.log(`📋 Текущий статус заказа №${order.orderId}: ${currentStatus || 'не определен'}`);

            // Если статус уже "Delivering" или другой финальный, пропускаем
            if (currentStatus && (currentStatus.includes('Delivering') || currentStatus.includes('Delivered') || currentStatus.includes('Completed'))) {
                console.log(`✅ Заказ №${order.orderId} уже в статусе ${currentStatus}, пропускаем`);
                                return;
                            }
                            
            // Ищем и нажимаем кнопку "Start Trading" (с повторными попытками)
            let buttonClicked = false;
            const maxRetries = 3;
            for (let attempt = 1; attempt <= maxRetries; attempt++) {
                try {
                    // Ждем стабилизации страницы перед поиском кнопки
                        await this.page.waitForTimeout(1000);
                    
                    buttonClicked = await this.page.evaluate(() => {
                        // Ищем кнопку "Start Trading" с onclick="javascript:seller_acknowledge(...)"
                        const startTradingButtons = Array.from(document.querySelectorAll('a.progress_gr, a[onclick*="seller_acknowledge"], .rate__btns-item a'));
                        const startTradingButton = startTradingButtons.find(btn => {
                            const text = btn.textContent.toLowerCase().trim();
                            const onclick = btn.getAttribute('onclick') || '';
                            return (text.includes('start trading') || onclick.includes('seller_acknowledge'));
                        });
                        
                        if (startTradingButton) {
                            startTradingButton.click();
                            return true;
                        }
                        
                        // Если не нашли "Start Trading", ищем другие кнопки доставки
                        const buttons = Array.from(document.querySelectorAll('a.list-action__btn-default, button, a[onclick*="deliver"], a[onclick*="confirm"]'));
                        const deliverButton = buttons.find(btn => {
                            const text = btn.textContent.toLowerCase().trim();
                            const onclick = btn.getAttribute('onclick') || '';
                            return text.includes('deliver') || 
                                   text.includes('start delivery') ||
                                   text.includes('confirm deliver') ||
                                   onclick.includes('deliver') ||
                                   onclick.includes('confirm_deliver');
                        });
                        if (deliverButton) {
                            deliverButton.click();
                            return true;
                        }
                        return false;
                    });
                    
                    if (buttonClicked) {
                        break; // Успешно нажали кнопку
                    }
                    } catch (e) {
                    if (e.message.includes('Navigating frame was detached') || e.message.includes('Execution context was destroyed')) {
                        console.log(`⚠️ Страница перезагрузилась при попытке ${attempt}, повторяем...`);
                        // Перезагружаем страницу и пробуем снова
                        if (attempt < maxRetries) {
                            await this.page.goto(order.url, { waitUntil: 'domcontentloaded', timeout: 60000 });
                            await this.page.waitForTimeout(2000);
                            continue;
                        }
                    } else {
                        console.log(`⚠️ Ошибка при поиске кнопки для заказа №${order.orderId} (попытка ${attempt}):`, e.message);
                    }
                }
            }
            
            if (buttonClicked) {
                    await this.page.waitForTimeout(2000);
                console.log(`✅ Заказ №${order.orderId} - нажата кнопка "Start Trading" (Preparing -> Delivering)`);
            } else {
                console.log(`⚠️ Кнопка "Start Trading" для заказа №${order.orderId} не найдена`);
                console.log(`   💡 Возможно заказ уже в другом статусе или требует особой обработки`);
                    }
        } catch (error) {
            console.error(`❌ Ошибка обработки Preparing заказа №${order.orderId}:`, error.message);
        }
    }

    /**
     * Получает список заказов со страницы с указанным статусом
     */
    async getOrdersByStatus(statusUrl, statusName) {
        const maxRetries = 3;
        for (let attempt = 1; attempt <= maxRetries; attempt++) {
        try {
            await this.init();
                console.log(`📋 Переход на страницу ${statusName} заказов... (попытка ${attempt}/${maxRetries})`);
                await this.page.goto(statusUrl, { waitUntil: 'domcontentloaded', timeout: 60000 });
                await this.page.waitForTimeout(3000);
                
                // Ждем загрузки таблицы
            try {
                await this.page.waitForSelector('table.sales-history__table', { timeout: 10000 });
                    console.log('✅ Таблица загружена');
            } catch (error) {
                    console.log('⚠️ Таблица не найдена, возможно заказов нет');
                    return [];
                }

                // Получаем список заказов с датами
                const orders = await this.page.evaluate(() => {
                    const orderList = [];
                    const rows = document.querySelectorAll('table.sales-history__table tbody tr');
                    
                    rows.forEach((row) => {
                            const orderLink = row.querySelector('a.sales-history__product-id');
                            if (orderLink) {
                            const orderText = orderLink.textContent || '';
                            const orderMatch = orderText.match(/Sold order №(\d+)/);
                                if (orderMatch) {
                                const orderId = orderMatch[1];
                                const dataUrl = row.querySelector('.clickable-row')?.getAttribute('data-url');
                                
                                // Извлекаем дату
                                const dateCell = row.querySelector('td:first-child');
                                const dateText = dateCell ? dateCell.textContent.trim() : '';
                                
                                if (dataUrl) {
                                    orderList.push({
                                orderId: orderId,
                                        url: dataUrl,
                                        date: dateText
                                    });
                                }
                            }
                        }
                    });

                    return orderList;
                });

                // Сортируем по дате (последний первым)
                orders.sort((a, b) => {
                    const dateA = new Date(a.date);
                    const dateB = new Date(b.date);
                    return dateB - dateA;
                });

                console.log(`📊 Найдено ${statusName} заказов: ${orders.length}`);
                return orders;
            } catch (error) {
                if (error.message.includes('Navigating frame was detached') || error.message.includes('Execution context was destroyed')) {
                    console.log(`⚠️ Страница перезагрузилась при получении ${statusName} заказов (попытка ${attempt}), повторяем...`);
                    if (attempt < maxRetries) {
                            await this.page.waitForTimeout(2000);
                        continue;
                    }
                }
                console.error(`❌ Ошибка получения ${statusName} заказов (попытка ${attempt}):`, error.message);
                if (attempt === maxRetries) {
                    // На последней попытке возвращаем пустой массив вместо throw
                    console.log(`⚠️ Не удалось получить ${statusName} заказы после ${maxRetries} попыток, возвращаем пустой массив`);
                    return [];
                }
            }
        }
        return [];
    }

    /**
     * Получает список заказов со страницы DELIVERING (status=1)
     */
    async getDeliveringOrders() {
        return await this.getOrdersByStatus(this.deliveringUrl, 'DELIVERING');
    }

    /**
     * Получает список заказов со страницы DELIVERED (status=2)
     */
    async getDeliveredOrders() {
        return await this.getOrdersByStatus(this.deliveredUrl, 'DELIVERED');
    }

    /**
     * Получает список заказов со страницы COMPLETED (status=3)
     */
    async getCompletedOrders() {
        return await this.getOrdersByStatus(this.completedUrl, 'COMPLETED');
    }

    /**
     * Получает список заказов со страницы CANCELLED (status=0)
     */
    async getCancelledOrders() {
        return await this.getOrdersByStatus(this.cancelledUrl, 'CANCELLED');
    }

    /**
     * Парсит данные одного заказа
     */
    async parseOrderDetails(orderId) {
        try {
            const orderUrl = `${this.orderUrlTemplate}${orderId}`;
            console.log(`🔍 Парсинг заказа №${orderId}...`);
                    
                    await this.page.goto(orderUrl, { waitUntil: 'domcontentloaded', timeout: 60000 });
                    await this.page.waitForTimeout(2000);
            
            const orderData = await this.page.evaluate(() => {
                const data = {};
                
                // Номер заказа
                const orderNumElement = document.querySelector('.trade__order__top-num');
                if (orderNumElement) {
                    const orderText = orderNumElement.textContent || '';
                    const orderMatch = orderText.match(/Sold order\s*№(\d+)/);
                    if (orderMatch) {
                        data.orderId = orderMatch[1];
                    }
                    const purchaseMatch = orderText.match(/Purchase order\s*№(\d+)/);
                    if (purchaseMatch) {
                        data.purchaseOrderId = purchaseMatch[1];
                    }
                }

                // Статус
                const statusElement = document.querySelector('.trade__status');
                if (statusElement) {
                    data.status = statusElement.textContent.trim();
                }

                // Дата заказа
                const dateElement = document.querySelector('.trade__date');
                if (dateElement) {
                    data.orderDate = dateElement.textContent.trim();
                }

                // Название заказа
                const titleElement = document.querySelector('.purchase-title');
                if (titleElement) {
                    data.productName = titleElement.textContent.trim();
                }

                // Данные из таблицы
                const tableRow = document.querySelector('table.sales-history__table tbody tr');
                if (tableRow) {
                    // Products ID - из заголовка таблицы
                    const productsHeader = document.querySelector('th');
                    if (productsHeader) {
                        const productsText = productsHeader.textContent || '';
                        const productsMatch = productsText.match(/Products ID\s*:\s*([^\s)]+)/);
                        if (productsMatch) {
                            data.productsId = productsMatch[1];
                        }
                    }

                    // Type - из tooltip
                    const typeCell = tableRow.querySelector('td[data-th="Type"]');
                    if (typeCell) {
                        const typeTooltip = typeCell.querySelector('.tooltip__content');
                        if (typeTooltip) {
                            data.type = typeTooltip.textContent.trim();
                    } else {
                            // Альтернативный способ
                            const typeIcon = typeCell.querySelector('.g2g-icon');
                            if (typeIcon) {
                                const tooltip = typeCell.querySelector('.tooltip__content');
                                if (tooltip) {
                                    data.type = tooltip.textContent.trim();
                                }
                            }
                        }
                    }

                    // QTY
                    const qtyCell = tableRow.querySelector('td[data-th="QTY."]');
                    if (qtyCell) {
                        data.quantity = qtyCell.textContent.trim();
                    }

                    // PRICE/UNIT
                    const priceUnitCell = tableRow.querySelector('td[data-th="PRICE/UNIT"]');
                    if (priceUnitCell) {
                        data.pricePerUnit = priceUnitCell.textContent.trim();
                    }

                    // Amount
                    const amountCell = tableRow.querySelector('td[data-th="Amount"]');
                    if (amountCell) {
                        data.amount = amountCell.textContent.trim();
                    }

                    // Commission fee
                    const commissionCell = tableRow.querySelector('td[data-th="Comission fee"]');
                    if (commissionCell) {
                        data.commissionFee = commissionCell.textContent.trim();
                    }

                    // To be earned
                    const earnedCell = tableRow.querySelector('td[data-th="To be earned"]');
                    if (earnedCell) {
                        data.toBeEarned = earnedCell.textContent.trim();
                    }
                }

                // Покупатель
                const buyerElement = document.querySelector('.seller__title-orders a');
                if (buyerElement) {
                    data.buyerName = buyerElement.textContent.trim();
                    data.buyerUrl = buyerElement.getAttribute('href');
                }

                // Game info
                const gameInfoItems = document.querySelectorAll('.game-info__list-item');
                gameInfoItems.forEach(item => {
                    const title = item.querySelector('.game-info__title')?.textContent.trim();
                    const info = item.querySelector('.game-info__info')?.textContent.trim();
                    if (title && info) {
                        if (title === 'Game') data.game = info;
                        if (title === 'Platform') data.platform = info;
                        if (title === 'Service Type') data.serviceType = info;
                    }
                });

                // Chat URL
                const chatLink = document.querySelector('a[href*="/chat/#/order/"]');
                if (chatLink) {
                    data.chatUrl = chatLink.getAttribute('href');
                }

                return data;
            });

            console.log(`✅ Данные заказа №${orderId} извлечены`);
            return orderData;
        } catch (error) {
            console.error(`❌ Ошибка парсинга заказа №${orderId}:`, error.message);
            return null;
        }
    }

    /**
     * Основной метод - обрабатывает все заказы
     */
    async processAllOrders(onOrderParsed) {
        try {
            // 0. Загружаем список обработанных заказов
            await this.loadProcessedOrders();
            
            // 1. Обрабатываем NEW ORDER заказы - переводим в PREPARING, затем в DELIVERING (только новые)
            console.log('📋 Шаг 1: Обработка NEW ORDER заказов (только новых)...');
            await this.processNewOrders();
            
            // 2. Обрабатываем PREPARING заказы - переводим в DELIVERING
            console.log('📋 Шаг 2: Обработка PREPARING заказов...');
            await this.processPreparingOrders();

            // 3. Получаем список всех заказов с разными статусами для обновления меток
            console.log('📋 Шаг 3: Получение списка заказов для обновления меток...');
            const allOrders = [];
            
            // DELIVERING заказы
            const deliveringOrders = await this.getDeliveringOrders();
            for (const order of deliveringOrders) {
                allOrders.push({ ...order, targetStatus: 'Delivering' });
            }
            
            // DELIVERED заказы
            const deliveredOrders = await this.getDeliveredOrders();
            for (const order of deliveredOrders) {
                allOrders.push({ ...order, targetStatus: 'Delivered' });
            }
            
            // COMPLETED заказы
            const completedOrders = await this.getCompletedOrders();
            for (const order of completedOrders) {
                allOrders.push({ ...order, targetStatus: 'Completed' });
            }
            
            // CANCELLED заказы
            const cancelledOrders = await this.getCancelledOrders();
            for (const order of cancelledOrders) {
                allOrders.push({ ...order, targetStatus: 'Cancelled' });
            }

            if (allOrders.length === 0) {
                console.log('📊 Заказов не найдено');
                return [];
            }

            // 4. Обрабатываем каждый заказ, начиная с последнего по дате
            console.log(`📋 Шаг 4: Обработка ${allOrders.length} заказов (включая обновление меток)...`);
            const processedOrders = [];

            for (const order of allOrders) {
                try {
                    const orderData = await this.parseOrderDetails(order.orderId);
                    
                    if (orderData && orderData.orderId) {
                        // ВСЕГДА используем targetStatus из страницы статуса, а не из parseOrderDetails
                        // Это гарантирует, что метка будет соответствовать странице, на которой находится заказ
                        if (order.targetStatus) {
                            orderData.status = order.targetStatus;
                            console.log(`📋 Заказ №${order.orderId}: статус установлен на "${order.targetStatus}" (из страницы статуса)`);
                        } else if (orderData.status) {
                            console.log(`📋 Заказ №${order.orderId}: используется статус из parseOrderDetails: "${orderData.status}"`);
                        }
                        
                        processedOrders.push(orderData);
                        
                        // Вызываем callback для создания/обновления карточки в Trello
                        if (onOrderParsed && typeof onOrderParsed === 'function') {
                            try {
                                const result = await onOrderParsed(orderData);
                                if (result) {
                                    console.log(`✅ Карточка Trello обновлена для заказа №${order.orderId} (статус: ${orderData.status})`);
            } else {
                                    console.log(`⚠️ Не удалось обновить карточку для заказа №${order.orderId}`);
                                }
                            } catch (callbackError) {
                                console.error(`❌ Ошибка в callback для заказа №${order.orderId}:`, callbackError.message);
                            }
                        }
                    }
                } catch (error) {
                    console.error(`❌ Ошибка обработки заказа №${order.orderId}:`, error.message);
                }
            }

            console.log(`📊 Обработано заказов: ${processedOrders.length}`);
            return processedOrders;
        } catch (error) {
            console.error('❌ Ошибка обработки заказов:', error.message);
            throw error;
        }
    }

    /**
     * Получает статус скрапера
     */
    async getStatus() {
            return {
            browser: this.browser ? 'running' : 'stopped',
            page: this.page ? 'active' : 'inactive'
        };
    }

    // Заглушки для старых методов (для совместимости с index.js)
    async openLoginPage() {
        await this.init();
        await this.page.goto('https://www.g2g.com/login', { waitUntil: 'domcontentloaded', timeout: 60000 });
    }

    async openOrdersPage() {
        await this.init();
        await this.page.goto('https://www.g2g.com/order/sellOrder', { waitUntil: 'domcontentloaded', timeout: 60000 });
    }

    async openDeliveringPage() {
        await this.init();
        await this.page.goto(this.deliveringUrl, { waitUntil: 'domcontentloaded', timeout: 60000 });
    }

    async openBoostingPreparingPage() {
        await this.init();
        await this.page.goto(this.preparingUrl, { waitUntil: 'domcontentloaded', timeout: 60000 });
    }

    async openBoostingDeliveringPage() {
        await this.init();
        await this.page.goto(this.deliveringUrl, { waitUntil: 'domcontentloaded', timeout: 60000 });
    }

    async checkIfLoggedIn() {
        if (!this.page) return false;
        try {
            const url = this.page.url();
            return !url.includes('/login');
            } catch (e) {
                return false;
        }
    }

    async scrapeOrders() {
        return [];
    }

    async scrapeDeliveringOrders() {
        return await this.getDeliveringOrders();
    }

    async scrapeBoostingPreparingOrders() {
        return [];
    }

    async scrapeBoostingDeliveringOrders() {
        return await this.getDeliveringOrders();
    }

    async startDeliveryForOrder(orderId) {
            return false;
            }

    async extractAccountDataFromChat(chatUrl) {
        return null;
    }

    async clearProcessedOrders() {
        // Заглушка
    }
}

module.exports = G2GScraper;

