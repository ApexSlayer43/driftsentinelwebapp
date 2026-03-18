'use client';

import { useState, useEffect } from 'react';
import { Save, Plus, Trash2, X, Plug, Unplug, ExternalLink, Loader2, Puzzle, Globe, Clock, Zap, Rocket } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import type { SessionConfig } from '@/lib/types';
import { GlowPanel } from '@/components/ui/glow-panel';
import { useOnboarding } from '@/lib/onboarding-context';

// ── Common IANA timezones for user timezone ────────────────────
const COMMON_TIMEZONES = [
  'America/New_York',
  'America/Chicago',
  'America/Denver',
  'America/Los_Angeles',
  'America/Anchorage',
  'Pacific/Honolulu',
  'America/Sao_Paulo',
  'Europe/London',
  'Europe/Berlin',
  'Europe/Paris',
  'Europe/Moscow',
  'Asia/Dubai',
  'Asia/Kolkata',
  'Asia/Singapore',
  'Asia/Tokyo',
  'Asia/Shanghai',
  'Asia/Hong_Kong',
  'Australia/Sydney',
];

// ── Market timezone options for session configs ────────────────
const MARKET_TIMEZONES = [
  { value: 'America/Chicago', label: 'Chicago (CME/CBOT)' },
  { value: 'America/New_York', label: 'New York (NYSE/NASDAQ)' },
  { value: 'Europe/Berlin', label: 'Berlin (Eurex)' },
  { value: 'Europe/London', label: 'London (ICE/LSE)' },
  { value: 'Asia/Tokyo', label: 'Tokyo (JPX)' },
  { value: 'Asia/Singapore', label: 'Singapore (SGX)' },
  { value: 'Asia/Hong_Kong', label: 'Hong Kong (HKEX)' },
];

// ── Market session presets ─────────────────────────────────────
const MARKET_PRESETS: SessionConfig[] = [
  {
    name: 'US Futures RTH',
    start_utc: '09:30',
    end_utc: '16:00',
    start_local: '09:30',
    end_local: '16:00',
    days: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri'],
    market_tz: 'America/Chicago',
  },
  {
    name: 'CME Globex',
    start_utc: '17:00',
    end_utc: '16:00',
    start_local: '17:00',
    end_local: '16:00',
    days: ['Sun', 'Mon', 'Tue', 'Wed', 'Thu'],
    market_tz: 'America/Chicago',
  },
  {
    name: 'US Equities RTH',
    start_utc: '09:30',
    end_utc: '16:00',
    start_local: '09:30',
    end_local: '16:00',
    days: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri'],
    market_tz: 'America/New_York',
  },
  {
    name: 'EU Futures (Eurex)',
    start_utc: '08:00',
    end_utc: '22:00',
    start_local: '08:00',
    end_local: '22:00',
    days: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri'],
    market_tz: 'Europe/Berlin',
  },
];

// ── Format timezone for display ────────────────────────────────
function formatTzLabel(tz: string): string {
  try {
    const now = new Date();
    const formatter = new Intl.DateTimeFormat('en-US', {
      timeZone: tz,
      timeZoneName: 'shortOffset',
    });
    const parts = formatter.formatToParts(now);
    const offsetPart = parts.find(p => p.type === 'timeZoneName')?.value ?? '';
    const city = tz.split('/').pop()?.replace(/_/g, ' ') ?? tz;
    return `${city} (${offsetPart})`;
  } catch {
    return tz;
  }
}

// ── Main page ──────────────────────────────────────────────────
export default function SettingsPage() {
  const [maxContracts, setMaxContracts] = useState(1);
  const [maxFillsPerDay, setMaxFillsPerDay] = useState(20);
  const [baselineWindowFills, setBaselineWindowFills] = useState(50);
  const [scoringWindowFills, setScoringWindowFills] = useState(20);
  const [sessions, setSessions] = useState<SessionConfig[]>([]);
  const [timezone, setTimezone] = useState<string>('');
  const [profileGoal, setProfileGoal] = useState<string>('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [accountRef, setAccountRef] = useState<string | null>(null);

  // ── Onboarding ───────────────────────────────────────────────
  const { isActive: onboardingActive, startOnboarding, resetOnboarding, progress: onboardingProgress } = useOnboarding();

  // ── Extension connection state ──────────────────────────────
  const [extStatus, setExtStatus] = useState<'loading' | 'not_installed' | 'detected' | 'connecting' | 'connected'>('loading');
  const [extError, setExtError] = useState<string | null>(null);

  useEffect(() => {
    function handleMessage(event: MessageEvent) {
      if (event.source !== window) return;
      if (!event.data || event.data.target !== 'drift-sentinel-webapp') return;

      if (event.data.type === 'DS_PONG' || event.data.type === 'DS_EXTENSION_READY') {
        setExtStatus(prev => prev === 'connected' ? prev : 'detected');
      }
      if (event.data.type === 'DS_STATUS') {
        setExtStatus(event.data.connected ? 'connected' : 'detected');
      }
      if (event.data.type === 'DS_CONFIG_SAVED') {
        if (event.data.ok) setExtStatus('connected');
        else setExtError(event.data.error || 'Extension failed to save config');
      }
    }

    window.addEventListener('message', handleMessage);

    // Ping the extension — handles SPA navigation where bridge.js already loaded
    window.postMessage({ target: 'drift-sentinel-companion', type: 'DS_PING' }, '*');

    // If no response arrives within 3s, extension is not installed
    const timeout = setTimeout(() => {
      setExtStatus(prev => prev === 'loading' ? 'not_installed' : prev);
    }, 3000);

    return () => {
      window.removeEventListener('message', handleMessage);
      clearTimeout(timeout);
    };
  }, []);

  async function connectExtension() {
    setExtStatus('connecting');
    setExtError(null);

    try {
      // Use the deterministic provision endpoint (same token every time for same user)
      const res = await fetch('/api/device/provision', { method: 'POST' });

      if (!res.ok) {
        const errData = await res.json().catch(() => null);
        setExtError(errData?.error || `Provision failed (${res.status})`);
        setExtStatus('detected');
        return;
      }

      const data = await res.json();
      window.postMessage({
        target: 'drift-sentinel-companion',
        type: 'DS_SET_CONFIG',
        config: {
          deviceToken: data.device_token,
          apiBaseUrl: data.api_base_url,
        },
      }, '*');

      // Wait for DS_CONFIG_SAVED — fall back to detected after 3s if no response
      setTimeout(() => {
        setExtStatus(prev => prev === 'connecting' ? 'detected' : prev);
      }, 3000);
    } catch {
      setExtError('Connection failed. Check your network.');
      setExtStatus('detected');
    }
  }

  function disconnectExtension() {
    setExtError(null);
    setExtStatus('detected');
  }

  useEffect(() => {
    async function loadSettings() {
      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        setLoading(false);
        return;
      }

      const { data: accounts } = await supabase
        .from('accounts')
        .select('account_ref')
        .eq('user_id', user.id)
        .limit(1);

      if (!accounts || accounts.length === 0) {
        setLoading(false);
        return;
      }

      setAccountRef(accounts[0].account_ref);

      const { data: config } = await supabase
        .from('user_configs')
        .select('*')
        .eq('account_ref', accounts[0].account_ref)
        .single();

      if (config) {
        setMaxContracts(config.max_contracts);
        setMaxFillsPerDay(config.max_fills_per_day);
        setBaselineWindowFills(config.baseline_window_fills);
        setScoringWindowFills(config.scoring_window_fills);
        setSessions((config.sessions_utc as SessionConfig[]) || []);
        setTimezone((config.timezone as string) || '');
        setProfileGoal((config.profile_goal as string) || '');
      }

      // Auto-detect timezone from browser if not set yet
      if (!config?.timezone) {
        try {
          const detected = Intl.DateTimeFormat().resolvedOptions().timeZone;
          if (detected) setTimezone(detected);
        } catch {
          // ignore — will use empty
        }
      }

      setLoading(false);
    }

    loadSettings();
  }, []);

  const [saveError, setSaveError] = useState<string | null>(null);

  async function handleSave() {
    if (!accountRef) return;
    setSaving(true);
    setSaved(false);
    setSaveError(null);

    try {
      const res = await fetch('/api/settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          account_ref: accountRef,
          max_contracts: maxContracts,
          max_fills_per_day: maxFillsPerDay,
          baseline_window_fills: baselineWindowFills,
          scoring_window_fills: scoringWindowFills,
          sessions_utc: sessions,
          timezone: timezone || null,
          profile_goal: profileGoal || null,
        }),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || `Save failed (${res.status})`);
      }

      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
    } catch (err) {
      setSaveError(err instanceof Error ? err.message : 'Failed to save settings');
    } finally {
      setSaving(false);
    }
  }

  function addSession() {
    setSessions([...sessions, {
      name: '',
      start_utc: '09:30',
      end_utc: '16:00',
      start_local: '09:30',
      end_local: '16:00',
      days: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri'],
      market_tz: 'America/Chicago',
    }]);
  }

  function addPreset(preset: SessionConfig) {
    // Don't add duplicates
    const exists = sessions.some(s => s.name === preset.name);
    if (exists) return;
    setSessions([...sessions, { ...preset }]);
  }

  function removeSession(index: number) {
    setSessions(sessions.filter((_, i) => i !== index));
  }

  function updateSession(index: number, field: keyof SessionConfig, value: string | string[]) {
    const updated = [...sessions];
    const current = updated[index];
    updated[index] = { ...current, [field]: value };

    // Keep start_local/end_local synced with start_utc/end_utc
    if (field === 'start_utc') {
      updated[index] = { ...updated[index], start_local: value as string };
    } else if (field === 'end_utc') {
      updated[index] = { ...updated[index], end_local: value as string };
    }

    setSessions(updated);
  }

  function autoDetectTimezone() {
    try {
      const detected = Intl.DateTimeFormat().resolvedOptions().timeZone;
      if (detected) setTimezone(detected);
    } catch {
      // ignore
    }
  }

  if (loading) {
    return (
      <div className="flex h-full items-center justify-center">
        <div className="h-5 w-5 animate-spin rounded-full border-2 border-positive border-t-transparent" />
      </div>
    );
  }

  return (
    <div className="overflow-auto px-8 py-8">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-display text-2xl font-bold text-text-primary">Settings</h1>
          <p className="mt-1 font-mono text-xs text-text-muted">Configure trading rules, timezone, and session windows</p>
        </div>
        <div className="flex items-center gap-3">
          {!onboardingActive && (
            <button
              onClick={onboardingProgress >= 100 ? resetOnboarding : startOnboarding}
              className="flex items-center gap-2 rounded-lg border border-positive/20 bg-positive/[0.06] px-3 py-2 font-mono text-xs font-semibold text-positive transition-colors hover:bg-positive/[0.12]"
            >
              <Rocket size={14} />
              {onboardingProgress >= 100 ? 'Restart Tutorial' : 'Tutorial'}
              {onboardingProgress < 100 && (
                <span className="ml-0.5 rounded bg-positive/20 px-1.5 py-0.5 font-mono text-[10px] font-bold">
                  {onboardingProgress}%
                </span>
              )}
            </button>
          )}
          <button
            onClick={handleSave}
            disabled={saving}
            className="flex items-center gap-2 rounded-lg bg-accent-primary px-4 py-2 font-mono text-sm font-bold text-void transition-opacity hover:opacity-90 disabled:opacity-50"
          >
            <Save size={14} />
            {saving ? 'Saving...' : saved ? 'Saved ✓' : 'Save Changes'}
          </button>
        </div>
      </div>

      {saveError && (
        <div className="mt-4 flex items-center gap-2 rounded-lg border border-negative/20 bg-negative/[0.06] px-4 py-2.5">
          <X size={14} className="text-negative shrink-0" />
          <span className="font-mono text-[12px] text-negative">{saveError}</span>
          <button onClick={() => setSaveError(null)} className="ml-auto text-negative/50 hover:text-negative">
            <X size={12} />
          </button>
        </div>
      )}

      <div className="mt-8 grid gap-6">
        {/* Timezone */}
        <div data-onboard="timezone-picker">
        <GlowPanel className="p-6">
          <div className="flex items-center gap-2 mb-1">
            <Globe size={14} className="text-positive" />
            <h3 className="font-display text-sm font-bold text-text-primary">Your Timezone</h3>
          </div>
          <p className="font-mono text-[12px] text-text-muted">
            Used to correctly resolve session windows across DST transitions
          </p>
          <div className="mt-4 flex items-center gap-3">
            <select
              value={timezone}
              onChange={(e) => setTimezone(e.target.value)}
              className="flex-1 rounded-lg border border-border-subtle bg-white/[0.04] backdrop-blur-xl px-3 py-2 font-mono text-sm text-text-primary outline-none focus:border-accent-primary bg-transparent"
            >
              <option value="">Select timezone...</option>
              {COMMON_TIMEZONES.map(tz => (
                <option key={tz} value={tz}>{formatTzLabel(tz)}</option>
              ))}
            </select>
            <button
              onClick={autoDetectTimezone}
              className="flex items-center gap-1.5 rounded-lg border border-border-subtle px-3 py-2 font-mono text-[12px] text-text-secondary hover:border-accent-primary hover:text-positive transition-colors"
              title="Auto-detect from browser"
            >
              <Zap size={12} /> Detect
            </button>
          </div>
          {timezone && (
            <div className="mt-2 font-mono text-[12px] text-text-dim">
              Current: {formatTzLabel(timezone)}
            </div>
          )}
        </GlowPanel>
        </div>

        {/* Profile Goal — North Star */}
        <GlowPanel className="p-6">
          <div className="flex items-center gap-2 mb-1">
            <Rocket size={14} className="text-positive" />
            <h3 className="font-display text-sm font-bold text-text-primary">Your Trading Goal</h3>
          </div>
          <p className="font-mono text-[12px] text-text-muted">
            Your north star — why you trade. Senti will reflect this back during cooldown interventions.
          </p>
          <textarea
            value={profileGoal}
            onChange={(e) => setProfileGoal(e.target.value)}
            placeholder="e.g., Build a funded account to replace my disability income"
            rows={2}
            className="mt-4 w-full rounded-lg border border-border-subtle bg-white/[0.04] backdrop-blur-xl px-3 py-2 font-mono text-sm text-text-primary outline-none focus:border-accent-primary bg-transparent resize-none placeholder:text-text-dim"
          />
          {profileGoal && (
            <div className="mt-2 font-mono text-[10px] text-text-dim uppercase tracking-widest">
              Senti will use this during cooldown mode
            </div>
          )}
        </GlowPanel>

        {/* Trading Rules */}
        <div data-onboard="trading-rules">
        <GlowPanel className="p-6">
          <h3 className="font-display text-sm font-bold text-text-primary">Trading Rules</h3>
          <p className="mt-1 font-mono text-[12px] text-text-muted">Define your maximum position sizes and activity limits</p>
          <div className="mt-4 grid grid-cols-2 gap-4">
            <div>
              <label className="mb-1.5 block font-mono text-[12px] font-semibold uppercase tracking-[0.15em] text-text-muted">
                Max Contracts
              </label>
              <input
                type="number"
                min={1}
                value={maxContracts}
                onChange={(e) => setMaxContracts(parseInt(e.target.value) || 1)}
                className="w-full rounded-lg border border-border-subtle bg-white/[0.04] backdrop-blur-xl px-3 py-2 font-mono text-sm text-text-primary outline-none focus:border-accent-primary"
              />
            </div>
            <div>
              <label className="mb-1.5 block font-mono text-[12px] font-semibold uppercase tracking-[0.15em] text-text-muted">
                Max Fills Per Day
              </label>
              <input
                type="number"
                min={1}
                value={maxFillsPerDay}
                onChange={(e) => setMaxFillsPerDay(parseInt(e.target.value) || 20)}
                className="w-full rounded-lg border border-border-subtle bg-white/[0.04] backdrop-blur-xl px-3 py-2 font-mono text-sm text-text-primary outline-none focus:border-accent-primary"
              />
            </div>
          </div>
        </GlowPanel>
        </div>

        {/* Session Windows */}
        <div data-onboard="session-windows">
        <GlowPanel className="p-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Clock size={14} className="text-positive" />
              <div>
                <h3 className="font-display text-sm font-bold text-text-primary">Session Windows</h3>
                <p className="mt-1 font-mono text-[12px] text-text-muted">
                  Define when you trade. Times are in the market&apos;s local timezone. Fills outside these windows are flagged.
                </p>
              </div>
            </div>
            <button
              onClick={addSession}
              className="flex items-center gap-1 font-mono text-[12px] text-positive hover:underline"
            >
              <Plus size={12} /> Add Session
            </button>
          </div>

          {/* Market Presets */}
          <div className="mt-3 flex flex-wrap gap-2">
            <span className="font-mono text-[10px] uppercase tracking-[0.15em] text-text-dim self-center mr-1">Presets:</span>
            {MARKET_PRESETS.map((preset) => {
              const alreadyAdded = sessions.some(s => s.name === preset.name);
              return (
                <button
                  key={preset.name}
                  onClick={() => addPreset(preset)}
                  disabled={alreadyAdded}
                  className={`rounded-md px-2.5 py-1 font-mono text-[11px] transition-colors ${
                    alreadyAdded
                      ? 'bg-accent-primary/10 text-positive/50 cursor-default'
                      : 'bg-white/[0.04] text-text-secondary hover:bg-accent-primary/15 hover:text-positive'
                  }`}
                >
                  {preset.name}
                </button>
              );
            })}
          </div>

          <div className="mt-4 space-y-3">
            {sessions.length === 0 ? (
              <p className="font-mono text-xs text-text-muted">No sessions configured. Add a preset or create a custom session.</p>
            ) : (
              sessions.map((session, i) => (
                <div key={i} className="rounded-lg bg-white/[0.04] backdrop-blur-xl border border-white/[0.08] p-3 space-y-2">
                  {/* Row 1: Name + Market Timezone + Delete */}
                  <div className="flex items-center gap-3">
                    <input
                      type="text"
                      placeholder="Session name"
                      value={session.name}
                      onChange={(e) => updateSession(i, 'name', e.target.value)}
                      className="w-36 rounded border border-border-subtle bg-white/[0.04] backdrop-blur-xl px-2 py-1 font-mono text-[12px] text-text-primary outline-none focus:border-accent-primary"
                    />
                    <select
                      value={session.market_tz || ''}
                      onChange={(e) => updateSession(i, 'market_tz', e.target.value)}
                      className="flex-1 rounded border border-border-subtle bg-white/[0.04] backdrop-blur-xl px-2 py-1 font-mono text-[11px] text-text-primary outline-none focus:border-accent-primary bg-transparent"
                    >
                      <option value="">Market timezone...</option>
                      {MARKET_TIMEZONES.map(mtz => (
                        <option key={mtz.value} value={mtz.value}>{mtz.label}</option>
                      ))}
                    </select>
                    <button onClick={() => removeSession(i)} className="text-text-dim hover:text-negative">
                      <Trash2 size={12} />
                    </button>
                  </div>
                  {/* Row 2: Times + Days */}
                  <div className="flex items-center gap-3">
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-[10px] uppercase text-text-dim">Local</span>
                      <input
                        type="time"
                        value={session.start_utc}
                        onChange={(e) => updateSession(i, 'start_utc', e.target.value)}
                        className="rounded border border-border-subtle bg-white/[0.04] backdrop-blur-xl px-2 py-1 font-mono text-[12px] text-text-primary outline-none focus:border-accent-primary"
                      />
                      <span className="font-mono text-[12px] text-text-muted">to</span>
                      <input
                        type="time"
                        value={session.end_utc}
                        onChange={(e) => updateSession(i, 'end_utc', e.target.value)}
                        className="rounded border border-border-subtle bg-white/[0.04] backdrop-blur-xl px-2 py-1 font-mono text-[12px] text-text-primary outline-none focus:border-accent-primary"
                      />
                    </div>
                    <div className="flex-1 flex gap-1">
                      {['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map((day) => (
                        <button
                          key={day}
                          onClick={() => {
                            const days = session.days.includes(day)
                              ? session.days.filter(d => d !== day)
                              : [...session.days, day];
                            updateSession(i, 'days', days);
                          }}
                          className={`rounded px-1.5 py-0.5 font-mono text-[10px] font-bold transition-colors ${
                            session.days.includes(day)
                              ? 'bg-accent-primary/20 text-positive'
                              : 'bg-white/[0.06] text-text-dim'
                          }`}
                        >
                          {day}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </GlowPanel>
        </div>

        {/* Baseline Configuration */}
        <GlowPanel className="p-6">
          <h3 className="font-display text-sm font-bold text-text-primary">Baseline Configuration</h3>
          <p className="mt-1 font-mono text-[12px] text-text-muted">Controls how many fills are needed to establish your trading baseline</p>
          <div className="mt-4 grid grid-cols-2 gap-4">
            <div>
              <label className="mb-1.5 block font-mono text-[12px] font-semibold uppercase tracking-[0.15em] text-text-muted">
                Baseline Window Fills
              </label>
              <input
                type="number"
                min={10}
                value={baselineWindowFills}
                onChange={(e) => setBaselineWindowFills(parseInt(e.target.value) || 50)}
                className="w-full rounded-lg border border-border-subtle bg-white/[0.04] backdrop-blur-xl px-3 py-2 font-mono text-sm text-text-primary outline-none focus:border-accent-primary"
              />
            </div>
            <div>
              <label className="mb-1.5 block font-mono text-[12px] font-semibold uppercase tracking-[0.15em] text-text-muted">
                Scoring Window Fills
              </label>
              <input
                type="number"
                min={5}
                value={scoringWindowFills}
                onChange={(e) => setScoringWindowFills(parseInt(e.target.value) || 20)}
                className="w-full rounded-lg border border-border-subtle bg-white/[0.04] backdrop-blur-xl px-3 py-2 font-mono text-sm text-text-primary outline-none focus:border-accent-primary"
              />
            </div>
          </div>
        </GlowPanel>

        {/* Connect Extension */}
        <GlowPanel className="p-6">
          <h3 className="font-display text-sm font-bold text-text-primary">Chrome Extension</h3>
          <p className="mt-1 font-mono text-[12px] text-text-muted">
            Connect the Drift Sentinel extension for real-time monitoring
          </p>

          <div className="mt-4 space-y-2">
            {extStatus === 'loading' && (
              <div className="flex items-center gap-2 rounded-lg bg-white/[0.04] backdrop-blur-xl border border-white/[0.08] p-3">
                <Loader2 size={14} className="animate-spin text-text-muted" />
                <span className="font-mono text-[12px] text-text-muted">Detecting extension...</span>
              </div>
            )}

            {extStatus === 'not_installed' && (
              <div className="flex items-center justify-between rounded-lg bg-white/[0.04] backdrop-blur-xl border border-white/[0.08] p-3">
                <div className="flex items-center gap-3">
                  <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-text-dim/10">
                    <Puzzle size={16} className="text-text-dim" />
                  </div>
                  <div>
                    <div className="font-mono text-[12px] font-semibold text-text-secondary">Extension not detected</div>
                    <div className="font-mono text-[12px] text-text-dim">Install the Chrome extension for live monitoring</div>
                  </div>
                </div>
                <a
                  href="https://github.com/ApexSlayer43/drift-sentinel-extension"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-1.5 rounded-lg bg-white/[0.04] backdrop-blur-xl border border-white/[0.08] px-3 py-1.5 font-mono text-[12px] font-semibold text-text-secondary hover:text-positive transition-colors"
                >
                  <ExternalLink size={10} /> Install Extension
                </a>
              </div>
            )}

            {(extStatus === 'detected' || extStatus === 'connecting') && (
              <div className="flex items-center justify-between rounded-lg bg-white/[0.04] backdrop-blur-xl border border-white/[0.08] p-3">
                <div className="flex items-center gap-3">
                  <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-amber-500/10">
                    <Unplug size={16} className="text-amber-400" />
                  </div>
                  <div>
                    <div className="font-mono text-[12px] font-semibold text-text-secondary">Extension detected</div>
                    <div className="font-mono text-[12px] text-text-dim">Connect to enable real-time behavioral monitoring</div>
                  </div>
                </div>
                <button
                  onClick={connectExtension}
                  disabled={extStatus === 'connecting'}
                  className="flex items-center gap-1.5 rounded-lg bg-accent-primary px-3 py-1.5 font-mono text-[12px] font-bold text-void transition-opacity hover:opacity-90 disabled:opacity-50"
                >
                  {extStatus === 'connecting' ? (
                    <><Loader2 size={10} className="animate-spin" /> Connecting...</>
                  ) : (
                    <><Plug size={10} /> Connect Extension</>
                  )}
                </button>
              </div>
            )}

            {extStatus === 'connected' && (
              <div className="flex items-center justify-between rounded-lg bg-white/[0.04] backdrop-blur-xl border border-white/[0.08] p-3">
                <div className="flex items-center gap-3">
                  <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-accent-primary/10">
                    <Plug size={16} className="text-positive" />
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="h-1.5 w-1.5 rounded-full bg-accent-primary animate-pulse" />
                    <div className="font-mono text-[12px] font-semibold text-positive">Extension Connected</div>
                  </div>
                </div>
                <button
                  onClick={disconnectExtension}
                  className="flex items-center gap-1 font-mono text-[12px] text-text-dim hover:text-negative transition-colors"
                >
                  <Unplug size={10} /> Disconnect
                </button>
              </div>
            )}

            {extError && (
              <div className="flex items-center gap-2 rounded-lg border border-breakdown/20 bg-breakdown/[0.04] px-3 py-2">
                <X size={12} className="text-breakdown shrink-0" />
                <span className="font-mono text-[12px] text-breakdown">{extError}</span>
              </div>
            )}
          </div>
        </GlowPanel>
      </div>
    </div>
  );
}
