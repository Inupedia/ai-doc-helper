
# AI Doc Helper (AI 文档助手)

这是一个基于 React + Vite + Gemini API 的专业文档处理工具，支持 Markdown 编辑、Word 导出、OCR 公式识别以及 AI 智能润色。

![App Screenshot](https://via.placeholder.com/800x400?text=AI+Doc+Helper+Preview)

## ✨ 核心功能

*   **Markdown 编辑器**: 支持实时预览、快捷键、以及丰富的格式支持。
*   **Word 完美导出**: 支持标准公文、学术论文、简洁笔记三种导出模板，完美还原 LaTeX 公式。
*   **AI 智能润色**: 内置“导出预优化”、“学术化润色”、“中英文翻译”等功能，支持自定义 Prompt。
*   **公式 OCR**: 截图粘贴即可识别数学公式为 LaTeX 代码。
*   **多模型支持**: 兼容 Google Gemini, Alibaba Qwen, Xiaomi Mimo 等多种大模型接口。

## 🚀 快速开始 (本地运行)

### 1. 环境准备
确保你的电脑上安装了 [Node.js](https://nodejs.org/) (推荐 v18 或 v20 版本)。

### 2. 安装依赖
在项目根目录下打开终端（命令行），运行：

```bash
npm install
```

### 3. 配置 API Key
本项目依赖 AI 模型接口。虽然 UI 支持配置自定义 Key，但为了开发方便，建议配置环境变量：
1. 复制 `.env.example` 文件并重命名为 `.env`。
2. 打开 `.env` 文件，填入你的 API Key：

```properties
API_KEY=你的_API_Key
```

### 4. 启动项目
运行开发服务器：

```bash
npm run dev
```

启动后，打开浏览器访问控制台提示的地址（通常是 `http://localhost:5173`）即可使用。

---

## 🎨 自定义设置

### 更换 Logo
如果您想使用自己的 Logo，请将您的图片文件命名为 `logo.png`，并将其放入项目的 `public/` 文件夹中。刷新页面后，左上角的图标将自动更新。

### 关于我们与隐私
点击右上角的 **?** 按钮，可以查看关于我们、隐私政策、服务条款及常见问题。
*   **隐私政策**: 我们坚持“客户端优先”，您的 API Key 和文档内容仅用于实时 AI 请求，不进行云端留存。
*   **服务条款**: 工具仅供学习研究，使用者需对生成内容的准确性负责。

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

- `components/`
  - `Layout/`: 布局组件 (Header, UserCenter, **AboutModal**)
  - `Editor/`: 编辑器核心组件
  - `OCR/`: 公式识别组件
  - `Preview/`: Word 预览组件
- `utils/`: 工具函数 (Word 转换核心逻辑、AI 接口封装)
- `types.ts`: TypeScript 类型定义
- `vite.config.ts`: Vite 构建配置
