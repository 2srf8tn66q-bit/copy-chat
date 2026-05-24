import { useChatColors } from './chatTheme';

interface DateSeparatorProps {
  text: string;
}

export default function DateSeparator({ text }: DateSeparatorProps) {
  const c = useChatColors();
  return (
    <div
      className="flex items-center justify-center py-2"
      style={{ padding: '8px 16px' }}
    >
      <span
        style={{
          fontSize: '12px',
          color: c.systemText,
          lineHeight: 1,
          whiteSpace: 'nowrap',
        }}
      >
        {text}
      </span>
    </div>
  );
}
