/**
 * 画像修正编排服务
 *
 * 作用：协调 store（内存）+ storage（IDB）+ feedback log + baseline。
 *
 * 关键设计：
 *   character = baseline + 顺序 replay 所有未 reverted 的 feedback patches
 *   撤销 = mark feedback.reverted=true → 重新 replay → 写回 store + IDB
 */

import { useCharacterStore, applyPatchToCharacter } from '../stores/characterStore';
import type { PersonaPatch } from '../stores/characterStore';
import {
  saveCharacter,
  saveCharacterBaseline,
  getCharacterBaseline,
  saveFeedback,
  getAllFeedback,
  updateFeedback,
  getFeedback,
} from './storage';
import type { PersonaFeedback } from './storage';

// ─── 应用一条新反馈 ─────────────────────────────────────

export interface ApplyFeedbackInput {
  characterId: string;
  triggerMessage: string;
  userCorrection: string;
  userSuggestion?: string;
  patch: PersonaPatch;
  diffSummary: string[];
  reasoning: string;
}

export async function applyFeedback(input: ApplyFeedbackInput): Promise<PersonaFeedback | undefined> {
  const store = useCharacterStore.getState();
  const current = store.getCharacter(input.characterId);
  if (!current) return undefined;

  // 1. 首次修正前，把当前画像保存为 baseline（永不覆盖）
  const existingBaseline = await getCharacterBaseline(input.characterId);
  if (!existingBaseline) {
    await saveCharacterBaseline(input.characterId, current);
  }

  // 2. in-memory 应用 patch
  const updated = store.applyPersonaPatch(input.characterId, input.patch);
  if (!updated) return undefined;

  // 3. 持久化 feedback 记录
  const feedback: PersonaFeedback = {
    id: `fb_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
    characterId: input.characterId,
    timestamp: new Date().toISOString(),
    triggerMessage: input.triggerMessage,
    userCorrection: input.userCorrection,
    userSuggestion: input.userSuggestion,
    patch: input.patch,
    diffSummary: input.diffSummary,
    reasoning: input.reasoning,
    reverted: false,
  };
  await saveFeedback(feedback);

  // 4. 持久化当前 character
  await saveCharacter(updated);

  return feedback;
}

// ─── 重算 character（baseline + 顺序 replay 未撤销的 patches）──

export async function recomputeCharacter(characterId: string): Promise<void> {
  const store = useCharacterStore.getState();
  const baseline = await getCharacterBaseline(characterId);
  // 没 baseline 说明从未被修正过，无需重算
  if (!baseline) return;

  const feedbacks = await getAllFeedback(characterId);
  const active = feedbacks.filter((f) => !f.reverted);

  let current = baseline;
  for (const fb of active) {
    current = applyPatchToCharacter(current, fb.patch);
  }

  // 写回 store + IDB
  store.setCharacter(characterId, current);
  await saveCharacter(current);
}

// ─── 切换某条 feedback 的撤销状态 ────────────────────────

export async function toggleFeedbackReverted(feedbackId: string): Promise<void> {
  const fb = await getFeedback(feedbackId);
  if (!fb) return;
  await updateFeedback(feedbackId, { reverted: !fb.reverted });
  await recomputeCharacter(fb.characterId);
}

// ─── 撤销最近一次非 reverted 的 feedback（toast 撤销用）──

export async function undoLatestFeedback(characterId: string): Promise<boolean> {
  const feedbacks = await getAllFeedback(characterId);
  const latestActive = [...feedbacks].reverse().find((f) => !f.reverted);
  if (!latestActive) return false;
  await updateFeedback(latestActive.id, { reverted: true });
  await recomputeCharacter(characterId);
  return true;
}

// ─── 列出某角色全部 feedback（编辑页历史 tab 用）──────

export async function listFeedbacks(characterId: string): Promise<PersonaFeedback[]> {
  const fbs = await getAllFeedback(characterId);
  // 编辑页要倒序（最新在顶）
  return fbs.sort((a, b) => b.timestamp.localeCompare(a.timestamp));
}
