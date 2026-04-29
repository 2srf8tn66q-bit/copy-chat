import type { TimelineEvent } from '../types/timeline';
import type { WorldRule, WorldState, IFSession } from '../types/world';

// ─── createIFSession ─────────────────────────────────────

export function createIFSession(
  characterId: string,
  startDate: string,
  worldRule: WorldRule,
  events: TimelineEvent[],
): IFSession {
  // Reset all events to pending for the new session
  const resetEvents = events.map((e) => ({ ...e, status: 'pending' as const }));

  // We don't store events inside IFSession per the type; they're managed externally.
  // But we initialize the world state based on event context.
  const initialWorldState: WorldState = {
    relationshipHeat: 50,
    unresolvedEmotions: [],
    divergences: [],
    currentPhase: '日常',
    characterMood: '平静',
  };

  return {
    id: `if_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
    characterId,
    startDate,
    worldRule,
    worldState: initialWorldState,
    messages: [],
    currentDate: startDate,
    createdAt: new Date().toISOString(),
  };
}

// ─── evaluateEvents ──────────────────────────────────────

export function evaluateEvents(
  session: IFSession,
  events: TimelineEvent[],
): {
  triggered: TimelineEvent[];
  cancelled: TimelineEvent[];
  mutated: TimelineEvent[];
} {
  const triggered: TimelineEvent[] = [];
  const cancelled: TimelineEvent[] = [];
  const mutated: TimelineEvent[] = [];

  for (const event of events) {
    // Only consider pending events whose date has arrived
    if (event.status !== 'pending') continue;
    if (event.date > session.currentDate) continue;

    // Check preconditions
    const preconditionsMet = checkPreconditions(event, session.worldState);

    if (preconditionsMet) {
      triggered.push(event);
    } else {
      // Preconditions not met
      if (session.worldRule === 'fated' && event.isKeyEvent) {
        // In fated mode, key events mutate rather than cancel
        mutated.push(event);
      } else {
        cancelled.push(event);
      }
    }
  }

  return { triggered, cancelled, mutated };
}

/** Check if an event's preconditions are satisfied by current world state */
function checkPreconditions(event: TimelineEvent, state: WorldState): boolean {
  if (!event.preconditions) return true;

  const { relationshipHeatRange, requiredEmotions } = event.preconditions;

  // Check heat range
  if (relationshipHeatRange) {
    const heat = state.relationshipHeat;
    if (relationshipHeatRange.min !== undefined && heat < relationshipHeatRange.min) {
      return false;
    }
    if (relationshipHeatRange.max !== undefined && heat > relationshipHeatRange.max) {
      return false;
    }
  }

  // Check required emotions
  if (requiredEmotions && requiredEmotions.length > 0) {
    const hasAll = requiredEmotions.every((req) =>
      state.unresolvedEmotions.some((e) => e.includes(req)),
    );
    if (!hasAll) return false;
  }

  return true;
}

// ─── updateWorldState (rule-based engine) ────────────────

/** Keyword lists for rule-based sentiment analysis */
const CARE_KEYWORDS = [
  '想你', '担心', '心疼', '在乎', '关心', '照顾好自己', '注意身体', '别熬夜',
  '早点睡', '吃饭了吗', '怎么不回', '在吗', '在不在', '还生气吗', '对不起',
  '抱歉', '我错了', '原谅', '和好', '想你', '爱你', '喜欢', '舍不得', '乖',
  '宝', '亲', '抱抱', '摸摸头', '加油', '别难过', '别哭', '陪你',
];

const COLD_KEYWORDS = [
  '随便', '无所谓', '关我什么事', '不想理你', '烦', '滚', '别烦我',
  '不想说', '算了', '无所谓了', '不说了', '你说完了吗', '够了', '别说了',
  '我走了', '分手', '结束吧', '不想继续', '懒得说', '呵呵', '哦',
  '嗯', '行吧', '那就这样', '不考虑了',
];

const ANGRY_KEYWORDS_IN_REPLY = [
  '生气', '烦', '你干嘛', '你够了', '不想说', '滚', '讨厌', '别管我',
  '你烦不烦', '你有完没完', '无语', '不想理你', '随便你', '无所谓',
];

const SWEET_KEYWORDS_IN_REPLY = [
  '想你', '爱你', '喜欢你', '开心', '嘻嘻', '嘿嘿', '么么', '抱抱',
  '亲亲', '也是', '好吧好吧', '那你', '晚安', '好梦', '乖', '好的呀',
  '当然', '舍不得', '嘿嘿嘿', '嘻嘻嘻', '我也是',
];

/** Clamp a number between min and max */
function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

/** Determine relationship phase from heat value */
function phaseFromHeat(heat: number): WorldState['currentPhase'] {
  if (heat >= 80) return '升温';
  if (heat >= 60) return '日常';
  if (heat >= 40) return '和解';
  if (heat >= 25) return '冲突';
  if (heat >= 10) return '冷战';
  return '分离';
}

/** Determine mood from heat + user message sentiment */
function moodFromContext(heat: number, userCare: boolean, userCold: boolean): string {
  if (heat >= 70) {
    if (userCare) return '甜蜜';
    if (userCold) return '困惑';
    return '开心';
  }
  if (heat >= 45) {
    if (userCare) return '感动';
    if (userCold) return '失落';
    return '平静';
  }
  if (heat >= 25) {
    if (userCare) return '犹豫';
    if (userCold) return '愤怒';
    return '心烦';
  }
  if (userCare) return '动摇';
  if (userCold) return '绝望';
  return '冷漠';
}

export function updateWorldState(
  session: IFSession,
  userMessage: string,
  aiReply: string,
): WorldState {
  const state = { ...session.worldState };
  const msg = userMessage.toLowerCase();
  const reply = aiReply.toLowerCase();

  // Detect sentiment in user message
  const userCare = CARE_KEYWORDS.some((kw) => msg.includes(kw));
  const userCold = COLD_KEYWORDS.some((kw) => msg.includes(kw));

  // Detect sentiment in AI reply
  const aiAngry = ANGRY_KEYWORDS_IN_REPLY.some((kw) => reply.includes(kw));
  const aiSweet = SWEET_KEYWORDS_IN_REPLY.some((kw) => reply.includes(kw));

  // Heat adjustments
  let delta = 0;
  if (userCare) delta += 5;
  if (userCold) delta -= 10;
  if (aiAngry)  delta -= 5;
  if (aiSweet)  delta += 3;

  state.relationshipHeat = clamp(state.relationshipHeat + delta, 0, 100);

  // Update emotions list
  const emotions = [...state.unresolvedEmotions];
  if (userCare) {
    addEmotion(emotions, '被关心');
    removeEmotion(emotions, '委屈');
  }
  if (userCold) {
    addEmotion(emotions, '受伤');
    removeEmotion(emotions, '被关心');
  }
  if (aiAngry) {
    addEmotion(emotions, '生气');
  }
  if (aiSweet) {
    removeEmotion(emotions, '生气');
    removeEmotion(emotions, '委屈');
  }
  // Keep the list manageable
  state.unresolvedEmotions = emotions.slice(0, 5);

  // Update phase
  state.currentPhase = phaseFromHeat(state.relationshipHeat);

  // Update mood
  state.characterMood = moodFromContext(state.relationshipHeat, userCare, userCold);

  return state;
}

/** Add an emotion if not already present */
function addEmotion(emotions: string[], emotion: string): void {
  if (!emotions.includes(emotion)) {
    emotions.push(emotion);
  }
}

/** Remove an emotion if present */
function removeEmotion(emotions: string[], emotion: string): void {
  const idx = emotions.indexOf(emotion);
  if (idx !== -1) {
    emotions.splice(idx, 1);
  }
}

// ─── Time advancement ────────────────────────────────────

/** Advance the session's current date by one day */
export function advanceTime(session: IFSession, days: number = 1): IFSession {
  const current = new Date(session.currentDate);
  current.setDate(current.getDate() + days);
  return {
    ...session,
    currentDate: formatDate(current),
  };
}

/** Jump to a specific date */
export function jumpToDate(session: IFSession, targetDate: string): IFSession {
  return {
    ...session,
    currentDate: targetDate,
  };
}

/** Find the next pending event's date */
export function findNextEventDate(
  session: IFSession,
  events: TimelineEvent[],
): string | null {
  const pending = events
    .filter((e) => e.status === 'pending' && e.date > session.currentDate)
    .sort((a, b) => a.date.localeCompare(b.date));
  return pending.length > 0 ? pending[0].date : null;
}

/** Format a Date to YYYY-MM-DD */
function formatDate(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${dd}`;
}

// ─── Event status helpers ────────────────────────────────

/** Mark events as triggered/cancelled/mutated */
export function markEventStatus(
  events: TimelineEvent[],
  eventId: string,
  status: TimelineEvent['status'],
): TimelineEvent[] {
  return events.map((e) =>
    e.id === eventId ? { ...e, status } : e,
  );
}

/** Batch-mark multiple events */
export function markEventsStatus(
  events: TimelineEvent[],
  ids: string[],
  status: TimelineEvent['status'],
): TimelineEvent[] {
  const idSet = new Set(ids);
  return events.map((e) =>
    idSet.has(e.id) ? { ...e, status } : e,
  );
}
