import { createTextContainer } from '../utils/modUtils.js';
import { generateConfigPayload } from '../utils/configUI.js';
import { ActionRowBuilder, ButtonBuilder, ButtonStyle, ModalBuilder, TextInputBuilder, TextInputStyle, PermissionFlagsBits, StringSelectMenuBuilder } from 'discord.js';
import Infraction from '../models/Infraction.js';
import HRCase from '../models/HRCase.js';
import GuildConfig from '../models/GuildConfig.js';

export default {
    name: 'interactionCreate',
    once: false,
    async execute(interaction, client) {
        // Handle Slash Command Interactions
        if (interaction.isChatInputCommand()) {
            const command = client.commands.get(interaction.commandName.toLowerCase());
            if (!command) return;

            // Restricted access check
            let config = await GuildConfig.findOne({ guildId: interaction.guild.id });
            if (!config) config = new GuildConfig({ guildId: interaction.guild.id });

            const REQUIRED_ROLE_ID = config.roles.hrRole;
            const isDev = interaction.user.id === '1347129007321387068';
            
            if (command.name !== 'membercount' && command.name !== 'config' && !isDev && (!interaction.member || !interaction.member.roles.cache.has(REQUIRED_ROLE_ID))) {
                return interaction.reply(createTextContainer('<:deny:1493679796281020426> You do not have permission to use this command.', true));
            }

            try {
                await command.execute(interaction, null, client);
            } catch (error) {
                console.error(`Error executing slash command ${interaction.commandName}:`, error);
                await interaction.reply(createTextContainer('<:deny:1493679796281020426> There was an error while executing this command!', true)).catch(() => {});
            }
        }

        // Handle Select Menu Interactions
        if (interaction.isStringSelectMenu()) {
            const { customId, values, guild } = interaction;

            if (customId === 'config_main_menu') {
                const page = values[0];
                let config = await GuildConfig.findOne({ guildId: guild.id });
                if (!config) config = new GuildConfig({ guildId: guild.id });

                const refreshData = await generateConfigPayload(page, config, guild, interaction.user, true);
                return interaction.update(refreshData);
            }

            if (customId === 'config_embed_select') {
                const page = values[0];
                let config = await GuildConfig.findOne({ guildId: guild.id });
                if (!config) config = new GuildConfig({ guildId: guild.id });

                const refreshData = await generateConfigPayload(page, config, guild, interaction.user, true);
                return interaction.update(refreshData);
            }
        }

        // Handle Button Interactions
        if (interaction.isButton()) {
            const { customId, member, guild } = interaction;
            
            // Dashboard Config Update (Triggers Modal)
            if (customId.startsWith('config_update_')) {
                const field = customId.replace('config_update_', '');
                
                const modal = new ModalBuilder()
                    .setCustomId(`config_modal_${field}`)
                    .setTitle(`Update ${field.split('.').pop()}`)
                    .addComponents(
                        new ActionRowBuilder().addComponents(
                            new TextInputBuilder()
                                .setCustomId('new_value')
                                .setLabel(`Set ${field.split('.').pop()}`)
                                .setStyle(TextInputStyle.Short)
                                .setPlaceholder('Enter ID, URL, or Key...')
                                .setRequired(true)
                        )
                    );
                return interaction.showModal(modal);
            }

            // Dashboard Return Home
            if (customId === 'config_page_main') {
                let config = await GuildConfig.findOne({ guildId: guild.id });
                if (!config) config = new GuildConfig({ guildId: guild.id });
                const refreshData = await generateConfigPayload('config_page_main', config, guild, interaction.user, true);
                return interaction.update(refreshData);
            }

            // Session Role Toggle
            const role = guild.roles.cache.get(customId);
            if (role && (customId.length === 18 || customId.length === 19)) {
                try {
                    if (member.roles.cache.has(customId)) {
                        await member.roles.remove(role);
                        return interaction.reply(createTextContainer('<:wrench:1493679827960598710> You have been removed from the session pings.', true));
                    } else {
                        await member.roles.add(role);
                        return interaction.reply(createTextContainer('<:accept:1493679794879987852> You have successfully opted into session pings!', true));
                    }
                } catch (err) {
                    return interaction.reply(createTextContainer('<:deny:1493679796281020426> Failed to update roles.', true));
                }
            }

            // View Executioner
            if (customId.startsWith('view_executioner_')) {
                const caseId = parseInt(customId.split('_').pop());
                let config = await GuildConfig.findOne({ guildId: guild.id });
                if (!config) config = new GuildConfig({ guildId: guild.id });
                
                const hrRole = config.roles.hrRole;

                if (!hrRole || (!member.roles.cache.has(hrRole) && !member.permissions.has(PermissionFlagsBits.Administrator))) {
                    return interaction.reply(createTextContainer('<:deny:1493679796281020426> Only High Ranks can view the executioner.', true));
                }

                const inf = await Infraction.findOne({ caseId, guildId: guild.id });
                if (!inf) return interaction.reply(createTextContainer('<:deny:1493679796281020426> Case not found.', true));

                const staff = await client.users.fetch(inf.staffId).catch(() => ({ tag: 'Unknown' }));
                return interaction.reply(createTextContainer(`**Case #${caseId} Executioner:** <@${inf.staffId}> (${staff.tag})`, true));
            }

            // Void Infraction Button -> Open Modal
            if (customId.startsWith('void_infraction_')) {
                const caseId = customId.split('_').pop();
                const modal = new ModalBuilder()
                    .setCustomId(`void_modal_${caseId}`)
                    .setTitle(`Void Case #${caseId}`)
                    .addComponents(
                        new ActionRowBuilder().addComponents(
                            new TextInputBuilder()
                                .setCustomId('reason')
                                .setLabel('Reason for voiding')
                                .setStyle(TextInputStyle.Paragraph)
                                .setPlaceholder('Explain why this infraction is being voided...')
                                .setRequired(true)
                        )
                    );
                return interaction.showModal(modal);
            }

            // Edit Infraction Button -> Open Modal
            if (customId.startsWith('edit_infraction_')) {
                const caseId = parseInt(customId.split('_').pop());
                const inf = await Infraction.findOne({ caseId, guildId: guild.id });
                if (!inf) return interaction.reply(createTextContainer('<:deny:1493679796281020426> Case not found.', true));

                const modal = new ModalBuilder()
                    .setCustomId(`edit_modal_${caseId}`)
                    .setTitle(`Edit Case #${caseId}`)
                    .addComponents(
                        new ActionRowBuilder().addComponents(
                            new TextInputBuilder()
                                .setCustomId('type')
                                .setLabel('Infraction Type')
                                .setStyle(TextInputStyle.Short)
                                .setValue(inf.type)
                                .setRequired(true)
                        ),
                        new ActionRowBuilder().addComponents(
                            new TextInputBuilder()
                                .setCustomId('reason')
                                .setLabel('Reason')
                                .setStyle(TextInputStyle.Paragraph)
                                .setValue(inf.reason)
                                .setRequired(true)
                        ),
                        new ActionRowBuilder().addComponents(
                            new TextInputBuilder()
                                .setCustomId('appealable')
                                .setLabel('Appealable? (Yes/No)')
                                .setStyle(TextInputStyle.Short)
                                .setValue(inf.isAppealable ? 'Yes' : 'No')
                                .setRequired(true)
                        )
                    );
                return interaction.showModal(modal);
            }

            // HR CASE BUTTONS
            if (customId.startsWith('hr_case_')) {
                let config = await GuildConfig.findOne({ guildId: guild.id });
                if (!config) config = new GuildConfig({ guildId: guild.id });

                const hrRole = config.roles.hrRole;

                if (!hrRole || (!member.roles.cache.has(hrRole) && !member.permissions.has(PermissionFlagsBits.ManageGuild))) {
                    return interaction.reply(createTextContainer('<:deny:1493679796281020426> You do not have permission to manage HR cases.', true));
                }

                const action = customId.split('_')[2];
                const caseId = parseInt(customId.split('_')[3]);
                const hrCase = await HRCase.findOne({ caseId, guildId: guild.id });

                if (!hrCase) return interaction.reply(createTextContainer('<:deny:1493679796281020426> Case not found.', true));

                if (action === 'delete') {
                    // Delete from DB
                    await HRCase.deleteOne({ _id: hrCase._id });

                    // Try to delete log message
                    if (hrCase.channelId && hrCase.messageId) {
                        const channel = await guild.channels.fetch(hrCase.channelId).catch(() => null);
                        if (channel) {
                            const msg = await channel.messages.fetch(hrCase.messageId).catch(() => null);
                            if (msg) await msg.delete().catch(() => {});
                        }
                    }

                    return interaction.update({
                        flags: 32768,
                        components: [
                            {
                                type: 17,
                                components: [{ type: 10, content: `<:accept:1493679794879987852> Case #${caseId} has been deleted.` }]
                            }
                        ],
                        embeds: []
                    });
                }

                if (action === 'accept') {
                    if (hrCase.status === 'Accepted') return interaction.reply(createTextContainer('<:deny:1493679796281020426> Case is already accepted.', true));

                    hrCase.status = 'Accepted';
                    await hrCase.save();

                    const targetUser = await client.users.fetch(hrCase.targetId).catch(() => ({ tag: 'Unknown User' }));
                    const textContent = `<:smorii:1493679842229616702> **| Smorii Systems HR Case #${caseId} UPDATED**\n` +
                                        `**Target:** <@${hrCase.targetId}> (${targetUser.tag})\n` +
                                        `**Issuer:** <@${hrCase.issuerId}>\n` +
                                        `**Reported By:** <@${hrCase.reportedById}>\n` +
                                        `**Reason:** ${hrCase.reason}\n` +
                                        `**Notes:** ${hrCase.notes}\n` +
                                        `**Status:** <:accept:1493679794879987852> Accepted (Updated by <@${interaction.user.id}>)`;

                    const componentsPayload = [{ type: 10, content: textContent }];
                    if (hrCase.proofUrl) {
                        componentsPayload.push({ type: 14, spacing: 2, divider: true });
                        componentsPayload.push({ type: 12, items: [{ media: { url: hrCase.proofUrl } }] });
                    }

                    const messageData = {
                        flags: 32768,
                        components: [{ type: 17, components: componentsPayload }]
                    };

                    // Update Forum Thread
                    const hrLogChannelId = config.channels.hrLog;
                    const logChannel = hrLogChannelId ? await guild.channels.fetch(hrLogChannelId).catch(() => null) : null;
                    
                    if (logChannel) {
                        if (hrCase.forumThreadId) {
                            const thread = await logChannel.threads.fetch(hrCase.forumThreadId).catch(() => null);
                            if (thread) {
                                await thread.send({ 
                                    flags: 32768,
                                    components: messageData.components
                                });
                            }
                        } else if (logChannel.isThreadOnly()) {
                            // Fallback
                            const thread = await logChannel.threads.create({
                                name: `Case #${caseId} - ${targetUser.tag}`,
                                message: messageData
                            }).catch(() => null);

                            if (thread) {
                                hrCase.forumThreadId = thread.id;
                                await hrCase.save();
                            }
                        }
                    }

                    // Update log message
                    if (hrCase.channelId && hrCase.messageId) {
                        const channel = await guild.channels.fetch(hrCase.channelId).catch(() => null);
                        if (channel) {
                            const msg = await channel.messages.fetch(hrCase.messageId).catch(() => null);
                            if (msg) {
                                await msg.edit(messageData);
                            }
                        }
                    }

                    // Update interaction message
                    const updatedRow = ActionRowBuilder.from(interaction.message.components[1]);
                    updatedRow.components[1].setDisabled(true);

                    return interaction.update({ ...messageData, components: [...messageData.components, updatedRow.toJSON()] });
                }

                if (action === 'edit') {
                    const modal = new ModalBuilder()
                        .setCustomId(`hr_edit_modal_${caseId}`)
                        .setTitle(`Edit HR Case #${caseId}`)
                        .addComponents(
                            new ActionRowBuilder().addComponents(
                                new TextInputBuilder()
                                    .setCustomId('reason')
                                    .setLabel('Reason')
                                    .setStyle(TextInputStyle.Paragraph)
                                    .setValue(hrCase.reason)
                                    .setRequired(true)
                            )
                        );
                    return interaction.showModal(modal);
                }
            }
        }

        // Handle Modal Submissions
        if (interaction.isModalSubmit()) {
            const { customId, guild, member } = interaction;

            // VOID MODAL SUBMIT
            if (customId.startsWith('void_modal_')) {
                const caseId = parseInt(customId.split('_').pop());
                const reason = interaction.fields.getTextInputValue('reason');

                const inf = await Infraction.findOne({ caseId, guildId: guild.id });
                if (!inf) return interaction.reply(createTextContainer('<:deny:1493679796281020426> Case not found.', true));

                inf.isVoided = true;
                inf.voidReason = reason;
                inf.voidBy = member.id;
                await inf.save();

                // Generate new container payload
                const user = await client.users.fetch(inf.userId).catch(() => ({ tag: 'Unknown User' }));
                const staffUser = await client.users.fetch(inf.staffId).catch(() => ({ tag: 'Unknown Staff' }));

                if (inf.messageId && inf.channelId) {
                    const channel = await guild.channels.fetch(inf.channelId).catch(() => null);
                    if (channel) {
                        const originalMsg = await channel.messages.fetch(inf.messageId).catch(() => null);
                        if (originalMsg) {
                            const updatedText = `<:smorii:1493679842229616702> **| Smorii Systems Infraction Case #${inf.caseId}**\n` +
                                                `**User:** <@${inf.userId}> (${user.tag})\n` +
                                                `**Type:** ${inf.type}\n` +
                                                `**Reason:** ${inf.reason}\n` +
                                                `**Appealable:** ${inf.isAppealable ? 'Yes' : 'No'}\n` +
                                                `**Status:** <:deny:1493679796281020426> Voided (${inf.voidReason})\n` +
                                                `**Issued By:** <@${inf.staffId}> (${staffUser.tag})\n` +
                                                `**Timestamp:** <t:${Math.floor(inf.timestamp.getTime() / 1000)}:F>`;
                                                
                            const messageData = {
                                flags: 32768,
                                components: [
                                    {
                                        type: 17,
                                        components: [{ type: 10, content: updatedText }]
                                    },
                                    new ActionRowBuilder().addComponents(
                                        new ButtonBuilder()
                                            .setCustomId(`void_infraction_${inf.caseId}`)
                                            .setLabel('Void Case')
                                            .setEmoji('<:wrench:1493679827960598710>')  
                                            .setStyle(ButtonStyle.Danger)
                                            .setDisabled(true),
                                        new ButtonBuilder()
                                            .setCustomId(`edit_infraction_${inf.caseId}`)
                                            .setLabel('Edit Case')
                                            .setEmoji('<:settings:1493679803143028766>')
                                            .setStyle(ButtonStyle.Secondary)
                                            .setDisabled(true)
                                    ).toJSON()
                                ]
                            };

                            await originalMsg.edit(messageData);
                            await originalMsg.reply(createTextContainer(`<:wrench:1493679827960598710> Infraction Voided for ${reason}`));
                        }
                    }
                }

                return interaction.reply(createTextContainer(`<:accept:1493679794879987852> Case #${caseId} successfully voided.`, true));
            }

            // EDIT MODAL SUBMIT
            if (customId.startsWith('edit_modal_')) {
                const caseId = parseInt(customId.split('_').pop());
                const newType = interaction.fields.getTextInputValue('type');
                const newReason = interaction.fields.getTextInputValue('reason');
                const newAppeal = interaction.fields.getTextInputValue('appealable').toLowerCase() === 'yes';

                const inf = await Infraction.findOne({ caseId, guildId: guild.id });
                if (!inf) return interaction.reply(createTextContainer('<:deny:1493679796281020426> Case not found.', true));

                inf.type = newType;
                inf.reason = newReason;
                inf.isAppealable = newAppeal;
                await inf.save();

                const user = await client.users.fetch(inf.userId).catch(() => ({ tag: 'Unknown User' }));
                const staffUser = await client.users.fetch(inf.staffId).catch(() => ({ tag: 'Unknown Staff' }));

                if (inf.messageId && inf.channelId) {
                    const channel = await guild.channels.fetch(inf.channelId).catch(() => null);
                    if (channel) {
                        const originalMsg = await channel.messages.fetch(inf.messageId).catch(() => null);
                        if (originalMsg) {
                            const updatedText = `<:smorii:1493679842229616702> **| Smorii Systems Infraction Case #${inf.caseId}**\n` +
                                                `**User:** <@${inf.userId}> (${user.tag})\n` +
                                                `**Type:** ${inf.type}\n` +
                                                `**Reason:** ${inf.reason}\n` +
                                                `**Appealable:** ${inf.isAppealable ? 'Yes' : 'No'}\n` +
                                                `**Status:** ${inf.isVoided ? `<:deny:1493679796281020426> Voided (${inf.voidReason})` : '<:accept:1493679794879987852> Active'}\n` +
                                                `**Issued By:** <@${inf.staffId}> (${staffUser.tag})\n` +
                                                `**Timestamp:** <t:${Math.floor(inf.timestamp.getTime() / 1000)}:F>`;
                                                
                            const messageData = {
                                flags: 32768,
                                components: [
                                    {
                                        type: 17,
                                        components: [{ type: 10, content: updatedText }]
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

                            await originalMsg.edit(messageData);
                        }
                    }
                }

                return interaction.reply(createTextContainer(`<:accept:1493679794879987852> Case #${caseId} updated successfully.`, true));
            }

            // HR EDIT MODAL SUBMIT
            if (customId.startsWith('hr_edit_modal_')) {
                const caseId = parseInt(customId.split('_').pop());
                const newReason = interaction.fields.getTextInputValue('reason');

                const hrCase = await HRCase.findOne({ caseId, guildId: guild.id });
                if (!hrCase) return interaction.reply(createTextContainer('<:deny:1493679796281020426> Case not found.', true));

                hrCase.reason = newReason;
                await hrCase.save();

                // Update log message
                if (hrCase.channelId && hrCase.messageId) {
                    const channel = await guild.channels.fetch(hrCase.channelId).catch(() => null);
                    if (channel) {
                        const msg = await channel.messages.fetch(hrCase.messageId).catch(() => null);
                        if (msg) {
                            const targetUser = await client.users.fetch(hrCase.targetId).catch(() => ({ tag: 'Unknown User' }));
                            
                            const textContent = `<:smorii:1493679842229616702> **| Smorii Systems HR Case #${caseId} UPDATED**\n` +
                                                `**Target:** <@${hrCase.targetId}> (${targetUser.tag})\n` +
                                                `**Issuer:** <@${hrCase.issuerId}>\n` +
                                                `**Reported By:** <@${hrCase.reportedById}>\n` +
                                                `**Reason:** ${hrCase.reason}\n` +
                                                `**Notes:** ${hrCase.notes}\n` +
                                                `**Status:** ${hrCase.status === 'Accepted' ? '<:accept:1493679794879987852> Accepted' : '<:deny:1493679796281020426> Pending'}`;

                            const componentsPayload = [{ type: 10, content: textContent }];
                            if (hrCase.proofUrl) {
                                componentsPayload.push({ type: 14, spacing: 2, divider: true });
                                componentsPayload.push({ type: 12, items: [{ media: { url: hrCase.proofUrl } }] });
                            }

                            const messageData = {
                                flags: 32768,
                                components: [{ type: 17, components: componentsPayload }]
                            };
                            
                            // Keep action row if it's the management message that has buttons
                            let finalComponents = messageData.components;
                            if (msg.components && msg.components.length > 1) {
                                finalComponents = [
                                    messageData.components[0],
                                    msg.components[1] // The row of buttons
                                ];
                            }
                            
                            await msg.edit({ flags: 32768, components: finalComponents });
                        }
                    }
                }

                return interaction.reply(createTextContainer(`<:accept:1493679794879987852> HR Case #${caseId} updated successfully.`, true));
            }

            // CONFIG MODAL SUBMIT
            if (customId.startsWith('config_modal_')) {
                const path = customId.replace('config_modal_', ''); // e.g. "channels.infractionLog"
                const newValue = interaction.fields.getTextInputValue('new_value');

                let config = await GuildConfig.findOne({ guildId: guild.id });
                if (!config) config = new GuildConfig({ guildId: guild.id });

                // Dynamic update using path
                const keys = path.split('.');
                if (keys.length === 1) {
                    config[keys[0]] = newValue;
                } else if (keys.length === 2) {
                    config[keys[0]][keys[1]] = newValue;
                } else if (keys.length === 3) {
                    if (!config[keys[0]]) config[keys[0]] = {};
                    if (!config[keys[0]][keys[1]]) config[keys[0]][keys[1]] = {};
                    config[keys[0]][keys[1]][keys[2]] = newValue;
                }

                await config.save();

                // Determine which page to refresh to
                let page = 'config_page_main';
                if (path.startsWith('channels.')) page = 'config_page_channels';
                if (path.startsWith('roles.')) page = 'config_page_roles';
                if (path.startsWith('images.')) page = 'config_page_images';
                if (path.startsWith('erlcKey')) page = 'config_page_integrations';
                if (path.startsWith('customEmbeds.')) {
                    const cmd = path.split('.')[1];
                    page = `config_page_embeds_${cmd}`;
                }

                const refreshData = await generateConfigPayload(page, config, guild, interaction.user, true);
                return interaction.update(refreshData);
            }
        }
    }
};

