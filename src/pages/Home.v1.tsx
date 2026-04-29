import { useNavigate } from 'react-router-dom';
import { ArrowRight, MessageCircle, GitBranch, Users } from 'lucide-react';
import Aurora from '../components/Aurora';
import NavBar from '../components/layout/NavBar';
import BlurText from '../components/BlurText';
import { useLLMStore } from '../stores/llmStore';

export default function HomePage() {
  const navigate = useNavigate();
  const hasLLM = !!useLLMStore((s) => s.getActiveConfig());

  return (
    <div className="bg-surface text-on-surface min-h-screen">
      <NavBar variant="glass" />

      {/* Aurora - full viewport behind nav */}
      <div className="fixed inset-0 -top-[30vh] -bottom-[30vh] opacity-50 z-0">
        <Aurora colorStops={['#022c22', '#065f46', '#34d399']} amplitude={1.0} blend={0.5} speed={0.8} />
      </div>

      <main className="relative z-10 pt-16">
        {/* Hero */}
        <section className="relative min-h-[80vh] flex flex-col justify-center px-8">
          <div className="max-w-3xl mx-auto w-full text-center py-20">
            {/* Phone chat animation */}
            <div className="w-48 h-48 mx-auto mb-8">
              <svg viewBox="0 0 240 240" className="w-full h-full overflow-visible">
                <g style={{ animation: 'pulse-halo 6s ease-in-out infinite', transformOrigin: 'center', transformBox: 'fill-box' }}>
                  <circle cx="120" cy="140" r="90" stroke="rgba(255,255,255,0.15)" strokeWidth="1.5" fill="none" strokeDasharray="6 8" />
                  <circle cx="120" cy="140" r="115" stroke="rgba(255,255,255,0.05)" strokeWidth="1" fill="none" />
                </g>
                <g style={{ animation: 'float-phone 5s ease-in-out infinite', transformOrigin: 'center' }}>
                  <g transform="rotate(8 120 160)">
                    <rect x="80" y="85" width="80" height="155" rx="14" fill="#1a1a1a" stroke="#ffffff" strokeWidth="2" />
                    <rect x="87" y="92" width="66" height="141" rx="8" fill="none" stroke="rgba(255,255,255,0.2)" strokeWidth="1.5" />
                    <line x1="108" y1="102" x2="132" y2="102" stroke="#ffffff" strokeWidth="2.5" strokeLinecap="round" />
                    <g opacity="0.6">
                      <rect x="94" y="120" width="30" height="6" rx="3" fill="rgba(255,255,255,0.5)" />
                      <rect x="114" y="132" width="32" height="6" rx="3" fill="#34d399" />
                      <rect x="94" y="144" width="45" height="6" rx="3" fill="rgba(255,255,255,0.5)" />
                    </g>
                    <rect x="156" y="115" width="14" height="26" rx="7" fill="#1a1a1a" stroke="#ffffff" strokeWidth="2" />
                    <rect x="158" y="145" width="14" height="26" rx="7" fill="#1a1a1a" stroke="#ffffff" strokeWidth="2" />
                    <rect x="157" y="175" width="14" height="26" rx="7" fill="#1a1a1a" stroke="#ffffff" strokeWidth="2" />
                    <rect x="62" y="145" width="24" height="65" rx="12" transform="rotate(35 74 177)" fill="#1a1a1a" stroke="#ffffff" strokeWidth="2" />
                    <path d="M 66 175 Q 74 178, 82 175" transform="rotate(35 74 177)" stroke="rgba(255,255,255,0.4)" strokeWidth="1.5" fill="none" strokeLinecap="round" />
                    <path d="M 70 195 C 65 215, 65 240, 65 240" fill="none" stroke="#ffffff" strokeWidth="2" strokeLinecap="round" />
                    <path d="M 125 240 L 125 245" fill="none" stroke="#ffffff" strokeWidth="2" strokeLinecap="round" />
                  </g>
                </g>
                <g style={{ animation: 'float-chat-left 6.5s ease-in-out infinite', transformOrigin: 'center' }}>
                  <rect x="25" y="45" width="85" height="44" rx="12" fill="#1a1a1a" stroke="#ffffff" strokeWidth="2" />
                  <path d="M 35 88 Q 25 100, 15 102 Q 25 90, 30 75" fill="#1a1a1a" stroke="#ffffff" strokeWidth="2" strokeLinejoin="round" />
                  <line x1="40" y1="58" x2="95" y2="58" stroke="rgba(255,255,255,0.4)" strokeWidth="4" strokeLinecap="round" />
                  <line x1="40" y1="72" x2="75" y2="72" stroke="rgba(255,255,255,0.4)" strokeWidth="4" strokeLinecap="round" />
                </g>
                <g style={{ animation: 'float-chat-right 4.5s ease-in-out infinite', transformOrigin: 'center' }}>
                  <rect x="120" y="10" width="95" height="44" rx="12" fill="#34d399" />
                  <path d="M 205 52 Q 215 65, 225 67 Q 215 55, 210 40" fill="#34d399" />
                  <line x1="135" y1="23" x2="200" y2="23" stroke="#ffffff" strokeWidth="4" strokeLinecap="round" opacity="0.9" />
                  <line x1="135" y1="37" x2="175" y2="37" stroke="#ffffff" strokeWidth="4" strokeLinecap="round" opacity="0.9" />
                </g>
                <g style={{ animation: 'spin-star 3s ease-in-out infinite', transformOrigin: 'center', transformBox: 'fill-box' }}>
                  <circle cx="215" cy="15" r="4" fill="#34d399" />
                  <circle cx="228" cy="28" r="2" fill="#34d399" />
                  <path d="M 20 40 Q 30 40, 30 30 Q 30 40, 40 40 Q 30 40, 30 50 Q 30 40, 20 40" fill="#ffffff" />
                </g>
              </svg>
            </div>
            <h1 className="text-4xl md:text-6xl font-extrabold text-on-surface tracking-tight leading-tight mb-6">
              你还记得上次<br/>和 TA 聊天是什么时候吗？<span className="inline-block w-[3px] h-[0.85em] bg-primary align-middle -translate-y-[0.09em] -translate-x-[6px]" style={{ animation: 'caret-blink 1.1s step-end infinite' }} />
            </h1>
            <p className="text-lg md:text-xl text-on-surface-variant max-w-lg mx-auto leading-relaxed mb-10">
              导入聊天记录，让 TA 的说话方式、语气、口头禅都被记住。<br/>
              你可以继续和 TA 聊天，也可以回到过去某个瞬间，重新来一次。
            </p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <button onClick={() => navigate(hasLLM ? '/characters' : '/onboarding')} className="bg-primary text-on-primary px-8 py-4 rounded-md font-bold text-base shadow-lg active:scale-95 transition-transform flex items-center justify-center gap-2">
                开始创建角色
                <ArrowRight size={18} />
              </button>
            </div>
            {!hasLLM && (
              <p className="text-xs text-secondary mt-4">点击开始，前往配置 API 接口</p>
            )}
            {hasLLM && (
              <p className="text-xs text-on-surface-variant mt-6">所有数据只存在你的浏览器里，不会上传到任何服务器</p>
            )}
          </div>
        </section>

        {/* Features */}
        <section className="py-24 px-8 bg-surface-container-low">
          <div className="max-w-5xl mx-auto">
            <div className="mb-16 max-w-xl">
              <BlurText text="你能做什么" className="text-3xl font-extrabold tracking-tight mb-4" animateBy="chars" delay={60} />
              <BlurText text="三种方式，和记忆里的人重新对话。" className="text-on-surface-variant text-lg" animateBy="chars" delay={30} />
            </div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
              <div className="bg-surface-container-lowest p-10 rounded-xl">
                <div className="w-12 h-12 rounded-lg bg-primary/10 flex items-center justify-center text-primary mb-6">
                  <MessageCircle size={24} />
                </div>
                <h3 className="text-xl font-bold mb-3">继续聊天</h3>
                <p className="text-on-surface-variant leading-relaxed text-sm">像平常一样和 TA 发消息。TA 的语气、口头禅、回复节奏都和真人一样。</p>
              </div>
              <div className="bg-surface-container-lowest p-10 rounded-xl">
                <div className="w-12 h-12 rounded-lg bg-secondary/10 flex items-center justify-center text-secondary mb-6">
                  <GitBranch size={24} />
                </div>
                <h3 className="text-xl font-bold mb-3">IF 线</h3>
                <p className="text-on-surface-variant leading-relaxed text-sm">回到过去某一天，重新经历那些对话。这次你可以说不同的话，看看会发生什么。</p>
              </div>
              <div className="bg-surface-container-lowest p-10 rounded-xl">
                <div className="w-12 h-12 rounded-lg bg-tertiary/10 flex items-center justify-center text-tertiary mb-6">
                  <Users size={24} />
                </div>
                <h3 className="text-xl font-bold mb-3">群聊</h3>
                <p className="text-on-surface-variant leading-relaxed text-sm">把几个角色拉到一个群里，看他们像真人一样聊天、互怼、分享日常。</p>
              </div>
            </div>
          </div>
        </section>

        {/* Steps */}
        <section className="py-24 px-8 bg-surface">
          <div className="max-w-4xl mx-auto">
            <div className="mb-16 max-w-xl">
              <BlurText text="怎么开始" className="text-3xl font-extrabold tracking-tight mb-4" animateBy="chars" delay={60} />
            </div>
            <div className="flex flex-col gap-12">
              <div className="flex gap-6 items-start">
                <div className="w-10 h-10 rounded-full bg-primary text-on-primary flex items-center justify-center font-bold text-sm shrink-0">1</div>
                <div>
                  <h3 className="font-bold text-lg mb-2">配置 AI 接口</h3>
                  <p className="text-on-surface-variant text-sm leading-relaxed">选择一个大模型服务商，填入 API Key。用于生成角色画像和驱动对话。</p>
                </div>
              </div>
              <div className="flex gap-6 items-start">
                <div className="w-10 h-10 rounded-full bg-surface-container-high text-on-surface-variant flex items-center justify-center font-bold text-sm shrink-0">2</div>
                <div>
                  <h3 className="font-bold text-lg mb-2">导入聊天记录</h3>
                  <p className="text-on-surface-variant text-sm leading-relaxed">直接粘贴文字，或者上传微信导出的聊天文件。图片和视频也会被解析。</p>
                </div>
              </div>
              <div className="flex gap-6 items-start">
                <div className="w-10 h-10 rounded-full bg-surface-container-high text-on-surface-variant flex items-center justify-center font-bold text-sm shrink-0">3</div>
                <div>
                  <h3 className="font-bold text-lg mb-2">确认角色画像</h3>
                  <p className="text-on-surface-variant text-sm leading-relaxed">系统会自动分析 TA 的说话风格、性格、你们之间的记忆。你可以修改任何不准确的地方。</p>
                </div>
              </div>
              <div className="flex gap-6 items-start">
                <div className="w-10 h-10 rounded-full bg-surface-container-high text-on-surface-variant flex items-center justify-center font-bold text-sm shrink-0">4</div>
                <div>
                  <h3 className="font-bold text-lg mb-2">开始对话</h3>
                  <p className="text-on-surface-variant text-sm leading-relaxed">选择聊天、IF 线或者群聊。界面和微信一样，就像真的在和那个人发消息。</p>
                </div>
              </div>
            </div>
          </div>
        </section>
      </main>

      {/* Footer */}
      <footer className="w-full py-8 border-t border-outline-variant bg-surface">
        <div className="max-w-7xl mx-auto flex flex-col md:flex-row justify-between items-center px-8 space-y-4 md:space-y-0">
          <div className="text-xs text-on-surface-variant">© 2026 Copy Chat</div>
          <div className="flex space-x-8">
            <span className="text-xs text-on-surface-variant">隐私</span>
            <span className="text-xs text-on-surface-variant">条款</span>
            <span className="text-xs text-on-surface-variant">帮助</span>
          </div>
        </div>
      </footer>
    </div>
  );
}
