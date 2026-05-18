// lib/liquipedia.js
// 抓取 Liquipedia OWCS 2026 Champions Clash 页面，解析 14 场比赛数据。
//
// 解析对象：HTML 上的 bracket-game 结构 (双败树状)。
// 由于 Liquipedia 模板会随时间变化，本模块尽量做容错：
//   - 抽取所有 .bracket-game / .brkts-matchlist-match 节点
//   - 用 customId / teams / score / 时间戳 等启发式特征匹配 14 场
//   - 找不到就跳过，由 sync-scheduler 写 diff 日志，不自动覆盖

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

// 7 official customIds 出现在 Liquipedia 上的常见格式 (M1, M2, ..., UBF, LBF, GF)
const KNOWN_IDS = ['M1','M2','M3','M4','M5','M6','M7','M8','M9','M10','M11','UBF','LBF','GF'];

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

function parseInt0(v) {
    const n = parseInt(v, 10);
    return Number.isFinite(n) ? n : 0;
}

// =======================================================
// 解析整页 HTML，返回 14 场比赛的 { customId, team1, team2, score1, score2, startTime, status }
// =======================================================
function parsePage(html) {
    const $ = cheerio.load(html);
    const out = [];

    // 策略 1: brkts-match-info-icon / data-customid 直接标注 (新模板)
    $('[data-customid]').each((_, el) => {
        const customId = String($(el).attr('data-customid') || '').toUpperCase();
        if (!KNOWN_IDS.includes(customId)) return;
        out.push(extractMatch($, $(el), customId));
    });

    // 策略 2: bracket-game 节点 (经典模板)
    if (out.length === 0) {
        $('.bracket-game, .brkts-match, .brkts-matchlist-match').each((_, el) => {
            const matchEl = $(el);
            // 从 header / tooltip 找 customId
            const headerText = (matchEl.find('.bracket-header, .brkts-match-header').first().text() || '').trim();
            const m = headerText.match(/\b(M\d{1,2}|UBF|LBF|GF)\b/i);
            if (!m) return;
            const customId = m[1].toUpperCase();
            if (!KNOWN_IDS.includes(customId)) return;
            out.push(extractMatch($, matchEl, customId));
        });
    }

    return out.filter(Boolean);
}

function extractMatch($, $el, customId) {
    const team1Raw = $el.find('.bracket-team-top, .brkts-opponent-entry').eq(0).find('[data-highlightingclass], .name, a').first().text()
        || $el.find('.team-top .team-template-text').first().text()
        || $el.find('.team1, .opp1').first().text();
    const team2Raw = $el.find('.bracket-team-bottom, .brkts-opponent-entry').eq(1).find('[data-highlightingclass], .name, a').first().text()
        || $el.find('.team-bottom .team-template-text').first().text()
        || $el.find('.team2, .opp2').first().text();

    const score1Raw = $el.find('.bracket-score, .brkts-opponent-score').eq(0).text();
    const score2Raw = $el.find('.bracket-score, .brkts-opponent-score').eq(1).text();

    const dateAttr = $el.find('[data-timestamp], .timer-object').first().attr('data-timestamp')
        || $el.find('[data-timestamp]').first().attr('data-timestamp');
    let startTime = null;
    if (dateAttr) {
        const ts = parseInt(dateAttr, 10);
        if (Number.isFinite(ts)) startTime = new Date(ts * 1000);
    }

    const team1 = normalizeTeam(team1Raw);
    const team2 = normalizeTeam(team2Raw);
    const score1 = parseInt0(score1Raw);
    const score2 = parseInt0(score2Raw);

    let status = 'upcoming';
    const winnerMark = $el.find('.bracket-team-top.bracket-won, .bracket-team-bottom.bracket-won, .brkts-opponent-win').length;
    if (winnerMark > 0) status = 'finished';

    return {
        customId,
        team1, team2,
        score1, score2,
        startTime,
        status
    };
}

async function scrape() {
    const html = await fetchHtml();
    return parsePage(html);
}

module.exports = {
    scrape,
    parsePage, // for tests
    normalizeTeam,
    KNOWN_IDS,
    PAGE_URL,
    USER_AGENT
};
