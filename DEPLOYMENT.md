# Mahjong 部署指南

适用环境：腾讯云 CVM / Ubuntu 22.04 / Debian 系列。

## 1. 安装基础依赖

```bash
sudo apt update
sudo apt install -y git curl nginx build-essential
```

安装 Node.js 20（推荐使用 NodeSource）：

```bash
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt install -y nodejs
node -v
npm -v
```

可选：安装 PM2 作为进程守护。

```bash
sudo npm i -g pm2
```

## 2. 拉取项目

```bash
cd /var/www
sudo mkdir -p mahjong
sudo chown -R $USER:$USER mahjong
cd mahjong
git clone https://github.com/WUDIFIVE/AnytimeMahjong.git .
```

## 3. 安装依赖

仓库根目录、server、client 都需要安装依赖：

```bash
npm install
cd server && npm install
cd ../client && npm install
```

## 4. 配置环境变量

服务端支持以下变量：

- `PORT`：服务端监听端口，默认 `3001`

如果使用 PM2，可直接在启动命令前设置：

```bash
PORT=3001 pm2 start server/dist/index.js --name mahjong-server
```

## 5. 生产构建

```bash
cd /var/www/mahjong
npm run build
```

这会依次构建：

- `server`：`tsc`
- `client`：`vite build`

## 6. 启动服务

### 方式 A：直接启动

```bash
cd /var/www/mahjong/server
PORT=3001 npm run start
```

### 方式 B：PM2（推荐）

先构建：

```bash
cd /var/www/mahjong
npm run build
```

再启动：

```bash
cd /var/www/mahjong
PORT=3001 pm2 start server/dist/index.js --name mahjong-server
pm2 save
pm2 startup
```

## 7. Nginx 反向代理

建议让 Nginx 负责 HTTPS 和静态资源，转发 `/ws` 到 Node 服务。

示例配置：

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
    }

    location / {
        try_files $uri $uri/ /index.html;
    }
}
```

启用配置后：

```bash
sudo ln -s /etc/nginx/sites-available/mahjong /etc/nginx/sites-enabled/mahjong
sudo nginx -t
sudo systemctl reload nginx
```

## 8. 更新代码

以后更新只需要：

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

## 9. 常见检查

### 服务健康检查

```bash
curl http://127.0.0.1:3001/health
```

### 查看 PM2 状态

```bash
pm2 status
pm2 logs mahjong-server
```
