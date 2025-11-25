// reset_predictions.js
require('dotenv').config();
const mongoose = require('mongoose');
const Prediction = require('./models/Prediction');

mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/owcs_prediction', {
    useNewUrlParser: true,
    useUnifiedTopology: true
}).then(async () => {
    console.log("🧹 正在清理无效的旧预测数据...");
    await Prediction.deleteMany({});
    console.log("✅ 预测记录已清空，现在大家都在同一起跑线了！");
    mongoose.connection.close();
});