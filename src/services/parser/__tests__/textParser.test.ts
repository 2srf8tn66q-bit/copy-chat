/**
 * textParser 单元测试
 *
 * 运行需要：vitest
 * 安装：npm install -D vitest
 * 运行：npx vitest run src/services/parser/__tests__/textParser.test.ts
 */

import { describe, it, expect } from 'vitest';
import { parseTextChat } from '../textParser';

// ─── 测试用例 1: 基本的两列格式解析 ──────────────────────────

describe('parseTextChat - 基本两列格式', () => {
  it('应该正确解析名字+时间在同行，内容在下一行的格式', () => {
    const input = `小林 14:32
在吗

我 14:33
在呢怎么了

小林 14:33
周末有空吗 想去看电影`;

    const result = parseTextChat(input);

    expect(result.totalMessages).toBe(3);
    expect(result.participants.other).toBe('小林');
    expect(result.participants.self).toBe('我');
    expect(result.messages[0].content).toBe('在吗');
    expect(result.messages[0].sender).toBe('character');
    expect(result.messages[1].content).toBe('在呢怎么了');
    expect(result.messages[1].sender).toBe('user');
    expect(result.messages[2].content).toBe('周末有空吗 想去看电影');
    expect(result.messages[2].sender).toBe('character');
  });

  it('应该正确处理单条消息', () => {
    const input = `小明 10:00
你好`;

    const result = parseTextChat(input);

    expect(result.totalMessages).toBe(1);
    expect(result.messages[0].content).toBe('你好');
  });

  it('应该处理多行消息内容', () => {
    const input = `小林 14:32
第一行
第二行
第三行

我 14:33
收到`;

    const result = parseTextChat(input);

    expect(result.totalMessages).toBe(2);
    expect(result.messages[0].content).toBe('第一行\n第二行\n第三行');
    expect(result.messages[1].content).toBe('收到');
  });
});

// ─── 测试用例 2: 带日期分割线的解析 ──────────────────────────

describe('parseTextChat - 日期分割线', () => {
  it('应该识别 "2024年3月15日" 格式的日期', () => {
    const input = `2024年3月15日
小林 14:32
在吗`;

    const result = parseTextChat(input);

    expect(result.totalMessages).toBe(1);
    expect(result.startDate).toBe('2024-03-15');
    expect(result.endDate).toBe('2024-03-15');
  });

  it('应该识别 "2024-03-15" 格式的日期', () => {
    const input = `2024-03-15
小林 14:32
你好`;

    const result = parseTextChat(input);

    expect(result.startDate).toBe('2024-03-15');
  });

  it('应该处理跨天的消息', () => {
    const input = `2024年3月15日
小林 14:32
你好

2024年3月16日
我 9:00
早上好`;

    const result = parseTextChat(input);

    expect(result.totalMessages).toBe(2);
    expect(result.startDate).toBe('2024-03-15');
    expect(result.endDate).toBe('2024-03-16');
    expect(result.messages[0].timestamp).toContain('2024-03-15');
    expect(result.messages[1].timestamp).toContain('2024-03-16');
  });
});

// ─── 测试用例 3: 包含 [图片] [视频] 的解析 ──────────────────

describe('parseTextChat - 媒体消息', () => {
  it('应该将 [图片] 标记为 image 类型', () => {
    const input = `小林 14:32
[图片]

我 14:33
好看！`;

    const result = parseTextChat(input);

    expect(result.mediaCount.images).toBe(1);
    expect(result.messages[0].type).toBe('image');
    expect(result.messages[0].content).toBe('[图片]');
  });

  it('应该将 [视频] 标记为 video 类型', () => {
    const input = `小林 14:32
[视频]`;

    const result = parseTextChat(input);

    expect(result.mediaCount.videos).toBe(1);
    expect(result.messages[0].type).toBe('video');
  });

  it('应该正确统计混合媒体和非媒体消息', () => {
    const input = `小林 14:32
[图片]

小林 14:33
[视频]

我 14:34
收到`;

    const result = parseTextChat(input);

    expect(result.mediaCount.images).toBe(1);
    expect(result.mediaCount.videos).toBe(1);
    expect(result.totalMessages).toBe(3);
  });
});

// ─── 测试用例 4: 自动识别"我"和"对方" ──────────────────────

describe('parseTextChat - 参与者识别', () => {
  it('应该以名字"我"识别为 self', () => {
    const input = `小林 14:32
在吗

我 14:33
在呢`;

    const result = parseTextChat(input);

    expect(result.participants.self).toBe('我');
    expect(result.participants.other).toBe('小林');
  });

  it('名字包含"我"时应该识别为 self', () => {
    const input = `小明 14:32
在吗

我的名字 14:33
在呢`;

    const result = parseTextChat(input);

    expect(result.participants.self).toBe('我的名字');
    expect(result.participants.other).toBe('小明');
  });

  it('没有任何"我"标记时，默认第一个发言者为对方', () => {
    const input = `张三 14:32
你好

李四 14:33
你好呀`;

    const result = parseTextChat(input);

    expect(result.participants.other).toBe('张三');
    expect(result.participants.self).toBe('李四');
  });

  it('只有一个人发言时，应该正确处理', () => {
    const input = `小林 14:32
你好

小林 14:33
在吗`;

    const result = parseTextChat(input);

    expect(result.participants.other).toBe('小林');
  });
});

// ─── 测试用例 5: 过滤系统消息 ────────────────────────────────

describe('parseTextChat - 系统消息过滤', () => {
  it('应该过滤"你已添加了xxx"', () => {
    const input = `小林 14:32
你好

系统 14:31
你已添加了小林，现在可以开始聊天了

我 14:33
在呢`;

    const result = parseTextChat(input);

    // 系统消息应该被过滤
    expect(result.messages.every((m) => m.type !== 'system')).toBe(true);
  });

  it('应该过滤"以上是新消息"', () => {
    const input = `小林 14:32
你好

我 14:33
以上是新消息

小林 14:34
在吗`;

    const result = parseTextChat(input);

    expect(result.messages.every((m) => !m.content.includes('以上是新消息'))).toBe(true);
  });

  it('应该过滤撤回消息通知', () => {
    const input = `小林 14:32
你好

小林 14:33
撤回了一条消息`;

    const result = parseTextChat(input);

    expect(result.messages.every((m) => !m.content.includes('撤回了一条消息'))).toBe(true);
  });
});

// ─── 测试用例 6: 空输入和异常格式容错 ────────────────────────

describe('parseTextChat - 容错处理', () => {
  it('空字符串应该返回空结果', () => {
    const result = parseTextChat('');

    expect(result.totalMessages).toBe(0);
    expect(result.messages).toEqual([]);
  });

  it('纯空白字符串应该返回空结果', () => {
    const result = parseTextChat('   \n\n  \t  ');

    expect(result.totalMessages).toBe(0);
  });

  it('无法识别的文本应该返回空结果', () => {
    const result = parseTextChat('这是一段普通的文字，不是聊天记录');

    expect(result.totalMessages).toBe(0);
  });

  it('只有日期没有消息应该返回空结果', () => {
    const result = parseTextChat('2024年3月15日');

    expect(result.totalMessages).toBe(0);
  });

  it('格式2（冒号格式）应该被正确解析', () => {
    const input = `2024年3月15日
下午2:32
小林: 在吗
下午2:33
我: 在呢怎么了`;

    const result = parseTextChat(input);

    expect(result.totalMessages).toBe(2);
    expect(result.participants.other).toBe('小林');
    expect(result.participants.self).toBe('我');
  });
});
