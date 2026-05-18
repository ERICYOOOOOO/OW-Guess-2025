// routes/rankings.js
// 合并榜 (/total): max(realtime, bracket)，完整 tiebreaker 链
// Bracket 榜 (/bracket): 只列提交过 bracket 的人

const express = require('express');
const router = express.Router();
const User = require('../models/user');
const Prediction = require('../models/Prediction');
const BracketPrediction = require('../models/BracketPrediction');

async function getUserStats() {
    // 仅看实时单场预测的战绩
    const agg = await Prediction.aggregate([
        { $match: { status: 'judged' } },
        { $lookup: { from: 'matches', localField: 'matchId', foreignField: '_id', as: 'matchInfo' } },
        { $unwind: '$matchInfo' },
        {
            $group: {
                _id: "$userId",
                wins: { $sum: { $cond: [{ $gte: ["$pointsEarned", 1] }, 1, 0] } },
                ft2Perfect: { $sum: { $cond: [{ $and: ["$isPerfect", { $eq: ["$matchInfo.format", "FT2"] }] }, 1, 0] } },
                ft3Perfect: { $sum: { $cond: [{ $and: ["$isPerfect", { $eq: ["$matchInfo.format", "FT3"] }] }, 1, 0] } },
                ft4Perfect: { $sum: { $cond: [{ $and: ["$isPerfect", { $eq: ["$matchInfo.format", "FT4"] }] }, 1, 0] } }
            }
        }
    ]);
    const map = {};
    agg.forEach(s => map[s._id.toString()] = s);
    return map;
}

// ==========================================
// 合并榜 (Total = 合并榜)
// ==========================================
router.get('/total', async (req, res) => {
    try {
        const users = await User.find().select('nickname totalScore bracketScore bracketSubmittedAt').lean();
        const statsMap = await getUserStats();
        const submittedSet = new Set(
            (await BracketPrediction.find().select('userId').lean()).map(b => b.userId.toString())
        );

        const finalUsers = users.map(u => {
            const realtime = u.totalScore || 0;
            const bracket = u.bracketScore || 0;
            const hasBracket = submittedSet.has(u._id.toString());
            const displayScore = Math.max(realtime, bracket);
            const displaySource = (hasBracket && bracket >= realtime) ? 'bracket' : 'realtime';
            const s = statsMap[u._id.toString()] || { wins: 0, ft2Perfect: 0, ft3Perfect: 0, ft4Perfect: 0 };
            return {
                _id: u._id,
                nickname: u.nickname,
                realtimeScore: realtime,
                bracketScore: bracket,
                bracketSubmittedAt: u.bracketSubmittedAt || null,
                hasBracket,
                displayScore,
                displaySource,
                stats: {
                    wins: s.wins,
                    ft2: s.ft2Perfect,
                    ft3: s.ft3Perfect,
                    ft4: s.ft4Perfect
                }
            };
        });

        // 完整 tiebreaker 链
        finalUsers.sort((a, b) => {
            if (a.displayScore !== b.displayScore) return b.displayScore - a.displayScore;
            // tiebreaker 1: 有 bracket 优先
            if (a.hasBracket !== b.hasBracket) return a.hasBracket ? -1 : 1;
            // tiebreaker 2: 都有 bracket -> 提交早的优先
            if (a.hasBracket && b.hasBracket) {
                const ta = a.bracketSubmittedAt ? new Date(a.bracketSubmittedAt).getTime() : Infinity;
                const tb = b.bracketSubmittedAt ? new Date(b.bracketSubmittedAt).getTime() : Infinity;
                if (ta !== tb) return ta - tb;
                return 0;
            }
            // tiebreaker 3: 都没 bracket -> 实时战绩级联
            if (a.stats.wins !== b.stats.wins) return b.stats.wins - a.stats.wins;
            if (a.stats.ft4 !== b.stats.ft4) return b.stats.ft4 - a.stats.ft4;
            if (a.stats.ft3 !== b.stats.ft3) return b.stats.ft3 - a.stats.ft3;
            if (a.stats.ft2 !== b.stats.ft2) return b.stats.ft2 - a.stats.ft2;
            return 0;
        });

        res.json(finalUsers);
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
});

// ==========================================
// Bracket 榜
// ==========================================
router.get('/bracket', async (req, res) => {
    try {
        const bps = await BracketPrediction.find().select('userId bracketScore submittedAt').lean();
        if (bps.length === 0) return res.json([]);

        const userIds = bps.map(b => b.userId);
        const users = await User.find({ _id: { $in: userIds } }).select('nickname').lean();
        const userMap = new Map(users.map(u => [u._id.toString(), u]));
        const statsMap = await getUserStats();

        const rows = bps.map(b => {
            const u = userMap.get(b.userId.toString());
            const s = statsMap[b.userId.toString()] || { wins: 0, ft2Perfect: 0, ft3Perfect: 0, ft4Perfect: 0 };
            return {
                _id: b.userId,
                nickname: u ? u.nickname : '(unknown)',
                bracketScore: b.bracketScore || 0,
                submittedAt: b.submittedAt,
                stats: {
                    wins: s.wins,
                    ft2: s.ft2Perfect,
                    ft3: s.ft3Perfect,
                    ft4: s.ft4Perfect
                }
            };
        });

        rows.sort((a, b) => {
            if (a.bracketScore !== b.bracketScore) return b.bracketScore - a.bracketScore;
            const ta = a.submittedAt ? new Date(a.submittedAt).getTime() : Infinity;
            const tb = b.submittedAt ? new Date(b.submittedAt).getTime() : Infinity;
            return ta - tb;
        });

        res.json(rows);
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
});

module.exports = router;
