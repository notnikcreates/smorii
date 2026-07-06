import { createTextContainer } from '../utils/modUtils.js';
import { SlashCommandBuilder, PermissionFlagsBits, ActionRowBuilder, ButtonBuilder, ButtonStyle } from 'discord.js';
import HRCase from '../models/HRCase.js';
import GuildConfig from '../models/GuildConfig.js';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export default {
    name: 'hr',
    description: 'High Rank management commands.',
    data: new SlashCommandBuilder()
        .setName('hr')
        .setDescription('High Rank management commands.')
        .addSubcommandGroup(group => 
            group.setName('case')
                .setDescription('Manage HR cases.')
                .addSubcommand(subcommand =>
                    subcommand
                        .setName('create')
                        .setDescription('Create a new HR case.')
                        .addUserOption(option => option.setName('user').setDescription('The user the case is about').setRequired(true))
                        .addStringOption(option => option.setName('reason').setDescription('The reason for the case').setRequired(true))
                        .addStringOption(option => option.setName('notes').setDescription('Additional notes for the case').setRequired(true))
                        .addUserOption(option => option.setName('reportedby').setDescription('The user who reported this').setRequired(true))
                        .addAttachmentOption(option => option.setName('proof').setDescription('Optional proof attachment').setRequired(false)))
                .addSubcommand(subcommand =>
                    subcommand
                        .setName('manage')
                        .setDescription('Manage a specific HR case.')
                        .addIntegerOption(option => option.setName('id').setDescription('The Case ID').setRequired(true)))),

    async execute(message, args, client) {
        const isInteraction = message.commandName !== undefined;
        const guild = message.guild;
        const member = message.member;
        const author = isInteraction ? message.user : message.author;

        let config = await GuildConfig.findOne({ guildId: guild.id });
        if (!config) config = new GuildConfig({ guildId: guild.id });

        const HR_ROLE_ID = config.roles.hrRole;

        // Check for HR Role or Manage Server permissions
        if ((!HR_ROLE_ID || !member.roles.cache.has(HR_ROLE_ID)) && !member.permissions.has(PermissionFlagsBits.ManageGuild)) {
            const content = '<:deny:1493679796281020426> You do not have permission to use HR commands.';
            return isInteraction ? message.reply(createTextContainer(content, true)) : message.reply(createTextContainer(content));
        }

        const subCommand = isInteraction ? message.options.getSubcommand() : args[1]?.toLowerCase();
        const subGroup = isInteraction ? message.options.getSubcommandGroup() : args[0]?.toLowerCase();

        if (subGroup === 'case') {
            if (subCommand === 'create') {
                const targetUser = isInteraction ? message.options.getUser('user') : (message.mentions.users.first() || await client.users.fetch(args[2]).catch(() => null));
                const reason = isInteraction ? message.options.getString('reason') : args[3];
                const notes = isInteraction ? message.options.getString('notes') : args[4];
                const reportedBy = isInteraction ? message.options.getUser('reportedby') : (message.mentions.users.at(1) || await client.users.fetch(args[5]).catch(() => null));
                const attachment = isInteraction ? message.options.getAttachment('proof') : (message.attachments.first() || null);

                if (!targetUser) return isInteraction ? message.reply(createTextContainer('<:deny:1493679796281020426> Invalid user.', true)) : message.reply(createTextContainer('<:deny:1493679796281020426> Invalid user.'));
                if (!reason) return isInteraction ? message.reply(createTextContainer('<:deny:1493679796281020426> Please provide a reason.', true)) : message.reply(createTextContainer('<:deny:1493679796281020426> Please provide a reason.'));
                if (!notes) return isInteraction ? message.reply(createTextContainer('<:deny:1493679796281020426> Please provide notes.', true)) : message.reply(createTextContainer('<:deny:1493679796281020426> Please provide notes.'));
                if (!reportedBy) return isInteraction ? message.reply(createTextContainer('<:deny:1493679796281020426> Please provide who reported this.', true)) : message.reply(createTextContainer('<:deny:1493679796281020426> Please provide who reported this.'));

                const hrLogChannelId = config.channels.hrLog;
                if (!hrLogChannelId) {
                    const errorContent = `<:deny:1493679796281020426> HR log channel is not set! Use \`/config set-channel\` first.`;
                    return isInteraction ? message.reply(createTextContainer(errorContent, true)) : message.reply(createTextContainer(errorContent));
                }

                const logChannel = await guild.channels.fetch(hrLogChannelId).catch(() => null);
                if (!logChannel) {
                    const errorContent = `<:deny:1493679796281020426> HR log channel <#${hrLogChannelId}> not found.`;
                    return isInteraction ? message.reply(createTextContainer(errorContent, true)) : message.reply(createTextContainer(errorContent));
                }

                // Get next Case ID
                const lastCase = await HRCase.findOne({ guildId: guild.id }).sort({ caseId: -1 });
                const nextCaseId = (lastCase?.caseId || 0) + 1;

                // Create Case record
                const newCase = new HRCase({
                    guildId: guild.id,
                    caseId: nextCaseId,
                    issuerId: author.id,
                    targetId: targetUser.id,
                    reportedById: reportedBy.id,
                    reason: reason,
                    notes: notes,
                    proofUrl: attachment?.url || null,
                    status: 'Pending'
                });

                await newCase.save();

                const hrCfg = config.customEmbeds?.hr || { title: 'Smorii Systems HR Case' };
                const textContent = `<:smorii:1493679842229616702> **| ${hrCfg.title} #${nextCaseId}**\n` +
                                    `**Target:** <@${targetUser.id}> (${targetUser.tag})\n` +
                                    `**Issuer:** <@${author.id}>\n` +
                                    `**Reported By:** <@${reportedBy.id}>\n` +
                                    `**Reason:** ${reason}\n` +
                                    `**Notes:** ${notes}\n` +
                                    `**Status:** <:deny:1493679796281020426> Pending`;

                const components = [
                    { type: 10, content: textContent }
                ];

                if (attachment) {
                    components.push({ type: 14, spacing: 2, divider: true });
                    components.push({ type: 12, items: [{ media: { url: attachment.url } }] });
                }

                const logMessageData = {
                    flags: 32768,
                    components: [
                        {
                            type: 17,
                            components: components
                        }
                    ]
                };

                let logMsg;
                if (logChannel) {
                    // Try to create thread if it's a forum channel. Otherwise send normally.
                    if (logChannel.type === 15 || logChannel.isThreadOnly()) {
                        const thread = await logChannel.threads.create({
                            name: `Case #${nextCaseId} - ${targetUser.tag}`,
                            message: logMessageData
                        }).catch(err => {
                            console.error("Failed to create forum thread:", err);
                            return null;
                        });

                        if (thread) {
                            newCase.forumThreadId = thread.id;
                            logMsg = await thread.messages.fetch(thread.id).catch(() => null); // gets starter message
                        }
                    } else {
                        logMsg = await logChannel.send(logMessageData);
                    }
                    if (logMsg) {
                        newCase.messageId = logMsg.id;
                        newCase.channelId = logMsg.channelId;
                    }
                }

                await newCase.save();

                // Send confirmation container
                const confirmationText = `<:accept:1493679794879987852> **Case created successfully.**\n` +
                                         `Case ${nextCaseId} has been created successfully.\n` +
                                         `View it [here.](${logMsg?.url || 'Channel not configured'})`;

                const confirmData = {
                    flags: 32768,
                    components: [
                        {
                            type: 17,
                            components: [
                                { type: 10, content: confirmationText }
                            ]
                        }
                    ]
                };

                return isInteraction ? message.reply(confirmData) : message.reply(confirmData);
            }

            if (subCommand === 'manage') {
                const caseId = isInteraction ? message.options.getInteger('id') : parseInt(args[2]);
                if (!caseId) return isInteraction ? message.reply(createTextContainer('<:deny:1493679796281020426> Invalid Case ID.', true)) : message.reply(createTextContainer('<:deny:1493679796281020426> Invalid Case ID.'));

                const hrCase = await HRCase.findOne({ caseId, guildId: guild.id });
                if (!hrCase) return isInteraction ? message.reply(createTextContainer(`<:deny:1493679796281020426> Case #${caseId} not found.`, true)) : message.reply(createTextContainer(`<:deny:1493679796281020426> Case #${caseId} not found.`));

                const targetUser = await client.users.fetch(hrCase.targetId).catch(() => ({ tag: 'Unknown User' }));
                const issuer = await client.users.fetch(hrCase.issuerId).catch(() => ({ tag: 'Unknown User' }));

                const statusEmoji = hrCase.status === 'Accepted' ? '<:accept:1493679794879987852>' : (hrCase.status === 'Denied' ? '<:deny:1493679796281020426>' : '🕒');

                const textContent = `<:smorii:1493679842229616702> **| Smorii Systems HR Case Management #${hrCase.caseId}**\n` +
                                    `**Subject:** <@${hrCase.targetId}> (${targetUser.tag})\n` +
                                    `**Issuer:** <@${hrCase.issuerId}> (${issuer.tag})\n` +
                                    `**Reported By:** <@${hrCase.reportedById}>\n` +
                                    `**Reason:** ${hrCase.reason}\n` +
                                    `**Notes:** ${hrCase.notes}\n` +
                                    `**Status:** ${statusEmoji} ${hrCase.status}\n` +
                                    `**Created:** <t:${Math.floor(hrCase.timestamp.getTime() / 1000)}:F>`;

                const containerComponents = [
                    { type: 10, content: textContent }
                ];

                if (hrCase.proofUrl) {
                    containerComponents.push({ type: 14, spacing: 2, divider: true });
                    containerComponents.push({ type: 12, items: [{ media: { url: hrCase.proofUrl } }] });
                }

                const messageData = {
                    flags: 32768,
                    components: [
                        {
                            type: 17,
                            components: containerComponents
                        },
                        new ActionRowBuilder().addComponents(
                            new ButtonBuilder()
                                .setCustomId(`hr_case_delete_${hrCase.caseId}`)
                                .setLabel('Delete case')
                                .setEmoji('1493679796281020426')
                                .setStyle(ButtonStyle.Danger),
                            new ButtonBuilder()
                                .setCustomId(`hr_case_accept_${hrCase.caseId}`)
                                .setLabel('Case Accept')
                                .setEmoji('1493679794879987852')
                                .setStyle(ButtonStyle.Success)
                                .setDisabled(hrCase.status === 'Accepted'),
                            new ButtonBuilder()
                                .setCustomId(`hr_case_edit_${hrCase.caseId}`)
                                .setLabel('Edit Case')
                                .setEmoji('<:settings:1493679803143028766>')
                                .setStyle(ButtonStyle.Secondary)
                        ).toJSON()
                    ]
                };

                return isInteraction ? message.reply(messageData) : message.channel.send(messageData);
            }
        }
    }
};
