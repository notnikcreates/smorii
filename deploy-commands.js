import 'dotenv/config';
import { REST, Routes } from 'discord.js';
import fs from 'node:fs';
import { pathToFileURL, fileURLToPath } from 'url';
import { join, dirname } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const {
  CLIENT_ID: clientId,
  GUILD_IDS: guildIdsStr,
  DISCORD_TOKEN: token,
} = process.env;

if (!clientId || !guildIdsStr || !token) {
    console.error("✖ Missing CLIENT_ID, GUILD_IDS, or DISCORD_TOKEN in .env");
    process.exit(1);
}

const guildIds = guildIdsStr.split(',').map(id => id.trim());
const commands = [];
const commandsPath = join(__dirname, 'commands');

async function getCommands(dir) {
    const files = fs.readdirSync(dir, { withFileTypes: true });

    for (const file of files) {
        const fullPath = join(dir, file.name);
        if (file.isDirectory()) {
            await getCommands(fullPath);
        } else if (file.name.endsWith('.js')) {
            try {
                const filePath = pathToFileURL(fullPath).href;
                const command = await import(filePath);
                
                if (command.default?.data) {
                    commands.push(command.default.data.toJSON());
                    console.log(`↳ Loaded slash command: ${command.default.name}`);
                }
            } catch (err) {
                console.error(`✖ Failed to load command ${file.name}:`, err);
            }
        }
    }
}

const rest = new REST({ version: '10' }).setToken(token);

(async () => {
    try {
        await getCommands(commandsPath);
        
        console.log(`\nRefreshing ${commands.length} application (/) commands for ${guildIds.length} guild(s)...`);

        for (const gId of guildIds) {
            try {
                const data = await rest.put(
                    Routes.applicationGuildCommands(clientId, gId),
                    { body: commands }
                );
                console.log(`✅ Successfully reloaded ${data.length} commands for guild: ${gId}`);
            } catch (error) {
                console.error(`✖ Error refreshing guild ${gId}:`, error);
            }
        }
        
        console.log('\nCommand deployment complete.');
    } catch (error) {
        console.error('✖ Deployment failed:', error);
    }
})();
