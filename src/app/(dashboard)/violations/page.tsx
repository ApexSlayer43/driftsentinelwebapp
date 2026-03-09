'use client';

import { useState, useEffect } from 'react';
import { AlertTriangle } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import { getModeLabel, getModeIcon } from '@/lib/tokens';
import { DynamicIcon } from '@/components/dynamic-icon';
import type { ViolationDetail } from '@/lib/types';

type SeverityFilter = 'ALL' | 'LOW' | 'MED' | 'HIGH' | 'CRITICAL';

function daysAgo(d: number, h = 0) {
  return new Date(Date.now() - d * 86400000 - h * 3600000).toISOString();
}

const MOCK_VIOLATIONS: ViolationDetail[] = [
  {
    violation_id: 'v-m-001', mode_instance_id: 'mi-001', account_ref: 'DEMO-001',
    rule_id: 'R-SIZE-01', mode: 'OVERSIZE', severity: 'HIGH', points: 8,
    first_seen_utc: daysAgo(0, 1), window_start_utc: daysAgo(0, 2), window_end_utc: daysAgo(0),
    evidence_event_ids: ['e-1', 'e-2', 'e-3'], created_at: daysAgo(0, 1),
  },
  {
    violation_id: 'v-m-002', mode_instance_id: 'mi-002', account_ref: 'DEMO-001',
    rule_id: 'R-OFF-01', mode: 'OFF_SESSION', severity: 'MED', points: 5,
    first_seen_utc: daysAgo(0, 3), window_start_utc: daysAgo(0, 4), window_end_utc: daysAgo(0, 2),
    evidence_event_ids: ['e-4', 'e-5'], created_at: daysAgo(0, 3),
  },
  {
    violation_id: 'v-m-003', mode_instance_id: 'mi-003', account_ref: 'DEMO-001',
    rule_id: 'R-FREQ-01', mode: 'FREQUENCY', severity: 'LOW', points: 3,
    first_seen_utc: daysAgo(0, 5), window_start_utc: daysAgo(0, 6), window_end_utc: daysAgo(0, 4),
    evidence_event_ids: ['e-6'], created_at: daysAgo(0, 5),
  },
  {
    violation_id: 'v-m-004', mode_instance_id: 'mi-004', account_ref: 'DEMO-001',
    rule_id: 'R-SIZE-02', mode: 'SIZE_ESCALATION', severity: 'CRITICAL', points: 12,
    first_seen_utc: daysAgo(2, 2), window_start_utc: daysAgo(2, 3), window_end_utc: daysAgo(2, 1),
    evidence_event_ids: ['e-7', 'e-8', 'e-9', 'e-10'], created_at: daysAgo(2, 2),
  },
  {
    violation_id: 'v-m-005', mode_instance_id: 'mi-005', account_ref: 'DEMO-001',
    rule_id: 'R-OFF-01', mode: 'OFF_SESSION', severity: 'MED', points: 5,
    first_seen_utc: daysAgo(3, 1), window_start_utc: daysAgo(3, 2), window_end_utc: daysAgo(3),
    evidence_event_ids: ['e-11', 'e-12'], created_at: daysAgo(3, 1),
  },
  {
    violation_id: 'v-m-006', mode_instance_id: 'mi-006', account_ref: 'DEMO-001',
    rule_id: 'R-REVENGE-01', mode: 'REVENGE_ENTRY', severity: 'HIGH', points: 10,
    first_seen_utc: daysAgo(5, 4), window_start_utc: daysAgo(5, 5), window_end_utc: daysAgo(5, 3),
    evidence_event_ids: ['e-13', 'e-14', 'e-15'], created_at: daysAgo(5, 4),
  },
  {
    violation_id: 'v-m-007', mode_instance_id: 'mi-007', account_ref: 'DEMO-001',
    rule_id: 'R-FREQ-01', mode: 'FREQUENCY', severity: 'LOW', points: 2,
    first_seen_utc: daysAgo(7, 3), window_start_utc: daysAgo(7, 4), window_end_utc: daysAgo(7, 2),
    evidence_event_ids: ['e-16'], created_at: daysAgo(7, 3),
  },
  {
    violation_id: 'v-m-008', mode_instance_id: 'mi-008', account_ref: 'DEMO-001',
    rule_id: 'R-HESIT-01', mode: 'HESITATION', severity: 'LOW', points: 2,
    first_seen_utc: daysAgo(8, 2), window_start_utc: daysAgo(8, 3), window_end_utc: daysAgo(8, 1),
    evidence_event_ids: ['e-17', 'e-18'], created_at: daysAgo(8, 2),
  },
];

export default function ViolationsPage() {
  const [violations, setViolations] = useState<ViolationDetail[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<SeverityFilter>('ALL');
  const [expandedId, setExpandedId] = useState<string | null>(null);

  useEffect(() => {
    async function loadViolations() {
      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        setViolations(MOCK_VIOLATIONS);
        setLoading(false);
        return;
      }

      const { data: accounts } = await supabase
        .from('accounts')
        .select('account_ref')
        .eq('user_id', user.id)
        .limit(1);

      if (!accounts || accounts.length === 0) {
        setLoading(false);
        return;
      }

      const { data, error } = await supabase
        .from('violations')
        .select('*')
        .eq('account_ref', accounts[0].account_ref)
        .order('created_at', { ascending: false })
        .limit(100);

      if (!error && data) {
        setViolations(data as ViolationDetail[]);
      }
      setLoading(false);
    }

    loadViolations();
  }, []);

  const filtered = filter === 'ALL'
    ? violations
    : violations.filter(v => v.severity === filter);

  const totalDeductions = violations.reduce((sum, v) => sum + v.points, 0);
  const sevCounts = violations.reduce((acc, v) => {
    acc[v.severity] = (acc[v.severity] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  const FILTERS: SeverityFilter[] = ['ALL', 'LOW', 'MED', 'HIGH', 'CRITICAL'];

  return (
    <div className="flex h-full overflow-auto">
      {/* Violation list */}
      <div className="w-1/2 shrink-0 px-8 py-8">
        <h1 className="font-display text-2xl font-bold text-text-primary">
          Violations
        </h1>
        <p className="mt-1 font-mono text-xs text-text-muted">
          Behavioral deduction forensics
        </p>

        {/* Filter bar */}
        <div className="mt-6 flex gap-2">
          {FILTERS.map((f) => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={`rounded-full px-3 py-1 font-mono text-[9px] font-bold uppercase tracking-[0.1em] transition-colors ${
                filter === f
                  ? 'liquid-glass-tab-active text-text-primary'
                  : 'liquid-glass-tab text-text-muted hover:text-text-secondary'
              }`}
            >
              {f}
            </button>
          ))}
        </div>

        <div className="mt-6 flex flex-col gap-2">
          {loading ? (
            <div className="py-12 text-center">
              <div className="mx-auto h-5 w-5 animate-spin rounded-full border-2 border-stable border-t-transparent" />
            </div>
          ) : filtered.length === 0 ? (
            <div className="rounded-xl liquid-glass py-12 text-center">
              <AlertTriangle size={24} className="mx-auto text-text-dim" />
              <p className="mt-3 font-mono text-xs text-text-muted">
                {violations.length === 0 ? 'No violations recorded' : 'No violations match this filter'}
              </p>
            </div>
          ) : (
            filtered.map((v) => {
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

              return (
                <div key={v.violation_id}>
                  <button
                    onClick={() => setExpandedId(isExpanded ? null : v.violation_id)}
                    className="flex w-full items-center gap-3 rounded-xl glass p-3 transition-colors hover:border-border-active"
                  >
                    <DynamicIcon name={modeIcon} size={14} className="shrink-0 text-text-muted" />
                    <div className="flex-1 text-left">
                      <div className="font-mono text-[11px] font-semibold text-text-primary">
                        {modeLabel}
                      </div>
                      <div className="font-mono text-[8px] text-text-muted">{time}</div>
                    </div>
                    <span className="rounded-full px-2 py-0.5 font-mono text-[7px] font-bold uppercase text-text-muted liquid-glass-tab">
                      {v.severity}
                    </span>
                    <span className="font-mono text-sm font-bold text-text-primary">
                      -{v.points}
                    </span>
                  </button>
                  {isExpanded && (
                    <div className="ml-5 mt-1 rounded-xl liquid-glass p-3">
                      <div className="grid grid-cols-2 gap-2 font-mono text-[9px]">
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
                            {' \u2013 '}
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
            })
          )}
        </div>
      </div>

      {/* Daily summary */}
      <div className="flex-1 py-8 pr-8">
        <div className="sticky top-8 rounded-2xl liquid-glass p-6">
          <h3 className="font-mono text-[8px] font-semibold uppercase tracking-[0.2em] text-text-muted">
            Summary
          </h3>

          <div className="mt-6 flex gap-8">
            <div>
              <div className="font-mono text-[8px] uppercase tracking-[0.15em] text-text-muted">Total Deductions</div>
              <div className="font-mono text-3xl font-bold text-text-primary mt-1">
                {totalDeductions > 0 ? `-${totalDeductions}` : '\u2014'}
              </div>
            </div>
            <div>
              <div className="font-mono text-[8px] uppercase tracking-[0.15em] text-text-muted">Violations</div>
              <div className="font-mono text-3xl font-bold text-text-primary mt-1">
                {violations.length}
              </div>
            </div>
          </div>

          <div className="mt-6">
            <div className="font-mono text-[8px] font-semibold uppercase tracking-[0.15em] text-text-muted">
              By Severity
            </div>
            <div className="mt-3 space-y-2">
              {(['CRITICAL', 'HIGH', 'MED', 'LOW'] as const).map((sev) => {
                const count = sevCounts[sev] || 0;
                return (
                  <div key={sev} className="flex items-center justify-between font-mono text-[9px]">
                    <span className="text-text-muted">{sev}</span>
                    <span className="text-text-primary">{count}</span>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
