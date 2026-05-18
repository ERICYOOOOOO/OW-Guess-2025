require('dotenv').config();
const express = require('express');
const mongoose = require('mongoose');
const bodyParser = require('body-parser');
const path = require('path');

const authRoutes = require('./routes/auth');
const matchRoutes = require('./routes/matches');
const predictRoutes = require('./routes/predict');
const rankingRoutes = require('./routes/rankings');
const adminRoutes = require('./routes/admin');
const { router: bracketRoutes } = require('./routes/bracket');
const syncScheduler = require('./lib/sync-scheduler');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, 'public')));

mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/owcs_prediction_2026', {
    useNewUrlParser: true,
    useUnifiedTopology: true
})
.then(() => {
    console.log('✅ MongoDB Connected Successfully');
    // 启动 Liquipedia 同步调度器
    syncScheduler.start({
        autoSettleHook: async (matchId, scoreA, scoreB) => {
            await adminRoutes.settleMatchCore(matchId, scoreA, scoreB);
        }
    });
})
.catch(err => console.error('❌ MongoDB Connection Error:', err));

app.use('/api/auth', authRoutes);
app.use('/api/matches', matchRoutes);
app.use('/api/predict', predictRoutes);
app.use('/api/rankings', rankingRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/bracket', bracketRoutes);

app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.listen(PORT, () => {
    console.log(`🚀 Server running on port ${PORT}`);
    console.log(`👉 Open http://localhost:${PORT} in your browser`);
});
