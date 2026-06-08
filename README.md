# Mocation Web · 影视取景地

一个清爽的「明亮杂志风」影视取景地浏览站 —— 在地图上发现电影 / 剧集的拍摄地。
基于对官方 App 逆向得到的公开只读 API 构建，**Next.js + Vercel**，自带防封代理层。

> 仅供学习研究。数据来自 `mocation.cc` 公开接口，版权归原作者所有。

---

## ✨ 功能（v1 核心闭环）

| 页面 | 路径 | 说明 |
|---|---|---|
| 首页 | `/` | 本期精选 Hero、收录统计、热门影视、取景地精选、新片速递 |
| 影视 | `/movies` | 热门影视网格（Top 200）+ 新片 |
| 影视详情 | `/movie/[id]` | 简介、**取景地图**（Leaflet 标注全部场景）、取景地清单、评论 |
| 取景地 | `/places` | 热门取景地网格（~100） |
| 取景地详情 | `/place/[id]` | 封面大图、地址、地图、在此取景的影视、评论 |
| 搜索 | `/search?q=` | 在热门影视 / 取景地中检索（见下方说明） |

## 🏗 架构与「防封」设计

```
浏览器 ──> Next.js (Vercel)
              ├─ Server Components  ──直连──> www.mocation.cc/api/*   (ISR 缓存)
              ├─ /api/img?u=        ──代理──> cache.fotoplace.cc      (图片)
              └─ /api/m/[...path]   ──代理──> www.mocation.cc/api/*   (客户端只读)
```

防止上游封禁的几道闸：

1. **服务端渲染 + ISR 缓存**：页面数据在服务端拉取并缓存（首页 30min / 列表 1h / 详情 12h）。
   每个页面在缓存窗口内最多回源一次 —— 这是最主要的防封手段（缓存优先、流量平缓）。
2. **请求重试退避**：上游偶发超时（单 IP 轻量限流），`mfetch` 自动 3 次退避重试。
3. **图片代理** `app/api/img/route.ts`：解决三件事 —— ① `http→https`（混合内容）；
   ② CDN 对带 `Referer` 的请求返回 403（服务端请求不带 Referer）；③ 永久边缘缓存。
4. **只读白名单代理** `app/api/m/[...path]/route.ts`：仅放行只读接口，**按 IP 限流**（默认 40 次/分），
   绝不代理登录 / 写入 / 支付接口，避免被当作开放中继滥用。
5. **UA 伪装**：回源时携带与官方 App 一致的 `User-Agent`。

> 生产环境建议把内存版限流换成 [Upstash Redis](https://upstash.com/)（见 `app/api/m/[...path]/route.ts` 注释），
> 因为 Vercel 函数是多实例 / 易失的。

## 🔎 关于搜索

官方全局搜索 `/api/search` 需要 App 端签名头（`X-AK / X-SG / X-TP …`，签名算法在加固后的 dex 内），
未签名请求恒返回空。因此本站**不**直接调它，而是对一份长缓存的热门目录（Top 影视 + 热门取景地）
做服务端关键词过滤 —— 诚实、可用、且对上游友好（每 12h 仅回源一两次）。若要全量搜索，需还原签名算法。

## 🗺 坐标系

上游经纬度为中国 **GCJ-02（火星坐标）**。`lib/coords.ts` 将其转换为 WGS-84 以匹配
Leaflet + Carto/OSM 瓦片。如发现整体偏移，把 `NEXT_PUBLIC_COORD_DATUM` 改成 `bd09` 或 `wgs84`。

## 🚀 本地运行

```bash
cd web
npm install
npm run dev          # http://localhost:3000
# 或生产模式
npm run build && npm run start
```

## ▲ 部署到 Vercel

1. 把本仓库（`web/` 目录）推到 GitHub。
2. 在 [vercel.com](https://vercel.com) **New Project** 导入该仓库；
   - 若 `web/` 不是仓库根目录，在 Vercel 项目设置里把 **Root Directory** 设为 `web`。
   - Framework 自动识别为 Next.js，无需改构建命令。
3. （可选）环境变量：

   | 变量 | 默认 | 说明 |
   |---|---|---|
   | `MOCATION_API_ORIGIN` | `https://www.mocation.cc` | 上游 API 源 |
   | `MOCATION_UA` | `Mocation/5.5.23 (Android; web-mirror)` | 回源 UA |
   | `NEXT_PUBLIC_COORD_DATUM` | `gcj02` | 坐标系：`gcj02` / `bd09` / `wgs84` |

4. Deploy。`/` `/movies` `/places` 为静态 ISR，详情 / 搜索为按需渲染。

## ☁️ 部署到 Cloudflare

可以。两个代理路由已设为 **Edge Runtime**（`export const runtime = "edge"`），代码只用
fetch / Web Streams，天然兼容 Cloudflare。两条路子：

**A. Cloudflare Pages + next-on-pages（最简单）**
```bash
cd web
npx @cloudflare/next-on-pages@1     # 产物在 .vercel/output/static
```
Pages 项目设置：
- Build command: `npx @cloudflare/next-on-pages@1`
- Build output directory: `.vercel/output/static`
- Compatibility flags 勾选 **`nodejs_compat`**
- 环境变量同上表

**B. OpenNext for Cloudflare（推荐，支持 ISR 缓存）**
用 [`@opennextjs/cloudflare`](https://opennext.js.org/cloudflare)，把 Next 的数据缓存接到
Workers KV / R2，能保留下面说的"防封"缓存语义。

> ⚠️ **防封注意**：本站的防封核心是 Server Component 的 **ISR 数据缓存**（每页每窗口最多回源一次）。
> 这在 **Vercel** 上开箱即用；在 **Cloudflare Pages（next-on-pages）** 上 Next 数据缓存支持有限，
> 可能导致回源更频繁。两种补救：① 用上面的 **OpenNext**（KV/R2 做 ISR）；
> ② 数据全部改走 `/api/m` 代理（该路由已带 `Cache-Control: s-maxage`，会被 Cloudflare CDN 缓存）。
> 因此**最省心仍是 Vercel**；要上 Cloudflare 建议走 OpenNext。

> 另一种纯静态方案：**GitHub Pages 前端 + 单独 Cloudflare Worker 代理**（把 `/api/img`、`/api/m`
> 逻辑搬进 Worker）。灵活但要维护两处。

## 📁 结构

```
web/
├─ app/
│  ├─ page.tsx                 首页
│  ├─ movies/  movie/[id]/     影视
│  ├─ places/  place/[id]/     取景地
│  ├─ search/                  搜索
│  └─ api/{img,m}/             图片 / 只读代理
├─ components/                 Header / Card / Map / Comments …
├─ lib/
│  ├─ mocation.ts              类型化数据层（mfetch：缓存 + 重试）
│  ├─ config.ts                源、UA、缓存窗口、坐标系
│  ├─ coords.ts                GCJ-02 → WGS-84
│  ├─ categories.ts            分类字典（取自 App assets）
│  └─ img.ts                   图片代理 URL
└─ ...
```

## ⚖️ 免责声明

本项目仅用于技术学习与研究。请勿用于商业用途；请遵守对方服务条款与 robots 约定，控制访问频率。
