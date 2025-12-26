
import { GoogleGenAI } from "@google/genai";

/**
 * Standard client initialization using process.env.API_KEY.
 * Per guidelines, API keys must not be managed via UI or local storage.
 */
export const getGeminiClient = () => {
  return new GoogleGenAI({ apiKey: process.env.API_KEY });
};
