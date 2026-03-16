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

  return (
    <GlowPanel className="p-6 relative">
      {/* Close button */}
      <button
        onClick={onClose}
        className="absolute top-4 right-4 z-10 flex h-8 w-8 items-center justify-center rounded-lg bg-white/[0.04] hover:bg-white/[0.08] transition-all text-text-muted hover:text-text-primary"
      >
        <X size={14} />
      </button>

      {/* Session Summary Header */}
      <div className="mb-6">
        {/* Date + Quality badge row */}
        <div className="flex items-center gap-3 mb-4">
          <div className="flex items-center gap-2.5">
            <div className="h-2.5 w-2.5 rounded-full bg-white/60" style={{ boxShadow: '0 0 8px rgba(255,255,255,0.2)' }} />
            <h3 className="font-mono text-base font-bold text-white tracking-tight">
              {session.trading_date}
            </h3>
          </div>
          <span className="rounded-full px-3 py-1 font-mono text-[9px] font-bold uppercase tracking-[0.12em] bg-white/[0.06] text-white/70 border border-white/[0.1]">
            {qualityStyle.label}
          </span>
        </div>

        {/* Metrics grid — monochrome white/silver */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2.5">
          <MetricTile label="Fills" value={String(session.fills_count)} icon={Activity} />
          <MetricTile label="Violations" value={String(session.violation_count)} icon={AlertTriangle} />
          <MetricTile label="DSI Score" value={session.dsi_score !== null ? String(session.dsi_score) : '—'} icon={Shield} />
          <MetricTile label="BSS" value={session.bss_at_session !== null ? String(session.bss_at_session) : '—'} icon={Zap} />
          <MetricTile
            label="BSS Delta"
            value={session.bss_delta !== null ? `${session.bss_delta >= 0 ? '+' : ''}${session.bss_delta.toFixed(1)}` : '—'}
            icon={TrendingUp}
          />
          <MetricTile label="Max Consec Loss" value={String(session.max_consecutive_losses)} icon={RotateCcw} />
        </div>

        {/* Behavioral flags — improved pill design */}
        {(session.recovery_attempted || session.session_extended || session.first_violation_sequence !== null) && (
          <div className="flex flex-wrap items-center gap-2 mt-4">
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
        )}
      </div>

      {/* Event Timeline — redesigned */}
      <div className="border-t border-white/[0.04] pt-5">
        <h4 className="font-mono text-[9px] font-semibold uppercase tracking-[0.2em] text-text-muted mb-4">
          Event Timeline
        </h4>

        {loading ? (
          <div className="flex items-center justify-center py-10">
            <div className="h-4 w-4 animate-spin rounded-full border-2 border-positive border-t-transparent" />
          </div>
        ) : events.length === 0 ? (
          <div className="flex items-center justify-center py-8 rounded-xl bg-white/[0.01] border border-white/[0.03]">
            <p className="font-mono text-[11px] text-text-dim">
              No events recorded for this session.
            </p>
          </div>
        ) : (
          <div className="relative pl-8">
            {/* Vertical timeline line — gradient fade */}
            <div
              className="absolute left-[9px] top-1 bottom-1 w-px"
              style={{
                background: 'linear-gradient(to bottom, rgba(255,255,255,0.25), rgba(255,255,255,0.08), rgba(255,255,255,0.02))',
              }}
            />

            <div className="flex flex-col gap-1">
              {events.map((event, i) => {
                const Icon = getEventIcon(event.event_type);
                const label = EVENT_TYPE_LABELS[event.event_type] ?? event.event_type;
                const meta = event.metadata ?? {};
                const isViolation = event.event_type === 'VIOLATION_TRIGGERED' || event.event_type === 'PROTOCOL_BREACH';
                // Monochrome brightness: violations slightly brighter to stand out
                const nodeBrightness = isViolation ? 'bg-white/90' : 'bg-white/60';

                return (
                  <div
                    key={event.session_event_id ?? i}
                    className={`relative flex items-start gap-3 py-2 px-3 rounded-lg transition-colors ${
                      isViolation ? 'bg-white/[0.02]' : 'hover:bg-white/[0.02]'
                    }`}
                  >
                    {/* Timeline node */}
                    <div
                      className={`absolute left-[-23px] top-3 flex h-[18px] w-[18px] items-center justify-center rounded-full ring-2 ring-[rgba(13,15,21,0.85)] ${nodeBrightness}`}
                      style={{
                        boxShadow: isViolation ? '0 0 8px rgba(255,255,255,0.3)' : '0 0 6px rgba(255,255,255,0.15)',
                      }}
                    >
                      <Icon size={9} className="text-void" strokeWidth={2.5} />
                    </div>

                    {/* Event content */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2.5">
                        <span className={`font-mono text-[11px] font-semibold ${isViolation ? 'text-white' : 'text-white/80'}`}>
                          {label}
                        </span>
                        <span className="font-mono text-[9px] text-text-dim bg-white/[0.03] rounded px-1.5 py-0.5">
                          +{formatElapsed(event.elapsed_seconds)}
                        </span>
                        <span className="font-mono text-[8px] text-text-dim">
                          #{event.sequence_number}
                        </span>
                      </div>

                      {/* Metadata display */}
                      {meta.instrument && (
                        <p className="font-mono text-[10px] text-text-muted mt-1">
                          <span className="text-text-secondary">{meta.side}</span>{' '}
                          {meta.qty}x {meta.contract ?? meta.instrument}{' '}
                          <span className="text-text-secondary">@ {meta.price}</span>
                          {meta.off_session && (
                            <span className="ml-1.5 text-[8px] text-warning">(off-session)</span>
                          )}
                        </p>
                      )}
                      {meta.violation_type && (
                        <p className="font-mono text-[10px] mt-1 text-white/70">
                          {meta.violation_type}
                          <span className="text-white/40"> — {meta.severity}</span>
                          <span className="ml-1 text-white/30">({meta.points} pts)</span>
                        </p>
                      )}
                      {meta.session_quality && event.event_type === 'SESSION_END' && (
                        <p className="font-mono text-[10px] text-text-muted mt-1">
                          Quality: <span className="text-text-secondary">{meta.session_quality}</span> — {meta.fills_count} fills, {meta.violation_count} violations
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
    </GlowPanel>
  );
}

/* ── Metric Tile ── */
function MetricTile({
  label,
  value,
  icon: Icon,
}: {
  label: string;
  value: string;
  icon: LucideIcon;
}) {
  return (
    <div className="flex flex-col gap-1.5 rounded-xl px-3.5 py-3 bg-white/[0.03] border border-white/[0.04] transition-colors hover:border-white/[0.08]">
      <div className="flex items-center gap-1.5">
        <Icon size={10} className="text-white/40" />
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
    <span className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 font-mono text-[8px] font-semibold uppercase tracking-[0.1em] bg-white/[0.06] text-white/60 border border-white/[0.08] transition-colors">
      <span className="h-1 w-1 rounded-full bg-white/50" />
      {label}
    </span>
  );
}
