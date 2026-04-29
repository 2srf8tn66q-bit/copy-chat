import { useEffect, useRef, useState } from 'react';
import { gsap } from 'gsap';

const STEPS = [
  {
    num: '01',
    badgeBg: '#86efac',
    title: '配置 AI',
    desc: '选服务商，填 API Key',
    icon: (
      <>
        <circle cx="12" cy="12" r="3" />
        <path d="M12 1v4m0 14v4m8.66-13.66l-2.83 2.83M6.17 15.83l-2.83 2.83M23 12h-4M5 12H1m18.66 5.66l-2.83-2.83M6.17 8.17L3.34 5.34" />
      </>
    ),
  },
  {
    num: '02',
    badgeBg: '#93c5fd',
    title: '导入聊天',
    desc: '粘贴文字或上传文件',
    icon: (
      <>
        <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4" />
        <polyline points="17 8 12 3 7 8" />
        <line x1="12" y1="3" x2="12" y2="15" />
      </>
    ),
  },
  {
    num: '03',
    badgeBg: '#fcd34d',
    title: '开始对话',
    desc: '聊天、IF 线或群聊',
    icon: (
      <>
        <path d="M21 11.5a8.38 8.38 0 01-.9 3.8 8.5 8.5 0 01-7.6 4.7 8.38 8.38 0 01-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 01-.9-3.8 8.5 8.5 0 014.7-7.6 8.38 8.38 0 013.8-.9h.5a8.48 8.48 0 018 8v.5z" />
      </>
    ),
  },
];

const FAN_TRANSFORMS = [
  'rotate(-10deg) translate(-60px, 8px)',
  'rotate(0deg) translate(0px, -4px)',
  'rotate(10deg) translate(60px, 10px)',
];

const NEAT_TRANSFORMS = [
  'rotate(0deg) translate(-310px, 0px)',
  'rotate(0deg) translate(0px, 0px)',
  'rotate(0deg) translate(310px, 0px)',
];

export default function FanCards() {
  const containerRef = useRef<HTMLDivElement>(null);
  const [neat, setNeat] = useState(false);

  useEffect(() => {
    const ctx = gsap.context(() => {
      gsap.fromTo(
        '.step-card',
        { scale: 0 },
        { scale: 1, stagger: 0.1, ease: 'elastic.out(1, 0.8)', delay: 0.3 }
      );
    }, containerRef);
    return () => ctx.revert();
  }, []);

  const toggle = () => {
    if (!containerRef.current) return;
    const q = gsap.utils.selector(containerRef);
    const transforms = neat ? FAN_TRANSFORMS : NEAT_TRANSFORMS;

    STEPS.forEach((_, i) => {
      const el = q(`.step-card-${i}`);
      gsap.killTweensOf(el);
      gsap.to(el, {
        transform: transforms[i],
        duration: 0.7,
        ease: 'elastic.out(1, 0.75)',
        delay: i * 0.08,
        overwrite: 'auto',
      });
    });

    const arrows = q('.card-arrow');
    gsap.killTweensOf(arrows);
    if (!neat) {
      gsap.to(arrows, { opacity: 1, duration: 0.3, delay: 0.5, stagger: 0.1 });
    } else {
      gsap.to(arrows, { opacity: 0, duration: 0.15 });
    }
    setNeat(!neat);
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
      <div
        ref={containerRef}
        style={{ position: 'relative', width: 960, height: 180, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}
        onClick={toggle}
      >
        {STEPS.map((step, i) => (
          <div
            key={i}
            className={`step-card step-card-${i}`}
            style={{
              position: 'absolute',
              width: 280,
              background: '#161616',
              border: '1px solid #222',
              borderRadius: 14,
              overflow: 'hidden',
              display: 'flex',
              textAlign: 'left',
              boxShadow: '0 4px 10px rgba(0,0,0,0.2)',
              transform: FAN_TRANSFORMS[i],
              translate: '0px 0px' as any,
              transition: 'translate 0.35s cubic-bezier(0.34, 1.56, 0.64, 1), border-color 0.25s ease, box-shadow 0.35s ease',
            }}
            onMouseEnter={(e) => {
              const el = e.currentTarget as HTMLElement;
              (el.style as any).translate = '0px -6px';
              el.style.borderColor = '#3a3a3a';
              el.style.boxShadow = '0 20px 50px rgba(0,0,0,0.5)';
              const badge = el.querySelector('.step-badge') as HTMLElement;
              const num = el.querySelector('.step-num') as HTMLElement;
              const icon = el.querySelector('.step-icon') as HTMLElement;
              if (badge) badge.style.filter = 'brightness(1.08)';
              if (num) num.style.transform = 'scale(1.12)';
              if (icon) { icon.style.stroke = '#888'; icon.style.transform = 'scale(1.1)'; }
            }}
            onMouseLeave={(e) => {
              const el = e.currentTarget as HTMLElement;
              (el.style as any).translate = '0px 0px';
              el.style.borderColor = '#222';
              el.style.boxShadow = '0 4px 10px rgba(0,0,0,0.2)';
              const badge = el.querySelector('.step-badge') as HTMLElement;
              const num = el.querySelector('.step-num') as HTMLElement;
              const icon = el.querySelector('.step-icon') as HTMLElement;
              if (badge) badge.style.filter = '';
              if (num) num.style.transform = '';
              if (icon) { icon.style.stroke = '#555'; icon.style.transform = ''; }
            }}
          >
            {/* Left colored badge */}
            <div className="step-badge" style={{
              width: 64,
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              flexShrink: 0,
              padding: '20px 0',
              background: step.badgeBg,
              transition: 'filter 0.3s ease',
            }}>
              <div className="step-num" style={{ fontSize: 26, fontWeight: 800, color: '#111', lineHeight: 1, fontVariantNumeric: 'tabular-nums', transition: 'transform 0.3s cubic-bezier(0.34, 1.56, 0.64, 1)' }}>
                {step.num}
              </div>
              <div style={{ fontSize: 10, fontWeight: 600, color: 'rgba(0,0,0,0.38)', marginTop: 4, letterSpacing: 0.8, textTransform: 'uppercase' }}>
                Step
              </div>
            </div>

            {/* Right body */}
            <div style={{ padding: '28px 24px', flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
              <svg
                className="step-icon"
                style={{ width: 22, height: 22, stroke: '#555', strokeWidth: 1.5, fill: 'none', strokeLinecap: 'round', strokeLinejoin: 'round', marginBottom: 14, transition: 'all 0.3s ease', transformOrigin: 'left center' }}
                viewBox="0 0 24 24"
              >
                {step.icon}
              </svg>
              <h3 style={{ fontSize: 17, fontWeight: 600, color: '#e8e8e8', marginBottom: 6 }}>{step.title}</h3>
              <p style={{ fontSize: 13, color: '#737373', lineHeight: 1.5 }}>{step.desc}</p>
            </div>
          </div>
        ))}

        {/* Arrows */}
        <div className="card-arrow" style={{ position: 'absolute', left: 'calc(50% - 155px - 12px)', top: '50%', transform: 'translateY(-50%)', opacity: 0, pointerEvents: 'none', color: '#444', fontSize: 20 }}>
          →
        </div>
        <div className="card-arrow" style={{ position: 'absolute', left: 'calc(50% + 155px - 8px)', top: '50%', transform: 'translateY(-50%)', opacity: 0, pointerEvents: 'none', color: '#444', fontSize: 20 }}>
          →
        </div>
      </div>
      <p style={{ fontSize: 13, color: '#555', marginTop: 8 }}>
        {neat ? '点击收拢' : '点击展开'}
      </p>
    </div>
  );
}
