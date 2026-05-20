import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Plus, Search, User, Users, Settings, Trash2 } from 'lucide-react';
import { getAllCharacters, deleteCharacter } from '../../services/storage';
import { useCharacterStore } from '../../stores/characterStore';
import NavBar from '../../components/layout/NavBar';
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

  return (
    <div className="min-h-screen bg-surface text-on-surface">
      {/* Nav */}
      <NavBar variant="solid" />

      <main className="pt-20 pb-20 px-6 md:px-8 max-w-5xl mx-auto">
        {/* Header */}
        <header className="flex flex-col md:flex-row md:items-end justify-between gap-5 mb-10">
          <div className="max-w-xl">
            <h1 className="text-3xl md:text-4xl font-extrabold tracking-tight mb-2 text-on-surface">
              创建角色
            </h1>
            <p className="text-sm text-secondary">
              每个人都是根据真实聊天记录生成的。
            </p>
          </div>
          <div className="flex items-center gap-3">
            <div className="relative">
              <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-outline" />
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="搜索角色..."
                className="pl-9 pr-4 py-2 bg-surface-container-low rounded-md text-sm outline-none w-56 md:w-64 focus:ring-1 focus:ring-primary text-on-surface placeholder:text-outline"
              />
            </div>
            <button
              onClick={() => navigate('/import')}
              className="inline-flex items-center gap-1.5 bg-primary text-on-primary px-4 py-2 rounded-md text-sm font-medium hover:scale-[1.02] active:scale-95 transition-all"
            >
              <Plus size={14} />
              导入角色
            </button>
          </div>
        </header>

        {/* Characters */}
        <section className="mb-14">
          <h2 className="text-lg font-bold tracking-tight mb-5 text-primary">角色</h2>

          {filtered.length === 0 ? (
            <div className="text-center py-16">
              <p className="text-sm mb-2 text-on-surface-variant">
                {characters.length === 0 ? '还没有角色' : '没有匹配的角色'}
              </p>
              {characters.length === 0 && (
                <button
                  onClick={() => navigate('/import')}
                  className="inline-flex items-center gap-1.5 bg-primary text-on-primary px-4 py-2 rounded-md text-sm font-medium mt-3 hover:scale-[1.02] hover:shadow-md hover:shadow-primary/25 active:scale-95 transition-all"
                >
                  <Plus size={14} />
                  导入第一个角色
                </button>
              )}
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
              {filtered.map((char) => (
                <CharacterCard key={char.id} character={char} onNavigate={navigate} onDelete={async (id) => {
                  await deleteCharacter(id);
                  removeCharacter(id);
                  setCharacters(prev => prev.filter(c => c.id !== id));
                }} />
              ))}
            </div>
          )}
        </section>

        {/* Group Chats */}
        <section>
          <h2 className="text-lg font-bold tracking-tight mb-5 text-primary">群聊</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <button
              onClick={() => navigate('/groups')}
              className="p-5 rounded-xl flex flex-col items-center justify-center text-center border-2 border-dashed border-outline-variant bg-surface hover:bg-surface-container-low transition-colors"
            >
              <div className="w-10 h-10 rounded-full bg-surface-container-high flex items-center justify-center mb-2">
                <Users size={18} className="text-outline" />
              </div>
              <h3 className="font-bold text-sm text-on-surface">创建群聊</h3>
              <p className="text-xs mt-1 text-outline">选几个角色拉一个群</p>
            </button>
          </div>
        </section>
      </main>

      {/* Footer */}
      <footer className="w-full py-6 px-6 md:px-8 border-t border-outline-variant bg-surface">
        <div className="max-w-7xl mx-auto flex justify-between items-center">
          <span className="text-xs text-outline">&copy; 2026 Copy Chat</span>
          <button
            onClick={() => navigate('/settings')}
            className="flex items-center gap-1 text-xs text-outline hover:text-on-surface-variant transition-colors"
          >
            <Settings size={12} />
            设置
          </button>
        </div>
      </footer>
    </div>
  );
}

function CharacterCard({ character, onNavigate, onDelete }: { character: Character; onNavigate: (path: string) => void; onDelete: (id: string) => void }) {
  return (
    <div className="bg-surface-container-lowest p-5 rounded-xl border border-transparent hover:border-outline-variant transition-colors">
      <div className="flex items-center gap-3.5">
        <div className="w-14 h-14 rounded-xl overflow-hidden shrink-0 bg-surface-container-highest border border-surface-container-high flex items-center justify-center">
          {character.identity.avatar ? (
            <img src={character.identity.avatar} alt="" className="w-full h-full object-cover" />
          ) : (
            <User size={24} className="text-outline opacity-40" />
          )}
        </div>
        <div className="flex-1 min-w-0">
          <h4 className="font-bold text-base text-on-surface">{character.identity.name}</h4>
          <p className="text-xs text-outline">
            {character.sourceType === 'text-paste' ? '文本导入' : character.sourceType === 'html-upload' ? '文件导入' : '手动创建'}
          </p>
        </div>
        <button
          onClick={() => { if (confirm(`确定删除「${character.identity.name}」？`)) onDelete(character.id); }}
          className="shrink-0 w-8 h-8 rounded-full flex items-center justify-center text-outline hover:bg-error/10 hover:text-error transition-colors"
        >
          <Trash2 size={15} />
        </button>
      </div>
      <div className="mt-4 flex gap-2">
        <button
          onClick={() => onNavigate(`/characters/${character.id}/chat`)}
          className="flex-1 py-2 rounded-md text-xs font-bold bg-primary text-on-primary"
        >
          聊天
        </button>
        <button
          onClick={() => onNavigate(`/characters/${character.id}/timeline`)}
          className="flex-1 py-2 rounded-md text-xs font-bold bg-surface-container-high text-on-surface hover:bg-surface-container-highest transition-colors"
        >
          IF 线
        </button>
        <button
          onClick={() => onNavigate(`/characters/${character.id}/edit`)}
          className="px-3 py-2 rounded-md text-xs font-bold bg-surface-container-high text-on-surface hover:bg-surface-container-highest transition-colors"
        >
          画像
        </button>
      </div>
    </div>
  );
}
