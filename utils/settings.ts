
export const AVAILABLE_MODELS = [
  { id: 'gemini-3-flash-preview', name: 'Gemini 3.0 Flash (Preview) - 极速推荐', type: 'fast' },
  { id: 'gemini-3-pro-preview', name: 'Gemini 3.0 Pro (Preview) - 最强推理', type: 'complex' },
  { id: 'gemini-2.0-flash', name: 'Gemini 2.0 Flash - 稳定版', type: 'fast' },
];

export const getEffectiveApiKey = (): string => {
  // 优先使用用户在界面设置的 Key，其次使用环境变量中的 Key
  return localStorage.getItem('user_api_key') || process.env.API_KEY || '';
};

export const getEffectiveModel = (taskType: 'ocr' | 'text' = 'text'): string => {
  const userModel = localStorage.getItem('user_model');
  // 如果用户设置了模型，直接使用
  if (userModel) return userModel;
  
  // 默认策略
  if (taskType === 'ocr') return 'gemini-3-pro-preview'; // OCR 任务使用 Pro 模型以获得更好的视觉识别
  
  // 文本处理默认使用 3.0 Flash 保证速度
  return 'gemini-3-flash-preview';
};

export const getEffectiveBaseUrl = (): string => {
  return localStorage.getItem('user_base_url') || '';
};

export const saveUserSettings = (apiKey: string, model: string, baseUrl: string = '') => {
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

  if (baseUrl) {
    localStorage.setItem('user_base_url', baseUrl);
  } else {
    localStorage.removeItem('user_base_url');
  }
};

export const getUserSettings = () => {
  return {
    apiKey: localStorage.getItem('user_api_key') || '',
    model: localStorage.getItem('user_model') || AVAILABLE_MODELS[0].id,
    baseUrl: localStorage.getItem('user_base_url') || ''
  };
};
