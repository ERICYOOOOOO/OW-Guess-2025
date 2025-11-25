const express = require('express');
const router = express.Router();
const Match = require('../models/Match');

// GET /api/matches
// 获取所有比赛数据，按时间排序
router.get('/', async (req, res) => {
    try {
        // 按 ID 排序 (M1, M2...) 或者按时间排序
        const matches = await Match.find().sort({ startTime: 1 });
        res.json(matches);
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
});

// GET /api/matches/day/:day
// (可选) 按天获取比赛，方便手机端按天加载
router.get('/day/:day', async (req, res) => {
    try {
        const matches = await Match.find({ day: req.params.day }).sort({ startTime: 1 });
        res.json(matches);
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
});

module.exports = router;