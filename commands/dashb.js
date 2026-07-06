import { createTextContainer } from '../utils/modUtils.js';
import GuildConfig from '../models/GuildConfig.js';
import { SlashCommandBuilder } from 'discord.js';

export default {
    name: 'dashb',
    description: 'Sends the Smorii Systems dashboard using Components V2.',
    data: new SlashCommandBuilder()
        .setName('dashb')
        .setDescription('Sends the Smorii Systems dashboard using Components V2.'),

    async execute(message, args, client) {
        const isInteraction = message.commandName !== undefined;
        const guildId = message.guild?.id;

        if (!guildId) return;

        let config = await GuildConfig.findOne({ guildId });
        if (!config) config = new GuildConfig({ guildId });

        const dashbCfg = config.customEmbeds?.dashb || { title: 'Smorii Systems | Dashboard' };
        const textContent1 = `<:smorii:1493679842229616702> ** | ${dashbCfg.title}**\n` +
                             `> Welcome to the <:smorii:1493679842229616702> **Smorii Systems dashboard.** This is your central hub for everything you may need while in the server. The dashboard is designed to provide clear and efficient access to important information, resources, and other, so you can navigate the server without confusion or delays. Our goal is to maintain an environment that is both realistic and enjoyable. We aim to keep interactions natural and engaging, allowing everyone to be part of a community where things feel smooth rather than forced.`;

        const textContent2 = `<:folderoutline:1493679785002537131> **Channels**\n` +
                             `* <#${config.channels.hrLog || 'Not Set'}>\n` +
                             `* <#${config.channels.infractionLog || 'Not Set'}>\n` +
                             `* <#${config.channels.promotionLog || 'Not Set'}>`;

        const messageData = {
          "components": [
            {
              "type": 17,
              "components": [
                {
                  "type": 12,
                  "items": [
                    {
                      "media": {
                        "url": config.images.dashbImage
                      }
                    }
                  ]
                },
                {
                  "type": 10,
                  "content": textContent1
                },
                {
                  "type": 14,
                  "spacing": 2,
                  "divider": true
                },
                {
                  "type": 10,
                  "content": textContent2
                },
                {
                  "type": 14,
                  "spacing": 2,
                  "divider": true
                },
                {
                  "type": 1,
                  "components": [
                    {
                      "type": 2,
                      "style": 5,
                      "url": "https://forms.gle/", // Example replaced link
                      "label": "Staff Application",
                      "emoji": {
                        "id": "1493679781672128533", // external
                        "animated": false
                      }
                    }
                  ]
                },
                {
                  "type": 1,
                  "components": [
                    {
                      "type": 2,
                      "style": 5,
                      "url": "https://www.roblox.com/", // Example replaced
                      "label": "Roblox Group",
                      "emoji": {
                        "id": "1493679781672128533", // external
                        "animated": false
                      }
                    }
                  ]
                },
                {
                  "type": 1,
                  "components": [
                    {
                      "type": 2,
                      "style": 5,
                      "url": "https://forms.gle/", // Example replaced link
                      "label": "Ban Appeal",
                      "emoji": {
                        "id": "1493679781672128533", // external
                        "animated": false
                      }
                    }
                  ]
                }
              ]
            }
          ],
          "flags": 32768
        };

        try {
            if (isInteraction) {
                await message.reply({content: 'Sent!', flags: 64})
                await message.channel.send(messageData);
            } else {
                await message.delete().catch(() => {});
                await message.channel.send(messageData);
            }
        } catch (error) {
            console.error('Error sending V2 Dashboard:', error);
            const errorMsg = '<:deny:1493679796281020426> Failed to send the dashboard message.';
            if (isInteraction) {
                await message.reply(createTextContainer(errorMsg, true));
            } else {
                await message.channel.send(createTextContainer(errorMsg)).catch(() => {});
            }
        }
    },
};
