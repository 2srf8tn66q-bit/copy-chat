import { create } from 'zustand';
import type { GroupSession, GroupMessage } from '../types/group';
import {
  saveGroupSession as persistSession,
  getAllGroupSessions,
  deleteGroupSession as persistDelete,
} from '../services/storage';

interface GroupSessionStore {
  sessions: GroupSession[];
  loaded: boolean;
  load: () => Promise<void>;
  addSession: (session: GroupSession) => Promise<void>;
  removeSession: (id: string) => Promise<void>;
  renameSession: (id: string, name: string) => Promise<void>;
  appendMessage: (id: string, message: GroupMessage) => Promise<void>;
  setMessages: (id: string, messages: GroupMessage[]) => Promise<void>;
  getSession: (id: string) => GroupSession | undefined;
}

export const useGroupSessionStore = create<GroupSessionStore>()((set, get) => ({
  sessions: [],
  loaded: false,

  load: async () => {
    const sessions = await getAllGroupSessions();
    set({ sessions, loaded: true });
  },

  addSession: async (session) => {
    set((state) => ({ sessions: [session, ...state.sessions] }));
    await persistSession(session);
  },

  removeSession: async (id) => {
    set((state) => ({ sessions: state.sessions.filter((s) => s.id !== id) }));
    await persistDelete(id);
  },

  renameSession: async (id, name) => {
    const now = new Date().toISOString();
    let updated: GroupSession | undefined;
    set((state) => ({
      sessions: state.sessions.map((s) => {
        if (s.id !== id) return s;
        updated = { ...s, name, updatedAt: now };
        return updated;
      }),
    }));
    if (updated) await persistSession(updated);
  },

  appendMessage: async (id, message) => {
    const now = new Date().toISOString();
    let updated: GroupSession | undefined;
    set((state) => ({
      sessions: state.sessions.map((s) => {
        if (s.id !== id) return s;
        updated = { ...s, messages: [...s.messages, message], updatedAt: now };
        return updated;
      }),
    }));
    if (updated) {
      // 把最新会话放到列表最前
      set((state) => ({
        sessions: [updated!, ...state.sessions.filter((s) => s.id !== id)],
      }));
      await persistSession(updated);
    }
  },

  setMessages: async (id, messages) => {
    const now = new Date().toISOString();
    let updated: GroupSession | undefined;
    set((state) => ({
      sessions: state.sessions.map((s) => {
        if (s.id !== id) return s;
        updated = { ...s, messages, updatedAt: now };
        return updated;
      }),
    }));
    if (updated) await persistSession(updated);
  },

  getSession: (id) => get().sessions.find((s) => s.id === id),
}));
