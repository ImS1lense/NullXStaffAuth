require('dotenv').config();
const express = require('express');
const cors = require('cors');
const { Client, GatewayIntentBits, Partials, EmbedBuilder } = require('discord.js');

const app = express();
// ВАЖНО: Render и другие хостинги выдают свой порт через process.env.PORT
const PORT = process.env.PORT || 4000;

const GUILD_ID = '1458138848822431770'; // ID вашего сервера
const LOG_CHANNEL_ID = '1458163321302945946'; // Канал для логов
const STAFF_ROLE_ID = '1458158245700046901'; // Роль Staff для фильтрации списка

// Middleware
// Разрешаем запросы с вашего сайта на Vercel и с локалки
app.use(cors({
    origin: ['https://o-auth2-null-x.vercel.app', 'http://localhost:3000', 'http://localhost:5173'],
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
    console.error("❌ ОШИБКА: Не найден токен бота! Создайте файл .env и добавьте DISCORD_BOT_TOKEN=ваш_токен");
} else {
    client.login(process.env.DISCORD_BOT_TOKEN).catch(err => {
        if (err.message.includes('Used disallowed intents') || err.code === 'DisallowedIntents') {
            console.error("\n❌ ОШИБКА ДОСТУПА (INTENTS):");
            console.error("👉 Включите 'Privileged Gateway Intents' (Presence, Server Members, Message Content) в Discord Dev Portal.\n");
        } else {
            console.error("❌ ОШИБКА АВТОРИЗАЦИИ БОТА:", err.message);
        }
    });
}

client.once('ready', () => {
    console.log(`✅ Бот вошел как ${client.user.tag}`);
    console.log(`🚀 Сервер API запущен на порту ${PORT}`);
    console.log(`📂 Рабочая директория: ${__dirname}`);
});

// === HELPER: LOGGING ===
async function logActionToDiscord(action, targetUser, adminUser, reason, details = "") {
    try {
        const channel = await client.channels.fetch(LOG_CHANNEL_ID).catch(() => null);
        if (!channel) return console.error("Канал логов не найден или нет доступа");

        const colorMap = {
            promote: 0x34D399, // Green
            demote: 0xF97316, // Orange
            kick: 0xEF4444,   // Red
            warn: 0xEAB308,   // Yellow
            unwarn: 0x6366F1, // Indigo
            hire: 0x3B82F6    // Blue
        };

        const actionNames = {
            promote: "ПОВЫШЕНИЕ",
            demote: "ПОНИЖЕНИЕ",
            kick: "ИЗГНАНИЕ",
            warn: "ПРЕДУПРЕЖДЕНИЕ",
            unwarn: "СНЯТИЕ ВАРНА",
            hire: "ПРИНЯТИЕ"
        };

        const embed = new EmbedBuilder()
            .setTitle(`ДЕЙСТВИЕ: ${actionNames[action] || action.toUpperCase()}`)
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
        console.error("Failed to send log:", e);
    }
}

// === API: GET STAFF LIST ===
app.get('/api/staff', async (req, res) => {
    try {
        const guild = await client.guilds.fetch(GUILD_ID);
        if (!guild) return res.status(404).json({ error: 'Сервер Discord не найден' });

        // Загружаем всех участников
        await guild.members.fetch();

        const staffMembers = guild.members.cache.filter(member => 
            member.roles.cache.has(STAFF_ROLE_ID)
        );

        const result = staffMembers.map(m => ({
            id: m.id,
            username: m.user.username,
            global_name: m.user.globalName,
            avatar: m.user.avatar,
            roles: m.roles.cache.map(r => r.id),
            status: m.presence ? m.presence.status : 'offline'
        }));

        res.json(result);
    } catch (error) {
        console.error("Error fetching staff:", error);
        res.status(500).json({ error: "Ошибка получения списка персонала" });
    }
});

// === API: ACTIONS ===
app.post('/api/action', async (req, res) => {
    const { action, targetId, targetRoleId, reason, warnCount, adminId } = req.body;

    console.log(`[API] Action: ${action} | Target: ${targetId} | Admin: ${adminId}`);

    try {
        const guild = await client.guilds.fetch(GUILD_ID);
        const member = await guild.members.fetch({ user: targetId, force: true }).catch(() => null);
        const adminMember = adminId ? await guild.members.fetch(adminId).catch(() => null) : null;

        if (!member && action !== 'lookup') return res.status(404).json({ error: 'Пользователь не найден' });

        // Проверка прав
        if (!guild.members.me.permissions.has('Administrator') && !guild.members.me.permissions.has('ManageRoles')) {
             return res.status(403).json({ error: 'У бота нет прав Администратора' });
        }

        let logDetails = "";

        switch (action) {
            case 'kick':
                if (!member.kickable) return res.status(403).json({ error: 'Невозможно кикнуть (роль пользователя выше роли бота)' });
                await member.kick(reason);
                logDetails = "Пользователь изгнан с сервера";
                break;

            case 'promote':
            case 'demote':
            case 'hire':
                if (!targetRoleId) return res.status(400).json({ error: 'Роль не указана' });
                const role = guild.roles.cache.get(targetRoleId);
                
                await member.roles.add(targetRoleId, reason);
                logDetails = `Выдана роль: ${role ? role.name : targetRoleId}`;
                break;

            case 'warn':
                logDetails = `Уровень варна: ${warnCount}/3`;
                try {
                    await member.send({
                        embeds: [{
                            title: "⚠️ ПОЛУЧЕНО ПРЕДУПРЕЖДЕНИЕ",
                            color: 0xFFAA00,
                            description: `**Причина:** ${reason}\n**Уровень:** ${warnCount}/3`,
                            footer: { text: `Выдал: Администрация` }
                        }]
                    });
                } catch (e) { logDetails += " (ЛС закрыты)"; }
                break;

            case 'unwarn':
                logDetails = `Варн снят. Уровень: ${warnCount}/3`;
                 try {
                    await member.send({
                        embeds: [{
                            title: "👁️ ПРЕДУПРЕЖДЕНИЕ СНЯТО",
                            color: 0x55FF55,
                            description: `**Причина:** ${reason}`,
                        }]
                    });
                } catch (e) {}
                break;

            default:
                return res.status(400).json({ error: 'Неизвестное действие' });
        }

        // Send Log
        logActionToDiscord(action, member.user, adminMember ? adminMember.user : { id: adminId }, reason, logDetails);

        res.json({ success: true, message: `Действие ${action} выполнено` });

    } catch (error) {
        console.error("API Error:", error);
        res.status(500).json({ error: error.message || 'Внутренняя ошибка сервера' });
    }
});

app.listen(PORT, () => {
    // console.log(`Listening on ${PORT}`); 
});