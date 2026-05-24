import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export type ChatTheme = 'light' | 'dark';

interface ChatThemeStore {
  theme: ChatTheme;
  setTheme: (theme: ChatTheme) => void;
  toggle: () => void;
}

export const useChatThemeStore = create<ChatThemeStore>()(
  persist(
    (set) => ({
      theme: 'dark', // 默认 WeChat 夜间模式，避免从暗色 app 跳进白底产生 flashbang
      setTheme: (theme) => set({ theme }),
      toggle: () => set((s) => ({ theme: s.theme === 'dark' ? 'light' : 'dark' })),
    }),
    {
      name: 'copy-chat-theme',
    }
  )
);
