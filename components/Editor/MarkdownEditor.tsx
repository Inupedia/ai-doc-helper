
import React, { useRef, useState, useEffect } from 'react';
import mammoth from 'mammoth';
import { GoogleGenAI } from "@google/genai";
import { getEffectiveApiKey, getEffectiveModel } from '../../utils/settings';

interface MarkdownEditorProps {
  value: string;
  onChange: (val: string) => void;
  onProcessing?: (isProcessing: boolean) => void;
}

interface Tool {
  id: string;
  title: string;
  prompt: string;
  isCustom?: boolean;
}

const DEFAULT_TOOLS: Tool[] = [
  {
    id: 'pre-export',
    title: '导出预优化',
    prompt: 'You are an expert Markdown optimizer. Please prepare this document for high-quality Word conversion. 1. Fix LaTeX formulas: ensure inline math has $...$ with NO spaces ($x$ instead of $ x $), and block math has $$...$$. 2. Fix tables: ensure they are correctly balanced with pipes. 3. Simplify complex LaTeX environments that Word might not support. 4. Maintain original content exactly.'
  },
  {
    id: 'format',
    title: '中英文排版',
    prompt: 'Please format this text correctly. Add spaces between Chinese and English characters/numbers, fix punctuation (use full-width punctuation in Chinese sentences). Do not rewrite content.'
  },
  {
    id: 'polish',
    title: '学术化润色',
    prompt: 'Please rewrite this document to be more academic and professional. Use formal vocabulary and passive voice where appropriate. Keep all Markdown elements like tables and formulas intact.'
  },
  {
    id: 'math',
    title: '公式检查',
    prompt: 'Review all mathematical formulas. Ensure consistent styling and fix any LaTeX syntax errors that might crash the rendering.'
  }
];

const MarkdownEditor: React.FC<MarkdownEditorProps> = ({ value, onChange, onProcessing }) => {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const [showAiTools, setShowAiTools] = useState(false);
  const [history, setHistory] = useState<string[]>([value]);
  const [historyIndex, setHistoryIndex] = useState(0);

  // Tools State
  const [tools, setTools] = useState<Tool[]>(DEFAULT_TOOLS);
  
  // Edit State
  const [editingTool, setEditingTool] = useState<Tool | null>(null);
  const [editPromptValue, setEditPromptValue] = useState('');
  
  // Create State
  const [isCreating, setIsCreating] = useState(false);
  const [newToolTitle, setNewToolTitle] = useState('');
  const [newToolPrompt, setNewToolPrompt] = useState('');

  // 初始化历史记录，避免第一次 undo 为空
  useEffect(() => {
    if (history.length === 1 && history[0] !== value) {
        setHistory([value]);
    }
  }, []);

  // 加载用户自定义的 Prompts 和 Custom Tools
  useEffect(() => {
    // 1. Load Custom Tools
    const savedCustomToolsStr = localStorage.getItem('user_custom_tools');
    let customTools: Tool[] = [];
    if (savedCustomToolsStr) {
        try { customTools = JSON.parse(savedCustomToolsStr); } catch(e) { console.error(e); }
    }

    // 2. Load Default Tool Overrides
    const savedPromptsStr = localStorage.getItem('user_tool_prompts');
    let savedPrompts: Record<string, string> = {};
    if (savedPromptsStr) {
        try { savedPrompts = JSON.parse(savedPromptsStr); } catch(e) { console.error(e); }
    }

    const mergedDefaultTools = DEFAULT_TOOLS.map(t => ({
        ...t,
        prompt: savedPrompts[t.id] || t.prompt
    }));

    setTools([...mergedDefaultTools, ...customTools]);
  }, []);

  const saveToolPrompt = (id: string, newPrompt: string) => {
    const updatedTools = tools.map(t => t.id === id ? {...t, prompt: newPrompt} : t);
    setTools(updatedTools);
    
    const tool = updatedTools.find(t => t.id === id);
    if (tool?.isCustom) {
         // Persist custom tools
         const customTools = updatedTools.filter(t => t.isCustom);
         localStorage.setItem('user_custom_tools', JSON.stringify(customTools));
    } else {
         // Persist default overrides
         const promptMap = updatedTools
            .filter(t => !t.isCustom)
            .reduce((acc, t) => ({...acc, [t.id]: t.prompt}), {} as Record<string, string>);
         localStorage.setItem('user_tool_prompts', JSON.stringify(promptMap));
    }
    
    setEditingTool(null);
  };

  const createTool = () => {
    if (!newToolTitle.trim() || !newToolPrompt.trim()) {
        alert("请输入功能名称和 Prompt");
        return;
    }
    
    const newTool: Tool = {
        id: `custom-${Date.now()}`,
        title: newToolTitle.trim(),
        prompt: newToolPrompt.trim(),
        isCustom: true
    };
    
    const updatedTools = [...tools, newTool];
    setTools(updatedTools);
    
    // Save custom tools
    const customTools = updatedTools.filter(t => t.isCustom);
    localStorage.setItem('user_custom_tools', JSON.stringify(customTools));
    
    setIsCreating(false);
    setNewToolTitle('');
    setNewToolPrompt('');
  };

  const deleteTool = (id: string) => {
    if (!confirm("确定要删除这个自定义功能吗？")) return;
    
    const updatedTools = tools.filter(t => t.id !== id);
    setTools(updatedTools);
    
    const customTools = updatedTools.filter(t => t.isCustom);
    localStorage.setItem('user_custom_tools', JSON.stringify(customTools));
    
    setEditingTool(null);
  };

  const resetToolPrompt = (id: string) => {
    const defaultTool = DEFAULT_TOOLS.find(t => t.id === id);
    if (defaultTool) {
        setEditPromptValue(defaultTool.prompt);
    }
  };

  const updateHistory = (newValue: string) => {
    // 简单的历史记录管理
    const newHistory = history.slice(0, historyIndex + 1);
    newHistory.push(newValue);
    
    // 限制历史记录长度，防止内存溢出
    if (newHistory.length > 50) {
        newHistory.shift();
    } else {
        setHistoryIndex(newHistory.length - 1);
    }
    
    setHistory(newHistory);
    onChange(newValue);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    // Ctrl+Z or Cmd+Z
    if ((e.ctrlKey || e.metaKey) && e.key === 'z') {
      e.preventDefault();
      if (e.shiftKey) {
        // Redo (Ctrl+Shift+Z)
        if (historyIndex < history.length - 1) {
          const nextIndex = historyIndex + 1;
          setHistoryIndex(nextIndex);
          onChange(history[nextIndex]);
        }
      } else {
        // Undo (Ctrl+Z)
        if (historyIndex > 0) {
          const prevIndex = historyIndex - 1;
          setHistoryIndex(prevIndex);
          onChange(history[prevIndex]);
        }
      }
    }
  };

  const handleTextareaChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
      const val = e.target.value;
      const newHistory = history.slice(0, historyIndex + 1);
      newHistory.push(val);
      if (newHistory.length > 50) newHistory.shift();
      else setHistoryIndex(newHistory.length - 1);
      
      setHistory(newHistory);
      onChange(val);
  };

  const toolbarActions = [
    { label: 'H1', action: () => insertText('# ') },
    { label: 'H2', action: () => insertText('## ') },
    { label: 'B', action: () => insertText('**', '**') },
    { label: 'Math', action: () => insertText('$$', '$$') },
    { label: 'Code', action: () => insertText('```\n', '\n```') },
    { label: 'Table', action: () => insertText('| Header | Header |\n| --- | --- |\n| Cell | Cell |\n') },
  ];

  const runAiTool = async (tool: Tool) => {
    setShowAiTools(false);
    const apiKey = getEffectiveApiKey();
    if (!apiKey) {
        alert('请先在右上角用户中心配置 API Key');
        return;
    }

    if (onProcessing) onProcessing(true);
    
    try {
      const ai = new GoogleGenAI({ apiKey });
      const modelName = getEffectiveModel('text');
      
      const response = await ai.models.generateContent({
        model: modelName,
        contents: `I want you to process the following Markdown document. ${tool.prompt}\n\nDocument Content:\n${value}`
      });
      
      const newContent = response.text || value;
      updateHistory(newContent); // AI 修改后的内容加入历史栈，方便用户撤销
    } catch (err) {
      console.error('AI Tool Error:', err);
      alert('AI 处理失败，请检查配置。');
    } finally {
      if (onProcessing) onProcessing(false);
    }
  };

  const insertText = (before: string, after: string = '') => {
    const textarea = textareaRef.current;
    if (!textarea) return;

    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    const current = textarea.value;
    const selected = current.substring(start, end);
    const newValue = current.substring(0, start) + before + selected + after + current.substring(end);
    
    updateHistory(newValue);
    
    setTimeout(() => {
      textarea.focus();
      textarea.setSelectionRange(start + before.length, start + before.length + selected.length);
    }, 0);
  };

  const handleImportWord = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async (event) => {
      const arrayBuffer = event.target?.result as ArrayBuffer;
      try {
        const result = await mammoth.convertToMarkdown({ arrayBuffer });
        updateHistory(result.value);
      } catch (err) {
        console.error("Word import error:", err);
        alert("Word 导入失败，请确保文件格式正确。");
      }
    };
    reader.readAsArrayBuffer(file);
  };

  return (
    <div className="flex flex-col h-full relative">
      <div className="flex items-center justify-between px-4 py-2 border-b border-slate-200 bg-[#F8FAFC]">
        <div className="flex items-center space-x-1">
          {toolbarActions.map((btn, idx) => (
            <button
              key={idx}
              onClick={btn.action}
              className="p-1.5 px-3 rounded hover:bg-white hover:shadow-sm border border-transparent hover:border-slate-300 text-[11px] font-bold text-slate-600 transition-all uppercase"
            >
              {btn.label}
            </button>
          ))}
          
          <div className="h-4 w-[1px] bg-slate-300 mx-2"></div>

          {/* AI Tools Dropdown */}
          <div className="relative">
            <button
              onClick={() => setShowAiTools(!showAiTools)}
              className={`flex items-center px-3 py-1.5 rounded text-[11px] font-bold border transition-all ${showAiTools ? 'bg-indigo-100 text-indigo-700 border-indigo-200' : 'bg-white text-slate-700 border-slate-200 hover:border-indigo-300 hover:text-indigo-600'}`}
            >
              <svg className="w-3.5 h-3.5 mr-1.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" /></svg>
              AI 助手
              <svg className={`w-3 h-3 ml-1 transform transition-transform ${showAiTools ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" /></svg>
            </button>
            
            {showAiTools && (
              <>
                <div className="fixed inset-0 z-10" onClick={() => setShowAiTools(false)}></div>
                <div className="absolute top-full left-0 mt-2 w-56 bg-white rounded-xl shadow-xl border border-slate-100 z-20 overflow-hidden animate-in fade-in zoom-in-95 duration-150">
                   <div className="py-1 max-h-[320px] overflow-y-auto custom-scrollbar">
                      {tools.map(tool => (
                        <div key={tool.id} className="group flex items-center w-full hover:bg-indigo-50 transition-colors pr-2">
                            <button
                                onClick={() => runAiTool(tool)}
                                className="flex-1 text-left px-4 py-2.5 text-xs text-slate-700 hover:text-indigo-700 font-medium flex items-center"
                            >
                                <span className={`w-1.5 h-1.5 rounded-full mr-2 transition-colors ${tool.isCustom ? 'bg-orange-300 group-hover:bg-orange-500' : 'bg-indigo-200 group-hover:bg-indigo-500'}`}></span>
                                {tool.title}
                            </button>
                            <button
                                onClick={(e) => {
                                    e.stopPropagation();
                                    setEditingTool(tool);
                                    setEditPromptValue(tool.prompt);
                                    setShowAiTools(false);
                                }}
                                className="p-1.5 rounded-md text-slate-300 hover:text-slate-600 hover:bg-slate-200 opacity-0 group-hover:opacity-100 transition-all"
                                title="设置 Prompt"
                            >
                                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /></svg>
                            </button>
                        </div>
                      ))}
                   </div>
                   <div className="border-t border-slate-100 p-1 bg-slate-50">
                        <button 
                            onClick={() => { setShowAiTools(false); setIsCreating(true); }}
                            className="w-full text-left px-3 py-2 text-[11px] text-blue-600 hover:bg-blue-100/50 rounded-lg font-bold flex items-center transition-colors"
                        >
                            <div className="w-5 h-5 rounded-full bg-blue-100 flex items-center justify-center mr-2 text-blue-600">
                                <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" /></svg>
                            </div>
                            新建自定义功能
                        </button>
                   </div>
                </div>
              </>
            )}
          </div>
        </div>
        
        <div className="flex items-center">
            <button
            onClick={() => fileInputRef.current?.click()}
            className="flex items-center px-3 py-1.5 rounded bg-blue-50 text-blue-600 text-[11px] font-bold border border-blue-100 hover:bg-blue-100 transition-all"
            >
            <svg className="w-3.5 h-3.5 mr-1.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a2 2 0 002 2h12a2 2 0 002-2v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
            </svg>
            导入 WORD
            </button>
            <input 
            type="file" 
            ref={fileInputRef} 
            onChange={handleImportWord} 
            className="hidden" 
            accept=".docx" 
            />
        </div>
      </div>
      <textarea
        ref={textareaRef}
        className="flex-1 w-full p-8 resize-none focus:outline-none markdown-editor text-sm leading-relaxed text-slate-800 bg-white selection:bg-blue-100"
        placeholder="在这里输入 Markdown 内容，或点击上方导入 Word... (支持 Ctrl+Z 撤销)"
        value={value}
        onChange={handleTextareaChange}
        onKeyDown={handleKeyDown}
      />

      {/* Edit Prompt Modal */}
      {editingTool && (
        <div className="absolute inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/10 backdrop-blur-[2px]">
            <div className="bg-white rounded-xl shadow-2xl w-full max-w-lg overflow-hidden animate-in zoom-in-95 duration-200 border border-slate-200">
                <div className="bg-slate-50 px-6 py-4 border-b border-slate-100 flex justify-between items-center">
                    <h3 className="font-bold text-slate-800">编辑功能: {editingTool.title}</h3>
                    <button onClick={() => setEditingTool(null)} className="text-slate-400 hover:text-slate-600">
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                    </button>
                </div>
                <div className="p-6">
                    <p className="text-xs text-slate-500 mb-2">您可以修改发送给 AI 的指令以微调结果：</p>
                    <textarea 
                        className="w-full h-40 p-3 text-sm border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent outline-none resize-none font-mono bg-slate-50 text-slate-700"
                        value={editPromptValue}
                        onChange={(e) => setEditPromptValue(e.target.value)}
                    ></textarea>
                    <div className="mt-4 flex justify-between items-center">
                        <div>
                            {!editingTool.isCustom ? (
                                <button 
                                    onClick={() => resetToolPrompt(editingTool.id)}
                                    className="text-xs text-slate-400 hover:text-blue-500 font-medium hover:underline"
                                >
                                    恢复默认指令
                                </button>
                            ) : (
                                <button 
                                    onClick={() => deleteTool(editingTool.id)}
                                    className="text-xs text-red-400 hover:text-red-600 font-medium hover:underline flex items-center"
                                >
                                    <svg className="w-3 h-3 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                                    删除此功能
                                </button>
                            )}
                        </div>
                        <div className="space-x-2">
                            <button 
                                onClick={() => setEditingTool(null)}
                                className="px-4 py-2 text-xs font-bold text-slate-600 hover:bg-slate-100 rounded-lg transition-colors"
                            >
                                取消
                            </button>
                            <button 
                                onClick={() => saveToolPrompt(editingTool.id, editPromptValue)}
                                className="px-4 py-2 text-xs font-bold text-white bg-indigo-600 hover:bg-indigo-700 rounded-lg shadow-sm transition-colors"
                            >
                                保存修改
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        </div>
      )}

      {/* Create Tool Modal */}
      {isCreating && (
        <div className="absolute inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/10 backdrop-blur-[2px]">
            <div className="bg-white rounded-xl shadow-2xl w-full max-w-lg overflow-hidden animate-in zoom-in-95 duration-200 border border-slate-200">
                <div className="bg-slate-50 px-6 py-4 border-b border-slate-100 flex justify-between items-center">
                    <h3 className="font-bold text-slate-800">新建自定义功能</h3>
                    <button onClick={() => setIsCreating(false)} className="text-slate-400 hover:text-slate-600">
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                    </button>
                </div>
                <div className="p-6 space-y-4">
                    <div>
                        <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">功能名称 (Title)</label>
                        <input 
                            type="text"
                            className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none bg-white"
                            placeholder="例如：翻译为日文"
                            value={newToolTitle}
                            onChange={(e) => setNewToolTitle(e.target.value)}
                        />
                    </div>
                    <div>
                        <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">指令 (Prompt)</label>
                        <textarea 
                            className="w-full h-32 p-3 text-sm border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none resize-none font-mono bg-slate-50 text-slate-700"
                            placeholder="告诉 AI 应该怎么处理您的文档..."
                            value={newToolPrompt}
                            onChange={(e) => setNewToolPrompt(e.target.value)}
                        ></textarea>
                    </div>
                    <div className="mt-4 flex justify-end space-x-2 pt-2">
                        <button 
                            onClick={() => setIsCreating(false)}
                            className="px-4 py-2 text-xs font-bold text-slate-600 hover:bg-slate-100 rounded-lg transition-colors"
                        >
                            取消
                        </button>
                        <button 
                            onClick={createTool}
                            className="px-6 py-2 text-xs font-bold text-white bg-blue-600 hover:bg-blue-700 rounded-lg shadow-sm transition-colors"
                        >
                            创建功能
                        </button>
                    </div>
                </div>
            </div>
        </div>
      )}
    </div>
  );
};

export default MarkdownEditor;
