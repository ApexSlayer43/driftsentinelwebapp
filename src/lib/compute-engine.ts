/**
 * Behavioral Compute Engine
 *
 * The core intelligence pipeline for Drift Sentinel.
 * fills → sessions → violations → DSI → BSS
 *
 * Replaces the broken Express backend compute pipeline.
 * This runs inside the Next.js app, writes directly to Supabase.
 */

import { SupabaseClient } from '@supabase/supabase-js';
import { randomUUID } from 'crypto';

/* ─────────────────────────────────────────────
   TYPES
   ───────────────────────────────────────────── */

interface Fill {
  event_id: string;
  account_ref: string;
  ingest_run_id: string;
  timestamp_utc: string;
  instrument_root: string;
  contract: string;
  side: 'BUY' | 'SELL';
  qty: number;
  price: number;
  commission: number;
  strategy_id?: string | null;
}

interface SessionWindow {
  name: string;
  start_utc: string;   // "14:30"
  end_utc: string;      // "20:00"
  days: string[];        // ["Mon","Tue",...]
}

interface ProtocolRule {
  rule_id: string;
  category: string;
  name: string;
  description: string;
  params: Record<string, unknown>;
  enabled: boolean;
  enforcement: string;
}

interface Trade {
  buy_event_id: string;
  sell_event_id: string;
  instrument_root: string;
  contract: string;
  qty: number;
  buy_price: number;
  sell_price: number;
  pnl: number;
  buy_time: string;
  sell_time: string;
  side_opened: 'LONG' | 'SHORT';
}

interface Violation {
  violation_id: string;
  mode_instance_id: string;
  account_ref: string;
  rule_id: string;
  mode: string;
  severity: string;
  points: number;
  first_seen_utc: string;
  window_start_utc: string;
  window_end_utc: string;
  evidence_event_ids: string[];
  status: string;
}

interface ComputeResult {
  sessions_built: number;
  violations_found: number;
  bss_score: number | null;
  bss_tier: string | null;
  days_scored: number;
}

/* ─────────────────────────────────────────────
   POINT-VALUE MAP
   ───────────────────────────────────────────── */

const POINT_VALUES: Record<string, number> = {
  MES: 5, ES: 50, MNQ: 2, NQ: 20, MYM: 0.5,
  YM: 5, MCL: 10, CL: 1000, GC: 100, MGC: 10,
  SI: 5000, RTY: 50, M2K: 5, HE: 400, LE: 400,
  ZB: 1000, ZN: 1000, ZC: 50, ZS: 50, ZW: 50,
  '6E': 125000, '6J': 12500000,
};

function getPointValue(instrumentRoot: string): number {
  return POINT_VALUES[instrumentRoot] ?? 5; // Default MES-equivalent
}

/* ─────────────────────────────────────────────
   FIFO TRADE MATCHER
   ───────────────────────────────────────────── */

function fifoMatch(fills: Fill[]): Trade[] {
  const trades: Trade[] = [];

  // Group by contract for independent FIFO queues
  const byContract = new Map<string, Fill[]>();
  for (const f of fills) {
    const key = f.contract;
    if (!byContract.has(key)) byContract.set(key, []);
    byContract.get(key)!.push(f);
  }

  for (const [, contractFills] of byContract) {
    // Sort by timestamp
    contractFills.sort((a, b) => new Date(a.timestamp_utc).getTime() - new Date(b.timestamp_utc).getTime());

    const buyQueue: { fill: Fill; remainingQty: number }[] = [];
    const sellQueue: { fill: Fill; remainingQty: number }[] = [];

    for (const fill of contractFills) {
      if (fill.side === 'BUY') {
        // Try to match against existing sells (short positions)
        let qty = fill.qty;
        while (qty > 0 && sellQueue.length > 0) {
          const oldest = sellQueue[0];
          const matchQty = Math.min(qty, oldest.remainingQty);
          const pv = getPointValue(fill.instrument_root);
          // Short: sold first, bought back — P&L = (sell - buy) * qty * pv
          const pnl = (oldest.fill.price - fill.price) * matchQty * pv;

          trades.push({
            buy_event_id: fill.event_id,
            sell_event_id: oldest.fill.event_id,
            instrument_root: fill.instrument_root,
            contract: fill.contract,
            qty: matchQty,
            buy_price: fill.price,
            sell_price: oldest.fill.price,
            pnl,
            buy_time: fill.timestamp_utc,
            sell_time: oldest.fill.timestamp_utc,
            side_opened: 'SHORT',
          });

          oldest.remainingQty -= matchQty;
          qty -= matchQty;
          if (oldest.remainingQty === 0) sellQueue.shift();
        }
        if (qty > 0) buyQueue.push({ fill, remainingQty: qty });
      } else {
        // SELL — try to match against existing buys (long positions)
        let qty = fill.qty;
        while (qty > 0 && buyQueue.length > 0) {
          const oldest = buyQueue[0];
          const matchQty = Math.min(qty, oldest.remainingQty);
          const pv = getPointValue(fill.instrument_root);
          // Long: bought first, sold — P&L = (sell - buy) * qty * pv
          const pnl = (fill.price - oldest.fill.price) * matchQty * pv;

          trades.push({
            buy_event_id: oldest.fill.event_id,
            sell_event_id: fill.event_id,
            instrument_root: fill.instrument_root,
            contract: fill.contract,
            qty: matchQty,
            buy_price: oldest.fill.price,
            sell_price: fill.price,
            pnl,
            buy_time: oldest.fill.timestamp_utc,
            sell_time: fill.timestamp_utc,
            side_opened: 'LONG',
          });

          oldest.remainingQty -= matchQty;
          qty -= matchQty;
          if (oldest.remainingQty === 0) buyQueue.shift();
        }
        if (qty > 0) sellQueue.push({ fill, remainingQty: qty });
      }
    }
  }

  // Sort trades by the time they were closed
  trades.sort((a, b) => {
    const aClose = a.side_opened === 'LONG' ? a.sell_time : a.buy_time;
    const bClose = b.side_opened === 'LONG' ? b.sell_time : b.buy_time;
    return new Date(aClose).getTime() - new Date(bClose).getTime();
  });

  return trades;
}

/* ─────────────────────────────────────────────
   SESSION BUILDER
   ───────────────────────────────────────────── */

interface BuiltSession {
  trading_date: string;          // YYYY-MM-DD
  window_name: string;
  session_start_utc: string;     // ISO
  session_end_utc: string;       // ISO
  fills: Fill[];
  trades: Trade[];
  fills_count: number;
}

function buildSessions(
  fills: Fill[],
  trades: Trade[],
  windows: SessionWindow[],
): BuiltSession[] {
  // Group fills by date
  const fillsByDate = new Map<string, Fill[]>();
  for (const f of fills) {
    const date = f.timestamp_utc.split('T')[0] ?? f.timestamp_utc.slice(0, 10);
    if (!fillsByDate.has(date)) fillsByDate.set(date, []);
    fillsByDate.get(date)!.push(f);
  }

  const sessions: BuiltSession[] = [];

  for (const [date, dayFills] of fillsByDate) {
    // Determine day of week
    const d = new Date(date + 'T12:00:00Z');
    const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    const dayName = dayNames[d.getUTCDay()];

    // Match fills to the best session window
    // Default: use the first window that matches this day
    let matchedWindow: SessionWindow | null = null;
    for (const w of windows) {
      if (w.days.includes(dayName)) {
        matchedWindow = w;
        break;
      }
    }

    if (!matchedWindow) {
      // No window matches this day — create a synthetic "off-session" window
      matchedWindow = {
        name: 'Off-Session',
        start_utc: '00:00',
        end_utc: '23:59',
        days: [dayName],
      };
    }

    // Build session time boundaries
    const [startH, startM] = matchedWindow.start_utc.split(':').map(Number);
    const [endH, endM] = matchedWindow.end_utc.split(':').map(Number);
    const sessionStart = new Date(`${date}T${String(startH).padStart(2, '0')}:${String(startM).padStart(2, '0')}:00Z`);
    const sessionEnd = new Date(`${date}T${String(endH).padStart(2, '0')}:${String(endM).padStart(2, '0')}:00Z`);

    // Get trades that belong to this date (by close time)
    const dayTrades = trades.filter(t => {
      const closeTime = t.side_opened === 'LONG' ? t.sell_time : t.buy_time;
      return closeTime.startsWith(date);
    });

    sessions.push({
      trading_date: date,
      window_name: matchedWindow.name,
      session_start_utc: sessionStart.toISOString(),
      session_end_utc: sessionEnd.toISOString(),
      fills: dayFills,
      trades: dayTrades,
      fills_count: dayFills.length,
    });
  }

  // Sort by date
  sessions.sort((a, b) => a.trading_date.localeCompare(b.trading_date));
  return sessions;
}

/* ─────────────────────────────────────────────
   RULE EVALUATOR
   ───────────────────────────────────────────── */

function evaluateRules(
  session: BuiltSession,
  rules: ProtocolRule[],
  accountRef: string,
): Violation[] {
  const violations: Violation[] = [];

  for (const rule of rules) {
    if (!rule.enabled) continue;

    switch (rule.rule_id) {
      case 'one-shot':
        violations.push(...evaluateOneShot(session, rule, accountRef));
        break;
      case 'protect-green':
        violations.push(...evaluateProtectGreen(session, rule, accountRef));
        break;
      case 'ghost-equity':
        violations.push(...evaluateGhostEquity(session, rule, accountRef));
        break;
      // volatility-filter: deferred — needs external vol data
    }
  }

  return violations;
}

/**
 * ONE-SHOT: max_full_losses per day.
 * If trader takes more than max_full_losses consecutive losing trades
 * and keeps trading, that's a violation.
 */
function evaluateOneShot(
  session: BuiltSession,
  rule: ProtocolRule,
  accountRef: string,
): Violation[] {
  const maxLosses = (rule.params.max_full_losses as number) ?? 1;
  const trades = session.trades;
  if (trades.length === 0) return [];

  // Count losses and track where the limit was hit
  let consecutiveLosses = 0;
  let limitHitAt = -1;

  for (let i = 0; i < trades.length; i++) {
    if (trades[i].pnl < 0) {
      consecutiveLosses++;
      if (consecutiveLosses >= maxLosses && limitHitAt === -1) {
        limitHitAt = i;
      }
    } else {
      consecutiveLosses = 0;
    }
  }

  // Violation: hit the loss limit AND kept trading after
  if (limitHitAt >= 0 && limitHitAt < trades.length - 1) {
    const tradesAfterLimit = trades.slice(limitHitAt + 1);
    const evidenceIds = tradesAfterLimit.flatMap(t => [t.buy_event_id, t.sell_event_id]);

    return [{
      violation_id: randomUUID(),
      mode_instance_id: `${accountRef}:${session.trading_date}`,
      account_ref: accountRef,
      rule_id: 'one-shot',
      mode: 'ONE_SHOT',
      severity: 'HIGH',
      points: 15,
      first_seen_utc: tradesAfterLimit[0].buy_time,
      window_start_utc: session.session_start_utc,
      window_end_utc: session.session_end_utc,
      evidence_event_ids: evidenceIds,
      status: 'active',
    }];
  }

  return [];
}

/**
 * PROTECT-GREEN: Session went green, then ended at or below breakeven.
 * If running P&L peaked positive and final P&L ≤ 0, violation.
 */
function evaluateProtectGreen(
  session: BuiltSession,
  rule: ProtocolRule,
  accountRef: string,
): Violation[] {
  const trades = session.trades;
  if (trades.length < 2) return [];
  if (!(rule.params.stop_at_breakeven as boolean)) return [];

  let runningPnl = 0;
  let peakPnl = 0;
  let peakIdx = -1;

  for (let i = 0; i < trades.length; i++) {
    runningPnl += trades[i].pnl;
    if (runningPnl > peakPnl) {
      peakPnl = runningPnl;
      peakIdx = i;
    }
  }

  const finalPnl = runningPnl;

  // Session went green (peak > 0) but ended at or below breakeven
  if (peakPnl > 0 && finalPnl <= 0 && peakIdx >= 0) {
    // Find the trade that crossed back below zero
    let crossIdx = peakIdx + 1;
    let pnlAfterPeak = peakPnl;
    for (let i = peakIdx + 1; i < trades.length; i++) {
      pnlAfterPeak += trades[i].pnl;
      if (pnlAfterPeak <= 0) {
        crossIdx = i;
        break;
      }
    }

    const peakTrade = trades[peakIdx];
    const crossTrade = trades[crossIdx] ?? trades[trades.length - 1];
    const evidenceIds = [
      peakTrade.buy_event_id, peakTrade.sell_event_id,
      crossTrade.buy_event_id, crossTrade.sell_event_id,
    ];

    return [{
      violation_id: randomUUID(),
      mode_instance_id: `${accountRef}:${session.trading_date}`,
      account_ref: accountRef,
      rule_id: 'protect-green',
      mode: 'PROTECT_GREEN',
      severity: 'MED',
      points: 10,
      first_seen_utc: crossTrade.sell_time || crossTrade.buy_time,
      window_start_utc: session.session_start_utc,
      window_end_utc: session.session_end_utc,
      evidence_event_ids: evidenceIds,
      status: 'active',
    }];
  }

  return [];
}

/**
 * GHOST-EQUITY: fills within N minutes of session close.
 * Trading too close to the bell risks floating drawdown at settlement.
 */
function evaluateGhostEquity(
  session: BuiltSession,
  rule: ProtocolRule,
  accountRef: string,
): Violation[] {
  const minutesBefore = (rule.params.minutes_before_close as number) ?? 15;
  const sessionEnd = new Date(session.session_end_utc).getTime();
  const cutoff = sessionEnd - minutesBefore * 60 * 1000;

  const lateFills = session.fills.filter(f => {
    const ts = new Date(f.timestamp_utc).getTime();
    return ts >= cutoff && ts <= sessionEnd;
  });

  if (lateFills.length === 0) return [];

  return [{
    violation_id: randomUUID(),
    mode_instance_id: `${accountRef}:${session.trading_date}`,
    account_ref: accountRef,
    rule_id: 'ghost-equity',
    mode: 'GHOST_EQUITY',
    severity: 'MEDIUM',
    points: 10,
    first_seen_utc: lateFills[0].timestamp_utc,
    window_start_utc: session.session_start_utc,
    window_end_utc: session.session_end_utc,
    evidence_event_ids: lateFills.map(f => f.event_id),
    status: 'active',
  }];
}

/* ─────────────────────────────────────────────
   DSI SCORER
   ───────────────────────────────────────────── */

function computeDSI(violations: Violation[]): number {
  const totalPoints = violations.reduce((sum, v) => sum + v.points, 0);
  return Math.max(0, 100 - totalPoints);
}

/* ─────────────────────────────────────────────
   BSS CALCULATOR (EWMA with streak bonus)
   ───────────────────────────────────────────── */

interface DayScore {
  trading_date: string;
  dsi_score: number;
  violation_count: number;
  fills_count: number;
  bss_score: number;
  bss_previous: number;
  streak_count: number;
}

function computeBSS(
  dailyScores: { date: string; dsi: number; violations: number; fills: number }[],
): DayScore[] {
  const ALPHA = 0.15;
  const STARTING_BSS = 50;

  // Sort chronologically
  dailyScores.sort((a, b) => a.date.localeCompare(b.date));

  const results: DayScore[] = [];
  let prevBSS = STARTING_BSS;
  let streak = 0;

  for (const day of dailyScores) {
    if (day.dsi === 100) {
      streak++;
    } else {
      streak = 0;
    }

    const effectiveAlpha = ALPHA * (1 + streak * 0.02);
    const newBSS = (effectiveAlpha * day.dsi) + ((1 - effectiveAlpha) * prevBSS);
    // Round to integer — matches backend bssV3 behavior (Math.round(raw))
    const score = Math.max(0, Math.min(100, Math.round(newBSS)));

    results.push({
      trading_date: day.date,
      dsi_score: day.dsi,
      violation_count: day.violations,
      fills_count: day.fills,
      bss_score: score,
      bss_previous: prevBSS,
      streak_count: streak,
    });

    prevBSS = score;
  }

  return results;
}

function bssTier(score: number): string {
  // Match backend bssV3 tier system
  if (score >= 90) return 'SOVEREIGN';
  if (score >= 80) return 'PROVEN';
  if (score >= 65) return 'GROUNDED';
  if (score >= 50) return 'DEFINED';
  return 'FORMING';
}

/* ─────────────────────────────────────────────
   MAIN COMPUTE PIPELINE
   ───────────────────────────────────────────── */

export async function runComputeEngine(
  admin: SupabaseClient,
  accountRef: string,
  userId: string,
): Promise<ComputeResult> {
  console.log(`[compute-engine] Starting for ${accountRef}`);

  /* 1. Read fills */
  const { data: rawFills, error: fillsErr } = await admin
    .from('fills_canonical')
    .select('event_id, account_ref, ingest_run_id, timestamp_utc, instrument_root, contract, side, qty, price, commission, strategy_id')
    .eq('account_ref', accountRef)
    .order('timestamp_utc', { ascending: true });

  if (fillsErr || !rawFills || rawFills.length === 0) {
    console.log(`[compute-engine] No fills found for ${accountRef}`);
    return { sessions_built: 0, violations_found: 0, bss_score: null, bss_tier: null, days_scored: 0 };
  }

  const fills = rawFills as Fill[];
  console.log(`[compute-engine] ${fills.length} fills loaded`);

  /* 2. Read session windows from user_configs */
  const { data: configData } = await admin
    .from('user_configs')
    .select('sessions_utc')
    .eq('account_ref', accountRef)
    .single();

  const windows: SessionWindow[] = configData?.sessions_utc ?? [
    { name: 'Regular', start_utc: '13:30', end_utc: '20:00', days: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri'] },
  ];

  /* 3. Read enabled protocol rules */
  const { data: rulesData } = await admin
    .from('protocol_rules')
    .select('rule_id, category, name, description, params, enabled, enforcement')
    .eq('account_ref', accountRef)
    .eq('enabled', true);

  const rules = (rulesData ?? []) as ProtocolRule[];
  console.log(`[compute-engine] ${rules.length} enabled rules loaded`);

  /* 4. FIFO match trades */
  const trades = fifoMatch(fills);
  console.log(`[compute-engine] ${trades.length} trades matched`);

  /* 5. Build sessions */
  const sessions = buildSessions(fills, trades, windows);
  console.log(`[compute-engine] ${sessions.length} sessions built`);

  /* 6. Evaluate rules + collect violations */
  const allViolations: Violation[] = [];
  const dailyInput: { date: string; dsi: number; violations: number; fills: number }[] = [];

  for (const session of sessions) {
    const sessionViolations = evaluateRules(session, rules, accountRef);
    allViolations.push(...sessionViolations);

    const dsi = computeDSI(sessionViolations);
    dailyInput.push({
      date: session.trading_date,
      dsi,
      violations: sessionViolations.length,
      fills: session.fills_count,
    });
  }

  console.log(`[compute-engine] ${allViolations.length} violations detected`);

  /* 7. Compute BSS across all days */
  const bssResults = computeBSS(dailyInput);

  /* 8. WRITE TO DATABASE — clear old computed data, write fresh */

  // 8a. Delete old session_events, sessions, violations, daily_scores for this account
  // (order matters for FK constraints)
  await admin.from('session_events').delete().eq('account_ref', accountRef);
  await admin.from('sessions').delete().eq('account_ref', accountRef);
  await admin.from('violations').delete().eq('account_ref', accountRef);
  await admin.from('daily_scores').delete().eq('account_ref', accountRef);

  // 8b. Write sessions
  for (const session of sessions) {
    const bssDay = bssResults.find(b => b.trading_date === session.trading_date);
    const sessionViolations = allViolations.filter(
      v => v.window_start_utc === session.session_start_utc,
    );
    const dsi = computeDSI(sessionViolations);

    // Compute max consecutive losses for this session
    let maxConsecLosses = 0;
    let currentStreak = 0;
    for (const t of session.trades) {
      if (t.pnl < 0) { currentStreak++; maxConsecLosses = Math.max(maxConsecLosses, currentStreak); }
      else { currentStreak = 0; }
    }

    // Determine session quality
    // DB CHECK constraint: CLEAN | MINOR | DEGRADED | COMPROMISED | BREAKDOWN
    const totalPnl = session.trades.reduce((s, t) => s + t.pnl, 0);
    let quality = 'CLEAN';
    if (sessionViolations.length >= 2) quality = 'COMPROMISED';
    else if (sessionViolations.length === 1) quality = 'DEGRADED';
    else if (totalPnl < 0) quality = 'MINOR';

    const sessionId = randomUUID();
    const latestIngestRun = fills[fills.length - 1]?.ingest_run_id ?? null;

    const { error: sessErr } = await admin.from('sessions').insert({
      session_id: sessionId,
      account_ref: accountRef,
      user_id: userId,
      trading_date: session.trading_date,
      session_start_utc: session.session_start_utc,
      session_end_utc: session.session_end_utc,
      fills_count: session.fills_count,
      violation_count: sessionViolations.length,
      dsi_score: dsi,
      bss_at_session: bssDay?.bss_score ?? null,
      bss_delta: bssDay ? Math.round(bssDay.bss_score) - Math.round(bssDay.bss_previous) : null,
      max_consecutive_losses: maxConsecLosses,
      session_quality: quality,
    });

    if (sessErr) {
      console.error(`[compute-engine] Session insert error (${session.trading_date}):`, sessErr.message);
      continue;
    }

    // 8c. Write session_events (fills as events)
    const sessionEvents: {
      event_id: string; session_id: string; account_ref: string; user_id: string;
      sequence_number: number; elapsed_seconds: number; event_type: string;
      metadata: Record<string, unknown>; fill_event_id: string | null; violation_id: string | null;
    }[] = session.fills.map((f, idx) => ({
      event_id: randomUUID(),
      session_id: sessionId,
      account_ref: accountRef,
      user_id: userId,
      sequence_number: idx + 1,
      elapsed_seconds: Math.round(
        (new Date(f.timestamp_utc).getTime() - new Date(session.session_start_utc).getTime()) / 1000,
      ),
      event_type: 'FILL',
      metadata: {
        side: f.side,
        contract: f.contract,
        qty: f.qty,
        price: f.price,
        instrument_root: f.instrument_root,
      },
      fill_event_id: f.event_id,
      violation_id: null,
    }));

    // Add violation events
    for (const v of sessionViolations) {
      sessionEvents.push({
        event_id: randomUUID(),
        session_id: sessionId,
        account_ref: accountRef,
        user_id: userId,
        sequence_number: sessionEvents.length + 1,
        elapsed_seconds: Math.round(
          (new Date(v.first_seen_utc).getTime() - new Date(session.session_start_utc).getTime()) / 1000,
        ),
        event_type: 'VIOLATION',
        metadata: {
          rule_id: v.rule_id,
          severity: v.severity,
          points: v.points,
        },
        fill_event_id: null,
        violation_id: v.violation_id,
      });
    }

    if (sessionEvents.length > 0) {
      const { error: evErr } = await admin.from('session_events').insert(sessionEvents);
      if (evErr) console.error(`[compute-engine] Session events insert error:`, evErr.message);
    }
  }

  // 8d. Write violations
  if (allViolations.length > 0) {
    const { error: vErr } = await admin.from('violations').insert(allViolations);
    if (vErr) console.error(`[compute-engine] Violations insert error:`, vErr.message);
  }

  // 8e. Write daily_scores
  for (const day of bssResults) {
    const { error: dsErr } = await admin.from('daily_scores').insert({
      daily_score_id: randomUUID(),
      account_ref: accountRef,
      trading_date: day.trading_date,
      dsi_score: day.dsi_score,
      violation_count: day.violation_count,
      fills_count: day.fills_count,
      computed_at: new Date().toISOString(),
      bss_score: Math.round(day.bss_score),
      bss_previous: Math.round(day.bss_previous),
      streak_count: day.streak_count,
    });
    if (dsErr) console.error(`[compute-engine] Daily score insert error (${day.trading_date}):`, dsErr.message);
  }

  const finalBSS = bssResults.length > 0 ? bssResults[bssResults.length - 1].bss_score : null;
  const tier = finalBSS !== null ? bssTier(finalBSS) : null;

  console.log(`[compute-engine] Complete. Sessions: ${sessions.length}, Violations: ${allViolations.length}, BSS: ${finalBSS} (${tier})`);

  return {
    sessions_built: sessions.length,
    violations_found: allViolations.length,
    bss_score: finalBSS,
    bss_tier: tier,
    days_scored: bssResults.length,
  };
}
