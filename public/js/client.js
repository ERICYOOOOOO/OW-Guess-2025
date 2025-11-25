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