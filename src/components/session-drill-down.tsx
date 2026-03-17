'use client';

import { useState, useEffect } from 'react';
import { createClient } from '@/lib/supabase/client';
import type { Session, SessionEvent } from '@/lib/types';
import { getSessionQualityStyle } from '@/lib/tokens';
import { EVENT_TYPE_LABELS, EVENT_TYPE_ICONS } from '@/lib/tokens';
import { GlowPanel } from '@/components/ui/glow-panel';
import {
  X,
  Play,
  Square,
  ArrowUpRight,
  ArrowDownRight,
  AlertTriangle,
  CheckCircle,
  ShieldAlert,
  TrendingUp,
  RotateCcw,
  Activity,
  Zap,
  Shield,
  Clock,
  type LucideIcon,
} from 'lucide-react';

const ICON_MAP: Record<string, LucideIcon> = {
  Play,
  Square,
  ArrowUpRight,
  ArrowDownRight,
  AlertTriangle,
  CheckCircle,
  ShieldAlert,
  TrendingUp,
  RotateCcw,
};

function getEventIcon(eventType: string): LucideIcon {
  const iconName = EVENT_TYPE_ICONS[eventType] ?? 'AlertTriangle';
  return ICON_MAP[iconName] ?? AlertTriangle;
}

function formatElapsed(seconds: number): string {
  if (seconds < 60) return `${seconds}s`;
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  if (mins < 60) return `${mins}m ${secs}s`;
  const hrs = Math.floor(mins / 60);
  const remMins = mins % 60;
  return `${hrs}h ${remMins}m`;
}

interface SessionDrillDownProps {
  session: Session;
  onClose: () => void;
}

export function SessionDrillDown({ session, onClose }: SessionDrillDownProps) {
  const [events, setEvents] = useState<SessionEvent[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadEvents() {
      setLoading(true);
      const supabase = createClient();

      const { data, error } = await supabase
        .from('session_events')
        .select('*')
        .eq('session_id', session.session_id)
        .order('sequence_number', { ascending: true });

      if (!error && data) {
        setEvents(data as SessionEvent[]);
      }
      setLoading(false);
    }

    loadEvents();
  }, [session.session_id]);

  const qualityStyle = getSessionQualityStyle(session.session_quality);

  // Compute derived stats
  const totalEvents = events.length;
  const violationEvents = events.filter(
    (e) => e.event_type === 'VIOLATION_TRIGGERED' || e.event_type === 'PROTOCOL_BREACH'
  );
  const tradeEvents = events.filter(
    (e) => e.event_type === 'TRADE_OPEN' || e.event_type === 'TRADE_CLOSE'
  );
  const sessionDuration = events.length > 1
    ? formatElapsed(events[events.length - 1].elapsed_seconds - events[0].elapsed_seconds)
    : '—';

  return (
    <GlowPanel className="p-0 relative overflow-hidden bg-[#0D0F15]">
      {/* Close button — prominent, top-right */}
      <button
        onClick={onClose}
        className="absolute top-3 right-3 z-20 flex h-9 w-9 items-center justify-center rounded-full bg-white/[0.08] hover:bg-white/[0.15] border border-white/[0.10] hover:border-white/[0.20] transition-all text-white/60 hover:text-white shadow-lg"
        title="Close session"
      >
        <X size={16} strokeWidth={2} />
      </button>

      {/* Two-column layout: Left = session overview, Right = timeline */}
      <div className="grid grid-cols-1 lg:grid-cols-[minmax(340px,_1fr)_minmax(400px,_1.4fr)] min-h-[500px]">
        {/* ── LEFT PANEL: Session Overview ── */}
        <div className="p-6 lg:border-r border-white/[0.04]">
          {/* Session header */}
          <div className="mb-6">
            <div className="flex items-center gap-3 mb-1">
              <h3 className="font-mono text-lg font-bold text-white tracking-tight">
                {session.trading_date}
              </h3>
              <span className="rounded-full px-3 py-1 font-mono text-[9px] font-bold uppercase tracking-[0.12em] bg-white/[0.06] text-white/70 border border-white/[0.1]">
                {qualityStyle.label}
              </span>
            </div>
            <p className="font-mono text-[10px] text-text-dim mt-1">
              {totalEvents} events &middot; {sessionDuration} duration &middot; {violationEvents.length} violation{violationEvents.length !== 1 ? 's' : ''}
            </p>
          </div>

          {/* Primary metrics — 2×3 grid */}
          <div className="grid grid-cols-2 gap-2 mb-5">
            <MetricCard label="Fills" value={String(session.fills_count)} icon={Activity} />
            <MetricCard label="Violations" value={String(session.violation_count)} icon={AlertTriangle} />
            <MetricCard label="BSS" value={session.bss_at_session !== null ? String(session.bss_at_session) : '—'} icon={Zap} />
            <MetricCard
              label="BSS Delta"
              value={session.bss_delta !== null ? `${session.bss_delta >= 0 ? '+' : ''}${session.bss_delta.toFixed(1)}` : '—'}
              icon={TrendingUp}
            />
            <MetricCard label="DSI Score" value={session.dsi_score !== null ? String(session.dsi_score) : '—'} icon={Shield} />
            <MetricCard label="Max Consec Loss" value={String(session.max_consecutive_losses)} icon={RotateCcw} />
          </div>

          {/* Session duration + event counts */}
          <div className="rounded-xl bg-white/[0.02] border border-white/[0.04] p-4 mb-5">
            <div className="flex items-center gap-2 mb-3">
              <Clock size={10} className="text-white/40" />
              <span className="font-mono text-[8px] font-semibold uppercase tracking-[0.18em] text-white/30">
                Session Breakdown
              </span>
            </div>
            <div className="grid grid-cols-3 gap-3">
              <div>
                <span className="block font-mono text-xl font-bold text-white">{tradeEvents.length}</span>
                <span className="font-mono text-[8px] text-white/30 uppercase tracking-wide">Trades</span>
              </div>
              <div>
                <span className="block font-mono text-xl font-bold text-white">{violationEvents.length}</span>
                <span className="font-mono text-[8px] text-white/30 uppercase tracking-wide">Violations</span>
              </div>
              <div>
                <span className="block font-mono text-xl font-bold text-white">{sessionDuration}</span>
                <span className="font-mono text-[8px] text-white/30 uppercase tracking-wide">Duration</span>
              </div>
            </div>
          </div>

          {/* Behavioral flags */}
          {(session.recovery_attempted || session.session_extended || session.first_violation_sequence !== null) && (
            <div>
              <span className="font-mono text-[8px] font-semibold uppercase tracking-[0.18em] text-white/30 block mb-2">
                Behavioral Flags
              </span>
              <div className="flex flex-wrap gap-2">
                {session.recovery_attempted && (
                  <BehaviorFlag label="Recovery Attempted" />
                )}
                {session.session_extended && (
                  <BehaviorFlag label="Extended Session" />
                )}
                {session.first_violation_sequence !== null && (
                  <BehaviorFlag label={`First Violation @ Trade #${session.first_violation_sequence}`} />
                )}
              </div>
            </div>
          )}
        </div>

        {/* ── RIGHT PANEL: Event Timeline ── */}
        <div className="p-6 overflow-auto max-h-[600px] lg:max-h-none">
          <h4 className="font-mono text-[9px] font-semibold uppercase tracking-[0.2em] text-text-muted mb-4 sticky top-0 bg-white/[0.06] backdrop-blur-2xl py-1 -mt-1 z-10">
            Event Timeline
          </h4>

          {loading ? (
            <div className="flex items-center justify-center py-16">
              <div className="h-4 w-4 animate-spin rounded-full border-2 border-white/30 border-t-transparent" />
            </div>
          ) : events.length === 0 ? (
            <div className="flex items-center justify-center py-12 rounded-xl bg-white/[0.01] border border-white/[0.03]">
              <p className="font-mono text-[11px] text-text-dim">
                No events recorded for this session.
              </p>
            </div>
          ) : (
            <div className="relative pl-7">
              {/* Vertical timeline line */}
              <div
                className="absolute left-[9px] top-2 bottom-2 w-px"
                style={{
                  background: 'linear-gradient(to bottom, rgba(255,255,255,0.20), rgba(255,255,255,0.06), rgba(255,255,255,0.02))',
                }}
              />

              <div className="flex flex-col gap-0.5">
                {events.map((event, i) => {
                  const Icon = getEventIcon(event.event_type);
                  const label = EVENT_TYPE_LABELS[event.event_type] ?? event.event_type;
                  const meta = event.metadata ?? {};
                  const isViolation = event.event_type === 'VIOLATION_TRIGGERED' || event.event_type === 'PROTOCOL_BREACH';

                  return (
                    <div
                      key={event.session_event_id ?? i}
                      className={`relative flex items-start gap-3 py-2.5 px-3 rounded-lg transition-colors ${
                        isViolation ? 'bg-white/[0.03]' : 'hover:bg-white/[0.02]'
                      }`}
                    >
                      {/* Timeline node */}
                      <div
                        className={`absolute left-[-20px] top-3.5 flex h-[18px] w-[18px] items-center justify-center rounded-full ring-2 ring-[rgba(13,15,21,0.9)] ${
                          isViolation ? 'bg-white/90' : 'bg-white/50'
                        }`}
                        style={{
                          boxShadow: isViolation ? '0 0 10px rgba(255,255,255,0.35)' : '0 0 4px rgba(255,255,255,0.1)',
                        }}
                      >
                        <Icon size={9} className="text-void" strokeWidth={2.5} />
                      </div>

                      {/* Event content */}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2.5 flex-wrap">
                          <span className={`font-mono text-[11px] font-semibold ${isViolation ? 'text-white' : 'text-white/75'}`}>
                            {label}
                          </span>
                          <span className="font-mono text-[9px] text-text-dim bg-white/[0.04] rounded px-1.5 py-0.5">
                            +{formatElapsed(event.elapsed_seconds)}
                          </span>
                          <span className="font-mono text-[8px] text-text-dim">
                            #{event.sequence_number}
                          </span>
                        </div>

                        {/* Trade metadata */}
                        {meta.instrument && (
                          <p className="font-mono text-[10px] text-text-muted mt-1">
                            <span className="text-white/60">{meta.side}</span>{' '}
                            {meta.qty}x {meta.contract ?? meta.instrument}{' '}
                            <span className="text-white/50">@ {meta.price}</span>
                            {meta.off_session && (
                              <span className="ml-1.5 text-[8px] text-warning">(off-session)</span>
                            )}
                          </p>
                        )}
                        {/* Violation metadata */}
                        {meta.violation_type && (
                          <p className="font-mono text-[10px] mt-1 text-white/70">
                            {meta.violation_type}
                            <span className="text-white/40"> — {meta.severity}</span>
                            <span className="ml-1 text-white/30">({meta.points} pts)</span>
                          </p>
                        )}
                        {/* Session end metadata */}
                        {meta.session_quality && event.event_type === 'SESSION_END' && (
                          <p className="font-mono text-[10px] text-text-muted mt-1">
                            Quality: <span className="text-white/60">{meta.session_quality}</span> — {meta.fills_count} fills, {meta.violation_count} violations
                          </p>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      </div>
    </GlowPanel>
  );
}

/* ── Metric Card ── */
function MetricCard({
  label,
  value,
  icon: Icon,
}: {
  label: string;
  value: string;
  icon: LucideIcon;
}) {
  return (
    <div className="rounded-xl px-4 py-3 bg-white/[0.03] border border-white/[0.04] transition-colors hover:border-white/[0.08]">
      <div className="flex items-center gap-1.5 mb-1.5">
        <Icon size={10} className="text-white/35" />
        <span className="font-mono text-[7px] font-semibold uppercase tracking-[0.18em] text-white/30">
          {label}
        </span>
      </div>
      <span className="font-mono text-lg font-bold leading-none text-white">
        {value}
      </span>
    </div>
  );
}

/* ── Behavior Flag ── */
function BehaviorFlag({ label }: { label: string }) {
  return (
    <span className="inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 font-mono text-[8px] font-semibold uppercase tracking-[0.1em] bg-white/[0.05] text-white/60 border border-white/[0.07] transition-colors">
      <span className="h-1 w-1 rounded-full bg-white/50" />
      {label}
    </span>
  );
}
