import { useState, useRef, useCallback, useEffect, type KeyboardEvent } from 'react';
import { Mic, MicOff, Smile, PlusCircle } from 'lucide-react';
import EmojiPicker from './EmojiPicker';
import { useChatColors } from './chatTheme';
import Tooltip from '../Tooltip';

interface ChatInputProps {
  onSend: (text: string) => void;
  disabled?: boolean;
  placeholder?: string;
}

// ─── Speech Recognition type shim ───────────────────────
interface SpeechRecognitionEvent {
  results: { [index: number]: { [index: number]: { transcript: string } }; length: number };
  resultIndex: number;
}

type SpeechRecognitionInstance = {
  lang: string;
  interimResults: boolean;
  continuous: boolean;
  start(): void;
  stop(): void;
  onresult: ((e: SpeechRecognitionEvent) => void) | null;
  onend: (() => void) | null;
  onerror: ((e: { error: string }) => void) | null;
};

function getSpeechRecognition(): (new () => SpeechRecognitionInstance) | null {
  const w = window as unknown as Record<string, unknown>;
  return (w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null) as (new () => SpeechRecognitionInstance) | null;
}

export default function ChatInput({
  onSend,
  disabled = false,
  placeholder = '',
}: ChatInputProps) {
  const c = useChatColors();
  const [text, setText] = useState('');
  const [showEmoji, setShowEmoji] = useState(false);
  const [isListening, setIsListening] = useState(false);
  const [speechSupported] = useState(() => !!getSpeechRecognition());
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const recognitionRef = useRef<SpeechRecognitionInstance | null>(null);
  const composingRef = useRef(false);
  // 记录最后一次 IME 结束时间 — 用于过滤"确认候选词"那一下的 Enter
  const lastCompositionEndRef = useRef(0);

  // Cleanup recognition on unmount
  useEffect(() => {
    return () => {
      if (recognitionRef.current) {
        recognitionRef.current.onresult = null;
        recognitionRef.current.onend = null;
        recognitionRef.current.onerror = null;
        recognitionRef.current.stop();
      }
    };
  }, []);

  const handleSend = () => {
    const trimmed = text.trim();
    if (!trimmed || disabled) return;
    onSend(trimmed);
    setText('');
    setShowEmoji(false);
  };

  const handleKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    // 三层 IME 防护：
    // 1) nativeEvent.isComposing — 现代浏览器标准信号
    // 2) composingRef — 手动追踪 compositionstart/end
    // 3) keyCode 229 — 部分 IME 在 keydown 时报这个码作为 IME 占位
    // 4) lastCompositionEnd 时间窗 — 某些 IME（macOS 中文）keydown 晚于 compositionend ~50ms
    if (
      e.nativeEvent.isComposing ||
      composingRef.current ||
      e.keyCode === 229 ||
      Date.now() - lastCompositionEndRef.current < 100
    ) {
      return;
    }
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const handleEmojiSelect = useCallback((emoji: string) => {
    const ta = textareaRef.current;
    if (ta) {
      const start = ta.selectionStart;
      const end = ta.selectionEnd;
      const newText = text.slice(0, start) + emoji + text.slice(end);
      setText(newText);
      requestAnimationFrame(() => {
        ta.focus();
        const pos = start + emoji.length;
        ta.setSelectionRange(pos, pos);
      });
    } else {
      setText(prev => prev + emoji);
    }
  }, [text]);

  // ── Speech recognition ──
  // 录音前文本框已有内容（用户可能先打了一半字再开录音）—— 录音过程中这段不能动
  const baseTextRef = useRef('');
  // 录音期间已被确认的 final transcript 累积值（不可变）
  const finalAccumRef = useRef('');

  const toggleListening = useCallback(() => {
    if (isListening) {
      recognitionRef.current?.stop();
      setIsListening(false);
      return;
    }

    const SpeechRecognition = getSpeechRecognition();
    if (!SpeechRecognition) return;

    const recognition = new SpeechRecognition();
    recognition.lang = 'zh-CN';
    recognition.interimResults = true;
    recognition.continuous = true;
    recognitionRef.current = recognition;

    // 锁定录音开始时的文本作为基线，加一个空格分隔（如果之前有内容）
    baseTextRef.current = text.length > 0 && !text.endsWith(' ') ? text + ' ' : text;
    finalAccumRef.current = '';

    recognition.onresult = (e: SpeechRecognitionEvent) => {
      let interim = '';
      // 重新遍历从 resultIndex 开始的所有结果：final 累加，interim 取最新一份
      for (let i = e.resultIndex; i < e.results.length; i++) {
        const result = e.results[i];
        if (!result[0]) continue;
        const isFinal = !!(result as unknown as { isFinal: boolean }).isFinal;
        if (isFinal) {
          finalAccumRef.current += result[0].transcript;
        } else {
          interim += result[0].transcript;
        }
      }
      // 关键：完整重写，不基于 prev —— 这样 interim 修正会自然替换
      setText(baseTextRef.current + finalAccumRef.current + interim);
    };

    recognition.onend = () => {
      setIsListening(false);
      // 把最后一份 final 固化进 baseText，避免下一轮录音又复读
      baseTextRef.current = baseTextRef.current + finalAccumRef.current;
      finalAccumRef.current = '';
      textareaRef.current?.focus();
    };

    recognition.onerror = (e: { error: string }) => {
      console.warn('Speech recognition error:', e.error);
      setIsListening(false);
    };

    recognition.start();
    setIsListening(true);
  }, [isListening, text]);

  return (
    <div
      className="shrink-0"
      style={{ position: 'relative' }}
    >
      {/* Emoji picker */}
      {showEmoji && (
        <EmojiPicker
          onSelect={handleEmojiSelect}
          onClose={() => setShowEmoji(false)}
        />
      )}

      <div
        className="flex items-end gap-2"
        style={{
          backgroundColor: c.inputBg,
          borderTop: `1px solid ${c.inputBorder}`,
          padding: '8px 10px',
          paddingBottom: 'calc(8px + env(safe-area-inset-bottom, 0px))',
          transition: 'background-color 240ms ease, border-color 240ms ease',
        }}
      >
        {/* Microphone button — voice input */}
        {speechSupported && (
          <Tooltip label={isListening ? '停止录音' : '语音输入'} placement="top">
            <button
              type="button"
              onClick={toggleListening}
              className="flex items-center justify-center shrink-0"
              style={{ width: '32px', height: '36px' }}
            >
              {isListening
                ? <MicOff size={24} color="#e74c3c" />
                : <Mic size={24} color={c.inputIcon} />
              }
            </button>
          </Tooltip>
        )}

        {/* Text input */}
        <textarea
          ref={textareaRef}
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={handleKeyDown}
          onCompositionStart={() => { composingRef.current = true; }}
          onCompositionEnd={() => {
            composingRef.current = false;
            lastCompositionEndRef.current = Date.now();
          }}
          disabled={disabled}
          placeholder={isListening ? '正在听...' : placeholder}
          rows={1}
          className="chat-input-field flex-1 resize-none outline-none"
          style={{
            height: '36px',
            maxHeight: '100px',
            fontSize: '16px',
            lineHeight: '20px',
            padding: '8px 10px',
            borderRadius: '4px',
            border: isListening ? '1px solid #e74c3c' : `1px solid ${c.inputFieldBorder}`,
            backgroundColor: c.inputFieldBg,
            color: c.inputFieldText,
            fontFamily: 'inherit',
            transition: 'background-color 240ms ease, color 240ms ease, border-color 240ms ease',
            ['--chat-placeholder' as string]: c.inputFieldPlaceholder,
          } as React.CSSProperties}
        />

        {/* Emoji toggle */}
        <button
          type="button"
          onClick={() => setShowEmoji(prev => !prev)}
          className="flex items-center justify-center shrink-0"
          style={{ width: '32px', height: '36px' }}
        >
          <Smile size={24} color={showEmoji ? c.inputIconActive : c.inputIcon} />
        </button>

        {/* Plus icon */}
        <button
          type="button"
          className="flex items-center justify-center shrink-0"
          style={{ width: '32px', height: '36px' }}
        >
          <PlusCircle size={24} color={c.inputIcon} />
        </button>
      </div>
    </div>
  );
}
