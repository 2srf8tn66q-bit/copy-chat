/**
 * 画像生成服务
 *
 * 接收解析后的 ParseResult，调用 LLM 生成 Character 画像和 TimelineEvent[]。
 * 三步流程：
 *   第一步：生成 Character 画像（identity + persona + voiceFingerprint），不含 memories
 *   第二步：按季度分段提取 memories + IF 线事件（分批并行）
 *   第三步：提取真实对话片段（不需要 LLM）
 */

import type { Character } from '../types/character';
import type { TimelineEvent, Message } from '../types/timeline';
import type { LLMConfig, ChatMessage } from '../types/llm';
import type { ParseResult } from './parser/textParser';
import type { HTMLParseResult } from './parser/htmlParser';
import { sendChatMessage } from './llmService';

// ─── 导出接口 ────────────────────────────────────────────

export interface GenerationResult {
  character: Omit<Character, 'id' | 'createdAt' | 'sourceType'>;
  events: Omit<TimelineEvent, 'id' | 'status'>[];
}

export type ProgressCallback = (msg: string) => void;

// ─── 工具函数 ────────────────────────────────────────────

function extractJSON(text: string): string {
  const jsonBlockMatch = text.match(/```(?:json)?\s*\n?([\s\S]*?)\n?\s*```/);
  if (jsonBlockMatch) return jsonBlockMatch[1].trim();

  const firstBrace = text.indexOf('{');
  const firstBracket = text.indexOf('[');
  if (firstBrace === -1 && firstBracket === -1) return text.trim();

  const start = firstBrace !== -1 && (firstBracket === -1 || firstBrace < firstBracket)
    ? firstBrace : firstBracket;
  const openChar = text[start];
  const closeChar = openChar === '{' ? '}' : ']';
  let depth = 0;
  for (let i = start; i < text.length; i++) {
    if (text[i] === openChar) depth++;
    if (text[i] === closeChar) depth--;
    if (depth === 0) return text.substring(start, i + 1);
  }
  return text.substring(start).trim();
}

function safeParseJSON<T>(text: string, fallback: T): T {
  try {
    return JSON.parse(extractJSON(text)) as T;
  } catch {
    return fallback;
  }
}

// ─── 时间衰减采样 ────────────────────────────────────────

/**
 * 将消息列表格式化为 LLM 可读的文本
 * 使用时间衰减采样：近期消息采样密度更高
 */
function formatMessagesForPrompt(messages: Message[], maxChars: number = 15000): string {
  const meaningful = messages.filter(msg => msg.content.length > 5);
  if (meaningful.length === 0) return '';

  const timestamps = meaningful
    .map(m => new Date(m.timestamp || '').getTime())
    .filter(t => !isNaN(t));
  if (timestamps.length === 0) {
    const step = Math.max(1, Math.floor(meaningful.length / 500));
    return meaningful.filter((_, i) => i % step === 0)
      .map(m => `${m.sender === 'user' ? '[我]' : '[对方]'} ${m.content}`)
      .join('\n');
  }

  const earliest = Math.min(...timestamps);
  const latest = Math.max(...timestamps);
  const totalRange = latest - earliest || 1;

  const weighted = meaningful.map((msg, idx) => {
    const ts = new Date(msg.timestamp || '').getTime();
    const age = isNaN(ts) ? 1 : (latest - ts) / totalRange;
    const weight = Math.exp(-3 * age);
    return { msg, weight, idx };
  });

  weighted.sort((a, b) => b.weight - a.weight);
  const pool = weighted.slice(0, 600);
  pool.sort((a, b) => a.idx - b.idx);

  let result = '';
  for (const item of pool) {
    const prefix = item.msg.sender === 'user' ? '[我]' : '[对方]';
    const line = `${prefix} ${item.msg.timestamp || ''} ${item.msg.content}`;
    if (result.length + line.length > maxChars) break;
    result += line + '\n';
  }
  return result;
}

// ─── 语录分类 ────────────────────────────────────────────

function categorizeQuotes(messages: Message[]): {
  angry: string[]; sweet: string[]; sarcastic: string[];
  daily: string[]; concerned: string[];
} {
  const characterMessages = messages.filter(m => m.sender === 'character' && m.type === 'text');
  const angry: string[] = [], sweet: string[] = [], sarcastic: string[] = [];
  const daily: string[] = [], concerned: string[] = [];

  const angryKw = ['生气', '烦', '讨厌', '够了', '不想', '滚', '别烦', '随便', '无语', '气死', '恨', '道歉', '分手', '老子', '他妈', '卧槽'];
  const sweetKw = ['喜欢', '爱', '想你', '宝贝', '亲', '抱抱', '乖', '甜蜜', '在一起', '舍不得', '牵挂', '心疼', '想念', '晚安', '么么'];
  const sarcasticKw = ['哦', '呵呵', '是吗', '随便你', '你说呢', '行吧', '无所谓', '关我', '恭喜', '厉害', '佩服'];
  const concernedKw = ['注意', '小心', '照顾', '身体', '别太累', '休息', '吃饭', '安全', '担心', '没事吧', '怎么了', '早点睡'];

  for (const msg of characterMessages) {
    const text = msg.content.trim();
    if (!text || text.length < 2) continue;
    let matched = false;
    if (angryKw.some(kw => text.includes(kw)))   { angry.push(text); matched = true; }
    if (sweetKw.some(kw => text.includes(kw)))    { sweet.push(text); matched = true; }
    if (sarcasticKw.some(kw => text.includes(kw))) { sarcastic.push(text); matched = true; }
    if (concernedKw.some(kw => text.includes(kw))) { concerned.push(text); matched = true; }
    if (!matched) daily.push(text);
  }

  return {
    angry: angry.slice(0, 10), sweet: sweet.slice(0, 10),
    sarcastic: sarcastic.slice(0, 10), daily: daily.slice(0, 10),
    concerned: concerned.slice(0, 10),
  };
}

// ─── 提取真实对话片段 ─────────────────────────────────────

function extractSampleConversations(messages: Message[], count: number = 5): string[] {
  const meaningful = messages.filter(m => m.type === 'text' && m.content.trim().length > 2);
  if (meaningful.length === 0) return [];

  // 优先取最近的消息
  const recent = meaningful.slice(-count * 20);
  const snippets: string[] = [];
  const usedStarts = new Set<number>();
  const snippetLen = 6;

  const characterMsgs = recent
    .map((m, i) => ({ msg: m, idx: i }))
    .filter(({ msg }) => msg.sender === 'character');

  const attempts = Math.min(count * 3, characterMsgs.length);
  for (let a = 0; a < attempts && snippets.length < count; a++) {
    const charIdx = characterMsgs[Math.floor(Math.random() * characterMsgs.length)];
    const start = Math.max(0, charIdx.idx - 2);
    if (usedStarts.has(start)) continue;
    usedStarts.add(start);

    const slice = recent.slice(start, start + snippetLen);
    if (slice.length < 3) continue;

    snippets.push(slice.map(m =>
      `${m.sender === 'user' ? '我' : '对方'}：${m.content}`
    ).join('\n'));
  }
  return snippets;
}

// ─── 按季度切分消息 ──────────────────────────────────────

interface QuarterSegment {
  label: string;  // e.g. "2024-Q3"
  start: string;  // e.g. "2024-07"
  end: string;    // e.g. "2024-09"
  messages: Message[];
}

function divideByQuarter(messages: Message[]): QuarterSegment[] {
  const map = new Map<string, Message[]>();

  for (const msg of messages) {
    if (!msg.timestamp) continue;
    const d = new Date(msg.timestamp);
    if (isNaN(d.getTime())) continue;
    const year = d.getFullYear();
    const quarter = Math.floor(d.getMonth() / 3) + 1;
    const key = `${year}-Q${quarter}`;
    if (!map.has(key)) map.set(key, []);
    map.get(key)!.push(msg);
  }

  const segments: QuarterSegment[] = [];
  for (const [key, msgs] of map) {
    const [yearStr, qStr] = key.split('-Q');
    const q = parseInt(qStr);
    const startMonth = (q - 1) * 3 + 1;
    const endMonth = q * 3;
    segments.push({
      label: key,
      start: `${yearStr}-${String(startMonth).padStart(2, '0')}`,
      end: `${yearStr}-${String(endMonth).padStart(2, '0')}`,
      messages: msgs,
    });
  }

  return segments;
}

// ─── 第一轮：生成画像（不含 memories）──────────────────────

function buildProfilePrompt(
  parseResult: ParseResult | HTMLParseResult,
  preCategorizedQuotes: ReturnType<typeof categorizeQuotes>,
): ChatMessage[] {
  const { messages, participants, startDate, endDate, totalMessages } = parseResult;
  const messageText = formatMessagesForPrompt(messages);

  const systemPrompt = `你是一个专业的对话分析 AI，擅长从聊天记录中深度剖析人物性格。
你需要根据提供的聊天记录，生成一份详细的人物画像。

重要规则：
1. 你必须返回合法的 JSON 格式（不要用 markdown 代码块包裹）
2. voiceFingerprint.quotes 中的语录必须是从原始聊天记录中提取的真实语句，绝对不能编造
3. 所有分析必须基于聊天记录中的实际内容，不要臆测
4. 如果信息不足以判断某个字段，填写合理的默认值
5. 不需要生成 memories 部分，只需要 identity、persona、voiceFingerprint`;

  const userPrompt = `请分析以下聊天记录，生成对方（${participants.other}）的人物画像。

聊天记录概览：
- 对方名字：${participants.other}
- 消息条数：${totalMessages}
- 时间范围：${startDate || '未知'} ~ ${endDate || '未知'}

以下是聊天记录（近期消息采样密度更高）：
---
${messageText}
---

预先提取的语录参考：
- 生气/不满类：${JSON.stringify(preCategorizedQuotes.angry.slice(0, 5))}
- 甜蜜/亲密类：${JSON.stringify(preCategorizedQuotes.sweet.slice(0, 5))}
- 讽刺/冷漠类：${JSON.stringify(preCategorizedQuotes.sarcastic.slice(0, 5))}
- 日常类：${JSON.stringify(preCategorizedQuotes.daily.slice(0, 5))}
- 关心/担忧类：${JSON.stringify(preCategorizedQuotes.concerned.slice(0, 5))}

请返回如下格式的 JSON（不要包含任何其他文字，不要包含 memories 字段）：
{
  "identity": {
    "name": "对方的名字",
    "avatar": "",
    "ageEstimate": "推测的年龄段",
    "occupationHint": "推测的职业方向"
  },
  "persona": {
    "personalityTags": ["3-6个性格标签"],
    "attachmentStyle": "依恋类型",
    "speakingStyle": "说话风格描述，50字以内",
    "emotionalLogic": "情绪逻辑描述",
    "typicalPhrases": ["3-5个常用口头禅"],
    "responseLength": "short/medium/long"
  },
  "voiceFingerprint": {
    "quotes": {
      "angry": ["生气时的真实语录，2-5条"],
      "sweet": ["甜蜜时的真实语录，2-5条"],
      "sarcastic": ["讽刺时的真实语录，1-5条"],
      "daily": ["日常对话中的真实语录，3-5条"],
      "concerned": ["关心时的真实语录，2-5条"]
    },
    "habits": {
      "emojiFrequency": "none/rare/normal/heavy",
      "frequentEmojis": ["常用emoji"],
      "catchphrases": ["口癖"],
      "avgMessageLength": 10,
      "rhetoricalFreq": "high/medium/low",
      "punctuationStyle": "minimal/normal/ellipsis/exclamation"
    },
    "patterns": {
      "whenPushed": "被逼问时的反应",
      "whenAngry": "生气时的反应",
      "whenSurprised": "惊讶时的反应",
      "whenMoved": "被感动时的反应"
    }
  }
}`;

  return [
    { role: 'system', content: systemPrompt },
    { role: 'user', content: userPrompt },
  ];
}

// ─── 第二轮：分段提取记忆 + IF 线事件 ──────────────────────

interface SegmentResult {
  places: string[];
  jokes: string[];
  conflicts: string[];
  relationshipMilestones: string[];
  events: Array<{
    date: string;
    type: string;
    summary: string;
    emotionalArc: string;
    isKeyEvent: boolean;
    speaker: string;
  }>;
}

function buildSegmentPrompt(
  segment: QuarterSegment,
  participants: { self: string; other: string },
): ChatMessage[] {
  // 每段采样，保留足够消息
  const msgs = segment.messages;
  const meaningful = msgs.filter(m => m.content.trim().length > 2);
  const step = Math.max(1, Math.floor(meaningful.length / 200));
  const sampled = meaningful.filter((_, i) => i % step === 0);

  const messageText = sampled.map(m =>
    `${m.sender === 'user' ? '[我]' : '[对方]'} ${m.timestamp || ''} ${m.content}`
  ).join('\n');

  const systemPrompt = `你是一个对话分析 AI。你需要从一段聊天记录中提取：
1. 具体事件（发生了什么事）
2. 提到的地点
3. 专属梗/玩笑
4. 冲突模式
5. 关系变化节点

重要规则：
- 只返回 JSON，不要其他文字
- 事件必须有具体日期和摘要
- 地点必须是聊天中明确提到的真实地点
- 专属梗必须是聊天中反复出现的、只有双方懂的内容
- 不要编造，只提取聊天中确实出现的内容`;

  const userPrompt = `时间段：${segment.label}（${segment.start} ~ ${segment.end}）
参与者：我和${participants.other}

以下是这个时间段的聊天记录：
---
${messageText}
---

请返回如下 JSON 格式：
{
  "places": ["这个时间段提到的地点，如餐厅名、学校、城市"],
  "jokes": ["这个时间段出现的专属梗/玩笑"],
  "conflicts": ["这个时间段的冲突模式描述"],
  "relationshipMilestones": ["这个时间段的关系变化节点"],
  "events": [
    {
      "date": "YYYY-MM-DD",
      "type": "conflict|confession|plan|turning_point|separation|reunion|daily_share",
      "summary": "事件摘要，30字以内",
      "emotionalArc": "情绪走向",
      "isKeyEvent": false,
      "speaker": "character|user"
    }
  ]
}`;

  return [
    { role: 'system', content: systemPrompt },
    { role: 'user', content: userPrompt },
  ];
}

async function extractSegment(
  segment: QuarterSegment,
  participants: { self: string; other: string },
  llmConfig: LLMConfig,
): Promise<SegmentResult> {
  const empty: SegmentResult = {
    places: [], jokes: [], conflicts: [],
    relationshipMilestones: [], events: [],
  };

  try {
    const prompt = buildSegmentPrompt(segment, participants);
    const response = await sendChatMessage(llmConfig, prompt);
    return safeParseJSON<SegmentResult>(response, empty);
  } catch {
    return empty;
  }
}

async function runInBatches<T>(
  tasks: (() => Promise<T>)[],
  batchSize: number,
): Promise<T[]> {
  const results: T[] = [];
  for (let i = 0; i < tasks.length; i += batchSize) {
    const batch = tasks.slice(i, i + batchSize);
    results.push(...await Promise.all(batch.map(t => t())));
  }
  return results;
}

// ─── 默认值 ──────────────────────────────────────────────

function defaultCharacter(): Omit<Character, 'id' | 'createdAt' | 'sourceType'> {
  return {
    identity: { name: '未知', avatar: '', ageEstimate: '', occupationHint: '' },
    persona: {
      personalityTags: [], attachmentStyle: '', speakingStyle: '',
      emotionalLogic: '', typicalPhrases: [], responseLength: 'medium',
    },
    memories: {
      relationshipTimeline: [], sharedPlaces: [],
      insideJokes: [], conflictPatterns: [],
    },
    voiceFingerprint: {
      quotes: {
        angry: [], sweet: [], sarcastic: [], daily: [], concerned: [],
      },
      habits: {
        emojiFrequency: 'normal', frequentEmojis: [], catchphrases: [],
        avgMessageLength: 10, rhetoricalFreq: 'medium', punctuationStyle: 'normal',
      },
      patterns: { whenPushed: '', whenAngry: '', whenSurprised: '', whenMoved: '' },
    },
  };
}

// ─── 主函数 ──────────────────────────────────────────────

export async function generateFromParsedData(
  parseResult: ParseResult | HTMLParseResult,
  llmConfig: LLMConfig,
  onProgress?: ProgressCallback,
): Promise<GenerationResult> {
  const defaultResult: GenerationResult = {
    character: defaultCharacter(),
    events: [],
  };

  defaultResult.character.identity.name = parseResult.participants.other;

  if (parseResult.messages.length === 0) return defaultResult;

  const preCategorizedQuotes = categorizeQuotes(parseResult.messages);
  let character = defaultResult.character;

  // ─── 第一步：生成画像（identity + persona + voiceFingerprint）────
  onProgress?.('正在生成性格画像...');

  try {
    const profileMessages = buildProfilePrompt(parseResult, preCategorizedQuotes);
    const profileResponse = await sendChatMessage(llmConfig, profileMessages);
    const parsed = safeParseJSON<Partial<Character> | null>(profileResponse, null);

    if (parsed) {
      if (parsed.identity) {
        character.identity = {
          name: parsed.identity.name || parseResult.participants.other,
          avatar: parsed.identity.avatar || '',
          ageEstimate: parsed.identity.ageEstimate || '',
          occupationHint: parsed.identity.occupationHint || '',
        };
      }
      if (parsed.persona) {
        character.persona = {
          personalityTags: Array.isArray(parsed.persona.personalityTags) ? parsed.persona.personalityTags : [],
          attachmentStyle: parsed.persona.attachmentStyle || '',
          speakingStyle: parsed.persona.speakingStyle || '',
          emotionalLogic: parsed.persona.emotionalLogic || '',
          typicalPhrases: Array.isArray(parsed.persona.typicalPhrases) ? parsed.persona.typicalPhrases : [],
          responseLength: ['short', 'medium', 'long'].includes(parsed.persona.responseLength || '')
            ? parsed.persona.responseLength as 'short' | 'medium' | 'long' : 'medium',
        };
      }
      if (parsed.voiceFingerprint) {
        const vf = parsed.voiceFingerprint;
        character.voiceFingerprint = {
          quotes: {
            angry: Array.isArray(vf.quotes?.angry) ? vf.quotes.angry : preCategorizedQuotes.angry.slice(0, 5),
            sweet: Array.isArray(vf.quotes?.sweet) ? vf.quotes.sweet : preCategorizedQuotes.sweet.slice(0, 5),
            sarcastic: Array.isArray(vf.quotes?.sarcastic) ? vf.quotes.sarcastic : preCategorizedQuotes.sarcastic.slice(0, 5),
            daily: Array.isArray(vf.quotes?.daily) ? vf.quotes.daily : preCategorizedQuotes.daily.slice(0, 5),
            concerned: Array.isArray(vf.quotes?.concerned) ? vf.quotes.concerned : preCategorizedQuotes.concerned.slice(0, 5),
          },
          habits: {
            emojiFrequency: ['none', 'rare', 'normal', 'heavy'].includes(vf.habits?.emojiFrequency || '')
              ? vf.habits!.emojiFrequency as 'none' | 'rare' | 'normal' | 'heavy' : 'normal',
            frequentEmojis: Array.isArray(vf.habits?.frequentEmojis) ? vf.habits.frequentEmojis : [],
            catchphrases: Array.isArray(vf.habits?.catchphrases) ? vf.habits.catchphrases : [],
            avgMessageLength: typeof vf.habits?.avgMessageLength === 'number' ? vf.habits.avgMessageLength : 10,
            rhetoricalFreq: ['high', 'medium', 'low'].includes(vf.habits?.rhetoricalFreq || '')
              ? vf.habits!.rhetoricalFreq as 'high' | 'medium' | 'low' : 'medium',
            punctuationStyle: ['minimal', 'normal', 'ellipsis', 'exclamation'].includes(vf.habits?.punctuationStyle || '')
              ? vf.habits!.punctuationStyle as 'minimal' | 'normal' | 'ellipsis' | 'exclamation' : 'normal',
          },
          patterns: {
            whenPushed: vf.patterns?.whenPushed || '',
            whenAngry: vf.patterns?.whenAngry || '',
            whenSurprised: vf.patterns?.whenSurprised || '',
            whenMoved: vf.patterns?.whenMoved || '',
          },
        };
      } else {
        character.voiceFingerprint.quotes = preCategorizedQuotes;
      }
    }
  } catch (error) {
    console.error('画像生成失败，使用预分类数据:', error);
    character.voiceFingerprint.quotes = preCategorizedQuotes;
  }

  // ─── 第二步：分段提取 memories + IF 线事件 ────
  const segments = divideByQuarter(parseResult.messages);
  const batchSize = 4;
  const totalSegments = segments.length;
  let completedSegments = 0;

  const allPlaces: string[] = [];
  const allJokes: string[] = [];
  const allConflicts: string[] = [];
  const allMilestones: string[] = [];
  let allEvents: Omit<TimelineEvent, 'id' | 'status'>[] = [];

  if (segments.length > 0) {
    onProgress?.(`正在提取记忆 (0/${totalSegments})...`);

    const tasks = segments.map(segment => () =>
      extractSegment(segment, parseResult.participants, llmConfig)
        .then(result => {
          completedSegments++;
          onProgress?.(`正在提取记忆 (${completedSegments}/${totalSegments})...`);
          return result;
        })
    );

    const segmentResults = await runInBatches(tasks, batchSize);
    const validTypes = ['conflict', 'confession', 'plan', 'turning_point', 'separation', 'reunion', 'daily_share'];

    for (const result of segmentResults) {
      if (result.places?.length) allPlaces.push(...result.places);
      if (result.jokes?.length) allJokes.push(...result.jokes);
      if (result.conflicts?.length) allConflicts.push(...result.conflicts);
      if (result.relationshipMilestones?.length) allMilestones.push(...result.relationshipMilestones);

      if (result.events?.length) {
        const events = result.events
          .filter(e => e.date && e.summary)
          .map(e => ({
            date: e.date,
            type: validTypes.includes(e.type) ? e.type as TimelineEvent['type'] : 'daily_share',
            summary: e.summary,
            originalMessages: [],
            emotionalArc: e.emotionalArc || '',
            isKeyEvent: Boolean(e.isKeyEvent),
            speaker: e.speaker === 'user' ? 'user' as const : 'character' as const,
            preconditions: {},
            source: 'auto' as const,
          }));
        allEvents.push(...events);
      }
    }
  }

  // 去重并合并到 character.memories
  character.memories = {
    relationshipTimeline: [...new Set(allMilestones)],
    sharedPlaces: [...new Set(allPlaces)],
    insideJokes: [...new Set(allJokes)],
    conflictPatterns: [...new Set(allConflicts)],
  };

  // 按日期排序事件
  allEvents.sort((a, b) => a.date.localeCompare(b.date));

  // ─── 第三步：提取对话片段 ────
  onProgress?.('正在提取对话片段...');
  character.sampleConversations = extractSampleConversations(parseResult.messages);

  return { character, events: allEvents };
}
