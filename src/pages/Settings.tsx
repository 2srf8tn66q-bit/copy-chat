import { useState, useRef, useCallback } from 'react';
import { Plus, Eye, EyeOff, Zap, Trash2, X, CheckCircle, Loader2, Settings as SettingsIcon, Upload, User } from 'lucide-react';
import { useLLMStore } from '../stores/llmStore';
import { useUserProfileStore } from '../stores/userProfileStore';
import { testConnection } from '../services/llmService';
import { fileToCompressedDataUrl } from '../utils/image';
import type { LLMConfig, LLMProvider } from '../types/llm';
import NavBar from '../components/layout/NavBar';
import PageHeader from '../components/PageHeader';
import FadeImage from '../components/FadeImage';
import openaiLogo from '../assets/providers/openai.png';
import kimiLogo from '../assets/providers/kimi.png';
import zhipuLogo from '../assets/providers/zhipu.png';
import claudeLogo from '../assets/providers/claude.png';
import aliyunLogo from '../assets/providers/aliyun.png';
import minimaxLogo from '../assets/providers/minimax.png';
import ollamaLogo from '../assets/providers/ollama.png';

const PROVIDER_ICONS: Record<string, string> = {
  openai: openaiLogo,
  kimi: kimiLogo,
  zhipu: zhipuLogo,
  claude: claudeLogo,
  aliyun: aliyunLogo,
  minimax: minimaxLogo,
  ollama: ollamaLogo,
};

// 默认 base URL + model ID。各家更新很快，这里用相对稳的"已发布过的合理 ID"作为默认值。
// 用户可以在配置表单里改成最新的，不影响接口接通。
const PROVIDER_META: Record<string, { baseUrl: string; model: string; label: string; color: string }> = {
  openai:   { baseUrl: 'https://api.openai.com/v1', model: 'gpt-5.5', label: 'OpenAI', color: '#10a37f' },
  kimi:     { baseUrl: 'https://api.moonshot.cn/v1', model: 'kimi-k2.6', label: 'Kimi', color: '#6366f1' },
  zhipu:    { baseUrl: 'https://open.bigmodel.cn/api/paas/v4', model: 'glm-5', label: '智谱', color: '#3b82f6' },
  claude:   { baseUrl: 'https://api.anthropic.com/v1', model: 'claude-sonnet-4-6', label: 'Claude', color: '#d97706' },
  aliyun:   { baseUrl: 'https://dashscope.aliyuncs.com/compatible-mode/v1', model: 'qwen-max-latest', label: '阿里云', color: '#f97316' },
  minimax:  { baseUrl: 'https://api.minimax.io/v1', model: 'MiniMax-M2.7', label: 'MiniMax', color: '#6366f1' },
  deepseek: { baseUrl: 'https://api.deepseek.com/v1', model: 'deepseek-v4-pro', label: 'DeepSeek', color: '#4d6bfe' },
  mimo:     { baseUrl: 'https://api.xiaomimimo.com/v1', model: 'mimo-v2.5-pro', label: '小米 MiMo', color: '#ff6700' },
  ollama:   { baseUrl: 'http://localhost:11434/v1', model: 'llama4:scout', label: 'Ollama', color: '#64748b' },
  custom:   { baseUrl: '', model: '', label: '自定义', color: '#6d7b6d' },
};

const PROVIDER_OPTIONS: LLMProvider[] = ['openai', 'kimi', 'zhipu', 'claude', 'aliyun', 'minimax', 'deepseek', 'mimo', 'ollama', 'custom'];

interface FormData {
  provider: LLMProvider;
  apiKey: string;
  baseUrl: string;
  model: string;
}

function createInitialFormData(): FormData {
  return {
    provider: 'openai',
    apiKey: '',
    baseUrl: PROVIDER_META.openai.baseUrl,
    model: PROVIDER_META.openai.model,
  };
}

export default function SettingsPage() {
  const { configs, activeConfigIndex, addConfig, removeConfig, setActiveConfig } = useLLMStore();
  const userAvatar = useUserProfileStore((s) => s.avatar);
  const userNickname = useUserProfileStore((s) => s.nickname);
  const setUserAvatar = useUserProfileStore((s) => s.setAvatar);
  const setUserNickname = useUserProfileStore((s) => s.setNickname);
  const clearUserAvatar = useUserProfileStore((s) => s.clearAvatar);

  const [showForm, setShowForm] = useState(false);
  const [formData, setFormData] = useState<FormData>(createInitialFormData());
  const [showApiKey, setShowApiKey] = useState(false);
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<{ success: boolean; message: string } | null>(null);

  // 用户头像上传
  const avatarFileRef = useRef<HTMLInputElement>(null);
  const [uploadingAvatar, setUploadingAvatar] = useState(false);
  const [avatarError, setAvatarError] = useState<string | null>(null);

  const handleAvatarFile = useCallback(async (file: File) => {
    setAvatarError(null);
    if (!file.type.startsWith('image/')) {
      setAvatarError('请选择图片文件');
      return;
    }
    if (file.size > 10 * 1024 * 1024) {
      setAvatarError('图片不能超过 10MB');
      return;
    }
    setUploadingAvatar(true);
    try {
      const compressed = await fileToCompressedDataUrl(file, 256);
      setUserAvatar(compressed);
    } catch (err) {
      console.error(err);
      setAvatarError('图片处理失败');
    } finally {
      setUploadingAvatar(false);
    }
  }, [setUserAvatar]);

  const handleProviderChange = (provider: LLMProvider) => {
    const meta = PROVIDER_META[provider];
    setFormData((prev) => ({
      ...prev,
      provider,
      baseUrl: meta.baseUrl || prev.baseUrl,
      model: meta.model || prev.model,
    }));
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const config: LLMConfig = {
      provider: formData.provider,
      apiKey: formData.apiKey,
      baseUrl: formData.baseUrl,
      model: formData.model,
    };
    addConfig(config);
    setFormData(createInitialFormData());
    setShowForm(false);
    setShowApiKey(false);
  };

  const handleTest = async () => {
    setTesting(true);
    setTestResult(null);
    const config: LLMConfig = {
      provider: formData.provider,
      apiKey: formData.apiKey,
      baseUrl: formData.baseUrl,
      model: formData.model,
    };
    const result = await testConnection(config);
    setTestResult(result);
    setTesting(false);
  };

  const handleCancel = () => {
    setShowForm(false);
    setFormData(createInitialFormData());
    setShowApiKey(false);
    setTestResult(null);
  };

  return (
    <div className="text-on-surface min-h-screen flex flex-col relative">
      <NavBar variant="solid" />

      <main className="relative z-10 pt-32 pb-24 px-8 md:px-16 lg:px-24 max-w-[1100px] mx-auto flex-1 w-full">
        <PageHeader
          eyebrow="SETTINGS · 配置"
          title="设置"
          subtitle="管理你的资料和大模型接口。"
          action={
            configs.length > 0 && !showForm && (
              <button onClick={() => setShowForm(true)} className="btn-primary inline-flex items-center gap-1.5">
                <Plus size={14} />
                添加
              </button>
            )
          }
        />

        {/* ─── 你的资料 ────────────────────────────────────── */}
        <section className="mb-10 anim-fade-up">
          <p className="eyebrow mb-3 text-white/40">PROFILE · 你的资料</p>
          <div className="card-glass p-6">
            <div className="flex items-start gap-5">
              {/* Avatar preview */}
              <div
                className="w-20 h-20 rounded-2xl overflow-hidden flex items-center justify-center shrink-0"
                style={{
                  backgroundColor: 'rgba(255,255,255,0.04)',
                  border: '1px solid rgba(255,255,255,0.08)',
                }}
              >
                {userAvatar ? (
                  <FadeImage src={userAvatar} alt="" className="w-full h-full object-cover" />
                ) : (
                  <User size={28} className="text-white/30" />
                )}
              </div>

              {/* Controls */}
              <div className="flex-1 min-w-0 space-y-3">
                <div>
                  <label className="block text-[11px] uppercase tracking-wider text-white/40 mb-1.5">
                    你的头像
                  </label>
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={() => avatarFileRef.current?.click()}
                      disabled={uploadingAvatar}
                      className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-medium disabled:opacity-50"
                      style={{
                        backgroundColor: 'rgba(15, 168, 118, 0.12)',
                        color: 'var(--color-primary)',
                        border: '1px solid rgba(15, 168, 118, 0.3)',
                      }}
                    >
                      <Upload size={14} />
                      {uploadingAvatar ? '处理中…' : userAvatar ? '更换' : '上传头像'}
                    </button>
                    {userAvatar && (
                      <button
                        type="button"
                        onClick={clearUserAvatar}
                        className="px-3 py-2 rounded-lg text-sm text-white/60 hover:text-white/90 hover:bg-white/[0.05] transition-colors"
                      >
                        清除
                      </button>
                    )}
                  </div>
                  {avatarError && (
                    <p className="text-xs mt-1.5" style={{ color: 'var(--color-error)' }}>{avatarError}</p>
                  )}
                  <p className="text-[11px] mt-1.5 text-white/35">
                    会出现在聊天里你这一侧 · 自动压缩到 256×256 · 仅存本地
                  </p>
                </div>

                <div>
                  <label className="block text-[11px] uppercase tracking-wider text-white/40 mb-1.5">
                    昵称 (可选)
                  </label>
                  <input
                    type="text"
                    value={userNickname}
                    onChange={(e) => setUserNickname(e.target.value)}
                    placeholder='留空就用"我"'
                    maxLength={20}
                    className="w-full max-w-xs px-3 py-2 rounded-lg text-sm bg-white/[0.04] border border-white/[0.08] text-white outline-none focus:border-white/20 transition-colors"
                  />
                </div>

                <input
                  ref={avatarFileRef}
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) handleAvatarFile(file);
                    e.target.value = '';
                  }}
                />
              </div>
            </div>
          </div>
        </section>

        {/* ─── API 接口 ──────────────────────────────────── */}
        <p className="eyebrow mb-3 text-white/40">API · 接口</p>

        {/* Empty state */}
        {configs.length === 0 && !showForm && (
          <div className="mt-10 card-glass p-12 text-center anim-fade-up-lg">
            {/* 浮动的 provider logo 暗示——这里需要"接一个 AI" */}
            <div className="flex items-center justify-center gap-3 mb-6 opacity-60">
              {(['openai', 'kimi', 'claude', 'zhipu'] as const).map((p, i) => (
                <div
                  key={p}
                  className="w-10 h-10 rounded-xl flex items-center justify-center overflow-hidden"
                  style={{
                    backgroundColor: 'rgba(255,255,255,0.04)',
                    border: '1px solid rgba(255,255,255,0.08)',
                    animation: `float${(i % 3) + 1} ${5 + i * 0.4}s ease-in-out infinite`,
                  }}
                >
                  <img src={PROVIDER_ICONS[p]} alt="" className="w-7 h-7" />
                </div>
              ))}
            </div>
            <p className="eyebrow mb-3 text-white/40">NO CONNECTION</p>
            <p className="text-[28px] text-white/95 mb-3" style={{ fontFamily: 'var(--font-serif)', letterSpacing: '-0.01em' }}>
              先接一个大模型
            </p>
            <p className="text-sm text-white/55 mb-8 max-w-md mx-auto leading-relaxed">
              COPY CHAT 用大模型分析聊天记录、还原 TA 的说话方式。<br />
              OpenAI / Claude / Kimi / 智谱…… 选一个接入。
            </p>
            <button onClick={() => setShowForm(true)} className="btn-primary inline-flex items-center gap-2">
              <Plus size={16} />
              添加配置
            </button>
          </div>
        )}

        {configs.length > 0 && (
          <div className="space-y-3 mb-6">
            {configs.map((config, index) => {
              const meta = PROVIDER_META[config.provider];
              const isActive = index === activeConfigIndex;
              return (
                <button
                  key={index}
                  onClick={() => setActiveConfig(index)}
                  className={`w-full text-left rounded-xl p-4 transition-all duration-200 flex items-center gap-4 group ${
                    isActive
                      ? 'bg-primary/8 ring-1 ring-primary/20 shadow-sm'
                      : 'bg-surface-container-lowest hover:bg-surface-container-low border border-transparent hover:border-outline-variant'
                  }`}
                >
                  {/* Provider icon */}
                  {PROVIDER_ICONS[config.provider] ? (
                    <img src={PROVIDER_ICONS[config.provider]} alt="" className="w-10 h-10 rounded-lg shrink-0" />
                  ) : (
                    <div
                      className="w-10 h-10 rounded-lg flex items-center justify-center text-white text-xs font-bold shrink-0"
                      style={{ backgroundColor: meta?.color ?? '#6d7b6d' }}
                    >
                      {(meta?.label ?? '?').slice(0, 1)}
                    </div>
                  )}

                  {/* Info */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="font-semibold text-sm text-on-surface">{meta?.label ?? config.provider}</span>
                      <span className="text-xs text-on-surface-variant font-mono bg-surface-container-high px-1.5 py-0.5 rounded">{config.model}</span>
                      {isActive && (
                        <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-primary bg-primary/10 px-2 py-0.5 rounded-full">
                          <Zap size={10} />
                          使用中
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-on-surface-variant truncate mt-0.5">{config.baseUrl}</p>
                  </div>

                  {/* Delete */}
                  <div
                    onClick={(e) => { e.stopPropagation(); removeConfig(index); }}
                    className="p-2 rounded-lg text-outline opacity-0 group-hover:opacity-100 hover:text-error hover:bg-error/10 transition-all"
                  >
                    <Trash2 size={16} />
                  </div>
                </button>
              );
            })}

            {!showForm && (
              <button
                onClick={() => setShowForm(true)}
                className="w-full py-3 rounded-xl border-2 border-dashed border-outline-variant text-on-surface-variant text-sm font-medium hover:border-primary hover:text-primary hover:bg-primary/5 transition-all flex items-center justify-center gap-2"
              >
                <Plus size={16} />
                添加新配置
              </button>
            )}
          </div>
        )}

        {/* Add Config Form */}
        {showForm && configs.length === 0 && (
          <div className="bg-surface-container-lowest rounded-2xl border border-outline-variant shadow-sm overflow-hidden">
            <div className="px-6 py-4 border-b border-outline-variant flex items-center justify-between">
              <div className="flex items-center gap-2">
                <SettingsIcon size={18} className="text-primary" />
                <h2 className="font-semibold text-on-surface">新配置</h2>
              </div>
              <button onClick={handleCancel} className="p-1.5 rounded-lg text-outline hover:text-on-surface hover:bg-surface-container-high transition-colors">
                <X size={16} />
              </button>
            </div>
            <ConfigForm
              formData={formData}
              showApiKey={showApiKey}
              testing={testing}
              testResult={testResult}
              onProviderChange={handleProviderChange}
              onFormDataChange={setFormData}
              onToggleApiKey={() => setShowApiKey(!showApiKey)}
              onSubmit={handleSubmit}
              onTest={handleTest}
              onCancel={handleCancel}
            />
          </div>
        )}

        {showForm && configs.length > 0 && (
          <div className="bg-surface-container-lowest rounded-2xl border border-outline-variant shadow-sm overflow-hidden">
            <div className="px-6 py-4 border-b border-outline-variant flex items-center justify-between">
              <div className="flex items-center gap-2">
                <SettingsIcon size={18} className="text-primary" />
                <h2 className="font-semibold text-on-surface">新配置</h2>
              </div>
              <button onClick={handleCancel} className="p-1.5 rounded-lg text-outline hover:text-on-surface hover:bg-surface-container-high transition-colors">
                <X size={16} />
              </button>
            </div>
            <ConfigForm
              formData={formData}
              showApiKey={showApiKey}
              testing={testing}
              testResult={testResult}
              onProviderChange={handleProviderChange}
              onFormDataChange={setFormData}
              onToggleApiKey={() => setShowApiKey(!showApiKey)}
              onSubmit={handleSubmit}
              onTest={handleTest}
              onCancel={handleCancel}
            />
          </div>
        )}
      </main>

    </div>
  );
}

function ConfigForm({
  formData,
  showApiKey,
  testing,
  testResult,
  onProviderChange,
  onFormDataChange,
  onToggleApiKey,
  onSubmit,
  onTest,
  onCancel,
}: {
  formData: FormData;
  showApiKey: boolean;
  testing: boolean;
  testResult: { success: boolean; message: string } | null;
  onProviderChange: (p: LLMProvider) => void;
  onFormDataChange: (fn: (prev: FormData) => FormData) => void;
  onToggleApiKey: () => void;
  onSubmit: (e: React.FormEvent) => void;
  onTest: () => void;
  onCancel: () => void;
}) {
  return (
    <form onSubmit={onSubmit} className="p-6 space-y-5">
      {/* Provider */}
      <div>
        <label className="block text-xs font-semibold text-on-surface-variant mb-2 uppercase tracking-wider">服务商</label>
        <div className="grid grid-cols-4 gap-2">
          {PROVIDER_OPTIONS.map((p) => {
            const meta = PROVIDER_META[p];
            const selected = formData.provider === p;
            return (
              <button
                key={p}
                type="button"
                onClick={() => onProviderChange(p)}
                className={`flex flex-col items-center gap-1.5 py-3 px-2 rounded-xl text-xs font-medium transition-all ${
                  selected
                    ? 'bg-primary/10 ring-1 ring-primary text-primary'
                    : 'bg-surface-container-low text-on-surface-variant hover:bg-surface-container'
                }`}
              >
                <div
                  className="w-7 h-7 rounded-md flex items-center justify-center overflow-hidden"
                >
                  {PROVIDER_ICONS[p] ? (
                    <img src={PROVIDER_ICONS[p]} alt="" className="w-full h-full" />
                  ) : (
                    <span className="text-white text-[10px] font-bold" style={{ color: meta.color }}>
                      {meta.label.slice(0, 1)}
                    </span>
                  )}
                </div>
                {meta.label}
              </button>
            );
          })}
        </div>
      </div>

      {/* API Key */}
      <div>
        <label className="block text-xs font-semibold text-on-surface-variant mb-2 uppercase tracking-wider">API Key</label>
        <div className="relative">
          <input
            type={showApiKey ? 'text' : 'password'}
            value={formData.apiKey}
            onChange={(e) => onFormDataChange((prev) => ({ ...prev, apiKey: e.target.value }))}
            placeholder={formData.provider === 'ollama' ? '本地模型无需 API Key' : '输入 API Key'}
            required={formData.provider !== 'ollama'}
            className="w-full px-4 py-2.5 bg-surface-container-low rounded-lg text-sm text-on-surface placeholder:text-outline outline-none focus:ring-2 focus:ring-primary/30 transition-shadow"
          />
          <button
            type="button"
            onClick={onToggleApiKey}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-outline hover:text-on-surface transition-colors"
          >
            {showApiKey ? <EyeOff size={16} /> : <Eye size={16} />}
          </button>
        </div>
      </div>

      {/* Base URL */}
      <div>
        <label className="block text-xs font-semibold text-on-surface-variant mb-2 uppercase tracking-wider">Base URL</label>
        <input
          type="url"
          value={formData.baseUrl}
          onChange={(e) => onFormDataChange((prev) => ({ ...prev, baseUrl: e.target.value }))}
          placeholder="https://api.example.com/v1"
          required
          className="w-full px-4 py-2.5 bg-surface-container-low rounded-lg text-sm text-on-surface placeholder:text-outline outline-none focus:ring-2 focus:ring-primary/30 transition-shadow font-mono"
        />
        <p className="text-[11px] text-on-surface-variant/70 mt-1.5 leading-relaxed">
          部分模型的 Coding Plan 与计费版 API 地址不同，请到服务商官网核对后再填。
        </p>
      </div>

      {/* Model */}
      <div>
        <label className="block text-xs font-semibold text-on-surface-variant mb-2 uppercase tracking-wider">模型</label>
        <input
          type="text"
          value={formData.model}
          onChange={(e) => onFormDataChange((prev) => ({ ...prev, model: e.target.value }))}
          placeholder="模型名称"
          required
          className="w-full px-4 py-2.5 bg-surface-container-low rounded-lg text-sm text-on-surface placeholder:text-outline outline-none focus:ring-2 focus:ring-primary/30 transition-shadow font-mono"
        />
      </div>

      {/* Test Result */}
      {testResult && (
        <div className={`flex items-center gap-2 px-4 py-3 rounded-lg text-sm ${
          testResult.success
            ? 'bg-primary/10 text-primary'
            : 'bg-error/10 text-error'
        }`}>
          <CheckCircle size={16} className="shrink-0" />
          {testResult.message}
        </div>
      )}

      {/* Actions */}
      <div className="flex items-center gap-3 pt-2">
        <button
          type="submit"
          className="px-6 py-2.5 bg-primary text-on-primary rounded-lg text-sm font-semibold active:scale-95 transition-transform"
        >
          保存
        </button>
        <button
          type="button"
          onClick={onTest}
          disabled={testing || !formData.apiKey}
          className="px-5 py-2.5 bg-surface-container-high text-on-surface rounded-lg text-sm font-medium hover:bg-surface-container-highest active:scale-95 transition-all disabled:opacity-40 inline-flex items-center gap-1.5"
        >
          {testing ? <Loader2 size={14} className="animate-spin" /> : <Zap size={14} />}
          {testing ? '测试中...' : '测试连接'}
        </button>
        <button
          type="button"
          onClick={onCancel}
          className="px-5 py-2.5 text-on-surface-variant rounded-lg text-sm font-medium hover:bg-surface-container-low transition-colors"
        >
          取消
        </button>
      </div>
    </form>
  );
}
