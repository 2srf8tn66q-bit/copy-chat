import { useState, useEffect, useRef, useCallback } from 'react';
import { useParams, useNavigate, useSearchParams } from 'react-router-dom';
import { Calendar, ChevronRight, X } from 'lucide-react';
import { useCharacterStore } from '../stores/characterStore';
import { useLLMStore } from '../stores/llmStore';
import { ChatContainer } from '../components/chat';
import { buildMessages } from '../services/chatPromptBuilder';
import { sendChatMessage } from '../services/llmService';
import { saveIFSession, getIFSession, getCharacter as getCharacterFromDB } from '../services/storage';
import {
  createIFSession,
  evaluateEvents,
  updateWorldState,
  advanceTime,
  jumpToDate,
  findNextEventDate,
  markEventsStatus,
} from '../services/ifEngine';
import type { Character } from '../types/character';
import type { Message, TimelineEvent } from '../types/timeline';
import type { ChatMessage } from '../types/llm';
import type { IFSession, WorldRule } from '../types/world';

// ─── Helpers ─────────────────────────────────────────────

function createMessage(sender: 'user' | 'character', content: string, type: Message['type'] = 'text'): Message {
  return {
    id: `msg_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
    sender,
    content,
    timestamp: new Date().toISOString(),
    type,
  };
}

function messageToChatMessage(msg: Message): ChatMessage {
  return {
    role: msg.sender === 'user' ? 'user' : 'assistant',
    content: msg.content,
  };
}

/** Format "2024-03-15" to "3月15日" for display */
function formatDateDisplay(dateStr: string): string {
  try {
    const [y, m, d] = dateStr.split('-').map(Number);
    return `${m}月${d}日`;
  } catch {
    return dateStr;
  }
}

/** Insert a date separator message into the list */
function createDateSeparator(dateStr: string): Message {
  return {
    id: `sep_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
    sender: 'user',
    content: `─── ${formatDateDisplay(dateStr)} ───`,
    timestamp: new Date().toISOString(),
    type: 'system',
  };
}

// ─── WhatIfPage ──────────────────────────────────────────

export default function WhatIfPage() {
  const { id: characterId } = useParams<{ id: string }>();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();

  const getCharacter = useCharacterStore((s) => s.getCharacter);
  const addCharacter = useCharacterStore((s) => s.addCharacter);
  const getActiveConfig = useLLMStore((s) => s.getActiveConfig);

  // URL params
  const startEventId = searchParams.get('eventId') ?? '';
  const worldRule = (searchParams.get('rule') ?? 'free') as WorldRule;
  const startDate = searchParams.get('startDate') ?? '';

  // State
  const [character, setCharacter] = useState<Character | null>(null);
  const [session, setSession] = useState<IFSession | null>(null);
  const [events, setEvents] = useState<TimelineEvent[]>([]);
  const [displayMessages, setDisplayMessages] = useState<Message[]>([]);
  const [isTyping, setIsTyping] = useState(false);
  const [showTimePanel, setShowTimePanel] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [initialized, setInitialized] = useState(false);

  const messagesRef = useRef<Message[]>(displayMessages);
  messagesRef.current = displayMessages;

  // ── Initialize session ──
  useEffect(() => {
    if (!characterId || !startDate) return;

    const loadCharacter = async () => {
      let char = getCharacter(characterId);
      if (!char) {
        char = (await getCharacterFromDB(characterId)) ?? undefined;
        if (char) addCharacter(char);
      }
      return char;
    };

    loadCharacter().then((char) => {
      if (!char) return;
      setCharacter(char as Character);

      // Build a basic event list from the start event
      const startEvent: TimelineEvent = {
        id: startEventId || `evt_${Date.now()}`,
        date: startDate,
        type: 'turning_point',
        summary: 'IF线的起点',
        originalMessages: [],
        emotionalArc: '新的开始',
        isKeyEvent: true,
        speaker: 'character',
        source: 'manual',
        status: 'pending',
      };

      // Create new IF session
      const newSession = createIFSession(characterId, startDate, worldRule, [startEvent]);
      setSession(newSession);
      setEvents([startEvent]);

      // Insert an opening date separator
      setDisplayMessages([createDateSeparator(startDate)]);
      setInitialized(true);
    });
  }, [characterId, startDate, startEventId, worldRule, getCharacter, addCharacter]);

  // ── Save session periodically ──
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (!session || displayMessages.length <= 1) return;

    if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    saveTimerRef.current = setTimeout(() => {
      // Sync messages back to session before saving
      const sessionToUpdate: IFSession = {
        ...session,
        messages: displayMessages
          .filter((m) => m.type !== 'system')
          .map((m) => ({
            id: m.id,
            sender: m.sender,
            content: m.content,
            timestamp: m.timestamp,
          })),
      };
      saveIFSession(sessionToUpdate).catch(console.error);
    }, 500);

    return () => {
      if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    };
  }, [displayMessages, session]);

  // ── Evaluate events on date change ──
  const evaluateAndInject = useCallback(
    (currentSession: IFSession, currentEvents: TimelineEvent[]) => {
      const result = evaluateEvents(currentSession, currentEvents);

      let updatedEvents = [...currentEvents];

      // Mark cancelled events
      if (result.cancelled.length > 0) {
        updatedEvents = markEventsStatus(
          updatedEvents,
          result.cancelled.map((e) => e.id),
          'cancelled',
        );
      }

      // Mark mutated events (fated mode)
      if (result.mutated.length > 0) {
        updatedEvents = markEventsStatus(
          updatedEvents,
          result.mutated.map((e) => e.id),
          'mutated',
        );
      }

      // Mark triggered events
      if (result.triggered.length > 0) {
        updatedEvents = markEventsStatus(
          updatedEvents,
          result.triggered.map((e) => e.id),
          'triggered',
        );
      }

      setEvents(updatedEvents);

      return result;
    },
    [],
  );

  // ── Send message handler ──
  const handleSend = useCallback(
    async (text: string) => {
      if (!character || !characterId || !session) return;

      const config = getActiveConfig();
      if (!config) {
        setError('请先在设置中配置 LLM');
        return;
      }

      setError(null);

      // 1. Append user message
      const userMsg = createMessage('user', text);
      const currentMessages = [...messagesRef.current, userMsg];
      setDisplayMessages(currentMessages);
      setIsTyping(true);

      try {
        // 2. Evaluate events to see if any should trigger
        const eventResult = evaluateAndInject(session, events);

        // Pick the next pending event to inject (if any)
        const pendingEvent =
          eventResult.triggered.length > 0 ? eventResult.triggered[0] : undefined;

        // 3. Build chat history for prompt builder
        const chatHistory: ChatMessage[] = currentMessages
          .filter((m) => m.type !== 'system')
          .map(messageToChatMessage);

        // 4. Build messages for LLM
        const llmMessages = buildMessages(
          {
            character,
            chatHistory: chatHistory,
            mode: 'if',
            worldState: session.worldState,
            currentDate: session.currentDate,
            pendingEvent,
          },
          text,
        );

        // 5. Call LLM
        const reply = await sendChatMessage(config, llmMessages);

        // 6. Append AI reply
        const aiMsg = createMessage('character', reply);
        const allMessages = [...currentMessages, aiMsg];
        setDisplayMessages(allMessages);

        // 7. Update world state
        const newWorldState = updateWorldState(session, text, reply);
        setSession((prev) =>
          prev ? { ...prev, worldState: newWorldState } : prev,
        );
      } catch (err) {
        const errMsg = err instanceof Error ? err.message : '发送失败';
        setError(errMsg);
      } finally {
        setIsTyping(false);
      }
    },
    [character, characterId, session, events, getActiveConfig, evaluateAndInject],
  );

  // ── Time advancement ──
  const handleAdvanceTime = useCallback(
    (days: number) => {
      if (!session) return;

      let updatedSession: IFSession;
      if (days === 0) {
        // "Continue today" — no change
        setShowTimePanel(false);
        return;
      } else {
        updatedSession = advanceTime(session, days);
      }

      // Insert date separator
      const separator = createDateSeparator(updatedSession.currentDate);
      setDisplayMessages((prev) => [...prev, separator]);
      setSession(updatedSession);

      // Evaluate events for the new date
      evaluateAndInject(updatedSession, events);

      setShowTimePanel(false);
    },
    [session, events, evaluateAndInject],
  );

  const handleJumpToNextEvent = useCallback(() => {
    if (!session || events.length === 0) return;

    const nextDate = findNextEventDate(session, events);
    if (!nextDate) {
      // No more events
      setShowTimePanel(false);
      return;
    }

    const updatedSession = jumpToDate(session, nextDate);
    const separator = createDateSeparator(updatedSession.currentDate);
    setDisplayMessages((prev) => [...prev, separator]);
    setSession(updatedSession);

    evaluateAndInject(updatedSession, events);
    setShowTimePanel(false);
  }, [session, events, evaluateAndInject]);

  // ── No character / not initialized ──
  if (!character || !initialized) {
    return (
      <div className="h-screen flex flex-col items-center justify-center gap-4" style={{ backgroundColor: '#EDEDED' }}>
        <p style={{ color: '#666' }}>
          {!startDate ? '缺少起始日期参数' : !characterId ? '缺少角色 ID' : '加载中...'}
        </p>
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

  // ── Render ──
  return (
    <div className="h-screen relative" style={{ backgroundColor: '#EDEDED' }}>
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
        messages={displayMessages}
        characterName={character.identity.name}
        characterAvatar={character.identity.avatar}
        onSendMessage={handleSend}
        inputDisabled={isTyping}
        onBack={() => navigate(`/characters/${characterId}/timeline`)}
        typing={isTyping}
        headerRight={
          <button
            onClick={() => setShowTimePanel(!showTimePanel)}
            className="flex items-center justify-center"
            style={{
              width: '40px',
              height: '40px',
              border: 'none',
              background: 'transparent',
              cursor: 'pointer',
            }}
            title="时间控制"
          >
            <Calendar size={18} color="#666" />
          </button>
        }
      />

      {/* Time control panel (overlay) */}
      {showTimePanel && (
        <>
          {/* Backdrop */}
          <div
            className="fixed inset-0 z-40"
            style={{ backgroundColor: 'rgba(0,0,0,0.2)' }}
            onClick={() => setShowTimePanel(false)}
          />

          {/* Panel */}
          <div
            className="fixed right-2 z-50 rounded-lg shadow-lg"
            style={{
              top: '52px',
              width: '180px',
              backgroundColor: '#fff',
              border: '1px solid #ddd',
            }}
          >
            {/* Current date display */}
            <div
              className="px-3 py-2 border-b text-center"
              style={{ borderColor: '#eee' }}
            >
              <span className="text-xs" style={{ color: '#999' }}>当前日期</span>
              <div className="text-sm font-medium" style={{ color: '#333' }}>
                {session ? formatDateDisplay(session.currentDate) : ''}
              </div>
            </div>

            {/* Actions */}
            <div className="py-1">
              <button
                onClick={() => handleAdvanceTime(0)}
                className="w-full px-3 py-2 text-left text-sm flex items-center gap-2 hover:bg-gray-50 transition-colors"
                style={{ color: '#333', border: 'none', background: 'none', cursor: 'pointer' }}
              >
                继续当天
              </button>
              <button
                onClick={() => handleAdvanceTime(1)}
                className="w-full px-3 py-2 text-left text-sm flex items-center gap-2 hover:bg-gray-50 transition-colors"
                style={{ color: '#333', border: 'none', background: 'none', cursor: 'pointer' }}
              >
                到下一天
                <ChevronRight size={14} color="#999" />
              </button>
              <button
                onClick={handleJumpToNextEvent}
                className="w-full px-3 py-2 text-left text-sm flex items-center gap-2 hover:bg-gray-50 transition-colors"
                style={{ color: '#333', border: 'none', background: 'none', cursor: 'pointer' }}
              >
                到下一个事件
                <ChevronRight size={14} color="#999" />
              </button>
            </div>

            {/* Close button */}
            <div className="border-t px-3 py-1" style={{ borderColor: '#eee' }}>
              <button
                onClick={() => setShowTimePanel(false)}
                className="w-full py-1 text-xs text-center"
                style={{ color: '#999', border: 'none', background: 'none', cursor: 'pointer' }}
              >
                关闭
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
