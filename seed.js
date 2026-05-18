require('dotenv').config();
const mongoose = require('mongoose');
const Match = require('./models/Match');

mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/owcs_prediction_2026', {
    useNewUrlParser: true,
    useUnifiedTopology: true
}).then(() => console.log("✅ 数据库连接成功，准备初始化 2026 Champions Clash 赛程..."));

// =======================================================
// OWCS 2026 — Champions Clash (Stage 1 国际总决赛)
// 5/22 ~ 5/24 JST · Arena Tachikawa Tachihi · 8 队双败 14 场
// Day 1 第一场: 2026-05-22T03:00:00Z (= 5/21 20:00 PT)
// 时间为初始占位，Liquipedia 同步模块会自动校正
// =======================================================

const matches = [
    // Day 1 (5/22 JST) - UB Round 1 + LB Round 1, 全部 FT2
    { customId: "M1",  day: 1, format: "FT2", teamA: { name: "WBG" },  teamB: { name: "VP" },   startTime: new Date("2026-05-22T03:00:00Z") },
    { customId: "M2",  day: 1, format: "FT2", teamA: { name: "ZETA" }, teamB: { name: "SSG" },  startTime: new Date("2026-05-22T04:30:00Z") },
    { customId: "M3",  day: 1, format: "FT2", teamA: { name: "DAL" },  teamB: { name: "CR" },   startTime: new Date("2026-05-22T06:00:00Z") },
    { customId: "M4",  day: 1, format: "FT2", teamA: { name: "TM" },   teamB: { name: "AG" },   startTime: new Date("2026-05-22T07:30:00Z") },
    { customId: "M5",  day: 1, format: "FT2",
        teamA: { name: "TBD", displayName: "L-M4" },
        teamB: { name: "TBD", displayName: "L-M3" },
        startTime: new Date("2026-05-22T09:00:00Z") },
    { customId: "M6",  day: 1, format: "FT2",
        teamA: { name: "TBD", displayName: "L-M1" },
        teamB: { name: "TBD", displayName: "L-M2" },
        startTime: new Date("2026-05-22T10:30:00Z") },

    // Day 2 (5/23 JST) - UBSF + LBQF (交叉) + LBSF, 全部 FT3
    { customId: "M7",  day: 2, format: "FT3",
        teamA: { name: "TBD", displayName: "W-M4" },
        teamB: { name: "TBD", displayName: "W-M3" },
        startTime: new Date("2026-05-23T03:00:00Z") },
    { customId: "M8",  day: 2, format: "FT3",
        teamA: { name: "TBD", displayName: "W-M2" },
        teamB: { name: "TBD", displayName: "W-M1" },
        startTime: new Date("2026-05-23T05:00:00Z") },
    { customId: "M9",  day: 2, format: "FT3",
        teamA: { name: "TBD", displayName: "L-M8" },
        teamB: { name: "TBD", displayName: "W-M5" },
        startTime: new Date("2026-05-23T07:00:00Z") },
    { customId: "M10", day: 2, format: "FT3",
        teamA: { name: "TBD", displayName: "L-M7" },
        teamB: { name: "TBD", displayName: "W-M6" },
        startTime: new Date("2026-05-23T09:00:00Z") },
    { customId: "M11", day: 2, format: "FT3",
        teamA: { name: "TBD", displayName: "W-M9" },
        teamB: { name: "TBD", displayName: "W-M10" },
        startTime: new Date("2026-05-23T11:00:00Z") },

    // Day 3 (5/24 JST) - UBF + LBF + GF
    { customId: "UBF", day: 3, format: "FT3",
        teamA: { name: "TBD", displayName: "W-M7" },
        teamB: { name: "TBD", displayName: "W-M8" },
        startTime: new Date("2026-05-24T03:00:00Z") },
    { customId: "LBF", day: 3, format: "FT3",
        teamA: { name: "TBD", displayName: "L-UBF" },
        teamB: { name: "TBD", displayName: "W-M11" },
        startTime: new Date("2026-05-24T05:00:00Z") },
    { customId: "GF",  day: 3, format: "FT4",
        teamA: { name: "TBD", displayName: "W-UBF" },
        teamB: { name: "TBD", displayName: "W-LBF" },
        startTime: new Date("2026-05-24T07:30:00Z") }
];

const seedDB = async () => {
    try {
        console.log("🧹 清理旧 Match 集合...");
        try {
            await Match.collection.drop();
        } catch (e) {
            if (e.code !== 26) console.log("⚠️ 清理时遇到小问题(可忽略):", e.message);
        }

        console.log(`🌱 插入 ${matches.length} 场赛程 (UTC)...`);
        await Match.insertMany(matches);
        console.log(`✅ 初始化完成 — OWCS 2026 Champions Clash 已就绪`);

    } catch (err) {
        console.error("❌ 严重错误:", err);
    } finally {
        mongoose.connection.close();
    }
};

seedDB();
