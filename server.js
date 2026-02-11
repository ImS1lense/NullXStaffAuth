require('dotenv').config();
const express = require('express');
const cors = require('cors');
const mysql = require('mysql2/promise');
const { Client, GatewayIntentBits, Partials, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, ModalBuilder, TextInputBuilder, TextInputStyle, Events } = require('discord.js');

const app = express();
const PORT = process.env.PORT || 4000;

// === TOKEN FROM ENV ONLY ===
const DISCORD_BOT_TOKEN = process.env.DISCORD_BOT_TOKEN;

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

async function initDB() {
    try {
        litebansPool = mysql.createPool(LITEBANS_DB_CONFIG);
        console.log("✅ LiteBans DB Pool Initialized");
    } catch (err) { console.error("❌ LiteBans Config Error:", err.message); }

    try {
        checksPool = mysql.createPool(CHECKS_DB_CONFIG);
        console.log("✅ Checks/Logs DB Pool Initialized");
        
        const connection = await checksPool.getConnection();
        await connection.query(`
            CREATE TABLE IF NOT EXISTS web_users (
                discord_id VARCHAR(32) PRIMARY KEY,
                username VARCHAR(64),
                minecraft_nick VARCHAR(64),
                balance INT DEFAULT 5000,
                banner_url TEXT,
                last_withdraw BIGINT DEFAULT 0
            )
        `);
        await connection.query(`
            CREATE TABLE IF NOT EXISTS web_logs (
                id INT AUTO_INCREMENT PRIMARY KEY,
                target_id VARCHAR(32),
                admin_id VARCHAR(32),
                action VARCHAR(32),
                reason TEXT,
                details TEXT,
                date DATETIME DEFAULT CURRENT_TIMESTAMP
            )
        `);
        await connection.query(`
            CREATE TABLE IF NOT EXISTS web_economy_logs (
                id INT AUTO_INCREMENT PRIMARY KEY,
                user_id VARCHAR(32),
                executor_id VARCHAR(32),
                type VARCHAR(32),
                amount INT,
                details TEXT,
                source VARCHAR(64),
                date DATETIME DEFAULT CURRENT_TIMESTAMP
            )
        `);
        connection.release();
        console.log("✅ Web Panel Tables Verified");
    } catch (err) { console.error("❌ Checks/Logs DB Config Error:", err.message); }
}

initDB();

const RANK_ROLE_IDS = [
    "1459285694458626222", "1458158059187732666", "1458158896894967879",
    "1458159110720589944", "1458159802105594061", "1458277039399374991"
];

const ALLOWED_ADMIN_IDS = [
    '802105175720460318', '440704669178789888', '591281053503848469',
    '1455582084893642998', '846540575032344596', '1468330580910542868'
];

const TEMP_DB = { loa: {}, loaRequests: [], appeals: [] };

app.use(cors({ origin: true, credentials: true }));
app.use(express.json());

const client = new Client({
    intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMembers, GatewayIntentBits.DirectMessages, GatewayIntentBits.GuildPresences],
    partials: [Partials.Channel, Partials.Message] 
});

client.on('debug', (info) => {
    if (!info.includes('Heartbeat')) console.log(`[DISCORD DEBUG] ${info}`);
});

if (!DISCORD_BOT_TOKEN) {
    console.error("❌❌❌ CRITICAL ERROR: DISCORD_BOT_TOKEN IS MISSING IN ENV! ❌❌❌");
} else {
    console.log("🔑 Initializing Bot with token from Environment...");
    client.login(DISCORD_BOT_TOKEN)
        .then(() => console.log("✅ Login Promise Resolved."))
        .catch(err => {
            console.error("❌ FATAL LOGIN ERROR:", err.message);
            if (err.code === 'TokenInvalid') console.error("👉 Check Token in Render Environment Variables.");
            if (err.code === 'DisallowedIntents') console.error("👉 Enable PRESENCE INTENT & SERVER MEMBERS INTENT in Discord Dev Portal.");
        });
}

client.once('ready', () => {
    console.log(`✅ BOT ONLINE: ${client.user.tag}`);
    console.log(`✅ Monitoring Guild ID: ${GUILD_ID}`);
});

// === HELPER FUNCTIONS ===
async function getUserData(discordId, username = 'Unknown') {
    if (!checksPool) return { balance: 5000, minecraft_nick: null, banner_url: null, last_withdraw: 0 };
    try {
        const [rows] = await checksPool.query('SELECT * FROM web_users WHERE discord_id = ?', [discordId]);
        if (rows.length === 0) {
            await checksPool.query('INSERT INTO web_users (discord_id, username) VALUES (?, ?)', [discordId, username]);
            return { balance: 5000, minecraft_nick: null, banner_url: null, last_withdraw: 0 };
        }
        return rows[0];
    } catch (e) { return { balance: 5000, minecraft_nick: null, banner_url: null, last_withdraw: 0 }; }
}

async function updateUserBalance(discordId, newBalance) {
    if (!checksPool) return;
    try { await checksPool.query('UPDATE web_users SET balance = ? WHERE discord_id = ?', [newBalance, discordId]); } catch (e) {}
}

async function addWebLog(targetId, adminId, action, reason, details) {
    if (!checksPool) return;
    try { await checksPool.query('INSERT INTO web_logs (target_id, admin_id, action, reason, details) VALUES (?, ?, ?, ?, ?)', [targetId, adminId, action, reason, details]); } catch (e) {}
}

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
    } catch (e) { console.error("Discord Log error:", e); }
}

function formatDateForMySQL(date) { return date.toISOString().slice(0, 19).replace('T', ' '); }

async function waitForReady(timeout = 10000) {
    if (client.isReady()) return true;
    console.log("⏳ Waiting for bot to be ready...");
    return new Promise(resolve => {
        let isResolved = false;
        const onReady = () => { if (!isResolved) { isResolved = true; resolve(true); } };
        setTimeout(() => {
            if (!isResolved) {
                isResolved = true;
                console.log("⚠️ Bot wait timeout reached. Proceeding anyway.");
                client.off('ready', onReady); 
                resolve(false);
            }
        }, timeout);
        client.once('ready', onReady);
    });
}

// === API ROUTES ===
app.get('/api/staff', async (req, res) => {
    const isReady = await waitForReady(8000); 
    
    try {
        const guild = await client.guilds.fetch(GUILD_ID).catch((e) => {
            console.error(`Failed to fetch guild ${GUILD_ID}:`, e.message);
            return null;
        });

        if (!guild) return res.status(404).json({ error: 'Bot not connected to Guild' });
        
        await guild.members.fetch({ withPresences: true }).catch(e => console.error("Member fetch failed:", e.message));
        
        const staffMembers = guild.members.cache.filter(member => member.roles.cache.has(STAFF_ROLE_ID));
        
        let dbUsers = [], dbLogs = [];
        try {
             if (checksPool) {
                 [dbUsers] = await checksPool.query('SELECT * FROM web_users');
                 [dbLogs] = await checksPool.query('SELECT target_id, action FROM web_logs');
             }
        } catch (dbErr) {}

        const result = staffMembers.map(m => {
            const userDb = dbUsers.find(u => u.discord_id === m.id) || {};
            const userLogs = dbLogs.filter(l => l.target_id === m.id);
            const activeWarns = Math.max(0, userLogs.filter(l => l.action === 'warn').length - userLogs.filter(l => l.action === 'unwarn').length);
            return {
                id: m.id, username: m.user.username, displayName: m.displayName, avatar: m.user.avatar,
                roles: m.roles.cache.map(r => r.id), status: m.presence ? m.presence.status : 'offline',
                loa: TEMP_DB.loa[m.id] || null, 
                minecraftNick: userDb.minecraft_nick || null,
                bannerUrl: userDb.banner_url || null, warnCount: activeWarns, 
                balance: userDb.balance !== undefined ? userDb.balance : 5000
            };
        });
        res.json(result);
    } catch (error) { 
        console.error("Staff Fetch Error:", error);
        res.json([]);
    }
});

app.post('/api/economy/withdraw', async (req, res) => {
    const { userId, amount, minecraftNick } = req.body;
    if (!userId || !amount || !minecraftNick) return res.status(400).json({ error: "Missing parameters" });
    const userData = await getUserData(userId);
    const lastTime = userData.last_withdraw || 0;
    const now = Date.now();
    const COOLDOWN = 24 * 60 * 60 * 1000;
    if (now - lastTime < COOLDOWN) {
        const remaining = Math.ceil((COOLDOWN - (now - lastTime)) / (1000 * 60 * 60));
        return res.status(400).json({ error: `Вывод доступен через ${remaining} ч.` });
    }
    if (amount > userData.balance) return res.status(400).json({ error: "Недостаточно средств" });
    if (!checksPool) return res.status(503).json({ error: "DB Error" });
    try {
        const newBalance = userData.balance - amount;
        await checksPool.query('UPDATE web_users SET balance = ?, last_withdraw = ? WHERE discord_id = ?', [newBalance, now, userId]);
        await checksPool.query('INSERT INTO commands (command) VALUES (?)', [`p give ${minecraftNick} ${amount}`]);
        await checksPool.query('INSERT INTO web_economy_logs (user_id, executor_id, type, amount, details, source) VALUES (?, ?, ?, ?, ?, ?)',
            [userId, userId, 'WITHDRAW', -amount, `Вывод на IGN: ${minecraftNick}`, 'Личный кабинет']);
        res.json({ success: true, newBalance, message: `Успешно выведено ${amount} Аметринов` });
    } catch (error) {
        await checksPool.query('UPDATE web_users SET balance = ? WHERE discord_id = ?', [userData.balance, userId]);
        res.status(500).json({ error: "Ошибка базы данных." });
    }
});

app.post('/api/economy/manage', async (req, res) => {
    const { adminId, targetId, amount, action } = req.body;
    if (!ALLOWED_ADMIN_IDS.includes(adminId)) return res.status(403).json({ error: "Доступ запрещен" });
    const userData = await getUserData(targetId);
    let newBalance = userData.balance;
    let logAmount = 0;
    let type = 'INCOME';
    if (action === 'give') { newBalance += amount; logAmount = amount; }
    else if (action === 'take') { newBalance = Math.max(0, newBalance - amount); logAmount = -amount; type = 'WITHDRAW'; }
    else if (action === 'set') { newBalance = amount; logAmount = amount; }
    await updateUserBalance(targetId, newBalance);
    await checksPool.query('INSERT INTO web_economy_logs (user_id, executor_id, type, amount, details, source) VALUES (?, ?, ?, ?, ?, ?)',
        [targetId, adminId, type, logAmount, `Admin: ${action}`, 'Администрация']);
    res.json({ success: true, newBalance });
});

app.get('/api/economy/history/:userId', async (req, res) => {
    if (!checksPool) return res.json({ logs: [], lastWithdraw: 0 });
    try {
        const [logs] = await checksPool.query('SELECT * FROM web_economy_logs WHERE user_id = ? ORDER BY date DESC LIMIT 50', [req.params.userId]);
        const userData = await getUserData(req.params.userId);
        res.json({ logs, lastWithdraw: userData.last_withdraw });
    } catch(e) { res.json({ logs: [], lastWithdraw: 0 }); }
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
        if (range === 'week') { cutoffTime = now - (604800000); dateObj = new Date(cutoffTime); }
        else if (range === 'month') { cutoffTime = now - (2592000000); dateObj = new Date(cutoffTime); }
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
        res.json(stats);
    } catch (error) { res.json(stats); }
});

app.post('/api/set-nickname', async (req, res) => {
    const { targetId, nickname } = req.body;
    await getUserData(targetId);
    if (checksPool) await checksPool.query('UPDATE web_users SET minecraft_nick = ? WHERE discord_id = ?', [nickname || null, targetId]);
    res.json({ success: true, nickname });
});

app.post('/api/set-banner', async (req, res) => {
    const { targetId, bannerUrl } = req.body;
    await getUserData(targetId);
    if (checksPool) await checksPool.query('UPDATE web_users SET banner_url = ? WHERE discord_id = ?', [bannerUrl || null, targetId]);
    res.json({ success: true, bannerUrl });
});

app.get('/api/logs/:userId', async (req, res) => {
    if (!checksPool) return res.json([]);
    try {
        const [rows] = await checksPool.query('SELECT * FROM web_logs WHERE target_id = ? ORDER BY date DESC', [req.params.userId]);
        const formatted = rows.map(r => ({ id: r.id, targetId: r.target_id, adminId: r.admin_id, action: r.action, reason: r.reason, date: r.date }));
        res.json(formatted);
    } catch (e) { res.json([]); }
});

app.get('/api/updates', async (req, res) => {
    let logsCount = 0;
    try {
        if (checksPool) {
            const [rows] = await checksPool.query('SELECT COUNT(*) as count FROM web_logs');
            logsCount = rows[0].count;
        }
    } catch(e) {}
    res.json({ logsCount, appealsCount: TEMP_DB.appeals.length, loaRequestsCount: TEMP_DB.loaRequests.length });
});

app.get('/api/appeals', (req, res) => { res.json(TEMP_DB.appeals.filter(a => a.status === 'pending').reverse()); });
app.post('/api/appeals/resolve', async (req, res) => {
    const { appealId, action, adminId } = req.body;
    const appeal = TEMP_DB.appeals.find(a => a.id === appealId);
    if (!appeal) return res.status(404).json({ error: "Not found" });
    appeal.status = action === 'approve' ? 'approved' : 'rejected';
    try {
        const user = await client.users.fetch(appeal.userId);
        if (action === 'approve') {
            await user.send(`✅ **Ваша апелляция принята!**\nВарн будет снят.`);
            await addWebLog(appeal.userId, adminId, 'unwarn', 'Апелляция одобрена', `Appeal ID: ${appealId}`);
            logActionToDiscord('unwarn', user, { id: adminId }, 'Апелляция одобрена', `Appeal ID: ${appealId}`);
        } else await user.send(`❌ **Ваша апелляция отклонена.**`);
    } catch(e) {}
    res.json({ success: true });
});

app.get('/api/loa/requests', (req, res) => { res.json(TEMP_DB.loaRequests); });
app.post('/api/loa/request', (req, res) => {
    const { userId, username, duration, reason } = req.body;
    if (TEMP_DB.loaRequests.find(r => r.userId === userId)) return res.status(400).json({ error: "Есть активная заявка" });
    TEMP_DB.loaRequests.push({ id: Date.now().toString(), userId, username, duration, reason, date: new Date().toISOString() });
    res.json({ success: true });
});
app.post('/api/loa/resolve', async (req, res) => {
    const { requestId, action, adminId } = req.body;
    const idx = TEMP_DB.loaRequests.findIndex(r => r.id === requestId);
    if (idx === -1) return res.status(404).json({ error: "Not found" });
    const reqData = TEMP_DB.loaRequests[idx];
    TEMP_DB.loaRequests.splice(idx, 1);
    if (action === 'approve') {
        TEMP_DB.loa[reqData.userId] = { active: true, start: Date.now(), end: Date.now() + (reqData.duration * 86400000), reason: reqData.reason };
        try {
            const user = await client.users.fetch(reqData.userId);
            const admin = await client.users.fetch(adminId).catch(() => ({ id: adminId }));
            await user.send(`✅ **Отпуск одобрен!**\nСрок: ${reqData.duration} дн.`);
            logActionToDiscord('loa', user, admin, "Отпуск одобрен", `Срок: ${reqData.duration} дн.`);
            await addWebLog(reqData.userId, adminId, 'loa', 'Отпуск одобрен', `${reqData.duration} дн`);
        } catch(e) {}
    } else try { (await client.users.fetch(reqData.userId)).send(`❌ **Заявка на отпуск отклонена.**`); } catch(e) {}
    res.json({ success: true });
});
app.post('/api/loa/stop', async (req, res) => {
    const { userId } = req.body;
    if (TEMP_DB.loa[userId]) {
        TEMP_DB.loa[userId].active = false;
        await addWebLog(userId, userId, 'loa', 'Вернулся из неактива', 'Manual stop');
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
            try { await member.send({ content: `⚠️ **ВЫ ПОЛУЧИЛИ ПРЕДУПРЕЖДЕНИЕ**\nПричина: ${reason}`, components: [row] }); } catch(e) {}
        }
        await addWebLog(targetId, adminId, finalAction, reason, logDetails);
        logActionToDiscord(finalAction, member.user, { id: adminId }, reason, logDetails);
        res.json({ success: true });
    } catch (error) { res.status(500).json({ error: error.message }); }
});

app.listen(PORT, () => console.log(`✅ Server running on ${PORT}`));