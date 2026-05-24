/**
 * 聊天主题色板
 *
 * light 还原 WeChat 经典浅色（#EDEDED + 绿气泡）
 * dark 参照 WeChat 官方夜间模式（深灰底 + 深绿气泡 + 浅字）
 *
 * 所有 chat 组件通过 useChatColors() 消费这套主题。
 */

import { useChatThemeStore } from '../../stores/chatThemeStore';

export interface ChatColors {
  // 容器
  bg: string;
  header: string;
  headerBorder: string;
  headerText: string;

  // 气泡
  incomingBubble: string;
  incomingText: string;
  incomingBorder: string; // dark mode 下用细描边增强层次
  outgoingBubble: string;
  outgoingText: string;

  // 文字
  timestamp: string;
  systemText: string;

  // 头像
  avatarBg: string;
  avatarUserBg: string;
  avatarIcon: string;

  // 输入区
  inputBg: string;
  inputBorder: string;
  inputFieldBg: string;
  inputFieldText: string;
  inputFieldBorder: string;
  inputFieldPlaceholder: string;
  inputIcon: string;
  inputIconActive: string;

  // Emoji picker
  emojiPickerBg: string;
  emojiPickerBorder: string;
  emojiPickerTabActive: string;
  emojiPickerTabIdle: string;
  emojiPickerHover: string;

  // 主题切换按钮自身
  toggleIcon: string;
}

const light: ChatColors = {
  bg: '#EDEDED',
  header: '#EDEDED',
  headerBorder: '#d9d9d9',
  headerText: '#000000',

  incomingBubble: '#FFFFFF',
  incomingText: '#000000',
  incomingBorder: 'transparent',
  outgoingBubble: '#95EC69',
  outgoingText: '#000000',

  timestamp: '#999999',
  systemText: '#999999',

  avatarBg: '#d9d9d9',
  avatarUserBg: '#b2d8b2',
  avatarIcon: '#555555',

  inputBg: '#F7F7F7',
  inputBorder: '#DEDEDE',
  inputFieldBg: '#FFFFFF',
  inputFieldText: '#000000',
  inputFieldBorder: '#DEDEDE',
  inputFieldPlaceholder: '#999999',
  inputIcon: '#333333',
  inputIconActive: '#07c160',

  emojiPickerBg: '#FFFFFF',
  emojiPickerBorder: '#EEEEEE',
  emojiPickerTabActive: '#07c160',
  emojiPickerTabIdle: '#999999',
  emojiPickerHover: '#F0F0F0',

  toggleIcon: '#333333',
};

const dark: ChatColors = {
  // 对照官方 WeChat 夜间模式截图取色
  bg: '#1A1A1A',
  header: '#1A1A1A',
  headerBorder: '#2A2A2A',
  headerText: 'rgba(255, 255, 255, 0.95)',

  incomingBubble: '#2C2C2C',
  incomingText: 'rgba(255, 255, 255, 0.95)',
  incomingBorder: 'transparent',
  outgoingBubble: '#5DD685',          // 亮绿气泡（WeChat 夜间模式标志色）
  outgoingText: '#000000',            // 亮绿底配黑字

  timestamp: 'rgba(255, 255, 255, 0.42)',
  systemText: 'rgba(255, 255, 255, 0.42)',

  avatarBg: '#2C2C2C',
  avatarUserBg: '#2C2C2C',
  avatarIcon: 'rgba(255, 255, 255, 0.55)',

  inputBg: '#1A1A1A',
  inputBorder: '#2A2A2A',
  inputFieldBg: '#252525',
  inputFieldText: 'rgba(255, 255, 255, 0.95)',
  inputFieldBorder: '#2A2A2A',
  inputFieldPlaceholder: 'rgba(255, 255, 255, 0.32)',
  inputIcon: 'rgba(255, 255, 255, 0.55)',
  inputIconActive: '#5DD685',

  emojiPickerBg: '#252525',
  emojiPickerBorder: '#333333',
  emojiPickerTabActive: '#5DD685',
  emojiPickerTabIdle: 'rgba(255, 255, 255, 0.45)',
  emojiPickerHover: 'rgba(255, 255, 255, 0.06)',

  toggleIcon: 'rgba(255, 255, 255, 0.85)',
};

export function useChatColors(): ChatColors {
  const theme = useChatThemeStore((s) => s.theme);
  return theme === 'dark' ? dark : light;
}

export function getChatColors(theme: 'light' | 'dark'): ChatColors {
  return theme === 'dark' ? dark : light;
}
