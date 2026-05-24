import { useRef, useState, useEffect, type ImgHTMLAttributes } from 'react';

/**
 * <img> 替代：首次加载 onLoad 时 200ms 淡入，避免突然出现。
 * 如果图片已经在浏览器缓存里（img.complete 在 mount 时为 true），
 * 直接显示，不放 fade —— 否则在切换页面回来时会重复出现"缓入"的卡顿感。
 *
 * 接口与原生 img 兼容，可直接替换。
 */
export default function FadeImage({
  style,
  onLoad,
  ...rest
}: ImgHTMLAttributes<HTMLImageElement>) {
  const imgRef = useRef<HTMLImageElement>(null);
  // 缓存命中时 img.complete 同步为 true。我们用 lazy initializer 在第一帧就感知。
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    // mount 后立刻检查 complete —— 缓存命中 / data:URL / 同源已加载 都会同步 true
    if (imgRef.current?.complete) {
      setLoaded(true);
    }
  }, []);

  return (
    <img
      ref={imgRef}
      {...rest}
      onLoad={(e) => {
        setLoaded(true);
        onLoad?.(e);
      }}
      style={{
        ...style,
        opacity: loaded ? 1 : 0,
        // 缓存命中时 loaded 同步为 true，没有 transition 反而最干净
        transition: 'opacity 200ms cubic-bezier(0.16, 1, 0.3, 1)',
      }}
    />
  );
}
