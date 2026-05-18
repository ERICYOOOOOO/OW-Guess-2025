// public/js/rankings.js
// Phase 6 会重写。此处先把成就 UI 去掉，保留总榜骨架。

let currentTabType = 'total';

document.addEventListener('DOMContentLoaded', () => {
    loadRankings('total');
    setInterval(() => { loadRankings(currentTabType, true); }, 5000);
});

window.switchTab = async (type) => {
    currentTabType = type;
    document.querySelectorAll('.tab-btn').forEach(btn => btn.classList.remove('active'));
    const buttons = document.querySelectorAll('.tab-btn');
    const subtitle = document.getElementById('export-subtitle');

    if (type === 'bracket') {
        if (buttons[1]) buttons[1].classList.add('active');
        if (subtitle) subtitle.innerText = "Bracket 榜";
    } else {
        if (buttons[0]) buttons[0].classList.add('active');
        if (subtitle) subtitle.innerText = "合并榜";
    }

    await loadRankings(type, false);
};

window.downloadImage = async () => {
    const captureArea = document.getElementById('capture-area');
    const watermark = document.getElementById('export-watermark');
    const btn = document.querySelector('button[onclick="downloadImage()"]');

    if (!captureArea || !watermark) return alert("页面元素加载不全");

    watermark.style.display = 'block';
    const originalText = btn.innerText;
    btn.innerHTML = '⏳ 生成中...';
    btn.disabled = true;

    try {
        const canvas = await html2canvas(captureArea, { scale: 2, backgroundColor: '#ffffff', useCORS: true });
        const link = document.createElement('a');
        link.download = `OWCS-Ranking-${new Date().getTime()}.png`;
        link.href = canvas.toDataURL('image/png');
        link.click();
    } catch (err) {
        console.error(err);
        alert("生成图片失败");
    } finally {
        watermark.style.display = 'none';
        btn.innerHTML = originalText;
        btn.disabled = false;
    }
};

async function loadRankings(type, isSilent = false) {
    const container = document.getElementById('rank-container');
    if (!isSilent) container.innerHTML = '<div class="loading">正在拉取排名数据...</div>';

    try {
        const url = type === 'bracket' ? '/api/rankings/bracket' : '/api/rankings/total';
        const res = await fetch(url);
        const users = await res.json();
        renderTable(users, type);
    } catch (err) {
        if (!isSilent) container.innerHTML = `<p style="text-align:center; color:red;">加载失败: ${err.message}</p>`;
    }
}

function renderTable(users, type) {
    const container = document.getElementById('rank-container');

    if (!users || users.length === 0) {
        container.innerHTML = `<div style="text-align:center; padding:40px; color:#666;">👻 暂无数据</div>`;
        return;
    }

    let html = `<table class="leaderboard-table"><thead>
        <tr>
            <th width="10%">排名</th>
            <th width="30%">玩家</th>
            <th width="15%">积分</th>
            <th width="20%">来源</th>
            <th width="25%">战绩</th>
        </tr></thead><tbody>`;

    let currentRank = 1;
    let skip = 0;

    for (let i = 0; i < users.length; i++) {
        const user = users[i];
        const value = (type === 'bracket') ? (user.bracketScore || 0) : (user.displayScore != null ? user.displayScore : user.totalScore || 0);
        const prevValue = i > 0
            ? (type === 'bracket' ? (users[i-1].bracketScore || 0) : (users[i-1].displayScore != null ? users[i-1].displayScore : users[i-1].totalScore || 0))
            : 0;

        if (i > 0 && value === prevValue) skip++;
        else if (i > 0) { currentRank += 1 + skip; skip = 0; }

        let rankDisplay = `<span style="font-weight:bold; color:#666">${currentRank}</span>`;
        if (currentRank === 1) rankDisplay = '👑';
        else if (currentRank === 2) rankDisplay = '🥈';
        else if (currentRank === 3) rankDisplay = '🥉';

        const sourceBadge = (type === 'bracket')
            ? '<span class="src-badge src-bracket">Bracket</span>'
            : (user.displaySource === 'bracket'
                ? '<span class="src-badge src-bracket">Bracket</span>'
                : '<span class="src-badge src-realtime">实时</span>');

        const stats = user.stats || { wins: 0, ft2: 0, ft3: 0, ft4: 0 };
        const statsHtml = `
            <div style="font-size:0.75rem; color:#666; line-height:1.4;">
                <div>胜负: <b>${stats.wins}</b></div>
                <div style="display:flex; gap:5px; justify-content:center; opacity:0.8;">
                    <span title="FT4精确">FT4:${stats.ft4}</span>
                    <span title="FT3精确">FT3:${stats.ft3}</span>
                    <span title="FT2精确">FT2:${stats.ft2}</span>
                </div>
            </div>`;

        html += `<tr>
            <td style="font-size:1.2rem;">${rankDisplay}</td>
            <td style="font-weight:bold;">${user.nickname}</td>
            <td style="color:var(--accent-purple); font-weight:900; font-size:1.1rem;">${value}</td>
            <td>${sourceBadge}</td>
            <td>${statsHtml}</td>
        </tr>`;
    }

    html += `</tbody></table>`;
    container.innerHTML = html;
}
