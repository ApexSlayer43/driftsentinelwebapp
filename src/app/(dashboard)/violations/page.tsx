'use client';

import { useState, useEffect } from 'react';
import { AlertTriangle } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import { getModeLabel, getModeIcon } from '@/lib/tokens';
import { DynamicIcon } from '@/components/dynamic-icon';
import { ViolationDetailPanel } from '@/components/violation-detail';
import type { ViolationDetail } from '@/lib/types';

type SeverityFilter = 'ALL' | 'LOW' | 'MED' | 'HIGH' | 'CRITICAL';


export default function ViolationsPage() {
  const [violations, setViolations] = useState<ViolationDetail[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<SeverityFilter>('ALL');
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [selectedViolation, setSelectedViolation] = useState<ViolationDetail | null>(null);

  useEffect(() => {
    async function loadViolations() {
      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
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
              className={`rounded-full px-3 py-1 font-mono text-[12px] font-bold uppercase tracking-[0.1em] transition-colors ${
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
              <div className="mx-auto h-5 w-5 animate-spin rounded-full border-2 border-positive border-t-transparent" />
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
                    onClick={() => {
                      setExpandedId(isExpanded ? null : v.violation_id);
                      setSelectedViolation(v);
                    }}
                    className={`flex w-full items-center gap-3 glass-card rounded-2xl p-3.5 transition-colors hover:border-border-active ${
                      selectedViolation?.violation_id === v.violation_id ? 'border-border-active' : ''
                    }`}
                  >
                    <DynamicIcon name={modeIcon} size={14} className="shrink-0 text-text-muted" />
                    <div className="flex-1 text-left">
                      <div className="font-mono text-[12px] font-semibold text-text-primary">
                        {modeLabel}
                      </div>
                      <div className="font-mono text-[10px] text-text-muted">{time}</div>
                    </div>
                    <span className="rounded-full px-2 py-0.5 font-mono text-[10px] font-bold uppercase text-text-muted liquid-glass-tab">
                      {v.severity}
                    </span>
                    <span className="font-mono text-sm font-bold text-text-primary">
                      -{v.points}
                    </span>
                  </button>
                  {isExpanded && (
                    <div className="ml-5 mt-1.5 glass-inset rounded-xl p-3.5">
                      <div className="grid grid-cols-2 gap-2 font-mono text-[12px]">
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
            })
          )}
        </div>
      </div>

      {/* Right panel: Detail view or Summary */}
      <div className="flex-1 py-8 pr-8 overflow-y-auto">
        {selectedViolation ? (
          <ViolationDetailPanel
            violation={selectedViolation}
            onBack={() => setSelectedViolation(null)}
          />
        ) : (
          <div className="sticky top-8 glass-card rounded-2xl p-6">
            <h3 className="font-mono text-[10px] font-semibold uppercase tracking-[0.2em] text-text-muted">
              Summary
            </h3>

            <div className="mt-6 flex gap-8">
              <div>
                <div className="font-mono text-[10px] uppercase tracking-[0.15em] text-text-muted">Total Deductions</div>
                <div className="font-mono text-3xl font-bold text-text-primary mt-1">
                  {totalDeductions > 0 ? `−${totalDeductions}` : '—'}
                </div>
              </div>
              <div>
                <div className="font-mono text-[10px] uppercase tracking-[0.15em] text-text-muted">Violations</div>
                <div className="font-mono text-3xl font-bold text-text-primary mt-1">
                  {violations.length}
                </div>
              </div>
            </div>

            <div className="mt-6">
              <div className="font-mono text-[10px] font-semibold uppercase tracking-[0.15em] text-text-muted">
                By Severity
              </div>
              <div className="mt-3 space-y-2">
                {(['CRITICAL', 'HIGH', 'MED', 'LOW'] as const).map((sev) => {
                  const count = sevCounts[sev] || 0;
                  return (
                    <div key={sev} className="flex items-center justify-between font-mono text-[12px]">
                      <span className="text-text-muted">{sev}</span>
                      <span className="text-text-primary">{count}</span>
                    </div>
                  );
                })}
              </div>
            </div>

            {violations.length > 0 && (
              <p className="mt-6 font-mono text-[10px] text-text-dim text-center">
                Select a violation to view forensic detail
              </p>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
