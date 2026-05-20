import { get, set, del, keys, entries, clear } from 'idb-keyval';
import type { Character } from '../types/character';
import type { Message, TimelineEvent } from '../types/timeline';
import type { IFSession } from '../types/world';

// Key prefixes
const CHAR_PREFIX = 'char:';
const CHAT_PREFIX = 'chat:';
const IF_PREFIX = 'if:';
const EVENT_PREFIX = 'events:';
const RAW_PREFIX = 'raw:';

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
}

// ==================== Chat History CRUD ====================

export async function saveChatHistory(characterId: string, messages: Message[]): Promise<void> {
  await set(`${CHAT_PREFIX}${characterId}`, messages);
}

export async function getChatHistory(characterId: string): Promise<Message[]> {
  return get<Message[]>(`${CHAT_PREFIX}${characterId}`) ?? [];
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

// ==================== Timeline Events CRUD ====================

export async function saveTimelineEvents(characterId: string, events: TimelineEvent[]): Promise<void> {
  await set(`${EVENT_PREFIX}${characterId}`, events);
}

export async function getTimelineEvents(characterId: string): Promise<TimelineEvent[]> {
  return get<TimelineEvent[]>(`${EVENT_PREFIX}${characterId}`) ?? [];
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
  return get<Message[]>(`${RAW_PREFIX}${characterId}`) ?? [];
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

// ==================== Utility ====================

export async function getAllKeys(): Promise<string[]> {
  const allKeys = await keys();
  return allKeys as string[];
}
