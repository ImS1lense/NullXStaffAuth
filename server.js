require('dotenv').config();
const express = require('express');
const cors = require('cors');
const mysql = require('mysql2/promise');
const { Client, GatewayIntentBits, Partials, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, ModalBuilder, TextInputBuilder, TextInputStyle, Events } = require('discord.js');

const app = express();
const PORT = process.env.PORT || 4000;

const GUILD_ID = process.env.GUILD_ID || '1458138848822431770'; 
const LOG_CHANNEL_ID = '1458163321302945946'; 
const STAFF_ROLE_ID = '1458158245700046901'; 

// === DATABASE CONFIGURATION ===

const LITEBANS_DB_CONFIG = {
    host: process.env.DB_HOST || 'panel.nullx.space',
    user: process.env.DB_USER || 'u1_FAXro5fVCj',
    password: process.env.DB_PASSWORD || 'Crd9BOkGxGz+lYwihN96Uu+T',
    database: process.env.DB_NAME || 's1_litebans',
    waitForConnections: true,
    connectionLimit: 10,
    queueLimit: 0
};

const CHECKS_DB_CONFIG = {
    host: 'panel.nullx.space', 
    user: 'u1_McHWJLbCr4',
    password: 'J3K1qTw61BZpp!y.sbLrlpvt',
    database: 's1_logs', 
    port: 3306,
    waitForConnections: true,
    connectionLimit: 10,
    queueLimit: 0
};

let litebansPool = null;
let checksPool = null;

try {
    litebansPool = mysql.createPool(LITEBANS_DB_CONFIG);
    console.log("✅ LiteBans DB Pool Initialized");
} catch (err) {
    console.error("❌ LiteBans DB Config Error:", err.message);
}

try {
    checksPool = mysql.createPool(CHECKS_DB_CONFIG);
    console.log("✅ Checks/Logs DB Pool Initialized");
} catch (err) {
    console.error("❌ Checks/Logs DB Config Error:", err.message);
}

const RANK_ROLE_IDS = [
    "1459285694458626222", // Trainee
    "1458158059187732666", // Jr. Mod
    "1458158896894967879", // Moderator
    "1458159110720589944", // Sr. Mod
    "1458159802105594061", // Chief
    "1458277039399374991"  // Curator
];

const ALLOWED_ADMIN_IDS = [
    '802105175720460318', '440704669178789888', '591281053503848469',
    '1455582084893642998', '846540575032344596', '1468330580910542868'
];

const MOCK_DB = {
    logs: [],
    loa: {},
    loaRequests: [],
    appeals: [],
    minecraftNicks: {},
    banners: {},
    balances: {},
    lastWithdraw: {},
    economyLogs: [] // { id, userId, executorId, type, amount, date, details, source }
};

app.use(cors({
    origin: function (origin, callback) {
        if (!origin) return callback(null, true);
        if (origin.includes('vercel.app') || origin.includes('localhost')) {
            return callback(null, true);
        }
        return callback(new Error('Not allowed by CORS'));
    },
    credentials: true
}));

app.use(express.json());

const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMembers, 
        GatewayIntentBits.DirectMessages,
        GatewayIntentBits.GuildPresences 
    ],
    partials: [Partials.Channel, Partials.Message] 
});

if (!process.env.DISCORD_BOT_TOKEN) {
    console.error("❌ ОШИБКА: Нет токена!");
} else {
    client.login(process.env.DISCORD_BOT_TOKEN).catch(err => console.error("❌ Auth Error:", err.message));
}

client.once('ready', () => {
    console.log(`✅ Bot ready: ${client.user.tag}`);
});

client.on(Events.InteractionCreate, async interaction => {
    try {
        if (interaction.isButton()) {
            if (interaction.customId === 'write_excuse') {
                const modal = new ModalBuilder()
                    .setCustomId('excuse_modal')
                    .setTitle('Написать объяснительную');

                const reasonInput = new TextInputBuilder()
                    .setCustomId('excuse_reason')
                    .setLabel("Причина / Оправдание")
                    .setPlaceholder("Опишите ситуацию подробно...")
                    .setStyle(TextInputStyle.Paragraph)
                    .setRequired(true);

                const firstActionRow = new ActionRowBuilder().addComponents(reasonInput);
                modal.addComponents(firstActionRow);

                await interaction.showModal(modal);
            }
        } 
        else if (interaction.isModalSubmit()) {
            if (interaction.customId === 'excuse_modal') {
                const reason = interaction.fields.getTextInputValue('excuse_reason');
                const appealObj = {
                    id: Date.now().toString(),
                    userId: interaction.user.id,
                    username: interaction.user.username,
                    text: reason,
                    status: 'pending',
                    date: new Date().toISOString()
                };
                MOCK_DB.appeals.push(appealObj);
                await interaction.reply({ content: '✅ Ваша объяснительная отправлена руководству. Ожидайте решения.', ephemeral: true });
                const channel = await client.channels.fetch(LOG_CHANNEL_ID).catch(() => null);
                if (channel) {
                    const embed = new EmbedBuilder()
                        .setTitle('📝 ПОЛУЧЕНА ОБЪЯСНИТЕЛЬНАЯ')
                        .setColor(0x3B82F6) 
                        .addFields(
                            { name: 'От сотрудника', value: `<@${interaction.user.id}> (${interaction.user.tag})`, inline: true },
                            { name: 'Текст', value: reason }
                        )
                        .setTimestamp();
                    await channel.send({ embeds: [embed] });
                }
            }
        }
    } catch (error) {
        console.error("Interaction error:", error);
    }
});

async function logActionToDiscord(action, targetUser, adminUser, reason, details = "") {
    try {
        const channel = await client.channels.fetch(LOG_CHANNEL_ID).catch(() => null);
        if (!channel) return;
        const colorMap = { promote: 0x34D399, demote: 0xF97316, kick: 0xEF4444, warn: 0xEAB308, unwarn: 0x6366F1, hire: 0x3B82F6, loa: 0x9333EA };
        const embed = new EmbedBuilder()
            .setTitle(`ACTION: ${action.toUpperCase()}`)
            .setColor(colorMap[action] || 0x808080)
            .addFields(
                { name: 'Admin', value: `${adminUser ? `<@${adminUser.id}>` : 'System'}`, inline: true },
                { name: 'Target', value: `${targetUser ? `<@${targetUser.id}>` : 'None'}`, inline: true },
                { name: 'Reason', value: reason || 'N/A' },
                { name: 'Details', value: details || 'None' }
            )
            .setTimestamp();
        await channel.send({ embeds: [embed] });
    } catch (e) { console.error("Log error:", e); }
}

function formatDateForMySQL(date) {
    return date.toISOString().slice(0, 19).replace('T', ' ');
}

// === API Routes ===

app.post('/api/economy/withdraw', async (req, res) => {
    const { userId, amount, minecraftNick } = req.body;
    if (!userId || !amount || !minecraftNick) return res.status(400).json({ error: "Missing parameters" });

    const lastTime = MOCK_DB.lastWithdraw[userId] || 0;
    const now = Date.now();
    const COOLDOWN = 24 * 60 * 60 * 1000;

    if (now - lastTime < COOLDOWN) {
        const remaining = Math.ceil((COOLDOWN - (now - lastTime)) / (1000 * 60 * 60));
        return res.status(400).json({ error: `Вывод доступен через ${remaining} ч.` });
    }

    const currentBalance = MOCK_DB.balances[userId] || 0;
    if (amount > currentBalance) return res.status(400).json({ error: "Недостаточно средств" });

    // Проверка подключения к БД для выдачи
    if (!checksPool) {
         return res.status(503).json({ error: "Ошибка подключения к серверу выдачи" });
    }

    try {
        // Оптимистичное списание
        MOCK_DB.balances[userId] = currentBalance - amount;
        MOCK_DB.lastWithdraw[userId] = now;

        // Выполнение команды на сервере через БД
        const command = `p give ${minecraftNick} ${amount}`;
        await checksPool.query('INSERT INTO commands (command) VALUES (?)', [command]);

        MOCK_DB.economyLogs.push({
            id: Date.now().toString(),
            userId,
            executorId: userId,
            type: 'WITHDRAW',
            amount: -amount,
            date: new Date().toISOString(),
            details: `Вывод на игровой аккаунт ${minecraftNick}`,
            source: 'Личный кабинет'
        });

        console.log(`[Economy] Withdrawal success: ${amount} to ${minecraftNick} (Cmd: ${command})`);

        res.json({ 
            success: true, 
            newBalance: MOCK_DB.balances[userId],
            message: `Успешно выведено ${amount} Аметринов на аккаунт ${minecraftNick}` 
        });

    } catch (error) {
        console.error("[Economy] Withdraw DB Error:", error);
        // Возврат средств при ошибке
        MOCK_DB.balances[userId] = currentBalance;
        MOCK_DB.lastWithdraw[userId] = lastTime; 
        
        res.status(500).json({ error: "Ошибка базы данных. Средства возвращены." });
    }
});

app.post('/api/economy/manage', (req, res) => {
    const { adminId, targetId, amount, action } = req.body; 

    if (!ALLOWED_ADMIN_IDS.includes(adminId)) return res.status(403).json({ error: "Доступ запрещен" });
    if (!MOCK_DB.balances[targetId]) MOCK_DB.balances[targetId] = 0;
    
    let oldBalance = MOCK_DB.balances[targetId];
    let newBalance = oldBalance;
    let logType = 'INCOME';
    let source = 'Администрация';

    if (action === 'give') {
        newBalance = oldBalance + amount;
        logType = 'INCOME';
        source = 'Пополнение счета (Зарплата)';
    } else if (action === 'take') {
        newBalance = Math.max(0, oldBalance - amount);
        logType = 'WITHDRAW';
        source = 'Списание средств (Штраф)';
    } else if (action === 'set') {
        newBalance = amount;
        logType = 'INCOME';
        source = 'Корректировка баланса';
    }

    MOCK_DB.balances[targetId] = newBalance;
    MOCK_DB.economyLogs.push({
        id: Date.now().toString(),
        userId: targetId,
        executorId: adminId,
        type: logType,
        amount: action === 'take' ? -amount : amount,
        date: new Date().toISOString(),
        details: `Действие администратора`,
        source: source
    });

    res.json({ success: true, newBalance });
});

app.get('/api/economy/history/:userId', (req, res) => {
    const userId = req.params.userId;
    const logs = MOCK_DB.economyLogs.filter(l => l.userId === userId).reverse();
    const lastWithdraw = MOCK_DB.lastWithdraw[userId] || 0;
    res.json({ logs, lastWithdraw });
});

app.get('/api/stats/:ign', async (req, res) => {
    const ign = req.params.ign;
    const range = req.query.range || 'all';
    let stats = { bans: 0, mutes: 0, checks: 0, playtimeSeconds: 0, history: [] };
    if (!ign || ign === 'undefined') return res.json(stats);

    try {
        let cutoffTime = 0;
        let dateObj = new Date(0); 
        const now = Date.now();
        if (range === 'week') { cutoffTime = now - (7 * 24 * 60 * 60 * 1000); dateObj = new Date(cutoffTime); }
        else if (range === 'month') { cutoffTime = now - (30 * 24 * 60 * 60 * 1000); dateObj = new Date(cutoffTime); }
        const mysqlDateString = formatDateForMySQL(dateObj);

        if (litebansPool) {
            const [banRows] = await litebansPool.query('SELECT COUNT(*) as count FROM litebans_bans WHERE banned_by_name = ? AND time >= ?', [ign, cutoffTime]);
            stats.bans = banRows[0]?.count || 0;
            const [muteRows] = await litebansPool.query('SELECT COUNT(*) as count FROM litebans_mutes WHERE banned_by_name = ? AND time >= ?', [ign, cutoffTime]);
            stats.mutes = muteRows[0]?.count || 0;
        }

        if (checksPool) {
            const [checkCountRows] = await checksPool.query('SELECT COUNT(*) as count FROM revise_logs WHERE admin = ? AND date >= ?', [ign, mysqlDateString]);
            stats.checks = checkCountRows[0]?.count || 0;
            const [playtimeRows] = await checksPool.query(`SELECT SUM(TIMESTAMPDIFF(SECOND, enterDate, exitDate)) as total_seconds FROM online_logs WHERE player = ? AND enterDate >= ? AND exitDate IS NOT NULL`, [ign, mysqlDateString]);
            stats.playtimeSeconds = parseInt(playtimeRows[0]?.total_seconds || 0);
        }

        let lbH = [], chH = [];
        if (litebansPool) {
            const [lbRows] = await litebansPool.query(`(SELECT 'ban' as type, reason, time, until, removed_by_name, banned_by_name as admin, NULL as target FROM litebans_bans WHERE banned_by_name = ? AND time >= ? ORDER BY time DESC) UNION ALL (SELECT 'mute' as type, reason, time, until, removed_by_name, banned_by_name as admin, NULL as target FROM litebans_mutes WHERE banned_by_name = ? AND time >= ? ORDER BY time DESC) ORDER BY time DESC`, [ign, cutoffTime, ign, cutoffTime]);
            lbH = lbRows.map(r => ({ ...r, dateObj: new Date(parseInt(r.time)), displayType: r.type.toUpperCase() }));
        }
        if (checksPool) {
            const [checkRows] = await checksPool.query('SELECT id, date, admin, target, type FROM revise_logs WHERE admin = ? AND date >= ? ORDER BY date DESC', [ign, mysqlDateString]);
            chH = checkRows.map(r => ({ type: 'CHECK', displayType: r.type, reason: 'Проверка на читы', time: new Date(r.date).getTime(), dateObj: new Date(r.date), target: r.target, admin: r.admin, removed_by_name: null, until: 0 }));
        }
        stats.history = [...lbH, ...chH].sort((a, b) => b.dateObj - a.dateObj);
    } catch (error) { console.error(error); }
    res.json(stats);
});

app.get('/api/staff', async (req, res) => {
    if (!client.isReady()) return res.status(503).json({ error: "Bot starting..." });
    try {
        const guild = await client.guilds.fetch(GUILD_ID).catch(() => null);
        if (!guild) return res.status(404).json({ error: 'Guild not found' });
        await guild.members.fetch({ withPresences: true });
        const staffMembers = guild.members.cache.filter(member => member.roles.cache.has(STAFF_ROLE_ID));
        const result = staffMembers.map(m => {
            const userLogs = MOCK_DB.logs.filter(l => l.targetId === m.id);
            const activeWarns = Math.max(0, userLogs.filter(l => l.action === 'warn').length - userLogs.filter(l => l.action === 'unwarn').length);
            if (MOCK_DB.balances[m.id] === undefined) MOCK_DB.balances[m.id] = 5000;
            return {
                id: m.id, username: m.user.username, displayName: m.displayName, avatar: m.user.avatar,
                roles: m.roles.cache.map(r => r.id), status: m.presence ? m.presence.status : 'offline',
                loa: MOCK_DB.loa[m.id] || null, minecraftNick: MOCK_DB.minecraftNicks[m.id] || null,
                bannerUrl: MOCK_DB.banners[m.id] || null, warnCount: activeWarns, balance: MOCK_DB.balances[m.id]
            };
        });
        res.json(result);
    } catch (error) { res.status(500).json({ error: error.message }); }
});

app.post('/api/set-nickname', (req, res) => {
    const { targetId, nickname } = req.body;
    if (!targetId) return res.status(400).json({ error: "Target ID required" });
    if (nickname && nickname.trim() !== "") MOCK_DB.minecraftNicks[targetId] = nickname;
    else delete MOCK_DB.minecraftNicks[targetId];
    res.json({ success: true, nickname: MOCK_DB.minecraftNicks[targetId] });
});

app.post('/api/set-banner', (req, res) => {
    const { targetId, bannerUrl } = req.body;
    if (!targetId) return res.status(400).json({ error: "Target ID required" });
    if (bannerUrl && bannerUrl.trim() !== "") MOCK_DB.banners[targetId] = bannerUrl;
    else delete MOCK_DB.banners[targetId];
    res.json({ success: true, bannerUrl: MOCK_DB.banners[targetId] });
});

app.get('/api/logs/:userId', (req, res) => {
    res.json(MOCK_DB.logs.filter(l => l.targetId === req.params.userId).reverse());
});

app.get('/api/updates', (req, res) => {
    res.json({
        logsCount: MOCK_DB.logs.length,
        appealsCount: MOCK_DB.appeals.length,
        loaRequestsCount: MOCK_DB.loaRequests.length,
        lastLog: MOCK_DB.logs[MOCK_DB.logs.length - 1],
        lastAppeal: MOCK_DB.appeals[MOCK_DB.appeals.length - 1],
        lastLoaRequest: MOCK_DB.loaRequests[MOCK_DB.loaRequests.length - 1]
    });
});

app.get('/api/appeals', (req, res) => { res.json(MOCK_DB.appeals.filter(a => a.status === 'pending').reverse()); });

app.post('/api/appeals/resolve', async (req, res) => {
    const { appealId, action, adminId } = req.body;
    const appeal = MOCK_DB.appeals.find(a => a.id === appealId);
    if (!appeal) return res.status(404).json({ error: "Appeal not found" });
    appeal.status = action === 'approve' ? 'approved' : 'rejected';
    try {
        const user = await client.users.fetch(appeal.userId);
        if (action === 'approve') {
            await user.send(`✅ **Ваша апелляция принята!**\nВарн будет снят.`);
            MOCK_DB.logs.push({ id: Date.now().toString(), targetId: appeal.userId, adminId: adminId, action: 'unwarn', reason: 'Апелляция одобрена', date: new Date().toISOString() });
            logActionToDiscord('unwarn', user, { id: adminId }, 'Апелляция одобрена', `Appeal ID: ${appealId}`);
        } else await user.send(`❌ **Ваша апелляция отклонена.**\nРешение администрации окончательно.`);
    } catch(e) {}
    res.json({ success: true });
});

app.get('/api/loa/requests', (req, res) => { res.json(MOCK_DB.loaRequests); });

app.post('/api/loa/request', (req, res) => {
    const { userId, username, duration, reason } = req.body;
    if (MOCK_DB.loaRequests.find(r => r.userId === userId)) return res.status(400).json({ error: "У вас уже есть активная заявка на рассмотрении." });
    MOCK_DB.loaRequests.push({ id: Date.now().toString(), userId, username, duration, reason, date: new Date().toISOString() });
    res.json({ success: true });
});

app.post('/api/loa/resolve', async (req, res) => {
    const { requestId, action, adminId } = req.body;
    const requestIndex = MOCK_DB.loaRequests.findIndex(r => r.id === requestId);
    if (requestIndex === -1) return res.status(404).json({ error: "Request not found" });
    const request = MOCK_DB.loaRequests[requestIndex];
    MOCK_DB.loaRequests.splice(requestIndex, 1);
    if (action === 'approve') {
        MOCK_DB.loa[request.userId] = { active: true, start: Date.now(), end: Date.now() + (request.duration * 24 * 60 * 60 * 1000), reason: request.reason };
        try {
            const user = await client.users.fetch(request.userId);
            const admin = await client.users.fetch(adminId).catch(() => ({ id: adminId, tag: 'Admin' }));
            await user.send(`✅ **Ваш отпуск одобрен!**\nСрок: ${request.duration} дн.\nОдобрил: <@${adminId}>`);
            logActionToDiscord('loa', user, admin, "Отпуск одобрен куратором", `Срок: ${request.duration} дн. Причина: ${request.reason}`);
        } catch(e) {}
    } else {
        try {
            const user = await client.users.fetch(request.userId);
            await user.send(`❌ **Заявка на отпуск отклонена.**\nПопробуйте позже или свяжитесь с куратором.`);
        } catch(e) {}
    }
    res.json({ success: true });
});

app.post('/api/loa/stop', async (req, res) => {
    const { userId } = req.body;
    if (MOCK_DB.loa[userId]) {
        MOCK_DB.loa[userId].active = false;
        try { const user = await client.users.fetch(userId); logActionToDiscord('loa', user, user, "Вернулся из неактива (Вручную)", "Статус: Active"); } catch(e) {}
    }
    res.json({ success: true });
});

app.post('/api/action', async (req, res) => {
    const { action, targetId, reason, warnCount, adminId } = req.body;
    try {
        const guild = await client.guilds.fetch(GUILD_ID);
        const member = await guild.members.fetch({ user: targetId, force: true }).catch(() => null);
        if (!member) return res.status(404).json({ error: 'Member not found' });
        let logDetails = "", finalAction = action;
        if (action === 'promote' || action === 'demote') {
            const currentRoleIds = member.roles.cache.map(r => r.id);
            let currentRankIndex = -1;
            for (let i = RANK_ROLE_IDS.length - 1; i >= 0; i--) { if (currentRoleIds.includes(RANK_ROLE_IDS[i])) { currentRankIndex = i; break; } }
            let newRankIndex = action === 'promote' ? currentRankIndex + 1 : currentRankIndex - 1;
            if (newRankIndex < 0 || newRankIndex >= RANK_ROLE_IDS.length) return res.status(400).json({ error: "Ошибка границ ранга" });
            const newRoleId = RANK_ROLE_IDS[newRankIndex];
            const rolesToRemove = member.roles.cache.filter(role => RANK_ROLE_IDS.includes(role.id) && role.id !== newRoleId).map(role => role.id);
            if (rolesToRemove.length > 0) await member.roles.remove(rolesToRemove);
            await member.roles.add(newRoleId, reason);
            logDetails = `Auto: ${currentRankIndex} -> ${newRankIndex}`;
        } else if (action === 'kick') { await member.kick(reason); logDetails = "Kicked"; }
        else if (action === 'warn') {
            logDetails = `Warn ${warnCount}/3`;
            const row = new ActionRowBuilder().addComponents(new ButtonBuilder().setCustomId('write_excuse').setLabel('Написать объяснительную').setStyle(ButtonStyle.Primary).setEmoji('📝'));
            try { await member.send({ content: `⚠️ **ВЫ ПОЛУЧИЛИ ПРЕДУПРЕЖДЕНИЕ**\n\n**Причина:** ${reason}\n**Администратор:** <@${adminId}>\n**Счетчик:** ${warnCount}/3`, components: [row] }); } catch(e) {}
        }
        MOCK_DB.logs.push({ id: Date.now().toString(), targetId, adminId, action: finalAction, reason, date: new Date().toISOString() });
        logActionToDiscord(finalAction, member.user, { id: adminId }, reason, logDetails);
        res.json({ success: true });
    } catch (error) { res.status(500).json({ error: error.message }); }
});

app.listen(PORT, () => console.log(`✅ Server running on ${PORT}`));