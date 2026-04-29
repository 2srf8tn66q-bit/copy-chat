interface TypingIndicatorProps {
  visible: boolean;
}

export default function TypingIndicator({ visible }: TypingIndicatorProps) {
  if (!visible) return null;

  return (
    <div className="flex items-end gap-2 px-3 py-1">
      {/* Avatar placeholder (same width as bubble avatar) */}
      <div
        className="flex items-center justify-center shrink-0"
        style={{
          width: '40px',
          height: '40px',
          borderRadius: '4px',
          backgroundColor: '#d9d9d9',
        }}
      />

      {/* Bubble with bouncing dots */}
      <div
        className="relative flex items-center gap-1 px-4 py-3"
        style={{
          backgroundColor: '#ffffff',
          borderRadius: '4px',
        }}
      >
        {/* Left triangle */}
        <div
          className="absolute"
          style={{
            top: '10px',
            left: '-6px',
            width: 0,
            height: 0,
            borderTop: '6px solid transparent',
            borderBottom: '6px solid transparent',
            borderRight: '6px solid #ffffff',
          }}
        />
        {[0, 1, 2].map((i) => (
          <span
            key={i}
            className="inline-block rounded-full"
            style={{
              width: '8px',
              height: '8px',
              backgroundColor: '#999',
              animation: `typing-bounce 1.4s ease-in-out ${i * 0.2}s infinite both`,
            }}
          />
        ))}
      </div>
    </div>
  );
}
