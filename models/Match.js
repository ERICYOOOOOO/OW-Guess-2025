const mongoose = require('mongoose');

const matchSchema = new mongoose.Schema({
    // 1. 比赛标识
    customId: { 
        type: String, 
        required: true, 
        unique: true 
    }, // 例如: "M1", "M15", "UBF" (胜决), "GF" (总决赛)

    // 2. 比赛时间与轮次 (用于排序和显示)
    day: { type: Number, required: true }, // 例如: 1 (Day 1), 2 (Day 2)
    startTime: { type: Date, required: true }, // 比赛具体开始时间 (11/26 19:00)
    
    // 3. 赛制规则 (核心计分依据)
    // 你的规则: FT2(BO3), FT3(BO5), FT4(BO7)
    format: { 
        type: String, 
        enum: ['FT2', 'FT3', 'FT4'], 
        required: true 
    },

    // 4. 队伍信息
    // 初始时可能是 "M4 Winner"，管理员更新后变成 "CR"
    teamA: {
        name: { type: String, required: true }, // 队名 或 "TBD"
        displayName: { type: String }, // 显示文本，如 "M4 Winner"
        score: { type: Number, default: 0 },
        logo: { type: String, default: 'default_logo.png' } // 队伍Logo路径
    },
    teamB: {
        name: { type: String, required: true },
        displayName: { type: String }, // 显示文本，如 "M3 Winner"
        score: { type: Number, default: 0 },
        logo: { type: String, default: 'default_logo.png' }
    },

    // 5. 比赛状态
    // upcoming: 开放预测
    // locked: 比赛进行中 (禁止预测)
    // finished: 比赛结束 (用于结算)
    status: {
        type: String,
        enum: ['upcoming', 'locked', 'finished'],
        default: 'upcoming'
    },

    // 6. 赛程关联 (可选，用于自动更新名字)
    // 记录这场比赛的胜者/败者会去哪场比赛
    winnerTo: { type: String }, // 例如 "M5" (表示去M5打比赛)
    loserTo: { type: String }   // 例如 "M9" (表示去M9打败者组)
});

module.exports = mongoose.model('Match', matchSchema);