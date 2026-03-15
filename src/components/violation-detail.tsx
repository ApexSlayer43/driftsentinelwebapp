'use client';

import { useState, useEffect } from 'react';
import { Clock, Layers } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import { getModeLabel, getModeIcon } from '@/lib/tokens';
import { DynamicIcon } from '@/components/dynamic-icon';
import { EvidenceOrbital } from '@/components/evidence-orbital';
import type { ViolationDetail as ViolationDetailType, FillCanonical } from '@/lib/types';

interface ViolationDetailProps {
  violation: ViolationDetailType;
  onBack: () => void;
}

/**
 * Forensic detail panel — SBI analysis, impact metrics, session context,
 * recurrence tracker, evidence orbital, and fill timeline.
 * Matches the Drift Sentinel Forensics preview design.
 */
export function ViolationDetailPanel({ violation, onBack }: ViolationDetailProps) {
  const [fills, setFills] = useState<FillCanonical[]>([]);
  const [loading, setLoading] = useState(true);

  const modeLabel = getModeLabel(violation.mode);
  const modeIcon = getModeIcon(violation.mode);

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

  // Compute window duration in minutes
  const windowMs = new Date(violation.window_end_utc).getTime() - new Date(violation.window_start_utc).getTime();
  const windowMinutes = Math.round(windowMs / 60000);

  return (
    <div className="flex flex-col gap-6 max-w-3xl">
      {/* ═══ HEADER ═══ */}
      <div>
        <div className="font-mono text-[12px] uppercase tracking-[0.2em] text-text-muted mb-2">
          Pattern Detected
        </div>
        <h2 className="font-mono text-[22px] font-bold text-text-primary mb-2">
          {modeLabel}
        </h2>
        <div className="flex items-center gap-4 font-mono text-[12px] text-text-muted">
          <div className="flex items-center gap-1.5">
            <Clock size={14} />
            {dateStr} · {timeStr} EST
          </div>
          <div className="flex items-center gap-1.5">
            <Layers size={14} />
            Rule {violation.rule_id}
          </div>
        </div>
      </div>

      {/* ═══ SBI ANALYSIS ═══ */}
      <div>
        <div className="font-mono text-[12px] font-semibold uppercase tracking-[0.2em] text-text-muted mb-3">
          SBI Analysis
        </div>
        <div className="glass-card rounded-2xl p-5 space-y-4">
          {/* Situation */}
          <div className="flex gap-3">
            <div className="w-7 h-7 rounded-lg flex items-center justify-center shrink-0 bg-[rgba(96,165,250,0.10)] text-[#60A5FA] font-mono text-[12px] font-bold">
              S
            </div>
            <div className="flex-1">
              <div className="font-mono text-[12px] font-semibold uppercase tracking-[0.15em] text-text-muted mb-1">
                Situation (Window)
              </div>
              <div className="font-mono text-[13px] text-text-secondary leading-relaxed">
                {violation.evidence_event_ids.length} fills executed over {windowMinutes} minutes between {windowStart}–{windowEnd} EST.
              </div>
            </div>
          </div>

          {/* Behavior */}
          <div className="flex gap-3">
            <div className="w-7 h-7 rounded-lg flex items-center justify-center shrink-0 bg-[rgba(245,158,11,0.10)] text-[#F59E0B] font-mono text-[12px] font-bold">
              B
            </div>
            <div className="flex-1">
              <div className="font-mono text-[12px] font-semibold uppercase tracking-[0.15em] text-text-muted mb-1">
                Behavior
              </div>
              <div className="font-mono text-[13px] text-text-secondary leading-relaxed">
                {modeLabel} pattern detected. Violation triggered under rule {violation.rule_id} with severity {violation.severity}. {violation.evidence_event_ids.length} evidence fills flagged within the analysis window.
              </div>
            </div>
          </div>

          {/* Impact */}
          <div className="flex gap-3">
            <div className="w-7 h-7 rounded-lg flex items-center justify-center shrink-0 bg-[rgba(239,68,68,0.10)] text-[#EF4444] font-mono text-[12px] font-bold">
              I
            </div>
            <div className="flex-1">
              <div className="font-mono text-[12px] font-semibold uppercase tracking-[0.15em] text-text-muted mb-1">
                Impact
              </div>
              <div className="font-mono text-[13px] text-text-secondary leading-relaxed">
                {violation.points} violation points assessed (weighted by mode before BSS calculation). Pattern severity classified as {violation.severity}.
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* ═══ IMPACT METRICS ═══ */}
      <div>
        <div className="font-mono text-[12px] font-semibold uppercase tracking-[0.2em] text-text-muted mb-3">
          Impact Metrics
        </div>
        <div className="grid grid-cols-3 gap-3">
          <div className="glass-inset rounded-xl p-4 text-center">
            <div className="font-mono text-[20px] font-bold text-[#EF4444]">
              -{violation.points}
            </div>
            <div className="font-mono text-[10px] uppercase tracking-[0.15em] text-text-muted mt-1">
              Violation Pts
            </div>
          </div>
          <div className="glass-inset rounded-xl p-4 text-center">
            <div className="font-mono text-[20px] font-bold text-warning">
              {violation.severity}
            </div>
            <div className="font-mono text-[10px] uppercase tracking-[0.15em] text-text-muted mt-1">
              Severity
            </div>
          </div>
          <div className="glass-inset rounded-xl p-4 text-center">
            <div className="font-mono text-[20px] font-bold text-text-secondary">
              {violation.evidence_event_ids.length}
            </div>
            <div className="font-mono text-[10px] uppercase tracking-[0.15em] text-text-muted mt-1">
              Evidence Fills
            </div>
          </div>
        </div>
      </div>

      {/* ═══ SESSION CONTEXT ═══ */}
      <div>
        <div className="font-mono text-[12px] font-semibold uppercase tracking-[0.2em] text-text-muted mb-3">
          Session Context
        </div>
        <div className="glass-card rounded-2xl p-4 flex gap-5 flex-wrap">
          <div className="flex flex-col gap-0.5">
            <span className="font-mono text-[10px] uppercase tracking-[0.15em] text-text-muted">Duration</span>
            <span className="font-mono text-[13px] font-semibold text-text-primary">{windowMinutes} min</span>
          </div>
          <div className="flex flex-col gap-0.5">
            <span className="font-mono text-[10px] uppercase tracking-[0.15em] text-text-muted">Entries</span>
            <span className="font-mono text-[13px] font-semibold text-text-primary">{violation.evidence_event_ids.length}</span>
          </div>
          <div className="flex flex-col gap-0.5">
            <span className="font-mono text-[10px] uppercase tracking-[0.15em] text-text-muted">Window</span>
            <span className="font-mono text-[13px] font-semibold text-text-primary">{windowStart} – {windowEnd}</span>
          </div>
          <div className="flex flex-col gap-0.5">
            <span className="font-mono text-[10px] uppercase tracking-[0.15em] text-text-muted">Rule</span>
            <span className="font-mono text-[13px] font-semibold text-text-primary">{violation.rule_id}</span>
          </div>
        </div>
      </div>

      {/* ═══ EVIDENCE ORBITAL ═══ */}
      {loading ? (
        <div className="flex justify-center py-8">
          <div className="h-4 w-4 animate-spin rounded-full border-2 border-accent-primary border-t-transparent" />
        </div>
      ) : fills.length > 0 ? (
        <div>
          <div className="font-mono text-[12px] font-semibold uppercase tracking-[0.2em] text-text-muted mb-3">
            Evidence Orbital
          </div>
          <div className="glass-card rounded-2xl p-4">
            <EvidenceOrbital violation={violation} fills={fills} />
          </div>
        </div>
      ) : null}

      {/* ═══ FILL TIMELINE ═══ */}
      {fills.length > 0 && (
        <div>
          <div className="font-mono text-[12px] font-semibold uppercase tracking-[0.2em] text-text-muted mb-3">
            Fill Timeline
          </div>
          <div className="glass-card rounded-2xl p-4 space-y-1.5">
            {fills.map((fill) => {
              const fillTime = new Date(fill.timestamp_utc).toLocaleTimeString('en-US', {
                hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false,
              });
              const sideColor = fill.side === 'BUY' ? '#00D4AA' : '#FB923C';

              return (
                <div
                  key={fill.event_id}
                  className="flex items-center gap-3 glass-inset rounded-xl px-3 py-2"
                >
                  <span
                    className="rounded-full px-1.5 py-0.5 font-mono text-[12px] font-bold"
                    style={{ color: sideColor, backgroundColor: `${sideColor}15` }}
                  >
                    {fill.side}
                  </span>
                  <span className="font-mono text-[12px] text-text-muted">{fillTime}</span>
                  <span className="font-mono text-[12px] text-text-secondary">{fill.contract}</span>
                  <span className="ml-auto font-mono text-[12px] font-bold text-text-primary">
                    {fill.qty} @ {fill.price}
                  </span>
                  {fill.off_session && (
                    <span className="rounded-full bg-warning/10 px-1.5 py-0.5 font-mono text-[12px] font-bold text-warning">
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
