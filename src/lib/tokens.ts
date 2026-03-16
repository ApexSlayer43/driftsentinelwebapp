// ── Invisible Interface Design Token System ──
// Aligned exactly to the design intelligence briefing (Sections 5-7)

// Accent: Indigo (#6366F1) — trust, reliability, technology
export const ACCENT = {
  primary: '#6366F1',
  hover: '#818CF8',
  muted: '#312E81',
} as const;

// Behavioral Signals — colorblind-safe (cyan/orange, NOT red/green)
export const SIGNALS = {
  positive: '#22D3EE',   // cyan — not green
  negative: '#FB923C',   // orange — not red
  warning: '#F59E0B',    // amber — caution
  neutral: '#94A3B8',    // blue-gray — unchanged
} as const;

// State styles — used by BSS orb, badges, cards
export const STATE_STYLES = {
  STABLE:        { solid: '#22D3EE', bg: 'rgba(34,211,238,0.07)', border: 'rgba(34,211,238,0.18)' },
  DRIFT_FORMING: { solid: '#F59E0B', bg: 'rgba(245,158,11,0.07)', border: 'rgba(245,158,11,0.18)' },
  COMPROMISED:   { solid: '#FB923C', bg: 'rgba(251,146,60,0.07)', border: 'rgba(251,146,60,0.18)' },
  BREAKDOWN:     { solid: '#FB923C', bg: 'rgba(251,146,60,0.09)', border: 'rgba(251,146,60,0.22)' },
  BUILDING:      { solid: '#6B7280', bg: 'rgba(107,114,128,0.07)', border: 'rgba(107,114,128,0.18)' },
} as const;

// Tier colors — gaming loot rarity progression (spec Section 5)
// DORMANT → FORMING → DEVELOPING → CONSISTENT → DISCIPLINED → SOVEREIGN
export const TIER_STYLES = {
  DORMANT:     { color: '#6B7280', glow: 'rgba(107,114,128,0.10)' },
  FORMING:     { color: '#60A5FA', glow: 'rgba(96,165,250,0.12)' },
  DEVELOPING:  { color: '#34D399', glow: 'rgba(52,211,153,0.14)' },
  CONSISTENT:  { color: '#A78BFA', glow: 'rgba(167,139,250,0.14)' },
  DISCIPLINED: { color: '#F59E0B', glow: 'rgba(245,158,11,0.16)' },
  SOVEREIGN:   { color: '#FFD700', glow: 'rgba(255,215,0,0.18)' },
} as const;

export const SEVERITY_COLORS = {
  LOW: '#94A3B8',
  MED: '#F59E0B',
  HIGH: '#FB923C',
  CRITICAL: '#FB923C',
} as const;

// Compliance grid colors (spec Section 7 — indigo at varying opacities)
export const COMPLIANCE_COLORS = {
  empty: '#1A1D27',
  partial: '#1E2A4A',
  moderate: '#2346A0',
  high: '#3B6CF6',
  full: '#6366F1',
} as const;

export const MODE_LABELS: Record<string, string> = {
  OVERSIZE: 'Oversize Position',
  OFF_SESSION: 'Off-Session Trading',
  FREQUENCY: 'Excessive Frequency',
  BASELINE_SHIFT: 'Baseline Shift',
  HESITATION: 'Hesitation Pattern',
  REVENGE_ENTRY: 'Revenge Entry',
  SIZE_ESCALATION: 'Size Escalation',
};

export const MODE_ICONS: Record<string, string> = {
  OVERSIZE: 'Scale',
  OFF_SESSION: 'Clock',
  FREQUENCY: 'Activity',
  BASELINE_SHIFT: 'TrendingUp',
  HESITATION: 'Pause',
  REVENGE_ENTRY: 'Zap',
  SIZE_ESCALATION: 'ArrowUpRight',
};

// Session quality styles — maps session_quality enum to visual tokens
// Uses colorblind-safe palette aligned with SIGNALS
export const SESSION_QUALITY_STYLES = {
  CLEAN:       { color: '#22D3EE', bg: 'rgba(34,211,238,0.12)', border: 'rgba(34,211,238,0.25)', label: 'Clean' },
  MINOR:       { color: '#60A5FA', bg: 'rgba(96,165,250,0.12)', border: 'rgba(96,165,250,0.25)', label: 'Minor' },
  DEGRADED:    { color: '#F59E0B', bg: 'rgba(245,158,11,0.12)', border: 'rgba(245,158,11,0.25)', label: 'Degraded' },
  COMPROMISED: { color: '#FB923C', bg: 'rgba(251,146,60,0.12)', border: 'rgba(251,146,60,0.25)', label: 'Compromised' },
  BREAKDOWN:   { color: '#FB923C', bg: 'rgba(251,146,60,0.15)', border: 'rgba(251,146,60,0.30)', label: 'Breakdown' },
} as const;

// Upload cadence styles — colorblind-safe
export const CADENCE_STYLES = {
  SAME_DAY:     { color: '#22D3EE', label: 'Same Day' },
  NEXT_DAY:     { color: '#60A5FA', label: 'Next Day' },
  SHORT_GAP:    { color: '#94A3B8', label: '1-3 Days' },
  MEDIUM_GAP:   { color: '#F59E0B', label: '3-7 Days' },
  LONG_GAP:     { color: '#FB923C', label: '7-14 Days' },
  DARK_PERIOD:  { color: '#FB923C', label: 'Dark Period' },
  FIRST_UPLOAD: { color: '#6B7280', label: 'First Upload' },
} as const;

// Session event type labels
export const EVENT_TYPE_LABELS: Record<string, string> = {
  SESSION_START: 'Session Start',
  SESSION_END: 'Session End',
  TRADE_OPEN: 'Trade Open',
  TRADE_CLOSE: 'Trade Close',
  VIOLATION_TRIGGERED: 'Violation Triggered',
  VIOLATION_CLEARED: 'Violation Cleared',
  PROTOCOL_BREACH: 'Protocol Breach',
  SIZE_ESCALATION: 'Size Escalation',
  RECOVERY_ATTEMPT: 'Recovery Attempt',
};

export const EVENT_TYPE_ICONS: Record<string, string> = {
  SESSION_START: 'Play',
  SESSION_END: 'Square',
  TRADE_OPEN: 'ArrowUpRight',
  TRADE_CLOSE: 'ArrowDownRight',
  VIOLATION_TRIGGERED: 'AlertTriangle',
  VIOLATION_CLEARED: 'CheckCircle',
  PROTOCOL_BREACH: 'ShieldAlert',
  SIZE_ESCALATION: 'TrendingUp',
  RECOVERY_ATTEMPT: 'RotateCcw',
};

export function getSessionQualityStyle(quality: string) {
  return SESSION_QUALITY_STYLES[quality as keyof typeof SESSION_QUALITY_STYLES] ?? SESSION_QUALITY_STYLES.CLEAN;
}

export function getCadenceStyle(status: string) {
  return CADENCE_STYLES[status as keyof typeof CADENCE_STYLES] ?? CADENCE_STYLES.FIRST_UPLOAD;
}

export type BehavioralState = keyof typeof STATE_STYLES;
export type BssTier = keyof typeof TIER_STYLES;
export type Severity = keyof typeof SEVERITY_COLORS;

export function getStateStyle(state: string) {
  return STATE_STYLES[state as keyof typeof STATE_STYLES] ?? STATE_STYLES.BUILDING;
}

export function getTierStyle(tier: string) {
  return TIER_STYLES[tier as keyof typeof TIER_STYLES] ?? TIER_STYLES.DORMANT;
}

export function getSeverityColor(severity: string) {
  return SEVERITY_COLORS[severity as keyof typeof SEVERITY_COLORS] ?? SEVERITY_COLORS.LOW;
}

// DSI mode weights — mirrors backend/src/engine/dsi.ts
export const MODE_WEIGHTS: Record<string, number> = {
  OFF_SESSION: 1.5,
  OVERSIZE: 1.3,
  FREQUENCY: 1.0,
  BASELINE_SHIFT: 0.7,
  HESITATION: 1.0,
  REVENGE_ENTRY: 1.3,
  SIZE_ESCALATION: 1.3,
};

export function getModeWeight(mode: string) {
  return MODE_WEIGHTS[mode] ?? 1.0;
}

export function getModeLabel(mode: string) {
  return MODE_LABELS[mode] ?? mode;
}

export function getModeIcon(mode: string) {
  return MODE_ICONS[mode] ?? 'AlertTriangle';
}
