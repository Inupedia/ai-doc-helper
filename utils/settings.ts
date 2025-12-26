
export const AVAILABLE_MODELS = [
  { id: 'gemini-2.0-flash', name: 'Gemini 2.0 Flash - 稳定/极速 (推荐)', type: 'fast' },
  { id: 'gemini-3-flash-preview', name: 'Gemini 3.0 Flash (Preview)', type: 'fast' },
  { id: 'gemini-3-pro-preview', name: 'Gemini 3.0 Pro (Preview)', type: 'complex' },
  { id: 'gemini-1.5-pro', name: 'Gemini 1.5 Pro - 大窗口上下文', type: 'complex' },
];

export const getEffectiveApiKey = (): string => {
  // 优先使用用户在界面设置的 Key，其次使用环境变量中的 Key
  return localStorage.getItem('user_api_key') || process.env.API_KEY || '';
};

export const getEffectiveModel = (taskType: 'ocr' | 'text' = 'text'): string => {
  const userModel = localStorage.getItem('user_model');
  // 如果用户设置了模型，直接使用
  if (userModel) return userModel;
  
  // 默认策略：OCR 使用 gemini-2.0-flash 以避免预览版 404 问题
  if (taskType === 'ocr') return 'gemini-2.0-flash';
  
  // 文本处理默认使用 2.0 Flash 保证速度和稳定性
  return 'gemini-2.0-flash';
};

export const saveUserSettings = (apiKey: string, model: string) => {
  if (apiKey) {
    localStorage.setItem('user_api_key', apiKey);
  } else {
    localStorage.removeItem('user_api_key');
  }
  
  if (model) {
    localStorage.setItem('user_model', model);
  } else {
    localStorage.removeItem('user_model');
  }
};

export const getUserSettings = () => {
  return {
    apiKey: localStorage.getItem('user_api_key') || '',
    model: localStorage.getItem('user_model') || AVAILABLE_MODELS[0].id
  };
};
