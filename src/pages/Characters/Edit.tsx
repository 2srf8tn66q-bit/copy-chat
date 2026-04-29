import { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, ChevronDown, ChevronRight, Save, X, Plus, Trash2 } from 'lucide-react';
import { useCharacterStore } from '../../stores/characterStore';
import { saveCharacter, getCharacter as getCharacterFromDB } from '../../services/storage';
import type { Character } from '../../types/character';

type PanelKey = 'identity' | 'persona' | 'memories' | 'voiceFingerprint';

interface PanelState {
  identity: boolean;
  persona: boolean;
  memories: boolean;
  voiceFingerprint: boolean;
}

export default function CharacterEditPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const getCharacter = useCharacterStore((s) => s.getCharacter);
  const addCharacter = useCharacterStore((s) => s.addCharacter);
  const updateCharacter = useCharacterStore((s) => s.updateCharacter);

  const [character, setCharacter] = useState<Character | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [panels, setPanels] = useState<PanelState>({
    identity: true,
    persona: false,
    memories: false,
    voiceFingerprint: false,
  });

  // 加载角色数据（store → IndexedDB 回退）
  useEffect(() => {
    if (!id) {
      setLoading(false);
      return;
    }

    const loadCharacter = async () => {
      let char = getCharacter(id);
      if (!char) {
        char = (await getCharacterFromDB(id)) ?? undefined;
        if (char) addCharacter(char);
      }
      return char;
    };

    loadCharacter().then((char) => {
      if (char) setCharacter({ ...(char as Character) });
      setLoading(false);
    });
  }, [id, getCharacter, addCharacter]);

  // 切换面板
  const togglePanel = useCallback((key: PanelKey) => {
    setPanels(prev => ({ ...prev, [key]: !prev[key] }));
  }, []);

  // 更新字段的通用方法
  const updateField = useCallback((path: string, value: unknown) => {
    if (!character) return;
    const keys = path.split('.');
    const updated = JSON.parse(JSON.stringify(character)) as Character;
    let target: Record<string, unknown> = updated;
    for (let i = 0; i < keys.length - 1; i++) {
      target = target[keys[i]] as Record<string, unknown>;
    }
    target[keys[keys.length - 1]] = value;
    setCharacter(updated);
  }, [character]);

  // 更新数组字段的某个元素
  const updateArrayItem = useCallback((path: string, index: number, value: string) => {
    if (!character) return;
    const keys = path.split('.');
    const updated = JSON.parse(JSON.stringify(character)) as Character;
    let target: Record<string, unknown> = updated;
    for (let i = 0; i < keys.length - 1; i++) {
      target = target[keys[i]] as Record<string, unknown>;
    }
    const arr = target[keys[keys.length - 1]] as string[];
    arr[index] = value;
    setCharacter(updated);
  }, [character]);

  // 添加数组项
  const addArrayItem = useCallback((path: string) => {
    if (!character) return;
    const keys = path.split('.');
    const updated = JSON.parse(JSON.stringify(character)) as Character;
    let target: Record<string, unknown> = updated;
    for (let i = 0; i < keys.length - 1; i++) {
      target = target[keys[i]] as Record<string, unknown>;
    }
    const arr = target[keys[keys.length - 1]] as string[];
    arr.push('');
    setCharacter(updated);
  }, [character]);

  // 删除数组项
  const removeArrayItem = useCallback((path: string, index: number) => {
    if (!character) return;
    const keys = path.split('.');
    const updated = JSON.parse(JSON.stringify(character)) as Character;
    let target: Record<string, unknown> = updated;
    for (let i = 0; i < keys.length - 1; i++) {
      target = target[keys[i]] as Record<string, unknown>;
    }
    const arr = target[keys[keys.length - 1]] as string[];
    arr.splice(index, 1);
    setCharacter(updated);
  }, [character]);

  // 保存
  const handleSave = useCallback(async () => {
    if (!character || !id) return;
    setSaving(true);
    try {
      updateCharacter(id, character);
      await saveCharacter(character);
      navigate(-1);
    } catch (err) {
      console.error('保存失败:', err);
    } finally {
      setSaving(false);
    }
  }, [character, id, updateCharacter, navigate]);

  // 取消
  const handleCancel = useCallback(() => {
    navigate(-1);
  }, [navigate]);

  // ─── 渲染辅助 ──────────────────────────────────────

  const renderPanelHeader = (key: PanelKey, title: string, icon: string) => (
    <button
      onClick={() => togglePanel(key)}
      className="w-full flex items-center justify-between p-4 rounded-t-xl transition-colors"
      style={{ backgroundColor: 'var(--color-surface-container-low)' }}
    >
      <div className="flex items-center gap-2">
        <span className="text-lg">{icon}</span>
        <span className="font-semibold text-sm" style={{ color: 'var(--color-on-surface)' }}>{title}</span>
      </div>
      {panels[key] ? <ChevronDown size={18} style={{ color: 'var(--color-on-surface-variant)' }} /> : <ChevronRight size={18} style={{ color: 'var(--color-on-surface-variant)' }} />}
    </button>
  );

  const renderInput = (label: string, path: string, value: string, placeholder?: string) => (
    <div className="mb-3">
      <label className="block text-xs font-medium mb-1" style={{ color: 'var(--color-on-surface-variant)' }}>{label}</label>
      <input
        type="text"
        className="w-full px-3 py-2 rounded-lg text-sm focus:outline-none focus:ring-2"
        style={{
          backgroundColor: 'var(--color-surface)',
          color: 'var(--color-on-surface)',
          border: '1px solid var(--color-outline-variant)',
          '--tw-ring-color': 'var(--color-primary)',
        } as React.CSSProperties}
        value={value}
        onChange={(e) => updateField(path, e.target.value)}
        placeholder={placeholder}
      />
    </div>
  );

  const renderTextarea = (label: string, path: string, value: string, rows?: number, placeholder?: string) => (
    <div className="mb-3">
      <label className="block text-xs font-medium mb-1" style={{ color: 'var(--color-on-surface-variant)' }}>{label}</label>
      <textarea
        className="w-full px-3 py-2 rounded-lg text-sm resize-none focus:outline-none focus:ring-2"
        style={{
          backgroundColor: 'var(--color-surface)',
          color: 'var(--color-on-surface)',
          border: '1px solid var(--color-outline-variant)',
          '--tw-ring-color': 'var(--color-primary)',
        } as React.CSSProperties}
        rows={rows || 3}
        value={value}
        onChange={(e) => updateField(path, e.target.value)}
        placeholder={placeholder}
      />
    </div>
  );

  const renderStringArray = (label: string, path: string, items: string[], addLabel?: string) => (
    <div className="mb-3">
      <div className="flex items-center justify-between mb-1">
        <label className="text-xs font-medium" style={{ color: 'var(--color-on-surface-variant)' }}>{label}</label>
        <button
          onClick={() => addArrayItem(path)}
          className="flex items-center gap-1 text-xs px-2 py-0.5 rounded transition-colors"
          style={{ color: 'var(--color-primary)' }}
        >
          <Plus size={12} />
          {addLabel || '添加'}
        </button>
      </div>
      <div className="space-y-1.5">
        {items.map((item, i) => (
          <div key={i} className="flex items-center gap-1">
            <input
              type="text"
              className="flex-1 px-2 py-1 rounded text-sm focus:outline-none focus:ring-1"
              style={{
                backgroundColor: 'var(--color-surface)',
                color: 'var(--color-on-surface)',
                border: '1px solid var(--color-outline-variant)',
                '--tw-ring-color': 'var(--color-primary)',
              } as React.CSSProperties}
              value={item}
              onChange={(e) => updateArrayItem(path, i, e.target.value)}
            />
            <button
              onClick={() => removeArrayItem(path, i)}
              className="p-1 rounded transition-colors hover:opacity-70"
              style={{ color: 'var(--color-error)' }}
            >
              <Trash2 size={14} />
            </button>
          </div>
        ))}
      </div>
    </div>
  );

  const renderSelect = (label: string, path: string, value: string, options: { value: string; label: string }[]) => (
    <div className="mb-3">
      <label className="block text-xs font-medium mb-1" style={{ color: 'var(--color-on-surface-variant)' }}>{label}</label>
      <select
        className="w-full px-3 py-2 rounded-lg text-sm focus:outline-none focus:ring-2"
        style={{
          backgroundColor: 'var(--color-surface)',
          color: 'var(--color-on-surface)',
          border: '1px solid var(--color-outline-variant)',
          '--tw-ring-color': 'var(--color-primary)',
        } as React.CSSProperties}
        value={value}
        onChange={(e) => updateField(path, e.target.value)}
      >
        {options.map(opt => (
          <option key={opt.value} value={opt.value}>{opt.label}</option>
        ))}
      </select>
    </div>
  );

  // ─── 主渲染 ──────────────────────────────────────────

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ backgroundColor: 'var(--color-surface)' }}>
        <p style={{ color: 'var(--color-on-surface-variant)' }}>加载中...</p>
      </div>
    );
  }

  if (!character) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center gap-4" style={{ backgroundColor: 'var(--color-surface)' }}>
        <p style={{ color: 'var(--color-on-surface-variant)' }}>角色不存在</p>
        <button
          onClick={() => navigate('/')}
          className="px-4 py-2 rounded-lg text-sm"
          style={{ backgroundColor: 'var(--color-primary)', color: 'var(--color-on-primary)' }}
        >
          返回首页
        </button>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col" style={{ backgroundColor: 'var(--color-surface)' }}>
      {/* 顶部导航 */}
      <div className="sticky top-0 z-10 border-b" style={{ borderColor: 'var(--color-outline-variant)', backgroundColor: 'var(--color-surface)' }}>
        <div className="max-w-2xl mx-auto px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <button
              onClick={handleCancel}
              className="p-1 rounded hover:opacity-70 transition-opacity"
              style={{ color: 'var(--color-on-surface)' }}
            >
              <ArrowLeft size={20} />
            </button>
            <h1 className="text-lg font-semibold" style={{ color: 'var(--color-on-surface)' }}>编辑角色画像</h1>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={handleCancel}
              className="px-3 py-1.5 rounded-lg text-sm transition-colors flex items-center gap-1"
              style={{ color: 'var(--color-on-surface-variant)' }}
            >
              <X size={14} />
              取消
            </button>
            <button
              onClick={handleSave}
              disabled={saving}
              className="px-3 py-1.5 rounded-lg text-sm font-medium transition-colors flex items-center gap-1 disabled:opacity-50"
              style={{ backgroundColor: 'var(--color-primary)', color: 'var(--color-on-primary)' }}
            >
              <Save size={14} />
              {saving ? '保存中...' : '保存'}
            </button>
          </div>
        </div>
      </div>

      {/* 角色名称头部 */}
      <div className="max-w-2xl mx-auto w-full px-4 py-4">
        <div className="flex items-center gap-3 p-4 rounded-xl" style={{ backgroundColor: 'var(--color-surface-container-low)' }}>
          <div
            className="w-12 h-12 rounded-full flex items-center justify-center text-lg font-bold"
            style={{ backgroundColor: 'var(--color-secondary)', color: 'var(--color-on-secondary)' }}
          >
            {character.identity.name.charAt(0)}
          </div>
          <div>
            <h2 className="font-semibold" style={{ color: 'var(--color-on-surface)' }}>{character.identity.name}</h2>
            <p className="text-xs" style={{ color: 'var(--color-on-surface-variant)' }}>
              {character.sourceType === 'text-paste' ? '文本导入' : character.sourceType === 'html-upload' ? 'HTML 导入' : '手动创建'}
            </p>
          </div>
        </div>
      </div>

      {/* 面板列表 */}
      <div className="max-w-2xl mx-auto w-full px-4 pb-24 space-y-2">
        {/* 身份面板 */}
        <div className="rounded-xl overflow-hidden" style={{ border: '1px solid var(--color-outline-variant)' }}>
          {renderPanelHeader('identity', '身份 (Identity)', '1')}
          {panels.identity && (
            <div className="p-4 space-y-0">
              {renderInput('名字', 'identity.name', character.identity.name, '对方的名字')}
              {renderInput('头像 URL', 'identity.avatar', character.identity.avatar, '留空使用默认头像')}
              {renderInput('年龄段', 'identity.ageEstimate', character.identity.ageEstimate, '如 25-30')}
              {renderInput('职业方向', 'identity.occupationHint', character.identity.occupationHint, '如 互联网/教育/学生')}
            </div>
          )}
        </div>

        {/* 人格面板 */}
        <div className="rounded-xl overflow-hidden" style={{ border: '1px solid var(--color-outline-variant)' }}>
          {renderPanelHeader('persona', '人格 (Persona)', '2')}
          {panels.persona && (
            <div className="p-4 space-y-0">
              {renderStringArray('性格标签', 'persona.personalityTags', character.persona.personalityTags, '添加标签')}
              {renderSelect('依恋类型', 'persona.attachmentStyle', character.persona.attachmentStyle, [
                { value: '', label: '未选择' },
                { value: '安全型', label: '安全型' },
                { value: '焦虑型', label: '焦虑型' },
                { value: '回避型', label: '回避型' },
                { value: '恐惧型', label: '恐惧型' },
              ])}
              {renderTextarea('说话风格', 'persona.speakingStyle', character.persona.speakingStyle, 2, '描述说话风格，50字以内')}
              {renderTextarea('情绪逻辑', 'persona.emotionalLogic', character.persona.emotionalLogic, 3, '描述情绪触发和表达模式')}
              {renderStringArray('常用表达', 'persona.typicalPhrases', character.persona.typicalPhrases, '添加表达')}
              {renderSelect('回复长度', 'persona.responseLength', character.persona.responseLength, [
                { value: 'short', label: '短' },
                { value: 'medium', label: '中等' },
                { value: 'long', label: '长' },
              ])}
            </div>
          )}
        </div>

        {/* 记忆面板 */}
        <div className="rounded-xl overflow-hidden" style={{ border: '1px solid var(--color-outline-variant)' }}>
          {renderPanelHeader('memories', '记忆 (Memories)', '3')}
          {panels.memories && (
            <div className="p-4 space-y-0">
              {renderStringArray('关系时间线', 'memories.relationshipTimeline', character.memories.relationshipTimeline, '添加节点')}
              {renderStringArray('共同去过的地方', 'memories.sharedPlaces', character.memories.sharedPlaces, '添加地点')}
              {renderStringArray('专属梗/玩笑', 'memories.insideJokes', character.memories.insideJokes, '添加梗')}
              {renderStringArray('冲突模式', 'memories.conflictPatterns', character.memories.conflictPatterns, '添加模式')}
            </div>
          )}
        </div>

        {/* 语料指纹面板 */}
        <div className="rounded-xl overflow-hidden" style={{ border: '1px solid var(--color-outline-variant)' }}>
          {renderPanelHeader('voiceFingerprint', '语料指纹 (Voice Fingerprint)', '4')}
          {panels.voiceFingerprint && (
            <div className="p-4 space-y-4">
              {/* 语录分类 */}
              <div>
                <h3 className="text-sm font-medium mb-3" style={{ color: 'var(--color-on-surface)' }}>真实语录</h3>
                <div className="space-y-3">
                  <div className="p-3 rounded-lg" style={{ backgroundColor: 'var(--color-surface-container-low)' }}>
                    <p className="text-xs font-medium mb-1" style={{ color: 'var(--color-tertiary)' }}>生气/不满</p>
                    {renderStringArray('', 'voiceFingerprint.quotes.angry', character.voiceFingerprint.quotes.angry, '添加语录')}
                  </div>
                  <div className="p-3 rounded-lg" style={{ backgroundColor: 'var(--color-surface-container-low)' }}>
                    <p className="text-xs font-medium mb-1" style={{ color: 'var(--color-primary)' }}>甜蜜/亲密</p>
                    {renderStringArray('', 'voiceFingerprint.quotes.sweet', character.voiceFingerprint.quotes.sweet, '添加语录')}
                  </div>
                  <div className="p-3 rounded-lg" style={{ backgroundColor: 'var(--color-surface-container-low)' }}>
                    <p className="text-xs font-medium mb-1" style={{ color: 'var(--color-on-surface-variant)' }}>讽刺/冷漠</p>
                    {renderStringArray('', 'voiceFingerprint.quotes.sarcastic', character.voiceFingerprint.quotes.sarcastic, '添加语录')}
                  </div>
                  <div className="p-3 rounded-lg" style={{ backgroundColor: 'var(--color-surface-container-low)' }}>
                    <p className="text-xs font-medium mb-1" style={{ color: 'var(--color-secondary)' }}>日常</p>
                    {renderStringArray('', 'voiceFingerprint.quotes.daily', character.voiceFingerprint.quotes.daily, '添加语录')}
                  </div>
                  <div className="p-3 rounded-lg" style={{ backgroundColor: 'var(--color-surface-container-low)' }}>
                    <p className="text-xs font-medium mb-1" style={{ color: 'var(--color-primary-container)' }}>关心/担忧</p>
                    {renderStringArray('', 'voiceFingerprint.quotes.concerned', character.voiceFingerprint.quotes.concerned, '添加语录')}
                  </div>
                </div>
              </div>

              {/* 习惯 */}
              <div>
                <h3 className="text-sm font-medium mb-3" style={{ color: 'var(--color-on-surface)' }}>沟通习惯</h3>
                {renderSelect('Emoji 使用频率', 'voiceFingerprint.habits.emojiFrequency', character.voiceFingerprint.habits.emojiFrequency, [
                  { value: 'none', label: '从不' },
                  { value: 'rare', label: '偶尔' },
                  { value: 'normal', label: '正常' },
                  { value: 'heavy', label: '重度' },
                ])}
                {renderStringArray('常用 Emoji', 'voiceFingerprint.habits.frequentEmojis', character.voiceFingerprint.habits.frequentEmojis, '添加 Emoji')}
                {renderStringArray('口癖', 'voiceFingerprint.habits.catchphrases', character.voiceFingerprint.habits.catchphrases, '添加口癖')}
                {renderInput('平均消息长度（字）', 'voiceFingerprint.habits.avgMessageLength', String(character.voiceFingerprint.habits.avgMessageLength))}
                {renderSelect('反问频率', 'voiceFingerprint.habits.rhetoricalFreq', character.voiceFingerprint.habits.rhetoricalFreq, [
                  { value: 'high', label: '高' },
                  { value: 'medium', label: '中等' },
                  { value: 'low', label: '低' },
                ])}
                {renderSelect('标点风格', 'voiceFingerprint.habits.punctuationStyle', character.voiceFingerprint.habits.punctuationStyle, [
                  { value: 'minimal', label: '极少标点' },
                  { value: 'normal', label: '正常' },
                  { value: 'ellipsis', label: '爱用省略号' },
                  { value: 'exclamation', label: '爱用感叹号' },
                ])}
              </div>

              {/* 行为模式 */}
              <div>
                <h3 className="text-sm font-medium mb-3" style={{ color: 'var(--color-on-surface)' }}>行为模式</h3>
                {renderTextarea('被逼问/施压时', 'voiceFingerprint.patterns.whenPushed', character.voiceFingerprint.patterns.whenPushed, 2)}
                {renderTextarea('生气时', 'voiceFingerprint.patterns.whenAngry', character.voiceFingerprint.patterns.whenAngry, 2)}
                {renderTextarea('惊讶时', 'voiceFingerprint.patterns.whenSurprised', character.voiceFingerprint.patterns.whenSurprised, 2)}
                {renderTextarea('被感动时', 'voiceFingerprint.patterns.whenMoved', character.voiceFingerprint.patterns.whenMoved, 2)}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* 底部操作栏 */}
      <div className="fixed bottom-0 left-0 right-0 border-t py-3 px-4" style={{ backgroundColor: 'var(--color-surface)', borderColor: 'var(--color-outline-variant)' }}>
        <div className="max-w-2xl mx-auto flex gap-3">
          <button
            onClick={handleCancel}
            className="flex-1 px-4 py-2.5 rounded-lg text-sm font-medium transition-colors"
            style={{
              backgroundColor: 'var(--color-surface-container-high)',
              color: 'var(--color-on-surface)',
            }}
          >
            取消
          </button>
          <button
            onClick={handleSave}
            disabled={saving}
            className="flex-1 px-4 py-2.5 rounded-lg text-sm font-medium transition-colors flex items-center justify-center gap-1 disabled:opacity-50"
            style={{
              backgroundColor: 'var(--color-primary)',
              color: 'var(--color-on-primary)',
            }}
          >
            <Save size={14} />
            {saving ? '保存中...' : '保存'}
          </button>
        </div>
      </div>
    </div>
  );
}
