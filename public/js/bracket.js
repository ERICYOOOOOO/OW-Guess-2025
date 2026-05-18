// public/js/bracket.js
// 树状 Bracket 预测 UI + 依赖锁定逻辑

const TEAM_FULL_NAMES = {
    "WBG": "Weibo Gaming",
    "VP": "Virtus.pro",
    "ZETA": "ZETA DIVISION",
    "SSG": "Spacestation Gaming",
    "DAL": "Dallas Fuel",
    "CR": "Crazy Raccoon",
    "TM": "Twisted Minds",
    "AG": "All Gamers"
};

// 14 场比赛的依赖结构 (与 routes/admin.js BRACKET_MAP 一致)
// teamA / teamB 的 source: 'fixed' (硬编码队伍) | 'winner' | 'loser' (依赖另一场)
const MATCHES_DEF = [
    { id: 'M1',  day:1, format:'FT2', teamA:{source:'fixed', team:'WBG'},  teamB:{source:'fixed', team:'VP'}  },
    { id: 'M2',  day:1, format:'FT2', teamA:{source:'fixed', team:'ZETA'}, teamB:{source:'fixed', team:'SSG'} },
    { id: 'M3',  day:1, format:'FT2', teamA:{source:'fixed', team:'DAL'},  teamB:{source:'fixed', team:'CR'}  },
    { id: 'M4',  day:1, format:'FT2', teamA:{source:'fixed', team:'TM'},   teamB:{source:'fixed', team:'AG'}  },
    { id: 'M5',  day:1, format:'FT2', teamA:{source:'loser',  from:'M4'},  teamB:{source:'loser',  from:'M3'} },
    { id: 'M6',  day:1, format:'FT2', teamA:{source:'loser',  from:'M1'},  teamB:{source:'loser',  from:'M2'} },
    { id: 'M7',  day:2, format:'FT3', teamA:{source:'winner', from:'M4'},  teamB:{source:'winner', from:'M3'} },
    { id: 'M8',  day:2, format:'FT3', teamA:{source:'winner', from:'M2'},  teamB:{source:'winner', from:'M1'} },
    { id: 'M9',  day:2, format:'FT3', teamA:{source:'loser',  from:'M8'},  teamB:{source:'winner', from:'M5'} },
    { id: 'M10', day:2, format:'FT3', teamA:{source:'loser',  from:'M7'},  teamB:{source:'winner', from:'M6'} },
    { id: 'M11', day:2, format:'FT3', teamA:{source:'winner', from:'M9'},  teamB:{source:'winner', from:'M10'}},
    { id: 'UBF', day:3, format:'FT3', teamA:{source:'winner', from:'M7'},  teamB:{source:'winner', from:'M8'} },
    { id: 'LBF', day:3, format:'FT3', teamA:{source:'loser',  from:'UBF'}, teamB:{source:'winner', from:'M11'}},
    { id: 'GF',  day:3, format:'FT4', teamA:{source:'winner', from:'UBF'}, teamB:{source:'winner', from:'LBF'}},
];
const MATCHES_BY_ID = Object.fromEntries(MATCHES_DEF.map(m => [m.id, m]));

// 反向依赖图: parentId -> [childId, ...]
const DEPENDENTS = {};
for (const m of MATCHES_DEF) {
    for (const slot of ['teamA','teamB']) {
        const src = m[slot];
        if (src.source !== 'fixed') {
            if (!DEPENDENTS[src.from]) DEPENDENTS[src.from] = [];
            DEPENDENTS[src.from].push(m.id);
        }
    }
}

// state.picks[id] = { winnerSlot: 'A'|'B'|null, scoreA, scoreB }
const state = {
    picks: {},
    locked: false,
    submitted: false,
    lockTime: null,
    serverTimes: {}      // id -> ISO startTime
};

function maxScore(format) {
    return format === 'FT4' ? 4 : (format === 'FT3' ? 3 : 2);
}

// 解析某场比赛某 slot 的队伍 (递归追溯)
// slot 接受 'teamA'/'teamB' (def 上的字段名)
function resolveTeam(matchId, slot) {
    const def = MATCHES_BY_ID[matchId][slot];
    if (def.source === 'fixed') return def.team;
    const parent = state.picks[def.from];
    if (!parent || !parent.winnerSlot) return null;
    const winnerSlot = parent.winnerSlot;   // 'A' or 'B'
    const loserSlot = winnerSlot === 'A' ? 'B' : 'A';
    const target = def.source === 'winner' ? winnerSlot : loserSlot;
    return resolveTeam(def.from, 'team' + target);
}

function hasAnyDependentPicked(matchId) {
    const deps = DEPENDENTS[matchId] || [];
    return deps.some(cid => state.picks[cid] && state.picks[cid].winnerSlot);
}
function listDependentPicked(matchId) {
    return (DEPENDENTS[matchId] || []).filter(cid => state.picks[cid] && state.picks[cid].winnerSlot);
}

function ensurePick(id) {
    if (!state.picks[id]) state.picks[id] = { winnerSlot: null, scoreA: 0, scoreB: 0 };
    return state.picks[id];
}

function pickWinner(matchId, slot) {
    if (state.locked || state.submitted) return;
    const def = MATCHES_BY_ID[matchId];
    const teamA = resolveTeam(matchId, 'teamA');
    const teamB = resolveTeam(matchId, 'teamB');
    if (!teamA || !teamB) return;
    if (hasAnyDependentPicked(matchId) && state.picks[matchId] && state.picks[matchId].winnerSlot) {
        // 锁着，不能改
        return;
    }
    const max = maxScore(def.format);
    const p = ensurePick(matchId);
    p.winnerSlot = slot;
    if (slot === 'A') {
        p.scoreA = max;
        p.scoreB = Math.min(p.scoreB, max - 1);
        if (p.scoreB < 0) p.scoreB = 0;
    } else {
        p.scoreB = max;
        p.scoreA = Math.min(p.scoreA, max - 1);
        if (p.scoreA < 0) p.scoreA = 0;
    }
    render();
}

function adjustScore(matchId, slot, val) {
    if (state.locked || state.submitted) return;
    const p = state.picks[matchId];
    if (!p || !p.winnerSlot) return;
    if (hasAnyDependentPicked(matchId)) return;
    const def = MATCHES_BY_ID[matchId];
    const max = maxScore(def.format);
    let v = parseInt(val);
    if (!Number.isFinite(v)) v = 0;
    if (v < 0) v = 0;

    // 赢方必须是 max，输方在 [0, max-1]
    if (slot === p.winnerSlot) {
        if (v > max) v = max;
        if (v < max) v = max; // 强制赢方=max
    } else {
        if (v >= max) v = max - 1;
    }
    if (slot === 'A') p.scoreA = v; else p.scoreB = v;
    render();
}

function clearPick(matchId) {
    if (state.locked || state.submitted) return;
    const deps = listDependentPicked(matchId);
    if (deps.length > 0) {
        alert(`请先取消依赖项的选择: ${deps.join(', ')}`);
        return;
    }
    delete state.picks[matchId];
    render();
}

function fmtUTC(iso) {
    if (!iso) return '';
    const d = new Date(iso);
    const fmt = (tz) => new Intl.DateTimeFormat('zh-CN', {
        timeZone: tz, month: '2-digit', day: '2-digit',
        hour: '2-digit', minute: '2-digit', hour12: false
    }).format(d);
    return `EDT ${fmt('America/New_York')} · CDT ${fmt('America/Chicago')} · PDT ${fmt('America/Los_Angeles')}`;
}

function renderCard(def) {
    const teamA = resolveTeam(def.id, 'teamA');
    const teamB = resolveTeam(def.id, 'teamB');
    const p = state.picks[def.id];
    const unresolved = !teamA || !teamB;
    const lockedByDep = !state.locked && hasAnyDependentPicked(def.id) && p && p.winnerSlot;
    const max = maxScore(def.format);

    const sourceLabel = (s) => {
        if (s.source === 'fixed') return '';
        return s.source === 'winner' ? `W-${s.from}` : `L-${s.from}`;
    };

    const labelA = teamA || `<span class="placeholder">${sourceLabel(def.teamA) || 'TBD'}</span>`;
    const labelB = teamB || `<span class="placeholder">${sourceLabel(def.teamB) || 'TBD'}</span>`;

    const fullA = teamA ? (TEAM_FULL_NAMES[teamA] || teamA) : labelA;
    const fullB = teamB ? (TEAM_FULL_NAMES[teamB] || teamB) : labelB;

    const winA = p && p.winnerSlot === 'A';
    const winB = p && p.winnerSlot === 'B';

    const inputsDisabled = unresolved || state.locked || state.submitted || lockedByDep;

    const startTime = state.serverTimes[def.id];
    const tzHtml = startTime ? `<div class="timezone-row" style="margin-top:6px;">${fmtUTC(startTime).split('·').map(s => `<span>${s.trim()}</span>`).join('')}</div>` : '';

    const cardClasses = ['bracket-card'];
    if (p && p.winnerSlot) cardClasses.push('picked');
    if (unresolved) cardClasses.push('unresolved');
    if (lockedByDep) cardClasses.push('locked-by-dep');

    const scoreA = p ? p.scoreA : 0;
    const scoreB = p ? p.scoreB : 0;

    let msg = '';
    if (lockedByDep) {
        msg = `🔒 已锁 (依赖: ${listDependentPicked(def.id).join(', ')})`;
    } else if (unresolved) {
        msg = '上游比赛未选定';
    }

    return `
    <div class="${cardClasses.join(' ')}" data-id="${def.id}">
        <div class="bc-head">
            <span><b>${def.id}</b> · ${def.format} · Day ${def.day}</span>
            <span>${winA ? 'A 胜' : (winB ? 'B 胜' : '未选')}</span>
        </div>
        <div class="bc-row ${winA ? 'win' : ''}">
            <div class="bc-team">${fullA}</div>
            <div class="bc-score">
                <input type="number" min="0" max="${max}" value="${scoreA}"
                    ${inputsDisabled ? 'disabled' : ''}
                    onchange="adjustScore('${def.id}','A', this.value)">
            </div>
            <button class="bc-pick-btn ${winA ? 'active' : ''}"
                ${inputsDisabled ? 'disabled' : ''}
                onclick="pickWinner('${def.id}','A')">A 赢</button>
        </div>
        <div class="bc-row ${winB ? 'win' : ''}">
            <div class="bc-team">${fullB}</div>
            <div class="bc-score">
                <input type="number" min="0" max="${max}" value="${scoreB}"
                    ${inputsDisabled ? 'disabled' : ''}
                    onchange="adjustScore('${def.id}','B', this.value)">
            </div>
            <button class="bc-pick-btn ${winB ? 'active' : ''}"
                ${inputsDisabled ? 'disabled' : ''}
                onclick="pickWinner('${def.id}','B')">B 赢</button>
        </div>
        ${tzHtml}
        <button class="bc-clear"
            ${(state.locked || state.submitted || !p || !p.winnerSlot) ? 'disabled' : ''}
            onclick="clearPick('${def.id}')">取消选择</button>
        <div class="bc-msg">${msg}</div>
    </div>`;
}

function isPickComplete(id) {
    const p = state.picks[id];
    if (!p || !p.winnerSlot) return false;
    const def = MATCHES_BY_ID[id];
    const max = maxScore(def.format);
    const w = p.winnerSlot === 'A' ? p.scoreA : p.scoreB;
    const l = p.winnerSlot === 'A' ? p.scoreB : p.scoreA;
    return w === max && l >= 0 && l < max;
}

function renderProgress() {
    const filled = MATCHES_DEF.filter(m => isPickComplete(m.id)).length;
    const el = document.getElementById('progress-text');
    if (el) el.innerText = `已填 ${filled} / 14`;
    const btn = document.getElementById('submit-btn');
    if (btn) btn.disabled = filled !== 14 || state.locked || state.submitted;
}

function render() {
    const root = document.getElementById('bracket-content');
    const rounds = [
        { title: 'Day 1 · UB Round 1', ids: ['M1','M2','M3','M4'] },
        { title: 'Day 1 · LB Round 1', ids: ['M5','M6'] },
        { title: 'Day 2 · UB Semifinals', ids: ['M7','M8'] },
        { title: 'Day 2 · LB Quarterfinals (交叉)', ids: ['M9','M10'] },
        { title: 'Day 2 · LB Semifinal', ids: ['M11'] },
        { title: 'Day 3 · Upper Bracket Final', ids: ['UBF'] },
        { title: 'Day 3 · Lower Bracket Final', ids: ['LBF'] },
        { title: 'Day 3 · 🏆 Grand Final', ids: ['GF'] }
    ];
    let html = '';
    for (const r of rounds) {
        html += `<div class="bracket-round"><h3>${r.title}</h3><div class="bracket-grid">`;
        for (const id of r.ids) {
            const def = MATCHES_BY_ID[id];
            html += renderCard(def);
        }
        html += `</div></div>`;
    }
    root.innerHTML = html;
    renderProgress();
}

async function init() {
    if (!App.user) {
        document.getElementById('login-modal').style.display = 'flex';
        document.getElementById('bracket-content').innerHTML = '';
        return;
    }
    document.getElementById('submit-bar').style.display = 'flex';

    try {
        // 1. 拉取模板 + 锁定信息
        const [tplRes, myRes] = await Promise.all([
            fetch('/api/bracket/template'),
            fetch(`/api/bracket/my/${App.user._id}`)
        ]);
        const tpl = await tplRes.json();
        const mine = await myRes.json();

        state.locked = !!tpl.locked;
        state.lockTime = tpl.lockTime;
        tpl.matches.forEach(m => { state.serverTimes[m.customId] = m.startTime; });

        const banner = document.getElementById('lock-banner');
        if (state.locked) {
            banner.className = 'lock-banner locked';
            banner.innerText = '🔒 Bracket 已锁定 (M1 已开赛)，仅查看模式';
        } else {
            const lt = new Date(tpl.lockTime);
            const fmt = (tz) => new Intl.DateTimeFormat('zh-CN', {
                timeZone: tz, month: '2-digit', day: '2-digit',
                hour: '2-digit', minute: '2-digit', hour12: false
            }).format(lt);
            banner.className = 'lock-banner';
            banner.innerHTML = `⏰ 截止时间: EDT ${fmt('America/New_York')} · CDT ${fmt('America/Chicago')} · PDT ${fmt('America/Los_Angeles')}`;
        }

        if (mine && mine.picks && mine.picks.length > 0) {
            state.submitted = true;
            // 已提交：把picks 回填
            for (const pick of mine.picks) {
                const def = MATCHES_BY_ID[pick.matchCustomId];
                if (!def) continue;
                const teamA = resolveTeam(pick.matchCustomId, 'teamA');
                const teamB = resolveTeam(pick.matchCustomId, 'teamB');
                // 保留 pick 原始 A/B 顺序: 比较 pick.teamAName 与 def 推导出的 teamA
                let scoreA, scoreB, winnerSlot;
                if (teamA && pick.teamAName === teamA) {
                    scoreA = pick.teamAScore;
                    scoreB = pick.teamBScore;
                } else if (teamA && pick.teamAName === teamB) {
                    scoreA = pick.teamBScore;
                    scoreB = pick.teamAScore;
                } else {
                    // 上游未解析 (固定队伍): 直接按 def 的 teamA 决定
                    scoreA = pick.teamAScore;
                    scoreB = pick.teamBScore;
                }
                winnerSlot = scoreA > scoreB ? 'A' : 'B';
                state.picks[pick.matchCustomId] = { winnerSlot, scoreA, scoreB };
            }
            if (!state.locked) {
                const banner = document.getElementById('lock-banner');
                banner.className = 'lock-banner locked';
                banner.innerText = `✅ 已提交 (${new Date(mine.submittedAt).toLocaleString()})，仅查看模式`;
            }
        }

        render();
    } catch (err) {
        console.error(err);
        document.getElementById('bracket-content').innerHTML =
            `<div style="text-align:center; color:red; padding:40px;">加载失败: ${err.message}</div>`;
    }
}

window.pickWinner = pickWinner;
window.adjustScore = adjustScore;
window.clearPick = clearPick;

window.submitBracket = async () => {
    if (state.locked || state.submitted) return;
    const filled = MATCHES_DEF.every(m => isPickComplete(m.id));
    if (!filled) return alert('请填全 14 场再提交');
    if (!confirm('提交后不可修改，确认?')) return;

    const picks = MATCHES_DEF.map(def => {
        const p = state.picks[def.id];
        const teamA = resolveTeam(def.id, 'teamA');
        const teamB = resolveTeam(def.id, 'teamB');
        return {
            matchCustomId: def.id,
            teamAName: teamA,
            teamBName: teamB,
            teamAScore: p.scoreA,
            teamBScore: p.scoreB
        };
    });

    try {
        const res = await fetch('/api/bracket/submit', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ userId: App.user._id, picks })
        });
        const data = await res.json();
        if (data.success) {
            alert('Bracket 提交成功！');
            state.submitted = true;
            location.reload();
        } else {
            alert(data.message || '提交失败');
        }
    } catch (e) {
        alert('网络错误: ' + e.message);
    }
};

document.addEventListener('DOMContentLoaded', init);
