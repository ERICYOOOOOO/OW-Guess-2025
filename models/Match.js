const mongoose = require('mongoose');

const matchSchema = new mongoose.Schema({
    customId: { type: String, required: true, unique: true }, 
    day: { type: Number, required: true }, 
    startTime: { type: Date, required: true }, 
    format: { type: String, enum: ['FT2', 'FT3', 'FT4'], required: true },

    teamA: {
        name: { type: String, required: true }, 
        displayName: { type: String }, 
        score: { type: Number, default: 0 },
        logo: { type: String, default: 'default_logo.png' } 
    },
    teamB: {
        name: { type: String, required: true },
        displayName: { type: String }, 
        score: { type: Number, default: 0 },
        logo: { type: String, default: 'default_logo.png' }
    },

    status: {
        type: String,
        enum: ['upcoming', 'locked', 'finished'],
        default: 'upcoming'
    },

    // === [新增] 管理员手动锁定开关 ===
    isExplicitlyLocked: { 
        type: Boolean, 
        default: false 
    }
});

module.exports = mongoose.model('Match', matchSchema);