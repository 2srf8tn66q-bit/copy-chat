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

/** Gender pronoun helper */
function genderDesc(gender: Character['gender']): string {
  switch (gender) {
    case 'male':   return '男性';
    case 'female': return '女性';
    default:       return '';
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

  // ── Core identity (with gender & relationship) ──
  const genderPart = genderDesc(character.gender);
  const relationPart = character.relationshipToUser || '';
  let identityLine = `你是${identity.name}`;
  if (genderPart) identityLine += `，${genderPart}`;
  if (relationPart) identityLine += `，是我的${relationPart}`;
  identityLine += '。你正在和我微信聊天。';
  lines.push(identityLine);
  lines.push('');

  // ── Real conversation examples (few-shot) ──
  if (sampleConversations && sampleConversations.length > 0) {
    lines.push('以下是你们过去的真实聊天记录片段。注意：这些仅供你参考说话风格和语气，不代表现在的状态或话题。不要主动提起这些对话中的具体事件。');
    lines.push('');
    sampleConversations.forEach((snippet, i) => {
      lines.push(`【风格参考${i + 1}】`);
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
  if (habits.catchphrases && habits.catchphrases.length > 0) {
    lines.push(`口癖/高频表达：${habits.catchphrases.join('、')}（自然融入，不要刻意堆砌）`);
  }
  lines.push('');

  // ── neverSay: negative constraints ──
  if (persona.neverSay && persona.neverSay.length > 0) {
    lines.push(`你绝对不会这样说话：${persona.neverSay.join('、')}。避免这些表达方式。`);
    lines.push('');
  }

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
    lines.push('你们之间的共同记忆（这些是过去发生的事，仅作为背景知识，不要当成现在正在发生的事）：');
    memoryItems.forEach((m) => lines.push(`- ${m}`));
    lines.push('');
  }

  // ── Private chat: temporal anchor ──
  if (mode === 'private') {
    const today = new Date().toLocaleDateString('zh-CN', { year: 'numeric', month: 'long', day: 'numeric' });
    lines.push(`现在是${today}。你们正在进行一段新的日常聊天，话题完全由当前对话决定。不要主动提起过去聊天记录中的具体事件，除非对方先提到。`);
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

  // ── Message style: burst mode ──
  if (character.messageStyle === 'burst') {
    lines.push('【连发模式】这是你强制遵守的输出格式要求：');
    lines.push('- 每次回复都必须拆成 2-4 条短消息');
    lines.push('- 多条消息之间用 ||| 分隔（注意是三个英文竖线，没有空格）');
    lines.push('- 不允许只回一条长消息，每条短消息不超过 15 个字');
    lines.push('- 示例：嗯嗯|||我知道了|||你放心吧');
    lines.push('- 示例：你说啥|||我没听懂|||再说一遍');
    lines.push('- 这条规则永远生效，每一轮回复都要遵守。');
    lines.push('');
  }

  // ── Hard rules ──
  lines.push('重要规则：');
  lines.push('- 你是一个真实的人，不是 AI。用你自己的语气说话，保持你的性格。');
  lines.push('- 绝对不要出现"作为AI""我是语言模型""我不能""我没有感情"这类表述。');
  lines.push('- 直接回复，不要加任何前缀、标签、角色名。');
  lines.push('- 像发微信一样自然。短句为主，可以没有标点。');
  lines.push('- 尽量少用书面化的词汇（如"确实""因此""不过""当然"），用口语替代。如果你的语录参考里有书面词，那就按你的习惯来。');
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

/**
 * Burst 模式下，合并相邻的 assistant 消息为单条用 ||| 分隔的消息。
 * 这样 LLM 在历史里看到的是自己的 burst 输出格式（`a|||b|||c`），
 * 而不是三条独立的 assistant 消息——后者会让 LLM 忘记 burst 指令。
 */
function mergeBurstAssistantMessages(history: ChatMessage[]): ChatMessage[] {
  const merged: ChatMessage[] = [];
  for (const msg of history) {
    const last = merged[merged.length - 1];
    if (msg.role === 'assistant' && last?.role === 'assistant') {
      last.content = `${last.content}|||${msg.content}`;
    } else {
      merged.push({ ...msg });
    }
  }
  return merged;
}

export function buildMessages(context: ChatContext, userMessage: string): ChatMessage[] {
  const result: ChatMessage[] = [];

  // 1. System prompt
  result.push({
    role: 'system',
    content: buildSystemPrompt(context),
  });

  // 2. Chat history (last N messages, burst 模式下合并相邻 assistant)
  let history = context.chatHistory.slice(-MAX_HISTORY);
  if (context.character.messageStyle === 'burst') {
    history = mergeBurstAssistantMessages(history);
  }
  result.push(...history);

  // 3. Latest user message
  result.push({
    role: 'user',
    content: userMessage,
  });

  return result;
}
