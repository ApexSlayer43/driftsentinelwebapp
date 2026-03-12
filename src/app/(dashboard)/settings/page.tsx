'use client';

import { useState, useEffect } from 'react';
import { Save, Plus, Trash2, X, Shield, Plug, Unplug, ExternalLink, Loader2, Puzzle } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import type { SessionConfig } from '@/lib/types';
import Link from 'next/link';

// ── Main page ──────────────────────────────────────────────────
export default function SettingsPage() {
  const [maxContracts, setMaxContracts] = useState(1);
  const [maxFillsPerDay, setMaxFillsPerDay] = useState(20);
  const [baselineWindowFills, setBaselineWindowFills] = useState(50);
  const [scoringWindowFills, setScoringWindowFills] = useState(20);
  const [sessions, setSessions] = useState<SessionConfig[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [accountRef, setAccountRef] = useState<string | null>(null);

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
      }
      setLoading(false);
    }

    loadSettings();
  }, []);

  async function handleSave() {
    if (!accountRef) return;
    setSaving(true);
    setSaved(false);

    const supabase = createClient();
    const { error } = await supabase
      .from('user_configs')
      .upsert({
        account_ref: accountRef,
        max_contracts: maxContracts,
        max_fills_per_day: maxFillsPerDay,
        baseline_window_fills: baselineWindowFills,
        scoring_window_fills: scoringWindowFills,
        sessions_utc: sessions as unknown as Record<string, unknown>,
        updated_at: new Date().toISOString(),
      });

    setSaving(false);
    if (!error) {
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
    }
  }

  function addSession() {
    setSessions([...sessions, { name: '', start_utc: '09:30', end_utc: '16:00', days: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri'] }]);
  }

  function removeSession(index: number) {
    setSessions(sessions.filter((_, i) => i !== index));
  }

  function updateSession(index: number, field: keyof SessionConfig, value: string | string[]) {
    const updated = [...sessions];
    updated[index] = { ...updated[index], [field]: value };
    setSessions(updated);
  }

  if (loading) {
    return (
      <div className="flex h-full items-center justify-center">
        <div className="h-5 w-5 animate-spin rounded-full border-2 border-stable border-t-transparent" />
      </div>
    );
  }

  return (
    <div className="overflow-auto px-8 py-8">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-display text-2xl font-bold text-text-primary">Settings</h1>
          <p className="mt-1 font-mono text-xs text-text-muted">Configure trading rules and session windows</p>
        </div>
        <button
          onClick={handleSave}
          disabled={saving}
          className="flex items-center gap-2 rounded-lg bg-stable px-4 py-2 font-mono text-sm font-bold text-void transition-opacity hover:opacity-90 disabled:opacity-50"
        >
          <Save size={14} />
          {saving ? 'Saving...' : saved ? 'Saved' : 'Save Changes'}
        </button>
      </div>

      <div className="mt-8 grid gap-6">
        {/* Protocol — managed on dedicated page */}
        <Link
          href="/protocol"
          className="group flex items-center justify-between rounded-xl glass p-6 transition-colors hover:bg-raised/30"
        >
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-stable/10">
              <Shield size={16} className="text-stable" />
            </div>
            <div>
              <h3 className="font-display text-sm font-bold text-text-primary">Protocol</h3>
              <p className="mt-0.5 font-mono text-[10px] text-text-muted">
                Upload and manage your trading protocol rules
              </p>
            </div>
          </div>
          <ExternalLink size={14} className="text-text-dim group-hover:text-stable transition-colors" />
        </Link>

        {/* Trading Rules */}
        <div className="rounded-xl glass p-6">
          <h3 className="font-display text-sm font-bold text-text-primary">Trading Rules</h3>
          <p className="mt-1 font-mono text-[10px] text-text-muted">Define your maximum position sizes and activity limits</p>
          <div className="mt-4 grid grid-cols-2 gap-4">
            <div>
              <label className="mb-1.5 block font-mono text-[9px] font-semibold uppercase tracking-[0.15em] text-text-muted">
                Max Contracts
              </label>
              <input
                type="number"
                min={1}
                value={maxContracts}
                onChange={(e) => setMaxContracts(parseInt(e.target.value) || 1)}
                className="w-full rounded-lg border border-border-subtle glass-input px-3 py-2 font-mono text-sm text-text-primary outline-none focus:border-stable"
              />
            </div>
            <div>
              <label className="mb-1.5 block font-mono text-[9px] font-semibold uppercase tracking-[0.15em] text-text-muted">
                Max Fills Per Day
              </label>
              <input
                type="number"
                min={1}
                value={maxFillsPerDay}
                onChange={(e) => setMaxFillsPerDay(parseInt(e.target.value) || 20)}
                className="w-full rounded-lg border border-border-subtle glass-input px-3 py-2 font-mono text-sm text-text-primary outline-none focus:border-stable"
              />
            </div>
          </div>
        </div>

        {/* Session Windows */}
        <div className="rounded-xl glass p-6">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="font-display text-sm font-bold text-text-primary">Session Windows</h3>
              <p className="mt-1 font-mono text-[10px] text-text-muted">Define when you trade. Fills outside these windows are flagged.</p>
            </div>
            <button
              onClick={addSession}
              className="flex items-center gap-1 font-mono text-[10px] text-stable hover:underline"
            >
              <Plus size={12} /> Add Session
            </button>
          </div>
          <div className="mt-4 space-y-3">
            {sessions.length === 0 ? (
              <p className="font-mono text-xs text-text-muted">No sessions configured. All trading times are considered valid.</p>
            ) : (
              sessions.map((session, i) => (
                <div key={i} className="flex items-center gap-3 rounded-lg glass-raised p-3">
                  <input
                    type="text"
                    placeholder="Session name"
                    value={session.name}
                    onChange={(e) => updateSession(i, 'name', e.target.value)}
                    className="w-32 rounded border border-border-subtle glass-input px-2 py-1 font-mono text-[10px] text-text-primary outline-none focus:border-stable"
                  />
                  <input
                    type="time"
                    value={session.start_utc}
                    onChange={(e) => updateSession(i, 'start_utc', e.target.value)}
                    className="rounded border border-border-subtle glass-input px-2 py-1 font-mono text-[10px] text-text-primary outline-none focus:border-stable"
                  />
                  <span className="font-mono text-[10px] text-text-muted">to</span>
                  <input
                    type="time"
                    value={session.end_utc}
                    onChange={(e) => updateSession(i, 'end_utc', e.target.value)}
                    className="rounded border border-border-subtle glass-input px-2 py-1 font-mono text-[10px] text-text-primary outline-none focus:border-stable"
                  />
                  <div className="flex-1 flex gap-1">
                    {['Mon', 'Tue', 'Wed', 'Thu', 'Fri'].map((day) => (
                      <button
                        key={day}
                        onClick={() => {
                          const days = session.days.includes(day)
                            ? session.days.filter(d => d !== day)
                            : [...session.days, day];
                          updateSession(i, 'days', days);
                        }}
                        className={`rounded px-1.5 py-0.5 font-mono text-[8px] font-bold ${
                          session.days.includes(day)
                            ? 'bg-stable/20 text-stable'
                            : 'bg-elevated text-text-dim'
                        }`}
                      >
                        {day}
                      </button>
                    ))}
                  </div>
                  <button onClick={() => removeSession(i)} className="text-text-dim hover:text-breakdown">
                    <Trash2 size={12} />
                  </button>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Baseline Configuration */}
        <div className="rounded-xl glass p-6">
          <h3 className="font-display text-sm font-bold text-text-primary">Baseline Configuration</h3>
          <p className="mt-1 font-mono text-[10px] text-text-muted">Controls how many fills are needed to establish your trading baseline</p>
          <div className="mt-4 grid grid-cols-2 gap-4">
            <div>
              <label className="mb-1.5 block font-mono text-[9px] font-semibold uppercase tracking-[0.15em] text-text-muted">
                Baseline Window Fills
              </label>
              <input
                type="number"
                min={10}
                value={baselineWindowFills}
                onChange={(e) => setBaselineWindowFills(parseInt(e.target.value) || 50)}
                className="w-full rounded-lg border border-border-subtle glass-input px-3 py-2 font-mono text-sm text-text-primary outline-none focus:border-stable"
              />
            </div>
            <div>
              <label className="mb-1.5 block font-mono text-[9px] font-semibold uppercase tracking-[0.15em] text-text-muted">
                Scoring Window Fills
              </label>
              <input
                type="number"
                min={5}
                value={scoringWindowFills}
                onChange={(e) => setScoringWindowFills(parseInt(e.target.value) || 20)}
                className="w-full rounded-lg border border-border-subtle glass-input px-3 py-2 font-mono text-sm text-text-primary outline-none focus:border-stable"
              />
            </div>
          </div>
        </div>

        {/* Connect Extension */}
        <div className="rounded-xl glass p-6">
          <h3 className="font-display text-sm font-bold text-text-primary">Chrome Extension</h3>
          <p className="mt-1 font-mono text-[10px] text-text-muted">
            Connect the Drift Sentinel extension for real-time monitoring
          </p>

          <div className="mt-4 space-y-2">
            {extStatus === 'loading' && (
              <div className="flex items-center gap-2 rounded-lg glass-raised p-3">
                <Loader2 size={14} className="animate-spin text-text-muted" />
                <span className="font-mono text-[10px] text-text-muted">Detecting extension...</span>
              </div>
            )}

            {extStatus === 'not_installed' && (
              <div className="flex items-center justify-between rounded-lg glass-raised p-3">
                <div className="flex items-center gap-3">
                  <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-text-dim/10">
                    <Puzzle size={16} className="text-text-dim" />
                  </div>
                  <div>
                    <div className="font-mono text-[10px] font-semibold text-text-secondary">Extension not detected</div>
                    <div className="font-mono text-[8px] text-text-dim">Install the Chrome extension for live monitoring</div>
                  </div>
                </div>
                <a
                  href="https://github.com/ApexSlayer43/drift-sentinel-extension"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-1.5 rounded-lg bg-elevated px-3 py-1.5 font-mono text-[10px] font-semibold text-text-secondary hover:text-stable transition-colors"
                >
                  <ExternalLink size={10} /> Install Extension
                </a>
              </div>
            )}

            {(extStatus === 'detected' || extStatus === 'connecting') && (
              <div className="flex items-center justify-between rounded-lg glass-raised p-3">
                <div className="flex items-center gap-3">
                  <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-amber-500/10">
                    <Unplug size={16} className="text-amber-400" />
                  </div>
                  <div>
                    <div className="font-mono text-[10px] font-semibold text-text-secondary">Extension detected</div>
                    <div className="font-mono text-[8px] text-text-dim">Connect to enable real-time behavioral monitoring</div>
                  </div>
                </div>
                <button
                  onClick={connectExtension}
                  disabled={extStatus === 'connecting'}
                  className="flex items-center gap-1.5 rounded-lg bg-stable px-3 py-1.5 font-mono text-[10px] font-bold text-void transition-opacity hover:opacity-90 disabled:opacity-50"
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
              <div className="flex items-center justify-between rounded-lg glass-raised p-3">
                <div className="flex items-center gap-3">
                  <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-stable/10">
                    <Plug size={16} className="text-stable" />
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="h-1.5 w-1.5 rounded-full bg-stable animate-pulse" />
                    <div className="font-mono text-[10px] font-semibold text-stable">Extension Connected</div>
                  </div>
                </div>
                <button
                  onClick={disconnectExtension}
                  className="flex items-center gap-1 font-mono text-[10px] text-text-dim hover:text-breakdown transition-colors"
                >
                  <Unplug size={10} /> Disconnect
                </button>
              </div>
            )}

            {extError && (
              <div className="flex items-center gap-2 rounded-lg border border-breakdown/20 bg-breakdown/[0.04] px-3 py-2">
                <X size={12} className="text-breakdown shrink-0" />
                <span className="font-mono text-[9px] text-breakdown">{extError}</span>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
