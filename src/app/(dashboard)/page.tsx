'use client';

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { BssGauge } from '@/components/bss-gauge';
import { GaugeSkeleton } from '@/components/gauge-skeleton';
import { VerdictLine } from '@/components/verdict-line';
import { Sparkline } from '@/components/sparkline';
import { Upload, Calendar, PenLine } from 'lucide-react';
import { EvidenceSheet } from '@/components/evidence-sheet';
import { useStrategies } from '@/hooks/use-strategies';
import { STRATEGY_ALL, type StrategyFilter } from '@/lib/strategies';
import { useOnboarding } from '@/lib/onboarding-context';
import { IntentionModal } from '@/components/intention-modal';
import { WeeklyWrap } from '@/components/weekly-wrap';
import { SessionNotepad } from '@/components/session-notepad';
import type { StatePayload } from '@/lib/types';

/** Step IDs that require the evidence sheet to be open */
const EVIDENCE_STEP_IDS = new Set(['evidence-sessions', 'evidence-violations', 'evidence-trends']);

/**
 * Dashboard — The Cockpit
 *
 * Three-column layout:
 *   Left:   Weekly Wrap (toggleable)
 *   Center: BSS orb + verdict (always visible)
 *   Right:  Session Notepad (toggleable)
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
  const { strategies } = useStrategies();
  const [activeStrategy, setActiveStrategy] = useState<StrategyFilter>(STRATEGY_ALL);
  const { currentTooltipStep, isActive: onboardingActive } = useOnboarding();

  // Side panel toggles
  const [wrapOpen, setWrapOpen] = useState(false);
  const [notepadOpen, setNotepadOpen] = useState(false);

  // Auto-open evidence sheet when onboarding navigates to evidence breakdown steps
  useEffect(() => {
    if (onboardingActive && currentTooltipStep && EVIDENCE_STEP_IDS.has(currentTooltipStep)) {
      setSheetOpen(true);
    }
  }, [onboardingActive, currentTooltipStep]);

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
          <span className="section-label">
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
          className="mt-4 flex items-center gap-2 rounded-full bg-gold px-5 py-2.5 font-mono text-[13px] font-bold text-void uppercase tracking-[0.1em] transition-all hover:bg-gold-light"
        >
          <Upload size={14} />
          Upload CSV
        </Link>
      </div>
    );
  }

  const effectiveState = data.onboarding.is_building ? 'BUILDING' : data.drift.state;

  return (
    <div className="relative flex h-full overflow-hidden">

      {/* ── TOGGLE BUTTONS — top-level z so panels never cover them ── */}
      <div className="absolute top-3 left-4 z-40">
        <button
          onClick={() => setWrapOpen(!wrapOpen)}
          className={`flex items-center gap-1.5 rounded-full px-3 py-1.5 font-mono text-[10px] font-bold uppercase tracking-[0.15em] transition-all border backdrop-blur-md ${
            wrapOpen
              ? 'bg-[rgba(200,169,110,0.1)] border-[rgba(200,169,110,0.2)] text-gold'
              : 'bg-[rgba(200,169,110,0.03)] border-[rgba(200,169,110,0.08)] text-text-dim hover:text-warm-muted hover:bg-[rgba(200,169,110,0.06)]'
          }`}
          title="Toggle Weekly Wrap"
        >
          <Calendar size={12} />
          Wrap
        </button>
      </div>

      <div className="absolute top-3 right-16 z-40">
        <button
          onClick={() => setNotepadOpen(!notepadOpen)}
          className={`flex items-center gap-1.5 rounded-full px-3 py-1.5 font-mono text-[10px] font-bold uppercase tracking-[0.15em] transition-all border backdrop-blur-md ${
            notepadOpen
              ? 'bg-[rgba(200,169,110,0.1)] border-[rgba(200,169,110,0.2)] text-gold'
              : 'bg-[rgba(200,169,110,0.03)] border-[rgba(200,169,110,0.08)] text-text-dim hover:text-warm-muted hover:bg-[rgba(200,169,110,0.06)]'
          }`}
          title="Toggle Session Notes"
        >
          <PenLine size={12} />
          Notes
        </button>
      </div>

      {/* ── LEFT PANEL: Weekly Wrap (toggleable) ── */}
      <div
        className={`absolute top-0 left-0 h-full z-20 transition-all duration-300 ease-in-out ${
          wrapOpen ? 'w-80 opacity-100 translate-x-0' : 'w-0 opacity-0 -translate-x-4'
        }`}
      >
        {wrapOpen && (
          <div className="h-full w-80 p-4 pt-12 overflow-y-auto">
            <WeeklyWrap />
          </div>
        )}
      </div>

      {/* ── CENTER: BSS Orb + Surface Layer ── */}
      <div className="flex-1 flex flex-col items-center justify-center relative z-10">

        {/* Strategy pill tabs — only show when user has 2+ strategies */}
        {strategies.length > 1 && (
          <div className="mb-4 flex items-center gap-1 rounded-full bg-[rgba(200,169,110,0.03)] p-1 border border-[rgba(200,169,110,0.06)]">
            <button
              onClick={() => setActiveStrategy(STRATEGY_ALL)}
              className={`rounded-full px-4 py-1.5 font-mono text-[10px] font-bold uppercase tracking-[0.15em] transition-all ${
                activeStrategy === STRATEGY_ALL
                  ? 'bg-[rgba(200,169,110,0.1)] text-gold shadow-sm'
                  : 'text-text-dim hover:text-warm-muted'
              }`}
            >
              All
            </button>
            {strategies.map((s) => (
              <button
                key={s.strategy_id}
                onClick={() => setActiveStrategy(s.strategy_id)}
                className={`rounded-full px-4 py-1.5 font-mono text-[10px] font-bold uppercase tracking-[0.15em] transition-all ${
                  activeStrategy === s.strategy_id
                    ? 'bg-[rgba(200,169,110,0.1)] text-gold shadow-sm'
                    : 'text-text-dim hover:text-warm-muted'
                }`}
              >
                {s.tag}
              </button>
            ))}
          </div>
        )}

        {/* BSS label + freshness indicator */}
        <div className="mb-6 flex flex-col items-center gap-1.5">
          <span className="section-label">
            Behavioral Stability Score
          </span>
          <DataFreshnessIndicator computedAt={data.drift.computed_at} />
        </div>

        {/* 1. BSS Gauge — 240° arc, score centered, tap opens evidence sheet */}
        <div
          data-onboard="bss-gauge"
          onClick={() => setSheetOpen(true)}
          className="relative cursor-pointer transition-transform hover:scale-[1.02] rounded-full p-4"
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
          <span className={`font-mono text-[14px] font-medium ${
            (data.bss_delta ?? 0) > 0 ? 'text-positive' : (data.bss_delta ?? 0) < 0 ? 'text-negative' : 'text-text-muted'
          }`}>
            {(data.bss_delta ?? 0) > 0 ? '+' : ''}{data.bss_delta ?? 0} since last session
          </span>

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

      {/* ── RIGHT PANEL: Compact Session Notepad (toggleable) ── */}
      {/* Always mounted so CSS transition works. pointer-events-none when hidden. */}
      <div
        className={`absolute bottom-6 right-14 z-30 transition-all duration-300 ease-in-out ${
          notepadOpen
            ? 'opacity-100 translate-y-0 pointer-events-auto'
            : 'opacity-0 translate-y-3 pointer-events-none'
        }`}
      >
        <div className="w-60 glass-card p-3">
          <SessionNotepad />
        </div>
      </div>

      {/* ── EVIDENCE SHEET: Opens from gauge tap (Layer 2) ── */}
      <EvidenceSheet
        isOpen={sheetOpen}
        onClose={() => {
          if (onboardingActive && currentTooltipStep && EVIDENCE_STEP_IDS.has(currentTooltipStep)) return;
          setSheetOpen(false);
        }}
        accountRef={data.account_ref}
      />

      {/* Pre-session intention capture — shows once per day if no intention set */}
      <IntentionModal />
    </div>
  );
}
