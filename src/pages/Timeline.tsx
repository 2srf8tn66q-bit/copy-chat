import { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, Plus, X, ChevronRight } from 'lucide-react';
import { useCharacterStore } from '../stores/characterStore';
import { getCharacter as getCharacterFromDB } from '../services/storage';
import type { Character } from '../types/character';
import type { TimelineEvent } from '../types/timeline';
import { saveTimelineEvents, getTimelineEvents } from '../services/storage';
import type { WorldRule } from '../types/world';

// ─── 事件类型配置 ──────────────────────────────────────

const EVENT_TYPE_CONFIG: Record<TimelineEvent['type'], { label: string; color: string; bgColor: string }> = {
  conflict: { label: '冲突', color: 'var(--color-tertiary)', bgColor: 'rgba(172, 46, 74, 0.1)' },
  confession: { label: '表白', color: 'var(--color-primary)', bgColor: 'rgba(0, 109, 51, 0.1)' },
  plan: { label: '约定', color: 'var(--color-secondary)', bgColor: 'rgba(74, 94, 135, 0.1)' },
  turning_point: { label: '转折', color: 'var(--color-tertiary-container)', bgColor: 'rgba(247, 103, 128, 0.1)' },
  separation: { label: '分离', color: 'var(--color-error)', bgColor: 'rgba(186, 26, 26, 0.1)' },
  reunion: { label: '重逢', color: 'var(--color-primary-container)', bgColor: 'rgba(0, 174, 85, 0.1)' },
  daily_share: { label: '日常', color: 'var(--color-on-surface-variant)', bgColor: 'var(--color-surface-container-low)' },
};

// ─── 组件 ──────────────────────────────────────────────

interface ManualEventForm {
  date: string;
  summary: string;
  type: TimelineEvent['type'];
  emotionalArc: string;
  isKeyEvent: boolean;
}

export default function TimelinePage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const getCharacter = useCharacterStore((s) => s.getCharacter);
  const addCharacter = useCharacterStore((s) => s.addCharacter);

  const [character, setCharacter] = useState<Character | null>(null);
  const [events, setEvents] = useState<TimelineEvent[]>([]);
  const [selectedEventId, setSelectedEventId] = useState<string | null>(null);
  const [worldRule, setWorldRule] = useState<WorldRule>('free');
  const [showAddForm, setShowAddForm] = useState(false);
  const [loading, setLoading] = useState(true);
  const [newEvent, setNewEvent] = useState<ManualEventForm>({
    date: '',
    summary: '',
    type: 'daily_share',
    emotionalArc: '',
    isKeyEvent: false,
  });

  // 加载角色数据（store → IndexedDB 回退）
  useEffect(() => {
    if (!id) return;

    const loadCharacter = async () => {
      let char = getCharacter(id);
      if (!char) {
        char = (await getCharacterFromDB(id)) ?? undefined;
        if (char) addCharacter(char);
      }
      return char;
    };

    loadCharacter().then((char) => {
      if (char) setCharacter(char as Character);
      setLoading(false);
    });

    // Load persisted timeline events
    if (id) {
      getTimelineEvents(id).then((persisted) => {
        if (persisted.length > 0) setEvents(persisted);
      });
    }
  }, [id, getCharacter, addCharacter]);

  // Persist events whenever they change
  useEffect(() => {
    if (id && events.length > 0) {
      saveTimelineEvents(id, events);
    }
  }, [id, events]);

  // ─── 手动添加事件 ────────────────────────────────

  const handleAddEvent = useCallback(() => {
    if (!newEvent.date || !newEvent.summary) return;

    const event: TimelineEvent = {
      id: `evt_${Date.now()}`,
      date: newEvent.date,
      type: newEvent.type,
      summary: newEvent.summary,
      originalMessages: [],
      emotionalArc: newEvent.emotionalArc,
      isKeyEvent: newEvent.isKeyEvent,
      speaker: 'character',
      source: 'manual',
      status: 'pending',
    };

    setEvents(prev => [...prev, event].sort((a, b) => a.date.localeCompare(b.date)));
    setShowAddForm(false);
    setNewEvent({
      date: '',
      summary: '',
      type: 'daily_share',
      emotionalArc: '',
      isKeyEvent: false,
    });
  }, [newEvent]);

  // 删除手动事件
  const handleRemoveEvent = useCallback((eventId: string) => {
    setEvents(prev => prev.filter(e => !(e.id === eventId && e.source === 'manual')));
  }, []);

  // ─── 开始 IF 线 ──────────────────────────────────

  const canStartIF = selectedEventId !== null && worldRule !== null;
  const selectedEvent = events.find(e => e.id === selectedEventId);

  const handleStartIF = useCallback(() => {
    if (!canStartIF || !id || !selectedEvent) return;
    // 导航到 WhatIf 页面，传递参数
    navigate(`/characters/${id}/whatif?eventId=${selectedEventId}&rule=${worldRule}&startDate=${selectedEvent.date}`);
  }, [canStartIF, id, selectedEventId, selectedEvent, worldRule, navigate]);

  // ─── 渲染 ──────────────────────────────────────────

  if (loading) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center" style={{ backgroundColor: 'var(--color-surface)' }}>
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
        <div className="max-w-2xl mx-auto px-4 py-3 flex items-center gap-3">
          <button
            onClick={() => navigate('/characters')}
            className="p-1 rounded hover:opacity-70 transition-opacity"
            style={{ color: 'var(--color-on-surface)' }}
          >
            <ArrowLeft size={20} />
          </button>
          <div className="flex-1">
            <h1 className="text-lg font-semibold" style={{ color: 'var(--color-on-surface)' }}>IF 线 · 时间轴</h1>
            <p className="text-xs" style={{ color: 'var(--color-on-surface-variant)' }}>{character.identity.name}</p>
          </div>
          <button
            onClick={() => setShowAddForm(true)}
            className="p-2 rounded-lg transition-colors"
            style={{ backgroundColor: 'var(--color-primary)', color: 'var(--color-on-primary)' }}
          >
            <Plus size={18} />
          </button>
        </div>
      </div>

      {/* 时间轴内容 */}
      <div className="flex-1 max-w-2xl mx-auto w-full px-4 py-6">
        {events.length === 0 ? (
          <div className="text-center py-12">
            <p className="text-sm mb-2" style={{ color: 'var(--color-on-surface-variant)' }}>暂无时间轴事件</p>
            <p className="text-xs mb-4" style={{ color: 'var(--color-on-surface-variant)' }}>
              通过导入聊天记录自动生成，或手动添加事件
            </p>
            <button
              onClick={() => setShowAddForm(true)}
              className="inline-flex items-center gap-1 px-4 py-2 rounded-lg text-sm font-medium transition-colors"
              style={{ backgroundColor: 'var(--color-primary)', color: 'var(--color-on-primary)' }}
            >
              <Plus size={14} />
              手动添加事件
            </button>
          </div>
        ) : (
          <div className="relative">
            {/* 垂直线 */}
            <div
              className="absolute left-[11px] top-0 bottom-0 w-0.5"
              style={{ backgroundColor: 'var(--color-secondary)' }}
            />

            <div className="space-y-4">
              {events.map((event) => {
                const config = EVENT_TYPE_CONFIG[event.type];
                const isSelected = selectedEventId === event.id;

                return (
                  <div
                    key={event.id}
                    className="relative pl-10 cursor-pointer group"
                    onClick={() => setSelectedEventId(isSelected ? null : event.id)}
                  >
                    {/* 事件节点圆点 */}
                    <div
                      className="absolute left-[3px] top-4 w-[17px] h-[17px] rounded-full border-2 transition-all"
                      style={{
                        borderColor: event.isKeyEvent ? 'var(--color-tertiary)' : 'var(--color-secondary)',
                        backgroundColor: isSelected
                          ? (event.isKeyEvent ? 'var(--color-tertiary)' : 'var(--color-secondary)')
                          : 'var(--color-surface)',
                        borderStyle: event.source === 'manual' ? 'dashed' : 'solid',
                      }}
                    />

                    {/* 事件卡片 */}
                    <div
                      className="p-3 rounded-lg transition-all"
                      style={{
                        backgroundColor: isSelected ? config.bgColor : 'var(--color-surface-container-lowest)',
                        border: `1px solid ${isSelected ? config.color : 'var(--color-outline-variant)'}`,
                      }}
                    >
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-1">
                            <span className="text-xs font-mono" style={{ color: 'var(--color-on-surface-variant)' }}>
                              {event.date}
                            </span>
                            <span
                              className="text-xs px-1.5 py-0.5 rounded-full"
                              style={{ backgroundColor: config.bgColor, color: config.color }}
                            >
                              {config.label}
                            </span>
                            {event.isKeyEvent && (
                              <span
                                className="text-xs px-1.5 py-0.5 rounded-full font-medium"
                                style={{ backgroundColor: 'rgba(172, 46, 74, 0.15)', color: 'var(--color-tertiary)' }}
                              >
                                关键
                              </span>
                            )}
                            {event.source === 'manual' && (
                              <span className="text-xs" style={{ color: 'var(--color-on-surface-variant)' }}>手动</span>
                            )}
                          </div>
                          <p className="text-sm" style={{ color: 'var(--color-on-surface)' }}>{event.summary}</p>
                          {event.emotionalArc && (
                            <p className="text-xs mt-1" style={{ color: 'var(--color-on-surface-variant)' }}>
                              {event.emotionalArc}
                            </p>
                          )}
                        </div>

                        {/* 手动事件删除按钮 */}
                        {event.source === 'manual' && (
                          <button
                            onClick={(e) => { e.stopPropagation(); handleRemoveEvent(event.id); }}
                            className="p-1 rounded opacity-0 group-hover:opacity-70 transition-opacity"
                            style={{ color: 'var(--color-error)' }}
                          >
                            <X size={14} />
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>

      {/* 底部面板：世界线规则 + 开始按钮 */}
      <div className="sticky bottom-0 border-t" style={{ borderColor: 'var(--color-outline-variant)', backgroundColor: 'var(--color-surface)' }}>
        <div className="max-w-2xl mx-auto px-4 py-3">
          {/* 选中起点提示 */}
          {selectedEvent && (
            <div className="mb-3 p-2 rounded-lg text-xs flex items-center gap-2" style={{ backgroundColor: 'var(--color-primary-fixed)', color: 'var(--color-on-primary-fixed)' }}>
              <span>起点：{selectedEvent.date} - {selectedEvent.summary}</span>
            </div>
          )}

          {/* 世界线规则选择 */}
          <div className="grid grid-cols-2 gap-2 mb-3">
            <button
              onClick={() => setWorldRule('free')}
              className="p-3 rounded-lg text-left transition-all"
              style={{
                backgroundColor: worldRule === 'free' ? 'var(--color-primary-fixed)' : 'var(--color-surface-container-low)',
                border: `2px solid ${worldRule === 'free' ? 'var(--color-primary)' : 'transparent'}`,
              }}
            >
              <p className="text-sm font-semibold" style={{ color: 'var(--color-on-surface)' }}>自由意志</p>
              <p className="text-xs mt-0.5" style={{ color: 'var(--color-on-surface-variant)' }}>
                你的每个选择都会真实改变走向
              </p>
            </button>
            <button
              onClick={() => setWorldRule('fated')}
              className="p-3 rounded-lg text-left transition-all"
              style={{
                backgroundColor: worldRule === 'fated' ? 'var(--color-surface-container-high)' : 'var(--color-surface-container-low)',
                border: `2px solid ${worldRule === 'fated' ? 'var(--color-tertiary)' : 'transparent'}`,
              }}
            >
              <p className="text-sm font-semibold" style={{ color: 'var(--color-on-surface)' }}>宿命论</p>
              <p className="text-xs mt-0.5" style={{ color: 'var(--color-on-surface-variant)' }}>
                某些事件注定会发生
              </p>
            </button>
          </div>

          {/* 开始 IF 线按钮 */}
          <button
            onClick={handleStartIF}
            disabled={!canStartIF}
            className="w-full px-4 py-2.5 rounded-lg text-sm font-medium transition-colors flex items-center justify-center gap-2 disabled:opacity-40"
            style={{
              backgroundColor: 'var(--color-secondary)',
              color: 'var(--color-on-secondary)',
            }}
          >
            开始 IF 线
            <ChevronRight size={16} />
          </button>
          {!selectedEventId && (
            <p className="text-xs text-center mt-1" style={{ color: 'var(--color-on-surface-variant)' }}>
              请在上方时间轴中选择一个起点事件
            </p>
          )}
        </div>
      </div>

      {/* 添加事件弹窗 */}
      {showAddForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ backgroundColor: 'rgba(0,0,0,0.5)' }}>
          <div className="w-full max-w-md rounded-xl p-5" style={{ backgroundColor: 'var(--color-surface-container-lowest)' }}>
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-base font-semibold" style={{ color: 'var(--color-on-surface)' }}>添加事件</h2>
              <button onClick={() => setShowAddForm(false)} style={{ color: 'var(--color-on-surface-variant)' }}>
                <X size={18} />
              </button>
            </div>

            <div className="space-y-3">
              <div>
                <label className="block text-xs font-medium mb-1" style={{ color: 'var(--color-on-surface-variant)' }}>日期</label>
                <input
                  type="date"
                  className="w-full px-3 py-2 rounded-lg text-sm focus:outline-none focus:ring-2"
                  style={{
                    backgroundColor: 'var(--color-surface)',
                    color: 'var(--color-on-surface)',
                    border: '1px solid var(--color-outline-variant)',
                  }}
                  value={newEvent.date}
                  onChange={(e) => setNewEvent(prev => ({ ...prev, date: e.target.value }))}
                />
              </div>

              <div>
                <label className="block text-xs font-medium mb-1" style={{ color: 'var(--color-on-surface-variant)' }}>事件描述</label>
                <textarea
                  className="w-full px-3 py-2 rounded-lg text-sm resize-none focus:outline-none focus:ring-2"
                  style={{
                    backgroundColor: 'var(--color-surface)',
                    color: 'var(--color-on-surface)',
                    border: '1px solid var(--color-outline-variant)',
                  }}
                  rows={3}
                  value={newEvent.summary}
                  onChange={(e) => setNewEvent(prev => ({ ...prev, summary: e.target.value }))}
                  placeholder="描述这个事件..."
                />
              </div>

              <div>
                <label className="block text-xs font-medium mb-1" style={{ color: 'var(--color-on-surface-variant)' }}>事件类型</label>
                <select
                  className="w-full px-3 py-2 rounded-lg text-sm focus:outline-none focus:ring-2"
                  style={{
                    backgroundColor: 'var(--color-surface)',
                    color: 'var(--color-on-surface)',
                    border: '1px solid var(--color-outline-variant)',
                  }}
                  value={newEvent.type}
                  onChange={(e) => setNewEvent(prev => ({ ...prev, type: e.target.value as TimelineEvent['type'] }))}
                >
                  <option value="conflict">冲突</option>
                  <option value="confession">表白</option>
                  <option value="plan">约定</option>
                  <option value="turning_point">转折</option>
                  <option value="separation">分离</option>
                  <option value="reunion">重逢</option>
                  <option value="daily_share">日常</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-medium mb-1" style={{ color: 'var(--color-on-surface-variant)' }}>情绪走向</label>
                <input
                  type="text"
                  className="w-full px-3 py-2 rounded-lg text-sm focus:outline-none focus:ring-2"
                  style={{
                    backgroundColor: 'var(--color-surface)',
                    color: 'var(--color-on-surface)',
                    border: '1px solid var(--color-outline-variant)',
                  }}
                  value={newEvent.emotionalArc}
                  onChange={(e) => setNewEvent(prev => ({ ...prev, emotionalArc: e.target.value }))}
                  placeholder="如：从平静到愤怒"
                />
              </div>

              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  id="isKeyEvent"
                  checked={newEvent.isKeyEvent}
                  onChange={(e) => setNewEvent(prev => ({ ...prev, isKeyEvent: e.target.checked }))}
                  className="w-4 h-4 rounded"
                  style={{ accentColor: 'var(--color-tertiary)' }}
                />
                <label htmlFor="isKeyEvent" className="text-sm" style={{ color: 'var(--color-on-surface)' }}>
                  标记为关键事件
                </label>
              </div>
            </div>

            <div className="flex gap-3 mt-4">
              <button
                onClick={() => setShowAddForm(false)}
                className="flex-1 px-4 py-2 rounded-lg text-sm"
                style={{
                  backgroundColor: 'var(--color-surface-container-high)',
                  color: 'var(--color-on-surface)',
                }}
              >
                取消
              </button>
              <button
                onClick={handleAddEvent}
                disabled={!newEvent.date || !newEvent.summary}
                className="flex-1 px-4 py-2 rounded-lg text-sm font-medium disabled:opacity-50"
                style={{
                  backgroundColor: 'var(--color-primary)',
                  color: 'var(--color-on-primary)',
                }}
              >
                添加
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
