/**
 * WeChatExporter HTML 聊天记录解析器
 *
 * 解析 WeChatExporter 导出的 HTML 文件结构，
 * 提取消息、发送者、时间、媒体文件等信息。
 */

import type { Message } from '../../types/timeline';
import type { ParseResult } from './textParser';

// ─── 导出接口 ────────────────────────────────────────────

export interface HTMLMediaFile {
  id: string;
  type: 'image' | 'video';
  filename: string;
  blob?: Blob;
  dataUrl?: string;
}

export interface HTMLParseResult extends ParseResult {
  mediaFiles: HTMLMediaFile[];
}

// ─── 常量 ─────────────────────────────────────────────────

let _htmlMsgCounter = 0;

function generateId(): string {
  _htmlMsgCounter += 1;
  return `html_msg_${Date.now()}_${_htmlMsgCounter}`;
}

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

function isSystemMessage(text: string): boolean {
  const trimmed = text.trim();
  return SYSTEM_KEYWORDS.some((kw) => trimmed.includes(kw));
}

function padZero(n: number): string {
  return n < 10 ? `0${n}` : `${n}`;
}

// ─── HTML 解析辅助函数 ─────────────────────────────────────

/**
 * 尝试从元素中提取时间文本
 * 查找顺序：.time, .date, time 属性, data-time 属性
 */
function extractTime(element: Element): string {
  // 查找 .time 子元素
  const timeEl = element.querySelector('.time');
  if (timeEl?.textContent?.trim()) {
    return timeEl.textContent.trim();
  }

  // 查找 .date 子元素
  const dateEl = element.querySelector('.date');
  if (dateEl?.textContent?.trim()) {
    return dateEl.textContent.trim();
  }

  // 查找 data-time 属性
  const dataTime = element.getAttribute('data-time');
  if (dataTime) {
    return dataTime;
  }

  // 查找 <time> 标签
  const timeTag = element.querySelector('time');
  if (timeTag?.textContent?.trim()) {
    return timeTag.textContent.trim();
  }

  return '';
}

/**
 * 提取发送者名字
 */
function extractName(element: Element): string {
  const nameEl = element.querySelector('.name');
  if (nameEl?.textContent?.trim()) {
    return nameEl.textContent.trim();
  }

  const nameEl2 = element.querySelector('.nickname');
  if (nameEl2?.textContent?.trim()) {
    return nameEl2.textContent.trim();
  }

  return '';
}

/**
 * 提取消息内容文本
 */
function extractContent(element: Element): string {
  const contentEl = element.querySelector('.content');
  if (contentEl) {
    return contentEl.textContent?.trim() || '';
  }

  const textEl = element.querySelector('.text');
  if (textEl) {
    return textEl.textContent?.trim() || '';
  }

  return '';
}

/**
 * 查找消息中的媒体元素
 */
function extractMedia(
  element: Element,
  fileMap: Map<string, File>
): { type: 'image' | 'video'; filename: string; mediaFile?: HTMLMediaFile } | null {
  // 查找图片
  const img = element.querySelector('img');
  if (img) {
    const src = img.getAttribute('src') || '';
    // 过滤掉头像图片（通常在 .avatar 内）
    const isInAvatar = img.closest('.avatar') !== null;
    if (!isInAvatar && src && !src.startsWith('data:')) {
      const filename = getFilenameFromPath(src);
      const file = fileMap.get(filename) || fileMap.get(src);
      const mediaFile: HTMLMediaFile = {
        id: generateId(),
        type: 'image',
        filename,
        blob: file,
      };
      return { type: 'image', filename, mediaFile };
    }
  }

  // 查找视频
  const video = element.querySelector('video');
  if (video) {
    const src = video.getAttribute('src') || '';
    const source = video.querySelector('source');
    const sourceSrc = source?.getAttribute('src') || '';
    const finalSrc = src || sourceSrc;

    if (finalSrc) {
      const filename = getFilenameFromPath(finalSrc);
      const file = fileMap.get(filename) || fileMap.get(finalSrc);
      const mediaFile: HTMLMediaFile = {
        id: generateId(),
        type: 'video',
        filename,
        blob: file,
      };
      return { type: 'video', filename, mediaFile };
    }
  }

  return null;
}

/**
 * 从路径中提取文件名
 * "img/photo.jpg" → "photo.jpg"
 */
function getFilenameFromPath(path: string): string {
  const parts = path.split('/');
  return parts[parts.length - 1] || path;
}

// ─── 自动识别"我" ────────────────────────────────────────

const SELF_KEYWORDS = ['我', '自己'];

function identifyParticipants(
  senders: string[]
): { self: string; other: string } {
  for (const keyword of SELF_KEYWORDS) {
    const match = senders.find((s) => s === keyword);
    if (match) {
      const other = senders.find((s) => s !== match) || '对方';
      return { self: match, other };
    }
  }

  for (const sender of senders) {
    if (sender.includes('我')) {
      const other = senders.find((s) => s !== sender) || '对方';
      return { self: sender, other };
    }
  }

  if (senders.length >= 2) {
    return { self: senders[1], other: senders[0] };
  }

  return { self: '我', other: senders[0] || '对方' };
}

// ─── 将 Blob/File 转为 dataUrl ────────────────────────────

async function blobToDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => resolve(reader.result as string);
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
}

// ─── 主解析函数 ────────────────────────────────────────────

export async function parseHTMLChat(
  htmlContent: string,
  fileMap: Map<string, File>
): Promise<HTMLParseResult> {
  const emptyResult: HTMLParseResult = {
    messages: [],
    participants: { self: '我', other: '对方' },
    startDate: '',
    endDate: '',
    totalMessages: 0,
    mediaCount: { images: 0, videos: 0 },
    mediaFiles: [],
  };

  if (!htmlContent || !htmlContent.trim()) {
    return emptyResult;
  }

  // 使用 DOMParser 解析 HTML
  const parser = new DOMParser();
  const doc = parser.parseFromString(htmlContent, 'text/html');

  // 查找所有聊天消息项
  // WeChatExporter 可能使用多种选择器
  const chatItems = doc.querySelectorAll(
    '.chat-item, .msg-item, .message-item, .chatItem, .msgItem'
  );

  if (chatItems.length === 0) {
    // 备选：尝试更宽松的选择器
    const fallbackItems = doc.querySelectorAll('[class*="chat"], [class*="msg"], [class*="message"]');
    if (fallbackItems.length === 0) {
      return emptyResult;
    }
    return parseFallback(doc, fileMap, fallbackItems);
  }

  return parseChatItems(chatItems, fileMap);
}

/**
 * 解析标准聊天项
 */
async function parseChatItems(
  chatItems: NodeListOf<Element>,
  fileMap: Map<string, File>
): Promise<HTMLParseResult> {
  const allMediaFiles: HTMLMediaFile[] = [];
  const rawMessages: {
    sender: string;
    time: string;
    content: string;
    type: Message['type'];
    mediaFile?: HTMLMediaFile;
  }[] = [];

  let currentDate = '';

  chatItems.forEach((item) => {
    const name = extractName(item);
    const time = extractTime(item);
    const content = extractContent(item);
    const media = extractMedia(item, fileMap);

    // 检查是否是日期分割线
    if (!name && !content) {
      if (time) {
        // 可能是日期行
        const dateMatch = time.match(/(\d{4})[年/\-.](\d{1,2})[月/\-.](\d{1,2})/);
        if (dateMatch) {
          currentDate = `${dateMatch[1]}-${padZero(parseInt(dateMatch[2], 10))}-${padZero(parseInt(dateMatch[3], 10))}`;
        }
      }
      return;
    }

    if (!content && !media) return;
    if (isSystemMessage(content)) return;

    let msgType: Message['type'] = 'text';
    if (media) {
      msgType = media.type;
      if (media.mediaFile) {
        allMediaFiles.push(media.mediaFile);
      }
    } else if (/^\[图片\]$/.test(content.trim())) {
      msgType = 'image';
    } else if (/^\[视频\]$/.test(content.trim())) {
      msgType = 'video';
    }

    // 处理时间
    let normalizedTime = time;
    if (time && !time.includes('-') && !time.includes('/')) {
      // 只是时间，需要加上日期
      normalizedTime = currentDate ? `${currentDate} ${time}` : time;
    }

    rawMessages.push({
      sender: name,
      time: normalizedTime,
      content: content || (media ? `[${media.type === 'image' ? '图片' : '视频'}]` : ''),
      type: msgType,
      mediaFile: media?.mediaFile,
    });
  });

  // 识别参与者
  const senderNames = [...new Set(rawMessages.map((m) => m.sender).filter(Boolean))];
  const participants = identifyParticipants(senderNames);

  // 转换为 Message[]
  const messages: Message[] = rawMessages.map((r) => ({
    id: generateId(),
    sender: r.sender === participants.self ? 'user' : 'character',
    content: r.content,
    timestamp: r.time,
    type: r.type,
    mediaUrl: r.mediaFile?.dataUrl || r.mediaFile?.filename,
  }));

  // 统计
  const images = messages.filter((m) => m.type === 'image').length;
  const videos = messages.filter((m) => m.type === 'video').length;

  // 异步转换 blob → dataUrl
  for (const mf of allMediaFiles) {
    if (mf.blob) {
      try {
        mf.dataUrl = await blobToDataUrl(mf.blob);
        // 更新对应 message 的 mediaUrl
        const matchedMsg = messages.find(
          (m) => m.mediaUrl === mf.filename
        );
        if (matchedMsg) {
          matchedMsg.mediaUrl = mf.dataUrl;
        }
      } catch {
        // 转换失败，保留 filename
      }
    }
  }

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
    mediaFiles: allMediaFiles,
  };
}

/**
 * 备选解析：当标准选择器不匹配时，尝试更宽松的解析
 */
async function parseFallback(
  doc: Document,
  fileMap: Map<string, File>,
  items: NodeListOf<Element>
): Promise<HTMLParseResult> {
  // 过滤出看起来像聊天消息的元素
  const chatItems = Array.from(items).filter((el) => {
    // 必须同时有名字和内容子元素（或看起来包含文本）
    return el.querySelector('.name, .nickname') || el.querySelector('.content, .text');
  });

  if (chatItems.length === 0) {
    return {
      messages: [],
      participants: { self: '我', other: '对方' },
      startDate: '',
      endDate: '',
      totalMessages: 0,
      mediaCount: { images: 0, videos: 0 },
      mediaFiles: [],
    };
  }

  // 转换为 NodeList-like 便于复用 parseChatItems
  // 由于无法构造 NodeList，直接处理数组
  const result = await parseChatItems(
    // 使用 Proxy 让数组 behave like NodeList
    { length: chatItems.length, item: (i: number) => chatItems[i] } as unknown as NodeListOf<Element>,
    fileMap
  );

  return result;
}
