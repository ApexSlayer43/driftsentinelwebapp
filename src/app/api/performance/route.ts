import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

/**
 * GET /api/performance?account_ref=xxx
 *
 * Returns cumulative lifetime performance stats computed from
 * fills_canonical + sessions tables.
 */
export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const accountRef = searchParams.get('account_ref');

  if (!accountRef) {
    return NextResponse.json({ error: 'account_ref required' }, { status: 400 });
  }

  const supabase = await createClient();

  // Pull all fills + all sessions in parallel
  const [fillsRes, sessionsRes] = await Promise.all([
    supabase
      .from('fills_canonical')
      .select('side, qty, price, commission, contract, instrument_root, timestamp_utc')
      .eq('account_ref', accountRef)
      .order('timestamp_utc', { ascending: true }),
    supabase
      .from('sessions')
      .select('fills_count, violation_count, session_quality, trading_date, dsi_score, bss_at_session')
      .eq('account_ref', accountRef)
      .order('trading_date', { ascending: true }),
  ]);

  const fills = fillsRes.data ?? [];
  const sessions = sessionsRes.data ?? [];

  // ── Compute from fills ──
  // Group fills into round-trip trades (BUY then SELL or SELL then BUY)
  // For P&L we pair fills by instrument, alternating open/close
  const openPositions: Map<string, { side: string; qty: number; price: number; commission: number }> = new Map();

  let grossPnl = 0;
  let totalCommission = 0;
  let tradeCount = 0;
  let winCount = 0;
  let totalContracts = 0;
  let maxRunUp = 0;
  let maxDrawdown = 0;
  let runningPnl = 0;
  let peakPnl = 0;

  for (const fill of fills) {
    totalContracts += fill.qty;
    totalCommission += fill.commission ?? 0;

    const key = fill.contract || fill.instrument_root;
    const existing = openPositions.get(key);

    if (!existing) {
      // Open new position
      openPositions.set(key, {
        side: fill.side,
        qty: fill.qty,
        price: fill.price,
        commission: fill.commission ?? 0,
      });
    } else if (existing.side !== fill.side) {
      // Closing trade — compute P&L
      const pnl = existing.side === 'BUY'
        ? (fill.price - existing.price) * Math.min(existing.qty, fill.qty)
        : (existing.price - fill.price) * Math.min(existing.qty, fill.qty);

      grossPnl += pnl;
      runningPnl += pnl - (fill.commission ?? 0) - existing.commission;
      tradeCount++;

      if (pnl > 0) winCount++;

      peakPnl = Math.max(peakPnl, runningPnl);
      const dd = peakPnl - runningPnl;
      if (dd > maxDrawdown) maxDrawdown = dd;
      if (runningPnl > maxRunUp) maxRunUp = runningPnl;

      // Handle partial fills
      const remainQty = existing.qty - fill.qty;
      if (remainQty > 0) {
        openPositions.set(key, { ...existing, qty: remainQty });
      } else {
        openPositions.delete(key);
      }
    } else {
      // Same side — averaging in
      const totalQty = existing.qty + fill.qty;
      const avgPrice = ((existing.price * existing.qty) + (fill.price * fill.qty)) / totalQty;
      openPositions.set(key, {
        side: existing.side,
        qty: totalQty,
        price: avgPrice,
        commission: existing.commission + (fill.commission ?? 0),
      });
    }
  }

  const netPnl = grossPnl - totalCommission;
  const winRate = tradeCount > 0 ? Math.round((winCount / tradeCount) * 10000) / 100 : 0;
  const expectancy = tradeCount > 0 ? Math.round((netPnl / tradeCount) * 100) / 100 : 0;

  // ── Compute from sessions ──
  const totalSessions = sessions.length;
  const totalFills = sessions.reduce((sum, s) => sum + s.fills_count, 0);
  const totalViolations = sessions.reduce((sum, s) => sum + s.violation_count, 0);
  const cleanSessions = sessions.filter(s => s.session_quality === 'CLEAN').length;
  const cleanRate = totalSessions > 0 ? Math.round((cleanSessions / totalSessions) * 100) : 0;

  const dsiScores = sessions.filter(s => s.dsi_score != null).map(s => s.dsi_score as number);
  const avgDsi = dsiScores.length > 0 ? Math.round(dsiScores.reduce((a, b) => a + b, 0) / dsiScores.length) : null;

  // Quality distribution counts
  const qualityCounts: Record<string, number> = { CLEAN: 0, MINOR: 0, DEGRADED: 0, COMPROMISED: 0, BREAKDOWN: 0 };
  for (const s of sessions) {
    if (s.session_quality && s.session_quality in qualityCounts) {
      qualityCounts[s.session_quality]++;
    }
  }

  // Date range
  const firstDate = sessions.length > 0 ? sessions[0].trading_date : null;
  const lastDate = sessions.length > 0 ? sessions[sessions.length - 1].trading_date : null;

  return NextResponse.json({
    summary: {
      grossPnl: Math.round(grossPnl * 100) / 100,
      netPnl: Math.round(netPnl * 100) / 100,
      totalCommission: Math.round(totalCommission * 100) / 100,
      tradeCount,
      winCount,
      winRate,
      expectancy,
      totalContracts,
      maxRunUp: Math.round(maxRunUp * 100) / 100,
      maxDrawdown: Math.round(maxDrawdown * 100) / 100,
    },
    sessions: {
      total: totalSessions,
      totalFills,
      totalViolations,
      cleanSessions,
      cleanRate,
      avgDsi,
      qualityCounts,
    },
    dateRange: firstDate && lastDate ? { start: firstDate, end: lastDate } : null,
  });
}
