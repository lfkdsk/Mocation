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
| 3. 图片 | `images.mjs` *(WIP)* | 下载所有去重图片 → content-addressed 落盘 → 推 `assets` 分支 |
| 4. 切源 | web 数据层改造 | SSG 从 SQLite 读，图片走 jsDelivr |

## 运行

```bash
# 阶段 1：全量枚举（约 7 + 105 次翻页请求，温柔限速下几分钟）
node scripts/scrape/enumerate.mjs
node scripts/scrape/enumerate.mjs --only=place --from=40   # 断点续传：从第 40 页起
```

全部脚本**幂等可续传**：重跑是 upsert，不会重复。进度写在 `meta` 表（`enum.place.page` 等）。

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
