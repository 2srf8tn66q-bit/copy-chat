export interface TimelineEvent {
  id: string;
  date: string;
  type: 'conflict' | 'confession' | 'plan' | 'turning_point' | 'separation' | 'reunion' | 'daily_share';
  summary: string;
  originalMessages: Message[];
  emotionalArc: string;
  isKeyEvent: boolean;
  speaker: 'character' | 'user';
  // 因果链前提条件
  preconditions?: {
    relationshipHeatRange?: { min?: number; max?: number };
    requiredEmotions?: string[];
  };
  // 来源
  source: 'auto' | 'manual';
  // 运行时状态（IF线用）
  status: 'pending' | 'triggered' | 'cancelled' | 'mutated';
}

export interface Message {
  id: string;
  sender: 'user' | 'character';
  content: string;
  timestamp: string;
  type: 'text' | 'image' | 'video' | 'system';
  mediaUrl?: string;
  mediaDescription?: string;
}
