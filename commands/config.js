import { generateConfigPayload } from '../utils/configUI.js';
import { SlashCommandBuilder, PermissionFlagsBits, MessageFlags } from 'discord.js';
import GuildConfig from '../models/GuildConfig.js';

export default {
    name: 'config',
    description: 'Manage server settings via an interactive dashboard.',
    data: new SlashCommandBuilder()
        .setName('config')
        .setDescription('Manage server settings via an interactive dashboard.')
        .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),

    async execute(message, args, client) {
        const isInteraction = message.commandName !== undefined;
        const guild = message.guild;
        const author = isInteraction ? message.user : message.author;
        const guildId = guild.id;

        let config = await GuildConfig.findOne({ guildId });
        if (!config) config = new GuildConfig({ guildId });

        let messageData = await generateConfigPayload(
            'config_page_main',
            config,
            guild,
            author,
            isInteraction
        );

        messageData = {
            flags: MessageFlags.IsComponentsV2,
            ...messageData,
        };

        if (isInteraction) {
            return message.reply({
                ...messageData,
                fetchReply: true
            });
        } else {
            return message.reply(messageData);
        }
    }
};