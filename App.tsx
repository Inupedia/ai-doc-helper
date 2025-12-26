
import React, { useState, useCallback } from 'react';
import Header from './components/Layout/Header';
import MarkdownEditor from './components/Editor/MarkdownEditor';
import WordPreview from './components/Preview/WordPreview';
import FormulaOCR from './components/OCR/FormulaOCR';
import { AppView, DocumentState } from './types';

const App: React.FC = () => {
  const [view, setView] = useState<AppView>(AppView.EDITOR);
  const [docState, setDocState] = useState<DocumentState>({
    markdown: `# AI 智能文档助理使用手册\n\n这是一个专业的文档处理平台，支持将 **Markdown** 无缝转换为 **Word** 格式。\n\n### 1. 公式展示 (LaTeX)\n\n系统支持复杂的数学公式渲染，例如高斯积分：\n\n$$\\int_{-\\infty}^{\\infty} e^{-x^2} dx = \\sqrt{\\pi}$$\n\n### 2. 功能特性\n\n- **OCR 识别**：截图粘贴即可识别数学公式。\n- **一键排版**：自动修正中英文间距，提升专业感。\n- **导出预览**：右侧实时模拟 Word A4 纸张排版效果。\n\n### 3. 示例表格\n\n| 功能模块 | 技术选型 | 优势 |\n| :--- | :--- | :--- |\n| 文本处理 | Markdown-it | 标准化程度高 |\n| 公式识别 | Gemini 2 Flash | 多模态深度理解 |\n| 文档转换 | Docx.js | 浏览器端纯前端转换 |\n\n> 提示：点击“AI 助手”体验一键润色，支持 Ctrl+Z 撤销。`,
    isProcessing: false,
    progress: 0
  });

  const handleMarkdownChange = (val: string) => {
    setDocState(prev => ({ ...prev, markdown: val }));
  };

  const handleProcessing = (isProcessing: boolean) => {
     setDocState(prev => ({ 
         ...prev, 
         isProcessing, 
         progress: isProcessing ? 30 : 100 
     }));
     
     if (isProcessing) {
         // 模拟进度条
         const interval = setInterval(() => {
             setDocState(prev => {
                 if (!prev.isProcessing || prev.progress >= 90) {
                     clearInterval(interval);
                     return prev;
                 }
                 return { ...prev, progress: prev.progress + 5 };
             });
         }, 500);
     } else {
         setTimeout(() => setDocState(prev => ({ ...prev, progress: 0 })), 500);
     }
  };

  const insertAtCursor = useCallback((text: string) => {
    setDocState(prev => ({
      ...prev,
      markdown: prev.markdown + '\n' + text + '\n'
    }));
    setView(AppView.EDITOR);
  }, []);

  return (
    <div className="flex flex-col h-screen bg-[#F7F9FB] text-slate-800">
      <Header currentView={view} setView={setView} />
      
      <main className="flex-1 overflow-hidden relative">
        {view === AppView.EDITOR && (
          <div className="flex h-full animate-in fade-in duration-300">
            <div className="w-1/2 h-full border-r border-slate-200 bg-white">
              <MarkdownEditor 
                value={docState.markdown} 
                onChange={handleMarkdownChange} 
                onProcessing={handleProcessing}
              />
            </div>
            <div className="w-1/2 h-full bg-[#f1f3f5] overflow-x-auto overflow-y-hidden">
              <WordPreview 
                markdown={docState.markdown} 
                isProcessing={docState.isProcessing}
                progress={docState.progress}
              />
            </div>
          </div>
        )}

        {view === AppView.OCR && (
          <div className="h-full animate-in slide-in-from-bottom-4 duration-300 overflow-y-auto">
            <FormulaOCR onResult={insertAtCursor} />
          </div>
        )}
      </main>

      {docState.isProcessing && (
        <div className="fixed bottom-0 left-0 w-full h-1 bg-slate-100 z-50">
          <div 
            className="h-full bg-blue-500 transition-all duration-300 ease-out" 
            style={{ width: `${docState.progress}%` }}
          />
        </div>
      )}
    </div>
  );
};

export default App;
