// public/js/predict.js

// === 队伍全称映射表 (OWCS 2026 Champions Clash 8 队) ===
const TEAM_FULL_NAMES = {
    "WBG": "Weibo Gaming",
    "VP": "Virtus.pro",
    "ZETA": "ZETA DIVISION",
    "SSG": "Spacestation Gaming",
    "DAL": "Dallas Fuel",
    "CR": "Crazy Raccoon",
    "TM": "Twisted Minds",
    "AG": "All Gamers",
    "TBD": "TBD"
};

// 北京 / 美西 / 美东 三时区显示工具
function formatThreeTZ(iso) {
    if (!iso) return '';
    const d = new Date(iso);
    const fmt = (tz) => new Intl.DateTimeFormat('zh-CN', {
        timeZone: tz, month: '2-digit', day: '2-digit',
        hour: '2-digit', minute: '2-digit', hour12: false
    }).format(d);
    return `北京 ${fmt('Asia/Shanghai')} · 美西 ${fmt('America/Los_Angeles')} · 美东 ${fmt('America/New_York')}`;
}

document.addEventListener('DOMContentLoaded', async () => {
    // 1. 检查登录状态
    if (!App.user) {
        document.getElementById('login-modal').style.display = 'flex';
    } else {
        document.getElementById('login-modal').style.display = 'none';
        document.getElementById('prediction-container').classList.remove('hidden');
        
        // 只加载一次数据，不再启动轮询
        await loadData();
    }

    // 2. 绑定登录表单
    document.getElementById('login-form').addEventListener('submit', async (e) => {
        e.preventDefault();
        const result = await App.login(document.getElementById('nickname').value, document.getElementById('wechatId').value);
        if (result.success) location.reload();
        else document.getElementById('login-error').innerText = result.message;
    });
});

async function loadData() {
    try {
        // 同时获取赛程、我的预测、全服统计
        const [matchesRes, myPredsRes, statsRes] = await Promise.all([
            fetch('/api/matches'),
            fetch(`/api/predict/my/${App.user._id}`),
            fetch('/api/predict/stats')
        ]);
        
        const matches = await matchesRes.json();
        const preds = await myPredsRes.json();
        const stats = await statsRes.json();
        
        const predMap = new Map();
        preds.forEach(p => predMap.set(p.matchId, p));
        
        renderSchedule(matches, predMap, stats);
        console.log("数据加载完成");
    } catch (err) { console.error(err); }
}

function renderSchedule(matches, predMap, stats) {
    const container = document.getElementById('schedule-list');
    const days = {};
    matches.forEach(m => { if(!days[m.day]) days[m.day]=[]; days[m.day].push(m); });
    
    let html = '';
    Object.keys(days).sort().forEach(day => {
        html += `<h3 class="day-header">Day ${day}</h3>`;
        days[day].forEach(m => html += createMatchCard(m, predMap.get(m._id), stats[m._id]));
    });
    
    container.innerHTML = html;
}

function createMatchCard(match, pred, matchStats) {
    // 1. 各种状态判断
    const isTimeLocked = new Date() >= new Date(match.startTime) || match.status !== 'upcoming';
    const isTBD = match.teamA.name === 'TBD' || match.teamB.name === 'TBD';
    const isAdminLocked = match.isExplicitlyLocked;
    const isFinished = match.status === 'finished'; // 比赛是否已结算

    // 2. 全锁定：只要满足任意条件，输入框就禁用 (包括比赛已结束)
    const isFullyLocked = isTimeLocked || isTBD || isAdminLocked || !!pred || isFinished;

    let statusClass = '';
    let resultText = '';
    
    // 3. 处理结算状态 (优先级最高)
    if (pred && pred.status === 'judged') {
        if (pred.isPerfect) statusClass = 'status-perfect';
        else if (pred.pointsEarned > 0) statusClass = 'status-correct';
        else statusClass = 'status-wrong';
        
        resultText = `<div style="text-align:center;font-size:0.8em;color:#666;margin-top:5px;">实际: ${match.teamA.score}:${match.teamB.score} (得分: ${pred.pointsEarned})</div>`;
    } else if (isFinished) {
        resultText = `<div style="text-align:center;font-size:0.8em;color:#666;margin-top:5px;">实际: ${match.teamA.score}:${match.teamB.score} (未参与)</div>`;
    }

    if (isTBD) statusClass += ' tbd-locked';
    
    // 如果手动锁定，且比赛还没结束，才加变灰样式
    if (isAdminLocked && !isFinished) statusClass += ' tbd-locked'; 

    const nameA = match.teamA.name === 'TBD' ? (match.teamA.displayName || 'TBD') : (TEAM_FULL_NAMES[match.teamA.name] || match.teamA.name);
    const nameB = match.teamB.name === 'TBD' ? (match.teamB.displayName || 'TBD') : (TEAM_FULL_NAMES[match.teamB.name] || match.teamB.name);

    const scoreA = pred ? pred.teamAScore : 0;
    const scoreB = pred ? pred.teamBScore : 0;
    const maxScore = match.format === 'FT4' ? 4 : (match.format === 'FT3' ? 3 : 2);

    const logoA = match.teamA.name === 'TBD' ? 'images/teams/TBD.png' : `images/teams/${match.teamA.name}.png`;
    const logoB = match.teamB.name === 'TBD' ? 'images/teams/TBD.png' : `images/teams/${match.teamB.name}.png`;

    // 提示语逻辑
    let noticeHtml = '';
    if (isTBD) {
        noticeHtml = '<div class="tbd-notice">🔒 队伍待定</div>';
    } 
    else if (isAdminLocked && !isFinished) {
        // 只有在“被管理员锁了”且“还没出结果”时，才显示这个红字
        noticeHtml = '<div class="tbd-notice" style="color:#d9534f;">🔒 管理员暂停预测</div>';
    }

    // === 生成支持率条 HTML ===
    let statsHtml = '';
    // 只有当“已经预测”或者“比赛结束”时才显示，且必须有统计数据
    if ((pred || isFinished) && matchStats && matchStats.total > 0 && !isTBD) {
        const total = matchStats.total;
        const pctA = Math.round((matchStats.A / total) * 100);
        const pctB = Math.round((matchStats.B / total) * 100);
        
        statsHtml = `
            <div class="stats-container">
                <div class="stats-label">
                    <span style="color:var(--primary-pink)">${pctA}% ${match.teamA.name}</span>
                    <span style="color:var(--accent-purple)">${match.teamB.name} ${pctB}%</span>
                </div>
                <div class="stats-bar">
                    <div class="stats-fill-a" style="width:${pctA}%"></div>
                    <div class="stats-fill-b" style="width:${pctB}%"></div>
                </div>
                <div style="text-align:center; font-size:0.7rem; color:#bbb; margin-top:2px;">共 ${total} 人预测</div>
            </div>
        `;
    } else if ((pred || isFinished) && !isTBD) {
        statsHtml = `<div class="stats-container"><div class="stats-empty">暂无其他玩家预测数据</div></div>`;
    }

    const tzLine = formatThreeTZ(match.startTime);

    return `
        <div class="match-card ${statusClass}" data-id="${match._id}">
            <div class="match-info">
                <span>${match.customId} • ${match.format}</span>
                <span style="font-size:0.72rem; color:#888;">${tzLine}</span>
            </div>
            
            <div class="teams-container">
                <div class="team">
                    <div class="logo-wrapper">
                        <img src="${logoA}" class="team-logo" alt="${match.teamA.name}" onerror="this.src='images/logo_placeholder.png'">
                    </div>
                    <span>${nameA}</span>
                </div>
                
                <div class="score-inputs">
                    ${renderScoreControl(match._id, 'A', scoreA, maxScore, isFullyLocked)}
                    <span style="font-weight:bold; color:#ccc;">:</span>
                    ${renderScoreControl(match._id, 'B', scoreB, maxScore, isFullyLocked)}
                </div>

                <div class="team">
                    <div class="logo-wrapper">
                        <img src="${logoB}" class="team-logo" alt="${match.teamB.name}" onerror="this.src='images/logo_placeholder.png'">
                    </div>
                    <span>${nameB}</span>
                </div>
            </div>

            ${noticeHtml}
            ${resultText}
            ${statsHtml}
            
            ${(!isFullyLocked) ? `<button class="btn-submit-predict" onclick="submitPrediction('${match._id}')">确认预测</button>` : ''}
        </div>
    `;
}

function renderScoreControl(matchId, team, value, max, disabled) {
    if (disabled) {
        return `<div class="score-display" style="background:#f9f9f9; border-color:#eee; color:#666; cursor:default;">${value}</div>`;
    }
    return `
        <div class="score-control">
            <button class="score-btn" onclick="adjustScore('${matchId}', '${team}', 1, ${max})">▲</button>
            <div class="score-display" id="score-${matchId}-${team}" data-val="${value}">${value}</div>
            <button class="score-btn" onclick="adjustScore('${matchId}', '${team}', -1, ${max})">▼</button>
        </div>
    `;
}

window.adjustScore = (matchId, team, delta, maxWin) => {
    const elA = document.getElementById(`score-${matchId}-A`);
    const elB = document.getElementById(`score-${matchId}-B`);
    let valA = parseInt(elA.getAttribute('data-val'));
    let valB = parseInt(elB.getAttribute('data-val'));

    if (team === 'A') valA += delta; else valB += delta;
    if (valA < 0) valA = 0; if (valA > maxWin) valA = maxWin;
    if (valB < 0) valB = 0; if (valB > maxWin) valB = maxWin;

    if (valA === maxWin && valB === maxWin) {
        if (team === 'A') valB = maxWin - 1; else valA = maxWin - 1;
    }

    elA.innerText = valA; elA.setAttribute('data-val', valA);
    elB.innerText = valB; elB.setAttribute('data-val', valB);
};

window.submitPrediction = async (matchId) => {
    const scoreA = document.getElementById(`score-${matchId}-A`).getAttribute('data-val');
    const scoreB = document.getElementById(`score-${matchId}-B`).getAttribute('data-val');
    
    if(!confirm(`确认预测 ${scoreA}:${scoreB} 吗？`)) return;

    try {
        const res = await fetch('/api/predict', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ userId: App.user._id, matchId, teamAScore: scoreA, teamBScore: scoreB })
        });
        const data = await res.json();
        if (data.success) { alert("预测成功！"); loadData(); } // 提交成功后手动刷新一次数据
        else alert(data.message);
    } catch (e) { alert("网络错误"); }
};