import mongoose from 'mongoose';

const infractionSchema = new mongoose.Schema({
    caseId: { type: Number, required: true },
    userId: { type: String, required: true },
    staffId: { type: String, required: true },
    guildId: { type: String, required: true },
    messageId: { type: String },
    channelId: { type: String },
    reason: { type: String, default: 'No reason provided' },
    type: { type: String, default: 'Warning' }, // Warning, Strike, etc.
    duration: { type: String }, // e.g., "10m", "1h"
    expiresAt: { type: Date }, // Automated expiration time
    isExpired: { type: Boolean, default: false }, // Has the expiration notification been sent?
    isAppealable: { type: Boolean, default: false },
    isVoided: { type: Boolean, default: false },
    voidReason: { type: String },
    voidBy: { type: String },
    points: { type: Number, default: 1 },
    timestamp: { type: Date, default: Date.now }
});

export default mongoose.model('Infraction', infractionSchema);
