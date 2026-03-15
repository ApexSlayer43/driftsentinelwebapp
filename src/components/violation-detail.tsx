'use client';

import { useState, useEffect } from 'react';
import { createClient } from '@/lib/supabase/client';
import { getModeLabel, getModeIcon, getSeverityColor } from '@/lib/tokens';
import { DynamicIcon } from '@/components/dynamic-icon';
import { EvidenceOrbital } from '@/components/evidence-orbital';
import type { ViolationDetail as ViolationDetailType, FillCanonical } from '@/lib/types';

interface ViolationDetailProps {
  violation: ViolationDetailType;
  onBack: () => void;
}

/**
 * Forensic detail panel for a single violation.
 * Shows: violation summary, evidence orbital (fill visualization),
 * and the raw fill-level data table.
 */
export function ViolationDetailPanel({ violation, onBack }: ViolationDetailProps) {
  const [fills, setFills] = useState<FillCanonical[]>([]);
  const [loading, setLoading] = useState(true);

  const modeLabel = getModeLabel(violation.mode);
  const modeIcon = getModeIcon(violation.mode);
  const sevColor = getSeverityColor(violation.severity);

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

  const time = new Date(violation.first_seen_utc).toLocaleString('en-US', {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  });

  const windowStart = new Date(violation.window_start_utc).toLocaleTimeString('en-US', {
    hour: '2-digit', minute: '2-digit', hour12: false,
  });
  const windowEnd = new Date(violation.window_end_utc).toLocaleTimeString('en-US', {
    hour: '2-digit', minute: '2-digit', hour12: false,
  });

  return (
    <div className="flex flex-col gap-5">
      {/* Back button */}
      <button
        onClick={onBack}
        className="self-start font-mono text-[9px] uppercase tracking-[0.12em] text-text-muted transition-colors hover:text-text-secondary"
      >
        \u2190 Back to list
      </button>

      {/* Violation header */}
      <div className="rounded-xl liquid-glass p-5">
        <div className="flex items-start gap-3">
          <DynamicIcon name={modeIcon} size={18} className="mt-0.5 shrink-0 text-text-muted" />
          <div className="flex-1">
            <h3 className="font-mono text-sm font-bold text-text-primary">{modeLabel}</h3>
            <div className="mt-1 font-mono text-[9px] text-text-muted">{time}</div>
          </div>
          <span
            className="rounded-full px-2.5 py-0.5 font-mono text-[8px] font-bold uppercase"
            style={{ color: sevColor, backgroundColor: `${sevColor}15` }}
          >
            {violation.severity}
          </span>
        </div>

        <div className="mt-4 grid grid-cols-2 gap-3 font-mono text-[9px]">
          <div>
            <span className="text-text-muted">Points: </span>
            <span className="font-bold text-text-primary">-{violation.points}</span>
          </div>
          <div>
            <span className="text-text-muted">Rule: </span>
            <span className="text-text-secondary">{violation.rule_id}</span>
          </div>
          <div>
            <span className="text-text-muted">Window: </span>
            <span className="text-text-secondary">{windowStart} \u2013 {windowEnd}</span>
          </div>
          <div>
            <span className="text-text-muted">Evidence: </span>
            <span className="text-text-secondary">{violation.evidence_event_ids.length} fills</span>
          </div>
        </div>
      </div>

      {/* Evidence Orbital — SVG visualization of fills around the violation */}
      {loading ? (
        <div className="flex justify-center py-8">
          <div className="h-4 w-4 animate-spin rounded-full border-2 border-stable border-t-transparent" />
        </div>
      ) : fills.length > 0 ? (
        <div className="rounded-xl liquid-glass p-4">
          <h4 className="mb-3 font-mono text-[8px] font-semibold uppercase tracking-[0.2em] text-text-muted">
            Evidence Orbital
          </h4>
          <EvidenceOrbital violation={violation} fills={fills} />
        </div>
      ) : null}

      {/* Fill-level data table */}
      {fills.length > 0 && (
        <div className="rounded-xl liquid-glass p-4">
          <h4 className="mb-3 font-mono text-[8px] font-semibold uppercase tracking-[0.2em] text-text-muted">
            Fill Timeline
          </h4>
          <div className="space-y-1.5">
            {fills.map((fill) => {
              const fillTime = new Date(fill.timestamp_utc).toLocaleTimeString('en-US', {
                hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false,
              });
              const sideColor = fill.side === 'BUY' ? '#00D4AA' : '#FF3B5C';

              return (
                <div
                  key={fill.event_id}
                  className="flex items-center gap-3 rounded-lg glass-raised px-3 py-2"
                >
                  <span
                    className="rounded-full px-1.5 py-0.5 font-mono text-[7px] font-bold"
                    style={{ color: sideColor, backgroundColor: `${sideColor}15` }}
                  >
                    {fill.side}
                  </span>
                  <span className="font-mono text-[9px] text-text-muted">{fillTime}</span>
                  <span className="font-mono text-[9px] text-text-secondary">{fill.contract}</span>
                  <span className="ml-auto font-mono text-[9px] font-bold text-text-primary">
                    {fill.qty} @ {fill.price}
                  </span>
                  {fill.off_session && (
                    <span className="rounded-full bg-drift/10 px-1.5 py-0.5 font-mono text-[6px] font-bold text-drift">
                      OFF
                    </span>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
