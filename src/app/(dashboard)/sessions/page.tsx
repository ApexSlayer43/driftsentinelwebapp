'use client';

import { useState, useEffect, useMemo } from 'react';
import { createClient } from '@/lib/supabase/client';
import type { Session, UploadEvent } from '@/lib/types';
import { SessionPulseStrip } from '@/components/session-pulse-strip';
import { SessionHeatmap } from '@/components/session-heatmap';
import { SessionDrillDown } from '@/components/session-drill-down';
import { UploadCadenceBar } from '@/components/upload-cadence-bar';
import { GlowingEffect } from '@/components/ui/glowing-effect';

type TimeRange = '30D' | '60D' | '90D';

export default function SessionsPage() {
  const [sessions, setSessions] = useState<Session[]>([]);
  const [uploads, setUploads] = useState<UploadEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [range, setRange] = useState<TimeRange>('30D');
  const [selectedSession, setSelectedSession] = useState<Session | null>(null);
  const [heatmapMonth, setHeatmapMonth] = useState(() => new Date());

  useEffect(() => {
    async function loadData() {
      setLoading(true);
      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        setLoading(false);
        return;
      }

      // Get account_ref
      const { data: accounts } = await supabase
        .from('accounts')
        .select('account_ref')
        .eq('user_id', user.id)
        .limit(1);

      if (!accounts || accounts.length === 0) {
        setLoading(false);
        return;
      }

      const accountRef = accounts[0].account_ref;
      const days = range === '30D' ? 30 : range === '60D' ? 60 : 90;
      const since = new Date();
      since.setDate(since.getDate() - days);
      const sinceStr = since.toISOString().slice(0, 10);

      // Fetch sessions and uploads in parallel
      const [sessionsResult, uploadsResult] = await Promise.all([
        supabase
          .from('sessions')
          .select('*')
          .eq('account_ref', accountRef)
          .gte('trading_date', sinceStr)
          .order('trading_date', { ascending: false }),
        supabase
          .from('upload_events')
          .select('*')
          .eq('account_ref', accountRef)
          .order('uploaded_at', { ascending: false })
          .limit(30),
      ]);

      if (!sessionsResult.error && sessionsResult.data) {
        setSessions(sessionsResult.data as Session[]);
      }
      if (!uploadsResult.error && uploadsResult.data) {
        setUploads(uploadsResult.data as UploadEvent[]);
      }

      setLoading(false);
    }

    loadData();
  }, [range]);

  // Compute summary stats
  const stats = useMemo(() => {
    if (sessions.length === 0) return null;
    const cleanCount = sessions.filter((s) => s.session_quality === 'CLEAN').length;
    const cleanRate = Math.round((cleanCount / sessions.length) * 100);
    const avgFills = Math.round(sessions.reduce((sum, s) => sum + s.fills_count, 0) / sessions.length);
    const totalViolations = sessions.reduce((sum, s) => sum + s.violation_count, 0);
    const avgDsi = sessions.filter((s) => s.dsi_score !== null).length > 0
      ? Math.round(sessions.filter((s) => s.dsi_score !== null).reduce((sum, s) => sum + (s.dsi_score ?? 0), 0) / sessions.filter((s) => s.dsi_score !== null).length)
      : null;

    return { cleanCount, cleanRate, avgFills, totalViolations, avgDsi, total: sessions.length };
  }, [sessions]);

  const RANGES: TimeRange[] = ['30D', '60D', '90D'];

  if (loading) {
    return (
      <div className="flex h-full items-center justify-center">
        <div className="text-center">
          <div className="h-6 w-6 animate-spin rounded-full border-2 border-stable border-t-transparent mx-auto" />
          <p className="mt-3 font-mono text-xs text-text-muted">Loading sessions...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full overflow-auto">
      {/* Header */}
      <div className="px-8 pt-6 pb-2 flex items-end justify-between shrink-0">
        <div>
          <h1 className="font-display text-2xl font-bold text-text-primary">
            Sessions
          </h1>
          <p className="mt-1 font-mono text-xs text-text-muted">
            Your behavioral black box — every session, every event, every pattern
          </p>
        </div>
        <div className="flex gap-2">
          {RANGES.map((r) => (
            <button
              key={r}
              onClick={() => setRange(r)}
              className={`rounded-full px-3 py-1 font-mono text-[9px] font-bold uppercase tracking-[0.1em] transition-colors ${
                range === r
                  ? 'liquid-glass-tab-active text-text-primary'
                  : 'liquid-glass-tab text-text-muted hover:text-text-secondary'
              }`}
            >
              {r}
            </button>
          ))}
        </div>
      </div>

      {/* Summary stats */}
      {stats && (
        <div className="px-8 py-3 shrink-0">
          <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
            <StatCard label="Sessions" value={String(stats.total)} />
            <StatCard label="Clean Rate" value={`${stats.cleanRate}%`} color={stats.cleanRate >= 70 ? '#22D3EE' : stats.cleanRate >= 40 ? '#F59E0B' : '#FB923C'} />
            <StatCard label="Avg Fills" value={String(stats.avgFills)} />
            <StatCard label="Total Violations" value={String(stats.totalViolations)} color={stats.totalViolations > 0 ? '#FB923C' : '#22D3EE'} />
            <StatCard label="Avg DSI" value={stats.avgDsi !== null ? String(stats.avgDsi) : '—'} />
          </div>
        </div>
      )}

      {/* Pulse Strip */}
      <div className="px-8 py-2 shrink-0">
        <h2 className="font-mono text-[8px] font-semibold uppercase tracking-[0.2em] text-text-muted mb-2">
          Session Pulse
        </h2>
        <SessionPulseStrip
          sessions={sessions}
          selectedId={selectedSession?.session_id ?? null}
          onSelect={setSelectedSession}
        />
      </div>

      {/* Main content grid: Heatmap + Upload Cadence */}
      <div className="px-8 py-3 flex-1 min-h-0">
        <div className="grid grid-cols-1 lg:grid-cols-[1fr_280px] gap-4 h-full">
          {/* Heatmap */}
          <div className="relative">
            <div className="relative h-full rounded-[1.25rem] border-[0.75px] border-border-subtle p-2 md:rounded-[1.5rem] md:p-3">
              <GlowingEffect
                spread={40}
                glow={true}
                disabled={false}
                proximity={64}
                inactiveZone={0.01}
                borderWidth={3}
              />
              <div className="relative h-full overflow-hidden rounded-xl border-[0.75px] border-border-dim">
                <SessionHeatmap
                  sessions={sessions}
                  selectedId={selectedSession?.session_id ?? null}
                  onSelect={setSelectedSession}
                  month={heatmapMonth}
                  onMonthChange={setHeatmapMonth}
                />
              </div>
            </div>
          </div>

          {/* Upload Cadence */}
          <div className="relative min-h-[300px]">
            <div className="relative h-full rounded-[1.25rem] border-[0.75px] border-border-subtle p-2 md:rounded-[1.5rem] md:p-3">
              <GlowingEffect
                spread={40}
                glow={true}
                disabled={false}
                proximity={64}
                inactiveZone={0.01}
                borderWidth={3}
              />
              <div className="relative h-full overflow-hidden rounded-xl border-[0.75px] border-border-dim">
                <UploadCadenceBar uploads={uploads} />
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Drill-Down Panel */}
      {selectedSession && (
        <div className="px-8 py-3 shrink-0">
          <SessionDrillDown
            session={selectedSession}
            onClose={() => setSelectedSession(null)}
          />
        </div>
      )}
    </div>
  );
}

function StatCard({ label, value, color }: { label: string; value: string; color?: string }) {
  return (
    <div className="flex flex-col items-center gap-1 rounded-xl liquid-glass px-4 py-3">
      <span className="font-mono text-[7px] font-semibold uppercase tracking-[0.18em] text-text-muted">
        {label}
      </span>
      <span
        className="font-mono text-lg font-bold"
        style={{ color: color ?? '#E8EDF5' }}
      >
        {value}
      </span>
    </div>
  );
}
