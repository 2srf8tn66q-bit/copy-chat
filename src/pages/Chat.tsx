import { useState, useEffect, useRef, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Trash2, Undo2, Check, Wand2, X } from 'lucide-react';
import { AnimatePresence, motion } from 'motion/react';
import { useCharacterStore } from '../stores/characterStore';
import { useLLMStore } from '../stores/llmStore';
import { useUserProfileStore } from '../stores/userProfileStore';
import { ChatContainer } from '../components/chat';
import FeedbackDialog from '../components/chat/FeedbackDialog';
import { buildMessages } from '../services/chatPromptBuilder';
import { sendChatMessage } from '../services/llmService';
import {
  getChatHistory,
  saveChatHistory,
  clearChatHistory,
  getCharacter as getCharacterFromDB,
} from '../services/storage';
import { applyFeedback, undoLatestFeedback, listFeedbacks } from '../services/personaRefinement';
import { detectPattern } from '../services/patternDetector';
import { useChatColors } from '../components/chat/chatTheme';
import LoadingState from '../components/LoadingState';
import Tooltip from '../components/Tooltip';
import type { FeedbackApplyPayload } from '../components/chat/FeedbackDialog';
import type { Message } from '../types/timeline';
import type { ChatMessage } from '../types/llm';

// ─── Helpers ─────────────────────────────────────────────

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

  // 关键改造：character 通过 selector 订阅 store，不再用本地 state
  // 这样画像被在线修正后，Chat 立刻拿到新版
  const character = useCharacterStore((s) =>
    characterId ? s.characters.find((c) => c.id === characterId) : undefined
  );
  const addCharacter = useCharacterStore((s) => s.addCharacter);
  const getActiveConfig = useLLMStore((s) => s.getActiveConfig);
  const userAvatar = useUserProfileStore((s) => s.avatar);
  const chatColors = useChatColors();

  const [messages, setMessages] = useState<Message[]>([]);
  const [isTyping, setIsTyping] = useState(false);
  const [noLLM, setNoLLM] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  // Refine 流程状态
  const [refineMessage, setRefineMessage] = useState<Message | null>(null);
  const [toast, setToast] = useState<{ message: string; canUndo: boolean } | null>(null);
  const toastTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  // 模式检测提示（"你最近多次..."的非阻塞 banner）
  const [patternHint, setPatternHint] = useState<{ message: string; suggestion: string } | null>(null);

  // 一次性发现提示 — 全局只显示一次
  const REFINE_HINT_KEY = 'copy-chat:refine-hint-dismissed';
  const [showRefineHint, setShowRefineHint] = useState<boolean>(() => {
    try {
      return localStorage.getItem(REFINE_HINT_KEY) !== '1';
    } catch {
      return true;
    }
  });
  const dismissRefineHint = useCallback(() => {
    setShowRefineHint(false);
    try { localStorage.setItem(REFINE_HINT_KEY, '1'); } catch { /* localStorage 不可用就忽略 */ }
  }, []);

  // 用于 send handler 拿最新消息
  const messagesRef = useRef<Message[]>(messages);
  messagesRef.current = messages;

  // ── Load character & chat history ──
  useEffect(() => {
    if (!characterId) return;
    setLoading(true);

    (async () => {
      // 如果 store 里已经有，selector 会自动拿到
      if (!character) {
        const fromDb = await getCharacterFromDB(characterId);
        if (fromDb) addCharacter(fromDb);
      }
      if (!getActiveConfig()) setNoLLM(true);
      const history = await getChatHistory(characterId);
      setMessages(Array.isArray(history) ? history : []);
      setLoading(false);
    })();
    // 故意只依赖 characterId，避免 character 引用变化触发整段重跑
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [characterId]);

  // ── Persist chat history (debounced) ──
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => {
    if (!characterId || messages.length === 0) return;
    if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    saveTimerRef.current = setTimeout(() => {
      saveChatHistory(characterId, messages).catch(console.error);
    }, 300);
    return () => {
      if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    };
  }, [messages, characterId]);

  // ── Toast helpers ──
  const showToast = useCallback((message: string, canUndo: boolean, durationMs = 8000) => {
    if (toastTimerRef.current) clearTimeout(toastTimerRef.current);
    setToast({ message, canUndo });
    toastTimerRef.current = setTimeout(() => setToast(null), durationMs);
  }, []);

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

      const userMsg = createMessage('user', text);
      setMessages((prev) => [...prev, userMsg]);
      setIsTyping(true);

      try {
        const chatHistory: ChatMessage[] = messagesRef.current.map(messageToChatMessage);
        const llmMessages = buildMessages(
          { character, chatHistory, mode: 'private' },
          text,
        );

        // ── 自检循环：如果回复触发 neverSay，自动追加纠正再生成（最多 2 次重试）──
        const neverSay = character.persona.neverSay ?? [];
        const checkViolation = (reply: string): string | null => {
          for (const banned of neverSay) {
            if (!banned.trim()) continue;
            if (reply.includes(banned)) return banned;
          }
          return null;
        };

        let reply = await sendChatMessage(config, llmMessages);
        let violation = neverSay.length > 0 ? checkViolation(reply) : null;
        let retries = 0;
        while (violation && retries < 2) {
          retries++;
          // 把违规告诉 LLM 并要求重写
          const correctionMessages = [
            ...llmMessages,
            { role: 'assistant' as const, content: reply },
            {
              role: 'user' as const,
              content: `你刚才说了"${violation}"，但你绝对不会用这个词。重新回答上一条消息，避开这个词，用你自己的说法。`,
            },
          ];
          reply = await sendChatMessage(config, correctionMessages);
          violation = checkViolation(reply);
        }

        if (character.messageStyle === 'burst' && reply.includes('|||')) {
          const parts = reply.split('|||').map((s) => s.trim()).filter(Boolean);
          for (let i = 0; i < parts.length; i++) {
            if (i > 0) await new Promise((r) => setTimeout(r, 300 + Math.random() * 500));
            setMessages((prev) => [...prev, createMessage('character', parts[i])]);
          }
        } else {
          setMessages((prev) => [...prev, createMessage('character', reply)]);
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : '发送失败');
      } finally {
        setIsTyping(false);
      }
    },
    [character, characterId, getActiveConfig],
  );

  // ── Clear chat history ──
  const handleClearHistory = useCallback(async () => {
    if (!characterId || messages.length === 0) return;
    if (!confirm('清空和这个角色的所有聊天记录？此操作不可撤销。')) return;
    setMessages([]);
    await clearChatHistory(characterId);
  }, [characterId, messages.length]);

  // ── Refine flow ──
  const handleRefineClick = useCallback((msg: Message) => {
    setRefineMessage(msg);
  }, []);

  const handleRefineApply = useCallback(
    async (payload: FeedbackApplyPayload) => {
      if (!characterId || !refineMessage) return;
      setRefineMessage(null);
      try {
        await applyFeedback({
          characterId,
          triggerMessage: refineMessage.content,
          userCorrection: payload.userCorrection,
          userSuggestion: payload.userSuggestion,
          patch: payload.result.patch,
          diffSummary: payload.result.diffSummary,
          reasoning: payload.result.reasoning,
        });
        showToast('已修正 TA 的说话方式', true);
        // 用户已经发现并使用了这个功能 → 永久关闭发现提示
        dismissRefineHint();

        // 模式检测：如果最近 5 条 active feedback 里有 3+ 同类，提示用户结构性修改
        const allFbs = await listFeedbacks(characterId);
        // listFeedbacks 是倒序的，detectPattern 需要正序最近 5 条
        const chronological = [...allFbs].reverse();
        const pattern = detectPattern(chronological);
        if (pattern) {
          // 1 秒后再显示，避免和 "已修正" toast 重叠
          setTimeout(() => setPatternHint({ message: pattern.message, suggestion: pattern.suggestion }), 1200);
        }
      } catch (err) {
        console.error('applyFeedback failed', err);
        showToast('修正保存失败', false);
      }
    },
    [characterId, refineMessage, showToast, dismissRefineHint],
  );

  const handleUndo = useCallback(async () => {
    if (!characterId) return;
    const ok = await undoLatestFeedback(characterId);
    if (ok) showToast('已撤销修正', false, 4000);
  }, [characterId, showToast]);

  // ── Loading ──
  if (loading) {
    return <LoadingState bg={chatColors.bg} textColor={chatColors.timestamp} />;
  }

  // ── No character found ──
  if (!character) {
    return (
      <div className="h-screen flex flex-col items-center justify-center gap-4" style={{ backgroundColor: chatColors.bg }}>
        <p style={{ color: chatColors.timestamp }}>角色不存在</p>
        <button
          onClick={() => navigate('/characters')}
          className="btn-primary"
        >
          返回角色列表
        </button>
      </div>
    );
  }

  const activeConfig = getActiveConfig();

  return (
    <div className="h-screen relative" style={{ backgroundColor: chatColors.bg }}>
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

      {/* 一次性发现提示 — 仅当用户从未关闭过 + 至少收到 1 条 AI 回复时显示 */}
      <AnimatePresence>
        {showRefineHint && activeConfig && messages.some((m) => m.sender === 'character') && (
          <motion.div
            key="refine-hint"
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.24, ease: [0.16, 1, 0.3, 1] }}
            className="absolute left-1/2 -translate-x-1/2 z-30 max-w-[92%]"
            style={{ top: '60px' }}
          >
            <div
              className="flex items-center gap-2.5 px-3.5 py-2 rounded-full text-xs"
              style={{
                backgroundColor: 'rgba(20, 20, 22, 0.92)',
                backdropFilter: 'blur(8px)',
                border: '1px solid rgba(15, 168, 118, 0.25)',
                color: 'rgba(255, 255, 255, 0.92)',
                boxShadow: '0 6px 24px rgba(0, 0, 0, 0.35)',
              }}
            >
              <Wand2 size={13} style={{ color: 'var(--color-primary)' }} />
              <span>
                觉得 TA 哪里说话不像？把鼠标停在 TA 的消息上，点
                <Wand2 size={11} className="inline mx-1 -mt-0.5" style={{ color: 'var(--color-primary)' }} />
                修正画像
              </span>
              <button
                onClick={dismissRefineHint}
                className="ml-1 text-white/45 hover:text-white/90 transition-colors"
                aria-label="知道了"
                title="知道了"
              >
                <X size={13} />
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <ChatContainer
        messages={messages}
        characterName={character.identity.name}
        characterAvatar={character.identity.avatar}
        userAvatar={userAvatar}
        onSendMessage={noLLM ? () => {} : handleSend}
        inputDisabled={noLLM || isTyping}
        inputPlaceholder={noLLM ? '请先配置 LLM...' : ''}
        onBack={() => navigate('/characters')}
        typing={isTyping}
        onRefineMessage={activeConfig ? handleRefineClick : undefined}
        headerRight={
          messages.length > 0 ? (
            <Tooltip label="清空聊天记录" placement="bottom">
              <button
                type="button"
                onClick={handleClearHistory}
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
                  (e.currentTarget as HTMLElement).style.backgroundColor = 'rgba(255, 80, 80, 0.10)';
                }}
                onMouseLeave={(e) => {
                  (e.currentTarget as HTMLElement).style.backgroundColor = 'transparent';
                }}
              >
                <Trash2 size={17} color={chatColors.toggleIcon} />
              </button>
            </Tooltip>
          ) : null
        }
      />

      {/* Refine dialog */}
      {activeConfig && refineMessage && (
        <FeedbackDialog
          open
          character={character}
          config={activeConfig}
          triggerMessage={refineMessage.content}
          onClose={() => setRefineMessage(null)}
          onApply={handleRefineApply}
        />
      )}

      {/* Toast (with undo) */}
      <AnimatePresence>
        {toast && (
          <motion.div
            key="toast"
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 8 }}
            transition={{ duration: 0.22, ease: [0.16, 1, 0.3, 1] }}
            className="fixed bottom-24 left-1/2 -translate-x-1/2 z-40"
          >
            <div
              className="flex items-center gap-3 px-4 py-2.5 rounded-full"
              style={{
                backgroundColor: 'rgba(20, 20, 22, 0.95)',
                backdropFilter: 'blur(8px)',
                border: '1px solid rgba(255,255,255,0.10)',
                boxShadow: '0 8px 32px rgba(0,0,0,0.4)',
              }}
            >
              <Check size={14} style={{ color: 'var(--color-primary)' }} />
              <span className="text-sm text-white/95">{toast.message}</span>
              {toast.canUndo && (
                <>
                  <span className="text-white/15">|</span>
                  <button
                    onClick={handleUndo}
                    className="inline-flex items-center gap-1 text-sm font-medium"
                    style={{ color: 'var(--color-primary)' }}
                  >
                    <Undo2 size={13} />
                    撤销
                  </button>
                </>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Pattern hint banner */}
      <AnimatePresence>
        {patternHint && (
          <motion.div
            key="pattern-hint"
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 8 }}
            transition={{ duration: 0.28, ease: [0.16, 1, 0.3, 1] }}
            className="fixed bottom-40 left-1/2 -translate-x-1/2 z-40 max-w-md"
          >
            <div
              className="px-4 py-3 rounded-xl flex items-start gap-3"
              style={{
                backgroundColor: 'rgba(20, 20, 22, 0.96)',
                backdropFilter: 'blur(10px)',
                border: '1px solid rgba(15, 168, 118, 0.30)',
                boxShadow: '0 12px 36px rgba(0,0,0,0.5)',
              }}
            >
              <Wand2 size={16} className="shrink-0 mt-0.5" style={{ color: 'var(--color-primary)' }} />
              <div className="flex-1 min-w-0">
                <p className="text-sm text-white/95 mb-0.5">{patternHint.message}</p>
                <p className="text-xs text-white/55">{patternHint.suggestion}</p>
                <div className="flex gap-3 mt-2">
                  <button
                    onClick={() => {
                      setPatternHint(null);
                      navigate(`/characters/${characterId}/edit`);
                    }}
                    className="text-xs font-medium"
                    style={{ color: 'var(--color-primary)' }}
                  >
                    去画像调整 →
                  </button>
                  <button
                    onClick={() => setPatternHint(null)}
                    className="text-xs text-white/50"
                  >
                    忽略
                  </button>
                </div>
              </div>
              <button
                onClick={() => setPatternHint(null)}
                className="text-white/40 hover:text-white/80 transition-colors shrink-0"
                aria-label="关闭"
              >
                <X size={14} />
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
