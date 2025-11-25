// fix_indexes.js
require('dotenv').config();
const mongoose = require('mongoose');

// 确保这里连接的是你 Render 上用的那个云端数据库
// 如果你是在本地运行修复，请确保 .env 文件里的 MONGODB_URI 是云端链接
mongoose.connect(process.env.MONGODB_URI, {
    useNewUrlParser: true,
    useUnifiedTopology: true
}).then(async () => {
    console.log("🔧 正在连接数据库进行修复...");

    try {
        // 获取 users 集合
        const collection = mongoose.connection.collection('users');

        // 列出当前所有索引，看看都在乱搞些什么
        const indexes = await collection.indexes();
        console.log("当前存在的索引:", indexes.map(i => i.name));

        // 尝试删除那个捣乱的 'username_1' 索引
        // 注意：为了彻底干净，我们直接删除 users 表的所有索引
        // 不用担心，Mongoose 会在重启服务器时自动重建正确的索引 (nickname)
        await collection.dropIndexes();
        
        console.log("✅ 成功！已清除所有旧索引。");
        console.log("👉 请重启你的网站服务器 (npm start)，系统会自动建立正确的新索引。");

    } catch (err) {
        console.error("❌ 修复过程中出错:", err.message);
    } finally {
        mongoose.connection.close();
    }
});