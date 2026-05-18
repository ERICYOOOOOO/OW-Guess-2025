// lib/liquipedia.js
// 抓取 Liquipedia OWCS 2026 Champions Clash 页面，解析 14 场比赛数据。
//
// Liquipedia HTML 不直接标注 M1/M2/UBF/LBF/GF 这种 customId, 也没有结构性的顺序保证,
// 因此本模块只返回每场的原始字段 { team1, team2, score1, score2, startTime, status },
// 由 sync-scheduler 根据 (teamA, teamB) 集合反查 DB 里的 customId 完成对账。

const axios = require('axios');
const cheerio = require('cheerio');

const PAGE_URL = process.env.LIQUIPEDIA_PAGE_URL
    || 'https://liquipedia.net/overwatch/Overwatch_Champions_Series/2026/Champions_Clash';

const USER_AGENT = process.env.LIQUIPEDIA_USER_AGENT
    || 'OWCS-Guess-2026/1.0 (contact@example.com)';

const CACHE_TTL_MS = 30 * 1000;
let _cache = { html: null, fetchedAt: 0 };

async function fetchHtml() {
    if (_cache.html && (Date.now() - _cache.fetchedAt) < CACHE_TTL_MS) {
        return _cache.html;
    }
    const res = await axios.get(PAGE_URL, {
        timeout: 15000,
        headers: {
            'User-Agent': USER_AGENT,
            'Accept-Encoding': 'gzip',
            'Accept': 'text/html,application/xhtml+xml'
        },
        responseType: 'text'
    });
    if (!res.data) throw new Error('Empty response from Liquipedia');
    _cache = { html: res.data, fetchedAt: Date.now() };
    return res.data;
}

// 把 Liquipedia 上的常见 队伍中文/全称 映射回内部短码。可以按需扩充。
const TEAM_ALIAS = {
    'Weibo Gaming': 'WBG',
    'Virtus.pro': 'VP',
    'ZETA DIVISION': 'ZETA',
    'ZETA': 'ZETA',
    'Spacestation Gaming': 'SSG',
    'Spacestation': 'SSG',
    'Dallas Fuel': 'DAL',
    'Crazy Raccoon': 'CR',
    'Twisted Minds': 'TM',
    'All Gamers': 'AG'
};

function normalizeTeam(raw) {
    if (!raw) return null;
    const t = String(raw).trim();
    if (!t || /^TBD$/i.test(t)) return null;
    if (TEAM_ALIAS[t]) return TEAM_ALIAS[t];
    // 已经是短码就保留
    if (/^[A-Z0-9]{2,5}$/.test(t)) return t;
    // 尝试取大写首字母组合的子串作为 fallback
    return t;
}

function parseScore(raw) {
    if (raw == null) return null;
    const s = String(raw).trim();
    if (!s || s === '-' || s === '–') return null;
    const n = parseInt(s, 10);
    return Number.isFinite(n) ? n : null;
}

// =======================================================
// 解析整页 HTML，返回 14 场比赛的
//   { team1, team2, score1, score2, startTime, status }
// 顺序为 HTML 中 .brkts-match 出现顺序 (Liquipedia bracket tree 渲染顺序, 不保证等于 M1-M14)
// =======================================================
function parsePage(html) {
    const $ = cheerio.load(html);
    const out = [];

    $('.brkts-match').each((_, el) => {
        const $el = $(el);
        const opps = $el.find('.brkts-opponent-entry');
        if (opps.length < 2) return;

        const team1Raw = opps.eq(0).attr('aria-label') || opps.eq(0).find('.name').first().text();
        const team2Raw = opps.eq(1).attr('aria-label') || opps.eq(1).find('.name').first().text();

        const score1Raw = $el.find('.brkts-opponent-score-inner').eq(0).text();
        const score2Raw = $el.find('.brkts-opponent-score-inner').eq(1).text();

        const tsAttr = $el.find('[data-timestamp]').first().attr('data-timestamp');
        let startTime = null;
        if (tsAttr) {
            const ts = parseInt(tsAttr, 10);
            if (Number.isFinite(ts)) startTime = new Date(ts * 1000);
        }

        const team1 = normalizeTeam(team1Raw);
        const team2 = normalizeTeam(team2Raw);
        const score1 = parseScore(score1Raw);
        const score2 = parseScore(score2Raw);

        // status: opponent 有 brkts-opponent-win 之一 → finished
        let status = 'upcoming';
        if ($el.find('.brkts-opponent-win').length > 0) status = 'finished';

        out.push({ team1, team2, score1, score2, startTime, status });
    });

    return out;
}

async function scrape() {
    const html = await fetchHtml();
    return parsePage(html);
}

module.exports = {
    scrape,
    parsePage, // for tests
    normalizeTeam,
    PAGE_URL,
    USER_AGENT
};
