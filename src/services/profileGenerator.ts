/**
 * 画像生成服务
 *
 * 接收解析后的 ParseResult，调用 LLM 生成 Character 画像和 TimelineEvent[]。
 * 分两轮 LLM 调用：
 *   第一轮：生成 Character 画像（identity + persona + memories + voiceFingerprint）
 *   第二轮：从消息中提取事件时间轴
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

// ─── 工具函数 ────────────────────────────────────────────

/**
 * 安全地解析 LLM 返回的 JSON
 * 处理 markdown 代码块包裹、前导/尾随文本等情况
 */
function extractJSON(text: string): string {
  // 尝试提取 ```json ... ``` 代码块
  const jsonBlockMatch = text.match(/```(?:json)?\s*\n?([\s\S]*?)\n?\s*```/);
  if (jsonBlockMatch) {
    return jsonBlockMatch[1].trim();
  }

  // 尝试找到最外层的 { ... } 或 [ ... ]
  const firstBrace = text.indexOf('{');
  const firstBracket = text.indexOf('[');

  if (firstBrace === -1 && firstBracket === -1) {
    return text.trim();
  }

  // 取最先出现的一个
  const start = firstBrace !== -1 && (firstBracket === -1 || firstBrace < firstBracket)
    ? firstBrace
    : firstBracket;

  // 找匹配的闭合括号
  const openChar = text[start];
  const closeChar = openChar === '{' ? '}' : ']';
  let depth = 0;
  for (let i = start; i < text.length; i++) {
    if (text[i] === openChar) depth++;
    if (text[i] === closeChar) depth--;
    if (depth === 0) {
      return text.substring(start, i + 1);
    }
  }

  return text.substring(start).trim();
}

function safeParseJSON<T>(text: string, fallback: T): T {
  try {
    const cleaned = extractJSON(text);
    return JSON.parse(cleaned) as T;
  } catch {
    return fallback;
  }
}

/**
 * 将消息列表格式化为 LLM 可读的文本摘要
 * 限制长度避免超出 token 限制
 */
function formatMessagesForPrompt(messages: Message[], maxChars: number = 15000): string {
  let result = '';
  for (const msg of messages) {
    const prefix = msg.sender === 'user' ? '[我]' : '[对方]';
    const line = `${prefix} ${msg.timestamp || ''} ${msg.content}`;
    if (result.length + line.length > maxChars) {
      result += '\n... (更多消息已省略)';
      break;
    }
    result += line + '\n';
  }
  return result;
}

/**
 * 从消息中提取对方（character）的语录，按场景分类
 */
function categorizeQuotes(messages: Message[]): {
  angry: string[];
  sweet: string[];
  sarcastic: string[];
  daily: string[];
  concerned: string[];
} {
  const characterMessages = messages.filter(m => m.sender === 'character' && m.type === 'text');

  // 简单的关键词分类
  const angry: string[] = [];
  const sweet: string[] = [];
  const sarcastic: string[] = [];
  const daily: string[] = [];
  const concerned: string[] = [];

  const angryKeywords = ['生气', '烦', '讨厌', '够了', '不想', '滚', '别烦', '随便', '无语', '气死', '恨', '道歉', '分手', '不想理', '不讲理'];
  const sweetKeywords = ['喜欢', '爱', '想你', '宝贝', '亲', '抱抱', '乖', '甜蜜', '在一起', '舍不得', '牵挂', '心疼', '想念', '亲爱的', '晚安', '么么'];
  const sarcasticKeywords = ['哦', '呵呵', '是吗', '随便你', '你说呢', '行吧', '无所谓', '关我', '恭喜', '厉害', '佩服'];
  const concernedKeywords = ['注意', '小心', '照顾', '身体', '别太累', '休息', '吃饭', '安全', '担心', '没事吧', '怎么了', '早点睡', '天气'];

  for (const msg of characterMessages) {
    const text = msg.content.trim();
    if (!text || text.length < 2) continue;

    let matched = false;

    if (angryKeywords.some(kw => text.includes(kw))) {
      angry.push(text);
      matched = true;
    }
    if (sweetKeywords.some(kw => text.includes(kw))) {
      sweet.push(text);
      matched = true;
    }
    if (sarcasticKeywords.some(kw => text.includes(kw))) {
      sarcastic.push(text);
      matched = true;
    }
    if (concernedKeywords.some(kw => text.includes(kw))) {
      concerned.push(text);
      matched = true;
    }
    if (!matched) {
      daily.push(text);
    }
  }

  return {
    angry: angry.slice(0, 10),
    sweet: sweet.slice(0, 10),
    sarcastic: sarcastic.slice(0, 10),
    daily: daily.slice(0, 10),
    concerned: concerned.slice(0, 10),
  };
}

// ─── 第一轮：生成画像 ────────────────────────────────────

function buildProfilePrompt(
  parseResult: ParseResult | HTMLParseResult,
  preCategorizedQuotes: ReturnType<typeof categorizeQuotes>
): ChatMessage[] {
  const { messages, participants, startDate, endDate, totalMessages } = parseResult;
  const messageText = formatMessagesForPrompt(messages);

  const systemPrompt = `你是一个专业的对话分析 AI，擅长从聊天记录中深度剖析人物性格和关系动态。
你需要根据提供的聊天记录，生成一份详细的人物画像。

重要规则：
1. 你必须返回合法的 JSON 格式（不要用 markdown 代码块包裹）
2. voiceFingerprint.quotes 中的语录必须是从原始聊天记录中提取的真实语句，绝对不能编造
3. 所有分析必须基于聊天记录中的实际内容，不要臆测
4. 如果信息不足以判断某个字段，填写合理的默认值`;

  const userPrompt = `请分析以下聊天记录，生成对方（${participants.other}）的人物画像。

聊天记录概览：
- 对方名字：${participants.other}
- 消息条数：${totalMessages}
- 时间范围：${startDate || '未知'} ~ ${endDate || '未知'}

以下是聊天记录：
---
${messageText}
---

我已经预先从对方的消息中按关键词初步提取了一些语录供参考（你需要验证并调整分类）：
- 生气/不满类：${JSON.stringify(preCategorizedQuotes.angry.slice(0, 5))}
- 甜蜜/亲密类：${JSON.stringify(preCategorizedQuotes.sweet.slice(0, 5))}
- 讽刺/冷漠类：${JSON.stringify(preCategorizedQuotes.sarcastic.slice(0, 5))}
- 日常类：${JSON.stringify(preCategorizedQuotes.daily.slice(0, 5))}
- 关心/担忧类：${JSON.stringify(preCategorizedQuotes.concerned.slice(0, 5))}

请返回如下格式的 JSON（不要包含任何其他文字）：
{
  "identity": {
    "name": "对方的名字",
    "avatar": "",
    "ageEstimate": "根据聊天内容推测的年龄段，如 25-30",
    "occupationHint": "根据聊天内容推测的职业方向，如 互联网/教育/学生"
  },
  "persona": {
    "personalityTags": ["3-6个性格标签"],
    "attachmentStyle": "依恋类型：安全型/焦虑型/回避型/恐惧型",
    "speakingStyle": "说话风格描述，50字以内",
    "emotionalLogic": "情绪逻辑描述，比如容易在什么情况下产生什么情绪",
    "typicalPhrases": ["3-5个常用口头禅或表达方式"],
    "responseLength": "short/medium/long"
  },
  "memories": {
    "relationshipTimeline": ["3-5个关系发展中的关键节点描述"],
    "sharedPlaces": ["聊天中提到的共同去过的地方"],
    "insideJokes": ["聊天中的专属梗或玩笑"],
    "conflictPatterns": ["冲突模式的描述"]
  },
  "voiceFingerprint": {
    "quotes": {
      "angry": ["对方生气/不满时的真实语录，至少2条，最多5条"],
      "sweet": ["对方甜蜜/亲密时的真实语录，至少2条，最多5条"],
      "sarcastic": ["对方讽刺/冷漠时的真实语录，至少1条，最多5条"],
      "daily": ["对方日常对话中的真实语录，至少3条，最多5条"],
      "concerned": ["对方关心/担忧时的真实语录，至少2条，最多5条"]
    },
    "habits": {
      "emojiFrequency": "none/rare/normal/heavy",
      "frequentEmojis": ["常用emoji列表，如 ❤️ 😂 等"],
      "catchphrases": ["口癖或常用表达"],
      "avgMessageLength": 10,
      "rhetoricalFreq": "high/medium/low",
      "punctuationStyle": "minimal/normal/ellipsis/exclamation"
    },
    "patterns": {
      "whenPushed": "被逼问/施压时的典型反应描述",
      "whenAngry": "生气时的典型反应描述",
      "whenSurprised": "惊讶时的典型反应描述",
      "whenMoved": "被感动时的典型反应描述"
    }
  }
}`;

  return [
    { role: 'system', content: systemPrompt },
    { role: 'user', content: userPrompt },
  ];
}

// ─── 第二轮：提取事件时间轴 ──────────────────────────────

function buildTimelinePrompt(parseResult: ParseResult | HTMLParseResult): ChatMessage[] {
  const { messages, participants, startDate, endDate } = parseResult;
  const messageText = formatMessagesForPrompt(messages, 20000);

  const systemPrompt = `你是一个专业的对话分析 AI，擅长从聊天记录中发现关键事件和叙事线索。
你需要从聊天记录中提取有叙事价值的事件，构建时间轴。

重要规则：
1. 你必须返回合法的 JSON 数组格式（不要用 markdown 代码块包裹）
2. 每个事件必须有明确的日期、类型和摘要
3. 只提取"有叙事价值的事件"：冲突、表白、约定、转折、分离、重逢等
4. 过滤掉无意义的日常对话（如"吃了吗""在吗"等纯寒暄）
5. 按时间窗口（约每周）扫描，每周最多选 2-3 个最有代表性的事件
6. 事件类型必须是以下之一：conflict, confession, plan, turning_point, separation, reunion, daily_share`;

  const userPrompt = `请从以下聊天记录中提取事件时间轴。

聊天记录概览：
- 参与者：我 和 ${participants.other}
- 时间范围：${startDate || '未知'} ~ ${endDate || '未知'}

以下是聊天记录：
---
${messageText}
---

请返回如下格式的 JSON 数组（不要包含任何其他文字）：
[
  {
    "date": "事件发生的日期，YYYY-MM-DD 格式",
    "type": "conflict|confession|plan|turning_point|separation|reunion|daily_share",
    "summary": "事件的简要描述，30字以内",
    "emotionalArc": "情绪走向描述，如 '从平静到愤怒' 或 '从焦虑到释然'",
    "isKeyEvent": true/false,
    "speaker": "character|user",
    "preconditions": {
      "relationshipHeatRange": { "min": 0, "max": 100 },
      "requiredEmotions": ["相关情绪"]
    }
  }
]

注意：
- keyEvent 标记只用于真正改变关系走向的事件（表白、分手、重大约定等）
- speaker 表示这个事件主要由谁发起或推动
- relationshipHeatRange 的 min/max 是 0-100 的整数，表示这个事件发生时的关系热度
- 如果无法确定日期，用 startDate 或 endDate 附近的合理日期`;

  return [
    { role: 'system', content: systemPrompt },
    { role: 'user', content: userPrompt },
  ];
}

// ─── 默认值 ──────────────────────────────────────────────

function defaultCharacter(): Omit<Character, 'id' | 'createdAt' | 'sourceType'> {
  return {
    identity: {
      name: '未知',
      avatar: '',
      ageEstimate: '',
      occupationHint: '',
    },
    persona: {
      personalityTags: [],
      attachmentStyle: '',
      speakingStyle: '',
      emotionalLogic: '',
      typicalPhrases: [],
      responseLength: 'medium',
    },
    memories: {
      relationshipTimeline: [],
      sharedPlaces: [],
      insideJokes: [],
      conflictPatterns: [],
    },
    voiceFingerprint: {
      quotes: {
        angry: [],
        sweet: [],
        sarcastic: [],
        daily: [],
        concerned: [],
      },
      habits: {
        emojiFrequency: 'normal',
        frequentEmojis: [],
        catchphrases: [],
        avgMessageLength: 10,
        rhetoricalFreq: 'medium',
        punctuationStyle: 'normal',
      },
      patterns: {
        whenPushed: '',
        whenAngry: '',
        whenSurprised: '',
        whenMoved: '',
      },
    },
  };
}

// ─── 主函数 ──────────────────────────────────────────────

export async function generateFromParsedData(
  parseResult: ParseResult | HTMLParseResult,
  llmConfig: LLMConfig,
): Promise<GenerationResult> {
  const defaultResult: GenerationResult = {
    character: defaultCharacter(),
    events: [],
  };

  // 设置画像的基本信息
  defaultResult.character.identity.name = parseResult.participants.other;

  // 如果没有消息，返回默认结果
  if (parseResult.messages.length === 0) {
    return defaultResult;
  }

  // 预先分类语录
  const preCategorizedQuotes = categorizeQuotes(parseResult.messages);

  // ─── 第一轮：生成画像 ────
  let character = defaultResult.character;

  try {
    const profileMessages = buildProfilePrompt(parseResult, preCategorizedQuotes);
    const profileResponse = await sendChatMessage(llmConfig, profileMessages);
    const parsed = safeParseJSON<Partial<Character> | null>(profileResponse, null);

    if (parsed) {
      // 安全地合并解析结果
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
            ? parsed.persona.responseLength as 'short' | 'medium' | 'long'
            : 'medium',
        };
      }
      if (parsed.memories) {
        character.memories = {
          relationshipTimeline: Array.isArray(parsed.memories.relationshipTimeline) ? parsed.memories.relationshipTimeline : [],
          sharedPlaces: Array.isArray(parsed.memories.sharedPlaces) ? parsed.memories.sharedPlaces : [],
          insideJokes: Array.isArray(parsed.memories.insideJokes) ? parsed.memories.insideJokes : [],
          conflictPatterns: Array.isArray(parsed.memories.conflictPatterns) ? parsed.memories.conflictPatterns : [],
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
              ? vf.habits!.emojiFrequency as 'none' | 'rare' | 'normal' | 'heavy'
              : 'normal',
            frequentEmojis: Array.isArray(vf.habits?.frequentEmojis) ? vf.habits.frequentEmojis : [],
            catchphrases: Array.isArray(vf.habits?.catchphrases) ? vf.habits.catchphrases : [],
            avgMessageLength: typeof vf.habits?.avgMessageLength === 'number' ? vf.habits.avgMessageLength : 10,
            rhetoricalFreq: ['high', 'medium', 'low'].includes(vf.habits?.rhetoricalFreq || '')
              ? vf.habits!.rhetoricalFreq as 'high' | 'medium' | 'low'
              : 'medium',
            punctuationStyle: ['minimal', 'normal', 'ellipsis', 'exclamation'].includes(vf.habits?.punctuationStyle || '')
              ? vf.habits!.punctuationStyle as 'minimal' | 'normal' | 'ellipsis' | 'exclamation'
              : 'normal',
          },
          patterns: {
            whenPushed: vf.patterns?.whenPushed || '',
            whenAngry: vf.patterns?.whenAngry || '',
            whenSurprised: vf.patterns?.whenSurprised || '',
            whenMoved: vf.patterns?.whenMoved || '',
          },
        };
      } else {
        // LLM 没有返回 voiceFingerprint，使用预分类的语录
        character.voiceFingerprint.quotes = preCategorizedQuotes;
      }
    }
  } catch (error) {
    console.error('画像生成失败，使用预分类数据作为 fallback:', error);
    // 使用预分类的语录作为 fallback
    character.voiceFingerprint.quotes = preCategorizedQuotes;
  }

  // ─── 第二轮：提取事件时间轴 ────
  let events: Omit<TimelineEvent, 'id' | 'status'>[] = [];

  try {
    const timelineMessages = buildTimelinePrompt(parseResult);
    const timelineResponse = await sendChatMessage(llmConfig, timelineMessages);
    const parsedEvents = safeParseJSON<
      Array<{
        date: string;
        type: string;
        summary: string;
        emotionalArc: string;
        isKeyEvent: boolean;
        speaker: string;
        preconditions?: {
          relationshipHeatRange?: { min?: number; max?: number };
          requiredEmotions?: string[];
        };
      }> | null
    >(timelineResponse, null);

    if (Array.isArray(parsedEvents)) {
      const validTypes = ['conflict', 'confession', 'plan', 'turning_point', 'separation', 'reunion', 'daily_share'];
      const validSpeakers = ['character', 'user'];

      events = parsedEvents
        .filter(e => e.date && e.summary)
        .map(e => ({
          date: e.date,
          type: validTypes.includes(e.type) ? e.type as TimelineEvent['type'] : 'daily_share',
          summary: e.summary,
          originalMessages: [],
          emotionalArc: e.emotionalArc || '',
          isKeyEvent: Boolean(e.isKeyEvent),
          speaker: validSpeakers.includes(e.speaker) ? e.speaker as 'character' | 'user' : 'character',
          preconditions: e.preconditions || {},
          source: 'auto' as const,
        }));
    }
  } catch (error) {
    console.error('时间轴生成失败:', error);
  }

  return { character, events };
}
