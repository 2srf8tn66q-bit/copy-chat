export default function HeroAnimation() {
  return (
    <div className="relative w-28 h-28 mx-auto mb-6">
      {/* Outer glow */}
      <div className="absolute inset-0 rounded-full bg-primary/10 animate-pulse" />

      {/* Main circle */}
      <div className="absolute inset-3 rounded-full bg-primary/5 border border-primary/20 flex items-center justify-center">
        {/* Chat bubble left */}
        <svg
          viewBox="0 0 120 80"
          className="w-14 h-10 absolute -left-1 top-4 animate-[float1_3s_ease-in-out_infinite]"
          fill="none"
        >
          <rect x="5" y="5" width="70" height="40" rx="12" fill="#006d33" opacity="0.9" />
          <polygon points="15,45 25,45 10,55" fill="#006d33" opacity="0.9" />
          <rect x="15" y="16" width="40" height="4" rx="2" fill="white" opacity="0.6" />
          <rect x="15" y="26" width="28" height="4" rx="2" fill="white" opacity="0.4" />
        </svg>

        {/* Chat bubble right */}
        <svg
          viewBox="0 0 120 80"
          className="w-14 h-10 absolute -right-1 top-8 animate-[float2_3.5s_ease-in-out_infinite]"
          fill="none"
        >
          <rect x="35" y="5" width="70" height="40" rx="12" fill="#00ae55" opacity="0.85" />
          <polygon points="85,45 95,45 100,55" fill="#00ae55" opacity="0.85" />
          <rect x="45" y="16" width="40" height="4" rx="2" fill="white" opacity="0.6" />
          <rect x="45" y="26" width="30" height="4" rx="2" fill="white" opacity="0.4" />
        </svg>

        {/* Heart icon */}
        <svg
          viewBox="0 0 24 24"
          className="w-6 h-6 absolute top-4 left-1/2 -translate-x-1/2 text-tertiary animate-[float3_2.5s_ease-in-out_infinite]"
          fill="currentColor"
        >
          <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z" />
        </svg>

        {/* Sparkle dots */}
        <div className="absolute top-3 right-6 w-2 h-2 rounded-full bg-primary animate-[twinkle_2s_ease-in-out_infinite]" />
        <div className="absolute bottom-4 left-5 w-1.5 h-1.5 rounded-full bg-primary-container animate-[twinkle_2.5s_ease-in-out_infinite_0.5s]" />
        <div className="absolute bottom-8 right-4 w-1 h-1 rounded-full bg-primary animate-[twinkle_3s_ease-in-out_infinite_1s]" />
      </div>
    </div>
  );
}
