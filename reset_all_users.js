// reset_all_users.js
require('dotenv').config();
const mongoose = require('mongoose');
const User = require('./models/user');
const Prediction = require('./models/Prediction');

mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/owcs_prediction', {
    useNewUrlParser: true,
    useUnifiedTopology: true
}).then(async () => {
    console.log("⚠️  正在启动核清理程序...");
    
    // 1. 删除所有预测记录 (防止残留孤儿数据)
    const predResult = await Prediction.deleteMany({});
    console.log(`🗑️  已清除 ${predResult.deletedCount} 条预测记录`);

    // 2. 删除所有用户 (账号、分数、成就全没)
    const userResult = await User.deleteMany({});
    console.log(`💀 已清除 ${userResult.deletedCount} 名玩家资料`);

    console.log("✅ 数据库已重置！所有玩家数据已清空。");
    console.log("提示：比赛赛程 (Matches) 未被删除，新玩家注册后即可直接开始预测。");

    mongoose.connection.close();
}).catch(err => {
    console.error("❌ 错误:", err);
    mongoose.connection.close();
});