# AnytimeMahjong

一个可以和朋友在线开房玩的麻将 Web 应用。

项目采用前后端分离架构：

- **前端**：React + TypeScript + Vite
- **后端**：Node.js + Express + WebSocket
- **部署**：Nginx 托管静态资源，PM2 守护 Node 后端

> 目前项目以“朋友之间快速开房娱乐”为目标，规则和计分偏轻量实用，不追求完整地方麻将竞技规则。
![Uploading image.png…]()

---

## 功能特性

- 在线房间
- 输入昵称创建/加入房间
- 支持 4 人局，不足人数自动补 AI
- 摸牌、出牌、吃、碰、明杠、暗杠、加杠、胡牌
- 支持自摸 / 点炮
- AI 自动出牌与自动处理吃碰杠胡响应
- AI 响应兜底，避免卡在 `Claims pending`
- 牌桌中央弃牌区
- 房间内累计积分与排名
- 结算页完整胡牌展示
- 结算页 PNG 长图导出
- 适合部署到腾讯云 CVM / 普通 Linux 服务器

---

## 项目结构

```txt
.
├── client                 # React 前端
│   ├── src
│   └── dist               # 前端生产构建产物
├── server                 # Node 后端
│   ├── src
│   └── dist               # 后端生产构建产物
├── DEPLOYMENT.md          # 生产部署运维手册
├── package.json           # 根目录脚本
└── README.md
```

---

## 环境要求

建议使用：

- Node.js 20+
- npm 10+
- Linux / macOS / Windows 均可本地开发

服务器部署建议：

- Ubuntu 22.04 / Debian
- Nginx
- PM2

---

## 本地开发启动

### 1. 克隆项目

```bash
git clone https://github.com/WUDIFIVE/AnytimeMahjong.git
cd AnytimeMahjong
```

### 2. 安装依赖

根目录、后端、前端都需要安装依赖：

```bash
npm install
cd server && npm install
cd ../client && npm install
cd ..
```

### 3. 启动开发环境

```bash
npm run dev
```

默认会同时启动：

- 后端：`http://localhost:3001`
- 前端：`http://localhost:5173`

浏览器打开：

```txt
http://localhost:5173
```

---

## 生产构建

在项目根目录执行：

```bash
npm run build
```

该命令会依次构建：

- `server/dist`
- `client/dist`

---

## 生产部署简述

完整部署手册见：

```txt
DEPLOYMENT.md
```

最简流程如下。

### 1. 构建项目

```bash
cd /var/www/mahjong
npm run build
```

### 2. 使用 PM2 启动后端

```bash
PORT=3001 pm2 start server/dist/index.js --name mahjong-server
pm2 save
```

### 3. Nginx 托管前端并反代 WebSocket

示例配置：

```nginx
server {
    listen 80;
    server_name _;

    root /var/www/mahjong/client/dist;
    index index.html;

    location /ws {
        proxy_pass http://127.0.0.1:3001/ws;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "Upgrade";
        proxy_set_header Host $host;
        proxy_read_timeout 86400;
    }

    location /health {
        proxy_pass http://127.0.0.1:3001/health;
    }

    location / {
        try_files $uri $uri/ /index.html;
    }
}
```

修改 Nginx 后检查并重载：

```bash
sudo nginx -t
sudo systemctl reload nginx
```

---

## 常用运维命令

### 查看后端状态

```bash
pm2 status
curl http://127.0.0.1:3001/health
```

### 查看后端日志

```bash
pm2 logs mahjong-server --lines 100
```

### 重启后端

```bash
pm2 restart mahjong-server
```

### 更新项目

```bash
cd /var/www/mahjong
git pull
npm run build
pm2 restart mahjong-server
```

### 检查 Nginx

```bash
sudo nginx -t
sudo systemctl status nginx --no-pager
```

---

## WebSocket 路径

生产环境中，前端默认连接当前域名下的：

```txt
/ws
```

因此 Nginx 需要将 `/ws` 反向代理到：

```txt
http://127.0.0.1:3001/ws
```

---

## 当前规则说明

目前项目包含常见麻将核心流程：

- 摸牌
- 出牌
- 吃
- 碰
- 杠
- 自摸
- 点炮
- 基础番型识别
- 房间累计积分

计分规则偏轻量娱乐向，后续可以继续扩展地方规则、番种、封顶、底分、买马等玩法。

---

## 适合朋友开房试玩的方式

1. 一人创建房间。
2. 复制房间号给朋友。
3. 朋友输入昵称和房间号加入。
4. 不足 4 人时自动补 AI。
5. 开始游戏。
6. 一局结束后可继续下一局，房间积分会累计。

---

## 开发提示

### 后端入口

```txt
server/src/index.ts
```

### WebSocket 逻辑

```txt
server/src/ws/handler.ts
```

### 麻将核心规则

```txt
server/src/game/engine.ts
```

### 前端主界面

```txt
client/src/App.tsx
client/src/components/GameBoard.tsx
client/src/components/Settlement.tsx
```

---

## Roadmap

可能的后续优化方向：

- 更完整的地方麻将规则
- 更细的番型和计分配置
- 移动端交互优化
- 房间观战
- 回放记录
- 聊天和表情
- HTTPS 自动部署脚本
- 数据持久化与账号系统

---

## License

目前暂未指定开源许可证。若要正式开源，建议补充 `LICENSE` 文件，例如 MIT License。
