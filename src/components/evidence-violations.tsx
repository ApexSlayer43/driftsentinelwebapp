'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/client';
import { getModeLabel, getModeIcon } from '@/lib/tokens';
import { DynamicIcon } from '@/components/dynamic-icon';
import type { ViolationDetail } from '@/lib/types';

interface EvidenceViolationsProps {
  accountRef?: string;
}

/**
 * Violations tab — SBI (Situation-Behavior-Impact) framework cards.
 * Header: "Pattern Detected" — never "Violation" or "Error".
 * Amber left border per spec Section 7. Expand/collapse detail.
 */
export function EvidenceViolations({ accountRef }: EvidenceViolationsProps) {
  const [violations, setViolations] = useState<ViolationDetail[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  useEffect(() => {
    async function load() {
      const supabase = createClient();
      let ref = accountRef;

      if (!ref) {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) { setLoading(false); return; }

        const { data: accounts } = await supabase
          .from('accounts')
          .select('account_ref')
          .eq('user_id', user.id)
          .limit(1);

        if (!accounts || accounts.length === 0) { setLoading(false); return; }
        ref = accounts[0].account_ref;
      }

      // Last 7 days of violations
      const since = new Date();
      since.setDate(since.getDate() - 7);

      const { data, error } = await supabase
        .from('violations')
        .select('*')
        .eq('account_ref', ref)
        .gte('created_at', since.toISOString())
        .order('created_at', { ascending: false })
        .limit(50);

      if (!error && data) {
        setViolations(data as ViolationDetail[]);
      }
      setLoading(false);
    }

    load();
  }, [accountRef]);

  if (loading) {
    return (
      <div className="flex justify-center py-8">
        <div className="h-4 w-4 animate-spin rounded-full border-2 border-positive border-t-transparent" />
      </div>
    );
  }

  if (violations.length === 0) {
    return (
      <div className="py-8 text-center">
        <p className="font-mono text-[14px] text-text-muted">No patterns detected in the last 7 days</p>
        <p className="mt-1 font-mono text-[12px] text-positive">Clean record</p>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {/* Link to full forensics */}
      <Link
        href="/violations"
        className="block text-center font-mono text-[12px] uppercase tracking-[0.12em] text-accent-primary transition-colors hover:text-accent-hover"
      >
        View full forensics →
      </Link>

      {violations.map((v) => {
        const modeLabel = getModeLabel(v.mode);
        const modeIcon = getModeIcon(v.mode);
        const isExpanded = expandedId === v.violation_id;
        const time = new Date(v.first_seen_utc).toLocaleString('en-US', {
          month: 'short',
          day: 'numeric',
          hour: '2-digit',
          minute: '2-digit',
          hour12: false,
        });
        const windowStart = new Date(v.window_start_utc).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: false });
        const windowEnd = new Date(v.window_end_utc).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: false });

        return (
          <div key={v.violation_id}>
            {/* SBI Card — amber left border, elevated bg per spec Section 7 */}
            <button
              onClick={() => setExpandedId(isExpanded ? null : v.violation_id)}
              className="flex w-full items-center gap-3 rounded-2xl border-l-4 border-warning bg-elevated p-3.5 transition-transform hover:scale-[1.01]"
              style={{ borderRadius: '24px' }}
            >
              <DynamicIcon name={modeIcon} size={14} className="shrink-0 text-warning" />
              <div className="flex-1 text-left">
                <div className="flex items-center gap-2">
                  <span className="font-mono text-[12px] font-semibold text-warning">⚡ Pattern Detected</span>
                </div>
                <div className="font-mono text-[12px] font-medium text-text-primary mt-0.5">
                  {modeLabel}
                </div>
                <div className="font-mono text-[12px] text-text-muted">{time}</div>
              </div>
              <span className="font-mono text-[14px] font-bold text-text-primary">
                −{v.points}
              </span>
            </button>

            {/* SBI Detail — Situation, Behavior, Impact, Forward Suggestion */}
            {isExpanded && (
              <div className="ml-5 mt-1.5 rounded-xl p-3.5 space-y-2.5" style={{ background: '#1A1D27' }}>
                {/* Situation */}
                <div className="font-mono text-[12px]">
                  <span className="text-text-muted uppercase tracking-wider">Situation: </span>
                  <span className="text-text-secondary">
                    During window {windowStart} – {windowEnd}
                  </span>
                </div>
                {/* Behavior */}
                <div className="font-mono text-[12px]">
                  <span className="text-text-muted uppercase tracking-wider">Behavior: </span>
                  <span className="text-text-secondary">
                    {modeLabel} detected across {v.evidence_event_ids.length} fill{v.evidence_event_ids.length > 1 ? 's' : ''}
                  </span>
                </div>
                {/* Impact */}
                <div className="font-mono text-[12px] rounded-lg p-2.5" style={{ background: '#242836' }}>
                  <span className="text-text-muted uppercase tracking-wider">Impact: </span>
                  <span className="text-text-secondary">
                    −{v.points} BSS points · Rule {v.rule_id}
                  </span>
                </div>
                {/* Forward suggestion */}
                <div className="font-mono text-[12px] text-accent-primary">
                  Review protocol to address this pattern →
                </div>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
