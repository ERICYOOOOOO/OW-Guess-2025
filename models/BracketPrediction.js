// models/BracketPrediction.js
// 玩家一次性提交对整个 14 场赛程的 bracket 预测。
// 每人最多提交一次，BRACKET_LOCK_TIME 之后拒收。

const mongoose = require('mongoose');

const pickSchema = new mongoose.Schema({
    matchCustomId: { type: String, required: true }, // M1, M2, ..., GF
    // 玩家预测这场参战的两支队伍 (集合相等才判分)
    teamAName: { type: String, required: true },
    teamBName: { type: String, required: true },
    // 玩家预测的比分
    teamAScore: { type: Number, required: true },
    teamBScore: { type: Number, required: true },
    predictedWinner: { type: String, required: true },

    // 结算后回写
    pointsEarned: { type: Number, default: 0 },
    isPerfect: { type: Boolean, default: false },
    // 'pending' (未结算) | 'judged' (已结算且队伍对得上) | 'invalid' (队伍对不上, 0分)
    status: { type: String, enum: ['pending', 'judged', 'invalid'], default: 'pending' }
}, { _id: false });

const bracketPredictionSchema = new mongoose.Schema({
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, unique: true, index: true },
    picks: [pickSchema],
    bracketScore: { type: Number, default: 0, index: true },
    submittedAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model('BracketPrediction', bracketPredictionSchema);
