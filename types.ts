
export enum AppView {
  EDITOR = 'editor',
  OCR = 'ocr'
}

export enum WordTemplate {
  STANDARD = 'standard',
  ACADEMIC = 'academic',
  NOTE = 'note'
}

export interface DocumentState {
  markdown: string;
  isProcessing: boolean;
  progress: number;
}

export interface OCRResult {
  latex: string;
  confidence?: number;
}
