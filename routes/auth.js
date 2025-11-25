const express = require('express');
const router = express.Router();
const User = require('../models/user');
const Log = require('../models/Log'); // 引入日志模型

router.post('/login', async (req, res) => {
    try {
        const { nickname, wechatId } = req.body;
        if (!nickname || !wechatId) return res.status(400).json({ message: '请输入昵称和微信号' });

        let user = await User.findOne({ nickname: nickname }).select('+wechatId');

        if (!user) {
            // [Scenario A]: 创建新用户
            user = new User({ nickname, wechatId });
            await user.save();
            
            // === 📝 记录日志: 玩家注册 ===
            await Log.create({
                action: "USER_REGISTER",
                operatorId: user._id,
                operatorName: user.nickname,
                target: "Self",
                details: { nickname, wechatId: "***" } // 保护隐私，不记微信号
            });
            // ===========================
            
            const userResponse = user.toObject(); delete userResponse.wechatId;
            return res.status(201).json({ success: true, user: userResponse, isNew: true });
        } else {
            if (user.wechatId === wechatId) {
                // [Scenario B]: 登录 (登录通常不记重要日志，除非你想做安全审计，这里暂略)
                const userResponse = user.toObject(); delete userResponse.wechatId;
                return res.json({ success: true, user: userResponse, isNew: false });
            } else {
                return res.status(401).json({ message: '昵称或微信号错误' });
            }
        }
    } catch (err) {
        console.error(err);
        res.status(500).json({ message: '服务器错误' });
    }
});

module.exports = router;