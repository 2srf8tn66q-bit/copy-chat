import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { LLMConfig, LLMProvider } from '../types';

interface LLMStore {
  configs: LLMConfig[];
  activeConfigIndex: number;
  setConfig: (index: number, config: LLMConfig) => void;
  addConfig: (config: LLMConfig) => void;
  removeConfig: (index: number) => void;
  setActiveConfig: (index: number) => void;
  getActiveConfig: () => LLMConfig | null;
}

export const useLLMStore = create<LLMStore>()(
  persist(
    (set, get) => ({
      configs: [],
      activeConfigIndex: -1,
      setConfig: (index, config) =>
        set((state) => {
          const configs = [...state.configs];
          configs[index] = config;
          return { configs };
        }),
      addConfig: (config) =>
        set((state) => ({
          configs: [...state.configs, config],
          activeConfigIndex: state.configs.length === 0 ? 0 : state.activeConfigIndex,
        })),
      removeConfig: (index) =>
        set((state) => {
          const configs = state.configs.filter((_, i) => i !== index);
          let activeConfigIndex = state.activeConfigIndex;
          if (activeConfigIndex >= configs.length) activeConfigIndex = configs.length - 1;
          return { configs, activeConfigIndex };
        }),
      setActiveConfig: (index) => set({ activeConfigIndex: index }),
      getActiveConfig: () => {
        const { configs, activeConfigIndex } = get();
        return configs[activeConfigIndex] ?? null;
      },
    }),
    { name: 'copychat-llm-config' }
  )
);
