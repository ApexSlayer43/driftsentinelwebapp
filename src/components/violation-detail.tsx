'use client';

import { useState, useEffect } from 'react';
import { Clock, Layers, ArrowLeft } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import { getModeLabel, getModeIcon, getModeWeight } from '@/lib/tokens';
import { DynamicIcon } from '@/components/dynamic-icon';
import { GlowPanel } from '@/components/ui/glow-panel';
import type { ViolationDetail as ViolationDetailType, FillCanonical } from '@/lib/types';

interface ViolationDetailProps {
  violation: ViolationDetailType;
  onBack: () => void;
}

/**
 * Forensic detail panel — SBI analysis, impact metrics, session context,
 * and fill timeline. No orbital. No decorative elements.
 * Diagnostic, not judgmental. "Pattern Detected", never "Violation".
 *
 * SBI framework (spec Section 7):
 * - Header: Neutral icon + "Pattern Detected" label
 * - Behavior description: Observable, specific
 * - Impact data box: Historical context
 * - Forward suggestion: Protocol-based
 * - Actions: [Review Protocol] (primary), [Dismiss] (ghost)
 */
export function ViolationDetailPanel({ violation, onBack }: ViolationDetailProps) {
  const [fills, setFills] = useState<FillCanonical[]>([]);
  const [loading, setLoading] = useState(true);

  const modeLabel = getModeLabel(violation.mode);
  const modeIcon = getModeIcon(violation.mode);
  const modeWeight = getModeWeight(violation.mode);
  const weightedPoints = Math.round(violation.points * modeWeight);

  useEffect(() => {
    async function loadFills() {
      if (violation.evidence_event_ids.length === 0) {
        setLoading(false);
        return;
      }

      const supabase = createClient();
      const { data, error } = await supabase
        .from('fills_canonical')
        .select('*')
        .in('event_id', violation.evidence_event_ids)
        .order('timestamp_utc', { ascending: true });

      if (!error && data) {
        setFills(data as FillCanonical[]);
      }
      setLoading(false);
    }

    loadFills();
  }, [violation.evidence_event_ids]);

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

  return (
    <div className="flex flex-col gap-5 max-w-3xl">
      {/* Back button */}
      <button
        onClick={onBack}
        className="flex items-center gap-1.5 font-mono text-[11px] text-text-muted hover:text-text-secondary transition-colors w-fit"
      >
        <ArrowLeft size={12} />
        Back to table
      </button>

      {/* ═══ HEADER — "Pattern Detected", not "Violation" ═══ */}
      <div>
        <div className="flex items-center gap-2 mb-2">
          <DynamicIcon name={modeIcon} size={16} className="text-warning" />
          <span className="font-mono text-[11px] uppercase tracking-[0.2em] text-warning">
            Pattern Detected
          </span>
        </div>
        <h2 className="font-mono text-[20px] font-bold text-text-primary mb-2">
          {modeLabel}
        </h2>
        <div className="flex items-center gap-4 font-mono text-[12px] text-text-muted">
          <div className="flex items-center gap-1.5">
            <Clock size={12} />
            {dateStr} · {timeStr} EST
          </div>
          <div className="flex items-center gap-1.5">
            <Layers size={12} />
            Rule {violation.rule_id}
          </div>
        </div>
      </div>

      {/* ═══ SBI ANALYSIS ═══ */}
      <GlowPanel className="p-5 space-y-4 border-l-4 border-warning">
        {/* Situation */}
        <div>
          <div className="font-mono text-[11px] font-semibold uppercase tracking-[0.15em] text-text-muted mb-1">
            Situation
          </div>
          <div className="font-mono text-[13px] text-text-secondary leading-relaxed">
            {violation.evidence_event_ids.length} fills executed over {windowMinutes} minutes between {windowStart}–{windowEnd} EST.
          </div>
        </div>

        {/* Behavior — observable, specific */}
        <div>
          <div className="font-mono text-[11px] font-semibold uppercase tracking-[0.15em] text-text-muted mb-1">
            Behavior
          </div>
          <div className="font-mono text-[13px] text-text-secondary leading-relaxed">
            {modeLabel} pattern detected. {violation.evidence_event_ids.length} evidence fills flagged under rule {violation.rule_id} with severity {violation.severity}.
          </div>
        </div>

        {/* Impact — historical context in subtle inset container */}
        <div>
          <div className="font-mono text-[11px] font-semibold uppercase tracking-[0.15em] text-text-muted mb-1">
            Impact
          </div>
          <div className="bg-white/[0.04] backdrop-blur-xl border border-white/[0.08] rounded-xl px-3.5 py-2.5 font-mono text-[13px] text-text-secondary leading-relaxed">
            {violation.points} raw pts × {modeWeight}x mode weight = <span className="font-bold text-warning">{weightedPoints} weighted points</span> deducted from DSI.
          </div>
        </div>

        {/* Forward suggestion */}
        <div>
          <div className="font-mono text-[11px] font-semibold uppercase tracking-[0.15em] text-text-muted mb-1">
            Suggestion
          </div>
          <div className="font-mono text-[13px] text-text-secondary leading-relaxed">
            Review your protocol settings for {modeLabel.toLowerCase()} detection thresholds. Consider adding a cooldown rule.
          </div>
        </div>
      </GlowPanel>

      {/* ═══ IMPACT METRICS — 4-column grid ═══ */}
      <div className="grid grid-cols-4 gap-2.5">
        <GlowPanel className="p-3 text-center">
          <div className="font-mono text-[17px] font-bold text-[#FB923C]" style={{ fontVariantNumeric: 'tabular-nums' }}>
            -{violation.points}
          </div>
          <div className="font-mono text-[10px] uppercase tracking-[0.15em] text-text-muted mt-0.5">
            DSI Penalty
          </div>
        </GlowPanel>
        <GlowPanel className="p-3 text-center">
          <div className="font-mono text-[17px] font-bold text-text-secondary" style={{ fontVariantNumeric: 'tabular-nums' }}>
            ×{modeWeight}
          </div>
          <div className="font-mono text-[10px] uppercase tracking-[0.15em] text-text-muted mt-0.5">
            Mode Weight
          </div>
        </GlowPanel>
        <GlowPanel className="p-3 text-center">
          <div className={`font-mono text-[17px] font-bold ${
            violation.severity === 'CRITICAL' ? 'text-[#EF4444]' :
            violation.severity === 'HIGH' ? 'text-[#FB923C]' : 'text-[#F59E0B]'
          }`}>
            {violation.severity}
          </div>
          <div className="font-mono text-[10px] uppercase tracking-[0.15em] text-text-muted mt-0.5">
            Severity
          </div>
        </GlowPanel>
        <GlowPanel className="p-3 text-center">
          <div className="font-mono text-[17px] font-bold text-text-secondary" style={{ fontVariantNumeric: 'tabular-nums' }}>
            {violation.evidence_event_ids.length}
          </div>
          <div className="font-mono text-[10px] uppercase tracking-[0.15em] text-text-muted mt-0.5">
            Evidence
          </div>
        </GlowPanel>
      </div>

      {/* ═══ FILL TIMELINE — trade-level evidence ═══ */}
      {loading ? (
        <div className="flex justify-center py-6">
          <div className="h-4 w-4 animate-pulse rounded-full bg-white/[0.06]" />
        </div>
      ) : fills.length > 0 ? (
        <div>
          <div className="font-mono text-[11px] font-semibold uppercase tracking-[0.15em] text-text-muted mb-2.5">
            Evidence Fills
          </div>
          <div className="space-y-1">
            {fills.map((fill) => {
              const fillTime = new Date(fill.timestamp_utc).toLocaleTimeString('en-US', {
                hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false,
              });
              const sideColor = fill.side === 'BUY' ? '#22D3EE' : '#FB923C';

              return (
                <div
                  key={fill.event_id}
                  className="flex items-center gap-3 bg-white/[0.04] backdrop-blur-xl border border-white/[0.08] rounded-xl px-3 py-2"
                >
                  <span
                    className="rounded px-1.5 py-0.5 font-mono text-[11px] font-bold"
                    style={{ color: sideColor, backgroundColor: `${sideColor}12` }}
                  >
                    {fill.side}
                  </span>
                  <span className="font-mono text-[12px] text-text-muted" style={{ fontVariantNumeric: 'tabular-nums' }}>
                    {fillTime}
                  </span>
                  <span className="font-mono text-[12px] text-text-secondary">{fill.contract}</span>
                  <span className="ml-auto font-mono text-[12px] font-bold text-text-primary" style={{ fontVariantNumeric: 'tabular-nums' }}>
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

      {/* ═══ ACTIONS — spec: [Review Protocol] primary, [Dismiss] ghost ═══ */}
      <div className="flex gap-3 pt-2">
        <button className="rounded-xl bg-accent-primary px-5 py-2.5 font-mono text-[12px] font-semibold text-white transition-opacity hover:opacity-90">
          Review Protocol
        </button>
        <button
          onClick={onBack}
          className="rounded-xl bg-white/[0.04] backdrop-blur-xl border border-white/[0.08] px-5 py-2.5 font-mono text-[12px] font-semibold text-text-secondary transition-colors hover:text-text-primary"
        >
          Dismiss
        </button>
      </div>
    </div>
  );
}
