import { createTextContainer } from '../utils/modUtils.js';
import { PermissionFlagsBits, SlashCommandBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } from 'discord.js';
import Infraction from '../models/Infraction.js';
import GuildConfig from '../models/GuildConfig.js';

export default {
    name: 'infraction',
    aliases: ['infractions', 'history', 'inf'],
    description: 'Manage user infractions with cases and moderation tools.',
    data: new SlashCommandBuilder()
        .setName('infraction')
        .setDescription('Manage user infractions.')
        .addSubcommand(subcommand =>
            subcommand
                .setName('issue')
                .setDescription('Issue a new infraction to a user.')
                .addUserOption(option => option.setName('user').setDescription('The user to infract').setRequired(true))
                .addStringOption(option => 
                    option.setName('type')
                        .setDescription('The type of infraction')
                        .setRequired(true)
                        .addChoices(
                            { name: 'Strike', value: 'Strike' },
                            { name: 'Verbal Strike', value: 'Verbal Strike' },
                            { name: 'Demotion', value: 'Demotion' },
                            { name: 'Termination', value: 'Termination' },
                            { name: 'Staff Blacklist', value: 'Staff Blacklist' }
                        ))
                .addStringOption(option =>
                    option.setName('appealable')
                        .setDescription('Is this infraction appealable?')
                        .setRequired(true)
                        .addChoices(
                            { name: 'Yes', value: 'yes' },
                            { name: 'No', value: 'no' }
                        ))
                .addStringOption(option => option.setName('reason').setDescription('The reason for the infraction')))
        .addSubcommand(subcommand =>
            subcommand
                .setName('case')
                .setDescription('View and manage a specific infraction case.')
                .addIntegerOption(option => option.setName('id').setDescription('The Case ID (e.g., 1, 2, 3)').setRequired(true)))
        .addSubcommand(subcommand =>
            subcommand
                .setName('list')
                .setDescription('List all infractions for a user.')
                .addUserOption(option => option.setName('user').setDescription('The user to view history for').setRequired(true))),
    async execute(message, args, client) {
        const isInteraction = message.commandName !== undefined;
        const guild = message.guild;
        const member = message.member;
        const author = isInteraction ? message.user : message.author;

        if (!member.permissions.has(PermissionFlagsBits.ManageMessages)) {
            const content = '<:deny:1493679796281020426> You do not have permission to manage infractions.';
            return isInteraction ? message.reply(createTextContainer(content, true)) : message.reply(createTextContainer(content));
        }

        let subCommand = isInteraction ? message.options.getSubcommand() : args[0]?.toLowerCase();

        // Default logic for legacy commands (!infractions, !history, or omitted subcommand)
        if (!isInteraction && !['issue', 'add', 'case', 'list', 'history'].includes(subCommand)) {
            subCommand = 'list';
        }

        let config = await GuildConfig.findOne({ guildId: guild.id });
        if (!config) config = new GuildConfig({ guildId: guild.id });

        if (subCommand === 'issue' || subCommand === 'add') {
            let targetUser, type, isAppealable, reason;

            if (isInteraction) {
                targetUser = message.options.getUser('user');
                type = message.options.getString('type');
                isAppealable = message.options.getString('appealable') === 'yes';
                reason = message.options.getString('reason') || 'No reason provided';
            } else {
                targetUser = message.mentions.users.first() || await client.users.fetch(args[1]).catch(() => null);
                if (!targetUser) return message.reply(createTextContainer('<:deny:1493679796281020426> Please mention a valid user.'));
                type = args[2] || 'Warning';
                const appealArg = args[3]?.toLowerCase();
                isAppealable = appealArg === 'yes' || appealArg === 'y';
                reason = args.slice(4).join(' ') || 'No reason provided';
            }

            // Get next Case ID
            const lastInfraction = await Infraction.findOne({ guildId: guild.id }).sort({ caseId: -1 });
            const nextCaseId = (lastInfraction?.caseId || 0) + 1;

            const logChannelId = config.channels.infractionLog;
            if (!logChannelId) {
                const errorContent = `<:deny:1493679796281020426> Infraction log channel is not set up! Please use \`/config set-channel\` first.`;
                return isInteraction ? message.reply(createTextContainer(errorContent, true)) : message.reply(createTextContainer(errorContent));
            }

            const logChannel = await guild.channels.fetch(logChannelId).catch(() => null);
            if (!logChannel) {
                const errorContent = `<:deny:1493679796281020426> Log channel <#${logChannelId}> not found.`;
                return isInteraction ? message.reply(createTextContainer(errorContent, true)) : message.reply(createTextContainer(errorContent));
            }

            const infCfg = config.customEmbeds?.infraction || { title: 'Smorii Systems Infraction' };
            const textContent = `<:smorii:1493679842229616702> **| ${infCfg.title}**\n` +
                                `**Name:** <@${targetUser.id}>\n` +
                                `**Type:** ${type}\n` +
                                `**Reason:** ${reason}\n` +
                                `**Appealable:** ${isAppealable ? 'Yes' : 'No'}`;
            const signatureContent = `**Thank you,**\n<:file:1493679783505301676> | *Signed,*\n<:smorii:1493679842229616702> **High Rank**\n> Case ID: #${nextCaseId}`;

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
                            { type: 12, items: [{ media: { url: config.images.infractionBanner } }] }
                        ]
                    },
                    new ActionRowBuilder().addComponents(
                        new ButtonBuilder()
                            .setCustomId(`view_executioner_${nextCaseId}`)
                            .setLabel('View Executioner')
                            .setEmoji('<:star:1493679798008938701>')
                            .setStyle(ButtonStyle.Secondary)
                    ).toJSON()
                ]
            };

            const response = await logChannel.send(messageData);

            if (isInteraction) {
                await message.reply(createTextContainer(`<:accept:1493679794879987852> Infraction issued successfully in <#${logChannelId}>.`, true));
            } else {
                await message.channel.send(createTextContainer(`<:accept:1493679794879987852> Infraction issued successfully in <#${logChannelId}>.`));
            }

            const newInfraction = new Infraction({
                caseId: nextCaseId,
                userId: targetUser.id,
                staffId: author.id,
                guildId: guild.id,
                messageId: response.id,
                channelId: response.channelId,
                reason: reason,
                type: type,
                isAppealable: isAppealable,
                timestamp: new Date()
            });

            await newInfraction.save();
            return;
        }

        if (subCommand === 'case') {
            const caseId = isInteraction ? message.options.getInteger('id') : parseInt(args[1]);
            if (isNaN(caseId)) return isInteraction ? message.reply(createTextContainer('Please provide a valid Case ID.', true)) : message.reply(createTextContainer('Please provide a valid Case ID.'));

            const inf = await Infraction.findOne({ caseId, guildId: guild.id });
            if (!inf) return isInteraction ? message.reply(createTextContainer(`Case #${caseId} not found.`, true)) : message.reply(createTextContainer(`Case #${caseId} not found.`));

            const user = await client.users.fetch(inf.userId).catch(() => ({ tag: 'Unknown User', id: inf.userId }));
            const staff = await client.users.fetch(inf.staffId).catch(() => ({ tag: 'Unknown Staff' }));

            const textContent = `<:smorii:1493679842229616702> **| Smorii Systems Infraction Case #${inf.caseId}**\n` +
                                `**User:** <@${inf.userId}> (${user.tag})\n` +
                                `**Type:** ${inf.type}\n` +
                                `**Reason:** ${inf.reason}\n` +
                                `**Appealable:** ${inf.isAppealable ? 'Yes' : 'No'}\n` +
                                `**Status:** ${inf.isVoided ? `<:deny:1493679796281020426> Voided (${inf.voidReason})` : '<:accept:1493679794879987852> Active'}\n` +
                                `**Issued By:** <@${inf.staffId}> (${staff.tag})\n` +
                                `**Timestamp:** <t:${Math.floor(inf.timestamp.getTime() / 1000)}:F>`;

            const messageData = {
                flags: 32768,
                components: [
                    {
                        type: 17,
                        components: [
                            { type: 10, content: textContent }
                        ]
                    },
                    new ActionRowBuilder().addComponents(
                        new ButtonBuilder()
                            .setCustomId(`void_infraction_${inf.caseId}`)
                            .setLabel('Void Case')
                            .setEmoji('<:wrench:1493679827960598710>')  
                            .setStyle(ButtonStyle.Danger)
                            .setDisabled(inf.isVoided),
                        new ButtonBuilder()
                            .setCustomId(`edit_infraction_${inf.caseId}`)
                            .setLabel('Edit Case')
                            .setEmoji('<:settings:1493679803143028766>')
                            .setStyle(ButtonStyle.Secondary)
                            .setDisabled(inf.isVoided)
                    ).toJSON()
                ]
            };

            if (isInteraction) {
                return message.reply(messageData);
            } else {
                const { flags, ephemeral, ...prefixMessageData } = messageData;
                return message.reply(prefixMessageData);
            }
        }

        if (subCommand === 'list' || subCommand === 'history') {
            const targetUser = isInteraction 
                ? message.options.getUser('user') 
                : (message.mentions.users.first() || 
                   (args[0] === 'list' || args[0] === 'history' ? await client.users.fetch(args[1]).catch(() => null) : await client.users.fetch(args[0]).catch(() => null)) ||
                   author);

            if (!targetUser) return isInteraction ? message.reply(createTextContainer('<:deny:1493679796281020426> Please mention a valid user.', true)) : message.reply(createTextContainer('<:deny:1493679796281020426> Please mention a valid user.'));

            const infractions = await Infraction.find({ userId: targetUser.id, guildId: guild.id }).sort({ caseId: -1 });

            if (infractions.length === 0) {
                return isInteraction ? message.reply(createTextContainer(`**${targetUser.tag}** has no recorded infractions.`, true)) : message.reply(createTextContainer(`**${targetUser.tag}** has no recorded infractions.`));
            }

            const listText = infractions.map((inf) => {
                const statusEmoji = inf.isVoided ? '<:deny:1493679796281020426>' : '<:accept:1493679794879987852>';
                const jumpLink = (inf.messageId && inf.channelId) ? `[Jump to message](https://discord.com/channels/${guild.id}/${inf.channelId}/${inf.messageId})` : '*Original message missing*';
                return `**Case #${inf.caseId}** ${statusEmoji}\n> **Type:** ${inf.type}\n> **Reason:** \`${inf.reason}\`\n> **Link:** ${jumpLink}`;
            }).join('\n\n').slice(0, 4000);

            const textContent = `<:folderoutline:1493679785002537131> **| Smorii Systems Infraction History: ${targetUser.tag}**\n\n` + listText;

            const messageData = {
                flags: 32768,
                components: [
                    {
                        type: 17,
                        components: [
                            { type: 10, content: textContent },
                            { type: 12, items: [{ media: { url: config.images.historyImage } }] }
                        ]
                    }
                ]
            };

            if (isInteraction) {
                return message.reply(messageData);
            } else {
                const { flags, ephemeral, ...prefixMessageData } = messageData;
                return message.reply(prefixMessageData);
            }
        }
    },
};
