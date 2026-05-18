require('dotenv').config();
const mongoose = require('mongoose');
const Match = require('./models/Match');

mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/owcs_prediction_2026', {
    useNewUrlParser: true,
    useUnifiedTopology: true
}).then(() => console.log("✅ 数据库连接成功，准备重置赛程..."));

// 修复说明：
// 已将你提供的“多伦多当地时间”转换为“UTC标准时间(+5h)”，确保显示正确。
// 例如: 你写的 06:00 (多伦多) -> 存为 11:00Z (UTC)
// M9-M12 已确认为 FT2

const matches = [
    // ==========================================
    // Day 1 (11.26) - Round 1
    // Local: 06:00, 07:15, 08:30, 09:45
    // ==========================================
    { customId: "M1", day: 1, format: "FT2", teamA: { name: "CC" }, teamB: { name: "T1" }, startTime: new Date("2025-11-26T11:00:00Z") },
    { customId: "M2", day: 1, format: "FT2", teamA: { name: "FLC" }, teamB: { name: "VL" }, startTime: new Date("2025-11-26T12:15:00Z") },
    { customId: "M3", day: 1, format: "FT2", teamA: { name: "QAD" }, teamB: { name: "GK" }, startTime: new Date("2025-11-26T13:30:00Z") },
    { customId: "M4", day: 1, format: "FT2", teamA: { name: "SSG" }, teamB: { name: "PEPS" }, startTime: new Date("2025-11-26T14:45:00Z") },

    // ==========================================
    // Day 2 (11.27) - Round 2
    // Local: 06:00, 07:45, 09:30, 11:15
    // ==========================================
    { customId: "M5", day: 2, format: "FT3", teamA: { name: "CR" }, teamB: { name: "TBD", displayName: "M4 Winner" }, startTime: new Date("2025-11-27T11:00:00Z") },
    { customId: "M6", day: 2, format: "FT3", teamA: { name: "WBG" }, teamB: { name: "TBD", displayName: "M3 Winner" }, startTime: new Date("2025-11-27T12:45:00Z") },
    { customId: "M7", day: 2, format: "FT3", teamA: { name: "TM" }, teamB: { name: "TBD", displayName: "M1 Winner" }, startTime: new Date("2025-11-27T14:30:00Z") },
    { customId: "M8", day: 2, format: "FT3", teamA: { name: "TL" }, teamB: { name: "TBD", displayName: "M2 Winner" }, startTime: new Date("2025-11-27T16:15:00Z") },

    // ==========================================
    // Day 3 (11.28) - Lower Round 1 & 2
    // Local: 06:15, 07:30, 08:45, 10:00 (FT2)
    // Local: 11:15, 13:00 (FT3)
    // ==========================================
    { customId: "M9", day: 3, format: "FT2", teamA: { name: "TBD", displayName: "M8 Loser" }, teamB: { name: "TBD", displayName: "M4 Loser" }, startTime: new Date("2025-11-28T11:15:00Z") },
    { customId: "M10", day: 3, format: "FT2", teamA: { name: "TBD", displayName: "M7 Loser" }, teamB: { name: "TBD", displayName: "M3 Loser" }, startTime: new Date("2025-11-28T12:30:00Z") },
    { customId: "M11", day: 3, format: "FT2", teamA: { name: "TBD", displayName: "M6 Loser" }, teamB: { name: "TBD", displayName: "M1 Loser" }, startTime: new Date("2025-11-28T13:45:00Z") },
    { customId: "M12", day: 3, format: "FT2", teamA: { name: "TBD", displayName: "M5 Loser" }, teamB: { name: "TBD", displayName: "M2 Loser" }, startTime: new Date("2025-11-28T15:00:00Z") },
    
    { customId: "M13", day: 3, format: "FT3", teamA: { name: "TBD", displayName: "M9 Winner" }, teamB: { name: "TBD", displayName: "M10 Winner" }, startTime: new Date("2025-11-28T16:15:00Z") },
    { customId: "M14", day: 3, format: "FT3", teamA: { name: "TBD", displayName: "M11 Winner" }, teamB: { name: "TBD", displayName: "M12 Winner" }, startTime: new Date("2025-11-28T18:00:00Z") },

    // ==========================================
    // Day 4 (11.29) - Upper Finals & Lower Round 3
    // Local: 05:00, 06:45, 08:30, 10:15, 12:30
    // ==========================================
    { customId: "M15", day: 4, format: "FT3", teamA: { name: "TBD", displayName: "M5 Winner" }, teamB: { name: "TBD", displayName: "M6 Winner" }, startTime: new Date("2025-11-29T10:00:00Z") },
    { customId: "M16", day: 4, format: "FT3", teamA: { name: "TBD", displayName: "M7 Winner" }, teamB: { name: "TBD", displayName: "M8 Winner" }, startTime: new Date("2025-11-29T11:45:00Z") },
    { customId: "M17", day: 4, format: "FT3", teamA: { name: "TBD", displayName: "M15 Loser" }, teamB: { name: "TBD", displayName: "M13 Winner" }, startTime: new Date("2025-11-29T13:30:00Z") },
    { customId: "M18", day: 4, format: "FT3", teamA: { name: "TBD", displayName: "M16 Loser" }, teamB: { name: "TBD", displayName: "M14 Winner" }, startTime: new Date("2025-11-29T15:15:00Z") },
    { customId: "M19", day: 4, format: "FT3", teamA: { name: "TBD", displayName: "M17 Winner" }, teamB: { name: "TBD", displayName: "M18 Winner" }, startTime: new Date("2025-11-29T17:30:00Z") },

    // ==========================================
    // Day 5 (11.30) - Finals
    // Local: 05:00, 08:45, 10:30
    // ==========================================
    { customId: "UBF", day: 5, format: "FT3", teamA: { name: "TBD", displayName: "M15 Winner" }, teamB: { name: "TBD", displayName: "M16 Winner" }, startTime: new Date("2025-11-30T10:00:00Z") },
    { customId: "LBF", day: 5, format: "FT3", teamA: { name: "TBD", displayName: "UBF Loser" }, teamB: { name: "TBD", displayName: "M19 Winner" }, startTime: new Date("2025-11-30T13:45:00Z") },
    { customId: "GF", day: 5, format: "FT4", teamA: { name: "TBD", displayName: "UBF Winner" }, teamB: { name: "TBD", displayName: "LBF Winner" }, startTime: new Date("2025-11-30T15:30:00Z") } 
];

const seedDB = async () => {
    try {
        console.log("🧹 正在清理旧数据和冲突索引...");
        try {
            await Match.collection.drop(); 
        } catch (e) {
            if (e.code !== 26) console.log("⚠️ 清理时遇到小问题(可忽略):", e.message);
        }

        console.log("🌱 正在插入新赛程 (已修正为 UTC)...");
        await Match.insertMany(matches);
        console.log(`✅ 成功插入 ${matches.length} 场比赛！数据库修复完成！`);
        
    } catch (err) {
        console.error("❌ 严重错误:", err);
    } finally {
        mongoose.connection.close();
    }
};

seedDB();