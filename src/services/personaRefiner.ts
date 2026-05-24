/**
 * 画像在线修正服务
 *
 * 用户在聊天中觉得 AI 出戏 → 提供反馈 → 调 LLM 生成 patch → 用户确认 → 应用
 */

import type { Character } from '../types/character';
import type { LLMConfig } from '../types/llm';
import { sendChatMessage } from './llmService';
import type { PersonaPatch } from '../stores/characterStore';

export interface RefineRequest {
  character: Character;
  triggerMessage: string;        // 出戏的 AI 回复
  userCorrection: string;         // 用户说哪里不对（必填）
  userSuggestion?: string;        // 用户给的示范说法（可选）
}

export interface RefineResult {
  patch: PersonaPatch;
  reasoning: string;              // LLM 给的修改理由（展示给用户）
  diffSummary: string[];          // 人话版的变更摘要（"在禁词加 X" 之类）
}

// ─── JSON 抽取 ───────────────────────────────────────────

function extractJSON(text: string): string {
  const block = text.match(/```(?:json)?\s*\n?([\s\S]*?)\n?\s*```/);
  if (block) return block[1].trim();
  const firstBrace = text.indexOf('{');
  if (firstBrace === -1) return text.trim();
  let depth = 0;
  for (let i = firstBrace; i < text.length; i++) {
    if (text[i] === '{') depth++;
    if (text[i] === '}') {
      depth--;
      if (depth === 0) return text.substring(firstBrace, i + 1);
    }
  }
  return text.substring(firstBrace).trim();
}

// ─── Prompt 构造 ──────────────────────────────────────────

function buildRefinePrompt(req: RefineRequest): string {
  const { character, triggerMessage, userCorrection, userSuggestion } = req;
  const lines: string[] = [];

  lines.push('你是一个角色画像修补工程师。用户在聊天中指出 AI 角色出戏了，');
  lines.push('请根据反馈，输出一个**最小化的 JSON 补丁**修复画像。');
  lines.push('');
  lines.push('## 规则');
  lines.push('- 只改需要改的字段，不要重写整个画像');
  lines.push('- 优先用 addTo* 字段往数组里追加（保留原有内容），少用覆盖');
  lines.push('- 用户指出的不合适表达 → addToNeverSay');
  lines.push('- 用户给的示范说法 → 提取关键短语放入 addToTypicalPhrases');
  lines.push('- 仅当问题是**结构性的**（语气/风格整体不对）才改 speakingStyle');
  lines.push('- 不要捏造原画像里没有的事实（年龄、职业等）');
  lines.push('');
  lines.push('## 输出格式（严格 JSON，不要 markdown）');
  lines.push('{');
  lines.push('  "patch": {');
  lines.push('    "persona": {');
  lines.push('      "addToTypicalPhrases": ["..."],');
  lines.push('      "addToNeverSay": ["..."],');
  lines.push('      "speakingStyle": "...（只在结构问题时填）"');
  lines.push('    },');
  lines.push('    "voiceFingerprint": {');
  lines.push('      "habits": {');
  lines.push('        "addToCatchphrases": ["..."]');
  lines.push('      }');
  lines.push('    }');
  lines.push('  },');
  lines.push('  "reasoning": "一两句话解释为什么这么改",');
  lines.push('  "diffSummary": ["+ 禁词加 X", "+ 口头禅加 Y"]');
  lines.push('}');
  lines.push('');
  lines.push('## 当前画像（只列关键字段）');
  lines.push('```json');
  lines.push(JSON.stringify({
    name: character.identity.name,
    persona: {
      speakingStyle: character.persona.speakingStyle,
      typicalPhrases: character.persona.typicalPhrases,
      neverSay: character.persona.neverSay,
      emotionalLogic: character.persona.emotionalLogic,
    },
    voiceFingerprint: {
      habits: {
        catchphrases: character.voiceFingerprint.habits.catchphrases,
      },
    },
  }, null, 2));
  lines.push('```');
  lines.push('');
  lines.push('## 出戏的 AI 回复');
  lines.push(triggerMessage);
  lines.push('');
  lines.push('## 用户反馈');
  lines.push(userCorrection);
  if (userSuggestion?.trim()) {
    lines.push('');
    lines.push('## 用户提供的示范');
    lines.push(userSuggestion);
  }
  lines.push('');
  lines.push('请输出 JSON 补丁：');

  return lines.join('\n');
}

// ─── 主调用 ──────────────────────────────────────────────

export async function refinePersona(
  config: LLMConfig,
  req: RefineRequest,
): Promise<RefineResult> {
  const prompt = buildRefinePrompt(req);
  const reply = await sendChatMessage(config, [
    { role: 'system', content: '你是画像修正助手，必须输出严格 JSON。' },
    { role: 'user', content: prompt },
  ]);

  let parsed: { patch?: PersonaPatch; reasoning?: string; diffSummary?: string[] };
  try {
    parsed = JSON.parse(extractJSON(reply));
  } catch (err) {
    throw new Error('AI 返回的不是合法 JSON，请重试。原始返回：' + reply.slice(0, 200));
  }

  if (!parsed.patch) {
    throw new Error('AI 没有给出 patch 字段，请重试。');
  }

  // 兜底：如果 LLM 没给 diffSummary，自己生成一个
  const diff = parsed.diffSummary && parsed.diffSummary.length > 0
    ? parsed.diffSummary
    : autoSummarizePatch(parsed.patch);

  return {
    patch: parsed.patch,
    reasoning: parsed.reasoning ?? '已根据你的反馈调整画像。',
    diffSummary: diff,
  };
}

function autoSummarizePatch(patch: PersonaPatch): string[] {
  const out: string[] = [];
  const p = patch.persona;
  if (p?.addToTypicalPhrases?.length) out.push(`+ 口头禅: ${p.addToTypicalPhrases.join('、')}`);
  if (p?.addToNeverSay?.length) out.push(`+ 禁词: ${p.addToNeverSay.join('、')}`);
  if (p?.speakingStyle) out.push(`✎ 说话风格: ${p.speakingStyle}`);
  const h = patch.voiceFingerprint?.habits;
  if (h?.addToCatchphrases?.length) out.push(`+ 口癖: ${h.addToCatchphrases.join('、')}`);
  if (out.length === 0) out.push('（无明显变化）');
  return out;
}
