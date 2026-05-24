import { useState, useRef, useEffect } from 'react';
import { useChatColors } from './chatTheme';

interface EmojiPickerProps {
  onSelect: (emoji: string) => void;
  onClose: () => void;
}

const CATEGORIES: { label: string; emojis: string[] }[] = [
  {
    label: '常用',
    emojis: [
      '😂', '😭', '🥺', '😍', '😘', '🤣', '😊', '😅',
      '😢', '😏', '😒', '🙄', '😳', '😱', '🤔', '😡',
      '👍', '👎', '❤️', '💔', '🔥', '✨', '🎉', '💯',
      '🙏', '😴', '🤗', '😎', '🥰', '😤', '😠', '🤮',
    ],
  },
  {
    label: '笑脸',
    emojis: [
      '😀', '😃', '😄', '😁', '😆', '🤩', '😋', '😛',
      '😜', '🤪', '😝', '🤑', '🤭', '🤫', '🤥', '😶',
      '😐', '😑', '😬', '🫡', '🤐', '🥱', '😌', '😔',
      '🫠', '🤒', '🤕', '🤧', '🥵', '🥶', '🥴', '😵',
    ],
  },
  {
    label: '手势',
    emojis: [
      '👋', '🤚', '🖐️', '✋', '🖖', '🫱', '🫲', '👌',
      '🤌', '🤏', '✌️', '🤞', '🫰', '🤟', '🤘', '🤙',
      '👈', '👉', '👆', '👇', '☝️', '🫵', '👏', '🙌',
      '👐', '🤲', '🤝', '💪', '🫶', '✍️', '🫡', '💅',
    ],
  },
  {
    label: '动物',
    emojis: [
      '🐶', '🐱', '🐭', '🐹', '🐰', '🦊', '🐻', '🐼',
      '🐨', '🐯', '🦁', '🐮', '🐷', '🐸', '🐵', '🙈',
      '🙉', '🙊', '🐔', '🐧', '🐦', '🦋', '🐛', '🐝',
    ],
  },
  {
    label: '食物',
    emojis: [
      '🍎', '🍊', '🍋', '🍉', '🍇', '🍓', '🫐', '🍑',
      '🍔', '🍟', '🍕', '🌮', '🍜', '🍣', '🍦', '🍰',
      '☕', '🧋', '🍺', '🍷', '🥤', '🧃', '🍵', '🥛',
    ],
  },
  {
    label: '符号',
    emojis: [
      '❤️', '🧡', '💛', '💚', '💙', '💜', '🖤', '🤍',
      '💕', '💞', '💓', '💗', '💖', '💘', '💝', '💟',
      '⭐', '🌟', '💫', '⚡', '🌈', '☀️', '🌙', '🌸',
    ],
  },
];

export default function EmojiPicker({ onSelect, onClose }: EmojiPickerProps) {
  const c = useChatColors();
  const [activeTab, setActiveTab] = useState(0);
  const panelRef = useRef<HTMLDivElement>(null);

  // Close on click outside
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (panelRef.current && !panelRef.current.contains(e.target as Node)) {
        onClose();
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [onClose]);

  return (
    <div
      ref={panelRef}
      style={{
        position: 'absolute',
        bottom: '100%',
        right: '40px',
        marginBottom: '8px',
        width: '320px',
        backgroundColor: c.emojiPickerBg,
        borderRadius: '12px',
        boxShadow: '0 4px 20px rgba(0,0,0,0.35)',
        overflow: 'hidden',
        zIndex: 50,
        border: `1px solid ${c.emojiPickerBorder}`,
      }}
    >
      {/* Category tabs */}
      <div
        style={{
          display: 'flex',
          borderBottom: `1px solid ${c.emojiPickerBorder}`,
          padding: '0 4px',
          gap: '0',
        }}
      >
        {CATEGORIES.map((cat, i) => (
          <button
            key={cat.label}
            onClick={() => setActiveTab(i)}
            style={{
              flex: 1,
              padding: '8px 0',
              fontSize: '12px',
              fontWeight: activeTab === i ? 600 : 400,
              color: activeTab === i ? c.emojiPickerTabActive : c.emojiPickerTabIdle,
              background: 'none',
              border: 'none',
              borderBottomWidth: '2px',
              borderBottomStyle: 'solid',
              borderBottomColor: activeTab === i ? c.emojiPickerTabActive : 'transparent',
              cursor: 'pointer',
              transition: 'all 0.15s',
            }}
          >
            {cat.label}
          </button>
        ))}
      </div>

      {/* Emoji grid */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(8, 1fr)',
          gap: '2px',
          padding: '8px',
          maxHeight: '200px',
          overflowY: 'auto',
        }}
      >
        {CATEGORIES[activeTab].emojis.map((emoji, i) => (
          <button
            key={`${emoji}-${i}`}
            onClick={() => onSelect(emoji)}
            style={{
              width: '36px',
              height: '36px',
              fontSize: '22px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              borderRadius: '6px',
              border: 'none',
              background: 'none',
              cursor: 'pointer',
              transition: 'background 0.1s',
            }}
            onMouseEnter={(e) => { (e.target as HTMLElement).style.backgroundColor = c.emojiPickerHover; }}
            onMouseLeave={(e) => { (e.target as HTMLElement).style.backgroundColor = 'transparent'; }}
          >
            {emoji}
          </button>
        ))}
      </div>
    </div>
  );
}
