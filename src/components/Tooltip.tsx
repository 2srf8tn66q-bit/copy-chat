import { useState, useRef, useEffect, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence } from 'motion/react';

interface TooltipProps {
  label: string;
  children: ReactNode;
  /** ms 悬停意图延迟（避免快速划过触发）*/
  delay?: number;
  /** 相对触发元素的位置 */
  placement?: 'top' | 'bottom' | 'left' | 'right';
}

/**
 * 自定义 Tooltip — 替代 HTML 原生 title 属性（丑、不可控、时机不可调）。
 * - 悬停 500ms 才显示
 * - Portal 渲染到 body，避免被 overflow:hidden 裁剪
 * - 离开 / 点击立刻消失
 * - 跟随 element bounds 自动定位
 */
export default function Tooltip({
  label,
  children,
  delay = 500,
  placement = 'top',
}: TooltipProps) {
  const [show, setShow] = useState(false);
  const [coords, setCoords] = useState<{ top: number; left: number } | null>(null);
  const triggerRef = useRef<HTMLSpanElement>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const updateCoords = () => {
    const el = triggerRef.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    const GAP = 8;
    switch (placement) {
      case 'top':
        setCoords({ top: r.top - GAP, left: r.left + r.width / 2 });
        break;
      case 'bottom':
        setCoords({ top: r.bottom + GAP, left: r.left + r.width / 2 });
        break;
      case 'left':
        setCoords({ top: r.top + r.height / 2, left: r.left - GAP });
        break;
      case 'right':
        setCoords({ top: r.top + r.height / 2, left: r.right + GAP });
        break;
    }
  };

  const handleEnter = () => {
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => {
      updateCoords();
      setShow(true);
    }, delay);
  };

  const handleLeave = () => {
    if (timerRef.current) clearTimeout(timerRef.current);
    setShow(false);
  };

  useEffect(() => {
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, []);

  // Hide on scroll / resize — popup geometry would be stale
  useEffect(() => {
    if (!show) return;
    const hide = () => setShow(false);
    window.addEventListener('scroll', hide, true);
    window.addEventListener('resize', hide);
    return () => {
      window.removeEventListener('scroll', hide, true);
      window.removeEventListener('resize', hide);
    };
  }, [show]);

  // 计算 transform 让 tooltip 自身定位以"锚点居中"为基准
  const transformByPlacement: Record<NonNullable<TooltipProps['placement']>, string> = {
    top: 'translate(-50%, -100%)',
    bottom: 'translate(-50%, 0)',
    left: 'translate(-100%, -50%)',
    right: 'translate(0, -50%)',
  };

  return (
    <>
      <span
        ref={triggerRef}
        onMouseEnter={handleEnter}
        onMouseLeave={handleLeave}
        onClick={handleLeave}
        style={{ display: 'inline-flex' }}
      >
        {children}
      </span>
      {createPortal(
        <AnimatePresence>
          {show && coords && (
            <motion.div
              initial={{ opacity: 0, y: placement === 'top' ? 4 : placement === 'bottom' ? -4 : 0, scale: 0.95 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              transition={{ duration: 0.14, ease: 'easeOut' }}
              style={{
                position: 'fixed',
                top: coords.top,
                left: coords.left,
                transform: transformByPlacement[placement],
                pointerEvents: 'none',
                zIndex: 9999,
                background: 'rgba(20, 20, 22, 0.96)',
                backdropFilter: 'blur(8px)',
                border: '1px solid rgba(255,255,255,0.10)',
                color: 'rgba(255, 255, 255, 0.92)',
                fontSize: '12px',
                padding: '6px 10px',
                borderRadius: '6px',
                whiteSpace: 'nowrap',
                boxShadow: '0 4px 16px rgba(0,0,0,0.4)',
              }}
            >
              {label}
            </motion.div>
          )}
        </AnimatePresence>,
        document.body
      )}
    </>
  );
}
