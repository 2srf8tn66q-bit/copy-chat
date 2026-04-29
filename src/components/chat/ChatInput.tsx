import { useState, type KeyboardEvent } from 'react';
import { Mic, Smile, PlusCircle } from 'lucide-react';

interface ChatInputProps {
  onSend: (text: string) => void;
  disabled?: boolean;
  placeholder?: string;
}

export default function ChatInput({
  onSend,
  disabled = false,
  placeholder = '',
}: ChatInputProps) {
  const [text, setText] = useState('');

  const handleSend = () => {
    const trimmed = text.trim();
    if (!trimmed || disabled) return;
    onSend(trimmed);
    setText('');
  };

  const handleKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  return (
    <div
      className="flex items-end gap-2 shrink-0"
      style={{
        backgroundColor: '#F7F7F7',
        borderTop: '1px solid #DEDEDE',
        padding: '8px 10px',
        // safe area for mobile
        paddingBottom: 'calc(8px + env(safe-area-inset-bottom, 0px))',
      }}
    >
      {/* Microphone icon */}
      <button
        type="button"
        className="flex items-center justify-center shrink-0"
        style={{ width: '32px', height: '36px' }}
      >
        <Mic size={24} color="#333" />
      </button>

      {/* Text input */}
      <textarea
        value={text}
        onChange={(e) => setText(e.target.value)}
        onKeyDown={handleKeyDown}
        disabled={disabled}
        placeholder={placeholder}
        rows={1}
        className="flex-1 resize-none outline-none"
        style={{
          height: '36px',
          maxHeight: '100px',
          fontSize: '16px',
          lineHeight: '20px',
          padding: '8px 10px',
          borderRadius: '4px',
          border: '1px solid #DEDEDE',
          backgroundColor: '#FFFFFF',
          color: '#000',
          fontFamily: 'inherit',
        }}
      />

      {/* Emoji icon */}
      <button
        type="button"
        className="flex items-center justify-center shrink-0"
        style={{ width: '32px', height: '36px' }}
      >
        <Smile size={24} color="#333" />
      </button>

      {/* Plus icon */}
      <button
        type="button"
        className="flex items-center justify-center shrink-0"
        style={{ width: '32px', height: '36px' }}
      >
        <PlusCircle size={24} color="#333" />
      </button>
    </div>
  );
}
