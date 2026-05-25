/**
 * 画像生成服务
 *
 * 接收解析后的 ParseResult，调用 LLM 生成 Character 画像和 TimelineEvent[]。
 * 流程：
 *   第零步：本地预处理（精确统计 + 候选语录粗筛 + 对话片段采样）
 *   第一步：LLM 生成画像（identity + persona + voiceFingerprint），精确值覆盖 LLM 猜测值
 *   第二步：LLM 按季度分段提取 memories + IF 线事件（分批并行）
 *   第三步：组装最终结果
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
  /** 提取失败（重试用尽后仍失败）的季度标签，例如 ["2025-Q3", "2026-Q1"]。
   *  UI 可用此提示用户重新生成。 */
  failedSegments: string[];
  /** 主画像生成失败时记录原因（重试用尽后仍失败 = 非 null）。
   *  失败时 character 走 defaultCharacter，identity/persona/voiceFingerprint 大半为空。
   *  UI 应优先显示这个失败 —— 比 segment 失败更严重。 */
  mainProfileError: string | null;
}

export type ProgressCallback = (msg: string) => void;

// ─── JSON 工具函数 ──────────────────────────────────────

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

// ═══════════════════════════════════════════════════════════
// 第零步：本地预处理
// ═══════════════════════════════════════════════════════════

// ─── 精确统计 ────────────────────────────────────────────

interface ComputedStats {
  avgMessageLength: number;
  medianMessageLength: number;
  emojiFrequency: 'none' | 'rare' | 'normal' | 'heavy';
  punctuationStyle: 'minimal' | 'normal' | 'ellipsis' | 'exclamation';
  messageStyle: 'single' | 'burst';
}

function computeStats(messages: Message[]): ComputedStats {
  const charMsgs = messages.filter(m => m.sender === 'character' && m.type === 'text' && m.content.trim());

  // avgMessageLength & median
  const lengths = charMsgs.map(m => m.content.trim().length).sort((a, b) => a - b);
  const avgMessageLength = lengths.length > 0
    ? Math.round(lengths.reduce((s, l) => s + l, 0) / lengths.length) : 10;
  const medianMessageLength = lengths.length > 0
    ? lengths[Math.floor(lengths.length / 2)] : 10;

  // emojiFrequency
  const emojiPattern = /[\p{Emoji_Presentation}\p{Extended_Pictographic}]/u;
  const emojiCount = charMsgs.filter(m => emojiPattern.test(m.content)).length;
  const emojiRatio = charMsgs.length > 0 ? emojiCount / charMsgs.length : 0;
  let emojiFrequency: ComputedStats['emojiFrequency'] = 'normal';
  if (emojiRatio < 0.02) emojiFrequency = 'none';
  else if (emojiRatio < 0.1) emojiFrequency = 'rare';
  else if (emojiRatio < 0.4) emojiFrequency = 'normal';
  else emojiFrequency = 'heavy';

  // punctuationStyle
  let ellipsisCount = 0, exclamationCount = 0, periodCount = 0;
  for (const m of charMsgs) {
    const t = m.content;
    if (/[…⋯]{1}|\.{3,}|。{2,}/.test(t)) ellipsisCount++;
    if (/[！!]{1}/.test(t)) exclamationCount++;
    if (/[。.，,；;]$/.test(t)) periodCount++;
  }
  const total = charMsgs.length || 1;
  let punctuationStyle: ComputedStats['punctuationStyle'] = 'normal';
  if (ellipsisCount / total > 0.15) punctuationStyle = 'ellipsis';
  else if (exclamationCount / total > 0.2) punctuationStyle = 'exclamation';
  else if (periodCount / total < 0.1) punctuationStyle = 'minimal';

  // messageStyle: detect burst patterns
  let burstCount = 0;
  let totalTurns = 0;
  let consecutiveChar = 0;
  for (const m of messages) {
    if (m.sender === 'character') {
      consecutiveChar++;
    } else {
      if (consecutiveChar > 0) {
        totalTurns++;
        if (consecutiveChar >= 2) burstCount++;
      }
      consecutiveChar = 0;
    }
  }
  if (consecutiveChar > 0) {
    totalTurns++;
    if (consecutiveChar >= 2) burstCount++;
  }
  const messageStyle: ComputedStats['messageStyle'] =
    totalTurns > 0 && burstCount / totalTurns > 0.3 ? 'burst' : 'single';

  return { avgMessageLength, medianMessageLength, emojiFrequency, punctuationStyle, messageStyle };
}

// ─── 候选语录粗筛（不分类，只捞候选）─────────────────────

function collectCandidateQuotes(messages: Message[], maxCount: number = 80): string[] {
  const charMsgs = messages.filter(m => m.sender === 'character' && m.type === 'text');
  const candidates: { text: string; score: number }[] = [];

  // 合并所有关键词，不区分类别
  const emotionalKw = [
    // 生气类
    '生气', '烦死', '讨厌', '够了', '滚', '别烦', '无语', '气死', '分手', '卧槽',
    // 甜蜜类（用更长的词避免歧义）
    '喜欢你', '爱你', '想你', '宝贝', '抱抱', '舍不得', '心疼', '想念', '么么',
    // 讽刺类（只保留高置信度的）
    '呵呵', '关我', '恭喜你', '真厉害',
    // 关心类
    '别太累', '早点睡', '注意身体', '小心', '担心', '没事吧', '怎么了',
  ];

  // 否定前缀
  const negPrefixes = ['不', '没', '别', '没有', '不要', '不会', '不是'];

  for (const msg of charMsgs) {
    const text = msg.content.trim();
    if (!text || text.length < 3) continue;

    let score = 0;

    // 关键词命中
    for (const kw of emotionalKw) {
      const idx = text.indexOf(kw);
      if (idx >= 0) {
        // 否定词检测：关键词前2字是否有否定
        const prefix = text.substring(Math.max(0, idx - 2), idx);
        const negated = negPrefixes.some(np => prefix.endsWith(np));
        if (!negated) score += 2;
      }
    }

    // 长度加分（有信息量）
    if (text.length > 15) score += 1;
    // 包含问号（有互动）
    if (/[？?]/.test(text)) score += 1;
    // 包含感叹号（有情绪）
    if (/[！!]/.test(text)) score += 1;

    if (score > 0) {
      candidates.push({ text, score });
    }
  }

  candidates.sort((a, b) => b.score - a.score);

  // 去重（相同内容只保留一条）
  const seen = new Set<string>();
  const result: string[] = [];
  for (const c of candidates) {
    if (seen.has(c.text)) continue;
    seen.add(c.text);
    result.push(c.text);
    if (result.length >= maxCount) break;
  }
  return result;
}

// ─── 关键词分类（仅兜底用）──────────────────────────────

function categorizeQuotesFallback(messages: Message[]): {
  angry: string[]; sweet: string[]; sarcastic: string[];
  daily: string[]; concerned: string[];
} {
  const charMsgs = messages.filter(m => m.sender === 'character' && m.type === 'text');
  const angry: string[] = [], sweet: string[] = [], sarcastic: string[] = [];
  const daily: string[] = [], concerned: string[] = [];

  for (const msg of charMsgs) {
    const text = msg.content.trim();
    if (!text || text.length < 3) continue;
    let matched = false;
    if (['生气', '烦死', '讨厌', '够了', '滚', '无语', '气死', '卧槽'].some(kw => text.includes(kw))) {
      angry.push(text); matched = true;
    }
    if (['喜欢你', '爱你', '想你', '宝贝', '抱抱', '舍不得', '想念'].some(kw => text.includes(kw))) {
      sweet.push(text); matched = true;
    }
    if (['呵呵', '关我', '真厉害'].some(kw => text.includes(kw))) {
      sarcastic.push(text); matched = true;
    }
    if (['别太累', '早点睡', '注意身体', '担心', '没事吧', '怎么了'].some(kw => text.includes(kw))) {
      concerned.push(text); matched = true;
    }
    if (!matched && text.length > 5) daily.push(text);
  }

  return {
    angry: angry.slice(0, 8), sweet: sweet.slice(0, 8),
    sarcastic: sarcastic.slice(0, 8), daily: daily.slice(0, 8),
    concerned: concerned.slice(0, 8),
  };
}

// ─── 对话片段采样（按信息量评分）─────────────────────────

function extractSampleConversations(messages: Message[], count: number = 6): string[] {
  const meaningful = messages.filter(m => m.type === 'text' && m.content.trim().length > 2);
  if (meaningful.length === 0) return [];

  // 给每条消息算信息量分数
  const scores: number[] = meaningful.map((m, i) => {
    let score = 0;
    if (m.content.length > 15) score += 2;
    if (/[？?]/.test(m.content)) score += 1;
    if (/[\p{Emoji_Presentation}\p{Extended_Pictographic}]/u.test(m.content)) score += 1;
    if (m.content.length < 3) score -= 1;

    // 处于连续对话中（前后4条内有不同sender交替）
    let turns = 0;
    for (let j = Math.max(0, i - 3); j <= Math.min(meaningful.length - 1, i + 3); j++) {
      if (j > 0 && meaningful[j].sender !== meaningful[j - 1].sender) turns++;
    }
    if (turns >= 3) score += 2;
    return score;
  });

  // 找高分消息作为片段中心
  const indexed = scores.map((s, i) => ({ score: s, idx: i }));
  indexed.sort((a, b) => b.score - a.score);

  const snippets: string[] = [];
  const usedRanges = new Set<number>();
  const snippetLen = 6;

  for (const { idx } of indexed) {
    if (snippets.length >= count) break;
    const start = Math.max(0, idx - 2);

    // 跳过已覆盖的范围
    let overlap = false;
    for (let k = start; k < start + snippetLen && k < meaningful.length; k++) {
      if (usedRanges.has(k)) { overlap = true; break; }
    }
    if (overlap) continue;

    const slice = meaningful.slice(start, start + snippetLen);
    if (slice.length < 3) continue;

    // 确保片段包含角色消息
    if (!slice.some(m => m.sender === 'character')) continue;

    for (let k = start; k < start + snippetLen; k++) usedRanges.add(k);

    snippets.push(slice.map(m =>
      `${m.sender === 'user' ? '我' : '对方'}：${m.content}`
    ).join('\n'));
  }
  return snippets;
}

// ─── 时间衰减采样 ────────────────────────────────────────

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

// ═══════════════════════════════════════════════════════════
// 第一步：LLM 生成画像
// ═══════════════════════════════════════════════════════════

function buildProfilePrompt(
  parseResult: ParseResult | HTMLParseResult,
  candidateQuotes: string[],
): ChatMessage[] {
  const { messages, participants, startDate, endDate, totalMessages } = parseResult;
  const messageText = formatMessagesForPrompt(messages);

  const systemPrompt = `你是一个专业的对话分析 AI，擅长从聊天记录中深度剖析人物性格。
你需要根据提供的聊天记录，生成一份详细的人物画像。

重要规则：
1. 你必须返回合法的 JSON 格式（不要用 markdown 代码块包裹）
2. voiceFingerprint.quotes 中的语录必须是从原始聊天记录或候选语录中提取的真实语句，绝对不能编造
3. 所有分析必须基于聊天记录中的实际内容，不要臆测
4. 如果信息不足以判断某个字段，填写合理的默认值
5. 不需要生成 memories 部分`;

  const candidateSection = candidateQuotes.length > 0
    ? `\n以下是对方说过的一些有特点的原话（未分类），请你判断每条的情绪类别，挑选最有代表性的放入对应的 quotes 分类中：\n${candidateQuotes.map(q => `- "${q}"`).join('\n')}\n`
    : '';

  const userPrompt = `请分析以下聊天记录，生成对方（${participants.other}）的人物画像。

聊天记录概览：
- 对方名字：${participants.other}
- 消息条数：${totalMessages}
- 时间范围：${startDate || '未知'} ~ ${endDate || '未知'}

以下是聊天记录（近期消息采样密度更高）：
---
${messageText}
---
${candidateSection}
请返回如下格式的 JSON（不要包含任何其他文字，不要包含 memories 字段）：
{
  "gender": "male 或 female 或 unknown（根据说话方式和内容推断）",
  "relationshipToUser": "你们的关系，如：恋人、好朋友、闺蜜、大学室友、同事、家人等",
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
    "responseLength": "short/medium/long",
    "neverSay": ["这个人绝对不会使用的3-5种表达方式，比如某些称呼、语气词、说话方式"]
  },
  "voiceFingerprint": {
    "quotes": {
      "angry": ["生气/不满时的真实语录，2-5条，必须从聊天记录或候选语录中提取"],
      "sweet": ["甜蜜/亲密时的真实语录，2-5条"],
      "sarcastic": ["讽刺/敷衍时的真实语录，1-5条"],
      "daily": ["日常对话中的真实语录，3-5条"],
      "concerned": ["关心/担忧时的真实语录，2-5条"]
    },
    "habits": {
      "emojiFrequency": "none/rare/normal/heavy",
      "frequentEmojis": ["常用emoji"],
      "catchphrases": ["无意识的语言习惯，如句尾带'嘛''呀''啦'，或特定的语气词"],
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

// ═══════════════════════════════════════════════════════════
// 第二步：分段提取记忆 + IF 线事件
// ═══════════════════════════════════════════════════════════

interface QuarterSegment {
  label: string;
  start: string;
  end: string;
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

// ═══════════════════════════════════════════════════════════
// 自适应限流（AIMD）
//
// 默认 4 并发（付费用户全速跑）。
// 任何一次 LLM 调用拿到 rate-limit 错误 → 自动降到串行 + 1.5s 间隔。
// 所有降级后的请求（包括正在 in-flight 的重试）通过 SerialQueue 共享
// 一个串行通道，避免 retry stampede 再次撞墙。
// 这样 Kimi free（3 RPM / 3 并发）也能跑完，付费用户不付速度代价。
// ═══════════════════════════════════════════════════════════

const sleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

/** 简易串行队列：任务挂在 promise chain 上，可选 task 间间隔。 */
class SerialQueue {
  private tail: Promise<unknown> = Promise.resolve();
  enqueue<T>(fn: () => Promise<T>, delayBeforeMs: number): Promise<T> {
    const result = this.tail.then(async () => {
      if (delayBeforeMs > 0) await sleep(delayBeforeMs);
      return fn();
    });
    // 链尾推进到 fn 完成（成败都算），错误不传播给后续 enqueue
    this.tail = result.then(() => undefined, () => undefined);
    return result;
  }
}

interface AdaptiveThrottle {
  batchSize: number;
  interDelayMs: number;
  queue: SerialQueue;
}

function createThrottle(initialBatchSize: number): AdaptiveThrottle {
  return { batchSize: initialBatchSize, interDelayMs: 0, queue: new SerialQueue() };
}

/** 判断错误是否为限流类（用 humanizeApiError 输出 + 常见关键词匹配）。 */
function isRateLimitError(msg: string): boolean {
  return /请求太频繁|rate.?limit|concurrency|429|too many requests/i.test(msg);
}

/**
 * 撞限流 → 降级，进阶递增间隔。
 * 第 1 次：batchSize=1, 间隔 1.5s（覆盖一般付费 plan）
 * 第 2 次：3s
 * 第 3 次：6s
 * 第 4 次：12s
 * 第 5 次：20s 封顶（=3 RPM，覆盖 Kimi free 等紧额度）
 * 已降到最大间隔再撞墙说明用户 plan 太紧，需要换或充值。
 */
const ESCALATION_STEPS_MS = [1500, 3000, 6000, 12000, 20000];

function tripThrottle(throttle: AdaptiveThrottle, label: string): void {
  if (throttle.batchSize > 1) {
    // 第一次降级：并发 → 串行
    throttle.batchSize = 1;
    throttle.interDelayMs = ESCALATION_STEPS_MS[0];
    console.warn(
      `[profileGenerator] ${label} 触发限流，降级为串行 + ${throttle.interDelayMs}ms 间隔`,
    );
    return;
  }
  // 已经在串行模式还撞墙 → 加大间隔
  const currentIdx = ESCALATION_STEPS_MS.indexOf(throttle.interDelayMs);
  const nextIdx = Math.min(currentIdx + 1, ESCALATION_STEPS_MS.length - 1);
  const nextDelay = ESCALATION_STEPS_MS[nextIdx];
  if (nextDelay > throttle.interDelayMs) {
    console.warn(
      `[profileGenerator] ${label} 串行模式仍撞墙，间隔 ${throttle.interDelayMs}ms → ${nextDelay}ms`,
    );
    throttle.interDelayMs = nextDelay;
  } else if (currentIdx === ESCALATION_STEPS_MS.length - 1) {
    console.warn(
      `[profileGenerator] ${label} 已经在最大间隔（${nextDelay}ms = 3 RPM）仍撞墙，可能 LLM plan 配额太紧`,
    );
  }
}

/** 限流降级后所有 LLM 调用走串行队列；未降级时直发。 */
async function throttledSend(
  llmConfig: LLMConfig,
  messages: ChatMessage[],
  throttle: AdaptiveThrottle,
): Promise<string> {
  if (throttle.batchSize <= 1 && throttle.interDelayMs > 0) {
    return throttle.queue.enqueue(() => sendChatMessage(llmConfig, messages), throttle.interDelayMs);
  }
  return sendChatMessage(llmConfig, messages);
}

/**
 * 通用重试 wrapper：
 * - 限流错误：每次重试都会 trip throttle 进阶递增间隔；重试 backoff 至少等
 *   throttle.interDelayMs 让 SerialQueue 真正间隔生效
 * - 普通错误（500/timeout 等）：短 backoff 快速重试
 * - 5 次重试给进阶降级足够时间 kick in（最坏情况 20s 间隔 × 5 ≈ 100s）
 * - jitter 防止重试 stampede
 */
async function callWithRetry(
  llmConfig: LLMConfig,
  messages: ChatMessage[],
  throttle: AdaptiveThrottle,
  label: string,
): Promise<string> {
  const RETRY_DELAYS_NORMAL = [500, 1500, 3000];                   // 普通错误 3 次重试
  const RETRY_DELAYS_RATE_LIMIT_BASE = [2000, 4000, 8000, 12000];  // 限流 4 次重试

  for (let attempt = 0; ; attempt++) {
    try {
      return await throttledSend(llmConfig, messages, throttle);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      const isRL = isRateLimitError(msg);
      if (isRL) tripThrottle(throttle, label);

      const delays = isRL ? RETRY_DELAYS_RATE_LIMIT_BASE : RETRY_DELAYS_NORMAL;
      if (attempt < delays.length) {
        // 限流重试间隔至少等 throttle 当前间隔，否则 SerialQueue 节流无意义
        const baseDelay = isRL
          ? Math.max(delays[attempt], throttle.interDelayMs)
          : delays[attempt];
        const jitter = Math.random() * 500;
        const delayMs = Math.round(baseDelay + jitter);
        console.warn(`[profileGenerator] ${label} attempt ${attempt + 1} 失败，${delayMs}ms 后重试: ${msg}`);
        await sleep(delayMs);
      } else {
        console.error(`[profileGenerator] ${label} 重试用尽，放弃。原始错误: ${msg}`);
        throw err;
      }
    }
  }
}

interface SegmentExtractResult {
  /** 季度结果（成功提取的内容，失败时为空 result） */
  result: SegmentResult;
  /** 季度标签（如 "2025-Q3"），用于 UI 汇总失败项 */
  label: string;
  /** 该季度是否提取成功（重试用尽后仍失败 = false） */
  ok: boolean;
}

/**
 * 单个季度的提取：通过 callWithRetry 走自适应限流通道。
 * 失败时打 console.error 暴露真因（429/JSON 解析错/超时等），
 * 不再静默返回空数据，让调用方能汇总失败 segment 提示用户。
 */
async function extractSegment(
  segment: QuarterSegment,
  participants: { self: string; other: string },
  llmConfig: LLMConfig,
  throttle: AdaptiveThrottle,
): Promise<SegmentExtractResult> {
  const empty: SegmentResult = {
    places: [], jokes: [], conflicts: [],
    relationshipMilestones: [], events: [],
  };
  const prompt = buildSegmentPrompt(segment, participants);
  const label = `segment ${segment.label}`;

  try {
    const response = await callWithRetry(llmConfig, prompt, throttle, label);
    const parsed = safeParseJSON<SegmentResult | null>(response, null);
    if (!parsed) {
      console.error(`[profileGenerator] ${label} LLM 返回非合法 JSON，放弃`);
      return { result: empty, label: segment.label, ok: false };
    }
    return { result: parsed, label: segment.label, ok: true };
  } catch {
    // callWithRetry 已经 console.error 过原因了
    return { result: empty, label: segment.label, ok: false };
  }
}

/**
 * 自适应批量执行：每轮开始前读 throttle.batchSize 决定串/并发。
 * 串行模式下 task 内部已走 SerialQueue（throttledSend），不需要外层再串。
 */
async function runAdaptive<T>(
  tasks: (() => Promise<T>)[],
  throttle: AdaptiveThrottle,
): Promise<T[]> {
  const results: T[] = [];
  let i = 0;
  while (i < tasks.length) {
    if (throttle.batchSize <= 1) {
      // 串行：每次只起 1 个；task 内部 throttledSend 会走 SerialQueue 加间隔
      results.push(await tasks[i]());
      i += 1;
    } else {
      const batch = tasks.slice(i, i + throttle.batchSize);
      results.push(...(await Promise.all(batch.map((t) => t()))));
      i += batch.length;
    }
  }
  return results;
}

// ═══════════════════════════════════════════════════════════
// 默认值
// ═══════════════════════════════════════════════════════════

function defaultCharacter(): Omit<Character, 'id' | 'createdAt' | 'sourceType'> {
  return {
    gender: 'unknown',
    relationshipToUser: '',
    messageStyle: 'single',
    identity: { name: '未知', avatar: '', ageEstimate: '', occupationHint: '' },
    persona: {
      personalityTags: [], attachmentStyle: '', speakingStyle: '',
      emotionalLogic: '', typicalPhrases: [], responseLength: 'medium',
      neverSay: [],
    },
    memories: {
      relationshipTimeline: [], sharedPlaces: [],
      insideJokes: [], conflictPatterns: [],
    },
    voiceFingerprint: {
      quotes: { angry: [], sweet: [], sarcastic: [], daily: [], concerned: [] },
      habits: {
        emojiFrequency: 'normal', frequentEmojis: [], catchphrases: [],
        avgMessageLength: 10, rhetoricalFreq: 'medium', punctuationStyle: 'normal',
      },
      patterns: { whenPushed: '', whenAngry: '', whenSurprised: '', whenMoved: '' },
    },
  };
}

// ═══════════════════════════════════════════════════════════
// 主函数
// ═══════════════════════════════════════════════════════════

export async function generateFromParsedData(
  parseResult: ParseResult | HTMLParseResult,
  llmConfig: LLMConfig,
  onProgress?: ProgressCallback,
): Promise<GenerationResult> {
  const defaultResult: GenerationResult = {
    character: defaultCharacter(),
    events: [],
    failedSegments: [],
    mainProfileError: null,
  };
  defaultResult.character.identity.name = parseResult.participants.other;

  if (parseResult.messages.length === 0) return defaultResult;

  // ─── 第零步：本地预处理 ────
  onProgress?.('正在分析聊天数据...');

  const stats = computeStats(parseResult.messages);
  const candidateQuotes = collectCandidateQuotes(parseResult.messages);
  const fallbackQuotes = categorizeQuotesFallback(parseResult.messages);

  const character = defaultResult.character;

  // 整次生成共享一个自适应限流状态，主画像 + 所有 segments 共用
  const throttle = createThrottle(4);

  // ─── 第一步：LLM 生成画像 ────
  onProgress?.('正在生成性格画像...');

  try {
    const profileMessages = buildProfilePrompt(parseResult, candidateQuotes);
    // 主画像通过 callWithRetry 走自适应限流，限流错误会自动 trip throttle
    // → 后续 segment 一开始就走串行，省去再撞一次墙的时间
    const profileResponse = await callWithRetry(llmConfig, profileMessages, throttle, '主画像');
    const parsed = safeParseJSON<Record<string, unknown> | null>(profileResponse, null);

    if (parsed) {
      // gender / relationshipToUser
      if (typeof parsed.gender === 'string' && ['male', 'female', 'unknown'].includes(parsed.gender)) {
        character.gender = parsed.gender as Character['gender'];
      }
      if (typeof parsed.relationshipToUser === 'string') {
        character.relationshipToUser = parsed.relationshipToUser;
      }

      // identity
      const pid = parsed.identity as Record<string, string> | undefined;
      if (pid) {
        character.identity = {
          name: pid.name || parseResult.participants.other,
          avatar: pid.avatar || '',
          ageEstimate: pid.ageEstimate || '',
          occupationHint: pid.occupationHint || '',
        };
      }

      // persona
      const pp = parsed.persona as Record<string, unknown> | undefined;
      if (pp) {
        character.persona = {
          personalityTags: Array.isArray(pp.personalityTags) ? pp.personalityTags as string[] : [],
          attachmentStyle: (pp.attachmentStyle as string) || '',
          speakingStyle: (pp.speakingStyle as string) || '',
          emotionalLogic: (pp.emotionalLogic as string) || '',
          typicalPhrases: Array.isArray(pp.typicalPhrases) ? pp.typicalPhrases as string[] : [],
          responseLength: ['short', 'medium', 'long'].includes(pp.responseLength as string)
            ? pp.responseLength as 'short' | 'medium' | 'long' : 'medium',
          neverSay: Array.isArray(pp.neverSay) ? pp.neverSay as string[] : [],
        };
      }

      // voiceFingerprint
      const vf = parsed.voiceFingerprint as Record<string, unknown> | undefined;
      if (vf) {
        const quotes = vf.quotes as Record<string, string[]> | undefined;
        const habits = vf.habits as Record<string, unknown> | undefined;
        const patterns = vf.patterns as Record<string, string> | undefined;

        character.voiceFingerprint = {
          quotes: {
            angry: Array.isArray(quotes?.angry) ? quotes!.angry : fallbackQuotes.angry,
            sweet: Array.isArray(quotes?.sweet) ? quotes!.sweet : fallbackQuotes.sweet,
            sarcastic: Array.isArray(quotes?.sarcastic) ? quotes!.sarcastic : fallbackQuotes.sarcastic,
            daily: Array.isArray(quotes?.daily) ? quotes!.daily : fallbackQuotes.daily,
            concerned: Array.isArray(quotes?.concerned) ? quotes!.concerned : fallbackQuotes.concerned,
          },
          habits: {
            // 精确值覆盖 LLM 猜测值
            emojiFrequency: stats.emojiFrequency,
            frequentEmojis: Array.isArray(habits?.frequentEmojis) ? habits!.frequentEmojis as string[] : [],
            catchphrases: Array.isArray(habits?.catchphrases) ? habits!.catchphrases as string[] : [],
            avgMessageLength: stats.avgMessageLength,
            rhetoricalFreq: ['high', 'medium', 'low'].includes(habits?.rhetoricalFreq as string)
              ? habits!.rhetoricalFreq as 'high' | 'medium' | 'low' : 'medium',
            punctuationStyle: stats.punctuationStyle,
          },
          patterns: {
            whenPushed: patterns?.whenPushed || '',
            whenAngry: patterns?.whenAngry || '',
            whenSurprised: patterns?.whenSurprised || '',
            whenMoved: patterns?.whenMoved || '',
          },
        };
      } else {
        character.voiceFingerprint.quotes = fallbackQuotes;
      }
    }
  } catch (error) {
    console.error('画像生成失败，使用兜底数据:', error);
    character.voiceFingerprint.quotes = fallbackQuotes;
    // 把失败原因记录下来传给 UI，让用户看到具体出错信息（contentFilter / 限流 / 网络等）
    defaultResult.mainProfileError = error instanceof Error ? error.message : String(error);
  }

  // 覆盖 messageStyle
  character.messageStyle = stats.messageStyle;

  // ─── 第二步：分段提取 memories + IF 线事件 ────
  const segments = divideByQuarter(parseResult.messages);
  const totalSegments = segments.length;
  let completedSegments = 0;

  const allPlaces: string[] = [];
  const allJokes: string[] = [];
  const allConflicts: string[] = [];
  const allMilestones: string[] = [];
  const allEvents: Omit<TimelineEvent, 'id' | 'status'>[] = [];
  const failedSegments: string[] = [];

  if (segments.length > 0) {
    onProgress?.(`正在提取记忆 (0/${totalSegments})...`);

    const tasks = segments.map(segment => () =>
      extractSegment(segment, parseResult.participants, llmConfig, throttle)
        .then(extractResult => {
          completedSegments++;
          onProgress?.(`正在提取记忆 (${completedSegments}/${totalSegments})...`);
          return extractResult;
        })
    );

    const segmentResults = await runAdaptive(tasks, throttle);
    const validTypes = ['conflict', 'confession', 'plan', 'turning_point', 'separation', 'reunion', 'daily_share'];

    for (const { result, label, ok } of segmentResults) {
      if (!ok) {
        failedSegments.push(label);
        continue;
      }
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

    if (failedSegments.length > 0) {
      console.warn(
        `[profileGenerator] 共 ${failedSegments.length}/${totalSegments} 个季度提取失败: ${failedSegments.join(', ')}`,
      );
    }
  }

  character.memories = {
    relationshipTimeline: [...new Set(allMilestones)],
    sharedPlaces: [...new Set(allPlaces)],
    insideJokes: [...new Set(allJokes)],
    conflictPatterns: [...new Set(allConflicts)],
  };

  allEvents.sort((a, b) => a.date.localeCompare(b.date));

  // ─── 第三步：提取对话片段 ────
  onProgress?.('正在提取对话片段...');
  character.sampleConversations = extractSampleConversations(parseResult.messages);

  return { character, events: allEvents, failedSegments, mainProfileError: defaultResult.mainProfileError };
}
