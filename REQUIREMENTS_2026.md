# OWCS 2026 Stage 1 改造需求 + 实施计划 (已确认稿)

> 把现有 2025 多伦多版本改造成给 **OWCS 2026 Champions Clash**（Stage 1 国际总决赛）使用。
> 12 个待确认问题已经全部回完，下面是确认后的需求 + 实施计划。

---

## 1. 新赛事基本信息

- **官方名称**：Overwatch Champions Series 2026 — **Champions Clash** (Stage 1 国际总决赛)
- **时间**：JST **5/22 ~ 5/24**。北美 EDT 视角第一场 **5/21 23:00** 开打。
- **地点**：东京 Arena Tachikawa Tachihi
- **赛制**：8 队双败淘汰，**共 14 场**（GF 一把 Bo7，无 bracket reset）

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

### 完整赛程（14 场，UTC + 三个美国时区）

| customId | day | 对阵 | JST | EDT (美东) | CDT (美中) | PDT (美西) | UTC | 赛制 |
|---|---|---|---|---|---|---|---|---|
| UBQF1 | 1 | WBG vs VP        | 5/22 12:00 | 5/21 23:00 | 5/21 22:00 | 5/21 20:00 | 5/22 03:00 | FT2 (Bo3) |
| UBQF2 | 1 | ZETA vs SSG      | 5/22 13:15 | 5/22 00:15 | 5/21 23:15 | 5/21 21:15 | 5/22 04:15 | FT2 |
| UBQF3 | 1 | DAL vs CR        | 5/22 14:30 | 5/22 01:30 | 5/22 00:30 | 5/21 22:30 | 5/22 05:30 | FT2 |
| UBQF4 | 1 | TM vs AG         | 5/22 15:45 | 5/22 02:45 | 5/22 01:45 | 5/21 23:45 | 5/22 06:45 | FT2 |
| LBR1A | 1 | UBQF1L vs UBQF2L | 5/22 17:00 | 5/22 04:00 | 5/22 03:00 | 5/22 01:00 | 5/22 08:00 | FT2 |
| LBR1B | 1 | UBQF3L vs UBQF4L | 5/22 18:15 | 5/22 05:15 | 5/22 04:15 | 5/22 02:15 | 5/22 09:15 | FT2 |
| UBSF1 | 2 | UBQF1W vs UBQF2W | 5/23 12:00 | 5/22 23:00 | 5/22 22:00 | 5/22 20:00 | 5/23 03:00 | FT3 (Bo5) |
| UBSF2 | 2 | UBQF3W vs UBQF4W | 5/23 13:45 | 5/23 00:45 | 5/22 23:45 | 5/22 21:45 | 5/23 04:45 | FT3 |
| LBQF1 | 2 | LBR1AW vs UBSF2L | 5/23 15:30 | 5/23 02:30 | 5/23 01:30 | 5/22 23:30 | 5/23 06:30 | FT3 |
| LBQF2 | 2 | LBR1BW vs UBSF1L | 5/23 17:15 | 5/23 04:15 | 5/23 03:15 | 5/23 01:15 | 5/23 08:15 | FT3 |
| LBSF  | 2 | LBQF1W vs LBQF2W | 5/23 19:00 | 5/23 06:00 | 5/23 05:00 | 5/23 03:00 | 5/23 10:00 | FT3 |
| UBF   | 2 | UBSF1W vs UBSF2W | 5/23 TBD   | 5/23 TBD   | -          | -          | TBD        | FT3 |
| LBF   | 3 | UBF Loser vs LBSF Winner | 5/24 14:45 | 5/24 01:45 | 5/24 00:45 | 5/23 22:45 | 5/24 05:45 | FT3 |
| GF    | 3 | UBF Winner vs LBF Winner | 5/24 12:00 | 5/23 23:00 | 5/23 22:00 | 5/23 20:00 | 5/24 03:00 | **FT4 (Bo7)** |

⚠️ UBF 具体时间 Liquipedia 没给死，按 LBSF 之后排，写代码时取 LBSF 后 +90min 作为占位，临场用 admin 改时间接口校正。
⚠️ LBQF 的交叉规则按标准双败 (UB R1 winner ↔ UB R2 loser 交叉)。如果 Liquipedia 实际不同，临场调 BRACKET_MAP。

---

## 2. 确认后的决定 (12 题答案归档)

| # | 问题 | 决定 |
|---|---|---|
| 1 | 总场数 | **14 场**，GF 是一把 Bo7（无 reset） |
| 2 | GF 赛制 | **FT4** (Bo7)，完美比分 +2 |
| 3 | 显示时区 | **美东 / 美中 / 美西** 三时区同时显示 |
| 4 | 隐藏成就 | **彻底删除**（包括 User.achievements 字段、首杀奖励、相关 UI） |
| 5 | 排行榜 | **合并榜 + Bracket 榜**：合并榜显示每人 max(实时, bracket) 并标注来源；Bracket 榜只看 bracket 成绩 |
| 6 | Bracket 评分语义 | **队伍 + 比分都要对**。该场实际参赛队 ≠ 玩家预测两队时，该场不得分。队伍对得上时按 +1/+0.5/+1/+2 规则正常判分 |
| 7 | Bracket UI | **树状 A**，支持改/取消选择，**选了后面的会锁前面**，要改前面得先取消后面所有依赖项 |
| 8 | 两模式并存 | **允许并存**，分别记分。合并榜显示更高的那一个 + 来源标记 |
| 9 | 日榜 | **删除** |
| 10 | 文案 | **沿用 "新皇后街居委会" 等老梗**，但**视觉按最新 OWCS 设计语言重做** |
| 11 | 数据库 | **新建一个 db**（`owcs_prediction_2026`），不动 2025 历史数据。理由：干净开始、保留历史、避免工厂重置误伤 |
| 12 | 项目重命名 | **改为 2026**：package.json `name` 改为 `owcs-prediction-2026`，repo 名建议你在 GitHub 上手动改（我没权限改 remote 名） |

### 一些自然推导出来的细节
- **合并榜 tie-break**：当 `realtimeScore == bracketScore` 时，标 "实时"（更稳）。如果你想反过来标 "Bracket"，告诉我一句即可。
- **Bracket 锁定时间**：UBQF1 开赛即锁，即 `2026-05-22T03:00:00Z`。锁了之后 `/api/bracket/submit` 拒收。
- **未提交 bracket 的玩家**：bracketScore = 0，不上 Bracket 榜（只显示提交过的）。
- **合并榜分数来源标记**：如果一个人没提交 bracket，他的合并榜分就是实时分，标 "实时"；如果一个人 bracket 比实时高，就显示 bracket 分 + 标 "Bracket"。

---

## 3. 实施计划

按依赖顺序分 7 个阶段，每阶段我做完会跟你 check 一次。

### Phase 0 — 基础设施（半小时）
- 改 `package.json`: name → `owcs-prediction-2026`，description 同步。
- 改默认 MongoDB URI: `owcs_prediction` → `owcs_prediction_2026`。
- `.env.example` 加进 repo（不带敏感信息）说明需要哪些环境变量。
- repo 名建议你在 GitHub 设置里改成 `OW-Guess-2026`（push 完我会提醒一下）。

### Phase 1 — 彻底删除隐藏成就系统
- **后端**：
  - `models/user.js`：删 `achievements` 字段。
  - `routes/admin.js`：删 `processAchievements`、`getUserHistory`、`achievementRules`、`/manage-achievement`、settle 里 `await processAchievements(match)` 这一行、相关 logging。settle 时给玩家加分的 `addPoints` 调用不变。
  - `routes/rankings.js`：删 `/achievements`，total 榜 select 里去掉 `achievements`。
- **前端**：
  - `index.html` / `rankings.html` / `predict.html` / `admin.html` 里所有成就徽章、成就榜入口、首杀提示、"🏆 抢到首杀成就" 文案。
  - JS 里相关 fetch/render 逻辑。

### Phase 2 — 新赛程 seed + bracket map
- 重写 `seed.js`：14 场比赛，时间存 UTC（参考上面表格），FT2/FT3/FT4 正确填好。
- 重写 `routes/admin.js` 的 `BRACKET_MAP` 为 14 场新结构。
- 把 `customId` 从 `M1` 这种风格切到 `UBQF1`/`LBR1A`/`UBSF1`/`UBF`/`LBF`/`GF` 这种更有语义的名字（搜索一下前端写没写死 customId 格式）。

### Phase 3 — Bracket 预测后端
- 新文件 `models/BracketPrediction.js`（schema 见上一版文档）。
- `models/user.js` 加 `bracketScore: Number, index: true`、`bracketSubmittedAt: Date`。
- 新文件 `routes/bracket.js`：
  - `GET /api/bracket/template` — 返回 14 场的空模板 + 锁定时间。
  - `POST /api/bracket/submit` — 校验未锁、所有 14 场都填、比分合法、用户没提交过；存库。
  - `GET /api/bracket/my/:userId` — 拿自己提交的 bracket。
- `server.js` 注册 `/api/bracket`。

### Phase 4 — 结算时同步刷新 bracket 分
- `routes/admin.js` 的 `/settle` 路由结算完单场后，新增：
  - 找到所有 `BracketPrediction` 里对这场比赛的 pick。
  - **判定**: `pick.teamAName/teamBName` 集合 == `match.teamA.name/teamB.name` 集合 → 才进入判分；否则该场 0 分。
  - 判分用现有规则（猜对胜负 +1，比分完美按 format 加奖励）。
  - 累加到 `BracketPrediction.bracketScore` 和 `User.bracketScore`。
- 撤销结算 (`/reset-match`) 同步回滚 bracket 分。

### Phase 5 — 排行榜重写
- `routes/rankings.js`：
  - 删 `/daily/:day` 和 `/achievements`。
  - 改 `/total` 为合并榜：返回每个用户 `{ nickname, realtimeScore, bracketScore, displayScore: max(两者), displaySource: 'realtime' | 'bracket' }`，按 `displayScore` 排序。
  - 新增 `/bracket` 路由：只返回提交过 bracket 的玩家，按 `bracketScore` 降序。

### Phase 6 — Bracket 前端 (树状 UI)
- 新文件 `public/bracket.html`：
  - 8 队 + 14 场的双败树状图（左侧 UB、下方 LB、右侧 GF），CSS Grid 布局。
  - 每个 match 卡片：两队头像/缩写 + 比分输入框 + "选 A 赢" / "选 B 赢" 按钮 + "取消选择" 按钮。
  - **依赖锁定**：选了 UBSF1 → 锁 UBQF1/UBQF2；要改 UBQF1 必须先取消 UBSF1（前端做 graph traversal，禁用相关输入并提示）。
  - 实时把当前选择的胜者带入下一格的对阵显示。
  - 提交按钮：所有 14 场必须填全 + 比分合法 才能点。
  - 锁定时间到了之后整个页面变成只读"我的 Bracket"。
- 新增 `public/js/bracket.js` 处理依赖图 + 提交逻辑。
- `index.html` 加入口 "🎯 提交我的 Bracket"。

### Phase 7 — 前端视觉升级 + 清理
- CSS 按 OWCS 2026 视觉调整：
  - 主色调参考 OWCS 2026 官方（紫色 + 蓝色 + 金色，找一下 viewer's guide 的色板）。
  - 字体可考虑 Industry / Big Noodle Titling 这种电竞风。
- `rankings.html`：改成两个 tab —— "合并榜" / "Bracket 榜"。合并榜每行多一个"来源"小徽章（"实时" / "Bracket"）。
- `predict.html`：保留实时单场预测流程，去掉成就 UI。
- `index.html`：保留 "新皇后街居委会" 文案 + Top3，加 Bracket 提交入口。
- 比赛时间显示用客户端 JS 把 UTC 转成 EDT/CDT/PDT 三行展示（用 `Intl.DateTimeFormat` + `timeZone: 'America/New_York' | 'America/Chicago' | 'America/Los_Angeles'`）。
- 顶部导航：主页 / 实时预测 / Bracket / 排行榜。

### Phase 8 — Admin 后台清理
- 删成就管理面板。
- 加 "查看某用户的 bracket" 只读视图（debug 用）。
- 工厂重置同步清 `BracketPrediction` collection。

---

## 4. 文件改动清单 (汇总)

**新增**：
- `models/BracketPrediction.js`
- `routes/bracket.js`
- `public/bracket.html`
- `public/js/bracket.js`

**重写**：
- `seed.js`（14 场新赛程）
- `routes/admin.js`（删成就 + 新 BRACKET_MAP + bracket 同步结算）
- `routes/rankings.js`（删日榜/成就榜，改总榜为合并榜，加 bracket 榜）
- `public/rankings.html` + `public/js/rankings.js`
- `public/css/style.css`（视觉升级）

**小改**：
- `package.json`（重命名）
- `server.js`（注册 /api/bracket）
- `models/user.js`（删 achievements，加 bracketScore）
- `routes/predict.js`（去除可能的成就关联）
- `public/index.html`、`public/predict.html`、`public/admin.html`（清成就、加 bracket 入口、多时区）

**删除**（或停用）：
- `fix_indexes.js` / `reset_*.js` 视情况调整（这些是数据维护脚本）

---

## 5. 实施前最后两个小问题

1. **合并榜 tie-break**：实时分 == bracket 分时显示哪个来源？我默认 **"实时"**。要改吗？
2. **GF 时间**：Liquipedia 上 GF 时间是 "5/24 12:00 JST?" 不太确定。先按 5/24 12:00 JST 占位，到时 admin 改时间。OK 吗？

回答这俩（或直接说"按你写的就行"）我就开 Phase 0 起跑。
