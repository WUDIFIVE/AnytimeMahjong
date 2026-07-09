# AnytimeMahjong 生产部署手册

本文档用于将本项目部署到腾讯云 CVM（Ubuntu / Debian）。

---

## 1. 部署目标

推荐架构：

- **Nginx**：负责静态资源、域名、HTTPS、WebSocket 反代
- **Node.js 服务**：负责游戏后端 `/health` 与 `/ws`
- **前端静态文件**：由 Nginx 直接托管 `client/dist`

默认后端端口：`3001`

---

## 2. 服务器前置条件

请先准备：

- 一台腾讯云 CVM
- 已配置好安全组
- 可 SSH 登录
- 已安装 Git、Node.js 20+、Nginx

### 安装基础软件

```bash
sudo apt update
sudo apt install -y git curl nginx build-essential
```

### 安装 Node.js 20

```bash
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt install -y nodejs
node -v
npm -v
```

### 可选：安装 PM2

```bash
sudo npm i -g pm2
pm2 -v
```

---

## 3. 获取项目代码

建议统一放在 `/var/www/mahjong`：

```bash
cd /var/www
sudo mkdir -p mahjong
sudo chown -R $USER:$USER mahjong
cd mahjong
git clone https://github.com/WUDIFIVE/AnytimeMahjong.git .
```

如果你已经在服务器上有仓库，只需：

```bash
cd /var/www/mahjong
git pull
```

---

## 4. 安装依赖

仓库根目录、`server`、`client` 都需要安装依赖：

```bash
cd /var/www/mahjong
npm install
cd server && npm install
cd ../client && npm install
```

> 如果你要做正式生产环境，建议在首次部署后保留 `package-lock.json`，后续更新继续使用 `npm install` 或 `npm ci`。

---

## 5. 构建生产包

在仓库根目录执行：

```bash
cd /var/www/mahjong
npm run build
```

这个命令会：

- 构建后端 `server`（TypeScript → `dist`）
- 构建前端 `client`（Vite → `client/dist`）

构建成功后，前端静态文件位于：

```bash
/var/www/mahjong/client/dist
```

---

## 6. 后端启动方式

### 方式 A：直接启动

```bash
cd /var/www/mahjong/server
PORT=3001 npm run start
```

### 方式 B：PM2 启动（推荐）

```bash
cd /var/www/mahjong
PORT=3001 pm2 start server/dist/index.js --name mahjong-server
pm2 save
pm2 startup
```

### 后端环境变量

当前服务端支持：

- `PORT`：监听端口，默认 `3001`

如果你要换端口：

```bash
PORT=8080 pm2 start server/dist/index.js --name mahjong-server
```

---

## 7. Nginx 配置

Nginx 负责：

- 托管前端静态文件
- 反代 `/ws` 到 Node.js 后端
- 可选：配置 HTTPS

### 示例配置

创建文件：

```bash
sudo nano /etc/nginx/sites-available/mahjong
```

填入：

```nginx
server {
    listen 80;
    server_name your.domain.com;

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
        proxy_set_header Host $host;
    }

    location / {
        try_files $uri $uri/ /index.html;
    }
}
```

启用站点：

```bash
sudo ln -sf /etc/nginx/sites-available/mahjong /etc/nginx/sites-enabled/mahjong
sudo nginx -t
sudo systemctl reload nginx
```

---

## 8. 更新与发布流程

以后更新建议按以下顺序：

```bash
cd /var/www/mahjong
git pull
npm install
cd server && npm install
cd ../client && npm install
cd ..
npm run build
pm2 restart mahjong-server
```

如果你不用 PM2，而是直接 `npm run start`，则需要手动停止旧进程后重启。

---

## 9. 回滚建议

如果新版本有问题：

```bash
cd /var/www/mahjong
git log --oneline --max-count=10
```

回滚到指定提交：

```bash
git checkout <commit_sha>
npm install
npm run build
pm2 restart mahjong-server
```

如果你用的是生产分支，也可以通过：

```bash
git reset --hard <commit_sha>
```

> 回滚前先确认没有未保存的本地修改。

---

## 10. 排障清单

### 10.1 后端启动失败

检查端口是否被占用：

```bash
lsof -nP -iTCP:3001 -sTCP:LISTEN
```

查看后端日志：

```bash
pm2 logs mahjong-server
```

### 10.2 前端打开空白页

确认前端已构建：

```bash
ls -la /var/www/mahjong/client/dist
```

确认 Nginx 的 `root` 路径正确。

### 10.3 WebSocket 连不上

确认：

- 后端服务已启动
- Nginx 已反代 `/ws`
- 浏览器访问域名对应的 Nginx 站点

可直接测试：

```bash
curl http://127.0.0.1:3001/health
```

### 10.4 需要重启服务

```bash
pm2 restart mahjong-server
sudo systemctl reload nginx
```

---

## 11. 推荐的首次部署命令顺序

如果你想直接复制执行，可以按下面流程：

```bash
# 1) 准备目录
cd /var/www
sudo mkdir -p mahjong
sudo chown -R $USER:$USER mahjong
cd mahjong

# 2) 拉代码
git clone https://github.com/WUDIFIVE/AnytimeMahjong.git .

# 3) 安装依赖
npm install
cd server && npm install
cd ../client && npm install
cd ..

# 4) 构建
npm run build

# 5) 启动后端
PORT=3001 pm2 start server/dist/index.js --name mahjong-server
pm2 save

# 6) 配置 Nginx 后重载
sudo nginx -t
sudo systemctl reload nginx
```

---

## 12. 备注

- 本项目的 WebSocket 地址默认挂载在 `/ws`
- 后端健康检查地址为 `/health`
- 前端构建产物在 `client/dist`
- 后端构建产物在 `server/dist`
