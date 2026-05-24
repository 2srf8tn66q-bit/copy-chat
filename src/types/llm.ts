export type LLMProvider = 'openai' | 'kimi' | 'zhipu' | 'claude' | 'aliyun' | 'minimax' | 'deepseek' | 'mimo' | 'ollama' | 'custom';

export interface LLMConfig {
  provider: LLMProvider;
  apiKey: string;
  baseUrl: string;
  model: string;
}

export interface ChatMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}
