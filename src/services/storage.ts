import { get, set, del, keys, entries, clear } from 'idb-keyval';
import type { Character } from '../types/character';
import type { Message, TimelineEvent } from '../types/timeline';
import type { IFSession } from '../types/world';

// Key prefixes
const CHAR_PREFIX = 'char:';
const CHAT_PREFIX = 'chat:';
const IF_PREFIX = 'if:';
const EVENT_PREFIX = 'events:';

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
  // Also delete associated chat history
  await del(`${CHAT_PREFIX}${id}`);
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

// ==================== Utility ====================

export async function getAllKeys(): Promise<string[]> {
  const allKeys = await keys();
  return allKeys as string[];
}
