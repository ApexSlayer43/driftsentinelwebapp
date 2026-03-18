'use client';

import { useState, useEffect } from 'react';
import { createClient } from '@/lib/supabase/client';
import { getTierStyle } from '@/lib/tokens';
import { GlowPanel } from '@/components/ui/glow-panel';
import type { DailyScore } from '@/lib/types';

interface EvidenceSessionsProps {
  accountRef?: string;
}

/**
 * Sessions tab — 7-day session timeline (spec Section 7).
 *
 * Each card: date/time (12px), duration (12px JetBrains Mono),
 * trade count, net P&L, BSS impact (positive/negative delta).
 * 4px left border accent: green (clean), amber (violations), orange (severe).
 * Vertically stacked with 8px spacing, each 64-72dp height.
 */
export function EvidenceSessions({ accountRef }: EvidenceSessionsProps) {
  const [scores, setScores] = useState<DailyScore[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      if (!accountRef) {
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
        <div className="h-4 w-4 animate-pulse rounded-full bg-white/[0.06]" />
      </div>
    );
  }

  if (scores.length === 0) {
    return (
      <div className="py-8 text-center">
        <p className="font-mono text-[14px] text-text-muted">No session data in the last 7 days</p>
      </div>
    );
  }

  return (
    <div className="space-y-1.5">
      {scores.map((day) => {
        // Derive tier from BSS score for color
        const tier = day.bss_score >= 90 ? 'SOVEREIGN'
          : day.bss_score >= 80 ? 'DISCIPLINED'
          : day.bss_score >= 65 ? 'CONSISTENT'
          : day.bss_score >= 50 ? 'DEVELOPING'
          : day.bss_score >= 30 ? 'FORMING'
          : 'DORMANT';
        const tierStyle = getTierStyle(tier);

        // BSS delta
        const delta = day.bss_score - day.bss_previous;

        return (
          <GlowPanel
            key={day.daily_score_id}
            className="p-2.5"
            outerClassName="p-1"
          >
            <div className="flex items-center justify-between">
              <div className="min-w-0">
                <div className="font-mono text-[12px] font-medium text-text-primary">
                  {day.trading_date}
                </div>
                <div className="mt-1 flex items-center gap-3 font-mono text-[11px] text-text-muted">
                  <span>{day.fills_count} trades</span>
                  <span>Session {day.dsi_score}/100</span>
                  {day.streak_count > 0 && (
                    <span className="text-positive">{day.streak_count}d streak</span>
                  )}
                </div>
              </div>
              <div className="text-right">
                <div
                  className="font-mono text-lg font-bold"
                  style={{ color: tierStyle.color, fontVariantNumeric: 'tabular-nums' }}
                >
                  {day.bss_score}
                </div>
                <div className={`font-mono text-[11px] font-medium ${
                  delta > 0 ? 'text-positive' : delta < 0 ? 'text-negative' : 'text-text-muted'
                }`} style={{ fontVariantNumeric: 'tabular-nums' }}>
                  {delta > 0 ? '+' : ''}{delta !== 0 ? delta : '—'}
                </div>
              </div>
            </div>

            {day.violation_count > 0 && (
              <div className="mt-1.5 flex items-center gap-1.5 font-mono text-[11px] text-warning">
                <span className="inline-block h-1.5 w-1.5 rounded-full bg-warning" />
                {day.violation_count} pattern{day.violation_count > 1 ? 's' : ''} detected
              </div>
            )}
          </GlowPanel>
        );
      })}
    </div>
  );
}
