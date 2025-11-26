const express = require('express');
const router = express.Router();
const Match = require('../models/Match');
const User = require('../models/user');
const Prediction = require('../models/Prediction');
const Log = require('../models/Log');

const requireAdmin = (req, res, next) => next(); 

// =======================================================
// 🏆 核心逻辑：OWCS 2025 多伦多晋级路线图
// =======================================================
const BRACKET_MAP = {
    // Round 1 -> Round 2 & Losers R1
    "M1": { win: { to: "M7", slot: "teamB" }, lose: { to: "M11", slot: "teamB" } }, 
    "M2": { win: { to: "M8", slot: "teamB" }, lose: { to: "M12", slot: "teamB" } }, 
    "M3": { win: { to: "M6", slot: "teamB" }, lose: { to: "M10", slot: "teamB" } }, 
    "M4": { win: { to: "M5", slot: "teamB" }, lose: { to: "M9", slot: "teamB" } },  

    // Round 2 -> Winners Finals & Losers R1
    "M5": { win: { to: "M15", slot: "teamA" }, lose: { to: "M12", slot: "teamA" } },
    "M6": { win: { to: "M15", slot: "teamB" }, lose: { to: "M11", slot: "teamA" } },
    "M7": { win: { to: "M16", slot: "teamA" }, lose: { to: "M10", slot: "teamA" } },
    "M8": { win: { to: "M16", slot: "teamB" }, lose: { to: "M9", slot: "teamA" } },

    // Losers R1 -> Losers R2
    "M9":  { win: { to: "M13", slot: "teamA" } },
    "M10": { win: { to: "M13", slot: "teamB" } },
    "M11": { win: { to: "M14", slot: "teamA" } },
    "M12": { win: { to: "M14", slot: "teamB" } },

    // Losers R2 -> Losers R3
    "M13": { win: { to: "M17", slot: "teamB" } },
    "M14": { win: { to: "M18", slot: "teamB" } },

    // Upper Semis -> UBF & Losers R3
    "M15": { win: { to: "UBF", slot: "teamA" }, lose: { to: "M17", slot: "teamA" } },
    "M16": { win: { to: "UBF", slot: "teamB" }, lose: { to: "M18", slot: "teamA" } },

    // Losers R3 -> Losers Semis
    "M17": { win: { to: "M19", slot: "teamA" } },
    "M18": { win: { to: "M19", slot: "teamB" } },

    // Losers Semis -> LBF
    "M19": { win: { to: "LBF", slot: "teamB" } },

    // Upper Bracket Finals -> GF & LBF
    "UBF": { win: { to: "GF", slot: "teamA" }, lose: { to: "LBF", slot: "teamA" } },

    // Lower Bracket Finals -> GF
    "LBF": { win: { to: "GF", slot: "teamB" } }
};

// 辅助：处理晋级
async function advanceTeams(match, winnerName, loserName) {
    const path = BRACKET_MAP[match.customId];
    if (!path) return; 

    // 处理胜者
    if (path.win) {
        const nextMatch = await Match.findOne({ customId: path.win.to });
        if (nextMatch) {
            if (path.win.slot === 'teamA') nextMatch.teamA.name = winnerName;
            if (path.win.slot === 'teamB') nextMatch.teamB.name = winnerName;
            await nextMatch.save();
        }
    }
    // 处理败者
    if (path.lose) {
        const nextMatch = await Match.findOne({ customId: path.lose.to });
        if (nextMatch) {
            if (path.lose.slot === 'teamA') nextMatch.teamA.name = loserName;
            if (path.lose.slot === 'teamB') nextMatch.teamB.name = loserName;
            await nextMatch.save();
        }
    }
}

// 辅助日志
async function logAdminAction(action, target, details) {
    await Log.create({ action, operatorId: "ADMIN", operatorName: "Administrator", target, details });
}

// 辅助：获取用户最近 N 场已结算的预测 (用于连续成就)
async function getUserHistory(userId, limit) {
    const finishedMatches = await Match.find({ status: 'finished' }).select('_id startTime').sort({ startTime: -1 });
    const finishedMatchIds = finishedMatches.map(m => m._id);
    return await Prediction.find({ userId: userId, matchId: { $in: finishedMatchIds }, status: 'judged' })
        .populate('matchId').sort({ 'matchId.startTime': -1 }).limit(limit);
}

// 辅助：核心成就判定逻辑
async function processAchievements(currentMatch) {
    const currentPreds = await Prediction.find({ matchId: currentMatch._id, status: 'judged' });
    if (currentPreds.length === 0) return [];

    const matchesToday = await Match.find({ day: currentMatch.day });
    const pendingMatches = matchesToday.filter(m => m.status !== 'finished' && m._id.toString() !== currentMatch._id.toString());
    const isLastMatchOfDay = pendingMatches.length === 0;

    let logs = [];
    const achievementRules = [
        {
            name: "喜忧参半", type: "instant",
            check: async () => currentPreds.filter(p => p.pointsEarned > 0 && !p.isPerfect).map(p => p.userId)
        },
        {
            name: "闪电念", type: "streak",
            check: async () => {
                const candidates = currentPreds.filter(p => p.isPerfect).map(p => p.userId);
                let winners = [];
                for (let uid of candidates) {
                    const history = await getUserHistory(uid, 3);
                    if (history.length === 3 && history.every(p => p.isPerfect)) winners.push(uid);
                }
                return winners;
            }
        },
        {
            name: "老开爱炸墙", type: "streak",
            check: async () => {
                const candidates = currentPreds.filter(p => p.pointsEarned === 0).map(p => p.userId);
                let winners = [];
                for (let uid of candidates) {
                    const history = await getUserHistory(uid, 3);
                    if (history.length === 3 && history.every(p => p.pointsEarned === 0)) winners.push(uid);
                }
                return winners;
            }
        },
        {
            name: "吃土豆", type: "daily",
            check: async () => {
                if (!isLastMatchOfDay) return [];
                const matchIds = matchesToday.map(m => m._id);
                const allDailyPreds = await Prediction.find({ matchId: { $in: matchIds } });
                const userMap = {};
                allDailyPreds.forEach(p => { if(!userMap[p.userId]) userMap[p.userId]=[]; userMap[p.userId].push(p); });
                let winners = [];
                for (let uid in userMap) {
                    if (userMap[uid].length === matchIds.length && userMap[uid].every(p => p.pointsEarned === 0)) winners.push(uid);
                }
                return winners;
            }
        }
    ];

    for (let rule of achievementRules) {
        const isClaimed = await User.exists({ "achievements.name": rule.name });
        if (isClaimed) continue;

        const winnerIds = await rule.check();
        if (winnerIds && winnerIds.length > 0) {
            for (let uid of winnerIds) {
                const user = await User.findById(uid);
                if (user && !user.achievements.some(a => a.name === rule.name)) {
                    user.achievements.push({ name: rule.name });
                    user.totalScore += 0.5;
                    user.scoreLog.push({ reason: `🏆 抢到首杀成就: [${rule.name}]`, points: 0.5, matchId: currentMatch._id });
                    await user.save();
                    logs.push(`${user.nickname} 夺得 [${rule.name}]`);
                }
            }
        }
    }
    return logs;
}


// ==========================================
// 1. 结算比赛 (Settle) + 自动晋级 + 成就
// ==========================================
router.post('/settle', requireAdmin, async (req, res) => {
    const { matchId, scoreA, scoreB } = req.body;
    try {
        const match = await Match.findById(matchId);
        if (!match || match.status === 'finished') return res.status(400).json({message: 'Error'});

        // 1. 检查占位符
        if (match.teamA.name === 'TBD' || match.teamB.name === 'TBD') {
            return res.status(400).json({ message: '无法结算：参赛队伍尚未确定 (TBD)' });
        }

        match.teamA.score = scoreA; match.teamB.score = scoreB; match.status = 'finished';
        await match.save();

        // 2. 自动晋级
        const winnerName = parseInt(scoreA) > parseInt(scoreB) ? match.teamA.name : match.teamB.name;
        const loserName = parseInt(scoreA) > parseInt(scoreB) ? match.teamB.name : match.teamA.name;
        await advanceTeams(match, winnerName, loserName);

        // 3. 判分
        const preds = await Prediction.find({ matchId });
        let updateCount = 0;
        let totalPoints = 0;
        
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
                    let bonus = match.format === 'FT4' ? 2 : (match.format === 'FT3' ? 1 : 0.5);
                    pts += bonus;
                    reason += `,比分对(+${bonus})`;
                }
            } else {
                reason += "预测失败";
            }

            p.pointsEarned = pts; p.status = 'judged'; await p.save();
            const u = await User.findById(p.userId);
            if (u) { await u.addPoints(pts, reason, match._id, match.startTime.toISOString().split('T')[0]); totalPoints += pts; }
            updateCount++;
        }

        // 4. 成就结算
        const achievementLogs = await processAchievements(match);

        await logAdminAction("ADMIN_SETTLE", `Match ${match.customId}`, { result: `${scoreA}:${scoreB}`, advanced: `${winnerName} -> Next`, newAchievements: achievementLogs });
        res.json({ success: true, message: `结算完毕！${winnerName} 已晋级。`, achievements: achievementLogs });
    } catch (e) { res.status(500).json({message: e.message}); }
});

// ==========================================
// 2. 撤销/重置
// ==========================================
router.post('/reset-match', requireAdmin, async (req, res) => {
    const { matchId } = req.body;
    try {
        const match = await Match.findById(matchId);
        if (!match || match.status !== 'finished') return res.status(400).json({message: '无效操作'});
        
        const preds = await Prediction.find({ matchId, status: 'judged' });
        for (let p of preds) {
            if (p.pointsEarned > 0) {
                const user = await User.findById(p.userId);
                if (user) { user.totalScore -= p.pointsEarned; await user.save(); }
            }
            p.pointsEarned = 0; p.status = 'pending'; p.isPerfect = false; await p.save();
        }
        match.status = 'upcoming'; match.teamA.score = 0; match.teamB.score = 0; await match.save();
        
        await logAdminAction("ADMIN_RESET", `Match ${match.customId}`, { reason: "Rollback" });
        res.json({ success: true, message: '比赛已重置' });
    } catch (e) { res.status(500).json({message: e.message}); }
});

// ==========================================
// 3. 搜索用户
// ==========================================
router.get('/search-users', requireAdmin, async (req, res) => {
    const q = req.query.q;
    const users = await User.find({ nickname: new RegExp(q, 'i') }).select('nickname totalScore achievements').limit(10);
    res.json(users);
});

// ==========================================
// 4. 手动修正分数
// ==========================================
router.post('/manual-score', requireAdmin, async (req, res) => {
    const { userId, points, reason, targetDay } = req.body;
    try {
        const u = await User.findById(userId);
        if(!u) return res.status(404).json({message:'Error'});
        
        const pts = parseFloat(points);
        const day = parseInt(targetDay);
        
        const oldScore = u.totalScore;
        u.totalScore += pts;
        
        let dayLog = "";
        if(day > 0) {
            u.manualAdjustments.push({day: day, points: pts, reason});
            dayLog = ` (Day ${day})`;
        }
        
        u.scoreLog.push({reason:`[Admin] ${reason}${dayLog}`, points: pts});
        await u.save();
        
        await logAdminAction("ADMIN_MANUAL_FIX", `User ${u.nickname}`, {points, reason, scoreBefore: oldScore, scoreAfter: u.totalScore});
        res.json({success:true});
    } catch(e){ res.status(500).json({message:e.message}); }
});

// ==========================================
// 5. 管理用户成就
// ==========================================
router.post('/manage-achievement', requireAdmin, async (req, res) => {
    const { userId, action, achievementName } = req.body;
    try {
        const u = await User.findById(userId);
        if(!u) return res.status(404).json({message:'Error'});
        
        const oldScore = u.totalScore;
        let change = 0;

        if(action==='add') {
            if(u.achievements.some(a=>a.name===achievementName)) return res.status(400).json({message:'已拥有'});
            u.achievements.push({name:achievementName}); 
            u.totalScore+=0.5; change=0.5;
            u.scoreLog.push({reason: `[管理员颁发] ${achievementName}`, points: 0.5});
        } 
        else if(action==='remove') {
            const i=u.achievements.findIndex(a=>a.name===achievementName); 
            if(i===-1) return res.status(400).json({message:'未拥有'});
            u.achievements.splice(i,1); 
            u.totalScore-=0.5; change=-0.5;
            u.scoreLog.push({reason: `[管理员移除] ${achievementName}`, points: -0.5});
        }
        
        await u.save();
        await logAdminAction("ADMIN_ACHIEVEMENT", `User ${u.nickname}`, {action, achievementName, scoreBefore: oldScore, scoreAfter: u.totalScore});
        res.json({success:true});
    } catch(e){ res.status(500).json({message:e.message}); }
});
// ... (前面的代码保持不变)

// ==========================================
// 6. [新增] 切换比赛锁定状态 (Lock/Unlock)
// ==========================================
router.post('/toggle-lock', requireAdmin, async (req, res) => {
    const { matchId } = req.body;
    try {
        const match = await Match.findById(matchId);
        if (!match) return res.status(404).json({ message: '比赛不存在' });

        // 切换状态 (true -> false, false -> true)
        match.isExplicitlyLocked = !match.isExplicitlyLocked;
        await match.save();

        // 记录日志
        const actionType = match.isExplicitlyLocked ? "LOCK_MATCH" : "UNLOCK_MATCH";
        await Log.create({
            action: `ADMIN_${actionType}`,
            operatorId: "ADMIN",
            operatorName: "Administrator",
            target: `Match ${match.customId}`,
            details: { newState: match.isExplicitlyLocked ? "LOCKED 🔒" : "OPEN 🔓" }
        });

        res.json({ 
            success: true, 
            message: match.isExplicitlyLocked ? '已锁定 🔒' : '已解锁 🔓', 
            isLocked: match.isExplicitlyLocked 
        });

    } catch (e) { res.status(500).json({ message: e.message }); }
});
// ==========================================
// 7. [新增] 修改比赛开始时间 (Update Start Time)
// ==========================================
router.post('/update-time', requireAdmin, async (req, res) => {
    const { matchId, newStartTime } = req.body;
    
    try {
        const match = await Match.findById(matchId);
        if (!match) return res.status(404).json({ message: '比赛不存在' });

        // 保存旧时间用于日志
        const oldTime = match.startTime;
        
        // 更新时间 (前端传来的是 ISO 格式字符串，Mongoose 会自动转为 Date)
        match.startTime = newStartTime;
        await match.save();

        // 记录管理员操作日志
        await Log.create({
            action: "ADMIN_UPDATE_TIME",
            operatorId: "ADMIN",
            operatorName: "Administrator",
            target: `Match ${match.customId}`,
            details: { 
                oldTime: oldTime,
                newTime: match.startTime,
                note: "管理员手动调整比赛时间"
            }
        });

        res.json({ success: true, message: `时间已更新！\n比赛锁定时间现已变更为: ${new Date(newStartTime).toLocaleString()}` });

    } catch (e) { 
        console.error(e);
        res.status(500).json({ message: e.message }); 
    }
});
module.exports = router;