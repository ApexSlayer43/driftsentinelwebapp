'use client';

import { useRef, useState, useCallback, type ReactNode } from 'react';
import { getStateStyle, type BehavioralState } from '@/lib/tokens';

interface GlowCardProps {
  children: ReactNode;
  state?: BehavioralState;
  className?: string;
}

export function GlowCard({ children, state = 'STABLE', className = '' }: GlowCardProps) {
  const cardRef = useRef<HTMLDivElement>(null);
  const [glowPosition, setGlowPosition] = useState({ x: 50, y: 50 });
  const [isHovered, setIsHovered] = useState(false);

  const stateStyle = getStateStyle(state);

  const handleMouseMove = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    if (!cardRef.current) return;
    const rect = cardRef.current.getBoundingClientRect();
    const x = ((e.clientX - rect.left) / rect.width) * 100;
    const y = ((e.clientY - rect.top) / rect.height) * 100;
    setGlowPosition({ x, y });
  }, []);

  return (
    <div
      ref={cardRef}
      className={`group relative rounded-xl ${className}`}
      onMouseMove={handleMouseMove}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      {/* Glow border layer */}
      <div
        className="pointer-events-none absolute -inset-px rounded-xl transition-opacity duration-300"
        style={{
          opacity: isHovered ? 1 : 0,
          background: `radial-gradient(
            280px circle at ${glowPosition.x}% ${glowPosition.y}%,
            ${stateStyle.solid}30,
            ${stateStyle.solid}08 40%,
            transparent 70%
          )`,
        }}
      />

      {/* Inner content with border */}
      <div className="relative rounded-xl glass transition-colors group-hover:border-border-active">
        {children}
      </div>
    </div>
  );
}
