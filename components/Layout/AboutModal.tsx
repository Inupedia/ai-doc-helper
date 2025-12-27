
import React, { useState } from 'react';

interface AboutModalProps {
  isOpen: boolean;
  onClose: () => void;
}

const AboutModal: React.FC<AboutModalProps> = ({ isOpen, onClose }) => {
  const [activeTab, setActiveTab] = useState<'about' | 'privacy' | 'terms' | 'faq'>('about');
  const [logoError, setLogoError] = useState(false);

  if (!isOpen) return null;

  const renderContent = () => {
    switch (activeTab) {
      case 'about':
        return (
          <div className="space-y-4 animate-in fade-in duration-300">
            <div className="flex flex-col items-center mb-6">
              <div className="w-16 h-16 mb-4 flex items-center justify-center">
                {!logoError ? (
                  <img 
                    src="/logo.png" 
                    alt="Logo" 
                    className="w-full h-full object-contain"
                    onError={() => setLogoError(true)}
                  />
                ) : (
                  <div className="w-full h-full bg-gradient-to-tr from-blue-600 to-indigo-600 rounded-2xl flex items-center justify-center shadow-lg">
                    <span className="text-white text-3xl font-bold">A</span>
                  </div>
                )}
              </div>
              <h3 className="text-xl font-bold text-slate-900">AI Doc Helper</h3>
              <p className="text-slate-500 text-sm">V1.4.1 Professional</p>
            </div>
            <p className="text-slate-600 leading-relaxed text-sm">
              AI Doc Helper 是一个专注于学术与专业文档处理的智能助手。我们致力于通过先进的人工智能技术，解决 Markdown 到 Word 转换过程中的排版痛点，提供公式识别、格式清洗及学术润色服务。
            </p>
            <div className="bg-slate-50 p-4 rounded-xl border border-slate-100 mt-4">
              <h4 className="font-bold text-slate-800 text-sm mb-2">开发者寄语</h4>
              <p className="text-slate-500 text-xs italic">
                "省下来的时间可以喝杯咖啡"
              </p>
            </div>
            
            <div className="mt-6 border-t border-slate-100 pt-4 flex flex-col items-center">
                <a 
                    href="https://github.com/cenzihan/ai-doc-helper.git" 
                    target="_blank" 
                    rel="noopener noreferrer"
                    className="flex items-center text-xs font-bold text-[var(--primary-color)] hover:text-[var(--primary-hover)] transition-colors mb-1"
                >
                    <svg className="w-4 h-4 mr-1.5" fill="currentColor" viewBox="0 0 24 24"><path d="M12 0c-6.626 0-12 5.373-12 12 0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23.957-.266 1.983-.399 3.003-.404 1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576 4.765-1.589 8.199-6.086 8.199-11.386 0-6.627-5.373-12-12-12z"/></svg>
                    开源链接 (GitHub)
                </a>
                <p className="text-[10px] text-slate-400">by 【The college dropout团队】</p>
                <a href="mailto:cenzh3@mail2.sysu.edu.cn" className="text-[10px] text-slate-400 mt-1 hover:text-[var(--primary-color)] transition-colors">
                    联系邮箱：cenzh3@mail2.sysu.edu.cn
                </a>
            </div>
          </div>
        );
      case 'privacy':
        return (
          <div className="space-y-4 animate-in fade-in duration-300 h-[300px] overflow-y-auto custom-scrollbar pr-2">
            <h3 className="text-lg font-bold text-slate-900">隐私政策 (Privacy Policy)</h3>
            <div className="text-sm text-slate-600 space-y-3">
              <p><strong>1. 数据存储</strong><br/>本应用是一个“客户端优先”的应用。您的 API Key 仅存储在您本地浏览器的 LocalStorage 中，不会上传至我们的服务器。</p>
              <p><strong>2. 文档内容</strong><br/>您上传或编辑的文档内容，仅在您发起 AI 请求时，会直接发送至相应的 AI 服务提供商（如 Google Gemini、阿里云等），我们不会在中间服务器留存副本。</p>
              <p><strong>3. 第三方服务</strong><br/>使用本服务即代表您同意 Google Gemini 或您选择的其他模型提供商的服务条款。</p>
            </div>
          </div>
        );
      case 'terms':
        return (
          <div className="space-y-4 animate-in fade-in duration-300 h-[300px] overflow-y-auto custom-scrollbar pr-2">
            <h3 className="text-lg font-bold text-slate-900">服务条款 (Terms of Service)</h3>
            <div className="text-sm text-slate-600 space-y-3">
              <p><strong>1. 使用许可</strong><br/>本工具仅供个人学习和非商业用途使用。禁止利用本工具生成违反法律法规的内容。</p>
              <p><strong>2. 免责声明</strong><br/>AI 生成的内容可能存在误差（幻觉），使用者应对最终文档内容的准确性负责。开发者不对因使用本工具导致的任何直接或间接损失负责。</p>
              <p><strong>3. 服务变更</strong><br/>我们保留随时修改或中断服务的权利，恕不另行通知。</p>
            </div>
          </div>
        );
      case 'faq':
        return (
          <div className="space-y-4 animate-in fade-in duration-300 h-[300px] overflow-y-auto custom-scrollbar pr-2">
            <h3 className="text-lg font-bold text-slate-900">常见问题 (FAQ)</h3>
            <div className="space-y-3">
              <div className="bg-slate-50 p-3 rounded-lg border border-slate-100">
                <p className="font-bold text-slate-800 text-xs mb-1">Q: API Key 报错怎么办？</p>
                <p className="text-slate-500 text-xs">A: 请检查右上角设置，确认 Key 是否有额度，或尝试切换不同的模型（如 Qwen 或 Mimo）。</p>
              </div>
              <div className="bg-slate-50 p-3 rounded-lg border border-slate-100">
                <p className="font-bold text-slate-800 text-xs mb-1">Q: 导出的 Word 公式乱码？</p>
                <p className="text-slate-500 text-xs">A: 请使用“导出预优化”功能清洗 LaTeX 语法。Word 对部分复杂 LaTeX 环境支持有限，建议简化公式。</p>
              </div>
              <div className="bg-slate-50 p-3 rounded-lg border border-slate-100">
                <p className="font-bold text-slate-800 text-xs mb-1">Q: 可以在手机上使用吗？</p>
                <p className="text-slate-500 text-xs">A: 目前的界面针对桌面端优化，手机端可能存在布局错位，建议使用 PC 浏览器访问。</p>
              </div>
            </div>
          </div>
        );
    }
  };

  const tabs = [
    { id: 'about', label: '关于我们' },
    { id: 'privacy', label: '隐私政策' },
    { id: 'terms', label: '服务条款' },
    { id: 'faq', label: '常见问题' },
  ];

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-slate-900/50 backdrop-blur-sm" onClick={onClose}></div>
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl relative z-10 flex overflow-hidden h-[450px]">
        
        {/* Sidebar */}
        <div className="w-48 bg-slate-50 border-r border-slate-200 p-4 flex flex-col">
          <div className="mb-6 px-2">
             <span className="text-xs font-black text-slate-400 uppercase tracking-wider">Information</span>
          </div>
          <nav className="space-y-1 flex-1">
            {tabs.map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id as any)}
                className={`w-full text-left px-3 py-2.5 rounded-lg text-xs font-bold transition-all ${
                  activeTab === tab.id
                    ? 'bg-white text-[var(--primary-color)] shadow-sm border border-slate-200'
                    : 'text-slate-500 hover:bg-slate-200/50'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </nav>
          <div className="text-[10px] text-slate-300 px-2 mt-auto">
            © 2024 AI Doc Helper
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 p-8 relative">
           <button 
             onClick={onClose}
             className="absolute top-4 right-4 p-2 rounded-full hover:bg-slate-100 text-slate-400 hover:text-slate-600 transition-colors"
           >
             <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
           </button>
           {renderContent()}
        </div>
      </div>
    </div>
  );
};

export default AboutModal;
