
import React, { useState } from 'react';
import { getEffectiveApiKey, getEffectiveModel, getEffectiveBaseUrl } from '../../utils/settings';
import { generateContent } from '../../utils/aiHelper';

interface DocumentToolsProps {
  markdown: string;
  onUpdate: (val: string) => void;
}

const DocumentTools: React.FC<DocumentToolsProps> = ({ markdown, onUpdate }) => {
  const [isProcessing, setIsProcessing] = useState(false);
  const [activeTool, setActiveTool] = useState<string | null>(null);

  const runAITool = async (toolName: string, prompt: string) => {
    const apiKey = getEffectiveApiKey();
    if (!apiKey) {
        alert('请先在右上角用户中心配置 API Key');
        return;
    }

    setIsProcessing(true);
    setActiveTool(toolName);
    try {
      const modelName = getEffectiveModel('text');
      const baseUrl = getEffectiveBaseUrl();
      
      const newContent = await generateContent({
        apiKey,
        model: modelName,
        baseUrl,
        prompt: `I want you to process the following Markdown document. ${prompt}\n\nDocument Content:\n${markdown}`
      });
      
      onUpdate(newContent);
    } catch (err) {
      console.error('AI Tool Error:', err);
      alert('AI 处理失败，请检查 API 配置或网络连接。');
    } finally {
      setIsProcessing(false);
      setActiveTool(null);
    }
  };

  const tools = [
    {
      id: 'pre-export',
      title: '导出预优化 (推荐)',
      desc: '针对 Word 转换进行深度检查，修复 LaTeX 公式空格、表格对齐及图片链接问题。',
      prompt: 'You are an expert Markdown optimizer. Please prepare this document for high-quality Word conversion. 1. Fix LaTeX formulas: ensure inline math has $...$ with NO spaces ($x$ instead of $ x $), and block math has $$...$$. 2. Fix tables: ensure they are correctly balanced with pipes. 3. Simplify complex LaTeX environments that Word might not support. 4. Maintain original content exactly.',
      icon: 'M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4'
    },
    {
      id: 'format',
      title: '中英文排版',
      desc: '自动修正中英文混排空格、标点符号规范。',
      prompt: 'Please format this text correctly. Add spaces between Chinese and English characters/numbers, fix punctuation (use full-width punctuation in Chinese sentences). Do not rewrite content.',
      icon: 'M4 6h16M4 12h16m-7 6h7'
    },
    {
      id: 'polish',
      title: '学术化润色',
      desc: '将口语化表达转化为正式学术用语，提升专业感。',
      prompt: 'Please rewrite this document to be more academic and professional. Use formal vocabulary and passive voice where appropriate. Keep all Markdown elements like tables and formulas intact.',
      icon: 'M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z'
    },
    {
      id: 'math',
      title: '公式格式检查',
      desc: '统一 LaTeX 语法，确保所有数学变量均进入公式模式。',
      prompt: 'Review all mathematical formulas. Ensure consistent styling and fix any LaTeX syntax errors that might crash the rendering.',
      icon: 'M9 7h6m0 10v-3m-3 3h.01M9 17h.01M9 14h.01M12 14h.01M15 11h.01M12 11h.01M9 11h.01M7 21h10a2 2 0 002-2V5a2 2 0 00-2-2H7a2 2 0 00-2 2v14a2 2 0 002 2z'
    }
  ];

  return (
    <div className="max-w-5xl mx-auto space-y-12 pb-20">
      <div className="text-center">
        <div className="inline-block px-4 py-1.5 mb-4 rounded-full bg-blue-50 text-blue-600 text-xs font-bold uppercase tracking-widest">
          Document Intelligence
        </div>
        <h2 className="text-4xl font-black text-slate-900 mb-4 tracking-tight">AI 智能处理中心</h2>
        <p className="text-slate-500 max-w-2xl mx-auto text-lg leading-relaxed">
          借鉴工业级 Pandoc 转换链路，通过 AI 预处理大幅提升导出 Word 的格式准确度。
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
        {tools.map((tool) => (
          <div 
            key={tool.id} 
            className={`group relative bg-white border border-slate-200 rounded-[32px] p-8 transition-all duration-500 hover:shadow-2xl hover:-translate-y-1 ${
              activeTool === tool.id ? 'ring-2 ring-blue-500 border-transparent' : 'hover:border-blue-200'
            }`}
          >
            <div className={`w-16 h-16 rounded-2xl flex items-center justify-center mb-8 transition-all duration-500 ${
              activeTool === tool.id ? 'bg-blue-600 text-white rotate-12' : 'bg-slate-50 text-slate-400 group-hover:bg-blue-50 group-hover:text-blue-500'
            }`}>
              <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d={tool.icon} />
              </svg>
            </div>
            <h3 className="text-2xl font-bold text-slate-900 mb-3">{tool.title}</h3>
            <p className="text-slate-500 text-sm leading-relaxed mb-10 h-10">{tool.desc}</p>
            
            <button
              onClick={() => runAITool(tool.id, tool.prompt)}
              disabled={isProcessing}
              className={`w-full py-4 rounded-2xl text-sm font-black transition-all ${
                activeTool === tool.id
                  ? 'bg-blue-600 text-white shadow-xl'
                  : isProcessing
                  ? 'bg-slate-100 text-slate-300 cursor-not-allowed'
                  : 'bg-slate-900 text-white hover:bg-blue-600 hover:shadow-xl active:scale-95'
              }`}
            >
              {activeTool === tool.id ? (
                <span className="flex items-center justify-center">
                  <svg className="animate-spin -ml-1 mr-3 h-4 w-4 text-white" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                  处理中...
                </span>
              ) : '运行 AI 任务'}
            </button>
          </div>
        ))}
      </div>

      <div className="bg-gradient-to-br from-blue-600 to-indigo-700 rounded-[32px] p-10 text-white shadow-2xl relative overflow-hidden group">
        <div className="absolute -right-20 -bottom-20 w-64 h-64 bg-white/10 rounded-full blur-3xl group-hover:bg-white/20 transition-all duration-700"></div>
        <div className="relative z-10 flex flex-col md:flex-row items-center md:space-x-8">
          <div className="bg-white/20 p-4 rounded-3xl backdrop-blur-md mb-6 md:mb-0">
            <svg className="w-8 h-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </div>
          <div>
            <h4 className="text-xl font-bold mb-2">私有化配置 (Privacy)</h4>
            <p className="text-blue-100 text-sm leading-relaxed max-w-2xl">
              您在右上角配置的 API Key 仅保存在本地浏览器中，适合个人使用。如需在团队内部署，建议通过服务器环境变量（Environment Variables）注入 Key。
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default DocumentTools;
