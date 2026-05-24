import { useState, useRef, useEffect } from 'react';
import type { Message } from '../../types/timeline';
import { User, Wand2 } from 'lucide-react';
import { motion } from 'motion/react';
import { useChatColors } from './chatTheme';
import FadeImage from '../FadeImage';
import Tooltip from '../Tooltip';

// 悬停意图判断：避免鼠标"扫过"就触发
const HOVER_INTENT_MS = 300;

interface ChatBubbleProps {
  message: Message;
  showAvatar: boolean;
  characterAvatar?: string;
  userAvatar?: string;
  showTimestamp: boolean;
  /** 用户点击"修正"按钮时调用 — 只对 character 消息有效 */
  onRefine?: (message: Message) => void;
}

export default function ChatBubble({
  message,
  showAvatar,
  characterAvatar,
  userAvatar,
  showTimestamp,
  onRefine,
}: ChatBubbleProps) {
  const c = useChatColors();

  // System messages: centered small grey text, no bubble (gentle fade-in)
  if (message.type === 'system') {
    return (
      <motion.div
        className="flex justify-center py-2 px-4"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.3, ease: [0.16, 1, 0.3, 1] }}
      >
        <span
          className="text-xs leading-none"
          style={{ color: c.systemText, fontSize: '12px' }}
        >
          {message.content}
        </span>
      </motion.div>
    );
  }

  const isUser = message.sender === 'user';

  // Timestamp display
  const timestampEl = showTimestamp ? (
    <div className="flex justify-center py-2">
      <span
        className="text-xs leading-none"
        style={{ color: c.timestamp, fontSize: '12px' }}
      >
        {formatTimestamp(message.timestamp)}
      </span>
    </div>
  ) : null;

  // Avatar element
  const avatarEl = (
    <div
      className="shrink-0 flex items-end"
      style={{ width: '40px', height: '40px' }}
    >
      {showAvatar ? (
        <div
          className="flex items-center justify-center overflow-hidden"
          style={{
            width: '40px',
            height: '40px',
            borderRadius: '4px',
            backgroundColor: isUser ? c.avatarUserBg : c.avatarBg,
          }}
        >
          {isUser ? (
            userAvatar ? (
              <FadeImage
                src={userAvatar}
                alt=""
                className="h-full w-full object-cover"
                style={{ borderRadius: '4px' }}
              />
            ) : (
              <User size={20} color={c.avatarIcon} />
            )
          ) : characterAvatar ? (
            <FadeImage
              src={characterAvatar}
              alt=""
              className="h-full w-full object-cover"
              style={{ borderRadius: '4px' }}
            />
          ) : (
            <User size={20} color={c.avatarIcon} />
          )}
        </div>
      ) : (
        <div style={{ width: '40px', height: '40px' }} />
      )}
    </div>
  );

  const bubbleBg = isUser ? c.outgoingBubble : c.incomingBubble;
  const bubbleText = isUser ? c.outgoingText : c.incomingText;

  // Bubble element — max-width 由外层 wrapper 承担
  const bubbleEl = (
    <div
      className="relative px-3 py-2"
      style={{
        borderRadius: '4px',
        backgroundColor: bubbleBg,
        color: bubbleText,
        fontSize: '16px',
        lineHeight: '1.5',
        wordBreak: 'break-word',
        border: !isUser && c.incomingBorder !== 'transparent'
          ? `1px solid ${c.incomingBorder}`
          : 'none',
        transition: 'background-color 240ms ease, color 240ms ease',
      }}
    >
      {/* Bubble triangle */}
      {isUser ? (
        <div
          className="absolute"
          style={{
            top: '10px',
            right: '-6px',
            width: 0,
            height: 0,
            borderTop: '6px solid transparent',
            borderBottom: '6px solid transparent',
            borderLeft: `6px solid ${bubbleBg}`,
            transition: 'border-left-color 240ms ease',
          }}
        />
      ) : (
        <div
          className="absolute"
          style={{
            top: '10px',
            left: '-6px',
            width: 0,
            height: 0,
            borderTop: '6px solid transparent',
            borderBottom: '6px solid transparent',
            borderRight: `6px solid ${bubbleBg}`,
            transition: 'border-right-color 240ms ease',
          }}
        />
      )}
      {message.type === 'image' && message.mediaUrl ? (
        <FadeImage src={message.mediaUrl} alt={message.content || '图片'} style={{ maxWidth: '200px', maxHeight: '200px', borderRadius: '4px', display: 'block' }} />
      ) : message.type === 'video' && message.mediaUrl ? (
        <video src={message.mediaUrl} controls style={{ maxWidth: '200px', borderRadius: '4px', display: 'block' }} />
      ) : (
        message.content
      )}
    </div>
  );

  // 仅 character 消息（非自己、非系统）才允许"修正"
  const canRefine = !isUser && message.type === 'text' && !!onRefine;

  // Hover intent: 悬停 300ms 才显示，离开立刻消失
  const [showRefine, setShowRefine] = useState(false);
  const enterTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const wrapperRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    return () => {
      if (enterTimerRef.current) clearTimeout(enterTimerRef.current);
    };
  }, []);

  // 显示中时挂一个全局 mousemove 监听 —— 真正以 wrapper 的几何边界判断"离开"
  // 这是为了兜底 React onMouseLeave 在某些场景下漏触发（动画进场期间、display 变化时序）
  useEffect(() => {
    if (!showRefine) return;
    let raf = 0;
    const onMove = (e: MouseEvent) => {
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(() => {
        const el = wrapperRef.current;
        if (!el) return;
        const r = el.getBoundingClientRect();
        if (e.clientX < r.left || e.clientX > r.right || e.clientY < r.top || e.clientY > r.bottom) {
          setShowRefine(false);
        }
      });
    };
    document.addEventListener('mousemove', onMove);
    return () => {
      cancelAnimationFrame(raf);
      document.removeEventListener('mousemove', onMove);
    };
  }, [showRefine]);

  const handleMouseEnter = () => {
    if (!canRefine) return;
    if (enterTimerRef.current) clearTimeout(enterTimerRef.current);
    enterTimerRef.current = setTimeout(() => setShowRefine(true), HOVER_INTENT_MS);
  };

  const handleMouseLeave = () => {
    if (enterTimerRef.current) clearTimeout(enterTimerRef.current);
    setShowRefine(false);
  };

  // 关键：只在 showRefine 为 true 时**真正 render**这个按钮。
  // 不用 opacity:0 + pointerEvents:none —— 那样它仍然占着 wrapper 的 ~36px 几何宽度，
  // 导致鼠标移出气泡向右走时还在 wrapper 范围内，mouseLeave 不触发，按钮看着像"不消失"。
  const refineButtonEl = canRefine && showRefine ? (
    <Tooltip label="修正 TA 的说话方式" placement="top" delay={400}>
      <motion.button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          onRefine?.(message);
          setShowRefine(false);
        }}
        className="shrink-0 self-center w-7 h-7 rounded-full flex items-center justify-center"
        style={{
          backgroundColor: 'rgba(255,255,255,0.08)',
          color: 'rgba(255,255,255,0.65)',
        }}
        initial={{ opacity: 0, scale: 0.8 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.14, ease: 'easeOut' }}
        aria-label="修正"
      >
        <Wand2 size={13} />
      </motion.button>
    </Tooltip>
  ) : null;

  return (
    <>
      {timestampEl}
      <motion.div
        className={`flex items-end gap-2 px-3 py-1 ${
          isUser ? 'flex-row-reverse' : 'flex-row'
        }`}
        initial={{ opacity: 0, y: 10, scale: 0.96 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{
          type: 'spring',
          damping: 26,
          stiffness: 360,
          mass: 0.8,
        }}
      >
        {avatarEl}
        {/* hover 检测只挂在这个紧贴 bubble 的小盒子上 —— 不包括 avatar 和外层 padding。
            ref 给全局 mousemove 安全网用：以这个 div 的实际几何边界判断"鼠标是否在范围内"。 */}
        <div
          ref={wrapperRef}
          className="flex items-end gap-2 min-w-0"
          style={{ maxWidth: '70%' }}
          onMouseEnter={canRefine ? handleMouseEnter : undefined}
          onMouseLeave={canRefine ? handleMouseLeave : undefined}
        >
          {bubbleEl}
          {refineButtonEl}
        </div>
      </motion.div>
    </>
  );
}

function formatTimestamp(ts: string): string {
  try {
    const date = new Date(ts);
    if (isNaN(date.getTime())) return ts;
    const h = date.getHours().toString().padStart(2, '0');
    const m = date.getMinutes().toString().padStart(2, '0');
    return `${h}:${m}`;
  } catch {
    return ts;
  }
}
