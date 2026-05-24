import type { ReactNode } from 'react';

interface PageHeaderProps {
  eyebrow: string;       // e.g. "CHARACTERS · 角色"
  title: string;          // 大宋体 H1, 中文为主
  subtitle?: string;      // 副标题，灰色一行
  action?: ReactNode;     // 右上角按钮/链接
}

/**
 * 全站内页统一标题模板
 * 杂志/编辑式布局：左对齐巨大宋体标题，不居中
 * CSS keyframe 动画 — 比 motion 更可靠
 */
export default function PageHeader({ eyebrow, title, subtitle, action }: PageHeaderProps) {
  return (
    <header className="flex items-end justify-between gap-8 mb-16">
      <div className="flex-1 min-w-0">
        <p className="eyebrow mb-4 anim-fade-in">{eyebrow}</p>
        <h1
          className="text-h1 text-[color:var(--color-on-surface)] anim-fade-up delay-100"
          style={{ color: 'var(--color-on-surface)' }}
        >
          {title}
        </h1>
        {subtitle && (
          <p
            className="mt-3 text-base max-w-xl anim-fade-in delay-300"
            style={{ color: 'var(--color-on-surface-variant)' }}
          >
            {subtitle}
          </p>
        )}
      </div>

      {action && (
        /* 工具区不跟标题 cascade：立即出现，避免功能 chrome 让用户等待 */
        <div className="shrink-0">
          {action}
        </div>
      )}
    </header>
  );
}
