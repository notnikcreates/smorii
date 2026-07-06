import { createTextContainer } from '../utils/modUtils.js';
import GuildConfig from '../models/GuildConfig.js';
import { PermissionFlagsBits } from 'discord.js';

export default {
    name: 'messageCreate',
    once: false,

    async execute(message, client) {
        // Ignore bot messages and messages outside of guilds
        if (message.author.bot || !message.guild) return;

        // Check for prefix
        if (!message.content.startsWith(client.prefix)) return;

        // Parse command name and args
        const args = message.content.slice(client.prefix.length).trim().split(/\s+/);
        const commandName = args.shift().toLowerCase();

        // Look up command
        const command = client.commands.get(commandName) || client.commands.find(cmd => cmd.aliases?.includes(commandName));
        if (!command) return;

        // Restricted access check (Mirroring interactionCreate logic)
        try {
            let config = await GuildConfig.findOne({ guildId: message.guild.id });
            if (!config) config = new GuildConfig({ guildId: message.guild.id });

            const REQUIRED_ROLE_ID = config.roles?.hrRole;
            const isDev = message.author.id === '1347129007321387068';
            
            // Allow 'membercount' and 'config' to bypass standard HR check if needed (they have their own checks or are public)
            // But we check for HR role for everything else
            const bypassCommands = ['membercount', 'config'];
            
            if (!bypassCommands.includes(command.name) && !isDev) {
                if (!REQUIRED_ROLE_ID || !message.member.roles.cache.has(REQUIRED_ROLE_ID)) {
                     // Check if they are administrator as a fallback
                     if (!message.member.permissions.has(PermissionFlagsBits.Administrator)) {
                        return message.reply(createTextContainer('<:deny:1493679796281020426> You do not have permission to use this command.'));
                     }
                }
            }
        } catch (err) {
            console.error('Error in messageCreate access check:', err);
            return;
        }

        // Run the command
        try {
            await command.execute(message, args, client);
        } catch (err) {
            console.error(`✖ Error executing prefix command "${commandName}":`, err);
            try {
                await message.reply(createTextContainer('<:deny:1493679796281020426> Something went wrong while running that command!'));
            } catch {
                // Ignore reply failures
            }
        }
    },
};