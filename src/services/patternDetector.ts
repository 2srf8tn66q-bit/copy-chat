/**
 * 反馈模式检测
 *
 * 用户在短时间内多次做类似性质的修正（比如都加 neverSay），
 * 提示用户：是不是该直接改整体说话风格？
 */

import type { PersonaFeedback } from './storage';

export type PatternKind =
  | 'repeatedNeverSay'        // 多次加禁词
  | 'repeatedTypicalPhrases'  // 多次加口头禅
  | 'repeatedCatchphrases'    // 多次加口癖
  | 'styleShift';             // 多次改 speakingStyle

export interface DetectedPattern {
  kind: PatternKind;
  count: number;
  // 最近 N 条同类反馈的 ID
  feedbackIds: string[];
  // 给用户看的人话描述
  message: string;
  // 给用户的建议动作
  suggestion: string;
}

/** 在最近 N 条 active 反馈中检测重复模式 */
export function detectPattern(
  feedbacks: PersonaFeedback[],
  windowSize = 5,
  threshold = 3,
): DetectedPattern | null {
  // 只看最近 windowSize 条未撤销的
  const active = feedbacks
    .filter((f) => !f.reverted)
    .slice(-windowSize);

  if (active.length < threshold) return null;

  // 计数每类修改
  let neverSayCount = 0;
  let typicalPhrasesCount = 0;
  let catchphrasesCount = 0;
  let styleShiftCount = 0;
  const ids: string[] = [];

  for (const fb of active) {
    const p = fb.patch.persona;
    if (p?.addToNeverSay?.length) {
      neverSayCount++;
      ids.push(fb.id);
    }
    if (p?.addToTypicalPhrases?.length) typicalPhrasesCount++;
    if (p?.speakingStyle) styleShiftCount++;
    if (fb.patch.voiceFingerprint?.habits?.addToCatchphrases?.length) catchphrasesCount++;
  }

  // 按严重程度排序，挑最显著的一个返回
  if (neverSayCount >= threshold) {
    return {
      kind: 'repeatedNeverSay',
      count: neverSayCount,
      feedbackIds: ids,
      message: `你最近已经 ${neverSayCount} 次给 TA 加禁词了`,
      suggestion: '考虑直接调整整体说话风格，而不是一条条加禁词',
    };
  }
  if (typicalPhrasesCount >= threshold) {
    return {
      kind: 'repeatedTypicalPhrases',
      count: typicalPhrasesCount,
      feedbackIds: ids,
      message: `你最近已经 ${typicalPhrasesCount} 次给 TA 补充口头禅了`,
      suggestion: '可能 TA 的语料库本身需要扩充，可以去画像里直接加',
    };
  }
  if (catchphrasesCount >= threshold) {
    return {
      kind: 'repeatedCatchphrases',
      count: catchphrasesCount,
      feedbackIds: ids,
      message: `你最近多次纠正 TA 的口癖`,
      suggestion: '考虑去画像里集中调整口癖列表',
    };
  }
  if (styleShiftCount >= threshold) {
    return {
      kind: 'styleShift',
      count: styleShiftCount,
      feedbackIds: ids,
      message: `你最近多次改 TA 的说话风格`,
      suggestion: '说话风格可能需要彻底重写，建议去画像里直接编辑',
    };
  }

  return null;
}
