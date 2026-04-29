export type WorldRule = 'free' | 'fated';

export interface WorldState {
  relationshipHeat: number;
  unresolvedEmotions: string[];
  divergences: {
    originalEventId: string;
    whatActuallyHappened: string;
    consequences: string;
  }[];
  currentPhase: '日常' | '升温' | '冲突' | '冷战' | '和解' | '分离';
  characterMood: string;
}

export interface IFSession {
  id: string;
  characterId: string;
  startDate: string;
  worldRule: WorldRule;
  worldState: WorldState;
  messages: {
    id: string;
    sender: 'user' | 'character';
    content: string;
    timestamp: string;
  }[];
  currentDate: string;
  createdAt: string;
}
