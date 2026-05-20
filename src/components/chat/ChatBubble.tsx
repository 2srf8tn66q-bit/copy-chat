import type { Message } from '../../types/timeline';
import { User } from 'lucide-react';

interface ChatBubbleProps {
  message: Message;
  showAvatar: boolean;
  characterAvatar?: string;
  userAvatar?: string;
  showTimestamp: boolean;
}

export default function ChatBubble({
  message,
  showAvatar,
  characterAvatar,
  userAvatar,
  showTimestamp,
}: ChatBubbleProps) {
  // System messages: centered small grey text, no bubble
  if (message.type === 'system') {
    return (
      <div className="flex justify-center py-2 px-4">
        <span
          className="text-xs leading-none"
          style={{ color: '#999', fontSize: '12px' }}
        >
          {message.content}
        </span>
      </div>
    );
  }

  const isUser = message.sender === 'user';

  // Timestamp display
  const timestampEl = showTimestamp ? (
    <div className="flex justify-center py-2">
      <span
        className="text-xs leading-none"
        style={{ color: '#999', fontSize: '12px' }}
      >
        {formatTimestamp(message.timestamp)}
      </span>
    </div>
  ) : null;

  // Avatar element
  const avatarEl = (
    <div
      className="shrink-0 flex items-end"
      style={{ width: '40px', height: '40px' }}
    >
      {showAvatar ? (
        <div
          className="flex items-center justify-center overflow-hidden"
          style={{
            width: '40px',
            height: '40px',
            borderRadius: '4px',
            backgroundColor: isUser ? '#b2d8b2' : '#d9d9d9',
          }}
        >
          {isUser ? (
            userAvatar ? (
              <img
                src={userAvatar}
                alt=""
                className="h-full w-full object-cover"
                style={{ borderRadius: '4px' }}
              />
            ) : (
              <User size={20} color="#555" />
            )
          ) : characterAvatar ? (
            <img
              src={characterAvatar}
              alt=""
              className="h-full w-full object-cover"
              style={{ borderRadius: '4px' }}
            />
          ) : (
            <User size={20} color="#555" />
          )}
        </div>
      ) : (
        <div style={{ width: '40px', height: '40px' }} />
      )}
    </div>
  );

  // Bubble element
  const bubbleEl = (
    <div
      className={`
        relative px-3 py-2
        ${isUser ? '' : ''}
      `}
      style={{
        maxWidth: '70%',
        borderRadius: '4px',
        backgroundColor: isUser ? '#95ec69' : '#ffffff',
        color: '#000',
        fontSize: '16px',
        lineHeight: '1.5',
        wordBreak: 'break-word',
      }}
    >
      {/* Bubble triangle */}
      {isUser ? (
        <div
          className="absolute"
          style={{
            top: '10px',
            right: '-6px',
            width: 0,
            height: 0,
            borderTop: '6px solid transparent',
            borderBottom: '6px solid transparent',
            borderLeft: '6px solid #95ec69',
          }}
        />
      ) : (
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
      )}
      {message.type === 'image' && message.mediaUrl ? (
        <img src={message.mediaUrl} alt={message.content || '图片'} style={{ maxWidth: '200px', maxHeight: '200px', borderRadius: '4px', display: 'block' }} />
      ) : message.type === 'video' && message.mediaUrl ? (
        <video src={message.mediaUrl} controls style={{ maxWidth: '200px', borderRadius: '4px', display: 'block' }} />
      ) : (
        message.content
      )}
    </div>
  );

  return (
    <>
      {timestampEl}
      <div
        className={`flex items-end gap-2 px-3 py-1 ${
          isUser ? 'flex-row-reverse' : 'flex-row'
        }`}
      >
        {avatarEl}
        {bubbleEl}
      </div>
    </>
  );
}

function formatTimestamp(ts: string): string {
  try {
    const date = new Date(ts);
    if (isNaN(date.getTime())) return ts;
    const h = date.getHours().toString().padStart(2, '0');
    const m = date.getMinutes().toString().padStart(2, '0');
    return `${h}:${m}`;
  } catch {
    return ts;
  }
}
