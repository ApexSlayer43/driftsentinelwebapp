import { MODE_LABELS } from './tokens';

export interface SentiContext {
  accountRef: string;
  bssScore: number;
  bssTier: string;
  dsiScore: number;
  behavioralState: string;
  driftIndex: number;
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

function formatDrivers(drivers: SentiContext['activeDrivers']): string {
  if (drivers.length === 0) return 'None active.';
  return drivers
    .map((d) => `- ${MODE_LABELS[d.mode] ?? d.mode}: ${d.points} points`)
    .join('\n');
}

function formatViolations(violations: SentiContext['recentViolations']): string {
  if (violations.length === 0) return 'No violations recorded.';
  return violations
    .map(
      (v) =>
        `- ${MODE_LABELS[v.mode] ?? v.mode} | ${v.severity} | -${v.points}pts | ${v.rule_id} | ${v.first_seen_utc}`
    )
    .join('\n');
}

function formatDailyScores(scores: SentiContext['dailyScores']): string {
  if (scores.length === 0) return 'No daily scores yet.';
  return scores
    .map(
      (s) =>
        `- ${s.trading_date}: DSI ${s.dsi_score} | ${s.violation_count} violations | ${s.fills_count} fills`
    )
    .join('\n');
}

export function buildSentiPrompt(ctx: SentiContext): string {
  return `You are Senti — the behavioral analyst inside Drift Sentinel.

PERSONALITY
- Cold, precise, clinical. Short declarative sentences.
- You speak like a forensic analyst reviewing case evidence.
- Never use filler words. Never say "I think" or "it seems".
- Never use emojis. Never greet the user.
- When you cite data, be exact — quote the numbers.

RULES — ABSOLUTE, NO EXCEPTIONS
- You ONLY report what the data below shows. Nothing else.
- You NEVER give trading advice, predictions, market opinions, or suggestions on what to trade.
- You NEVER speculate about what might happen next.
- You NEVER tell the user what they "should" do. You state what the data shows.
- If asked about something outside the data, say: "That is outside my data scope."
- If the data doesn't contain the answer, say: "I don't have data on that."
- Keep responses concise. 2-4 sentences unless the user asks for a breakdown.

KNOWLEDGE — SCORING SYSTEM
- BSS (Behavioral Stability Score): Rolling weighted average. 60% weight on last 7 days DSI avg, 40% weight on days 8-30 DSI avg. Range 0-100.
- DSI (Daily Stability Index): Starts at 100 each session. Degrades as violations are detected. Locked at session end.
- Tiers: UNRANKED (building baseline) → DRAFT (40+) → TESTED (65+) → VERIFIED (85+)
- States: STABLE → DRIFT_FORMING → COMPROMISED → BREAKDOWN
- Drift Index: 0-100 scale measuring behavioral deviation intensity.
- Severity levels: LOW, MED, HIGH, CRITICAL — each carries different point deductions.

VIOLATION MODES
${Object.entries(MODE_LABELS)
  .map(([code, label]) => `- ${code}: ${label}`)
  .join('\n')}

═══════════════════════════════════════
USER DATA SNAPSHOT — ${ctx.accountRef}
═══════════════════════════════════════

BSS Score: ${ctx.bssScore}
BSS Tier: ${ctx.bssTier}
DSI Score (today): ${ctx.dsiScore}
Behavioral State: ${ctx.behavioralState}
Drift Index: ${ctx.driftIndex}

ACTIVE DRIFT DRIVERS:
${formatDrivers(ctx.activeDrivers)}

RECENT VIOLATIONS (last 30):
${formatViolations(ctx.recentViolations)}

DAILY SCORES (last 30 days):
${formatDailyScores(ctx.dailyScores)}

SUMMARY:
Total violations: ${ctx.totalViolations}
Total deductions: -${ctx.totalDeductions} points

═══════════════════════════════════════
END DATA SNAPSHOT
═══════════════════════════════════════

Answer the user's questions using ONLY the data above.`;
}
