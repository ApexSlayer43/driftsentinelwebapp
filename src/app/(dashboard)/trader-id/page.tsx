'use client';

import { useState, useEffect } from 'react';
import { UserCircle, Share2, TrendingUp, TrendingDown } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import { getTierStyle } from '@/lib/tokens';
import type { StatePayload } from '@/lib/types';

/**
 * DS Trader ID — read-only behavioral profile page.
 * Shows: BSS score, tier, streak, 90-day trajectory, shareable URL stub.
 * Spec: "The DS Trader ID is the trader's behavioral resume."
 */
export default function TraderIdPage() {
  const [data, setData] = useState<StatePayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [sparkline, setSparkline] = useState<number[]>([]);

  useEffect(() => {
    async function load() {
      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { setLoading(false); return; }

      const { data: accounts } = await supabase
        .from('accounts')
        .select('account_ref')
        .eq('user_id', user.id)
        .limit(1);

      if (!accounts || accounts.length === 0) { setLoading(false); return; }
      const ref = accounts[0].account_ref;

      // Fetch current state
      try {
        const res = await fetch(`/api/state?account_ref=${ref}`);
        if (res.ok) {
          const payload = await res.json();
          setData(payload);
          setSparkline(payload.bss_sparkline || []);
        }
      } catch {
        // Silent
      }

      // Fetch 90-day trajectory from daily_scores
      const since = new Date();
      since.setDate(since.getDate() - 90);
      const { data: scores } = await supabase
        .from('daily_scores')
        .select('bss_score')
        .eq('account_ref', ref)
        .gte('trading_date', since.toISOString().slice(0, 10))
        .order('trading_date', { ascending: true });

      if (scores && scores.length > 0) {
        setSparkline(scores.map(s => s.bss_score));
      }

      setLoading(false);
    }

    load();
  }, []);

  if (loading) {
    return (
      <div className="flex h-full items-center justify-center">
        <div className="h-5 w-5 animate-spin rounded-full border-2 border-accent-primary border-t-transparent" />
      </div>
    );
  }

  if (!data) {
    return (
      <div className="flex h-full items-center justify-center">
        <div className="text-center">
          <UserCircle size={48} className="mx-auto text-text-dim" />
          <p className="mt-4 font-mono text-[14px] text-text-muted">
            No trading data yet. Upload your first session to create your DS Trader ID.
          </p>
        </div>
      </div>
    );
  }

  const tierStyle = getTierStyle(data.bss_tier);
  const delta = data.bss_delta;
  const DeltaIcon = delta >= 0 ? TrendingUp : TrendingDown;

  // Mini sparkline SVG
  const sparkW = 200;
  const sparkH = 40;
  const sparkPoints = sparkline.length > 1
    ? sparkline.map((v, i) => {
        const x = (i / (sparkline.length - 1)) * sparkW;
        const y = sparkH - ((v / 100) * sparkH);
        return `${x},${y}`;
      }).join(' ')
    : '';

  return (
    <div className="mx-auto max-w-lg px-6 py-10">
      {/* Header */}
      <div className="flex items-center gap-3">
        <UserCircle size={28} className="text-accent-primary" />
        <h1 className="font-display text-[24px] font-bold text-text-primary">
          DS Trader ID
        </h1>
      </div>
      <p className="mt-1 font-mono text-[12px] text-text-muted">
        Your behavioral stability profile
      </p>

      {/* Main card */}
      <div className="mt-8 glass-card rounded-2xl p-6 space-y-6">
        {/* BSS Score + Tier */}
        <div className="flex items-center justify-between">
          <div>
            <div className="font-mono text-[12px] uppercase tracking-[0.12em] text-text-muted">
              BSS Score
            </div>
            <div
              className="font-mono text-[48px] font-bold leading-none mt-1"
              style={{ color: tierStyle.color }}
            >
              {data.bss_score}
            </div>
          </div>
          <div className="text-right">
            <div
              className="inline-block rounded-full px-3 py-1.5 font-mono text-[14px] font-medium"
              style={{
                color: tierStyle.color,
                backgroundColor: `${tierStyle.color}15`,
              }}
            >
              {data.bss_tier}
            </div>
            <div className={`mt-2 flex items-center justify-end gap-1 font-mono text-[12px] font-medium ${
              delta >= 0 ? 'text-positive' : 'text-negative'
            }`}>
              <DeltaIcon size={12} />
              <span>{delta >= 0 ? '+' : ''}{delta}</span>
            </div>
          </div>
        </div>

        {/* Divider */}
        <div className="h-px bg-border-subtle" />

        {/* Stats row */}
        <div className="grid grid-cols-3 gap-4">
          <div>
            <div className="font-mono text-[12px] text-text-muted">Streak</div>
            <div className="font-mono text-[20px] font-bold text-text-primary mt-0.5">
              {data.bss_streak}d
            </div>
          </div>
          <div>
            <div className="font-mono text-[12px] text-text-muted">Yesterday</div>
            <div className="font-mono text-[20px] font-bold text-text-primary mt-0.5">
              {data.bss_yesterday}
            </div>
          </div>
          <div>
            <div className="font-mono text-[12px] text-text-muted">Alpha</div>
            <div className="font-mono text-[20px] font-bold text-text-primary mt-0.5">
              {data.bss_alpha.toFixed(2)}
            </div>
          </div>
        </div>

        {/* 90-day trajectory sparkline */}
        {sparkline.length > 1 && (
          <>
            <div className="h-px bg-border-subtle" />
            <div>
              <div className="font-mono text-[12px] text-text-muted mb-2">
                {sparkline.length}-Day Trajectory
              </div>
              <svg width={sparkW} height={sparkH} className="w-full" viewBox={`0 0 ${sparkW} ${sparkH}`} preserveAspectRatio="none">
                <polyline
                  points={sparkPoints}
                  fill="none"
                  stroke="#00D4AA"
                  strokeWidth="2"
                  strokeLinejoin="round"
                  strokeLinecap="round"
                />
                <polyline
                  points={`0,${sparkH} ${sparkPoints} ${sparkW},${sparkH}`}
                  fill="rgba(0,212,170,0.10)"
                  stroke="none"
                />
              </svg>
            </div>
          </>
        )}
      </div>

      {/* Shareable URL stub */}
      <div className="mt-6 glass-inset rounded-xl p-4 flex items-center gap-3">
        <Share2 size={14} className="text-text-muted shrink-0" />
        <div className="flex-1">
          <div className="font-mono text-[12px] text-text-muted">Shareable Profile URL</div>
          <div className="font-mono text-[12px] text-text-dim mt-0.5">
            Coming soon — share your behavioral stability profile
          </div>
        </div>
      </div>
    </div>
  );
}
