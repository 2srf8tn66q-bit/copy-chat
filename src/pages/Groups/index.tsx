import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Users, ArrowRight, Hammer } from 'lucide-react';
import NavBar from '../../components/layout/NavBar';
import PageHeader from '../../components/PageHeader';
import { getAllCharacters } from '../../services/storage';
import type { Character } from '../../types/character';

export default function GroupsPage() {
  const navigate = useNavigate();
  const [count, setCount] = useState(0);

  useEffect(() => {
    getAllCharacters().then((cs: Character[]) => setCount(cs.length));
  }, []);

  return (
    <div className="min-h-screen text-on-surface relative">
      <NavBar variant="solid" />

      <main className="relative z-10 pt-32 pb-24 px-8 md:px-16 lg:px-24 max-w-[1280px] mx-auto">
        <PageHeader
          eyebrow="GROUPS · 群聊"
          title="把 TA 们拉一个群"
          subtitle="未来你可以把多个角色拉进一个群聊，看 TA 们之间会怎么互动。"
        />

        {/* 建设中占位卡 */}
        <div className="card-glass p-12 anim-fade-up-lg max-w-3xl">
          <div
            className="w-14 h-14 rounded-2xl flex items-center justify-center mb-6"
            style={{
              backgroundColor: 'rgba(15, 168, 118, 0.10)',
              border: '1px solid rgba(15, 168, 118, 0.20)',
            }}
          >
            <Hammer size={22} style={{ color: 'var(--color-primary)' }} />
          </div>

          <p className="eyebrow mb-3 text-white/40">UNDER CONSTRUCTION</p>
          <h2
            className="text-[28px] text-white/95 mb-4"
            style={{ fontFamily: 'var(--font-serif)', letterSpacing: '-0.01em' }}
          >
            群聊还在建设中
          </h2>
          <p className="text-sm text-white/55 max-w-xl leading-relaxed mb-8">
            COPY CHAT 计划支持小型群聊场景 —— 把你和多个角色拉进同一个对话，
            看 TA 们如何互相反应、对话、产生冲突或共鸣。
            <br /><br />
            目前正在打磨中。先去单独跟 TA 们聊聊吧。
          </p>

          <div className="flex items-center gap-4">
            <button
              onClick={() => navigate('/characters')}
              className="btn-primary inline-flex items-center gap-2"
            >
              <Users size={14} />
              去看角色
              <ArrowRight size={14} />
            </button>
            <p className="text-xs text-white/40">
              你已经有 <span className="text-white/80 font-mono">{count}</span> 个角色
            </p>
          </div>
        </div>
      </main>
    </div>
  );
}
