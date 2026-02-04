require('dotenv').config();
const express = require('express');
const cors = require('cors');
const { Client, GatewayIntentBits, Partials, EmbedBuilder } = require('discord.js');

const app = express();
// Render выдает порт автоматически через process.env.PORT
const PORT = process.env.PORT || 4000;

// КОНФИГУРАЦИЯ
const GUILD_ID = process.env.GUILD_ID || '1458138848822431770'; 
const LOG_CHANNEL_ID = '1458163321302945946'; 
const STAFF_ROLE_ID = '1458158245700046901'; 

// IDs ролей иерархии (для авто-снятия при повышении/понижении)
const RANK_ROLE_IDS = [
    "1459285694458626222", // Стажёр
    "1458158059187732666", // Младший модератор
    "1458158896894967879", // Модератор
    "1458159110720589944", // Старший модератор
    "1458159802105594061", // Шеф модератор
    "1458277039399374991"  // Куратор
];

// === НАСТРОЙКА ДОСТУПА (CORS) ===
app.use(cors({
    origin: function (origin, callback) {
        // Разрешаем запросы без origin (например, если тестировать через Postman)
        if (!origin) return callback(null, true);
        
        // Разрешаем ВСЕ поддомены vercel.app и локалку
        if (origin.includes('vercel.app') || origin.includes('localhost')) {
            return callback(null, true);
        }
        
        console.log("⛔ Блокировка CORS для:", origin);
        return callback(new Error('Not allowed by CORS'));
    },
    credentials: true
}));

app.use(express.json());

// Инициализация Discord Клиента
const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMembers, 
        GatewayIntentBits.DirectMessages,
        GatewayIntentBits.GuildPresences 
    ],
    partials: [Partials.Channel, Partials.Message] 
});

// Логин бота
if (!process.env.DISCORD_BOT_TOKEN) {
    console.error("❌ ОШИБКА: Нет токена! Убедитесь, что он добавлен в Environment Variables на Render.");
} else {
    client.login(process.env.DISCORD_BOT_TOKEN).catch(err => {
        console.error("❌ ОШИБКА АВТОРИЗАЦИИ БОТА:", err.message);
    });
}

client.once('ready', () => {
    console.log(`✅ Бот вошел как ${client.user.tag}`);
    console.log(`🚀 API доступно по адресу: https://nullx-backend.onrender.com`);
});

// === HELPER: LOGGING ===
async function logActionToDiscord(action, targetUser, adminUser, reason, details = "") {
    try {
        const channel = await client.channels.fetch(LOG_CHANNEL_ID).catch(() => null);
        if (!channel) return console.log("Канал логов не найден");

        const colorMap = {
            promote: 0x34D399, demote: 0xF97316, kick: 0xEF4444,
            warn: 0xEAB308, unwarn: 0x6366F1, hire: 0x3B82F6
        };

        const embed = new EmbedBuilder()
            .setTitle(`ДЕЙСТВИЕ: ${action.toUpperCase()}`)
            .setColor(colorMap[action] || 0x808080)
            .addFields(
                { name: 'Администратор', value: `${adminUser ? `<@${adminUser.id}>` : 'Неизвестно'}`, inline: true },
                { name: 'Пользователь', value: `${targetUser ? `<@${targetUser.id}>` : 'Неизвестно'}`, inline: true },
                { name: 'Причина', value: reason || 'Не указана' },
                { name: 'Детали', value: details || 'Нет' }
            )
            .setTimestamp()
            .setFooter({ text: 'NULLX Admin Panel' });

        await channel.send({ embeds: [embed] });
    } catch (e) {
        console.error("Log error:", e);
    }
}

// === API: GET STAFF LIST ===
app.get('/api/staff', async (req, res) => {
    // Check if client is ready
    if (!client.isReady()) {
        return res.status(503).json({ error: "Бот запускается, попробуйте через 5 секунд..." });
    }

    try {
        const guild = await client.guilds.fetch(GUILD_ID).catch(() => null);
        if (!guild) return res.status(404).json({ error: 'Discord Server Error: Guild not found' });

        // Важно: нужно включить SERVER MEMBERS INTENT в Developer Portal
        try {
            await guild.members.fetch(); 
        } catch (e) {
            console.error("Ошибка получения участников. Проверьте Intents в Dev Portal:", e.message);
            // Пытаемся продолжить с кэшем, если fetch упал
        }

        const staffMembers = guild.members.cache.filter(member => 
            member.roles.cache.has(STAFF_ROLE_ID)
        );

        const result = staffMembers.map(m => ({
            id: m.id,
            username: m.user.username,
            displayName: m.displayName, // Никнейм на сервере (обычно это ник в Minecraft)
            global_name: m.user.globalName,
            avatar: m.user.avatar,
            roles: m.roles.cache.map(r => r.id),
            status: m.presence ? m.presence.status : 'offline'
        }));

        res.json(result);
    } catch (error) {
        console.error("Staff fetch error:", error);
        res.status(500).json({ error: "Ошибка получения списка: " + error.message });
    }
});

// === API: ACTIONS ===
app.post('/api/action', async (req, res) => {
    const { action, targetId, targetRoleId, reason, warnCount, adminId } = req.body;
    
    // Лог в консоль Render для отладки
    console.log(`[API REQUEST] Action: ${action} | User: ${targetId}`);

    try {
        const guild = await client.guilds.fetch(GUILD_ID);
        const member = await guild.members.fetch({ user: targetId, force: true }).catch(() => null);
        
        if (!member) return res.status(404).json({ error: 'Пользователь не найден в Discord' });

        let logDetails = "";

        // ЛОГИКА ДЕЙСТВИЙ
        switch (action) {
            case 'kick':
                if (!member.kickable) return res.status(403).json({ error: 'Нет прав кикнуть этого пользователя (его роль выше роли бота)' });
                await member.kick(reason);
                logDetails = "Пользователь изгнан";
                break;

            case 'promote':
            case 'demote':
                if (!targetRoleId) return res.status(400).json({ error: 'Роль не указана' });
                
                // 1. Снимаем все другие ранговые роли, кроме новой
                const rolesToRemove = member.roles.cache
                    .filter(role => RANK_ROLE_IDS.includes(role.id) && role.id !== targetRoleId)
                    .map(role => role.id); // Получаем массив ID для надежности

                if (rolesToRemove.length > 0) {
                    await member.roles.remove(rolesToRemove, "Обновление ранга (снятие старого)");
                }

                // 2. Выдаем новую роль
                // Проверяем, есть ли уже эта роль, чтобы не спамить API, но add идемпотентен
                await member.roles.add(targetRoleId, reason);

                logDetails = `Новая роль: <@&${targetRoleId}>`;
                break;

            case 'hire':
                if (!targetRoleId) return res.status(400).json({ error: 'Роль не указана' });
                await member.roles.add(targetRoleId, reason);
                
                // При hire добавляем роль персонала (доступ к панели) если ее нет
                if (STAFF_ROLE_ID && !member.roles.cache.has(STAFF_ROLE_ID)) {
                     await member.roles.add(STAFF_ROLE_ID, "Выдача прав персонала");
                }
                
                logDetails = `Принят на должность <@&${targetRoleId}>`;
                break;

            case 'warn':
                logDetails = `Варн ${warnCount}/3`;
                try {
                    await member.send(`⚠️ **Вам выдано предупреждение!**\nПричина: ${reason}\nВсего: ${warnCount}/3`);
                } catch(e) {}
                break;
                
            case 'unwarn':
                logDetails = `Варн снят`;
                try {
                    await member.send(`✅ **Предупреждение снято!**\nПричина: ${reason}`);
                } catch(e) {}
                break;
            
            default: return res.status(400).json({ error: 'Unknown action' });
        }

        // Отправляем лог в канал
        logActionToDiscord(action, member.user, { id: adminId }, reason, logDetails);

        res.json({ success: true });

    } catch (error) {
        console.error("API Error:", error);
        res.status(500).json({ error: error.message });
    }
});

// Запуск сервера
app.listen(PORT, () => {
    console.log(`✅ Сервер запущен на порту ${PORT}`);
});