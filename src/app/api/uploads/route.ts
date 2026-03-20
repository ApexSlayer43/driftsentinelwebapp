import { createClient as createAuthClient } from '@/lib/supabase/server';
import { createClient } from '@supabase/supabase-js';

/* ── Point‑value map for futures P&L computation ── */
const POINT_VALUES: Record<string, number> = {
  MES: 5, ES: 50, MNQ: 2, NQ: 20, MYM: 0.5, YM: 5,
  M2K: 5, RTY: 50, MCL: 100, CL: 1000, MGC: 10, GC: 100,
  MBT: 1.25, '6E': 125000, SI: 5000, ZB: 1000, ZN: 1000,
};

function pointValueFor(contract: string): number {
  // contract like "MESM6" → root "MES"
  for (const root of Object.keys(POINT_VALUES)) {
    if (contract.startsWith(root)) return POINT_VALUES[root];
  }
  return 5; // default to MES
}

interface Fill {
  timestamp_utc: string;
  contract: string;
  side: string;
  qty: number;
  price: number;
  commission: number;
}

interface ComputedTrade {
  contract: string;
  qty: number;
  buyPrice: number;
  sellPrice: number;
  buyTime: string;
  sellTime: string;
  pnl: number;
}

/** FIFO‑match raw fills into round‑trip trades and compute stats */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function computeFromFills(fills: Fill[], dateRange: { start: string; end: string } | null): any {
  // Sort chronologically
  const sorted = [...fills].sort((a, b) => new Date(a.timestamp_utc).getTime() - new Date(b.timestamp_utc).getTime());

  // FIFO match by contract
  const queues = new Map<string, { price: number; qty: number; time: string }[]>();
  const trades: ComputedTrade[] = [];
  let totalCommission = 0;

  for (const fill of sorted) {
    totalCommission += Number(fill.commission) || 0;
    const pv = pointValueFor(fill.contract);
    const q = queues.get(fill.contract) || [];

    if (fill.side === 'BUY') {
      // Check if there's an open short to close
      const shortQ = q.filter(e => e.qty < 0);
      if (shortQ.length > 0) {
        // Closing a short: BUY closes a previous SELL
        let remaining = fill.qty;
        while (remaining > 0 && shortQ.length > 0) {
          const open = shortQ[0];
          const matchQty = Math.min(remaining, Math.abs(open.qty));
          const pnl = (open.price - fill.price) * matchQty * pv;
          trades.push({
            contract: fill.contract, qty: matchQty,
            buyPrice: fill.price, sellPrice: open.price,
            buyTime: fill.timestamp_utc, sellTime: open.time,
            pnl,
          });
          open.qty += matchQty;
          remaining -= matchQty;
          if (open.qty === 0) shortQ.shift();
        }
        queues.set(fill.contract, q.filter(e => e.qty !== 0));
        if (remaining > 0) {
          q.push({ price: fill.price, qty: remaining, time: fill.timestamp_utc });
        }
      } else {
        q.push({ price: fill.price, qty: fill.qty, time: fill.timestamp_utc });
      }
    } else {
      // SELL
      const longQ = q.filter(e => e.qty > 0);
      if (longQ.length > 0) {
        // Closing a long: SELL closes a previous BUY
        let remaining = fill.qty;
        while (remaining > 0 && longQ.length > 0) {
          const open = longQ[0];
          const matchQty = Math.min(remaining, open.qty);
          const pnl = (fill.price - open.price) * matchQty * pv;
          trades.push({
            contract: fill.contract, qty: matchQty,
            buyPrice: open.price, sellPrice: fill.price,
            buyTime: open.time, sellTime: fill.timestamp_utc,
            pnl,
          });
          open.qty -= matchQty;
          remaining -= matchQty;
          if (open.qty === 0) longQ.shift();
        }
        queues.set(fill.contract, q.filter(e => e.qty !== 0));
        if (remaining > 0) {
          q.push({ price: fill.price, qty: -remaining, time: fill.timestamp_utc });
        }
      } else {
        q.push({ price: fill.price, qty: -fill.qty, time: fill.timestamp_utc });
      }
    }
    if (!queues.has(fill.contract)) queues.set(fill.contract, q);
  }

  // Compute summary stats
  const grossPnl = trades.reduce((s, t) => s + t.pnl, 0);
  const totalPnl = grossPnl - totalCommission;
  const winningTrades = trades.filter(t => t.pnl > 0);
  const losingTrades = trades.filter(t => t.pnl < 0);
  const winRate = trades.length > 0 ? (winningTrades.length / trades.length) * 100 : 0;
  const totalProfit = winningTrades.reduce((s, t) => s + t.pnl, 0);
  const totalLoss = losingTrades.reduce((s, t) => s + t.pnl, 0);
  const avgWin = winningTrades.length > 0 ? totalProfit / winningTrades.length : 0;
  const avgLoss = losingTrades.length > 0 ? totalLoss / losingTrades.length : 0;
  const largestWin = winningTrades.length > 0 ? Math.max(...winningTrades.map(t => t.pnl)) : 0;
  const largestLoss = losingTrades.length > 0 ? Math.min(...losingTrades.map(t => t.pnl)) : 0;
  const contractCount = trades.reduce((s, t) => s + t.qty, 0);
  const expectancy = trades.length > 0 ? totalPnl / trades.length : 0;

  // Max drawdown
  let peak = 0, runningPnl = 0, maxDrawdown = 0;
  for (const t of trades) {
    runningPnl += t.pnl;
    if (runningPnl > peak) peak = runningPnl;
    const dd = peak - runningPnl;
    if (dd > maxDrawdown) maxDrawdown = dd;
  }

  // Day breakdown
  const dayMap = new Map<string, { date: string; trades: number; pnl: number; wins: number; losses: number }>();
  for (const t of trades) {
    const date = t.buyTime.split('T')[0];
    const existing = dayMap.get(date) || { date, trades: 0, pnl: 0, wins: 0, losses: 0 };
    existing.trades++;
    existing.pnl += t.pnl;
    if (t.pnl > 0) existing.wins++;
    else if (t.pnl < 0) existing.losses++;
    dayMap.set(date, existing);
  }

  // Behavioral flags
  const avgQty = trades.length > 0 ? trades.reduce((s, t) => s + t.qty, 0) / trades.length : 0;
  const oversized = trades.filter(t => t.qty > avgQty * 1.5);
  const behavioralFlags: { type: string; description: string; severity: string }[] = [];
  if (oversized.length > 0) {
    behavioralFlags.push({
      type: 'oversize',
      description: `${oversized.length} trade${oversized.length > 1 ? 's' : ''} exceeded 1.5x avg size (${avgQty.toFixed(1)} contracts)`,
      severity: oversized.length > 3 ? 'high' : 'medium',
    });
  }

  const biggestWin = trades.length > 0 ? trades.reduce((best, t) => t.pnl > best.pnl ? t : best, trades[0]) : null;
  const biggestLoss = trades.length > 0 ? trades.reduce((worst, t) => t.pnl < worst.pnl ? t : worst, trades[0]) : null;

  return {
    summary: {
      grossPnl, totalPnl, tradeCount: trades.length, contractCount,
      avgTradeTime: '', longestTradeTime: '', winRate, expectancy,
      fees: totalCommission,
      totalProfit, winningTrades: winningTrades.length, winningContracts: 0,
      largestWin, avgWin, stdDevWin: 0,
      totalLoss, losingTrades: losingTrades.length, losingContracts: 0,
      largestLoss, avgLoss, stdDevLoss: 0,
      maxRunUp: peak, maxDrawdown: -maxDrawdown,
      maxDrawdownFrom: null, maxDrawdownTo: null,
      breakEvenPercent: 0, lossBreakdown: null,
    },
    tradeCount: trades.length,
    fillCount: fills.length,
    dateRange,
    dayBreakdown: Array.from(dayMap.values()),
    keyTrades: { biggestWin, biggestLoss, oversized },
    behavioralFlags,
  };
}

/**
 * GET /api/uploads
 *
 * Query params:
 *   ?latest=true       — returns the most recent ingest run
 *   ?date=YYYY-MM-DD   — returns ingest runs for a specific date
 *   ?limit=N           — max results (default 10)
 *
 * Returns ingest runs with their upload events for the current user.
 * If parsed_summary is missing, computes stats from fills_canonical.
 */
export async function GET(req: Request) {
  /* 1. Authenticate */
  const supabase = await createAuthClient();
  const {
    data: { user },
    error: authErr,
  } = await supabase.auth.getUser();

  if (!user || authErr) {
    return Response.json({ error: 'Not authenticated' }, { status: 401 });
  }

  /* 2. Admin client */
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!serviceKey) {
    return Response.json({ error: 'Server misconfigured' }, { status: 500 });
  }

  const admin = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    serviceKey,
    { auth: { persistSession: false, autoRefreshToken: false } },
  );

  /* 3. Parse query params */
  const url = new URL(req.url);
  const latest = url.searchParams.get('latest') === 'true';
  const date = url.searchParams.get('date');
  const limit = Math.min(parseInt(url.searchParams.get('limit') ?? '10', 10), 50);

  /* 4. Get account ref */
  const { data: accounts } = await admin
    .from('accounts')
    .select('account_ref')
    .eq('user_id', user.id)
    .limit(1);

  if (!accounts || accounts.length === 0) {
    return Response.json({ uploads: [] });
  }

  const accountRef = accounts[0].account_ref;

  /* 5. Query ingest_runs */
  let query = admin
    .from('ingest_runs')
    .select('ingest_run_id, file_name, file_hash, accepted_count, dup_count, reject_count, compute_triggered, created_at, parsed_summary')
    .eq('account_ref', accountRef)
    .order('created_at', { ascending: false });

  if (date) {
    // Filter by date — match runs created on that day (UTC)
    query = query.gte('created_at', `${date}T00:00:00Z`).lt('created_at', `${date}T23:59:59Z`);
  }

  if (latest) {
    query = query.limit(1);
  } else {
    query = query.limit(limit);
  }

  const { data: runs, error: runsErr } = await query;

  if (runsErr) {
    console.error('uploads query error:', runsErr);
    return Response.json({ error: 'Failed to query uploads' }, { status: 500 });
  }

  /* 6. For each run, get upload_events if they exist */
  const uploads = [];
  for (const run of (runs ?? [])) {
    const { data: events } = await admin
      .from('upload_events')
      .select('uploaded_at, cadence_status, session_count, trade_count, date_range_start, date_range_end, detected_platform')
      .eq('ingest_run_id', run.ingest_run_id)
      .limit(1);

    // If no parsed_summary, compute from fills_canonical
    let computedSummary = run.parsed_summary;
    if (!computedSummary) {
      const { data: fills } = await admin
        .from('fills_canonical')
        .select('timestamp_utc, contract, side, qty, price, commission')
        .eq('ingest_run_id', run.ingest_run_id)
        .order('timestamp_utc', { ascending: true });

      if (fills && fills.length > 0) {
        const evt = events?.[0];
        const dr = evt?.date_range_start && evt?.date_range_end
          ? { start: evt.date_range_start, end: evt.date_range_end }
          : null;
        computedSummary = computeFromFills(fills as Fill[], dr);

        // Cache it back to the DB for future recalls (best-effort)
        // Backfill to DB for future recalls (best-effort, no await)
        void admin
          .from('ingest_runs')
          .update({ parsed_summary: computedSummary })
          .eq('ingest_run_id', run.ingest_run_id)
          .then(() => { console.log(`[uploads] Backfilled parsed_summary for ${run.ingest_run_id}`); });
      }
    }

    uploads.push({
      ...run,
      parsed_summary: computedSummary,
      upload_event: events?.[0] ?? null,
    });
  }

  /* 7. Also get daily_scores for the date range if available */
  let dailyScores: Array<{ trading_date: string; dsi_score: number; bss_score: number; fills_count: number; violation_count: number }> = [];
  if (date) {
    const { data: scores } = await admin
      .from('daily_scores')
      .select('trading_date, dsi_score, bss_score, fills_count, violation_count')
      .eq('account_ref', accountRef)
      .eq('trading_date', date);
    dailyScores = scores ?? [];
  } else if (latest && uploads.length > 0 && uploads[0].upload_event) {
    const evt = uploads[0].upload_event;
    if (evt.date_range_start && evt.date_range_end) {
      const { data: scores } = await admin
        .from('daily_scores')
        .select('trading_date, dsi_score, bss_score, fills_count, violation_count')
        .eq('account_ref', accountRef)
        .gte('trading_date', evt.date_range_start)
        .lte('trading_date', evt.date_range_end)
        .order('trading_date', { ascending: true });
      dailyScores = scores ?? [];
    }
  }

  return Response.json({
    uploads,
    daily_scores: dailyScores,
  });
}
