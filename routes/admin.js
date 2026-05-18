// routes/admin.js
const express = require('express');
const router = express.Router();
const Match = require('../models/Match');
const User = require('../models/user');
const Prediction = require('../models/Prediction');
const Log = require('../models/Log');

const requireAdmin = (req, res, next) => next();

// =======================================================
// 🏆 OWCS 2026 Champions Clash 晋级路线 (8 队双败, 14 场)
// =======================================================
// 上区第一轮 (M1~M4) 胜者进 UBSF, 败者进 LBR1
// LBR1 (M5/M6) 胜者交叉进 LBQF (M9/M10)
// UBSF (M7/M8) 败者交叉进 LBQF
const BRACKET_MAP = {
    "M1": { win:  { to: "M8",  slot: "teamB" }, lose: { to: "M6", slot: "teamA" } },
    "M2": { win:  { to: "M8",  slot: "teamA" }, lose: { to: "M6", slot: "teamB" } },
    "M3": { win:  { to: "M7",  slot: "teamB" }, lose: { to: "M5", slot: "teamA" } },
    "M4": { win:  { to: "M7",  slot: "teamA" }, lose: { to: "M5", slot: "teamB" } },
    "M5": { win:  { to: "M9",  slot: "teamB" } },
    "M6": { win:  { to: "M10", slot: "teamB" } },
    "M7": { win:  { to: "UBF", slot: "teamA" }, lose: { to: "M10", slot: "teamA" } },
    "M8": { win:  { to: "UBF", slot: "teamB" }, lose: { to: "M9",  slot: "teamA" } },
    "M9": { win:  { to: "M11", slot: "teamA" } },
    "M10":{ win:  { to: "M11", slot: "teamB" } },
    "M11":{ win:  { to: "LBF", slot: "teamB" } },
    "UBF":{ win:  { to: "GF",  slot: "teamA" }, lose: { to: "LBF", slot: "teamA" } },
    "LBF":{ win:  { to: "GF",  slot: "teamB" } }
};

async function advanceTeams(match, winnerName, loserName) {
    const path = BRACKET_MAP[match.customId];
    if (!path) return;
    if (path.win) {
        const nextMatch = await Match.findOne({ customId: path.win.to });
        if (nextMatch) {
            if (path.win.slot === 'teamA') nextMatch.teamA.name = winnerName;
            if (path.win.slot === 'teamB') nextMatch.teamB.name = winnerName;
            await nextMatch.save();
        }
    }
    if (path.lose) {
        const nextMatch = await Match.findOne({ customId: path.lose.to });
        if (nextMatch) {
            if (path.lose.slot === 'teamA') nextMatch.teamA.name = loserName;
            if (path.lose.slot === 'teamB') nextMatch.teamB.name = loserName;
            await nextMatch.save();
        }
    }
}

async function logAdminAction(action, target, details) {
    await Log.create({ action, operatorId: "ADMIN", operatorName: "Administrator", target, details });
}

// ==========================================
// 1. 结算比赛
// ==========================================
router.post('/settle', requireAdmin, async (req, res) => {
    const { matchId, scoreA, scoreB } = req.body;
    try {
        const match = await Match.findById(matchId);
        if (!match || match.status === 'finished') return res.status(400).json({ message: 'Error' });

        if (match.teamA.name === 'TBD' || match.teamB.name === 'TBD') {
            return res.status(400).json({ message: '无法结算：参赛队伍尚未确定' });
        }

        match.teamA.score = scoreA;
        match.teamB.score = scoreB;
        match.status = 'finished';
        await match.save();

        const winnerName = parseInt(scoreA) > parseInt(scoreB) ? match.teamA.name : match.teamB.name;
        const loserName  = parseInt(scoreA) > parseInt(scoreB) ? match.teamB.name : match.teamA.name;
        await advanceTeams(match, winnerName, loserName);

        const preds = await Prediction.find({ matchId });
        let updateCount = 0;

        const targetA = parseInt(scoreA);
        const targetB = parseInt(scoreB);

        for (let p of preds) {
            let pts = 0;
            const userA = parseInt(p.teamAScore);
            const userB = parseInt(p.teamBScore);
            const userWinA = userA > userB;
            const targetWinA = targetA > targetB;
            let reason = `[${match.customId}]`;

            p.isPerfect = false;

            if (userWinA === targetWinA) {
                pts += 1;
                reason += "胜负对(+1)";
                if (userA === targetA && userB === targetB) {
                    p.isPerfect = true;
                    const bonus = match.format === 'FT4' ? 2 : (match.format === 'FT3' ? 1 : 0.5);
                    pts += bonus;
                    reason += `,比分对(+${bonus})`;
                }
            } else {
                reason += "预测失败";
            }

            p.pointsEarned = pts;
            p.status = 'judged';
            await p.save();
            const u = await User.findById(p.userId);
            if (u) { await u.addPoints(pts, reason, match._id, 'realtime'); }
            updateCount++;
        }

        await logAdminAction("ADMIN_SETTLE", `Match ${match.customId}`, { result: `${scoreA}:${scoreB}`, advanced: `${winnerName} -> Next` });
        res.json({ success: true, message: `结算完毕！${winnerName} 已晋级。` });
    } catch (e) { res.status(500).json({ message: e.message }); }
});

// ==========================================
// 2. 撤销/重置
// ==========================================
router.post('/reset-match', requireAdmin, async (req, res) => {
    const { matchId } = req.body;
    try {
        const match = await Match.findById(matchId);
        if (!match || match.status !== 'finished') return res.status(400).json({ message: '无效操作' });

        const preds = await Prediction.find({ matchId, status: 'judged' });
        for (let p of preds) {
            if (p.pointsEarned > 0) {
                const user = await User.findById(p.userId);
                if (user) { user.totalScore -= p.pointsEarned; await user.save(); }
            }
            p.pointsEarned = 0;
            p.status = 'pending';
            p.isPerfect = false;
            await p.save();
        }
        match.status = 'upcoming';
        match.teamA.score = 0;
        match.teamB.score = 0;
        await match.save();

        await logAdminAction("ADMIN_RESET", `Match ${match.customId}`, { reason: "Rollback" });
        res.json({ success: true, message: '比赛已重置' });
    } catch (e) { res.status(500).json({ message: e.message }); }
});

// ==========================================
// 3. 搜索用户
// ==========================================
router.get('/search-users', requireAdmin, async (req, res) => {
    const q = req.query.q;
    const users = await User.find({ nickname: new RegExp(q, 'i') }).select('nickname totalScore bracketScore').limit(10);
    res.json(users);
});

// ==========================================
// 4. 手动修正分数
// ==========================================
router.post('/manual-score', requireAdmin, async (req, res) => {
    const { userId, points, reason, targetDay } = req.body;
    try {
        const u = await User.findById(userId);
        if (!u) return res.status(404).json({ message: 'Error' });

        const pts = parseFloat(points);
        const day = parseInt(targetDay);

        const oldScore = u.totalScore;
        u.totalScore += pts;

        if (day > 0) {
            u.manualAdjustments.push({ day, points: pts, reason });
        }

        u.scoreLog.push({ reason: `[Admin] ${reason}`, points: pts, source: 'manual' });
        await u.save();

        await logAdminAction("ADMIN_MANUAL_FIX", `User ${u.nickname}`, { points, reason, scoreBefore: oldScore, scoreAfter: u.totalScore });
        res.json({ success: true });
    } catch (e) { res.status(500).json({ message: e.message }); }
});

// ==========================================
// 5. 切换比赛锁定状态
// ==========================================
router.post('/toggle-lock', requireAdmin, async (req, res) => {
    const { matchId } = req.body;
    try {
        const match = await Match.findById(matchId);
        if (!match) return res.status(404).json({ message: '比赛不存在' });

        match.isExplicitlyLocked = !match.isExplicitlyLocked;
        await match.save();

        await Log.create({
            action: match.isExplicitlyLocked ? "ADMIN_LOCK" : "ADMIN_UNLOCK",
            operatorId: "ADMIN",
            operatorName: "Administrator",
            target: `Match ${match.customId}`,
            details: { newState: match.isExplicitlyLocked ? "LOCKED" : "OPEN" }
        });

        res.json({ success: true, message: match.isExplicitlyLocked ? '已锁定 🔒' : '已解锁 🔓' });

    } catch (e) { res.status(500).json({ message: e.message }); }
});

// ==========================================
// 6. 修改比赛开始时间
// ==========================================
router.post('/update-time', requireAdmin, async (req, res) => {
    const { matchId, newStartTime } = req.body;
    try {
        const match = await Match.findById(matchId);
        if (!match) return res.status(404).json({ message: '比赛不存在' });

        const oldTime = match.startTime;
        match.startTime = newStartTime;
        await match.save();

        await Log.create({
            action: "ADMIN_UPDATE_TIME",
            operatorId: "ADMIN",
            operatorName: "Administrator",
            target: `Match ${match.customId}`,
            details: { oldTime, newTime: match.startTime }
        });

        res.json({ success: true, message: '时间已更新' });
    } catch (e) { res.status(500).json({ message: e.message }); }
});

// ==========================================
// 7. 工厂重置
// ==========================================
router.post('/factory-reset', requireAdmin, async (req, res) => {
    const { confirmation } = req.body;
    if (confirmation !== 'DELETE') return res.status(400).json({ message: '确认码错误' });

    try {
        await User.deleteMany({});
        await Prediction.deleteMany({});
        await Log.deleteMany({});
        await Match.deleteMany({});

        await Log.create({ action: "SYSTEM_RESET", operatorId: "ADMIN", operatorName: "Administrator", target: "ALL DATA" });
        res.json({ success: true, message: '☢️ 系统已重置。请手动运行 seed.js 恢复赛程！' });

    } catch (e) { res.status(500).json({ message: e.message }); }
});

module.exports = router;
