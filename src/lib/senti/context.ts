// src/lib/senti/context.ts
// Dynamic context injection — assembled at runtime with trader's current data.
// This layer changes every request; NOT cached.

import { MODE_LABELS } from '@/lib/tokens';

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
  recentViolations: Array<{
    mode: string;
    severity: string;
    points: number;
    rule_id: string;
    first_seen_utc: string;
  }>;
  dailyScores: Array<{
    trading_date: string;
    dsi_score: number;
    violation_count: number;
    fills_count: number;
  }>;
  totalViolations: number;
  totalDeductions: number;
}

function formatDrivers(drivers: TraderProfile['activeDrivers']): string {
  if (drivers.length === 0) return 'None active.';
  return drivers
    .map((d) => `- ${MODE_LABELS[d.mode] ?? d.mode}: ${d.points} points`)
    .join('\n');
}

function formatViolations(violations: TraderProfile['recentViolations']): string {
  if (violations.length === 0) return 'No recent violations';
  return violations
    .map(
      (v) =>
        `- ${MODE_LABELS[v.mode] ?? v.mode} | ${v.severity} | -${v.points}pts | ${v.rule_id} | ${v.first_seen_utc}`
    )
    .join('\n');
}

function formatDailyScores(scores: TraderProfile['dailyScores']): string {
  if (scores.length === 0) return 'No daily scores yet.';
  return scores
    .map(
      (s) =>
        `- ${s.trading_date}: DSI ${s.dsi_score} | ${s.violation_count} violations | ${s.fills_count} fills`
    )
    .join('\n');
}

export function buildDynamicContext(user: TraderProfile): string {
  return `<current_context>
- Trader: ${user.displayName}
- Account: ${user.accountRef}
- Current BSS Score: ${user.bssScore}/100
- Tier: ${user.tier}
- DSI Score (today): ${user.dsiScore}
- Behavioral State: ${user.behavioralState}
- Drift Index: ${user.driftIndex}
- Active Protocol: ${user.activeProtocol || 'None'}
- Sessions This Week: ${user.weeklySessionCount}
- Recent Violations (last 7 days): ${user.recentViolations.length}
${user.recentViolations.length > 0
    ? `  - Violation Types: ${user.recentViolations.map(v => MODE_LABELS[v.mode] ?? v.mode).join(', ')}`
    : '  - No recent violations'}
- Streak: ${user.currentStreak} consecutive sessions
- Last Session: ${user.lastSessionDate || 'No sessions recorded'}

ACTIVE DRIFT DRIVERS:
${formatDrivers(user.activeDrivers)}

RECENT VIOLATIONS (last 30):
${formatViolations(user.recentViolations)}

DAILY SCORES (last 30 days):
${formatDailyScores(user.dailyScores)}

SUMMARY:
Total violations: ${user.totalViolations}
Total deductions: -${user.totalDeductions} points
</current_context>`;
}
