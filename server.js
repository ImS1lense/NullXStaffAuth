require('dotenv').config();
const express = require('express');
const cors = require('cors');
const { Client, GatewayIntentBits, Partials, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, ModalBuilder, TextInputBuilder, TextInputStyle, Events } = require('discord.js');

const app = express();
const PORT = process.env.PORT || 4000;

const GUILD_ID = process.env.GUILD_ID || '1458138848822431770'; 
const LOG_CHANNEL_ID = '1458163321302945946'; 
const STAFF_ROLE_ID = '1458158245700046901'; 

// Roles sorted from Lowest (0) to Highest (5)
const RANK_ROLE_IDS = [
    "1459285694458626222", // Trainee
    "1458158059187732666", // Jr. Mod
    "1458158896894967879", // Moderator
    "1458159110720589944", // Sr. Mod
    "1458159802105594061", // Chief
    "1458277039399374991"  // Curator
];

// === MOCK DATABASE (IN-MEMORY) ===
const MOCK_DB = {
    logs: [], // { id, targetId, adminId, action, reason, date }
    loa: {},   // { userId: { start: timestamp, end: timestamp, active: boolean, reason: string } }
    appeals: [], // { id, userId, warnId (optional), text, status: 'pending'|'approved'|'rejected', date }
    minecraftNicks: {} // { userId: "Nickname" }
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

// === INTERACTION HANDLER FOR EXCUSES ===
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
                
                // Save to DB
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

                // Log to Discord Channel
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

// === API Routes ===

app.get('/api/staff', async (req, res) => {
    if (!client.isReady()) return res.status(503).json({ error: "Bot starting..." });

    try {
        const guild = await client.guilds.fetch(GUILD_ID).catch(() => null);
        if (!guild) return res.status(404).json({ error: 'Guild not found' });

        // Ensure we fetch presences to show Online/Offline correctly
        await guild.members.fetch({ withPresences: true });

        const staffMembers = guild.members.cache.filter(member => member.roles.cache.has(STAFF_ROLE_ID));

        const result = staffMembers.map(m => ({
            id: m.id,
            username: m.user.username,
            displayName: m.displayName,
            avatar: m.user.avatar,
            roles: m.roles.cache.map(r => r.id),
            status: m.presence ? m.presence.status : 'offline',
            loa: MOCK_DB.loa[m.id] || null,
            minecraftNick: MOCK_DB.minecraftNicks[m.id] || null // Send MC Nick
        }));

        res.json(result);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

app.post('/api/set-nickname', (req, res) => {
    const { targetId, nickname } = req.body;
    if (!targetId) return res.status(400).json({ error: "Target ID required" });

    if (nickname && nickname.trim() !== "") {
        MOCK_DB.minecraftNicks[targetId] = nickname;
    } else {
        delete MOCK_DB.minecraftNicks[targetId];
    }
    
    res.json({ success: true, nickname: MOCK_DB.minecraftNicks[targetId] });
});

app.get('/api/logs/:userId', (req, res) => {
    const userId = req.params.userId;
    const userLogs = MOCK_DB.logs.filter(l => l.targetId === userId).reverse();
    res.json(userLogs);
});

// Endpoint for Notification Polling
app.get('/api/updates', (req, res) => {
    // Return counts so client can check if something changed
    res.json({
        logsCount: MOCK_DB.logs.length,
        appealsCount: MOCK_DB.appeals.length,
        lastLog: MOCK_DB.logs[MOCK_DB.logs.length - 1],
        lastAppeal: MOCK_DB.appeals[MOCK_DB.appeals.length - 1]
    });
});

app.get('/api/appeals', (req, res) => {
    // Returns pending appeals
    res.json(MOCK_DB.appeals.filter(a => a.status === 'pending').reverse());
});

app.post('/api/appeals/resolve', async (req, res) => {
    const { appealId, action, adminId } = req.body; // action: 'approve' | 'reject'
    
    const appeal = MOCK_DB.appeals.find(a => a.id === appealId);
    if (!appeal) return res.status(404).json({ error: "Appeal not found" });

    appeal.status = action === 'approve' ? 'approved' : 'rejected';

    try {
        const user = await client.users.fetch(appeal.userId);
        if (action === 'approve') {
            await user.send(`✅ **Ваша апелляция принята!**\nВарн будет снят.`);
             MOCK_DB.logs.push({
                id: Date.now().toString(),
                targetId: appeal.userId,
                adminId: adminId,
                action: 'unwarn',
                reason: 'Апелляция одобрена',
                date: new Date().toISOString()
            });
            logActionToDiscord('unwarn', user, { id: adminId }, 'Апелляция одобрена', `Appeal ID: ${appealId}`);

        } else {
            await user.send(`❌ **Ваша апелляция отклонена.**\nРешение администрации окончательно.`);
        }
    } catch(e) {}

    res.json({ success: true });
});

app.post('/api/loa', async (req, res) => {
    const { userId, active, duration, reason } = req.body;
    
    if (active) {
        MOCK_DB.loa[userId] = {
            active: true,
            start: Date.now(),
            end: Date.now() + (duration * 24 * 60 * 60 * 1000),
            reason: reason || "Без причины"
        };
    } else {
        if (MOCK_DB.loa[userId]) MOCK_DB.loa[userId].active = false;
    }

    try {
        const user = await client.users.fetch(userId);
        const details = active 
            ? `Срок: ${duration} дн. Причина: ${reason}` 
            : "Вернулся из неактива";
        logActionToDiscord('loa', user, user, active ? "Ушел в неактив" : "Снял неактив", details);
    } catch(e) {}

    res.json({ success: true, active });
});

app.post('/api/action', async (req, res) => {
    const { action, targetId, targetRoleId, reason, warnCount, adminId } = req.body;
    console.log(`[Action] ${action} -> ${targetId}`);

    try {
        const guild = await client.guilds.fetch(GUILD_ID);
        const member = await guild.members.fetch({ user: targetId, force: true }).catch(() => null);
        if (!member) return res.status(404).json({ error: 'Member not found' });

        let logDetails = "";
        let finalAction = action;

        // Auto Promote/Demote Logic
        if (action === 'promote' || action === 'demote') {
            // 1. Find current rank index
            const currentRoleIds = member.roles.cache.map(r => r.id);
            let currentRankIndex = -1;
            
            // Find highest rank they have
            for (let i = RANK_ROLE_IDS.length - 1; i >= 0; i--) {
                if (currentRoleIds.includes(RANK_ROLE_IDS[i])) {
                    currentRankIndex = i;
                    break;
                }
            }

            let newRankIndex = currentRankIndex;
            if (action === 'promote') newRankIndex++;
            if (action === 'demote') newRankIndex--;

            // Boundary checks
            if (newRankIndex < 0) return res.status(400).json({ error: "Нельзя понизить ниже Стажера." });
            if (newRankIndex >= RANK_ROLE_IDS.length) return res.status(400).json({ error: "Достигнут максимальный ранг." });

            const newRoleId = RANK_ROLE_IDS[newRankIndex];
            
            // Apply changes
            const rolesToRemove = member.roles.cache
                .filter(role => RANK_ROLE_IDS.includes(role.id) && role.id !== newRoleId)
                .map(role => role.id);
            
            if (rolesToRemove.length > 0) await member.roles.remove(rolesToRemove);
            await member.roles.add(newRoleId, reason);
            
            logDetails = `Auto: ${currentRankIndex} -> ${newRankIndex} (<@&${newRoleId}>)`;
        } 
        else if (action === 'kick') {
             if (!member.kickable) return res.status(403).json({ error: 'Not kickable' });
             await member.kick(reason);
             logDetails = "Kicked";
        }
        else if (action === 'warn') {
             logDetails = `Warn ${warnCount}/3`;
             try {
                const row = new ActionRowBuilder()
                    .addComponents(
                        new ButtonBuilder()
                            .setCustomId('write_excuse')
                            .setLabel('Написать объяснительную')
                            .setStyle(ButtonStyle.Primary) 
                            .setEmoji('📝')
                    );
                
                await member.send({ 
                    content: `⚠️ **ВЫ ПОЛУЧИЛИ ПРЕДУПРЕЖДЕНИЕ**\n\n**Причина:** ${reason}\n**Администратор:** <@${adminId}>\n**Счетчик:** ${warnCount}/3\n\nЕсли вы считаете наказание несправедливым, нажмите кнопку ниже для подачи апелляции/объяснительной.`,
                    components: [row]
                });
            } catch(e) { logDetails += " (DM Failed)"; }
        }
        else if (action === 'unwarn') {
            logDetails = `Unwarned manually`;
            try { await member.send(`✅ **Варн снят!**\nПричина снятия: ${reason}`); } catch(e) {}
        }

        // Записываем в "БД"
        MOCK_DB.logs.push({
            id: Date.now().toString(),
            targetId,
            adminId,
            action: finalAction,
            reason,
            date: new Date().toISOString()
        });

        logActionToDiscord(finalAction, member.user, { id: adminId }, reason, logDetails);
        res.json({ success: true });

    } catch (error) {
        console.error("API Error:", error);
        res.status(500).json({ error: error.message });
    }
});

app.listen(PORT, () => console.log(`✅ Server running on ${PORT}`));