# CLAUDE.md — 项目状态与交接

> 这份文件给「下一个接手的 Claude agent」看：新会话**不继承聊天记录**，只继承仓库。
> 这里写清「到哪了 / 下一步 / 决策 / 坑」，让你一进来就能续上。
> 配套细节见 `scripts/scrape/README.md` 和 PR #3。

## 这个 section 在做什么

把站点从「**实时反代** `www.mocation.cc`」重构为「**一次性全量快照 + 自托管**」，运行时**零回源**（消灭封禁面）。
工作分支：`claude/proxy-request-redesign-DuZNF`（PR #3，draft）。

## 已定的三项决策（不要重开）

1. **范围**：全量（1581 影视 + 28981 取景地 + 派生 area；person 放弃——movie 详情无演职人员、唯一源是签名门控的 search）。
2. **数据**：构建期扒进本地 SQLite → 全静态 SSG；运行时不查库。搜索/筛选若要做，阶段五用 D1（精简目录灌入）。
3. **图片**：全量下、转 webp（默认质量、**不降采样**、不纠结体积 ~59GB）、内容寻址，存**独立 `lfkdsk/mocation-assets` 仓** + jsDelivr CDN。文件名 = `sha1(原图URL)`，app 端可确定性算出 CDN 地址。

## 进度

- [x] **阶段 1 枚举**：全量 catalog（`enumerate.mjs`）
- [x] **阶段 2 详情**：movie 1581/1581 + place 28981/28981，**零失败**（`details.mjs`）。485,635 去重图 URL（去 staticmap 可下 419,865）。
- [~] **阶段 2b area**：脚本就绪（`areas.mjs`，~5635 个），**尚未运行**
- [ ] **阶段 3 图片下载**：脚本就绪（`images.mjs` + `publish-assets.mjs`），**由用户在 MacBook 本地跑**（5–11h / ~59GB / 45万文件，云端容器不适合）
- [ ] **阶段 4 切数据源**：web 数据层从 SQLite 读、图片 URL 改走 jsDelivr、移除 `app/api/m` 与 `lib/mocation.ts` 的实时回源。**纯代码、未开始**，不依赖图下完可并行。
- [ ] **阶段 5（可选）**：D1 全量搜索

## 数据怎么续传（关键）

DB 是 gitignore 的本地文件；**进度靠 `data/mocation.sqlite.gz` 快照提交到 git** 持久化（容器临时、会回收）。
- 拍快照：`npm run scrape:snapshot`（VACUUM INTO + gzip，写入时也安全）
- 恢复续跑：`npm run scrape:restore` → 各脚本按 `fetched_detail` / `image.status` 自动跳过已完成
- 当前 committed 快照 = **完整元数据**（阶段 2 完）。

## 坑 / 注意

- 云端 GitHub 令牌**只授权 `lfkdsk/mocation`，无建仓权限**：`mocation-assets` 必须用户本地用自己凭据建/推。
- `data/mocation.sqlite.gz` 已 52MB，超 GitHub 50MB 推荐线（只警告没拦）。**胖 DB 终归要挪出 app 仓**（移到 Release/assets 仓，app 仓只留精简派生数据）——阶段四处理。历史里已累积多版本 gz，合并前可考虑 squash/purge。
- list 端点 `total` 含重复（movie 3026 / place 52257），但 distinct ID = 1581 / 28981，与 `coopen/data` 吻合 = 全量。size 上限 500。
- 详情存**完整 raw JSON**（加字段从 raw 重导，免重爬）。图片用 `harvestImages()` 递归扒所有 `*.fotoplace.cc` URL。
- 工具零依赖（Node 22 `node:sqlite` + fetch）；图片转码需 `sharp`（`npm i -D sharp`，缺了存原图）。

## 接手命令速查

```bash
# 接力元数据
git pull && npm run scrape:restore
node scripts/scrape/areas.mjs                 # 阶段 2b（可选）

# 阶段 3 图片（本地）
gh repo create lfkdsk/mocation-assets --public
git clone git@github.com:lfkdsk/mocation-assets.git data/assets
node scripts/scrape/images.mjs                # 下载+webp，断点续传
node scripts/scrape/publish-assets.mjs        # 分批 <1.5GB 推

# 验证
# https://cdn.jsdelivr.net/gh/lfkdsk/mocation-assets@main/<ab>/<sha1>.webp
```
