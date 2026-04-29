import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Plus, Eye, EyeOff, Zap, Trash2, Server, X, CheckCircle, Loader2, Settings as SettingsIcon } from 'lucide-react';
import { useLLMStore } from '../stores/llmStore';
import { testConnection } from '../services/llmService';
import type { LLMConfig, LLMProvider } from '../types/llm';
import NavBar from '../components/layout/NavBar';
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

const PROVIDER_META: Record<string, { baseUrl: string; model: string; label: string; color: string }> = {
  openai: { baseUrl: 'https://api.openai.com/v1', model: 'gpt-5.4', label: 'OpenAI', color: '#10a37f' },
  kimi: { baseUrl: 'https://api.moonshot.cn/v1', model: 'k2.5', label: 'Kimi', color: '#6366f1' },
  zhipu: { baseUrl: 'https://open.bigmodel.cn/api/paas/v4', model: 'glm-5', label: '智谱', color: '#3b82f6' },
  claude: { baseUrl: 'https://api.anthropic.com/v1', model: 'claude-opus-4-7', label: 'Claude', color: '#d97706' },
  aliyun: { baseUrl: 'https://dashscope.aliyuncs.com/compatible-mode/v1', model: 'qwen3-max', label: '阿里云', color: '#f97316' },
  minimax: { baseUrl: 'https://api.minimax.io/v1', model: 'MiniMax-M2.7', label: 'MiniMax', color: '#6366f1' },
  ollama: { baseUrl: 'http://localhost:11434/v1', model: 'llama4', label: 'Ollama', color: '#64748b' },
  custom: { baseUrl: '', model: '', label: '自定义', color: '#6d7b6d' },
};

const PROVIDER_OPTIONS: LLMProvider[] = ['openai', 'kimi', 'zhipu', 'claude', 'aliyun', 'minimax', 'ollama', 'custom'];

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
  const navigate = useNavigate();
  const { configs, activeConfigIndex, addConfig, removeConfig, setActiveConfig } = useLLMStore();
  const [showForm, setShowForm] = useState(false);
  const [formData, setFormData] = useState<FormData>(createInitialFormData());
  const [showApiKey, setShowApiKey] = useState(false);
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<{ success: boolean; message: string } | null>(null);

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
    <div className="bg-surface text-on-surface min-h-screen flex flex-col">
      {/* Nav */}
      <NavBar variant="solid" />

      <main className="pt-28 pb-20 px-6 max-w-2xl mx-auto flex-1">
        {/* Header */}
        <div className="mb-10">
          <h1 className="text-3xl font-extrabold tracking-tight mb-2">设置</h1>
          <p className="text-on-surface-variant text-sm">配置用于生成画像和对话的大模型接口</p>
        </div>

        {/* Config List */}
        {configs.length === 0 && !showForm && (
          <div className="text-center py-20">
            <div className="w-16 h-16 rounded-2xl bg-surface-container-high mx-auto mb-5 flex items-center justify-center">
              <Server size={28} className="text-outline" />
            </div>
            <p className="font-semibold text-on-surface mb-1">还没有配置</p>
            <p className="text-sm text-outline mb-6">添加一个 LLM 接口配置来开始使用</p>
            <button
              onClick={() => setShowForm(true)}
              className="inline-flex items-center gap-2 bg-primary text-on-primary px-6 py-3 rounded-lg text-sm font-semibold active:scale-95 transition-transform"
            >
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

      {/* Footer */}
      <footer className="w-full py-8 border-t border-outline-variant bg-surface">
        <div className="max-w-7xl mx-auto flex justify-between items-center px-8">
          <span className="text-xs text-outline">&copy; 2026 Copy Chat</span>
        </div>
      </footer>
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
