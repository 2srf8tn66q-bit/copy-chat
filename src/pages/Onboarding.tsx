import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Eye, EyeOff, Zap, CheckCircle, Loader2, ArrowRight, Sparkles } from 'lucide-react';
import { useLLMStore } from '../stores/llmStore';
import { testConnection } from '../services/llmService';
import type { LLMConfig, LLMProvider } from '../types/llm';
import openaiLogo from '../assets/providers/openai.png';
import kimiLogo from '../assets/providers/kimi.png';
import zhipuLogo from '../assets/providers/zhipu.png';
import claudeLogo from '../assets/providers/claude.png';
import aliyunLogo from '../assets/providers/aliyun.png';
import minimaxLogo from '../assets/providers/minimax.png';
import deepseekLogo from '../assets/providers/deepseek.png';
import mimoLogo from '../assets/providers/mimo.png';
import ollamaLogo from '../assets/providers/ollama.png';

const PROVIDER_ICONS: Record<string, string> = {
  openai: openaiLogo,
  kimi: kimiLogo,
  zhipu: zhipuLogo,
  claude: claudeLogo,
  aliyun: aliyunLogo,
  minimax: minimaxLogo,
  deepseek: deepseekLogo,
  mimo: mimoLogo,
  ollama: ollamaLogo,
};

// 默认 base URL + model ID — 跟 Settings.tsx 保持一致
const PROVIDER_META: Record<string, { baseUrl: string; model: string; label: string; color: string; desc: string }> = {
  openai:   { baseUrl: 'https://api.openai.com/v1', model: 'gpt-5.5', label: 'OpenAI', color: '#10a37f', desc: 'GPT-5.5' },
  kimi:     { baseUrl: 'https://api.moonshot.cn/v1', model: 'kimi-k2.6', label: 'Kimi', color: '#6366f1', desc: 'K2.6' },
  zhipu:    { baseUrl: 'https://open.bigmodel.cn/api/paas/v4', model: 'glm-5', label: '智谱', color: '#3b82f6', desc: 'GLM-5' },
  claude:   { baseUrl: 'https://api.anthropic.com/v1', model: 'claude-sonnet-4-6', label: 'Claude', color: '#d97706', desc: 'Sonnet 4.6' },
  aliyun:   { baseUrl: 'https://dashscope.aliyuncs.com/compatible-mode/v1', model: 'qwen-max-latest', label: '阿里云', color: '#f97316', desc: 'Qwen Max' },
  minimax:  { baseUrl: 'https://api.minimax.io/v1', model: 'MiniMax-M2.7', label: 'MiniMax', color: '#6366f1', desc: 'M2.7' },
  deepseek: { baseUrl: 'https://api.deepseek.com/v1', model: 'deepseek-v4-pro', label: 'DeepSeek', color: '#4d6bfe', desc: 'V4 Pro' },
  mimo:     { baseUrl: 'https://api.xiaomimimo.com/v1', model: 'mimo-v2.5-pro', label: '小米 MiMo', color: '#ff6700', desc: 'V2.5 Pro' },
  ollama:   { baseUrl: 'http://localhost:11434/v1', model: 'llama4:scout', label: 'Ollama', color: '#64748b', desc: '本地模型' },
  custom:   { baseUrl: '', model: '', label: '自定义', color: '#6d7b6d', desc: '兼容 OpenAI 格式' },
};

const PROVIDER_OPTIONS: LLMProvider[] = ['openai', 'kimi', 'zhipu', 'claude', 'aliyun', 'minimax', 'deepseek', 'mimo', 'ollama', 'custom'];

const STEPS = [
  { num: 1, label: '配置 AI' },
  { num: 2, label: '导入聊天' },
  { num: 3, label: '开始对话' },
];

interface FormData {
  provider: LLMProvider;
  apiKey: string;
  baseUrl: string;
  model: string;
}

export default function OnboardingPage() {
  const navigate = useNavigate();
  const addConfig = useLLMStore((s) => s.addConfig);
  const configs = useLLMStore((s) => s.configs);
  const setConfig = useLLMStore((s) => s.setConfig);
  const setActiveConfig = useLLMStore((s) => s.setActiveConfig);

  const [formData, setFormData] = useState<FormData>({
    provider: 'openai',
    apiKey: '',
    baseUrl: PROVIDER_META.openai.baseUrl,
    model: PROVIDER_META.openai.model,
  });
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
    setTestResult(null);
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

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const config: LLMConfig = {
      provider: formData.provider,
      apiKey: formData.apiKey,
      baseUrl: formData.baseUrl,
      model: formData.model,
    };
    if (configs.length > 0) {
      setConfig(0, config);
      setActiveConfig(0);
    } else {
      addConfig(config);
    }
    navigate('/import');
  };

  return (
    <div className="min-h-screen bg-surface text-on-surface flex flex-col">
      {/* Progress */}
      <div className="pt-12 pb-8">
        <div className="flex items-center justify-center gap-3">
          {STEPS.map((step, i) => (
            <div key={step.num} className="flex items-center">
              <div className="flex items-center gap-2">
                <div
                  className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold transition-all ${
                    i === 0
                      ? 'bg-primary text-on-primary'
                      : 'bg-surface-container-high text-on-surface-variant'
                  }`}
                >
                  {step.num}
                </div>
                <span className={`text-sm ${i === 0 ? 'font-semibold text-primary' : 'text-on-surface-variant'}`}>
                  {step.label}
                </span>
              </div>
              {i < STEPS.length - 1 && (
                <div className="w-12 h-px bg-outline-variant mx-4" />
              )}
            </div>
          ))}
        </div>
      </div>

      {/* Main */}
      <main className="flex-1 flex flex-col items-center justify-start px-6 pb-16">
        <div className="w-full max-w-lg">
          {/* Header */}
          <div className="text-center mb-10">
            <div className="w-14 h-14 rounded-2xl bg-primary/10 mx-auto mb-5 flex items-center justify-center">
              <Sparkles size={28} className="text-primary" />
            </div>
            <h1 className="text-2xl font-extrabold tracking-tight mb-2">配置 AI 接口</h1>
            <p className="text-on-surface-variant text-sm">用于生成角色画像和驱动对话</p>
          </div>

          {/* Form Card */}
          <form onSubmit={handleSubmit} className="bg-surface-container-lowest rounded-2xl border border-outline-variant shadow-sm p-6 space-y-6">
            {/* Provider Grid */}
            <div>
              <label className="block text-xs font-semibold text-on-surface-variant mb-3 uppercase tracking-wider">选择服务商</label>
              <div className="grid grid-cols-5 gap-2">
                {PROVIDER_OPTIONS.map((p) => {
                  const meta = PROVIDER_META[p];
                  const selected = formData.provider === p;
                  return (
                    <button
                      key={p}
                      type="button"
                      onClick={() => handleProviderChange(p)}
                      className={`flex flex-col items-center gap-1.5 py-3 px-2 rounded-xl text-xs font-medium transition-all duration-200 ${
                        selected
                          ? 'bg-primary/8 ring-2 ring-primary/40 text-primary shadow-sm'
                          : 'bg-surface-container-low text-on-surface-variant hover:bg-surface-container'
                      }`}
                    >
                      <div className="w-8 h-8 rounded-lg flex items-center justify-center overflow-hidden">
                        {PROVIDER_ICONS[p] ? (
                          <img src={PROVIDER_ICONS[p]} alt="" className="w-full h-full" />
                        ) : (
                          <span className="text-[11px] font-bold" style={{ color: meta.color }}>
                            {meta.label.slice(0, 1)}
                          </span>
                        )}
                      </div>
                      <span>{meta.label}</span>
                      <span className="text-[10px] opacity-60">{meta.desc}</span>
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
                  onChange={(e) => setFormData((prev) => ({ ...prev, apiKey: e.target.value }))}
                  placeholder={formData.provider === 'ollama' ? '本地模型无需 API Key' : '输入你的 API Key'}
                  required={formData.provider !== 'ollama'}
                  className="w-full px-4 py-2.5 bg-surface-container-low rounded-lg text-sm text-on-surface placeholder:text-outline outline-none focus:ring-2 focus:ring-primary/30 transition-shadow"
                />
                <button
                  type="button"
                  onClick={() => setShowApiKey(!showApiKey)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-outline hover:text-on-surface transition-colors"
                >
                  {showApiKey ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
            </div>

            {/* Base URL + Model side by side */}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-semibold text-on-surface-variant mb-2 uppercase tracking-wider">Base URL</label>
                <input
                  type="url"
                  value={formData.baseUrl}
                  onChange={(e) => setFormData((prev) => ({ ...prev, baseUrl: e.target.value }))}
                  placeholder="https://api.example.com/v1"
                  required
                  className="w-full px-3 py-2.5 bg-surface-container-low rounded-lg text-sm text-on-surface placeholder:text-outline outline-none focus:ring-2 focus:ring-primary/30 transition-shadow font-mono"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-on-surface-variant mb-2 uppercase tracking-wider">模型</label>
                <input
                  type="text"
                  value={formData.model}
                  onChange={(e) => setFormData((prev) => ({ ...prev, model: e.target.value }))}
                  placeholder="模型名称"
                  required
                  className="w-full px-3 py-2.5 bg-surface-container-low rounded-lg text-sm text-on-surface placeholder:text-outline outline-none focus:ring-2 focus:ring-primary/30 transition-shadow font-mono"
                />
              </div>
            </div>
            <p className="text-[11px] text-on-surface-variant/70 -mt-1 leading-relaxed">
              部分模型的 Coding Plan 与计费版 API 地址不同，请到服务商官网核对后再填。
            </p>

            {/* Test Result */}
            {testResult && (
              <div className={`flex items-center gap-2 px-4 py-3 rounded-lg text-sm ${
                testResult.success ? 'bg-primary/10 text-primary' : 'bg-error/10 text-error'
              }`}>
                <CheckCircle size={16} className="shrink-0" />
                {testResult.message}
              </div>
            )}

            {/* Actions */}
            <div className="flex items-center gap-3 pt-1">
              <button
                type="submit"
                className="flex-1 px-6 py-3 bg-primary text-on-primary rounded-lg text-sm font-bold active:scale-[0.98] transition-transform flex items-center justify-center gap-2"
              >
                保存并继续
                <ArrowRight size={16} />
              </button>
              <button
                type="button"
                onClick={handleTest}
                disabled={testing || (!formData.apiKey && formData.provider !== 'ollama')}
                className="px-5 py-3 bg-surface-container-high text-on-surface rounded-lg text-sm font-medium hover:bg-surface-container-highest active:scale-[0.98] transition-all disabled:opacity-40 inline-flex items-center gap-1.5"
              >
                {testing ? <Loader2 size={14} className="animate-spin" /> : <Zap size={14} />}
                {testing ? '测试中...' : '测试'}
              </button>
            </div>
          </form>

          {/* Footer link */}
          <p className="text-center mt-6 text-sm text-on-surface-variant">
            已有配置？<button onClick={() => navigate('/characters')} className="text-primary font-semibold hover:underline">直接去角色页</button>
          </p>
        </div>
      </main>
    </div>
  );
}
