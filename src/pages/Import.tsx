import { useState, useCallback, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { Upload, FileText, AlertCircle, CheckCircle, Loader2, ChevronRight, ClipboardPaste, Image, Video, MessageSquare, X } from 'lucide-react';
import { parseTextChat } from '../services/parser/textParser';
import { parseHTMLChat, buildFileMap } from '../services/parser';
import NavBar from '../components/layout/NavBar';
import ProfileLoadingOverlay from '../components/ProfileLoadingOverlay';
import type { ParseResult } from '../services/parser/textParser';
import type { HTMLParseResult } from '../services/parser/htmlParser';
import { generateFromParsedData } from '../services/profileGenerator';
import type { GenerationResult } from '../services/profileGenerator';
import { useLLMStore } from '../stores/llmStore';
import { useCharacterStore } from '../stores/characterStore';
import { saveCharacter, saveTimelineEvents, saveRawMessages } from '../services/storage';
import type { Character } from '../types/character';

type Step = 'import' | 'confirm' | 'done';

export default function ImportPage() {
  const navigate = useNavigate();
  const getActiveConfig = useLLMStore((s) => s.getActiveConfig);
  const addCharacter = useCharacterStore((s) => s.addCharacter);

  const [step, setStep] = useState<Step>('import');
  const [textValue, setTextValue] = useState('');

  const fileInputRef = useRef<HTMLInputElement>(null);
  const [dragOver, setDragOver] = useState(false);
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);

  const [parseResult, setParseResult] = useState<ParseResult | HTMLParseResult | null>(null);
  const [sourceType, setSourceType] = useState<'text-paste' | 'html-upload'>('text-paste');
  const [generationResult, setGenerationResult] = useState<GenerationResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [loadingText, setLoadingText] = useState('加载中...');
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const savingRef = useRef(false);

  // ─── File handling ───

  const handleFileSelect = useCallback((files: FileList | File[]) => {
    setSelectedFiles(Array.from(files));
    setError(null);
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    if (e.dataTransfer.files.length > 0) handleFileSelect(e.dataTransfer.files);
  }, [handleFileSelect]);

  // ─── Parse ───

  const handleParse = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      if (textValue.trim()) {
        const result = parseTextChat(textValue);
        if (result.messages.length === 0) {
          setError('未能解析出有效的聊天记录，请检查格式');
          setLoading(false);
          return;
        }
        setParseResult(result);
        setSourceType('text-paste');
      } else if (selectedFiles.length > 0) {
        const htmlFile = selectedFiles.find(f => f.name.endsWith('.html') || f.name.endsWith('.htm'));
        if (!htmlFile) {
          setError('未找到 HTML 文件');
          setLoading(false);
          return;
        }
        const htmlContent = await htmlFile.text();
        const fileMap = buildFileMap(selectedFiles);
        const result = await parseHTMLChat(htmlContent, fileMap);
        if (result.messages.length === 0) {
          setError('未能从 HTML 文件中解析出有效的聊天记录');
          setLoading(false);
          return;
        }
        setParseResult(result);
        setSourceType('html-upload');
      } else {
        setError('请粘贴聊天记录或上传文件');
        setLoading(false);
        return;
      }
      setStep('confirm');
    } catch (err) {
      setError(err instanceof Error ? err.message : '解析失败');
    } finally {
      setLoading(false);
    }
  }, [textValue, selectedFiles]);

  // ─── Generate profile ───

  const handleGenerate = useCallback(async () => {
    if (!parseResult) return;
    const llmConfig = getActiveConfig();
    if (!llmConfig) { setError('请先在设置中配置 LLM API'); return; }

    setLoading(true);
    setError(null);
    setLoadingText('正在生成性格画像...');
    try {
      const result = await generateFromParsedData(parseResult, llmConfig, (msg) => {
        setLoadingText(msg);
      });
      setGenerationResult(result);
      setStep('done');
    } catch (err) {
      setError(err instanceof Error ? err.message : '画像生成失败');
    } finally {
      setLoading(false);
    }
  }, [parseResult, getActiveConfig]);

  // ─── Save ───

  const saveCharacter_ = useCallback(async (target: 'chat' | 'edit' | 'list') => {
    if (!generationResult || savingRef.current) return;
    savingRef.current = true;
    setSaving(true);
    try {
      const character: Character = {
        id: `char_${Date.now()}`,
        ...generationResult.character,
        createdAt: new Date().toISOString(),
        sourceType,
      };
      addCharacter(character);
      await saveCharacter(character);
      if (parseResult?.messages?.length) {
        await saveRawMessages(character.id, parseResult.messages);
      }
      if (generationResult.events.length > 0) {
        const eventsWithIds = generationResult.events.map(e => ({
          ...e,
          id: `evt_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
          status: 'pending' as const,
        }));
        await saveTimelineEvents(character.id, eventsWithIds);
      }
      if (target === 'list') {
        navigate('/characters');
      } else {
        navigate(`/characters/${character.id}/${target}`);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : '保存失败，请重试');
    } finally {
      savingRef.current = false;
      setSaving(false);
    }
  }, [generationResult, parseResult, sourceType, addCharacter, navigate]);

  // ─── Steps indicator ───

  const steps = [
    { key: 'import' as const, label: '导入', num: 1 },
    { key: 'confirm' as const, label: '确认画像', num: 2 },
    { key: 'done' as const, label: '开始对话', num: 3 },
  ];
  const currentStepIndex = steps.findIndex(s => s.key === step);

  // Show full-screen loading overlay during LLM generation
  const showLoadingOverlay = loading && step === 'confirm';

  return (
    <div className="text-on-surface min-h-screen relative">
      <NavBar variant="solid" />

      {/* Profile generation overlay */}
      <ProfileLoadingOverlay visible={showLoadingOverlay} message={loadingText} />

      <main className="relative z-10 pt-32 pb-24 px-8 md:px-16 lg:px-24 max-w-[1280px] mx-auto">
        {/* Minimal progress indicator — eyebrow style */}
        <div className="flex items-center gap-2 mb-8">
          {steps.map((s, i) => (
            <div key={s.key} className="flex items-center gap-2">
              <span
                className={`text-[11px] tracking-[0.18em] uppercase transition-colors ${
                  i === currentStepIndex
                    ? 'text-white'
                    : i < currentStepIndex
                    ? 'text-white/40'
                    : 'text-white/20'
                }`}
              >
                {i < currentStepIndex && <CheckCircle size={11} className="inline mr-1.5 -mt-0.5" />}
                {String(s.num).padStart(2, '0')} · {s.label}
              </span>
              {i < steps.length - 1 && (
                <span
                  className={`w-8 h-px ${
                    i < currentStepIndex ? 'bg-white/40' : 'bg-white/10'
                  }`}
                />
              )}
            </div>
          ))}
        </div>

        {/* Error */}
        {error && (
          <div className="mb-6 p-4 rounded-lg flex items-center gap-2 bg-error/10 text-error max-w-2xl mx-auto">
            <AlertCircle size={18} className="shrink-0" />
            <span className="text-sm">{error}</span>
          </div>
        )}

        {/* Step 1: Import */}
        {step === 'import' && (
          <>
            <header className="mb-12">
              <p className="eyebrow mb-3">CHOOSE A METHOD · 挑一段对话</p>
              <h1 className="text-h1 text-white">挑一段对话</h1>
              <p className="mt-3 text-base text-white/55 max-w-xl">
                把聊天记录导入进来，COPY CHAT 会自动分析 TA 的说话方式、口头禅和情绪习惯。
              </p>
            </header>

            <div className="grid md:grid-cols-2 gap-6 items-stretch">
              {/* Text Paste */}
              <div className="card-glass p-8 flex flex-col">
                <div className="flex items-center gap-3 mb-6">
                  <div className="w-9 h-9 rounded-lg bg-white/[0.06] flex items-center justify-center text-white/70">
                    <ClipboardPaste size={18} />
                  </div>
                  <div>
                    <h2 className="text-base text-white/90 font-medium" style={{ fontFamily: 'var(--font-sans)' }}>文本粘贴</h2>
                    <p className="text-xs text-white/40 mt-0.5">快速导入</p>
                  </div>
                </div>

                <div className="flex-grow">
                  <label className="block text-[11px] tracking-[0.16em] uppercase text-white/40 mb-2">聊天记录</label>
                  <textarea
                    className="w-full h-64 bg-black/30 border border-white/[0.08] focus:border-white/20 rounded-lg p-4 text-sm text-on-surface transition-colors placeholder:text-white/25 outline-none resize-none"
                    placeholder={`从微信复制聊天记录，粘贴到这里...\n\n小林 14:32\n在吗\n\n我 14:33\n在呢怎么了\n\n小林 14:33\n周末有空吗 想去看电影`}
                    value={textValue}
                    onChange={(e) => setTextValue(e.target.value)}
                  />
                </div>

                <div className="mt-6 flex flex-col gap-4">
                  <div className="text-xs text-white/40 leading-relaxed">
                    支持文字消息、时间戳和 emoji · 不支持图片视频
                  </div>
                  <button
                    onClick={handleParse}
                    disabled={loading || !textValue.trim()}
                    className="btn-primary w-full inline-flex items-center justify-center gap-2 disabled:opacity-50"
                  >
                    {loading ? <><Loader2 size={16} className="animate-spin" /> 解析中...</> : '解析聊天记录'}
                  </button>
                </div>
              </div>

              {/* HTML Upload */}
              <div className="card-glass p-8 flex flex-col">
                <div className="flex items-center gap-3 mb-6">
                  <div className="w-9 h-9 rounded-lg bg-white/[0.06] flex items-center justify-center text-white/70">
                    <Upload size={18} />
                  </div>
                  <div>
                    <h2 className="text-base text-white/90 font-medium" style={{ fontFamily: 'var(--font-sans)' }}>上传聊天文件</h2>
                    <p className="text-xs text-white/40 mt-0.5">完整解析（含图片视频）</p>
                  </div>
                </div>

                <label className="block text-[11px] tracking-[0.16em] uppercase text-white/40 mb-2">聊天文件</label>
                <div
                  className={`flex-grow flex flex-col border border-dashed rounded-xl bg-black/30 hover:bg-black/40 transition-all cursor-pointer p-8 group overflow-y-auto ${
                    selectedFiles.length > 0 ? 'items-start justify-start' : 'items-center justify-center text-center'
                  } ${dragOver ? 'border-white/40' : 'border-white/[0.10]'}`}
                  onDrop={handleDrop}
                  onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
                  onDragLeave={() => setDragOver(false)}
                  onClick={() => fileInputRef.current?.click()}
                >
                  {selectedFiles.length > 0 ? (
                    <div className="w-full text-left" onClick={(e) => e.stopPropagation()}>
                      <div className="flex items-center justify-between mb-3">
                        <p className="text-xs text-white/55">已选择 {selectedFiles.length} 个文件</p>
                        <button onClick={() => fileInputRef.current?.click()} className="text-[11px] text-white/70 hover:text-white transition-colors">重新选择</button>
                      </div>
                      <div className="max-h-40 overflow-y-auto space-y-2">
                        {selectedFiles.map((f, i) => (
                          <div key={i} className="flex items-center gap-3 rounded-lg px-3 py-2.5 bg-white/[0.04] border border-white/[0.06]">
                            <div className="w-8 h-8 rounded-md flex items-center justify-center shrink-0 bg-white/[0.06]">
                              <FileText size={14} className="text-white/55" />
                            </div>
                            <div className="flex-1 min-w-0">
                              <p className="text-sm text-white/85 truncate">{f.name}</p>
                              <p className="text-[10px] text-white/40 mt-0.5">{(f.size / 1024).toFixed(0)} KB</p>
                            </div>
                            <button
                              onClick={() => setSelectedFiles(prev => prev.filter((_, idx) => idx !== i))}
                              className="shrink-0 w-6 h-6 rounded-full flex items-center justify-center text-white/40 hover:bg-white/10 hover:text-white transition-colors"
                            >
                              <X size={13} />
                            </button>
                          </div>
                        ))}
                      </div>
                    </div>
                  ) : (
                    <>
                      <div className="mb-4 text-white/25 group-hover:text-white/55 transition-colors">
                        <Upload size={48} strokeWidth={1.5} />
                      </div>
                      <p className="text-sm text-white/80 mb-1">把文件夹拖到这里</p>
                      <p className="text-xs text-white/40 mb-6">支持 WeFlow 导出的 HTML + 资源文件夹</p>
                      <div className="flex gap-2 justify-center">
                        <div className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-white/[0.06] text-white/60">
                          <Image size={12} />
                          <span className="text-[10px]">图片</span>
                        </div>
                        <div className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-white/[0.06] text-white/60">
                          <Video size={12} />
                          <span className="text-[10px]">视频</span>
                        </div>
                        <div className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-white/[0.06] text-white/60">
                          <MessageSquare size={12} />
                          <span className="text-[10px]">文字</span>
                        </div>
                      </div>
                    </>
                  )}
                </div>

                <input ref={fileInputRef} type="file" accept=".html,.htm" multiple className="hidden" onChange={(e) => { if (e.target.files) handleFileSelect(e.target.files); }} />

                <div className="mt-6 flex flex-col gap-4">
                  <div className="flex items-start gap-2.5 rounded-lg px-3 py-2.5 bg-white/[0.03] border border-white/[0.08]">
                    <span className="text-white/40 mt-0.5 shrink-0">↗</span>
                    <p className="text-xs text-white/55 leading-relaxed">
                      导出前需先安装{' '}
                      <a href="https://github.com/hicccc77/WeFlow" target="_blank" rel="noopener noreferrer" className="text-white/85 underline underline-offset-2 hover:text-white transition-colors">WeFlow</a>
                      ，将微信聊天记录导出为 HTML 文件夹后再上传
                    </p>
                  </div>
                  <button
                    onClick={handleParse}
                    disabled={loading || selectedFiles.length === 0}
                    className="w-full bg-white/[0.06] hover:bg-white/[0.10] text-white py-3 rounded-lg font-medium text-sm flex items-center justify-center gap-2 transition-colors disabled:opacity-40"
                  >
                    {loading ? <><Loader2 size={16} className="animate-spin" /> 解析中...</> : '选择文件'}
                  </button>
                </div>
              </div>
            </div>
          </>
        )}

        {/* Step 2: Confirm */}
        {step === 'confirm' && parseResult && (
          <div className="max-w-3xl mx-auto">
            <header className="mb-10">
              <p className="eyebrow mb-3">CONFIRM · 确认解析结果</p>
              <h1 className="text-h1 text-white">检查一下</h1>
              <p className="mt-3 text-base text-white/55">
                以下是从聊天记录中解析出的信息，确认无误后生成画像。
              </p>
            </header>

            <div className="card-glass p-6">
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
                <div className="p-4 rounded-lg bg-white/[0.03]">
                  <p className="text-2xl text-white font-medium" style={{ fontFeatureSettings: '"tnum" 1' }}>{parseResult.totalMessages}</p>
                  <p className="text-[11px] text-white/40 mt-1 tracking-wider uppercase">消息数</p>
                </div>
                <div className="p-4 rounded-lg bg-white/[0.03]">
                  <p className="text-base text-white/85 truncate">{parseResult.participants.other}</p>
                  <p className="text-[11px] text-white/40 mt-1 tracking-wider uppercase">对方</p>
                </div>
                <div className="p-4 rounded-lg bg-white/[0.03]">
                  <p className="text-sm text-white/85" style={{ fontFeatureSettings: '"tnum" 1' }}>{parseResult.startDate || '未知'}</p>
                  <p className="text-[11px] text-white/40 mt-1 tracking-wider uppercase">起始</p>
                </div>
                <div className="p-4 rounded-lg bg-white/[0.03]">
                  <p className="text-sm text-white/85" style={{ fontFeatureSettings: '"tnum" 1' }}>{parseResult.endDate || '未知'}</p>
                  <p className="text-[11px] text-white/40 mt-1 tracking-wider uppercase">结束</p>
                </div>
              </div>

              <p className="text-[11px] tracking-[0.16em] uppercase text-white/40 mb-3">前 10 条预览</p>
              <div className="space-y-2 max-h-48 overflow-y-auto mb-6 text-sm">
                {parseResult.messages.slice(0, 10).map((msg) => (
                  <div key={msg.id} className="flex gap-2">
                    <span className="shrink-0 text-white/40 w-12">{msg.sender === 'user' ? '我' : parseResult.participants.other}</span>
                    <span className="text-white/80">{msg.content}</span>
                  </div>
                ))}
              </div>

              {!getActiveConfig() && (
                <div className="p-3 rounded-lg mb-4 flex items-center gap-2 bg-red-500/10 border border-red-500/20 text-red-400">
                  <AlertCircle size={16} />
                  <span className="text-sm">请先在设置中配置 LLM API，否则无法生成画像</span>
                </div>
              )}

              <div className="flex gap-3">
                <button onClick={() => setStep('import')} className="px-5 py-2.5 rounded-lg text-sm font-medium bg-white/[0.05] hover:bg-white/[0.10] text-white/80 transition-colors">
                  返回修改
                </button>
                <button
                  onClick={handleGenerate}
                  disabled={loading || !getActiveConfig()}
                  className="btn-primary flex-1 inline-flex items-center justify-center gap-2 disabled:opacity-50"
                >
                  {loading ? <Loader2 size={16} className="animate-spin" /> : <FileText size={16} />}
                  {loading ? '生成中…' : '生成画像'}
                  {!loading && <ChevronRight size={14} />}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Step 3: Done */}
        {step === 'done' && generationResult && (
          <div className="max-w-3xl mx-auto">
            <header className="mb-10">
              <p className="eyebrow mb-3">READY · 还原完成</p>
              <h1 className="text-h1 text-white">
                {generationResult.character.identity.name}
                <span className="text-white/30"> · 已就位</span>
              </h1>
              <p className="mt-3 text-base text-white/55">画像已生成，可以开始对话了。</p>
            </header>

            <div className="card-glass p-6">
              <div className="space-y-3 mb-6">
                <div className="p-4 rounded-lg bg-white/[0.03]">
                  <p className="text-[11px] tracking-[0.16em] uppercase text-white/40 mb-1.5">身份</p>
                  <p className="text-sm text-white/85">
                    {generationResult.character.identity.name}
                    {generationResult.character.identity.ageEstimate && ` · ${generationResult.character.identity.ageEstimate}`}
                    {generationResult.character.identity.occupationHint && ` · ${generationResult.character.identity.occupationHint}`}
                  </p>
                </div>
                <div className="p-4 rounded-lg bg-white/[0.03]">
                  <p className="text-[11px] tracking-[0.16em] uppercase text-white/40 mb-2">性格标签</p>
                  <div className="flex flex-wrap gap-1.5">
                    {generationResult.character.persona.personalityTags.map((tag, i) => (
                      <span key={i} className="px-2.5 py-0.5 rounded-full text-xs bg-white/[0.06] text-white/75">{tag}</span>
                    ))}
                  </div>
                </div>
                <div className="p-4 rounded-lg bg-white/[0.03]">
                  <p className="text-[11px] tracking-[0.16em] uppercase text-white/40 mb-2">时间轴事件 · {generationResult.events.length}</p>
                  <div className="space-y-1 max-h-32 overflow-y-auto">
                    {generationResult.events.slice(0, 5).map((ev, i) => (
                      <div key={i} className="flex items-center gap-3 text-xs">
                        <span className="text-white/45 shrink-0" style={{ fontFeatureSettings: '"tnum" 1' }}>{ev.date}</span>
                        <span className="text-white/80 truncate">{ev.summary}</span>
                      </div>
                    ))}
                    {generationResult.events.length > 5 && (
                      <p className="text-xs text-white/30">… 还有 {generationResult.events.length - 5} 个</p>
                    )}
                  </div>
                </div>
              </div>

              <div className="flex gap-3">
                <button disabled={saving} onClick={() => saveCharacter_('edit')} className="flex-1 px-4 py-2.5 rounded-lg text-sm font-medium bg-white/[0.05] hover:bg-white/[0.10] text-white/80 transition-colors disabled:opacity-50">
                  {saving ? '保存中...' : '查看画像'}
                </button>
                <button disabled={saving} onClick={() => saveCharacter_('chat')} className="btn-primary flex-1 inline-flex items-center justify-center gap-2 disabled:opacity-50">
                  {saving ? '保存中...' : '开始聊天'}
                </button>
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
