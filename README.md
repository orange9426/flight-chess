# 星空飞行棋 · 双人联机

一款支持本地双人对战和在线联机的网页飞行棋游戏。

## 本地运行

```bash
npm install
npm start
```

然后浏览器打开 http://localhost:3000

## 部署到 Railway

### 方法一：通过 GitHub 自动部署

1. 在 GitHub 创建一个新仓库
2. 将本项目所有文件推送到仓库：
   ```bash
   git init
   git add .
   git commit -m "init"
   git branch -M main
   git remote add origin https://github.com/你的用户名/你的仓库名.git
   git push -u origin main
   ```
3. 打开 [Railway](https://railway.app)，用 GitHub 登录
4. 点击 **New Project** → **Deploy from GitHub repo**
5. 选择你刚推送的仓库
6. Railway 会自动识别 Node.js 项目并部署
7. 部署完成后，在 **Settings** → **Networking** 里生成一个公网域名
8. 打开域名即可游戏，把链接发给朋友就能联机

### 方法二：Railway CLI

```bash
npm install -g @railway/cli
railway login
railway init
railway up
```

## 游戏说明

- 5×8 弓字形棋盘，从左下角起点走到右上角终点
- 每玩家2枚棋子，初始15积分
- 掷骰→选棋子移动→触发格子效果
- 任务格：2选1任务，1-4分/5-8分两池独立洗牌
- 事件格：30种随机事件，抽完洗牌
- 商店格：1件随机装备+4件道具
- 传送格：同列上升一层
- 跨层需脱装备或花积分免脱
- 碰撞踢人、叠棋再掷
- 一方双棋到终点后，对方继续但每回合-10分，最终比积分

## 技术栈

- 前端：原生 HTML/CSS/JS（单文件）
- 后端：Node.js + ws（WebSocket）
- 无需数据库，房间状态在内存中
