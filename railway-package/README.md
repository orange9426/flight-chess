# 星空飞行棋 · 双人对战 (Railway 部署版)

双人联机飞行棋游戏，支持本地双人 + WebSocket 联机对战。

## 🚀 一键部署到 Railway

### 方式一：GitHub 部署（推荐）

1. 将本目录下所有文件推送到你的 GitHub 仓库
2. 在 [Railway](https://railway.app/) 点击 **New Project** → **Deploy from GitHub repo**
3. 选择你的仓库
4. Railway 会自动检测 `package.json` 并执行 `npm install` + `npm start`
5. 部署完成后，在 **Settings** → **Networking** → 点击 **Generate Domain** 生成公网域名

### 方式二：CLI 部署

```bash
npm i -g @railway/cli
railway login
railway init
railway up
```

## 📁 项目结构

```
├── server.js          # Node.js 服务器 (HTTP + WebSocket + 服务端游戏引擎)
├── package.json       # 依赖配置
├── src/
│   └── index.html     # 前端单文件 (HTML + CSS + 内联 JS)
└── README.md
```

## ⚙️ 环境变量

| 变量 | 默认值 | 说明 |
|------|--------|------|
| `PORT` | `3000` | 服务监听端口（Railway 会自动注入） |

## 🎮 游戏模式

- **本地双人**：同一设备两人轮流操作
- **创建房间**：通过 WebSocket 创建联机房间，分享房间号给朋友
- **加入房间**：输入 6 位房间号加入朋友的房间

## 🔌 技术栈

- 前端：原生 HTML + CSS + JavaScript (Tailwind CSS CDN)
- 后端：Node.js + `ws` (WebSocket)
- 服务端权威游戏引擎，防作弊
