
import React, { useState, useEffect } from 'react';
import { saveUserSettings, getUserSettings, AVAILABLE_MODELS, getEffectiveApiKey } from '../../utils/settings';

const UserCenter: React.FC = () => {
  const [isOpen, setIsOpen] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  
  // Settings State
  const [apiKey, setApiKey] = useState('');
  const [selectedModel, setSelectedModel] = useState(''); // 用于存储预设模型的 ID
  const [customModelName, setCustomModelName] = useState(''); // 用于存储自定义输入的模型 ID
  const [baseUrl, setBaseUrl] = useState(''); // 用于存储 Base URL
  const [useCustomModel, setUseCustomModel] = useState(false); // 标记当前是否选中了自定义模式
  const [isSaved, setIsSaved] = useState(false);

  useEffect(() => {
    if (showSettings) {
      const settings = getUserSettings();
      setApiKey(settings.apiKey);
      setBaseUrl(settings.baseUrl);
      
      const storedModel = settings.model;
      // 检查存储的模型是否在预设列表中
      const isPreset = AVAILABLE_MODELS.some(m => m.id === storedModel);
      
      if (isPreset) {
        setSelectedModel(storedModel);
        setUseCustomModel(false);
        setCustomModelName('');
      } else if (storedModel) {
        // 如果有值但不在预设列表中，说明是自定义模型
        setUseCustomModel(true);
        setCustomModelName(storedModel);
        setSelectedModel(''); // 清空预设选择
      } else {
        // 默认情况
        setSelectedModel(AVAILABLE_MODELS[1].id);
        setUseCustomModel(false);
      }
    }
  }, [showSettings]);

  const handleSave = () => {
    // 根据当前模式决定保存哪个值
    const modelToSave = useCustomModel ? customModelName.trim() : selectedModel;
    
    // 如果是自定义模式但没填内容，不允许保存
    if (useCustomModel && !modelToSave) {
        alert("请输入自定义模型名称");
        return;
    }

    saveUserSettings(apiKey, modelToSave, useCustomModel ? baseUrl.trim() : '');
    setIsSaved(true);
    setTimeout(() => setIsSaved(false), 2000);
  };

  const currentKey = getEffectiveApiKey();
  const hasKey = !!currentKey;

  return (
    <div className="relative">
      <button 
        onClick={() => setIsOpen(!isOpen)}
        className={`flex items-center space-x-2 p-1.5 pr-3 rounded-full transition-all border group ${hasKey ? 'bg-white border-slate-200 hover:border-blue-300' : 'bg-red-50 border-red-200'}`}
      >
        <div className={`w-8 h-8 rounded-full flex items-center justify-center text-white shadow-sm transition-transform ${hasKey ? 'bg-gradient-to-tr from-blue-600 to-indigo-600' : 'bg-red-500'}`}>
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
          </svg>
        </div>
        <div className="flex flex-col items-start">
            <span className={`text-[10px] font-bold uppercase tracking-wider ${hasKey ? 'text-slate-500' : 'text-red-500'}`}>
                {hasKey ? 'Pro User' : 'No Key'}
            </span>
        </div>
      </button>

      {isOpen && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setIsOpen(false)}></div>
          <div className="absolute right-0 mt-3 w-80 bg-white rounded-[24px] shadow-2xl border border-slate-200 z-50 p-6 animate-in fade-in zoom-in duration-200 origin-top-right">
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-lg font-bold text-slate-900">用户中心</h3>
              <span className="px-2 py-0.5 rounded-md bg-slate-100 text-slate-500 text-[10px] font-bold">V1.3.2</span>
            </div>
            
            <div className="space-y-4">
              <div className={`p-4 rounded-2xl ${hasKey ? 'bg-blue-50' : 'bg-red-50'}`}>
                <p className={`text-xs font-bold uppercase mb-1 ${hasKey ? 'text-blue-700' : 'text-red-700'}`}>API 状态</p>
                <div className={`flex items-center ${hasKey ? 'text-blue-600' : 'text-red-600'}`}>
                  <div className={`w-2 h-2 rounded-full mr-2 animate-pulse ${hasKey ? 'bg-green-500' : 'bg-red-500'}`}></div>
                  <span className="text-sm font-medium">
                    {hasKey ? '已连接至 API' : '未配置 API Key'}
                  </span>
                </div>
              </div>

              <div className="pt-2">
                <button 
                  onClick={() => { setShowSettings(true); setIsOpen(false); }}
                  className="w-full flex items-center justify-between p-3 rounded-xl bg-slate-50 hover:bg-slate-100 text-slate-700 transition-colors border border-slate-100"
                >
                    <div className="flex items-center">
                        <svg className="w-5 h-5 mr-3 text-slate-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /></svg>
                        <span className="font-bold text-sm">配置 API Key & 模型</span>
                    </div>
                    <svg className="w-4 h-4 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" /></svg>
                </button>
              </div>

              <div className="pt-4 border-t border-slate-100 flex items-center justify-between">
                <a href="https://aistudio.google.com/app/apikey" target="_blank" rel="noopener noreferrer" className="text-[10px] text-blue-600 font-bold hover:underline">
                  GET GEMINI KEY
                </a>
                <span className="text-[10px] text-slate-300">Local Storage Only</span>
              </div>
            </div>
          </div>
        </>
      )}

      {/* Settings Modal */}
      {showSettings && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
            <div className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm" onClick={() => setShowSettings(false)}></div>
            <div className="bg-white rounded-[32px] shadow-2xl w-full max-w-lg relative z-10 overflow-hidden animate-in zoom-in-95 duration-200 max-h-[90vh] overflow-y-auto custom-scrollbar">
                <div className="p-8">
                    <div className="flex items-center justify-between mb-8">
                        <div>
                            <h2 className="text-2xl font-black text-slate-900">API 配置</h2>
                            <p className="text-slate-500 text-sm mt-1">自定义您的 AI 引擎参数</p>
                        </div>
                        <button onClick={() => setShowSettings(false)} className="p-2 hover:bg-slate-100 rounded-full text-slate-400 hover:text-slate-600 transition-colors">
                            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                        </button>
                    </div>

                    <div className="space-y-6">
                        <div>
                            <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">API Key</label>
                            <input 
                                type="password" 
                                value={apiKey}
                                onChange={(e) => setApiKey(e.target.value)}
                                placeholder="sk-..."
                                className="w-full px-4 py-3 rounded-xl border border-slate-300 focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10 outline-none transition-all font-mono text-sm"
                            />
                            <p className="text-[10px] text-slate-400 mt-2">
                                * 您的 Key 仅存储在本地浏览器中。
                            </p>
                        </div>

                        <div>
                            <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Base URL (可选 / Optional)</label>
                            <input 
                                type="text" 
                                value={baseUrl}
                                onChange={(e) => setBaseUrl(e.target.value)}
                                placeholder="默认使用 Google Gemini SDK"
                                className="w-full px-4 py-3 rounded-xl border border-slate-300 focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10 outline-none transition-all font-mono text-sm"
                            />
                            <p className="text-[10px] text-slate-400 mt-2 leading-relaxed">
                                * 兼容 OpenAI 格式接口 (如阿里云 DashScope、DeepSeek)。<br/>
                                * 示例: <code className="bg-slate-100 px-1 rounded text-slate-600">https://dashscope.aliyuncs.com/compatible-mode/v1</code>
                            </p>
                        </div>

                        <div>
                            <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">模型选择 (Model)</label>
                            <div className="grid gap-3">
                                {/* 预设模型列表 */}
                                {AVAILABLE_MODELS.map(model => (
                                    <label key={model.id} className={`flex items-center p-3 rounded-xl border cursor-pointer transition-all ${(!useCustomModel && selectedModel === model.id) ? 'bg-blue-50 border-blue-500 ring-1 ring-blue-500' : 'bg-white border-slate-200 hover:border-slate-300'}`}>
                                        <input 
                                            type="radio" 
                                            name="model_selection" 
                                            value={model.id}
                                            checked={!useCustomModel && selectedModel === model.id}
                                            onChange={() => {
                                                setUseCustomModel(false);
                                                setSelectedModel(model.id);
                                            }}
                                            className="w-4 h-4 text-blue-600 border-slate-300 focus:ring-blue-500"
                                        />
                                        <div className="ml-3">
                                            <span className="block text-sm font-bold text-slate-700">{model.name}</span>
                                        </div>
                                    </label>
                                ))}

                                {/* 自定义模型选项 */}
                                <div className={`rounded-xl border transition-all overflow-hidden ${useCustomModel ? 'bg-blue-50 border-blue-500 ring-1 ring-blue-500' : 'bg-white border-slate-200 hover:border-slate-300'}`}>
                                    <label className="flex items-center p-3 cursor-pointer">
                                        <input 
                                            type="radio" 
                                            name="model_selection" 
                                            value="custom"
                                            checked={useCustomModel}
                                            onChange={() => setUseCustomModel(true)}
                                            className="w-4 h-4 text-blue-600 border-slate-300 focus:ring-blue-500"
                                        />
                                        <div className="ml-3 flex-1">
                                            <span className="block text-sm font-bold text-slate-700">自定义模型 (Custom)</span>
                                        </div>
                                    </label>
                                    
                                    {/* 当选中自定义时显示的输入框 */}
                                    {useCustomModel && (
                                        <div className="px-3 pb-3 pl-10 animate-in slide-in-from-top-2 duration-200 space-y-3">
                                            <input 
                                                type="text" 
                                                value={customModelName}
                                                onChange={(e) => setCustomModelName(e.target.value)}
                                                placeholder="输入模型 ID (如: qwen-plus)"
                                                className="w-full px-3 py-2 rounded-lg border border-blue-200 focus:border-blue-400 outline-none text-sm font-mono bg-white text-slate-700"
                                            />
                                        </div>
                                    )}
                                </div>
                            </div>
                        </div>
                    </div>

                    <div className="mt-8 pt-6 border-t border-slate-100 flex items-center justify-end space-x-3">
                        <button 
                            onClick={() => setShowSettings(false)}
                            className="px-6 py-2.5 rounded-xl font-bold text-slate-500 hover:bg-slate-100 transition-colors text-sm"
                        >
                            取消
                        </button>
                        <button 
                            onClick={handleSave}
                            className={`px-8 py-2.5 rounded-xl font-bold text-white shadow-lg transition-all text-sm flex items-center ${isSaved ? 'bg-green-500' : 'bg-blue-600 hover:bg-blue-700'}`}
                        >
                            {isSaved ? (
                                <>
                                    <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg>
                                    已保存
                                </>
                            ) : '保存配置'}
                        </button>
                    </div>
                </div>
            </div>
        </div>
      )}
    </div>
  );
};

export default UserCenter;
