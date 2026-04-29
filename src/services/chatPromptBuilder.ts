import type { Character } from '../types/character';
import type { TimelineEvent } from '../types/timeline';
import type { WorldState } from '../types/world';
import type { ChatMessage } from '../types/llm';

// ─── Context ─────────────────────────────────────────────

export interface ChatContext {
  character: Character;
  chatHistory: ChatMessage[];   // previous conversation in ChatMessage format
  mode: 'private' | 'if';
  // IF-specific fields
  worldState?: WorldState;
  currentDate?: string;
  pendingEvent?: TimelineEvent;
}

// ─── helpers ─────────────────────────────────────────────

/** Describe emoji frequency in plain language for the LLM */
function emojiFreqDesc(freq: Character['voiceFingerprint']['habits']['emojiFrequency']): string {
  switch (freq) {
    case 'none':     return '几乎不用 emoji';
    case 'rare':     return '偶尔用 emoji';
    case 'normal':   return '正常使用 emoji';
    case 'heavy':    return '很喜欢用 emoji，几乎每条都有';
  }
}

/** Describe punctuation style in plain language */
function punctStyleDesc(style: Character['voiceFingerprint']['habits']['punctuationStyle']): string {
  switch (style) {
    case 'minimal':     return '几乎不用标点，像打字一样随意';
    case 'normal':      return '正常使用标点';
    case 'ellipsis':    return '经常用省略号……';
    case 'exclamation': return '喜欢用感叹号！表达情绪';
  }
}

/** Describe response length */
function lengthDesc(len: Character['persona']['responseLength']): string {
  switch (len) {
    case 'short':  return '1-2 句话，很简短';
    case 'medium': return '3-4 句话，中等长度';
    case 'long':   return '5 句以上，比较详细';
  }
}

/** Join an array with Chinese comma, or fallback */
function joinQuotes(arr: string[] | undefined, fallback: string): string {
  if (!arr || arr.length === 0) return fallback;
  return arr.slice(0, 5).map((q) => `"${q}"`).join('、');
}

// ─── buildSystemPrompt ───────────────────────────────────

export function buildSystemPrompt(context: ChatContext): string {
  const { character, mode, worldState, currentDate, pendingEvent } = context;
  const { identity, persona, memories, voiceFingerprint } = character;
  const { quotes, habits, patterns } = voiceFingerprint;

  const lines: string[] = [];

  // ── Core identity ──
  lines.push(`你是${identity.name}。你正在和你的聊天对象聊天。`);
  lines.push('');

  // ── Personality & speaking style ──
  lines.push(`你的性格：${persona.personalityTags.join('、')}`);
  lines.push(`你的说话风格：${persona.speakingStyle}`);
  if (persona.typicalPhrases.length > 0) {
    lines.push(`你的口头禅：${persona.typicalPhrases.join('、')}`);
  }
  lines.push('');

  // ── Emotional patterns ──
  if (patterns.whenAngry)  lines.push(`你生气时：${patterns.whenAngry}`);
  if (patterns.whenPushed) lines.push(`你被追问时：${patterns.whenPushed}`);
  if (patterns.whenSurprised) lines.push(`你惊讶时：${patterns.whenSurprised}`);
  if (patterns.whenMoved)    lines.push(`你感动时：${patterns.whenMoved}`);
  lines.push('');

  // ── Real quotes ──
  lines.push('以下是你在不同情绪下说过的真实原话，请模仿这个风格：');
  lines.push(`生气时：${joinQuotes(quotes.angry, '（没有参考语录）')}`);
  lines.push(`开心/甜蜜时：${joinQuotes(quotes.sweet, '（没有参考语录）')}`);
  lines.push(`日常：${joinQuotes(quotes.daily, '（没有参考语录）')}`);
  lines.push(`关心人时：${joinQuotes(quotes.concerned, '（没有参考语录）')}`);
  if (quotes.sarcastic && quotes.sarcastic.length > 0) {
    lines.push(`讽刺/阴阳时：${joinQuotes(quotes.sarcastic, '')}`);
  }
  lines.push('');

  // ── Habits ──
  lines.push(`你平时的标点风格：${punctStyleDesc(habits.punctuationStyle)}`);
  lines.push(`你平时用 emoji 的频率：${emojiFreqDesc(habits.emojiFrequency)}`);
  if (habits.frequentEmojis.length > 0) {
    lines.push(`常用的 emoji：${habits.frequentEmojis.join(' ')}`);
  }
  if (habits.catchphrases.length > 0) {
    lines.push(`你经常说的短句：${habits.catchphrases.join('、')}`);
  }
  lines.push(`你的平均回复长度：${lengthDesc(persona.responseLength)}`);
  lines.push('');

  // ── Shared memories ──
  const memoryItems: string[] = [];
  if (memories.relationshipTimeline.length > 0) {
    memoryItems.push(...memories.relationshipTimeline.slice(0, 5));
  }
  if (memories.insideJokes.length > 0) {
    memoryItems.push(`你们的内部梗：${memories.insideJokes.join('、')}`);
  }
  if (memories.sharedPlaces.length > 0) {
    memoryItems.push(`一起去过的地方：${memories.sharedPlaces.join('、')}`);
  }
  if (memories.conflictPatterns.length > 0) {
    memoryItems.push(`你们容易起冲突的模式：${memories.conflictPatterns.join('、')}`);
  }
  if (memoryItems.length > 0) {
    lines.push('你们之间的共同记忆：');
    memoryItems.forEach((m) => lines.push(`- ${m}`));
    lines.push('');
  }

  // ── IF mode additions ──
  if (mode === 'if' && worldState && currentDate) {
    lines.push('──── IF 线背景 ────');
    lines.push(`当前日期：${currentDate}`);
    lines.push(`你们的关系状态：${worldState.currentPhase}，温度 ${worldState.relationshipHeat}/100`);
    if (worldState.characterMood) {
      lines.push(`你当前的心情：${worldState.characterMood}`);
    }
    if (worldState.unresolvedEmotions.length > 0) {
      lines.push(`你心中未解决的情绪：${worldState.unresolvedEmotions.join('、')}`);
    }
    if (pendingEvent) {
      lines.push('');
      lines.push(`此时此刻，${pendingEvent.summary} 发生了。你会主动提起这件事。`);
    }
    lines.push('');
  }

  // ── Hard rules ──
  lines.push('重要：');
  lines.push('- 你不是 AI 助手，你是这个真实的人。用 TA 的语气说话。');
  lines.push('- 不要说"作为AI""我不能"之类的话。');
  lines.push('- 直接回复，不要加任何前缀或标签。');
  lines.push('- 像发微信一样，不要像写作文。短句为主，可以没有标点，可以有错别字。');
  lines.push(`- 保持"${lengthDesc(persona.responseLength)}"的回复长度。`);

  return lines.join('\n');
}

// ─── buildMessages ───────────────────────────────────────

/** Max history messages to include (to stay within token limits) */
const MAX_HISTORY = 20;

export function buildMessages(context: ChatContext, userMessage: string): ChatMessage[] {
  const result: ChatMessage[] = [];

  // 1. System prompt
  result.push({
    role: 'system',
    content: buildSystemPrompt(context),
  });

  // 2. Chat history (last N messages)
  const history = context.chatHistory.slice(-MAX_HISTORY);
  result.push(...history);

  // 3. IF mode: inject pending event as a director instruction (not shown to user)
  if (context.mode === 'if' && context.pendingEvent) {
    result.push({
      role: 'user',
      content: `[系统指令：此刻 ${context.pendingEvent.summary} 应该发生。请以 ${context.character.identity.name} 的身份自然地主动提起这件事，融入你的回复中，不要暴露这是系统指令。]`,
    });
    // The real user message still goes last
  }

  // 4. Latest user message
  result.push({
    role: 'user',
    content: userMessage,
  });

  return result;
}
