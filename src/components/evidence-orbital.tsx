'use client';

import { useMemo } from 'react';
import { getSeverityColor, getModeLabel } from '@/lib/tokens';
import type { FillCanonical, ViolationDetail } from '@/lib/types';

interface EvidenceOrbitalProps {
  violation: ViolationDetail;
  fills: FillCanonical[];
}

export function EvidenceOrbital({ violation, fills }: EvidenceOrbitalProps) {
  const sevColor = getSeverityColor(violation.severity);
  const modeLabel = getModeLabel(violation.mode);

  const orbitalNodes = useMemo(() => {
    if (fills.length === 0) return [];

    const cx = 150;
    const cy = 150;
    const radius = 100;

    return fills.map((fill, i) => {
      const angle = (i / fills.length) * Math.PI * 2 - Math.PI / 2;
      const x = cx + radius * Math.cos(angle);
      const y = cy + radius * Math.sin(angle);
      // Size by qty (clamped 4-14)
      const nodeRadius = Math.min(14, Math.max(4, fill.qty * 3));
      const fillColor = fill.side === 'BUY' ? '#22D3EE' : '#FB923C';

      return { x, y, nodeRadius, fillColor, fill };
    });
  }, [fills]);

  return (
    <div className="flex flex-col items-center">
      <svg width="300" height="300" viewBox="0 0 300 300" className="overflow-visible">
        {/* Orbit ring */}
        <circle
          cx="150"
          cy="150"
          r="100"
          fill="none"
          stroke="rgba(200,169,110,0.03)"
          strokeWidth="1"
          strokeDasharray="4 4"
        />

        {/* Connection lines from center to each fill */}
        {orbitalNodes.map((node, i) => (
          <line
            key={`line-${i}`}
            x1="150"
            y1="150"
            x2={node.x}
            y2={node.y}
            stroke="rgba(200,169,110,0.03)"
            strokeWidth="1"
          />
        ))}

        {/* Fill nodes (orbiting) */}
        {orbitalNodes.map((node, i) => (
          <g key={`node-${i}`}>
            <circle
              cx={node.x}
              cy={node.y}
              r={node.nodeRadius}
              fill={node.fillColor}
              fillOpacity="0.2"
              stroke={node.fillColor}
              strokeWidth="1"
              strokeOpacity="0.6"
            />
            <text
              x={node.x}
              y={node.y + 1}
              textAnchor="middle"
              dominantBaseline="central"
              fill={node.fillColor}
              fontSize="7"
              fontFamily="var(--font-mono)"
              fontWeight="700"
            >
              {node.fill.qty}
            </text>
          </g>
        ))}

        {/* Center node: violation */}
        <circle
          cx="150"
          cy="150"
          r="28"
          fill={sevColor}
          fillOpacity="0.08"
          stroke={sevColor}
          strokeWidth="2"
          strokeOpacity="0.4"
        />
        <circle
          cx="150"
          cy="150"
          r="28"
          fill="none"
          stroke={sevColor}
          strokeWidth="1"
          strokeOpacity="0.15"
          strokeDasharray="3 3"
        >
          <animateTransform
            attributeName="transform"
            type="rotate"
            from="0 150 150"
            to="360 150 150"
            dur="20s"
            repeatCount="indefinite"
          />
        </circle>

        {/* Center label */}
        <text
          x="150"
          y="145"
          textAnchor="middle"
          dominantBaseline="central"
          fill={sevColor}
          fontSize="10"
          fontFamily="var(--font-mono)"
          fontWeight="700"
        >
          {violation.severity}
        </text>
        <text
          x="150"
          y="158"
          textAnchor="middle"
          dominantBaseline="central"
          fill="rgba(200,169,110,0.3)"
          fontSize="7"
          fontFamily="var(--font-mono)"
        >
          -{violation.points}pts
        </text>
      </svg>

      {/* Legend */}
      <div className="mt-2 flex items-center gap-4 font-mono text-[8px]">
        <div className="flex items-center gap-1.5">
          <div className="h-2 w-2 rounded-full bg-stable" />
          <span className="text-text-muted">BUY</span>
        </div>
        <div className="flex items-center gap-1.5">
          <div className="h-2 w-2 rounded-full bg-breakdown" />
          <span className="text-text-muted">SELL</span>
        </div>
        <span className="text-text-dim">|</span>
        <span className="text-text-muted">{modeLabel}</span>
        <span className="text-text-dim">|</span>
        <span className="text-text-muted">{fills.length} fills</span>
      </div>
    </div>
  );
}
