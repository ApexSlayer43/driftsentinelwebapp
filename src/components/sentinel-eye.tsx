export function SentinelEye({ className }: { className?: string }) {
  return (
    <svg
      viewBox="-38 -38 76 76"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
    >
      {/* Outer reticle ring — dashed */}
      <circle cx="0" cy="0" r="36" fill="none" stroke="currentColor" strokeWidth="0.5" opacity={0.2} strokeDasharray="4 8" />
      {/* Almond eye shape */}
      <path
        d="M-32,0 C-20,-18 20,-18 32,0 C20,18 -20,18 -32,0 Z"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.5"
      />
      {/* Inner iris ring */}
      <circle cx="0" cy="0" r="13" fill="none" stroke="currentColor" strokeWidth="1" opacity={0.6} />
      {/* Pupil — solid fill */}
      <circle cx="0" cy="0" r="7" fill="currentColor" />
      {/* Pupil core — dark cutout */}
      <circle cx="0" cy="0" r="4" fill="#080A0E" />
      {/* Center dot */}
      <circle cx="0" cy="0" r="1.5" fill="currentColor" />
      {/* Horizontal tick marks */}
      <line x1="-32" y1="0" x2="-28" y2="0" stroke="currentColor" strokeWidth="1.5" opacity={0.8} />
      <line x1="28" y1="0" x2="32" y2="0" stroke="currentColor" strokeWidth="1.5" opacity={0.8} />
      {/* Vertical tick marks */}
      <line x1="0" y1="-18" x2="0" y2="-14" stroke="currentColor" strokeWidth="1" opacity={0.5} />
      <line x1="0" y1="14" x2="0" y2="18" stroke="currentColor" strokeWidth="1" opacity={0.5} />
      {/* 45-degree reticle marks */}
      <line x1="22" y1="-10" x2="24" y2="-12" stroke="currentColor" strokeWidth="0.8" opacity={0.4} />
      <line x1="-22" y1="-10" x2="-24" y2="-12" stroke="currentColor" strokeWidth="0.8" opacity={0.4} />
      <line x1="22" y1="10" x2="24" y2="12" stroke="currentColor" strokeWidth="0.8" opacity={0.4} />
      <line x1="-22" y1="10" x2="-24" y2="12" stroke="currentColor" strokeWidth="0.8" opacity={0.4} />
    </svg>
  );
}
