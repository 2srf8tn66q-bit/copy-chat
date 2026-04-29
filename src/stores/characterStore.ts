import { create } from 'zustand';
import type { Character } from '../types';

interface CharacterStore {
  characters: Character[];
  addCharacter: (character: Character) => void;
  updateCharacter: (id: string, updates: Partial<Character>) => void;
  removeCharacter: (id: string) => void;
  getCharacter: (id: string) => Character | undefined;
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
  removeCharacter: (id) =>
    set((state) => ({
      characters: state.characters.filter((c) => c.id !== id),
    })),
  getCharacter: (id) => get().characters.find((c) => c.id === id),
}));
