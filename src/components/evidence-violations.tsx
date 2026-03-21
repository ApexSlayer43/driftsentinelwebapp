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
  const [reviewedCount, setReviewedCount] = useState(0);
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

      // Fetch active violations (unreviewed)
      const { data, error } = await supabase
        .from('violations')
        .select('*')
        .eq('account_ref', ref)
        .eq('status', 'active')
        .gte('created_at', since.toISOString())
        .order('created_at', { ascending: false })
        .limit(50);

      // Also count reviewed violations in the same window
      const { count } = await supabase
        .from('violations')
        .select('*', { count: 'exact', head: true })
        .eq('account_ref', ref)
        .neq('status', 'active')
        .gte('created_at', since.toISOString());

      if (!error && data) {
        setViolations(data as ViolationDetail[]);
      }
      setReviewedCount(count ?? 0);
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
        {reviewedCount > 0 ? (
          <>
            <p className="font-mono text-[14px] text-text-muted">
              {reviewedCount} pattern{reviewedCount !== 1 ? 's' : ''} reviewed this week
            </p>
            <p className="mt-1 font-mono text-[12px] text-[#c8a96e]">All acknowledged</p>
            <Link
              href="/forensics"
              className="mt-2 inline-block font-mono text-[11px] uppercase tracking-[0.12em] text-accent-primary transition-colors hover:text-accent-hover"
            >
              View in Forensics →
            </Link>
          </>
        ) : (
          <>
            <p className="font-mono text-[14px] text-text-muted">No patterns detected in the last 7 days</p>
            <p className="mt-1 font-mono text-[12px] text-positive">Clean record</p>
          </>
        )}
      </div>
    );
  }

  return (
    <div className="space-y-1.5">
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
          <GlowPanel key={v.violation_id} className="p-3" outerClassName="p-1">
            <button
              onClick={() => setExpandedId(isExpanded ? null : v.violation_id)}
              className="flex w-full items-center gap-3"
            >
              <DynamicIcon name={modeIcon} size={14} className="shrink-0 text-text-muted" />
              <div className="flex-1 text-left min-w-0">
                <div className="font-mono text-[11px] font-semibold text-text-secondary">
                  Pattern Detected
                </div>
                <div className="font-mono text-[12px] font-medium text-text-primary mt-0.5">
                  {modeLabel}
                </div>
                <div className="font-mono text-[11px] text-text-muted">{time}</div>
              </div>
              <span className={`font-mono text-[10px] font-bold px-2 py-0.5 rounded-full shrink-0 ${
                v.severity === 'CRITICAL' ? 'text-[#EF4444] bg-[#EF4444]/10' :
                v.severity === 'HIGH' ? 'text-[#FB923C] bg-[#FB923C]/10' :
                'text-[#F59E0B] bg-[#F59E0B]/10'
              }`}>
                {v.severity}
              </span>
            </button>

            {isExpanded && (
              <div className="mt-2 rounded-xl bg-white/[0.04] backdrop-blur-xl border border-white/[0.08] p-3 space-y-2">
                <div className="font-mono text-[11px]">
                  <span className="text-text-muted">Window: </span>
                  <span className="text-text-secondary">{windowStart} – {windowEnd}</span>
                </div>
                <div className="font-mono text-[11px]">
                  <span className="text-text-muted">Behavior: </span>
                  <span className="text-text-secondary">
                    {modeLabel} across {v.evidence_event_ids.length} fill{v.evidence_event_ids.length > 1 ? 's' : ''}
                  </span>
                </div>
                <div className="font-mono text-[11px]">
                  <span className="text-text-muted">Impact: </span>
                  <span className="text-text-secondary">−{v.points} pts daily score impact</span>
                </div>
              </div>
            )}
          </GlowPanel>
        );
      })}
    </div>
  );
}
