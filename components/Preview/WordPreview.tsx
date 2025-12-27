
import React, { useState, useEffect, useRef } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import remarkMath from 'remark-math';
import rehypeKatex from 'rehype-katex';
import { WordTemplate } from '../../types';
import { downloadDocx } from '../../utils/converter';

interface WordPreviewProps {
  markdown: string;
  isProcessing: boolean;
  progress: number;
}

const WordPreview: React.FC<WordPreviewProps> = ({ markdown, isProcessing, progress }) => {
  const [template, setTemplate] = useState<WordTemplate>(WordTemplate.STANDARD);
  const [scale, setScale] = useState(1);
  const containerRef = useRef<HTMLDivElement>(null);
  const paperRef = useRef<HTMLDivElement>(null);

  // 动态计算缩放比例，确保 A4 纸张完整显示
  useEffect(() => {
    const handleResize = () => {
      if (containerRef.current && paperRef.current) {
        const containerWidth = containerRef.current.offsetWidth - 64; // 减去 padding
        const paperWidth = 794; // 210mm 约为 794px (96dpi)
        if (containerWidth < paperWidth) {
          setScale(containerWidth / paperWidth);
        } else {
          setScale(1);
        }
      }
    };

    handleResize();
    window.addEventListener('resize', handleResize);
    const timer = setTimeout(handleResize, 100); // 延迟执行确保 DOM 加载完成
    return () => {
      window.removeEventListener('resize', handleResize);
      clearTimeout(timer);
    };
  }, [markdown]);

  const getTemplateStyles = () => {
    switch(template) {
      case WordTemplate.ACADEMIC:
        return "prose-academic text-[10.5pt] leading-[1.6] px-[25mm] py-[30mm] bg-white shadow-2xl mx-auto border border-slate-200";
      case WordTemplate.NOTE:
        return "max-w-none text-[11pt] leading-relaxed px-[20mm] py-[25mm] bg-white shadow-lg mx-auto rounded-lg border border-slate-100";
      default:
        return "max-w-none text-[12pt] leading-normal px-[25mm] py-[30mm] bg-white shadow-2xl mx-auto border border-slate-200";
    }
  };

  const handleDownload = async () => {
    await downloadDocx(markdown, template);
  };

  return (
    <div className="flex flex-col h-full bg-[#8E97A4] overflow-hidden" ref={containerRef}>
      <div className="flex items-center justify-between px-6 py-3 bg-white border-b border-slate-300 shadow-md z-20">
        <div className="flex items-center space-x-4">
          <div className="flex flex-col">
             <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider leading-none mb-1">视图控制 (View Control)</span>
             <div className="flex items-center">
                <span className="text-xs font-semibold text-[var(--primary-color)]">
                  {Math.round(scale * 100)}% 缩放适应
                </span>
             </div>
          </div>
          <div className="h-6 w-[1px] bg-slate-200 mx-2"></div>
          <select 
            value={template} 
            onChange={(e) => setTemplate(e.target.value as WordTemplate)}
            className="text-xs bg-slate-50 border border-slate-300 rounded-md px-3 py-1.5 focus:outline-none focus:ring-2 focus:ring-[var(--primary-color)] transition-all font-medium text-slate-700"
          >
            <option value={WordTemplate.STANDARD}>📄 标准公文样式 (宋体/12pt)</option>
            <option value={WordTemplate.ACADEMIC}>🎓 学术论文样式 (Times New Roman)</option>
            <option value={WordTemplate.NOTE}>📝 简洁笔记样式 (微软雅黑)</option>
          </select>
        </div>
        <button 
          onClick={handleDownload}
          className="bg-[var(--primary-color)] hover:bg-[var(--primary-hover)] text-white text-xs font-bold px-5 py-2.5 rounded shadow-lg flex items-center transform transition-all active:scale-95"
        >
          <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a2 2 0 002 2h12a2 2 0 002-2v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
          </svg>
          导出 Word 文档
        </button>
      </div>

      <div className="flex-1 overflow-auto p-8 flex justify-center items-start scroll-smooth custom-scrollbar">
        <div 
          ref={paperRef}
          className="relative transition-transform duration-300 ease-out origin-top mb-20"
          style={{ transform: `scale(${scale})` }}
        >
          <div className={`w-[210mm] min-h-[297mm] transition-all duration-500 ${getTemplateStyles()} prose prose-slate`}>
            <ReactMarkdown 
              remarkPlugins={[remarkGfm, remarkMath]} 
              rehypePlugins={[rehypeKatex]}
              components={{
                h1: ({node, ...props}) => <h1 className="text-4xl font-bold mb-10 text-center text-slate-900 border-b-0 pb-0" {...props} />,
                h2: ({node, ...props}) => <h2 className="text-2xl font-bold mt-10 mb-5 border-b-2 border-slate-900 pb-2" {...props} />,
                h3: ({node, ...props}) => <h3 className="text-xl font-bold mt-8 mb-4 text-slate-800" {...props} />,
                p: ({node, ...props}) => <p className="mb-4 text-justify leading-relaxed text-slate-800" {...props} />,
                table: ({node, ...props}) => (
                  <div className="overflow-x-auto my-6">
                    <table className="min-w-full border-collapse border border-slate-400" {...props} />
                  </div>
                ),
                thead: ({node, ...props}) => <thead className="bg-slate-100" {...props} />,
                th: ({node, ...props}) => <th className="border border-slate-400 px-4 py-2 font-bold text-slate-800" {...props} />,
                td: ({node, ...props}) => <td className="border border-slate-400 px-4 py-2 text-slate-700" {...props} />,
                ul: ({node, ...props}) => <ul className="list-disc pl-8 mb-4" {...props} />,
                ol: ({node, ...props}) => <ol className="list-decimal pl-8 mb-4" {...props} />,
                // Fix: Access 'inline' property using type assertion to avoid TypeScript error in newer react-markdown versions
                code: ({node, className, children, ...props}: any) => {
                  const inline = props.inline;
                  if (inline) return <code className="bg-slate-100 px-1.5 py-0.5 rounded text-pink-700 font-mono text-[0.9em]" {...props}>{children}</code>;
                  return (
                    <pre className="bg-[#f8fafc] text-slate-800 p-5 rounded border border-slate-200 overflow-x-auto my-6 text-[0.85em] font-mono">
                      <code {...props}>{children}</code>
                    </pre>
                  );
                }
              }}
            >
              {markdown}
            </ReactMarkdown>
          </div>
          
          {/* 堆叠效果 - 模拟真实纸张 */}
          <div className="absolute top-1 left-1 -z-10 w-full h-full bg-slate-400 opacity-20 shadow-sm"></div>
          <div className="absolute top-2 left-2 -z-20 w-full h-full bg-slate-500 opacity-10 shadow-sm"></div>
        </div>
      </div>
    </div>
  );
};

export default WordPreview;
