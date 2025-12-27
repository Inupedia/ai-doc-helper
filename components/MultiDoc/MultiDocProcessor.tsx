
import React, { useState, useRef } from 'react';
import mammoth from 'mammoth';
import ReactMarkdown from 'react-markdown';
import { Document, Packer, Paragraph, TextRun } from 'docx';
import JSZip from 'jszip';
import { getModelConfig } from '../../utils/settings';
import { generateContent } from '../../utils/aiHelper';

type Mode = 'rename' | 'report';

interface FileItem {
  file: File;
  contentSnippet: string; // 提取的前1000个字符用于分析
  status: 'pending' | 'processing' | 'done' | 'error';
  newName?: string;
  reason?: string;
}

const DEFAULT_RENAME_PROMPT = `Analyze the provided file contents to extract key metadata: Date, Author, Assignment Batch (e.g., "First Assignment", "第X次作业"), and Topic/Content.
Goal: Rename these files exactly matching the target naming pattern provided.
Output: A JSON array of objects, each containing "originalName", "newName", and "reason".
Important: 
1. If the pattern includes "第X次作业", extract the specific number from the text (e.g., if text says "Third Assignment", output "第三次作业").
2. Format dates strictly according to the pattern (e.g., YYYYMMDD).
3. Extract the specific topic/content for the assignment.`;

const DEFAULT_REPORT_PROMPT = `You are a team leader assistant. 
Goal: Aggregate the following weekly reports into a single, cohesive team weekly report.

Requirements:
1. **Header**: Start by explicitly listing the names of all members who submitted a report (e.g., "Contributors: Name1, Name2...").
2. **Categorization**: Group the updates by technical domain (e.g., RL, CV, NLP, LLM Fine-tuning) rather than just listing by person.
3. **Structure**: Use clear Markdown headings for "Team Progress", "Key Learnings", and "Next Steps".
4. **Tone**: Professional and concise.
5. **Language**: The output report MUST be in the same language as the input contents (e.g., if inputs are Chinese, output Chinese; if mixed, default to Chinese).

Input: A list of report contents from different team members.`;

const MultiDocProcessor: React.FC = () => {
  const [mode, setMode] = useState<Mode>('rename');
  const [files, setFiles] = useState<FileItem[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [resultReport, setResultReport] = useState<string>('');
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Rename Pattern State
  const [renamePattern, setRenamePattern] = useState('');

  // Settings
  const [showSettings, setShowSettings] = useState(false);
  const [renamePrompt, setRenamePrompt] = useState(() => localStorage.getItem('prompt_rename') || DEFAULT_RENAME_PROMPT);
  const [reportPrompt, setReportPrompt] = useState(() => localStorage.getItem('prompt_report') || DEFAULT_REPORT_PROMPT);
  const [tempPrompt, setTempPrompt] = useState('');

  const config = getModelConfig('text');

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      const newFiles: FileItem[] = [];
      for (let i = 0; i < e.target.files.length; i++) {
        const file = e.target.files[i];
        let contentSnippet = '';
        
        try {
          if (file.name.endsWith('.docx')) {
            const arrayBuffer = await file.arrayBuffer();
            const result = await mammoth.extractRawText({ arrayBuffer });
            contentSnippet = result.value.substring(0, 2000); // 提取前2000字
          } else {
            const text = await file.text();
            contentSnippet = text.substring(0, 2000);
          }
        } catch (err) {
          console.error(`Error reading file ${file.name}`, err);
          contentSnippet = "(Error reading file content)";
        }

        newFiles.push({ file, contentSnippet, status: 'pending' });
      }
      setFiles(prev => [...prev, ...newFiles]);
    }
  };

  const createDocxBlob = async (text: string): Promise<Blob> => {
      const doc = new Document({
          sections: [{
              properties: {},
              children: text.split('\n').map(line => new Paragraph({
                  children: [new TextRun(line)],
              })),
          }],
      });
      return await Packer.toBlob(doc);
  };

  const loadSampleFiles = async () => {
    let samples = [];

    if (mode === 'rename') {
        // 重命名模式的示例数据
        samples = [
            { 
                name: "李四_2.docx", 
                text: "【实验报告】\n\n实验人：李四\n日期：2026年3月15日\n实验名称：物理光学干涉实验\n\n备注：这是本学期的第三次作业，请查收。" 
            },
            { 
                name: "draft_2025_wangwu.docx", 
                text: "【期末提交】\n汇报人：王五\n时间：2025/12/20\n作业批次：第八次作业\n作业主题：前端架构设计与Vue3迁移实践\n\n正文：..." 
            },
            { 
                name: "新建文本文档 (3).docx", 
                text: "课程：数据结构\n姓名：张三\n提交时间：2026-01-01\n内容：第一次作业 - 二叉树遍历算法\n\n代码如下..." 
            },
            { 
                name: "SCAN_0021.docx", 
                text: "作业提交单\n\n学生：赵六\n时间：05月20日\n频次：第五次作业\n内容：产品发布会策划方案" 
            },
            {
                name: "final_v2_resubmit.docx",
                text: "项目：AI助手开发进度汇报\n汇报人：钱七\n日期：2月10日\n内容：第七次作业 - 界面设计优化"
            }
        ];
        // 设置默认重命名格式
        setRenamePattern('20260101_张三_第一次作业_作业内容.docx');
    } else {
        // 周报整合模式的示例数据 (AI 算法学习小组)
        samples = [
            {
                name: "周报_萧炎.docx",
                text: "姓名：萧炎\n部门：强化学习组\n本周工作总结：\n1. 深入学习了强化学习算法基础。\n2. 重点研究了 PPO (Proximal Policy Optimization) 的数学推导与代码实现。\n3. 阅读了 DeepSeek 相关的技术报告，尝试复现 GRPO 算法在数学推理任务上的表现。\n\n下周计划：对比 PPO 与 GRPO 的显存占用情况。"
            },
            {
                name: "周报_林动.docx",
                text: "汇报人：林动\n岗位：CV算法工程师\n\n本周进度：\n- 专注于计算机视觉（CV）领域的经典算法复习。\n- 成功跑通了 YOLO v8 的目标检测 Demo。\n- 正在阅读 Mask R-CNN 的论文，准备将其应用于工业质检场景的实例分割任务。\n\n遇到的问题：Mask R-CNN 训练收敛速度较慢，正在排查原因。"
            },
            {
                name: "周报_牧尘.docx",
                text: "To: Team Leader\nFrom: 牧尘\nDate: 2024-10-24\n\nSubject: NLP 学习汇报\n\n本周主要精力投入在 NLP 基础架构上：\n1. 通读了 'Attention is all you need' 论文，彻底搞懂了 Transformer 的 Encoder-Decoder 架构。\n2. 深入研究了 BERT 模型的双向编码机制与 Masked LM 预训练任务。\n3. 尝试使用 HuggingFace Transformers 库加载 BERT 进行文本分类微调。"
            },
            {
                name: "周报_唐三.docx",
                text: "工作周报\n姓名：唐三\n方向：大模型微调 (LLM Fine-tuning)\n\n本周产出：\n- 学习了 SFT (Supervised Fine-Tuning) 的全流程数据准备。\n- 重点实践了 LoRA (Low-Rank Adaptation) 技术，通过向基座模型注入低秩矩阵，成功在单卡 3090 上完成了 7B 模型的微调。\n- 对比了全量微调与 LoRA 微调的效果差异，结论是 LoRA 性价比极高。"
            }
        ];
    }

    const newFiles: FileItem[] = [];

    // 动态生成真实的 DOCX 二进制流
    for (const s of samples) {
        const blob = await createDocxBlob(s.text);
        const file = new File([blob], s.name, { type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' });
        newFiles.push({
            file: file,
            contentSnippet: s.text, // 直接保存文本供 AI 分析
            status: 'pending'
        });
    }

    setFiles(newFiles);
  };

  const clearFiles = () => {
    setFiles([]);
    setResultReport('');
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const processRename = async () => {
    if (files.length === 0) return;
    setIsProcessing(true);

    try {
      const inputs = files.map(f => ({
        originalName: f.file.name,
        contentStart: f.contentSnippet.replace(/\n/g, ' ').substring(0, 500) // 压缩一下发给AI
      }));

      // Fallback if pattern is empty
      const effectivePattern = renamePattern || 'YYYY-MM-DD_作者_文件主题.ext';

      const prompt = `${renamePrompt}\n\nIMPORTANT: Use this Target Naming Pattern: "${effectivePattern}"\n\nFiles to process:\n${JSON.stringify(inputs, null, 2)}`;
      
      const response = await generateContent({
        apiKey: config.apiKey,
        model: config.model,
        baseUrl: config.baseUrl,
        prompt: prompt,
        jsonSchema: {
            type: "ARRAY", // Simple hint for generic models, schema object for Gemini
        }
      });

      // Try parse JSON
      let jsonStr = response.trim().replace(/```json|```/g, '');
      const mapping = JSON.parse(jsonStr); // Expect array

      if (Array.isArray(mapping)) {
        setFiles(prev => prev.map(f => {
          const match = mapping.find((m: any) => m.originalName === f.file.name);
          return match ? { ...f, newName: match.newName, reason: match.reason, status: 'done' } : f;
        }));
      }

    } catch (e) {
      console.error(e);
      alert("AI 处理失败，请检查 Prompt 或重试");
    } finally {
      setIsProcessing(false);
    }
  };

  const processReport = async () => {
    if (files.length === 0) return;
    setIsProcessing(true);

    try {
      const combinedContent = files.map((f, idx) => `--- Report ${idx + 1} (${f.file.name}) ---\n${f.contentSnippet}`).join('\n\n');
      const prompt = `${reportPrompt}\n\nReports Content:\n${combinedContent}`;

      const response = await generateContent({
        apiKey: config.apiKey,
        model: config.model,
        baseUrl: config.baseUrl,
        prompt: prompt
      });

      setResultReport(response);
      setFiles(prev => prev.map(f => ({ ...f, status: 'done' })));
    } catch (e) {
      console.error(e);
      alert("生成报告失败");
    } finally {
      setIsProcessing(false);
    }
  };

  const downloadRenameScript = () => {
    // Generate a simple shell script / batch file
    const isWin = navigator.platform.toLowerCase().includes('win');
    let content = isWin ? '@echo off\r\n' : '#!/bin/bash\n';
    
    files.forEach(f => {
      if (f.newName && f.newName !== f.file.name) {
        if (isWin) {
          content += `ren "${f.file.name}" "${f.newName}"\r\n`;
        } else {
          content += `mv "${f.file.name}" "${f.newName}"\n`;
        }
      }
    });

    const blob = new Blob([content], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = isWin ? 'rename_files.bat' : 'rename_files.sh';
    a.click();
  };

  // 单个文件下载功能（支持下载改名后的文件，或者下载原文件）
  const handleDownloadFile = (fileItem: FileItem) => {
    // 优先下载重命名后的文件，如果没有重命名，则下载原文件
    const fileName = (fileItem.status === 'done' && fileItem.newName) ? fileItem.newName : fileItem.file.name;
    const url = URL.createObjectURL(fileItem.file);
    const a = document.createElement('a');
    a.href = url;
    a.download = fileName;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  // 批量下载所有文件（ZIP）
  const handleDownloadAll = async () => {
      if (files.length === 0) return;
      
      const zip = new JSZip();
      
      files.forEach(f => {
          const fileName = (f.status === 'done' && f.newName) ? f.newName : f.file.name;
          zip.file(fileName, f.file);
      });
      
      const content = await zip.generateAsync({ type: "blob" });
      const url = URL.createObjectURL(content);
      const a = document.createElement('a');
      a.href = url;
      a.download = `renamed_files_${new Date().getTime()}.zip`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
  };

  const openSettings = () => {
      setTempPrompt(mode === 'rename' ? renamePrompt : reportPrompt);
      setShowSettings(true);
  };

  const saveSettings = () => {
      if (mode === 'rename') {
          setRenamePrompt(tempPrompt);
          localStorage.setItem('prompt_rename', tempPrompt);
      } else {
          setReportPrompt(tempPrompt);
          localStorage.setItem('prompt_report', tempPrompt);
      }
      setShowSettings(false);
  };

  return (
    <div className="p-6 lg:p-12 max-w-[1440px] mx-auto min-h-full flex flex-col">
      <div className="text-center mb-8">
        <h2 className="text-3xl font-extrabold text-slate-900 mb-2">多文档智能处理</h2>
        <p className="text-slate-500">批量命名整理 • 团队周报聚合</p>
      </div>

      <div className="flex justify-center mb-8">
        <div className="bg-slate-100 p-1 rounded-xl flex space-x-1">
          <button
            onClick={() => { setMode('rename'); clearFiles(); }}
            className={`px-6 py-2 rounded-lg text-sm font-bold transition-all ${mode === 'rename' ? 'bg-white text-[var(--primary-color)] shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
          >
            📂 智能重命名 (Rename)
          </button>
          <button
            onClick={() => { setMode('report'); clearFiles(); }}
            className={`px-6 py-2 rounded-lg text-sm font-bold transition-all ${mode === 'report' ? 'bg-white text-[var(--primary-color)] shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
          >
            📊 周报整合 (Aggregator)
          </button>
        </div>
      </div>

      <div className="flex-1 bg-white border border-slate-200 rounded-3xl p-8 shadow-sm flex flex-col min-h-[500px]">
        <div className="flex justify-between items-center mb-6">
            <div>
                <h3 className="text-xl font-bold text-slate-800">
                    {mode === 'rename' ? '文件批量重命名' : '多文档内容聚合'}
                </h3>
                <p className="text-sm text-slate-500 mt-1">
                    {mode === 'rename' ? '上传多个命名混乱的文件，AI 将根据内容自动生成规范文件名。' : '上传多个成员的周报/文档，AI 将提取关键信息生成汇总报告。'}
                </p>
            </div>
            <div className="flex space-x-3">
                 <button
                    onClick={openSettings}
                    className="flex items-center px-3 py-2 text-xs font-bold text-slate-500 bg-slate-50 hover:bg-slate-100 border border-slate-200 rounded-lg transition-colors"
                 >
                     <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /></svg>
                     配置 System Prompt
                 </button>
                 <button 
                    onClick={() => fileInputRef.current?.click()}
                    className="bg-[var(--primary-color)] hover:bg-[var(--primary-hover)] text-white px-4 py-2 rounded-lg text-sm font-bold shadow-md transition-all flex items-center"
                 >
                    <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" /></svg>
                    添加文件
                 </button>
                 <input 
                    type="file" 
                    multiple 
                    ref={fileInputRef} 
                    className="hidden" 
                    onChange={handleFileSelect}
                    accept=".docx,.txt,.md"
                 />
            </div>
        </div>

        {/* Rename Format Input */}
        {mode === 'rename' && (
            <div className="mb-6 bg-[var(--primary-50)] p-4 rounded-xl border border-[var(--primary-color)] border-opacity-30">
                <div className="flex flex-col md:flex-row md:items-center space-y-2 md:space-y-0 md:space-x-4">
                    <div className="flex items-center text-[var(--primary-color)] font-bold text-sm whitespace-nowrap">
                        <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A1.994 1.994 0 013 12V7a4 4 0 014-4z" /></svg>
                        目标格式参考:
                    </div>
                    <input
                        type="text"
                        value={renamePattern}
                        onChange={(e) => setRenamePattern(e.target.value)}
                        placeholder="例如: 20260101_张三_第一次作业_作业内容.docx"
                        className="flex-1 px-4 py-2 rounded-lg border border-[var(--primary-color)] border-opacity-40 bg-white text-sm focus:ring-2 focus:ring-[var(--primary-color)] outline-none text-slate-900 placeholder-slate-400"
                    />
                    <div className="text-xs text-[var(--primary-color)] opacity-70 font-medium whitespace-nowrap hidden lg:block">
                        * AI 将尝试分析内容并按此格式生成新文件名
                    </div>
                </div>
                {/* Sample Buttons */}
                <div className="mt-3 flex items-center md:pl-[125px] space-x-2 animate-in fade-in slide-in-from-left-2 duration-300">
                    <span className="text-[10px] text-[var(--primary-color)] opacity-70 font-bold uppercase tracking-wider">Try Sample:</span>
                    <button 
                        onClick={() => setRenamePattern('20260101_张三_第一次作业_作业内容.docx')}
                        className="text-xs bg-white border border-[var(--primary-color)] border-opacity-40 text-[var(--primary-color)] px-2.5 py-1 rounded-md hover:bg-[var(--primary-color)] hover:text-white hover:border-[var(--primary-color)] transition-all cursor-pointer font-mono shadow-sm"
                        title="点击填充此格式"
                    >
                        20260101_张三_第一次作业_作业内容.docx
                    </button>
                </div>
            </div>
        )}

        {/* File List Area */}
        {files.length > 0 && (
            <div className="mb-6 bg-slate-50 rounded-xl border border-slate-200 overflow-hidden">
                <div className="max-h-60 overflow-y-auto custom-scrollbar">
                    <table className="w-full text-left text-sm">
                        <thead className="bg-slate-100 text-slate-500 font-bold border-b border-slate-200">
                            <tr>
                                <th className="p-3 pl-4">原始文件名</th>
                                {mode === 'rename' && <th className="p-3">建议新文件名</th>}
                                {mode === 'rename' && <th className="p-3">重命名理由</th>}
                                <th className="p-3 text-right pr-4">操作</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-200">
                            {files.map((f, i) => (
                                <tr key={i} className="hover:bg-white transition-colors">
                                    <td className="p-3 pl-4 text-slate-700 font-mono truncate max-w-[200px]" title={f.file.name}>{f.file.name}</td>
                                    {mode === 'rename' && (
                                        <>
                                            <td className="p-3 text-[var(--primary-color)] font-bold font-mono truncate max-w-[250px]" title={f.newName || '-'}>{f.newName || '-'}</td>
                                            <td className="p-3 text-slate-500 text-xs">{f.reason || '-'}</td>
                                        </>
                                    )}
                                    <td className="p-3 text-right pr-4">
                                        <div className="flex items-center justify-end space-x-2">
                                            {f.status === 'done' && <span className="text-green-500 font-bold text-xs mr-2">完成</span>}
                                            {f.status === 'pending' && <span className="text-slate-400 text-xs mr-2">待处理</span>}
                                            {f.status === 'processing' && <span className="text-[var(--primary-color)] text-xs animate-pulse mr-2">分析中...</span>}
                                            
                                            {/* 单文件下载按钮 (总是显示，方便下载原文件或新文件) */}
                                            <button 
                                                onClick={() => handleDownloadFile(f)}
                                                className="p-1.5 text-[var(--primary-color)] hover:bg-[var(--primary-50)] rounded-md transition-colors"
                                                title={f.status === 'done' && f.newName ? `下载重命名文件: ${f.newName}` : "下载原始文件"}
                                            >
                                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a2 2 0 002 2h12a2 2 0 002-2v-1m-4-4l-4 4m0 0l-4-4m4 4V4" /></svg>
                                            </button>
                                        </div>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
                <div className="p-3 bg-slate-100 border-t border-slate-200 flex justify-between items-center">
                    <span className="text-xs text-slate-500 font-bold">{files.length} 个文件已加载</span>
                    <div className="flex space-x-3">
                         {files.length > 0 && (
                            <button onClick={handleDownloadAll} className="text-xs text-[var(--primary-color)] hover:text-[var(--primary-hover)] font-bold flex items-center">
                                <svg className="w-3 h-3 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a2 2 0 002 2h12a2 2 0 002-2v-1m-4-4l-4 4m0 0l-4-4m4 4V4" /></svg>
                                批量下载 (ZIP)
                            </button>
                         )}
                         <button onClick={clearFiles} className="text-xs text-red-400 hover:text-red-600 font-bold">清空列表</button>
                    </div>
                </div>
            </div>
        )}

        {/* Empty State */}
        {files.length === 0 && (
            <div className="flex-1 border-2 border-dashed border-slate-200 rounded-xl flex flex-col items-center justify-center text-slate-400 mb-6 group hover:border-[var(--primary-color)] hover:bg-[var(--primary-50)] transition-all">
                <div className="flex flex-col items-center justify-center cursor-pointer" onClick={() => fileInputRef.current?.click()}>
                    <svg className="w-12 h-12 mb-3 opacity-50 group-hover:text-[var(--primary-color)] group-hover:opacity-100 transition-all" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 13h6m-3-3v6m5 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>
                    <p className="mb-2">拖拽或点击上方按钮上传 .docx / .md / .txt 文件</p>
                </div>
                
                {/* Load Sample Button */}
                <button 
                    onClick={loadSampleFiles}
                    className="mt-4 flex items-center px-4 py-2 rounded-full bg-[var(--primary-50)] text-[var(--primary-color)] text-xs font-bold border border-[var(--primary-color)] border-opacity-30 hover:shadow-sm transition-all animate-in fade-in slide-in-from-bottom-2"
                >
                    <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19.428 15.428a2 2 0 00-1.022-.547l-2.384-.477a6 6 0 00-3.86.517l-.318.158a6 6 0 01-3.86.517L6.05 15.21a2 2 0 00-1.806.547M8 4h8l-1 1v5.172a2 2 0 00.586 1.414l5 5c1.26 1.26.367 3.414-1.415 3.414H4.828c-1.782 0-2.674-2.154-1.414-3.414l5-5A2 2 0 009 10.172V5L8 4z" /></svg>
                    {mode === 'rename' ? '加载重命名测试文件 (Samples)' : '加载周报测试文件 (Samples)'}
                </button>
            </div>
        )}

        {/* Action Area */}
        <div className="flex justify-center space-x-4 mb-8">
            <button
                onClick={mode === 'rename' ? processRename : processReport}
                disabled={files.length === 0 || isProcessing}
                className={`w-48 py-3 rounded-xl font-bold text-white shadow-lg transition-all ${
                    files.length === 0 || isProcessing 
                    ? 'bg-slate-300 cursor-not-allowed' 
                    : 'bg-[var(--primary-color)] hover:bg-[var(--primary-hover)] hover:scale-105'
                }`}
            >
                {isProcessing ? 'AI 处理中...' : (mode === 'rename' ? '开始生成文件名' : '开始合并周报')}
            </button>
            
            {mode === 'rename' && files.some(f => f.newName) && (
                <button
                    onClick={downloadRenameScript}
                    className="w-48 py-3 rounded-xl font-bold text-[var(--primary-color)] bg-[var(--primary-50)] border border-[var(--primary-color)] border-opacity-30 hover:bg-slate-100 transition-all flex items-center justify-center"
                >
                    <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a2 2 0 002 2h12a2 2 0 002-2v-1m-4-4l-4 4m0 0l-4-4m4 4V4" /></svg>
                    下载重命名脚本
                </button>
            )}
        </div>

        {/* Report Result Area */}
        {mode === 'report' && resultReport && (
            <div className="border-t border-slate-200 pt-6 animate-in slide-in-from-bottom-2">
                <h4 className="text-lg font-bold text-slate-800 mb-4">生成结果 (Generated Report)</h4>
                <div className="bg-slate-50 p-6 rounded-xl border border-slate-200 prose prose-slate max-w-none text-sm">
                    <ReactMarkdown>{resultReport}</ReactMarkdown>
                </div>
            </div>
        )}
      </div>

      {/* Settings Modal */}
      {showSettings && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/20 backdrop-blur-sm">
            <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl overflow-hidden animate-in zoom-in-95 duration-200 border border-slate-200">
                <div className="bg-slate-50 px-6 py-4 border-b border-slate-100 flex justify-between items-center">
                    <h3 className="font-bold text-slate-800 text-lg">
                        配置 Prompt ({mode === 'rename' ? '智能重命名' : '周报整合'})
                    </h3>
                    <button onClick={() => setShowSettings(false)} className="text-slate-400 hover:text-slate-600">
                        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                    </button>
                </div>
                <div className="p-6">
                    <p className="text-xs text-slate-500 mb-2">定义 AI 如何处理您的文件。保持明确的 Input/Output 指令效果最佳。</p>
                    <textarea 
                        className="w-full h-64 p-4 text-sm border border-slate-300 rounded-xl focus:ring-2 focus:ring-[var(--primary-color)] outline-none resize-none font-mono bg-slate-50 text-slate-700 leading-relaxed shadow-inner"
                        value={tempPrompt}
                        onChange={(e) => setTempPrompt(e.target.value)}
                    ></textarea>
                    
                    <div className="mt-6 flex justify-end space-x-3">
                        <button 
                            onClick={() => setShowSettings(false)}
                            className="px-5 py-2.5 text-sm font-bold text-slate-600 hover:bg-slate-100 rounded-xl transition-colors"
                        >
                            取消
                        </button>
                        <button 
                            onClick={saveSettings}
                            className="px-6 py-2.5 text-sm font-bold text-white bg-[var(--primary-color)] hover:bg-[var(--primary-hover)] rounded-xl shadow-lg"
                        >
                            保存配置
                        </button>
                    </div>
                </div>
            </div>
        </div>
      )}
    </div>
  );
};

export default MultiDocProcessor;
