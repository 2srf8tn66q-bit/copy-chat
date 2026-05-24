import type { Character } from '../types/character';
import type { ChatMessage } from '../types/llm';
import type { GroupMessage } from '../types/group';
import { buildSystemPrompt } from './chatPromptBuilder';

const MAX_HISTORY = 30;

export interface GroupContext {
  speaker: Character;
  members: Character[];          // 群里全部 AI 成员（含 speaker）
  userDisplayName: string;       // 用户在群里的名字
  history: GroupMessage[];       // 最近的群聊消息
}

/**
 * 把群聊消息历史渲染成 LLM 看得懂的对话脚本。
 * 用 `[名字]: 内容` 标注每条消息的发言人，让 speaker 能区分多个对话对象。
 */
function renderTranscript(
  history: GroupMessage[],
  members: Character[],
  userDisplayName: string,
): string {
  const nameOf = (senderId: string): string => {
    if (senderId === 'user') return userDisplayName;
    return members.find((m) => m.id === senderId)?.identity.name ?? '某人';
  };
  return history
    .slice(-MAX_HISTORY)
    .map((m) => `[${nameOf(m.senderId)}]: ${m.content}`)
    .join('\n');
}

/**
 * 构造某个角色在群里说话时要发给 LLM 的 messages。
 * 思路：
 * 1. system prompt 复用私聊版本（性格 / 语录 / 习惯都完全一样）
 * 2. 末尾追加群聊专属上下文：你在群里、群成员是谁、群历史
 * 3. user 消息装载完整对话脚本，让 LLM 看到所有人说了什么
 * 4. 明确要求："现在轮到你说话，只输出你自己的一条消息，不要带名字前缀"
 */
export function buildGroupMessages(ctx: GroupContext): ChatMessage[] {
  const { speaker, members, userDisplayName, history } = ctx;

  const basePrompt = buildSystemPrompt({
    character: speaker,
    chatHistory: [],
    mode: 'group',
  });

  const otherMembers = members.filter((m) => m.id !== speaker.id);
  const memberRoster = otherMembers
    .map((m) => `- ${m.identity.name}${m.relationshipToUser ? `（${m.relationshipToUser}）` : ''}`)
    .join('\n');

  const groupAddendum = [
    '',
    '──── 群聊场景 ────',
    `你现在不在和 ${userDisplayName} 私聊，而是在一个微信小群里。群里除了你，还有：`,
    memberRoster,
    `以及 ${userDisplayName}（就是平时跟你私聊的那个人）。`,
    '',
    '群聊规则：',
    `- 你只输出你自己（${speaker.identity.name}）的一条消息，不要扮演别人。`,
    '- 不要在回复前加 [名字]: 之类的前缀，直接说话即可。',
    '- 可以回应任何人最近说的话，包括其他群成员。可以 @ 别人或者直接回别人。',
    '- 保持你的性格、语气、口头禅 —— 在群里你和私聊时是同一个人。',
    '- 群里说话普遍比私聊更短、更随意。多观察少独白。',
    '',
  ].join('\n');

  const transcript = renderTranscript(history, members, userDisplayName);

  const userTurn = [
    '以下是这个群最近的聊天记录：',
    '',
    transcript,
    '',
    `现在轮到你（${speaker.identity.name}）说话。只输出一条消息，保持你的风格。`,
  ].join('\n');

  return [
    { role: 'system', content: basePrompt + groupAddendum },
    { role: 'user', content: userTurn },
  ];
}

// ─── 调度器 prompt ───────────────────────────────────────

export interface SchedulerContext {
  members: Character[];          // AI 候选发言人
  userDisplayName: string;
  history: GroupMessage[];
  lastSpeakerId: string | null;  // 上一条消息的发言人 id（user 或某个 member id）
  consecutiveAiTurns: number;    // 上一轮以来 AI 连续发言了几次
}

/**
 * 调度器的 prompt：让 LLM 判断接下来谁该接话（或谁都不接）。
 * 输出严格 JSON：{"speakerId": "char_xxx" | null, "reason": "..."}
 */
export function buildSchedulerMessages(ctx: SchedulerContext): ChatMessage[] {
  const { members, userDisplayName, history, lastSpeakerId, consecutiveAiTurns } = ctx;

  const roster = members
    .map((m) => {
      const tag = m.persona.personalityTags?.slice(0, 2).join('、') || '';
      return `- id=${m.id} 名字=${m.identity.name}${tag ? `（${tag}）` : ''}`;
    })
    .join('\n');

  const nameOf = (senderId: string): string => {
    if (senderId === 'user') return userDisplayName;
    return members.find((m) => m.id === senderId)?.identity.name ?? '某人';
  };
  const transcript = history
    .slice(-15)
    .map((m) => `[${nameOf(m.senderId)}]: ${m.content}`)
    .join('\n');

  const lastSpeakerName = lastSpeakerId ? nameOf(lastSpeakerId) : '（无）';

  const system = [
    '你是一个微信群聊的"发言调度员"。你的工作：根据最近的对话，判断接下来哪个 AI 角色最自然地会主动接话。',
    '',
    '判断准则：',
    '1. 如果对话刚被某人抛出问题或点名，被点的人最该接话。',
    '2. 如果话题是某人的强项 / 兴趣 / 痛点，TA 更可能开口。',
    '3. 如果两人之间正在拌嘴或对话，让他们继续，别强行拉第三人。',
    '4. 如果话题已经聊完、气氛冷场、没人会主动接话，返回 null（绝对不要硬找人发言）。',
    '5. 同一个人不要连续说话超过 2 次。',
    '',
    '输出严格 JSON，只输出 JSON，不要任何解释或 markdown：',
    '{"speakerId": "候选 id 或 null", "reason": "一句话理由"}',
  ].join('\n');

  const user = [
    '群里的 AI 角色候选：',
    roster,
    '',
    `用户名字：${userDisplayName}（用户的 id 是 "user"，但你不能让用户发言）`,
    '',
    '最近聊天记录：',
    transcript || '（群刚建好，还没人说话）',
    '',
    `上一条消息的发言人：${lastSpeakerName}`,
    `AI 已经连续发言了 ${consecutiveAiTurns} 次（上限 2 次，超过应该让用户接话 → 返回 null）`,
    '',
    '决定下一个发言人（从候选 id 里选一个，或 null 表示冷场停下）：',
  ].join('\n');

  return [
    { role: 'system', content: system },
    { role: 'user', content: user },
  ];
}

/**
 * 解析调度器返回的 JSON。
 * 容错处理：包裹 markdown 的、带前缀解释的、字段拼写错的都尽量救回来。
 */
export function parseSchedulerResponse(raw: string, validIds: string[]): string | null {
  let text = raw.trim();
  // 剥 markdown 代码块
  const codeBlock = text.match(/```(?:json)?\s*([\s\S]+?)\s*```/);
  if (codeBlock) text = codeBlock[1].trim();
  // 抓第一个 { ... }
  const jsonMatch = text.match(/\{[\s\S]*?\}/);
  if (jsonMatch) text = jsonMatch[0];

  try {
    const parsed = JSON.parse(text);
    const id = parsed?.speakerId;
    if (id === null || id === 'null' || id === undefined) return null;
    if (typeof id === 'string' && validIds.includes(id)) return id;
    return null;
  } catch {
    return null;
  }
}
