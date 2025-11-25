// public/js/rankings.js

// === 成就元数据字典  ===
// 包含图标、全名、达成条件描述
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
    "喜忧参半": { icon: "🌗", desc: "猜对胜负但是猜错比分" }
};

document.addEventListener('DOMContentLoaded', () => {
    loadRankings('total');
});

window.switchTab = async (type) => {
    // 1. 样式切换
    const btns = document.querySelectorAll('.tab-btn');
    btns.forEach(b => b.classList.remove('active'));

    if (type === 'total') btns[0].classList.add('active');
    else if (type === 'daily') btns[1].classList.add('active');
    else if (type === 'achievements') btns[2].classList.add('active'); // 激活成就榜按钮

    // 2. 加载数据
    await loadRankings(type);
};

async function loadRankings(type) {
    const container = document.getElementById('rank-container');
    container.innerHTML = '<div class="loading">正在拉取排名数据...</div>';

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
        if (!res.ok) throw new Error("网络请求失败");
        const users = await res.json();
        
        renderTable(users, type);

    } catch (err) {
        console.error(err);
        container.innerHTML = `<p style="text-align:center; color:red;">加载失败: ${err.message}</p>`;
    }
}

function renderTable(users, type) {
    const container = document.getElementById('rank-container');
    
    if (!users || users.length === 0) {
        container.innerHTML = `<div style="text-align:center; padding:40px; color:#666;">👻 暂无数据</div>`;
        return;
    }

    // 根据不同榜单定义表头和列宽
    let headerHtml = '';
    if (type === 'achievements') {
        headerHtml = `
            <tr>
                <th width="15%">排名</th>
                <th width="25%">玩家</th>
                <th width="15%">解锁数量</th>
                <th width="45%">成就展示 (悬停查看)</th>
            </tr>`;
    } else {
        headerHtml = `
            <tr>
                <th width="15%">排名</th>
                <th width="35%">玩家</th>
                <th width="20%">积分</th>
                <th width="30%">成就</th>
            </tr>`;
    }

    let html = `<table class="leaderboard-table"><thead>${headerHtml}</thead><tbody>`;

    let currentRank = 1;
    let skip = 0;

    for (let i = 0; i < users.length; i++) {
        const user = users[i];
        
        // --- 1. 确定排序数值 (Value) ---
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

        // --- 2. 处理并列排名 (1, 1, 3) ---
        if (i > 0 && value === prevValue) {
            skip++;
        } else if (i > 0) {
            currentRank += 1 + skip;
            skip = 0;
        }

        // --- 3. 渲染排名图标 ---
        let rankDisplay = `<span style="font-weight:bold; color:#666">${currentRank}</span>`;
        if (currentRank === 1) rankDisplay = '👑';
        else if (currentRank === 2) rankDisplay = '🥈';
        else if (currentRank === 3) rankDisplay = '🥉';// public/js/rankings.js

// 记录当前状态，以便轮询时知道查哪个接口
let currentTabType = 'total'; 

document.addEventListener('DOMContentLoaded', () => {
    loadRankings('total');
    
    // === [新增] 开启轮询 ===
    setInterval(() => {
        // 静默刷新当前选中的榜单
        loadRankings(currentTabType, true); 
    }, 5000);
});

// 切换标签页
window.switchTab = async (type) => {
    currentTabType = type; // 更新当前状态

    // 1. 样式切换
    document.querySelectorAll('.tab-btn').forEach(btn => btn.classList.remove('active'));
    const buttons = document.querySelectorAll('.tab-btn');
    if (type === 'daily') { if (buttons[1]) buttons[1].classList.add('active'); }
    else if (type === 'achievements') { if (buttons[2]) buttons[2].classList.add('active'); }
    else { if (buttons[0]) buttons[0].classList.add('active'); }
    
    // 2. 加载数据 (立即执行，显示Loading)
    await loadRankings(type, false);
}

// 核心加载函数 (增加 isSilent 参数)
async function loadRankings(type, isSilent = false) {
    const container = document.getElementById('rank-container');
    
    // 如果不是静默刷新（即用户点击切换），则显示 Loading
    if (!isSilent) container.innerHTML = '<div class="loading">正在拉取排名数据...</div>';

    try {
        let url = '/api/rankings/total';
        
        if (type === 'daily') {
            const daySelect = document.getElementById('rank-day-select');
            const day = daySelect ? daySelect.value : 1; 
            url = `/api/rankings/daily/${day}`; 
        } else if (type === 'achievements') {
            url = '/api/rankings/achievements';
        }

        const res = await fetch(url);
        if (!res.ok) throw new Error("网络请求失败");
        
        const users = await res.json();
        renderTable(users, type);

    } catch (err) {
        console.error("加载失败:", err);
        // 静默刷新失败时不显示错误 UI，以免打扰用户
        if (!isSilent) container.innerHTML = `<p style="text-align:center; color:red;">加载失败: ${err.message}</p>`;
    }
}

// 渲染表格 (保持不变)
function renderTable(users, type) {
    const container = document.getElementById('rank-container');
    
    if (!users || users.length === 0) {
        container.innerHTML = `<div style="text-align:center; padding:40px; color:#666;">👻 暂无数据</div>`;
        return;
    }

    let headerHtml = '';
    if (type === 'achievements') {
        headerHtml = `<tr><th width="15%">排名</th><th width="25%">玩家</th><th width="15%">解锁数量</th><th width="45%">成就展示</th></tr>`;
    } else {
        headerHtml = `<tr><th width="15%">排名</th><th width="35%">玩家</th><th width="20%">积分</th><th width="30%">成就</th></tr>`;
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

        if (i > 0 && value === prevValue) skip++;
        else if (i > 0) { currentRank += 1 + skip; skip = 0; }

        let rankDisplay = `<span style="font-weight:bold; color:#666">${currentRank}</span>`;
        if (currentRank === 1) rankDisplay = '👑';
        else if (currentRank === 2) rankDisplay = '🥈';
        else if (currentRank === 3) rankDisplay = '🥉';

        let achievementHtml = '';
        if (user.achievements && user.achievements.length > 0) {
            user.achievements.forEach(ach => {
                const name = typeof ach === 'string' ? ach : ach.name;
                const iconMap = {
                    "闪电念": "⚡", "老开爱炸墙": "🧱", "reverse sweep": "🔄", "吃土豆": "🥔", 
                    "再冲一次": "☝️", "最中幻想": "💭", "landon见面交铃铛tp": "🔔", 
                    "冯哥见面三段闪": "✨", "闹麻了": "💢", "以父之名": "🙏", "新皇后街": "🏰", 
                    "反向木子": "📉", "P>L": "🦁", "西巴堡": "🍔", "喜忧参半": "🌗"
                };
                achievementHtml += `<span class="achievement-icon" title="${name}">${iconMap[name] || "🏅"}</span>`;
            });
        }

        html += `<tr><td style="font-size:1.2rem;">${rankDisplay}</td><td style="font-weight:bold;">${user.nickname}</td><td style="color:var(--accent-purple); font-weight:900; font-size:1.1rem;">${value}</td><td>${achievementHtml}</td></tr>`;
    }
    html += `</tbody></table>`;
    container.innerHTML = html;
}

        // --- 4. 生成成就图标 HTML (带 Tooltip) ---
        let achievementHtml = '';
        if (user.achievements && user.achievements.length > 0) {
            user.achievements.forEach(ach => {
                const name = typeof ach === 'string' ? ach : ach.name;
                const meta = ACHIEVEMENT_META[name] || { icon: "🏅", desc: "未知成就" };
                
                //  鼠标放上去显示全名和达成方法
                achievementHtml += `
                    <span class="achievement-icon" title="${name}: ${meta.desc}">
                        ${meta.icon}
                    </span>`;
            });
        } else {
            achievementHtml = '<span style="color:#ccc; font-size:0.8em;">暂无</span>';
        }

        // --- 5. 组合行 HTML ---
        html += `<tr>
            <td style="font-size:1.2rem;">${rankDisplay}</td>
            <td style="font-weight:bold;">${user.nickname}</td>
            <td style="color:var(--accent-purple); font-weight:900; font-size:1.1rem;">${value}</td>
            <td>${achievementHtml}</td>
        </tr>`;
    }

    html += `</tbody></table>`;
    container.innerHTML = html;
}