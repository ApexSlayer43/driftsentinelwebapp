interface SentinelWordmarkProps {
  className?: string;
  height?: number;
}

export function SentinelWordmark({ className = '', height = 100 }: SentinelWordmarkProps) {
  const aspectRatio = 420 / 100;
  const width = height * aspectRatio;

  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 420 100"
      width={width}
      height={height}
      className={className}
    >
      <defs>
        <filter id="wm-glow" x="-30%" y="-30%" width="160%" height="160%">
          <feGaussianBlur stdDeviation="2" result="blur" />
          <feMerge>
            <feMergeNode in="blur" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
        <filter id="wm-glow-strong" x="-50%" y="-50%" width="200%" height="200%">
          <feGaussianBlur stdDeviation="3.5" result="blur" />
          <feMerge>
            <feMergeNode in="blur" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
        <filter id="wm-glow-text" x="-10%" y="-30%" width="120%" height="160%">
          <feGaussianBlur stdDeviation="1.5" result="blur" />
          <feMerge>
            <feMergeNode in="blur" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
        <clipPath id="wm-eye-clip">
          <path d="M-32,0 C-19,-17 19,-17 32,0 C19,17 -19,17 -32,0 Z" />
        </clipPath>
      </defs>

      {/* Eye mark centered at 50,50 */}
      <g transform="translate(50,50)">
        {/* Outer orbit ring dashed */}
        <circle cx="0" cy="0" r="38" fill="none" stroke="#00D4AA" strokeWidth="0.4" opacity="0.18" strokeDasharray="3 7" />
        {/* Eye almond shape */}
        <path
          d="M-32,0 C-19,-17 19,-17 32,0 C19,17 -19,17 -32,0 Z"
          fill="none"
          stroke="#00D4AA"
          strokeWidth="2"
          filter="url(#wm-glow)"
        />
        {/* Iris ring */}
        <circle cx="0" cy="0" r="11" fill="none" stroke="#00D4AA" strokeWidth="1.2" opacity="0.55" filter="url(#wm-glow)" />
        {/* Pupil outer — gold */}
        <circle cx="0" cy="0" r="6.5" fill="#FFD700" opacity="0.12" />
        <circle cx="0" cy="0" r="6.5" fill="none" stroke="#FFD700" strokeWidth="1.6" filter="url(#wm-glow)" />
        {/* Center dot — gold */}
        <circle cx="0" cy="0" r="2.8" fill="#FFD700" filter="url(#wm-glow-strong)" />
        {/* Horizontal axis ticks */}
        <line x1="-32" y1="0" x2="-25" y2="0" stroke="#00D4AA" strokeWidth="2.2" filter="url(#wm-glow)" />
        <line x1="25" y1="0" x2="32" y2="0" stroke="#00D4AA" strokeWidth="2.2" filter="url(#wm-glow)" />
        {/* Vertical axis ticks — inside eye, clipped to almond */}
        <g clipPath="url(#wm-eye-clip)">
          <line x1="0" y1="-25" x2="0" y2="-12" stroke="#00D4AA" strokeWidth="2.2" filter="url(#wm-glow)" />
          <line x1="0" y1="12" x2="0" y2="25" stroke="#00D4AA" strokeWidth="2.2" filter="url(#wm-glow)" />
        </g>
        {/* Vertical minor ticks — outside */}
        <line x1="0" y1="-17" x2="0" y2="-12" stroke="#00D4AA" strokeWidth="1" opacity="0.45" />
        <line x1="0" y1="12" x2="0" y2="17" stroke="#00D4AA" strokeWidth="1" opacity="0.45" />
        {/* Corner reticle marks */}
        <line x1="22" y1="-11" x2="25" y2="-14" stroke="#00D4AA" strokeWidth="0.9" opacity="0.5" />
        <line x1="-22" y1="-11" x2="-25" y2="-14" stroke="#00D4AA" strokeWidth="0.9" opacity="0.5" />
        <line x1="22" y1="11" x2="25" y2="14" stroke="#00D4AA" strokeWidth="0.9" opacity="0.5" />
        <line x1="-22" y1="11" x2="-25" y2="14" stroke="#00D4AA" strokeWidth="0.9" opacity="0.5" />
      </g>

      {/* DRIFT - small, muted, wide tracking */}
      <text
        x="104"
        y="38"
        fontFamily="'JetBrains Mono', 'Courier New', Courier, monospace"
        fontSize="11"
        fontWeight="400"
        fill="#4B5563"
        letterSpacing="7"
      >
        DRIFT
      </text>
      {/* Thin rule */}
      <line x1="104" y1="44" x2="408" y2="44" stroke="#1A1D23" strokeWidth="0.8" />
      {/* SENTINEL - dominant, teal, heavy */}
      <text
        x="101"
        y="76"
        fontFamily="'Syne', 'Courier New', Courier, monospace"
        fontSize="36"
        fontWeight="900"
        fill="#00D4AA"
        letterSpacing="2.5"
        filter="url(#wm-glow-text)"
      >
        SENTINEL
      </text>
      {/* ALWAYS WATCHING - faint tagline */}
      <text
        x="104"
        y="92"
        fontFamily="'JetBrains Mono', 'Courier New', Courier, monospace"
        fontSize="7.5"
        fontWeight="400"
        fill="#00D4AA"
        letterSpacing="5.5"
        opacity="0.4"
      >
        ALWAYS  WATCHING
      </text>
    </svg>
  );
}
