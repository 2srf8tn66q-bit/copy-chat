import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowRight } from 'lucide-react';
import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import NavBar from '../components/layout/NavBar';
import { useLLMStore } from '../stores/llmStore';
import { ChatMockup, TimelineMockup, GroupChatMockup } from '../components/Mockups';
import TypewriterText from '../components/TypewriterText';
import ParticleCanvas from '../components/ParticleCanvas';
import GrainOverlay from '../components/GrainOverlay';
import FanCards from '../components/FanCards';

gsap.registerPlugin(ScrollTrigger);

export default function HomePage() {
  const navigate = useNavigate();
  const hasLLM = !!useLLMStore((s) => s.getActiveConfig());

  const featuresRef = useRef<HTMLDivElement>(null);
  const titleRef = useRef<HTMLDivElement>(null);
  const lineRef = useRef<HTMLDivElement>(null);
  const cardsRef = useRef<HTMLDivElement[]>([]);
  const ctaRef = useRef<HTMLDivElement>(null);
  const subtitleRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLDivElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  const [line1Done, setLine1Done] = useState(false);
  const [line2Done, setLine2Done] = useState(false);
  const [line3Done, setLine3Done] = useState(false);

  // Hero entrance
  useEffect(() => {
    const ctx = gsap.context(() => {
      gsap.fromTo(subtitleRef.current, { opacity: 0, y: 20 }, { opacity: 1, y: 0, duration: 1, ease: 'power2.out', delay: 3.5 });
      gsap.fromTo(buttonRef.current, { opacity: 0, y: 20 }, { opacity: 1, y: 0, duration: 0.8, ease: 'power2.out', delay: 4.5 });
      gsap.fromTo(scrollRef.current, { opacity: 0 }, { opacity: 1, duration: 1, delay: 5 });
      gsap.to(scrollRef.current, { y: 8, duration: 1.5, ease: 'power1.inOut', repeat: -1, yoyo: true });
    });
    return () => ctx.revert();
  }, []);

  // Features scroll animations
  useEffect(() => {
    const ctx = gsap.context(() => {
      gsap.fromTo(titleRef.current, { opacity: 0, y: 30 }, {
        opacity: 1, y: 0, duration: 1, ease: 'power2.out',
        scrollTrigger: { trigger: titleRef.current, start: 'top 80%' },
      });

      if (lineRef.current) {
        gsap.fromTo(lineRef.current, { scaleY: 0 }, {
          scaleY: 1, duration: 1.5, ease: 'power2.inOut',
          scrollTrigger: { trigger: featuresRef.current, start: 'top 60%' },
        });
      }

      cardsRef.current.forEach((card, i) => {
        if (!card) return;
        gsap.fromTo(card, { opacity: 0, x: i % 2 === 0 ? -40 : 40 }, {
          opacity: 1, x: 0, duration: 1, ease: 'power3.out',
          scrollTrigger: { trigger: card, start: 'top 80%' },
        });
      });

      gsap.fromTo(ctaRef.current, { opacity: 0, y: 30 }, {
        opacity: 1, y: 0, duration: 1, ease: 'power2.out',
        scrollTrigger: { trigger: ctaRef.current, start: 'top 80%' },
      });
    });
    return () => ctx.revert();
  }, []);

  return (
    <div className="bg-surface text-on-surface min-h-screen">
      <ParticleCanvas />
      <GrainOverlay />
      <NavBar variant="glass" />

      <main className="relative" style={{ zIndex: 2 }}>
        {/* ── Hero ── */}
        <section className="min-h-screen flex items-center px-8 md:px-16 lg:px-24 pt-16">
          <div className="max-w-[80rem] mx-auto w-full grid grid-cols-1 lg:grid-cols-12 gap-12 items-center">
            {/* Left: text — 7 cols */}
            <div className="lg:col-span-7">
              <h1 className="text-[clamp(2.5rem,7vw,6.5rem)] font-black leading-[0.95] tracking-tight mb-8">
                <TypewriterText text="还记得" speed={75} delay={800} onComplete={() => setLine1Done(true)} showCursor={!line1Done} />
                <br />
                {line1Done && (
                  <span className="font-light text-on-surface-variant">
                    <TypewriterText text="和 TA 聊天的" speed={75} delay={400} onComplete={() => setLine2Done(true)} showCursor={!line2Done} />
                  </span>
                )}
                {line1Done && <br />}
                {line2Done && (
                  <>
                    <TypewriterText text="最后一句吗" speed={90} delay={400} showCursor={!line3Done} onComplete={() => setLine3Done(true)} />
                    {line3Done && (
                      <span className="inline-block w-[3px] h-[0.7em] bg-primary align-middle ml-1 -translate-y-[0.05em]" style={{ animation: 'caret-blink 1.1s step-end infinite' }} />
                    )}
                  </>
                )}
              </h1>

              <div ref={subtitleRef} className="opacity-0">
                <p className="text-base md:text-lg text-on-surface-variant max-w-md leading-relaxed mb-10 font-light">
                  导入聊天记录，AI 学习 TA 的说话方式。<br />继续聊天，或回到某个瞬间重新来过。
                </p>
              </div>

              <div ref={buttonRef} className="opacity-0">
                <button
                  onClick={() => navigate(hasLLM ? '/characters' : '/onboarding')}
                  className="group inline-flex items-center gap-2 bg-primary text-on-primary px-7 py-3 rounded-full text-sm font-semibold hover:scale-[1.04] active:scale-95 transition-transform"
                  style={{ animation: 'btn-glow 3s ease-in-out infinite' }}
                >
                  {hasLLM ? '创建角色' : '开始'}
                  <ArrowRight size={14} className="group-hover:translate-x-2 transition-transform duration-300 ease-[cubic-bezier(0.34,1.56,0.64,1)]" />
                </button>
              </div>
            </div>

            {/* Right: SVG animation — 5 cols */}
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

          {/* Scroll indicator */}
          <div ref={scrollRef} className="absolute bottom-8 left-1/2 -translate-x-1/2 opacity-0">
            <div className="flex flex-col items-center gap-2">
              <span className="text-[11px] text-on-surface-variant/30 tracking-widest uppercase">Scroll</span>
              <div className="w-[1px] h-8 bg-gradient-to-b from-on-surface-variant/30 to-transparent" />
            </div>
          </div>
        </section>

        {/* ── Features: 三种与记忆相处的方式 ── */}
        <section ref={featuresRef} className="relative py-32 md:py-40">
          <div className="max-w-[1200px] mx-auto px-6 md:px-12">
            <div ref={titleRef} className="mb-24 md:mb-32 opacity-0">
              <span className="text-[11px] tracking-[0.3em] text-on-surface-variant/40 uppercase block mb-4">Core Features</span>
              <h2 className="text-[clamp(2rem,4vw,3rem)] leading-tight">三种与记忆相处的方式</h2>
            </div>

            <div className="relative">
              {/* Vertical timeline line */}
              <div
                ref={lineRef}
                className="absolute left-[50%] top-0 w-[1px] h-full bg-[#2a2a2a] origin-top hidden md:block"
              />

              <div className="space-y-20 md:space-y-32">
                {/* Feature 1: 继续聊天 */}
                <div
                  ref={(el) => { if (el) cardsRef.current[0] = el; }}
                  className="grid grid-cols-1 md:grid-cols-2 gap-8 md:gap-16 items-center opacity-0"
                >
                  <div>
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
                    <span className="text-[64px] md:text-[80px] leading-none block mb-4 text-on-surface-variant/10">01</span>
                    <h3 className="text-[24px] md:text-[28px] mb-2">继续聊天</h3>
                    <p className="text-[14px] md:text-[15px] text-on-surface-variant leading-[1.9] max-w-[420px]">
                      和平时一样发消息。TA 的语气、口头禅、回复节奏，都从真实聊天记录中学来。
                    </p>
                  </div>
                  <div className="flex justify-center">
                    <ChatMockup />
                  </div>
                </div>

                {/* Feature 2: IF 线 */}
                <div
                  ref={(el) => { if (el) cardsRef.current[1] = el; }}
                  className="grid grid-cols-1 md:grid-cols-2 gap-8 md:gap-16 items-center opacity-0"
                >
                  <div className="flex justify-center">
                    <TimelineMockup />
                  </div>
                  <div>
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
                    <span className="text-[64px] md:text-[80px] leading-none block mb-4 text-on-surface-variant/10">02</span>
                    <h3 className="text-[24px] md:text-[28px] mb-2">IF 线</h3>
                    <p className="text-[14px] md:text-[15px] text-on-surface-variant leading-[1.9] max-w-[420px]">
                      回到过去某一天，重新经历那些对话。这次你可以说不同的话，看看会怎样。
                    </p>
                  </div>
                </div>

                {/* Feature 3: 群聊 */}
                <div
                  ref={(el) => { if (el) cardsRef.current[2] = el; }}
                  className="grid grid-cols-1 md:grid-cols-2 gap-8 md:gap-16 items-center opacity-0"
                >
                  <div>
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
                    <span className="text-[64px] md:text-[80px] leading-none block mb-4 text-on-surface-variant/10">03</span>
                    <h3 className="text-[24px] md:text-[28px] mb-2">群聊</h3>
                    <p className="text-[14px] md:text-[15px] text-on-surface-variant leading-[1.9] max-w-[420px]">
                      把几个角色拉到一个群里。看他们像真人一样聊天、互怼、分享日常。
                    </p>
                  </div>
                  <div className="flex justify-center">
                    <GroupChatMockup />
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* ── CTA ── */}
        <section ref={ctaRef} className="min-h-[60vh] flex items-center justify-center px-8 opacity-0">
          <div className="text-center">
            <h2 className="text-3xl md:text-5xl tracking-tight mb-4">试试看</h2>
            <p className="text-on-surface-variant text-sm mb-10 font-light">三步，开始对话。</p>
            <FanCards />
            <button
              onClick={() => navigate(hasLLM ? '/characters' : '/onboarding')}
              className="group inline-flex items-center gap-2 bg-primary text-on-primary px-8 py-3 rounded-full text-sm font-semibold hover:scale-[1.04] active:scale-95 transition-transform"
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
      <footer className="w-full py-8 border-t border-outline-variant/30 bg-surface relative" style={{ zIndex: 2 }}>
        <div className="max-w-[80rem] mx-auto flex flex-col md:flex-row justify-between items-center px-8 md:px-16 lg:px-24 space-y-4 md:space-y-0">
          <div className="text-[11px] text-on-surface-variant/40">&copy; 2026 Copy Chat</div>
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
