import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Plus, ArrowRight, Trash2, Pencil, User, X, Check } from 'lucide-react';
import NavBar from '../../components/layout/NavBar';
import PageHeader from '../../components/PageHeader';
import FadeImage from '../../components/FadeImage';
import Tooltip from '../../components/Tooltip';
import { getAllCharacters } from '../../services/storage';
import { useGroupSessionStore } from '../../stores/groupSessionStore';
import type { Character } from '../../types/character';
import type { GroupSession } from '../../types/group';

const MAX_MEMBERS = 3;

export default function GroupsPage() {
  const navigate = useNavigate();
  const sessions = useGroupSessionStore((s) => s.sessions);
  const loaded = useGroupSessionStore((s) => s.loaded);
  const load = useGroupSessionStore((s) => s.load);
  const removeSession = useGroupSessionStore((s) => s.removeSession);
  const renameSession = useGroupSessionStore((s) => s.renameSession);

  const [characters, setCharacters] = useState<Character[]>([]);
  const [showCreate, setShowCreate] = useState(false);

  useEffect(() => {
    getAllCharacters().then(setCharacters);
    if (!loaded) load();
  }, [loaded, load]);

  const isEmpty = sessions.length === 0;
  const characterById = (id: string) => characters.find((c) => c.id === id);

  return (
    <div className="min-h-screen text-on-surface relative">
      <NavBar variant="solid" />

      <main className="relative z-10 pt-32 pb-24 px-8 md:px-16 lg:px-24 max-w-[1280px] mx-auto">
        <PageHeader
          eyebrow={`GROUPS · 群聊${sessions.length > 0 ? ` · ${sessions.length}` : ''}`}
          title="把 TA 们拉一个群"
          subtitle="选 2-3 个角色，看 TA 们如何互相反应。"
          action={
            !isEmpty && (
              <button
                onClick={() => setShowCreate(true)}
                disabled={characters.length < 2}
                className="btn-primary inline-flex items-center gap-1.5 disabled:opacity-40 disabled:cursor-not-allowed"
              >
                <Plus size={14} />
                新建群聊
              </button>
            )
          }
        />

        {isEmpty ? (
          <EmptyGroupsState
            canCreate={characters.length >= 2}
            characterCount={characters.length}
            onCreate={() => setShowCreate(true)}
            onGoCharacters={() => navigate('/characters')}
          />
        ) : (
          <section className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
            {sessions.map((s, i) => (
              <GroupCard
                key={s.id}
                session={s}
                memberLookup={characterById}
                delay={i * 50}
                onOpen={() => navigate(`/groups/${s.id}`)}
                onDelete={async () => {
                  if (confirm(`确定解散「${s.name}」？此群所有消息将被删除。`)) {
                    await removeSession(s.id);
                  }
                }}
                onRename={(name) => renameSession(s.id, name)}
              />
            ))}
          </section>
        )}
      </main>

      {showCreate && (
        <CreateGroupDialog
          characters={characters}
          onClose={() => setShowCreate(false)}
          onCreated={(id) => {
            setShowCreate(false);
            navigate(`/groups/${id}`);
          }}
        />
      )}
    </div>
  );
}

// ─── Empty state ──────────────────────────────────────

function EmptyGroupsState({
  canCreate,
  characterCount,
  onCreate,
  onGoCharacters,
}: {
  canCreate: boolean;
  characterCount: number;
  onCreate: () => void;
  onGoCharacters: () => void;
}) {
  const ctaLabel = canCreate ? '新建群聊' : '先去导入角色';
  const onCta = canCreate ? onCreate : onGoCharacters;

  return (
    <div
      className="relative rounded-2xl overflow-hidden mt-8 anim-fade-up-lg"
      style={{ aspectRatio: '16 / 9', minHeight: '420px' }}
    >
      {/* Background image (full bleed) */}
      <img
        src="/empty-groups.jpg"
        alt=""
        className="absolute inset-0 w-full h-full object-cover"
        style={{ objectPosition: 'center' }}
      />

      {/* Gradient overlay — left dark heavy for text legibility */}
      <div
        aria-hidden
        className="absolute inset-0"
        style={{
          background:
            'linear-gradient(to right, rgba(10,10,11,0.92) 0%, rgba(10,10,11,0.70) 35%, rgba(10,10,11,0.20) 70%, rgba(10,10,11,0.10) 100%)',
        }}
      />

      {/* Overlay content */}
      <div className="relative h-full flex items-center px-10 md:px-16 lg:px-20">
        <div className="max-w-md">
          <p className="eyebrow mb-3 anim-fade-in delay-500">EMPTY · 还没有群</p>
          <h2 className="text-h1 text-white anim-fade-up delay-700">把 TA 们拉一个群</h2>
          <p className="mt-4 text-base text-white/60 leading-relaxed anim-fade-in delay-900">
            建一个小群（最多 {MAX_MEMBERS} 个角色），<br />
            看 TA 们在你面前怎么互相反应。
            {!canCreate && (
              <>
                <br /><br />
                <span className="text-white/40">至少要先有 2 个角色才能建群。</span>
              </>
            )}
          </p>
          <button
            onClick={onCta}
            className="mt-8 inline-flex items-center gap-2 text-white text-[15px] group anim-fade-in delay-900"
            style={{ cursor: 'pointer', animationDelay: '1100ms' }}
          >
            {canCreate && <Plus size={14} className="opacity-80" />}
            <span className="border-b border-white/40 group-hover:border-white pb-0.5 transition-colors">
              {ctaLabel}
            </span>
            <ArrowRight
              size={16}
              className="transition-transform duration-300 group-hover:translate-x-1.5"
              style={{ transitionTimingFunction: 'cubic-bezier(0.16, 1, 0.3, 1)' }}
            />
          </button>
          {canCreate && characterCount > 0 && (
            <p className="text-xs text-white/40 mt-6 anim-fade-in delay-900" style={{ animationDelay: '1300ms' }}>
              目前有 <span className="text-white/80 font-mono">{characterCount}</span> 个角色
            </p>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── Group card ──────────────────────────────────────

function GroupCard({
  session,
  memberLookup,
  delay = 0,
  onOpen,
  onDelete,
  onRename,
}: {
  session: GroupSession;
  memberLookup: (id: string) => Character | undefined;
  delay?: number;
  onOpen: () => void;
  onDelete: () => void;
  onRename: (name: string) => void;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(session.name);

  const members = session.memberIds.map(memberLookup).filter((m): m is Character => Boolean(m));
  const lastMsg = session.messages[session.messages.length - 1];
  const lastMsgText = lastMsg
    ? lastMsg.content.length > 30 ? lastMsg.content.slice(0, 30) + '…' : lastMsg.content
    : '群刚建好，还没人说话';

  const commitRename = () => {
    const next = draft.trim();
    if (next && next !== session.name) onRename(next);
    setEditing(false);
  };

  return (
    <div
      className="card-glass p-6 group anim-fade-up flex flex-col cursor-pointer transition-all hover:border-white/15"
      style={{ animationDelay: `${delay}ms`, minHeight: '180px' }}
      onClick={() => !editing && onOpen()}
    >
      {/* Top row: stacked avatars + corner actions */}
      <div className="flex items-start justify-between mb-4">
        <StackedAvatars members={members} />
        <div
          className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity"
          onClick={(e) => e.stopPropagation()}
        >
          <Tooltip label="重命名" placement="bottom">
            <button
              onClick={() => {
                setDraft(session.name);
                setEditing(true);
              }}
              className="w-7 h-7 rounded-md flex items-center justify-center text-white/30 hover:bg-white/10 hover:text-white/80 transition-all"
              aria-label="重命名"
            >
              <Pencil size={13} />
            </button>
          </Tooltip>
          <Tooltip label="解散群" placement="bottom">
            <button
              onClick={onDelete}
              className="w-7 h-7 rounded-md flex items-center justify-center text-white/30 hover:bg-white/10 hover:text-red-400 transition-all"
              aria-label="解散"
            >
              <Trash2 size={13} />
            </button>
          </Tooltip>
        </div>
      </div>

      {/* Name + meta */}
      <div className="flex-1 min-w-0" onClick={(e) => editing && e.stopPropagation()}>
        {editing ? (
          <div className="flex items-center gap-2 mb-2">
            <input
              autoFocus
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') commitRename();
                if (e.key === 'Escape') setEditing(false);
              }}
              maxLength={30}
              className="flex-1 min-w-0 px-2 py-1 bg-white/[0.04] border border-white/15 rounded text-sm text-white/95 outline-none focus:border-white/30"
            />
            <button onClick={commitRename} className="w-7 h-7 rounded-md flex items-center justify-center text-white/60 hover:text-white hover:bg-white/10">
              <Check size={14} />
            </button>
            <button onClick={() => setEditing(false)} className="w-7 h-7 rounded-md flex items-center justify-center text-white/40 hover:text-white/80 hover:bg-white/10">
              <X size={14} />
            </button>
          </div>
        ) : (
          <h3
            className="text-[18px] text-white/95 truncate"
            style={{ fontFamily: 'var(--font-serif)', letterSpacing: '-0.01em' }}
          >
            {session.name}
          </h3>
        )}
        <p className="text-xs text-white/40 mt-1.5">
          {members.map((m) => m.identity.name).join('、') || '成员已不存在'}
        </p>
        <p className="text-sm text-white/55 mt-3 line-clamp-1">
          {lastMsg ? (
            <>
              <span className="text-white/35">
                {lastMsg.sender === 'user' ? '我' : (memberLookup(lastMsg.senderId)?.identity.name ?? '某人')}：
              </span>
              {lastMsgText}
            </>
          ) : (
            <span className="text-white/35 italic">{lastMsgText}</span>
          )}
        </p>
      </div>
    </div>
  );
}

// ─── Stacked avatars ──────────────────────────────────

export function StackedAvatars({ members, size = 36 }: { members: Character[]; size?: number }) {
  return (
    <div className="flex items-center">
      {members.slice(0, MAX_MEMBERS).map((m, i) => (
        <div
          key={m.id}
          className="rounded-full overflow-hidden bg-white/5 border-2 flex items-center justify-center"
          style={{
            width: size,
            height: size,
            borderColor: 'rgb(20, 20, 22)',
            marginLeft: i === 0 ? 0 : -size / 3,
            zIndex: members.length - i,
          }}
        >
          {m.identity.avatar ? (
            <FadeImage src={m.identity.avatar} alt="" className="w-full h-full object-cover" />
          ) : (
            <User size={size * 0.45} className="text-white/30" />
          )}
        </div>
      ))}
    </div>
  );
}

// ─── Create group dialog ──────────────────────────────

function CreateGroupDialog({
  characters,
  onClose,
  onCreated,
}: {
  characters: Character[];
  onClose: () => void;
  onCreated: (id: string) => void;
}) {
  const [selected, setSelected] = useState<string[]>([]);
  const [name, setName] = useState('');
  const [nameTouched, setNameTouched] = useState(false);
  const addSession = useGroupSessionStore((s) => s.addSession);

  // 自动建议群名（在用户改名前）
  const suggestedName = (() => {
    if (selected.length === 0) return '';
    const names = selected
      .map((id) => characters.find((c) => c.id === id)?.identity.name)
      .filter(Boolean);
    if (names.length === 1) return `${names[0]} 和我`;
    return `${names.join('、')} 的群`;
  })();

  const effectiveName = nameTouched ? name : suggestedName;

  const toggle = (id: string) => {
    setSelected((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : prev.length >= MAX_MEMBERS ? prev : [...prev, id],
    );
  };

  const canCreate = selected.length >= 2 && effectiveName.trim().length > 0;

  const handleCreate = async () => {
    if (!canCreate) return;
    const now = new Date().toISOString();
    const id = `grp_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    await addSession({
      id,
      name: effectiveName.trim(),
      memberIds: selected,
      messages: [],
      createdAt: now,
      updatedAt: now,
    });
    onCreated(id);
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 anim-fade-in"
      style={{ backgroundColor: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(4px)' }}
      onClick={onClose}
    >
      <div
        className="card-glass w-full max-w-xl p-8 anim-fade-up"
        onClick={(e) => e.stopPropagation()}
        style={{ animationDuration: '180ms' }}
      >
        <div className="flex items-start justify-between mb-6">
          <div>
            <p className="eyebrow mb-2 text-white/40">NEW · 新建群聊</p>
            <h2
              className="text-[22px] text-white/95"
              style={{ fontFamily: 'var(--font-serif)', letterSpacing: '-0.01em' }}
            >
              把 TA 们拉一个群
            </h2>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-md flex items-center justify-center text-white/40 hover:text-white/90 hover:bg-white/10 transition-all"
            aria-label="关闭"
          >
            <X size={16} />
          </button>
        </div>

        {/* Name input */}
        <div className="mb-6">
          <label className="block text-xs text-white/40 mb-2 tracking-wide">群名</label>
          <input
            value={effectiveName}
            placeholder="给群起个名字"
            onChange={(e) => {
              setName(e.target.value);
              setNameTouched(true);
            }}
            maxLength={30}
            className="w-full px-3 py-2.5 bg-white/[0.03] border border-white/[0.10] rounded-md text-sm outline-none focus:border-white/25 text-on-surface placeholder:text-white/25 transition-colors"
          />
        </div>

        {/* Member selection */}
        <div className="mb-6">
          <div className="flex items-center justify-between mb-3">
            <label className="text-xs text-white/40 tracking-wide">
              选择成员（最多 {MAX_MEMBERS} 个）
            </label>
            <span className="text-xs text-white/40 font-mono">
              {selected.length}/{MAX_MEMBERS}
            </span>
          </div>
          {characters.length === 0 ? (
            <p className="text-sm text-white/40 py-8 text-center">还没有角色，先去导入吧</p>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 max-h-[300px] overflow-y-auto pr-1">
              {characters.map((c) => {
                const isSelected = selected.includes(c.id);
                const isDisabled = !isSelected && selected.length >= MAX_MEMBERS;
                return (
                  <button
                    key={c.id}
                    onClick={() => toggle(c.id)}
                    disabled={isDisabled}
                    className={`flex flex-col items-center p-3 rounded-lg border transition-all ${
                      isSelected
                        ? 'border-[var(--color-primary)] bg-[rgba(15,168,118,0.08)]'
                        : isDisabled
                          ? 'border-white/[0.05] opacity-40 cursor-not-allowed'
                          : 'border-white/[0.08] hover:border-white/20 hover:bg-white/[0.03]'
                    }`}
                  >
                    <div className="w-12 h-12 rounded-full overflow-hidden bg-white/5 mb-2 flex items-center justify-center">
                      {c.identity.avatar ? (
                        <FadeImage src={c.identity.avatar} alt="" className="w-full h-full object-cover" />
                      ) : (
                        <User size={20} className="text-white/30" />
                      )}
                    </div>
                    <span className="text-xs text-white/85 truncate max-w-full">{c.identity.name}</span>
                  </button>
                );
              })}
            </div>
          )}
        </div>

        <div className="flex items-center justify-end gap-3">
          <button
            onClick={onClose}
            className="px-4 py-2 text-sm text-white/60 hover:text-white/90 transition-colors"
          >
            取消
          </button>
          <button
            onClick={handleCreate}
            disabled={!canCreate}
            className="btn-primary inline-flex items-center gap-1.5 disabled:opacity-40 disabled:cursor-not-allowed"
          >
            建群
            <ArrowRight size={14} />
          </button>
        </div>
      </div>
    </div>
  );
}
