'use client';

import { useEffect, useState, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, AlertTriangle, TrendingDown, TrendingUp, Shield, Activity } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import { SEVERITY_COLORS, MODE_LABELS } from '@/lib/tokens';

// ─── Types ───
interface Notification {
  id: string;
  type: 'violation' | 'tier_change' | 'drift_shift' | 'recovery';
  title: string;
  description: string;
  severity: 'LOW' | 'MED' | 'HIGH' | 'CRITICAL' | 'INFO';
  timestamp: string;
  read: boolean;
}

interface NotificationPanelProps {
  open: boolean;
  onClose: () => void;
}

// ─── Helpers ───
function timeAgo(dateStr: string): string {
  const now = new Date();
  const date = new Date(dateStr);
  const diffMs = now.getTime() - date.getTime();
  const diffMin = Math.floor(diffMs / 60000);
  const diffHr = Math.floor(diffMin / 60);
  const diffDay = Math.floor(diffHr / 24);

  if (diffMin < 1) return 'just now';
  if (diffMin < 60) return `${diffMin}m ago`;
  if (diffHr < 24) return `${diffHr}h ago`;
  if (diffDay < 7) return `${diffDay}d ago`;
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

function getSeverityColor(severity: string): string {
  if (severity === 'INFO') return '#00D4AA';
  return SEVERITY_COLORS[severity as keyof typeof SEVERITY_COLORS] ?? '#8A9BB8';
}

function getIcon(type: Notification['type']) {
  switch (type) {
    case 'violation':
      return AlertTriangle;
    case 'tier_change':
      return Shield;
    case 'drift_shift':
      return TrendingDown;
    case 'recovery':
      return TrendingUp;
    default:
      return Activity;
  }
}

// ─── Component ───
export function NotificationPanel({ open, onClose }: NotificationPanelProps) {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchNotifications = useCallback(async () => {
    setLoading(true);
    try {
      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      // Get user's account
      const { data: accounts } = await supabase
        .from('accounts')
        .select('account_ref, bss_score')
        .eq('user_id', user.id)
        .limit(1);

      if (!accounts || accounts.length === 0) return;
      const accountRef = accounts[0].account_ref;

      // Fetch recent violations (last 7 days)
      const sevenDaysAgo = new Date();
      sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

      const { data: violations } = await supabase
        .from('violations')
        .select('violation_id, mode, severity, points, first_seen_utc')
        .eq('account_ref', accountRef)
        .gte('first_seen_utc', sevenDaysAgo.toISOString())
        .order('first_seen_utc', { ascending: false })
        .limit(10);

      // Fetch recent daily scores for DSI change detection
      const { data: dailyScores } = await supabase
        .from('daily_scores')
        .select('trading_date, dsi_score, violation_count')
        .eq('account_ref', accountRef)
        .order('trading_date', { ascending: false })
        .limit(7);

      // Build notifications from violations
      const notifs: Notification[] = [];

      if (violations) {
        for (const v of violations) {
          notifs.push({
            id: v.violation_id,
            type: 'violation',
            title: MODE_LABELS[v.mode] ?? v.mode,
            description: `${v.severity} severity · −${v.points} pts`,
            severity: v.severity as Notification['severity'],
            timestamp: v.first_seen_utc,
            read: false,
          });
        }
      }

      // Detect DSI changes from daily scores
      if (dailyScores && dailyScores.length >= 2) {
        for (let i = 0; i < dailyScores.length - 1; i++) {
          const current = dailyScores[i];
          const previous = dailyScores[i + 1];
          const delta = current.dsi_score - previous.dsi_score;

          // Detect big DSI drops (>15 pts)
          if (delta < -15) {
            notifs.push({
              id: `dsi-drop-${current.trading_date}`,
              type: 'drift_shift',
              title: 'Significant DSI Drop',
              description: `DSI ${previous.dsi_score} → ${current.dsi_score} (${delta} pts)`,
              severity: delta < -25 ? 'HIGH' : 'MED',
              timestamp: `${current.trading_date}T16:00:00Z`,
              read: false,
            });
          }

          // Recovery: DSI jumped up >10
          if (delta > 10) {
            notifs.push({
              id: `recovery-${current.trading_date}`,
              type: 'recovery',
              title: 'Clean Session Recovery',
              description: `DSI ${previous.dsi_score} → ${current.dsi_score} (+${delta} pts)`,
              severity: 'INFO',
              timestamp: `${current.trading_date}T16:00:00Z`,
              read: false,
            });
          }
        }
      }

      // Sort by timestamp desc
      notifs.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
      setNotifications(notifs);
    } catch (err) {
      console.error('Failed to fetch notifications:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (open) fetchNotifications();
  }, [open, fetchNotifications]);

  return (
    <AnimatePresence>
      {open && (
        <>
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="fixed inset-0 z-40 bg-void/60 backdrop-blur-[2px]"
            onClick={onClose}
          />

          {/* Panel */}
          <motion.div
            initial={{ x: -320, opacity: 0 }}
            animate={{ x: 0, opacity: 1 }}
            exit={{ x: -320, opacity: 0 }}
            transition={{ type: 'spring', damping: 28, stiffness: 300 }}
            className="fixed left-24 top-4 bottom-4 z-50 w-[340px] overflow-hidden rounded-2xl liquid-glass"
          >
            {/* Header */}
            <div className="flex items-center justify-between border-b border-white/[0.04] px-5 py-4">
              <div>
                <h2 className="font-mono text-xs font-semibold uppercase tracking-[0.15em] text-text-primary">
                  Notifications
                </h2>
                <p className="mt-0.5 font-mono text-[12px] text-text-dim">
                  {notifications.length} event{notifications.length !== 1 ? 's' : ''} · last 7 days
                </p>
              </div>
              <button
                onClick={onClose}
                className="flex h-7 w-7 items-center justify-center rounded-lg text-text-dim transition-colors hover:text-text-secondary liquid-glass-tab"
              >
                <X size={14} />
              </button>
            </div>

            {/* Notification list */}
            <div className="flex-1 overflow-auto px-3 py-3" style={{ maxHeight: 'calc(100% - 60px)' }}>
              {loading ? (
                <div className="flex items-center justify-center py-12">
                  <span className="inline-block h-4 w-4 animate-spin rounded-full border-2 border-text-dim/30 border-t-positive" />
                </div>
              ) : notifications.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-16">
                  <Shield size={24} className="mb-3 text-text-dim" />
                  <p className="font-mono text-[12px] text-text-muted">All clear</p>
                  <p className="mt-1 font-mono text-[12px] text-text-dim">No events in the last 7 days</p>
                </div>
              ) : (
                <div className="space-y-1.5">
                  {notifications.map((notif, i) => {
                    const Icon = getIcon(notif.type);
                    const color = getSeverityColor(notif.severity);

                    return (
                      <motion.div
                        key={notif.id}
                        initial={{ opacity: 0, y: 8 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: i * 0.03 }}
                        className="group rounded-xl px-3.5 py-3 transition-colors hover:bg-white/[0.02] liquid-glass-tab"
                      >
                        <div className="flex gap-3">
                          {/* Icon */}
                          <div
                            className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-lg"
                            style={{ backgroundColor: `${color}10`, border: `1px solid ${color}25` }}
                          >
                            <Icon size={13} style={{ color }} />
                          </div>

                          {/* Content */}
                          <div className="min-w-0 flex-1">
                            <div className="flex items-center justify-between gap-2">
                              <p className="truncate font-mono text-[12px] font-semibold text-text-primary">
                                {notif.title}
                              </p>
                              <span className="shrink-0 font-mono text-[12px] text-text-dim">
                                {timeAgo(notif.timestamp)}
                              </span>
                            </div>
                            <p className="mt-0.5 font-mono text-[12px] text-text-muted">
                              {notif.description}
                            </p>
                          </div>
                        </div>
                      </motion.div>
                    );
                  })}
                </div>
              )}
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
