import { get, set, del, keys, entries, clear } from 'idb-keyval';
import type { Character } from '../types/character';
import type { Message, TimelineEvent } from '../types/timeline';
import type { IFSession } from '../types/world';
import type { GroupSession } from '../types/group';
import type { PersonaPatch } from '../stores/characterStore';

// Key prefixes
const CHAR_PREFIX = 'char:';
const CHAT_PREFIX = 'chat:';
const IF_PREFIX = 'if:';
const EVENT_PREFIX = 'events:';
const RAW_PREFIX = 'raw:';
const BASELINE_PREFIX = 'baseline:';     // 画像首次被修正前的快照
const FEEDBACK_PREFIX = 'feedback:';     // 每条修正反馈记录
const GROUP_PREFIX = 'group:';           // 群聊会话

// ==================== Character CRUD ====================

export async function saveCharacter(character: Character): Promise<void> {
  await set(`${CHAR_PREFIX}${character.id}`, character);
}

export async function getCharacter(id: string): Promise<Character | undefined> {
  return get<Character>(`${CHAR_PREFIX}${id}`);
}

export async function getAllCharacters(): Promise<Character[]> {
  const allEntries = await entries<string, Character>();
  return allEntries
    .filter(([key]) => (key as string).startsWith(CHAR_PREFIX))
    .map(([, value]) => value);
}

export async function deleteCharacter(id: string): Promise<void> {
  await del(`${CHAR_PREFIX}${id}`);
  await del(`${CHAT_PREFIX}${id}`);
  await del(`${EVENT_PREFIX}${id}`);
  await del(`${RAW_PREFIX}${id}`);
  await del(`${BASELINE_PREFIX}${id}`);
  // Delete all feedback for this character
  const feedbackKeys = await keys();
  await Promise.all(
    feedbackKeys
      .filter((k) => (k as string).startsWith(FEEDBACK_PREFIX))
      .map(async (k) => {
        const fb = await get<PersonaFeedback>(k as string);
        if (fb?.characterId === id) await del(k);
      })
  );
  // 级联清理所有群里的 memberIds 引用
  const groups = await getAllGroupSessions();
  await Promise.all(
    groups
      .filter((g) => g.memberIds.includes(id))
      .map((g) => saveGroupSession({ ...g, memberIds: g.memberIds.filter((mid) => mid !== id) })),
  );
}

// ==================== Chat History CRUD ====================

export async function saveChatHistory(characterId: string, messages: Message[]): Promise<void> {
  await set(`${CHAT_PREFIX}${characterId}`, messages);
}

export async function getChatHistory(characterId: string): Promise<Message[]> {
  return (await get<Message[]>(`${CHAT_PREFIX}${characterId}`)) ?? [];
}

export async function clearChatHistory(characterId: string): Promise<void> {
  await set(`${CHAT_PREFIX}${characterId}`, []);
}

// ==================== IF Session CRUD ====================

export async function saveIFSession(session: IFSession): Promise<void> {
  await set(`${IF_PREFIX}${session.id}`, session);
}

export async function getIFSession(id: string): Promise<IFSession | undefined> {
  return get<IFSession>(`${IF_PREFIX}${id}`);
}

export async function getAllIFSessions(characterId: string): Promise<IFSession[]> {
  const allEntries = await entries<string, IFSession>();
  return allEntries
    .filter(([key, value]) => {
      return (key as string).startsWith(IF_PREFIX) && value.characterId === characterId;
    })
    .map(([, value]) => value);
}

// ==================== Persona Refinement (baseline + feedback log) ====================

/**
 * 画像首次被修正之前的"原始快照"。
 * 一旦保存就永不覆盖（除非用户在 Edit 页里"重置画像"，未来 feature）。
 */
export async function saveCharacterBaseline(id: string, character: Character): Promise<void> {
  await set(`${BASELINE_PREFIX}${id}`, character);
}

export async function getCharacterBaseline(id: string): Promise<Character | undefined> {
  return get<Character>(`${BASELINE_PREFIX}${id}`);
}

/**
 * 用户在聊天里对某条 AI 回复做的一次修正。
 * 持久化下来 → 刷新后撤销链仍可用 / 编辑页"修正历史"tab 可查看。
 */
export interface PersonaFeedback {
  id: string;
  characterId: string;
  timestamp: string;            // ISO 8601
  triggerMessage: string;       // 出戏的 AI 回复
  userCorrection: string;       // 用户填的"哪里不对"
  userSuggestion?: string;      // 用户填的"应该怎么说"
  patch: PersonaPatch;          // 实际应用的补丁
  diffSummary: string[];        // 人话版的变更摘要
  reasoning: string;            // LLM 给的修改理由
  reverted?: boolean;           // 是否已被撤销
}

export async function saveFeedback(feedback: PersonaFeedback): Promise<void> {
  await set(`${FEEDBACK_PREFIX}${feedback.id}`, feedback);
}

export async function getFeedback(id: string): Promise<PersonaFeedback | undefined> {
  return get<PersonaFeedback>(`${FEEDBACK_PREFIX}${id}`);
}

export async function getAllFeedback(characterId: string): Promise<PersonaFeedback[]> {
  const allEntries = await entries<string, PersonaFeedback>();
  return allEntries
    .filter(([key, value]) => (key as string).startsWith(FEEDBACK_PREFIX) && value.characterId === characterId)
    .map(([, value]) => value)
    .sort((a, b) => a.timestamp.localeCompare(b.timestamp));  // 时间正序
}

export async function updateFeedback(id: string, updates: Partial<PersonaFeedback>): Promise<void> {
  const existing = await get<PersonaFeedback>(`${FEEDBACK_PREFIX}${id}`);
  if (!existing) return;
  await set(`${FEEDBACK_PREFIX}${id}`, { ...existing, ...updates });
}

export async function deleteFeedback(id: string): Promise<void> {
  await del(`${FEEDBACK_PREFIX}${id}`);
}

// ==================== Timeline Events CRUD ====================

export async function saveTimelineEvents(characterId: string, events: TimelineEvent[]): Promise<void> {
  await set(`${EVENT_PREFIX}${characterId}`, events);
}

export async function getTimelineEvents(characterId: string): Promise<TimelineEvent[]> {
  return (await get<TimelineEvent[]>(`${EVENT_PREFIX}${characterId}`)) ?? [];
}

// ==================== Data Import/Export ====================

export async function exportAllData(): Promise<string> {
  const allEntries = await entries<string, unknown>();
  const data: Record<string, unknown> = {};
  for (const [key, value] of allEntries) {
    data[key as string] = value;
  }
  return JSON.stringify(data, null, 2);
}

export async function importData(json: string): Promise<void> {
  const data = JSON.parse(json) as Record<string, unknown>;
  // Clear existing data first
  await clear();
  // Import all entries
  for (const [key, value] of Object.entries(data)) {
    await set(key, value);
  }
}

// ==================== Raw Messages (original chat history) ====================

export async function saveRawMessages(characterId: string, messages: Message[]): Promise<void> {
  await set(`${RAW_PREFIX}${characterId}`, messages);
}

export async function getRawMessages(characterId: string): Promise<Message[]> {
  return (await get<Message[]>(`${RAW_PREFIX}${characterId}`)) ?? [];
}

/**
 * Get a page of raw messages around a target date.
 * Returns up to `limit` messages ending at or just after `targetDate`.
 */
export async function getRawMessagesAroundDate(
  characterId: string,
  targetDate: string,
  limit: number = 40,
): Promise<Message[]> {
  const all = await getRawMessages(characterId);
  if (all.length === 0) return [];

  // Binary search for the index closest to targetDate
  const target = new Date(targetDate).getTime();
  let lo = 0, hi = all.length;
  while (lo < hi) {
    const mid = (lo + hi) >> 1;
    const t = new Date(all[mid].timestamp || '').getTime();
    if (isNaN(t) || t < target) lo = mid + 1;
    else hi = mid;
  }

  const start = Math.max(0, lo - Math.floor(limit / 2));
  return all.slice(start, start + limit);
}

/**
 * Get raw messages by index range (for lazy loading / infinite scroll).
 */
export async function getRawMessagesRange(
  characterId: string,
  start: number,
  count: number,
): Promise<{ messages: Message[]; total: number }> {
  const all = await getRawMessages(characterId);
  return {
    messages: all.slice(start, start + count),
    total: all.length,
  };
}

// ==================== IF Chat Sessions ====================

const IF_SESSIONS_PREFIX = 'ifsessions:';

export interface IFChatSession {
  id: string;
  characterId: string;
  interventionIdx: number;
  messages: Message[];
  startDate: string;
  createdAt: string;
  updatedAt: string;
  contextPreview: string;  // the message content at intervention point
}

export async function getAllIFChatSessions(characterId: string): Promise<IFChatSession[]> {
  const sessions = await get<IFChatSession[]>(`${IF_SESSIONS_PREFIX}${characterId}`);
  return (sessions ?? []).sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
}

export async function getIFChatSession(characterId: string, sessionId: string): Promise<IFChatSession | undefined> {
  const sessions = await getAllIFChatSessions(characterId);
  return sessions.find(s => s.id === sessionId);
}

export async function saveIFChatSession(session: IFChatSession): Promise<void> {
  const sessions = await get<IFChatSession[]>(`${IF_SESSIONS_PREFIX}${session.characterId}`) ?? [];
  const idx = sessions.findIndex(s => s.id === session.id);
  if (idx >= 0) {
    sessions[idx] = session;
  } else {
    sessions.push(session);
  }
  await set(`${IF_SESSIONS_PREFIX}${session.characterId}`, sessions);
}

export async function deleteIFChatSession(characterId: string, sessionId: string): Promise<void> {
  const sessions = await get<IFChatSession[]>(`${IF_SESSIONS_PREFIX}${characterId}`) ?? [];
  const filtered = sessions.filter(s => s.id !== sessionId);
  await set(`${IF_SESSIONS_PREFIX}${characterId}`, filtered);
}

// ==================== Group Sessions ====================

export async function saveGroupSession(session: GroupSession): Promise<void> {
  await set(`${GROUP_PREFIX}${session.id}`, session);
}

export async function getGroupSession(id: string): Promise<GroupSession | undefined> {
  return get<GroupSession>(`${GROUP_PREFIX}${id}`);
}

export async function getAllGroupSessions(): Promise<GroupSession[]> {
  const allEntries = await entries<string, GroupSession>();
  return allEntries
    .filter(([key]) => (key as string).startsWith(GROUP_PREFIX))
    .map(([, value]) => value)
    .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
}

export async function deleteGroupSession(id: string): Promise<void> {
  await del(`${GROUP_PREFIX}${id}`);
}

// ==================== Utility ====================

export async function getAllKeys(): Promise<string[]> {
  const allKeys = await keys();
  return allKeys as string[];
}
