import { useNavigate, useLocation } from 'react-router-dom';
import { motion } from 'motion/react';
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

/**
 * NavBar — Linear / Vercel style.
 * 极简：白色文字 + 1px 底部下划线，layoutId 在 tab 间平滑滑动。
 */
export default function NavBar({ variant = 'solid' }: NavBarProps) {
  const navigate = useNavigate();
  const location = useLocation();
  const hasLLM = !!useLLMStore((s) => s.getActiveConfig());
  const hasCharacters = useCharacterStore((s) => s.characters.length > 0);

  const activeIndex = NAV_ITEMS.findIndex((item) => location.pathname.startsWith(item.path));

  return (
    <nav
      className={`fixed top-0 left-0 right-0 z-50 h-16 flex justify-between items-center ${
        variant === 'glass'
          ? 'bg-black/30 backdrop-blur-2xl border-b border-white/[0.06]'
          : 'bg-[#0a0a0b]/85 backdrop-blur-xl border-b border-white/[0.06]'
      }`}
      style={{
        paddingLeft: 'max(2rem, calc((100vw - 80rem) / 2 + 2rem))',
        paddingRight: 'max(2rem, calc((100vw - 80rem) / 2 + 2rem))',
      }}
    >
      {/* ── Left: Logo + Brand ── */}
      <button
        onClick={() => navigate('/')}
        className="flex items-center gap-2.5 shrink-0 group"
      >
        <img
          src={logo}
          alt=""
          className="w-9 h-9 transition-transform duration-300 group-hover:scale-105"
        />
        <span
          className="text-[15px] font-medium tracking-[0.02em] text-white/90 leading-none"
          style={{ fontFeatureSettings: '"ss01" 1' }}
        >
          COPY CHAT
        </span>
      </button>

      {/* ── Center: Minimal tabs with sliding underline ── */}
      <ul className="hidden md:flex items-center gap-1 list-none m-0 p-0 absolute left-1/2 -translate-x-1/2">
        {NAV_ITEMS.map((item, i) => {
          const isActive = activeIndex === i;
          return (
            <li key={item.label} className="relative">
              <button
                onClick={() => navigate(item.path)}
                className={`relative px-4 py-2 text-[14px] transition-colors duration-200 ${
                  isActive
                    ? 'text-white'
                    : 'text-white/40 hover:text-white/70'
                }`}
                style={{ cursor: 'pointer' }}
              >
                {item.label}
                {isActive && (
                  <motion.div
                    layoutId="navbar-underline"
                    className="absolute left-2 right-2 bottom-0 h-px bg-white/80"
                    transition={{
                      type: 'spring',
                      stiffness: 500,
                      damping: 35,
                    }}
                  />
                )}
              </button>
            </li>
          );
        })}
      </ul>

      {/* ── Right: CTA — only when no characters ── */}
      {!hasCharacters && (
        <button
          onClick={() => navigate(hasLLM ? '/characters' : '/onboarding')}
          className="btn-primary shrink-0"
        >
          {hasLLM ? '创建角色' : '配置 AI'}
        </button>
      )}
    </nav>
  );
}
