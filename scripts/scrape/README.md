# Mocation 数据抓取 / Snapshot pipeline

把上游 `www.mocation.cc` 的公开只读数据全量扒成一份**本地快照**，让站点从「实时反代」变成「零回源的静态站」。数据进 SQLite（构建期数据源），图片进独立 `assets` orphan 分支 + jsDelivr 当 CDN。

> 仅供学习研究。请控制频率、遵守对方服务条款。

## 依赖

零外部依赖：用 Node 22 自带的 `node:sqlite`（实验性，已验证可用）和内置 `fetch`。

## 数据流（四阶段）

| 阶段 | 脚本 | 说明 |
|---|---|---|
| 1. 枚举 | `enumerate.mjs` | 翻页 `movie/place hot-and-default` 拿全量 ID + 列表字段，攒图片清单与 movie↔place 关系边 |
| 2. 详情 | `details.mjs` *(WIP)* | 逐个 `movie/{id}` `place/{id}` `area` `person` `comment` 回填，规范化入库 |
| 3. 图片 | `images.mjs` + `publish-assets.mjs` | 下载去重图片 → 转 webp → content-addressed 落盘 → 分批推 `mocation-assets` 仓 |
| 4. 切源 | web 数据层改造 | SSG 从 SQLite 读，图片走 jsDelivr |

## 🖥 本地 (MacBook) 接力——阶段三下图

阶段三是 5–8h / ~10–15GB 的活，适合在本地机器跑（不受云端容器回收影响）。云端已把数据快照和脚本备好，本地三步接上：

```bash
git pull                              # 拿到最新 data/mocation.sqlite.gz + 脚本
npm run scrape:restore                # 还原 DB 到云端进度点
npm i -D sharp                        # webp 转码（无则存原图）

# 准备图床仓库（一次性）
git clone <mocation-assets-url> data/assets

# 下载（断点续传；CDN 不同主机，并发更高）
# 全量约 45 万张。体积实测：原尺寸~59GB / ≤1600px~43GB / ≤1280px~37GB(推荐)
IMG_MAX_EDGE=1280 node scripts/scrape/images.mjs   # 跳过 staticmap，转 webp，落盘 data/assets/<ab>/<sha1>.webp

# 分批提交推送（每批 <1.5GB，绕开 GitHub 2GB/push）
node scripts/scrape/publish-assets.mjs
```

jsDelivr 访问：`https://cdn.jsdelivr.net/gh/lfkdsk/mocation-assets@main/<ab>/<sha1>.webp`
（文件名 = `sha1(原图URL)`，所以 app 端从 `coverPath` 能确定性算出 CDN 地址。）

## 运行

```bash
# 阶段 1：全量枚举（约 7 + 105 次翻页请求，温柔限速下几分钟）
node scripts/scrape/enumerate.mjs
node scripts/scrape/enumerate.mjs --only=place --from=40   # 断点续传：从第 40 页起
```

```bash
# 阶段 2：详情回填（约 3 万次请求，~6.6 req/s 下约 1.5h；可调 SCRAPE_CONCURRENCY/THROTTLE_MS）
node scripts/scrape/details.mjs
node scripts/scrape/details.mjs --only=place   # 只补取景地

# 进度持久化：把一致性快照压成 data/mocation.sqlite.gz（committable）
node scripts/scrape/snapshot.mjs
# 新容器里恢复后继续（gz 已随分支拉下来）
node scripts/scrape/snapshot.mjs --restore && node scripts/scrape/details.mjs
```

全部脚本**幂等可续传**：重跑是 upsert，不会重复。进度写在 `meta` 表（`enum.place.page`、`fetched_detail` 等）。容器是临时的，所以**里程碑节点用 `snapshot.mjs` 把 gz 提交到分支**——回收后 `--restore` 即可接着跑，最多损失最后一个增量。

## 配置（环境变量）

| 变量 | 默认 | 说明 |
|---|---|---|
| `MOCATION_DB` | `data/mocation.sqlite` | 快照 DB 路径 |
| `MOCATION_ASSETS` | `data/assets` | 图片落盘目录 |
| `SCRAPE_THROTTLE_MS` | `300` | 请求间最小间隔（全局节流） |
| `SCRAPE_CONCURRENCY` | `4` | 详情回填并发 worker 数 |
| `SCRAPE_RETRIES` | `4` | 网络错误退避重试次数 |

## SQLite schema

`movie` / `place` / `area` / `person` 各表同时存**规范化列**（可查询）和 `raw_list` / `raw_detail`（原始 JSON 留档 —— 以后加字段从 raw 重导，无需重爬）。关系在 `movie_place`，图片下载簿记在 `image`，评论在 `comment`。详见 `lib/db.mjs`。

## 当前快照规模（阶段 1）

- 影视 **1581** · 取景地 **28981** · 去重图片 URL **30562** · movie↔place 边 **43443**
- 封面与经纬度覆盖率 100%
