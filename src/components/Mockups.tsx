import { User, Search, MoreHorizontal, Phone, Video, Calendar } from 'lucide-react';

function WindowFrame({ children }: { children: React.ReactNode }) {
  return (
    <div className="w-full max-w-lg bg-[#EDEDED] rounded-xl overflow-hidden shadow-lg shadow-black/20 border border-[#d9d9d9]">
      <div className="flex items-center gap-1.5 px-3 py-2 bg-[#EDEDED] border-b border-[#d9d9d9]">
        <div className="w-2.5 h-2.5 rounded-full bg-[#ff5f57]" />
        <div className="w-2.5 h-2.5 rounded-full bg-[#febc2e]" />
        <div className="w-2.5 h-2.5 rounded-full bg-[#28c840]" />
      </div>
      {children}
    </div>
  );
}

function ChatHeader({ title, members }: { title: string; members?: string }) {
  return (
    <div className="flex items-center justify-between px-4 py-2.5 bg-[#EDEDED] border-b border-[#d9d9d9]">
      <div>
        <p className="text-sm font-medium text-black">{title}</p>
        {members && <p className="text-[10px] text-black/35">{members}</p>}
      </div>
      <div className="flex items-center gap-3 text-black/30">
        <Phone size={14} />
        <Video size={14} />
        <Search size={14} />
        <MoreHorizontal size={14} />
      </div>
    </div>
  );
}

function Bubble({ side, text, name }: { side: 'left' | 'right'; text: string; name?: string }) {
  return (
    <div className={`flex gap-2 px-4 mb-2.5 ${side === 'right' ? 'flex-row-reverse' : ''}`}>
      <div className={`w-8 h-8 rounded-[4px] shrink-0 flex items-center justify-center text-[10px] font-bold ${side === 'right' ? 'bg-[#b2d8b2] text-black/50' : 'bg-[#d9d9d9] text-black/50'}`}>
        {side === 'left' ? (name?.[0] ?? 'T') : '我'}
      </div>
      <div className="max-w-[60%]">
        {name && side === 'left' && <p className="text-[9px] text-black/30 mb-0.5 ml-1">{name}</p>}
        <div className={`px-3 py-1.5 rounded-[4px] text-[13px] leading-snug ${side === 'right' ? 'bg-[#95ec69] text-black' : 'bg-white text-black'}`}>
          {text}
        </div>
      </div>
    </div>
  );
}

function InputBar() {
  return (
    <div className="px-4 py-2.5 bg-[#F7F7F7] border-t border-[#DEDEDE] flex items-center gap-2">
      <div className="flex-1 h-7 rounded-[4px] bg-white border border-[#DEDEDE]" />
      <User size={14} className="text-black/20" />
    </div>
  );
}

export function ChatMockup() {
  return (
    <WindowFrame>
      <ChatHeader title="小美" />
      <div className="py-4 flex flex-col justify-center gap-0.5 bg-[#EDEDED]">
        <p className="text-[10px] text-black/20 text-center mb-3">今天 11:23</p>
        <Bubble side="right" text="宝宝你在干嘛呢" />
        <Bubble side="left" text="我刚睡醒呢" />
        <Bubble side="left" text="我想你了" />
        <Bubble side="right" text="天天起这么晚" />
        <Bubble side="left" text="那咋了，反正以后你要做完早饭再叫我起床" />
        <Bubble side="right" text="好好好 都听你的" />
        <Bubble side="left" text="哼 算你识相" />
        <Bubble side="right" text="今晚想吃什么" />
        <Bubble side="left" text="我们去吃去吃市中心那家很好吃的漂亮饭吧！" />
      </div>
      <InputBar />
    </WindowFrame>
  );
}

export function TimelineMockup() {
  return (
    <WindowFrame>
      <div className="flex items-center justify-between px-4 py-2.5 bg-[#EDEDED] border-b border-[#d9d9d9]">
        <div>
          <p className="text-sm font-medium text-black">小美</p>
          <p className="text-[10px] text-black/35">IF 线 · 3月15日</p>
        </div>
        <Calendar size={16} className="text-black/30" />
      </div>
      <div className="py-4 flex flex-col justify-center gap-0.5 bg-[#EDEDED]">
        <p className="text-[10px] text-black/20 text-center mb-3">─── 3月15日 ───</p>
        <Bubble side="left" text="你怎么又不回我消息" />
        <Bubble side="right" text="我在开会啊 真没看到" />
        <p className="text-[10px] text-[#0FA876]/60 text-center my-1">↑ 这一次你说了不同的话</p>
        <Bubble side="right" text="对不起 我以后不会了 你别生气" />
        <Bubble side="left" text="哼 你每次都这么说" />
        <Bubble side="right" text="这次是真的 我给你点了你最爱喝的奶茶" />
        <Bubble side="left" text="...什么口味的" />
        <Bubble side="right" text="你猜" />
        <Bubble side="left" text="算你还有点良心" />
      </div>
      <InputBar />
    </WindowFrame>
  );
}

export function GroupChatMockup() {
  return (
    <WindowFrame>
      <ChatHeader title="当1当0不如当小(3)" />
      <div className="py-4 flex flex-col justify-center gap-0.5 bg-[#EDEDED]">
        <p className="text-[10px] text-black/20 text-center mb-3">今天 22:15</p>
        <Bubble side="left" text="兄弟们 今天看到一个超搞笑的视频" name="浩哥" />
        <Bubble side="left" text="什么视频 发来看看" name="小陈" />
        <Bubble side="right" text="别发了 肯定又是擦边的" />
        <Bubble side="left" text="你怎么知道 哈哈哈哈" name="浩哥" />
        <Bubble side="left" text="浩哥你能不能有点出息" name="小陈" />
        <Bubble side="right" text="他这辈子就这样了" />
        <Bubble side="left" text="滚 你们两个合起伙来欺负我是吧" name="浩哥" />
        <Bubble side="left" text="哈哈哈 明天出来喝酒不" name="小陈" />
      </div>
      <InputBar />
    </WindowFrame>
  );
}
