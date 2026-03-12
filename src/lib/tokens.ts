// State styles — used by BSS orb, badges, cards
export const STATE_STYLES = {
  STABLE:        { solid: '#00D4AA', bg: 'rgba(0,212,170,0.07)', border: 'rgba(0,212,170,0.18)' },
  DRIFT_FORMING: { solid: '#F5A623', bg: 'rgba(245,166,35,0.07)', border: 'rgba(245,166,35,0.18)' },
  COMPROMISED:   { solid: '#FF6B35', bg: 'rgba(255,107,53,0.07)', border: 'rgba(255,107,53,0.18)' },
  BREAKDOWN:     { solid: '#FF3B5C', bg: 'rgba(255,59,92,0.09)', border: 'rgba(255,59,92,0.22)' },
  BUILDING:      { solid: '#5A6A85', bg: 'rgba(90,106,133,0.07)', border: 'rgba(90,106,133,0.18)' },
} as const;

export const TIER_STYLES = {
  CALIBRATING:    { color: '#5A6A85', glow: 'rgba(90,106,133,0.10)' },
  UNDISCIPLINED:  { color: '#8A9BB8', glow: 'rgba(138,155,184,0.12)' },
  DEVELOPING:     { color: '#00D4AA', glow: 'rgba(0,212,170,0.14)' },
  DISCIPLINED:    { color: '#FFD700', glow: 'rgba(255,215,0,0.16)' },
} as const;

export const SEVERITY_COLORS = {
  LOW: '#8A9BB8',
  MED: '#F5A623',
  HIGH: '#FF6B35',
  CRITICAL: '#FF3B5C',
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

export type BehavioralState = keyof typeof STATE_STYLES;
export type BssTier = keyof typeof TIER_STYLES;
export type Severity = keyof typeof SEVERITY_COLORS;

export function getStateStyle(state: string) {
  return STATE_STYLES[state as keyof typeof STATE_STYLES] ?? STATE_STYLES.BUILDING;
}

export function getTierStyle(tier: string) {
  return TIER_STYLES[tier as keyof typeof TIER_STYLES] ?? TIER_STYLES.UNDISCIPLINED;
}

export function getSeverityColor(severity: string) {
  return SEVERITY_COLORS[severity as keyof typeof SEVERITY_COLORS] ?? SEVERITY_COLORS.LOW;
}

export function getModeLabel(mode: string) {
  return MODE_LABELS[mode] ?? mode;
}

export function getModeIcon(mode: string) {
  return MODE_ICONS[mode] ?? 'AlertTriangle';
}
