import { useNavigate } from 'react-router-dom';
import { ArrowRight } from 'lucide-react';
import Aurora from '../components/Aurora';
import NavBar from '../components/layout/NavBar';
import { useLLMStore } from '../stores/llmStore';
import { ChatMockup, TimelineMockup, GroupChatMockup } from '../components/Mockups';
import SplitText from '../components/SplitText';
import FanCards from '../components/FanCards';

export default function HomePage() {
  const navigate = useNavigate();
  const hasLLM = !!useLLMStore((s) => s.getActiveConfig());

  return (
    <div className="bg-surface text-on-surface min-h-screen">
      <NavBar variant="glass" />

      {/* Aurora */}
      <div className="fixed inset-0 -top-[30vh] -bottom-[30vh] opacity-40 z-0">
        <Aurora colorStops={['#022c22', '#064e3b', '#0DB152']} amplitude={1.0} blend={0.5} speed={0.8} />
      </div>

      <main className="relative z-10">
        {/* Hero — full screen, asymmetric */}
        <section className="min-h-screen flex items-center px-8 md:px-16 lg:px-24 pt-16">
          <div className="max-w-[80rem] mx-auto w-full grid grid-cols-1 lg:grid-cols-12 gap-12 items-center">
            {/* Left: text — occupies 7 cols */}
            <div className="lg:col-span-7">
              <p className="text-xs font-medium tracking-[0.3em] uppercase text-primary mb-8 font-['DM_Sans']">Copy Chat</p>
              <h1 className="text-[clamp(2.5rem,7vw,6.5rem)] font-black leading-[0.95] tracking-tight mb-8">
                还记得<br />
                <span className="text-on-surface-variant font-light">和 TA 聊天的</span><br />
                最后一句吗
                <span className="inline-block w-[3px] h-[0.7em] bg-primary align-middle ml-1 -translate-y-[0.05em]" style={{ animation: 'caret-blink 1.1s step-end infinite' }} />
              </h1>
              <p className="text-base md:text-lg text-on-surface-variant max-w-md leading-relaxed mb-10 font-light">
                导入聊天记录，AI 学习 TA 的说话方式。<br />继续聊天，或回到某个瞬间重新来过。
              </p>
              <button
                onClick={() => navigate(hasLLM ? '/characters' : '/onboarding')}
                className="group inline-flex items-center gap-2 bg-primary text-on-primary px-7 py-3 rounded-full text-sm font-semibold hover:scale-[1.04] active:scale-95 transition-transform"
                style={{ animation: 'btn-glow 3s ease-in-out infinite' }}
              >
                {hasLLM ? '创建角色' : '开始'}
                <ArrowRight size={14} className="group-hover:translate-x-2 transition-transform duration-300 ease-[cubic-bezier(0.34,1.56,0.64,1)]" />
              </button>
              {hasLLM && (
                <p className="text-[11px] text-on-surface-variant/50 mt-12 font-light">所有数据只存在你的浏览器里</p>
              )}
            </div>

            {/* Right: SVG animation — occupies 5 cols */}
            <div className="lg:col-span-5 flex justify-center lg:justify-end">
              <div className="w-64 h-64 md:w-80 md:h-80">
                <svg viewBox="0 0 240 240" className="w-full h-full overflow-visible">
                  <g style={{ animation: 'pulse-halo 6s ease-in-out infinite', transformOrigin: 'center', transformBox: 'fill-box' }}>
                    <circle cx="120" cy="140" r="90" stroke="rgba(255,255,255,0.12)" strokeWidth="1.5" fill="none" strokeDasharray="6 8" />
                    <circle cx="120" cy="140" r="115" stroke="rgba(255,255,255,0.04)" strokeWidth="1" fill="none" />
                  </g>
                  <g style={{ animation: 'float-phone 5s ease-in-out infinite', transformOrigin: 'center' }}>
                    <g transform="rotate(8 120 160)">
                      <rect x="80" y="85" width="80" height="155" rx="14" fill="#1a1a1a" stroke="#ffffff" strokeWidth="1.5" />
                      <rect x="87" y="92" width="66" height="141" rx="8" fill="none" stroke="rgba(255,255,255,0.15)" strokeWidth="1" />
                      <line x1="108" y1="102" x2="132" y2="102" stroke="#ffffff" strokeWidth="2" strokeLinecap="round" />
                      <g opacity="0.5">
                        <rect x="94" y="120" width="30" height="5" rx="2.5" fill="rgba(255,255,255,0.4)" />
                        <rect x="114" y="132" width="32" height="5" rx="2.5" fill="#0DB152" />
                        <rect x="94" y="144" width="45" height="5" rx="2.5" fill="rgba(255,255,255,0.4)" />
                      </g>
                      <rect x="156" y="115" width="13" height="24" rx="6.5" fill="#1a1a1a" stroke="#ffffff" strokeWidth="1.5" />
                      <rect x="158" y="145" width="13" height="24" rx="6.5" fill="#1a1a1a" stroke="#ffffff" strokeWidth="1.5" />
                      <rect x="157" y="175" width="13" height="24" rx="6.5" fill="#1a1a1a" stroke="#ffffff" strokeWidth="1.5" />
                      <rect x="62" y="145" width="22" height="60" rx="11" transform="rotate(35 74 177)" fill="#1a1a1a" stroke="#ffffff" strokeWidth="1.5" />
                      <path d="M 66 175 Q 74 178, 82 175" transform="rotate(35 74 177)" stroke="rgba(255,255,255,0.3)" strokeWidth="1" fill="none" strokeLinecap="round" />
                      <path d="M 70 195 C 65 215, 65 240, 65 240" fill="none" stroke="#ffffff" strokeWidth="1.5" strokeLinecap="round" />
                    </g>
                  </g>
                  <g style={{ animation: 'float-chat-left 6.5s ease-in-out infinite', transformOrigin: 'center' }}>
                    <rect x="25" y="45" width="85" height="40" rx="10" fill="rgba(255,255,255,0.06)" stroke="rgba(255,255,255,0.15)" strokeWidth="1" />
                    <line x1="40" y1="57" x2="95" y2="57" stroke="rgba(255,255,255,0.3)" strokeWidth="3" strokeLinecap="round" />
                    <line x1="40" y1="70" x2="75" y2="70" stroke="rgba(255,255,255,0.3)" strokeWidth="3" strokeLinecap="round" />
                  </g>
                  <g style={{ animation: 'float-chat-right 4.5s ease-in-out infinite', transformOrigin: 'center' }}>
                    <rect x="120" y="10" width="95" height="40" rx="10" fill="#0DB152" opacity="0.9" />
                    <line x1="135" y1="23" x2="200" y2="23" stroke="#ffffff" strokeWidth="3" strokeLinecap="round" opacity="0.85" />
                    <line x1="135" y1="36" x2="175" y2="36" stroke="#ffffff" strokeWidth="3" strokeLinecap="round" opacity="0.85" />
                  </g>
                  <g style={{ animation: 'spin-star 3s ease-in-out infinite', transformOrigin: 'center', transformBox: 'fill-box' }}>
                    <circle cx="215" cy="15" r="3" fill="#0DB152" opacity="0.7" />
                    <circle cx="228" cy="28" r="1.5" fill="#0DB152" opacity="0.5" />
                  </g>
                </svg>
              </div>
            </div>
          </div>
        </section>

        {/* Feature 1: 聊天 */}
        <section className="min-h-screen flex items-center px-8 md:px-16 lg:px-24">
          <div className="max-w-[80rem] mx-auto w-full grid grid-cols-1 lg:grid-cols-12 gap-12 items-start pt-[18vh]">
            <div className="lg:col-span-5">
              <div className="w-48 h-48 mb-8">
                <svg viewBox="0 0 240 240" className="w-full h-full overflow-visible">
                  <g style={{ animation: 'float-up 6s ease-in-out infinite' }}>
                    <rect x="30" y="80" width="56" height="72" rx="6" stroke="#ffffff" strokeWidth="2" fill="none" strokeLinecap="round" strokeLinejoin="round" strokeDasharray="100" strokeDashoffset="100" pathLength={100} style={{ animation: 'draw-1 7s ease-in-out infinite' }} />
                    <line x1="44" y1="100" x2="72" y2="100" stroke="#ffffff" strokeWidth="2" fill="none" strokeLinecap="round" strokeLinejoin="round" strokeDasharray="100" strokeDashoffset="100" pathLength={100} style={{ animation: 'draw-1 7s ease-in-out infinite' }} />
                    <line x1="44" y1="116" x2="72" y2="116" stroke="#ffffff" strokeWidth="2" fill="none" strokeLinecap="round" strokeLinejoin="round" strokeDasharray="100" strokeDashoffset="100" pathLength={100} style={{ animation: 'draw-1 7s ease-in-out infinite' }} />
                    <line x1="44" y1="132" x2="58" y2="132" stroke="#ffffff" strokeWidth="2" fill="none" strokeLinecap="round" strokeLinejoin="round" strokeDasharray="100" strokeDashoffset="100" pathLength={100} style={{ animation: 'draw-1 7s ease-in-out infinite' }} />
                  </g>
                  <g>
                    <path d="M 98 116 Q 118 116, 126 95 T 142 95" stroke="#ffffff" strokeWidth="2" fill="none" strokeLinecap="round" strokeLinejoin="round" strokeDasharray="2 4" strokeDashoffset="100" pathLength={100} style={{ animation: 'draw-2 7s ease-in-out infinite' }} />
                    <path d="M 134 87 L 144 95 L 134 103" stroke="#ffffff" strokeWidth="2" fill="none" strokeLinecap="round" strokeLinejoin="round" strokeDasharray="100" strokeDashoffset="100" pathLength={100} style={{ animation: 'draw-2 7s ease-in-out infinite' }} />
                  </g>
                  <g style={{ animation: 'float-down 5s ease-in-out infinite' }}>
                    <rect x="150" y="70" width="66" height="52" rx="12" stroke="#ffffff" strokeWidth="2" fill="none" strokeLinecap="round" strokeLinejoin="round" strokeDasharray="100" strokeDashoffset="100" pathLength={100} style={{ animation: 'draw-3 7s ease-in-out infinite' }} />
                    <path d="M 160 122 L 160 134 L 172 122" stroke="#ffffff" strokeWidth="2" fill="none" strokeLinecap="round" strokeLinejoin="round" strokeDasharray="100" strokeDashoffset="100" pathLength={100} style={{ animation: 'draw-3 7s ease-in-out infinite' }} />
                    <path d="M 183 83 Q 183 90, 176 90 Q 183 90, 183 97 Q 183 90, 190 90 Q 183 90, 183 83" fill="#0DB152" style={{ animation: 'pop-in 7s cubic-bezier(0.175, 0.885, 0.32, 1.275) infinite', transformOrigin: 'center', transformBox: 'fill-box' }} />
                  </g>
                </svg>
              </div>
              <p className="text-xs font-medium tracking-[0.25em] uppercase text-on-surface-variant/60 mb-6 font-['DM_Sans']">01</p>
              <h2 className="text-4xl md:text-5xl font-black tracking-tight leading-[1.05] mb-6">
                <SplitText text="继续聊天" splitBy="chars" delay={40} />
              </h2>
              <p className="text-base text-on-surface-variant leading-relaxed max-w-sm font-light">
                和平时一样发消息。TA 的语气、口头禅、回复节奏，都从真实聊天记录中学来。
              </p>
            </div>
            <div className="lg:col-span-6 lg:col-start-7 flex justify-center">
              <ChatMockup />
            </div>
          </div>
        </section>

        {/* Feature 2: IF 线 */}
        <section className="min-h-screen flex items-center px-8 md:px-16 lg:px-24">
          <div className="max-w-[80rem] mx-auto w-full grid grid-cols-1 lg:grid-cols-12 gap-12 items-start pt-[18vh]">
            <div className="lg:col-span-5 flex justify-center">
              <TimelineMockup />
            </div>
            <div className="lg:col-span-6 lg:col-start-7">
              <div className="w-48 h-48 mb-8">
                <svg viewBox="0 0 240 240" className="w-full h-full overflow-visible">
                  <g style={{ animation: 'float-up 6s ease-in-out infinite' }}>
                    <path d="M 30 190 Q 90 190, 110 130 T 190 90" stroke="#ffffff" strokeWidth="2" fill="none" strokeLinecap="round" strokeLinejoin="round" strokeDasharray="100" strokeDashoffset="100" pathLength={100} style={{ animation: 'draw-1 7s ease-in-out infinite' }} />
                    <circle cx="110" cy="130" r="16" stroke="#ffffff" strokeWidth="2" fill="#1a1a1c" strokeLinecap="round" strokeLinejoin="round" strokeDasharray="100" strokeDashoffset="100" pathLength={100} style={{ animation: 'draw-1 7s ease-in-out infinite' }} />
                    <path d="M 104 125 A 6 6 0 1 0 110 122 L 106 118" stroke="#ffffff" strokeWidth="2" fill="none" strokeLinecap="round" strokeLinejoin="round" strokeDasharray="100" strokeDashoffset="100" pathLength={100} style={{ animation: 'draw-2 7s ease-in-out infinite' }} />
                    <path d="M 110 114 Q 110 50, 170 40" stroke="#0DB152" strokeWidth="3" fill="none" strokeLinecap="round" strokeLinejoin="round" strokeDasharray="100" strokeDashoffset="100" pathLength={100} style={{ animation: 'draw-3 7s ease-in-out infinite' }} />
                    <line x1="170" y1="40" x2="210" y2="40" stroke="#0DB152" strokeWidth="3" fill="none" strokeLinecap="round" strokeLinejoin="round" strokeDasharray="4 4" strokeDashoffset="100" pathLength={100} style={{ animation: 'draw-3 7s ease-in-out infinite' }} />
                    <circle cx="170" cy="40" r="5" fill="#0DB152" style={{ animation: 'pop-in 7s cubic-bezier(0.175, 0.885, 0.32, 1.275) infinite', transformOrigin: 'center', transformBox: 'fill-box' }} />
                  </g>
                </svg>
              </div>
              <p className="text-xs font-medium tracking-[0.25em] uppercase text-on-surface-variant/60 mb-6 font-['DM_Sans']">02</p>
              <h2 className="text-4xl md:text-5xl font-black tracking-tight leading-[1.05] mb-6">
                <SplitText text="IF 线" splitBy="chars" delay={50} />
              </h2>
              <p className="text-base text-on-surface-variant leading-relaxed max-w-sm font-light">
                回到过去某一天，重新经历那些对话。这次你可以说不同的话，看看会怎样。
              </p>
            </div>
          </div>
        </section>

        {/* Feature 3: 群聊 */}
        <section className="min-h-screen flex items-center px-8 md:px-16 lg:px-24">
          <div className="max-w-[80rem] mx-auto w-full grid grid-cols-1 lg:grid-cols-12 gap-12 items-start pt-[18vh]">
            <div className="lg:col-span-5">
              <div className="w-48 h-48 mb-8">
                <svg viewBox="0 0 240 240" className="w-full h-full overflow-visible">
                  <g style={{ animation: 'float-down 5s ease-in-out infinite' }}>
                    <circle cx="45" cy="55" r="10" stroke="#ffffff" strokeWidth="2" fill="none" strokeLinecap="round" strokeLinejoin="round" strokeDasharray="100" strokeDashoffset="100" pathLength={100} style={{ animation: 'draw-1 7s ease-in-out infinite' }} />
                    <path d="M 30 80 Q 45 68, 60 80" stroke="#ffffff" strokeWidth="2" fill="none" strokeLinecap="round" strokeLinejoin="round" strokeDasharray="100" strokeDashoffset="100" pathLength={100} style={{ animation: 'draw-1 7s ease-in-out infinite' }} />
                    <circle cx="55" cy="185" r="10" stroke="#ffffff" strokeWidth="2" fill="none" strokeLinecap="round" strokeLinejoin="round" strokeDasharray="100" strokeDashoffset="100" pathLength={100} style={{ animation: 'draw-1 7s ease-in-out infinite' }} />
                    <path d="M 40 210 Q 55 198, 70 210" stroke="#ffffff" strokeWidth="2" fill="none" strokeLinecap="round" strokeLinejoin="round" strokeDasharray="100" strokeDashoffset="100" pathLength={100} style={{ animation: 'draw-1 7s ease-in-out infinite' }} />
                    <circle cx="205" cy="140" r="10" stroke="#ffffff" strokeWidth="2" fill="none" strokeLinecap="round" strokeLinejoin="round" strokeDasharray="100" strokeDashoffset="100" pathLength={100} style={{ animation: 'draw-1 7s ease-in-out infinite' }} />
                    <path d="M 190 165 Q 205 153, 220 165" stroke="#ffffff" strokeWidth="2" fill="none" strokeLinecap="round" strokeLinejoin="round" strokeDasharray="100" strokeDashoffset="100" pathLength={100} style={{ animation: 'draw-1 7s ease-in-out infinite' }} />
                  </g>
                  <g>
                    <line x1="60" y1="75" x2="90" y2="95" stroke="#ffffff" strokeWidth="2" fill="none" strokeLinecap="round" strokeLinejoin="round" strokeDasharray="3 4" strokeDashoffset="100" pathLength={100} style={{ animation: 'draw-2 7s ease-in-out infinite' }} />
                    <line x1="70" y1="175" x2="95" y2="150" stroke="#ffffff" strokeWidth="2" fill="none" strokeLinecap="round" strokeLinejoin="round" strokeDasharray="3 4" strokeDashoffset="100" pathLength={100} style={{ animation: 'draw-2 7s ease-in-out infinite' }} />
                    <line x1="185" y1="140" x2="160" y2="125" stroke="#ffffff" strokeWidth="2" fill="none" strokeLinecap="round" strokeLinejoin="round" strokeDasharray="3 4" strokeDashoffset="100" pathLength={100} style={{ animation: 'draw-2 7s ease-in-out infinite' }} />
                  </g>
                  <g style={{ animation: 'float-up 6s ease-in-out infinite' }}>
                    <rect x="85" y="80" width="80" height="60" rx="14" stroke="#ffffff" strokeWidth="2" fill="#1a1a1c" strokeLinecap="round" strokeLinejoin="round" strokeDasharray="100" strokeDashoffset="100" pathLength={100} style={{ animation: 'draw-3 7s ease-in-out infinite' }} />
                    <path d="M 115 140 L 115 152 L 130 140" stroke="#ffffff" strokeWidth="2" fill="#1a1a1c" strokeLinecap="round" strokeLinejoin="round" strokeDasharray="100" strokeDashoffset="100" pathLength={100} style={{ animation: 'draw-3 7s ease-in-out infinite' }} />
                    <circle cx="105" cy="110" r="4" fill="#0DB152" style={{ animation: 'pop-in 7s cubic-bezier(0.175, 0.885, 0.32, 1.275) 0.1s infinite', transformOrigin: 'center', transformBox: 'fill-box' }} />
                    <circle cx="125" cy="110" r="4" fill="#0DB152" style={{ animation: 'pop-in 7s cubic-bezier(0.175, 0.885, 0.32, 1.275) 0.2s infinite', transformOrigin: 'center', transformBox: 'fill-box' }} />
                    <circle cx="145" cy="110" r="4" fill="#0DB152" style={{ animation: 'pop-in 7s cubic-bezier(0.175, 0.885, 0.32, 1.275) 0.3s infinite', transformOrigin: 'center', transformBox: 'fill-box' }} />
                  </g>
                </svg>
              </div>
              <p className="text-xs font-medium tracking-[0.25em] uppercase text-on-surface-variant/60 mb-6 font-['DM_Sans']">03</p>
              <h2 className="text-4xl md:text-5xl font-black tracking-tight leading-[1.05] mb-6">
                <SplitText text="群聊" splitBy="chars" delay={60} />
              </h2>
              <p className="text-base text-on-surface-variant leading-relaxed max-w-sm font-light">
                把几个角色拉到一个群里。看他们像真人一样聊天、互怼、分享日常。
              </p>
            </div>
            <div className="lg:col-span-6 lg:col-start-7 flex justify-center">
              <GroupChatMockup />
            </div>
          </div>
        </section>

        {/* CTA */}
        <section className="min-h-[60vh] flex items-center justify-center px-8">
          <div className="text-center">
            <h2 className="text-3xl md:text-5xl font-black tracking-tight mb-4">试试看</h2>
            <p className="text-on-surface-variant text-sm mb-10 font-light">三步，开始对话。</p>
            <FanCards />
            <button
              onClick={() => navigate(hasLLM ? '/characters' : '/onboarding')}
              className="group inline-flex items-center gap-2 bg-primary text-on-primary px-8 py-3 rounded-full text-sm font-semibold hover:scale-[1.04] active:scale-95 transition-transform font-['DM_Sans']"
              style={{ animation: 'btn-glow 3s ease-in-out infinite' }}
            >
              {hasLLM ? '创建角色' : '开始创建角色'}
              <ArrowRight size={14} className="group-hover:translate-x-2 transition-transform duration-300 ease-[cubic-bezier(0.34,1.56,0.64,1)]" />
            </button>
            {!hasLLM && (
              <p className="text-[11px] text-on-surface-variant/40 mt-6">点击开始，前往配置 API 接口</p>
            )}
          </div>
        </section>
      </main>

      {/* Footer */}
      <footer className="w-full py-8 border-t border-outline-variant/30 bg-surface relative z-10">
        <div className="max-w-[80rem] mx-auto flex flex-col md:flex-row justify-between items-center px-8 md:px-16 lg:px-24 space-y-4 md:space-y-0">
          <div className="text-[11px] text-on-surface-variant/40 font-['DM_Sans']">© 2026 Copy Chat</div>
          <div className="flex space-x-8">
            <span className="text-[11px] text-on-surface-variant/40">隐私</span>
            <span className="text-[11px] text-on-surface-variant/40">条款</span>
            <span className="text-[11px] text-on-surface-variant/40">帮助</span>
          </div>
        </div>
      </footer>
    </div>
  );
}
