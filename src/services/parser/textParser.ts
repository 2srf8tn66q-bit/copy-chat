/**
 * 微信纯文本聊天记录解析器
 *
 * 支持三种常见的微信文本格式：
 * 1. 两列格式：名字 + 时间在第一行（或分开两行），消息内容在下面
 *    例：
 *      小林 14:32
 *      在吗
 *      我 14:33
 *      在呢怎么了
 *
 * 2. 带日期前缀的冒号格式：
 *    例：
 *      2024年3月15日
 *      下午2:32
 *      小林: 在吗
 *
 * 3. 带换行的三行格式：
 *    例：
 *      小林\n2024-03-15 14:32\n在吗
 */

import type { Message } from '../../types/timeline';

// ─── 导出接口 ────────────────────────────────────────────

export interface ParseResult {
  messages: Message[];
  participants: {
    self: string;
    other: string;
  };
  startDate: string;
  endDate: string;
  totalMessages: number;
  mediaCount: { images: number; videos: number };
}

// ─── 正则常量 ────────────────────────────────────────────

// 格式1: "名字 HH:MM" 或 "名字 H:MM"
const PATTERN_NAME_TIME = /^(\S+)\s+(\d{1,2}:\d{2}(?::\d{2})?)$/;

// 格式1变体: "名字 上/下午H:MM"
const PATTERN_NAME_TIME_PERIOD = /^(\S+)\s+([上下]午\s?\d{1,2}:\d{2})$/;

// 格式1变体: 只有名字没有时间（当时间缺失时）
const PATTERN_NAME_ONLY = /^(\S+)$/;

// 格式2/3: 独立时间行 "HH:MM" 或 "H:MM"
const PATTERN_TIME_ONLY = /^(\d{1,2}:\d{2}(?::\d{2})?)$/;

// 格式2: "上/下午H:MM"
const PATTERN_TIME_PERIOD = /^([上下]午\s?\d{1,2}:\d{2})$/;

// 格式3: "名字 YYYY-MM-DD HH:MM" 或 "名字 YYYY/MM/DD HH:MM"
const PATTERN_NAME_DATETIME = /^(\S+)\s+(\d{4}[-/]\d{1,2}[-/]\d{1,2}\s+\d{1,2}:\d{2}(?::\d{2})?)$/;

// 日期分割线: "2024年3月15日" 或 "2024年03月15日"
const PATTERN_DATE_CN = /^(\d{4})年(\d{1,2})月(\d{1,2})日$/;

// 日期分割线: "2024-03-15" 或 "2024/03/15"
const PATTERN_DATE_ISO = /^(\d{4}[-/]\d{1,2}[-/]\d{1,2})$/;

// 格式2冒号行: "名字: 内容" 或 "名字：内容"
const PATTERN_COLON_MSG = /^(\S+)[：:]\s*(.+)$/;

// 媒体标记
const MEDIA_IMAGE = /^\[图片\]$/;
const MEDIA_VIDEO = /^\[视频\]$/;

// 系统消息关键词
const SYSTEM_KEYWORDS = [
  '你已添加了',
  '以上是新消息',
  '以下是新消息',
  '已过了',
  '聊天记录',
  '微信团队',
  '服务号',
  '撤回了一条消息',
  '领取了你的红包',
  '领取了红包',
];

// ─── 工具函数 ────────────────────────────────────────────

let _msgCounter = 0;

function generateId(): string {
  _msgCounter += 1;
  return `msg_${Date.now()}_${_msgCounter}`;
}

function padZero(n: number): string {
  return n < 10 ? `0${n}` : `${n}`;
}

/**
 * 将各种时间字符串标准化为 "HH:MM" 或 "HH:MM:SS" 格式
 */
function normalizeTime(raw: string): string {
  let t = raw.trim();
  // 处理 "下午 2:32" → "14:32"
  t = t.replace(/[上下]午\s?/g, (match) => {
    return match.includes('下') || match.includes('晚') ? '__PM__' : '';
  });

  // 如果有 __PM__ 标记，需要转换12小时到24小时
  if (t.includes('__PM__')) {
    t = t.replace('__PM__', '');
    const parts = t.split(':');
    if (parts.length >= 2) {
      let hour = parseInt(parts[0], 10);
      if (hour < 12) hour += 12;
      parts[0] = padZero(hour);
      t = parts.join(':');
    }
  }

  // 确保小时和分钟都是两位数
  const parts = t.split(':');
  if (parts.length >= 2) {
    parts[0] = padZero(parseInt(parts[0], 10));
    parts[1] = padZero(parseInt(parts[1], 10));
  }
  return parts.join(':');
}

/**
 * 将日期分割线解析为 ISO 日期字符串 "YYYY-MM-DD"
 */
function parseDateLine(line: string): string | null {
  const cn = line.match(PATTERN_DATE_CN);
  if (cn) {
    return `${cn[1]}-${padZero(parseInt(cn[2], 10))}-${padZero(parseInt(cn[3], 10))}`;
  }
  const iso = line.match(PATTERN_DATE_ISO);
  if (iso) {
    return iso[1].replace(/\//g, '-');
  }
  return null;
}

/**
 * 判断是否是系统消息
 */
function isSystemMessage(text: string): boolean {
  const trimmed = text.trim();
  return SYSTEM_KEYWORDS.some((kw) => trimmed.includes(kw));
}

/**
 * 从日期字符串中提取 YYYY-MM-DD 部分
 */
function extractDate(timestamp: string): string {
  // timestamp 可能是 "YYYY-MM-DD HH:MM" 或只有 "HH:MM"
  if (/^\d{4}-\d{2}-\d{2}/.test(timestamp)) {
    return timestamp.substring(0, 10);
  }
  return timestamp.substring(0, 10);
}

// ─── 解析器：格式1 (名字 时间 / 消息内容) ────────────────

interface RawMessage {
  sender: string;
  time: string;
  content: string;
  date: string;
  type: 'text' | 'image' | 'video' | 'system';
}

function parseFormat1(lines: string[]): RawMessage[] | null {
  const results: RawMessage[] = [];
  let currentDate = '';
  let i = 0;

  while (i < lines.length) {
    const line = lines[i];
    if (!line.trim()) {
      i++;
      continue;
    }

    // 检查日期分割线
    const dateParsed = parseDateLine(line.trim());
    if (dateParsed) {
      currentDate = dateParsed;
      i++;
      continue;
    }

    // 尝试匹配 "名字 HH:MM"
    let nameTimeMatch = line.match(PATTERN_NAME_TIME);
    let nameTimePeriodMatch: RegExpMatchArray | null = null;

    if (!nameTimeMatch) {
      nameTimePeriodMatch = line.match(PATTERN_NAME_TIME_PERIOD);
    }

    if (nameTimeMatch || nameTimePeriodMatch) {
      const match = nameTimeMatch || nameTimePeriodMatch!;
      const sender = match[1];
      const time = normalizeTime(match[2]);

      // 读取下一行作为消息内容
      i++;
      // 跳过空行
      while (i < lines.length && !lines[i].trim()) i++;

      if (i >= lines.length) {
        // 只有名字+时间没有内容，跳过
        break;
      }

      // 检查下一行是否是另一个名字+时间行，如果是则这条消息内容为空，跳过
      const nextLine = lines[i].trim();
      if (nextLine.match(PATTERN_NAME_TIME) || nextLine.match(PATTERN_NAME_TIME_PERIOD) || parseDateLine(nextLine)) {
        continue;
      }

      // 收集多行内容（直到遇到下一个名字+时间行或日期行或结尾）
      let content = nextLine;
      i++;

      while (i < lines.length) {
        const peek = lines[i].trim();
        if (!peek) {
          i++;
          continue;
        }
        if (peek.match(PATTERN_NAME_TIME) || peek.match(PATTERN_NAME_TIME_PERIOD) || parseDateLine(peek)) {
          break;
        }
        content += '\n' + peek;
        i++;
      }

      if (!currentDate) {
        currentDate = new Date().toISOString().substring(0, 10);
      }

      let msgType: RawMessage['type'] = 'text';
      if (MEDIA_IMAGE.test(content.trim())) msgType = 'image';
      else if (MEDIA_VIDEO.test(content.trim())) msgType = 'video';
      else if (isSystemMessage(content)) msgType = 'system';

      results.push({
        sender,
        time,
        content: content.trim(),
        date: currentDate,
        type: msgType,
      });
      continue;
    }

    // 无法识别，跳过这一行
    i++;
  }

  return results.length > 0 ? results : null;
}

// ─── 解析器：格式2 (日期 + 时间 + 名字: 内容) ────────────

function parseFormat2(lines: string[]): RawMessage[] | null {
  const results: RawMessage[] = [];
  let currentDate = '';
  let currentTime = '';
  let i = 0;

  while (i < lines.length) {
    const line = lines[i].trim();
    if (!line) {
      i++;
      continue;
    }

    // 日期行
    const dateParsed = parseDateLine(line);
    if (dateParsed) {
      currentDate = dateParsed;
      i++;
      continue;
    }

    // 独立时间行
    const timeOnlyMatch = line.match(PATTERN_TIME_ONLY);
    const timePeriodMatch = line.match(PATTERN_TIME_PERIOD);
    if (timeOnlyMatch) {
      currentTime = normalizeTime(timeOnlyMatch[1]);
      i++;
      continue;
    }
    if (timePeriodMatch) {
      currentTime = normalizeTime(timePeriodMatch[1]);
      i++;
      continue;
    }

    // 冒号行 "名字: 内容"
    const colonMatch = line.match(PATTERN_COLON_MSG);
    if (colonMatch) {
      const sender = colonMatch[1];
      const content = colonMatch[2];

      if (!currentDate) {
        currentDate = new Date().toISOString().substring(0, 10);
      }

      let msgType: RawMessage['type'] = 'text';
      if (MEDIA_IMAGE.test(content.trim())) msgType = 'image';
      else if (MEDIA_VIDEO.test(content.trim())) msgType = 'video';
      else if (isSystemMessage(content)) msgType = 'system';

      results.push({
        sender,
        time: currentTime || '00:00',
        content: content.trim(),
        date: currentDate,
        type: msgType,
      });
      i++;
      continue;
    }

    i++;
  }

  return results.length > 0 ? results : null;
}

// ─── 解析器：格式3 (名字\n日期时间\n内容) ──────────────────

function parseFormat3(lines: string[]): RawMessage[] | null {
  const results: RawMessage[] = [];
  let i = 0;

  while (i < lines.length) {
    const line = lines[i].trim();
    if (!line) {
      i++;
      continue;
    }

    // 日期分割线
    const dateParsed = parseDateLine(line);
    if (dateParsed) {
      i++;
      continue;
    }

    // 检查 "名字 日期 时间" 格式
    const nameDatetimeMatch = line.match(PATTERN_NAME_DATETIME);
    if (nameDatetimeMatch) {
      const sender = nameDatetimeMatch[1];
      const datetime = nameDatetimeMatch[2];
      // 从 datetime 中提取 date 和 time
      const dtParts = datetime.split(/\s+/);
      const date = dtParts[0].replace(/\//g, '-');
      const time = dtParts.length > 1 ? normalizeTime(dtParts[1]) : '00:00';

      // 读取内容行
      i++;
      while (i < lines.length && !lines[i].trim()) i++;

      if (i >= lines.length) break;

      let content = lines[i].trim();
      i++;

      // 多行内容
      while (i < lines.length) {
        const peek = lines[i].trim();
        if (!peek) { i++; continue; }
        if (peek.match(PATTERN_NAME_DATETIME) || parseDateLine(peek)) break;
        content += '\n' + peek;
        i++;
      }

      let msgType: RawMessage['type'] = 'text';
      if (MEDIA_IMAGE.test(content.trim())) msgType = 'image';
      else if (MEDIA_VIDEO.test(content.trim())) msgType = 'video';
      else if (isSystemMessage(content)) msgType = 'system';

      results.push({ sender, time, content: content.trim(), date, type: msgType });
      continue;
    }

    // 尝试三行一组: 名字 / 日期时间 / 内容
    if (i + 2 < lines.length) {
      const possibleName = line;
      const possibleDatetime = lines[i + 1].trim();
      const possibleContent = lines[i + 2].trim();

      // 检查第二行是否看起来像日期时间
      if (/^\d{4}[-/]\d{1,2}[-/]\d{1,2}\s+\d{1,2}:\d{2}/.test(possibleDatetime)) {
        const dtParts = possibleDatetime.split(/\s+/);
        const date = dtParts[0].replace(/\//g, '-');
        const time = dtParts.length > 1 ? normalizeTime(dtParts[1]) : '00:00';

        let msgType: RawMessage['type'] = 'text';
        if (MEDIA_IMAGE.test(possibleContent)) msgType = 'image';
        else if (MEDIA_VIDEO.test(possibleContent)) msgType = 'video';
        else if (isSystemMessage(possibleContent)) msgType = 'system';

        results.push({ sender: possibleName, time, content: possibleContent, date, type: msgType });
        i += 3;
        continue;
      }
    }

    i++;
  }

  return results.length > 0 ? results : null;
}

// ─── 自动识别"我" ────────────────────────────────────────

const SELF_KEYWORDS = ['我', '自己'];

function identifyParticipants(raws: RawMessage[]): { self: string; other: string } {
  // 策略1: 名字包含"我"等关键词
  const senders = [...new Set(raws.map((r) => r.sender))];

  for (const keyword of SELF_KEYWORDS) {
    const match = senders.find((s) => s === keyword);
    if (match) {
      const other = senders.find((s) => s !== match) || '对方';
      return { self: match, other };
    }
  }

  // 策略2: 名字中包含"我"字
  for (const sender of senders) {
    if (sender.includes('我')) {
      const other = senders.find((s) => s !== sender) || '对方';
      return { self: sender, other };
    }
  }

  // 策略3: 默认第一个发言者为对方（用户通常先粘贴对方的对话）
  if (senders.length >= 2) {
    // 统计每个 sender 的消息数量，较少的一方可能是"我"
    // 但更常见的做法是取名字不是系统名的第一个
    return { self: senders[1] || senders[0], other: senders[0] };
  }

  // 只有一个人说话
  return { self: '我', other: senders[0] || '对方' };
}

// ─── 主解析函数 ───────────────────────────────────────────

export function parseTextChat(rawText: string): ParseResult {
  const emptyResult: ParseResult = {
    messages: [],
    participants: { self: '我', other: '对方' },
    startDate: '',
    endDate: '',
    totalMessages: 0,
    mediaCount: { images: 0, videos: 0 },
  };

  if (!rawText || !rawText.trim()) {
    return emptyResult;
  }

  // 统一换行符
  const text = rawText.replace(/\r\n/g, '\n').replace(/\r/g, '\n');
  const lines = text.split('\n');

  // 依次尝试三种格式
  let raws: RawMessage[] | null = null;

  // 先尝试格式2（冒号格式），因为它最容易区分
  raws = parseFormat2(lines);
  // 再尝试格式3（三行一组）
  if (!raws || raws.length === 0) {
    raws = parseFormat3(lines);
  }
  // 最后尝试格式1（最通用的格式）
  if (!raws || raws.length === 0) {
    raws = parseFormat1(lines);
  }

  if (!raws || raws.length === 0) {
    return emptyResult;
  }

  // 过滤系统消息
  const filtered = raws.filter((r) => r.type !== 'system');

  // 识别参与者
  const participants = identifyParticipants(filtered);

  // 转换为 Message[]
  const messages: Message[] = filtered.map((r) => {
    const timestamp = r.date ? `${r.date} ${r.time}` : r.time;
    return {
      id: generateId(),
      sender: r.sender === participants.self ? 'user' : 'character',
      content: r.content,
      timestamp,
      type: r.type === 'system' ? 'text' : r.type,
    };
  });

  // 统计
  const images = messages.filter((m) => m.type === 'image').length;
  const videos = messages.filter((m) => m.type === 'video').length;

  // 日期范围
  const timestamps = messages.map((m) => m.timestamp).filter(Boolean).sort();
  const startDate = timestamps[0]?.substring(0, 10) || '';
  const endDate = timestamps[timestamps.length - 1]?.substring(0, 10) || '';

  return {
    messages,
    participants,
    startDate,
    endDate,
    totalMessages: messages.length,
    mediaCount: { images, videos },
  };
}
