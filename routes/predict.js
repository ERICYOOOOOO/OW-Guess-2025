const express = require('express');
const router = express.Router();
const Prediction = require('../models/Prediction');
const Match = require('../models/Match');
const User = require('../models/user'); // 注意 User 大小写
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

        // 1. [新增] 检查管理员手动锁
        if (match.isExplicitlyLocked) {
            return res.status(403).json({ message: '该比赛已被管理员暂停预测 🔒' });
        }

        // 2. 检查时间锁
        if (new Date() >= new Date(match.startTime)) {
            return res.status(403).json({ message: '比赛已开始，通道已关闭' });
        }

        // 3. 检查赛制
        if (!validateScore(match.format, parseInt(teamAScore), parseInt(teamBScore))) {
            return res.status(400).json({ message: '比分无效' });
        }

        // 4. 检查重复
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

module.exports = router;