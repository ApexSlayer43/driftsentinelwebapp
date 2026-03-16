'use client';

import { useState, useEffect } from 'react';
import { createClient } from '@/lib/supabase/client';
import type { Session, SessionEvent } from '@/lib/types';
import { getSessionQualityStyle, getTierStyle } from '@/lib/tokens';
import { EVENT_TYPE_LABELS, EVENT_TYPE_ICONS } from '@/lib/tokens';
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

function getEventColor(eventType: string): string {
  switch (eventType) {
    case 'SESSION_START': return '#6366F1';
    case 'SESSION_END': return '#94A3B8';
    case 'TRADE_OPEN': return '#22D3EE';
    case 'TRADE_CLOSE': return '#94A3B8';
    case 'VIOLATION_TRIGGERED': return '#FB923C';
    case 'VIOLATION_CLEARED': return '#22D3EE';
    case 'PROTOCOL_BREACH': return '#FB923C';
    case 'SIZE_ESCALATION': return '#F59E0B';
    case 'RECOVERY_ATTEMPT': return '#60A5FA';
    default: return '#6B7280';
  }
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
  const bssTierStyle = session.bss_at_session !== null
    ? getTierStyle(session.bss_at_session >= 80 ? 'PROVEN' : session.bss_at_session >= 60 ? 'GROUNDED' : session.bss_at_session >= 40 ? 'DEFINED' : 'FORMING')
    : null;

  return (
    <div className="animate-in slide-in-from-bottom-4 rounded-xl liquid-glass p-6 relative">
      {/* Close button */}
      <button
        onClick={onClose}
        className="absolute top-4 right-4 flex h-7 w-7 items-center justify-center rounded-lg liquid-glass-tab text-text-muted hover:text-text-secondary transition-colors"
      >
        <X size={14} />
      </button>

      {/* Session Summary Header */}
      <div className="mb-5">
        <div className="flex items-center gap-3 mb-3">
          <h3 className="font-mono text-sm font-bold text-text-primary">
            {session.trading_date}
          </h3>
          <span
            className="rounded-full px-2.5 py-0.5 font-mono text-[8px] font-bold uppercase tracking-wider"
            style={{ backgroundColor: qualityStyle.bg, color: qualityStyle.color, border: `1px solid ${qualityStyle.border}` }}
          >
            {qualityStyle.label}
          </span>
        </div>

        {/* Metrics row */}
        <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-6 gap-3">
          <MetricPill label="Fills" value={String(session.fills_count)} />
          <MetricPill label="Violations" value={String(session.violation_count)} color={session.violation_count > 0 ? '#FF6B35' : undefined} />
          <MetricPill label="DSI" value={session.dsi_score !== null ? String(session.dsi_score) : '—'} />
          <MetricPill label="BSS" value={session.bss_at_session !== null ? String(session.bss_at_session) : '—'} color={bssTierStyle?.color} />
          <MetricPill
            label="BSS Delta"
            value={session.bss_delta !== null ? `${session.bss_delta >= 0 ? '+' : ''}${session.bss_delta.toFixed(1)}` : '—'}
            color={session.bss_delta !== null ? (session.bss_delta >= 0 ? '#00D4AA' : '#FF3B5C') : undefined}
          />
          <MetricPill label="Max Consec. Loss" value={String(session.max_consecutive_losses)} color={session.max_consecutive_losses >= 3 ? '#FF6B35' : undefined} />
        </div>

        {/* Behavioral flags */}
        <div className="flex items-center gap-2 mt-3">
          {session.recovery_attempted && (
            <span className="rounded-full px-2 py-0.5 font-mono text-[7px] uppercase tracking-wider bg-[rgba(74,158,229,0.12)] text-[#4A9EE5] border border-[rgba(74,158,229,0.25)]">
              Recovery Attempted
            </span>
          )}
          {session.session_extended && (
            <span className="rounded-full px-2 py-0.5 font-mono text-[7px] uppercase tracking-wider bg-[rgba(245,166,35,0.12)] text-[#F5A623] border border-[rgba(245,166,35,0.25)]">
              Extended Session
            </span>
          )}
          {session.first_violation_sequence !== null && (
            <span className="rounded-full px-2 py-0.5 font-mono text-[7px] uppercase tracking-wider bg-[rgba(255,107,53,0.12)] text-[#FF6B35] border border-[rgba(255,107,53,0.25)]">
              First Violation @ Trade #{session.first_violation_sequence}
            </span>
          )}
        </div>
      </div>

      {/* Event Timeline */}
      <div className="border-t border-border-dim pt-4">
        <h4 className="font-mono text-[8px] font-semibold uppercase tracking-[0.2em] text-text-muted mb-3">
          Session Event Timeline
        </h4>

        {loading ? (
          <div className="flex items-center justify-center py-8">
            <div className="h-4 w-4 animate-spin rounded-full border-2 border-stable border-t-transparent" />
          </div>
        ) : events.length === 0 ? (
          <p className="font-mono text-[10px] text-text-muted py-4">
            No events recorded for this session.
          </p>
        ) : (
          <div className="relative pl-6">
            {/* Vertical timeline line */}
            <div className="absolute left-[7px] top-0 bottom-0 w-px bg-border-subtle" />

            <div className="flex flex-col gap-2">
              {events.map((event, i) => {
                const Icon = getEventIcon(event.event_type);
                const color = getEventColor(event.event_type);
                const label = EVENT_TYPE_LABELS[event.event_type] ?? event.event_type;
                const meta = event.metadata ?? {};

                return (
                  <div key={event.session_event_id ?? i} className="relative flex items-start gap-3">
                    {/* Timeline dot */}
                    <div
                      className="absolute left-[-20px] top-1 flex h-3.5 w-3.5 items-center justify-center rounded-full"
                      style={{ backgroundColor: color, opacity: 0.8 }}
                    >
                      <Icon size={8} className="text-void" />
                    </div>

                    {/* Event content */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="font-mono text-[10px] font-semibold" style={{ color }}>
                          {label}
                        </span>
                        <span className="font-mono text-[8px] text-text-muted">
                          +{formatElapsed(event.elapsed_seconds)}
                        </span>
                        <span className="font-mono text-[7px] text-text-dim">
                          #{event.sequence_number}
                        </span>
                      </div>

                      {/* Metadata display */}
                      {meta.instrument && (
                        <p className="font-mono text-[8px] text-text-muted mt-0.5">
                          {meta.side} {meta.qty}x {meta.contract ?? meta.instrument} @ {meta.price}
                          {meta.off_session ? ' (off-session)' : ''}
                        </p>
                      )}
                      {meta.violation_type && (
                        <p className="font-mono text-[8px] mt-0.5" style={{ color }}>
                          {meta.violation_type} — {meta.severity} ({meta.points} pts)
                        </p>
                      )}
                      {meta.session_quality && event.event_type === 'SESSION_END' && (
                        <p className="font-mono text-[8px] text-text-muted mt-0.5">
                          Quality: {meta.session_quality} — {meta.fills_count} fills, {meta.violation_count} violations
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
  );
}

function MetricPill({ label, value, color }: { label: string; value: string; color?: string }) {
  return (
    <div className="flex flex-col items-center gap-0.5 rounded-lg border border-border-dim px-3 py-2">
      <span className="font-mono text-[7px] uppercase tracking-wider text-text-muted">
        {label}
      </span>
      <span
        className="font-mono text-sm font-bold"
        style={{ color: color ?? '#E8EDF5' }}
      >
        {value}
      </span>
    </div>
  );
}
