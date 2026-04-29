import { useEffect, useRef, useCallback } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { gsap } from 'gsap';
import logo from '../../assets/logo.png';
import { useLLMStore } from '../../stores/llmStore';
import { useCharacterStore } from '../../stores/characterStore';

const NAV_ITEMS = [
  { label: '角色', path: '/characters' },
  { label: '群聊', path: '/groups' },
  { label: '设置', path: '/settings' },
];

interface NavBarProps {
  variant?: 'glass' | 'solid';
}

export default function NavBar({ variant = 'solid' }: NavBarProps) {
  const navigate = useNavigate();
  const location = useLocation();
  const hasLLM = !!useLLMStore((s) => s.getActiveConfig());
  const hasCharacters = useCharacterStore((s) => s.characters.length > 0);

  const activeIndex = NAV_ITEMS.findIndex((item) => location.pathname.startsWith(item.path));
  const pillRefs = useRef<(HTMLButtonElement | null)[]>([]);
  const circleRefs = useRef<(HTMLSpanElement | null)[]>([]);
  const labelRefs = useRef<(HTMLSpanElement | null)[]>([]);
  const hoverLabelRefs = useRef<(HTMLSpanElement | null)[]>([]);
  const tlRefs = useRef<gsap.core.Timeline[]>([]);

  const ease = 'power3.easeOut';

  // Layout: calculate circle sizes for each pill
  const layout = useCallback(() => {
    pillRefs.current.forEach((pill, i) => {
      if (!pill) return;
      const circle = circleRefs.current[i];
      const label = labelRefs.current[i];
      const hoverLabel = hoverLabelRefs.current[i];
      if (!circle) return;

      const rect = pill.getBoundingClientRect();
      const w = rect.width;
      const h = rect.height;
      const R = (w * w) / 4 + (h * h) / (4 * Math.max(h, 1));
      const D = Math.ceil(2 * R) + 2;
      const delta = Math.ceil(R - Math.sqrt(Math.max(0, R * R - (w * w) / 4))) + 1;
      const originY = D - delta;

      circle.style.width = `${D}px`;
      circle.style.height = `${D}px`;
      circle.style.bottom = `-${delta}px`;

      gsap.set(circle, {
        xPercent: -50,
        scale: activeIndex === i ? 1 : 0,
        transformOrigin: `50% ${originY}px`,
      });

      if (label) gsap.set(label, { y: 0 });
      if (hoverLabel) gsap.set(hoverLabel, { y: h + 12, opacity: 0 });

      // Build hover timeline
      tlRefs.current[i]?.kill();
      const tl = gsap.timeline({ paused: true });

      tl.to(circle, { scale: 1.15, xPercent: -50, duration: 0.4, ease, overwrite: 'auto' }, 0);
      if (label) tl.to(label, { y: -(h + 8), duration: 0.4, ease, overwrite: 'auto' }, 0);
      if (hoverLabel) {
        gsap.set(hoverLabel, { y: Math.ceil(h + 100), opacity: 0 });
        tl.to(hoverLabel, { y: 0, opacity: 1, duration: 0.4, ease, overwrite: 'auto' }, 0);
      }

      tlRefs.current[i] = tl;
    });
  }, [activeIndex, ease]);

  useEffect(() => {
    layout();
    window.addEventListener('resize', layout);
    return () => window.removeEventListener('resize', layout);
  }, [layout]);

  // Keep active pill visible when route changes
  useEffect(() => {
    pillRefs.current.forEach((_, i) => {
      const circle = circleRefs.current[i];
      if (!circle) return;
      if (activeIndex === i) {
        gsap.to(circle, { scale: 1.15, duration: 0.4, ease });
      }
    });
  }, [activeIndex, ease]);

  const handleEnter = (i: number) => {
    const tl = tlRefs.current[i];
    if (!tl) return;
    tl.tweenTo(tl.duration(), { duration: 0.3, ease, overwrite: 'auto' });
  };

  const handleLeave = (i: number) => {
    const tl = tlRefs.current[i];
    if (!tl) return;
    // If it's the active item, stay expanded
    if (activeIndex === i) return;
    tl.tweenTo(0, { duration: 0.25, ease, overwrite: 'auto' });
  };

  return (
    <nav
      className={`fixed top-0 w-full z-50 h-16 flex justify-between items-center max-w-full ${
        variant === 'glass'
          ? 'bg-black/40 backdrop-blur-2xl border-b border-white/10'
          : 'bg-surface/80 backdrop-blur-xl border-b border-outline-variant'
      }`}
      style={{ paddingLeft: 'max(2rem, calc((100vw - 80rem) / 2 + 2rem))', paddingRight: 'max(2rem, calc((100vw - 80rem) / 2 + 2rem))' }}
    >
      {/* Left: Logo + Brand */}
      <button onClick={() => navigate('/')} className="flex items-center gap-3 shrink-0">
        <img src={logo} alt="" className="w-12 h-12 -mt-0.5" />
        <span className="text-xl font-bold tracking-tighter text-white leading-none">COPY CHAT</span>
      </button>

      {/* Center: Pill Nav */}
      <div className="hidden md:flex items-center absolute left-1/2 -translate-x-1/2 bg-surface-container-low/60 backdrop-blur-xl rounded-full p-1 h-10">
        <ul className="flex items-stretch gap-0.5 h-full list-none m-0 p-0">
          {NAV_ITEMS.map((item, i) => (
            <li key={item.label} className="h-full">
              <button
                ref={(el) => { pillRefs.current[i] = el; }}
                onClick={() => navigate(item.path)}
                onMouseEnter={() => handleEnter(i)}
                onMouseLeave={() => handleLeave(i)}
                className="relative h-full px-5 rounded-full text-sm font-semibold overflow-hidden cursor-pointer flex items-center justify-center"
              >
                <span
                  ref={(el) => { circleRefs.current[i] = el; }}
                  className="absolute left-1/2 bottom-0 rounded-full bg-primary pointer-events-none"
                  style={{ willChange: 'transform' }}
                />
                <span className="relative z-10 inline-flex flex-col leading-none">
                  <span
                    ref={(el) => { labelRefs.current[i] = el; }}
                    className="inline-block text-on-surface-variant"
                    style={{ willChange: 'transform' }}
                  >
                    {item.label}
                  </span>
                  <span
                    ref={(el) => { hoverLabelRefs.current[i] = el; }}
                    className="absolute left-0 top-0 text-on-primary"
                    style={{ willChange: 'transform, opacity' }}
                  >
                    {item.label}
                  </span>
                </span>
              </button>
            </li>
          ))}
        </ul>
      </div>

      {/* Right: CTA — hide once user has characters */}
      {!hasCharacters && (
        <button
          onClick={() => navigate(hasLLM ? '/characters' : '/onboarding')}
          className="bg-primary text-on-primary px-5 py-2 rounded-md font-semibold text-sm hover:scale-[1.03] hover:shadow-md hover:shadow-primary/25 active:scale-95 transition-all shrink-0"
        >
          {hasLLM ? '创建角色' : '配置 AI'}
        </button>
      )}
    </nav>
  );
}
