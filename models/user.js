const mongoose = require('mongoose');

const userSchema = new mongoose.Schema({
    nickname: { type: String, required: true, unique: true, trim: true },
    wechatId: { type: String, required: true, select: false },
    isAdmin: { type: Boolean, default: false },

    // 实时单场预测累计分
    totalScore: { type: Number, default: 0, index: true },

    // Bracket (整体晋级预测) 累计分
    bracketScore: { type: Number, default: 0, index: true },
    bracketSubmittedAt: { type: Date },

    // 详细日志
    scoreLog: [{
        matchId: { type: mongoose.Schema.Types.ObjectId, ref: 'Match' },
        reason: String,
        points: Number,
        source: { type: String, enum: ['realtime', 'bracket', 'manual'], default: 'realtime' },
        timestamp: { type: Date, default: Date.now }
    }],

    // 管理员手动修正记录 (按天)
    manualAdjustments: [{
        day: Number,
        points: Number,
        reason: String
    }]
});

userSchema.methods.addPoints = async function(points, reason, matchId = null, source = 'realtime') {
    this.totalScore += points;
    this.scoreLog.push({ matchId, reason, points, source });
    return this.save();
};

module.exports = mongoose.model('User', userSchema);
