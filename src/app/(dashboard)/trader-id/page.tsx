'use client';

import { useState, useEffect } from 'react';
import { UserCircle, Copy, Check, TrendingUp, TrendingDown } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import { getTierStyle, TIER_STYLES } from '@/lib/tokens';
import { GlowingEffect } from '@/components/ui/glowing-effect';
import type { StatePayload } from '@/lib/types';

/**
 * DS Trader ID — behavioral profile card.
 * Centered single-column layout: avatar, BSS hero, tier badge,
 * 2×2 stats grid, 90-day sparkline, tier progression bar, share link.
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

      // Extract name from email or metadata
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
  const profileId = `ds://${userName.toLowerCase().replace(/\s+/g, '-')}-${data.account_ref.slice(0, 4)}`;
  const shareUrl = `driftsentinel.com/id/${userName.toLowerCase().replace(/\s+/g, '-')}-${data.account_ref.slice(0, 4)}`;

  // 90-day sparkline SVG path
  const sparkW = 460;
  const sparkH = 80;
  const sparkPoints = sparkline.length > 1
    ? sparkline.map((v, i) => {
        const x = (i / (sparkline.length - 1)) * sparkW;
        const y = sparkH - ((v / 100) * sparkH);
        return `${x},${y}`;
      }).join(' ')
    : '';

  const sparkPolygon = sparkPoints
    ? `0,${sparkH} ${sparkPoints} ${sparkW},${sparkH}`
    : '';

  // Tier progression data
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
        {/* Page header */}
        <div className="text-center mb-10">
          <div className="font-mono text-[12px] uppercase tracking-[0.25em] text-text-muted mb-2">
            DS Trader ID
          </div>
          <div className="font-mono text-[20px] font-bold text-text-primary">
            Behavioral Profile
          </div>
        </div>

        {/* ═══ PROFILE HERO CARD ═══ */}
        <div className="glass-card rounded-2xl p-10 text-center mb-5 relative overflow-hidden">
          <GlowingEffect
            spread={50}
            glow={true}
            disabled={false}
            proximity={80}
            inactiveZone={0.2}
            borderWidth={2}
            variant="teal-gold"
            blur={4}
            movementDuration={1.5}
          />
          {/* Subtle radial glow */}
          <div
            className="absolute inset-0 pointer-events-none"
            style={{
              background: 'radial-gradient(circle at 50% 80%, rgba(0,212,170,0.04) 0%, transparent 50%)',
            }}
          />

          {/* Avatar */}
          <div className="relative z-10">
            <div
              className="w-[72px] h-[72px] rounded-full mx-auto mb-4 flex items-center justify-center"
              style={{
                background: `linear-gradient(135deg, rgba(0,212,170,0.08), rgba(167,139,250,0.08))`,
                border: '2px solid #00D4AA',
                boxShadow: '0 0 30px rgba(0,212,170,0.15)',
              }}
            >
              <UserCircle size={32} className="text-accent-primary" />
            </div>

            <div className="font-mono text-[18px] font-bold text-text-primary mb-1">
              {userName}
            </div>
            <div className="font-mono text-[12px] text-text-muted mb-5">
              {profileId}
            </div>

            {/* BSS Hero Number */}
            <div
              className="font-mono text-[64px] font-bold leading-none mb-1"
              style={{ color: tierStyle.color }}
            >
              {data.bss_score}
            </div>
            <div className="font-mono text-[12px] uppercase tracking-[0.2em] text-text-muted mb-4">
              Behavioral Stability Score
            </div>

            {/* Tier Badge */}
            <div
              className="inline-flex items-center gap-2 px-5 py-2 rounded-full font-mono text-[13px] font-semibold tracking-[0.15em]"
              style={{
                color: tierStyle.color,
                backgroundColor: `${tierStyle.color}15`,
                border: `1px solid ${tierStyle.color}25`,
              }}
            >
              <div
                className="w-2 h-2 rounded-full"
                style={{ backgroundColor: tierStyle.color }}
              />
              {data.bss_tier}
            </div>
          </div>
        </div>

        {/* ═══ STATS GRID 2×2 ═══ */}
        <div className="grid grid-cols-2 gap-3 mb-5">
          <div className="glass-card rounded-xl p-4">
            <div className="font-mono text-[10px] uppercase tracking-[0.15em] text-text-muted">
              Delta
            </div>
            <div className={`font-mono text-[22px] font-bold mt-1 ${delta >= 0 ? 'text-positive' : 'text-negative'}`}>
              {delta >= 0 ? '+' : ''}{delta}
            </div>
            <div className="font-mono text-[12px] text-text-muted">from yesterday</div>
          </div>
          <div className="glass-card rounded-xl p-4">
            <div className="font-mono text-[10px] uppercase tracking-[0.15em] text-text-muted">
              Streak
            </div>
            <div className="font-mono text-[22px] font-bold mt-1 text-[#FFD700]">
              {data.bss_streak} days
            </div>
            <div className="font-mono text-[12px] text-text-muted">consecutive sessions</div>
          </div>
          <div className="glass-card rounded-xl p-4">
            <div className="font-mono text-[10px] uppercase tracking-[0.15em] text-text-muted">
              Yesterday
            </div>
            <div className="font-mono text-[22px] font-bold mt-1 text-text-primary">
              {data.bss_yesterday}
            </div>
            <div className="font-mono text-[12px] text-text-muted">BSS close</div>
          </div>
          <div className="glass-card rounded-xl p-4">
            <div className="font-mono text-[10px] uppercase tracking-[0.15em] text-text-muted">
              Alpha
            </div>
            <div className={`font-mono text-[22px] font-bold mt-1 ${data.bss_alpha >= 0 ? 'text-positive' : 'text-negative'}`}>
              {data.bss_alpha >= 0 ? '+' : ''}{data.bss_alpha.toFixed(1)}
            </div>
            <div className="font-mono text-[12px] text-text-muted">above cohort avg</div>
          </div>
        </div>

        {/* ═══ 90-DAY SPARKLINE ═══ */}
        {sparkline.length > 1 && (
          <div className="glass-card rounded-xl p-5 mb-5">
            <div className="flex justify-between items-center mb-4">
              <div className="font-mono text-[12px] uppercase tracking-[0.15em] text-text-muted">
                {sparkline.length}-Day Trajectory
              </div>
              <div className="font-mono text-[12px] text-text-muted">
                {sparkline.length >= 90 ? '90 days' : `${sparkline.length} days`}
              </div>
            </div>
            <svg
              width="100%"
              height="80"
              viewBox={`0 0 ${sparkW} ${sparkH}`}
              preserveAspectRatio="none"
              className="w-full"
            >
              <defs>
                <linearGradient id="sparkGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#00D4AA" stopOpacity="0.2" />
                  <stop offset="100%" stopColor="#00D4AA" stopOpacity="0" />
                </linearGradient>
              </defs>
              <polygon points={sparkPolygon} fill="url(#sparkGrad)" />
              <polyline
                points={sparkPoints}
                fill="none"
                stroke="#00D4AA"
                strokeWidth="2"
                strokeLinejoin="round"
                strokeLinecap="round"
              />
              {/* End dot */}
              {sparkline.length > 0 && (
                <circle
                  cx={sparkW}
                  cy={sparkH - ((sparkline[sparkline.length - 1] / 100) * sparkH)}
                  r="4"
                  fill="#00D4AA"
                  stroke="#0F1117"
                  strokeWidth="2"
                />
              )}
            </svg>
          </div>
        )}

        {/* ═══ TIER PROGRESSION ═══ */}
        <div className="glass-card rounded-xl p-5 mb-5">
          <div className="font-mono text-[12px] uppercase tracking-[0.15em] text-text-muted mb-4">
            Tier Progression
          </div>
          <div className="flex gap-1 mb-3">
            {TIERS.map((tier, idx) => {
              const isReached = idx <= currentTierIndex;
              const isCurrent = idx === currentTierIndex;
              return (
                <div
                  key={tier.key}
                  className="flex-1 h-1.5 rounded-full"
                  style={{
                    backgroundColor: isReached ? tier.color : 'rgba(255,255,255,0.04)',
                    boxShadow: isCurrent ? `0 0 10px ${tier.color}50` : 'none',
                  }}
                />
              );
            })}
          </div>
          <div className="flex justify-between">
            {TIERS.map((tier) => (
              <span
                key={tier.key}
                className={`font-mono text-[9px] uppercase tracking-[0.1em] ${
                  tier.key === data.bss_tier
                    ? 'font-semibold'
                    : 'text-text-muted'
                }`}
                style={{
                  color: tier.key === data.bss_tier ? tier.color : undefined,
                }}
              >
                {tier.name}
              </span>
            ))}
          </div>
        </div>

        {/* ═══ SHARE LINK ═══ */}
        <div className="glass-card rounded-xl p-4 flex items-center gap-3">
          <div className="flex-1 glass-inset rounded-lg px-3.5 py-2.5 font-mono text-[12px] text-text-muted truncate">
            {shareUrl}
          </div>
          <button
            onClick={handleCopy}
            className="bg-accent-primary text-[#0F1117] rounded-lg px-5 py-2.5 font-mono text-[12px] font-semibold tracking-[0.1em] uppercase transition-all hover:shadow-[0_0_20px_rgba(0,212,170,0.3)] shrink-0 flex items-center gap-2"
          >
            {copied ? <Check size={14} /> : <Copy size={14} />}
            {copied ? 'Copied' : 'Copy Link'}
          </button>
        </div>
      </div>
    </div>
  );
}
