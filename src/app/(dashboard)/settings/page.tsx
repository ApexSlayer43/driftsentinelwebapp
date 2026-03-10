'use client';

import { useState, useEffect, useCallback } from 'react';
import { Save, Plus, Trash2, Upload, FileText, Shield, Swords, Hammer, X, ChevronDown, ChevronRight, ToggleLeft, ToggleRight, Plug, Unplug, ExternalLink, Loader2, Puzzle } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import type { SessionConfig } from '@/lib/types';

// ── Canonical protocol rule types ──────────────────────────────
interface RuleParam {
  key: string;
  label: string;
  value: number | string | boolean;
  unit?: string;
  type: 'number' | 'string' | 'boolean' | 'percent';
  min?: number;
  max?: number;
}

interface ProtocolRule {
  id: string;
  category: string;
  name: string;
  description: string;
  params: RuleParam[];
  enabled: boolean;
}

interface ProtocolData {
  name: string;
  fileName: string;
  uploadedAt: string;
  rules: ProtocolRule[];
}

// ── Parse PDF text into canonical rules ────────────────────────
function canonicalizeProtocol(text: string, fileName: string): ProtocolData {
  const rules: ProtocolRule[] = [];
  const t = text.toLowerCase();

  // 1. Lifebar / Max Drawdown
  if (/lifebar|drawdown|max.*draw/i.test(text)) {
    const amountMatch = text.match(/\$([0-9,]+)\s*(?:lifebar|drawdown|end.?of.?day)/i);
    const pctMatch = text.match(/(\d+)%\s*(?:to\s*(\d+)%)?\s*max\s*drawdown/i);
    rules.push({
      id: 'lifebar',
      category: 'Risk',
      name: 'Max Drawdown (Lifebar)',
      description: 'Maximum drawdown limit that defines your true risk capital',
      enabled: true,
      params: [
        { key: 'amount', label: 'Lifebar Amount', value: amountMatch ? parseInt(amountMatch[1].replace(/,/g, '')) : 2000, unit: '$', type: 'number', min: 100 },
        { key: 'type', label: 'Drawdown Type', value: /end.?of.?day|eod/i.test(text) ? 'EOD' : 'Trailing', type: 'string' },
      ],
    });
  }

  // 2. Risk Tiers
  if (/tier|shield|sword|hammer|armory/i.test(text)) {
    const shieldPct = text.match(/shield[^%]*?(\d+)%/i);
    const swordPct = text.match(/sword[^%]*?(\d+)%/i);
    const hammerPct = text.match(/hammer[^%]*?(\d+)%/i);

    rules.push({
      id: 'tier-shield',
      category: 'Position Sizing',
      name: 'Tier 1: Shield',
      description: 'Conservative tier for new strategies or drawdown recovery',
      enabled: true,
      params: [
        { key: 'risk_pct', label: 'Lifebar Risk', value: shieldPct ? parseInt(shieldPct[1]) : 25, unit: '%', type: 'percent', min: 1, max: 100 },
        { key: 'max_losses', label: 'Max Consecutive Losses', value: 4, type: 'number', min: 1 },
      ],
    });
    rules.push({
      id: 'tier-sword',
      category: 'Position Sizing',
      name: 'Tier 2: Sword',
      description: 'Standard tier for proven consistent profitability',
      enabled: true,
      params: [
        { key: 'risk_pct', label: 'Lifebar Risk', value: swordPct ? parseInt(swordPct[1]) : 30, unit: '%', type: 'percent', min: 1, max: 100 },
        { key: 'max_losses', label: 'Max Consecutive Losses', value: 3, type: 'number', min: 1 },
      ],
    });
    rules.push({
      id: 'tier-hammer',
      category: 'Position Sizing',
      name: 'Tier 3: Hammer',
      description: 'Aggressive tier reserved for A+ setups with strong edge data',
      enabled: true,
      params: [
        { key: 'risk_pct', label: 'Lifebar Risk', value: hammerPct ? parseInt(hammerPct[1]) : 40, unit: '%', type: 'percent', min: 1, max: 100 },
        { key: 'max_losses', label: 'Max Consecutive Losses', value: 2, type: 'number', min: 1 },
      ],
    });
  }

  // 3. One-Shot Daily Rule
  if (/one.?shot|wounded|stop trading.*rest of the day/i.test(text)) {
    rules.push({
      id: 'one-shot',
      category: 'Session Rules',
      name: 'One-Shot Daily Rule',
      description: 'Stop trading for the day after taking a full stop loss',
      enabled: true,
      params: [
        { key: 'max_full_losses', label: 'Max Full Losses Per Day', value: 1, type: 'number', min: 1, max: 5 },
      ],
    });
  }

  // 4. Protect the Green
  if (/protect the green|green day|break.?even.*end.*session/i.test(text)) {
    rules.push({
      id: 'protect-green',
      category: 'Session Rules',
      name: 'Protect the Green',
      description: 'End session immediately if P&L retraces to breakeven after being green',
      enabled: true,
      params: [
        { key: 'stop_at_breakeven', label: 'Stop at Breakeven', value: true, type: 'boolean' },
      ],
    });
  }

  // 5. Volatility Filter
  if (/volatility.*filter|reduce size|wider stop/i.test(text)) {
    const reductionMatch = text.match(/(?:reduce.*?|by\s*)~?(\d+)%/i);
    rules.push({
      id: 'volatility-filter',
      category: 'Session Rules',
      name: 'Session Volatility Filter',
      description: 'Reduce position size when stop distance expands during high-volatility sessions',
      enabled: true,
      params: [
        { key: 'size_reduction', label: 'Size Reduction', value: reductionMatch ? parseInt(reductionMatch[1]) : 50, unit: '%', type: 'percent', min: 10, max: 90 },
      ],
    });
  }

  // 6. Ghost Equity / End-of-Day
  if (/ghost equity|close.*positions.*before.*bell|time stop/i.test(text)) {
    const minutesMatch = text.match(/(\d+)\s*minutes?\s*before/i);
    rules.push({
      id: 'ghost-equity',
      category: 'Session Rules',
      name: 'Ghost Equity Defense',
      description: 'Close all positions before the daily closing bell to avoid floating drawdown at settlement',
      enabled: true,
      params: [
        { key: 'minutes_before_close', label: 'Minutes Before Close', value: minutesMatch ? parseInt(minutesMatch[1]) : 15, unit: 'min', type: 'number', min: 1, max: 60 },
        { key: 'no_carry_floating', label: 'No Floating DD at Close', value: true, type: 'boolean' },
      ],
    });
  }

  // 7. Profit Allocation
  if (/treasury|profit allocation|payout|withdraw/i.test(text)) {
    const growthMatch = text.match(/(\d+)%\s*(?:active\s*)?account\s*growth/i);
    const armoryMatch = text.match(/(\d+)%\s*armory/i);
    const taxMatch = text.match(/(\d+)%\s*(?:crown|tax)/i);
    const wealthMatch = text.match(/(\d+)%\s*(?:sovereign|wealth|invest)/i);
    rules.push({
      id: 'profit-allocation',
      category: 'Capital',
      name: 'Profit Allocation',
      description: 'Split payouts into buckets for sustainability and growth',
      enabled: true,
      params: [
        { key: 'account_growth', label: 'Account Growth', value: growthMatch ? parseInt(growthMatch[1]) : 25, unit: '%', type: 'percent', min: 0, max: 100 },
        { key: 'armory_fund', label: 'Armory Fund', value: armoryMatch ? parseInt(armoryMatch[1]) : 20, unit: '%', type: 'percent', min: 0, max: 100 },
        { key: 'taxes', label: 'Taxes', value: taxMatch ? parseInt(taxMatch[1]) : 30, unit: '%', type: 'percent', min: 0, max: 100 },
        { key: 'wealth', label: 'Long-term Wealth', value: wealthMatch ? parseInt(wealthMatch[1]) : 25, unit: '%', type: 'percent', min: 0, max: 100 },
      ],
    });
  }

  // 8. Yield / Expectancy Model
  if (/expectancy|win rate|R per|yield/i.test(text)) {
    const wrMatch = text.match(/win\s*rate[:\s]*(\d+)%/i);
    const avgWinMatch = text.match(/average\s*win[:\s]*\+?([\d.]+)R/i);
    const avgLossMatch = text.match(/average\s*loss[:\s]*-?([\d.]+)R/i);
    const tradesMatch = text.match(/(\d+)\s*trades?\s*per\s*week/i);
    rules.push({
      id: 'yield-model',
      category: 'Capital',
      name: 'Expected Yield Model',
      description: 'Edge assumptions driving weekly yield projections',
      enabled: true,
      params: [
        { key: 'win_rate', label: 'Win Rate', value: wrMatch ? parseInt(wrMatch[1]) : 80, unit: '%', type: 'percent', min: 1, max: 100 },
        { key: 'avg_win_r', label: 'Avg Win (R)', value: avgWinMatch ? parseFloat(avgWinMatch[1]) : 0.5, type: 'number', min: 0.1 },
        { key: 'avg_loss_r', label: 'Avg Loss (R)', value: avgLossMatch ? parseFloat(avgLossMatch[1]) : 1.0, type: 'number', min: 0.1 },
        { key: 'trades_per_week', label: 'Trades / Week', value: tradesMatch ? parseInt(tradesMatch[1]) : 10, type: 'number', min: 1 },
      ],
    });
  }

  // Fallback if nothing matched
  if (rules.length === 0) {
    rules.push({
      id: 'generic',
      category: 'General',
      name: 'Trading Protocol',
      description: 'Protocol uploaded — add rules manually',
      enabled: true,
      params: [],
    });
  }

  return {
    name: fileName.replace(/\.pdf$/i, '').replace(/[-_]/g, ' '),
    fileName,
    uploadedAt: new Date().toISOString(),
    rules,
  };
}

// ── Category icons ─────────────────────────────────────────────
const CATEGORY_ICONS: Record<string, typeof Shield> = {
  'Risk': Shield,
  'Position Sizing': Swords,
  'Session Rules': Hammer,
  'Capital': FileText,
  'General': FileText,
};

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
  const [protocol, setProtocol] = useState<ProtocolData | null>(null);
  const [protocolDragOver, setProtocolDragOver] = useState(false);
  const [protocolUploading, setProtocolUploading] = useState(false);
  const [expandedCategories, setExpandedCategories] = useState<Set<string>>(new Set());

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

    let deviceId = localStorage.getItem('ds_device_id');
    if (!deviceId) {
      deviceId = crypto.randomUUID();
      localStorage.setItem('ds_device_id', deviceId);
    }

    try {
      const supabase = createClient();
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        setExtError('Session expired. Please log in again.');
        setExtStatus('detected');
        return;
      }

      // Look up the user's existing account_ref (matches CSV ingest format: WEB-XXXXXXXX)
      const { data: account } = await supabase
        .from('accounts')
        .select('account_ref')
        .eq('user_id', session.user.id)
        .single();

      const accountRef = account?.account_ref || `WEB-${session.user.id.slice(0, 8).toUpperCase()}`;

      const apiBaseUrl = process.env.NEXT_PUBLIC_API_URL || 'https://api.driftsentinel.io';

      const res = await fetch(`${apiBaseUrl}/v1/device/register`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${session.access_token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ device_id: deviceId, account_ref: accountRef }),
      });

      if (!res.ok) {
        const errData = await res.json().catch(() => null);
        setExtError(errData?.error || `Registration failed (${res.status})`);
        setExtStatus('detected');
        return;
      }

      const data = await res.json();
      window.postMessage({
        target: 'drift-sentinel-companion',
        type: 'DS_SET_CONFIG',
        config: {
          deviceToken: data.device_token,
          apiBaseUrl,
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
    localStorage.removeItem('ds_device_id');
    setExtError(null);
    setExtStatus('detected');
  }

  // Load saved protocol from localStorage
  useEffect(() => {
    const saved = localStorage.getItem('drift-sentinel-protocol');
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        setProtocol(parsed);
        // Expand all categories on load
        if (parsed.rules) {
          const cats = new Set<string>(parsed.rules.map((r: ProtocolRule) => r.category));
          setExpandedCategories(cats);
        }
      } catch { /* ignore */ }
    }
  }, []);

  const handleProtocolFile = useCallback(async (file: File) => {
    if (!file.name.toLowerCase().endsWith('.pdf')) return;
    setProtocolUploading(true);

    try {
      const text = await file.text();
      const data = canonicalizeProtocol(text, file.name);
      setProtocol(data);
      localStorage.setItem('drift-sentinel-protocol', JSON.stringify(data));
      // Expand all categories
      setExpandedCategories(new Set(data.rules.map(r => r.category)));
    } catch {
      // Fallback for unreadable PDFs
      const data: ProtocolData = {
        name: file.name.replace(/\.pdf$/i, '').replace(/[-_]/g, ' '),
        fileName: file.name,
        uploadedAt: new Date().toISOString(),
        rules: [{ id: 'generic', category: 'General', name: 'Trading Protocol', description: 'Protocol uploaded — add rules manually', enabled: true, params: [] }],
      };
      setProtocol(data);
      localStorage.setItem('drift-sentinel-protocol', JSON.stringify(data));
      setExpandedCategories(new Set(['General']));
    } finally {
      setProtocolUploading(false);
    }
  }, []);

  function removeProtocol() {
    setProtocol(null);
    localStorage.removeItem('drift-sentinel-protocol');
    setExpandedCategories(new Set());
  }

  function toggleRule(ruleId: string) {
    if (!protocol) return;
    const updated = {
      ...protocol,
      rules: protocol.rules.map(r => r.id === ruleId ? { ...r, enabled: !r.enabled } : r),
    };
    setProtocol(updated);
    localStorage.setItem('drift-sentinel-protocol', JSON.stringify(updated));
  }

  function updateRuleParam(ruleId: string, paramKey: string, value: number | string | boolean) {
    if (!protocol) return;
    const updated = {
      ...protocol,
      rules: protocol.rules.map(r => {
        if (r.id !== ruleId) return r;
        return {
          ...r,
          params: r.params.map(p => p.key === paramKey ? { ...p, value } : p),
        };
      }),
    };
    setProtocol(updated);
    localStorage.setItem('drift-sentinel-protocol', JSON.stringify(updated));
  }

  function toggleCategory(cat: string) {
    setExpandedCategories(prev => {
      const next = new Set(prev);
      if (next.has(cat)) next.delete(cat); else next.add(cat);
      return next;
    });
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

  // Group protocol rules by category
  const rulesByCategory: Record<string, ProtocolRule[]> = {};
  if (protocol) {
    for (const rule of protocol.rules) {
      if (!rulesByCategory[rule.category]) rulesByCategory[rule.category] = [];
      rulesByCategory[rule.category].push(rule);
    }
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
        {/* Protocol */}
        <div className="rounded-xl glass p-6">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="font-display text-sm font-bold text-text-primary">Protocol</h3>
              <p className="mt-1 font-mono text-[10px] text-text-muted">
                {protocol ? 'Rules canonicalized from your protocol' : 'Upload your trading protocol (PDF)'}
              </p>
            </div>
            {protocol && (
              <button
                onClick={removeProtocol}
                className="flex items-center gap-1 font-mono text-[10px] text-text-dim hover:text-breakdown transition-colors"
              >
                <X size={12} /> Remove
              </button>
            )}
          </div>

          {protocol ? (
            <div className="mt-4">
              {/* Protocol header */}
              <div className="flex items-center gap-3 rounded-lg glass-raised p-3">
                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-stable/10">
                  <Shield size={16} className="text-stable" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="font-display text-sm font-bold text-text-primary truncate">
                    {protocol.name}
                  </div>
                  <div className="font-mono text-[9px] text-text-muted">
                    {protocol.rules.length} rules extracted &middot; {protocol.rules.filter(r => r.enabled).length} active
                  </div>
                </div>
                <div className="font-mono text-[8px] text-text-dim shrink-0">
                  {new Date(protocol.uploadedAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                </div>
              </div>

              {/* Rules by category */}
              <div className="mt-3 space-y-2">
                {Object.entries(rulesByCategory).map(([category, catRules]) => {
                  const CatIcon = CATEGORY_ICONS[category] || FileText;
                  const isExpanded = expandedCategories.has(category);
                  const activeCount = catRules.filter(r => r.enabled).length;

                  return (
                    <div key={category} className="rounded-lg glass-raised overflow-hidden">
                      {/* Category header */}
                      <button
                        onClick={() => toggleCategory(category)}
                        className="flex w-full items-center gap-2.5 px-3 py-2.5 hover:bg-raised/50 transition-colors"
                      >
                        <CatIcon size={13} className="text-text-muted shrink-0" />
                        <span className="font-mono text-[10px] font-semibold text-text-secondary flex-1 text-left">
                          {category}
                        </span>
                        <span className="font-mono text-[8px] text-text-dim">
                          {activeCount}/{catRules.length}
                        </span>
                        {isExpanded
                          ? <ChevronDown size={12} className="text-text-dim" />
                          : <ChevronRight size={12} className="text-text-dim" />
                        }
                      </button>

                      {/* Rules */}
                      {isExpanded && (
                        <div className="border-t border-border-dim">
                          {catRules.map((rule) => (
                            <div key={rule.id} className={`px-3 py-3 border-b border-border-dim last:border-b-0 transition-opacity ${!rule.enabled ? 'opacity-40' : ''}`}>
                              {/* Rule header with toggle */}
                              <div className="flex items-center gap-2">
                                <button
                                  onClick={() => toggleRule(rule.id)}
                                  className="shrink-0"
                                >
                                  {rule.enabled
                                    ? <ToggleRight size={18} className="text-stable" />
                                    : <ToggleLeft size={18} className="text-text-dim" />
                                  }
                                </button>
                                <div className="flex-1 min-w-0">
                                  <div className="font-mono text-[10px] font-semibold text-text-primary">
                                    {rule.name}
                                  </div>
                                  <div className="font-mono text-[8px] text-text-muted leading-relaxed">
                                    {rule.description}
                                  </div>
                                </div>
                              </div>

                              {/* Editable params */}
                              {rule.enabled && rule.params.length > 0 && (
                                <div className="mt-2.5 ml-6 grid grid-cols-2 gap-x-4 gap-y-2">
                                  {rule.params.map((param) => (
                                    <div key={param.key}>
                                      <label className="mb-1 block font-mono text-[7px] font-semibold uppercase tracking-[0.15em] text-text-dim">
                                        {param.label}
                                      </label>
                                      {param.type === 'boolean' ? (
                                        <button
                                          onClick={() => updateRuleParam(rule.id, param.key, !param.value)}
                                          className={`rounded px-2 py-1 font-mono text-[9px] font-bold ${
                                            param.value
                                              ? 'bg-stable/15 text-stable'
                                              : 'bg-elevated text-text-dim'
                                          }`}
                                        >
                                          {param.value ? 'YES' : 'NO'}
                                        </button>
                                      ) : param.type === 'string' ? (
                                        <select
                                          value={param.value as string}
                                          onChange={(e) => updateRuleParam(rule.id, param.key, e.target.value)}
                                          className="w-full rounded border border-border-subtle bg-transparent px-2 py-1 font-mono text-[10px] text-text-primary outline-none focus:border-stable"
                                        >
                                          {param.key === 'type' && (
                                            <>
                                              <option value="EOD">EOD (End of Day)</option>
                                              <option value="Trailing">Trailing</option>
                                            </>
                                          )}
                                        </select>
                                      ) : (
                                        <div className="flex items-center gap-1.5">
                                          {param.unit === '$' && (
                                            <span className="font-mono text-[9px] text-text-dim">$</span>
                                          )}
                                          <input
                                            type="number"
                                            min={param.min}
                                            max={param.max}
                                            step={typeof param.value === 'number' && param.value % 1 !== 0 ? 0.1 : 1}
                                            value={param.value as number}
                                            onChange={(e) => updateRuleParam(rule.id, param.key, parseFloat(e.target.value) || 0)}
                                            className="w-full rounded border border-border-subtle bg-transparent px-2 py-1 font-mono text-[10px] text-text-primary outline-none focus:border-stable"
                                          />
                                          {param.unit && param.unit !== '$' && (
                                            <span className="font-mono text-[8px] text-text-dim shrink-0">{param.unit}</span>
                                          )}
                                        </div>
                                      )}
                                    </div>
                                  ))}
                                </div>
                              )}
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          ) : (
            <div
              onDragOver={(e) => { e.preventDefault(); setProtocolDragOver(true); }}
              onDragLeave={() => setProtocolDragOver(false)}
              onDrop={(e) => {
                e.preventDefault();
                setProtocolDragOver(false);
                const file = e.dataTransfer.files[0];
                if (file) handleProtocolFile(file);
              }}
              className={`mt-4 relative flex flex-col items-center justify-center rounded-xl border-2 border-dashed p-8 transition-colors ${
                protocolDragOver
                  ? 'border-stable bg-stable/[0.04]'
                  : 'border-border-subtle hover:border-border-active'
              }`}
            >
              {protocolUploading ? (
                <>
                  <div className="h-6 w-6 animate-spin rounded-full border-2 border-stable border-t-transparent" />
                  <p className="mt-2 font-mono text-[10px] text-text-secondary">Canonicalizing protocol...</p>
                </>
              ) : (
                <>
                  <Upload size={24} className="text-text-muted" strokeWidth={1} />
                  <p className="mt-2 font-mono text-[11px] text-text-secondary">
                    Drop your protocol PDF here
                  </p>
                  <p className="mt-0.5 font-mono text-[9px] text-text-dim">
                    or click to browse
                  </p>
                  <input
                    type="file"
                    accept=".pdf"
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      if (file) handleProtocolFile(file);
                    }}
                    className="absolute inset-0 cursor-pointer opacity-0"
                  />
                </>
              )}
            </div>
          )}
        </div>

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
