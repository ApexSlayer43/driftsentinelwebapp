'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/client';
import { getModeLabel, getModeIcon, getSeverityColor } from '@/lib/tokens';
import { DynamicIcon } from '@/components/dynamic-icon';
import type { ViolationDetail } from '@/lib/types';

interface EvidenceViolationsProps {
  accountRef?: string;
}

/**
 * Violations tab — recent violations with severity badges,
 * mode icons, expandable detail rows.
 * Matches the existing violations page style but in compact sheet form.
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
        const sevColor = getSeverityColor(v.severity);
        const isExpanded = expandedId === v.violation_id;
        const time = new Date(v.first_seen_utc).toLocaleString('en-US', {
          month: 'short',
          day: 'numeric',
          hour: '2-digit',
          minute: '2-digit',
          hour12: false,
        });

        return (
          <div key={v.violation_id}>
            <button
              onClick={() => setExpandedId(isExpanded ? null : v.violation_id)}
              className="flex w-full items-center gap-3 glass-card border-accent-violation rounded-2xl p-3.5 transition-transform hover:scale-[1.01]"
            >
              <DynamicIcon name={modeIcon} size={14} className="shrink-0 text-text-muted" />
              <div className="flex-1 text-left">
                <div className="font-mono text-[12px] font-semibold text-text-primary">
                  {modeLabel}
                </div>
                <div className="font-mono text-[12px] text-text-muted">{time}</div>
              </div>
              <span
                className="rounded-full px-2.5 py-0.5 font-mono text-[10px] font-bold uppercase"
                style={{ color: sevColor, backgroundColor: `${sevColor}15` }}
              >
                {v.severity}
              </span>
              <span className="font-mono text-sm font-bold text-text-primary">
                −{v.points}
              </span>
            </button>

            {isExpanded && (
              <div className="ml-5 mt-1.5 glass-inset rounded-xl p-3.5">
                <div className="grid grid-cols-2 gap-2.5 font-mono text-[12px]">
                  <div>
                    <span className="text-text-muted">Rule ID: </span>
                    <span className="text-text-secondary">{v.rule_id}</span>
                  </div>
                  <div>
                    <span className="text-text-muted">Points: </span>
                    <span className="text-text-secondary">{v.points}</span>
                  </div>
                  <div>
                    <span className="text-text-muted">Window: </span>
                    <span className="text-text-secondary">
                      {new Date(v.window_start_utc).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: false })}
                      {' – '}
                      {new Date(v.window_end_utc).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: false })}
                    </span>
                  </div>
                  <div>
                    <span className="text-text-muted">Evidence fills: </span>
                    <span className="text-text-secondary">{v.evidence_event_ids.length}</span>
                  </div>
                </div>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
