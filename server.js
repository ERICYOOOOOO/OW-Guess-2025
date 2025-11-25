require('dotenv').config();
const express = require('express');
const mongoose = require('mongoose');
const bodyParser = require('body-parser');
const path = require('path');

// 1. 先引入所有路由文件 (必须在 app.use 之前！)
const authRoutes = require('./routes/auth');
const matchRoutes = require('./routes/matches');
const predictRoutes = require('./routes/predict');
const rankingRoutes = require('./routes/rankings');
const adminRoutes = require('./routes/admin');

const app = express();
const PORT = process.env.PORT || 3000;

// 2. 中间件配置
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, 'public'))); // 托管前端页面

// 3. 数据库连接
mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/owcs_prediction', {
    useNewUrlParser: true,
    useUnifiedTopology: true
})
.then(() => console.log('✅ MongoDB Connected Successfully'))
.catch(err => console.error('❌ MongoDB Connection Error:', err));

// 4. 配置 API 路由 (使用刚才引入的变量)
app.use('/api/auth', authRoutes);
app.use('/api/matches', matchRoutes);
app.use('/api/predict', predictRoutes);
app.use('/api/rankings', rankingRoutes);
app.use('/api/admin', adminRoutes);

// 5. 默认路由 (让所有未匹配的 API 请求都返回主页，防止 404)
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// 6. 启动服务器
app.listen(PORT, () => {
    console.log(`🚀 Server running on port ${PORT}`);
    console.log(`👉 Open http://localhost:${PORT} in your browser`);
});