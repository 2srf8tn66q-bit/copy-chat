import { useRef, useEffect, useState, useCallback, type ReactNode } from 'react';
import { ChevronLeft, Sun, Moon } from 'lucide-react';
import { AnimatePresence } from 'motion/react';
import Tooltip from '../Tooltip';
import type { Message } from '../../types/timeline';
import ChatBubble from './ChatBubble';
import ChatInput from './ChatInput';
import TypingIndicator from './TypingIndicator';
import { useChatColors } from './chatTheme';
import { useChatThemeStore } from '../../stores/chatThemeStore';

interface ChatContainerProps {
  messages: Message[];
  characterName: string;
  characterAvatar?: string;
  /** 用户自己的头像（来自 userProfileStore），无值则用默认 User icon */
  userAvatar?: string;
  onSendMessage: (text: string) => void;
  inputDisabled?: boolean;
  inputPlaceholder?: string;
  headerRight?: ReactNode;
  onBack?: () => void;
  typing?: boolean;
  /** 用户点击某条 character 消息上的"修正"按钮 */
  onRefineMessage?: (message: Message) => void;
}

export default function ChatContainer({
  messages,
  characterName,
  characterAvatar,
  userAvatar,
  onSendMessage,
  inputDisabled = false,
  inputPlaceholder,
  headerRight,
  onBack,
  typing = false,
  onRefineMessage,
}: ChatContainerProps) {
  const c = useChatColors();
  const theme = useChatThemeStore((s) => s.theme);
  const toggleTheme = useChatThemeStore((s) => s.toggle);

  const scrollRef = useRef<HTMLDivElement>(null);
  const [shouldAutoScroll, setShouldAutoScroll] = useState(true);

  // Detect if user is near the bottom
  const handleScroll = useCallback(() => {
    const el = scrollRef.current;
    if (!el) return;
    const threshold = 80;
    const distanceFromBottom = el.scrollHeight - el.scrollTop - el.clientHeight;
    setShouldAutoScroll(distanceFromBottom <= threshold);
  }, []);

  // Auto-scroll to bottom when new messages arrive (only if user is near bottom)
  useEffect(() => {
    if (shouldAutoScroll) {
      const el = scrollRef.current;
      if (el) {
        el.scrollTop = el.scrollHeight;
      }
    }
  }, [messages, typing, shouldAutoScroll]);

  // Also scroll to bottom on initial mount
  useEffect(() => {
    const el = scrollRef.current;
    if (el) {
      el.scrollTop = el.scrollHeight;
    }
    // Only run once on mount
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Determine if a message should show its avatar
  const shouldShowAvatar = (index: number): boolean => {
    const msg = messages[index];
    if (msg.type === 'system') return false;
    if (index === 0) return true;
    const prev = messages[index - 1];
    if (prev.sender !== msg.sender) return true;
    return false;
  };

  // Show timestamp if gap > 5 minutes
  const shouldShowTimestamp = (index: number): boolean => {
    const msg = messages[index];
    if (msg.type === 'system') return false;
    if (index === 0) return true;
    const prev = messages[index - 1];
    if (prev.type === 'system') return true;
    try {
      const t1 = new Date(prev.timestamp).getTime();
      const t2 = new Date(msg.timestamp).getTime();
      if (isNaN(t1) || isNaN(t2)) return false;
      return t2 - t1 > 5 * 60 * 1000;
    } catch {
      return false;
    }
  };

  return (
    <div
      className="flex flex-col h-full"
      style={{ backgroundColor: c.bg, transition: 'background-color 240ms ease' }}
    >
      {/* Header */}
      <div
        className="flex items-center shrink-0"
        style={{
          height: '48px',
          backgroundColor: c.header,
          borderBottom: `1px solid ${c.headerBorder}`,
          paddingTop: 'env(safe-area-inset-top, 0px)',
          transition: 'background-color 240ms ease, border-color 240ms ease',
        }}
      >
        {/* Back button */}
        <button
          type="button"
          onClick={onBack}
          className="flex items-center justify-center shrink-0"
          style={{
            width: '40px',
            height: '100%',
            border: 'none',
            background: 'transparent',
            cursor: 'pointer',
          }}
        >
          <ChevronLeft size={24} color={c.headerText} />
        </button>

        {/* Title */}
        <div
          className="flex-1 text-center"
          style={{
            fontSize: '17px',
            fontWeight: 500,
            color: c.headerText,
            lineHeight: '48px',
            transition: 'color 240ms ease',
          }}
        >
          {characterName}
        </div>

        {/* Right area: theme toggle + any custom right node */}
        <div
          className="shrink-0 flex items-center gap-1 pr-2"
          style={{ height: '100%' }}
        >
          <Tooltip label={theme === 'dark' ? '切换到浅色' : '切换到深色'} placement="bottom">
            <button
              type="button"
              onClick={toggleTheme}
              className="flex items-center justify-center"
              style={{
                width: '36px',
                height: '36px',
                border: 'none',
                background: 'transparent',
                cursor: 'pointer',
                borderRadius: '8px',
                transition: 'background-color 150ms ease',
              }}
              onMouseEnter={(e) => {
                (e.currentTarget as HTMLElement).style.backgroundColor = theme === 'dark'
                  ? 'rgba(255,255,255,0.08)'
                  : 'rgba(0,0,0,0.05)';
              }}
              onMouseLeave={(e) => {
                (e.currentTarget as HTMLElement).style.backgroundColor = 'transparent';
              }}
            >
              {theme === 'dark'
                ? <Sun size={18} color={c.toggleIcon} />
                : <Moon size={18} color={c.toggleIcon} />
              }
            </button>
          </Tooltip>
          {headerRight}
        </div>
      </div>

      {/* Message area */}
      <div
        ref={scrollRef}
        onScroll={handleScroll}
        className="flex-1 overflow-y-auto"
        style={{
          WebkitOverflowScrolling: 'touch',
        }}
      >
        <div className="py-3">
          {/* initial={false}：第一次渲染不动画（加载历史时不刷一遍 spring），仅对新加入的消息触发入场 */}
          <AnimatePresence initial={false}>
            {(messages ?? []).map((msg, i) => (
              <ChatBubble
                key={msg.id}
                message={msg}
                showAvatar={shouldShowAvatar(i)}
                characterAvatar={characterAvatar}
                userAvatar={userAvatar}
                showTimestamp={shouldShowTimestamp(i)}
                onRefine={onRefineMessage}
              />
            ))}
          </AnimatePresence>
          <TypingIndicator visible={typing} />
        </div>
      </div>

      {/* Input bar */}
      <ChatInput
        onSend={onSendMessage}
        disabled={inputDisabled}
        placeholder={inputPlaceholder}
      />
    </div>
  );
}
