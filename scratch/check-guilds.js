import 'dotenv/config';
import { Client, GatewayIntentBits } from 'discord.js';

const client = new Client({ intents: [GatewayIntentBits.Guilds] });

client.once('ready', () => {
    console.log(`Bot is in ${client.guilds.cache.size} guilds:`);
    client.guilds.cache.forEach(guild => {
        console.log(`- ${guild.name} (${guild.id})`);
    });
    process.exit(0);
});

client.login(process.env.DISCORD_TOKEN).catch(err => {
    console.error(err);
    process.exit(1);
});
