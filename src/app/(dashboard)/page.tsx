'use client';

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { BssOrb } from '@/components/bss-orb';
import { ViolationRow } from '@/components/violation-row';
import { DriverRow } from '@/components/driver-row';
import { GlowingEffect } from '@/components/ui/glowing-effect';
import { Upload } from 'lucide-react';
import { getInsight } from '@/lib/insights';
import { createClient } from '@/lib/supabase/client';
import type { StatePayload } from '@/lib/types';


export default function DashboardPage() {
  const [showDetails, setShowDetails] = useState(false);
  const [data, setData] = useState<StatePayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    try {
      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();

      if (!user) {
        setError('Not authenticated');
        setLoading(false);
        return;
      }

      // Get account(s) for this user
      const { data: accounts } = await supabase
        .from('accounts')
        .select('account_ref, bss_score')
        .eq('user_id', user.id)
        .limit(1);

      if (!accounts || accounts.length === 0) {
        setLoading(false);
        return;
      }

      const accountRef = accounts[0].account_ref;

      // Fetch all needed data in parallel from Supabase
      const todayStart = new Date();
      todayStart.setUTCHours(0, 0, 0, 0);
      const todayISO = todayStart.toISOString();

      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

      const [
        driftScoresRes,
        violationsRes,
        todayFillsRes,
        modeStateRes,
        userConfigRes,
        totalFillsRes,
        dailyScoresRes,
      ] = await Promise.all([
        // Latest drift score
        supabase
          .from('drift_scores')
          .select('*')
          .eq('account_ref', accountRef)
          .order('computed_at', { ascending: false })
          .limit(1),
        // Today's violations
        supabase
          .from('violations')
          .select('*')
          .eq('account_ref', accountRef)
          .gte('first_seen_utc', todayISO)
          .order('first_seen_utc', { ascending: false }),
        // Today's fills count
        supabase
          .from('fills_canonical')
          .select('event_id', { count: 'exact', head: true })
          .eq('account_ref', accountRef)
          .gte('timestamp_utc', todayISO),
        // Active mode states (drift drivers)
        supabase
          .from('mode_state')
          .select('*')
          .eq('account_ref', accountRef)
          .eq('state', 'ACTIVE'),
        // User config
        supabase
          .from('user_configs')
          .select('*')
          .eq('account_ref', accountRef)
          .limit(1),
        // Total fills for onboarding progress
        supabase
          .from('fills_canonical')
          .select('event_id', { count: 'exact', head: true })
          .eq('account_ref', accountRef),
        // Last 30 days of daily scores for BSS calculation
        supabase
          .from('daily_scores')
          .select('trading_date, dsi_score')
          .eq('account_ref', accountRef)
          .gte('trading_date', thirtyDaysAgo.toISOString().slice(0, 10))
          .order('trading_date', { ascending: false }),
      ]);

      const driftScore = driftScoresRes.data?.[0] ?? null;
      const violations = violationsRes.data ?? [];
      const todayFillsCount = todayFillsRes.count ?? 0;
      const modeStates = modeStateRes.data ?? [];
      const config = userConfigRes.data?.[0] ?? null;
      const totalFills = totalFillsRes.count ?? 0;
      const dailyScores = (dailyScoresRes.data ?? []) as { trading_date: string; dsi_score: number }[];

      // Build onboarding view
      const baselineWindowFills = config?.baseline_window_fills ?? 200;
      const scoringWindowFills = config?.scoring_window_fills ?? 20;
      const isBuilding = totalFills < baselineWindowFills;

      // Build drivers from mode_state + drift_scores.top_modes
      const topModes = (driftScore?.top_modes ?? []) as { mode: string; points: number }[];
      const drivers = modeStates.map((ms: { mode: string; onset_utc: string | null }) => {
        // Get points from drift_scores.top_modes first, fall back to today's violations
        const fromTopModes = topModes.find((tm) => tm.mode === ms.mode);
        const modePoints = fromTopModes?.points ??
          violations
            .filter((v: { mode: string }) => v.mode === ms.mode)
            .reduce((sum: number, v: { points: number }) => sum + v.points, 0);
        return {
          mode: ms.mode,
          points: modePoints,
          onset_utc: ms.onset_utc ?? new Date().toISOString(),
        };
      }).sort((a: { points: number }, b: { points: number }) => b.points - a.points);

      // ── BSS Algorithm: 60/40 weighted average ──
      // Last 7 days DSI scores × 0.60 weight
      // Days 8-30 DSI scores × 0.40 weight
      const sevenDaysAgo = new Date();
      sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
      const sevenDaysAgoStr = sevenDaysAgo.toISOString().slice(0, 10);

      const recent7 = dailyScores.filter(d => d.trading_date > sevenDaysAgoStr);
      const older8to30 = dailyScores.filter(d => d.trading_date <= sevenDaysAgoStr);

      let bssScore: number;
      if (dailyScores.length === 0) {
        // No history — use account stored value or default
        bssScore = accounts[0].bss_score ?? 100;
      } else if (recent7.length > 0 && older8to30.length > 0) {
        const recentAvg = recent7.reduce((s, d) => s + d.dsi_score, 0) / recent7.length;
        const olderAvg = older8to30.reduce((s, d) => s + d.dsi_score, 0) / older8to30.length;
        bssScore = Math.round(recentAvg * 0.60 + olderAvg * 0.40);
      } else if (recent7.length > 0) {
        // Only recent data, use as-is
        bssScore = Math.round(recent7.reduce((s, d) => s + d.dsi_score, 0) / recent7.length);
      } else {
        // Only older data
        bssScore = Math.round(older8to30.reduce((s, d) => s + d.dsi_score, 0) / older8to30.length);
      }

      // Determine BSS tier
      let bssTier: 'UNRANKED' | 'DRAFT' | 'TESTED' | 'VERIFIED' = 'UNRANKED';
      if (isBuilding) bssTier = 'UNRANKED';
      else if (bssScore >= 85) bssTier = 'VERIFIED';
      else if (bssScore >= 65) bssTier = 'TESTED';
      else if (bssScore >= 40) bssTier = 'DRAFT';

      // ── DSI Score: 100 minus today's total violation points ──
      const todayTotalPoints = violations.reduce((sum: number, v: { points: number }) => sum + v.points, 0);
      const dsiScore = Math.max(0, 100 - todayTotalPoints);

      // Protocol breaches today
      const protocolBreaches = violations.filter((v: { severity: string }) =>
        v.severity === 'HIGH' || v.severity === 'CRITICAL'
      ).length;

      // Assemble the StatePayload
      const statePayload: StatePayload = {
        account_ref: accountRef,
        drift: {
          state: driftScore?.state ?? 'STABLE',
          drift_index: driftScore?.drift_index ?? 0,
          data_stale: driftScore?.data_stale ?? false,
          computed_at: driftScore?.computed_at ?? null,
          window_start_utc: driftScore?.window_start_utc ?? null,
          window_end_utc: driftScore?.window_end_utc ?? null,
          drivers,
        },
        last_execution_update_utc: null,
        protocol: {
          ref: accountRef,
          version: '1.0',
          activation_utc: null,
          source: 'SUPABASE',
        },
        metrics: {
          trades_today_utc: todayFillsCount,
          violations_today_utc: violations.length,
          protocol_breaches_today_utc: protocolBreaches,
          daily_pnl: null,
        },
        bss_score: bssScore,
        bss_tier: bssTier,
        dsi_score: dsiScore,
        dsi_state: dsiScore >= 80 ? 'CLEAN' : dsiScore >= 50 ? 'DRIFT' : 'BREACH',
        violations_today: violations.map((v: {
          violation_id: string;
          mode: string;
          rule_id: string;
          severity: 'LOW' | 'MED' | 'HIGH' | 'CRITICAL';
          points: number;
          first_seen_utc: string;
          created_at: string;
        }) => ({
          violation_id: v.violation_id,
          mode: v.mode,
          rule_id: v.rule_id,
          severity: v.severity,
          points: v.points,
          first_seen_utc: v.first_seen_utc,
          created_at: v.created_at,
        })),
        onboarding: {
          phase: isBuilding ? 'BASELINE' : 'ACTIVE',
          status: isBuilding ? 'BUILDING' : 'READY',
          is_building: isBuilding,
          total_fills_seen: totalFills,
          scoring_window_fills: scoringWindowFills,
          baseline_window_fills: baselineWindowFills,
          scoring_progress: {
            collected: Math.min(totalFills, scoringWindowFills),
            required: scoringWindowFills,
            remaining: Math.max(0, scoringWindowFills - totalFills),
          },
          baseline_progress: {
            collected: Math.min(totalFills, baselineWindowFills),
            required: baselineWindowFills,
            remaining: Math.max(0, baselineWindowFills - totalFills),
          },
        },
      };

      setData(statePayload);
    } catch (err) {
      console.error('Failed to fetch state:', err);
      setError(err instanceof Error ? err.message : 'Failed to load');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Broadcast state to layout for ambient dots + sidebar
  useEffect(() => {
    if (!data) return;
    const state = data.onboarding.is_building ? 'BUILDING' : data.drift.state;
    window.dispatchEvent(
      new CustomEvent('drift-state-update', {
        detail: { state, bssScore: data.bss_score, bssTier: data.bss_tier },
      })
    );
  }, [data]);

  if (loading) {
    return (
      <div className="flex h-full items-center justify-center">
        <div className="text-center">
          <div className="h-6 w-6 animate-spin rounded-full border-2 border-stable border-t-transparent mx-auto" />
          <p className="mt-3 font-mono text-xs text-text-muted">Loading state...</p>
        </div>
      </div>
    );
  }

  if (!data) {
    return (
      <div className="flex h-full flex-col items-center justify-center">
        {/* BSS label */}
        <div className="mb-6">
          <span className="font-mono text-[10px] font-semibold uppercase tracking-[0.15em] text-text-muted">
            Behavioral Stability Score
          </span>
        </div>

        {/* BSS Orb at 0, UNRANKED */}
        <BssOrb
          score={0}
          tier="UNRANKED"
          state="BUILDING"
          yesterdayScore={undefined}
          size="lg"
          isBuilding={false}
          buildProgress={undefined}
        />

        <p className="mt-6 font-mono text-sm text-text-muted">
          No data yet. Upload your Tradovate CSV to begin.
        </p>

        <Link
          href="/ingest"
          className="mt-4 flex items-center gap-2 rounded-lg bg-stable px-5 py-2.5 font-mono text-sm font-bold text-void transition-opacity hover:opacity-90"
        >
          <Upload size={14} />
          Upload CSV
        </Link>
      </div>
    );
  }

  const insight = getInsight(data);
  const effectiveState = data.onboarding.is_building ? 'BUILDING' : data.drift.state;

  const insightColorMap = {
    positive: 'text-stable',
    warning: 'text-drift',
    caution: 'text-compromised',
    neutral: 'text-text-secondary',
  };

  return (
    <div className="flex min-h-full flex-col overflow-auto">
      {/* Signal Mode: Always visible */}
      <div className={`flex flex-col items-center justify-center transition-all duration-500 ${showDetails ? 'pt-8 pb-4' : 'flex-1'}`}>
        {/* BSS label */}
        <div className="mb-6">
          <span className="font-mono text-[10px] font-semibold uppercase tracking-[0.15em] text-text-muted">
            Behavioral Stability Score
          </span>
        </div>

        {/* BSS Orb */}
        <BssOrb
          score={data.bss_score}
          tier={data.bss_tier}
          state={effectiveState}
          yesterdayScore={undefined}
          size={showDetails ? 'sm' : 'lg'}
          isBuilding={data.onboarding.is_building}
          buildProgress={data.onboarding.is_building ? data.onboarding.baseline_progress : undefined}
        />

        {/* Insight */}
        <p className={`mt-4 max-w-md text-center font-mono text-sm ${insightColorMap[insight.tone]}`}>
          {insight.text}
        </p>

        {/* Toggle */}
        <button
          onClick={() => setShowDetails(!showDetails)}
          className="mt-4 font-mono text-[10px] uppercase tracking-[0.15em] text-text-muted transition-colors hover:text-text-secondary"
        >
          {showDetails ? 'Hide Details' : 'View Details'}
        </button>

        {error && (
          <p className="mt-2 font-mono text-[9px] text-drift">
            Using cached data. {error}
          </p>
        )}
      </div>

      {/* Detail Mode: Bento grid */}
      {showDetails && (
        <div className="animate-in slide-in-from-bottom-4 mx-6 mb-6">
          <ul className="grid grid-cols-1 grid-rows-none gap-4 md:grid-cols-12 md:grid-rows-3 lg:gap-4 xl:grid-rows-2">
            {/* Trades Today */}
            <GlowGridItem
              area="md:[grid-area:1/1/2/4] xl:[grid-area:1/1/2/4]"
              label="Trades Today"
              value={String(data.metrics.trades_today_utc)}
            />
            {/* Violations Today */}
            <GlowGridItem
              area="md:[grid-area:1/4/2/7] xl:[grid-area:1/4/2/7]"
              label="Violations Today"
              value={String(data.metrics.violations_today_utc)}
            />
            {/* DSI Score */}
            <GlowGridItem
              area="md:[grid-area:1/7/2/10] xl:[grid-area:1/7/2/10]"
              label="DSI Score"
              value={String(data.dsi_score)}
            />
            {/* Protocol Breaches */}
            <GlowGridItem
              area="md:[grid-area:1/10/2/13] xl:[grid-area:1/10/2/13]"
              label="Protocol Breaches"
              value={String(data.metrics.protocol_breaches_today_utc)}
            />

            {/* Today's Violations */}
            <li className="min-h-[10rem] list-none md:[grid-area:2/1/4/7] xl:[grid-area:2/1/3/7]">
              <div className="relative h-full rounded-[1.25rem] border-[0.75px] border-border-subtle p-2 md:rounded-[1.5rem] md:p-3">
                <GlowingEffect
                  spread={40}
                  glow={true}
                  disabled={false}
                  proximity={64}
                  inactiveZone={0.01}
                  borderWidth={3}
                />
                <div className="relative flex h-full flex-col gap-3 overflow-hidden rounded-xl border-[0.75px] border-border-dim liquid-glass p-5">
                  <h3 className="font-mono text-[8px] font-semibold uppercase tracking-[0.2em] text-text-muted">
                    Today&apos;s Violations
                  </h3>
                  {data.violations_today.length === 0 ? (
                    <div className="flex flex-1 items-center justify-center">
                      <p className="font-mono text-xs text-text-muted">No violations today</p>
                    </div>
                  ) : (
                    <div className="flex flex-col gap-2">
                      {data.violations_today.map((v) => (
                        <ViolationRow key={v.violation_id} violation={v} />
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </li>

            {/* Active Drivers */}
            <li className="min-h-[10rem] list-none md:[grid-area:2/7/4/13] xl:[grid-area:2/7/3/13]">
              <div className="relative h-full rounded-[1.25rem] border-[0.75px] border-border-subtle p-2 md:rounded-[1.5rem] md:p-3">
                <GlowingEffect
                  spread={40}
                  glow={true}
                  disabled={false}
                  proximity={64}
                  inactiveZone={0.01}
                  borderWidth={3}
                />
                <div className="relative flex h-full flex-col gap-3 overflow-hidden rounded-xl border-[0.75px] border-border-dim liquid-glass p-5">
                  <h3 className="font-mono text-[8px] font-semibold uppercase tracking-[0.2em] text-text-muted">
                    Active Drivers
                  </h3>
                  {data.drift.drivers.length === 0 ? (
                    <div className="flex flex-1 items-center justify-center">
                      <p className="font-mono text-xs text-text-muted">No active drift drivers</p>
                    </div>
                  ) : (
                    <div className="flex flex-col gap-2">
                      {data.drift.drivers.map((d, i) => (
                        <DriverRow key={d.mode} driver={d} rank={i + 1} />
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </li>
          </ul>
        </div>
      )}
    </div>
  );
}

interface GlowGridItemProps {
  area: string;
  label: string;
  value: string;
}

function GlowGridItem({ area, label, value }: GlowGridItemProps) {
  return (
    <li className={`min-h-[6rem] list-none ${area}`}>
      <div className="relative h-full rounded-[1.25rem] border-[0.75px] border-border-subtle p-2 md:rounded-[1.5rem] md:p-3">
        <GlowingEffect
          spread={40}
          glow={true}
          disabled={false}
          proximity={64}
          inactiveZone={0.01}
          borderWidth={3}
        />
        <div className="relative flex h-full flex-col items-center justify-center gap-1.5 overflow-hidden rounded-xl border-[0.75px] border-border-dim liquid-glass p-5">
          <p className="font-mono text-[7px] font-semibold uppercase tracking-[0.18em] text-text-muted">
            {label}
          </p>
          <h3 className="font-mono text-2xl font-bold text-text-primary">
            {value}
          </h3>
        </div>
      </div>
    </li>
  );
}
