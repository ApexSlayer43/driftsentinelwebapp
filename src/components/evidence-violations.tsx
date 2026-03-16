'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/client';
import { getModeLabel, getModeIcon } from '@/lib/tokens';
import { DynamicIcon } from '@/components/dynamic-icon';
import { GlowPanel } from '@/components/ui/glow-panel';
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
        href="/forensics"
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
          <GlowPanel key={v.violation_id} className="p-0" outerClassName="p-1">
            <button
              onClick={() => setExpandedId(isExpanded ? null : v.violation_id)}
              className="flex items-center gap-2.5 p-2.5 transition-transform hover:scale-[1.005]"
            >
              <DynamicIcon name={modeIcon} size={12} className="shrink-0 text-text-muted" />
              <div className="text-left min-w-0">
                <div className="flex items-center gap-2">
                  <span className="font-mono text-[11px] font-medium text-text-primary truncate">
                    {modeLabel}
                  </span>
                  <span className={`font-mono text-[9px] font-bold px-1.5 py-0.5 rounded-full shrink-0 ${
                    v.severity === 'CRITICAL' ? 'text-[#EF4444] bg-[#EF4444]/10' :
                    v.severity === 'HIGH' ? 'text-[#FB923C] bg-[#FB923C]/10' :
                    'text-[#F59E0B] bg-[#F59E0B]/10'
                  }`}>
                    {v.severity}
                  </span>
                </div>
                <div className="font-mono text-[10px] text-text-muted mt-0.5">{time}</div>
              </div>
            </button>

            {isExpanded && (
              <div className="mx-2.5 mb-2.5 rounded-lg bg-white/[0.02] border border-white/[0.04] p-2.5 space-y-1.5">
                <div className="font-mono text-[10px]">
                  <span className="text-text-muted">Window: </span>
                  <span className="text-text-secondary">{windowStart} – {windowEnd}</span>
                </div>
                <div className="font-mono text-[10px]">
                  <span className="text-text-muted">Behavior: </span>
                  <span className="text-text-secondary">
                    {modeLabel} × {v.evidence_event_ids.length} fill{v.evidence_event_ids.length > 1 ? 's' : ''}
                  </span>
                </div>
                <div className="font-mono text-[10px]">
                  <span className="text-text-muted">Impact: </span>
                  <span className="text-text-secondary">−{v.points} DSI · Rule {v.rule_id}</span>
                </div>
              </div>
            )}
          </GlowPanel>
        );
      })}
    </div>
  );
}
