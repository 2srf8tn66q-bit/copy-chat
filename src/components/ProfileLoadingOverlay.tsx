import { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Check, Loader2 } from 'lucide-react';

interface ProfileLoadingOverlayProps {
  visible: boolean;
  /** Current status message from profileGenerator's progress callback */
  message: string;
}

/**
 * 角色画像生成时的全屏视频遮罩 + 多步骤进度指示
 *
 * Visual:
 *  - 全屏视频背景 (profile-loading.mp4)
 *  - 中央 4-step indicator with checkmarks
 *  - 当前 message
 */

interface Phase {
  id: string;
  label: string;
  /** Match against the progress message to mark this phase active/done */
  match: RegExp;
}

const PHASES: Phase[] = [
  { id: 'parse',    label: '解析聊天记录',  match: /解析|分批|提取候选|采样/ },
  { id: 'profile',  label: '提取语料指纹',  match: /语料|指纹|候选语录|分类/ },
  { id: 'persona',  label: '分析人格特征',  match: /人格|画像|性格|persona/i },
  { id: 'memory',   label: '生成时间线',    match: /记忆|时间线|事件|memory|timeline/i },
];

/** 把秒数格式化成 "12s" / "1 分 23 秒" / "5 分钟"，长生成时更易读 */
function formatElapsed(s: number): string {
  if (s < 60) return `${s}s`;
  const m = Math.floor(s / 60);
  const rem = s % 60;
  return rem === 0 ? `${m} 分钟` : `${m} 分 ${rem} 秒`;
}

export default function ProfileLoadingOverlay({ visible, message }: ProfileLoadingOverlayProps) {
  const [elapsed, setElapsed] = useState(0);

  useEffect(() => {
    if (!visible) {
      setElapsed(0);
      return;
    }
    const start = Date.now();
    const id = setInterval(() => setElapsed(Math.floor((Date.now() - start) / 1000)), 1000);
    return () => clearInterval(id);
  }, [visible]);

  // Determine current phase by matching message
  const activePhaseIdx = (() => {
    for (let i = PHASES.length - 1; i >= 0; i--) {
      if (PHASES[i].match.test(message)) return i;
    }
    return 0;
  })();

  return (
    <AnimatePresence>
      {visible && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
          className="fixed inset-0 z-[100] flex items-center justify-center"
          style={{ backgroundColor: '#0a0a0b' }}
        >
          {/* Background video */}
          <video
            src="/profile-loading.mp4"
            autoPlay
            muted
            loop
            playsInline
            className="absolute inset-0 w-full h-full object-cover"
            style={{ opacity: 0.45 }}
          />

          {/* Edge vignette — darkens corners */}
          <div
            aria-hidden
            className="absolute inset-0 pointer-events-none"
            style={{
              background:
                'radial-gradient(ellipse at center, transparent 30%, rgba(10,10,11,0.55) 70%, rgba(10,10,11,0.92) 100%)',
            }}
          />

          {/* Center text-protection layer — darkens behind copy */}
          <div
            aria-hidden
            className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 pointer-events-none"
            style={{
              width: '640px',
              height: '520px',
              background:
                'radial-gradient(ellipse at center, rgba(10,10,11,0.78) 0%, rgba(10,10,11,0.55) 45%, transparent 80%)',
              filter: 'blur(20px)',
            }}
          />

          {/* Content */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2, duration: 0.7, ease: [0.16, 1, 0.3, 1] }}
            className="relative z-10 max-w-md w-full px-8"
          >
            <p
              className="eyebrow mb-4 text-center"
              style={{ textShadow: '0 1px 8px rgba(0,0,0,0.6)' }}
            >
              GENERATING · 正在还原
            </p>
            <h2
              className="text-center text-white mb-2"
              style={{
                fontFamily: 'var(--font-serif)',
                fontSize: '36px',
                fontWeight: 600,
                letterSpacing: '-0.02em',
                lineHeight: 1.1,
                textShadow: '0 2px 16px rgba(0,0,0,0.8)',
              }}
            >
              正在还原 TA 的身影
            </h2>
            <p
              className="text-center text-sm text-white/55"
              style={{ textShadow: '0 1px 6px rgba(0,0,0,0.6)' }}
            >
              {elapsed > 0 ? `已用 ${formatElapsed(elapsed)} · ` : ''}时长视聊天记录大小而定，约 5–10 分钟
            </p>
            <p
              className="text-center text-xs text-white/35 mt-2 mb-10 px-4"
              style={{ textShadow: '0 1px 6px rgba(0,0,0,0.6)', lineHeight: 1.55 }}
            >
              部分对话内容可能因 LLM 审核被略过，不影响后续使用
            </p>

            {/* Phase indicators */}
            <div className="space-y-3">
              {PHASES.map((phase, i) => {
                const status: 'done' | 'active' | 'pending' =
                  i < activePhaseIdx ? 'done' : i === activePhaseIdx ? 'active' : 'pending';
                return (
                  <motion.div
                    key={phase.id}
                    initial={{ opacity: 0, x: -8 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: 0.4 + i * 0.08, duration: 0.4 }}
                    className="flex items-center gap-3 text-sm"
                  >
                    <span className="w-5 h-5 flex items-center justify-center shrink-0">
                      {status === 'done' && (
                        <motion.span
                          initial={{ scale: 0 }}
                          animate={{ scale: 1 }}
                          transition={{ type: 'spring', stiffness: 500, damping: 25 }}
                          className="w-5 h-5 rounded-full flex items-center justify-center"
                          style={{ backgroundColor: 'var(--color-primary)' }}
                        >
                          <Check size={12} className="text-white" strokeWidth={3} />
                        </motion.span>
                      )}
                      {status === 'active' && (
                        <Loader2
                          size={14}
                          className="animate-spin"
                          style={{ color: 'var(--color-primary)' }}
                        />
                      )}
                      {status === 'pending' && (
                        <span className="w-1.5 h-1.5 rounded-full bg-white/20" />
                      )}
                    </span>
                    <span
                      className={
                        status === 'pending'
                          ? 'text-white/30'
                          : status === 'active'
                          ? 'text-white'
                          : 'text-white/60'
                      }
                      style={{ textShadow: '0 1px 6px rgba(0,0,0,0.6)' }}
                    >
                      {phase.label}
                    </span>
                  </motion.div>
                );
              })}
            </div>

            {/* Current message */}
            {message && (
              <motion.p
                key={message}
                initial={{ opacity: 0, y: 4 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.3 }}
                className="text-xs text-white/50 mt-8 text-center min-h-[1.5em]"
                style={{ textShadow: '0 1px 6px rgba(0,0,0,0.6)' }}
              >
                {message}
              </motion.p>
            )}
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
