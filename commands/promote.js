import { createTextContainer } from '../utils/modUtils.js';
import { PermissionFlagsBits, SlashCommandBuilder } from 'discord.js';
import Promotion from '../models/Promotion.js';
import GuildConfig from '../models/GuildConfig.js';

export default {
    name: 'promote',
    description: 'Promote a user to a new rank.',
    data: new SlashCommandBuilder()
        .setName('promote')
        .setDescription('Promote a user to a new rank.')
        .addUserOption(option => option.setName('user').setDescription('The user to promote').setRequired(true))
        .addRoleOption(option => option.setName('role').setDescription('The new rank for the user').setRequired(true))
        .addStringOption(option => option.setName('reason').setDescription('The reason for the promotion')),
    async execute(message, args, client) {
        const isInteraction = message.commandName !== undefined;
        const guild = message.guild;
        const member = message.member;
        const author = isInteraction ? message.user : message.author;

        if (!member.permissions.has(PermissionFlagsBits.ManageRoles)) {
            const content = '<:deny:1493679796281020426> You do not have permission to manage promotions.';
            return isInteraction ? message.reply(createTextContainer(content, true)) : message.reply(createTextContainer(content));
        }

        let targetUser, targetRole, reason;

        if (isInteraction) {
            targetUser = message.options.getMember('user');
            targetRole = message.options.getRole('role');
            reason = message.options.getString('reason') || 'Approved by DB';
        } else {
            targetUser = message.mentions.members.first() || guild.members.cache.get(args[0]);
            targetRole = message.mentions.roles.first() || guild.roles.cache.get(args[1]) || guild.roles.cache.find(r => r.name.toLowerCase() === args.slice(1).join(' ').toLowerCase());
            reason = args.slice(2).join(' ') || 'Approved by DB';
        }

        if (!targetUser) {
            const content = '<:deny:1493679796281020426> Please mention a valid user.';
            return isInteraction ? message.reply(createTextContainer(content, true)) : message.reply(createTextContainer(content));
        }

        if (!targetRole) {
            const content = '<:deny:1493679796281020426> Please specify a valid role (mention, ID, or name).';
            return isInteraction ? message.reply(createTextContainer(content, true)) : message.reply(createTextContainer(content));
        }

        const oldRank = targetUser.roles.highest.name;
        
        let config = await GuildConfig.findOne({ guildId: guild.id });
        if (!config) config = new GuildConfig({ guildId: guild.id });

        const PROMOTION_LOG_CHANNEL_ID = config.channels.promotionLog;

        try {
            // Hierarchy Checks
            const botHighestRole = guild.members.me.roles.highest;
            if (targetRole.position >= botHighestRole.position) {
                const content = `<:deny:1493679796281020426> I cannot manage the role **${targetRole.name}** because it is equal to or higher than my own role (**${botHighestRole.name}**) in the hierarchy. Please move my role up!`;
                return isInteraction ? message.reply(createTextContainer(content, true)) : message.reply(createTextContainer(content));
            }

            if (targetRole.position >= member.roles.highest.position && author.id !== guild.ownerId) {
                const content = `<:deny:1493679796281020426> You cannot promote someone to a role equal to or higher than your own!`;
                return isInteraction ? message.reply(createTextContainer(content, true)) : message.reply(createTextContainer(content));
            }

            if (!PROMOTION_LOG_CHANNEL_ID) {
                const content = `<:deny:1493679796281020426> Promotion log channel is not set! Use \`/config set-channel\` first.`;
                return isInteraction ? message.reply(createTextContainer(content, true)) : message.reply(createTextContainer(content));
            }

            // Fetch Log Channel
            const logChannel = await guild.channels.fetch(PROMOTION_LOG_CHANNEL_ID).catch(() => null);
            if (!logChannel) {
                const content = `<:deny:1493679796281020426> Promotion log channel <#${PROMOTION_LOG_CHANNEL_ID}> not found.`;
                return isInteraction ? message.reply(createTextContainer(content, true)) : message.reply(createTextContainer(content));
            }

            // Update Discord Role
            await targetUser.roles.add(targetRole);
            
            // Log to Database
            const promotion = new Promotion({
                userId: targetUser.id,
                staffId: author.id,
                guildId: guild.id,
                oldRank: oldRank,
                newRank: targetRole.name,
                reason: reason,
                timestamp: new Date()
            });
            await promotion.save();

            const oldRole = targetUser.roles.highest;
            const oldRankDisplay = oldRole.id === guild.id ? "None" : `<@&${oldRole.id}>`;

            const promCfg = config.customEmbeds?.promotion || { title: 'Smorii Systems Promotions' };
            const textContent = `<:smorii:1493679842229616702> **| ${promCfg.title}**\n` +
                                `**Name:** <@${targetUser.id}>\n` +
                                `**Old Rank:** ${oldRankDisplay}\n` +
                                `**New Rank:** <@&${targetRole.id}>\n` +
                                `**Reason:** ${reason}`;
                                
            const signatureContent = `**Congratulations,**\n<:tada:1493679786986573965> | *Signed,*\n<@${author.id}>`;

            const messageData = {
                content: `<@${targetUser.id}>`,
                flags: 32768,
                components: [
                    {
                        type: 17,
                        components: [
                            { type: 10, content: textContent },
                            { type: 14, spacing: 2, divider: true },
                            { type: 10, content: signatureContent },
                            { type: 12, items: [{ media: { url: config.images.promotionBanner } }] }
                        ]
                    }
                ]
            };

            await logChannel.send(messageData);

            const confirmation = `<:accept:1493679794879987852> Successfully promoted <@${targetUser.id}> in <#${PROMOTION_LOG_CHANNEL_ID}>.`;
            return isInteraction ? message.reply(createTextContainer(confirmation, true)) : message.channel.send(confirmation);

        } catch (error) {
            console.error("Failed to promote user:", error);
            const content = `<:deny:1493679796281020426> An error occurred: \`${error.message}\`. This is usually due to Discord role hierarchy restrictions.`;
            return isInteraction ? message.reply(createTextContainer(content, true)) : message.reply(createTextContainer(content));
        }
    },
};
