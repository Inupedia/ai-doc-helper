
# AI Doc Helper (AI 文档助手)

这是一个基于 React + Vite + Gemini API 的专业文档处理工具，支持 Markdown 编辑、Word 导出、OCR 公式识别以及 AI 智能润色。

## 🚀 快速开始 (本地运行)

### 1. 环境准备
确保你的电脑上安装了 [Node.js](https://nodejs.org/) (推荐 v18 或 v20 版本)。

### 2. 安装依赖
在项目根目录下打开终端（命令行），运行：

```bash
npm install
```

### 3. 配置 API Key
本项目依赖 Google Gemini API。
1. 复制 `.env.example` 文件并重命名为 `.env`。
2. 打开 `.env` 文件，填入你的 API Key：

```properties
API_KEY=你的_Google_Gemini_API_Key
```

### 4. 启动项目
运行开发服务器：

```bash
npm run dev
```

启动后，打开浏览器访问控制台提示的地址（通常是 `http://localhost:5173`）即可使用。

---

## 🛠️ 构建与部署

### 构建生产版本
如果你想测试生产环境的构建效果，或者准备部署到服务器：

```bash
npm run build
```
构建产物位于 `dist` 目录。

### 本地预览生产版本
构建完成后，可以使用以下命令在本地预览生产版本（模拟服务器环境）：

```bash
npm run preview
```

---

## 📂 目录结构

- `components/`: UI 组件 (编辑器、预览、OCR、工具栏)
- `utils/`: 工具函数 (Word 转换核心逻辑、Gemini API 初始化)
- `types.ts`: TypeScript 类型定义
- `vite.config.ts`: Vite 构建配置 (包含环境变量注入逻辑)
