import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Plus, Search, User, Trash2, ArrowRight, Settings as SettingsIcon } from 'lucide-react';
import { getAllCharacters, deleteCharacter } from '../../services/storage';
import { useCharacterStore } from '../../stores/characterStore';
import NavBar from '../../components/layout/NavBar';
import PageHeader from '../../components/PageHeader';
import FadeImage from '../../components/FadeImage';
import Tooltip from '../../components/Tooltip';
import type { Character } from '../../types/character';

export default function CharactersPage() {
  const navigate = useNavigate();
  const addCharacter = useCharacterStore((s) => s.addCharacter);
  const removeCharacter = useCharacterStore((s) => s.removeCharacter);

  const [characters, setCharacters] = useState<Character[]>([]);
  const [search, setSearch] = useState('');

  useEffect(() => {
    getAllCharacters().then((chars) => {
      setCharacters(chars);
      chars.forEach((c) => addCharacter(c));
    });
  }, [addCharacter]);

  const filtered = characters.filter((c) =>
    c.identity.name.toLowerCase().includes(search.toLowerCase()),
  );

  const isEmpty = characters.length === 0;

  return (
    <div className="min-h-screen text-on-surface relative">
      <NavBar variant="solid" />

      <main className="relative z-10 pt-32 pb-24 px-8 md:px-16 lg:px-24 max-w-[1280px] mx-auto">
        {/* ── PageHeader ── */}
        <PageHeader
          eyebrow={`CHARACTERS · 角色${characters.length > 0 ? ` · ${characters.length}` : ''}`}
          title="你的角色"
          subtitle="每一个都从真实聊天记录里被还原出来。"
          action={
            !isEmpty && (
              <div className="flex items-center gap-3">
                <div className="relative">
                  <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-white/30" />
                  <input
                    type="text"
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    placeholder="搜索"
                    className="pl-9 pr-4 py-2 bg-white/[0.03] border border-white/[0.08] rounded-md text-sm outline-none w-48 focus:border-white/20 text-on-surface placeholder:text-white/25 transition-colors"
                  />
                </div>
                <button onClick={() => navigate('/import')} className="btn-primary inline-flex items-center gap-1.5">
                  <Plus size={14} />
                  导入
                </button>
              </div>
            )
          }
        />

        {/* ── Empty state — full-bleed image with overlay text ── */}
        {isEmpty ? (
          <EmptyCharactersState onImport={() => navigate('/import')} />
        ) : (
          <section>
            {filtered.length === 0 ? (
              <div className="py-20 text-center">
                <p className="text-sm text-white/40">没有匹配的角色</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
                {filtered.map((char, i) => (
                  <CharacterCard
                    key={char.id}
                    character={char}
                    delay={i * 60}
                    onNavigate={navigate}
                    onDelete={async (id) => {
                      await deleteCharacter(id);
                      removeCharacter(id);
                      setCharacters((prev) => prev.filter((c) => c.id !== id));
                    }}
                  />
                ))}
              </div>
            )}
          </section>
        )}
      </main>
    </div>
  );
}

// ─── Empty state with hero image ──────────────────────

function EmptyCharactersState({ onImport }: { onImport: () => void }) {
  return (
    <div
      className="relative rounded-2xl overflow-hidden mt-8 anim-fade-up-lg delay-200"
      style={{ aspectRatio: '16 / 9', minHeight: '420px' }}
    >
      {/* Background image (full bleed) */}
      <img
        src="/empty-characters.jpg"
        alt=""
        className="absolute inset-0 w-full h-full object-cover"
        style={{ objectPosition: 'center' }}
      />

      {/* Gradient overlay — strengthens left dark, lets right green shine */}
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
          <p className="eyebrow mb-3 anim-fade-in delay-500">EMPTY · 还没人在</p>
          <h2 className="text-h1 text-white anim-fade-up delay-700">TA 还没出现</h2>
          <p className="mt-4 text-base text-white/60 leading-relaxed anim-fade-in delay-900">
            导入你和某个人的聊天记录，<br />
            在这里和 TA 重新对话。
          </p>
          <button
            onClick={onImport}
            className="mt-8 inline-flex items-center gap-2 text-white text-[15px] group anim-fade-in delay-900"
            style={{ cursor: 'pointer', animationDelay: '1100ms' }}
          >
            <span className="border-b border-white/40 group-hover:border-white pb-0.5 transition-colors">
              导入聊天
            </span>
            <ArrowRight
              size={16}
              className="transition-transform duration-300 group-hover:translate-x-1.5"
              style={{ transitionTimingFunction: 'cubic-bezier(0.16, 1, 0.3, 1)' }}
            />
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Character card ──────────────────────────────────

function CharacterCard({
  character,
  onNavigate,
  onDelete,
  delay = 0,
}: {
  character: Character;
  onNavigate: (path: string) => void;
  onDelete: (id: string) => void;
  delay?: number;
}) {
  const sourceLabel =
    character.sourceType === 'text-paste' ? '文本导入'
    : character.sourceType === 'html-upload' ? '文件导入'
    : '手动创建';

  return (
    <div
      className="card-glass p-7 group anim-fade-up flex flex-col"
      style={{ animationDelay: `${delay}ms`, minHeight: '380px' }}
    >
      {/* Top corner actions — only visible on hover */}
      <div className="flex items-center justify-end gap-1 -mt-2 -mr-2 mb-1 h-7">
        <Tooltip label="编辑画像" placement="bottom">
          <button
            onClick={() => onNavigate(`/characters/${character.id}/edit`)}
            className="w-8 h-8 rounded-lg flex items-center justify-center text-white/30 hover:bg-white/10 hover:text-white/80 opacity-0 group-hover:opacity-100 transition-all"
            aria-label="编辑画像"
          >
            <SettingsIcon size={15} />
          </button>
        </Tooltip>
        <Tooltip label="删除角色" placement="bottom">
          <button
            onClick={() => {
              if (confirm(`确定删除「${character.identity.name}」？`)) onDelete(character.id);
            }}
            className="w-8 h-8 rounded-lg flex items-center justify-center text-white/30 hover:bg-white/10 hover:text-red-400 opacity-0 group-hover:opacity-100 transition-all"
            aria-label="删除"
          >
            <Trash2 size={15} />
          </button>
        </Tooltip>
      </div>

      {/* Centered avatar + identity */}
      <div className="flex flex-col items-center text-center flex-1 justify-center pb-2">
        <div className="w-20 h-20 rounded-2xl overflow-hidden bg-white/5 border border-white/[0.08] flex items-center justify-center mb-5">
          {character.identity.avatar ? (
            <FadeImage src={character.identity.avatar} alt="" className="w-full h-full object-cover" />
          ) : (
            <User size={32} className="text-white/30" />
          )}
        </div>
        <h3
          className="text-[20px] text-white/95 truncate max-w-full px-4"
          style={{ fontFamily: 'var(--font-serif)', letterSpacing: '-0.01em' }}
        >
          {character.identity.name}
        </h3>
        {character.relationshipToUser && (
          <p className="text-xs text-white/40 mt-1.5 tracking-wide">
            {character.relationshipToUser}
          </p>
        )}
        <p className="eyebrow mt-3 text-[10px] text-white/25">
          {sourceLabel}
        </p>
      </div>

      {/* Action buttons — vertical stack for clean hierarchy */}
      <div className="flex flex-col gap-2 mt-4">
        <button
          onClick={() => onNavigate(`/characters/${character.id}/chat`)}
          className="w-full py-2.5 rounded-lg text-sm font-semibold text-white inline-flex items-center justify-center gap-1.5 group/btn transition-all hover:brightness-110 active:scale-[0.98]"
          style={{ backgroundColor: 'var(--color-primary)' }}
        >
          开始聊天
          <ArrowRight size={14} className="group-hover/btn:translate-x-0.5 transition-transform" />
        </button>
        <button
          onClick={() => onNavigate(`/characters/${character.id}/timeline`)}
          className="w-full py-2.5 rounded-lg text-sm font-medium text-white/80 border border-white/15 hover:border-white/30 hover:text-white hover:bg-white/[0.03] active:scale-[0.98] transition-all"
        >
          IF 线
        </button>
      </div>
    </div>
  );
}
