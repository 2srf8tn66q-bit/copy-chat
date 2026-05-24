import { useState, useEffect, useRef, useCallback } from 'react';
import { useParams, useNavigate, useSearchParams } from 'react-router-dom';
import { ChevronLeft, Sun, Moon } from 'lucide-react';
import { AnimatePresence } from 'motion/react';
import { useCharacterStore } from '../stores/characterStore';
import { useLLMStore } from '../stores/llmStore';
import { useChatThemeStore } from '../stores/chatThemeStore';
import { useUserProfileStore } from '../stores/userProfileStore';
import { useChatColors } from '../components/chat/chatTheme';
import { buildMessages } from '../services/chatPromptBuilder';
import { sendChatMessage } from '../services/llmService';
import {
  getCharacter as getCharacterFromDB,
  getRawMessages,
  getIFChatSession,
  saveIFChatSession,
  deleteIFChatSession,
} from '../services/storage';
import type { IFChatSession } from '../services/storage';
import ChatBubble from '../components/chat/ChatBubble';
import ChatInput from '../components/chat/ChatInput';
import TypingIndicator from '../components/chat/TypingIndicator';
import LoadingState from '../components/LoadingState';
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
  const [searchParams, setSearchParams] = useSearchParams();
  const navigate = useNavigate();

  const getCharacter = useCharacterStore((s) => s.getCharacter);
  const addCharacter = useCharacterStore((s) => s.addCharacter);
  const getActiveConfig = useLLMStore((s) => s.getActiveConfig);
  const c = useChatColors();
  const theme = useChatThemeStore((s) => s.theme);
  const toggleTheme = useChatThemeStore((s) => s.toggle);
  const userAvatar = useUserProfileStore((s) => s.avatar);

  const startDate = searchParams.get('startDate') ?? '';
  const sessionId = searchParams.get('sessionId') ?? '';

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
  const [currentSessionId, setCurrentSessionId] = useState<string | null>(null);

  const scrollRef = useRef<HTMLDivElement>(null);
  const ifMessagesRef = useRef(ifMessages);
  ifMessagesRef.current = ifMessages;
  const justCreatedRef = useRef(false);

  // ── Initialize ──
  useEffect(() => {
    if (!characterId) return;
    if (!startDate && !sessionId) return;

    // Skip re-init if we just created a session via handleIntervene
    if (justCreatedRef.current) {
      justCreatedRef.current = false;
      return;
    }

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

      // Resuming an existing session?
      if (sessionId) {
        const saved = await getIFChatSession(characterId, sessionId);
        if (saved && saved.messages.length > 0) {
          setCurrentSessionId(saved.id);
          setInterventionIdx(saved.interventionIdx);
          setIfMessages(saved.messages);

          // Calculate visible range around intervention point
          const s = Math.max(0, saved.interventionIdx - Math.floor(PAGE_SIZE / 2));
          const e = Math.min(raw.length, s + PAGE_SIZE);
          setVisibleStart(s);
          setVisibleEnd(e);
          setMode('chat');
          return;
        }
      }

      // Fresh browse: find index closest to startDate
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
  }, [characterId, startDate, sessionId, getCharacter, addCharacter]);

  // ── Initial scroll to center (browse mode) ──
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

  // ── Persist IF session (debounced) ──
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (!characterId || interventionIdx === null || ifMessages.length === 0 || !currentSessionId) return;
    if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    saveTimerRef.current = setTimeout(() => {
      const session: IFChatSession = {
        id: currentSessionId,
        characterId,
        interventionIdx,
        messages: ifMessages,
        startDate: startDate || allRaw[interventionIdx]?.timestamp?.slice(0, 10) || '',
        createdAt: '', // will be filled if new
        updatedAt: new Date().toISOString(),
        contextPreview: allRaw[interventionIdx]?.content?.slice(0, 60) || '',
      };
      // Preserve original createdAt
      getIFChatSession(characterId, currentSessionId).then(existing => {
        session.createdAt = existing?.createdAt || session.updatedAt;
        saveIFChatSession(session).catch(console.error);
      });
    }, 500);
    return () => { if (saveTimerRef.current) clearTimeout(saveTimerRef.current); };
  }, [ifMessages, characterId, startDate, interventionIdx, currentSessionId, allRaw]);

  // ── Auto-scroll to bottom when entering chat mode or new messages ──
  useEffect(() => {
    if (mode === 'chat' && scrollRef.current) {
      requestAnimationFrame(() => {
        if (scrollRef.current) {
          scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
        }
      });
    }
  }, [mode, ifMessages.length]);

  // ── Infinite scroll ──
  const isLoadingMore = useRef(false);

  const handleScroll = useCallback(() => {
    const el = scrollRef.current;
    if (!el || mode !== 'browse' || isLoadingMore.current) return;

    if (el.scrollHeight - el.scrollTop - el.clientHeight < 100 && visibleEnd < allRaw.length) {
      isLoadingMore.current = true;
      setVisibleEnd(Math.min(allRaw.length, visibleEnd + PAGE_SIZE));
      requestAnimationFrame(() => { isLoadingMore.current = false; });
    }

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

  // ── Intervention: create a new session ──
  const handleIntervene = useCallback((idx: number) => {
    const newId = `ifs_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
    justCreatedRef.current = true;
    setCurrentSessionId(newId);
    setInterventionIdx(idx);
    setIfMessages([]);
    setMode('chat');
    // Update URL to include sessionId so refresh works
    setSearchParams(prev => {
      prev.set('sessionId', newId);
      return prev;
    });
  }, [setSearchParams]);

  const handleReset = useCallback(() => {
    // Delete the current session if it has no messages
    if (characterId && currentSessionId) {
      deleteIFChatSession(characterId, currentSessionId).catch(console.error);
    }
    setCurrentSessionId(null);
    setInterventionIdx(null);
    setIfMessages([]);
    setMode('browse');
    setSearchParams(prev => {
      prev.delete('sessionId');
      return prev;
    });
  }, [characterId, currentSessionId, setSearchParams]);

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
      const contextRaw = allRaw.slice(Math.max(0, interventionIdx - 20), interventionIdx + 1);
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
      // Burst mode: split on |||
      if (character.messageStyle === 'burst' && reply.includes('|||')) {
        const parts = reply.split('|||').map(s => s.trim()).filter(Boolean);
        for (let i = 0; i < parts.length; i++) {
          if (i > 0) await new Promise(r => setTimeout(r, 300 + Math.random() * 500));
          setIfMessages(prev => [...prev, createMessage('character', parts[i])]);
        }
      } else {
        setIfMessages(prev => [...prev, createMessage('character', reply)]);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : '发送失败');
    } finally {
      setIsTyping(false);
    }
  }, [character, interventionIdx, allRaw, startDate, getActiveConfig]);

  const accent = c.inputIconActive;  // 强调色：浅色用 WeChat 绿，深色用品牌主绿
  const accentMuted = `${accent}40`; // 25% opacity 描边版

  // ── Loading ──
  if (mode === 'loading') {
    return <LoadingState bg={c.bg} textColor={c.timestamp} />;
  }

  if (!character) {
    return (
      <div className="h-screen flex flex-col items-center justify-center gap-4" style={{ backgroundColor: c.bg }}>
        <p style={{ color: c.timestamp }}>角色不存在</p>
        <button onClick={() => navigate('/characters')} className="px-4 py-2 rounded-lg text-sm" style={{ backgroundColor: accent, color: '#fff' }}>
          返回角色列表
        </button>
      </div>
    );
  }

  const visibleRaw = allRaw.slice(visibleStart, visibleEnd);

  // ── Render ──
  return (
    <div className="h-screen flex flex-col" style={{ backgroundColor: c.bg, transition: 'background-color 240ms ease' }}>
      {/* Header */}
      <div
        className="flex items-center shrink-0"
        style={{
          height: '48px',
          backgroundColor: c.header,
          borderBottom: `1px solid ${c.headerBorder}`,
          transition: 'background-color 240ms ease, border-color 240ms ease',
        }}
      >
        <button
          onClick={() => navigate(`/characters/${characterId}/timeline`)}
          className="flex items-center justify-center shrink-0"
          style={{ width: '40px', height: '100%', border: 'none', background: 'transparent', cursor: 'pointer' }}
        >
          <ChevronLeft size={24} color={c.headerText} />
        </button>
        <div className="flex-1 text-center" style={{ fontSize: '17px', fontWeight: 500, color: c.headerText, lineHeight: '48px' }}>
          {mode === 'browse' ? 'IF 线 · 回顾' : `IF 线 · ${character.identity.name}`}
        </div>
        <div className="shrink-0 flex items-center gap-1 pr-2" style={{ height: '100%' }}>
          {mode === 'chat' && (
            <button
              onClick={handleReset}
              className="text-xs px-2"
              style={{ color: accent, border: 'none', background: 'none', cursor: 'pointer' }}
            >
              重新选择
            </button>
          )}
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
            }}
            title={theme === 'dark' ? '切换到浅色' : '切换到深色'}
          >
            {theme === 'dark'
              ? <Sun size={18} color={c.toggleIcon} />
              : <Moon size={18} color={c.toggleIcon} />
            }
          </button>
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
              {allRaw.length === 0 ? (
                <div className="text-center py-16">
                  <p className="text-sm" style={{ color: c.timestamp }}>没有原始聊天记录</p>
                  <p className="text-xs mt-1" style={{ color: c.timestamp, opacity: 0.7 }}>请重新导入聊天记录以使用 IF 线功能</p>
                </div>
              ) : (
                <>
                  {visibleStart > 0 && (
                    <div className="text-center py-3">
                      <span className="text-xs" style={{ color: c.timestamp }}>↑ 上滑加载更早的消息</span>
                    </div>
                  )}

                  <AnimatePresence initial={false}>
                    {visibleRaw.map((msg, i) => {
                      const globalIdx = visibleStart + i;
                      return (
                        <div key={msg.id || `raw-${globalIdx}`}>
                          <ChatBubble
                            message={msg}
                            showAvatar={shouldShowAvatar(visibleRaw, i)}
                            characterAvatar={character.identity.avatar}
                            userAvatar={userAvatar}
                            showTimestamp={shouldShowTimestamp(visibleRaw, i)}
                          />
                          {msg.type !== 'system' && (
                            <div className="flex justify-center py-0.5">
                              <button
                                onClick={() => handleIntervene(globalIdx)}
                                className="text-xs px-3 py-1 rounded-full"
                                style={{ color: accent, backgroundColor: 'transparent', border: `1px solid ${accentMuted}`, cursor: 'pointer' }}
                              >
                                从这里开始改变
                              </button>
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </AnimatePresence>

                  {visibleEnd < allRaw.length && (
                    <div className="text-center py-3">
                      <span className="text-xs" style={{ color: c.timestamp }}>↓ 下滑加载更多消息</span>
                    </div>
                  )}
                </>
              )}
            </>
          ) : (
            <>
              {/* Chat mode: raw context + divider + IF messages */}
              <AnimatePresence initial={false}>
                {(() => {
                  const contextRaw = allRaw.slice(Math.max(0, (interventionIdx ?? 0) - 10), (interventionIdx ?? 0) + 1);
                  return contextRaw.map((msg, i) => (
                    <ChatBubble
                      key={msg.id || `ctx-${i}`}
                      message={msg}
                      showAvatar={shouldShowAvatar(contextRaw, i)}
                      characterAvatar={character.identity.avatar}
                      userAvatar={userAvatar}
                      showTimestamp={shouldShowTimestamp(contextRaw, i)}
                    />
                  ));
                })()}
              </AnimatePresence>

              {/* Divider */}
              <div className="flex items-center gap-3 px-6 py-3">
                <div className="flex-1 h-px" style={{ backgroundColor: accent, opacity: 0.6 }} />
                <span className="text-xs font-medium" style={{ color: accent }}>从这里开始改变</span>
                <div className="flex-1 h-px" style={{ backgroundColor: accent, opacity: 0.6 }} />
              </div>

              {/* IF messages */}
              <AnimatePresence initial={false}>
                {ifMessages.map((msg, i) => (
                  <ChatBubble
                    key={msg.id}
                    message={msg}
                    showAvatar={shouldShowAvatar(ifMessages, i)}
                    characterAvatar={character.identity.avatar}
                    userAvatar={userAvatar}
                    showTimestamp={shouldShowTimestamp(ifMessages, i)}
                  />
                ))}
              </AnimatePresence>
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
