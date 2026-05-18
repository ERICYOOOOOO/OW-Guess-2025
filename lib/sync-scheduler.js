// lib/sync-scheduler.js
// Liquipedia 自动同步调度器
//
// 两种节奏：
//   - 高频 (默认 1 分钟): 当任何比赛 startTime ± WINDOW_HOURS 范围内 -> 检测比分变化 + 触发自动 settle
//   - 低频 (默认 10 分钟): 全局体检，校对所有 14 场的队伍/时间/最终比分，差异写 SyncLog (不自动覆盖)
//
// 失败 3 连 -> 切回手动模式 (paused = true)，需 admin sync-resume 恢复。

const liquipedia = require('./liquipedia');
const Match = require('../models/Match');
const LiquipediaSyncLog = require('../models/LiquipediaSyncLog');

const ENABLED = process.env.LIQUIPEDIA_SYNC_ENABLED !== 'false';
const POLL_HIGH = parseInt(process.env.LIQUIPEDIA_POLL_HIGH_FREQ_MS || '60000', 10);
const POLL_LOW  = parseInt(process.env.LIQUIPEDIA_POLL_LOW_FREQ_MS  || '600000', 10);
const WINDOW_HOURS = parseInt(process.env.LIQUIPEDIA_WINDOW_HOURS || '2', 10);

const state = {
    paused: !ENABLED,
    consecutiveFailures: 0,
    lastHighRun: null,
    lastLowRun: null,
    lastError: null,
    lastDiffCount: 0,
    autoSettleHook: null   // (matchId, scoreA, scoreB) => Promise
};

let _highTimer = null;
let _lowTimer = null;

function inHighFreqWindow(matches) {
    const now = Date.now();
    const w = WINDOW_HOURS * 3600 * 1000;
    return matches.some(m => {
        const t = new Date(m.startTime).getTime();
        return Math.abs(t - now) <= w;
    });
}

// 用 (teamA.name, teamB.name) 集合从 scraped 14 场里找匹配, 并把结果重排成
// 跟 current 同方向 (即 aligned.team1 对应 current.teamA, 比分同向)。
// current 任一边为 TBD 时返回 null —— 此时同步无法定位, 留给 admin 手动处理。
function findAlignedScraped(current, scrapedList) {
    if (!current.teamA?.name || !current.teamB?.name) return null;
    if (current.teamA.name === 'TBD' || current.teamB.name === 'TBD') return null;
    const target = new Set([current.teamA.name, current.teamB.name]);
    for (const s of scrapedList) {
        if (!s.team1 || !s.team2) continue;
        const sset = new Set([s.team1, s.team2]);
        if (sset.size !== target.size) continue;
        if (![...target].every(t => sset.has(t))) continue;
        if (s.team1 === current.teamA.name) {
            return { team1: s.team1, team2: s.team2, score1: s.score1, score2: s.score2, startTime: s.startTime, status: s.status };
        }
        return { team1: s.team2, team2: s.team1, score1: s.score2, score2: s.score1, startTime: s.startTime, status: s.status };
    }
    return null;
}

function diffMatch(current, scraped) {
    const diffs = [];
    // 时间
    if (scraped.startTime) {
        const cur = new Date(current.startTime).getTime();
        const scr = new Date(scraped.startTime).getTime();
        if (Math.abs(cur - scr) > 60 * 1000) {
            diffs.push({ customId: current.customId, field: 'startTime', current: current.startTime, scraped: scraped.startTime });
        }
    }
    // 比分 (null 表示 Liquipedia 未填, 跳过 diff)
    if (scraped.score1 != null && scraped.score1 !== current.teamA.score) {
        diffs.push({ customId: current.customId, field: 'teamA.score', current: current.teamA.score, scraped: scraped.score1 });
    }
    if (scraped.score2 != null && scraped.score2 !== current.teamB.score) {
        diffs.push({ customId: current.customId, field: 'teamB.score', current: current.teamB.score, scraped: scraped.score2 });
    }
    return diffs;
}

async function highFreqTick() {
    if (state.paused) return;
    try {
        const matches = await Match.find().lean();
        if (!inHighFreqWindow(matches)) return; // 窗外不轮询

        const scraped = await liquipedia.scrape();

        const autoSettled = [];
        const allDiffs = [];

        for (const m of matches) {
            const s = findAlignedScraped(m, scraped);
            if (!s) continue;
            const diffs = diffMatch(m, s);
            allDiffs.push(...diffs);

            // 触发自动 settle: 比赛 upcoming, scraped 报 finished 且比分非零
            if (m.status !== 'finished' && s.status === 'finished'
                && (s.score1 > 0 || s.score2 > 0)
                && state.autoSettleHook) {
                try {
                    await state.autoSettleHook(m._id.toString(), s.score1, s.score2);
                    autoSettled.push(m.customId);
                } catch (err) {
                    console.error(`[sync] auto-settle ${m.customId} 失败:`, err.message);
                }
            }
        }

        await LiquipediaSyncLog.create({
            triggeredBy: 'auto-high',
            success: true,
            diffs: allDiffs,
            autoSettled
        });

        state.consecutiveFailures = 0;
        state.lastHighRun = new Date();
        state.lastDiffCount = allDiffs.length;
        state.lastError = null;
    } catch (err) {
        state.consecutiveFailures += 1;
        state.lastError = err.message;
        await LiquipediaSyncLog.create({ triggeredBy: 'auto-high', success: false, error: err.message }).catch(() => {});
        if (state.consecutiveFailures >= 3) {
            state.paused = true;
            console.error(`[sync] 连续 ${state.consecutiveFailures} 次失败，切回手动模式`);
        }
    }
}

async function lowFreqTick() {
    if (state.paused) return;
    try {
        const matches = await Match.find().lean();
        const scraped = await liquipedia.scrape();

        const allDiffs = [];
        for (const m of matches) {
            const s = findAlignedScraped(m, scraped);
            if (!s) continue;
            allDiffs.push(...diffMatch(m, s));
        }

        await LiquipediaSyncLog.create({
            triggeredBy: 'auto-low',
            success: true,
            diffs: allDiffs
        });
        state.lastLowRun = new Date();
        state.lastDiffCount = allDiffs.length;
        state.consecutiveFailures = 0;
        state.lastError = null;
    } catch (err) {
        state.consecutiveFailures += 1;
        state.lastError = err.message;
        await LiquipediaSyncLog.create({ triggeredBy: 'auto-low', success: false, error: err.message }).catch(() => {});
        if (state.consecutiveFailures >= 3) {
            state.paused = true;
            console.error(`[sync] 连续 ${state.consecutiveFailures} 次失败，切回手动模式`);
        }
    }
}

async function manualSync() {
    const matches = await Match.find().lean();
    const scraped = await liquipedia.scrape();
    const allDiffs = [];
    for (const m of matches) {
        const s = findAlignedScraped(m, scraped);
        if (!s) continue;
        allDiffs.push(...diffMatch(m, s));
    }
    const log = await LiquipediaSyncLog.create({
        triggeredBy: 'manual',
        success: true,
        diffs: allDiffs
    });
    return { diffs: allDiffs, log };
}

function start(opts = {}) {
    if (opts.autoSettleHook) state.autoSettleHook = opts.autoSettleHook;
    if (_highTimer) clearInterval(_highTimer);
    if (_lowTimer)  clearInterval(_lowTimer);
    _highTimer = setInterval(() => { highFreqTick().catch(() => {}); }, POLL_HIGH);
    _lowTimer  = setInterval(() => { lowFreqTick().catch(() => {}); },  POLL_LOW);
    console.log(`✅ Liquipedia sync scheduler started (high=${POLL_HIGH}ms, low=${POLL_LOW}ms, paused=${state.paused})`);
}

function stop() {
    if (_highTimer) clearInterval(_highTimer);
    if (_lowTimer) clearInterval(_lowTimer);
    _highTimer = _lowTimer = null;
}

function pause() { state.paused = true; }
function resume() { state.paused = false; state.consecutiveFailures = 0; state.lastError = null; }

function status() {
    return {
        paused: state.paused,
        enabled: ENABLED,
        consecutiveFailures: state.consecutiveFailures,
        lastHighRun: state.lastHighRun,
        lastLowRun: state.lastLowRun,
        lastError: state.lastError,
        lastDiffCount: state.lastDiffCount,
        pollHigh: POLL_HIGH,
        pollLow: POLL_LOW,
        windowHours: WINDOW_HOURS
    };
}

module.exports = { start, stop, pause, resume, status, manualSync, highFreqTick, lowFreqTick };
