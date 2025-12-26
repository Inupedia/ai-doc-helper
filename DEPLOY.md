
# AI Doc Helper - Linux 服务器部署指南

本文档将指导你如何在 Linux 服务器（如 Ubuntu, CentOS, Debian）上部署 AI Doc Helper。

## 1. 环境准备

连接到你的服务器，确保安装了 **Node.js** 和 **Nginx**。

### 安装 Node.js (如果未安装)
推荐使用 nvm 安装：
```bash
curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.39.7/install.sh | bash
source ~/.bashrc
nvm install 20
nvm use 20
```

### 安装 Nginx
**Ubuntu/Debian:**
```bash
sudo apt update
sudo apt install nginx -y
```

**CentOS/RHEL:**
```bash
sudo yum install nginx -y
```

---

## 2. 项目上传与构建

### 2.1 上传代码
将你的项目文件上传到服务器的某个目录，例如 `/var/www/ai-doc-helper`。你可以使用 `scp`、`git clone` 或者 FTP 工具。

### 2.2 安装依赖
进入项目目录并安装依赖：
```bash
cd /var/www/ai-doc-helper
npm install
```

### 2.3 构建项目 (关键步骤)
我们需要在构建时注入 API Key。请确保你已经申请了 Gemini API Key。

运行以下命令进行构建（将 `你的_GEMINI_KEY` 替换为真实的 Key）：

```bash
# 方式一：临时注入并构建
export API_KEY="你的_GEMINI_KEY"
npm run build

# 方式二：创建 .env 文件 (推荐)
echo "API_KEY=你的_GEMINI_KEY" > .env
npm run build
```

构建完成后，你会看到一个生成的 `dist` 目录，里面包含了 `index.html` 和 `assets` 文件夹。

---

## 3. 配置 Nginx

我们需要配置 Nginx 来托管 `dist` 目录中的静态文件。

### 3.1 创建配置文件
创建一个新的 Nginx 配置文件：

```bash
sudo nano /etc/nginx/conf.d/aidoc.conf
# 或者在 Ubuntu 上: sudo nano /etc/nginx/sites-available/aidoc
```

### 3.2 填入配置内容
请将 `your_domain_or_ip` 替换为你的域名或服务器 IP，将 `root` 路径修改为你的实际路径。

```nginx
server {
    listen 80;
    server_name your_domain_or_ip; # 例如: 192.168.1.100 或 aidoc.example.com

    # 指向构建生成的 dist 目录
    root /var/www/ai-doc-helper/dist;
    index index.html;

    # 开启 gzip 压缩，加快加载速度
    gzip on;
    gzip_min_length 1k;
    gzip_types text/plain application/javascript text/css application/xml;

    location / {
        # 配合 React Router/SPA 使用，如果路径不存在则回退到 index.html
        try_files $uri $uri/ /index.html;
    }

    # 可选：缓存静态资源
    location /assets/ {
        expires 30d;
        add_header Cache-Control "public";
    }
}
```

### 3.3 激活配置并重启
如果是在 Ubuntu 上使用了 `sites-available`，需要建立软链接：
```bash
sudo ln -s /etc/nginx/sites-available/aidoc /etc/nginx/sites-enabled/
```

检查配置是否正确：
```bash
sudo nginx -t
```

重启 Nginx：
```bash
sudo systemctl restart nginx
```

---

## 4. 访问验证

在浏览器中输入 `http://你的域名或IP`。

1. 打开页面，查看是否正常加载。
2. 打开 F12 开发者工具，检查控制台是否有报错。
3. 尝试使用 OCR 或 AI 工具功能，确认 API Key 是否生效。

## 5. 安全提示

由于这是一个纯前端项目，**API Key 是被打包在前端代码中的**。这意味着有技术能力的用户可以通过查看网页源码获取你的 Key。

为了提高安全性：
1. **限制配额**：在 Google Cloud Console 中，限制该 API Key 的每日使用额度。
2. **限制来源**：在 Google Cloud Console 中，设置 API Key 仅允许来自你的域名（HTTP Referrer）的请求。
