// models/Setting.js
// 全局键值配置 (单例风格)
const mongoose = require('mongoose');

const settingSchema = new mongoose.Schema({
    key: { type: String, required: true, unique: true, index: true },
    value: mongoose.Schema.Types.Mixed,
    updatedAt: { type: Date, default: Date.now }
});

settingSchema.statics.get = async function (key, defaultValue = null) {
    const doc = await this.findOne({ key }).lean();
    return doc ? doc.value : defaultValue;
};

settingSchema.statics.set = async function (key, value) {
    return this.findOneAndUpdate(
        { key },
        { value, updatedAt: new Date() },
        { upsert: true, new: true }
    );
};

module.exports = mongoose.model('Setting', settingSchema);
