'use client';

import { X, FileText, TrendingUp, TrendingDown, AlertTriangle, Calendar, BarChart3 } from 'lucide-react';
import { useIntelligencePanel, type PanelDayBreakdown, type PanelBehavioralFlag } from '@/lib/intelligence-panel-context';

/* ── Severity colors ── */
const SEVERITY_STYLES: Record<string, string> = {
  low: 'text-text-dim border-[rgba(200,169,110,0.1)]',
  medium: 'text-warning border-warning/20',
  high: 'text-negative border-negative/20',
};

const FLAG_LABELS: Record<string, string> = {
  revenge: 'Revenge Pattern',
  oversize: 'Oversized Position',
  off_session: 'Off-Session Trade',
  frequency: 'Overtrading',
  size_escalation: 'Size Escalation',
};

function DayRow({ day }: { day: PanelDayBreakdown }) {
  const pnlColor = day.pnl > 0 ? 'text-positive' : day.pnl < 0 ? 'text-negative' : 'text-text-dim';
  return (
    <div className="flex items-center justify-between py-1.5 border-b border-[rgba(200,169,110,0.04)] last:border-0">
      <span className="font-mono text-[10px] text-text-muted">{day.date}</span>
      <div className="flex items-center gap-3">
        <span className="font-mono text-[10px] text-text-dim">{day.trades}t</span>
        <span className="font-mono text-[10px] text-text-dim">{day.wins}W/{day.losses}L</span>
        <span className={`font-mono text-[10px] font-semibold ${pnlColor}`}>
          {day.pnl >= 0 ? '+' : ''}${day.pnl.toFixed(2)}
        </span>
      </div>
    </div>
  );
}

function FlagBadge({ flag }: { flag: PanelBehavioralFlag }) {
  return (
    <div className={`rounded-lg border px-3 py-2 ${SEVERITY_STYLES[flag.severity]} bg-[rgba(200,169,110,0.02)]`}>
      <div className="flex items-center gap-1.5 mb-0.5">
        <AlertTriangle size={10} />
        <span className="font-mono text-[9px] font-bold uppercase tracking-[0.1em]">
          {FLAG_LABELS[flag.type] ?? flag.type}
        </span>
      </div>
      <p className="font-sans text-[11px] text-text-muted leading-snug">{flag.description}</p>
    </div>
  );
}

export function IntelligencePanel() {
  const { isOpen, data, closePanel } = useIntelligencePanel();

  if (!isOpen || !data) return null;

  const s = data.summary;
  const pnlColor = s.totalPnl >= 0 ? 'text-positive' : 'text-negative';

  return (
    <div className="w-96 shrink-0 flex flex-col h-full border-l border-[rgba(200,169,110,0.08)] bg-[rgba(200,169,110,0.01)] animate-in slide-in-from-right duration-300">
      {/* ── Header ── */}
      <div className="flex items-center gap-2 px-4 py-3 border-b border-[rgba(200,169,110,0.06)]">
        <FileText size={12} className="text-[#c8a96e]" />
        <span className="font-mono text-[10px] font-bold uppercase tracking-[0.15em] text-[#c8a96e] truncate flex-1">
          {data.source === 'recall' ? 'Recalled' : 'Upload'} — {data.fileName}
        </span>
        <button
          onClick={closePanel}
          className="rounded-md p-1 text-text-dim hover:text-text-muted transition-colors"
        >
          <X size={12} />
        </button>
      </div>

      {/* ── Scrollable Content ── */}
      <div className="flex-1 overflow-auto px-4 py-4 space-y-5" style={{ scrollbarWidth: 'thin' }}>

        {/* ── Summary Stats Grid ── */}
        <div>
          <div className="flex items-center gap-1.5 mb-2">
            <BarChart3 size={10} className="text-[rgba(200,169,110,0.5)]" />
            <span className="font-mono text-[8px] font-bold uppercase tracking-[0.2em] text-text-dim">Summary</span>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <StatCard label="Net P/L" value={`$${s.totalPnl.toFixed(2)}`} color={pnlColor} />
            <StatCard label="Trades" value={String(s.tradeCount)} />
            <StatCard label="Win Rate" value={`${s.winRate}%`} color={s.winRate >= 50 ? 'text-positive' : 'text-negative'} />
            <StatCard label="Expectancy" value={`$${s.expectancy.toFixed(2)}`} color={s.expectancy >= 0 ? 'text-positive' : 'text-negative'} />
            <StatCard label="Avg Win" value={`$${s.avgWin.toFixed(2)}`} color="text-positive" />
            <StatCard label="Avg Loss" value={`$${Math.abs(s.avgLoss).toFixed(2)}`} color="text-negative" />
            <StatCard label="Max Drawdown" value={`$${Math.abs(s.maxDrawdown).toFixed(2)}`} color="text-negative" />
            <StatCard label="Fees" value={`$${Math.abs(s.fees).toFixed(2)}`} />
          </div>
        </div>

        {/* ── Date Range ── */}
        {data.dateRange && (
          <div className="flex items-center gap-2 font-mono text-[9px] text-text-dim">
            <Calendar size={10} className="text-[rgba(200,169,110,0.4)]" />
            {data.dateRange.start} → {data.dateRange.end}
          </div>
        )}

        {/* ── Key Trades ── */}
        {(data.keyTrades.biggestWin || data.keyTrades.biggestLoss) && (
          <div>
            <div className="flex items-center gap-1.5 mb-2">
              <TrendingUp size={10} className="text-[rgba(200,169,110,0.5)]" />
              <span className="font-mono text-[8px] font-bold uppercase tracking-[0.2em] text-text-dim">Key Trades</span>
            </div>
            <div className="space-y-1.5">
              {data.keyTrades.biggestWin && (
                <TradeRow label="Best" trade={data.keyTrades.biggestWin} />
              )}
              {data.keyTrades.biggestLoss && (
                <TradeRow label="Worst" trade={data.keyTrades.biggestLoss} />
              )}
            </div>
            {data.keyTrades.oversized.length > 0 && (
              <div className="mt-2">
                <span className="font-mono text-[8px] text-warning uppercase tracking-[0.1em]">
                  {data.keyTrades.oversized.length} oversized trade{data.keyTrades.oversized.length > 1 ? 's' : ''}
                </span>
              </div>
            )}
          </div>
        )}

        {/* ── Per-Day Breakdown ── */}
        {data.dayBreakdown.length > 0 && (
          <div>
            <div className="flex items-center gap-1.5 mb-2">
              <Calendar size={10} className="text-[rgba(200,169,110,0.5)]" />
              <span className="font-mono text-[8px] font-bold uppercase tracking-[0.2em] text-text-dim">Daily Breakdown</span>
            </div>
            <div className="rounded-lg border border-[rgba(200,169,110,0.06)] bg-[rgba(200,169,110,0.02)] px-3 py-1.5">
              {data.dayBreakdown.map((day) => (
                <DayRow key={day.date} day={day} />
              ))}
            </div>
          </div>
        )}

        {/* ── Behavioral Flags ── */}
        {data.behavioralFlags.length > 0 && (
          <div>
            <div className="flex items-center gap-1.5 mb-2">
              <AlertTriangle size={10} className="text-[rgba(200,169,110,0.5)]" />
              <span className="font-mono text-[8px] font-bold uppercase tracking-[0.2em] text-text-dim">
                Behavioral Flags ({data.behavioralFlags.length})
              </span>
            </div>
            <div className="space-y-2">
              {data.behavioralFlags.map((flag, i) => (
                <FlagBadge key={i} flag={flag} />
              ))}
            </div>
          </div>
        )}

        {/* ── No Flags — Clean ── */}
        {data.behavioralFlags.length === 0 && (
          <div className="rounded-lg border border-[rgba(200,169,110,0.06)] bg-[rgba(200,169,110,0.02)] px-3 py-3 text-center">
            <span className="font-mono text-[10px] text-positive">No behavioral flags detected</span>
          </div>
        )}
      </div>
    </div>
  );
}

/* ── Sub-components ── */

function StatCard({ label, value, color = 'text-[#ede9e1]' }: { label: string; value: string; color?: string }) {
  return (
    <div className="rounded-lg border border-[rgba(200,169,110,0.06)] bg-[rgba(200,169,110,0.02)] px-3 py-2">
      <div className="font-mono text-[8px] uppercase tracking-[0.15em] text-text-dim mb-0.5">{label}</div>
      <div className={`font-mono text-[13px] font-semibold ${color}`}>{value}</div>
    </div>
  );
}

function TradeRow({ label, trade }: { label: string; trade: { symbol: string; qty: number; buyTime: string; pnl: number } }) {
  const pnlColor = trade.pnl >= 0 ? 'text-positive' : 'text-negative';
  return (
    <div className="flex items-center justify-between rounded-lg border border-[rgba(200,169,110,0.06)] bg-[rgba(200,169,110,0.02)] px-3 py-1.5">
      <div className="flex items-center gap-2">
        {trade.pnl >= 0 ? (
          <TrendingUp size={10} className="text-positive" />
        ) : (
          <TrendingDown size={10} className="text-negative" />
        )}
        <span className="font-mono text-[10px] text-text-muted">{label}</span>
        <span className="font-mono text-[10px] text-text-dim">{trade.symbol} {trade.qty}x</span>
      </div>
      <span className={`font-mono text-[11px] font-semibold ${pnlColor}`}>
        ${trade.pnl.toFixed(2)}
      </span>
    </div>
  );
}
