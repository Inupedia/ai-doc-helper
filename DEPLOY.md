
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

已在项目根目录为您生成了 `nginx.conf` 文件，其中配置了 IP **120.26.138.13**。

### 3.1 应用配置
将项目中的 `nginx.conf` 复制到 Nginx 配置目录：

```bash
# 复制配置文件 (假设您当前在项目根目录)
sudo cp nginx.conf /etc/nginx/sites-available/ai-doc-helper
```

### 3.2 检查路径
**注意**：`nginx.conf` 中默认的网站根目录是 `/var/www/ai-doc-helper/dist`。
如果您的项目上传到了其他位置（例如 `/home/ubuntu/ai-doc-helper`），请务必修改 `/etc/nginx/sites-available/ai-doc-helper` 中的 `root` 路径。

### 3.3 激活配置并重启
如果是在 Ubuntu 上使用了 `sites-available`，需要建立软链接：
```bash
sudo ln -s /etc/nginx/sites-available/ai-doc-helper /etc/nginx/sites-enabled/
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

在浏览器中输入：`http://120.26.138.13`

1. 打开页面，查看是否正常加载。
2. 打开 F12 开发者工具，检查控制台是否有报错。
3. 尝试使用 OCR 或 AI 工具功能，确认 API Key 是否生效。
