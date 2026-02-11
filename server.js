require('dotenv').config();
const express = require('express');
const cors = require('cors');
const mysql = require('mysql2/promise');
const { Client, GatewayIntentBits, Partials, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');

const app = express();
const PORT = process.env.PORT || 4000;

// === MOCK DATA (Фейковые данные, если бот не работает) ===
const MOCK_STAFF = [
    {
        id: "mock1", username: "NullX_Owner", displayName: "NullX_Owner", 
        avatar: null, roles: ["1458277039399374991"], status: "online", 
        loa: null, minecraftNick: "NullX_Admin", bannerUrl: null, warnCount: 0, balance: 99999
    },
    {
        id: "mock2", username: "Staff_User", displayName: "CoolModerator", 
        avatar: null, roles: ["1458158896894967879"], status: "dnd", 
        loa: null, minecraftNick: "Mod_Steve", bannerUrl: null, warnCount: 1, balance: 5000
    }
];

const DISCORD_BOT_TOKEN = process.env.DISCORD_BOT_TOKEN;
const GUILD_ID = process.env.GUILD_ID || '1458138848822431770'; 
const LOG_CHANNEL_ID = '1458163321302945946'; 
const STAFF_ROLE_ID = '1458158245700046901'; 

// === DB CONFIG ===
const LITEBANS_DB_CONFIG = {
    host: process.env.DB_HOST || 'panel.nullx.space',
    user: process.env.DB_USER || 'u1_FAXro5fVCj',
    password: process.env.DB_PASSWORD || 'Crd9BOkGxGz+lYwihN96Uu+T',
    database: process.env.DB_NAME || 's1_litebans',
    waitForConnections: true, connectionLimit: 10, queueLimit: 0
};
const CHECKS_DB_CONFIG = {
    host: 'panel.nullx.space', user: 'u1_McHWJLbCr4', password: 'J3K1qTw61BZpp!y.sbLrlpvt',
    database: 's1_logs', port: 3306, waitForConnections: true, connectionLimit: 10, queueLimit: 0
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
        const conn = await checksPool.getConnection();
        conn.release();
    } catch (err) { console.error("❌ Checks/Logs DB Config Error:", err.message); }
}
initDB();

const RANK_ROLE_IDS = [
    "1459285694458626222", "1458158059187732666", "1458158896894967879",
    "1458159110720589944", "1458159802105594061", "1458277039399374991"
];
const ALLOWED_ADMIN_IDS = ['802105175720460318', '440704669178789888', '591281053503848469', '1455582084893642998', '846540575032344596', '1468330580910542868'];
const TEMP_DB = { loa: {}, loaRequests: [], appeals: [] };

app.use(cors({ origin: true, credentials: true }));
app.use(express.json());

// REMOVED GatewayIntentBits.GuildPresences to fix timeout issues
const client = new Client({
    intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMembers, GatewayIntentBits.DirectMessages],
    partials: [Partials.Channel, Partials.Message] 
});

client.on('debug', (info) => {
    if (!info.includes('Heartbeat')) console.log(`[DISCORD] ${info}`);
});

if (DISCORD_BOT_TOKEN) {
    client.login(DISCORD_BOT_TOKEN).catch(e => console.error("Login Failed:", e.message));
} else {
    console.log("⚠️ NO TOKEN PROVIDED - RUNNING IN OFFLINE MOCK MODE");
}

client.once('ready', () => {
    console.log(`✅ BOT ONLINE: ${client.user.tag}`);
});

// === HELPER ===
async function waitForReady(timeout = 5000) {
    if (client.isReady()) return true;
    return new Promise(resolve => {
        const t = setTimeout(() => resolve(false), timeout);
        client.once('ready', () => { clearTimeout(t); resolve(true); });
    });
}

// === ROUTES ===
app.get('/api/staff', async (req, res) => {
    const isReady = await waitForReady(3000); // Wait 3s max
    
    // FALLBACK TO MOCK DATA IF BOT FAILS
    if (!isReady) {
        console.log("⚠️ Bot timeout/offline. Sending MOCK DATA to frontend.");
        // Return mock data formatted like real data
        return res.json(MOCK_STAFF.map(m => ({
            ...m,
            roleId: m.roles[0], // Simplified for mock
            isCurrentUser: false // Frontend handles this
        })));
    }

    try {
        const guild = await client.guilds.fetch(GUILD_ID);
        await guild.members.fetch(); // Load cache
        const staffMembers = guild.members.cache.filter(member => member.roles.cache.has(STAFF_ROLE_ID));
        
        // Fetch DB data... (simplified for stability)
        let dbUsers = [];
        if (checksPool) {
            try { [dbUsers] = await checksPool.query('SELECT * FROM web_users'); } catch(e) {}
        }

        const result = staffMembers.map(m => {
            const userDb = dbUsers.find(u => u.discord_id === m.id) || {};
            return {
                id: m.id, username: m.user.username, displayName: m.displayName, avatar: m.user.avatar,
                roles: m.roles.cache.map(r => r.id), status: 'online', // Presences disabled for stability
                loa: TEMP_DB.loa[m.id] || null, 
                minecraftNick: userDb.minecraft_nick || null,
                bannerUrl: userDb.banner_url || null, 
                warnCount: 0, 
                balance: userDb.balance !== undefined ? userDb.balance : 5000
            };
        });
        res.json(result);
    } catch (error) {
        console.error("API Error:", error);
        res.json([]);
    }
});

// Basic dummy routes to prevent crashes
app.get('/api/updates', (req, res) => res.json({ logsCount: 0, appealsCount: 0, loaRequestsCount: 0 }));
app.get('/api/logs/:userId', (req, res) => res.json([]));
app.get('/api/economy/history/:userId', (req, res) => res.json({ logs: [], lastWithdraw: 0 }));
app.get('/api/stats/:ign', (req, res) => res.json({ bans: 0, mutes: 0, checks: 0, playtimeSeconds: 0, history: [] }));
app.get('/api/loa/requests', (req, res) => res.json([]));
app.get('/api/appeals', (req, res) => res.json([]));

app.listen(PORT, () => console.log(`✅ Server running on ${PORT}`));