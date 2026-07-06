import mongoose from 'mongoose';

const guildConfigSchema = new mongoose.Schema({
    guildId: { type: String, required: true, unique: true },
    roles: {
        hrRole: { type: String, default: null },
        sessionRole: { type: String, default: null }
    },
    channels: {
        infractionLog: { type: String, default: null },
        promotionLog: { type: String, default: null },
        hrLog: { type: String, default: null }
    },
    erlcKey: { type: String, default: null },
    images: {
        infractionBanner: { type: String, default: 'https://cdn.discordapp.com/attachments/1490670329129992243/1490670615701618820/Infraction.png' },
        promotionBanner: { type: String, default: 'https://cdn.discordapp.com/attachments/1490670329129992243/1490670603924017182/Promotion.png' },
        historyImage: { type: String, default: 'https://cdn.discordapp.com/attachments/1490670329129992243/1490671683026157638/Alaska.png' },
        dashbImage: { type: String, default: 'https://cdn.discordapp.com/attachments/1490670329129992243/1490670633506439188/Dashboard.png' },
        sstatusBanner: { type: String, default: 'https://cdn.discordapp.com/attachments/1490376043184394270/1490664167701741679/Alaska.png' },
        sstatusMain: { type: String, default: 'https://cdn.discordapp.com/attachments/1490376043184394270/1490421390246019152/Screenshot_2025-07-09_at_7.26.56_PM.png' },
        membercountBanner: { type: String, default: 'https://media.discordapp.net/attachments/1490670329129992243/1491740924408103004/image.png' }
    },
    customEmbeds: {
        sstatus: {
            title: { type: String, default: 'Smorii Systems | Session Status' },
            color: { type: String, default: '#2b2d31' },
            footer: { type: String, default: 'Smorii Systems' }
        },
        infraction: {
            title: { type: String, default: 'Smorii Systems | Infraction Case' },
            color: { type: String, default: '#ff4b4b' },
            footer: { type: String, default: 'Smorii Systems' }
        },
        promotion: {
            title: { type: String, default: 'Smorii Systems | Promotion Case' },
            color: { type: String, default: '#4bff4b' },
            footer: { type: String, default: 'Smorii Systems' }
        },
        dashb: {
            title: { type: String, default: 'Smorii Systems | Dashboard' },
            color: { type: String, default: '#4b4bff' },
            footer: { type: String, default: 'Smorii Systems' }
        },
        membercount: {
            title: { type: String, default: 'Smorii Systems | Member Count' },
            color: { type: String, default: '#ffffff' },
            footer: { type: String, default: 'Smorii Systems' }
        },
        hr: {
            title: { type: String, default: 'Smorii Systems HR Case' },
            color: { type: String, default: '#fbff00' },
            footer: { type: String, default: 'Smorii Systems' }
        }
    }
});

export default mongoose.models.GuildConfig || mongoose.model('GuildConfig', guildConfigSchema);
