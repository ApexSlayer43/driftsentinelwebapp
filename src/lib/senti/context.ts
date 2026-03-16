// src/lib/senti/context.ts
// Dynamic context injection — assembled at runtime with trader's current data.
// This layer changes every request; NOT cached.

import { MODE_LABELS } from '@/lib/tokens';

export interface Fill {
  timestamp_utc: string;
  instrument_root: string;
  contract: string;
  side: string;
  qty: number;
  price: number;
  commission: number;
  off_session: boolean;
}

export interface ProtocolRule {
  rule_id: string;
  category: string;
  name: string;
  description: string;
  params: Record<string, unknown>;
  enabled: boolean;
  enforcement: string;
}

export interface Violation {
  mode: string;
  severity: string;
  points: number;
  rule_id: string;
  first_seen_utc: string;
  window_start_utc?: string;
  window_end_utc?: string;
  protocol_rule_id?: string;
}

export interface DailyScore {
  trading_date: string;
  dsi_score: number;
  violation_count: number;
  fills_count: number;
  bss_score?: number;
  bss_previous?: number;
  streak_count?: number;
  alpha_effective?: number;
}

export interface TraderProfile {
  displayName: string;
  accountRef: string;
  bssScore: number;
  tier: string;
  dsiScore: number;
  behavioralState: string;
  driftIndex: number;
  activeProtocol: string | null;
  weeklySessionCount: number;
  currentStreak: number;
  lastSessionDate: string | null;
  activeDrivers: Array<{ mode: string; points: number }>;
  recentViolations: Violation[];
  dailyScores: DailyScore[];
  totalViolations: number;
  totalDeductions: number;
  fills: Fill[];
  protocolRules: ProtocolRule[];
}

function formatDrivers(drivers: TraderProfile['activeDrivers']): string {
  if (drivers.length === 0) return 'None active.';
  return drivers
    .map((d) => `- ${MODE_LABELS[d.mode] ?? d.mode}: ${d.points} points`)
    .join('\n');
}

function formatViolations(violations: Violation[]): string {
  if (violations.length === 0) return 'No violations recorded.';
  return violations
    .map(
      (v) =>
        `- ${v.first_seen_utc} | ${MODE_LABELS[v.mode] ?? v.mode} | ${v.severity} | -${v.points}pts | ${v.rule_id}${v.window_start_utc ? ` | window: ${v.window_start_utc} → ${v.window_end_utc}` : ''}`
    )
    .join('\n');
}

function formatDailyScores(scores: DailyScore[]): string {
  if (scores.length === 0) return 'No daily scores yet.';
  return scores
    .map(
      (s) =>
        `- ${s.trading_date}: DSI ${s.dsi_score} | BSS ${s.bss_score ?? '?'}${s.bss_previous != null ? ` (prev ${s.bss_previous})` : ''} | ${s.violation_count} violations | ${s.fills_count} fills | streak ${s.streak_count ?? 0}${s.alpha_effective != null ? ` | α=${s.alpha_effective}` : ''}`
    )
    .join('\n');
}

function formatFills(fills: Fill[]): string {
  if (fills.length === 0) return 'No trade history available.';

  // Group by date for readability
  const byDate: Record<string, Fill[]> = {};
  for (const f of fills) {
    const date = f.timestamp_utc.split('T')[0];
    if (!byDate[date]) byDate[date] = [];
    byDate[date].push(f);
  }

  const lines: string[] = [];
  for (const [date, dateFills] of Object.entries(byDate)) {
    const totalQty = dateFills.reduce((sum, f) => sum + f.qty, 0);
    const buys = dateFills.filter((f) => f.side === 'BUY').length;
    const sells = dateFills.filter((f) => f.side === 'SELL').length;
    const offSession = dateFills.filter((f) => f.off_session).length;
    const instruments = [...new Set(dateFills.map((f) => f.instrument_root))].join(', ');
    const commission = dateFills.reduce((sum, f) => sum + (f.commission ?? 0), 0);

    lines.push(
      `- ${date}: ${dateFills.length} fills (${buys}B/${sells}S) | ${totalQty} contracts | ${instruments} | $${commission.toFixed(2)} commission${offSession > 0 ? ` | ${offSession} OFF-SESSION` : ''}`
    );
  }
  return lines.join('\n');
}

function formatProtocolRules(rules: ProtocolRule[]): string {
  if (rules.length === 0) return 'No protocol rules configured.';
  return rules
    .map(
      (r) =>
        `- [${r.category}] ${r.name}: ${r.description} | enforcement: ${r.enforcement} | params: ${JSON.stringify(r.params)}`
    )
    .join('\n');
}

export function buildDynamicContext(user: TraderProfile): string {
  return `<current_context>
TRADER OVERVIEW:
- Trader: ${user.displayName}
- Account: ${user.accountRef}
- Current BSS Score: ${user.bssScore}/100
- Tier: ${user.tier}
- DSI Score (today): ${user.dsiScore}
- Behavioral State: ${user.behavioralState}
- Drift Index: ${user.driftIndex}
- Active Protocol: ${user.activeProtocol || 'None'}
- Sessions This Week: ${user.weeklySessionCount}
- Streak: ${user.currentStreak} consecutive clean sessions
- Last Session: ${user.lastSessionDate || 'No sessions recorded'}
- Total Historical Violations: ${user.totalViolations}
- Total Historical Deductions: -${user.totalDeductions} points
- Total Fills on Record: ${user.fills.length}

ACTIVE DRIFT DRIVERS:
${formatDrivers(user.activeDrivers)}

PROTOCOL RULES (active):
${formatProtocolRules(user.protocolRules)}

FULL VIOLATION HISTORY (${user.recentViolations.length} records):
${formatViolations(user.recentViolations)}

BSS PROGRESSION — DAILY SCORES (${user.dailyScores.length} days):
${formatDailyScores(user.dailyScores)}

TRADE HISTORY BY DATE (${user.fills.length} fills):
${formatFills(user.fills)}
</current_context>`;
}
