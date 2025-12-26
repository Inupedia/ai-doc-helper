
import { 
  Document, Packer, Paragraph, TextRun, HeadingLevel, 
  AlignmentType, Table, TableRow, TableCell, WidthType, 
  BorderStyle, ShadingType, VerticalAlign 
} from 'docx';
import { WordTemplate } from '../types';

/**
 * 将文本解析为带有样式的 TextRun 数组
 */
function parseInlineStyles(text: string, font: string, fontSize: number): TextRun[] {
  const runs: TextRun[] = [];
  // 匹配：加粗 (**), 斜体 (*), 行内代码 (`), 公式 ($)
  const regex = /(\*\*\*?|__?|`|\$)(.*?)\1/g;
  let lastIndex = 0;
  let match;

  while ((match = regex.exec(text)) !== null) {
    // 添加匹配前的纯文本
    if (match.index > lastIndex) {
      runs.push(new TextRun({ text: text.substring(lastIndex, match.index), font, size: fontSize }));
    }

    const marker = match[1];
    const content = match[2];

    if (marker === '***') {
      runs.push(new TextRun({ text: content, font, size: fontSize, bold: true, italics: true }));
    } else if (marker === '**' || marker === '__') {
      runs.push(new TextRun({ text: content, font, size: fontSize, bold: true }));
    } else if (marker === '*' || marker === '_') {
      runs.push(new TextRun({ text: content, font, size: fontSize, italics: true }));
    } else if (marker === '`') {
      runs.push(new TextRun({ 
        text: content, 
        font: "JetBrains Mono", 
        size: fontSize - 2, 
        shading: { type: ShadingType.SOLID, color: "F1F5F9" },
        color: "E11D48" 
      }));
    } else if (marker === '$') {
      runs.push(new TextRun({ text: content, font: "Cambria Math", size: fontSize, italics: true }));
    }

    lastIndex = regex.lastIndex;
  }

  // 添加剩余文本
  if (lastIndex < text.length) {
    runs.push(new TextRun({ text: text.substring(lastIndex), font, size: fontSize }));
  }

  return runs;
}

export async function downloadDocx(markdown: string, template: WordTemplate) {
  const lines = markdown.split('\n');
  const sections: any[] = [];
  
  const isAcademic = template === WordTemplate.ACADEMIC;
  const font = isAcademic ? "Times New Roman" : (template === WordTemplate.NOTE ? "Microsoft YaHei" : "SimSun");
  const fontSize = isAcademic ? 21 : 24; // Word size is half-points

  let i = 0;
  while (i < lines.length) {
    let line = lines[i].trim();

    // 1. 处理标题
    if (line.startsWith('#')) {
      const level = line.match(/^#+/)?.[0].length || 1;
      const content = line.replace(/^#+\s*/, '');
      sections.push(new Paragraph({
        children: parseInlineStyles(content, font, fontSize + (4-level)*2),
        heading: level === 1 ? HeadingLevel.HEADING_1 : (level === 2 ? HeadingLevel.HEADING_2 : HeadingLevel.HEADING_3),
        spacing: { before: 400, after: 200 },
        alignment: level === 1 ? AlignmentType.CENTER : AlignmentType.LEFT,
      }));
      i++;
    } 
    // 2. 处理代码块
    else if (line.startsWith('```')) {
      const codeLines = [];
      i++;
      while (i < lines.length && !lines[i].trim().startsWith('```')) {
        codeLines.push(lines[i]);
        i++;
      }
      i++; // 跳过结束符号
      
      sections.push(new Table({
        width: { size: 100, type: WidthType.PERCENTAGE },
        rows: [
          new TableRow({
            children: [
              new TableCell({
                children: codeLines.map(cl => new Paragraph({
                  children: [new TextRun({ text: cl, font: "JetBrains Mono", size: 18, color: "334155" })],
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
        spacing: { before: 200, after: 200 }
      }));
    }
    // 3. 处理表格
    else if (line.startsWith('|')) {
      const tableRows = [];
      while (i < lines.length && lines[i].trim().startsWith('|')) {
        const rawRow = lines[i].trim();
        // 跳过分割行 |---|---|
        if (!rawRow.match(/^\|[:\s-]+\|/)) {
          const cells = rawRow.split('|').filter(c => c.trim() !== '' || rawRow.indexOf('|' + c + '|') !== -1).map(c => c.trim());
          if (cells.length > 0) {
            tableRows.push(new TableRow({
              children: cells.map(cell => new TableCell({
                children: [new Paragraph({ children: parseInlineStyles(cell, font, fontSize - 2) })],
                borders: {
                  top: { style: BorderStyle.SINGLE, size: 1, color: "94A3B8" },
                  bottom: { style: BorderStyle.SINGLE, size: 1, color: "94A3B8" },
                  left: { style: BorderStyle.SINGLE, size: 1, color: "94A3B8" },
                  right: { style: BorderStyle.SINGLE, size: 1, color: "94A3B8" },
                },
                verticalAlign: VerticalAlign.CENTER,
                margins: { top: 100, bottom: 100, left: 100, right: 100 }
              }))
            }));
          }
        }
        i++;
      }
      sections.push(new Table({
        rows: tableRows,
        width: { size: 100, type: WidthType.PERCENTAGE },
        spacing: { before: 200, after: 200 }
      }));
    }
    // 4. 处理块级公式
    else if (line.startsWith('$$')) {
      let formula = line.replace(/\$\$/g, '');
      if (formula === '') {
        i++;
        while (i < lines.length && !lines[i].trim().startsWith('$$')) {
          formula += lines[i] + ' ';
          i++;
        }
      }
      sections.push(new Paragraph({
        children: [new TextRun({ text: formula.trim(), font: "Cambria Math", size: fontSize + 4, italics: true })],
        alignment: AlignmentType.CENTER,
        spacing: { before: 300, after: 300 }
      }));
      i++;
    }
    // 5. 处理引用
    else if (line.startsWith('>')) {
      sections.push(new Paragraph({
        children: parseInlineStyles(line.replace(/^>\s*/, ''), font, fontSize),
        indent: { left: 720 },
        spacing: { after: 200 },
        shading: { fill: "F1F5F9", type: ShadingType.CLEAR }
      }));
      i++;
    }
    // 6. 普通段落
    else {
      if (line !== '') {
        sections.push(new Paragraph({
          children: parseInlineStyles(line, font, fontSize),
          alignment: AlignmentType.JUSTIFIED,
          spacing: { after: 200 }
        }));
      }
      i++;
    }
  }

  const doc = new Document({
    sections: [{
      properties: {
        page: {
          margin: { top: "2.54cm", bottom: "2.54cm", left: "3.18cm", right: "3.18cm" }
        }
      },
      children: sections,
    }],
  });

  const blob = await Packer.toBlob(doc);
  const url = window.URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `AI_Doc_${new Date().getTime()}.docx`;
  a.click();
  window.URL.revokeObjectURL(url);
}
