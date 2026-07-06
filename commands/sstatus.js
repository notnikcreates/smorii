import { createTextContainer } from '../utils/modUtils.js';
import { ActionRowBuilder, ButtonBuilder, ButtonStyle, SlashCommandBuilder } from 'discord.js';
import GuildConfig from '../models/GuildConfig.js';
import { fileURLToPath } from 'url';
import path from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function generateStatusPayload(guild, client, intervalMinutes, isInteraction = true) {
    let config = await GuildConfig.findOne({ guildId: guild.id });
    if (!config) config = new GuildConfig({ guildId: guild.id });

    const SERVER_KEY = config.erlcKey;

    if (!SERVER_KEY) {
        const payload = {
            components: [
                {
                    type: 17,
                    components: [{ type: 10, content: `<:deny:1493679796281020426> **ERLC API Key not set.**\nPlease use \`/config set-key\` to set your server's API key.` }]
                }
            ]
        };
        if (isInteraction) payload.flags = 32768;
        return payload;
    }

    // Default States
    let data = {
        name: "Unknown",
        owner: "Unknown",
        players: "0/0",
        queue: "0",
        staff: "0",
        code: "Scanning...",
        online: false
    };

    try {
        const [serverRes, queueRes, staffRes, playersRes] = await Promise.all([
            fetch('https://api.policeroleplay.community/v1/server', { headers: { 'Server-Key': SERVER_KEY } }),
            fetch('https://api.policeroleplay.community/v1/server/queue', { headers: { 'Server-Key': SERVER_KEY } }),
            fetch('https://api.policeroleplay.community/v1/server/staff', { headers: { 'Server-Key': SERVER_KEY } }),
            fetch('https://api.policeroleplay.community/v1/server/players', { headers: { 'Server-Key': SERVER_KEY } })
        ]);

        if (serverRes.ok) {
            const serverInfo = await serverRes.json();
            data.online = true;
            data.name = serverInfo.Name || "Smorii Systems";
            data.players = `${serverInfo.CurrentPlayers || 0}/${serverInfo.MaxPlayers || 0}`;
            data.code = serverInfo.JoinCode || "Private";

            if (serverInfo.OwnerId) {
                const robloxRes = await fetch(`https://users.roblox.com/v1/users/${serverInfo.OwnerId}`);
                if (robloxRes.ok) {
                    const robloxUser = await robloxRes.json();
                    data.owner = robloxUser.displayName || robloxUser.name;
                }
            }
        }

        if (queueRes.ok) {
            const q = await queueRes.json();
            data.queue = String(Array.isArray(q) ? q.length : (q.count || 0));
        }

        if (staffRes.ok && playersRes.ok) {
            const staffList = await staffRes.json();
            const players = await playersRes.json();
            const admins = staffList.Admins || [];
            const mods = staffList.Mods || [];
            const staffIds = new Set([
                ...(staffList.CoOwners || []),
                ...(Array.isArray(admins) ? admins : Object.keys(admins)),
                ...(Array.isArray(mods) ? mods : Object.keys(mods))
            ].map(String));

            const activeStaff = players.filter(p => {
                const id = String(p.Id || p.UserId || "");
                const perm = p.Permission || "";
                return ["Server Owner", "Co-Owner", "Admin", "Mod"].some(r => perm.includes(r)) || staffIds.has(id);
            });
            data.staff = String(activeStaff.length);
        }
    } catch (e) { console.error("ERLC API Error:", e); }

    const sstatusCfg = config.customEmbeds?.sstatus || { title: 'Smorii Systems | Session Status', footer: 'Smorii Systems' };
    const sessionRoleMention = config.roles.sessionRole ? `<@&${config.roles.sessionRole}>` : '*No role configured*';

    const textContent1 = `<:smorii:1493679842229616702> **| ${sstatusCfg.title}**\n` +
                         `### <:pin:1493679816359284936> Welcome to Smorii\n` +
                         `Our daily sessions are currently tracked below. Ensure you have the ${sessionRoleMention} role to stay updated on new starts.`;

    const textContent2 = `<:maintenance:1493679809090420947> **SERVER INFORMATION**\n` +
                         `> **Last Updated:** <t:${Math.floor(Date.now() / 1000)}:R>\n` +
                         `> **Join Code:** \`${data.code}\`\n` +
                         `> **Server Name:** \`${data.name}\`\n` +
                         `> **Owner:** \`${data.owner}\``;

    const statsContent = `<:settings:1493679803143028766> **Live Statistics**\n` +
                         `<:charmpeople:1493679818208837824> **Players:** \`${data.players}\`\n` +
                         `<:chart:1493679799472750714> **Queue:** \`${data.queue}\`\n` +
                         `<:crown:1493679801104597044> **Staff:** \`${data.staff}\``;

    const row = new ActionRowBuilder().addComponents(
        new ButtonBuilder()
            .setCustomId('status_display')
            .setLabel(data.online ? 'Server Online' : 'Server Offline')
            .setStyle(data.online ? ButtonStyle.Success : ButtonStyle.Danger)
            .setDisabled(true),
        new ButtonBuilder()
            .setCustomId(config.roles.sessionRole || 'not_set')
            .setLabel('Session Notifications')
            .setEmoji('<:cog:1493679820477960363>')
            .setStyle(ButtonStyle.Secondary)
    );

    const payload = {
        components: [
            {
                type: 17,
                components: [
                    { type: 12, items: [{ media: { url: config.images.sstatusBanner } }] },
                    { type: 10, content: textContent1 },
                    { type: 14, spacing: 2, divider: true },
                    { type: 10, content: textContent2 },
                    { type: 14, spacing: 2, divider: true },
                    { type: 10, content: statsContent },
                    { type: 12, items: [{ media: { url: config.images.sstatusMain } }] }
                ]
            },
            row.toJSON()
        ]
    };

    if (isInteraction) payload.flags = 32768;

    return payload;
}

export default {
    name: 'sstatus',
    data: new SlashCommandBuilder()
        .setName('sstatus')
        .setDescription('Displays the V2 auto-updating session status.')
        .addIntegerOption(opt => opt.setName('interval').setDescription('Update interval (mins)').setMinValue(1).setMaxValue(60)),

    async execute(interaction, args, client) {
        const isCmd = interaction.isChatInputCommand?.();
        const interval = (isCmd ? interaction.options.getInteger('interval') : parseInt(args?.[0])) || 15;

        const payload = await generateStatusPayload(interaction.guild, client, interval, isCmd);
        let statusMsg;

        if (isCmd) {
            statusMsg = await interaction.reply({ ...payload, fetchReply: true });
        } else {
            await interaction.delete().catch(() => {});
            statusMsg = await interaction.channel.send(payload);
        }

        const updater = setInterval(async () => {
            try {
                const refreshed = await generateStatusPayload(interaction.guild, client, interval, isCmd);
                isCmd ? await interaction.editReply(refreshed) : await statusMsg.edit(refreshed);
            } catch (err) {
                if ([10008, 50013, 10015].includes(err.code)) clearInterval(updater);
            }
        }, interval * 60 * 1000);
    }
}
