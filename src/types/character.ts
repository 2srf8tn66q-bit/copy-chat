export interface Character {
  id: string;
  // Layer 0: 基础
  gender: 'male' | 'female' | 'unknown';
  relationshipToUser: string;  // "恋人" / "闺蜜" / "大学室友" / "同事" 等
  messageStyle: 'single' | 'burst';  // single=一条说完, burst=连发多条短消息
  // Layer 1: 身份
  identity: {
    name: string;
    avatar: string;
    ageEstimate: string;
    occupationHint: string;
  };
  // Layer 2: 人格
  persona: {
    personalityTags: string[];
    attachmentStyle: string;
    speakingStyle: string;
    emotionalLogic: string;
    typicalPhrases: string[];
    responseLength: 'short' | 'medium' | 'long';
    neverSay: string[];  // 这个人绝对不会说的话/表达方式
  };
  // Layer 3: 记忆
  memories: {
    relationshipTimeline: string[];
    sharedPlaces: string[];
    insideJokes: string[];
    conflictPatterns: string[];
  };
  // Layer 4: 语料指纹
  voiceFingerprint: {
    quotes: {
      angry: string[];
      sweet: string[];
      sarcastic: string[];
      daily: string[];
      concerned: string[];
    };
    habits: {
      emojiFrequency: 'none' | 'rare' | 'normal' | 'heavy';
      frequentEmojis: string[];
      catchphrases: string[];
      avgMessageLength: number;
      rhetoricalFreq: 'high' | 'medium' | 'low';
      punctuationStyle: 'minimal' | 'normal' | 'ellipsis' | 'exclamation';
    };
    patterns: {
      whenPushed: string;
      whenAngry: string;
      whenSurprised: string;
      whenMoved: string;
    };
  };
  createdAt: string;
  sourceType: 'text-paste' | 'html-upload' | 'manual';
  // 真实对话片段（few-shot 示例）
  sampleConversations?: string[];
}
