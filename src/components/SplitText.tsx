import { motion } from 'motion/react';
import { useEffect, useRef, useState } from 'react';

interface SplitTextProps {
  text: string;
  className?: string;
  delay?: number;
  duration?: number;
  splitBy?: 'chars' | 'words';
  from?: Record<string, number | string>;
  to?: Record<string, number | string>;
  threshold?: number;
}

export default function SplitText({
  text,
  className = '',
  delay = 30,
  duration = 0.5,
  splitBy = 'chars',
  from = { opacity: 0, y: 20 },
  to = { opacity: 1, y: 0 },
  threshold = 0.1,
}: SplitTextProps) {
  const elements = splitBy === 'words' ? text.split(' ') : text.split('');
  const [inView, setInView] = useState(false);
  const ref = useRef<HTMLParagraphElement>(null);

  useEffect(() => {
    if (!ref.current) return;
    let lastY = window.scrollY;
    let wasOutOfView = true;
    const observer = new IntersectionObserver(
      ([entry]) => {
        const currentY = window.scrollY;
        const scrollingDown = currentY >= lastY;
        lastY = currentY;
        if (!entry.isIntersecting) {
          wasOutOfView = true;
          return;
        }
        if (scrollingDown && wasOutOfView) {
          setInView(false);
          requestAnimationFrame(() => {
            requestAnimationFrame(() => setInView(true));
          });
          wasOutOfView = false;
        }
      },
      { threshold }
    );
    observer.observe(ref.current);
    return () => observer.disconnect();
  }, [threshold]);

  return (
    <p ref={ref} className={className} style={{ display: 'flex', flexWrap: 'wrap' }}>
      {elements.map((segment, index) => (
        <motion.span
          className="inline-block will-change-[transform,opacity]"
          key={index}
          initial={from}
          animate={inView ? to : from}
          transition={{
            duration,
            delay: (index * delay) / 1000,
            ease: [0.25, 0.46, 0.45, 0.94],
          }}
        >
          {segment === ' ' ? '\u00A0' : segment}
          {splitBy === 'words' && index < elements.length - 1 && '\u00A0'}
        </motion.span>
      ))}
    </p>
  );
}
