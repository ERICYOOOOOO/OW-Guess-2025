# OWCS 2026 Stage 1 改造需求 + 实施计划 (已确认稿)

> 把现有 2025 多伦多版本改造成给 **OWCS 2026 Champions Clash**（Stage 1 国际总决赛）使用。
> 12 个待确认问题已经全部回完，下面是确认后的需求 + 实施计划。

---

## 1. 新赛事基本信息

- **官方名称**：Overwatch Champions Series 2026 — **Champions Clash** (Stage 1 国际总决赛)
- **时间**：JST **5/22 ~ 5/24**。北美 EDT 视角第一场 **5/21 23:00** 开打。
- **地点**：东京 Arena Tachikawa Tachihi
- **赛制**：8 队双败淘汰，**共 14 场**（GF 一把 Bo7，无 bracket reset）
- **官方 bracket 图为准**（Liquipedia 漏了一场 LBQF，已确认）
- **比赛起始**：May 21 20:00 PT = UTC 2026-05-22T03:00:00Z

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

### 完整赛程（14 场，按官方 bracket 图）

采用官方 ID 命名 M1~M11 + UBF + LBF + GF：

| customId | day | 对阵规则 | 赛制 |
|---|---|---|---|
| M1   | 1 | **WBG vs VP**         | FT2 (Bo3) |
| M2   | 1 | **ZETA vs SSG**       | FT2 |
| M3   | 1 | **DAL vs CR**         | FT2 |
| M4   | 1 | **TM vs AG**          | FT2 |
| M5   | 1 | L-M4 vs L-M3 (LBR1 上区) | FT2 |
| M6   | 1 | L-M1 vs L-M2 (LBR1 下区) | FT2 |
| M7   | 2 | W-M4 vs W-M3 (UBSF 上区) | FT3 (Bo5) |
| M8   | 2 | W-M1 vs W-M2 (UBSF 下区) | FT3 |
| M9   | 2 | **L-M8 vs W-M5** (LBQF 上 — 交叉) | FT3 |
| M10  | 2 | **L-M7 vs W-M6** (LBQF 下 — 交叉) | FT3 |
| M11  | 2 | W-M9 vs W-M10 (LBSF)     | FT3 |
| UBF  | 3 | W-M7 vs W-M8             | FT3 |
| LBF  | 3 | L-UBF vs W-M11           | FT3 |
| GF   | 3 | W-UBF vs W-LBF           | **FT4 (Bo7)** |

具体每场 startTime 由 Liquipedia 自动同步模块拉取并保持最新（见 §3 Phase 4）。
M1 第一场为 2026-05-22T03:00:00Z (= 5/21 20:00 PT)。前端按客户端浏览器把 UTC 转成 美东/美中/美西 三时区显示。

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

### 合并榜排序规则（完整 tiebreaker 链）

1. **主键**：`displayScore = max(bracketScore, realtimeScore)` 降序
2. **同分 tiebreaker 1**：有 bracket 提交的优先于没提交的
3. **同分 tiebreaker 2**：都有 bracket → bracket 提交时间早的优先
4. **同分 tiebreaker 3**：都没 bracket（纯实时玩家），按下列顺序级联：
   1. 猜对场数多的优先
   2. FT4 完美比分数多的优先
   3. FT3 完美比分数多的优先
   4. FT2 完美比分数多的优先

合并榜里每个玩家显示一个**来源徽章**：
- 有 bracket 提交且 bracketScore ≥ realtimeScore → 显示 **"Bracket"**
- 否则 → 显示 **"实时"**

### Bracket 榜排序规则
1. **主键**：`bracketScore` 降序
2. **同分**：bracket 提交时间早的优先

### 其他规则
- **Bracket 锁定时间**：M1 开赛即锁，`BRACKET_LOCK_TIME = 2026-05-22T03:00:00Z`。锁了之后 `/api/bracket/submit` 拒收。
- **未提交 bracket 的玩家**：bracketScore = 0，不上 Bracket 榜，但仍在合并榜上（按 realtime 算）。
- **Bracket 评分**：该场实际参赛队 == 玩家预测两队（集合相等）才进入判分，否则该场 0 分。

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
- 重写 `seed.js`：14 场比赛，使用官方 `M1`~`M11` + `UBF`/`LBF`/`GF` 命名。
- 重写 `routes/admin.js` 的 `BRACKET_MAP`：
  ```
  M1: { win: M8.B, lose: M6.A }   M2: { win: M8.A, lose: M6.B }
  M3: { win: M7.B, lose: M5.A }   M4: { win: M7.A, lose: M5.B }
  M5: { win: M10.A }              M6: { win: M9.A }
  M7: { win: UBF.A, lose: M10.A_overwrite — UBSF loser 进 LBQF 交叉 }  
  M8: { win: UBF.B, lose: M9.A_overwrite }
  M9: { win: M11.A }              M10: { win: M11.B }
  M11: { win: LBF.B }
  UBF: { win: GF.A, lose: LBF.A }
  LBF: { win: GF.B }
  ```
  (注：实际写代码时按官方 bracket 图准确填，这里只是示意逻辑。L-M7/L-M8 都是 UBSF 输 → LBQF 上下区，需要 cross。)

### Phase 3 — Bracket 预测后端
- 新文件 `models/BracketPrediction.js`（schema 见上一版文档）。
- `models/user.js` 加 `bracketScore: Number, index: true`、`bracketSubmittedAt: Date`。
- 新文件 `routes/bracket.js`：
  - `GET /api/bracket/template` — 返回 14 场的空模板 + 锁定时间。
  - `POST /api/bracket/submit` — 校验未锁、所有 14 场都填、比分合法、用户没提交过；存库。
  - `GET /api/bracket/my/:userId` — 拿自己提交的 bracket。
- `server.js` 注册 `/api/bracket`。

### Phase 4 — Liquipedia 自动同步模块 (新增)
- 新文件 `lib/liquipedia.js`：
  - 用 `axios` + `cheerio` GET `https://liquipedia.net/overwatch/Overwatch_Champions_Series/2026/Champions_Clash`
  - 解析出 14 场的 `customId / team1 / team2 / startTime / status / score`
  - 自定义 User-Agent 标识项目 + 联系邮箱，本地 30 秒缓存
- 新文件 `lib/sync-scheduler.js`：
  - **1 分钟轮询**：仅在任意比赛 `startTime ± 2 小时` 窗口内
    - 检测比赛开始 / 比分变化 / 比赛结束
    - 检测到 finished + 新比分 → 自动触发 settle 逻辑（含 bracket 推进 + 实时分刷新 + bracket 预测分刷新）
  - **10 分钟轮询**：全局体检
    - 校对所有 14 场的队伍名、startTime、最终比分
    - 不一致 → 写 `LiquipediaSyncLog` 表 + admin 后台显示差异红点（不自动覆盖）
  - 失败重试指数退避，3 连失败 → 切回手动模式
- 新增 admin 接口：
  - `GET /api/admin/sync-status` — 当前同步状态 + 差异列表
  - `POST /api/admin/sync-pause` / `sync-resume`
  - `POST /api/admin/sync-now` — 立即手动触发一次全量同步
- `server.js` 启动时拉起 `sync-scheduler`

### Phase 5 — 结算时同步刷新 bracket 分
- `routes/admin.js` 的 `/settle` 路由结算完单场后，新增：
  - 找到所有 `BracketPrediction` 里对这场比赛的 pick。
  - **判定**: `pick.teamAName/teamBName` 集合 == `match.teamA.name/teamB.name` 集合 → 才进入判分；否则该场 0 分。
  - 判分用现有规则（猜对胜负 +1，比分完美按 format 加奖励）。
  - 累加到 `BracketPrediction.bracketScore` 和 `User.bracketScore`。
- 撤销结算 (`/reset-match`) 同步回滚 bracket 分。

### Phase 6 — 排行榜重写
- `routes/rankings.js`：
  - 删 `/daily/:day` 和 `/achievements`。
  - 改 `/total` 为合并榜：返回每个用户 `{ nickname, realtimeScore, bracketScore, bracketSubmittedAt, displayScore: max(两者), displaySource: 'realtime' | 'bracket', stats: { wins, ft4Perfect, ft3Perfect, ft2Perfect } }`，按完整 tiebreaker 链排序。
  - 新增 `/bracket` 路由：只返回提交过 bracket 的玩家，按 `bracketScore` desc + `bracketSubmittedAt` asc 排序。

### Phase 7 — Bracket 前端 (树状 UI)
- 新文件 `public/bracket.html`：
  - 8 队 + 14 场的双败树状图（左侧 UB、下方 LB、右侧 GF），CSS Grid 布局。
  - 每个 match 卡片：两队头像/缩写 + 比分输入框 + "选 A 赢" / "选 B 赢" 按钮 + "取消选择" 按钮。
  - **依赖锁定**：选了 UBSF1 → 锁 UBQF1/UBQF2；要改 UBQF1 必须先取消 UBSF1（前端做 graph traversal，禁用相关输入并提示）。
  - 实时把当前选择的胜者带入下一格的对阵显示。
  - 提交按钮：所有 14 场必须填全 + 比分合法 才能点。
  - 锁定时间到了之后整个页面变成只读"我的 Bracket"。
- 新增 `public/js/bracket.js` 处理依赖图 + 提交逻辑。
- `index.html` 加入口 "🎯 提交我的 Bracket"。

### Phase 8 — 前端视觉升级 + 清理
- CSS 按 OWCS 2026 视觉调整：
  - 主色调参考 OWCS 2026 官方（紫色 + 蓝色 + 金色，找一下 viewer's guide 的色板）。
  - 字体可考虑 Industry / Big Noodle Titling 这种电竞风。
- `rankings.html`：改成两个 tab —— "合并榜" / "Bracket 榜"。合并榜每行多一个"来源"小徽章（"实时" / "Bracket"）。
- `predict.html`：保留实时单场预测流程，去掉成就 UI。
- `index.html`：保留 "新皇后街居委会" 文案 + Top3，加 Bracket 提交入口。
- 比赛时间显示用客户端 JS 把 UTC 转成 EDT/CDT/PDT 三行展示（用 `Intl.DateTimeFormat` + `timeZone: 'America/New_York' | 'America/Chicago' | 'America/Los_Angeles'`）。
- 顶部导航：主页 / 实时预测 / Bracket / 排行榜。

### Phase 9 — Admin 后台清理
- 删成就管理面板。
- 加 "查看某用户的 bracket" 只读视图（debug 用）。
- 工厂重置同步清 `BracketPrediction` collection。

---

## 4. 文件改动清单 (汇总)

**新增**：
- `models/BracketPrediction.js`
- `models/LiquipediaSyncLog.js`
- `routes/bracket.js`
- `lib/liquipedia.js` (爬虫)
- `lib/sync-scheduler.js` (定时任务)
- `public/bracket.html`
- `public/js/bracket.js`
- `public/images/teams/*.png` (8 个队伍 logo，等你提供)

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

## 5. 队伍 Logo 规范 (你之后给我)

| 项目 | 推荐规范 |
|---|---|
| **格式** | PNG (透明背景) 或 SVG |
| **尺寸** | 512×512 正方形（也接受 256/1024） |
| **背景** | 完全透明 |
| **内边距** | 5–10% 留白 |
| **命名** | `{缩写}.png`，全大写：`WBG.png`、`VP.png`、`ZETA.png`、`SSG.png`、`DAL.png`、`CR.png`、`TM.png`、`AG.png` |
| **存放** | `public/images/teams/` |
| **怎么给我** | 直接拖到对话框上传 / 打包 zip / 或给我官方 OWCS 资源链接我自己抓 |

没拿到 logo 之前先用文字缩写占位，不影响开发。

---

## 6. 依赖增加

新引入的 npm 包：
- `axios` (HTTP 客户端)
- `cheerio` (HTML 解析)
- 可选 `node-cron` (定时任务，或用 `setInterval` 自己实现)

---

## 7. 部署 / 环境变量准备

代码里**不写死任何线上凭据**，所有敏感配置走 `.env`：

```env
# .env (不进 git，已在 .gitignore)
MONGODB_URI=mongodb+srv://<user>:<pass>@cluster.xxx.mongodb.net/owcs_prediction_2026
PORT=3000

# Liquipedia 同步用
LIQUIPEDIA_USER_AGENT=OWCS-Guess-2026/1.0 (contact@example.com)
LIQUIPEDIA_SYNC_ENABLED=true     # 全自动同步开关，可临场关
LIQUIPEDIA_POLL_HIGH_FREQ_MS=60000   # 高频窗口 1 分钟
LIQUIPEDIA_POLL_LOW_FREQ_MS=600000   # 低频体检 10 分钟
LIQUIPEDIA_WINDOW_HOURS=2            # 比赛 ±N 小时算高频窗口

# Admin
ADMIN_TOKEN=<随机字符串>   # 用于保护 admin 接口（目前 requireAdmin 是空壳，建议补上）
```

新增一个 `.env.example` 文件进 repo，作为部署模板。

### 数据库准备
- **新建 db**：`owcs_prediction_2026`（与 2025 数据隔离）。
- 如果用 MongoDB Atlas：在原 cluster 里加一个新 database 即可，连接字符串末尾改 database 名。
- 第一次部署时跑 `node seed.js` 初始化 14 场赛程。

### 部署平台
现有项目部署形态（推测）是 PaaS（Render/Railway 类）+ MongoDB Atlas。改造后部署流程不变：
1. 平台 env 里更新 `MONGODB_URI`（指向新 db）+ 新加的环境变量。
2. 平台自动从 git 拉新代码。
3. 部署后 SSH/Web Shell 执行 `node seed.js` 初始化。

---

## 8. 实施前最后未决项 (handoff 给开发分支)

1. **MongoDB URI 谁负责**：开发者本地用 localhost，线上由你部署时配 env。代码默认 `mongodb://localhost:27017/owcs_prediction_2026`。
2. **8 个队伍 Logo**：等你提供（规范见 §5），开发期用文字缩写占位即可。
3. **OWCS 2026 视觉风格参考**：建议从官方 viewer's guide 抓配色 / 字体灵感：
   - https://overwatch.blizzard.com/en-us/news/24264002/owcs-2026-stage-1-viewers-guide/
   - 主题色待定：是否沿用 2025 的紫色，还是切到 OWCS 2026 官方配色？
4. **GF 准确时间**：Liquipedia 上是 5/24 12:00 JST。如果官方有更新，靠自动同步模块兜底。

---

## 9. 实施 Phase 总览 (开发分支照这个走)

| Phase | 内容 | 预估改动文件数 | 依赖前置 |
|---|---|---|---|
| 0 | 项目改名 + db 命名 + .env.example | 3 | 无 |
| 1 | 彻底删除隐藏成就系统 | 7+ | Phase 0 |
| 2 | 新赛程 seed + BRACKET_MAP | 2 | Phase 1 |
| 3 | Bracket 预测后端 (model + routes) | 4 | Phase 2 |
| 4 | Liquipedia 自动同步模块 | 3 | Phase 2 |
| 5 | Settle 结算同步刷新 bracket 分 | 1 (admin.js) | Phase 3, 4 |
| 6 | 排行榜重写（合并榜 + bracket 榜） | 1 (rankings.js) | Phase 3 |
| 7 | Bracket 树状前端 UI | 3 | Phase 3 |
| 8 | 视觉升级 + 多时区 + 清理 | 5 | Phase 1, 6, 7 |
| 9 | Admin 后台清理 + 同步状态面板 | 2 | Phase 4 |

**建议每个 Phase 一个 commit，方便逐步 review。**

---

## 10. 验收测试清单 (开发完后跑一遍)

- [ ] 14 场赛程 seed 后能在 `/api/matches` 完整返回，customId 正确
- [ ] 删除所有成就相关代码后 server 启动不报错，admin 后台没死链
- [ ] Bracket 树状 UI 能完整填完 14 场并提交一次，提交后只读
- [ ] 锁定时间到了之后再提交 → 拒收，错误提示正确
- [ ] 模拟一场结算后：
  - 实时预测者得分正确（胜负 +1 / FT2 +0.5 / FT3 +1 / FT4 +2）
  - 提交过 bracket 的玩家，bracket 那场分数同步刷新
  - bracket 中预测队伍 ≠ 实际队伍 → 该场 0 分
- [ ] 合并榜 tiebreaker 链：bracket > 没 bracket、提交早 > 晚、场数对多 > 少、FT4/3/2 比分对 cascade
- [ ] Bracket 榜只列提交过的人，按 score desc + submitTime asc
- [ ] 多时区显示：浏览器自动展示 EDT/CDT/PDT 三行
- [ ] Liquipedia 同步：手动 sync-now 能拉数据 + diff 显示
- [ ] Liquipedia 自动同步：在窗口期 1 分钟一次，窗口外不轮询
- [ ] 工厂重置同步清 BracketPrediction collection
- [ ] 移动端 (iPhone Safari / Android Chrome) 树状 bracket 能正常操作

---

**文档完结，等开发分支 pickup。**

OK 所有需求确认完毕，准备从 **Phase 0** 开干。
