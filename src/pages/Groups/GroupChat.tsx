import { useEffect, useMemo, useState, useRef, useCallback } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { motion, AnimatePresence } from 'motion/react';
import { ChevronLeft, Sun, Moon, Settings as SettingsIcon, User, X, Pencil, Check, Trash2, Square } from 'lucide-react';
import ChatInput from '../../components/chat/ChatInput';
import { useChatColors } from '../../components/chat/chatTheme';
import { useChatThemeStore } from '../../stores/chatThemeStore';
import FadeImage from '../../components/FadeImage';
import LoadingState from '../../components/LoadingState';
import Tooltip from '../../components/Tooltip';
import { useGroupSessionStore } from '../../stores/groupSessionStore';
import { useCharacterStore } from '../../stores/characterStore';
import { useLLMStore } from '../../stores/llmStore';
import { useUserProfileStore } from '../../stores/userProfileStore';
import { getAllCharacters } from '../../services/storage';
import { runGroupTurn } from '../../services/groupChatOrchestrator';
import type { Character } from '../../types/character';
import type { GroupMessage } from '../../types/group';

function newId(): string {
  return `gm_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

export default function GroupChatPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const c = useChatColors();
  const theme = useChatThemeStore((s) => s.theme);
  const toggleTheme = useChatThemeStore((s) => s.toggle);

  const session = useGroupSessionStore((s) => s.sessions.find((x) => x.id === id));
  const loaded = useGroupSessionStore((s) => s.loaded);
  const load = useGroupSessionStore((s) => s.load);
  const appendMessage = useGroupSessionStore((s) => s.appendMessage);
  const setMessages = useGroupSessionStore((s) => s.setMessages);
  const renameSession = useGroupSessionStore((s) => s.renameSession);
  const removeSession = useGroupSessionStore((s) => s.removeSession);

  const characters = useCharacterStore((s) => s.characters);
  const addCharacter = useCharacterStore((s) => s.addCharacter);
  const getActiveConfig = useLLMStore((s) => s.getActiveConfig);
  const userAvatar = useUserProfileStore((s) => s.avatar);
  const userNickname = useUserProfileStore((s) => s.nickname);
  const userDisplayName = userNickname.trim() || '我';

  const [typingSpeaker, setTypingSpeaker] = useState<Character | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [running, setRunning] = useState(false);
  const [stopping, setStopping] = useState(false);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const abortRef = useRef<AbortController | null>(null);

  // 初次进入：加载 store + 把 character 列表灌进 characterStore（chat 页能找到）
  useEffect(() => {
    if (!loaded) load();
    if (characters.length === 0) {
      getAllCharacters().then((all) => all.forEach((c) => addCharacter(c)));
    }
  }, [loaded, load, characters.length, addCharacter]);

  const memberLookup = useCallback(
    (senderId: string): Character | undefined => characters.find((c) => c.id === senderId),
    [characters],
  );

  const members = useMemo(() => {
    if (!session) return [];
    return session.memberIds
      .map((id) => characters.find((c) => c.id === id))
      .filter((c): c is Character => Boolean(c));
  }, [session, characters]);

  const handleSend = async (text: string) => {
    if (!session || running) return;
    const llm = getActiveConfig();
    if (!llm) {
      setError('请先到「设置」配置一个 LLM。');
      return;
    }
    if (members.length === 0) {
      setError('群里所有角色都已被删除，无法发送。');
      return;
    }

    setError(null);
    const userMsg: GroupMessage = {
      id: newId(),
      sender: 'user',
      senderId: 'user',
      content: text,
      timestamp: new Date().toISOString(),
      type: 'text',
    };
    await appendMessage(session.id, userMsg);

    setRunning(true);
    const controller = new AbortController();
    abortRef.current = controller;
    // 用最新历史 + 用户消息触发调度
    const historyForRun = [...(session.messages ?? []), userMsg];
    await runGroupTurn({
      members,
      history: historyForRun,
      llmConfig: llm,
      userDisplayName,
      signal: controller.signal,
      callbacks: {
        onTypingStart: (speaker) => setTypingSpeaker(speaker),
        onMessage: async (_speaker, message) => {
          setTypingSpeaker(null);
          await appendMessage(session.id, message);
        },
        onComplete: () => {
          setTypingSpeaker(null);
          setRunning(false);
          setStopping(false);
          abortRef.current = null;
        },
        onError: (err) => {
          setTypingSpeaker(null);
          setError(err.message);
        },
      },
    });
  };

  const handleStop = () => {
    if (stopping) return;
    setStopping(true);
    abortRef.current?.abort();
  };

  const handleClearMessages = async () => {
    if (!session) return;
    if (!confirm('确定清空这个群的所有聊天记录？')) return;
    await setMessages(session.id, []);
  };

  const handleDismiss = async () => {
    if (!session) return;
    if (!confirm(`确定解散「${session.name}」？此操作不可撤销。`)) return;
    await removeSession(session.id);
    navigate('/groups');
  };

  if (!loaded) {
    return (
      <div className="h-screen flex items-center justify-center" style={{ backgroundColor: c.bg }}>
        <LoadingState />
      </div>
    );
  }

  if (!session) {
    return (
      <div className="h-screen flex flex-col items-center justify-center gap-4" style={{ backgroundColor: c.bg }}>
        <p style={{ color: c.headerText }}>群聊不存在或已被解散</p>
        <button onClick={() => navigate('/groups')} className="btn-primary">回到群列表</button>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-screen" style={{ backgroundColor: c.bg, transition: 'background-color 240ms ease' }}>
      {/* Header */}
      <div
        className="flex items-center shrink-0"
        style={{
          height: '48px',
          backgroundColor: c.header,
          borderBottom: `1px solid ${c.headerBorder}`,
          paddingTop: 'env(safe-area-inset-top, 0px)',
          transition: 'background-color 240ms ease, border-color 240ms ease',
        }}
      >
        <button
          type="button"
          onClick={() => navigate('/groups')}
          className="flex items-center justify-center shrink-0"
          style={{ width: '40px', height: '100%', border: 'none', background: 'transparent', cursor: 'pointer' }}
        >
          <ChevronLeft size={24} color={c.headerText} />
        </button>

        <div className="flex-1 text-center" style={{ color: c.headerText, lineHeight: '48px' }}>
          <span style={{ fontSize: '17px', fontWeight: 500 }}>{session.name}</span>
          <span style={{ fontSize: '13px', marginLeft: 6, opacity: 0.55 }}>
            ({members.length + 1})
          </span>
        </div>

        <div className="shrink-0 flex items-center gap-1 pr-2" style={{ height: '100%' }}>
          <Tooltip label={theme === 'dark' ? '切换到浅色' : '切换到深色'} placement="bottom">
            <button
              type="button"
              onClick={toggleTheme}
              className="flex items-center justify-center"
              style={{
                width: '36px', height: '36px',
                border: 'none', background: 'transparent', cursor: 'pointer',
                borderRadius: '8px', transition: 'background-color 150ms ease',
              }}
              onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.backgroundColor = theme === 'dark' ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.05)'; }}
              onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.backgroundColor = 'transparent'; }}
            >
              {theme === 'dark' ? <Sun size={18} color={c.toggleIcon} /> : <Moon size={18} color={c.toggleIcon} />}
            </button>
          </Tooltip>
          <Tooltip label="群设置" placement="bottom">
            <button
              type="button"
              onClick={() => setDrawerOpen(true)}
              className="flex items-center justify-center"
              style={{
                width: '36px', height: '36px',
                border: 'none', background: 'transparent', cursor: 'pointer',
                borderRadius: '8px', transition: 'background-color 150ms ease',
              }}
              onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.backgroundColor = theme === 'dark' ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.05)'; }}
              onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.backgroundColor = 'transparent'; }}
            >
              <SettingsIcon size={18} color={c.toggleIcon} />
            </button>
          </Tooltip>
        </div>
      </div>

      {/* Messages */}
      <MessagesList
        messages={session.messages}
        typingSpeaker={typingSpeaker}
        memberLookup={memberLookup}
        userAvatar={userAvatar}
        members={members}
        empty={session.messages.length === 0}
      />

      {/* Error toast */}
      {error && (
        <div className="px-4 pb-2">
          <div
            className="text-xs rounded-md px-3 py-2 flex items-center justify-between gap-3"
            style={{ backgroundColor: 'rgba(239, 68, 68, 0.12)', color: '#ff8b8b', border: '1px solid rgba(239,68,68,0.25)' }}
          >
            <span>{error}</span>
            <button onClick={() => setError(null)} className="opacity-70 hover:opacity-100">
              <X size={14} />
            </button>
          </div>
        </div>
      )}

      {/* Stop pill — shown only while orchestrator is running */}
      {running && (
        <div className="flex justify-center pb-2">
          <button
            onClick={handleStop}
            disabled={stopping}
            className="inline-flex items-center gap-1.5 text-xs rounded-full px-3 py-1.5 transition-colors disabled:cursor-not-allowed"
            style={{
              backgroundColor: theme === 'dark' ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.05)',
              color: c.headerText,
              border: `1px solid ${theme === 'dark' ? 'rgba(255,255,255,0.12)' : 'rgba(0,0,0,0.08)'}`,
              opacity: stopping ? 0.6 : 1,
            }}
          >
            <Square size={10} fill="currentColor" />
            {stopping ? '停止中…' : '停止接话'}
          </button>
        </div>
      )}

      {/* Input */}
      <ChatInput
        onSend={handleSend}
        disabled={running || members.length === 0}
        placeholder={members.length === 0 ? '群成员都没了' : '发条消息...'}
      />

      {/* Settings drawer */}
      <AnimatePresence>
        {drawerOpen && (
          <GroupSettingsDrawer
            session={session}
            members={members}
            onClose={() => setDrawerOpen(false)}
            onRename={(name) => renameSession(session.id, name)}
            onClearMessages={handleClearMessages}
            onDismiss={handleDismiss}
          />
        )}
      </AnimatePresence>
    </div>
  );
}

// ─── Messages list ────────────────────────────────────

function MessagesList({
  messages,
  typingSpeaker,
  memberLookup,
  userAvatar,
  members,
  empty,
}: {
  messages: GroupMessage[];
  typingSpeaker: Character | null;
  memberLookup: (id: string) => Character | undefined;
  userAvatar: string;
  members: Character[];
  empty: boolean;
}) {
  const c = useChatColors();
  const scrollRef = useRef<HTMLDivElement>(null);
  const [autoScroll, setAutoScroll] = useState(true);

  const handleScroll = useCallback(() => {
    const el = scrollRef.current;
    if (!el) return;
    const distance = el.scrollHeight - el.scrollTop - el.clientHeight;
    setAutoScroll(distance <= 80);
  }, []);

  useEffect(() => {
    if (autoScroll && scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages, typingSpeaker, autoScroll]);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, []);

  return (
    <div
      ref={scrollRef}
      onScroll={handleScroll}
      className="flex-1 overflow-y-auto"
      style={{ WebkitOverflowScrolling: 'touch' }}
    >
      <div className="py-3">
        {empty && (
          <div className="flex flex-col items-center justify-center py-16 px-6">
            <p className="text-sm text-center" style={{ color: c.timestamp }}>
              群刚建好，{members.map((m) => m.identity.name).join('、')} 都在群里。
              <br />
              发条消息看看 TA 们怎么反应。
            </p>
          </div>
        )}
        <AnimatePresence initial={false}>
          {messages.map((msg, i) => {
            const prev = i > 0 ? messages[i - 1] : null;
            // 同一个人连续说话时不重复显示名字和头像
            const showHeader = !prev || prev.senderId !== msg.senderId;
            return (
              <GroupBubble
                key={msg.id}
                message={msg}
                speaker={memberLookup(msg.senderId)}
                userAvatar={userAvatar}
                showHeader={showHeader}
              />
            );
          })}
        </AnimatePresence>
        {typingSpeaker && <GroupTypingIndicator speaker={typingSpeaker} />}
      </div>
    </div>
  );
}

// ─── Group bubble ─────────────────────────────────────

function GroupBubble({
  message,
  speaker,
  userAvatar,
  showHeader,
}: {
  message: GroupMessage;
  speaker?: Character;
  userAvatar?: string;
  showHeader: boolean;
}) {
  const c = useChatColors();
  const isUser = message.sender === 'user';
  const displayName = isUser ? '我' : (speaker?.identity.name ?? '某人');
  const avatar = isUser ? userAvatar : speaker?.identity.avatar;

  const bubbleBg = isUser ? c.outgoingBubble : c.incomingBubble;
  const bubbleText = isUser ? c.outgoingText : c.incomingText;

  // 头像占 40px，gap-2 = 8px，所以名字 banner 左缩进 48px 才能贴到气泡的左边沿
  const NAME_INDENT_PX = 48;

  return (
    <motion.div
      className="px-3 py-0.5"
      initial={{ opacity: 0, y: 10, scale: 0.96 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={{ type: 'spring', damping: 26, stiffness: 360, mass: 0.8 }}
    >
      {/* 名字 banner —— 独立一行在气泡 row 上方，仅 incoming 显示 */}
      {showHeader && !isUser && (
        <div className="pt-0.5 pb-1" style={{ paddingLeft: `${NAME_INDENT_PX}px` }}>
          <span style={{ fontSize: '12px', color: c.timestamp }}>{displayName}</span>
        </div>
      )}

      {/* 头像 + 气泡 同一行，items-end 让头像底部与气泡底部对齐 */}
      <div className={`flex items-end gap-2 ${isUser ? 'flex-row-reverse' : 'flex-row'}`}>
        {/* Avatar slot — keep width even when hidden, so bubbles stay aligned */}
        <div className="shrink-0" style={{ width: '40px', height: '40px' }}>
          {showHeader ? (
            <div
              className="flex items-center justify-center overflow-hidden"
              style={{
                width: '40px',
                height: '40px',
                borderRadius: '4px',
                backgroundColor: isUser ? c.avatarUserBg : c.avatarBg,
              }}
            >
              {avatar ? (
                <FadeImage src={avatar} alt="" className="h-full w-full object-cover" style={{ borderRadius: '4px' }} />
              ) : (
                <User size={20} color={c.avatarIcon} />
              )}
            </div>
          ) : null}
        </div>

        <div
          className="relative px-3 py-2 min-w-0"
          style={{
            maxWidth: '70%',
            borderRadius: '4px',
            backgroundColor: bubbleBg,
            color: bubbleText,
            fontSize: '16px',
            lineHeight: '1.5',
            wordBreak: 'break-word',
            border: !isUser && c.incomingBorder !== 'transparent' ? `1px solid ${c.incomingBorder}` : 'none',
            transition: 'background-color 240ms ease, color 240ms ease',
          }}
        >
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
          {message.content}
        </div>
      </div>
    </motion.div>
  );
}

// ─── Group typing indicator ───────────────────────────

function GroupTypingIndicator({ speaker }: { speaker: Character }) {
  const c = useChatColors();
  // 与 GroupBubble 保持同一种结构：name banner 一行 + 头像/气泡同 row（items-end）
  return (
    <motion.div
      className="px-3 py-0.5"
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.18 }}
    >
      <div className="pt-0.5 pb-1" style={{ paddingLeft: '48px' }}>
        <span style={{ fontSize: '12px', color: c.timestamp }}>
          {speaker.identity.name} 正在输入…
        </span>
      </div>
      <div className="flex items-end gap-2">
        <div className="shrink-0" style={{ width: '40px', height: '40px' }}>
          <div
            className="flex items-center justify-center overflow-hidden"
            style={{ width: '40px', height: '40px', borderRadius: '4px', backgroundColor: c.avatarBg }}
          >
            {speaker.identity.avatar ? (
              <FadeImage src={speaker.identity.avatar} alt="" className="h-full w-full object-cover" style={{ borderRadius: '4px' }} />
            ) : (
              <User size={20} color={c.avatarIcon} />
            )}
          </div>
        </div>
        <div
          className="relative flex items-center gap-1 px-4 py-3"
          style={{
            backgroundColor: c.incomingBubble,
            borderRadius: '4px',
            border: c.incomingBorder !== 'transparent' ? `1px solid ${c.incomingBorder}` : 'none',
            transition: 'background-color 240ms ease',
          }}
        >
          <div
            className="absolute"
            style={{
              top: '10px',
              left: '-6px',
              width: 0,
              height: 0,
              borderTop: '6px solid transparent',
              borderBottom: '6px solid transparent',
              borderRight: `6px solid ${c.incomingBubble}`,
              transition: 'border-right-color 240ms ease',
            }}
          />
          {[0, 1, 2].map((i) => (
            <span
              key={i}
              className="inline-block rounded-full"
              style={{
                width: '8px',
                height: '8px',
                backgroundColor: c.timestamp,
                animation: `typing-bounce 1.4s ease-in-out ${i * 0.2}s infinite both`,
              }}
            />
          ))}
        </div>
      </div>
    </motion.div>
  );
}

// ─── Settings drawer ──────────────────────────────────

function GroupSettingsDrawer({
  session,
  members,
  onClose,
  onRename,
  onClearMessages,
  onDismiss,
}: {
  session: { id: string; name: string; memberIds: string[] };
  members: Character[];
  onClose: () => void;
  onRename: (name: string) => void;
  onClearMessages: () => void;
  onDismiss: () => void;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(session.name);

  const commitRename = () => {
    const next = draft.trim();
    if (next && next !== session.name) onRename(next);
    setEditing(false);
  };

  return (
    <>
      <motion.div
        className="fixed inset-0 z-40"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        transition={{ duration: 0.2 }}
        style={{ backgroundColor: 'rgba(0,0,0,0.5)' }}
        onClick={onClose}
      />
      <motion.aside
        className="fixed right-0 top-0 bottom-0 z-50 w-full max-w-sm flex flex-col"
        initial={{ x: '100%' }}
        animate={{ x: 0 }}
        exit={{ x: '100%' }}
        transition={{ type: 'spring', damping: 28, stiffness: 280 }}
        style={{
          backgroundColor: 'rgb(20, 20, 22)',
          borderLeft: '1px solid rgba(255,255,255,0.08)',
        }}
      >
        <div className="flex items-center justify-between px-5 py-4 border-b border-white/[0.06]">
          <h3 className="text-sm text-white/85" style={{ letterSpacing: '0.02em' }}>群设置</h3>
          <button onClick={onClose} className="w-8 h-8 rounded-md flex items-center justify-center text-white/50 hover:text-white hover:bg-white/10">
            <X size={16} />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-5 space-y-6">
          {/* Name */}
          <div>
            <label className="block text-[11px] text-white/40 mb-2 tracking-wider uppercase">群名</label>
            {editing ? (
              <div className="flex items-center gap-2">
                <input
                  autoFocus
                  value={draft}
                  onChange={(e) => setDraft(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') commitRename();
                    if (e.key === 'Escape') setEditing(false);
                  }}
                  maxLength={30}
                  className="flex-1 px-2 py-1.5 bg-white/[0.04] border border-white/15 rounded text-sm text-white/95 outline-none focus:border-white/30"
                />
                <button onClick={commitRename} className="w-8 h-8 rounded-md flex items-center justify-center text-white/60 hover:text-white hover:bg-white/10">
                  <Check size={14} />
                </button>
                <button onClick={() => setEditing(false)} className="w-8 h-8 rounded-md flex items-center justify-center text-white/40 hover:text-white/80 hover:bg-white/10">
                  <X size={14} />
                </button>
              </div>
            ) : (
              <div className="flex items-center justify-between group">
                <span className="text-sm text-white/95">{session.name}</span>
                <button
                  onClick={() => {
                    setDraft(session.name);
                    setEditing(true);
                  }}
                  className="opacity-0 group-hover:opacity-100 transition-opacity w-7 h-7 rounded-md flex items-center justify-center text-white/40 hover:text-white/80 hover:bg-white/10"
                >
                  <Pencil size={13} />
                </button>
              </div>
            )}
          </div>

          {/* Members */}
          <div>
            <label className="block text-[11px] text-white/40 mb-2 tracking-wider uppercase">
              成员（{members.length}）
            </label>
            <div className="space-y-2">
              {members.map((m) => (
                <div key={m.id} className="flex items-center gap-3 py-1.5">
                  <div className="w-9 h-9 rounded-full overflow-hidden bg-white/5 flex items-center justify-center shrink-0">
                    {m.identity.avatar ? (
                      <FadeImage src={m.identity.avatar} alt="" className="w-full h-full object-cover" />
                    ) : (
                      <User size={16} className="text-white/30" />
                    )}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm text-white/90 truncate">{m.identity.name}</p>
                    {m.relationshipToUser && (
                      <p className="text-xs text-white/40 truncate">{m.relationshipToUser}</p>
                    )}
                  </div>
                </div>
              ))}
              {members.length === 0 && (
                <p className="text-sm text-white/40 italic">群成员都已被删除</p>
              )}
            </div>
          </div>
        </div>

        {/* Danger zone */}
        <div className="p-5 border-t border-white/[0.06] space-y-2">
          <button
            onClick={onClearMessages}
            className="w-full py-2.5 rounded-md text-sm text-white/75 border border-white/10 hover:border-white/20 hover:bg-white/[0.04] transition-all inline-flex items-center justify-center gap-2"
          >
            <Trash2 size={13} />
            清空聊天记录
          </button>
          <button
            onClick={onDismiss}
            className="w-full py-2.5 rounded-md text-sm border transition-all inline-flex items-center justify-center gap-2"
            style={{
              color: '#ff8585',
              borderColor: 'rgba(239, 68, 68, 0.30)',
              backgroundColor: 'rgba(239, 68, 68, 0.06)',
            }}
          >
            <Trash2 size={13} />
            解散群聊
          </button>
        </div>
      </motion.aside>
    </>
  );
}
