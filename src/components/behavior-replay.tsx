'use client';

import { useState, useEffect } from 'react';
import { createClient } from '@/lib/supabase/client';
import { getModeLabel, getSeverityColor } from '@/lib/tokens';
import type { FillCanonical, ViolationDetail } from '@/lib/types';

interface BehaviorReplayProps {
  accountRef: string;
  tradingDate: string; // YYYY-MM-DD
}

interface AnnotatedFill extends FillCanonical {
  violations: ViolationDetail[];
}

/**
 * Behavior Replay — chronological timeline of all fills for a single trading day,
 * annotated with violation markers where fills triggered behavioral deductions.
 */
export function BehaviorReplay({ accountRef, tradingDate }: BehaviorReplayProps) {
  const [fills, setFills] = useState<AnnotatedFill[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      const supabase = createClient();

      // Fetch all fills for this date
      const dayStart = `${tradingDate}T00:00:00Z`;
      const dayEnd = `${tradingDate}T23:59:59Z`;

      const [fillsResult, violationsResult] = await Promise.all([
        supabase
          .from('fills_canonical')
          .select('*')
          .eq('account_ref', accountRef)
          .gte('timestamp_utc', dayStart)
          .lte('timestamp_utc', dayEnd)
          .order('timestamp_utc', { ascending: true }),
        supabase
          .from('violations')
          .select('*')
          .eq('account_ref', accountRef)
          .gte('created_at', dayStart)
          .lte('created_at', dayEnd),
      ]);

      const rawFills = (fillsResult.data ?? []) as FillCanonical[];
      const dayViolations = (violationsResult.data ?? []) as ViolationDetail[];

      // Annotate fills with their violations
      const annotated: AnnotatedFill[] = rawFills.map((fill) => {
        const matchingViolations = dayViolations.filter((v) =>
          v.evidence_event_ids.includes(fill.event_id)
        );
        return { ...fill, violations: matchingViolations };
      });

      setFills(annotated);
      setLoading(false);
    }

    load();
  }, [accountRef, tradingDate]);

  if (loading) {
    return (
      <div className="flex justify-center py-8">
        <div className="h-4 w-4 animate-spin rounded-full border-2 border-stable border-t-transparent" />
      </div>
    );
  }

  if (fills.length === 0) {
    return (
      <div className="py-8 text-center">
        <p className="font-mono text-xs text-text-muted">No fills on {tradingDate}</p>
      </div>
    );
  }

  return (
    <div className="relative pl-8 space-y-3">
      {/* Timeline spine */}
      <div className="absolute left-[11px] top-2 bottom-2 w-px bg-border-subtle" />

      {fills.map((fill, i) => {
        const hasViolation = fill.violations.length > 0;
        const sideColor = fill.side === 'BUY' ? '#00D4AA' : '#FF3B5C';
        const dotColor = hasViolation ? '#FF6B35' : sideColor;
        const time = new Date(fill.timestamp_utc).toLocaleTimeString('en-US', {
          hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false,
        });

        return (
          <div key={fill.event_id} className="relative">
            {/* Timeline dot */}
            <div
              className="absolute -left-[21px] top-3 h-3 w-3 rounded-full border-2 border-void"
              style={{ backgroundColor: dotColor }}
            />

            {/* Fill card */}
            <div className={`rounded-xl glass p-3 transition-colors hover:border-border-active ${
              hasViolation ? 'border-drift/20' : ''
            }`}>
              <div className="flex items-center gap-3">
                <span
                  className="rounded-full px-1.5 py-0.5 font-mono text-[7px] font-bold"
                  style={{ color: sideColor, backgroundColor: `${sideColor}15` }}
                >
                  {fill.side}
                </span>
                <span className="font-mono text-[9px] text-text-muted">{time}</span>
                <span className="font-mono text-[9px] text-text-secondary">{fill.contract}</span>
                <span className="ml-auto font-mono text-[10px] font-bold text-text-primary">
                  {fill.qty} @ {fill.price}
                </span>
              </div>

              {fill.off_session && (
                <div className="mt-1.5 rounded-lg bg-drift/[0.06] px-2 py-1 font-mono text-[7px] font-bold text-drift">
                  OFF-SESSION TRADE
                </div>
              )}

              {/* Violation annotations */}
              {fill.violations.map((v) => (
                <div
                  key={v.violation_id}
                  className="mt-1.5 flex items-center gap-2 rounded-lg px-2 py-1"
                  style={{ backgroundColor: `${getSeverityColor(v.severity)}08` }}
                >
                  <span
                    className="font-mono text-[7px] font-bold"
                    style={{ color: getSeverityColor(v.severity) }}
                  >
                    \u2716 {getModeLabel(v.mode)}
                  </span>
                  <span className="ml-auto font-mono text-[7px] text-text-muted">
                    -{v.points}pts
                  </span>
                </div>
              ))}
            </div>
          </div>
        );
      })}

      {/* Summary footer */}
      <div className="ml-2 mt-2 flex items-center gap-4 font-mono text-[8px] text-text-muted">
        <span>{fills.length} fills</span>
        <span>{fills.filter(f => f.violations.length > 0).length} flagged</span>
        <span>{fills.filter(f => f.off_session).length} off-session</span>
      </div>
    </div>
  );
}
