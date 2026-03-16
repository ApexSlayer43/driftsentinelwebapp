'use client';

import { useState, useEffect } from 'react';
import { createClient } from '@/lib/supabase/client';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from 'recharts';
import type { DailyScore } from '@/lib/types';

interface EvidenceTrendsProps {
  accountRef?: string;
}

interface TrendPoint {
  date: string;
  bss: number;
  dsi: number;
}

/**
 * Trends tab — 7-day BSS + DSI dual-line chart.
 * BSS in brand teal (#6366F1), DSI in soft purple (#A78BFA).
 * Dark theme matching the existing design system.
 */
export function EvidenceTrends({ accountRef }: EvidenceTrendsProps) {
  const [data, setData] = useState<TrendPoint[]>([]);
  const [loading, setLoading] = useState(true);

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

      const since = new Date();
      since.setDate(since.getDate() - 7);

      const { data: scores, error } = await supabase
        .from('daily_scores')
        .select('trading_date, bss_score, dsi_score')
        .eq('account_ref', ref)
        .gte('trading_date', since.toISOString().slice(0, 10))
        .order('trading_date', { ascending: true });

      if (!error && scores) {
        setData(
          (scores as Pick<DailyScore, 'trading_date' | 'bss_score' | 'dsi_score'>[]).map((s) => ({
            date: s.trading_date.slice(5), // "03-13" format
            bss: s.bss_score,
            dsi: s.dsi_score,
          }))
        );
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

  if (data.length === 0) {
    return (
      <div className="py-8 text-center">
        <p className="font-mono text-xs text-text-muted">No trend data available</p>
      </div>
    );
  }

  return (
    <div>
      {/* Legend */}
      <div className="mb-4 flex items-center gap-4 font-mono text-[12px]">
        <div className="flex items-center gap-1.5">
          <div className="h-2 w-2 rounded-full bg-positive" />
          <span className="text-text-muted">BSS</span>
        </div>
        <div className="flex items-center gap-1.5">
          <div className="h-2 w-2 rounded-full" style={{ backgroundColor: '#A78BFA' }} />
          <span className="text-text-muted">DSI</span>
        </div>
      </div>

      <ResponsiveContainer width="100%" height={200}>
        <LineChart data={data} margin={{ top: 5, right: 10, left: -20, bottom: 5 }}>
          <CartesianGrid
            strokeDasharray="3 3"
            stroke="rgba(255,255,255,0.04)"
            vertical={false}
          />
          <XAxis
            dataKey="date"
            tick={{ fill: '#4A5568', fontSize: 10, fontFamily: 'var(--font-mono)' }}
            axisLine={{ stroke: 'rgba(255,255,255,0.04)' }}
            tickLine={false}
          />
          <YAxis
            tick={{ fill: '#4A5568', fontSize: 10, fontFamily: 'var(--font-mono)' }}
            domain={[0, 100]}
            axisLine={false}
            tickLine={false}
          />
          <Tooltip
            contentStyle={{
              backgroundColor: '#1A1D27',
              border: '1px solid rgba(255,255,255,0.08)',
              borderRadius: '8px',
              fontFamily: 'var(--font-mono)',
              fontSize: '10px',
            }}
            labelStyle={{ color: '#E2E8F0' }}
            itemStyle={{ color: '#94A3B8' }}
          />
          <Line
            type="monotone"
            dataKey="bss"
            stroke="#6366F1"
            strokeWidth={2}
            dot={{ fill: '#6366F1', r: 3, strokeWidth: 0 }}
            activeDot={{ r: 5, stroke: '#6366F1', strokeWidth: 2, fill: '#1A1D27' }}
            name="BSS"
          />
          <Line
            type="monotone"
            dataKey="dsi"
            stroke="#A78BFA"
            strokeWidth={2}
            dot={{ fill: '#A78BFA', r: 3, strokeWidth: 0 }}
            activeDot={{ r: 5, stroke: '#A78BFA', strokeWidth: 2, fill: '#1A1D27' }}
            name="DSI"
          />
        </LineChart>
      </ResponsiveContainer>

      {/* Summary stats */}
      <div className="mt-4 grid grid-cols-3 gap-3">
        <TrendStat
          label="BSS Range"
          value={`${Math.min(...data.map(d => d.bss))} – ${Math.max(...data.map(d => d.bss))}`}
        />
        <TrendStat
          label="Avg BSS"
          value={String(Math.round(data.reduce((s, d) => s + d.bss, 0) / data.length))}
        />
        <TrendStat
          label="Avg DSI"
          value={String(Math.round(data.reduce((s, d) => s + d.dsi, 0) / data.length))}
        />
      </div>
    </div>
  );
}

function TrendStat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg glass-raised p-2.5 text-center">
      <div className="font-mono text-[12px] font-semibold uppercase tracking-[0.15em] text-text-muted">
        {label}
      </div>
      <div className="mt-1 font-mono text-sm font-bold text-text-primary">
        {value}
      </div>
    </div>
  );
}
