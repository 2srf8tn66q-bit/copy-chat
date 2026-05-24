import { useState } from 'react';
import { X, Loader2, ArrowRight, Wand2 } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import type { Character } from '../../types/character';
import type { LLMConfig } from '../../types/llm';
import { refinePersona, type RefineResult } from '../../services/personaRefiner';

export interface FeedbackApplyPayload {
  result: RefineResult;
  userCorrection: string;
  userSuggestion?: string;
}

interface FeedbackDialogProps {
  open: boolean;
  character: Character;
  config: LLMConfig;
  triggerMessage: string;
  onClose: () => void;
  onApply: (payload: FeedbackApplyPayload) => void;
}

export default function FeedbackDialog({
  open,
  character,
  config,
  triggerMessage,
  onClose,
  onApply,
}: FeedbackDialogProps) {
  const [correction, setCorrection] = useState('');
  const [suggestion, setSuggestion] = useState('');
  const [analyzing, setAnalyzing] = useState(false);
  const [result, setResult] = useState<RefineResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  const reset = () => {
    setCorrection('');
    setSuggestion('');
    setResult(null);
    setError(null);
    setAnalyzing(false);
  };

  const handleClose = () => {
    reset();
    onClose();
  };

  const handleAnalyze = async () => {
    if (!correction.trim()) return;
    setError(null);
    setAnalyzing(true);
    try {
      const res = await refinePersona(config, {
        character,
        triggerMessage,
        userCorrection: correction.trim(),
        userSuggestion: suggestion.trim() || undefined,
      });
      setResult(res);
    } catch (err) {
      setError(err instanceof Error ? err.message : '分析失败');
    } finally {
      setAnalyzing(false);
    }
  };

  const handleApply = () => {
    if (!result) return;
    onApply({
      result,
      userCorrection: correction.trim(),
      userSuggestion: suggestion.trim() || undefined,
    });
    reset();
  };

  if (!open) return null;

  return (
    <AnimatePresence>
      <motion.div
        key="backdrop"
        className="fixed inset-0 z-50 flex items-center justify-center p-4"
        style={{ backgroundColor: 'rgba(0,0,0,0.65)', backdropFilter: 'blur(6px)' }}
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        transition={{ duration: 0.18 }}
        onClick={handleClose}
      >
        <motion.div
          key="dialog"
          className="card-glass w-full max-w-md p-6"
          style={{ backgroundColor: 'rgba(20, 20, 22, 0.95)' }}
          initial={{ opacity: 0, y: 12, scale: 0.96 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: 8, scale: 0.98 }}
          transition={{ duration: 0.22, ease: [0.16, 1, 0.3, 1] }}
          onClick={(e) => e.stopPropagation()}
        >
          {/* Header */}
          <div className="flex items-center justify-between mb-5">
            <div className="flex items-center gap-2">
              <Wand2 size={16} style={{ color: 'var(--color-primary)' }} />
              <h2 className="text-base font-semibold text-white/95">
                修正 {character.identity.name}
              </h2>
            </div>
            <button onClick={handleClose} className="text-white/50 hover:text-white/90 transition-colors">
              <X size={18} />
            </button>
          </div>

          {/* Trigger message preview */}
          <div className="mb-4 p-3 rounded-lg" style={{ backgroundColor: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)' }}>
            <p className="eyebrow text-[10px] mb-1.5 text-white/35">TA 刚说</p>
            <p className="text-sm text-white/80 leading-relaxed line-clamp-4">
              {triggerMessage}
            </p>
          </div>

          {!result ? (
            // ─── 阶段 1: 收集反馈 ───
            <>
              <div className="mb-3">
                <label className="block text-xs font-medium text-white/55 mb-1.5">
                  哪里不对？<span className="text-red-400">*</span>
                </label>
                <textarea
                  value={correction}
                  onChange={(e) => setCorrection(e.target.value)}
                  rows={2}
                  placeholder="比如：TA 不会用'看法'这种书面词"
                  disabled={analyzing}
                  className="w-full px-3 py-2 rounded-lg text-sm resize-none outline-none"
                  style={{
                    backgroundColor: 'rgba(255,255,255,0.04)',
                    border: '1px solid rgba(255,255,255,0.08)',
                    color: 'rgba(255,255,255,0.95)',
                  }}
                  autoFocus
                />
              </div>

              <div className="mb-5">
                <label className="block text-xs font-medium text-white/55 mb-1.5">
                  TA 会怎么说？<span className="text-white/30">(可选，给 AI 学习用)</span>
                </label>
                <textarea
                  value={suggestion}
                  onChange={(e) => setSuggestion(e.target.value)}
                  rows={2}
                  placeholder="比如：我觉得吧，反正你看吧"
                  disabled={analyzing}
                  className="w-full px-3 py-2 rounded-lg text-sm resize-none outline-none"
                  style={{
                    backgroundColor: 'rgba(255,255,255,0.04)',
                    border: '1px solid rgba(255,255,255,0.08)',
                    color: 'rgba(255,255,255,0.95)',
                  }}
                />
              </div>

              {error && (
                <p className="text-xs mb-3" style={{ color: 'var(--color-error)' }}>{error}</p>
              )}

              <div className="flex gap-3">
                <button
                  type="button"
                  onClick={handleClose}
                  disabled={analyzing}
                  className="flex-1 px-4 py-2.5 rounded-lg text-sm text-white/80 hover:bg-white/[0.05] transition-colors disabled:opacity-40"
                >
                  取消
                </button>
                <button
                  type="button"
                  onClick={handleAnalyze}
                  disabled={!correction.trim() || analyzing}
                  className="flex-1 btn-primary disabled:opacity-40 disabled:cursor-not-allowed inline-flex items-center justify-center gap-1.5"
                >
                  {analyzing ? <Loader2 size={14} className="animate-spin" /> : <Wand2 size={14} />}
                  {analyzing ? '分析中...' : '分析'}
                </button>
              </div>
            </>
          ) : (
            // ─── 阶段 2: 显示 diff，确认应用 ───
            <>
              <div className="mb-4">
                <p className="eyebrow text-[10px] mb-2 text-white/35">准备这么改</p>
                <div
                  className="rounded-lg p-3 space-y-1.5"
                  style={{ backgroundColor: 'rgba(15, 168, 118, 0.08)', border: '1px solid rgba(15, 168, 118, 0.25)' }}
                >
                  {result.diffSummary.map((line, i) => (
                    <p key={i} className="text-xs text-white/90 font-mono">{line}</p>
                  ))}
                </div>
              </div>

              {result.reasoning && (
                <div className="mb-5">
                  <p className="eyebrow text-[10px] mb-1.5 text-white/35">修正理由</p>
                  <p className="text-xs text-white/65 leading-relaxed">{result.reasoning}</p>
                </div>
              )}

              <div className="flex gap-3">
                <button
                  type="button"
                  onClick={() => setResult(null)}
                  className="flex-1 px-4 py-2.5 rounded-lg text-sm text-white/80 hover:bg-white/[0.05] transition-colors"
                >
                  改一下反馈
                </button>
                <button
                  type="button"
                  onClick={handleApply}
                  className="flex-1 btn-primary inline-flex items-center justify-center gap-1.5"
                >
                  应用
                  <ArrowRight size={14} />
                </button>
              </div>
            </>
          )}
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}
