import type { Character } from '../types/character';
import type { LLMConfig } from '../types/llm';
import type { GroupMessage } from '../types/group';
import { sendChatMessage } from './llmService';
import {
  buildGroupMessages,
  buildSchedulerMessages,
  parseSchedulerResponse,
} from './groupPromptBuilder';

const MAX_AI_TURNS_PER_USER = 3;          // 用户一次发言后，最多触发几次 AI 回复
const MAX_CONSECUTIVE_AI = 2;             // AI 连续接话上限（防止两个 AI 无限拌嘴）
const TYPING_DELAY_MIN = 700;             // 模拟打字延迟下限（ms）
const TYPING_DELAY_MAX = 1600;            // 模拟打字延迟上限（ms）
const BURST_INTER_DELAY_MIN = 400;        // burst 模式下相邻短消息的间隔下限
const BURST_INTER_DELAY_MAX = 900;        // burst 模式下相邻短消息的间隔上限
const MAX_BURST_SEGMENTS = 4;             // 单轮 burst 最多拆几条，超出截断防刷屏

export interface OrchestratorCallbacks {
  /** 调度器选完发言人但还没说话时触发，UI 可以显示 typing indicator */
  onTypingStart?: (speaker: Character) => void;
  /** 一条 AI 消息生成完成，UI 应该 append 到消息流并持久化 */
  onMessage: (speaker: Character, message: GroupMessage) => void | Promise<void>;
  /** 所有轮次结束（包括冷场停下、达到上限、用户中止、报错）。reason 用于调试 */
  onComplete?: (reason: 'cold' | 'maxTurns' | 'aborted' | 'error') => void;
  /** LLM 调用出错（不抛出，作为回调让 UI 决定怎么提示） */
  onError?: (error: Error) => void;
}

export interface OrchestratorOptions {
  members: Character[];
  history: GroupMessage[];          // 已包含刚发完的用户消息
  llmConfig: LLMConfig;
  userDisplayName: string;
  /** 可选 AbortSignal —— 在 LLM 调用间隙检查 aborted 状态以提前停下。
   *  正在 in-flight 的请求不会被取消，但不会触发下一轮。 */
  signal?: AbortSignal;
  callbacks: OrchestratorCallbacks;
}

function randomDelay(): Promise<void> {
  const ms = TYPING_DELAY_MIN + Math.random() * (TYPING_DELAY_MAX - TYPING_DELAY_MIN);
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function burstInterDelay(): Promise<void> {
  const ms = BURST_INTER_DELAY_MIN + Math.random() * (BURST_INTER_DELAY_MAX - BURST_INTER_DELAY_MIN);
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function newMessageId(): string {
  return `gm_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

/**
 * Burst 模式下 LLM 会输出 `a|||b|||c`，每段就是真实连发里的一条短消息。
 * 拆成数组让 orchestrator 按短延迟依次 emit，复刻角色"连珠炮"的真实节奏。
 * 非 burst / 没有 ||| 的情况返回单元素数组。
 */
function splitBurstSegments(raw: string): string[] {
  const trimmed = raw.trim();
  if (!trimmed) return [];
  if (!trimmed.includes('|||')) return [trimmed];
  return trimmed
    .split('|||')
    .map((s) => s.trim())
    .filter(Boolean)
    .slice(0, MAX_BURST_SEGMENTS);
}

/**
 * 跑一轮群聊调度：用户刚发完一条消息 → 调度 → 让被选中的 AI 说话 → 再次调度 → ...
 * 直到冷场（调度返回 null）或达到上限。
 */
export async function runGroupTurn(opts: OrchestratorOptions): Promise<void> {
  const { members, history, llmConfig, userDisplayName, signal, callbacks } = opts;
  const memberIds = members.map((m) => m.id);

  let workingHistory = [...history];
  let aiTurnsThisRound = 0;
  let consecutiveAi = 0;
  let lastSpeakerId: string | null =
    workingHistory.length > 0 ? workingHistory[workingHistory.length - 1].senderId : null;

  const isAborted = () => signal?.aborted === true;

  try {
    while (aiTurnsThisRound < MAX_AI_TURNS_PER_USER) {
      if (isAborted()) { callbacks.onComplete?.('aborted'); return; }

      // 1) 调度：谁接话？
      let speakerId: string | null;
      try {
        const schedulerMessages = buildSchedulerMessages({
          members,
          userDisplayName,
          history: workingHistory,
          lastSpeakerId,
          consecutiveAiTurns: consecutiveAi,
        });
        const raw = await sendChatMessage(llmConfig, schedulerMessages, signal);
        speakerId = parseSchedulerResponse(raw, memberIds);
      } catch (err) {
        // 用户主动取消 → 不要走"随机 fallback"路径，直接把 abort 抛到外层处理
        if (signal?.aborted) throw err;
        // 调度失败：第一轮强制随机选一个，后续轮直接停
        if (aiTurnsThisRound === 0) {
          speakerId = memberIds[Math.floor(Math.random() * memberIds.length)];
        } else {
          throw err;
        }
      }

      if (isAborted()) { callbacks.onComplete?.('aborted'); return; }

      if (!speakerId) {
        callbacks.onComplete?.('cold');
        return;
      }

      // 防止同一人连续 >2 次
      if (speakerId === lastSpeakerId && consecutiveAi >= MAX_CONSECUTIVE_AI) {
        callbacks.onComplete?.('cold');
        return;
      }

      const speaker = members.find((m) => m.id === speakerId)!;

      // 2) typing indicator
      callbacks.onTypingStart?.(speaker);
      await randomDelay();

      if (isAborted()) { callbacks.onComplete?.('aborted'); return; }

      // 3) 让被选中的角色说话
      const speakerMessages = buildGroupMessages({
        speaker,
        members,
        userDisplayName,
        history: workingHistory,
      });
      const rawReply = await sendChatMessage(llmConfig, speakerMessages, signal);

      if (isAborted()) { callbacks.onComplete?.('aborted'); return; }

      // burst 模式拆成多条短消息按延迟依次 append，复刻角色真实连发节奏。
      // 非 burst 也走同一路径，只是数组只有一个元素。
      const segments = splitBurstSegments(rawReply);
      if (segments.length === 0) {
        callbacks.onComplete?.('cold');
        return;
      }

      for (let i = 0; i < segments.length; i++) {
        if (i > 0) {
          // 第 2 条起再次显示 typing → 短延迟 → 再 emit，模拟"打字 - 发送 - 打字"
          callbacks.onTypingStart?.(speaker);
          await burstInterDelay();
          if (isAborted()) { callbacks.onComplete?.('aborted'); return; }
        }
        const message: GroupMessage = {
          id: newMessageId(),
          sender: 'character',
          senderId: speaker.id,
          content: segments[i],
          timestamp: new Date().toISOString(),
          type: 'text',
        };
        await callbacks.onMessage(speaker, message);
        workingHistory = [...workingHistory, message];
      }

      // 一整轮 burst 算一个 turn（不论拆成几条），保持 MAX_AI_TURNS_PER_USER 节制
      aiTurnsThisRound += 1;
      consecutiveAi = speakerId === lastSpeakerId ? consecutiveAi + 1 : 1;
      lastSpeakerId = speakerId;
    }
    callbacks.onComplete?.('maxTurns');
  } catch (err) {
    // 用户主动取消（fetch AbortError 或外部 signal 已 aborted）→ 走 'aborted' 路径，不当成错误
    const isAbortErr = err instanceof DOMException && err.name === 'AbortError';
    if (isAbortErr || signal?.aborted) {
      callbacks.onComplete?.('aborted');
      return;
    }
    callbacks.onError?.(err instanceof Error ? err : new Error(String(err)));
    callbacks.onComplete?.('error');
  }
}
