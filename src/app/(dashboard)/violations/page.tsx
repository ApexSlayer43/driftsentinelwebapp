'use client';

import { useState, useEffect } from 'react';
import { Search, Clock, Layers } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import { getModeLabel, getModeIcon } from '@/lib/tokens';
import { DynamicIcon } from '@/components/dynamic-icon';
import { ViolationDetailPanel } from '@/components/violation-detail';
import type { ViolationDetail } from '@/lib/types';

/**
 * Forensics — master-detail behavioral pattern analysis.
 * Left: scrollable pattern list with point deductions + snippets.
 * Right: full SBI analysis, impact metrics, session context, recurrence.
 */
export default function ViolationsPage() {
  const [violations, setViolations] = useState<ViolationDetail[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedViolation, setSelectedViolation] = useState<ViolationDetail | null>(null);

  useEffect(() => {
    async function loadViolations() {
      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { setLoading(false); return; }

      const { data: accounts } = await supabase
        .from('accounts')
        .select('account_ref')
        .eq('user_id', user.id)
        .limit(1);

      if (!accounts || accounts.length === 0) { setLoading(false); return; }

      const { data, error } = await supabase
        .from('violations')
        .select('*')
        .eq('account_ref', accounts[0].account_ref)
        .order('created_at', { ascending: false })
        .limit(100);

      if (!error && data) {
        const viols = data as ViolationDetail[];
        setViolations(viols);
        // Auto-select first
        if (viols.length > 0) setSelectedViolation(viols[0]);
      }
      setLoading(false);
    }

    loadViolations();
  }, []);

  const totalDeductions = violations.reduce((sum, v) => sum + v.points, 0);

  return (
    <div className="flex h-full overflow-hidden">
      {/* ═══ MASTER LIST (left) ═══ */}
      <div className="w-[380px] shrink-0 border-r border-border-subtle flex flex-col overflow-hidden">
        {/* Header */}
        <div className="px-5 pt-6 pb-4 border-b border-border-subtle">
          <h1 className="font-mono text-[13px] font-semibold uppercase tracking-[0.15em] text-text-secondary">
            Forensics
          </h1>
          <p className="mt-1 font-mono text-[12px] text-text-muted">
            {violations.length} patterns detected · 30 days
          </p>
        </div>

        {/* Scrollable list */}
        <div className="flex-1 overflow-y-auto p-3 space-y-2">
          {loading ? (
            <div className="py-12 text-center">
              <div className="mx-auto h-5 w-5 animate-spin rounded-full border-2 border-accent-primary border-t-transparent" />
            </div>
          ) : violations.length === 0 ? (
            <div className="rounded-xl glass-card py-12 text-center">
              <Search size={24} className="mx-auto text-text-dim" />
              <p className="mt-3 font-mono text-[12px] text-text-muted">
                No patterns detected
              </p>
            </div>
          ) : (
            violations.map((v) => {
              const modeLabel = getModeLabel(v.mode);
              const isSelected = selectedViolation?.violation_id === v.violation_id;
              const time = new Date(v.first_seen_utc).toLocaleString('en-US', {
                month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit', hour12: false,
              });

              // Build a snippet from rule_id + window info
              const windowStart = new Date(v.window_start_utc).toLocaleTimeString('en-US', {
                hour: '2-digit', minute: '2-digit', hour12: false,
              });
              const windowEnd = new Date(v.window_end_utc).toLocaleTimeString('en-US', {
                hour: '2-digit', minute: '2-digit', hour12: false,
              });

              return (
                <button
                  key={v.violation_id}
                  onClick={() => setSelectedViolation(v)}
                  className={`w-full text-left rounded-xl p-3.5 transition-all ${
                    isSelected
                      ? 'glass-card border-accent-primary bg-accent-muted shadow-[0_0_20px_rgba(0,212,170,0.05)]'
                      : 'glass-card hover:border-border-active'
                  }`}
                >
                  <div className="flex items-center justify-between mb-1.5">
                    <span className="font-mono text-[13px] font-semibold text-text-primary">
                      {modeLabel}
                    </span>
                    <span className="font-mono text-[12px] font-bold text-warning bg-warning/10 px-2 py-0.5 rounded">
                      -{v.points} pts
                    </span>
                  </div>
                  <div className="font-mono text-[12px] text-text-muted">
                    {time}
                  </div>
                  <div className="mt-1.5 font-mono text-[12px] text-text-secondary leading-relaxed line-clamp-2">
                    Window {windowStart} – {windowEnd} · {v.evidence_event_ids.length} evidence fills · Rule {v.rule_id}
                  </div>
                </button>
              );
            })
          )}
        </div>
      </div>

      {/* ═══ DETAIL PANEL (right) ═══ */}
      <div className="flex-1 overflow-y-auto p-8">
        {selectedViolation ? (
          <ViolationDetailPanel violation={selectedViolation} onBack={() => setSelectedViolation(null)} />
        ) : (
          <div className="flex h-full items-center justify-center">
            <div className="text-center">
              <Search size={32} className="mx-auto text-text-dim" />
              <p className="mt-4 font-mono text-[13px] text-text-muted">
                {violations.length > 0
                  ? 'Select a pattern to view forensic detail'
                  : 'No patterns detected yet'}
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
