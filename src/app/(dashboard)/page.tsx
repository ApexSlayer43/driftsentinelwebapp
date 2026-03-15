'use client';

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { BssGauge } from '@/components/bss-gauge';
import { GaugeSkeleton } from '@/components/gauge-skeleton';
import { VerdictLine } from '@/components/verdict-line';
import { Sparkline } from '@/components/sparkline';
import { Upload } from 'lucide-react';
import { EvidenceSheet } from '@/components/evidence-sheet';
import type { StatePayload } from '@/lib/types';

/**
 * Dashboard — The Cockpit (Invisible Interface spec, Screen 01)
 *
 * Surface layer: exactly 5 elements, nothing else.
 *   1. BSS Score (240° arc gauge, 48px score)
 *   2. Tier Badge (color-coded capsule below score)
 *   3. Delta Indicator ("+3 from last week", cyan/orange)
 *   4. 7-Day Sparkline (40×16px, adjacent to delta)
 *   5. Verdict Line (one sentence, natural language)
 *
 * Tap gauge → evidence sheet (Layer 2).
 * Never show more than 5 data points on the surface layer.
 */

/** Data freshness — ambient indicator, not a surface element */
type FreshnessState = 'LIVE' | 'STALE' | 'ERROR';

function getDataFreshness(computedAt: string | null): { state: FreshnessState; label: string } {
  if (!computedAt) return { state: 'ERROR', label: 'ERROR' };
  const age = (Date.now() - new Date(computedAt).getTime()) / 1000;
  if (!Number.isFinite(age) || age < 0) return { state: 'ERROR', label: 'ERROR' };
  if (age < 120) return { state: 'LIVE', label: 'LIVE' };
  return { state: 'STALE', label: 'STALE' };
}

const FRESHNESS_STYLES: Record<FreshnessState, { dot: string; text: string }> = {
  LIVE:  { dot: 'bg-positive',    text: 'text-positive' },
  STALE: { dot: 'bg-warning',     text: 'text-warning' },
  ERROR: { dot: 'bg-negative',    text: 'text-negative' },
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
      <span className={`font-mono text-[10px] font-bold uppercase tracking-[0.15em] ${styles.text}`}>
        {freshness.label}
      </span>
    </div>
  );
}


export default function DashboardPage() {
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

  // ── Loading state — skeleton pulse in gauge shape (spec: never a spinner) ──
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
          <span className="font-mono text-[12px] font-semibold uppercase tracking-[0.12em] text-text-muted">
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

        <p className="mt-6 font-mono text-[14px] text-text-secondary">
          No data yet. Upload your Tradovate CSV to begin.
        </p>

        <Link
          href="/ingest"
          className="mt-4 flex items-center gap-2 rounded-2xl bg-accent-primary px-5 py-2.5 font-mono text-[14px] font-bold text-text-primary transition-opacity hover:opacity-90"
        >
          <Upload size={14} />
          Upload CSV
        </Link>
      </div>
    );
  }

  const effectiveState = data.onboarding.is_building ? 'BUILDING' : data.drift.state;

  return (
    <div className="relative flex min-h-full flex-col">
      {/* ── SURFACE LAYER: Exactly 5 Elements (spec Section 2) ── */}
      <div className="flex flex-1 flex-col items-center justify-center">

        {/* BSS label + freshness indicator */}
        <div className="mb-6 flex flex-col items-center gap-1.5">
          <span className="font-mono text-[12px] font-semibold uppercase tracking-[0.12em] text-text-muted">
            Behavioral Stability Score
          </span>
          <DataFreshnessIndicator computedAt={data.drift.computed_at} />
        </div>

        {/* 1. BSS Gauge — 240° arc, score centered, tap opens evidence sheet */}
        <div
          onClick={() => setSheetOpen(true)}
          className="cursor-pointer transition-transform hover:scale-[1.02]"
          role="button"
          tabIndex={0}
          onKeyDown={(e) => e.key === 'Enter' && setSheetOpen(true)}
          aria-label={`BSS Score ${data.bss_score}. Tap to view evidence.`}
        >
          <BssGauge
            score={data.bss_score}
            tier={data.bss_tier}
            state={effectiveState}
            delta={data.bss_delta ?? 0}
            yesterdayScore={data.bss_yesterday ?? 50}
            size="lg"
            isBuilding={data.onboarding.is_building}
            buildProgress={data.onboarding.is_building ? data.onboarding.baseline_progress : undefined}
          />
        </div>

        {/* 2-3. Delta + Sparkline row — adjacent per spec */}
        <div className="mt-4 flex items-center gap-4">
          {/* Delta indicator */}
          <span className={`font-mono text-[14px] font-medium ${
            (data.bss_delta ?? 0) > 0 ? 'text-positive' : (data.bss_delta ?? 0) < 0 ? 'text-negative' : 'text-text-muted'
          }`}>
            {(data.bss_delta ?? 0) > 0 ? '+' : ''}{data.bss_delta ?? 0} since last session
          </span>

          {/* 7-Day Sparkline — 40×16px, pure shape recognition */}
          {data.bss_sparkline && data.bss_sparkline.length >= 2 && (
            <Sparkline
              data={data.bss_sparkline}
              tier={data.bss_tier}
              width={40}
              height={16}
            />
          )}
        </div>

        {/* 4. Verdict Line — one sentence, Senti's surface-level voice */}
        <div className="mt-5">
          <VerdictLine data={data} />
        </div>

        {error && (
          <p className="mt-3 font-mono text-[12px] text-warning">
            Using cached data. {error}
          </p>
        )}
      </div>

      {/* ── EVIDENCE SHEET: Opens from gauge tap (Layer 2) ── */}
      <EvidenceSheet
        isOpen={sheetOpen}
        onClose={() => setSheetOpen(false)}
        accountRef={data.account_ref}
      />
    </div>
  );
}
