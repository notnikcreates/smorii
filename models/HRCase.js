import mongoose from 'mongoose';

const hrCaseSchema = new mongoose.Schema({
    guildId: { type: String, required: true },
    caseId: { type: Number, required: true },
    issuerId: { type: String, required: true },
    targetId: { type: String, required: true },
    reportedById: { type: String, required: true },
    reason: { type: String, required: true },
    notes: { type: String, required: true },
    status: { type: String, enum: ['Pending', 'Accepted', 'Denied'], default: 'Pending' },
    messageId: { type: String },
    channelId: { type: String },
    forumThreadId: { type: String },
    proofUrl: { type: String },
    timestamp: { type: Date, default: Date.now },
});

export default mongoose.model('HRCase', hrCaseSchema);
