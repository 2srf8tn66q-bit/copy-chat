import { useState, useEffect, useRef, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useCharacterStore } from '../stores/characterStore';
import { useLLMStore } from '../stores/llmStore';
import { ChatContainer } from '../components/chat';
import { buildMessages } from '../services/chatPromptBuilder';
import { sendChatMessage } from '../services/llmService';
import { getChatHistory, saveChatHistory, getCharacter as getCharacterFromDB } from '../services/storage';
import type { Character } from '../types/character';
import type { Message } from '../types/timeline';
import type { ChatMessage } from '../types/llm';

// ─── Convert between Message and ChatMessage ─────────────

function messageToChatMessage(msg: Message): ChatMessage {
  return {
    role: msg.sender === 'user' ? 'user' : 'assistant',
    content: msg.content,
  };
}

function createMessage(sender: 'user' | 'character', content: string): Message {
  return {
    id: `msg_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
    sender,
    content,
    timestamp: new Date().toISOString(),
    type: 'text',
  };
}

// ─── ChatPage ────────────────────────────────────────────

export default function ChatPage() {
  const { id: characterId } = useParams<{ id: string }>();
  const navigate = useNavigate();

  const getCharacter = useCharacterStore((s) => s.getCharacter);
  const addCharacter = useCharacterStore((s) => s.addCharacter);
  const getActiveConfig = useLLMStore((s) => s.getActiveConfig);

  const [character, setCharacter] = useState<Character | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [isTyping, setIsTyping] = useState(false);
  const [noLLM, setNoLLM] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  // Ref to avoid stale closures in the send handler
  const messagesRef = useRef<Message[]>(messages);
  messagesRef.current = messages;

  // ── Load character & chat history ──
  useEffect(() => {
    if (!characterId) return;
    setLoading(true);

    const loadCharacter = async () => {
      // Try store first, then IndexedDB
      let char = getCharacter(characterId);
      if (!char) {
        char = (await getCharacterFromDB(characterId)) ?? undefined;
        if (char) addCharacter(char);
      }
      return char;
    };

    loadCharacter()
      .then((char) => {
        if (!char) return;
        setCharacter(char as Character);

        // Check LLM config
        const config = getActiveConfig();
        if (!config) {
          setNoLLM(true);
        }

        // Load chat history from IndexedDB
        getChatHistory((char as Character).id).then((history) => {
          setMessages(Array.isArray(history) ? history : []);
        });
      })
      .catch((err) => {
        console.error('Failed to load character:', err);
      })
      .finally(() => {
        setLoading(false);
      });
  }, [characterId, getCharacter, addCharacter, getActiveConfig]);

  // ── Save to IndexedDB whenever messages change ──
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (!characterId) return;
    if (messages.length === 0) return;

    // Debounce saves (300ms)
    if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    saveTimerRef.current = setTimeout(() => {
      saveChatHistory(characterId, messages).catch((err) => {
        console.error('Failed to save chat history:', err);
      });
    }, 300);

    return () => {
      if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    };
  }, [messages, characterId]);

  // ── Send message handler ──
  const handleSend = useCallback(
    async (text: string) => {
      if (!character || !characterId) return;

      const config = getActiveConfig();
      if (!config) {
        setError('请先在设置中配置 LLM');
        return;
      }

      setError(null);

      // 1. Append user message
      const userMsg = createMessage('user', text);
      const updatedMessages = [...messagesRef.current, userMsg];
      setMessages(updatedMessages);
      setIsTyping(true);

      try {
        // 2. Build chat history (BEFORE current message, buildMessages adds it)
        const chatHistory: ChatMessage[] = messagesRef.current.map(messageToChatMessage);

        // 3. Build messages for LLM
        const llmMessages = buildMessages(
          {
            character,
            chatHistory: chatHistory,
            mode: 'private',
          },
          text,
        );

        // 4. Call LLM
        const reply = await sendChatMessage(config, llmMessages);

        // 5. Append AI reply
        const aiMsg = createMessage('character', reply);
        setMessages((prev) => [...prev, aiMsg]);
      } catch (err) {
        const errMsg = err instanceof Error ? err.message : '发送失败';
        setError(errMsg);
      } finally {
        setIsTyping(false);
      }
    },
    [character, characterId, getActiveConfig],
  );

  // ── Loading ──
  if (loading) {
    return (
      <div className="h-screen flex flex-col items-center justify-center" style={{ backgroundColor: '#EDEDED' }}>
        <p style={{ color: '#999' }}>加载中...</p>
      </div>
    );
  }

  // ── No character found ──
  if (!character) {
    return (
      <div className="h-screen flex flex-col items-center justify-center gap-4" style={{ backgroundColor: '#EDEDED' }}>
        <p style={{ color: '#666' }}>角色不存在</p>
        <button
          onClick={() => navigate('/characters')}
          className="px-4 py-2 rounded-lg text-sm"
          style={{ backgroundColor: '#07c160', color: '#fff' }}
        >
          返回角色列表
        </button>
      </div>
    );
  }

  return (
    <div className="h-screen" style={{ backgroundColor: '#EDEDED' }}>
      {/* LLM not configured warning */}
      {noLLM && (
        <div
          className="text-center py-2 text-xs"
          style={{ backgroundColor: '#fff3cd', color: '#856404' }}
        >
          未配置 LLM，请先前往
          <button
            onClick={() => navigate('/settings')}
            className="underline font-medium"
            style={{ color: '#856404' }}
          >
            设置页面
          </button>
          配置
        </div>
      )}

      {/* Error banner */}
      {error && (
        <div
          className="text-center py-2 text-xs"
          style={{ backgroundColor: '#f8d7da', color: '#721c24' }}
        >
          {error}
        </div>
      )}

      <ChatContainer
        messages={messages}
        characterName={character.identity.name}
        characterAvatar={character.identity.avatar}
        onSendMessage={noLLM ? () => {} : handleSend}
        inputDisabled={noLLM || isTyping}
        inputPlaceholder={noLLM ? '请先配置 LLM...' : ''}
        onBack={() => navigate('/characters')}
        typing={isTyping}
      />
    </div>
  );
}
