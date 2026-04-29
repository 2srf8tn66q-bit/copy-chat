import { useRef, useEffect, useState, useCallback, type ReactNode } from 'react';
import { ChevronLeft } from 'lucide-react';
import type { Message } from '../../types/timeline';
import ChatBubble from './ChatBubble';
import ChatInput from './ChatInput';
import TypingIndicator from './TypingIndicator';

interface ChatContainerProps {
  messages: Message[];
  characterName: string;
  characterAvatar?: string;
  onSendMessage: (text: string) => void;
  inputDisabled?: boolean;
  inputPlaceholder?: string;
  headerRight?: ReactNode;
  onBack?: () => void;
  typing?: boolean;
}

export default function ChatContainer({
  messages,
  characterName,
  characterAvatar,
  onSendMessage,
  inputDisabled = false,
  inputPlaceholder,
  headerRight,
  onBack,
  typing = false,
}: ChatContainerProps) {
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

  // Determine if a message should show its avatar:
  // Only the first message in a consecutive run of same-sender messages
  const shouldShowAvatar = (index: number): boolean => {
    const msg = messages[index];
    // System messages don't have avatars
    if (msg.type === 'system') return false;
    // First message always shows avatar
    if (index === 0) return true;
    const prev = messages[index - 1];
    // If previous message is from a different sender, show avatar
    if (prev.sender !== msg.sender) return true;
    // Same sender as previous, don't show avatar
    return false;
  };

  // Determine if a timestamp should be shown:
  // Show if gap > 5 minutes from previous message
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
      return t2 - t1 > 5 * 60 * 1000; // 5 minutes
    } catch {
      return false;
    }
  };

  return (
    <div
      className="flex flex-col h-full"
      style={{ backgroundColor: '#EDEDED' }}
    >
      {/* Header */}
      <div
        className="flex items-center shrink-0"
        style={{
          height: '48px',
          backgroundColor: '#EDEDED',
          borderBottom: '1px solid #d9d9d9',
          // safe area for mobile
          paddingTop: 'env(safe-area-inset-top, 0px)',
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
          <ChevronLeft size={24} color="#000" />
        </button>

        {/* Title */}
        <div
          className="flex-1 text-center"
          style={{
            fontSize: '17px',
            fontWeight: 500,
            color: '#000',
            lineHeight: '48px',
          }}
        >
          {characterName}
        </div>

        {/* Right area */}
        <div
          className="shrink-0 flex items-center"
          style={{ width: '40px', height: '100%' }}
        >
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
          {messages.map((msg, i) => (
            <ChatBubble
              key={msg.id}
              message={msg}
              showAvatar={shouldShowAvatar(i)}
              characterAvatar={characterAvatar}
              showTimestamp={shouldShowTimestamp(i)}
            />
          ))}
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
