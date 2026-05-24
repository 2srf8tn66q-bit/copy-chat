import { motion } from 'motion/react';

interface LoadingStateProps {
  /** 简洁文字（替代 "加载中..."），可选 */
  label?: string;
  /** 撑满父容器还是 inline */
  fullScreen?: boolean;
  /** 主题色（聊天页面会传深色背景，其他默认即可）*/
  bg?: string;
  textColor?: string;
}

/**
 * 优雅的 loading：
 * 三个脉动小点 + 极淡文字。
 * 默认 fullScreen 撑满容器、垂直水平居中。
 */
export default function LoadingState({
  label = '加载中',
  fullScreen = true,
  bg,
  textColor,
}: LoadingStateProps) {
  const content = (
    <div className="flex flex-col items-center gap-3">
      <div className="flex gap-1.5">
        {[0, 1, 2].map((i) => (
          <motion.span
            key={i}
            className="block w-1.5 h-1.5 rounded-full"
            style={{ backgroundColor: 'var(--color-primary)' }}
            animate={{ opacity: [0.35, 1, 0.35], y: [0, -3, 0] }}
            transition={{
              duration: 1.1,
              repeat: Infinity,
              delay: i * 0.15,
              ease: 'easeInOut',
            }}
          />
        ))}
      </div>
      <p
        className="text-xs tracking-wide"
        style={{ color: textColor ?? 'rgba(255,255,255,0.45)' }}
      >
        {label}
      </p>
    </div>
  );

  if (!fullScreen) return content;

  return (
    <div
      className="min-h-screen flex items-center justify-center"
      style={{ backgroundColor: bg ?? 'var(--color-surface)' }}
    >
      {content}
    </div>
  );
}

/** 行级骨架占位（Linear 风 shimmer） */
export function Skeleton({
  className = '',
  style,
}: { className?: string; style?: React.CSSProperties }) {
  return <div className={`skeleton rounded-md ${className}`} style={style} />;
}
