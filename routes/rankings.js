const express = require('express');
const router = express.Router();
const User = require('../models/user');
const Match = require('../models/Match');
const Prediction = require('../models/Prediction');

// ==========================================
// 总榜 (临时版 - Phase 6 会重写为合并榜)
// ==========================================
router.get('/total', async (req, res) => {
    try {
        const users = await User.find().select('nickname totalScore bracketScore').lean();

        const statsAgg = await Prediction.aggregate([
            { $match: { status: 'judged' } },
            { $lookup: { from: 'matches', localField: 'matchId', foreignField: '_id', as: 'matchInfo' } },
            { $unwind: '$matchInfo' },
            {
                $group: {
                    _id: "$userId",
                    wins: { $sum: { $cond: [{ $gte: ["$pointsEarned", 1] }, 1, 0] } },
                    ft2: { $sum: { $cond: [{ $and: ["$isPerfect", { $eq: ["$matchInfo.format", "FT2"] }] }, 1, 0] } },
                    ft3: { $sum: { $cond: [{ $and: ["$isPerfect", { $eq: ["$matchInfo.format", "FT3"] }] }, 1, 0] } },
                    ft4: { $sum: { $cond: [{ $and: ["$isPerfect", { $eq: ["$matchInfo.format", "FT4"] }] }, 1, 0] } }
                }
            }
        ]);

        const statsMap = {};
        statsAgg.forEach(s => statsMap[s._id.toString()] = s);

        const finalUsers = users.map(u => {
            const s = statsMap[u._id.toString()] || { wins: 0, ft2: 0, ft3: 0, ft4: 0 };
            return {
                ...u,
                stats: { wins: s.wins, ft2: s.ft2, ft3: s.ft3, ft4: s.ft4 }
            };
        });

        finalUsers.sort((a, b) => b.totalScore - a.totalScore);

        res.json(finalUsers);
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
});

module.exports = router;
