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
        if (new Date() >= new Date(match.startTime)) return res.status(403).json({ message: '比赛已开始' });
        if (!validateScore(match.format, parseInt(teamAScore), parseInt(teamBScore))) return res.status(400).json({ message: '比分无效' });

        const existingPred = await Prediction.findOne({ userId, matchId });
        if (existingPred) return res.status(400).json({ message: '不可重复预测' });

        const user = await User.findById(userId);

        // 保存预测
        const prediction = new Prediction({
            userId, matchId, teamAScore, teamBScore,
            predictedWinner: parseInt(teamAScore) > parseInt(teamBScore) ? match.teamA.name : match.teamB.name
        });
        await prediction.save();

        // === 📝 详细日志: 记录玩家具体猜了什么 ===
        if (user) {
            await Log.create({
                action: "USER_PREDICT",
                operatorId: user._id,
                operatorName: user.nickname,
                target: `Match ${match.customId}`, // e.g. Match M1
                details: { 
                    matchName: `${match.teamA.name} vs ${match.teamB.name}`,
                    userGuess: `${teamAScore} : ${teamBScore}`, // 记录具体比分
                    winnerGuess: prediction.predictedWinner     // 记录他猜谁赢
                }
            });
        }
        // =======================================

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