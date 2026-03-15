'use client';

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { BssGauge } from '@/components/bss-gauge';
import { GaugeSkeleton } from '@/components/gauge-skeleton';
import { VerdictLine } from '@/components/verdict-line';
import { Sparkline } from '@/components/sparkline';
import { ViolationRow } from '@/components/violation-row';
import { DriverRow } from '@/components/driver-row';
import { GlowingEffect } from '@/components/ui/glowing-effect';
import { Upload } from 'lucide-react';
import { EvidenceSheet } from '@/components/evidence-sheet';
import { ProtocolGrid } from '@/components/protocol-grid';
import type { StatePayload } from '@/lib/types';

/** Data freshness indicator — LIVE / STALE / ERROR */
type FreshnessState = 'LIVE' | 'STALE' | 'ERROR';

function getDataFreshness(computedAt: string | null): { state: FreshnessState; label: string } {
  if (!computedAt) return { state: 'ERROR', label: 'ERROR' };
  const age = (Date.now() - new Date(computedAt).getTime()) / 1000;
  if (!Number.isFinite(age) || age < 0) return { state: 'ERROR', label: 'ERROR' };
  if (age < 120) return { state: 'LIVE', label: 'LIVE' };
  return { state: 'STALE', label: 'STALE' };
}

const FRESHNESS_STYLES: Record<FreshnessState, { dot: string; text: string }> = {
  LIVE:  { dot: 'bg-stable',      text: 'text-stable' },
  STALE: { dot: 'bg-drift',       text: 'text-drift' },
  ERROR: { dot: 'bg-compromised', text: 'text-compromised' },
};

function DataFreshnessIndicator({ computedAt }: { computedAt: string | null }) {
  const [freshness, setFreshness] = useState(() => getDataFreshness(computedAt));

  useEffect(() => {
    setFreshness(getDataFreshness(computedAt));
    const id = setInterval(() => setFreshness(getDataFreshness(computedAt)), 10_000);
    return () => clearInterval(id);
  }, [computedAt]);

  const styles = FRESHNESS_STYLES[freshness.state];

  return (
    <div className="flex items-center gap-1.5">
      <span className={`inline-block h-1.5 w-1.5 rounded-full ${styles.dot} ${freshness.state === 'LIVE' ? 'animate-pulse' : ''}`} />
      <span className={`font-mono text-[8px] font-bold uppercase tracking-[0.15em] ${styles.text}`}>
        {freshness.label}
      </span>
    </div>
  );
}

/** Live UTC clock — updates every second */
function UtcClock() {
  const [now, setNow] = useState<string>('');
  useEffect(() => {
    const tick = () => {
      const d = new Date();
      setNow(
        d.toISOString().slice(0, 10) + ' ' +
        d.toISOString().slice(11, 19) + ' UTC'
      );
    };
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, []);
  return (
    <span className="font-mono text-[9px] tracking-wider text-text-muted">
      {now}
    </span>
  );
}


export default function DashboardPage() {
  const [showDetails, setShowDetails] = useState(false);
  const [sheetOpen, setSheetOpen] = useState(false);
  const [data, setData] = useState<StatePayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    try {
      const res = await fetch('/api/state');

      if (res.status === 401) {
        setError('Not authenticated');
        setLoading(false);
        return;
      }

      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error ?? `State fetch failed: ${res.status}`);
      }

      const statePayload: StatePayload = await res.json();
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

  // ── Loading state ──
  if (loading) {
    return (
      <div className="flex h-full items-center justify-center">
        <GaugeSkeleton size="lg" />
      </div>
    );
  }

  // ── No data state ──
  if (!data) {
    return (
      <div className="flex h-full flex-col items-center justify-center">
        <div className="mb-6">
          <span className="font-mono text-[10px] font-semibold uppercase tracking-[0.15em] text-text-muted">
            Behavioral Stability Score
          </span>
        </div>

        <BssGauge
          score={50}
          tier="DORMANT"
          state="BUILDING"
          delta={0}
          yesterdayScore={50}
          size="lg"
          isBuilding={false}
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

  const effectiveState = data.onboarding.is_building ? 'BUILDING' : data.drift.state;

  return (
    <div className="relative flex min-h-full flex-col overflow-auto">
      {/* UTC Clock — top right */}
      <div className="absolute top-4 right-6 z-10">
        <UtcClock />
      </div>

      {/* ── SURFACE LAYER: 5-Element Signal Display ── */}
      <div className={`flex flex-col items-center justify-center transition-all duration-500 ${showDetails ? 'pt-8 pb-4' : 'flex-1'}`}>
        {/* 1. BSS label + data freshness */}
        <div className="mb-6 flex flex-col items-center gap-1.5">
          <span className="font-mono text-[10px] font-semibold uppercase tracking-[0.15em] text-text-muted">
            Behavioral Stability Score
          </span>
          <DataFreshnessIndicator computedAt={data.drift.computed_at} />
        </div>

        {/* 2. BSS Gauge (replaces BssOrb) — 240° arc, delta inside. Click opens Evidence Sheet */}
        <div
          onClick={() => setSheetOpen(true)}
          className="cursor-pointer transition-transform hover:scale-[1.02]"
          role="button"
          tabIndex={0}
          onKeyDown={(e) => e.key === 'Enter' && setSheetOpen(true)}
        >
          <BssGauge
            score={data.bss_score}
            tier={data.bss_tier}
            state={effectiveState}
            delta={data.bss_delta ?? 0}
            yesterdayScore={data.bss_yesterday ?? 50}
            size={showDetails ? 'sm' : 'lg'}
            isBuilding={data.onboarding.is_building}
            buildProgress={data.onboarding.is_building ? data.onboarding.baseline_progress : undefined}
          />
        </div>

        {/* 3. 7-Day Sparkline */}
        {data.bss_sparkline && data.bss_sparkline.length >= 2 && (
          <div className="mt-3">
            <Sparkline
              data={data.bss_sparkline}
              tier={data.bss_tier}
              width={showDetails ? 100 : 140}
              height={showDetails ? 24 : 36}
            />
          </div>
        )}

        {/* 4. Protocol Grid — 5-week compliance calendar */}
        <div className="mt-5 w-full max-w-xs">
          <ProtocolGrid accountRef={data.account_ref} />
        </div>

        {/* 5. Verdict Line */}
        <div className="mt-4">
          <VerdictLine data={data} />
        </div>

        {/* 6. Detail Toggle */}
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

      {/* ── EVIDENCE SHEET: Opens from gauge tap ── */}
      <EvidenceSheet
        isOpen={sheetOpen}
        onClose={() => setSheetOpen(false)}
        accountRef={data.account_ref}
      />

      {/* ── DETAIL MODE: Bento Grid ── */}
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
