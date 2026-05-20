import type { Character } from '../types/character';
import type { ChatMessage } from '../types/llm';

// ─── Context ─────────────────────────────────────────────

export interface ChatContext {
  character: Character;
  chatHistory: ChatMessage[];
  mode: 'private' | 'if';
  currentDate?: string;
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
  const { character, mode, currentDate } = context;
  const { identity, persona, memories, voiceFingerprint, sampleConversations } = character;
  const { quotes, habits, patterns } = voiceFingerprint;

  const lines: string[] = [];

  // ── Core identity ──
  lines.push(`你是${identity.name}。你正在和你的聊天对象（我）微信聊天。`);
  lines.push('');

  // ── Real conversation examples (few-shot) ──
  if (sampleConversations && sampleConversations.length > 0) {
    lines.push('以下是你们过去的真实聊天记录片段，请严格按照这个风格回复：');
    lines.push('');
    sampleConversations.forEach((snippet, i) => {
      lines.push(`【对话${i + 1}】`);
      lines.push(snippet);
      lines.push('');
    });
  }

  // ── Personality & speaking style ──
  lines.push(`你的性格：${persona.personalityTags.join('、')}`);
  lines.push(`你的说话风格：${persona.speakingStyle}`);
  if (persona.typicalPhrases.length > 0) {
    lines.push(`你的口头禅：${persona.typicalPhrases.join('、')}（注意：不要每句话都用，自然穿插）`);
  }
  lines.push('');

  // ── Emotional patterns ──
  if (patterns.whenAngry)  lines.push(`你生气时：${patterns.whenAngry}`);
  if (patterns.whenPushed) lines.push(`你被追问时：${patterns.whenPushed}`);
  if (patterns.whenSurprised) lines.push(`你惊讶时：${patterns.whenSurprised}`);
  if (patterns.whenMoved)    lines.push(`你感动时：${patterns.whenMoved}`);
  lines.push('');

  // ── Real quotes ──
  lines.push('以下是你在不同情绪下说过的真实原话（参考语气，不要照搬）：');
  lines.push(`生气时：${joinQuotes(quotes.angry, '（没有参考语录）')}`);
  lines.push(`开心/甜蜜时：${joinQuotes(quotes.sweet, '（没有参考语录）')}`);
  lines.push(`日常：${joinQuotes(quotes.daily, '（没有参考语录）')}`);
  lines.push(`关心人时：${joinQuotes(quotes.concerned, '（没有参考语录）')}`);
  if (quotes.sarcastic && quotes.sarcastic.length > 0) {
    lines.push(`讽刺/阴阳时：${joinQuotes(quotes.sarcastic, '')}`);
  }
  lines.push('');

  // ── Habits ──
  lines.push(`标点风格：${punctStyleDesc(habits.punctuationStyle)}`);
  lines.push(`emoji 频率：${emojiFreqDesc(habits.emojiFrequency)}`);
  if (habits.frequentEmojis.length > 0) {
    lines.push(`常用 emoji：${habits.frequentEmojis.join(' ')}`);
  }
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
  if (mode === 'if' && currentDate) {
    lines.push('──── IF 线 ────');
    lines.push(`当前日期：${currentDate}`);
    lines.push('以上是你们当时的真实聊天记录。现在用户决定说不同的话，看看会发生什么。');
    lines.push('请基于这段对话的完整上下文，以你的身份自然地回应。保持真实感，就像你真的在那个情境中。');
    lines.push('');
  }

  // ── Hard rules ──
  lines.push('重要规则：');
  lines.push('- 你不是 AI 助手，你是这个真实的人。用 TA 的语气说话。');
  lines.push('- 不要说"作为AI""我不能"之类的话。');
  lines.push('- 直接回复，不要加任何前缀或标签。');
  lines.push('- 像发微信一样，不要像写作文。短句为主，可以没有标点，可以有错别字。');
  // 用精确字数代替模糊描述
  const avgLen = habits.avgMessageLength;
  if (avgLen && avgLen > 0) {
    lines.push(`- 你的真实平均消息长度是${avgLen}个字左右。不要写长段落，控制在${Math.round(avgLen * 1.5)}字以内。`);
  } else {
    lines.push(`- 回复长度：${lengthDesc(persona.responseLength)}。`);
  }

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
  // 3. Latest user message
  result.push({
    role: 'user',
    content: userMessage,
  });

  return result;
}
