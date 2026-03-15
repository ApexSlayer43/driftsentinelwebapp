'use client';

import { useState, useEffect } from 'react';
import { createClient } from '@/lib/supabase/client';
import { getTierStyle } from '@/lib/tokens';
import type { DailyScore } from '@/lib/types';

interface EvidenceSessionsProps {
  accountRef?: string;
}

/**
 * Sessions tab — 7-day daily scores timeline.
 * Each row shows trading_date, BSS score, DSI, fills, violations, streak.
 * Color-coded: clean days (green border) vs violation days (orange border).
 */
export function EvidenceSessions({ accountRef }: EvidenceSessionsProps) {
  const [scores, setScores] = useState<DailyScore[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      if (!accountRef) {
        // Resolve account_ref from auth
        const supabase = createClient();
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) { setLoading(false); return; }

        const { data: accounts } = await supabase
          .from('accounts')
          .select('account_ref')
          .eq('user_id', user.id)
          .limit(1);

        if (!accounts || accounts.length === 0) { setLoading(false); return; }
        await fetchScores(accounts[0].account_ref);
      } else {
        await fetchScores(accountRef);
      }
    }

    async function fetchScores(ref: string) {
      const supabase = createClient();
      const since = new Date();
      since.setDate(since.getDate() - 7);

      const { data, error } = await supabase
        .from('daily_scores')
        .select('*')
        .eq('account_ref', ref)
        .gte('trading_date', since.toISOString().slice(0, 10))
        .order('trading_date', { ascending: false });

      if (!error && data) {
        setScores(data as DailyScore[]);
      }
      setLoading(false);
    }

    load();
  }, [accountRef]);

  if (loading) {
    return (
      <div className="flex justify-center py-8">
        <div className="h-4 w-4 animate-spin rounded-full border-2 border-stable border-t-transparent" />
      </div>
    );
  }

  if (scores.length === 0) {
    return (
      <div className="py-8 text-center">
        <p className="font-mono text-xs text-text-muted">No session data in the last 7 days</p>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {scores.map((day) => {
        const isClean = day.violation_count === 0;
        const borderColor = isClean ? 'border-stable/30' : 'border-drift/30';
        const bgColor = isClean ? 'bg-stable/[0.03]' : 'bg-drift/[0.03]';

        // Derive tier from BSS score for color
        const tier = day.bss_score >= 90 ? 'SOVEREIGN'
          : day.bss_score >= 80 ? 'PROVEN'
          : day.bss_score >= 65 ? 'GROUNDED'
          : day.bss_score >= 50 ? 'DEFINED'
          : day.bss_score >= 30 ? 'FORMING'
          : 'DORMANT';
        const tierStyle = getTierStyle(tier);

        // BSS delta from previous
        const delta = day.bss_score - day.bss_previous;

        return (
          <div
            key={day.daily_score_id}
            className={`rounded-xl border ${borderColor} ${bgColor} p-3 transition-colors hover:border-border-active`}
          >
            <div className="flex items-center justify-between">
              <div>
                <div className="font-mono text-[11px] font-semibold text-text-primary">
                  {day.trading_date}
                </div>
                <div className="mt-0.5 flex items-center gap-3 font-mono text-[9px] text-text-muted">
                  <span>{day.fills_count} fills</span>
                  <span>DSI {day.dsi_score}</span>
                  {day.streak_count > 0 && (
                    <span className="text-stable">{day.streak_count}d streak</span>
                  )}
                </div>
              </div>
              <div className="text-right">
                <div
                  className="font-mono text-lg font-bold"
                  style={{ color: tierStyle.color }}
                >
                  {day.bss_score}
                </div>
                <div className={`font-mono text-[9px] font-medium ${
                  delta > 0 ? 'text-stable' : delta < 0 ? 'text-compromised' : 'text-text-muted'
                }`}>
                  {delta > 0 ? '+' : ''}{delta !== 0 ? delta : '\u2014'}
                </div>
              </div>
            </div>

            {day.violation_count > 0 && (
              <div className="mt-2 rounded-lg bg-drift/[0.06] px-2.5 py-1.5 font-mono text-[8px] text-drift">
                {day.violation_count} violation{day.violation_count > 1 ? 's' : ''} \u2022 -{day.violation_count * 10} deduction points
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
