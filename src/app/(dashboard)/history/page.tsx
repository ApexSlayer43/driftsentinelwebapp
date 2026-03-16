'use client';

import { useState, useEffect, useMemo } from 'react';
import { createClient } from '@/lib/supabase/client';
import type { DailyScore } from '@/lib/types';
import {
  BarChart3,
  TrendingUp,
  TrendingDown,
  Target,
} from 'lucide-react';
import RadialOrbitalTimeline from '@/components/ui/radial-orbital-timeline';
import type { TimelineItem } from '@/components/ui/radial-orbital-timeline';

type TimeRange = '7D' | '30D' | '90D';


function buildMetricNodes(scores: DailyScore[], range: string): TimelineItem[] {
  const currentScore = scores.length > 0 ? scores[scores.length - 1].dsi_score : null;
  const avgScore = scores.length > 0
    ? Math.round(scores.reduce((s, d) => s + d.dsi_score, 0) / scores.length)
    : null;
  const highScore = scores.length > 0 ? Math.max(...scores.map(d => d.dsi_score)) : null;
  const lowScore = scores.length > 0 ? Math.min(...scores.map(d => d.dsi_score)) : null;

  const totalViolations = scores.reduce((s, d) => s + d.violation_count, 0);
  const totalFills = scores.reduce((s, d) => s + d.fills_count, 0);
  const tradingDays = scores.length;

  const highDay = scores.length > 0
    ? scores.reduce((best, d) => d.dsi_score > best.dsi_score ? d : best)
    : null;
  const lowDay = scores.length > 0
    ? scores.reduce((worst, d) => d.dsi_score < worst.dsi_score ? d : worst)
    : null;

  return [
    {
      id: 1,
      title: 'Current',
      date: scores.length > 0 ? scores[scores.length - 1].trading_date : 'No data',
      content: currentScore !== null
        ? `Your latest DSI score is ${currentScore}. ${currentScore >= 80 ? 'Discipline is holding strong.' : currentScore >= 50 ? 'Some drift detected — stay focused.' : 'Significant drift — review your protocol.'}`
        : `No trading data for the ${range} window yet.`,
      category: 'Metric',
      icon: Target,
      relatedIds: [2, 3, 4],
      status: currentScore !== null ? (currentScore >= 80 ? 'completed' : currentScore >= 50 ? 'in-progress' : 'pending') : 'pending',
      energy: currentScore ?? 0,
    },
    {
      id: 2,
      title: 'Average',
      date: `${range} window`,
      content: avgScore !== null
        ? `Average DSI score of ${avgScore} across ${tradingDays} trading day${tradingDays !== 1 ? 's' : ''}. ${totalViolations} total violation${totalViolations !== 1 ? 's' : ''}, ${totalFills} fill${totalFills !== 1 ? 's' : ''} processed.`
        : `No trading data for the ${range} window yet.`,
      category: 'Metric',
      icon: BarChart3,
      relatedIds: [1, 3, 4],
      status: avgScore !== null ? (avgScore >= 80 ? 'completed' : avgScore >= 50 ? 'in-progress' : 'pending') : 'pending',
      energy: avgScore ?? 0,
    },
    {
      id: 3,
      title: 'High',
      date: highDay ? highDay.trading_date : 'No data',
      content: highScore !== null
        ? `Peak score of ${highScore} reached on ${highDay!.trading_date}. ${highDay!.violation_count === 0 ? 'Zero violations — clean execution.' : `${highDay!.violation_count} violation${highDay!.violation_count !== 1 ? 's' : ''} recorded that day.`}`
        : `No trading data for the ${range} window yet.`,
      category: 'Metric',
      icon: TrendingUp,
      relatedIds: [1, 2, 4],
      status: highScore !== null ? (highScore >= 80 ? 'completed' : highScore >= 50 ? 'in-progress' : 'pending') : 'pending',
      energy: highScore ?? 0,
    },
    {
      id: 4,
      title: 'Low',
      date: lowDay ? lowDay.trading_date : 'No data',
      content: lowScore !== null
        ? `Lowest score of ${lowScore} on ${lowDay!.trading_date}. ${lowDay!.violation_count} violation${lowDay!.violation_count !== 1 ? 's' : ''} that session. ${lowScore >= 60 ? 'Floor is still solid.' : 'Review this session for patterns.'}`
        : `No trading data for the ${range} window yet.`,
      category: 'Metric',
      icon: TrendingDown,
      relatedIds: [1, 2, 3],
      status: lowScore !== null ? (lowScore >= 80 ? 'completed' : lowScore >= 50 ? 'in-progress' : 'pending') : 'pending',
      energy: lowScore ?? 0,
    },
  ];
}

export default function HistoryPage() {
  const [scores, setScores] = useState<DailyScore[]>([]);
  const [loading, setLoading] = useState(true);
  const [range, setRange] = useState<TimeRange>('30D');

  useEffect(() => {
    async function loadScores() {
      setLoading(true);
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

      const days = range === '7D' ? 7 : range === '30D' ? 30 : 90;
      const since = new Date();
      since.setDate(since.getDate() - days);

      const { data, error } = await supabase
        .from('daily_scores')
        .select('*')
        .eq('account_ref', accounts[0].account_ref)
        .gte('trading_date', since.toISOString().slice(0, 10))
        .order('trading_date', { ascending: true });

      if (!error && data) {
        setScores(data as DailyScore[]);
      }
      setLoading(false);
    }

    loadScores();
  }, [range]);

  const timelineData = useMemo(() => buildMetricNodes(scores, range), [scores, range]);

  const RANGES: TimeRange[] = ['7D', '30D', '90D'];

  return (
    <div className="flex flex-col h-full overflow-hidden">
      {/* Header */}
      <div className="px-8 pt-6 pb-2 flex items-end justify-between shrink-0">
        <div>
          <h1 className="font-display text-2xl font-bold text-text-primary">
            History
          </h1>
          <p className="mt-1 font-mono text-xs text-text-muted">
            Orbital view of your trading metrics
          </p>
        </div>
        <div className="flex gap-2">
          {RANGES.map((r) => (
            <button
              key={r}
              onClick={() => setRange(r)}
              className={`rounded-full px-3 py-1 font-mono text-[12px] font-bold uppercase tracking-[0.1em] transition-colors ${
                range === r
                  ? 'bg-white/[0.06] text-text-primary'
                  : 'hover:bg-white/[0.04] transition-colors text-text-muted hover:text-text-secondary'
              }`}
            >
              {r}
            </button>
          ))}
        </div>
      </div>

      {/* Orbital */}
      <div className="flex-1 min-h-0 relative">
        {loading ? (
          <div className="flex h-full items-center justify-center">
            <div className="h-5 w-5 animate-spin rounded-full border-2 border-positive border-t-transparent" />
          </div>
        ) : (
          <RadialOrbitalTimeline timelineData={timelineData} />
        )}
      </div>
    </div>
  );
}
