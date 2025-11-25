const mongoose = require('mongoose');

const userSchema = new mongoose.Schema({
    nickname: { type: String, required: true, unique: true, trim: true },
    wechatId: { type: String, required: true, select: false },
    isAdmin: { type: Boolean, default: false },

    // 总分 (包含所有预测 + 成就 + 手动修正)
    totalScore: { type: Number, default: 0, index: true },
    
    // 每日得分记录 (旧字段，保留以防万一，但主要逻辑已转为实时计算)
    dailyScores: [{ date: String, score: Number }],

    // 详细日志
    scoreLog: [{
        matchId: { type: mongoose.Schema.Types.ObjectId, ref: 'Match' },
        reason: String, 
        points: Number,
        timestamp: { type: Date, default: Date.now }
    }],

    // 隐藏成就
    achievements: [{
        name: String,
        unlockedAt: { type: Date, default: Date.now }
    }],

    // === [新增] 每日手动修正记录 ===
    // 用于在计算日榜时，额外加上这些分数
    manualAdjustments: [{
        day: Number,   // 哪一天的修正 (1, 2, 3...)
        points: Number, // 修正了多少分
        reason: String  // 理由
    }]
});

// 辅助方法
userSchema.methods.addPoints = async function(points, reason, matchId = null, dateStr) {
    this.totalScore += points;
    this.scoreLog.push({ matchId, reason, points });
    // dailyScores 逻辑已废弃，但为了兼容性保留
    return this.save();
};

module.exports = mongoose.model('User', userSchema);