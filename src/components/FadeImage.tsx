import { useState, type ImgHTMLAttributes } from 'react';

/**
 * <img> 替代：onLoad 时 200ms 淡入，避免突然出现。
 * 接口与原生 img 兼容，可直接替换。
 */
export default function FadeImage({
  style,
  onLoad,
  ...rest
}: ImgHTMLAttributes<HTMLImageElement>) {
  const [loaded, setLoaded] = useState(false);

  return (
    <img
      {...rest}
      onLoad={(e) => {
        setLoaded(true);
        onLoad?.(e);
      }}
      style={{
        ...style,
        opacity: loaded ? 1 : 0,
        transition: 'opacity 200ms cubic-bezier(0.16, 1, 0.3, 1)',
      }}
    />
  );
}
