import { useState, useEffect, useRef, useCallback } from 'react';
import { useParams, useNavigate, useSearchParams } from 'react-router-dom';
import { ChevronLeft } from 'lucide-react';
import { useCharacterStore } from '../stores/characterStore';
import { useLLMStore } from '../stores/llmStore';
import { buildMessages } from '../services/chatPromptBuilder';
import { sendChatMessage } from '../services/llmService';
import { getCharacter as getCharacterFromDB, getRawMessages } from '../services/storage';
import ChatBubble from '../components/chat/ChatBubble';
import ChatInput from '../components/chat/ChatInput';
import TypingIndicator from '../components/chat/TypingIndicator';
import type { Character } from '../types/character';
import type { Message } from '../types/timeline';
import type { ChatMessage } from '../types/llm';

// ─── Helpers ─────────────────────────────────────────────

const PAGE_SIZE = 50;

function createMessage(sender: 'user' | 'character', content: string): Message {
  return {
    id: `msg_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
    sender,
    content,
    timestamp: new Date().toISOString(),
    type: 'text',
  };
}

function messageToChatMessage(msg: Message): ChatMessage {
  return {
    role: msg.sender === 'user' ? 'user' : 'assistant',
    content: msg.content,
  };
}

function shouldShowAvatar(msgs: Message[], i: number): boolean {
  if (msgs[i].type === 'system') return false;
  if (i === 0) return true;
  return msgs[i - 1].sender !== msgs[i].sender;
}

function shouldShowTimestamp(msgs: Message[], i: number): boolean {
  const msg = msgs[i];
  if (msg.type === 'system') return false;
  if (i === 0) return true;
  const prev = msgs[i - 1];
  if (prev.type === 'system') return true;
  try {
    const t1 = new Date(prev.timestamp).getTime();
    const t2 = new Date(msg.timestamp).getTime();
    if (isNaN(t1) || isNaN(t2)) return false;
    return t2 - t1 > 5 * 60 * 1000;
  } catch {
    return false;
  }
}

// ─── WhatIfPage ──────────────────────────────────────────

export default function WhatIfPage() {
  const { id: characterId } = useParams<{ id: string }>();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();

  const getCharacter = useCharacterStore((s) => s.getCharacter);
  const addCharacter = useCharacterStore((s) => s.addCharacter);
  const getActiveConfig = useLLMStore((s) => s.getActiveConfig);

  const startDate = searchParams.get('startDate') ?? '';

  // State
  const [mode, setMode] = useState<'loading' | 'browse' | 'chat'>('loading');
  const [character, setCharacter] = useState<Character | null>(null);
  const [allRaw, setAllRaw] = useState<Message[]>([]);
  const [visibleStart, setVisibleStart] = useState(0);
  const [visibleEnd, setVisibleEnd] = useState(0);
  const [interventionIdx, setInterventionIdx] = useState<number | null>(null);
  const [ifMessages, setIfMessages] = useState<Message[]>([]);
  const [isTyping, setIsTyping] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const scrollRef = useRef<HTMLDivElement>(null);
  const ifMessagesRef = useRef(ifMessages);
  ifMessagesRef.current = ifMessages;

  // ── Initialize ──
  useEffect(() => {
    if (!characterId || !startDate) return;

    const init = async () => {
      let char = getCharacter(characterId);
      if (!char) {
        char = (await getCharacterFromDB(characterId)) ?? undefined;
        if (char) addCharacter(char);
      }
      if (!char) { setMode('browse'); return; }
      setCharacter(char as Character);

      const raw = await getRawMessages(characterId);
      if (raw.length === 0) { setMode('browse'); return; }
      setAllRaw(raw);

      // Find index closest to startDate
      const target = new Date(startDate).getTime();
      let closest = 0;
      let minDist = Infinity;
      for (let i = 0; i < raw.length; i++) {
        const t = new Date(raw[i].timestamp || '').getTime();
        if (isNaN(t)) continue;
        const dist = Math.abs(t - target);
        if (dist < minDist) { minDist = dist; closest = i; }
      }

      const start = Math.max(0, closest - Math.floor(PAGE_SIZE / 2));
      const end = Math.min(raw.length, start + PAGE_SIZE);
      setVisibleStart(start);
      setVisibleEnd(end);
      didInitialScroll.current = false;
      setMode('browse');
    };

    init();
  }, [characterId, startDate, getCharacter, addCharacter]);

  // ── Initial scroll to center ──
  const didInitialScroll = useRef(false);

  useEffect(() => {
    if (mode === 'browse' && !didInitialScroll.current && scrollRef.current && allRaw.length > 0) {
      didInitialScroll.current = true;
      requestAnimationFrame(() => {
        if (scrollRef.current) {
          const el = scrollRef.current;
          el.scrollTop = (el.scrollHeight - el.clientHeight) / 2;
        }
      });
    }
  }, [mode, allRaw.length]);

  // ── Infinite scroll ──
  const isLoadingMore = useRef(false);

  const handleScroll = useCallback(() => {
    const el = scrollRef.current;
    if (!el || mode !== 'browse' || isLoadingMore.current) return;

    // Near bottom → load more below
    if (el.scrollHeight - el.scrollTop - el.clientHeight < 100 && visibleEnd < allRaw.length) {
      isLoadingMore.current = true;
      setVisibleEnd(Math.min(allRaw.length, visibleEnd + PAGE_SIZE));
      requestAnimationFrame(() => { isLoadingMore.current = false; });
    }

    // Near top → load more above
    if (el.scrollTop < 100 && visibleStart > 0) {
      isLoadingMore.current = true;
      const oldHeight = el.scrollHeight;
      setVisibleStart(Math.max(0, visibleStart - PAGE_SIZE));
      requestAnimationFrame(() => {
        if (scrollRef.current) {
          scrollRef.current.scrollTop = scrollRef.current.scrollHeight - oldHeight;
        }
        isLoadingMore.current = false;
      });
    }
  }, [mode, visibleStart, visibleEnd, allRaw.length]);

  // ── Intervention ──
  const handleIntervene = useCallback((idx: number) => {
    setInterventionIdx(idx);
    setIfMessages([]);
    setMode('chat');
  }, []);

  const handleReset = useCallback(() => {
    setInterventionIdx(null);
    setIfMessages([]);
    setMode('browse');
  }, []);

  // ── Send message ──
  const handleSend = useCallback(async (text: string) => {
    if (!character || interventionIdx === null) return;
    const config = getActiveConfig();
    if (!config) { setError('请先在设置中配置 LLM'); return; }

    setError(null);
    const userMsg = createMessage('user', text);
    setIfMessages(prev => [...prev, userMsg]);
    setIsTyping(true);

    try {
      // Context: raw messages up to intervention point + previous IF messages
      const contextRaw = allRaw.slice(visibleStart, interventionIdx + 1);
      const chatHistory: ChatMessage[] = [
        ...contextRaw.map(messageToChatMessage),
        ...ifMessagesRef.current.map(messageToChatMessage),
      ];

      const llmMessages = buildMessages(
        {
          character,
          chatHistory,
          mode: 'if',
          currentDate: allRaw[interventionIdx]?.timestamp?.slice(0, 10) || startDate,
        },
        text,
      );

      const reply = await sendChatMessage(config, llmMessages);
      setIfMessages(prev => [...prev, createMessage('character', reply)]);
    } catch (err) {
      setError(err instanceof Error ? err.message : '发送失败');
    } finally {
      setIsTyping(false);
    }
  }, [character, interventionIdx, visibleStart, allRaw, startDate, getActiveConfig]);

  // ── Loading ──
  if (mode === 'loading') {
    return (
      <div className="h-screen flex flex-col items-center justify-center" style={{ backgroundColor: '#EDEDED' }}>
        <p style={{ color: '#999' }}>加载中...</p>
      </div>
    );
  }

  if (!character) {
    return (
      <div className="h-screen flex flex-col items-center justify-center gap-4" style={{ backgroundColor: '#EDEDED' }}>
        <p style={{ color: '#666' }}>角色不存在</p>
        <button onClick={() => navigate('/characters')} className="px-4 py-2 rounded-lg text-sm" style={{ backgroundColor: '#07c160', color: '#fff' }}>
          返回角色列表
        </button>
      </div>
    );
  }

  const visibleRaw = allRaw.slice(visibleStart, visibleEnd);

  // ── Render ──
  return (
    <div className="h-screen flex flex-col" style={{ backgroundColor: '#EDEDED' }}>
      {/* Header */}
      <div className="flex items-center shrink-0" style={{ height: '48px', backgroundColor: '#EDEDED', borderBottom: '1px solid #d9d9d9' }}>
        <button
          onClick={() => navigate(`/characters/${characterId}/timeline`)}
          className="flex items-center justify-center shrink-0"
          style={{ width: '40px', height: '100%', border: 'none', background: 'transparent', cursor: 'pointer' }}
        >
          <ChevronLeft size={24} color="#000" />
        </button>
        <div className="flex-1 text-center" style={{ fontSize: '17px', fontWeight: 500, color: '#000', lineHeight: '48px' }}>
          {mode === 'browse' ? 'IF 线 · 回顾' : `IF 线 · ${character.identity.name}`}
        </div>
        <div className="shrink-0 flex items-center" style={{ width: '50px', height: '100%', justifyContent: 'flex-end', paddingRight: '8px' }}>
          {mode === 'chat' && (
            <button
              onClick={handleReset}
              className="text-xs"
              style={{ color: '#07c160', border: 'none', background: 'none', cursor: 'pointer' }}
            >
              重新选择
            </button>
          )}
        </div>
      </div>

      {/* Error */}
      {error && (
        <div className="text-center py-2 text-xs shrink-0" style={{ backgroundColor: '#f8d7da', color: '#721c24' }}>
          {error}
        </div>
      )}

      {/* Messages */}
      <div ref={scrollRef} onScroll={handleScroll} className="flex-1 overflow-y-auto" style={{ WebkitOverflowScrolling: 'touch' }}>
        <div className="py-3">
          {mode === 'browse' ? (
            <>
              {/* Empty state */}
              {allRaw.length === 0 ? (
                <div className="text-center py-16">
                  <p className="text-sm" style={{ color: '#999' }}>没有原始聊天记录</p>
                  <p className="text-xs mt-1" style={{ color: '#bbb' }}>请重新导入聊天记录以使用 IF 线功能</p>
                </div>
              ) : (
                <>
                  {visibleStart > 0 && (
                    <div className="text-center py-3">
                      <span className="text-xs" style={{ color: '#999' }}>↑ 上滑加载更早的消息</span>
                    </div>
                  )}

                  {visibleRaw.map((msg, i) => {
                    const globalIdx = visibleStart + i;
                    return (
                      <div key={msg.id || `raw-${globalIdx}`}>
                        <ChatBubble
                          message={msg}
                          showAvatar={shouldShowAvatar(visibleRaw, i)}
                          characterAvatar={character.identity.avatar}
                          showTimestamp={shouldShowTimestamp(visibleRaw, i)}
                        />
                        {msg.type !== 'system' && (
                          <div className="flex justify-center py-0.5">
                            <button
                              onClick={() => handleIntervene(globalIdx)}
                              className="text-xs px-3 py-1 rounded-full"
                              style={{ color: '#07c160', backgroundColor: 'transparent', border: '1px solid rgba(7,193,96,0.25)', cursor: 'pointer' }}
                            >
                              从这里开始改变
                            </button>
                          </div>
                        )}
                      </div>
                    );
                  })}

                  {visibleEnd < allRaw.length && (
                    <div className="text-center py-3">
                      <span className="text-xs" style={{ color: '#999' }}>↓ 下滑加载更多消息</span>
                    </div>
                  )}
                </>
              )}
            </>
          ) : (
            <>
              {/* Chat mode: raw context + divider + IF messages */}
              {(() => {
                const contextRaw = allRaw.slice(visibleStart, interventionIdx! + 1);
                return contextRaw.map((msg, i) => (
                  <ChatBubble
                    key={msg.id || `ctx-${i}`}
                    message={msg}
                    showAvatar={shouldShowAvatar(contextRaw, i)}
                    characterAvatar={character.identity.avatar}
                    showTimestamp={shouldShowTimestamp(contextRaw, i)}
                  />
                ));
              })()}

              {/* Divider */}
              <div className="flex items-center gap-3 px-6 py-3">
                <div className="flex-1 h-px" style={{ backgroundColor: '#07c160' }} />
                <span className="text-xs font-medium" style={{ color: '#07c160' }}>从这里开始改变</span>
                <div className="flex-1 h-px" style={{ backgroundColor: '#07c160' }} />
              </div>

              {/* IF messages */}
              {ifMessages.map((msg, i) => (
                <ChatBubble
                  key={msg.id}
                  message={msg}
                  showAvatar={shouldShowAvatar(ifMessages, i)}
                  characterAvatar={character.identity.avatar}
                  showTimestamp={shouldShowTimestamp(ifMessages, i)}
                />
              ))}
              <TypingIndicator visible={isTyping} />
            </>
          )}
        </div>
      </div>

      {/* Input (chat mode only) */}
      {mode === 'chat' && (
        <ChatInput onSend={handleSend} disabled={isTyping} placeholder="说点不一样的..." />
      )}
    </div>
  );
}
