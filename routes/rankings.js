const express = require('express');
const router = express.Router();
const User = require('../models/user');
const Match = require('../models/Match');
const Prediction = require('../models/Prediction');

// ==========================================
// 1. 总排行榜 (Total Ranking)
// ==========================================
router.get('/total', async (req, res) => {
    try {
        // 1. 获取所有用户基础数据 (含总分、成就)
        const users = await User.find().select('nickname totalScore achievements').lean();

        // 2. 聚合查询：统计所有已结算预测的详细战绩
        const statsAgg = await Prediction.aggregate([
            { $match: { status: 'judged' } }, // 只统计已结算的
            {
                $lookup: {
                    from: 'matches',
                    localField: 'matchId',
                    foreignField: '_id',
                    as: 'matchInfo'
                }
            },
            { $unwind: '$matchInfo' },
            {
                $group: {
                    _id: "$userId",
                    // 胜负正确数 (得分>=1 即视为胜负正确，因为基础分是1)
                    wins: { $sum: { $cond: [{ $gte: ["$pointsEarned", 1] }, 1, 0] } },
                    // FT2 完全正确数
                    ft2: { $sum: { $cond: [{ $and: ["$isPerfect", { $eq: ["$matchInfo.format", "FT2"] }] }, 1, 0] } },
                    // FT3 完全正确数
                    ft3: { $sum: { $cond: [{ $and: ["$isPerfect", { $eq: ["$matchInfo.format", "FT3"] }] }, 1, 0] } },
                    // FT4 完全正确数
                    ft4: { $sum: { $cond: [{ $and: ["$isPerfect", { $eq: ["$matchInfo.format", "FT4"] }] }, 1, 0] } }
                }
            }
        ]);

        // 3. 将统计数据合并到用户列表中
        const statsMap = {};
        statsAgg.forEach(s => statsMap[s._id.toString()] = s);

        const finalUsers = users.map(u => {
            const s = statsMap[u._id.toString()] || { wins: 0, ft2: 0, ft3: 0, ft4: 0 };
            return {
                ...u,
                stats: { wins: s.wins, ft2: s.ft2, ft3: s.ft3, ft4: s.ft4 }
            };
        });

        // 4. 排序
        finalUsers.sort((a, b) => b.totalScore - a.totalScore);

        res.json(finalUsers);
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
});

// ==========================================
// 2. 今日排行榜 (Daily Ranking)
// ==========================================
router.get('/daily/:day', async (req, res) => {
    try {
        const day = parseInt(req.params.day);

        // 1. 找出该日所有比赛
        const dayMatches = await Match.find({ day: day }).select('_id format');
        if (dayMatches.length === 0) return res.json([]);
        
        const matchIds = dayMatches.map(m => m._id);

        // 2. 聚合查询
        const leaderboard = await Prediction.aggregate([
            { $match: { matchId: { $in: matchIds } } },
            {
                $lookup: { // 关联 Match 表获取 format
                    from: 'matches',
                    localField: 'matchId',
                    foreignField: '_id',
                    as: 'matchInfo'
                }
            },
            { $unwind: '$matchInfo' },
            {
                $group: {
                    _id: "$userId",
                    dailyScore: { $sum: "$pointsEarned" },
                    // 统计今日战绩
                    wins: { $sum: { $cond: [{ $gte: ["$pointsEarned", 1] }, 1, 0] } },
                    ft2: { $sum: { $cond: [{ $and: ["$isPerfect", { $eq: ["$matchInfo.format", "FT2"] }] }, 1, 0] } },
                    ft3: { $sum: { $cond: [{ $and: ["$isPerfect", { $eq: ["$matchInfo.format", "FT3"] }] }, 1, 0] } },
                    ft4: { $sum: { $cond: [{ $and: ["$isPerfect", { $eq: ["$matchInfo.format", "FT4"] }] }, 1, 0] } }
                }
            },
            {
                $lookup: {
                    from: "users",
                    localField: "_id",
                    foreignField: "_id",
                    as: "userInfo"
                }
            },
            { $unwind: "$userInfo" }
        ]);

        // 3. 处理手动修正分 (Manual Adjustments)
        // 这里的逻辑稍微复杂：我们需要把 User 表里的 manualAdjustments 加到 aggregation 的结果里
        // 并且，如果某人今天没预测但有修正分，也要加进去。
        
        const result = [];
        const userMap = {}; // userId -> entry

        // 先把预测数据放进去
        leaderboard.forEach(item => {
            const uid = item._id.toString();
            const entry = {
                nickname: item.userInfo.nickname,
                dailyScore: item.dailyScore,
                achievements: item.userInfo.achievements,
                stats: { wins: item.wins, ft2: item.ft2, ft3: item.ft3, ft4: item.ft4 }
            };
            userMap[uid] = entry;
            result.push(entry);
        });

        // 再叠加手动修正
        const usersWithAdj = await User.find({ "manualAdjustments.day": day }).select('_id nickname manualAdjustments achievements');
        usersWithAdj.forEach(u => {
            const uid = u._id.toString();
            const adjTotal = u.manualAdjustments.filter(a => a.day === day).reduce((sum, a) => sum + a.points, 0);
            
            if (userMap[uid]) {
                // 已经在榜上，直接加分
                userMap[uid].dailyScore += adjTotal;
            } else {
                // 没在榜上（今天没预测），新增一条
                const entry = {
                    nickname: u.nickname,
                    dailyScore: adjTotal,
                    achievements: u.achievements,
                    stats: { wins: 0, ft2: 0, ft3: 0, ft4: 0 } // 没预测所以战绩为0
                };
                result.push(entry);
            }
        });

        // 4. 排序
        result.sort((a, b) => b.dailyScore - a.dailyScore);

        res.json(result);

    } catch (err) {
        console.error("日榜计算错误:", err);
        res.status(500).json({ message: err.message });
    }
});

// ==========================================
// 3. 隐藏成就排行榜 (不受影响)
// ==========================================
router.get('/achievements', async (req, res) => {
    try {
        const users = await User.find().select('nickname achievements');
        users.sort((a, b) => b.achievements.length - a.achievements.length);
        res.json(users);
    } catch (err) { res.status(500).json({ message: err.message }); }
});

module.exports = router;