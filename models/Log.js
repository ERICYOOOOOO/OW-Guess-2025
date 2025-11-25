// models/Log.js
const mongoose = require('mongoose');

const logSchema = new mongoose.Schema({
    // 操作类型: "REGISTER", "PREDICT", "ADMIN_SETTLE", "ADMIN_FIX", etc.
    action: { type: String, required: true },
    
    // 操作者信息
    operatorId: String,   // 玩家ID 或 "ADMIN"
    operatorName: String, // 玩家昵称 或 "Administrator"
    
    // 操作对象
    target: String,       // e.g. "Match M1", "User 闪电粉"
    
    // 详细变动数据 (存成对象，方便以后分析)
    details: Object,
    
    // 发生时间
    timestamp: { type: Date, default: Date.now }
});

module.exports = mongoose.model('Log', logSchema);