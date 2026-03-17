'use client';

import { useState, useEffect, useCallback } from 'react';
import {
  Target,
  Pause,
  TrendingUp,
  TrendingDown,
  Minus,
  ChevronDown,
  ChevronUp,
  Calendar,
  X,
} from 'lucide-react';
import { GlowPanel } from '@/components/ui/glow-panel';

/**
 * Weekly Wrap — Senti's end-of-week behavioral reflection.
 *
 * Aggregates intentions, cooldown usage, and BSS trajectory
 * into a narrative the trader can actually learn from.
 *
 * Shows as a dismissible card on the dashboard.
 * Visible Sunday–Monday (or anytime if user hasn't seen it this week).
 */

interface WeeklyWrapData {
  period: { start: string; end: string };
  intentions: {
    days_set: number;
    entries: { session_date: string; goal_text: string }[];
    top_themes: { word: string; count: number }[];
  };
  cooldowns: {
    total: number;
    avg_duration_seconds: number | null;
    avg_bss_at_activation: number | null;
  };
  bss: {
    start: number | null;
    end: number | null;
    delta: number | null;
    high: number | null;
    low: number | null;
    daily: { trading_date: string; bss_score: number }[];
  };
  profile_goal: string | null;
  narrative: string;
}

export function WeeklyWrap() {
  const [data, setData] = useState<WeeklyWrapData | null>(null);
  const [loading, setLoading] = useState(true);
  const [dismissed, setDismissed] = useState(false);
  const [expanded, setExpanded] = useState(false);

  useEffect(() => {
    // Check if already dismissed this week
    const dismissedWeek = sessionStorage.getItem('ds_weekly_wrap_dismissed');
    const currentWeek = getWeekKey();
    if (dismissedWeek === currentWeek) {
      setDismissed(true);
      setLoading(false);
      return;
    }

    async function fetchWrap() {
      try {
        const res = await fetch('/api/insights/weekly-wrap');
        if (!res.ok) {
          setLoading(false);
          return;
        }
        const json: WeeklyWrapData = await res.json();

        // Only show if there's meaningful data (at least 1 intention or 1 score)
        if (json.intentions.days_set === 0 && json.bss.daily.length === 0) {
          setLoading(false);
          return;
        }

        setData(json);
      } catch {
        // Silently fail — wrap is non-critical
      } finally {
        setLoading(false);
      }
    }

    fetchWrap();
  }, []);

  const handleDismiss = useCallback(() => {
    sessionStorage.setItem('ds_weekly_wrap_dismissed', getWeekKey());
    setDismissed(true);
  }, []);

  if (loading || dismissed || !data) return null;

  const deltaIcon =
    data.bss.delta != null && data.bss.delta > 0 ? (
      <TrendingUp size={14} className="text-positive" />
    ) : data.bss.delta != null && data.bss.delta < 0 ? (
      <TrendingDown size={14} className="text-negative" />
    ) : (
      <Minus size={14} className="text-text-muted" />
    );

  return (
    <div className="w-full animate-in fade-in slide-in-from-bottom-2 duration-500">
      <GlowPanel className="relative">
        {/* Dismiss */}
        <button
          onClick={handleDismiss}
          className="absolute top-4 right-4 rounded-full p-1 text-text-dim hover:text-text-muted transition-colors z-10"
          aria-label="Dismiss weekly wrap"
        >
          <X size={14} />
        </button>

        {/* Header */}
        <div className="flex items-center gap-2 mb-4">
          <Calendar size={14} className="text-positive" />
          <span className="font-mono text-[11px] font-bold uppercase tracking-[0.12em] text-positive">
            Weekly Wrap
          </span>
          <span className="font-mono text-[10px] text-text-dim">
            {formatDateRange(data.period.start, data.period.end)}
          </span>
        </div>

        {/* Stat pills */}
        <div className="flex flex-wrap gap-2 mb-5">
          <StatPill
            icon={<Target size={12} />}
            label="Intentions"
            value={`${data.intentions.days_set}/7 days`}
            accent={data.intentions.days_set >= 5 ? 'positive' : 'muted'}
          />
          <StatPill
            icon={<Pause size={12} />}
            label="Resets"
            value={`${data.cooldowns.total}`}
            accent="muted"
          />
          <StatPill
            icon={deltaIcon}
            label="BSS"
            value={
              data.bss.delta != null
                ? `${data.bss.delta > 0 ? '+' : ''}${data.bss.delta}`
                : '—'
            }
            accent={
              data.bss.delta != null && data.bss.delta > 0
                ? 'positive'
                : data.bss.delta != null && data.bss.delta < 0
                  ? 'negative'
                  : 'muted'
            }
          />
        </div>

        {/* Senti narrative — first paragraph always visible */}
        <div className="space-y-3">
          {data.narrative.split('\n\n').map((paragraph, i) => {
            if (!expanded && i > 0) return null;
            return (
              <p
                key={i}
                className="font-mono text-[12px] leading-relaxed text-text-secondary"
              >
                {paragraph}
              </p>
            );
          })}
        </div>

        {/* Expand toggle */}
        {data.narrative.split('\n\n').length > 1 && (
          <button
            onClick={() => setExpanded(!expanded)}
            className="mt-3 flex items-center gap-1 font-mono text-[11px] text-text-dim hover:text-text-muted transition-colors"
          >
            {expanded ? (
              <>
                <ChevronUp size={12} /> Less
              </>
            ) : (
              <>
                <ChevronDown size={12} /> Read full wrap
              </>
            )}
          </button>
        )}

        {/* Intention list — shown when expanded */}
        {expanded && data.intentions.entries.length > 0 && (
          <div className="mt-4 pt-4 border-t border-white/[0.1]">
            <span className="font-mono text-[10px] font-bold uppercase tracking-[0.12em] text-text-dim mb-2 block">
              This week&apos;s intentions
            </span>
            <div className="space-y-1.5">
              {data.intentions.entries.map((entry, i) => (
                <div key={i} className="flex items-start gap-2">
                  <span className="font-mono text-[10px] text-text-dim mt-0.5 shrink-0">
                    {formatShortDate(entry.session_date)}
                  </span>
                  <span className="font-mono text-[11px] text-text-secondary">
                    {entry.goal_text}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Theme tags */}
        {expanded &&
          data.intentions.top_themes.length > 0 &&
          data.intentions.top_themes[0].count >= 2 && (
            <div className="mt-3 flex flex-wrap gap-1.5">
              {data.intentions.top_themes.map((theme) => (
                <span
                  key={theme.word}
                  className="rounded-full bg-positive/10 border border-positive/20 px-2.5 py-0.5 font-mono text-[10px] text-positive"
                >
                  {theme.word} ×{theme.count}
                </span>
              ))}
            </div>
          )}
      </GlowPanel>
    </div>
  );
}

/* ── Helpers ── */

function StatPill({
  icon,
  label,
  value,
  accent,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  accent: 'positive' | 'negative' | 'muted';
}) {
  const colors = {
    positive: 'text-positive bg-positive/10 border-positive/20',
    negative: 'text-negative bg-negative/10 border-negative/20',
    muted: 'text-text-muted bg-white/[0.04] border-white/[0.08]',
  };

  return (
    <div
      className={`flex items-center gap-1.5 rounded-full border px-3 py-1 ${colors[accent]}`}
    >
      {icon}
      <span className="font-mono text-[10px] font-bold uppercase tracking-[0.08em]">
        {label}
      </span>
      <span className="font-mono text-[11px] font-medium">{value}</span>
    </div>
  );
}

function getWeekKey(): string {
  const now = new Date();
  const startOfYear = new Date(now.getFullYear(), 0, 1);
  const weekNum = Math.ceil(
    ((now.getTime() - startOfYear.getTime()) / 86400000 + startOfYear.getDay() + 1) / 7,
  );
  return `${now.getFullYear()}-W${weekNum}`;
}

function formatDateRange(start: string, end: string): string {
  const s = new Date(start + 'T00:00:00');
  const e = new Date(end + 'T00:00:00');
  const opts: Intl.DateTimeFormatOptions = { month: 'short', day: 'numeric' };
  return `${s.toLocaleDateString('en-US', opts)} – ${e.toLocaleDateString('en-US', opts)}`;
}

function formatShortDate(dateStr: string): string {
  const d = new Date(dateStr + 'T00:00:00');
  return d.toLocaleDateString('en-US', { weekday: 'short' }).toUpperCase();
}
