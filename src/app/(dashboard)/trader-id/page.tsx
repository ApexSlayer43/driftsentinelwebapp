'use client';

import { useState, useEffect } from 'react';
import { UserCircle, Copy, Check } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import { getTierStyle, ACCENT } from '@/lib/tokens';
import type { StatePayload } from '@/lib/types';

/**
 * DS Trader ID — behavioral profile card.
 * Accent: indigo (#6366F1). Score in #E2E8F0 (neutral).
 * Tier badge carries color. Golden iris preserved.
 */
export default function TraderIdPage() {
  const [data, setData] = useState<StatePayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [sparkline, setSparkline] = useState<number[]>([]);
  const [copied, setCopied] = useState(false);
  const [userName, setUserName] = useState('Trader');

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
        <div className="h-5 w-5 animate-pulse rounded-full bg-raised" />
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
    { name: 'Dormant', key: 'DORMANT', color: '#6B7280' },
    { name: 'Forming', key: 'FORMING', color: '#60A5FA' },
    { name: 'Developing', key: 'DEVELOPING', color: '#34D399' },
    { name: 'Consistent', key: 'CONSISTENT', color: '#A78BFA' },
    { name: 'Disciplined', key: 'DISCIPLINED', color: '#F59E0B' },
    { name: 'Sovereign', key: 'SOVEREIGN', color: '#FFD700' },
  ];
  const currentTierIndex = TIERS.findIndex(t => t.key === data.bss_tier);

  function handleCopy() {
    navigator.clipboard.writeText(shareUrl).catch(() => {});
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <div className="flex justify-center overflow-y-auto py-10 px-6">
      <div className="w-full max-w-[520px]">
        <div className="text-center mb-10">
          <div className="font-mono text-[12px] uppercase tracking-[0.25em] text-text-muted mb-2">DS Trader ID</div>
          <div className="font-display text-[20px] font-bold text-text-primary">Behavioral Profile</div>
        </div>

        {/* PROFILE HERO */}
        <div className="glass-card rounded-2xl p-10 text-center mb-5 relative overflow-hidden">
          <div className="absolute inset-0 pointer-events-none" style={{ background: `radial-gradient(circle at 50% 80%, rgba(99,102,241,0.04) 0%, transparent 50%)` }} />
          <div className="relative z-10">
            <div className="w-[72px] h-[72px] rounded-full mx-auto mb-4 flex items-center justify-center" style={{ background: `linear-gradient(135deg, rgba(99,102,241,0.08), rgba(167,139,250,0.08))`, border: `2px solid ${ACCENT.primary}`, boxShadow: `0 0 30px rgba(99,102,241,0.15)` }}>
              <UserCircle size={32} className="text-accent-primary" />
            </div>
            <div className="font-mono text-[18px] font-bold text-text-primary mb-1">{userName}</div>
            <div className="font-mono text-[12px] text-text-muted mb-5">{profileId}</div>
            <div className="font-mono text-[48px] font-bold leading-none mb-1" style={{ color: '#E2E8F0', fontVariantNumeric: 'tabular-nums' }}>{data.bss_score}</div>
            <div className="font-mono text-[12px] uppercase tracking-[0.2em] text-text-muted mb-4">Behavioral Stability Score</div>
            <div className="inline-flex items-center gap-2 px-5 py-2 rounded-full font-mono text-[13px] font-semibold tracking-[0.15em]" style={{ color: tierStyle.color, backgroundColor: `${tierStyle.color}15`, border: `1px solid ${tierStyle.color}25` }}>
              <div className="w-2 h-2 rounded-full" style={{ backgroundColor: tierStyle.color }} />
              {data.bss_tier}
            </div>
          </div>
        </div>

        {/* STATS 2×2 */}
        <div className="grid grid-cols-2 gap-3 mb-5">
          <div className="glass-card rounded-xl p-4">
            <div className="font-mono text-[10px] uppercase tracking-[0.15em] text-text-muted">Delta</div>
            <div className={`font-mono text-[22px] font-bold mt-1 ${delta >= 0 ? 'text-positive' : 'text-negative'}`} style={{ fontVariantNumeric: 'tabular-nums' }}>{delta >= 0 ? '+' : ''}{delta}</div>
            <div className="font-mono text-[12px] text-text-muted">from yesterday</div>
          </div>
          <div className="glass-card rounded-xl p-4">
            <div className="font-mono text-[10px] uppercase tracking-[0.15em] text-text-muted">Streak</div>
            <div className="font-mono text-[22px] font-bold mt-1 text-[#FFD700]" style={{ fontVariantNumeric: 'tabular-nums' }}>{data.bss_streak} days</div>
            <div className="font-mono text-[12px] text-text-muted">consecutive sessions</div>
          </div>
          <div className="glass-card rounded-xl p-4">
            <div className="font-mono text-[10px] uppercase tracking-[0.15em] text-text-muted">Yesterday</div>
            <div className="font-mono text-[22px] font-bold mt-1 text-text-primary" style={{ fontVariantNumeric: 'tabular-nums' }}>{data.bss_yesterday}</div>
            <div className="font-mono text-[12px] text-text-muted">BSS close</div>
          </div>
          <div className="glass-card rounded-xl p-4">
            <div className="font-mono text-[10px] uppercase tracking-[0.15em] text-text-muted">Alpha</div>
            <div className={`font-mono text-[22px] font-bold mt-1 ${data.bss_alpha >= 0 ? 'text-positive' : 'text-negative'}`} style={{ fontVariantNumeric: 'tabular-nums' }}>{data.bss_alpha >= 0 ? '+' : ''}{data.bss_alpha.toFixed(1)}</div>
            <div className="font-mono text-[12px] text-text-muted">above cohort avg</div>
          </div>
        </div>

        {/* 90-DAY SPARKLINE — indigo accent */}
        {sparkline.length > 1 && (
          <div className="glass-card rounded-xl p-5 mb-5">
            <div className="flex justify-between items-center mb-4">
              <div className="font-mono text-[12px] uppercase tracking-[0.15em] text-text-muted">{sparkline.length}-Day Trajectory</div>
              <div className="font-mono text-[12px] text-text-muted">{sparkline.length >= 90 ? '90 days' : `${sparkline.length} days`}</div>
            </div>
            <svg width="100%" height="80" viewBox={`0 0 ${sparkW} ${sparkH}`} preserveAspectRatio="none" className="w-full">
              <defs>
                <linearGradient id="sparkGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor={ACCENT.primary} stopOpacity="0.15" />
                  <stop offset="100%" stopColor={ACCENT.primary} stopOpacity="0" />
                </linearGradient>
              </defs>
              <polygon points={sparkPolygon} fill="url(#sparkGrad)" />
              <polyline points={sparkPoints} fill="none" stroke={ACCENT.primary} strokeWidth="2" strokeLinejoin="round" strokeLinecap="round" />
              {sparkline.length > 0 && <circle cx={sparkW} cy={sparkH - ((sparkline[sparkline.length - 1] / 100) * sparkH)} r="4" fill={ACCENT.primary} stroke="#0F1117" strokeWidth="2" />}
            </svg>
          </div>
        )}

        {/* TIER PROGRESSION */}
        <div className="glass-card rounded-xl p-5 mb-5">
          <div className="font-mono text-[12px] uppercase tracking-[0.15em] text-text-muted mb-4">Tier Progression</div>
          <div className="flex gap-1 mb-3">
            {TIERS.map((tier, idx) => (
              <div key={tier.key} className="flex-1 h-1.5 rounded-full" style={{ backgroundColor: idx <= currentTierIndex ? tier.color : 'rgba(255,255,255,0.04)', boxShadow: idx === currentTierIndex ? `0 0 10px ${tier.color}50` : 'none' }} />
            ))}
          </div>
          <div className="flex justify-between">
            {TIERS.map((tier) => (
              <span key={tier.key} className={`font-mono text-[9px] uppercase tracking-[0.1em] ${tier.key === data.bss_tier ? 'font-semibold' : 'text-text-muted'}`} style={{ color: tier.key === data.bss_tier ? tier.color : undefined }}>{tier.name}</span>
            ))}
          </div>
        </div>

        {/* SHARE LINK — indigo accent */}
        <div className="glass-card rounded-xl p-4 flex items-center gap-3">
          <div className="flex-1 glass-inset rounded-lg px-3.5 py-2.5 font-mono text-[12px] text-text-muted truncate">{shareUrl}</div>
          <button onClick={handleCopy} className="bg-accent-primary text-white rounded-lg px-5 py-2.5 font-mono text-[12px] font-semibold tracking-[0.1em] uppercase transition-all hover:shadow-[0_0_20px_rgba(99,102,241,0.3)] shrink-0 flex items-center gap-2">
            {copied ? <Check size={14} /> : <Copy size={14} />}
            {copied ? 'Copied' : 'Copy Link'}
          </button>
        </div>
      </div>
    </div>
  );
}
