const express = require('express');
const router = express.Router();
const User = require('../models/user');
const Match = require('../models/Match');
const Prediction = require('../models/Prediction');

// 1. 总榜 (不受影响，直接读 totalScore)
router.get('/total', async (req, res) => {
    try {
        const users = await User.find().select('nickname totalScore achievements').sort({ totalScore: -1 });
        res.json(users);
    } catch (err) { res.status(500).json({ message: err.message }); }
});

// 2. 隐藏成就榜 (不受影响)
router.get('/achievements', async (req, res) => {
    try {
        const users = await User.find().select('nickname achievements');
        users.sort((a, b) => b.achievements.length - a.achievements.length);
        res.json(users);
    } catch (err) { res.status(500).json({ message: err.message }); }
});

// 3. [修改] 今日排行榜 (包含手动修正分)
router.get('/daily/:day', async (req, res) => {
    try {
        const day = parseInt(req.params.day);

        // A. 获取该日比赛的预测分
        const dayMatches = await Match.find({ day: day }).select('_id');
        const matchIds = dayMatches.map(m => m._id);
        
        // 聚合预测分
        const predictionStats = await Prediction.aggregate([
            { $match: { matchId: { $in: matchIds } } },
            { $group: { _id: "$userId", score: { $sum: "$pointsEarned" } } }
        ]);

        // 转为 Map 方便查找: { "userId": score }
        const scoreMap = {};
        predictionStats.forEach(item => {
            scoreMap[item._id.toString()] = item.score;
        });

        // B. 获取该日的手动修正分
        // 查找所有在该日有修正记录的用户
        const usersWithAdjustments = await User.find({ "manualAdjustments.day": day }).select('_id manualAdjustments');
        
        usersWithAdjustments.forEach(u => {
            const uid = u._id.toString();
            // 累加该用户在这一天的所有修正值
            const adjTotal = u.manualAdjustments
                .filter(a => a.day === day)
                .reduce((sum, a) => sum + a.points, 0);
            
            // 合并到 Map 中
            if (!scoreMap[uid]) scoreMap[uid] = 0;
            scoreMap[uid] += adjTotal;
        });

        // C. 获取用户信息并组装最终列表
        // 找出所有在 Map 里有分数的 UserID
        const allUserIds = Object.keys(scoreMap);
        const usersInfo = await User.find({ _id: { $in: allUserIds } }).select('nickname achievements');

        const leaderboard = usersInfo.map(user => ({
            nickname: user.nickname,
            dailyScore: scoreMap[user._id.toString()], // 这里就是 (预测 + 修正) 的总和
            achievements: user.achievements
        }));

        // D. 排序
        leaderboard.sort((a, b) => b.dailyScore - a.dailyScore);

        res.json(leaderboard);

    } catch (err) {
        console.error("日榜计算错误:", err);
        res.status(500).json({ message: err.message });
    }
});

module.exports = router;