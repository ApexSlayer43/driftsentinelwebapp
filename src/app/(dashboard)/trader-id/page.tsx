'use client';

import { useState, useEffect, useId } from 'react';
import { UserCircle, Copy, Check, Shield, Flame, TrendingUp, TrendingDown, ChevronDown, ChevronRight, Target } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import { getTierStyle } from '@/lib/tokens';
import type { StatePayload } from '@/lib/types';
import { GlowPanel } from '@/components/ui/glow-panel';
import { PerformanceCard } from '@/components/performance-card';

/* ═══════════════════════════════════════════════════════════ */
/*  Types                                                      */
/* ═══════════════════════════════════════════════════════════ */

interface PerfData {
  summary: {
    grossPnl: number;
    netPnl: number;
    totalCommission: number;
    tradeCount: number;
    winCount: number;
    winRate: number;
    expectancy: number;
    totalContracts: number;
    maxRunUp: number;
    maxDrawdown: number;
  };
  sessions: {
    total: number;
    totalFills: number;
    totalViolations: number;
    cleanSessions: number;
    cleanRate: number;
    avgDsi: number | null;
    qualityCounts?: Record<string, number>;
  };
  dateRange: { start: string; end: string } | null;
}

/* ═══════════════════════════════════════════════════════════ */
/*  Constants                                                   */
/* ═══════════════════════════════════════════════════════════ */

const TIERS = [
  { name: 'Dormant', key: 'DORMANT', min: 0 },
  { name: 'Forming', key: 'FORMING', min: 20 },
  { name: 'Developing', key: 'DEVELOPING', min: 40 },
  { name: 'Consistent', key: 'CONSISTENT', min: 60 },
  { name: 'Disciplined', key: 'DISCIPLINED', min: 75 },
  { name: 'Sovereign', key: 'SOVEREIGN', min: 90 },
];

const QUALITY_COLORS: Record<string, string> = {
  CLEAN: '#c8a96e',
  MINOR: 'rgba(200,169,110,0.55)',
  DEGRADED: '#F59E0B',
  COMPROMISED: '#FB923C',
  BREAKDOWN: '#EF4444',
};

const TIER_OPACITIES = [0.15, 0.25, 0.4, 0.55, 0.75, 1.0];

/* ═══════════════════════════════════════════════════════════ */
/*  Helpers                                                     */
/* ═══════════════════════════════════════════════════════════ */

/** Compute a plain-language behavioral verdict from state data */
function computeVerdict(data: StatePayload): string {
  const { bss_streak, bss_delta, drift } = data;
  const state = drift.state;

  if (state === 'BREAKDOWN') return 'Behavioral breakdown detected. Reset and rebuild.';
  if (state === 'COMPROMISED') return 'Discipline compromised. Review recent sessions.';
  if (state === 'DRIFT_FORMING') {
    if (bss_delta < 0) return 'Drift forming. Score declining — tighten protocol adherence.';
    return 'Drift signals detected, but score holding. Stay vigilant.';
  }
  // STABLE
  if (bss_streak >= 14 && bss_delta > 0) return 'Strong consistency. Behavioral trend positive. Keep executing.';
  if (bss_streak >= 7 && bss_delta >= 0) return 'Consistency building. Protocol adherence holding.';
  if (bss_streak >= 3 && bss_delta > 0) return 'Early momentum. Discipline forming, trend positive.';
  if (bss_delta > 3) return 'Score improving. Maintain current approach.';
  if (bss_delta < -3) return 'Score declining despite stable state. Review session patterns.';
  return 'Holding steady. Continue building behavioral baseline.';
}

/** Compute trend direction from sparkline data */
function computeTrend(sparkline: number[]): { direction: 'improving' | 'stable' | 'declining'; label: string; detail: string } {
  if (sparkline.length < 6) return { direction: 'stable', label: 'Insufficient Data', detail: 'Need more sessions to determine trend.' };

  const recent5 = sparkline.slice(-5);
  const prior5 = sparkline.slice(-10, -5);

  if (prior5.length === 0) return { direction: 'stable', label: 'Building Baseline', detail: 'More data needed for trend analysis.' };

  const recentAvg = recent5.reduce((a, b) => a + b, 0) / recent5.length;
  const priorAvg = prior5.reduce((a, b) => a + b, 0) / prior5.length;
  const diff = recentAvg - priorAvg;

  if (diff > 3) return { direction: 'improving', label: 'Improving', detail: `Average BSS up ${diff.toFixed(1)} points over last 5 sessions.` };
  if (diff < -3) return { direction: 'declining', label: 'Declining', detail: `Average BSS down ${Math.abs(diff).toFixed(1)} points over last 5 sessions.` };
  return { direction: 'stable', label: 'Holding Steady', detail: `BSS stable within ±3 points across recent sessions.` };
}

/** Estimate sessions to next tier */
function estimateSessionsToNextTier(score: number, tier: string, sparkline: number[]): { nextTier: string; nextMin: number; sessionsNeeded: string } | null {
  const currentIdx = TIERS.findIndex(t => t.key === tier);
  if (currentIdx >= TIERS.length - 1) return null; // Already Sovereign

  const next = TIERS[currentIdx + 1];
  const pointsNeeded = next.min - score;

  if (pointsNeeded <= 0) return null;

  // Average gain per session from sparkline
  if (sparkline.length < 3) return { nextTier: next.name, nextMin: next.min, sessionsNeeded: '—' };

  const gains: number[] = [];
  for (let i = 1; i < sparkline.length; i++) {
    gains.push(sparkline[i] - sparkline[i - 1]);
  }
  const avgGain = gains.reduce((a, b) => a + b, 0) / gains.length;

  if (avgGain <= 0) return { nextTier: next.name, nextMin: next.min, sessionsNeeded: '—' };

  const est = Math.ceil(pointsNeeded / avgGain);
  return { nextTier: next.name, nextMin: next.min, sessionsNeeded: `~${est}` };
}

/* ═══════════════════════════════════════════════════════════ */
/*  Page Component                                              */
/* ═══════════════════════════════════════════════════════════ */

export default function TraderIdPage() {
  const sparkGradId = useId().replace(/:/g, '');
  const [data, setData] = useState<StatePayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [sparkline, setSparkline] = useState<number[]>([]);
  const [copied, setCopied] = useState(false);
  const [userName, setUserName] = useState('Trader');
  const [perfData, setPerfData] = useState<PerfData | null>(null);
  const [perfExpanded, setPerfExpanded] = useState(false);

  useEffect(() => {
    async function load() {
      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { setLoading(false); return; }

      const meta = user.user_metadata;
      if (meta?.full_name) {
        setUserName(meta.full_name);
      } else if (user.email) {
        setUserName(user.email.split('@')[0]);
      }

      const { data: accounts } = await supabase
        .from('accounts')
        .select('account_ref')
        .eq('user_id', user.id)
        .limit(1);

      if (!accounts || accounts.length === 0) { setLoading(false); return; }
      const ref = accounts[0].account_ref;

      const [stateRes, scoresRes, perfRes] = await Promise.all([
        fetch(`/api/state?account_ref=${ref}`).then(r => r.ok ? r.json() : null).catch(() => null),
        supabase
          .from('daily_scores')
          .select('bss_score')
          .eq('account_ref', ref)
          .gte('trading_date', new Date(Date.now() - 90 * 86400000).toISOString().slice(0, 10))
          .order('trading_date', { ascending: true }),
        fetch(`/api/performance?account_ref=${ref}`).then(r => r.ok ? r.json() : null).catch(() => null),
      ]);

      if (stateRes) {
        setData(stateRes);
        setSparkline(stateRes.bss_sparkline || []);
      }

      if (scoresRes.data && scoresRes.data.length > 0) {
        setSparkline(scoresRes.data.map((s: { bss_score: number }) => s.bss_score));
      }

      if (perfRes) setPerfData(perfRes);

      setLoading(false);
    }
    load();
  }, []);

  if (loading) {
    return (
      <div className="flex h-full items-center justify-center">
        <div className="h-5 w-5 animate-pulse rounded-full bg-[rgba(200,169,110,0.06)]" />
      </div>
    );
  }

  if (!data) {
    return (
      <div className="flex h-full items-center justify-center">
        <div className="text-center">
          <UserCircle size={48} className="mx-auto text-text-dim" />
          <p className="mt-4 font-sans text-[14px] text-text-muted">
            No trading data yet. Upload your first session to create your DS Trader ID.
          </p>
        </div>
      </div>
    );
  }

  // Compute tier from BSS score — don't blindly trust backend tier value
  // Walk the TIERS array backwards to find the highest tier the score qualifies for
  const computedTierIndex = (() => {
    for (let i = TIERS.length - 1; i >= 0; i--) {
      if (data.bss_score >= TIERS[i].min) return i;
    }
    return 0;
  })();
  const computedTier = TIERS[computedTierIndex].key;

  // Use backend tier if it matches a known tier, otherwise use computed
  const backendTierIndex = TIERS.findIndex(t => t.key === data.bss_tier);
  const currentTierIndex = backendTierIndex >= 0 ? backendTierIndex : computedTierIndex;
  const effectiveTier = TIERS[currentTierIndex].key;

  const tierStyle = getTierStyle(effectiveTier);
  const delta = data.bss_delta;
  const profileId = `ds://${userName.toLowerCase().replace(/\s+/g, '-')}-${data.account_ref.slice(0, 4)}`;
  const shareUrl = `driftsentinel.com/id/${userName.toLowerCase().replace(/\s+/g, '-')}-${data.account_ref.slice(0, 4)}`;
  const verdict = computeVerdict(data);
  const trend = computeTrend(sparkline);
  const nextTierEst = estimateSessionsToNextTier(data.bss_score, effectiveTier, sparkline);
  const currentTierMin = TIERS[currentTierIndex]?.min ?? 0;
  const nextTierMin = currentTierIndex < TIERS.length - 1 ? TIERS[currentTierIndex + 1].min : 100;
  const tierProgress = nextTierMin > currentTierMin
    ? Math.min(100, Math.round(((data.bss_score - currentTierMin) / (nextTierMin - currentTierMin)) * 100))
    : 100;

  // Sparkline geometry
  const sparkW = 460;
  const sparkH = 80;
  const sparkPoints = sparkline.length > 1
    ? sparkline.map((v, i) => {
        const x = (i / (sparkline.length - 1)) * sparkW;
        const y = sparkH - ((v / 100) * sparkH);
        return `${x},${y}`;
      }).join(' ')
    : '';
  const sparkPolygon = sparkPoints ? `0,${sparkH} ${sparkPoints} ${sparkW},${sparkH}` : '';

  // Quality distribution
  const qualityCounts = perfData?.sessions?.qualityCounts ?? { CLEAN: 0, MINOR: 0, DEGRADED: 0, COMPROMISED: 0, BREAKDOWN: 0 };
  const totalQualitySessions = Object.values(qualityCounts).reduce((a, b) => a + b, 0);

  // Performance summary line for collapsed state
  const perfSummary = perfData
    ? `${perfData.summary.tradeCount} trades · $${perfData.summary.netPnl.toFixed(0)} net · ${perfData.summary.winRate}% win rate`
    : '';

  function handleCopy() {
    navigator.clipboard.writeText(shareUrl).catch(() => {});
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <div className="overflow-y-auto py-10 px-6">
      <div className="max-w-[960px] mx-auto">

        {/* Page Header */}
        <div className="text-center mb-10">
          <div className="font-mono text-[10px] uppercase tracking-[0.25em] text-[#c8a96e] mb-2">DS Trader ID</div>
          <h1 className="font-display text-[24px] font-light text-[#ede9e1]">Behavioral Profile</h1>
        </div>

        {/* ═══════════════════════════════════════════════════════ */}
        {/* ZONE 1 — BEHAVIORAL IDENTITY                           */}
        {/* ═══════════════════════════════════════════════════════ */}
        <div className="grid grid-cols-1 lg:grid-cols-[1fr_1fr] gap-5 mb-5">
          {/* PROFILE HERO */}
          <GlowPanel className="p-10 text-center relative overflow-hidden" data-onboard="trader-id-hero">
            <div className="absolute inset-0 pointer-events-none" style={{ background: 'radial-gradient(circle at 50% 30%, rgba(200,169,110,0.06) 0%, transparent 60%)' }} />
            <div className="relative z-10">
              {/* Avatar */}
              <div
                className="w-[72px] h-[72px] rounded-full mx-auto mb-4 flex items-center justify-center"
                style={{
                  background: 'linear-gradient(135deg, rgba(200,169,110,0.1), rgba(200,169,110,0.04))',
                  border: '2px solid rgba(200,169,110,0.2)',
                  boxShadow: '0 0 30px rgba(200,169,110,0.08)',
                }}
              >
                <UserCircle size={32} className="text-[rgba(200,169,110,0.5)]" />
              </div>

              {/* Name */}
              <div className="font-display text-[20px] font-light text-[#ede9e1] mb-1">{userName}</div>
              <div className="font-mono text-[11px] text-[#4a473f] mb-6">{profileId}</div>

              {/* BSS Score */}
              <div className="font-display text-[56px] font-light leading-none mb-1 text-[#ede9e1]" style={{ fontVariantNumeric: 'tabular-nums' }}>
                {data.bss_score}
              </div>
              <div className="font-mono text-[9px] uppercase tracking-[0.2em] text-[#7a766d] mb-4">Behavioral Stability Score</div>

              {/* Tier badge */}
              <div
                className="inline-flex items-center gap-2 px-5 py-2 rounded-full font-mono text-[12px] font-semibold tracking-[0.15em] uppercase mb-4"
                style={{
                  color: tierStyle.color,
                  backgroundColor: `${tierStyle.color}15`,
                  border: `1px solid ${tierStyle.color}25`,
                }}
              >
                <div className="w-2 h-2 rounded-full" style={{ backgroundColor: tierStyle.color }} />
                {effectiveTier}
              </div>

              {/* Behavioral Verdict */}
              <p className="font-sans text-[12px] text-[#bdb8ae] italic leading-relaxed max-w-[280px] mx-auto">
                {verdict}
              </p>
            </div>
          </GlowPanel>

          {/* STATS 2×2 */}
          <div className="grid grid-cols-2 gap-3">
            <GlowPanel className="p-5">
              <div className="flex items-center gap-1.5 mb-2">
                {delta >= 0
                  ? <TrendingUp size={11} className="text-[#22D3EE]" />
                  : <TrendingDown size={11} className="text-[#FB923C]" />
                }
                <span className="font-mono text-[9px] uppercase tracking-[0.15em] text-[#7a766d]">Delta</span>
              </div>
              <div className={`font-display text-[28px] font-light ${delta >= 0 ? 'text-[#ede9e1]' : 'text-[#bdb8ae]'}`} style={{ fontVariantNumeric: 'tabular-nums' }}>
                {delta >= 0 ? '+' : ''}{delta}
              </div>
              <div className="font-sans text-[11px] text-[#4a473f] mt-1">from yesterday</div>
            </GlowPanel>

            <GlowPanel className="p-5">
              <div className="flex items-center gap-1.5 mb-2">
                <Flame size={11} className="text-[rgba(200,169,110,0.5)]" />
                <span className="font-mono text-[9px] uppercase tracking-[0.15em] text-[#7a766d]">Streak</span>
              </div>
              <div className="font-display text-[28px] font-light text-[#ede9e1]" style={{ fontVariantNumeric: 'tabular-nums' }}>
                {data.bss_streak} <span className="text-[16px] text-[#7a766d]">{data.bss_streak === 1 ? 'day' : 'days'}</span>
              </div>
              <div className="font-sans text-[11px] text-[#4a473f] mt-1">consecutive sessions</div>
            </GlowPanel>

            <GlowPanel className="p-5">
              <div className="flex items-center gap-1.5 mb-2">
                <Shield size={11} className="text-[rgba(200,169,110,0.5)]" />
                <span className="font-mono text-[9px] uppercase tracking-[0.15em] text-[#7a766d]">Yesterday</span>
              </div>
              <div className="font-display text-[28px] font-light text-[#bdb8ae]" style={{ fontVariantNumeric: 'tabular-nums' }}>
                {data.bss_yesterday}
              </div>
              <div className="font-sans text-[11px] text-[#4a473f] mt-1">BSS close</div>
            </GlowPanel>

            <GlowPanel className="p-5">
              <div className="flex items-center gap-1.5 mb-2">
                <TrendingUp size={11} className="text-[rgba(200,169,110,0.5)]" />
                <span className="font-mono text-[9px] uppercase tracking-[0.15em] text-[#7a766d]">Alpha</span>
              </div>
              <div className={`font-display text-[28px] font-light ${data.bss_alpha >= 0 ? 'text-[#ede9e1]' : 'text-[#bdb8ae]'}`} style={{ fontVariantNumeric: 'tabular-nums' }}>
                {data.bss_alpha >= 0 ? '+' : ''}{data.bss_alpha.toFixed(1)}
              </div>
              <div className="font-sans text-[11px] text-[#4a473f] mt-1">above cohort avg</div>
            </GlowPanel>
          </div>
        </div>

        {/* ═══════════════════════════════════════════════════════ */}
        {/* ZONE 2 — BEHAVIORAL DOSSIER                            */}
        {/* ═══════════════════════════════════════════════════════ */}

        {/* 2a. Session Quality Distribution */}
        {totalQualitySessions > 0 && (
          <GlowPanel className="p-5 mb-5">
            <div className="font-mono text-[10px] uppercase tracking-[0.15em] text-[#7a766d] mb-4">Session Quality Distribution</div>

            {/* Stacked bar */}
            <div className="flex h-3 rounded-full overflow-hidden gap-px mb-3">
              {(['CLEAN', 'MINOR', 'DEGRADED', 'COMPROMISED', 'BREAKDOWN'] as const).map(q => {
                const count = qualityCounts[q] ?? 0;
                if (count === 0) return null;
                const pct = (count / totalQualitySessions) * 100;
                return (
                  <div
                    key={q}
                    className="h-full rounded-sm transition-all"
                    style={{
                      width: `${pct}%`,
                      backgroundColor: QUALITY_COLORS[q],
                      minWidth: count > 0 ? '4px' : '0',
                    }}
                  />
                );
              })}
            </div>

            {/* Legend */}
            <div className="flex flex-wrap gap-x-5 gap-y-1.5">
              {(['CLEAN', 'MINOR', 'DEGRADED', 'COMPROMISED', 'BREAKDOWN'] as const).map(q => {
                const count = qualityCounts[q] ?? 0;
                if (count === 0) return null;
                const pct = Math.round((count / totalQualitySessions) * 100);
                return (
                  <div key={q} className="flex items-center gap-1.5">
                    <div className="h-2 w-2 rounded-full" style={{ backgroundColor: QUALITY_COLORS[q] }} />
                    <span className="font-mono text-[9px] text-[#7a766d]">
                      {q} <span className="text-[#4a473f]">{count} ({pct}%)</span>
                    </span>
                  </div>
                );
              })}
            </div>
          </GlowPanel>
        )}

        {/* 2b. Behavioral Trend */}
        {sparkline.length > 1 && (
          <GlowPanel className="p-5 mb-5">
            <div className="flex items-center justify-between mb-1">
              <div className="font-mono text-[10px] uppercase tracking-[0.15em] text-[#7a766d]">Behavioral Evolution</div>
              <div className="font-mono text-[10px] text-[#4a473f]">{sparkline.length} sessions</div>
            </div>

            {/* Trend verdict */}
            <div className="flex items-center gap-2 mb-4">
              {trend.direction === 'improving' && <TrendingUp size={16} className="text-[#22D3EE]" />}
              {trend.direction === 'declining' && <TrendingDown size={16} className="text-[#FB923C]" />}
              {trend.direction === 'stable' && <Shield size={16} className="text-[rgba(200,169,110,0.5)]" />}
              <span className="font-display text-[18px] font-light text-[#ede9e1]">{trend.label}</span>
            </div>
            <p className="font-sans text-[12px] text-[#7a766d] mb-4">{trend.detail}</p>

            {/* Sparkline with tier threshold lines */}
            <svg width="100%" height="80" viewBox={`0 0 ${sparkW} ${sparkH}`} preserveAspectRatio="none" className="w-full">
              <defs>
                <linearGradient id={`sparkGrad-${sparkGradId}`} x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#c8a96e" stopOpacity="0.15" />
                  <stop offset="100%" stopColor="#c8a96e" stopOpacity="0" />
                </linearGradient>
              </defs>
              {/* Tier threshold reference lines */}
              {TIERS.slice(1).map(tier => {
                const y = sparkH - ((tier.min / 100) * sparkH);
                return (
                  <line key={tier.key} x1={0} y1={y} x2={sparkW} y2={y} stroke="rgba(200,169,110,0.08)" strokeWidth="1" strokeDasharray="4 6" />
                );
              })}
              <polygon points={sparkPolygon} fill={`url(#sparkGrad-${sparkGradId})`} />
              <polyline points={sparkPoints} fill="none" stroke="#c8a96e" strokeWidth="2" strokeLinejoin="round" strokeLinecap="round" />
              {sparkline.length > 0 && (
                <circle cx={sparkW} cy={sparkH - ((sparkline[sparkline.length - 1] / 100) * sparkH)} r="4" fill="#c8a96e" stroke="#080a0e" strokeWidth="2" />
              )}
            </svg>
          </GlowPanel>
        )}

        {/* 2c. Path to Next Tier */}
        <GlowPanel className="p-5 mb-5">
          <div className="flex items-center justify-between mb-4">
            <div className="font-mono text-[10px] uppercase tracking-[0.15em] text-[#7a766d]">Tier Progression</div>
            {nextTierEst && (
              <div className="flex items-center gap-1.5">
                <Target size={10} className="text-[rgba(200,169,110,0.5)]" />
                <span className="font-mono text-[9px] text-[#7a766d]">
                  {nextTierEst.sessionsNeeded} sessions to <span className="text-[#c8a96e]">{nextTierEst.nextTier}</span>
                </span>
              </div>
            )}
          </div>

          {/* Tier bar */}
          <div className="flex gap-1 mb-3">
            {TIERS.map((tier, idx) => (
              <div
                key={tier.key}
                className="flex-1 h-1.5 rounded-full transition-all"
                style={{
                  backgroundColor: idx <= currentTierIndex
                    ? `rgba(200,169,110,${TIER_OPACITIES[idx]})`
                    : 'rgba(200,169,110,0.04)',
                  boxShadow: idx === currentTierIndex
                    ? `0 0 10px rgba(200,169,110,${TIER_OPACITIES[idx] * 0.5})`
                    : 'none',
                }}
              />
            ))}
          </div>

          <div className="flex justify-between mb-4">
            {TIERS.map((tier) => (
              <span
                key={tier.key}
                className={`font-mono text-[8px] uppercase tracking-[0.1em] ${
                  tier.key === effectiveTier
                    ? 'font-semibold text-[#c8a96e]'
                    : 'text-[#4a473f]'
                }`}
              >
                {tier.name}
              </span>
            ))}
          </div>

          {/* Progress within current tier */}
          {currentTierIndex < TIERS.length - 1 && (
            <div className="border-t border-[rgba(200,169,110,0.06)] pt-3">
              <div className="flex items-center justify-between mb-2">
                <span className="font-mono text-[9px] text-[#7a766d]">
                  Progress to {TIERS[currentTierIndex + 1]?.name}
                </span>
                <span className="font-mono text-[9px] text-[#c8a96e]">{tierProgress}%</span>
              </div>
              <div className="h-1 rounded-full bg-[rgba(200,169,110,0.06)] overflow-hidden">
                <div
                  className="h-full rounded-full bg-[#c8a96e] transition-all"
                  style={{ width: `${tierProgress}%` }}
                />
              </div>
              <div className="flex justify-between mt-1.5">
                <span className="font-mono text-[8px] text-[#4a473f]">{currentTierMin}</span>
                <span className="font-mono text-[8px] text-[#4a473f]">{nextTierMin}</span>
              </div>
            </div>
          )}
        </GlowPanel>

        {/* ═══════════════════════════════════════════════════════ */}
        {/* ZONE 3 — PERFORMANCE RECORD (collapsible)              */}
        {/* ═══════════════════════════════════════════════════════ */}
        {perfData && perfData.summary.tradeCount > 0 && (
          <div className="mb-5">
            <button
              onClick={() => setPerfExpanded(!perfExpanded)}
              className="w-full flex items-center justify-between rounded-2xl md:rounded-3xl border border-[rgba(200,169,110,0.06)] bg-[rgba(200,169,110,0.03)] backdrop-blur-xl px-6 py-4 transition-all hover:bg-[rgba(200,169,110,0.04)]"
            >
              <div className="flex items-center gap-3">
                <span className="font-mono text-[10px] uppercase tracking-[0.15em] text-[#7a766d]">Performance Record</span>
                <span className="font-mono text-[10px] text-[#4a473f]">{perfSummary}</span>
              </div>
              {perfExpanded
                ? <ChevronDown size={14} className="text-[#7a766d]" />
                : <ChevronRight size={14} className="text-[#7a766d]" />
              }
            </button>

            {perfExpanded && (
              <div className="mt-3">
                <PerformanceCard
                  summary={perfData.summary}
                  sessions={perfData.sessions}
                  dateRange={perfData.dateRange}
                />
              </div>
            )}
          </div>
        )}

        {/* SHARE LINK */}
        <GlowPanel className="p-4 flex items-center gap-3" data-onboard="trader-id-share">
          <div className="flex-1 bg-[rgba(200,169,110,0.03)] backdrop-blur-xl rounded-lg px-3.5 py-2.5 font-mono text-[12px] text-[#7a766d] truncate border border-[rgba(200,169,110,0.08)]">
            {shareUrl}
          </div>
          <button
            onClick={handleCopy}
            className="bg-[#c8a96e] text-[#080a0e] rounded-lg px-5 py-2.5 font-mono text-[11px] font-bold tracking-[0.1em] uppercase transition-all hover:shadow-[0_0_20px_rgba(200,169,110,0.3)] hover:bg-[#d4ba85] shrink-0 flex items-center gap-2"
          >
            {copied ? <Check size={14} /> : <Copy size={14} />}
            {copied ? 'Copied' : 'Copy Link'}
          </button>
        </GlowPanel>
      </div>
    </div>
  );
}
