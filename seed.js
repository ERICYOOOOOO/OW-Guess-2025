require('dotenv').config();
const mongoose = require('mongoose');
const Match = require('./models/Match');

mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/owcs_prediction', {
    useNewUrlParser: true,
    useUnifiedTopology: true
}).then(() => console.log("✅ 数据库连接成功，准备重置赛程..."));

const matches = [
    // ==========================================
    // Day 1 (11.26) - Round 1
    // 北京: 19:00 -> 多伦多: 06:00
    // ==========================================
    { customId: "M1", day: 1, format: "FT2", teamA: { name: "CC" }, teamB: { name: "T1" }, startTime: new Date("2025-11-26T06:00:00-05:00") },
    { customId: "M2", day: 1, format: "FT2", teamA: { name: "FLC" }, teamB: { name: "VL" }, startTime: new Date("2025-11-26T07:15:00-05:00") },
    { customId: "M3", day: 1, format: "FT2", teamA: { name: "QAD" }, teamB: { name: "GK" }, startTime: new Date("2025-11-26T08:30:00-05:00") },
    { customId: "M4", day: 1, format: "FT2", teamA: { name: "SSG" }, teamB: { name: "PEPS" }, startTime: new Date("2025-11-26T9:45:00-05:00") },

    // ==========================================
    // Day 2 (11.27) - Round 2
    // 北京: 19:00 -> 多伦多: 06:00
    // ==========================================
    { customId: "M5", day: 2, format: "FT3", teamA: { name: "CR" }, teamB: { name: "TBD", displayName: "M4 Winner" }, startTime: new Date("2025-11-27T06:00:00-05:00") },
    { customId: "M6", day: 2, format: "FT3", teamA: { name: "WBG" }, teamB: { name: "TBD", displayName: "M3 Winner" }, startTime: new Date("2025-11-27T07:45:00-05:00") },
    { customId: "M7", day: 2, format: "FT3", teamA: { name: "TM" }, teamB: { name: "TBD", displayName: "M1 Winner" }, startTime: new Date("2025-11-27T09:30:00-05:00") },
    { customId: "M8", day: 2, format: "FT3", teamA: { name: "TL" }, teamB: { name: "TBD", displayName: "M2 Winner" }, startTime: new Date("2025-11-27T11:15:00-05:00") },

    // ==========================================
    // Day 3 (11.28) - Lower Round 1 & 2
    // 【修改】M9-M12 改为 FT2
    // 北京: 19:00 -> 多伦多: 06:00
    // ==========================================
    { customId: "M9", day: 3, format: "FT2", teamA: { name: "TBD", displayName: "M8 Loser" }, teamB: { name: "TBD", displayName: "M4 Loser" }, startTime: new Date("2025-11-28T06:15:00-05:00") },
    { customId: "M10", day: 3, format: "FT2", teamA: { name: "TBD", displayName: "M7 Loser" }, teamB: { name: "TBD", displayName: "M3 Loser" }, startTime: new Date("2025-11-28T07:30:00-05:00") },
    { customId: "M11", day: 3, format: "FT2", teamA: { name: "TBD", displayName: "M6 Loser" }, teamB: { name: "TBD", displayName: "M1 Loser" }, startTime: new Date("2025-11-28T08:45:00-05:00") },
    { customId: "M12", day: 3, format: "FT2", teamA: { name: "TBD", displayName: "M5 Loser" }, teamB: { name: "TBD", displayName: "M2 Loser" }, startTime: new Date("2025-11-28T10:00:00-05:00") },
    
    // M13 & M14 是 FT3
    // 北京: 11.29 01:00 -> 多伦多: 11.28 12:00 (中午)
    { customId: "M13", day: 3, format: "FT3", teamA: { name: "TBD", displayName: "M9 Winner" }, teamB: { name: "TBD", displayName: "M10 Winner" }, startTime: new Date("2025-11-28T11:15:00-05:00") },
    { customId: "M14", day: 3, format: "FT3", teamA: { name: "TBD", displayName: "M11 Winner" }, teamB: { name: "TBD", displayName: "M12 Winner" }, startTime: new Date("2025-11-28T13:00:00-05:00") },

    // ==========================================
    // Day 4 (11.29) - Upper Finals & Lower Round 3
    // 北京: 19:00 -> 多伦多: 06:00
    // ==========================================
    { customId: "M15", day: 4, format: "FT3", teamA: { name: "TBD", displayName: "M5 Winner" }, teamB: { name: "TBD", displayName: "M6 Winner" }, startTime: new Date("2025-11-29T05:00:00-05:00") },
    { customId: "M16", day: 4, format: "FT3", teamA: { name: "TBD", displayName: "M7 Winner" }, teamB: { name: "TBD", displayName: "M8 Winner" }, startTime: new Date("2025-11-29T06:45:00-05:00") },
    { customId: "M17", day: 4, format: "FT3", teamA: { name: "TBD", displayName: "M15 Loser" }, teamB: { name: "TBD", displayName: "M13 Winner" }, startTime: new Date("2025-11-29T08:30:00-05:00") },
    { customId: "M18", day: 4, format: "FT3", teamA: { name: "TBD", displayName: "M16 Loser" }, teamB: { name: "TBD", displayName: "M14 Winner" }, startTime: new Date("2025-11-29T10:15:00-05:00") },
    
    // M19: 北京 11.30 01:00 -> 多伦多 11.29 12:00
    { customId: "M19", day: 4, format: "FT3", teamA: { name: "TBD", displayName: "M17 Winner" }, teamB: { name: "TBD", displayName: "M18 Winner" }, startTime: new Date("2025-11-29T12:30:00-05:00") },

    // ==========================================
    // Day 5 (11.30) - Finals
    // 北京: 22:30 -> 多伦多: 09:30
    // ==========================================
    { customId: "UBF", day: 5, format: "FT3", teamA: { name: "TBD", displayName: "M15 Winner" }, teamB: { name: "TBD", displayName: "M16 Winner" }, startTime: new Date("2025-11-30T05:00:00-05:00") },
    // 北京: 12.01 00:00 -> 多伦多: 11.30 11:00
    { customId: "LBF", day: 5, format: "FT3", teamA: { name: "TBD", displayName: "UBF Loser" }, teamB: { name: "TBD", displayName: "M19 Winner" }, startTime: new Date("2025-11-30T08:45:00-05:00") },
    // 北京: 12.01 02:00 -> 多伦多: 11.30 13:00
    { customId: "GF", day: 5, format: "FT4", teamA: { name: "TBD", displayName: "UBF Winner" }, teamB: { name: "TBD", displayName: "LBF Winner" }, startTime: new Date("2025-11-30T10:30:00-05:00") } 
];

const seedDB = async () => {
    try {
        console.log("🧹 正在清理旧数据和冲突索引...");
        try {
            await Match.collection.drop(); 
        } catch (e) {
            if (e.code !== 26) console.log("⚠️ 清理时遇到小问题(可忽略):", e.message);
        }

        console.log("🌱 正在插入新赛程 (多伦多时间 EST UTC-5)...");
        await Match.insertMany(matches);
        console.log(`✅ 成功插入 ${matches.length} 场比赛！数据库修复完成！`);
        
    } catch (err) {
        console.error("❌ 严重错误:", err);
    } finally {
        mongoose.connection.close();
    }
};

seedDB();