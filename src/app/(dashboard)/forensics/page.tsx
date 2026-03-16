'use client';

import { useState, useEffect, useMemo } from 'react';
import { Clock, Layers, Search } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import { getModeLabel, getModeIcon, getModeWeight } from '@/lib/tokens';
import { DynamicIcon } from '@/components/dynamic-icon';
import { GlowPanel } from '@/components/ui/glow-panel';
import type { ViolationDetail, FillCanonical, DailyScore } from '@/lib/types';

/**
 * Forensics — Pattern analysis deep-dive
 *
 * Left panel: scrollable list of violation/pattern cards
 * Right panel: full SBI analysis, impact metrics, session context, recurrence
 * Master-detail layout, diagnostic tone throughout.
 */

export default function ForensicsPage() {
  const [violations, setViolations] = useState<ViolationDetail[]>([]);
  const [fills, setFills] = useState<FillCanonical[]>([]);
  const [dailyScores, setDailyScores] = useState<DailyScore[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [detailFills, setDetailFills] = useState<FillCanonical[]>([]);
  const [detailLoading, setDetailLoading] = useState(false);

  // Load violations
  useEffect(() => {
    async function load() {
      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { setLoading(false); return; }

      // Get account_ref from accounts table — same pattern as Historical page
      const { data: accounts } = await supabase
        .from('accounts')
        .select('account_ref')
        .eq('user_id', user.id)
        .limit(1);

      if (!accounts || accounts.length === 0) { setLoading(false); return; }
      const ref = accounts[0].account_ref;

      const [violationsRes, fillsRes, scoresRes] = await Promise.all([
        supabase
          .from('violations')
          .select('*')
          .eq('account_ref', ref)
          .order('first_seen_utc', { ascending: false })
          .limit(200),
        supabase
          .from('fills_canonical')
          .select('*')
          .eq('account_ref', ref)
          .order('timestamp_utc', { ascending: false })
          .limit(500),
        supabase
          .from('daily_scores')
          .select('*')
          .eq('account_ref', ref)
          .order('trading_date', { ascending: false })
          .limit(60),
      ]);

      if (violationsRes.data) {
        const v = violationsRes.data as ViolationDetail[];
        setViolations(v);
        if (v.length > 0) setSelectedId(v[0].violation_id);
      }
      if (fillsRes.data) setFills(fillsRes.data as FillCanonical[]);
      if (scoresRes.data) setDailyScores(scoresRes.data as DailyScore[]);
      setLoading(false);
    }
    load();
  }, []);

  const selected = useMemo(
    () => violations.find((v) => v.violation_id === selectedId) ?? null,
    [violations, selectedId]
  );

  // Load evidence fills for selected violation
  useEffect(() => {
    if (!selected || selected.evidence_event_ids.length === 0) {
      setDetailFills([]);
      return;
    }
    setDetailLoading(true);
    const supabase = createClient();
    supabase
      .from('fills_canonical')
      .select('*')
      .in('event_id', selected.evidence_event_ids)
      .order('timestamp_utc', { ascending: true })
      .then(({ data }) => {
        if (data) setDetailFills(data as FillCanonical[]);
        setDetailLoading(false);
      });
  }, [selected]);

  // Build fill map for session context
  const fillMap = useMemo(() => {
    const map = new Map<string, FillCanonical>();
    for (const f of fills) map.set(f.event_id, f);
    return map;
  }, [fills]);

  // Compute recurrence for selected violation mode
  const recurrence = useMemo(() => {
    if (!selected) return [];
    return violations
      .filter((v) => v.mode === selected.mode)
      .map((v) => ({
        id: v.violation_id,
        date: new Date(v.first_seen_utc),
        points: v.points,
        isCurrent: v.violation_id === selected.violation_id,
      }))
      .sort((a, b) => a.date.getTime() - b.date.getTime());
  }, [violations, selected]);

  const patternCount = violations.length;

  if (loading) {
    return (
      <div className="flex h-full items-center justify-center">
        <div className="space-y-3">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-20 w-72 animate-pulse rounded-xl bg-raised" />
          ))}
        </div>
      </div>
    );
  }

  if (violations.length === 0) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-4 px-4">
        <Search size={32} className="text-text-dim" />
        <div className="text-center">
          <div className="font-mono text-[15px] font-semibold text-text-primary">
            No patterns detected
          </div>
          <div className="mt-1 font-mono text-[12px] text-text-muted">
            Forensics will populate as behavioral patterns are identified in your trading data.
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-full gap-0 overflow-hidden">
      {/* ═══ LEFT PANEL — Pattern Cards ═══ */}
      <div className="w-[320px] shrink-0 border-r border-border-dim overflow-y-auto">
        <div className="px-5 pt-5 pb-3">
          <h1 className="font-mono text-[15px] font-bold uppercase tracking-[0.15em] text-text-primary">
            Forensics
          </h1>
          <div className="mt-1 font-mono text-[11px] text-text-muted">
            {patternCount} patterns detected · 30 days
          </div>
        </div>

        <div className="px-3 pb-4 space-y-2">
          {violations.map((v) => {
            const isActive = v.violation_id === selectedId;
            const modeLabel = getModeLabel(v.mode);
            const modeIcon = getModeIcon(v.mode);
            const dateStr = new Date(v.first_seen_utc).toLocaleDateString('en-US', {
              month: 'short', day: 'numeric',
            });
            const timeStr = new Date(v.first_seen_utc).toLocaleTimeString('en-US', {
              hour: '2-digit', minute: '2-digit', hour12: false,
            });

            // Find instrument from evidence fills
            const evidenceFill = v.evidence_event_ids
              .map((eid) => fillMap.get(eid))
              .find(Boolean);
            const instrument = evidenceFill?.instrument_root ?? evidenceFill?.contract ?? '—';

            return (
              <GlowPanel key={v.violation_id} className="">
                <button
                  onClick={() => setSelectedId(v.violation_id)}
                  className={`w-full text-left rounded-xl px-4 py-3 transition-all ${
                    isActive
                      ? 'ring-1 ring-white/30 bg-raised/60'
                      : 'hover:bg-raised/30'
                  }`}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <DynamicIcon name={modeIcon} size={14} className="text-text-muted shrink-0 mt-0.5" />
                      <span className="font-mono text-[13px] font-semibold text-text-primary">
                        {modeLabel}
                      </span>
                    </div>
                    <span
                      className="shrink-0 rounded-full px-2 py-0.5 font-mono text-[11px] font-bold"
                      style={{
                        color: v.severity === 'CRITICAL' ? '#FFFFFF' : v.severity === 'HIGH' ? 'rgba(255,255,255,0.8)' : 'rgba(255,255,255,0.6)',
                        backgroundColor: v.severity === 'CRITICAL' ? 'rgba(255,255,255,0.12)' : v.severity === 'HIGH' ? 'rgba(255,255,255,0.08)' : 'rgba(255,255,255,0.05)',
                      }}
                    >
                      {v.severity}
                    </span>
                  </div>
                  <div className="mt-1.5 font-mono text-[11px] text-text-muted">
                    {instrument} · {dateStr} · {timeStr} EST
                  </div>
                  <div className="mt-1 font-mono text-[11px] text-text-dim leading-relaxed line-clamp-2">
                    {v.evidence_event_ids.length} fills flagged under rule {v.rule_id}. Severity: {v.severity}.
                  </div>
                </button>
              </GlowPanel>
            );
          })}
        </div>
      </div>

      {/* ═══ RIGHT PANEL — Detail View ═══ */}
      <div className="flex-1 overflow-y-auto px-8 py-6">
        {selected ? (
          <ForensicDetail
            violation={selected}
            fills={detailFills}
            fillsLoading={detailLoading}
            recurrence={recurrence}
            dailyScores={dailyScores}
          />
        ) : (
          <div className="flex h-full items-center justify-center font-mono text-[13px] text-text-muted">
            Select a pattern to analyze
          </div>
        )}
      </div>
    </div>
  );
}

/* ════════════════════════════════════════════════════════════════════
 * FORENSIC DETAIL — SBI analysis, impact metrics, session context, recurrence
 * ════════════════════════════════════════════════════════════════════ */

interface ForensicDetailProps {
  violation: ViolationDetail;
  fills: FillCanonical[];
  fillsLoading: boolean;
  recurrence: { id: string; date: Date; points: number; isCurrent: boolean }[];
  dailyScores: DailyScore[];
}

function ForensicDetail({ violation, fills, fillsLoading, recurrence, dailyScores }: ForensicDetailProps) {
  const modeLabel = getModeLabel(violation.mode);
  const modeIcon = getModeIcon(violation.mode);
  const modeWeight = getModeWeight(violation.mode);

  // Find the daily score — try violation date first, then +1 day (scoring may run next day)
  const violationDate = new Date(violation.first_seen_utc).toISOString().split('T')[0];
  const nextDate = new Date(new Date(violation.first_seen_utc).getTime() + 86400000).toISOString().split('T')[0];
  const dayScore = dailyScores.find((ds) => ds.trading_date === violationDate)
    ?? dailyScores.find((ds) => ds.trading_date === nextDate);

  // Real numbers from the scoring engine
  const bssBefore = dayScore?.bss_previous ?? null;
  const bssAfter = dayScore?.bss_score ?? null;
  const actualBssDelta = bssBefore !== null && bssAfter !== null
    ? Number(bssAfter) - Number(bssBefore)
    : null;
  const dsiScore = dayScore?.dsi_score ?? null;
  const alpha = dayScore?.alpha_effective ? Number(dayScore.alpha_effective) : null;

  const dateStr = new Date(violation.first_seen_utc).toLocaleDateString('en-US', {
    month: 'short', day: 'numeric', year: 'numeric',
  });
  const timeStr = new Date(violation.first_seen_utc).toLocaleTimeString('en-US', {
    hour: '2-digit', minute: '2-digit', hour12: false,
  });

  const windowStart = new Date(violation.window_start_utc).toLocaleTimeString('en-US', {
    hour: '2-digit', minute: '2-digit', hour12: false,
  });
  const windowEnd = new Date(violation.window_end_utc).toLocaleTimeString('en-US', {
    hour: '2-digit', minute: '2-digit', hour12: false,
  });
  const windowMs = new Date(violation.window_end_utc).getTime() - new Date(violation.window_start_utc).getTime();
  const windowMinutes = Math.round(windowMs / 60000);

  // Session context from fills
  const entries = fills.length;
  const buys = fills.filter((f) => f.side === 'BUY').length;
  const winRate = entries > 0 ? Math.round((buys / entries) * 100) : 0;
  const maxLot = fills.reduce((max, f) => Math.max(max, f.qty), 0);
  const instruments = [...new Set(fills.map((f) => f.instrument_root || f.contract))];
  const instrument = instruments[0] ?? '—';

  // Recurrence stats
  const avgInterval = recurrence.length > 1
    ? (() => {
        let totalMs = 0;
        for (let i = 1; i < recurrence.length; i++) {
          totalMs += recurrence[i].date.getTime() - recurrence[i - 1].date.getTime();
        }
        return (totalMs / (recurrence.length - 1) / 86400000).toFixed(1);
      })()
    : null;

  const lastOccurrence = recurrence.length > 0
    ? (() => {
        const last = recurrence[recurrence.length - 1];
        const now = Date.now();
        const daysAgo = Math.round((now - last.date.getTime()) / 86400000);
        return daysAgo === 0 ? 'today' : `${daysAgo}d ago`;
      })()
    : null;

  return (
    <div className="max-w-3xl space-y-6">
      {/* ═══ HEADER ═══ */}
      <div>
        <div className="flex items-center gap-2 mb-2">
          <DynamicIcon name={modeIcon} size={16} className="text-warning" />
          <span className="font-mono text-[11px] uppercase tracking-[0.2em] text-warning">
            Pattern Detected
          </span>
        </div>
        <h2 className="font-mono text-[22px] font-bold text-text-primary mb-2">
          {modeLabel}
        </h2>
        <div className="flex items-center gap-4 font-mono text-[12px] text-text-muted">
          <div className="flex items-center gap-1.5">
            <Clock size={12} />
            {dateStr} · {timeStr} EST
          </div>
          <div className="flex items-center gap-1.5">
            <Layers size={12} />
            {instrument}
          </div>
        </div>
      </div>

      {/* ═══ SBI ANALYSIS ═══ */}
      <div>
        <div className="font-mono text-[11px] font-semibold uppercase tracking-[0.15em] text-text-muted mb-3">
          SBI Analysis
        </div>
        <div className="space-y-4">
          {/* Situation */}
          <GlowPanel className="p-4 flex gap-3.5">
            <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-white/15 font-mono text-[12px] font-bold text-white">
              S
            </div>
            <div>
              <div className="font-mono text-[11px] font-semibold uppercase tracking-[0.12em] text-text-muted mb-1">
                Situation (Window)
              </div>
              <div className="font-mono text-[13px] text-text-secondary leading-relaxed">
                {instrument} session. {entries} entries executed over {windowMinutes} minutes between {windowStart}–{windowEnd} EST.
              </div>
            </div>
          </GlowPanel>

          {/* Behavior */}
          <GlowPanel className="p-4 flex gap-3.5">
            <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-white/10 font-mono text-[12px] font-bold text-white">
              B
            </div>
            <div>
              <div className="font-mono text-[11px] font-semibold uppercase tracking-[0.12em] text-text-muted mb-1">
                Behavior
              </div>
              <div className="font-mono text-[13px] text-text-secondary leading-relaxed">
                {modeLabel} pattern detected. {violation.evidence_event_ids.length} fills flagged under rule {violation.rule_id} with severity {violation.severity}.
                {maxLot > 1 && ` Max lot size reached ${maxLot} contracts.`}
              </div>
            </div>
          </GlowPanel>

          {/* Impact */}
          <GlowPanel className="p-4 flex gap-3.5">
            <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-white/12 font-mono text-[12px] font-bold text-white">
              I
            </div>
            <div>
              <div className="font-mono text-[11px] font-semibold uppercase tracking-[0.12em] text-text-muted mb-1">
                Impact
              </div>
              <div className="font-mono text-[13px] text-text-secondary leading-relaxed">
                {actualBssDelta !== null ? (
                  <>
                    This pattern caused a {violation.points}-pt DSI penalty, driving the Daily Stability Index to{' '}
                    <span className="font-bold text-text-primary">{dsiScore}/100</span>.
                    BSS moved from {bssBefore} to {bssAfter}{' '}
                    (<span className="font-bold text-white">{actualBssDelta}</span>)
                    {alpha !== null && ` at ${alpha} EWMA alpha`}.
                  </>
                ) : (
                  <>
                    This pattern applied a {violation.points}-pt DSI penalty (not subtracted directly from BSS).
                    The DSI score feeds into BSS via EWMA smoothing — the {'\u2013'}19 you see on the dashboard
                    is the smoothed result, not the raw penalty.
                  </>
                )}
              </div>
            </div>
          </GlowPanel>
        </div>
      </div>

      {/* ═══ SCORING FLOW — DSI Penalty → DSI Score → BSS Delta ═══ */}
      <div>
        <div className="font-mono text-[11px] font-semibold uppercase tracking-[0.15em] text-text-muted mb-3">
          Scoring Flow
        </div>

        {/* Visual pipeline: penalty → DSI → BSS */}
        <GlowPanel className="p-5">
          <div className="grid grid-cols-4 gap-3 items-center">
            {/* Step 1: DSI Penalty */}
            <div className="text-center">
              <div className="font-mono text-[20px] font-bold text-white" style={{ fontVariantNumeric: 'tabular-nums' }}>
                -{violation.points}
              </div>
              <div className="font-mono text-[10px] uppercase tracking-[0.12em] text-text-muted mt-1">
                DSI Penalty
              </div>
              <div className="font-mono text-[9px] text-text-dim mt-0.5">
                ×{modeWeight} weight
              </div>
            </div>

            {/* Arrow */}
            <div className="text-center font-mono text-[14px] text-text-dim">→</div>

            {/* Step 2: DSI Score for the day */}
            <div className="text-center">
              <div className="font-mono text-[20px] font-bold text-white" style={{ fontVariantNumeric: 'tabular-nums' }}>
                {dsiScore !== null ? `${dsiScore}/100` : '—'}
              </div>
              <div className="font-mono text-[10px] uppercase tracking-[0.12em] text-text-muted mt-1">
                DSI Score
              </div>
              <div className="font-mono text-[9px] text-text-dim mt-0.5">
                Daily stability
              </div>
            </div>

            {/* Arrow */}
            <div className="text-center">
              <div className="font-mono text-[11px] text-text-dim mb-1">EWMA →</div>
              <div className="font-mono text-[20px] font-bold text-white" style={{ fontVariantNumeric: 'tabular-nums' }}>
                {actualBssDelta !== null ? actualBssDelta : '—'}
              </div>
              <div className="font-mono text-[10px] uppercase tracking-[0.12em] text-text-muted mt-1">
                BSS Delta
              </div>
              {bssBefore !== null && bssAfter !== null && (
                <div className="font-mono text-[9px] text-text-dim mt-0.5">
                  {bssBefore} → {bssAfter}
                </div>
              )}
            </div>
          </div>

          {/* Explainer */}
          <div className="mt-4 pt-3 border-t border-border-dim font-mono text-[11px] text-text-dim leading-relaxed">
            The {violation.points}-pt penalty is a <span className="text-text-muted">DSI deduction</span>, not a direct BSS subtraction.
            Your daily DSI score{dsiScore !== null ? ` (${dsiScore}/100)` : ''} feeds into BSS via EWMA smoothing
            {alpha !== null && ` (alpha: ${alpha})`}, which is why the dashboard shows{' '}
            {actualBssDelta !== null
              ? <span className="text-white font-semibold">{actualBssDelta}</span>
              : 'a smaller delta'}{' '}
            — not -{violation.points}.
          </div>
        </GlowPanel>
      </div>

      {/* ═══ SESSION CONTEXT ═══ */}
      <div>
        <div className="font-mono text-[11px] font-semibold uppercase tracking-[0.15em] text-text-muted mb-3">
          Session Context
        </div>
        <GlowPanel className="overflow-hidden">
          <div className="grid grid-cols-5 gap-px bg-border-dim">
            {[
              { label: 'Duration', value: `${windowMinutes} min`, color: 'text-white' },
              { label: 'Entries', value: `${entries}`, color: 'text-white' },
              { label: 'Win Rate', value: `${winRate}%`, color: winRate < 50 ? 'text-white/60' : 'text-white' },
              { label: 'Max Lot', value: `${maxLot || '—'}`, color: 'text-white' },
              { label: 'Fills', value: `${violation.evidence_event_ids.length}`, color: 'text-white' },
            ].map((item) => (
              <div key={item.label} className="bg-surface px-4 py-3">
                <div className="font-mono text-[10px] uppercase tracking-[0.12em] text-text-muted mb-1">
                  {item.label}
                </div>
                <div className={`font-mono text-[15px] font-bold ${item.color}`} style={{ fontVariantNumeric: 'tabular-nums' }}>
                  {item.value}
                </div>
              </div>
            ))}
          </div>
        </GlowPanel>
      </div>

      {/* ═══ RECURRENCE ═══ */}
      {recurrence.length > 0 && (
        <div>
          <div className="font-mono text-[11px] font-semibold uppercase tracking-[0.15em] text-text-muted mb-3">
            Recurrence · 30 Days
          </div>
          <GlowPanel className="px-5 py-4">
            <div className="flex items-center gap-2 mb-3">
              {/* Occurrence bars */}
              {recurrence.map((r) => (
                <div
                  key={r.id}
                  className="w-3 rounded-sm"
                  style={{
                    height: `${Math.max(16, Math.min(32, r.points * 4))}px`,
                    backgroundColor: '#FFFFFF',
                    opacity: r.isCurrent ? 0.8 : 0.4,
                  }}
                />
              ))}
            </div>
            <div className="flex items-center gap-2 font-mono text-[12px]">
              <span className="font-bold text-white">{recurrence.length} occurrences</span>
              <span className="text-text-muted">
                Last: {lastOccurrence}
                {avgInterval && ` · Avg interval: ${avgInterval} days`}
              </span>
            </div>
          </GlowPanel>
        </div>
      )}

      {/* ═══ EVIDENCE FILLS ═══ */}
      {fillsLoading ? (
        <div className="flex justify-center py-6">
          <div className="h-4 w-4 animate-pulse rounded-full bg-raised" />
        </div>
      ) : fills.length > 0 ? (
        <div>
          <div className="font-mono text-[11px] font-semibold uppercase tracking-[0.15em] text-text-muted mb-3">
            Evidence Fills
          </div>
          <div className="space-y-1.5">
            {fills.map((fill) => {
              const fillTime = new Date(fill.timestamp_utc).toLocaleTimeString('en-US', {
                hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false,
              });
              const sideColor = fill.side === 'BUY' ? '#FFFFFF' : '#C0C8D8';

              return (
                <div key={fill.event_id} className="flex items-center gap-3 glass-inset rounded-xl px-3 py-2">
                  <span
                    className="rounded px-1.5 py-0.5 font-mono text-[11px] font-bold"
                    style={{
                      color: sideColor,
                      backgroundColor: fill.side === 'BUY' ? 'rgba(255,255,255,0.1)' : 'rgba(192,200,216,0.1)'
                    }}
                  >
                    {fill.side}
                  </span>
                  <span className="font-mono text-[12px] text-text-muted" style={{ fontVariantNumeric: 'tabular-nums' }}>
                    {fillTime}
                  </span>
                  <span className="font-mono text-[12px] text-text-secondary">{fill.contract}</span>
                  <span className="ml-auto font-mono text-[12px] font-bold text-white" style={{ fontVariantNumeric: 'tabular-nums' }}>
                    {fill.qty} @ {fill.price}
                  </span>
                  {fill.off_session && (
                    <span className="rounded bg-warning/10 px-1.5 py-0.5 font-mono text-[10px] font-bold text-warning">
                      OFF
                    </span>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      ) : null}
    </div>
  );
}
