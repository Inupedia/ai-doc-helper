
import React from 'react';
import { AppView } from '../../types';
import UserCenter from './UserCenter';

interface HeaderProps {
  currentView: AppView;
  setView: (view: AppView) => void;
}

const Header: React.FC<HeaderProps> = ({ currentView, setView }) => {
  const tabs = [
    { id: AppView.EDITOR, name: '编辑器 (Editor)', icon: 'M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z' },
    { id: AppView.OCR, name: '公式识别 (OCR)', icon: 'M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z M15 13a3 3 0 11-6 0 3 3 0 016 0z' },
  ];

  return (
    <header className="h-16 bg-white border-b border-slate-200 px-6 flex items-center justify-between sticky top-0 z-50">
      <div className="flex items-center space-x-3">
        <div className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center shadow-sm cursor-pointer hover:rotate-12 transition-transform">
          <span className="text-white font-bold text-lg">A</span>
        </div>
        <h1 className="text-lg font-semibold tracking-tight text-slate-800 hidden md:block">AI Doc Helper</h1>
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

      <div className="flex items-center space-x-4">
        <UserCenter />
      </div>
    </header>
  );
};

export default Header;
