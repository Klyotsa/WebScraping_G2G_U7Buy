const puppeteer = require('puppeteer');
const path = require('path');

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
        this.preparingUrl = 'https://www.g2g.com/order/sellOrder?status=5';
        this.deliveringUrl = 'https://www.g2g.com/order/sellOrder?status=1';
        this.orderUrlTemplate = 'https://www.g2g.com/order/sellOrder/order?oid=';
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
     * Получает список заказов со страницы PREPARING (status=5)
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

            // Обрабатываем каждый заказ - переводим в DELIVERING
            for (const order of orders) {
                try {
                    console.log(`🔄 Обработка заказа №${order.orderId} - перевод в DELIVERING...`);
                    
                    await this.page.goto(order.url, { waitUntil: 'domcontentloaded', timeout: 60000 });
                await this.page.waitForTimeout(2000);

                    // Ищем кнопку для перевода в DELIVERING и нажимаем 2 раза
                    // Сначала ищем кнопку "Start Delivery" или "Confirm Delivered"
                    const buttonClicked = await this.page.evaluate(() => {
                        // Ищем кнопку по тексту или классу
                        const buttons = Array.from(document.querySelectorAll('a.list-action__btn-default, button, a[onclick*="deliver"]'));
                        const deliveryButton = buttons.find(btn => {
                            const text = btn.textContent.toLowerCase().trim();
                            const onclick = btn.getAttribute('onclick') || '';
                            return text.includes('start delivery') || 
                                   text.includes('confirm deliver') || 
                                   onclick.includes('deliver') ||
                                   onclick.includes('confirm_deliver');
                        });

                        if (deliveryButton) {
                            deliveryButton.click();
                                    return true;
                            }
                            return false;
                        });
                        
                    if (buttonClicked) {
                        await this.page.waitForTimeout(1500);
                        // Второй клик - подтверждение
                        const secondClick = await this.page.evaluate(() => {
                            const buttons = Array.from(document.querySelectorAll('a.list-action__btn-default, button, a[onclick*="deliver"], a[onclick*="confirm"]'));
                            const confirmButton = buttons.find(btn => {
                            const text = btn.textContent.toLowerCase().trim();
                                const onclick = btn.getAttribute('onclick') || '';
                                return text.includes('confirm') || 
                                       onclick.includes('confirm_deliver') ||
                                       onclick.includes('confirm_deliver');
                            });
                            if (confirmButton) {
                                confirmButton.click();
                            return true;
                        }
                        return false;
                    });
                        await this.page.waitForTimeout(2000);
                        if (secondClick) {
                            console.log(`✅ Заказ №${order.orderId} переведен в DELIVERING (2 клика выполнено)`);
            } else {
                            console.log(`⚠️ Заказ №${order.orderId} - первый клик выполнен, второй не найден`);
                        }
                } else {
                        console.log(`⚠️ Кнопка для заказа №${order.orderId} не найдена`);
                    }
            
        } catch (error) {
                    console.error(`❌ Ошибка обработки заказа №${order.orderId}:`, error.message);
                }
            }

                return orders;
        } catch (error) {
            console.error('❌ Ошибка обработки PREPARING заказов:', error.message);
            throw error;
        }
    }

    /**
     * Получает список заказов со страницы DELIVERING (status=1)
     */
    async getDeliveringOrders() {
        await this.init();

        try {
            console.log('📋 Переход на страницу DELIVERING заказов...');
            await this.page.goto(this.deliveringUrl, { waitUntil: 'domcontentloaded', timeout: 60000 });
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

            console.log(`📊 Найдено DELIVERING заказов: ${orders.length}`);
            return orders;
                } catch (error) {
            console.error('❌ Ошибка получения DELIVERING заказов:', error.message);
            throw error;
        }
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
            // 1. Обрабатываем PREPARING заказы - переводим в DELIVERING
            console.log('📋 Шаг 1: Обработка PREPARING заказов...');
            await this.processPreparingOrders();

            // 2. Получаем список DELIVERING заказов
            console.log('📋 Шаг 2: Получение списка DELIVERING заказов...');
            const deliveringOrders = await this.getDeliveringOrders();

            if (deliveringOrders.length === 0) {
                console.log('📊 DELIVERING заказов не найдено');
                return [];
            }

            // 3. Обрабатываем каждый заказ, начиная с последнего по дате
            console.log(`📋 Шаг 3: Обработка ${deliveringOrders.length} DELIVERING заказов...`);
            const processedOrders = [];

            for (const order of deliveringOrders) {
                try {
                    const orderData = await this.parseOrderDetails(order.orderId);
                    
                    if (orderData && orderData.orderId) {
                        processedOrders.push(orderData);
                        
                        // Вызываем callback для создания карточки в Trello
                        if (onOrderParsed && typeof onOrderParsed === 'function') {
                            try {
                                const result = await onOrderParsed(orderData);
                                if (result) {
                                    console.log(`✅ Карточка Trello создана для заказа №${order.orderId}`);
                                } else {
                                    console.log(`⚠️ Не удалось создать карточку для заказа №${order.orderId}`);
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

