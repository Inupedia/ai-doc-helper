import { 
  Document, Packer, Paragraph, TextRun, HeadingLevel, 
  AlignmentType, Table, TableRow, TableCell, WidthType, 
  BorderStyle, ShadingType, VerticalAlign,
  Math as DocxMath, MathRun, ImageRun
} from 'docx';
import { WordTemplate, DocumentStyle } from '../types';

/**
 * 辅助函数：将 HTML 表格元素转换为 Markdown 表格
 */
function convertTableToMarkdown(tableEl: HTMLElement): string {
  let md = '';
  const rows = Array.from(tableEl.querySelectorAll('tr'));
  if (rows.length === 0) return '';

  // 1. 提取所有单元格文本
  const tableData: string[][] = rows.map(row => {
    const cells = Array.from(row.querySelectorAll('th, td'));
    return cells.map(cell => {
      // 移除换行符，Markdown 表格单元格内不支持换行，通常用 <br> 或空格代替
      return (cell.textContent || '').replace(/[\n\r]+/g, ' ').trim();
    });
  });

  // 2. 确定最大列数
  const colCount = tableData.reduce((max, row) => Math.max(max, row.length), 0);
  if (colCount === 0) return '';

  // 3. 构建 Markdown
  // Header Row (First row)
  const headerRow = tableData[0];
  // 补齐列
  while (headerRow.length < colCount) headerRow.push('');
  md += '| ' + headerRow.join(' | ') + ' |\n';

  // Separator Row
  md += '| ' + Array(colCount).fill('---').join(' | ') + ' |\n';

  // Data Rows
  for (let i = 1; i < tableData.length; i++) {
    const row = tableData[i];
    while (row.length < colCount) row.push('');
    md += '| ' + row.join(' | ') + ' |\n';
  }

  return md;
}

/**
 * 增强版 HTML 转 Markdown 工具
 * 支持图片提取、列表处理、表格转换等
 */
export function htmlToMarkdown(html: string): string {
  const parser = new DOMParser();
  const doc = parser.parseFromString(html, 'text/html');
  let md = '';

  function processNode(node: Node, indentLevel: number = 0) {
    if (node.nodeType === Node.TEXT_NODE) {
      let text = node.textContent || '';
      // 简单的去重换行，但保留必要的空格
      if (text.trim() === '' && text.includes('\n')) return;
      md += text;
    } else if (node.nodeType === Node.ELEMENT_NODE) {
      const el = node as HTMLElement;
      const tagName = el.tagName.toLowerCase();

      // 特殊处理表格
      if (tagName === 'table') {
        md += '\n\n' + convertTableToMarkdown(el) + '\n\n';
        return;
      }

      switch (tagName) {
        case 'h1': md += '\n# '; break;
        case 'h2': md += '\n## '; break;
        case 'h3': md += '\n### '; break;
        case 'h4': md += '\n#### '; break;
        case 'h5': md += '\n##### '; break;
        case 'p': md += '\n\n'; break;
        case 'strong': 
        case 'b': md += '**'; break;
        case 'em': 
        case 'i': md += '*'; break;
        case 'li': md += `\n${'  '.repeat(indentLevel)}- `; break;
        case 'ul': md += '\n'; break;
        case 'ol': md += '\n'; break;
        case 'br': md += '  \n'; break;
        case 'code': md += '`'; break;
        case 'pre': md += '\n```\n'; break;
        case 'blockquote': md += '\n> '; break;
        case 'img': 
          // 确保提取 src，mammoth 通常生成 base64
          const src = el.getAttribute('src');
          const alt = el.getAttribute('alt') || 'image';
          if (src) {
              md += `\n![${alt}](${src})\n`;
          }
          break;
        case 'a':
          md += '[';
          break;
      }

      // Recursively process children
      const newIndent = (tagName === 'ul' || tagName === 'ol') ? indentLevel + 1 : indentLevel;
      el.childNodes.forEach(child => processNode(child, newIndent));

      // Closing tags / cleanup
      switch (tagName) {
        case 'h1': case 'h2': case 'h3': case 'h4': case 'h5': md += '\n'; break;
        case 'p': md += '\n'; break;
        case 'strong': case 'b': md += '**'; break;
        case 'em': case 'i': md += '*'; break;
        case 'code': md += '`'; break;
        case 'pre': md += '\n```\n'; break;
        case 'div': md += '\n'; break;
        case 'a':
            const href = el.getAttribute('href');
            md += `](${href || '#'})`;
            break;
      }
    }
  }

  processNode(doc.body);
  
  // Post-processing cleaning
  // 1. Replace multiple newlines with max 2
  return md.replace(/\n\n\n+/g, '\n\n').trim();
}

/**
 * 将文本解析为带有样式的 TextRun 数组
 */
function parseInlineStyles(text: string, font: string, fontSize: number, color: string): (TextRun | DocxMath)[] {
  const runs: (TextRun | DocxMath)[] = [];
  
  const displayMathRegex = /\$\$(.+?)\$\$/g;
  const inlineMathRegex = /\$(.+?)\$/g;
  const styleRegex = /(\*\*\*?|__?|`)/g;
  
  let processedText = text;
  const mathPlaceholders: { placeholder: string; content: string; isDisplay: boolean }[] = [];
  let placeholderIndex = 0;
  
  processedText = processedText.replace(displayMathRegex, (match, content) => {
    const placeholder = `__MATH_DISPLAY_${placeholderIndex}__`;
    mathPlaceholders.push({ placeholder, content: content.trim(), isDisplay: true });
    placeholderIndex++;
    return placeholder;
  });
  
  processedText = processedText.replace(inlineMathRegex, (match, content) => {
    const placeholder = `__MATH_INLINE_${placeholderIndex}__`;
    mathPlaceholders.push({ placeholder, content: content.trim(), isDisplay: false });
    placeholderIndex++;
    return placeholder;
  });
  
  const segments: { text: string; style?: string }[] = [];
  let lastIndex = 0;
  let match;
  
  const combinedRegex = /(\*\*\*?|__?|`)(.*?)\1/g;
  while ((match = combinedRegex.exec(processedText)) !== null) {
    if (match.index > lastIndex) {
      segments.push({ text: processedText.substring(lastIndex, match.index) });
    }
    segments.push({ text: match[2], style: match[1] });
    lastIndex = combinedRegex.lastIndex;
  }
  
  if (lastIndex < processedText.length) {
    segments.push({ text: processedText.substring(lastIndex) });
  }
  
  for (const segment of segments) {
    const segmentText = segment.text;
    
    const mathPlaceholder = mathPlaceholders.find(m => segmentText.includes(m.placeholder));
    if (mathPlaceholder) {
      const parts = segmentText.split(mathPlaceholder.placeholder);
      if (parts[0]) {
        runs.push(new TextRun({ text: parts[0], font, size: fontSize * 2, color }));
      }
      runs.push(new DocxMath({
        children: [new MathRun(mathPlaceholder.content)]
      }));
      if (parts[1]) {
        runs.push(new TextRun({ text: parts[1], font, size: fontSize * 2, color }));
      }
    } else if (segment.style === '***') {
      runs.push(new TextRun({ text: segmentText, font, size: fontSize * 2, bold: true, italics: true, color }));
    } else if (segment.style === '**' || segment.style === '__') {
      runs.push(new TextRun({ text: segmentText, font, size: fontSize * 2, bold: true, color }));
    } else if (segment.style === '*' || segment.style === '_') {
      runs.push(new TextRun({ text: segmentText, font, size: fontSize * 2, italics: true, color }));
    } else if (segment.style === '`') {
      runs.push(new TextRun({ 
        text: segmentText, 
        font: "JetBrains Mono", 
        size: (fontSize - 1) * 2, 
        shading: { type: ShadingType.SOLID, color: "F1F5F9" },
        color: "E11D48" 
      }));
    } else {
      runs.push(new TextRun({ text: segmentText, font, size: fontSize * 2, color }));
    }
  }

  return runs;
}

const DEFAULT_STYLES: Record<string, DocumentStyle> = {
  [WordTemplate.STANDARD]: {
    fontFace: "SimSun",
    fontSize: 12,
    lineSpacing: 1.2,
    headingColor: "000000",
    textColor: "000000",
    alignment: "justify",
    paragraphSpacing: 200
  },
  [WordTemplate.ACADEMIC]: {
    fontFace: "Times New Roman",
    fontSize: 10.5,
    lineSpacing: 1.5,
    headingColor: "000000",
    textColor: "000000",
    alignment: "justify",
    paragraphSpacing: 100
  },
  [WordTemplate.NOTE]: {
    fontFace: "Microsoft YaHei",
    fontSize: 11,
    lineSpacing: 1.5,
    headingColor: "2563EB",
    textColor: "374151",
    alignment: "left",
    paragraphSpacing: 300
  }
};

async function fetchImageBuffer(url: string): Promise<{ data: ArrayBuffer, width: number, height: number } | null> {
    try {
        // Handle Base64 directly
        if (url.startsWith('data:image')) {
            const res = await fetch(url);
            const blob = await res.blob();
            const buffer = await blob.arrayBuffer();
             const dimensions = await new Promise<{ width: number, height: number }>((resolve) => {
                const img = new Image();
                img.onload = () => {
                    resolve({ width: img.naturalWidth, height: img.naturalHeight });
                };
                img.onerror = () => resolve({ width: 600, height: 400 });
                img.src = url;
            });
            return { data: buffer, width: dimensions.width, height: dimensions.height };
        }

        const response = await fetch(url);
        if (!response.ok) return null;
        const blob = await response.blob();
        const buffer = await blob.arrayBuffer();
        
        const dimensions = await new Promise<{ width: number, height: number }>((resolve) => {
            const img = new Image();
            img.onload = () => {
                const dims = { width: img.naturalWidth, height: img.naturalHeight };
                URL.revokeObjectURL(img.src);
                resolve(dims);
            };
            img.onerror = () => {
                 URL.revokeObjectURL(img.src);
                 resolve({ width: 600, height: 400 });
            };
            img.src = URL.createObjectURL(blob);
        });
        
        return { data: buffer, width: dimensions.width, height: dimensions.height }; 
    } catch (e) {
        console.warn("Failed to fetch image for docx:", url);
        return null;
    }
}

export async function downloadDocx(markdown: string, template: WordTemplate, customStyle?: DocumentStyle) {
  const lines = markdown.split('\n');
  const sections: any[] = [];
  
  const style = (template === WordTemplate.CUSTOM && customStyle) ? customStyle : (DEFAULT_STYLES[template] || DEFAULT_STYLES[WordTemplate.STANDARD]);
  
  const font = style.fontFace;
  const fontSize = style.fontSize; 
  const headingColor = style.headingColor;
  const textColor = style.textColor;
  
  let align: any = AlignmentType.LEFT;
  if (style.alignment === 'center') align = AlignmentType.CENTER;
  if (style.alignment === 'justify') align = AlignmentType.JUSTIFIED;
  if (style.alignment === 'right') align = AlignmentType.RIGHT;

  let i = 0;
  while (i < lines.length) {
    let line = lines[i].trim();

    if (line.startsWith('#')) {
      const level = line.match(/^#+/)?.[0].length || 1;
      const content = line.replace(/^#+\s*/, '');
      sections.push(new Paragraph({
        children: parseInlineStyles(content, font, fontSize + (4-level)*2, headingColor) as any,
        heading: level === 1 ? HeadingLevel.HEADING_1 : (level === 2 ? HeadingLevel.HEADING_2 : HeadingLevel.HEADING_3),
        spacing: { before: 400, after: 200 },
        alignment: level === 1 ? AlignmentType.CENTER : AlignmentType.LEFT,
      }));
      i++;
    } 
    else if (line.match(/^!\[(.*?)\]\((.*?)\)/)) {
        const match = line.match(/^!\[(.*?)\]\((.*?)\)/);
        if (match) {
            const alt = match[1];
            const url = match[2];
            const imgData = await fetchImageBuffer(url);
            
            if (imgData) {
                const MAX_WIDTH = 600; 
                let finalWidth = imgData.width;
                let finalHeight = imgData.height;

                if (finalWidth > MAX_WIDTH) {
                    const ratio = MAX_WIDTH / finalWidth;
                    finalWidth = MAX_WIDTH;
                    finalHeight = Math.round(finalHeight * ratio);
                }

                sections.push(new Paragraph({
                    children: [
                        new ImageRun({
                            data: imgData.data,
                            transformation: {
                                width: finalWidth,
                                height: finalHeight,
                            },
                            altText: {
                                title: alt,
                                description: alt,
                                name: alt,
                            }
                        } as any),
                        new TextRun({
                             text: `\n图: ${alt}`,
                             font: font,
                             size: fontSize - 2,
                             color: "666666",
                             italics: true
                        })
                    ],
                    alignment: AlignmentType.CENTER,
                    spacing: { before: 200, after: 200 }
                }));
            } else {
                sections.push(new Paragraph({
                    children: [new TextRun({ text: `[Image: ${alt} - Download Failed]`, color: "FF0000" })],
                    alignment: AlignmentType.CENTER
                }));
            }
        }
        i++;
    }
    else if (line.startsWith('```')) {
      const codeLines = [];
      i++;
      while (i < lines.length && !lines[i].trim().startsWith('```')) {
        codeLines.push(lines[i]);
        i++;
      }
      i++;
      sections.push(new Table({
        width: { size: 100, type: WidthType.PERCENTAGE },
        rows: [
          new TableRow({
            children: [
              new TableCell({
                children: codeLines.map(cl => new Paragraph({
                  children: [new TextRun({ text: cl, font: "JetBrains Mono", size: 20, color: "334155" })],
                  spacing: { before: 20, after: 20 }
                })),
                shading: { fill: "F8FAFC", type: ShadingType.CLEAR },
                borders: {
                  top: { style: BorderStyle.SINGLE, size: 1, color: "E2E8F0" },
                  bottom: { style: BorderStyle.SINGLE, size: 1, color: "E2E8F0" },
                  left: { style: BorderStyle.SINGLE, size: 6, color: "3B82F6" },
                  right: { style: BorderStyle.SINGLE, size: 1, color: "E2E8F0" },
                },
                margins: { top: 200, bottom: 200, left: 200, right: 200 }
              })
            ]
          })
        ],
      }));
    }
    else if (line.startsWith('|')) {
        const tableLines = [];
        while (i < lines.length && lines[i].trim().startsWith('|')) {
            tableLines.push(lines[i].trim());
            i++;
        }
        
        // Process tableLines into docx Table
        const rows = tableLines.map(row => {
            // Remove leading/trailing pipes and split
            // Note: This is a simple split and might break if pipes are inside cells, 
            // but for standard Markdown tables it works.
            const cells = row.replace(/^\||\|$/g, '').split('|').map(c => c.trim());
            return cells;
        }).filter(row => !row.every(cell => cell.match(/^-+$/))); // Filter separator row

        if (rows.length > 0) {
             sections.push(new Table({
                 width: { size: 100, type: WidthType.PERCENTAGE },
                 rows: rows.map((row, rowIndex) => 
                     new TableRow({
                         children: row.map(cellText => 
                             new TableCell({
                                 children: [new Paragraph({
                                     children: parseInlineStyles(cellText, font, fontSize, "#000000") as any,
                                     alignment: AlignmentType.CENTER
                                 })],
                                 shading: rowIndex === 0 ? { fill: "F3F4F6", type: ShadingType.CLEAR } : undefined,
                                 verticalAlign: VerticalAlign.CENTER,
                                 borders: {
                                     top: { style: BorderStyle.SINGLE, size: 1, color: "CBD5E1" },
                                     bottom: { style: BorderStyle.SINGLE, size: 1, color: "CBD5E1" },
                                     left: { style: BorderStyle.SINGLE, size: 1, color: "CBD5E1" },
                                     right: { style: BorderStyle.SINGLE, size: 1, color: "CBD5E1" },
                                 },
                                 margins: { top: 100, bottom: 100, left: 100, right: 100 }
                             })
                         )
                     })
                 )
             }));
        }
    }
    else {
      // Normal paragraph
      if (line.length > 0) {
        sections.push(new Paragraph({
          children: parseInlineStyles(line, font, fontSize, textColor) as any,
          spacing: { line: style.lineSpacing * 240, before: style.paragraphSpacing, after: style.paragraphSpacing },
          alignment: align
        }));
      }
      i++;
    }
  }

  const doc = new Document({
    sections: [{
      properties: {},
      children: sections,
    }],
  });

  const blob = await Packer.toBlob(doc);
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `document_${Date.now()}.docx`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}