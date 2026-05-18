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

function diffMatch(current, scraped) {
    const diffs = [];
    // 队伍名 (仅 current 还是 TBD 时考虑采纳)
    if (current.teamA.name === 'TBD' && scraped.team1) {
        diffs.push({ customId: current.customId, field: 'teamA.name', current: current.teamA.name, scraped: scraped.team1 });
    } else if (scraped.team1 && current.teamA.name !== 'TBD' && current.teamA.name !== scraped.team1) {
        diffs.push({ customId: current.customId, field: 'teamA.name', current: current.teamA.name, scraped: scraped.team1 });
    }
    if (current.teamB.name === 'TBD' && scraped.team2) {
        diffs.push({ customId: current.customId, field: 'teamB.name', current: current.teamB.name, scraped: scraped.team2 });
    } else if (scraped.team2 && current.teamB.name !== 'TBD' && current.teamB.name !== scraped.team2) {
        diffs.push({ customId: current.customId, field: 'teamB.name', current: current.teamB.name, scraped: scraped.team2 });
    }
    // 时间
    if (scraped.startTime) {
        const cur = new Date(current.startTime).getTime();
        const scr = new Date(scraped.startTime).getTime();
        if (Math.abs(cur - scr) > 60 * 1000) {
            diffs.push({ customId: current.customId, field: 'startTime', current: current.startTime, scraped: scraped.startTime });
        }
    }
    // 比分
    if (scraped.score1 !== undefined && scraped.score1 !== current.teamA.score) {
        diffs.push({ customId: current.customId, field: 'teamA.score', current: current.teamA.score, scraped: scraped.score1 });
    }
    if (scraped.score2 !== undefined && scraped.score2 !== current.teamB.score) {
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
        const scrapedById = new Map(scraped.map(s => [s.customId, s]));

        const autoSettled = [];
        const allDiffs = [];

        for (const m of matches) {
            const s = scrapedById.get(m.customId);
            if (!s) continue;
            const diffs = diffMatch(m, s);
            allDiffs.push(...diffs);

            // 触发自动 settle: 比赛 upcoming, scraped 报 finished 且比分非零
            if (m.status !== 'finished' && s.status === 'finished'
                && (s.score1 > 0 || s.score2 > 0)
                && state.autoSettleHook
                && m.teamA.name !== 'TBD' && m.teamB.name !== 'TBD') {
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
        const scrapedById = new Map(scraped.map(s => [s.customId, s]));

        const allDiffs = [];
        for (const m of matches) {
            const s = scrapedById.get(m.customId);
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
    const scrapedById = new Map(scraped.map(s => [s.customId, s]));
    const allDiffs = [];
    for (const m of matches) {
        const s = scrapedById.get(m.customId);
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
