// models/LiquipediaSyncLog.js
// 每次自动/手动同步的结果记录，差异写在 diffs 字段里 (不自动覆盖)

const mongoose = require('mongoose');

const syncLogSchema = new mongoose.Schema({
    triggeredBy: { type: String, enum: ['auto-high', 'auto-low', 'manual'], default: 'manual' },
    success: { type: Boolean, default: false },
    error: String,
    // diff item: { customId, field, current, scraped }
    diffs: [{
        customId: String,
        field: String,
        current: mongoose.Schema.Types.Mixed,
        scraped: mongoose.Schema.Types.Mixed
    }],
    // 触发自动结算的比赛 ID
    autoSettled: [String],
    // 触发自动锁定 (upcoming → locked) 的比赛 ID
    autoLocked: [String],
    timestamp: { type: Date, default: Date.now, index: true }
});

module.exports = mongoose.model('LiquipediaSyncLog', syncLogSchema);
