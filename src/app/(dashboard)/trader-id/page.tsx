'use client';

import { useState, useEffect, useId } from 'react';
import { UserCircle, Copy, Check, Shield, Flame, TrendingUp, TrendingDown } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import { getTierStyle } from '@/lib/tokens';
import type { StatePayload } from '@/lib/types';
import { GlowPanel } from '@/components/ui/glow-panel';
import { PerformanceCard } from '@/components/performance-card';

interface PerfData {
  summary: {
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
  };
  sessions: {
    total: number;
    totalFills: number;
    totalViolations: number;
    cleanSessions: number;
    cleanRate: number;
    avgDsi: number | null;
  };
  dateRange: { start: string; end: string } | null;
}

export default function TraderIdPage() {
  const sparkGradId = useId().replace(/:/g, '');
  const [data, setData] = useState<StatePayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [sparkline, setSparkline] = useState<number[]>([]);
  const [copied, setCopied] = useState(false);
  const [userName, setUserName] = useState('Trader');
  const [perfData, setPerfData] = useState<PerfData | null>(null);

  useEffect(() => {
    async function load() {
      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { setLoading(false); return; }

      const meta = user.user_metadata;
      if (meta?.full_name) {
        setUserName(meta.full_name);
      } else if (user.email) {
        setUserName(user.email.split('@')[0]);
      }

      const { data: accounts } = await supabase
        .from('accounts')
        .select('account_ref')
        .eq('user_id', user.id)
        .limit(1);

      if (!accounts || accounts.length === 0) { setLoading(false); return; }
      const ref = accounts[0].account_ref;

      // Fetch state, sparkline, and performance in parallel
      const [stateRes, scoresRes, perfRes] = await Promise.all([
        fetch(`/api/state?account_ref=${ref}`).then(r => r.ok ? r.json() : null).catch(() => null),
        supabase
          .from('daily_scores')
          .select('bss_score')
          .eq('account_ref', ref)
          .gte('trading_date', new Date(Date.now() - 90 * 86400000).toISOString().slice(0, 10))
          .order('trading_date', { ascending: true }),
        fetch(`/api/performance?account_ref=${ref}`).then(r => r.ok ? r.json() : null).catch(() => null),
      ]);

      if (stateRes) {
        setData(stateRes);
        setSparkline(stateRes.bss_sparkline || []);
      }

      if (scoresRes.data && scoresRes.data.length > 0) {
        setSparkline(scoresRes.data.map((s: { bss_score: number }) => s.bss_score));
      }

      if (perfRes) {
        setPerfData(perfRes);
      }

      setLoading(false);
    }

    load();
  }, []);

  if (loading) {
    return (
      <div className="flex h-full items-center justify-center">
        <div className="h-5 w-5 animate-pulse rounded-full bg-[rgba(200,169,110,0.06)]" />
      </div>
    );
  }

  if (!data) {
    return (
      <div className="flex h-full items-center justify-center">
        <div className="text-center">
          <UserCircle size={48} className="mx-auto text-text-dim" />
          <p className="mt-4 font-sans text-[14px] text-text-muted">
            No trading data yet. Upload your first session to create your DS Trader ID.
          </p>
        </div>
      </div>
    );
  }

  const tierStyle = getTierStyle(data.bss_tier);
  const delta = data.bss_delta;
  const profileId = `ds://${userName.toLowerCase().replace(/\s+/g, '-')}-${data.account_ref.slice(0, 4)}`;
  const shareUrl = `driftsentinel.com/id/${userName.toLowerCase().replace(/\s+/g, '-')}-${data.account_ref.slice(0, 4)}`;

  const sparkW = 460;
  const sparkH = 80;
  const sparkPoints = sparkline.length > 1
    ? sparkline.map((v, i) => {
        const x = (i / (sparkline.length - 1)) * sparkW;
        const y = sparkH - ((v / 100) * sparkH);
        return `${x},${y}`;
      }).join(' ')
    : '';
  const sparkPolygon = sparkPoints ? `0,${sparkH} ${sparkPoints} ${sparkW},${sparkH}` : '';

  const TIERS = [
    { name: 'Dormant', key: 'DORMANT' },
    { name: 'Forming', key: 'FORMING' },
    { name: 'Developing', key: 'DEVELOPING' },
    { name: 'Consistent', key: 'CONSISTENT' },
    { name: 'Disciplined', key: 'DISCIPLINED' },
    { name: 'Sovereign', key: 'SOVEREIGN' },
  ];
  const currentTierIndex = TIERS.findIndex(t => t.key === data.bss_tier);

  // Gold opacity scale for tier progression
  const tierOpacities = [0.15, 0.25, 0.4, 0.55, 0.75, 1.0];

  function handleCopy() {
    navigator.clipboard.writeText(shareUrl).catch(() => {});
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <div className="overflow-y-auto py-10 px-6">
      <div className="max-w-[960px] mx-auto">
        {/* Page Header */}
        <div className="text-center mb-10">
          <div className="font-mono text-[10px] uppercase tracking-[0.25em] text-[#c8a96e] mb-2">DS Trader ID</div>
          <h1 className="font-display text-[24px] font-light text-[#ede9e1]">Behavioral Profile</h1>
        </div>

        {/* Top row: Profile Hero + Stats 2×2 */}
        <div className="grid grid-cols-1 lg:grid-cols-[1fr_1fr] gap-5 mb-5">
          {/* PROFILE HERO */}
          <GlowPanel className="p-10 text-center relative overflow-hidden" data-onboard="trader-id-hero">
            {/* Subtle gold radial behind avatar */}
            <div className="absolute inset-0 pointer-events-none" style={{ background: 'radial-gradient(circle at 50% 30%, rgba(200,169,110,0.06) 0%, transparent 60%)' }} />
            <div className="relative z-10">
              {/* Avatar */}
              <div
                className="w-[72px] h-[72px] rounded-full mx-auto mb-4 flex items-center justify-center"
                style={{
                  background: 'linear-gradient(135deg, rgba(200,169,110,0.1), rgba(200,169,110,0.04))',
                  border: '2px solid rgba(200,169,110,0.2)',
                  boxShadow: '0 0 30px rgba(200,169,110,0.08)',
                }}
              >
                <UserCircle size={32} className="text-[rgba(200,169,110,0.5)]" />
              </div>

              {/* Name */}
              <div className="font-display text-[20px] font-light text-[#ede9e1] mb-1">{userName}</div>
              <div className="font-mono text-[11px] text-[#4a473f] mb-6">{profileId}</div>

              {/* BSS Score — large editorial treatment */}
              <div className="font-display text-[56px] font-light leading-none mb-1 text-[#ede9e1]" style={{ fontVariantNumeric: 'tabular-nums' }}>
                {data.bss_score}
              </div>
              <div className="font-mono text-[9px] uppercase tracking-[0.2em] text-[#7a766d] mb-5">Behavioral Stability Score</div>

              {/* Tier badge */}
              <div
                className="inline-flex items-center gap-2 px-5 py-2 rounded-full font-mono text-[12px] font-semibold tracking-[0.15em] uppercase"
                style={{
                  color: tierStyle.color,
                  backgroundColor: `${tierStyle.color}15`,
                  border: `1px solid ${tierStyle.color}25`,
                }}
              >
                <div className="w-2 h-2 rounded-full" style={{ backgroundColor: tierStyle.color }} />
                {data.bss_tier}
              </div>
            </div>
          </GlowPanel>

          {/* STATS 2×2 */}
          <div className="grid grid-cols-2 gap-3">
            <GlowPanel className="p-5">
              <div className="flex items-center gap-1.5 mb-2">
                {delta >= 0
                  ? <TrendingUp size={11} className="text-[#22D3EE]" />
                  : <TrendingDown size={11} className="text-[#FB923C]" />
                }
                <span className="font-mono text-[9px] uppercase tracking-[0.15em] text-[#7a766d]">Delta</span>
              </div>
              <div className={`font-display text-[28px] font-light ${delta >= 0 ? 'text-[#ede9e1]' : 'text-[#bdb8ae]'}`} style={{ fontVariantNumeric: 'tabular-nums' }}>
                {delta >= 0 ? '+' : ''}{delta}
              </div>
              <div className="font-sans text-[11px] text-[#4a473f] mt-1">from yesterday</div>
            </GlowPanel>

            <GlowPanel className="p-5">
              <div className="flex items-center gap-1.5 mb-2">
                <Flame size={11} className="text-[rgba(200,169,110,0.5)]" />
                <span className="font-mono text-[9px] uppercase tracking-[0.15em] text-[#7a766d]">Streak</span>
              </div>
              <div className="font-display text-[28px] font-light text-[#ede9e1]" style={{ fontVariantNumeric: 'tabular-nums' }}>
                {data.bss_streak} <span className="text-[16px] text-[#7a766d]">{data.bss_streak === 1 ? 'day' : 'days'}</span>
              </div>
              <div className="font-sans text-[11px] text-[#4a473f] mt-1">consecutive sessions</div>
            </GlowPanel>

            <GlowPanel className="p-5">
              <div className="flex items-center gap-1.5 mb-2">
                <Shield size={11} className="text-[rgba(200,169,110,0.5)]" />
                <span className="font-mono text-[9px] uppercase tracking-[0.15em] text-[#7a766d]">Yesterday</span>
              </div>
              <div className="font-display text-[28px] font-light text-[#bdb8ae]" style={{ fontVariantNumeric: 'tabular-nums' }}>
                {data.bss_yesterday}
              </div>
              <div className="font-sans text-[11px] text-[#4a473f] mt-1">BSS close</div>
            </GlowPanel>

            <GlowPanel className="p-5">
              <div className="flex items-center gap-1.5 mb-2">
                <TrendingUp size={11} className="text-[rgba(200,169,110,0.5)]" />
                <span className="font-mono text-[9px] uppercase tracking-[0.15em] text-[#7a766d]">Alpha</span>
              </div>
              <div className={`font-display text-[28px] font-light ${data.bss_alpha >= 0 ? 'text-[#ede9e1]' : 'text-[#bdb8ae]'}`} style={{ fontVariantNumeric: 'tabular-nums' }}>
                {data.bss_alpha >= 0 ? '+' : ''}{data.bss_alpha.toFixed(1)}
              </div>
              <div className="font-sans text-[11px] text-[#4a473f] mt-1">above cohort avg</div>
            </GlowPanel>
          </div>
        </div>

        {/* LIFETIME PERFORMANCE */}
        {perfData && perfData.summary.tradeCount > 0 && (
          <div className="mb-5">
            <PerformanceCard
              summary={perfData.summary}
              sessions={perfData.sessions}
              dateRange={perfData.dateRange}
            />
          </div>
        )}

        {/* 90-DAY SPARKLINE */}
        {sparkline.length > 1 && (
          <GlowPanel className="p-5 mb-5">
            <div className="flex justify-between items-center mb-4">
              <div className="font-mono text-[10px] uppercase tracking-[0.15em] text-[#7a766d]">{sparkline.length}-Day Trajectory</div>
              <div className="font-mono text-[10px] text-[#4a473f]">{sparkline.length >= 90 ? '90 days' : `${sparkline.length} days`}</div>
            </div>
            <svg width="100%" height="80" viewBox={`0 0 ${sparkW} ${sparkH}`} preserveAspectRatio="none" className="w-full">
              <defs>
                <linearGradient id={`sparkGrad-${sparkGradId}`} x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#c8a96e" stopOpacity="0.15" />
                  <stop offset="100%" stopColor="#c8a96e" stopOpacity="0" />
                </linearGradient>
              </defs>
              <polygon points={sparkPolygon} fill={`url(#sparkGrad-${sparkGradId})`} />
              <polyline points={sparkPoints} fill="none" stroke="#c8a96e" strokeWidth="2" strokeLinejoin="round" strokeLinecap="round" />
              {sparkline.length > 0 && (
                <circle
                  cx={sparkW}
                  cy={sparkH - ((sparkline[sparkline.length - 1] / 100) * sparkH)}
                  r="4"
                  fill="#c8a96e"
                  stroke="#080a0e"
                  strokeWidth="2"
                />
              )}
            </svg>
          </GlowPanel>
        )}

        {/* TIER PROGRESSION */}
        <GlowPanel className="p-5 mb-5">
          <div className="font-mono text-[10px] uppercase tracking-[0.15em] text-[#7a766d] mb-4">Tier Progression</div>
          <div className="flex gap-1 mb-3">
            {TIERS.map((tier, idx) => (
              <div
                key={tier.key}
                className="flex-1 h-1.5 rounded-full transition-all"
                style={{
                  backgroundColor: idx <= currentTierIndex
                    ? `rgba(200,169,110,${tierOpacities[idx]})`
                    : 'rgba(200,169,110,0.04)',
                  boxShadow: idx === currentTierIndex
                    ? `0 0 10px rgba(200,169,110,${tierOpacities[idx] * 0.5})`
                    : 'none',
                }}
              />
            ))}
          </div>
          <div className="flex justify-between">
            {TIERS.map((tier, idx) => (
              <span
                key={tier.key}
                className={`font-mono text-[8px] uppercase tracking-[0.1em] ${
                  tier.key === data.bss_tier
                    ? 'font-semibold text-[#c8a96e]'
                    : 'text-[#4a473f]'
                }`}
              >
                {tier.name}
              </span>
            ))}
          </div>
        </GlowPanel>

        {/* SHARE LINK */}
        <GlowPanel className="p-4 flex items-center gap-3" data-onboard="trader-id-share">
          <div className="flex-1 bg-[rgba(200,169,110,0.03)] backdrop-blur-xl rounded-lg px-3.5 py-2.5 font-mono text-[12px] text-[#7a766d] truncate border border-[rgba(200,169,110,0.08)]">
            {shareUrl}
          </div>
          <button
            onClick={handleCopy}
            className="bg-[#c8a96e] text-[#080a0e] rounded-lg px-5 py-2.5 font-mono text-[11px] font-bold tracking-[0.1em] uppercase transition-all hover:shadow-[0_0_20px_rgba(200,169,110,0.3)] hover:bg-[#d4ba85] shrink-0 flex items-center gap-2"
          >
            {copied ? <Check size={14} /> : <Copy size={14} />}
            {copied ? 'Copied' : 'Copy Link'}
          </button>
        </GlowPanel>
      </div>
    </div>
  );
}
