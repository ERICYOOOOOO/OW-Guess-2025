// routes/bracket.js
// 整体 Bracket 预测 (一次性提交 14 场)

const express = require('express');
const router = express.Router();
const Match = require('../models/Match');
const User = require('../models/user');
const BracketPrediction = require('../models/BracketPrediction');
const Log = require('../models/Log');
const Setting = require('../models/Setting');

// 文档 §1: M1 第一场为 2026-05-22T03:00:00Z, bracket 锁定时间 = M1 开赛
const BRACKET_LOCK_TIME = new Date('2026-05-22T03:00:00Z');

// 全局 bracket 锁定模式：
//   'auto'          → 跟随 BRACKET_LOCK_TIME (默认)
//   'force-lock'    → 强制锁定 (即使未到时间)
//   'force-unlock'  → 强制开放 (即使已过时间)
async function getBracketLockState() {
    const mode = await Setting.get('bracketLockMode', 'auto');
    const dateLocked = new Date() >= BRACKET_LOCK_TIME;
    let locked;
    if (mode === 'force-lock') locked = true;
    else if (mode === 'force-unlock') locked = false;
    else locked = dateLocked;
    return { mode, locked, dateLocked, lockTime: BRACKET_LOCK_TIME };
}

const MATCH_ORDER = ['M1','M2','M3','M4','M5','M6','M7','M8','M9','M10','M11','UBF','LBF','GF'];

function getFormat(customId) {
    if (['M1','M2','M3','M4','M5','M6'].includes(customId)) return 'FT2';
    if (customId === 'GF') return 'FT4';
    return 'FT3';
}

function validateScore(format, sA, sB) {
    const winScore = format === 'FT2' ? 2 : (format === 'FT3' ? 3 : 4);
    if (sA !== winScore && sB !== winScore) return false;
    if (sA === winScore && sB === winScore) return false;
    if (sA > winScore || sB > winScore) return false;
    if (sA < 0 || sB < 0) return false;
    return true;
}

// =======================================================
// GET /api/bracket/template
// 返回 14 场的占位结构 + Day1 已知队伍 + 锁定时间
// =======================================================
router.get('/template', async (req, res) => {
    try {
        const matches = await Match.find().sort({ startTime: 1 }).lean();
        const tpl = matches.map(m => ({
            customId: m.customId,
            day: m.day,
            format: m.format,
            startTime: m.startTime,
            // 仅 Day1 有确定队伍 (M1-M4)；其余靠前端 graph 推导
            teamA: m.teamA,
            teamB: m.teamB
        }));
        const lockState = await getBracketLockState();
        res.json({
            lockTime: BRACKET_LOCK_TIME.toISOString(),
            locked: lockState.locked,
            lockMode: lockState.mode,
            matches: tpl
        });
    } catch (e) {
        res.status(500).json({ message: e.message });
    }
});

// =======================================================
// POST /api/bracket/submit
// body: { userId, picks: [{ matchCustomId, teamAName, teamBName, teamAScore, teamBScore }, ...] }
// =======================================================
router.post('/submit', async (req, res) => {
    try {
        const lockState = await getBracketLockState();
        if (lockState.locked) {
            const reason = lockState.mode === 'force-lock'
                ? 'Bracket 已被管理员手动锁定，无法再提交'
                : 'Bracket 已锁定 (M1 已开赛)，无法再提交';
            return res.status(403).json({ message: reason });
        }

        const { userId, picks } = req.body;
        if (!userId || !Array.isArray(picks)) {
            return res.status(400).json({ message: '请求格式错误' });
        }

        const user = await User.findById(userId);
        if (!user) return res.status(404).json({ message: '用户不存在' });

        const existing = await BracketPrediction.findOne({ userId });
        if (existing) return res.status(400).json({ message: '已提交过 Bracket，不可重复提交' });

        if (picks.length !== MATCH_ORDER.length) {
            return res.status(400).json({ message: `必须填全 14 场, 当前 ${picks.length} 场` });
        }

        const seen = new Set();
        const normalizedPicks = [];
        for (const pick of picks) {
            const cid = pick.matchCustomId;
            if (!MATCH_ORDER.includes(cid) || seen.has(cid)) {
                return res.status(400).json({ message: `非法或重复的比赛 ID: ${cid}` });
            }
            seen.add(cid);

            const sA = parseInt(pick.teamAScore);
            const sB = parseInt(pick.teamBScore);
            const fmt = getFormat(cid);
            if (!validateScore(fmt, sA, sB)) {
                return res.status(400).json({ message: `${cid} 比分非法 (${sA}:${sB}, ${fmt})` });
            }

            const teamA = String(pick.teamAName || '').trim();
            const teamB = String(pick.teamBName || '').trim();
            if (!teamA || !teamB || teamA === teamB || teamA === 'TBD' || teamB === 'TBD') {
                return res.status(400).json({ message: `${cid} 参赛队伍无效` });
            }

            const winner = sA > sB ? teamA : teamB;
            normalizedPicks.push({
                matchCustomId: cid,
                teamAName: teamA,
                teamBName: teamB,
                teamAScore: sA,
                teamBScore: sB,
                predictedWinner: winner,
                pointsEarned: 0,
                isPerfect: false,
                status: 'pending'
            });
        }

        if (seen.size !== MATCH_ORDER.length) {
            return res.status(400).json({ message: '缺少部分比赛' });
        }

        const bp = await BracketPrediction.create({
            userId,
            picks: normalizedPicks,
            bracketScore: 0,
            submittedAt: new Date()
        });

        user.bracketSubmittedAt = bp.submittedAt;
        await user.save();

        await Log.create({
            action: 'USER_BRACKET_SUBMIT',
            operatorId: user._id,
            operatorName: user.nickname,
            target: 'Bracket',
            details: { picks: normalizedPicks.length }
        });

        res.status(201).json({ success: true, message: 'Bracket 已提交' });
    } catch (e) {
        if (e.code === 11000) return res.status(400).json({ message: '已提交过 Bracket' });
        res.status(500).json({ message: e.message });
    }
});

// =======================================================
// GET /api/bracket/my/:userId
// =======================================================
router.get('/my/:userId', async (req, res) => {
    try {
        const bp = await BracketPrediction.findOne({ userId: req.params.userId }).lean();
        if (!bp) return res.json(null);
        res.json(bp);
    } catch (e) {
        res.status(500).json({ message: e.message });
    }
});

module.exports = { router, BRACKET_LOCK_TIME, MATCH_ORDER, getFormat, getBracketLockState };
