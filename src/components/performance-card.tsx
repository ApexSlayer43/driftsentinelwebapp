'use client';

import { GlowPanel } from '@/components/ui/glow-panel';
import { TrendingUp, TrendingDown, Minus } from 'lucide-react';

interface PerformanceSummary {
  grossPnl: number;
  netPnl: number;
  totalCommission: number;
  tradeCount: number;
  winCount: number;
  winRate: number;
  expectancy: number;
  totalContracts: number;
  maxRunUp: number;
  maxDrawdown: number;
}

interface SessionStats {
  total: number;
  totalFills: number;
  totalViolations: number;
  cleanSessions: number;
  cleanRate: number;
  avgDsi: number | null;
}

interface PerformanceCardProps {
  summary: PerformanceSummary;
  sessions: SessionStats;
  dateRange: { start: string; end: string } | null;
  title?: string;
}

function formatMoney(val: number): string {
  const prefix = val >= 0 ? '$' : '$';
  return `${prefix}${Math.abs(val).toFixed(2)}`;
}

export function PerformanceCard({ summary, sessions, dateRange, title = 'Lifetime Performance' }: PerformanceCardProps) {
  const pnlPositive = summary.netPnl >= 0;

  return (
    <GlowPanel className="p-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-1">
        <h3 className="font-mono text-[11px] font-semibold uppercase tracking-[0.2em] text-white/40">
          {title}
        </h3>
        {pnlPositive ? (
          <TrendingUp size={14} className="text-white/50" />
        ) : (
          <TrendingDown size={14} className="text-white/30" />
        )}
      </div>

      {dateRange && (
        <p className="font-mono text-[10px] text-white/25 mb-4">
          {dateRange.start} → {dateRange.end}
        </p>
      )}

      {/* Primary P&L stats — large treatment */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-4">
        <PerfStat
          label="Gross P/L"
          value={formatMoney(summary.grossPnl)}
          emphasis={summary.grossPnl >= 0}
        />
        <PerfStat
          label="Net P/L"
          value={formatMoney(summary.netPnl)}
          emphasis={summary.netPnl >= 0}
        />
        <PerfStat
          label="Win Rate"
          value={`${summary.winRate}%`}
          emphasis={summary.winRate >= 50}
        />
        <PerfStat
          label="Expectancy"
          value={formatMoney(summary.expectancy)}
          emphasis={summary.expectancy >= 0}
        />
      </div>

      {/* Secondary stats row */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-4">
        <PerfStat label="Trades" value={String(summary.tradeCount)} />
        <PerfStat label="Contracts" value={String(summary.totalContracts)} />
        <PerfStat
          label="Max Run-up"
          value={formatMoney(summary.maxRunUp)}
          emphasis
        />
        <PerfStat
          label="Max Drawdown"
          value={formatMoney(summary.maxDrawdown)}
          emphasis={false}
        />
      </div>

      {/* Session stats */}
      <div className="border-t border-white/[0.04] pt-4">
        <h4 className="font-mono text-[9px] font-semibold uppercase tracking-[0.2em] text-white/30 mb-3">
          Session Overview
        </h4>
        <div className="grid grid-cols-3 sm:grid-cols-6 gap-3">
          <PerfStat label="Sessions" value={String(sessions.total)} small />
          <PerfStat label="Total Fills" value={String(sessions.totalFills)} small />
          <PerfStat label="Violations" value={String(sessions.totalViolations)} small />
          <PerfStat label="Clean Sessions" value={String(sessions.cleanSessions)} small />
          <PerfStat
            label="Clean Rate"
            value={`${sessions.cleanRate}%`}
            emphasis={sessions.cleanRate >= 70}
            small
          />
          <PerfStat
            label="Avg DSI"
            value={sessions.avgDsi !== null ? String(sessions.avgDsi) : '—'}
            small
          />
        </div>
      </div>
    </GlowPanel>
  );
}

/* ── Stat cell ── */
function PerfStat({
  label,
  value,
  emphasis,
  small = false,
}: {
  label: string;
  value: string;
  emphasis?: boolean;
  small?: boolean;
}) {
  // emphasis = true → full white, false → dimmed silver, undefined → neutral white
  const valueColor =
    emphasis === true ? 'text-white' :
    emphasis === false ? 'text-white/50' :
    'text-white/80';

  return (
    <div className="rounded-lg border border-white/[0.04] bg-white/[0.02] px-3 py-2">
      <div className="font-mono text-[7px] uppercase tracking-[0.15em] text-white/30">
        {label}
      </div>
      <div className={`font-mono ${small ? 'text-sm' : 'text-[15px]'} font-bold mt-0.5 ${valueColor}`} style={{ fontVariantNumeric: 'tabular-nums' }}>
        {value}
      </div>
    </div>
  );
}
