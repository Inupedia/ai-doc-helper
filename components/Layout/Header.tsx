
import React, { useState } from 'react';
import { AppView } from '../../types';
import UserCenter from './UserCenter';
import AboutModal from './AboutModal';

interface HeaderProps {
  currentView: AppView;
  setView: (view: AppView) => void;
}

const Header: React.FC<HeaderProps> = ({ currentView, setView }) => {
  const [showAbout, setShowAbout] = useState(false);
  const [logoError, setLogoError] = useState(false);

  const tabs = [
    { id: AppView.EDITOR, name: '编辑器 (Editor)', icon: 'M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z' },
    { id: AppView.OCR, name: '公式识别 (OCR)', icon: 'M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z M15 13a3 3 0 11-6 0 3 3 0 016 0z' },
    { id: AppView.MULTI_DOC, name: '多文档处理', icon: 'M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z' },
  ];

  return (
    <>
      <header className="h-16 bg-white border-b border-slate-200 px-6 flex items-center justify-between sticky top-0 z-50">
        <div className="flex items-center space-x-3 group cursor-pointer" onClick={() => window.location.reload()}>
          {/* Logo 区域: 优先显示 /public/logo.png，失败则显示默认 SVG */}
          <div className="w-8 h-8 relative flex items-center justify-center">
            {!logoError ? (
              <img 
                src="/logo.png" 
                alt="Logo" 
                className="w-full h-full object-contain"
                onError={() => setLogoError(true)}
              />
            ) : (
              <div className="w-8 h-8 rounded-lg flex items-center justify-center shadow-sm transition-transform group-hover:scale-105" style={{ background: 'linear-gradient(to top right, var(--primary-color), var(--primary-hover))' }}>
                 <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                   <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                 </svg>
              </div>
            )}
          </div>
          <h1 className="text-lg font-semibold tracking-tight text-slate-800 hidden md:block hover:text-[var(--primary-color)] transition-colors">AI Doc Helper</h1>
        </div>

        <nav className="flex space-x-1 bg-slate-50 p-1 rounded-xl border border-slate-100 overflow-x-auto custom-scrollbar max-w-[50vw] md:max-w-none">
          {tabs.map(tab => (
            <button
              key={tab.id}
              onClick={() => setView(tab.id)}
              className={`flex items-center px-4 py-2 rounded-lg text-sm font-bold transition-all whitespace-nowrap ${
                currentView === tab.id 
                  ? 'bg-white shadow-sm text-[var(--primary-color)]' 
                  : 'text-slate-500 hover:text-slate-700 hover:bg-slate-100/50'
              }`}
            >
              <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d={tab.icon} />
              </svg>
              <span>{tab.name}</span>
            </button>
          ))}
        </nav>

        <div className="flex items-center space-x-3">
          <button 
            onClick={() => setShowAbout(true)}
            className="w-8 h-8 rounded-full bg-slate-50 border border-slate-200 text-slate-400 hover:text-[var(--primary-color)] hover:border-[var(--primary-50)] hover:bg-[var(--primary-50)] flex items-center justify-center transition-all font-bold text-sm"
            title="关于我们 & 帮助"
          >
            ?
          </button>
          <div className="h-6 w-[1px] bg-slate-200"></div>
          <UserCenter />
        </div>
      </header>

      <AboutModal isOpen={showAbout} onClose={() => setShowAbout(false)} />
    </>
  );
};

export default Header;
