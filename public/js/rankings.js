// public/js/rankings.js

// === 成就元数据字典 ===
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
    "来晚了": { icon: "🏃", desc: "在后来触发猜对胜负但是猜错比分" }
};

let currentTabType = 'total';

document.addEventListener('DOMContentLoaded', () => {
    loadRankings('total');
    
    // 开启轮询 (5秒一次)
    setInterval(() => {
        loadRankings(currentTabType, true); 
    }, 5000);
});

// 切换标签页
window.switchTab = async (type) => {
    currentTabType = type;
    
    // 1. 样式切换
    document.querySelectorAll('.tab-btn').forEach(btn => btn.classList.remove('active'));
    const buttons = document.querySelectorAll('.tab-btn');
    
    // 更新水印副标题
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

    // 2. 加载数据
    await loadRankings(type, false);
};

// [新增] 截图下载功能
window.downloadImage = async () => {
    const captureArea = document.getElementById('capture-area');
    const watermark = document.getElementById('export-watermark');
    const btn = document.querySelector('button[onclick="downloadImage()"]');
    
    if (!captureArea || !watermark) return alert("页面元素加载不全");

    // 1. 准备截图
    watermark.style.display = 'block';
    const originalText = btn.innerText;
    btn.innerHTML = '⏳ 生成中...';
    btn.disabled = true;

    try {
        // 2. 执行截图
        const canvas = await html2canvas(captureArea, {
            scale: 2, // 高清
            backgroundColor: '#ffffff',
            useCORS: true
        });

        // 3. 下载
        const link = document.createElement('a');
        link.download = `OWCS-Ranking-${new Date().getTime()}.png`;
        link.href = canvas.toDataURL('image/png');
        link.click();

    } catch (err) {
        console.error("截图失败:", err);
        alert("生成图片失败，请使用手机截屏");
    } finally {
        // 4. 恢复
        watermark.style.display = 'none';
        btn.innerHTML = originalText;
        btn.disabled = false;
    }
};

// 核心加载函数
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
        if (!res.ok) throw new Error("网络请求失败");
        const users = await res.json();
        
        renderTable(users, type);

    } catch (err) {
        if (!isSilent) container.innerHTML = `<p style="text-align:center; color:red;">加载失败: ${err.message}</p>`;
    }
}

// 渲染表格
function renderTable(users, type) {
    const container = document.getElementById('rank-container');
    
    if (!users || users.length === 0) {
        container.innerHTML = `<div style="text-align:center; padding:40px; color:#666;">👻 暂无数据</div>`;
        return;
    }

    let headerHtml = '';
    if (type === 'achievements') {
        headerHtml = `<tr><th width="15%">排名</th><th width="25%">玩家</th><th width="15%">解锁数量</th><th width="45%">成就展示 (悬停查看)</th></tr>`;
    } else {
        headerHtml = `<tr><th width="15%">排名</th><th width="35%">玩家</th><th width="20%">积分</th><th width="30%">成就</th></tr>`;
    }

    let html = `<table class="leaderboard-table"><thead>${headerHtml}</thead><tbody>`;

    let currentRank = 1;
    let skip = 0;

    for (let i = 0; i < users.length; i++) {
        const user = users[i];
        
        // 确定数值
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

        // 并列逻辑
        if (i > 0 && value === prevValue) {
            skip++;
        } else if (i > 0) {
            currentRank += 1 + skip;
            skip = 0;
        }

        let rankDisplay = `<span style="font-weight:bold; color:#666">${currentRank}</span>`;
        if (currentRank === 1) rankDisplay = '👑';
        else if (currentRank === 2) rankDisplay = '🥈';
        else if (currentRank === 3) rankDisplay = '🥉';

        // 成就图标
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
            <td style="color:var(--accent-purple); font-weight:900; font-size:1.1rem;">${value}</td>
            <td>${achievementHtml}</td>
        </tr>`;
    }

    html += `</tbody></table>`;
    container.innerHTML = html;
}