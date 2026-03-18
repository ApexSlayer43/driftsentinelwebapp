'use client';

import { useState, useEffect, useMemo } from 'react';
import { Clock, Layers, Search } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import { getModeLabel, getModeIcon, getModeWeight, getModeDescription } from '@/lib/tokens';
import { DynamicIcon } from '@/components/dynamic-icon';
import { GlowPanel } from '@/components/ui/glow-panel';
import type { ViolationDetail, FillCanonical, DailyScore } from '@/lib/types';
import { ChevronDown, ChevronRight } from 'lucide-react';

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
            <div key={i} className="h-20 w-72 animate-pulse rounded-xl bg-white/[0.06]" />
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
      <div className="w-[320px] shrink-0 border-r border-white/[0.08] overflow-y-auto">
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
                      ? 'ring-1 ring-white/30 bg-white/[0.08]'
                      : 'hover:bg-white/[0.06]'
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
                    {v.evidence_event_ids.length} trades flagged · {getModeDescription(v.mode).split('—')[0].trim()}
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
  const [mathExpanded, setMathExpanded] = useState(false);
  const modeLabel = getModeLabel(violation.mode);
  const modeIcon = getModeIcon(violation.mode);
  const modeWeight = getModeWeight(violation.mode);
  const modeDescription = getModeDescription(violation.mode);

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
  const tradeCount = fills.length;
  const buys = fills.filter((f) => f.side === 'BUY').length;
  const winRate = tradeCount > 0 ? Math.round((buys / tradeCount) * 100) : 0;
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

  // Plain-language impact severity
  const impactLabel = actualBssDelta !== null
    ? Math.abs(actualBssDelta) >= 10 ? 'Significant impact'
      : Math.abs(actualBssDelta) >= 5 ? 'Moderate impact'
      : 'Minor impact'
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

      {/* ═══ WHAT HAPPENED — plain narrative, no S/B/I badges ═══ */}
      <GlowPanel className="p-5">
        <div className="font-mono text-[11px] font-semibold uppercase tracking-[0.15em] text-text-muted mb-3">
          What Happened
        </div>
        <div className="font-mono text-[13px] text-text-secondary leading-relaxed space-y-3">
          <p>
            On {dateStr}, you executed {violation.evidence_event_ids.length} trades on {instrument} in {windowMinutes} minutes
            ({windowStart}–{windowEnd} EST).
          </p>
          <p>
            {modeDescription}
            {maxLot > 1 && ` Your largest position was ${maxLot} contracts.`}
          </p>
        </div>
      </GlowPanel>

      {/* ═══ SCORE IMPACT — simple before/after, no math ═══ */}
      <GlowPanel className="p-5">
        <div className="font-mono text-[11px] font-semibold uppercase tracking-[0.15em] text-text-muted mb-4">
          Score Impact
        </div>

        {actualBssDelta !== null && bssBefore !== null && bssAfter !== null ? (
          <>
            {/* Before → After card */}
            <div className="flex items-center justify-center gap-6 mb-4">
              <div className="text-center">
                <div className="font-mono text-[10px] uppercase tracking-[0.12em] text-text-dim mb-1">Before</div>
                <div className="font-mono text-[28px] font-bold text-text-muted" style={{ fontVariantNumeric: 'tabular-nums' }}>
                  {bssBefore}
                </div>
              </div>
              <div className="font-mono text-[18px] text-text-dim">→</div>
              <div className="text-center">
                <div className="font-mono text-[10px] uppercase tracking-[0.12em] text-text-dim mb-1">After</div>
                <div className="font-mono text-[28px] font-bold text-white" style={{ fontVariantNumeric: 'tabular-nums' }}>
                  {bssAfter}
                </div>
              </div>
              <div className="text-center">
                <div className="font-mono text-[10px] uppercase tracking-[0.12em] text-text-dim mb-1">Change</div>
                <div className={`font-mono text-[28px] font-bold ${actualBssDelta < 0 ? 'text-[#FB923C]' : actualBssDelta > 0 ? 'text-[#22D3EE]' : 'text-text-muted'}`} style={{ fontVariantNumeric: 'tabular-nums' }}>
                  {actualBssDelta > 0 ? '+' : ''}{actualBssDelta}
                </div>
              </div>
            </div>

            <p className="font-mono text-[12px] text-text-muted leading-relaxed text-center">
              {impactLabel} on your Behavioral Stability Score. Session score for this day was {dsiScore}/100.
            </p>
          </>
        ) : (
          <p className="font-mono text-[13px] text-text-muted leading-relaxed">
            This pattern reduced your session score for the day. The exact impact on your overall score depends on how many sessions you&apos;ve completed — newer accounts see larger swings.
          </p>
        )}
      </GlowPanel>

      {/* ═══ WHAT TO DO — actionable suggestion ═══ */}
      <GlowPanel className="p-5 border-l-4 border-[rgba(200,169,110,0.3)]">
        <div className="font-mono text-[11px] font-semibold uppercase tracking-[0.15em] text-text-muted mb-2">
          What To Do
        </div>
        <div className="font-mono text-[13px] text-text-secondary leading-relaxed">
          {violation.mode === 'FREQUENCY' && 'Consider setting a maximum number of trades per session in your protocol rules. Fewer, higher-quality entries improve your score over time.'}
          {violation.mode === 'OVERSIZE' && 'Review your max contract limit in Settings → Trading Rules. Keeping position sizes within your protocol prevents this pattern.'}
          {violation.mode === 'OFF_SESSION' && 'Trades outside your session window always flag. If your trading hours have changed, update your session windows in Settings.'}
          {violation.mode === 'REVENGE_ENTRY' && 'After a loss, pause before re-entering. The cooldown feature can help enforce a waiting period between trades.'}
          {violation.mode === 'SIZE_ESCALATION' && 'Keep position sizes consistent throughout your session. Increasing size after losses is a common discipline leak.'}
          {violation.mode === 'HESITATION' && 'Delayed entries or exits can indicate uncertainty. Review your pre-session intention to stay aligned with your plan.'}
          {violation.mode === 'BASELINE_SHIFT' && 'Your behavior changed significantly from your baseline. This may be fine if intentional — review whether your protocol needs updating.'}
          {!['FREQUENCY', 'OVERSIZE', 'OFF_SESSION', 'REVENGE_ENTRY', 'SIZE_ESCALATION', 'HESITATION', 'BASELINE_SHIFT'].includes(violation.mode) && 'Review your protocol settings and consider adjusting detection thresholds for this pattern type.'}
        </div>
      </GlowPanel>

      {/* ═══ SESSION CONTEXT ═══ */}
      <div>
        <div className="font-mono text-[11px] font-semibold uppercase tracking-[0.15em] text-text-muted mb-3">
          Session Context
        </div>
        <GlowPanel className="overflow-hidden">
          <div className="grid grid-cols-4 gap-px bg-white/[0.06]">
            {[
              { label: 'Duration', value: `${windowMinutes} min`, color: 'text-white' },
              { label: 'Trades', value: `${tradeCount}`, color: 'text-white' },
              { label: 'Win Rate', value: `${winRate}%`, color: winRate < 50 ? 'text-white/60' : 'text-white' },
              { label: 'Max Position', value: `${maxLot || '—'}`, color: 'text-white' },
            ].map((item) => (
              <div key={item.label} className="bg-white/[0.04] px-4 py-3">
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

      {/* ═══ HOW IT'S CALCULATED — expandable, for power users ═══ */}
      <div>
        <button
          onClick={() => setMathExpanded(!mathExpanded)}
          className="flex items-center gap-2 font-mono text-[11px] uppercase tracking-[0.15em] text-text-dim hover:text-text-muted transition-colors"
        >
          {mathExpanded ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
          How It&apos;s Calculated
        </button>

        {mathExpanded && (
          <GlowPanel className="p-5 mt-3">
            <div className="grid grid-cols-4 gap-3 items-center mb-4">
              <div className="text-center">
                <div className="font-mono text-[20px] font-bold text-white" style={{ fontVariantNumeric: 'tabular-nums' }}>
                  -{violation.points}
                </div>
                <div className="font-mono text-[10px] uppercase tracking-[0.12em] text-text-muted mt-1">
                  Session Penalty
                </div>
                <div className="font-mono text-[9px] text-text-dim mt-0.5">
                  ×{modeWeight} weight
                </div>
              </div>
              <div className="text-center font-mono text-[14px] text-text-dim">→</div>
              <div className="text-center">
                <div className="font-mono text-[20px] font-bold text-white" style={{ fontVariantNumeric: 'tabular-nums' }}>
                  {dsiScore !== null ? `${dsiScore}/100` : '—'}
                </div>
                <div className="font-mono text-[10px] uppercase tracking-[0.12em] text-text-muted mt-1">
                  Session Score
                </div>
              </div>
              <div className="text-center">
                <div className="font-mono text-[11px] text-text-dim mb-1">Smoothed →</div>
                <div className="font-mono text-[20px] font-bold text-white" style={{ fontVariantNumeric: 'tabular-nums' }}>
                  {actualBssDelta !== null ? (actualBssDelta > 0 ? `+${actualBssDelta}` : actualBssDelta) : '—'}
                </div>
                <div className="font-mono text-[10px] uppercase tracking-[0.12em] text-text-muted mt-1">
                  Score Change
                </div>
                {bssBefore !== null && bssAfter !== null && (
                  <div className="font-mono text-[9px] text-text-dim mt-0.5">
                    {bssBefore} → {bssAfter}
                  </div>
                )}
              </div>
            </div>

            <div className="pt-3 border-t border-white/[0.08] font-mono text-[11px] text-text-dim leading-relaxed">
              The {violation.points}-pt penalty is deducted from your session score (not directly from BSS).
              Your session score{dsiScore !== null ? ` (${dsiScore}/100)` : ''} is then smoothed into your overall BSS
              {alpha !== null && ` using exponential smoothing (alpha: ${alpha})`}. This is why the score change
              ({actualBssDelta !== null ? actualBssDelta : '—'}) differs from the raw penalty (-{violation.points}).
            </div>
          </GlowPanel>
        )}
      </div>

      {/* ═══ FLAGGED TRADES ═══ */}
      {fillsLoading ? (
        <div className="flex justify-center py-6">
          <div className="h-4 w-4 animate-pulse rounded-full bg-white/[0.06]" />
        </div>
      ) : fills.length > 0 ? (
        <div>
          <div className="font-mono text-[11px] font-semibold uppercase tracking-[0.15em] text-text-muted mb-3">
            Flagged Trades
          </div>
          <div className="space-y-1.5">
            {fills.map((fill) => {
              const fillTime = new Date(fill.timestamp_utc).toLocaleTimeString('en-US', {
                hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false,
              });
              const sideColor = fill.side === 'BUY' ? '#FFFFFF' : '#C0C8D8';

              return (
                <div key={fill.event_id} className="flex items-center gap-3 bg-white/[0.04] backdrop-blur-xl border border-white/[0.08] rounded-xl px-3 py-2">
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
