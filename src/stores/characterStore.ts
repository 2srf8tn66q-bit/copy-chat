import { create } from 'zustand';
import type { Character } from '../types';

interface CharacterStore {
  characters: Character[];
  addCharacter: (character: Character) => void;
  updateCharacter: (id: string, updates: Partial<Character>) => void;
  /** 用计算好的 character 整体替换 store 里的对应条目（用于 recompute 后写回） */
  setCharacter: (id: string, character: Character) => void;
  removeCharacter: (id: string) => void;
  getCharacter: (id: string) => Character | undefined;
  /** in-memory 应用 patch；不会自己持久化，调用方负责存 IDB */
  applyPersonaPatch: (id: string, patch: PersonaPatch) => Character | undefined;
}

/** 增量补丁结构 — 与 Character 镜像，但全部字段可选 */
export interface PersonaPatch {
  persona?: Partial<Character['persona']> & {
    addToTypicalPhrases?: string[];
    addToNeverSay?: string[];
    addToPersonalityTags?: string[];
  };
  voiceFingerprint?: Partial<Character['voiceFingerprint']> & {
    habits?: Partial<Character['voiceFingerprint']['habits']> & {
      addToCatchphrases?: string[];
      addToFrequentEmojis?: string[];
    };
  };
  messageStyle?: Character['messageStyle'];
}

function uniqMerge(a: string[] | undefined, b: string[] | undefined): string[] {
  const all = [...(a ?? []), ...(b ?? [])];
  return Array.from(new Set(all.filter(Boolean)));
}

/**
 * 纯函数：把 patch 应用到 character，返回新对象。
 * 导出供 personaRefinement service 重算时使用。
 */
export function applyPatchToCharacter(c: Character, patch: PersonaPatch): Character {
  const next: Character = JSON.parse(JSON.stringify(c));

  if (patch.persona) {
    const p = patch.persona;
    if (p.addToTypicalPhrases) {
      next.persona.typicalPhrases = uniqMerge(next.persona.typicalPhrases, p.addToTypicalPhrases);
    }
    if (p.addToNeverSay) {
      next.persona.neverSay = uniqMerge(next.persona.neverSay, p.addToNeverSay);
    }
    if (p.addToPersonalityTags) {
      next.persona.personalityTags = uniqMerge(next.persona.personalityTags, p.addToPersonalityTags);
    }
    if (p.speakingStyle !== undefined) next.persona.speakingStyle = p.speakingStyle;
    if (p.emotionalLogic !== undefined) next.persona.emotionalLogic = p.emotionalLogic;
    if (p.attachmentStyle !== undefined) next.persona.attachmentStyle = p.attachmentStyle;
    if (p.responseLength !== undefined) next.persona.responseLength = p.responseLength;
  }

  if (patch.voiceFingerprint?.habits) {
    const h = patch.voiceFingerprint.habits;
    if (h.addToCatchphrases) {
      next.voiceFingerprint.habits.catchphrases = uniqMerge(next.voiceFingerprint.habits.catchphrases, h.addToCatchphrases);
    }
    if (h.addToFrequentEmojis) {
      next.voiceFingerprint.habits.frequentEmojis = uniqMerge(next.voiceFingerprint.habits.frequentEmojis, h.addToFrequentEmojis);
    }
    if (h.emojiFrequency !== undefined) next.voiceFingerprint.habits.emojiFrequency = h.emojiFrequency;
    if (h.punctuationStyle !== undefined) next.voiceFingerprint.habits.punctuationStyle = h.punctuationStyle;
    if (h.rhetoricalFreq !== undefined) next.voiceFingerprint.habits.rhetoricalFreq = h.rhetoricalFreq;
  }

  if (patch.messageStyle !== undefined) next.messageStyle = patch.messageStyle;

  return next;
}

export const useCharacterStore = create<CharacterStore>()((set, get) => ({
  characters: [],

  addCharacter: (character) =>
    set((state) => ({ characters: [...state.characters, character] })),

  updateCharacter: (id, updates) =>
    set((state) => ({
      characters: state.characters.map((c) =>
        c.id === id ? { ...c, ...updates } : c
      ),
    })),

  setCharacter: (id, character) =>
    set((state) => ({
      characters: state.characters.map((c) => (c.id === id ? character : c)),
    })),

  removeCharacter: (id) =>
    set((state) => ({
      characters: state.characters.filter((c) => c.id !== id),
    })),

  getCharacter: (id) => get().characters.find((c) => c.id === id),

  applyPersonaPatch: (id, patch) => {
    const current = get().characters.find((c) => c.id === id);
    if (!current) return undefined;
    const next = applyPatchToCharacter(current, patch);
    set((state) => ({
      characters: state.characters.map((c) => (c.id === id ? next : c)),
    }));
    return next;
  },
}));
