const mineflayer = require('mineflayer');
const express = require('express');
const vec3 = require('vec3');

const app = express();
app.use(express.json());

// Конфигурация ботов
const BOT_PASSWORD = '123123123'; // Общий пароль для всех ботов
const bots = [];
let botCreationQueue = [];
let isCreatingBots = false;
let totalBotsPlanned = 0;

// Создаем указанное количество ботов с задержкой
function createBots(count) {
    bots.forEach(cleanupBot);
    bots.length = 0;
    botCreationQueue = [];
    isCreatingBots = false;
    totalBotsPlanned = count;

    for (let i = 0; i < count; i++) {
        botCreationQueue.push(i);
    }
    createNextBot();
}

function createNextBot() {
    if (botCreationQueue.length === 0) {
        isCreatingBots = false;
        console.log(`[SYSTEM] Все боты созданы! Всего: ${bots.length}`);
        return;
    }

    isCreatingBots = true;
    const botIndex = botCreationQueue.shift();
    const username = `qvwi_${botIndex}`;
    
    console.log(`[SYSTEM] Создание бота #${botIndex} (${username}) [Осталось: ${botCreationQueue.length}]`);
    createBot(username, botIndex);

    const delay = 50 + Math.random() * 100;
    setTimeout(createNextBot, delay);
}

function cleanupBot(botData) {
    if (!botData) return;
    
    if (botData.bot) {
        botData.bot.removeAllListeners();
        botData.bot.end();
        botData.bot = null;
    }
    ['jumpInterval', 'walkInterval', 'reconnectTimeout', 'obstacleCheckInterval'].forEach(key => {
        if (botData[key]) {
            clearInterval(botData[key]);
            botData[key] = null;
        }
    });
}

function createBot(username, botIndex) {
    if (bots[botIndex]) {
        cleanupBot(bots[botIndex]);
    }

    const modList = [
        'structure_gel', 'spooky_mobs', 'sons_of_sins', 'framework', 'arphex',
        'lunar', 'simpleradio', 'ls_spooky_paintings', 'alexsmobs', 'exposure_catalog',
        'leather_to_rabbit_hide', 'ls_spooky_music', 'geckolib', 'graveyard',
        'refurbished_furniture', 'the_knocker', 'comforts', 'ls_spooky_foods',
        'citadel', 'securitycraft', 'born_in_chaos_v1', 'ls_djl', 'uteamcore',
        'apollyon', 'cave_dweller', 'haunted_house', 'polymorph', 'spooky_campsite',
        'horror_element_mod', 'exposure', 'undead_revamp2', 'spookytrees',
        'eyesinthedarkness', 'man', 'ironchest', 'anomaly', 'backpacked'
    ].map(modid => ({ modid, version: '1.0' }));

    const botInstance = mineflayer.createBot({
        host: '',
        port: 25565, // 25565
        username: username,
        version: '1.20.1',
        auth: 'offline',
        disableChatSigning: true,
        forge: {
            forgeMods: modList
        }
    });

    const botData = {
        bot: botInstance,
        isConnected: false,
        username: username,
        jumpInterval: null,
        walkInterval: null,
        reconnectTimeout: null,
        homePosition: null,
        isMoving: false,
        isBreakingBlock: false,
        lastPosition: null,
        stuckTimer: 0,
        obstacleCheckInterval: null,
        authCooldown: false // Защита от спама
    };

    bots[botIndex] = botData;

    botInstance.on('login', () => {
        console.log(`[${username}] Успешный вход на сервер!`);
        botData.isConnected = true;
    });

    botInstance.on('spawn', () => {
        console.log(`[${username}] Бот заспавнился!`);
        botData.homePosition = botInstance.entity.position.clone();
        
        // Авторизация при спавне
        setTimeout(() => {
            try {
                botInstance.chat(`/reg ${BOT_PASSWORD} ${BOT_PASSWORD}`);
            } catch (e) {
                console.log(`[${username}] Ошибка:`, e.message);
            }
        }, 3000);
        
        if (totalBotsPlanned <= 100) {
            startBotMovement(botData);
        }
    });

    // Обработчик сообщений с реакцией на команды
    botInstance.on('message', (msg) => {
        try {
            const message = typeof msg === 'string' 
                ? msg 
                : (msg.toString?.() || JSON.stringify(msg));
            
            console.log(`[${username}] Сообщение: ${message}`);
            
            // Реакция на команды аутентификации
            if (!botData.authCooldown) {
                const lowerMsg = message.toLowerCase();
                
                if (lowerMsg.includes('/reg')) {
                    botData.authCooldown = true;
                    setTimeout(() => {
                        try {
                            botInstance.chat(`/reg ${BOT_PASSWORD} ${BOT_PASSWORD}`);
                            console.log(`[${username}] Реакция на /reg`);
                        } catch (e) {
                            console.log(`[${username}] Ошибка:`, e.message);
                        } finally {
                            botData.authCooldown = false;
                        }
                    }, 1000 + Math.random() * 2000);
                }
                else if (lowerMsg.includes('/login')) {
                    botData.authCooldown = true;
                    setTimeout(() => {
                        try {
                            botInstance.chat(`/login ${BOT_PASSWORD}`);
                            console.log(`[${username}] Реакция на /login`);
                        } catch (e) {
                            console.log(`[${username}] Ошибка:`, e.message);
                        } finally {
                            botData.authCooldown = false;
                        }
                    }, 1000 + Math.random() * 2000);
                }
            }
        } catch (e) {
            console.log(`[${username}] Ошибка обработки:`, e.message);
        }
    });

    botInstance.on('kicked', (reason) => {
        console.log(`[${username}] Кикнут:`, reason);
        botData.isConnected = false;
        scheduleReconnect(botIndex);
    });

    botInstance.on('error', (err) => {
        console.log(`[${username}] Ошибка:`, err.message);
        botData.isConnected = false;
        scheduleReconnect(botIndex);
    });

    botInstance.on('end', () => {
        console.log(`[${username}] Отключен`);
        botData.isConnected = false;
        scheduleReconnect(botIndex);
    });

    // Периодические прыжки
    if (totalBotsPlanned <= 100) {
        botData.jumpInterval = setInterval(() => {
            if (botData.isConnected && !botData.isMoving) {
                try {
                    botInstance.setControlState('jump', true);
                    setTimeout(() => botInstance.setControlState('jump', false), 500);
                } catch (e) {
                    console.log(`[${username}] Ошибка прыжка:`, e.message);
                }
            }
        }, 30000 + Math.random() * 30000);
    }
}

async function breakObstructingBlocks(botData) {
    if (!botData.isConnected || botData.isBreakingBlock) return;
    
    const bot = botData.bot;
    const directions = [
        vec3(0, 0, 1),   // Вперед
        vec3(0, 1, 0),   // Вверх
        vec3(0, -1, 0),  // Вниз
        vec3(1, 0, 0),   // Вправо
        vec3(-1, 0, 0)   // Влево
    ];

    for (const dir of directions) {
        const targetPos = bot.entity.position.offset(dir.x, dir.y, dir.z).floored();
        const block = bot.blockAt(targetPos);
        
        if (block && bot.canDigBlock(block)) {
            try {
                botData.isBreakingBlock = true;
                await bot.dig(block);
                console.log(`[${botData.username}] Сломал блок: ${block.name}`);
            } catch (e) {
                console.log(`[${botData.username}] Ошибка:`, e.message);
            } finally {
                botData.isBreakingBlock = false;
            }
            return true;
        }
    }
    return false;
}

function checkIfStuck(botData) {
    if (!botData.lastPosition || !botData.isMoving) return false;
    
    const currentPos = botData.bot.entity.position;
    const distance = botData.lastPosition.distanceTo(currentPos);
    
    if (distance < 0.5) {
        botData.stuckTimer += 2000;
        if (botData.stuckTimer >= 5000) {
            console.log(`[${botData.username}] Застрял!`);
            return true;
        }
    } else {
        botData.stuckTimer = 0;
    }
    
    botData.lastPosition = currentPos.clone();
    return false;
}

function startBotMovement(botData) {
    if (botData.walkInterval) clearInterval(botData.walkInterval);
    if (botData.obstacleCheckInterval) clearInterval(botData.obstacleCheckInterval);
    
    botData.obstacleCheckInterval = setInterval(async () => {
        if (!botData.isConnected || !botData.isMoving) return;
        
        if (checkIfStuck(botData)) {
            await breakObstructingBlocks(botData);
            botData.bot.setControlState('jump', true);
            setTimeout(() => {
                botData.bot.setControlState('jump', false);
                botData.stuckTimer = 0;
            }, 1000);
        }
        
        if (Math.random() < 0.3) {
            await breakObstructingBlocks(botData);
        }
    }, 2000);
    
    if (totalBotsPlanned <= 100) {
        botData.walkInterval = setInterval(() => {
            if (!botData.isConnected || !botData.homePosition || botData.isMoving) return;
            
            try {
                const radius = 5;
                const angle = Math.random() * Math.PI * 2;
                const distance = Math.random() * radius;
                
                const target = vec3(
                    botData.homePosition.x + Math.cos(angle) * distance,
                    botData.homePosition.y,
                    botData.homePosition.z + Math.sin(angle) * distance
                );
                
                botData.isMoving = true;
                botData.lastPosition = botData.bot.entity.position.clone();
                botData.bot.lookAt(target);
                botData.bot.setControlState('forward', true);
                
                setTimeout(() => {
                    if (botData.isConnected) {
                        botData.bot.setControlState('forward', false);
                        botData.isMoving = false;
                        botData.stuckTimer = 0;
                    }
                }, 3000 + Math.random() * 5000);
                
            } catch (e) {
                console.log(`[${botData.username}] Ошибка:`, e.message);
                botData.isMoving = false;
            }
        }, 10000 + Math.random() * 15000);
    }
}

function scheduleReconnect(botIndex) {
    const botData = bots[botIndex];
    if (!botData || botData.reconnectTimeout) return;

    const delay = bots.length > 100 ? 30000 : 10000;
    
    botData.reconnectTimeout = setTimeout(() => {
        console.log(`[${botData.username}] Переподключение...`);
        botData.reconnectTimeout = null;
        createBot(botData.username, botIndex);
    }, delay);
}

// API для управления ботами
app.post('/createBots', (req, res) => {
    const count = Math.min(Math.max(parseInt(req.body.count) || 1, 1), 1000);
    
    botCreationQueue = [];
    createBots(count);
    
    res.send({ 
        status: 'creating', 
        count,
        message: `Создаю ${count} ботов. Ожидайте...`
    });
});

app.post('/chat', (req, res) => {
    const botIndex = parseInt(req.body.botIndex);
    if (isNaN(botIndex) || !bots[botIndex] || !bots[botIndex].isConnected) {
        return res.status(503).send({ status: 'error', message: 'Бот не подключен' });
    }

    try {
        bots[botIndex].bot.chat(req.body.message);
        res.send({ status: 'sent' });
    } catch (e) {
        res.status(500).send({ status: 'error', message: e.message });
    }
});

app.post('/move', (req, res) => {
    const botIndex = parseInt(req.body.botIndex);
    if (isNaN(botIndex) || !bots[botIndex] || !bots[botIndex].isConnected) {
        return res.status(503).send({ status: 'error', message: 'Бот не подключен' });
    }

    try {
        const { x, y, z } = req.body;
        const target = vec3(x, y, z);
        
        bots[botIndex].bot.setControlState('forward', false);
        bots[botIndex].isMoving = false;
        
        bots[botIndex].bot.lookAt(target);
        bots[botIndex].bot.setControlState('forward', true);
        bots[botIndex].isMoving = true;
        bots[botIndex].lastPosition = bots[botIndex].bot.entity.position.clone();
        
        res.send({ status: 'moving' });
    } catch (e) {
        res.status(500).send({ status: 'error', message: e.message });
    }
});

app.post('/stop', (req, res) => {
    const botIndex = parseInt(req.body.botIndex);
    if (isNaN(botIndex) || !bots[botIndex] || !bots[botIndex].isConnected) {
        return res.status(503).send({ status: 'error', message: 'Бот не подключен' });
    }

    try {
        bots[botIndex].bot.setControlState('forward', false);
        bots[botIndex].isMoving = false;
        bots[botIndex].stuckTimer = 0;
        res.send({ status: 'stopped' });
    } catch (e) {
        res.status(500).send({ status: 'error', message: e.message });
    }
});

app.post('/startAllWalking', (req, res) => {
    bots.forEach((botData, index) => {
        if (botData.isConnected) {
            try {
                if (botData.isMoving) {
                    botData.bot.setControlState('forward', false);
                    botData.isMoving = false;
                }
                
                const radius = 5;
                const angle = Math.random() * Math.PI * 2;
                const distance = Math.random() * radius;
                
                const target = vec3(
                    botData.homePosition.x + Math.cos(angle) * distance,
                    botData.homePosition.y,
                    botData.homePosition.z + Math.sin(angle) * distance
                );
                
                botData.bot.lookAt(target);
                botData.bot.setControlState('forward', true);
                botData.isMoving = true;
                botData.lastPosition = botData.bot.entity.position.clone();
                botData.stuckTimer = 0;
                
            } catch (e) {
                console.log(`[${botData.username}] Ошибка:`, e.message);
            }
        }
    });
    
    res.send({ status: 'all_started_walking', count: bots.length });
});

app.get('/status', (req, res) => {
    const statuses = bots.map((botData, index) => ({
        botIndex: index,
        connected: botData.isConnected,
        username: botData.username,
        position: botData.bot.entity?.position,
        health: botData.bot.health,
        food: botData.bot.food,
        isMoving: botData.isMoving || false
    }));
    res.send(statuses);
});

app.post('/broadcast', (req, res) => {
    const message = req.body.message;
    if (!message) {
        return res.status(400).send({ status: 'error', message: 'Требуется сообщение' });
    }

    let sentCount = 0;
    bots.forEach(botData => {
        if (botData.isConnected) {
            try {
                botData.bot.chat(message);
                sentCount++;
            } catch (e) {
                console.log(`[${botData.username}] Ошибка:`, e.message);
            }
        }
    });

    res.send({ 
        status: 'broadcast', 
        sentCount, 
        totalBots: bots.length,
        message: `Отправлено ${sentCount} ботам`
    });
});

// Мониторинг производительности
let lastCpuUsage = process.cpuUsage();
setInterval(() => {
    const usage = process.cpuUsage(lastCpuUsage);
    lastCpuUsage = process.cpuUsage();
    const mem = process.memoryUsage();
    
    const connectedBots = bots.filter(b => b.isConnected).length;
    
    console.log(`[PERF] CPU: ${(usage.user / 1000).toFixed(1)}ms | ` +
               `RAM: ${(mem.rss / 1024 / 1024).toFixed(1)}MB | ` +
               `Боты: ${connectedBots}/${bots.length} | ` +
               `Создание: ${isCreatingBots ? 'ДА' : 'нет'} [${botCreationQueue.length}]`);
}, 10000);

// Запускаем сервер API
const server = app.listen(3000, () => {
    console.log('API сервер запущен на порту 3000');
    server.setMaxListeners(1000);
    createBots(1);
});