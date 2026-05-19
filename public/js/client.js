// public/js/client.js

const API_BASE = '/api';

// 1. 全局状态管理
const App = {
    user: JSON.parse(localStorage.getItem('owcs_user')) || null,

    // 登录方法
    login: async (nickname, wechatId) => {
        try {
            const res = await fetch(`${API_BASE}/auth/login`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ nickname, wechatId })
            });
            const data = await res.json();
            
            if (data.success) {
                App.user = data.user;
                localStorage.setItem('owcs_user', JSON.stringify(data.user));
                return { success: true, isNew: data.isNew };
            } else {
                return { success: false, message: data.message };
            }
        } catch (err) {
            console.error(err);
            return { success: false, message: '网络连接失败' };
        }
    },

    // 退出登录
    logout: () => {
        App.user = null;
        localStorage.removeItem('owcs_user');
        window.location.href = '/';
    },

    // 检查是否登录 (未登录则跳转)
    requireAuth: () => {
        if (!App.user) {
            // 如果在需要登录的页面发现没登录，重定向到预测页(那里有登录框)
            // 或者弹出登录提示
            return false;
        }
        return true;
    }
};

// 2. 页面加载时的通用处理
document.addEventListener('DOMContentLoaded', () => {
    updateNav();
});

// 更新导航栏状态 (显示用户名)
function updateNav() {
    const userDisplay = document.getElementById('user-display');
    if (userDisplay && App.user) {
        userDisplay.innerHTML = `
            <span>欢迎, <b>${App.user.nickname}</b></span>
            <button onclick="App.logout()" class="btn-logout" style="font-size:0.8rem; margin-left:10px;">[退出]</button>
        `;
    }
}

// ... (前面的代码保持不变)

// === 新增：主页加载前三名 ===
// 只有在主页(存在 hero-leaderboard 元素)时才运行
if (document.getElementById('hero-leaderboard')) {
    loadHeroLeaderboard();
}

async function loadHeroLeaderboard() {
    try {
        const res = await fetch('/api/rankings/total');
        const users = await res.json();
        const container = document.getElementById('hero-leaderboard');

        if (!users || users.length === 0) {
            container.innerHTML = '<div style="font-size:0.9rem; color:#666;">👻 暂无排名，快去抢首杀！</div>';
            return;
        }

        // 只取前三名，不足3人也兼容
        const top3 = users.slice(0, 3);
        let html = '';

        // 定义奖牌图标
        const medals = ['👑', '🥈', '🥉'];
        // 定义样式类名 (注意顺序：数据是按 1,2,3 排的，但 CSS 里我们用 order 属性让冠军在中间)
        // 循环里：index 0 是冠军，index 1 是亚军...
        
        top3.forEach((user, index) => {
            // /api/rankings/total 返回 displayScore = max(realtime, bracket)
            // 兼容旧字段 (totalScore) 防止历史接口回退
            const score = (user.displayScore != null ? user.displayScore : (user.totalScore || 0));
            const source = user.displaySource === 'bracket' ? '🎯' : '🎮';
            const rankClass = `rank-${index + 1}-card`;
            const icon = medals[index];

            html += `
                <div class="top3-card ${rankClass}">
                    <span class="rank-icon">${icon}</span>
                    <div class="top3-name">${user.nickname}</div>
                    <div class="top3-score">${score} <span style="font-size:0.65em; opacity:0.7;">${source}</span></div>
                </div>
            `;
        });

        container.innerHTML = html;

    } catch (err) {
        console.error("无法加载主页排行:", err);
        document.getElementById('hero-leaderboard').style.display = 'none'; // 出错就隐藏，不影响美观
    }
}