// routes/admin.js
const express = require('express');
const router = express.Router();
const Match = require('../models/Match');
const User = require('../models/user');
const Prediction = require('../models/Prediction');
const BracketPrediction = require('../models/BracketPrediction');
const Log = require('../models/Log');
const syncScheduler = require('../lib/sync-scheduler');

const requireAdmin = (req, res, next) => next();

// =======================================================
// 🏆 OWCS 2026 Champions Clash 晋级路线 (8 队双败, 14 场)
// =======================================================
const BRACKET_MAP = {
    "M1": { win:  { to: "M8",  slot: "teamB" }, lose: { to: "M6", slot: "teamA" } },
    "M2": { win:  { to: "M8",  slot: "teamA" }, lose: { to: "M6", slot: "teamB" } },
    "M3": { win:  { to: "M7",  slot: "teamB" }, lose: { to: "M5", slot: "teamB" } },
    "M4": { win:  { to: "M7",  slot: "teamA" }, lose: { to: "M5", slot: "teamA" } },
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

function scoreBonus(format) {
    if (format === 'FT4') return 2;
    if (format === 'FT3') return 1;
    return 0.5;
}

// =======================================================
// 🎯 Bracket 评分: 该场实际参赛队 == 玩家预测两队 (集合相等) 才进入判分
// =======================================================
async function settleBracketForMatch(match) {
    const bps = await BracketPrediction.find({ "picks.matchCustomId": match.customId });
    const targetSet = new Set([match.teamA.name, match.teamB.name]);
    const targetA = match.teamA.score;
    const targetB = match.teamB.score;
    const winnerA = targetA > targetB;

    for (const bp of bps) {
        const pick = bp.picks.find(p => p.matchCustomId === match.customId);
        if (!pick) continue;
        if (pick.status !== 'pending') continue;

        const userSet = new Set([pick.teamAName, pick.teamBName]);
        const teamsMatch = (userSet.size === targetSet.size) && [...targetSet].every(t => userSet.has(t));

        if (!teamsMatch) {
            pick.pointsEarned = 0;
            pick.isPerfect = false;
            pick.status = 'invalid';
            await bp.save();
            continue;
        }

        // 队伍对得上：把玩家分数按 (teamAName==match.teamA.name?) 映射
        const userA = pick.teamAName === match.teamA.name ? pick.teamAScore : pick.teamBScore;
        const userB = pick.teamAName === match.teamA.name ? pick.teamBScore : pick.teamAScore;
        const userWinA = userA > userB;

        let pts = 0;
        let perfect = false;
        if (userWinA === winnerA) {
            pts += 1;
            if (userA === targetA && userB === targetB) {
                pts += scoreBonus(match.format);
                perfect = true;
            }
        }
        pick.pointsEarned = pts;
        pick.isPerfect = perfect;
        pick.status = 'judged';
        bp.bracketScore = bp.picks.reduce((sum, p) => sum + (p.pointsEarned || 0), 0);
        await bp.save();

        // 同步刷 User.bracketScore
        const u = await User.findById(bp.userId);
        if (u) {
            u.bracketScore = bp.bracketScore;
            u.scoreLog.push({
                matchId: match._id,
                reason: `[Bracket ${match.customId}] ${pts > 0 ? (perfect ? '比分对' : '胜负对') : '失败'} (+${pts})`,
                points: pts,
                source: 'bracket'
            });
            await u.save();
        }
    }
}

// 撤销 bracket 结算 (reset-match 时调用)
async function rollbackBracketForMatch(match) {
    const bps = await BracketPrediction.find({ "picks.matchCustomId": match.customId });
    for (const bp of bps) {
        const pick = bp.picks.find(p => p.matchCustomId === match.customId);
        if (!pick) continue;
        pick.pointsEarned = 0;
        pick.isPerfect = false;
        pick.status = 'pending';
        bp.bracketScore = bp.picks.reduce((sum, p) => sum + (p.pointsEarned || 0), 0);
        await bp.save();
        const u = await User.findById(bp.userId);
        if (u) {
            u.bracketScore = bp.bracketScore;
            await u.save();
        }
    }
}

// =======================================================
// 核心 settle 函数 (HTTP + 自动同步共用)
// =======================================================
async function settleMatchCore(matchId, scoreA, scoreB) {
    const match = await Match.findById(matchId);
    if (!match) throw new Error('比赛不存在');
    if (match.status === 'finished') throw new Error('已结算');
    if (match.teamA.name === 'TBD' || match.teamB.name === 'TBD') {
        throw new Error('无法结算：参赛队伍尚未确定');
    }

    match.teamA.score = parseInt(scoreA);
    match.teamB.score = parseInt(scoreB);
    match.status = 'finished';
    await match.save();

    const targetA = match.teamA.score;
    const targetB = match.teamB.score;
    const winnerName = targetA > targetB ? match.teamA.name : match.teamB.name;
    const loserName  = targetA > targetB ? match.teamB.name : match.teamA.name;

    await advanceTeams(match, winnerName, loserName);

    // 实时单场预测结算
    const preds = await Prediction.find({ matchId });
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
            reason += '胜负对(+1)';
            if (userA === targetA && userB === targetB) {
                p.isPerfect = true;
                const bonus = scoreBonus(match.format);
                pts += bonus;
                reason += `,比分对(+${bonus})`;
            }
        } else {
            reason += '预测失败';
        }

        p.pointsEarned = pts;
        p.status = 'judged';
        await p.save();
        const u = await User.findById(p.userId);
        if (u) await u.addPoints(pts, reason, match._id, 'realtime');
    }

    // Bracket 预测结算
    await settleBracketForMatch(match);

    return { winnerName, loserName };
}

// 反向撤销：把当前比赛在下游 (M_next) 占的 slot 清回 TBD。
// 若下游也已结算，先递归撤销下游 (它会再清自己的下游)，然后再清 slot。
async function revertDownstream(match, revokedList) {
    const path = BRACKET_MAP[match.customId];
    if (!path) return;

    for (const branch of ['win', 'lose']) {
        const target = path[branch];
        if (!target) continue;

        const nextMatch = await Match.findOne({ customId: target.to });
        if (!nextMatch) continue;

        // 下游已结算则先递归撤销 (内部会处理它自己的下游)
        if (nextMatch.status === 'finished') {
            await resetMatchCore(nextMatch._id, revokedList);
        }

        // 重新读 (递归可能改过它),把这场比赛占的 slot 清回 TBD
        const refreshed = await Match.findOne({ customId: target.to });
        if (!refreshed) continue;
        if (target.slot === 'teamA') refreshed.teamA.name = 'TBD';
        if (target.slot === 'teamB') refreshed.teamB.name = 'TBD';
        await refreshed.save();
    }
}

async function resetMatchCore(matchId, revokedList = []) {
    const match = await Match.findById(matchId);
    if (!match) throw new Error('比赛不存在');
    if (match.status !== 'finished') throw new Error('无效操作: 该场未结算');

    revokedList.push(match.customId);

    // 先递归撤销下游 (含清掉下游里本场占的 slot)
    await revertDownstream(match, revokedList);

    // 回滚实时预测分
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

    // 回滚 bracket 分
    await rollbackBracketForMatch(match);

    match.status = 'upcoming';
    match.teamA.score = 0;
    match.teamB.score = 0;
    await match.save();
}

// ==========================================
// 1. 结算比赛
// ==========================================
router.post('/settle', requireAdmin, async (req, res) => {
    const { matchId, scoreA, scoreB } = req.body;
    try {
        const { winnerName } = await settleMatchCore(matchId, scoreA, scoreB);
        const match = await Match.findById(matchId);
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
        const revoked = [];
        await resetMatchCore(matchId, revoked);
        const match = await Match.findById(matchId);
        await logAdminAction("ADMIN_RESET", `Match ${match.customId}`, { reason: "Rollback", cascade: revoked });
        const cascade = revoked.length > 1 ? ` (级联撤销: ${revoked.join(' → ')})` : '';
        res.json({ success: true, message: `比赛已重置${cascade}`, revoked });
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
        if (day > 0) u.manualAdjustments.push({ day, points: pts, reason });
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
// 7. 工厂重置 (同步清 BracketPrediction)
// ==========================================
router.post('/factory-reset', requireAdmin, async (req, res) => {
    const { confirmation } = req.body;
    if (confirmation !== 'DELETE') return res.status(400).json({ message: '确认码错误' });

    try {
        await User.deleteMany({});
        await Prediction.deleteMany({});
        await BracketPrediction.deleteMany({});
        await Log.deleteMany({});
        await Match.deleteMany({});

        await Log.create({ action: "SYSTEM_RESET", operatorId: "ADMIN", operatorName: "Administrator", target: "ALL DATA" });
        res.json({ success: true, message: '☢️ 系统已重置。请手动运行 seed.js 恢复赛程！' });
    } catch (e) { res.status(500).json({ message: e.message }); }
});

// ==========================================
// 8. Liquipedia 同步状态 / 控制
// ==========================================
router.get('/sync-status', requireAdmin, (req, res) => {
    res.json(syncScheduler.status());
});

router.post('/sync-pause', requireAdmin, async (req, res) => {
    syncScheduler.pause();
    await logAdminAction("ADMIN_SYNC_PAUSE", "Liquipedia Sync", {});
    res.json({ success: true, ...syncScheduler.status() });
});

router.post('/sync-resume', requireAdmin, async (req, res) => {
    syncScheduler.resume();
    await logAdminAction("ADMIN_SYNC_RESUME", "Liquipedia Sync", {});
    res.json({ success: true, ...syncScheduler.status() });
});

router.post('/sync-now', requireAdmin, async (req, res) => {
    try {
        const result = await syncScheduler.manualSync();
        await logAdminAction("ADMIN_SYNC_NOW", "Liquipedia Sync", { diffs: result.diffs.length });
        res.json({ success: true, diffs: result.diffs });
    } catch (e) {
        res.status(500).json({ message: e.message });
    }
});

module.exports = router;
module.exports.settleMatchCore = settleMatchCore;
module.exports.resetMatchCore = resetMatchCore;
