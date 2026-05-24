import { AnimatePresence, motion } from 'motion/react';
import { useLocation } from 'react-router-dom';
import type { ReactNode } from 'react';

/**
 * 路由切换动画包装。
 * 纯 opacity 渐隐渐显，无位移 —— 避免任何视觉错位感。
 * 配合全局 scrollbar-gutter: stable 消除回流。
 */
export default function RouteTransition({ children }: { children: ReactNode }) {
  const location = useLocation();

  return (
    <AnimatePresence mode="wait" initial={false}>
      <motion.div
        key={location.pathname}
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        transition={{ duration: 0.18, ease: 'easeOut' }}
      >
        {children}
      </motion.div>
    </AnimatePresence>
  );
}
