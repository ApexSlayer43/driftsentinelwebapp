'use client';

import { useState, useEffect, useCallback } from 'react';
import { BssOrb } from '@/components/bss-orb';
import { StateBadge } from '@/components/state-badge';
import { ViolationRow } from '@/components/violation-row';
import { DriverRow } from '@/components/driver-row';
import { GlowingEffect } from '@/components/ui/glowing-effect';
import { getInsight } from '@/lib/insights';
import { createClient } from '@/lib/supabase/client';
import type { StatePayload } from '@/lib/types';

// Mock data for development — replaced by live API in Piece 8
const MOCK_STATE: StatePayload = {
  account_ref: 'DEMO-001',
  drift: {
    state: 'DRIFT_FORMING',
    drift_index: 24,
    data_stale: false,
    computed_at: new Date().toISOString(),
    window_start_utc: new Date(Date.now() - 86400000).toISOString(),
    window_end_utc: new Date().toISOString(),
    drivers: [
      { mode: 'OFF_SESSION', points: 8, onset_utc: new Date(Date.now() - 3600000).toISOString() },
      { mode: 'FREQUENCY', points: 5, onset_utc: new Date(Date.now() - 7200000).toISOString() },
    ],
  },
  last_execution_update_utc: new Date().toISOString(),
  protocol: {
    ref: 'PROTOCOL/DEMO-001/DEFAULT',
    version: 'v1',
    activation_utc: null,
    source: 'TRADOVATE',
  },
  metrics: {
    trades_today_utc: 8,
    violations_today_utc: 3,
    protocol_breaches_today_utc: 1,
    daily_pnl: null,
  },
  bss_score: 87,
  bss_tier: 'TESTED',
  dsi_score: 74,
  dsi_state: 'DRIFT_FORMING',
  violations_today: [
    {
      violation_id: 'v-mock-001',
      mode: 'OFF_SESSION',
      rule_id: 'R-OFF-01',
      severity: 'MED',
      points: 5,
      first_seen_utc: new Date(Date.now() - 3600000).toISOString(),
      created_at: new Date(Date.now() - 3600000).toISOString(),
    },
    {
      violation_id: 'v-mock-002',
      mode: 'FREQUENCY',
      rule_id: 'R-FREQ-01',
      severity: 'LOW',
      points: 3,
      first_seen_utc: new Date(Date.now() - 7200000).toISOString(),
      created_at: new Date(Date.now() - 7200000).toISOString(),
    },
    {
      violation_id: 'v-mock-003',
      mode: 'OVERSIZE',
      rule_id: 'R-SIZE-01',
      severity: 'HIGH',
      points: 8,
      first_seen_utc: new Date(Date.now() - 1800000).toISOString(),
      created_at: new Date(Date.now() - 1800000).toISOString(),
    },
  ],
  onboarding: {
    phase: 'SCORING',
    status: 'READY',
    is_building: false,
    total_fills_seen: 310,
    scoring_window_fills: 48,
    baseline_window_fills: 262,
    scoring_progress: { collected: 20, required: 20, remaining: 0 },
    baseline_progress: { collected: 50, required: 50, remaining: 0 },
  },
};

const MOCK_YESTERDAY_SCORE = 82;

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
        // Use mock data when not authenticated (dev mode)
        setData(MOCK_STATE);
        setLoading(false);
        return;
      }

      // Try to get device token for this user
      const { data: tokens } = await supabase
        .from('device_tokens')
        .select('device_id,account_ref,token_hash')
        .eq('user_id', user.id)
        .eq('status', 'ACTIVE')
        .limit(1);

      if (!tokens || tokens.length === 0) {
        setData(MOCK_STATE);
        setLoading(false);
        return;
      }

      const apiUrl = process.env.NEXT_PUBLIC_API_URL;
      if (!apiUrl) {
        setData(MOCK_STATE);
        setLoading(false);
        return;
      }

      const res = await fetch(`${apiUrl}/v1/state`, {
        headers: { 'X-Device-Token': tokens[0].token_hash },
        cache: 'no-store',
      });

      if (!res.ok) throw new Error(`API error: ${res.status}`);
      const stateData: StatePayload = await res.json();
      setData(stateData);
    } catch (err) {
      console.error('Failed to fetch state:', err);
      setError(err instanceof Error ? err.message : 'Failed to load');
      setData(MOCK_STATE);
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
      <div className="flex h-full items-center justify-center">
        <p className="font-mono text-sm text-text-muted">No data available</p>
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
          yesterdayScore={MOCK_YESTERDAY_SCORE}
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
