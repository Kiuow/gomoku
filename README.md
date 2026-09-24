# 五子棋

基于 React 页面源码改造的五子棋网页应用，运行在 Cloudflare Workers 上。支持单人对弈、双人练习、联机房间和棋谱回放。

在线体验：[gomoku.skya.workers.dev](https://gomoku.skya.workers.dev)

## 功能

- 单人对弈：选择执黑或执白；提供简单、普通、困难、地狱四档难度，支持悔棋、AI 提示、AI 代下、胜率预测，以及在当前对局中切换难度（下一手生效）。困难和地狱档优先使用 Rapfi WASM。
- 练习模式：双人同屏对弈或自由摆盘，可显示棋盘坐标。
- 联机对战：创建或加入六位房间号，支持聊天和断线恢复；悔棋、和棋及重新开始由对方确认，其中悔棋和重新开始请求在 30 秒后失效。AI 辅助由使用者在自己的页面操作。
- 棋谱：本地保存、回放及 SGF 导入导出。
- 外观：浅色、深色及跟随系统主题，适配手机与桌面屏幕。

## 本地运行

需要 Node.js 22 或更新版本。

```bash
npm ci
npm run dev
```

打开 <http://127.0.0.1:8787/>。`npm run dev` 会先构建前端，再启动本地 Cloudflare Worker 和 Durable Object。前端源码变更后，重新运行 `npm run build` 并刷新页面；单独运行 `npm run dev:client` 只提供前端页面，联机 API 仍需 Worker。


## AI 引擎与等待时间

简单、普通档使用 JS 引擎；困难、地狱档在可用时使用浏览器中的 Rapfi。困难档每手给 Rapfi 约 0.9 秒搜索预算，地狱档约 3 秒；引擎搜索超时后，客户端至多再等约 0.5 秒响应，然后改用较快的 JS 搜索完成这一手。首次下载、初始化 Rapfi 不计入每手搜索预算，网速和设备性能也会影响实际等待时间。

Rapfi 无法启动或搜索超时后会自动重试恢复。联机 AI 辅助发生回退或恢复时，只在当前使用者的页面提示，不向对手广播引擎状态。胜率属于局面估计，并非保证结果。

## Cloudflare 部署
[![点击一键部署到 Cloudflare](https://deploy.workers.cloudflare.com/button)](https://deploy.workers.cloudflare.com/?url=https://github.com/kiuow/gomoku)

或先使用 Wrangler 登录有权部署的 Cloudflare 账号，再运行：

```bash
npx wrangler login
npm run deploy
```

`wrangler.toml` 中的 Worker 名称是 `gomoku`；运行部署命令会更新该名称对应的现有站点。静态文件由 Workers Assets 提供，房间与聊天使用 SQLite Durable Object 存储。修改 Worker 名称或 Durable Object 迁移配置前，请先确认目标账号中现有的资源。

## 项目结构

| 路径                                   | 内容                                           |
| -------------------------------------- | ---------------------------------------------- |
| `client/src/`                          | React 页面、棋盘、AI 面板和棋谱功能            |
| `client/public/rapfi/`                 | Rapfi 浏览器版引擎文件及第三方许可说明         |
| `server/modules/gomoku/gomoku-ai.*.ts` | Worker 复用的 TypeScript 棋形评估和 JS AI 搜索 |
| `worker/index.mjs`                     | API、房间协议及 Durable Object                 |
| `shared/`                              | 前后端共用的数据类型                           |
| `wrangler.toml`                        | Cloudflare Worker 配置                         |

前端构建结果在 `dist/client/`，本地 Worker 状态保存在 `.wrangler/`；两者均不应提交到 GitHub。棋谱保存在浏览器 `localStorage`，不随账号或设备同步。联机状态通过短轮询同步。Rapfi 需要浏览器支持 WebAssembly SIMD，并通过 HTTP(S) 加载；不可用时会回退到 JS AI。仓库中的改动不会自动同步到线上站点，需要运行部署命令。

## 来源与许可

本项目包含第三方 Rapfi 引擎文件。Rapfi 上游使用 GPLv3，详见 [Rapfi 来源说明](client/public/rapfi/NOTICE.md)和随附的 [GPLv3 正文](client/public/rapfi/COPYING.txt)。当前仓库没有为应用其余源码声明统一许可证；公开再分发前，应确认下载来源、原作者权益及 Rapfi 构建产物对应的源码。
