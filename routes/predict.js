const express = require('express');
const router = express.Router();
const Prediction = require('../models/Prediction');
const Match = require('../models/Match');
const User = require('../models/user');
const Log = require('../models/Log');

const validateScore = (format, sA, sB) => {
    const winScore = format === 'FT2' ? 2 : (format === 'FT3' ? 3 : 4);
    if (sA !== winScore && sB !== winScore) return false;
    if (sA === winScore && sB === winScore) return false;
    if (sA > winScore || sB > winScore) return false;
    return true;
};

router.post('/', async (req, res) => {
    try {
        const { userId, matchId, teamAScore, teamBScore } = req.body;
        const match = await Match.findById(matchId);
        if (!match) return res.status(404).json({ message: '比赛不存在' });
        if (match.isExplicitlyLocked) return res.status(403).json({ message: '该比赛已被管理员暂停预测 🔒' });
        if (match.status === 'finished') return res.status(403).json({ message: '比赛已结束，无法预测' });
        if (match.status === 'locked') return res.status(403).json({ message: '比赛进行中，预测已锁定 🔴' });
        if (new Date() >= new Date(match.startTime)) return res.status(403).json({ message: '比赛已开始，通道已关闭' });
        if (!validateScore(match.format, parseInt(teamAScore), parseInt(teamBScore))) return res.status(400).json({ message: '比分无效' });

        const existingPred = await Prediction.findOne({ userId, matchId });
        if (existingPred) return res.status(400).json({ message: '不可重复预测' });

        const user = await User.findById(userId);
        const prediction = new Prediction({
            userId, matchId, teamAScore, teamBScore,
            predictedWinner: parseInt(teamAScore) > parseInt(teamBScore) ? match.teamA.name : match.teamB.name
        });
        await prediction.save();

        if (user) {
            await Log.create({
                action: "USER_PREDICT",
                operatorId: user._id,
                operatorName: user.nickname,
                target: `Match ${match.customId}`,
                details: { matchName: `${match.teamA.name} vs ${match.teamB.name}`, userGuess: `${teamAScore}:${teamBScore}` }
            });
        }
        res.status(201).json({ success: true, message: '预测成功' });
    } catch (err) { res.status(500).json({ message: err.message }); }
});

router.get('/my/:userId', async (req, res) => {
    try {
        const predictions = await Prediction.find({ userId: req.params.userId });
        res.json(predictions);
    } catch (err) { res.status(500).json({ message: err.message }); }
});

// ==========================================
// [修改] 获取全服统计 (增加详细名单)
// ==========================================
router.get('/stats', async (req, res) => {
    try {
        const stats = await Prediction.aggregate([
            {
                $lookup: { // 关联用户表获取昵称
                    from: 'users',
                    localField: 'userId',
                    foreignField: '_id',
                    as: 'userInfo'
                }
            },
            { $unwind: '$userInfo' }, // 展开数组
            {
                $group: {
                    _id: "$matchId",
                    teamAWins: { $sum: { $cond: [ { $gt: ["$teamAScore", "$teamBScore"] }, 1, 0 ] } },
                    teamBWins: { $sum: { $cond: [ { $gt: ["$teamBScore", "$teamAScore"] }, 1, 0 ] } },
                    total: { $sum: 1 },
                    // [新增] 收集详细名单
                    details: {
                        $push: {
                            name: "$userInfo.nickname",
                            score: { $concat: [ { $toString: "$teamAScore" }, ":", { $toString: "$teamBScore" } ] }
                        }
                    }
                }
            }
        ]);

        const statsMap = {};
        stats.forEach(s => {
            statsMap[s._id] = { A: s.teamAWins, B: s.teamBWins, total: s.total, list: s.details };
        });

        res.json(statsMap);
    } catch (err) { res.status(500).json({ message: err.message }); }
});

module.exports = router;