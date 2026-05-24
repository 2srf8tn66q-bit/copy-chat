import { useNavigate } from 'react-router-dom';
import { ArrowRight, Home, Compass } from 'lucide-react';
import NavBar from '../components/layout/NavBar';

export default function NotFoundPage() {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen text-on-surface relative">
      <NavBar variant="solid" />

      <main className="relative z-10 min-h-screen flex items-center px-8 md:px-16 lg:px-24 max-w-[1280px] mx-auto pb-32">
        <div className="anim-fade-up-lg">
          <p className="eyebrow mb-4 text-white/35">404 · 这里没有 TA</p>

          <h1
            className="leading-[0.95] mb-6 text-white"
            style={{
              fontFamily: 'var(--font-serif)',
              fontSize: 'clamp(3rem, 8vw, 7rem)',
              letterSpacing: '-0.04em',
            }}
          >
            走错了
          </h1>

          <p className="text-base md:text-lg text-white/55 leading-relaxed mb-10 max-w-md">
            你要找的页面可能搬走了、被删了，<br />
            或者从来没存在过。
          </p>

          <div className="flex items-center gap-4">
            <button
              onClick={() => navigate('/')}
              className="btn-primary inline-flex items-center gap-2"
            >
              <Home size={14} />
              回首页
              <ArrowRight size={14} />
            </button>
            <button
              onClick={() => navigate('/characters')}
              className="inline-flex items-center gap-2 text-sm text-white/70 hover:text-white px-4 py-2.5 rounded-lg transition-colors"
            >
              <Compass size={14} />
              去找 TA 们
            </button>
          </div>
        </div>
      </main>
    </div>
  );
}
