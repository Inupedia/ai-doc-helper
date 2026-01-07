import React, { useState, useRef, useEffect } from 'react';
import mammoth from 'mammoth';
import ReactMarkdown from 'react-markdown';
import { Document, Packer, Paragraph, TextRun } from 'docx';
import JSZip from 'jszip';
import { getModelConfig } from '../../utils/settings';
import { generateContent, generateContentStream } from '../../utils/aiHelper';
import { Type } from '@google/genai';
import { downloadDocx } from '../../utils/converter';
import { WordTemplate } from '../../types';
import { addHistoryItem } from '../../utils/historyManager';

// PDF & Excel Imports
// Note: These libraries are loaded via <script> tags in index.html to expose global variables
declare const pdfjsLib: any;
declare const XLSX: any;

type Mode = 'deep_research' | 'report' | 'missing' | 'rename';

interface FileItem {
  file: File;
  contentSnippet: string; // 提取的前N个字符用于分析
  status: 'pending' | 'processing' | 'done' | 'error';
  newName?: string;
  reason?: string;
}

interface CheckResult {
  submitted: { name: string; fileName: string }[];
  missing: string[];
  extras: string[]; // 文件存在但不在名单中
}

interface ResearchTemplate {
    id: string;
    title: string;
    icon: string;
    prompt: string;
    isCustom?: boolean;
}

const RESEARCH_TEMPLATES: ResearchTemplate[] = [
    {
        id: 'paper',
        title: '论文精读 (Paper Reading)',
        icon: 'M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253',
        prompt: 'You are an academic research assistant. Please provide a detailed deep-dive reading report for the provided document(s).\nStructure:\n1. **Abstract & Core Contribution**: What is the main problem and solution?\n2. **Methodology**: Explain the technical approach in detail.\n3. **Experiments & Results**: Key metrics and comparison.\n4. **Critical Analysis**: Pros, cons, and limitations.\n5. **Future Work**: Potential research directions.\n\nKeep the tone academic and professional.'
    },
    {
        id: 'theory',
        title: '理论学习 (Theory Study)',
        icon: 'M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z',
        prompt: 'You are a professor. Please explain the theoretical concepts found in these documents.\n1. **Concept Definition**: Define key terms clearly.\n2. **Core Principles**: Explain the "Why" and "How" behind the theory.\n3. **Examples**: Provide analogies or simple examples to illustrate complex points.\n4. **Summary**: Key takeaways for a student.'
    },
    {
        id: 'code',
        title: '代码/功能分析 (Code Analysis)',
        icon: 'M10 20l4-16m4 4l4 4-4 4M6 16l-4-4 4-4',
        prompt: 'You are a senior software engineer. Analyze the provided code or technical design docs.\n1. **Architecture Overview**: High-level structure.\n2. **Key Functions**: Explain the most important classes/functions.\n3. **Logic Flow**: How data moves through the system.\n4. **Suggestions**: Potential improvements or bugs.'
    }
];

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

const DEFAULT_MISSING_PROMPT = `You are a teaching assistant checking homework submissions.
Goal: Compare the provided "Class Roster" against the list of "Submitted Files".

Rules:
1. **Fuzzy Match**: Match names even if the filename contains extra text (e.g., Roster: "ZhangSan", File: "Homework-ZhangSan-v2.docx" -> Match).
2. **Content Awareness**: If the filename is ambiguous, assume the "Snippet" content might contain the author's name.
3. **Categorize**:
   - "submitted": The name from the roster that was found in the files.
   - "missing": The name from the roster that was NOT found.
   - "extras": Filenames that do not match anyone in the roster.

Output strictly valid JSON with this structure:
{
  "submitted": [{"name": "RosterName", "fileName": "FileName"}],
  "missing": ["RosterName"],
  "extras": ["FileName"]
}`;

// Define mode-specific state type
interface ModeState {
  files: FileItem[];
  resultReport: string;
  checkResult: CheckResult | null;
  rosterText: string;
  renamePattern: string;
}

// Helper function to load mode state from localStorage
const loadModeState = (mode: Mode): ModeState => {
  const loadFiles = (): FileItem[] => {
    try {
      const saved = localStorage.getItem(`multidoc_${mode}_files`);
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  };

  const loadResultReport = (): string => {
    // Try new format first
    const newFormat = localStorage.getItem(`multidoc_${mode}_result_report`);
    if (newFormat) {
      try {
        return newFormat;
      } catch {
        return '';
      }
    }
    // Fallback to old format
    try {
      const oldFormat = localStorage.getItem('multidoc_result_report');
      if (oldFormat) {
        const reports = JSON.parse(oldFormat);
        return typeof reports === 'string' ? oldFormat : (reports[mode] || '');
      }
    } catch {
      return '';
    }
    return '';
  };

  const loadCheckResult = (): CheckResult | null => {
    try {
      const saved = localStorage.getItem(`multidoc_${mode}_check_result`);
      return saved ? JSON.parse(saved) : null;
    } catch {
      return null;
    }
  };

  const loadRosterText = (): string => {
    // Try new format first
    const newFormat = localStorage.getItem(`multidoc_${mode}_roster_text`);
    if (newFormat !== null) {
      return newFormat;
    }
    // Fallback to old format only for missing mode
    if (mode === 'missing') {
      const oldFormat = localStorage.getItem('multidoc_roster_text');
      return oldFormat || '';
    }
    return '';
  };

  const loadRenamePattern = (): string => {
    // Try new format first
    const newFormat = localStorage.getItem(`multidoc_${mode}_rename_pattern`);
    if (newFormat !== null) {
      return newFormat;
    }
    // Fallback to old format only for rename mode
    if (mode === 'rename') {
      const oldFormat = localStorage.getItem('multidoc_rename_pattern');
      return oldFormat || '';
    }
    return '';
  };

  return {
    files: loadFiles(),
    resultReport: loadResultReport(),
    checkResult: loadCheckResult(),
    rosterText: loadRosterText(),
    renamePattern: loadRenamePattern()
  };
};

const MultiDocProcessor: React.FC = () => {
  const [mode, setMode] = useState<Mode>(() => {
    const saved = localStorage.getItem('multidoc_mode');
    return (saved as Mode) || 'rename';
  });
  
  // Global state (shared across all modes)
  const [isProcessing, setIsProcessing] = useState(false);
  const [processingStatus, setProcessingStatus] = useState<'preparing' | 'analyzing' | 'streaming' | 'completed' | null>(null);
  const [progressText, setProgressText] = useState<string>('');
  const [shouldStop, setShouldStop] = useState(false);
  const [isDragOver, setIsDragOver] = useState(false);
  
  // Mode-specific state
  const [modeStates, setModeStates] = useState<Record<Mode, ModeState>>(() => {
    const initialStates: Record<Mode, ModeState> = {
      deep_research: loadModeState('deep_research'),
      report: loadModeState('report'),
      missing: loadModeState('missing'),
      rename: loadModeState('rename')
    };
    return initialStates;
  });
  
  // Research Mode
  const [templates, setTemplates] = useState<ResearchTemplate[]>(RESEARCH_TEMPLATES);
  const [activeTemplate, setActiveTemplate] = useState<ResearchTemplate>(() => {
    const saved = localStorage.getItem('multidoc_active_template');
    if (saved) {
      try {
        return JSON.parse(saved);
      } catch (e) {
        return RESEARCH_TEMPLATES[0];
      }
    }
    return RESEARCH_TEMPLATES[0];
  });
  const [customPrompt, setCustomPrompt] = useState(() => {
    const saved = localStorage.getItem('multidoc_custom_prompt');
    return saved || RESEARCH_TEMPLATES[0].prompt;
  });
  
  // Custom Template Creation
  const [isCreatingTemplate, setIsCreatingTemplate] = useState(false);
  const [newTemplateTitle, setNewTemplateTitle] = useState('');
  const [newTemplatePrompt, setNewTemplatePrompt] = useState('');
  const [isOptimizingTemplatePrompt, setIsOptimizingTemplatePrompt] = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const rosterInputRef = useRef<HTMLInputElement>(null);

  // Settings
  const [showSettings, setShowSettings] = useState(false);
  const [renamePrompt, setRenamePrompt] = useState(() => localStorage.getItem('prompt_rename') || DEFAULT_RENAME_PROMPT);
  const [reportPrompt, setReportPrompt] = useState(() => localStorage.getItem('prompt_report') || DEFAULT_REPORT_PROMPT);
  const [missingPrompt, setMissingPrompt] = useState(() => localStorage.getItem('prompt_missing') || DEFAULT_MISSING_PROMPT);
  
  const [tempPrompt, setTempPrompt] = useState('');

  const config = getModelConfig('text');

  // Helper functions to get/set current mode state
  const getCurrentFiles = () => modeStates[mode].files;
  const setCurrentFiles = (files: FileItem[] | ((prev: FileItem[]) => FileItem[])) => {
    setModeStates(prev => ({
      ...prev,
      [mode]: {
        ...prev[mode],
        files: typeof files === 'function' ? files(prev[mode].files) : files
      }
    }));
  };

  const getCurrentResultReport = () => modeStates[mode].resultReport;
  const setCurrentResultReport = (report: string) => {
    setModeStates(prev => ({
      ...prev,
      [mode]: {
        ...prev[mode],
        resultReport: report
      }
    }));
  };

  const getCurrentCheckResult = () => modeStates[mode].checkResult;
  const setCurrentCheckResult = (result: CheckResult | null) => {
    setModeStates(prev => ({
      ...prev,
      [mode]: {
        ...prev[mode],
        checkResult: result
      }
    }));
  };

  const getCurrentRosterText = () => modeStates[mode].rosterText;
  const setCurrentRosterText = (text: string) => {
    setModeStates(prev => ({
      ...prev,
      [mode]: {
        ...prev[mode],
        rosterText: text
      }
    }));
  };

  const getCurrentRenamePattern = () => modeStates[mode].renamePattern;
  const setCurrentRenamePattern = (pattern: string) => {
    setModeStates(prev => ({
      ...prev,
      [mode]: {
        ...prev[mode],
        renamePattern: pattern
      }
    }));
  };

  // Save mode to localStorage when it changes
  useEffect(() => {
    localStorage.setItem('multidoc_mode', mode);
  }, [mode]);

  // Save mode-specific states to localStorage
  useEffect(() => {
    // Save files
    localStorage.setItem(`multidoc_${mode}_files`, JSON.stringify(modeStates[mode].files));
  }, [mode, modeStates[mode].files]);

  useEffect(() => {
    // Save result report
    localStorage.setItem(`multidoc_${mode}_result_report`, modeStates[mode].resultReport);
  }, [mode, modeStates[mode].resultReport]);

  useEffect(() => {
    // Save check result
    if (modeStates[mode].checkResult) {
      localStorage.setItem(`multidoc_${mode}_check_result`, JSON.stringify(modeStates[mode].checkResult));
    }
  }, [mode, modeStates[mode].checkResult]);

  useEffect(() => {
    // Save roster text
    localStorage.setItem(`multidoc_${mode}_roster_text`, modeStates[mode].rosterText);
  }, [mode, modeStates[mode].rosterText]);

  useEffect(() => {
    // Save rename pattern
    localStorage.setItem(`multidoc_${mode}_rename_pattern`, modeStates[mode].renamePattern);
  }, [mode, modeStates[mode].renamePattern]);

  // Clear current mode state when switching modes (similar to OCR mode)
  useEffect(() => {
    // Clear files, results, and check results when switching modes
    // Each mode should have its own independent state
  }, [mode]);

  // Save active template to localStorage
  useEffect(() => {
    localStorage.setItem('multidoc_active_template', JSON.stringify(activeTemplate));
  }, [activeTemplate]);

  // Save custom prompt to localStorage
  useEffect(() => {
    localStorage.setItem('multidoc_custom_prompt', customPrompt);
  }, [customPrompt]);

  // Load Custom Templates on Mount
  useEffect(() => {
    const savedTemplates = localStorage.getItem('custom_research_templates');
    if (savedTemplates) {
        try {
            const parsed = JSON.parse(savedTemplates);
            setTemplates([...RESEARCH_TEMPLATES, ...parsed]);
        } catch (e) {
            console.error("Failed to load custom templates", e);
        }
    }
  }, []);

  const handleCreateTemplate = () => {
      if (!newTemplateTitle.trim() || !newTemplatePrompt.trim()) {
          alert("请输入标题和 Prompt");
          return;
      }
      const newTpl: ResearchTemplate = {
          id: `custom-${Date.now()}`,
          title: newTemplateTitle.trim(),
          prompt: newTemplatePrompt.trim(),
          icon: 'M19.428 15.428a2 2 0 00-1.022-.547l-2.384-.477a6 6 0 00-3.86.517l-.318.158a6 6 0 01-3.86.517L6.05 15.21a2 2 0 00-1.806.547M8 4h8l-1 1v5.172a2 2 0 00.586 1.414l5 5c1.26 1.26.367 3.414-1.415 3.414H4.828c-1.782 0-2.674-2.154-1.414-3.414l5-5A2 2 0 009 10.172V5L8 4z',
          isCustom: true
      };
      const updatedTemplates = [...templates, newTpl];
      setTemplates(updatedTemplates);
      localStorage.setItem('custom_research_templates', JSON.stringify(updatedTemplates.filter(t => t.isCustom)));
      
      setIsCreatingTemplate(false);
      setNewTemplateTitle('');
      setNewTemplatePrompt('');
      
      // Auto select
      setActiveTemplate(newTpl);
      setCustomPrompt(newTpl.prompt);
 };

 const optimizeTemplatePrompt = async () => {
     if (!newTemplateTitle.trim()) {
         alert('请先输入功能名称');
         return;
     }
     
     const config = getModelConfig('text');
     if (!config.apiKey) {
         alert('请先在右上角用户中心配置 API Key');
         return;
     }

     setIsOptimizingTemplatePrompt(true);
     
     try {
         const contextPrompt = `Please help me create a professional AI prompt for a multi-document research tool.

Template Name: "${newTemplateTitle}"
${newTemplatePrompt.trim() ? `User's partial idea: "${newTemplatePrompt}"` : ''}

Requirements for prompt:
1. It should tell AI to analyze and synthesize information from multiple uploaded documents
2. Should generate comprehensive, well-structured markdown reports
3. Should highlight key findings, comparisons, and insights
4. Should maintain academic/professional tone
5. Should support various document types (PDF, Word, Excel, code, etc.)
6. Language preference: ${newTemplateTitle.includes('中文') || newTemplateTitle.includes('翻译') ? 'Use Chinese where appropriate' : 'Use English'}

Please respond with ONLY complete prompt text, nothing else.`;

         const stream = generateContentStream({
             apiKey: config.apiKey,
             model: config.model,
             baseUrl: config.baseUrl,
             prompt: contextPrompt
         });

         let generatedPrompt = '';
         for await (const chunk of stream) {
             generatedPrompt += chunk;
             setNewTemplatePrompt(generatedPrompt);
         }

     } catch (err) {
         console.error('AI Optimization Error:', err);
         alert('AI 优化失败，请检查配置或网络连接。');
     } finally {
         setIsOptimizingTemplatePrompt(false);
     }
 };

 const handleDeleteTemplate = (id: string, e: React.MouseEvent) => {
     e.stopPropagation();
     if (!confirm("确定要删除这个自定义模板吗？")) return;

      const updatedTemplates = templates.filter(t => t.id !== id);
      setTemplates(updatedTemplates);
      localStorage.setItem('custom_research_templates', JSON.stringify(updatedTemplates.filter(t => t.isCustom)));

      if (activeTemplate.id === id) {
          setActiveTemplate(updatedTemplates[0]);
          setCustomPrompt(updatedTemplates[0].prompt);
      }
  };

  // Unified File Parsing Logic
  const parseFile = async (file: File): Promise<string> => {
      try {
          if (file.name.endsWith('.docx')) {
            const arrayBuffer = await file.arrayBuffer();
            const result = await mammoth.extractRawText({ arrayBuffer });
            return result.value;
          } else if (file.name.endsWith('.pdf')) {
             if (typeof pdfjsLib === 'undefined') return "[Error: PDF parser not loaded. Please ensure scripts are loaded.]";
             
             // Setup worker manually if using CDN import without bundler
             if (!pdfjsLib.GlobalWorkerOptions.workerSrc) {
                 pdfjsLib.GlobalWorkerOptions.workerSrc = `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js`;
             }

             const arrayBuffer = await file.arrayBuffer();
             const loadingTask = pdfjsLib.getDocument({ data: arrayBuffer });
             const pdf = await loadingTask.promise;
             let fullText = '';
             // Limit to first 15 pages to avoid OOM on client side for large docs
             const maxPages = Math.min(pdf.numPages, 15); 
             for (let i = 1; i <= maxPages; i++) {
                 const page = await pdf.getPage(i);
                 const textContent = await page.getTextContent();
                 const pageText = textContent.items.map((item: any) => item.str).join(' ');
                 fullText += `--- Page ${i} ---\n${pageText}\n`;
             }
             return fullText;
          } else if (file.name.endsWith('.xlsx') || file.name.endsWith('.xls')) {
             if (typeof XLSX === 'undefined') return "[Error: Excel parser not loaded]";
             const arrayBuffer = await file.arrayBuffer();
             const workbook = XLSX.read(arrayBuffer);
             let fullText = '';
             workbook.SheetNames.forEach((sheetName: string) => {
                 const sheet = workbook.Sheets[sheetName];
                 // Sheet to CSV is token efficient
                 const csv = XLSX.utils.sheet_to_csv(sheet);
                 fullText += `--- Sheet: ${sheetName} ---\n${csv}\n`;
             });
             return fullText;
          } else {
            // Treat as text (txt, md, py, js, etc.)
            return await file.text();
          }
      } catch (err) {
          console.error("Parse Error", err);
          return `[Error parsing file: ${file.name}]`;
      }
  };

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement> | DataTransfer) => {
    const isChangeEvent = 'target' in e;
    const fileList = isChangeEvent ? (e as React.ChangeEvent<HTMLInputElement>).target?.files : (e as DataTransfer).files;
    if (fileList) {
      const newFiles: FileItem[] = [];
      const isDeepResearch = mode === 'deep_research';

      for (let i = 0; i < fileList.length; i++) {
        const file = fileList[i];
        
        // Parse content
        const content = await parseFile(file);
        
        // Truncate based on mode
        // Deep research needs more context (e.g. 50k chars), others just need a snippet (1k chars)
        const limit = isDeepResearch ? 50000 : 1000;
        const snippet = content.substring(0, limit);

        newFiles.push({ file, contentSnippet: snippet, status: 'pending' });
      }
      setCurrentFiles(prev => [...prev, ...newFiles]);
    }
    if (isChangeEvent) {
      (e as React.ChangeEvent<HTMLInputElement>).target.value = '';
    }
  };
  
  // Drag and Drop Handlers
  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(true);
  };
  
  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
  };
  
  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      handleFileSelect(e.dataTransfer);
    }
  };

  const handleRosterImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (!file) return;
      try {
          const text = await parseFile(file);
          const cleanList = text.split(/\r?\n/).map(l => l.trim()).filter(l => l).join('\n');
          setCurrentRosterText(cleanList);
      } catch (err) {
          alert('读取名单失败，请重试');
      }
      if (e.target) e.target.value = '';
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
    let samples: any[] = [];
    
    // 清除旧数据
    setCurrentFiles([]);
    setCurrentResultReport('');
    setCurrentCheckResult(null);

    if (mode === 'rename') {
        samples = [
            { name: "李四_2.docx", text: "【实验报告】\n\n实验人：李四\n日期：2026年3月15日\n实验名称：物理光学干涉实验\n\n备注：这是本学期的第三次作业，请查收。" },
            { name: "draft_2025_wangwu.docx", text: "【期末提交】\n汇报人：王五\n时间：2025/12/20\n作业批次：第八次作业\n作业主题：前端架构设计与Vue3迁移实践\n\n正文：..." },
            { name: "新建文本文档 (3).docx", text: "课程：数据结构\n姓名：张三\n提交时间：2026-01-01\n内容：第一次作业 - 二叉树遍历算法\n\n代码如下..." },
            { name: "final_v2_resubmit.docx", text: "姓名：赵六\nDate: 2025.11.11\nSubject: 数据库系统原理\nBatch: 第五次作业\n\nSQL优化实验报告..." },
            { name: "20240909_unknown.docx", text: "学生：陈七\n提交日期：2024年9月9日\n作业：第二次作业\n题目：操作系统进程调度\n\n..." }
        ];
        setCurrentRenamePattern('20260101_张三_第一次作业_作业内容.docx');
    } else if (mode === 'report') {
        samples = [
            { name: "周报_萧炎.docx", text: "姓名：萧炎\n部门：强化学习组\n本周工作总结：\n1. 深入学习了强化学习算法基础。\n2. 重点研究了 PPO 算法的超参数调优。\n\n下周计划：\n- 在仿真环境中测试新模型。" },
            { name: "周报_林动.docx", text: "汇报人：林动\n岗位：CV算法工程师\n\n本周进度：\n- 专注于计算机视觉（CV）领域的经典算法复习。\n- 完成了 YOLOv8 的部署测试。\n\n遇到的问题：\n- 显存占用过高，需优化。" },
            { name: "周报_牧尘.docx", text: "姓名：牧尘\n组别：NLP组\n\n本周产出：\n1. 完成了 BERT 模型的微调实验。\n2. 阅读了 3 篇关于 RAG (检索增强生成) 的最新论文。\n\n下周重点：\n- 搭建本地知识库问答系统。" },
            { name: "周报_罗峰.docx", text: "汇报人：罗峰\n部门：大模型训练\n\n工作内容：\n- 监控 7B 模型预训练进度，Loss 收敛正常。\n- 清洗了 100GB 的高质量代码数据集。\n\n风险：\n- 算力资源紧张，需申请更多 GPU。" }
        ];
    } else if (mode === 'missing') {
        // 设置一个花名册
        setCurrentRosterText("孙悟空\n猪八戒\n沙悟净\n唐三藏\n白龙马");
        
        // 模拟提交的文件
        samples = [
            { name: "作业_孙悟空.docx", text: "这是孙悟空的作业。" },
            { name: "八戒的检讨书.docx", text: "检讨人：猪八戒\n内容：我错了..." },
            { name: "卷帘大将_报告.docx", text: "姓名：沙悟净\n职务：卷帘大将\n汇报..." },
            { name: "UNKNOWN_FILE.docx", text: "没有写名字的神秘文件..." }
        ];
    } else if (mode === 'deep_research') {
        // Deep Research Samples - Based on Active Template
        if (activeTemplate.id === 'paper') {
            samples = [
                { name: "Paper_Attention_Is_All_You_Need.txt", text: "Abstract\nThe dominant sequence transduction models are based on complex recurrent or convolutional neural networks that include an encoder and a decoder. The best performing models also connect the encoder and decoder through an attention mechanism. We propose a new simple network architecture, the Transformer, based solely on attention mechanisms, dispensing with recurrence and convolutions entirely..." },
                { name: "Notes_Transformer_Arch.txt", text: "Self-Attention Mechanism:\nQueries, Keys, Values.\nScaled Dot-Product Attention = softmax(QK^T / sqrt(d_k))V.\nMulti-Head Attention allows the model to jointly attend to information from different representation subspaces." }
            ];
        } else if (activeTemplate.id === 'theory') {
             samples = [
                { name: "Quantum_Mechanics_Intro.txt", text: "The Schrödinger equation is a linear partial differential equation that governs the wave function of a quantum-mechanical system.\n\nConcept 1: Wave-Particle Duality\nEvery particle or quantum entity may be described as either a particle or a wave." },
                { name: "Relativity_Notes.docx", text: "Special relativity is a theory of the structure of spacetime. It was introduced in Einstein's 1905 paper 'On the Electrodynamics of Moving Bodies'." }
            ];
        } else if (activeTemplate.id === 'code') {
             samples = [
                { name: "attention.py", text: "import torch\nimport torch.nn as nn\nimport torch.nn.functional as F\n\nclass MultiHeadAttention(nn.Module):\n    def __init__(self, d_model, num_heads):\n        super().__init__()\n        assert d_model % num_heads == 0\n        self.d_model = d_model\n        self.num_heads = num_heads\n        self.d_k = d_model // num_heads\n        \n        self.W_q = nn.Linear(d_model, d_model)\n        self.W_k = nn.Linear(d_model, d_model)\n        self.W_v = nn.Linear(d_model, d_model)\n        self.W_o = nn.Linear(d_model, d_model)\n    \n    def scaled_dot_product_attention(self, Q, K, V, mask=None):\n        attn_scores = torch.matmul(Q, K.transpose(-2, -1)) / torch.sqrt(torch.tensor(self.d_k, dtype=torch.float32))\n        if mask is not None:\n            attn_scores = attn_scores.masked_fill(mask == 0, -1e9)\n        attn_probs = F.softmax(attn_scores, dim=-1)\n        output = torch.matmul(attn_probs, V)\n        return output\n    \n    def forward(self, x, mask=None):\n        batch_size = x.size(0)\n        Q = self.W_q(x).view(batch_size, -1, self.num_heads, self.d_k).transpose(1, 2)\n        K = self.W_k(x).view(batch_size, -1, self.num_heads, self.d_k).transpose(1, 2)\n        V = self.W_v(x).view(batch_size, -1, self.num_heads, self.d_k).transpose(1, 2)\n        \n        attn_output = self.scaled_dot_product_attention(Q, K, V, mask)\n        attn_output = attn_output.transpose(1, 2).contiguous().view(batch_size, -1, self.d_model)\n        return self.W_o(attn_output)" },
                { name: "transformer.py", text: "import torch\nimport torch.nn as nn\n\nclass FeedForward(nn.Module):\n    def __init__(self, d_model, d_ff, dropout=0.1):\n        super().__init__()\n        self.linear1 = nn.Linear(d_model, d_ff)\n        self.dropout = nn.Dropout(dropout)\n        self.linear2 = nn.Linear(d_ff, d_model)\n    \n    def forward(self, x):\n        return self.linear2(self.dropout(F.relu(self.linear1(x))))\n\nclass TransformerBlock(nn.Module):\n    def __init__(self, d_model, num_heads, d_ff, dropout=0.1):\n        super().__init__()\n        self.attention = MultiHeadAttention(d_model, num_heads)\n        self.norm1 = nn.LayerNorm(d_model)\n        self.norm2 = nn.LayerNorm(d_model)\n        self.feed_forward = FeedForward(d_model, d_ff, dropout)\n        self.dropout = nn.Dropout(dropout)\n    \n    def forward(self, x, mask=None):\n        attn_output = self.attention(x, mask)\n        x = self.norm1(x + self.dropout(attn_output))\n        ff_output = self.feed_forward(x)\n        x = self.norm2(x + self.dropout(ff_output))\n        return x\n\nclass Transformer(nn.Module):\n    def __init__(self, vocab_size, d_model=512, num_heads=8, \n                 num_layers=6, d_ff=2048, max_seq_len=512):\n        super().__init__()\n        self.token_embedding = nn.Embedding(vocab_size, d_model)\n        self.pos_embedding = nn.Embedding(max_seq_len, d_model)\n        self.layers = nn.ModuleList([\n            TransformerBlock(d_model, num_heads, d_ff) \n            for _ in range(num_layers)\n        ])\n        self.dropout = nn.Dropout(0.1)\n    \n    def forward(self, x, mask=None):\n        seq_len = x.size(1)\n        positions = torch.arange(0, seq_len, dtype=torch.long, device=x.device)\n        x = self.token_embedding(x) + self.pos_embedding(positions)\n        x = self.dropout(x)\n        for layer in self.layers:\n            x = layer(x, mask)\n        return x" }
            ];
        } else {
            // Custom or default
             samples = [
                { name: "Research_Material_1.txt", text: "This is a sample document for research analysis." },
                { name: "Research_Material_2.txt", text: "Additional context and data points for the topic." }
            ];
        }
    }

    const newFiles: FileItem[] = [];
    for (const s of samples) {
        let blob;
        // If name implies docx, create docx blob, otherwise text/plain
        if (s.name.endsWith('.docx')) {
            blob = await createDocxBlob(s.text);
        } else {
            blob = new Blob([s.text], { type: 'text/plain' });
        }
        
        // Infer mime type
        const type = s.name.endsWith('.docx') 
            ? 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' 
            : 'text/plain';

        const file = new File([blob], s.name, { type });
        
        newFiles.push({
            file: file,
            contentSnippet: s.text,
            status: 'pending'
        });
    }
    setCurrentFiles(newFiles);
  };

  const clearFiles = () => {
    setCurrentFiles([]);
    // Note: Don't clear other modes' states here
    // Each mode tracks its own state independently
    if (fileInputRef.current) fileInputRef.current.value = '';
  };
  
  const clearCurrentModeResults = () => {
    // Clear results for current mode only
    setCurrentResultReport('');
    if (mode === 'missing') {
      setCurrentCheckResult(null);
      setCurrentRosterText('');
    }
    setProgressText('');
    setProcessingStatus(null);
  };
  
  const saveToHistory = (currentMode: Mode, result: string) => {
    // 使用新的统一历史记录系统
    const currentFiles = getCurrentFiles();
    const currentRosterText = getCurrentRosterText();
    addHistoryItem({
      module: 'multidoc',
      status: 'success',
      title: currentMode === 'rename' ? `智能重命名 - ${currentFiles.length} 个文件` :
             currentMode === 'report' ? `周报聚合 - ${currentFiles.length} 个报告` :
             currentMode === 'deep_research' ? `深度调研 - ${activeTemplate.title}` :
             `作业核对 - ${currentRosterText.split('\n').filter(l => l.trim()).length} 人名单`,
      preview: result.slice(0, 200) + (result.length > 200 ? '...' : ''),
      fullResult: result,
      metadata: {
        docMode: currentMode,
        fileCount: currentFiles.length
      }
    });
  };

  // --- Process Functions ---

  const processRename = async () => {
    const currentFiles = getCurrentFiles();
    if (currentFiles.length === 0) return;
    setIsProcessing(true);
    try {
      const inputs = currentFiles.map(f => ({
        originalName: f.file.name,
        contentStart: f.contentSnippet.replace(/\n/g, ' ').substring(0, 500)
      }));
      const effectivePattern = getCurrentRenamePattern() || 'YYYY-MM-DD_作者_文件主题.ext';
      const prompt = `${renamePrompt}\n\nIMPORTANT: Use this Target Naming Pattern: "${effectivePattern}"\n\nFiles to process:\n${JSON.stringify(inputs, null, 2)}`;
      
      // 🐛 调试：打印完整的 Prompt
      console.log('=== 智能重命名 Prompt ===');
      console.log(prompt);
      
      const response = await generateContent({
        apiKey: config.apiKey,
        model: config.model,
        baseUrl: config.baseUrl,
        prompt: prompt,
        jsonSchema: { type: Type.ARRAY }
      });
      
      // 🐛 调试：打印 AI 原始响应（前500字符）
      const truncatedRawResponse = response.substring(0, 500);
      console.log('=== AI 原始响应（前500字符） ===');
      console.log(truncatedRawResponse);
      
      let jsonStr = response.trim().replace(/```json|```/g, '');
      
      // 🐛 调试：打印 AI 响应的完整长度
      console.log('=== AI 响应完整长度 ===');
      console.log(response.length);
      
      // 🐛 调试：打印清理后的 JSON 字符串
      console.log('=== 清理后的 JSON 字符串（移除 ```json 标记） ===');
      console.log(jsonStr);
      
      let mapping;
      
      // 健壮的JSON解析
      try {
        mapping = JSON.parse(jsonStr);
        
        // 🐛 调试：打印解析成功
        console.log('=== JSON 解析成功 ===');
        console.log('解析对象类型:', typeof mapping, '是否为数组:', Array.isArray(mapping));
        console.log('解析结果详情:', JSON.stringify(mapping, null, 2));
        
      } catch (parseError) {
        // 🐛 调试：打印解析失败
        console.log('=== JSON 解析失败 ===');
        console.log('错误信息:', parseError.message);
        console.log('尝试的 JSON 字符串:', jsonStr);
        throw new Error(`AI返回格式错误: ${parseError.message}`);
      }

      // 验证返回数据格式
      console.log('=== 开始验证返回数据格式 ===');
      
      // AI 可能返回 { files: [...] } 或直接返回 [...]
      if (!Array.isArray(mapping) && mapping.files && Array.isArray(mapping.files)) {
        console.log('检测到包含 files 字段的对象，提取 files 数组');
        mapping = mapping.files;
      }
      
      if (!Array.isArray(mapping)) {
        console.error('❌ 错误：AI返回的不是数组');
        throw new Error(`AI返回格式错误: 期望数组格式，实际收到 ${typeof mapping}`);
      }
      
      console.log('✓ 数组验证通过，数组长度:', mapping.length);
      
      console.log('✓ 数组验证通过，数组长度:', mapping.length);
      
      // 验证数组内容
      let validCount = 0;
      const validMapping = mapping.filter((m: any) => {
        const hasName = m.originalName && typeof m.originalName === 'string';
        const hasNewName = m.newName && typeof m.newName === 'string';
        const hasReason = m.reason && typeof m.reason === 'string';
        const isValid = hasName && hasNewName && hasReason;
        
        if (isValid) {
          // 🐛 调试：打印每个元素的验证结果
          console.log(`元素 ${validCount + 1}:`, JSON.stringify(m, null, 2));
          validCount++;
        }
        
        return isValid;
      });
      
      console.log('✓ 有效的重命名结果数量:', validMapping.length);

      if (validMapping.length === 0) {
        throw new Error('AI返回的数据中没有任何有效的重命名结果');
      }

      console.log('AI返回的有效重命名结果:', validMapping);

      setCurrentFiles(prev => prev.map(f => {
        const match = validMapping.find((m: any) => m && m.originalName === f.file.name);
        
        // 🐛 调试：打印每个文件的匹配结果
        console.log(`正在处理文件: ${f.file.name}`);
        console.log('AI原始名称:', f.file.name);
        if (match) {
          console.log(`✅ 找到匹配，新名称: ${match.newName}`);
          console.log('  理由:', match.reason);
        } else {
          console.warn('⚠️ 文件未找到匹配');
        }
        
        return match ? { ...f, newName: match.newName, reason: match.reason, status: 'done' } : f;
      }));
      
      const renamedCount = validMapping.length;
      
      // 保存到统一历史记录
      addHistoryItem({
        module: 'multidoc',
        status: 'success',
        title: `智能重命名 - ${currentFiles.length} 个文件 (成功 ${renamedCount} 个)`,
        preview: validMapping.slice(0, 3).map((m: any) => `${m.originalName} → ${m.newName}`).join('\n') + (validMapping.length > 3 ? '\n...' : ''),
        fullResult: JSON.stringify(validMapping),
        metadata: {
          docMode: 'rename',
          fileCount: currentFiles.length,
          renamedCount: renamedCount,
          failedCount: currentFiles.length - renamedCount
        }
      });
    } catch (e) {
      console.error(e);
      alert("AI 处理失败，请检查 Prompt 或重试");
    } finally {
      setIsProcessing(false);
    }
  };

  const processReport = async () => {
    const currentFiles = getCurrentFiles();
    if (currentFiles.length === 0) return;
    setIsProcessing(true);
    setShouldStop(false);
    setCurrentResultReport('');
    setProcessingStatus('preparing');
    setProgressText(`📚 正在准备 ${currentFiles.length} 个文件...`);
    
    try {
      setProcessingStatus('analyzing');
      setProgressText(`🔍 正在分析 ${currentFiles.length} 个文件内容...`);
      
      // Simulate file analysis progress
      for (let i = 0; i < currentFiles.length; i++) {
        if (shouldStop) {
          setProcessingStatus('completed');
          setProgressText('');
          setIsProcessing(false);
          return;
        }
        setCurrentFiles(prev => prev.map((f, idx) => idx === i ? { ...f, status: 'processing' } : f));
        await new Promise(resolve => setTimeout(resolve, 300)); // Small delay for UI update
      }
      
      const combinedContent = currentFiles.map((f, idx) => `--- Report ${idx + 1} (${f.file.name}) ---\n${f.contentSnippet}`).join('\n\n');
      const prompt = `${reportPrompt}\n\nReports Content:\n${combinedContent}`;
      
      setProcessingStatus('streaming');
      setProgressText('✍️ AI 正在生成周报内容...');
      
      // Use streaming for real-time output
      const stream = generateContentStream({
        apiKey: config.apiKey,
        model: config.model,
        baseUrl: config.baseUrl,
        prompt: prompt
      });
      
      let fullText = '';
      for await (const chunk of stream) {
        if (shouldStop) {
          setProgressText('⏸️ 已停止生成');
          setProcessingStatus('completed');
          setIsProcessing(false);
          return;
        }
        fullText += chunk;
        setCurrentResultReport(fullText);
      }
      
      setCurrentFiles(prev => prev.map(f => ({ ...f, status: 'done' })));
      setProcessingStatus('completed');
      setProgressText('✅ 周报生成完成！');
      
      // Save to history
      saveToHistory('report', fullText);
      
      setTimeout(() => {
        setProcessingStatus(null);
        setProgressText('');
      }, 3000);
    } catch (e) {
      console.error(e);
      setProgressText('❌ 生成失败，请重试');
      setProcessingStatus('completed');
      setTimeout(() => {
        setProcessingStatus(null);
        setProgressText('');
      }, 3000);
    } finally {
      setIsProcessing(false);
    }
  };

  const processCheckMissing = async () => {
      const currentFiles = getCurrentFiles();
      const currentRosterText = getCurrentRosterText();
      if (currentFiles.length === 0 || !currentRosterText.trim()) {
          alert("请确保已输入应交名单并上传了文件。");
          return;
      }
      setIsProcessing(true);
      setCurrentCheckResult(null);

      try {
          const rosterList = currentRosterText.split(/\n|,|，/).map(s => s.trim()).filter(s => s);
          const fileInputs = currentFiles.map(f => ({
              fileName: f.file.name,
              snippet: f.contentSnippet.replace(/\n/g, ' ').substring(0, 200)
          }));

          const prompt = `${missingPrompt}\n\nClass Roster:\n${JSON.stringify(rosterList)}\n\nSubmitted Files:\n${JSON.stringify(fileInputs)}`;

          const response = await generateContent({
            apiKey: config.apiKey,
            model: config.model,
            baseUrl: config.baseUrl,
            prompt: prompt,
            jsonSchema: {
                type: Type.OBJECT,
                properties: {
                    submitted: { type: Type.ARRAY },
                    missing: { type: Type.ARRAY },
                    extras: { type: Type.ARRAY }
                }
            }
          });

          let jsonStr = response.trim().replace(/```json|```/g, '');
          const result = JSON.parse(jsonStr);
          setCurrentCheckResult(result);
          setCurrentFiles(prev => prev.map(f => ({ ...f, status: 'done' })));
          
          // 保存到统一历史记录
          addHistoryItem({
            module: 'multidoc',
            status: 'success',
            title: `作业核对 - ${getCurrentRosterText().split('\n').filter(l => l.trim()).length} 人名单`,
            preview: `已提交: ${result.submitted.length} 人, 未交: ${result.missing.length} 人`,
            fullResult: JSON.stringify(result),
            metadata: {
              docMode: 'missing',
              fileCount: currentFiles.length
            }
          });

      } catch (e) {
          console.error(e);
          alert("AI 核对失败，请检查网络或配置。");
      } finally {
          setIsProcessing(false);
      }
  };

  const processDeepResearch = async () => {
      const currentFiles = getCurrentFiles();
      if (currentFiles.length === 0) return;
      setIsProcessing(true);
      setShouldStop(false);
      setCurrentResultReport('');
      setProcessingStatus('preparing');
      setProgressText(`📚 正在准备 ${currentFiles.length} 个文档...`);
      
      try {
          setProcessingStatus('analyzing');
          setProgressText(`🔍 正在深度分析 ${currentFiles.length} 个文档...`);
          
          // Simulate file analysis progress
          for (let i = 0; i < currentFiles.length; i++) {
              if (shouldStop) {
                  setProcessingStatus('completed');
                  setProgressText('');
                  setIsProcessing(false);
                  return;
              }
              setCurrentFiles(prev => prev.map((f, idx) => idx === i ? { ...f, status: 'processing' } : f));
              await new Promise(resolve => setTimeout(resolve, 300)); // Small delay for UI update
          }
          
          // Combine all file contents
          let combinedDocs = '';
          currentFiles.forEach((f, i) => {
              combinedDocs += `\n\n=== DOCUMENT ${i+1}: ${f.file.name} ===\n${f.contentSnippet}\n`;
          });

          const prompt = `${customPrompt}\n\nDocuments to Analyze:\n${combinedDocs}`;
          
          setProcessingStatus('streaming');
          setProgressText('✍️ AI 正在生成深度研究报告...');
          
          // Use streaming for real-time output
          const stream = generateContentStream({
              apiKey: config.apiKey,
              model: config.model,
              baseUrl: config.baseUrl,
              prompt: prompt
          });
          
          let fullText = '';
          for await (const chunk of stream) {
              if (shouldStop) {
                  setProgressText('⏸️ 已停止生成');
                  setProcessingStatus('completed');
                  setIsProcessing(false);
                  return;
              }
              fullText += chunk;
              setCurrentResultReport(fullText);
          }
          
          setCurrentFiles(prev => prev.map(f => ({ ...f, status: 'done' })));
          setProcessingStatus('completed');
          setProgressText('✅ 深度调研完成！');
          
          // Save to history
          saveToHistory('deep_research', fullText);
          
          setTimeout(() => {
              setProcessingStatus(null);
              setProgressText('');
          }, 3000);

      } catch (e) {
          console.error(e);
          setProgressText('❌ 生成失败，请检查文档大小或 API 配额。');
          setProcessingStatus('completed');
          setTimeout(() => {
              setProcessingStatus(null);
              setProgressText('');
          }, 3000);
      } finally {
          setIsProcessing(false);
      }
  };

  // --- Downloads ---

  const handleDownloadFile = (fileItem: FileItem) => {
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

  const handleDownloadAll = async () => {
      const currentFiles = getCurrentFiles();
      if (currentFiles.length === 0) return;
      const zip = new JSZip();
      let hasFiles = false;
      currentFiles.forEach(f => {
          if (f.file) {
              const fileName = (f.status === 'done' && f.newName) ? f.newName : f.file.name;
              zip.file(fileName, f.file);
              hasFiles = true;
          }
      });
      if (!hasFiles) return;
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

  const handleDownloadReport = async () => {
      const currentReport = getCurrentResultReport();
      if (!currentReport) return;
      // Deep Research 默认使用学术模板，普通周报使用标准模板
      const tpl = mode === 'deep_research' ? WordTemplate.ACADEMIC : WordTemplate.STANDARD;
      await downloadDocx(currentReport, tpl);
  };

  const openSettings = () => {
      if (mode === 'rename') setTempPrompt(renamePrompt);
      else if (mode === 'report') setTempPrompt(reportPrompt);
      else if (mode === 'missing') setTempPrompt(missingPrompt);
      else setTempPrompt(customPrompt); // Deep research custom prompt
      setShowSettings(true);
  };

  const saveSettings = () => {
      if (mode === 'rename') {
          setRenamePrompt(tempPrompt);
          localStorage.setItem('prompt_rename', tempPrompt);
      } else if (mode === 'report') {
          setReportPrompt(tempPrompt);
          localStorage.setItem('prompt_report', tempPrompt);
      } else if (mode === 'missing') {
          setMissingPrompt(tempPrompt);
          localStorage.setItem('prompt_missing', tempPrompt);
      } else {
          // For deep research, we update the current active template's prompt locally in state if needed, 
          // but usually 'customPrompt' tracks the prompt for the current session/template.
          // If it's a custom template, we might want to persist it.
          setCustomPrompt(tempPrompt);
          // If it is a custom template, update it in storage
          if (activeTemplate.isCustom) {
               const updatedTemplates = templates.map(t => t.id === activeTemplate.id ? { ...t, prompt: tempPrompt } : t);
               setTemplates(updatedTemplates);
               localStorage.setItem('custom_research_templates', JSON.stringify(updatedTemplates.filter(t => t.isCustom)));
          }
      }
      setShowSettings(false);
  };

  const getActionName = () => {
      if (mode === 'rename') return '开始生成文件名';
      if (mode === 'report') return '开始合并周报';
      if (mode === 'deep_research') return '生成深度报告';
      return '开始核对名单';
  };

  const runProcess = () => {
      if (mode === 'rename') processRename();
      else if (mode === 'report') processReport();
      else if (mode === 'deep_research') processDeepResearch();
      else processCheckMissing();
  };

  return (
    <div className="p-6 lg:p-12 max-w-[1440px] mx-auto min-h-full flex flex-col">
      <div className="text-center mb-8">
        <h2 className="text-3xl font-extrabold text-slate-900 mb-2">多文档智能处理</h2>
        <p className="text-slate-500">批量命名整理 • 团队周报聚合 • Deep Research 深度分析</p>
      </div>

      {/* Mode Switcher */}
      <div className="flex justify-center mb-8 overflow-x-auto">
        <div className="bg-slate-100 p-1 rounded-xl flex space-x-1 shadow-inner shrink-0">
           <button
            onClick={() => { setMode('deep_research'); clearFiles(); }}
            className={`px-4 py-2 rounded-lg text-sm font-bold transition-all whitespace-nowrap flex items-center ${mode === 'deep_research' ? 'bg-gradient-to-r from-purple-500 to-indigo-500 text-white shadow-md' : 'text-slate-500 hover:text-slate-700'}`}
          >
            <svg className="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19.428 15.428a2 2 0 00-1.022-.547l-2.384-.477a6 6 0 00-3.86.517l-.318.158a6 6 0 01-3.86.517L6.05 15.21a2 2 0 00-1.806.547M8 4h8l-1 1v5.172a2 2 0 00.586 1.414l5 5c1.26 1.26.367 3.414-1.415 3.414H4.828c-1.782 0-2.674-2.154-1.414-3.414l5-5A2 2 0 009 10.172V5L8 4z" /></svg>
            Deep Research
          </button>
          <button
            onClick={() => { setMode('report'); clearFiles(); }}
            className={`px-4 py-2 rounded-lg text-sm font-bold transition-all whitespace-nowrap ${mode === 'report' ? 'bg-white text-[var(--primary-color)] shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
          >
            📊 周报整合
          </button>
          <button
            onClick={() => { setMode('missing'); clearFiles(); }}
            className={`px-4 py-2 rounded-lg text-sm font-bold transition-all whitespace-nowrap ${mode === 'missing' ? 'bg-white text-rose-500 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
          >
            📋 查缺补漏
          </button>
          <button
            onClick={() => { setMode('rename'); clearFiles(); }}
            className={`px-4 py-2 rounded-lg text-sm font-bold transition-all whitespace-nowrap ${mode === 'rename' ? 'bg-white text-[var(--primary-color)] shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
          >
            📂 智能重命名
          </button>
        </div>
      </div>

      <div className="flex-1 bg-white border border-slate-200 rounded-3xl p-6 lg:p-8 shadow-sm flex flex-col min-h-[500px]">
        
        {/* Header Section */}
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-6 gap-4">
            <div>
                <h3 className="text-xl font-bold text-slate-800">
                    {mode === 'rename' ? '文件批量重命名' : mode === 'report' ? '多文档内容聚合' : mode === 'deep_research' ? '深度文档调研' : '作业提交核对'}
                </h3>
                <p className="text-sm text-slate-500 mt-1">
                    {mode === 'rename' && '上传多个命名混乱的文件，AI 将根据内容自动生成规范文件名。'}
                    {mode === 'report' && '上传多个成员的周报/文档，AI 将提取关键信息生成汇总报告。'}
                    {mode === 'missing' && '输入应交名单并上传文件，AI 自动核对谁还没交作业。'}
                    {mode === 'deep_research' && '支持 PDF/Word/Excel/代码，智能生成学术级调研报告或分析文档。'}
                </p>
            </div>
            <div className="flex space-x-3 w-full md:w-auto flex-wrap gap-y-2">
                 <button
                    onClick={openSettings}
                    className="flex-1 md:flex-none flex items-center justify-center px-3 py-2 text-xs font-bold text-slate-500 bg-slate-50 hover:bg-slate-100 border border-slate-200 rounded-lg transition-colors"
                 >
                     <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /></svg>
                     配置 Prompt
                 </button>
                 <button
                    onClick={() => fileInputRef.current?.click()}
                    className="flex-1 md:flex-none bg-[var(--primary-color)] hover:bg-[var(--primary-hover)] text-white px-4 py-2 rounded-lg text-sm font-bold shadow-md transition-all flex items-center justify-center"
                 >
                     <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" /></svg>
                     添加文件
                 </button>
                 <input type="file" multiple ref={fileInputRef} className="hidden" onChange={handleFileSelect} accept={mode === 'deep_research' ? ".pdf,.docx,.xlsx,.xls,.txt,.md,.py,.js,.java,.c,.cpp" : ".docx,.txt,.md"} />
            </div>
        </div>

        <div className="flex flex-col lg:flex-row gap-6">
            
            {/* Left/Top Area: Inputs */}
            <div className={`flex-1 flex flex-col ${mode === 'missing' ? 'lg:w-1/3 lg:flex-none' : 'w-full'}`}>
                
                {/* 1. Deep Research: Template Selection */}
                {mode === 'deep_research' && (
                    <div className="mb-6">
                        <div className="grid grid-cols-3 gap-3">
                            {templates.map(t => (
                                <button
                                    key={t.id}
                                    onClick={() => {
                                        setActiveTemplate(t);
                                        setCustomPrompt(t.prompt);
                                        // In deep_research mode, preserve resultReport when switching templates
                                        // Only clear progress and status
                                        if (mode === 'deep_research') {
                                            setProgressText('');
                                            setProcessingStatus(null);
                                        } else {
                                            clearCurrentModeResults();
                                        }
                                    }}
                                    className={`relative flex flex-col items-center justify-center p-3 rounded-xl border transition-all ${activeTemplate.id === t.id ? 'bg-purple-50 border-purple-500 text-purple-700 ring-1 ring-purple-500' : 'bg-slate-50 border-slate-200 hover:bg-slate-100 text-slate-500'}`}
                                >
                                    <svg className="w-6 h-6 mb-2" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d={t.icon} /></svg>
                                    <span className="text-xs font-bold text-center">{t.title}</span>
                                    
                                    {t.isCustom && (
                                        <div 
                                            onClick={(e) => handleDeleteTemplate(t.id, e)}
                                            className="absolute top-1 right-1 text-slate-300 hover:text-red-500 p-1"
                                        >
                                            <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                                        </div>
                                    )}
                                </button>
                            ))}
                            {/* Create New Template Button */}
                            <button
                                onClick={() => setIsCreatingTemplate(true)}
                                className="flex flex-col items-center justify-center p-3 rounded-xl border border-dashed border-slate-300 bg-white text-slate-400 hover:border-[var(--primary-color)] hover:text-[var(--primary-color)] hover:bg-[var(--primary-50)] transition-all"
                            >
                                <svg className="w-6 h-6 mb-2" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" /></svg>
                                <span className="text-xs font-bold">新建功能...</span>
                            </button>
                        </div>
                    </div>
                )}

                {/* 2. Missing Mode: Roster Input */}
                {mode === 'missing' && (
                    <div className="mb-6 bg-rose-50 p-4 rounded-xl border border-rose-100 flex-1 flex flex-col">
                        <div className="flex justify-between items-center mb-2">
                            <label className="text-xs font-bold text-rose-600 uppercase tracking-wider">📋 应交名单 (Roster)</label>
                            <button 
                                onClick={() => rosterInputRef.current?.click()}
                                className="text-[10px] bg-white border border-rose-200 text-rose-500 px-2 py-1 rounded hover:bg-rose-100 font-bold transition-colors"
                            >
                                📂 导入名单文档
                            </button>
                            <input type="file" ref={rosterInputRef} className="hidden" onChange={handleRosterImport} accept=".txt,.docx" />
                        </div>
                        <textarea
                            value={getCurrentRosterText()}
                            onChange={(e) => setCurrentRosterText(e.target.value)}
                            placeholder={"张三\n李四\n王五\n..."}
                            className="w-full flex-1 min-h-[150px] lg:min-h-0 p-3 rounded-lg border border-rose-200 text-sm focus:ring-2 focus:ring-rose-500 outline-none resize-none bg-white text-slate-700"
                        />
                        <p className="text-[10px] text-rose-400 mt-2">* 每行一个名字，支持从 Word/Txt 导入</p>
                    </div>
                )}

                {/* 3. Rename Mode: Format Input */}
                {mode === 'rename' && (
                    <div className="mb-6 bg-[var(--primary-50)] p-4 rounded-xl border border-[var(--primary-color)] border-opacity-30">
                        <div className="flex flex-col space-y-2">
                            <div className="flex items-center text-[var(--primary-color)] font-bold text-sm">
                                <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A1.994 1.994 0 013 12V7a4 4 0 014-4z" /></svg>
                                目标格式参考:
                            </div>
                            <input
                                type="text"
                                value={getCurrentRenamePattern()}
                                onChange={(e) => setCurrentRenamePattern(e.target.value)}
                                placeholder="例如: 20260101_张三_第一次作业_作业内容.docx"
                                className="w-full px-4 py-2 rounded-lg border border-[var(--primary-color)] border-opacity-40 bg-white text-sm focus:ring-2 focus:ring-[var(--primary-color)] outline-none text-slate-900"
                            />
                            {/* Sample Pill */}
                            <div className="pt-1">
                                <button
                                    onClick={() => setCurrentRenamePattern('20260101_张三_第一次作业_作业内容.docx')}
                                    className="text-[10px] bg-white border border-[var(--primary-color)] border-opacity-40 text-[var(--primary-color)] px-2 py-0.5 rounded hover:bg-[var(--primary-color)] hover:text-white transition-all"
                                >
                                    填充示例: 20260101_张三...
                                </button>
                            </div>
                        </div>
                    </div>
                )}

                {/* 4. File List Area */}
                {getCurrentFiles().length > 0 ? (
                    <div className="bg-slate-50 rounded-xl border border-slate-200 overflow-hidden flex-1 flex flex-col">
                        <div className="p-3 bg-slate-100 border-b border-slate-200 font-bold text-xs text-slate-500 flex justify-between">
                            <span>已上传文件 ({getCurrentFiles().length})</span>
                            <button onClick={clearFiles} className="text-red-400 hover:text-red-600">清空</button>
                        </div>
                        <div className="overflow-y-auto custom-scrollbar max-h-[300px] lg:max-h-[400px]">
                            <ul className="divide-y divide-slate-200">
                                {getCurrentFiles().map((f, i) => (
                                    <li key={i} className="p-3 flex justify-between items-center hover:bg-white text-sm">
                                        <div className="truncate pr-4 flex-1">
                                            <div className="text-slate-700 font-mono truncate" title={f.file.name}>{f.file.name}</div>
                                            {mode === 'rename' && f.newName && (
                                                <div className="text-[var(--primary-color)] font-bold font-mono text-xs mt-0.5 truncate">➜ {f.newName}</div>
                                            )}
                                        </div>
                                        <div className="flex items-center space-x-2">
                                            {f.status === 'done' && <span className="text-green-500 text-xs">✔</span>}
                                            {f.status === 'processing' && <span className="text-[var(--primary-color)] text-xs animate-pulse">...</span>}
                                            <button onClick={() => handleDownloadFile(f)} className="text-slate-400 hover:text-[var(--primary-color)]"><svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a2 2 0 002 2h12a2 2 0 002-2v-1m-4-4l-4 4m0 0l-4-4m4 4V4" /></svg></button>
                                        </div>
                                    </li>
                                ))}
                            </ul>
                        </div>
                    </div>
                ) : (
                    // Empty State with Drag & Drop
                    <div
                        className={`flex-1 border-2 border-dashed rounded-xl flex flex-col items-center justify-center text-slate-400 min-h-[200px] group transition-all relative ${
                            isDragOver
                                ? 'border-[var(--primary-color)] bg-[var(--primary-50)]'
                                : 'border-slate-200 hover:border-[var(--primary-color)] hover:bg-[var(--primary-50)]'
                        }`}
                        onDragOver={handleDragOver}
                        onDragLeave={handleDragLeave}
                        onDrop={handleDrop}
                    >
                         <div className="absolute inset-0 cursor-pointer" onClick={() => fileInputRef.current?.click()}></div>
                         <svg className="w-10 h-10 mb-2 opacity-50 group-hover:text-[var(--primary-color)] transition-colors" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                             <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
                         </svg>
                         <span className="text-xs">点击或拖拽上传文件 {mode === 'deep_research' ? '(支持 PDF, Docx, Excel, Code)' : ''}</span>
                        
                        {isDragOver && (
                            <div className="absolute inset-0 flex items-center justify-center bg-[var(--primary-color)]/10 backdrop-blur-sm z-10">
                                <span className="text-lg font-bold text-[var(--primary-color)]">释放即可上传 📥</span>
                            </div>
                        )}
                         
                         <button
                            onClick={(e) => { e.stopPropagation(); loadSampleFiles(); }}
                            className="mt-4 px-3 py-1.5 rounded-full bg-white text-[var(--primary-color)] text-xs font-bold border border-[var(--primary-color)] hover:bg-[var(--primary-color)] hover:text-white transition-all relative z-10"
                        >
                            加载测试数据 (Samples)
                        </button>
                    </div>
                )}
                
                {/* Progress Bar */}
                {processingStatus && (
                    <div className="mb-4 p-4 rounded-xl bg-gradient-to-r from-blue-50 to-indigo-50 border border-blue-100 animate-in slide-in-from-bottom-2 duration-300">
                        <div className="flex items-center justify-between">
                            <div className="flex items-center space-x-3">
                                {processingStatus === 'preparing' && (
                                    <div className="w-6 h-6 border-2 border-blue-400 border-t-transparent rounded-full animate-spin"></div>
                                )}
                                {processingStatus === 'analyzing' && (
                                    <svg className="w-6 h-6 text-blue-500 animate-pulse" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" /></svg>
                                )}
                                {processingStatus === 'streaming' && (
                                    <svg className="w-6 h-6 text-green-500 animate-bounce" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" /></svg>
                                )}
                                <span className="text-sm font-bold text-slate-700">{progressText}</span>
                            </div>
                            <button
                                onClick={() => setShouldStop(true)}
                                className="px-3 py-1.5 bg-red-100 hover:bg-red-200 border border-red-300 text-red-600 text-xs font-bold rounded-lg transition-colors flex items-center"
                            >
                                <svg className="w-3 h-3 mr-1.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 10a1 1 0 011-1h4a1 1 0 011 1v4a1 1 0 01-1 1h-4a1 1 0 01-1-1v-4z" /></svg>
                                停止
                            </button>
                        </div>
                    </div>
                )}

                {/* Action Button */}
                <div className="mt-6">
                    <button
                        onClick={runProcess}
                        disabled={getCurrentFiles().length === 0 || isProcessing || (mode === 'missing' && !getCurrentRosterText().trim())}
                        className={`w-full py-3 rounded-xl font-bold text-white shadow-lg transition-all ${
                            getCurrentFiles().length === 0 || isProcessing || (mode === 'missing' && !getCurrentRosterText().trim())
                            ? 'bg-slate-300 cursor-not-allowed'
                            : mode === 'deep_research' ? 'bg-gradient-to-r from-purple-600 to-indigo-600 hover:scale-105'
                            : 'bg-[var(--primary-color)] hover:bg-[var(--primary-hover)] hover:scale-105'
                        }`}
                    >
                        {isProcessing ? 'AI 正在处理...' : getActionName()}
                    </button>

                    {mode === 'rename' && getCurrentFiles().some(f => f.status === 'done') && (
                        <button
                            onClick={handleDownloadAll}
                            className="w-full mt-3 py-3 rounded-xl font-bold text-[var(--primary-color)] bg-[var(--primary-50)] border border-[var(--primary-color)] hover:bg-[var(--primary-color)] hover:text-white transition-all flex items-center justify-center shadow-sm"
                        >
                            <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a2 2 0 002 2h12a2 2 0 002-2v-1m-4-4l-4 4m0 0l-4-4m4 4V4" /></svg>
                            📥 打包下载所有文件 (ZIP)
                        </button>
                    )}
                </div>

            </div>

            {/* Right/Bottom Area: Results */}
            {(mode === 'missing' || mode === 'report' || mode === 'deep_research') && (
                <div className="flex-[2] flex flex-col min-h-[400px]">
                    {mode === 'missing' && (
                        <div className="h-full bg-white border border-slate-200 rounded-xl overflow-hidden flex flex-col shadow-sm">
                            <div className="bg-slate-50 px-4 py-3 border-b border-slate-200 flex justify-between items-center">
                                <h4 className="font-bold text-slate-700">核对结果 (Check Result)</h4>
                                {getCurrentCheckResult() && (
                                    <div className="text-xs space-x-2">
                                        <span className="text-green-600 font-bold">已交: {getCurrentCheckResult()!.submitted.length}</span>
                                        <span className="text-red-500 font-bold">未交: {getCurrentCheckResult()!.missing.length}</span>
                                    </div>
                                )}
                            </div>
                            
                            {!getCurrentCheckResult() ? (
                                <div className="flex-1 flex flex-col items-center justify-center text-slate-300">
                                    <svg className="w-16 h-16 mb-4 opacity-20" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                                    <p className="text-sm">点击左侧"开始核对名单"查看结果</p>
                                </div>
                            ) : (
                                <div className="flex-1 overflow-y-auto p-4 grid grid-cols-1 md:grid-cols-2 gap-4">
                                    {/* Missing Column */}
                                    <div className="border border-red-100 bg-red-50/50 rounded-xl overflow-hidden flex flex-col">
                                        <div className="bg-red-100/80 px-4 py-2 text-red-700 font-bold text-xs uppercase tracking-wide flex justify-between">
                                            <span>❌ 未交人员 ({getCurrentCheckResult()!.missing.length})</span>
                                        </div>
                                        <div className="p-3 overflow-y-auto max-h-[300px] custom-scrollbar">
                                            {getCurrentCheckResult()!.missing.length === 0 ? (
                                                <div className="text-green-500 text-sm text-center py-4">全员已交！🎉</div>
                                            ) : (
                                                <ul className="space-y-1">
                                                    {getCurrentCheckResult()!.missing.map((name, idx) => (
                                                        <li key={idx} className="bg-white border border-red-100 px-3 py-2 rounded text-red-600 font-bold text-sm shadow-sm">
                                                            {name}
                                                        </li>
                                                    ))}
                                                </ul>
                                            )}
                                        </div>
                                    </div>

                                    {/* Submitted Column */}
                                    <div className="border border-green-100 bg-green-50/50 rounded-xl overflow-hidden flex flex-col">
                                        <div className="bg-green-100/80 px-4 py-2 text-green-700 font-bold text-xs uppercase tracking-wide flex justify-between">
                                            <span>✅ 已交人员 ({getCurrentCheckResult()!.submitted.length})</span>
                                        </div>
                                        <div className="p-3 overflow-y-auto max-h-[300px] custom-scrollbar">
                                            <ul className="space-y-2">
                                                {getCurrentCheckResult()!.submitted.map((item, idx) => (
                                                    <li key={idx} className="bg-white border border-green-100 px-3 py-2 rounded text-slate-700 text-sm shadow-sm">
                                                        <span className="font-bold text-green-700 block">{item.name}</span>
                                                        <span className="text-[10px] text-slate-400 block truncate" title={item.fileName}>📄 {item.fileName}</span>
                                                    </li>
                                                ))}
                                            </ul>
                                        </div>
                                    </div>

                                    {/* Extras Column */}
                                    {getCurrentCheckResult()!.extras.length > 0 && (
                                        <div className="md:col-span-2 border border-slate-200 bg-slate-50 rounded-xl overflow-hidden mt-2">
                                            <div className="bg-slate-200/50 px-4 py-2 text-slate-600 font-bold text-xs uppercase tracking-wide">
                                                ❓ 未知文件 / 无法匹配 ({getCurrentCheckResult()!.extras.length})
                                            </div>
                                            <div className="p-3">
                                                 <div className="flex flex-wrap gap-2">
                                                    {getCurrentCheckResult()!.extras.map((name, idx) => (
                                                        <span key={idx} className="px-2 py-1 bg-white border border-slate-300 rounded text-xs text-slate-500 truncate max-w-[200px]" title={name}>
                                                            {name}
                                                        </span>
                                                    ))}
                                                 </div>
                                            </div>
                                        </div>
                                    )}
                                </div>
                            )}
                        </div>
                    )}

                    {(mode === 'report' || mode === 'deep_research') && getCurrentResultReport() && (
                        <div className="h-full bg-white border border-slate-200 rounded-xl overflow-hidden flex flex-col shadow-sm">
                             <div className="bg-slate-50 px-4 py-3 border-b border-slate-200 flex justify-between items-center">
                                 <h4 className="font-bold text-slate-700">{mode === 'deep_research' ? '深度调研报告' : '周报汇总'}</h4>
                                 <button 
                                    onClick={handleDownloadReport}
                                    className="text-xs bg-white border border-slate-300 hover:border-[var(--primary-color)] hover:text-[var(--primary-color)] px-3 py-1.5 rounded-lg font-bold transition-all shadow-sm flex items-center"
                                 >
                                     <svg className="w-3.5 h-3.5 mr-1.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a2 2 0 002 2h12a2 2 0 002-2v-1m-4-4l-4 4m0 0l-4-4m4 4V4" /></svg>
                                     导出 Word
                                 </button>
                             </div>
                             <div className="flex-1 p-6 overflow-y-auto custom-scrollbar bg-slate-50">
                                 <div className="prose prose-slate max-w-none text-sm bg-white p-6 rounded-xl shadow-sm border border-slate-100">
                                    <ReactMarkdown>{getCurrentResultReport()}</ReactMarkdown>
                               </div>
                            </div>
                        </div>
                    )}
                     
                    {(mode === 'report' || mode === 'deep_research') && !getCurrentResultReport() && (
                         <div className="h-full flex flex-col items-center justify-center text-slate-300 border border-slate-200 border-dashed rounded-xl">
                            <svg className="w-16 h-16 mb-4 opacity-20" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 17v-2m3 2v-4m3 4v-6m2 10H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>
                            <p className="text-sm">生成的报告将显示在这里</p>
                        </div>
                    )}
                </div>
            )}
        </div>

      </div>

      {/* Settings Modal (Reused for Config) */}
      {showSettings && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/20 backdrop-blur-sm">
            <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl overflow-hidden animate-in zoom-in-95 duration-200 border border-slate-200">
                <div className="bg-slate-50 px-6 py-4 border-b border-slate-100 flex justify-between items-center">
                    <h3 className="font-bold text-slate-800 text-lg">
                        配置 Prompt ({mode === 'rename' ? '智能重命名' : mode === 'report' ? '周报整合' : mode === 'deep_research' ? '深度调研' : '名单核对'})
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

     {/* Create Template Modal */}
      {isCreatingTemplate && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/20 backdrop-blur-sm">
            <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg overflow-hidden animate-in zoom-in-95 duration-200 border border-slate-200">
                <div className="bg-slate-50 px-6 py-4 border-b border-slate-100 flex justify-between items-center">
                    <h3 className="font-bold text-slate-800 text-lg">新建调研功能</h3>
                    <button onClick={() => setIsCreatingTemplate(false)} className="text-slate-400 hover:text-slate-600">
                        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                    </button>
                </div>
                <div className="p-6 space-y-4">
                    <div>
                        <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">功能名称</label>
                        <input 
                            type="text"
                            className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:ring-2 focus:ring-[var(--primary-color)] focus:border-transparent outline-none bg-white"
                            placeholder="例如：财报分析"
                            value={newTemplateTitle}
                            onChange={(e) => setNewTemplateTitle(e.target.value)}
                        />
                    </div>
                    <div>
                        <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">指令</label>
                        <textarea 
                            className="w-full h-40 p-3 text-sm border border-slate-300 rounded-lg focus:ring-2 focus:ring-[var(--primary-color)] focus:border-transparent outline-none resize-none font-mono bg-slate-50 text-slate-700"
                            placeholder="告诉 AI 应该如何分析上传的文档..."
                            value={newTemplatePrompt}
                            onChange={(e) => setNewTemplatePrompt(e.target.value)}
                        ></textarea>
                        
                        {/* AI 优化按钮 */}
                        <button
                            onClick={optimizeTemplatePrompt}
                            disabled={isOptimizingTemplatePrompt}
                            className={`mt-3 w-full py-3 text-xs font-bold rounded-lg transition-all flex items-center justify-center ${
                                isOptimizingTemplatePrompt
                                ? 'bg-slate-200 text-slate-500 cursor-not-allowed'
                                : 'bg-gradient-to-r from-[var(--primary-50)] to-purple-50 text-[var(--primary-color)] hover:from-[var(--primary-100)] hover:to-purple-100 border border-[var(--primary-200)]'
                            }`}
                        >
                            {isOptimizingTemplatePrompt ? (
                                <>
                                    <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-slate-500" fill="none" viewBox="0 0 24 24">
                                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                                    </svg>
                                    AI 正在优化 Prompt...
                                </>
                            ) : (
                                <>
                                    <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
                                    </svg>
                                    AI 优化 Prompt
                                </>
                            )}
                        </button>
                    </div>
                    <div className="mt-4 flex justify-end space-x-2 pt-2">
                        <button
                            onClick={() => setIsCreatingTemplate(false)}
                            className="px-4 py-2 text-xs font-bold text-slate-600 hover:bg-slate-100 rounded-lg transition-colors"
                        >
                            取消
                        </button>
                        <button
                            onClick={handleCreateTemplate}
                            disabled={isOptimizingTemplatePrompt}
                            className="px-6 py-2 text-xs font-bold text-white bg-[var(--primary-color)] hover:bg-[var(--primary-hover)] rounded-lg shadow-sm transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
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

export default MultiDocProcessor;
