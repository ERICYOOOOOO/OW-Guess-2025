// models/Prediction.js
const mongoose = require('mongoose');

const predictionSchema = new mongoose.Schema({
    // 关联玩家
    userId: { 
        type: mongoose.Schema.Types.ObjectId, 
        ref: 'User', 
        required: true 
    },
    // 关联比赛
    matchId: { 
        type: mongoose.Schema.Types.ObjectId, 
        ref: 'Match', 
        required: true 
    },
    
    // 玩家预测的核心数据
    teamAScore: { type: Number, required: true },
    teamBScore: { type: Number, required: true },
    
    // 辅助字段：方便快速判断玩家猜谁赢
    predictedWinner: { type: String }, // 存队名，例如 "Team CC"

    // 结算后的得分 (初始为 null, 结算后更新)
    pointsEarned: { type: Number, default: 0 },
    
    // 状态标记
    isPerfect: { type: Boolean, default: false }, // 是否完全猜对 (用于触发彩虹特效)
    status: { 
        type: String, 
        enum: ['pending', 'judged'], 
        default: 'pending' 
    },

    // 提交时间 (用于判断是否逾期)
    submittedAt: { type: Date, default: Date.now }
});

// 复合索引：确保一个玩家对一场比赛只能有一条预测记录
predictionSchema.index({ userId: 1, matchId: 1 }, { unique: true });

module.exports = mongoose.model('Prediction', predictionSchema);