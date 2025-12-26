
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

  const tabs = [
    { id: AppView.EDITOR, name: '编辑器 (Editor)', icon: 'M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z' },
    { id: AppView.OCR, name: '公式识别 (OCR)', icon: 'M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z M15 13a3 3 0 11-6 0 3 3 0 016 0z' },
  ];

  return (
    <>
      <header className="h-16 bg-white border-b border-slate-200 px-6 flex items-center justify-between sticky top-0 z-50">
        <div className="flex items-center space-x-3 group cursor-pointer" onClick={() => window.location.reload()}>
          {/* 
            Logo 区域：
            如果您想使用自己的图片，请将图片命名为 logo.png 并放入 public 文件夹中。
            如果图片加载失败，下方代码会自动显示一个漂亮的 SVG 图标作为兜底。
          */}
          <div className="w-8 h-8 relative flex items-center justify-center">
            <img 
              src="/logo.png" 
              alt="Logo" 
              className="w-full h-full object-contain"
              onError={(e) => {
                // 如果图片加载失败，隐藏 img 标签，显示后方的 SVG
                e.currentTarget.style.display = 'none';
                const sibling = e.currentTarget.nextElementSibling as HTMLElement;
                if(sibling) sibling.style.display = 'flex';
              }}
            />
            {/* 默认 SVG 图标 (当没有 /logo.png 时显示) */}
            <div className="w-8 h-8 bg-gradient-to-tr from-blue-600 to-indigo-600 rounded-lg flex items-center justify-center shadow-sm transition-transform group-hover:scale-105 absolute inset-0" style={{ display: 'none' }}>
                {/* 如果 img 加载失败，JS 会把这个 display:none 去掉，或者您可以直接删除 img 标签只用这个 div */}
                 <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                   <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                 </svg>
            </div>
            
            {/* 纯 SVG 版本兜底 (为了确保在第一次加载且没有图片时也能看到东西，这里写一个显式的 SVG，如果 img 加载成功它会被覆盖) */}
             <div className="w-8 h-8 bg-gradient-to-tr from-blue-600 to-indigo-600 rounded-lg flex items-center justify-center shadow-sm -z-10 absolute">
                 <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                   <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                 </svg>
            </div>
          </div>
          <h1 className="text-lg font-semibold tracking-tight text-slate-800 hidden md:block group-hover:text-blue-600 transition-colors">AI Doc Helper</h1>
        </div>

        <nav className="flex space-x-1 bg-slate-50 p-1 rounded-xl border border-slate-100">
          {tabs.map(tab => (
            <button
              key={tab.id}
              onClick={() => setView(tab.id)}
              className={`flex items-center px-4 py-2 rounded-lg text-sm font-bold transition-all ${
                currentView === tab.id 
                  ? 'bg-white text-blue-600 shadow-sm' 
                  : 'text-slate-500 hover:text-slate-700 hover:bg-slate-100/50'
              }`}
            >
              <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d={tab.icon} />
              </svg>
              <span className="hidden sm:inline">{tab.name}</span>
            </button>
          ))}
        </nav>

        <div className="flex items-center space-x-3">
          <button 
            onClick={() => setShowAbout(true)}
            className="w-8 h-8 rounded-full bg-slate-50 border border-slate-200 text-slate-400 hover:text-blue-600 hover:border-blue-200 hover:bg-blue-50 flex items-center justify-center transition-all font-bold text-sm"
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
