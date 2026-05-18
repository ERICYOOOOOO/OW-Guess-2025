# OWCS 2026 Stage 1 改造需求 (待确认稿)

> 把现有 2025 多伦多版本改造成给即将开打的 **OWCS 2026 Champions Clash**（Stage 1 国际总决赛）使用。
> 本文档先把需求和细节铺平、列出待确认点，**经你 review 并回答下面的问题后再开始动手写代码**。

---

## 1. 新赛事基本信息

- **官方名称**：Overwatch Champions Series 2026 — **Champions Clash** (Stage 1 的国际总决赛)
- **时间**：JST **5/22 ~ 5/24**。对应北美 EDT 约 **5/21 23:00 ~ 5/24 早上**，所以你说的"21号到24号"完全对得上（看北美时区，第一场就在 5/21 晚上）。
- **地点**：东京 Arena Tachikawa Tachihi
- **赛制**：8 队 **双败淘汰**
- **资料来源**：Liquipedia / Blizzard / Esports.gg

### 8 支参赛队伍

| 缩写 | 全名 | 区域 |
|---|---|---|
| WBG | Weibo Gaming | China |
| VP | Virtus.pro | EMEA |
| ZETA | ZETA DIVISION | Asia (Japan) |
| SSG | Spacestation Gaming | NA |
| DAL | Dallas Fuel | NA |
| CR | Crazy Raccoon | Asia |
| TM | Twisted Minds | EMEA |
| AG | All Gamers | China |

### 完整赛程（来自 Liquipedia，**我数出来是 14 场，你说 13 — 待确认**）

| customId | day | 对阵 | JST 时间 | EDT 时间 | 赛制 |
|---|---|---|---|---|---|
| UBQF1 | 1 | WBG vs VP        | 5/22 12:00 | 5/21 23:00 | FT2 (Bo3) |
| UBQF2 | 1 | ZETA vs SSG      | 5/22 13:15 | 5/22 00:15 | FT2 |
| UBQF3 | 1 | DAL vs CR        | 5/22 14:30 | 5/22 01:30 | FT2 |
| UBQF4 | 1 | TM vs AG         | 5/22 15:45 | 5/22 02:45 | FT2 |
| LBR1A | 1 | UBQF1 输 vs UBQF2 输 | 5/22 17:00 | 5/22 04:00 | FT2 |
| LBR1B | 1 | UBQF3 输 vs UBQF4 输 | 5/22 18:15 | 5/22 05:15 | FT2 |
| UBSF1 | 2 | UBQF1 赢 vs UBQF2 赢 | 5/23 12:00 | 5/22 23:00 | FT3 (Bo5) |
| UBSF2 | 2 | UBQF3 赢 vs UBQF4 赢 | 5/23 13:45 | 5/23 00:45 | FT3 |
| LBQF1 | 2 | LBR1A 赢 vs UBSF? 输 | 5/23 15:30 | 5/23 02:30 | FT3 |
| LBQF2 | 2 | LBR1B 赢 vs UBSF? 输 | 5/23 17:15 | 5/23 04:15 | FT3 |
| LBSF  | 2 | LBQF1 赢 vs LBQF2 赢 | 5/23 19:00 | 5/23 06:00 | FT3 |
| UBF   | 2 | UBSF1 赢 vs UBSF2 赢 | 5/23 TBD   | 5/23 TBD   | FT3 |
| LBF   | 3 | UBF 输 vs LBSF 赢   | 5/24 14:45 | 5/24 01:45 | FT3 |
| GF    | 3 | UBF 赢 vs LBF 赢    | 5/24 12:00? | 5/24 ~00:00 | FT3 / FT4 ⚠️ |

⚠️ **你看到的 13 场是不是没把 bracket reset 算进去？** 我按标准 8 队双败数出来就是 13 场（GF 1 场，不含重置），或者 14 场（含重置/Bo7）。请你跟我对一下到底是哪个版本。

---

## 2. 改动一：完全移除「隐藏成就系统」

不论是结算时的自动判定、管理员手动颁发、还是用户面板上的展示，全部清掉。

### 后端要删的东西
- `routes/admin.js`：`processAchievements()`、`getUserHistory()`、`achievementRules[]` 整段逻辑、`/api/admin/manage-achievement`、settle 里调用 `processAchievements` 的代码。
- `routes/rankings.js`：`/api/rankings/achievements`，以及 total/daily 榜里 select 的 `achievements` 字段。
- `models/user.js`：删 `achievements` 字段（新赛事是干净数据库，没历史包袱）。
- `routes/predict.js`、`routes/auth.js` 等其他文件里关联的 0.5 分首杀奖励逻辑。

### 前端要删的东西
- `index.html`、`predict.html`、`rankings.html`：成就榜入口、Top3 上的成就徽章、用户卡片里的成就展示。
- `admin.html`：管理用户成就的 UI。
- 任何提示 "🏆 抢到首杀成就" 之类的文案/特效。

---

## 3. 改动二：双模式预测系统

每个玩家可以**同时**用两种方式参与（互不冲突，分别打分进不同榜单）：

### 模式 A：实时单场预测（现有玩法，保留不动）
- 比赛开始前提交单场比分，开赛即锁。
- 计分规则**完全保留**：
  - 猜对胜负 **+1**
  - 比分完全猜对额外：**FT2 +0.5 / FT3 +1 / FT4 +2**
- 一人一场一次，不可改。

### 模式 B：Bracket 整体预测（新增）
- 类似 NCAA March Madness：**5/21 第一场开打前**，玩家一次性把全部 13 (或 14) 场的胜者 + 比分填完。
- 提交后**全部锁定**，不可修改。
- 后续比赛在前端按玩家自己的预测自动推进（玩家在 UBQF1 选了 WBG 赢 → UBSF1 自动填上 WBG）。
- 每场单独按现有规则结算（**同样的 +1 / +0.5 / +1 / +2 计分**）。
- 玩家的 bracket 总分 = 所有 13/14 场预测得分之和。

### 关键设计点（**待你拍板**）

**Q1：bracket 评分的语义？**
我建议采用 **"按你写的比分独立判分"** 这一标准 NCAA 做法：
- 比如你在 bracket 里说 "UBSF1: WBG 3-1 SSG"，实际 UBSF1 是 ZETA 3-1 SSG，那这场你的胜负预测算对（都说"队伍A 赢"），比分完美算对，+1+1=+2 分。
- 也就是说**只看你写的比分和实际比分的对比，不要求你预测的队伍真的出现在那一轮**。
- 替代方案：要求"队伍也猜对"才能拿胜负分——但这样太苛刻，前期错一场后面全废。

**Q2：是否允许两个模式同时参与？**
我假设**允许**：同一账号既能在赛中做单场预测，也能赛前提交 bracket，分别进两个榜。

**Q3：bracket UI 形式？**
- 选项 A：传统树状 bracket（左 UB / 右 LB / 中 GF），点击每个 match 弹窗填比分，自动把胜者推进到下一格。
- 选项 B：列表形式，所有 14 场列成一张大表单一次填完，旁边小图示意 bracket 结构。
- 我倾向 **A**（视觉清晰、防止误填），但 A 工作量大些。

### 数据模型新增

新建 `models/BracketPrediction.js`：
```js
{
  userId: ObjectId (ref User, unique),
  submittedAt: Date,
  isLocked: Boolean,
  bracketScore: Number (cached total),
  picks: [{
    matchCustomId: String,         // "UBQF1", "LBF", "GF"...
    teamAName: String,             // 玩家填的对阵 A（可能是 TBD 推出来的）
    teamBName: String,
    predTeamAScore: Number,
    predTeamBScore: Number,
    predWinner: String,
    pointsEarned: Number,          // 结算后填
    isPerfect: Boolean,            // 结算后填
    status: "pending" | "judged"
  }]
}
```

`User` schema 加一个缓存字段方便排序：
```js
bracketScore: { type: Number, default: 0, index: true }
```

### 新增 API
- `POST /api/bracket/submit` — 提交 bracket（仅在锁定时间前可用）。
- `GET  /api/bracket/my/:userId` — 拿自己的 bracket。
- `GET  /api/bracket/template` — 给前端返回空的 bracket 结构 + 锁定时间。
- 已有的 `POST /api/admin/settle` 内追加逻辑：每场结算后同步刷新所有 bracket 在这一场的 `pointsEarned` + 用户 `bracketScore`。

---

## 4. 改动三：两个独立排行榜

⚠️ **你原话有点歧义，请确认是哪种方案**：

### 方案 1（推荐）：完全分开
- **实时预测榜（总榜）**：累计模式 A 的 `totalScore`。
- **Bracket 预测榜**：累计模式 B 的 `bracketScore`。
- 各自独立排名，互不影响。

### 方案 2：合并 + 单独
- **总榜（合并）**：模式 A `totalScore` + 模式 B `bracketScore` 加总后排。
- **Bracket 榜**：只看 `bracketScore`。

我读你的描述（"两个榜单，总榜（每个比赛实时方式预测榜和 bracket 预测榜"）感觉是**方案 1**，但 typo 较多想确认。

### 其他榜单
- 日榜（按 day 分天）：是否保留？现在只有 3 天，每天 5–7 场，保留也合理。
- 隐藏成就榜：已删。

---

## 5. 顺手要处理的其他改动

- `seed.js` 整个重写：13/14 场新赛程、新队伍、新时间。
- `routes/admin.js` 里 `BRACKET_MAP` 整个重写，对应新双败结构（13 场比 2025 的 23 场简单很多）。
- 加一个全局常量 `BRACKET_LOCK_TIME`（=第一场开赛时间，到点后 bracket 提交接口拒收）。
- 文案：现在主页是 "新皇后街居委会·英杰预测王"——是否换成新主题？或保留这个梗？
- 数据库：建议**换一个 db name**（如 `owcs_prediction_2026`），与 2025 数据彻底隔离，避免误污染。或者用工厂重置清空再 seed。
- 项目名 `OW-Guess-2025` / package 名 `owcs-prediction-2025`：要不要改成 `2026`？（重命名 repo 影响 origin，要小心）

---

## 6. ⚠️ 待你回答的问题清单

动手之前请逐条回复：

1. **总场数**：13 还是 14？（GF 是否含 bracket reset？）
2. **GF 赛制**：当 FT3 还是 FT4 来计分？
3. **显示时区**：EDT (多伦多) / CST (北京) / JST (东京) 哪个？
4. **隐藏成就**：彻底删（包括 User schema 字段）vs 只是停用不显示？我倾向彻底删。
5. **排行榜方案**：方案 1（分开）还是方案 2（总榜合并）？
6. **bracket 评分语义**：按"自己写的比分独立判分"对吗？还是要求"队伍也对"？
7. **bracket UI**：树状（A）还是列表（B）？
8. **两模式并存**：玩家可同时参与两种模式吧？
9. **日榜**：保留 vs 删除？
10. **文案**：主页"新皇后街居委会"沿用还是换新主题？
11. **数据库**：新建 db vs 工厂重置旧 db？
12. **项目重命名**：repo / package 名要不要改成 2026？

---

回复这 12 个问题后，我会基于你的答案出一份**实施计划**（拆任务 + 顺序 + 改动文件清单），再开始写代码。
