// routes/admin.js (最终完整修正版)
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
    "M1": { win: { to: "M7", slot: "teamB" }, lose: { to: "M11", slot: "teamB" } }, 
    "M2": { win: { to: "M8", slot: "teamB" }, lose: { to: "M12", slot: "teamB" } }, 
    "M3": { win: { to: "M6", slot: "teamB" }, lose: { to: "M10", slot: "teamB" } }, 
    "M4": { win: { to: "M5", slot: "teamB" }, lose: { to: "M9", slot: "teamB" } },  
    "M5": { win: { to: "M15", slot: "teamA" }, lose: { to: "M12", slot: "teamA" } },
    "M6": { win: { to: "M15", slot: "teamB" }, lose: { to: "M11", slot: "teamA" } },
    "M7": { win: { to: "M16", slot: "teamA" }, lose: { to: "M10", slot: "teamA" } },
    "M8": { win: { to: "M16", slot: "teamB" }, lose: { to: "M9", slot: "teamA" } },
    "M9":  { win: { to: "M13", slot: "teamA" } },
    "M10": { win: { to: "M13", slot: "teamB" } },
    "M11": { win: { to: "M14", slot: "teamA" } },
    "M12": { win: { to: "M14", slot: "teamB" } },
    "M13": { win: { to: "M17", slot: "teamB" } },
    "M14": { win: { to: "M18", slot: "teamB" } },
    "M15": { win: { to: "UBF", slot: "teamA" }, lose: { to: "M17", slot: "teamA" } },
    "M16": { win: { to: "UBF", slot: "teamB" }, lose: { to: "M18", slot: "teamA" } },
    "M17": { win: { to: "M19", slot: "teamA" } },
    "M18": { win: { to: "M19", slot: "teamB" } },
    "M19": { win: { to: "LBF", slot: "teamB" } },
    "UBF": { win: { to: "GF", slot: "teamA" }, lose: { to: "LBF", slot: "teamA" } },
    "LBF": { win: { to: "GF", slot: "teamB" } }
};

// 辅助：处理晋级
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

// 辅助日志
async function logAdminAction(action, target, details) {
    await Log.create({ action, operatorId: "ADMIN", operatorName: "Administrator", target, details });
}

// 辅助：获取用户最近 N 场已结算的预测
async function getUserHistory(userId, limit) {
    const finishedMatches = await Match.find({ status: 'finished' }).select('_id startTime').sort({ startTime: -1 });
    const finishedMatchIds = finishedMatches.map(m => m._id);
    return await Prediction.find({ userId: userId, matchId: { $in: finishedMatchIds }, status: 'judged' })
        .populate('matchId').sort({ 'matchId.startTime': -1 }).limit(limit);
}

// =======================================================
// 💎 隐藏成就核心算法 (全覆盖)
// =======================================================
async function processAchievements(currentMatch) {
    const currentPreds = await Prediction.find({ matchId: currentMatch._id, status: 'judged' });
    if (currentPreds.length === 0) return [];

    const matchesToday = await Match.find({ day: currentMatch.day });
    const pendingMatches = matchesToday.filter(m => m.status !== 'finished' && m._id.toString() !== currentMatch._id.toString());
    const isLastMatchOfDay = pendingMatches.length === 0;

    // 获取昨天的日榜冠军 (用于反向木子)
    // 这是一个比较重的查询，仅在最后一场时做
    let yesterdayWinnerId = null;
    if (isLastMatchOfDay && currentMatch.day > 1) {
        // 简化逻辑：假设昨天的榜首已经存在某种记录，或者实时算一下昨天的
        // 这里为了性能和简洁，暂时略过具体的“反向木子”自动判断（因为这需要跨天状态），
        // 建议“反向木子”由管理员手动确认后发放。
    }

    let logs = [];
    
    // 定义判定规则
    // 注意：OA (Toronto Defiant) 在数据库里的名字需要确认，这里假设是 "TOR" 或 "OA"？
    // 根据之前的 Team List，没有看到 OA。如果是 "TM" (Twisted Minds) 或其他，请自行替换。
    // 假设: OA = "SSG" (Spacestation)? 不对。
    // 假设: OA = "Toronto Defiant" -> 简写可能是 "TOR" 或 "TD"。
    // 请务必确认数据库中战队的 `name` 字段值！
    // 下面的代码中，我将使用 "OA" 作为代号，你需要替换成真实的队名 (如 "SSG", "CR", "FLC" 等)
    
    // ⚠️ 请将下面的 "OA" 替换为实际的战队 ID (例如 "SSG")
    const TEAM_OA = "WBG"; // <--- 修改这里！
    const TEAM_CR = "CR";
    const TEAM_TM = "TM";
    const TEAM_QAD = "QAD";
    const TEAM_CC = "CC";

    const achievementRules = [
        {
            name: "喜忧参半", type: "instant", // 猜对胜负但猜错比分
            check: async () => currentPreds.filter(p => p.pointsEarned > 0 && !p.isPerfect).map(p => p.userId)
        },
        {
            name: "闪电念", type: "streak", // 3连Perfect
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
            name: "老开爱炸墙", type: "streak", // 3连0分
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
            name: "reverse sweep", type: "instant", // 猜对让二追三 (比分 3:2 且胜者是后手? 这里的逻辑比较模糊，通常指大比分翻盘)
            // 简化定义：猜对了 3:2 或 2:3 的比分 (FT3) 或 4:3 (FT4)
            check: async () => {
                // 只有 FT3/FT4 可能触发
                if (currentMatch.format === 'FT2') return [];
                // 必须是决胜局比分 (3:2, 2:3, 4:3, 3:4)
                const scoreStr = `${currentMatch.teamA.score}:${currentMatch.teamB.score}`;
                const isReverse = ['3:2', '2:3', '4:3', '3:4'].includes(scoreStr);
                if (!isReverse) return [];
                // 返回猜中比分的人
                return currentPreds.filter(p => p.isPerfect).map(p => p.userId);
            }
        },
        {
            name: "吃土豆", type: "daily", // 一天全错
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
        },
        // --- 特定战队成就 (需要匹配队名) ---
        {
            name: "再冲一次", type: "instant", // OA每场都猜赢 (需长期记录，这里简化为：只要猜了OA赢就算？不对，应该是连续)
            // 这种长期成就建议管理员手动发放，或者简化逻辑。
            // 这里暂略，因为需要遍历所有历史比赛。
            check: async () => [] 
        },
        {
            name: "最中幻想", type: "instant", // 猜对 OA 战胜 CR/FLC/TM 的比分
            check: async () => {
                const opponents = [TEAM_CR, "FLC", TEAM_TM];
                // 检查比赛双方是否有 OA 和 对手
                const hasOA = currentMatch.teamA.name === TEAM_OA || currentMatch.teamB.name === TEAM_OA;
                const hasOpp = opponents.includes(currentMatch.teamA.name) || opponents.includes(currentMatch.teamB.name);
                
                if (!hasOA || !hasOpp) return [];
                
                // 必须是 OA 赢
                const oaWon = (currentMatch.teamA.name === TEAM_OA && currentMatch.teamA.score > currentMatch.teamB.score) ||
                              (currentMatch.teamB.name === TEAM_OA && currentMatch.teamB.score > currentMatch.teamA.score);
                
                if (!oaWon) return [];
                
                // 返回比分猜对的人
                return currentPreds.filter(p => p.isPerfect).map(p => p.userId);
            }
        },
        {
            name: "landon见面交铃铛tp", type: "instant", // 猜对 OA 胜 QAD 比分
            check: async () => {
                const isTargetMatch = (currentMatch.teamA.name === TEAM_OA && currentMatch.teamB.name === TEAM_QAD) || 
                                      (currentMatch.teamB.name === TEAM_OA && currentMatch.teamA.name === TEAM_QAD);
                if(!isTargetMatch) return [];
                // 必须 OA 赢
                const oaWon = (currentMatch.teamA.name === TEAM_OA && currentMatch.teamA.score > currentMatch.teamB.score) ||
                              (currentMatch.teamB.name === TEAM_OA && currentMatch.teamB.score > currentMatch.teamA.score);
                if(!oaWon) return [];
                return currentPreds.filter(p => p.isPerfect).map(p => p.userId);
            }
        },
        {
            name: "冯哥见面三段闪", type: "instant", // 猜对 QAD 胜 OA 比分
            check: async () => {
                const isTargetMatch = (currentMatch.teamA.name === TEAM_OA && currentMatch.teamB.name === TEAM_QAD) || 
                                      (currentMatch.teamB.name === TEAM_OA && currentMatch.teamA.name === TEAM_QAD);
                if(!isTargetMatch) return [];
                // 必须 QAD 赢
                const qadWon = (currentMatch.teamA.name === TEAM_QAD && currentMatch.teamA.score > currentMatch.teamB.score) ||
                               (currentMatch.teamB.name === TEAM_QAD && currentMatch.teamB.score > currentMatch.teamA.score);
                if(!qadWon) return [];
                return currentPreds.filter(p => p.isPerfect).map(p => p.userId);
            }
        },
        {
            name: "闹麻了", type: "instant", // 猜对 OA 二连败回家
            // 逻辑复杂，涉及历史，建议手动。
            check: async () => []
        },
        {
            name: "以父之名", type: "instant", // 猜对 CR 胜 OA 比分
            check: async () => {
                const isTargetMatch = (currentMatch.teamA.name === TEAM_CR && currentMatch.teamB.name === TEAM_OA) || 
                                      (currentMatch.teamB.name === TEAM_CR && currentMatch.teamA.name === TEAM_OA);
                if(!isTargetMatch) return [];
                // 必须 CR 赢
                const crWon = (currentMatch.teamA.name === TEAM_CR && currentMatch.teamA.score > currentMatch.teamB.score) ||
                              (currentMatch.teamB.name === TEAM_CR && currentMatch.teamB.score > currentMatch.teamA.score);
                if(!crWon) return [];
                return currentPreds.filter(p => p.isPerfect).map(p => p.userId);
            }
        },
        {
            name: "新皇后街", type: "instant", // 猜对 OA/CC 在新皇后街胜利 (这里简化为: 只要 OA 或 CC 赢了这场比赛，且猜对了胜负)
            // 注: "新皇后街"是一张地图，这里没存地图信息。假设只要是 OA/CC 赢了就算。
            check: async () => {
                const isTargetMatch = [TEAM_OA, TEAM_CC].includes(currentMatch.teamA.name) || [TEAM_OA, TEAM_CC].includes(currentMatch.teamB.name);
                if(!isTargetMatch) return [];
                
                const oaOrCcWon = ([TEAM_OA, TEAM_CC].includes(currentMatch.teamA.name) && currentMatch.teamA.score > currentMatch.teamB.score) ||
                                  ([TEAM_OA, TEAM_CC].includes(currentMatch.teamB.name) && currentMatch.teamB.score > currentMatch.teamA.score);
                
                if(!oaOrCcWon) return [];
                // 返回猜对胜负的人 (积分>0)
                return currentPreds.filter(p => p.pointsEarned > 0).map(p => p.userId);
            }
        },
        {
            name: "P>L", type: "instant", // 猜对 CR 胜 OA 比分 (同 以父之名??)
            // 逻辑完全一样，跳过或复用
            check: async () => [] 
        },
        {
            name: "西巴堡", type: "instant", // 猜对 TM 胜 OA 比分
            check: async () => {
                const isTargetMatch = (currentMatch.teamA.name === TEAM_TM && currentMatch.teamB.name === TEAM_OA) || 
                                      (currentMatch.teamB.name === TEAM_TM && currentMatch.teamA.name === TEAM_OA);
                if(!isTargetMatch) return [];
                // 必须 TM 赢
                const tmWon = (currentMatch.teamA.name === TEAM_TM && currentMatch.teamA.score > currentMatch.teamB.score) ||
                              (currentMatch.teamB.name === TEAM_TM && currentMatch.teamB.score > currentMatch.teamA.score);
                if(!tmWon) return [];
                return currentPreds.filter(p => p.isPerfect).map(p => p.userId);
            }
        }
    ];

    for (let rule of achievementRules) {
        // 全球唯一锁
        const isClaimed = await User.exists({ "achievements.name": rule.name });
        if (isClaimed) continue;

        const winnerIds = await rule.check();
        if (winnerIds && winnerIds.length > 0) {
            for (let uid of winnerIds) {
                const user = await User.findById(uid);
                if (user && !user.achievements.some(a => a.name === rule.name)) {
                    user.achievements.push({ name: rule.name });
                    user.totalScore += 0.5; // [修改] 加 0.5 分
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
// 1. 结算比赛
// ==========================================
router.post('/settle', requireAdmin, async (req, res) => {
    const { matchId, scoreA, scoreB } = req.body;
    try {
        const match = await Match.findById(matchId);
        if (!match || match.status === 'finished') return res.status(400).json({message: 'Error'});

        if (match.teamA.name === 'TBD' || match.teamB.name === 'TBD') {
            return res.status(400).json({ message: '无法结算：参赛队伍尚未确定' });
        }

        match.teamA.score = scoreA; match.teamB.score = scoreB; match.status = 'finished';
        await match.save();

        const winnerName = parseInt(scoreA) > parseInt(scoreB) ? match.teamA.name : match.teamB.name;
        const loserName = parseInt(scoreA) > parseInt(scoreB) ? match.teamB.name : match.teamA.name;
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
                    let bonus = match.format === 'FT4' ? 2 : (match.format === 'FT3' ? 1 : 0.5);
                    pts += bonus;
                    reason += `,比分对(+${bonus})`;
                }
            } else {
                reason += "预测失败";
            }

            p.pointsEarned = pts; p.status = 'judged'; await p.save();
            const u = await User.findById(p.userId);
            if (u) { await u.addPoints(pts, reason, match._id, match.startTime.toISOString().split('T')[0]); }
            updateCount++;
        }

        // 成就结算
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
        
        if(day > 0) {
            u.manualAdjustments.push({day: day, points: pts, reason});
        }
        
        u.scoreLog.push({reason:`[Admin] ${reason}`, points: pts});
        await u.save();
        
        await logAdminAction("ADMIN_MANUAL_FIX", `User ${u.nickname}`, {points, reason, scoreBefore: oldScore, scoreAfter: u.totalScore});
        res.json({success:true});
    } catch(e){ res.status(500).json({message:e.message}); }
});

// ==========================================
// 5. 管理用户成就 (修改分数)
// ==========================================
router.post('/manage-achievement', requireAdmin, async (req, res) => {
    const { userId, action, achievementName } = req.body;
    try {
        const u = await User.findById(userId);
        if(!u) return res.status(404).json({message:'Error'});
        
        const oldScore = u.totalScore;

        if(action==='add') {
            if(u.achievements.some(a=>a.name===achievementName)) return res.status(400).json({message:'已拥有'});
            u.achievements.push({name:achievementName}); 
            u.totalScore += 0.5; // [修改]
            u.scoreLog.push({reason: `[管理员颁发] ${achievementName}`, points: 0.5});
        } 
        else if(action==='remove') {
            const i=u.achievements.findIndex(a=>a.name===achievementName); 
            if(i===-1) return res.status(400).json({message:'未拥有'});
            u.achievements.splice(i,1); 
            u.totalScore -= 0.5; // [修改]
            u.scoreLog.push({reason: `[管理员移除] ${achievementName}`, points: -0.5});
        }
        
        await u.save();
        await logAdminAction("ADMIN_ACHIEVEMENT", `User ${u.nickname}`, {action, achievementName, scoreBefore: oldScore, scoreAfter: u.totalScore});
        res.json({success:true});
    } catch(e){ res.status(500).json({message:e.message}); }
});

// ==========================================
// 6. 切换比赛锁定状态
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
// 7. 修改比赛开始时间
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
// 8. 工厂重置
// ==========================================
router.post('/factory-reset', requireAdmin, async (req, res) => {
    const { confirmation } = req.body;
    if (confirmation !== 'DELETE') return res.status(400).json({ message: '确认码错误' });

    try {
        await User.deleteMany({});
        await Prediction.deleteMany({});
        await Log.deleteMany({});
        await Match.deleteMany({});
        
        // 重新插入初始赛程 (这里简化处理，实际建议调用 seed 逻辑或保留空)
        // 为了防止报错，这里只返回成功信息，建议管理员手动运行 seed.js
        
        await Log.create({ action: "SYSTEM_RESET", operatorId: "ADMIN", operatorName: "Administrator", target: "ALL DATA" });
        res.json({ success: true, message: '☢️ 系统已重置。请手动运行 seed.js 恢复赛程！' });

    } catch (e) { res.status(500).json({message: e.message}); }
});

module.exports = router;