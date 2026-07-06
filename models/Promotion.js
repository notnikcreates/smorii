import mongoose from 'mongoose';

const promotionSchema = new mongoose.Schema({
    userId: { type: String, required: true },
    staffId: { type: String, required: true },
    guildId: { type: String, required: true },
    oldRank: { type: String, default: 'Unknown' },
    newRank: { type: String, required: true },
    reason: { type: String, default: 'Promotion granted' },
    timestamp: { type: Date, default: Date.now }
});

export default mongoose.model('Promotion', promotionSchema);
