import { Client, GatewayIntentBits, Collection } from 'discord.js';
import mongoose from 'mongoose';
import dotenv from 'dotenv';
import chalk from 'chalk';
import boxen from 'boxen';
import gradient from 'gradient-string';
import ora from 'ora';
import { readdirSync } from 'fs';
import { fileURLToPath, pathToFileURL } from 'url';
import { dirname, join } from 'path';
import { startExpirationTask } from './utils/expirationTask.js';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// ─── ENV VALIDATION ───────────────────────────────────────────────────────────
if (!process.env.DISCORD_TOKEN) {
    console.error(chalk.red.bold('✖ DISCORD_TOKEN is missing from .env. Cannot start.'));
    process.exit(1);
}

if (!process.env.PREFIX) {
    console.error(chalk.red.bold('✖ PREFIX is missing from .env. Cannot start.'));
    process.exit(1);
}

const PREFIX = process.env.PREFIX;

// ─── CLIENT SETUP ─────────────────────────────────────────────────────────────
const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent,
        GatewayIntentBits.GuildMembers,
    ],
});

client.commands = new Collection();
client.prefix = PREFIX;

// ─── COMMAND LOADER ───────────────────────────────────────────────────────────
async function loadCommands() {
    const commandsPath = join(__dirname, 'commands');
    let files;

    try {
        files = readdirSync(commandsPath).filter(f => f.endsWith('.js'));
    } catch {
        console.warn(chalk.yellow('⚠ No commands folder found, skipping command loading.'));
        return;
    }

    for (const file of files) {
        try {
            const filePath = pathToFileURL(join(commandsPath, file)).href;
            const command = await import(filePath);

            if (!command.default?.name || !command.default?.execute) {
                console.warn(chalk.yellow(`⚠ Skipping ${file}: missing "name" or "execute".`));
                continue;
            }

            client.commands.set(command.default.name.toLowerCase(), command.default);
            console.log(chalk.gray(`  ↳ Loaded command: ${chalk.cyan(command.default.name)}`));
        } catch (err) {
            console.error(chalk.red(`✖ Failed to load command ${file}:`), err);
        }
    }
}

// ─── EVENT LOADER ─────────────────────────────────────────────────────────────
async function loadEvents() {
    const eventsPath = join(__dirname, 'events');
    let files;

    try {
        files = readdirSync(eventsPath).filter(f => f.endsWith('.js'));
    } catch {
        console.warn(chalk.yellow('⚠ No events folder found, skipping event loading.'));
        return;
    }

    for (const file of files) {
        try {
            const filePath = pathToFileURL(join(eventsPath, file)).href;
            const event = await import(filePath);

            if (!event.default?.name || !event.default?.execute) {
                console.warn(chalk.yellow(`⚠ Skipping ${file}: missing "name" or "execute".`));
                continue;
            }

            const wrappedExecute = async (...args) => {
                try {
                    await event.default.execute(...args, client);
                } catch (err) {
                    console.error(chalk.red(`✖ Error in event "${event.default.name}":`), err);
                }
            };

            if (event.default.once) {
                client.once(event.default.name, wrappedExecute);
            } else {
                client.on(event.default.name, wrappedExecute);
            }

            console.log(
                chalk.gray(
                    `  ↳ Loaded event: ${chalk.cyan(event.default.name)} ${event.default.once ? chalk.dim('(once)') : ''}`
                )
            );
        } catch (err) {
            console.error(chalk.red(`✖ Failed to load event ${file}:`), err);
        }
    }
}

// ─── READY EVENT ──────────────────────────────────────────────────────────────
client.once('clientReady', () => {
    const msg = gradient.cristal(`Logged in as ${client.user.tag}!`);
    console.log(
        boxen(msg, {
            padding: 1,
            margin: 1,
            borderStyle: 'round',
            borderColor: 'cyan',
            textAlignment: 'center',
        })
    );

    console.log(
        chalk.gray(
            `  Prefix: ${chalk.cyan(PREFIX)} · Commands: ${chalk.cyan(client.commands.size)}`
        )
    );
});

// ─── PROCESS ERROR HANDLING ───────────────────────────────────────────────────
process.on('unhandledRejection', (reason) => {
    console.error(chalk.red('❌ Unhandled Promise Rejection:'), reason);
});

process.on('uncaughtException', (err) => {
    console.error(chalk.red('❌ Uncaught Exception:'), err);
});

// ─── START FUNCTION ───────────────────────────────────────────────────────────
async function start() {
    const spinner = ora('Starting bot...').start();

    try {
        // MongoDB
        if (process.env.MONGO_URI) {
            spinner.text = 'Connecting to MongoDB...';
            try {
                await mongoose.connect(process.env.MONGO_URI);
                spinner.succeed(chalk.green('Connected to MongoDB!'));
            } catch (err) {
                spinner.fail(chalk.red('Failed to connect to MongoDB.'));
                console.error(err);
                process.exit(1);
            }
        } else {
            spinner.warn(chalk.yellow('No MONGO_URI in .env — skipping database connection.'));
        }

        spinner.start('Loading commands...');
        await loadCommands();
        spinner.succeed(chalk.green(`Loaded ${client.commands.size} command(s).`));

        spinner.start('Loading events...');
        await loadEvents();
        spinner.succeed(chalk.green('Events loaded.'));

        spinner.start('Logging in to Discord...');
        await client.login(process.env.DISCORD_TOKEN);
        spinner.succeed(chalk.green('Discord client started!'));

        // Start background tasks
        startExpirationTask(client);
    } catch (error) {
        spinner.fail(chalk.red('Failed to start the bot.'));
        console.error(error);
        process.exit(1);
    }
}

start();