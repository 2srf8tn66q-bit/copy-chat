import { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, Plus, X, ChevronRight, MessageCircle, Trash2 } from 'lucide-react';
import { useCharacterStore } from '../stores/characterStore';
import { getCharacter as getCharacterFromDB } from '../services/storage';
import type { Character } from '../types/character';
import type { TimelineEvent } from '../types/timeline';
import { saveTimelineEvents, getTimelineEvents, getAllIFChatSessions, deleteIFChatSession } from '../services/storage';
import type { IFChatSession } from '../services/storage';
import type { WorldRule } from '../types/world';
import LoadingState from '../components/LoadingState';

// ─── 工具函数 ──────────────────────────────────────────

function formatTimeAgo(isoString: string): string {
  const now = Date.now();
  const then = new Date(isoString).getTime();
  if (isNaN(then)) return '';
  const diff = now - then;
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return '刚刚';
  if (mins < 60) return `${mins} 分钟前`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours} 小时前`;
  const days = Math.floor(hours / 24);
  if (days < 30) return `${days} 天前`;
  return new Date(isoString).toLocaleDateString('zh-CN');
}

// ─── 事件类型配置 ──────────────────────────────────────
// 事件标签：保留情绪色饱和度（用户特别指出）
// 灰蓝 secondary 全部替换为暖色 / 中性

const EVENT_TYPE_CONFIG: Record<TimelineEvent['type'], { label: string; color: string; bgColor: string }> = {
  conflict: { label: '冲突', color: '#F76780', bgColor: 'rgba(247, 103, 128, 0.12)' },
  confession: { label: '表白', color: 'var(--color-primary)', bgColor: 'rgba(15, 168, 118, 0.12)' },
  plan: { label: '约定', color: '#E5A95C', bgColor: 'rgba(229, 169, 92, 0.12)' },  // 暖琥珀色替换灰蓝
  turning_point: { label: '转折', color: '#C77DFF', bgColor: 'rgba(199, 125, 255, 0.12)' },  // 紫罗兰
  separation: { label: '分离', color: '#FF6B6B', bgColor: 'rgba(255, 107, 107, 0.12)' },
  reunion: { label: '重逢', color: '#3DD97A', bgColor: 'rgba(61, 217, 122, 0.12)' },
  daily_share: { label: '日常', color: 'rgba(255, 255, 255, 0.55)', bgColor: 'rgba(255, 255, 255, 0.04)' },
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
  const [ifSessions, setIfSessions] = useState<IFChatSession[]>([]);
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

    if (id) {
      getTimelineEvents(id).then((persisted) => {
        if (persisted.length > 0) setEvents(persisted);
      });
      getAllIFChatSessions(id).then(setIfSessions);
    }
  }, [id, getCharacter, addCharacter]);

  // Persist events whenever they change
  useEffect(() => {
    if (id && events.length > 0) {
      saveTimelineEvents(id, events);
    }
  }, [id, events]);

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
    setNewEvent({ date: '', summary: '', type: 'daily_share', emotionalArc: '', isKeyEvent: false });
  }, [newEvent]);

  const handleRemoveEvent = useCallback((eventId: string) => {
    setEvents(prev => prev.filter(e => !(e.id === eventId && e.source === 'manual')));
  }, []);

  const handleResumeSession = useCallback((session: IFChatSession) => {
    if (!id) return;
    navigate(`/characters/${id}/whatif?startDate=${session.startDate}&sessionId=${session.id}`);
  }, [id, navigate]);

  const handleDeleteSession = useCallback(async (sessionId: string) => {
    if (!id) return;
    await deleteIFChatSession(id, sessionId);
    setIfSessions(prev => prev.filter(s => s.id !== sessionId));
  }, [id]);

  const canStartIF = selectedEventId !== null && worldRule !== null;
  const selectedEvent = events.find(e => e.id === selectedEventId);

  const handleStartIF = useCallback(() => {
    if (!canStartIF || !id || !selectedEvent) return;
    navigate(`/characters/${id}/whatif?eventId=${selectedEventId}&rule=${worldRule}&startDate=${selectedEvent.date}`);
  }, [canStartIF, id, selectedEventId, selectedEvent, worldRule, navigate]);

  if (loading) {
    return <LoadingState />;
  }

  if (!character) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center gap-4" style={{ backgroundColor: 'var(--color-surface)' }}>
        <p style={{ color: 'var(--color-on-surface-variant)' }}>角色不存在</p>
        <button
          onClick={() => navigate('/')}
          className="btn-primary"
        >
          返回首页
        </button>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col" style={{ backgroundColor: 'var(--color-surface)' }}>
      {/* ── Top nav ── */}
      <div className="sticky top-0 z-20 border-b" style={{ borderColor: 'var(--color-outline-variant)', backgroundColor: 'var(--color-surface)' }}>
        <div className="max-w-[1280px] mx-auto px-6 md:px-10 py-4 flex items-center gap-3">
          <button
            onClick={() => navigate('/characters')}
            className="p-1 rounded hover:opacity-70 transition-opacity"
            style={{ color: 'var(--color-on-surface)' }}
          >
            <ArrowLeft size={20} />
          </button>
          <div className="flex-1">
            <p className="eyebrow text-[10px] mb-0.5">IF LINE · 时间轴</p>
            <h1 className="text-lg" style={{ color: 'var(--color-on-surface)', fontFamily: 'var(--font-serif)' }}>
              {character.identity.name}
            </h1>
          </div>
          <button
            onClick={() => setShowAddForm(true)}
            className="btn-primary inline-flex items-center gap-1.5"
          >
            <Plus size={14} />
            添加事件
          </button>
        </div>
      </div>

      {/* ── Main: 2-column grid (events left, history right) ── */}
      <div className="flex-1 max-w-[1280px] mx-auto w-full px-6 md:px-10 py-8 pb-48">
        <div className="grid grid-cols-1 lg:grid-cols-[1fr_360px] gap-8">

          {/* ─── LEFT: events timeline ─── */}
          <section>
            <h2 className="eyebrow mb-5 text-white/45">EVENTS · 时间轴事件</h2>

            {events.length === 0 ? (
              <div className="card-glass py-14 px-6 text-center">
                <p className="text-sm mb-2 text-white/70">还没有事件</p>
                <p className="text-xs mb-5 text-white/40">
                  导入聊天记录时会自动生成<br />也可以手动添加一些重要时刻
                </p>
                <button
                  onClick={() => setShowAddForm(true)}
                  className="btn-primary inline-flex items-center gap-1.5"
                >
                  <Plus size={14} />
                  手动添加事件
                </button>
              </div>
            ) : (
              <div className="relative">
                {/* 中性白色时间轴线 — 替换原灰蓝 */}
                <div
                  className="absolute left-[11px] top-2 bottom-2 w-px"
                  style={{ backgroundColor: 'rgba(255, 255, 255, 0.12)' }}
                />

                <div className="space-y-3">
                  {events.map((event) => {
                    const config = EVENT_TYPE_CONFIG[event.type];
                    const isSelected = selectedEventId === event.id;

                    return (
                      <div
                        key={event.id}
                        className="relative pl-10 cursor-pointer group"
                        onClick={() => setSelectedEventId(isSelected ? null : event.id)}
                      >
                        {/* 时间节点圆点 — selected 用品牌绿；关键事件用粉红 */}
                        <div
                          className="absolute left-[3px] top-4 w-[17px] h-[17px] rounded-full border-2 transition-all"
                          style={{
                            borderColor: event.isKeyEvent
                              ? '#F76780'
                              : isSelected ? 'var(--color-primary)' : 'rgba(255,255,255,0.25)',
                            backgroundColor: isSelected
                              ? (event.isKeyEvent ? '#F76780' : 'var(--color-primary)')
                              : 'var(--color-surface)',
                            borderStyle: event.source === 'manual' ? 'dashed' : 'solid',
                            boxShadow: isSelected ? '0 0 0 4px rgba(15, 168, 118, 0.15)' : 'none',
                          }}
                        />

                        {/* 事件卡片 */}
                        <div
                          className="p-4 rounded-xl transition-all"
                          style={{
                            backgroundColor: isSelected ? config.bgColor : 'rgba(255,255,255,0.025)',
                            border: `1px solid ${isSelected ? config.color : 'rgba(255,255,255,0.06)'}`,
                          }}
                        >
                          <div className="flex items-start justify-between gap-3">
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2 mb-1.5 flex-wrap">
                                <span className="text-xs font-mono text-white/45">
                                  {event.date}
                                </span>
                                <span
                                  className="text-[11px] px-2 py-0.5 rounded-full font-medium"
                                  style={{ backgroundColor: config.bgColor, color: config.color }}
                                >
                                  {config.label}
                                </span>
                                {event.isKeyEvent && (
                                  <span
                                    className="text-[11px] px-2 py-0.5 rounded-full font-medium"
                                    style={{ backgroundColor: 'rgba(247, 103, 128, 0.15)', color: '#F76780' }}
                                  >
                                    关键
                                  </span>
                                )}
                                {event.source === 'manual' && (
                                  <span className="text-[11px] text-white/35">手动</span>
                                )}
                              </div>
                              <p className="text-sm leading-relaxed text-white/90">{event.summary}</p>
                              {event.emotionalArc && (
                                <p className="text-xs mt-1.5 text-white/45">
                                  {event.emotionalArc}
                                </p>
                              )}
                            </div>

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
          </section>

          {/* ─── RIGHT: IF history sidebar (sticky) ─── */}
          <aside className="lg:sticky lg:top-[88px] lg:self-start">
            <h2 className="eyebrow mb-5 text-white/45 flex items-center gap-1.5">
              <MessageCircle size={11} />
              IF 历史 · {ifSessions.length}
            </h2>

            {ifSessions.length === 0 ? (
              <div className="card-glass p-6 text-center">
                <p className="text-xs text-white/40">
                  还没有 IF 线对话<br />
                  选个事件，开启第一段
                </p>
              </div>
            ) : (
              <div className="space-y-2 max-h-[calc(100vh-300px)] overflow-y-auto pr-1">
                {ifSessions.map((session) => (
                  <div
                    key={session.id}
                    onClick={() => handleResumeSession(session)}
                    className="group card-glass p-4 cursor-pointer"
                  >
                    <div className="flex items-start justify-between gap-2 mb-1.5">
                      <span className="text-[11px] font-mono text-white/45">
                        {session.startDate}
                      </span>
                      <div className="flex items-center gap-1 shrink-0">
                        <button
                          onClick={(e) => { e.stopPropagation(); handleDeleteSession(session.id); }}
                          className="p-1 rounded opacity-0 group-hover:opacity-60 hover:!opacity-100 transition-opacity"
                          style={{ color: 'var(--color-error)' }}
                          title="删除此记录"
                        >
                          <Trash2 size={12} />
                        </button>
                        <ChevronRight size={14} className="text-white/30 group-hover:text-white/70 group-hover:translate-x-0.5 transition-all" />
                      </div>
                    </div>

                    <p className="text-sm text-white/85 mb-2 line-clamp-2 leading-snug">
                      {session.contextPreview || '对话记录'}
                    </p>

                    {session.messages.length > 0 && (
                      <p className="text-[11px] text-white/40 line-clamp-1 italic">
                        {session.messages[session.messages.length - 1].sender === 'user' ? '你：' : `${character?.identity.name ?? 'TA'}：`}
                        {session.messages[session.messages.length - 1].content}
                      </p>
                    )}

                    <div className="flex items-center gap-2 mt-2.5 text-[10px] text-white/35">
                      <span>{session.messages.length} 条对话</span>
                      <span>·</span>
                      <span>{formatTimeAgo(session.updatedAt)}</span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </aside>
        </div>
      </div>

      {/* ── Bottom sticky: rule selector + huge green CTA ── */}
      <div
        className="fixed bottom-0 left-0 right-0 z-30 border-t backdrop-blur-xl"
        style={{
          borderColor: 'rgba(255, 255, 255, 0.08)',
          backgroundColor: 'rgba(10, 10, 11, 0.85)',
        }}
      >
        <div className="max-w-[1280px] mx-auto px-6 md:px-10 py-4">
          <div className="grid grid-cols-1 md:grid-cols-[1fr_auto] gap-4 items-center">

            {/* Left: selected event chip + rule selector */}
            <div className="space-y-2.5 min-w-0">
              {selectedEvent && (
                <div
                  className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-xs"
                  style={{ backgroundColor: 'rgba(15, 168, 118, 0.12)', color: 'var(--color-primary)' }}
                >
                  <span className="font-mono">{selectedEvent.date}</span>
                  <span className="text-white/50">·</span>
                  <span className="truncate max-w-[400px]">{selectedEvent.summary}</span>
                </div>
              )}

              <div className="flex gap-2">
                <button
                  onClick={() => setWorldRule('free')}
                  className="flex-1 md:flex-initial px-4 py-2 rounded-lg text-left transition-all"
                  style={{
                    backgroundColor: worldRule === 'free' ? 'rgba(15, 168, 118, 0.10)' : 'rgba(255,255,255,0.03)',
                    border: `1px solid ${worldRule === 'free' ? 'var(--color-primary)' : 'rgba(255,255,255,0.08)'}`,
                  }}
                >
                  <p className="text-xs font-semibold text-white/95">自由意志</p>
                  <p className="text-[10px] mt-0.5 text-white/45">
                    你的选择改变走向
                  </p>
                </button>
                <button
                  onClick={() => setWorldRule('fated')}
                  className="flex-1 md:flex-initial px-4 py-2 rounded-lg text-left transition-all"
                  style={{
                    backgroundColor: worldRule === 'fated' ? 'rgba(247, 103, 128, 0.10)' : 'rgba(255,255,255,0.03)',
                    border: `1px solid ${worldRule === 'fated' ? '#F76780' : 'rgba(255,255,255,0.08)'}`,
                  }}
                >
                  <p className="text-xs font-semibold text-white/95">宿命论</p>
                  <p className="text-[10px] mt-0.5 text-white/45">
                    有些事注定发生
                  </p>
                </button>
              </div>
            </div>

            {/* Right: BIG green CTA */}
            <div className="flex flex-col items-end">
              <button
                onClick={handleStartIF}
                disabled={!canStartIF}
                className="px-7 py-3.5 rounded-xl text-base font-semibold transition-all inline-flex items-center gap-2 disabled:cursor-not-allowed group"
                style={{
                  backgroundColor: canStartIF ? 'var(--color-primary)' : 'transparent',
                  color: canStartIF ? '#fff' : 'rgba(255,255,255,0.35)',
                  border: canStartIF ? '1px solid var(--color-primary)' : '1px solid rgba(15, 168, 118, 0.4)',
                  boxShadow: canStartIF ? '0 8px 28px rgba(15, 168, 118, 0.35)' : 'none',
                }}
              >
                开启 IF 线
                <ChevronRight size={18} className={canStartIF ? 'group-hover:translate-x-1 transition-transform' : ''} />
              </button>
              {!selectedEventId && (
                <p className="text-[10px] mt-2 text-white/35">
                  上方选一个事件作为起点
                </p>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* ── Add event dialog ── */}
      {showAddForm && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4"
          style={{ backgroundColor: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(4px)' }}
          onClick={() => setShowAddForm(false)}
        >
          <div
            className="w-full max-w-md card-glass p-6"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between mb-5">
              <h2 className="text-base font-semibold text-white/95">添加事件</h2>
              <button onClick={() => setShowAddForm(false)} className="text-white/50 hover:text-white/90">
                <X size={18} />
              </button>
            </div>

            <div className="space-y-3">
              <div>
                <label className="block text-xs font-medium mb-1.5 text-white/55">日期</label>
                <input
                  type="date"
                  className="w-full px-3 py-2 rounded-lg text-sm bg-white/[0.04] border border-white/[0.08] text-white outline-none"
                  value={newEvent.date}
                  onChange={(e) => setNewEvent(prev => ({ ...prev, date: e.target.value }))}
                />
              </div>

              <div>
                <label className="block text-xs font-medium mb-1.5 text-white/55">事件描述</label>
                <textarea
                  className="w-full px-3 py-2 rounded-lg text-sm bg-white/[0.04] border border-white/[0.08] text-white outline-none resize-none"
                  rows={3}
                  value={newEvent.summary}
                  onChange={(e) => setNewEvent(prev => ({ ...prev, summary: e.target.value }))}
                  placeholder="描述这个事件..."
                />
              </div>

              <div>
                <label className="block text-xs font-medium mb-1.5 text-white/55">事件类型</label>
                <select
                  className="w-full px-3 py-2 rounded-lg text-sm bg-white/[0.04] border border-white/[0.08] text-white outline-none"
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
                <label className="block text-xs font-medium mb-1.5 text-white/55">情绪走向</label>
                <input
                  type="text"
                  className="w-full px-3 py-2 rounded-lg text-sm bg-white/[0.04] border border-white/[0.08] text-white outline-none"
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
                  style={{ accentColor: '#F76780' }}
                />
                <label htmlFor="isKeyEvent" className="text-sm text-white/90">
                  标记为关键事件
                </label>
              </div>
            </div>

            <div className="flex gap-3 mt-5">
              <button
                onClick={() => setShowAddForm(false)}
                className="flex-1 px-4 py-2.5 rounded-lg text-sm bg-white/[0.05] hover:bg-white/[0.10] text-white/80 transition-colors"
              >
                取消
              </button>
              <button
                onClick={handleAddEvent}
                disabled={!newEvent.date || !newEvent.summary}
                className="flex-1 btn-primary disabled:opacity-40 disabled:cursor-not-allowed"
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
