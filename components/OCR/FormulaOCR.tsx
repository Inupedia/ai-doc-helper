
import React, { useState, useRef, useCallback } from 'react';
import { Type } from "@google/genai";
import ReactMarkdown from 'react-markdown';
import remarkMath from 'remark-math';
import rehypeKatex from 'rehype-katex';
import { getEffectiveApiKey, getEffectiveModel, getEffectiveBaseUrl } from '../../utils/settings';
import { generateContent } from '../../utils/aiHelper';

interface FormulaOCRProps {
  onResult: (latex: string) => void;
}

interface OCRResultModes {
  inline: string;
  block: string;
  raw: string;
}

const FormulaOCR: React.FC<FormulaOCRProps> = ({ onResult }) => {
  const [image, setImage] = useState<string | null>(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [results, setResults] = useState<OCRResultModes | null>(null);
  const [activeTab, setActiveTab] = useState<'inline' | 'block'>('block');
  const [copyStatus, setCopyStatus] = useState<'idle' | 'copied'>('idle');
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handlePaste = useCallback((e: React.ClipboardEvent) => {
    const items = e.clipboardData.items;
    for (let i = 0; i < items.length; i++) {
      if (items[i].type.indexOf('image') !== -1) {
        const blob = items[i].getAsFile();
        if (blob) {
          const reader = new FileReader();
          reader.onload = (event) => {
            setImage(event.target?.result as string);
          };
          reader.readAsDataURL(blob);
        }
      }
    }
  }, []);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (event) => {
        setImage(event.target?.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const analyzeFormula = async () => {
    if (!image) return;
    
    const apiKey = getEffectiveApiKey();
    if (!apiKey) {
        alert('请先在右上角用户中心配置 API Key');
        return;
    }

    setIsAnalyzing(true);
    setResults(null);

    try {
      const base64Data = image.split(',')[1];
      const modelName = getEffectiveModel('ocr');
      const baseUrl = getEffectiveBaseUrl();
      
      const responseText = await generateContent({
        apiKey,
        model: modelName,
        baseUrl,
        image: base64Data,
        prompt: '请识别图片中的数学公式，并提供三种格式的 JSON 输出：1. inline (单美元符号包裹的行内公式), 2. block (双美元符号包裹的独立块公式), 3. raw (不带美元符号的原始 LaTeX 代码)。',
        jsonSchema: {
            type: Type.OBJECT,
            properties: {
              inline: { type: Type.STRING, description: 'Inline LaTeX string with $...$' },
              block: { type: Type.STRING, description: 'Block/Display LaTeX string with $$...$$' },
              raw: { type: Type.STRING, description: 'Raw LaTeX code without delimiters' }
            },
            required: ['inline', 'block', 'raw']
        }
      });

      // Parse JSON (Handling Markdown code block wrapping if API returns it)
      let cleanJson = responseText.trim();
      if (cleanJson.startsWith('```json')) {
        cleanJson = cleanJson.replace(/^```json\s*/, '').replace(/\s*```$/, '');
      } else if (cleanJson.startsWith('```')) {
        cleanJson = cleanJson.replace(/^```\s*/, '').replace(/\s*```$/, '');
      }

      const data = JSON.parse(cleanJson);
      setResults(data);
      setActiveTab('block');
    } catch (err) {
      console.error('OCR Error:', err);
      alert('识别失败，请检查 API Key 配额或网络连接。');
    } finally {
      setIsAnalyzing(false);
    }
  };

  const handleCopy = (text: string) => {
    navigator.clipboard.writeText(text).then(() => {
        setCopyStatus('copied');
        setTimeout(() => setCopyStatus('idle'), 2000);
    }).catch(err => {
        console.error('Copy failed', err);
    });
  };

  return (
    <div className="p-4 lg:p-12 max-w-[1440px] mx-auto min-h-full flex flex-col" onPaste={handlePaste}>
      <div className="text-center mb-10">
        <h2 className="text-3xl font-extrabold text-slate-900 mb-3 tracking-tight">AI 公式精准识别 (多模式)</h2>
        <p className="text-slate-500 text-lg">支持截图粘贴 • 即时预览 • LaTeX 导出</p>
      </div>

      <div className="flex-1 grid grid-cols-1 lg:grid-cols-2 gap-10">
        <div className="space-y-6">
          <div className="bg-white border-2 border-dashed border-slate-300 rounded-3xl h-[450px] flex flex-col items-center justify-center relative overflow-hidden group hover:border-blue-500 hover:bg-blue-50/30 transition-all duration-300 shadow-sm">
            {image ? (
              <>
                <img src={image} alt="Preview" className="max-h-full max-w-full object-contain p-6" />
                <div className="absolute top-4 right-4">
                  <button onClick={() => setImage(null)} className="bg-red-500 text-white p-2 rounded-full shadow-lg"><svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg></button>
                </div>
              </>
            ) : (
              <div className="text-center cursor-pointer p-10 w-full h-full flex flex-col items-center justify-center" onClick={() => fileInputRef.current?.click()}>
                <h4 className="text-slate-800 font-bold text-xl mb-2">粘贴截图或点击上传</h4>
                <p className="text-slate-400 text-sm">支持 PNG/JPG 格式</p>
                <input type="file" ref={fileInputRef} onChange={handleFileChange} className="hidden" accept="image/*" />
              </div>
            )}
          </div>
          <button 
            onClick={analyzeFormula}
            disabled={!image || isAnalyzing}
            className={`w-full py-5 rounded-2xl font-bold text-lg transition-all ${!image || isAnalyzing ? 'bg-slate-200 text-slate-400' : 'bg-blue-600 text-white shadow-xl hover:shadow-2xl hover:bg-blue-700'}`}
          >
            {isAnalyzing ? '正在深度解析...' : '识别公式 (Analyze)'}
          </button>
        </div>

        <div className="bg-white border border-slate-200 rounded-3xl p-8 shadow-sm flex flex-col h-[550px]">
          {results ? (
             <div className="flex-1 flex flex-col space-y-4 overflow-hidden">
                <div className="flex bg-slate-100 p-1 rounded-xl w-fit">
                    {['block', 'inline'].map(tab => (
                        <button key={tab} onClick={() => setActiveTab(tab as any)} className={`px-4 py-1.5 rounded-lg text-xs font-bold ${activeTab === tab ? 'bg-white text-blue-600 shadow-sm' : 'text-slate-500'}`}>
                            {tab === 'block' ? '块级' : '行内'}
                        </button>
                    ))}
                </div>
                <div className="bg-slate-900 p-4 rounded-xl text-blue-300 font-mono text-xs break-all overflow-y-auto max-h-32">
                    {results[activeTab]}
                </div>
                <div className="flex-1 border border-slate-100 rounded-xl flex items-center justify-center p-4 overflow-auto">
                    <ReactMarkdown remarkPlugins={[remarkMath]} rehypePlugins={[rehypeKatex]}>{results[activeTab]}</ReactMarkdown>
                </div>
                <div className="flex justify-end space-x-2">
                    <button 
                        onClick={() => handleCopy(results[activeTab])} 
                        className={`px-6 py-2 rounded-xl text-sm font-bold border transition-all flex items-center ${
                            copyStatus === 'copied' 
                            ? 'bg-green-50 border-green-200 text-green-600' 
                            : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-50'
                        }`}
                    >
                        {copyStatus === 'copied' ? (
                            <>
                                <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg>
                                已复制
                            </>
                        ) : (
                            <>
                                <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 5H6a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2v-1M8 5a2 2 0 002 2h2a2 2 0 002-2M8 5a2 2 0 012-2h2a2 2 0 012 2m0 0h2a2 2 0 012 2v3m2 4H10m0 0l3-3m-3 3l3 3" /></svg>
                                复制
                            </>
                        )}
                    </button>
                    <button onClick={() => onResult(results[activeTab])} className="bg-blue-600 text-white px-6 py-2 rounded-xl text-sm font-bold shadow-lg hover:bg-blue-700 transition-colors flex items-center">
                        <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a2 2 0 002 2h12a2 2 0 002-2v-1m-4-4l-4 4m0 0l-4-4m4 4V4" /></svg>
                        插入编辑器
                    </button>
                </div>
             </div>
          ) : (
             <div className="flex-1 flex items-center justify-center text-slate-300 italic">等待识别成果...</div>
          )}
        </div>
      </div>
    </div>
  );
};

export default FormulaOCR;
