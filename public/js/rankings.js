// public/js/rankings.js

const ACHIEVEMENT_META = {
    "闪电念": { icon: "⚡", desc: "连续三场比分全猜对 (时间顺序上)" },
    "老开爱炸墙": { icon: "🧱", desc: "连续三场胜负全错 (时间顺序上)" },
    "reverse sweep": { icon: "🔄", desc: "猜对一场让二追三的比分" },
    "吃土豆": { icon: "🥔", desc: "一天猜错所有胜负" },
    "再冲一次": { icon: "☝️", desc: "OA的每场预测胜负都猜OA赢" },
    "最中幻想": { icon: "💭", desc: "猜对OA战胜CR/FLC/TM的比分" },
    "landon见面交铃铛tp": { icon: "🔔", desc: "猜对OA战胜QAD的比分" },
    "冯哥见面三段闪": { icon: "✨", desc: "猜对QAD战胜OA的比分" },
    "闹麻了": { icon: "💢", desc: "猜对OA二连败回家的胜负" },
    "以父之名": { icon: "🙏", desc: "猜对CR战胜OA的比分" },
    "新皇后街": { icon: "🏰", desc: "猜对OA/CC在新皇后街胜利" },
    "反向木子": { icon: "📉", desc: "连续两天获得当天日榜榜首" },
    "P>L": { icon: "🦁", desc: "猜对CR战胜OA的比分" },
    "西巴堡": { icon: "🍔", desc: "猜对TM战胜OA的比分" },
    "喜忧参半": { icon: "🌗", desc: "猜对胜负但是猜错比分" },
    "来晚了": { icon: "🏃", desc: "在后来触发猜对胜负但是猜错比分" },
    "难兄难弟": { icon: "👬", desc: "猜对OA对战CC的比分" }
};

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

    if (type === 'daily') { 
        if (buttons[1]) buttons[1].classList.add('active'); 
        const daySelect = document.getElementById('rank-day-select');
        const dayText = daySelect.options[daySelect.selectedIndex].text;
        if(subtitle) subtitle.innerText = `今日排行 - ${dayText}`;
    }
    else if (type === 'achievements') { 
        if (buttons[2]) buttons[2].classList.add('active'); 
        if(subtitle) subtitle.innerText = "成就解锁榜";
    }
    else { 
        if (buttons[0]) buttons[0].classList.add('active'); 
        if(subtitle) subtitle.innerText = "总积分榜";
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
        let url = '';
        if (type === 'total') url = '/api/rankings/total';
        else if (type === 'achievements') url = '/api/rankings/achievements';
        else {
            const daySelect = document.getElementById('rank-day-select');
            const day = daySelect ? daySelect.value : 1;
            url = `/api/rankings/daily/${day}`;
        }

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

    // [修改] 动态定义表头
    let headerHtml = '';
    // 如果是积分榜(总榜或日榜)，显示战绩列
    const showStats = type === 'total' || type === 'daily';

    if (type === 'achievements') {
        headerHtml = `
            <tr>
                <th width="10%">排名</th>
                <th width="30%">玩家</th>
                <th width="10%">解锁</th>
                <th width="50%">成就展示</th>
            </tr>`;
    } else {
        headerHtml = `
            <tr>
                <th width="10%">排名</th>
                <th width="25%">玩家</th>
                <th width="15%">积分</th>
                <th width="25%">战绩详情</th>
                <th width="25%">成就</th>
            </tr>`;
    }

    let html = `<table class="leaderboard-table"><thead>${headerHtml}</thead><tbody>`;

    let currentRank = 1;
    let skip = 0;

    for (let i = 0; i < users.length; i++) {
        const user = users[i];
        
        let value = 0;
        let prevValue = 0;

        if (type === 'total') {
            value = user.totalScore || 0;
            if (i > 0) prevValue = users[i-1].totalScore || 0;
        } else if (type === 'daily') {
            value = user.dailyScore || 0;
            if (i > 0) prevValue = users[i-1].dailyScore || 0;
        } else if (type === 'achievements') {
            value = user.achievements ? user.achievements.length : 0;
            if (i > 0) prevValue = users[i-1].achievements ? users[i-1].achievements.length : 0;
        }

        if (i > 0 && value === prevValue) { skip++; } 
        else if (i > 0) { currentRank += 1 + skip; skip = 0; }

        let rankDisplay = `<span style="font-weight:bold; color:#666">${currentRank}</span>`;
        if (currentRank === 1) rankDisplay = '👑';
        else if (currentRank === 2) rankDisplay = '🥈';
        else if (currentRank === 3) rankDisplay = '🥉';

        // [新增] 战绩 HTML
        let statsHtml = '';
        if (showStats && user.stats) {
            statsHtml = `
                <div style="font-size:0.75rem; color:#666; line-height:1.4;">
                    <div>胜负: <b>${user.stats.wins}</b></div>
                    <div style="display:flex; gap:5px; justify-content:center; opacity:0.8;">
                        <span title="FT4精确">FT4:${user.stats.ft4}</span>
                        <span title="FT3精确">FT3:${user.stats.ft3}</span>
                        <span title="FT2精确">FT2:${user.stats.ft2}</span>
                    </div>
                </div>
            `;
        } else if (showStats) {
            statsHtml = '<span style="color:#ccc">-</span>';
        }

        // 成就 HTML
        let achievementHtml = '';
        if (user.achievements && user.achievements.length > 0) {
            user.achievements.forEach(ach => {
                const name = typeof ach === 'string' ? ach : ach.name;
                const meta = ACHIEVEMENT_META[name] || { icon: "🏅", desc: "未知成就" };
                achievementHtml += `<span class="achievement-icon" title="${name}: ${meta.desc}">${meta.icon}</span>`;
            });
        } else {
            achievementHtml = '<span style="color:#ccc; font-size:0.8em;">暂无</span>';
        }

        html += `<tr>
            <td style="font-size:1.2rem;">${rankDisplay}</td>
            <td style="font-weight:bold;">${user.nickname}</td>
            
            ${showStats ? `<td style="color:var(--accent-purple); font-weight:900; font-size:1.1rem;">${value}</td>` : ''}
            ${showStats ? `<td>${statsHtml}</td>` : ''}
            ${!showStats ? `<td style="color:var(--accent-purple); font-weight:900;">${value}</td>` : ''}
            
            <td>${achievementHtml}</td>
        </tr>`;
    }

    html += `</tbody></table>`;
    container.innerHTML = html;
}