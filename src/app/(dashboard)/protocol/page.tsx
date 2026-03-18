'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import {
  Shield, Swords, Hammer, Upload, FileText, X, Save,
  ChevronDown, ChevronRight, ToggleLeft, ToggleRight,
  Loader2, CheckCircle2, AlertCircle, HelpCircle,
} from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import { GlowPanel } from '@/components/ui/glow-panel';
import {
  canonicalizeProtocol,
  type ProtocolData,
  type ProtocolRule,
  type RuleParam,
} from '@/lib/canonicalizeProtocol';

// ── Category icons & colors — gold editorial palette ────────
const CATEGORY_META: Record<string, { icon: React.ElementType; color: string }> = {
  'Risk':             { icon: Shield,  color: 'text-[#c8a96e]' },
  'Position Sizing':  { icon: Swords,  color: 'text-[#d4ba85]' },
  'Session Rules':    { icon: Shield,  color: 'text-[#bdb8ae]' },
  'Capital':          { icon: Hammer,  color: 'text-[#c8a96e]' },
  'Constraints':      { icon: AlertCircle, color: 'text-[#8a7345]' },
};

const STATUS_BADGE: Record<string, { label: string; color: string; icon: React.ElementType }> = {
  'COMPLIANT':  { label: 'Compliant',  color: 'text-[#c8a96e] bg-[rgba(200,169,110,0.08)] border-[rgba(200,169,110,0.15)]', icon: CheckCircle2 },
  'VIOLATED':   { label: 'Violated',   color: 'text-[#FB923C] bg-[rgba(251,146,60,0.08)] border-[rgba(251,146,60,0.15)]',   icon: AlertCircle },
  'UNCHECKED':  { label: 'Unchecked',  color: 'text-[#7a766d] bg-[rgba(122,118,109,0.08)] border-[rgba(122,118,109,0.15)]', icon: HelpCircle },
};

export default function ProtocolPage() {
  const [protocol, setProtocol] = useState<ProtocolData | null>(null);
  const [accountRef, setAccountRef] = useState<string | null>(null);
  const [expandedCategories, setExpandedCategories] = useState<Set<string>>(new Set());
  const [uploading, setUploading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saveMsg, setSaveMsg] = useState<string | null>(null);
  const [dragOver, setDragOver] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // ── Resolve accountRef on mount ────────────────────────────
  useEffect(() => {
    async function init() {
      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      const { data: accts } = await supabase
        .from('accounts')
        .select('account_ref')
        .eq('user_id', user.id)
        .limit(1);
      if (accts && accts.length > 0) {
        setAccountRef(accts[0].account_ref);
      }
    }
    init();
  }, []);

  // ── Load protocol from API ─────────────────────────────────
  useEffect(() => {
    if (!accountRef) return;

    async function loadProtocol() {
      try {
        const res = await fetch(`/api/protocol?accountRef=${encodeURIComponent(accountRef!)}`);
        if (res.ok) {
          const data = await res.json();
          if (data.rules && data.rules.length > 0) {
            const dbRules: ProtocolRule[] = data.rules.map((r: Record<string, unknown>) => ({
              id: r.rule_id as string,
              category: r.category as string,
              name: r.name as string,
              description: (r.description as string) || '',
              enabled: r.enabled as boolean,
              params: Object.entries((r.params as Record<string, unknown>) || {}).map(([key, value]) => ({
                key,
                label: key.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase()),
                value: value as number | string | boolean,
                type: typeof value === 'number' ? 'number' : typeof value === 'boolean' ? 'boolean' : 'string',
              })),
              // Preserve compliance status from API if present
              ...(r.status ? { status: r.status } : {}),
            }));
            const sourceFile = (data.rules[0]?.source_file as string) || '';
            setProtocol({
              name: sourceFile ? sourceFile.replace(/\.pdf$/i, '').replace(/[-_]/g, ' ') : 'Saved Protocol',
              fileName: sourceFile,
              uploadedAt: (data.rules[0]?.updated_at as string) || new Date().toISOString(),
              rules: dbRules,
            });
            setExpandedCategories(new Set(dbRules.map(r => r.category)));
            return;
          }
        }
      } catch { /* API unavailable */ }
    }
    loadProtocol();
  }, [accountRef]);

  // ── Handle PDF upload ──────────────────────────────────────
  const handleFile = useCallback(async (file: File) => {
    if (!file.name.toLowerCase().endsWith('.pdf')) return;
    setUploading(true);

    try {
      // Server-side PDF text extraction
      const formData = new FormData();
      formData.append('file', file);
      const res = await fetch('/api/protocol/parse', {
        method: 'POST',
        body: formData,
      });

      if (!res.ok) {
        throw new Error('PDF extraction failed');
      }

      const { text } = await res.json();
      const data = canonicalizeProtocol(text, file.name);
      setProtocol(data);
      setExpandedCategories(new Set(data.rules.map(r => r.category)));
    } catch {
      // Fallback: generic rule
      setProtocol({
        name: file.name.replace(/\.pdf$/i, '').replace(/[-_]/g, ' '),
        fileName: file.name,
        uploadedAt: new Date().toISOString(),
        rules: [{
          id: 'generic',
          category: 'General',
          name: 'Trading Protocol',
          description: 'Could not extract rules — add them manually',
          enabled: true,
          params: [],
        }],
      });
      setExpandedCategories(new Set(['General']));
    } finally {
      setUploading(false);
    }
  }, []);

  // ── Save protocol to API ───────────────────────────────────
  const handleSave = useCallback(async () => {
    if (!protocol || !accountRef) return;
    setSaving(true);
    setSaveMsg(null);

    try {
      const res = await fetch('/api/protocol', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          accountRef,
          sourceFile: protocol.fileName,
          rules: protocol.rules.map(r => ({
            rule_id: r.id,
            category: r.category,
            name: r.name,
            description: r.description,
            params: Object.fromEntries(r.params.map(p => [p.key, p.value])),
            enabled: r.enabled,
          })),
        }),
      });

      if (res.ok) {
        setSaveMsg('Protocol saved and synced to engine');
      } else {
        const err = await res.json().catch(() => ({}));
        setSaveMsg(`Save failed: ${(err as Record<string, string>).error || 'Unknown error'}`);
      }
    } catch {
      setSaveMsg('Save failed: network error');
    } finally {
      setSaving(false);
      setTimeout(() => setSaveMsg(null), 4000);
    }
  }, [protocol, accountRef]);

  // ── Toggle rule ────────────────────────────────────────────
  const toggleRule = (ruleId: string) => {
    if (!protocol) return;
    setProtocol({
      ...protocol,
      rules: protocol.rules.map(r =>
        r.id === ruleId ? { ...r, enabled: !r.enabled } : r
      ),
    });
  };

  // ── Update rule param ──────────────────────────────────────
  const updateParam = (ruleId: string, paramKey: string, value: number | string | boolean) => {
    if (!protocol) return;
    setProtocol({
      ...protocol,
      rules: protocol.rules.map(r =>
        r.id === ruleId
          ? {
              ...r,
              params: r.params.map(p =>
                p.key === paramKey ? { ...p, value } : p
              ),
            }
          : r
      ),
    });
  };

  // ── Remove protocol ────────────────────────────────────────
  const removeProtocol = useCallback(async () => {
    setProtocol(null);
    if (accountRef) {
      await fetch('/api/protocol', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ accountRef, sourceFile: '', rules: [] }),
      }).catch(() => {});
    }
  }, [accountRef]);

  // ── Toggle category ────────────────────────────────────────
  const toggleCategory = (cat: string) => {
    setExpandedCategories(prev => {
      const next = new Set(prev);
      if (next.has(cat)) next.delete(cat);
      else next.add(cat);
      return next;
    });
  };

  // ── Group rules by category ────────────────────────────────
  const grouped = protocol
    ? protocol.rules.reduce<Record<string, (ProtocolRule & { status?: string })[]>>((acc, r) => {
        (acc[r.category] = acc[r.category] || []).push(r as ProtocolRule & { status?: string });
        return acc;
      }, {})
    : {};

  const totalRules = protocol?.rules.length || 0;
  const enabledRules = protocol?.rules.filter(r => r.enabled).length || 0;

  // ── Drag & Drop handlers ───────────────────────────────────
  const onDragOver = (e: React.DragEvent) => { e.preventDefault(); setDragOver(true); };
  const onDragLeave = () => setDragOver(false);
  const onDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    const file = e.dataTransfer.files[0];
    if (file) handleFile(file);
  };

  return (
    <div data-onboard="protocol-settings" className="mx-auto max-w-4xl px-6 py-8 space-y-6">
      {/* ── Header ──────────────────────────────────────────── */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-light tracking-tight font-[family-name:var(--font-display)] text-[#ede9e1]">
            Protocol
          </h1>
          <p className="text-sm text-text-muted mt-1 font-[family-name:var(--font-sans)]">
            Upload your trading protocol. Rules are extracted, enforced, and scored automatically.
          </p>
        </div>
        {protocol && (
          <div className="flex items-center gap-3">
            <button
              onClick={handleSave}
              disabled={saving}
              className="flex items-center gap-2 px-4 py-2 rounded-full bg-[rgba(200,169,110,0.06)] backdrop-blur-xl border border-[rgba(200,169,110,0.15)] text-[#c8a96e] hover:bg-[rgba(200,169,110,0.1)] transition-all text-sm font-mono font-medium uppercase tracking-[0.1em]"
            >
              {saving ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
              Save Protocol
            </button>
          </div>
        )}
      </div>

      {/* ── Save message ────────────────────────────────────── */}
      {saveMsg && (
        <div className={`text-sm font-mono px-4 py-2 rounded-lg ${saveMsg.includes('failed') ? 'bg-[rgba(251,146,60,0.08)] text-[#FB923C]' : 'bg-[rgba(200,169,110,0.08)] text-[#c8a96e]'}`}>
          {saveMsg}
        </div>
      )}

      {/* ── Upload Area (shown when no protocol loaded) ─────── */}
      {!protocol && (
        <div
          onDragOver={onDragOver}
          onDragLeave={onDragLeave}
          onDrop={onDrop}
          onClick={() => fileInputRef.current?.click()}
          className={`relative cursor-pointer rounded-2xl border-2 border-dashed p-12 text-center transition-all duration-200 ${
            dragOver
              ? 'border-[#c8a96e] bg-[rgba(200,169,110,0.04)]'
              : 'border-[rgba(200,169,110,0.1)] hover:border-[rgba(200,169,110,0.2)]'
          }`}
        >
          <input
            ref={fileInputRef}
            type="file"
            accept=".pdf"
            className="hidden"
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) handleFile(f);
            }}
          />
          {uploading ? (
            <div className="flex flex-col items-center gap-3">
              <Loader2 size={32} className="animate-spin text-[#c8a96e]" />
              <p className="text-sm text-text-muted">Extracting rules from PDF...</p>
            </div>
          ) : (
            <div className="flex flex-col items-center gap-3">
              <Upload size={32} className="text-text-muted" />
              <p className="text-lg font-medium text-text-secondary">
                Drop your trading protocol PDF here
              </p>
              <p className="text-sm text-text-muted">
                or click to browse · Any structured trading protocol will be parsed into enforceable rules
              </p>
            </div>
          )}
        </div>
      )}

      {/* ── Protocol Header ─────────────────────────────────── */}
      {protocol && (
        <GlowPanel className="p-5">
          <div className="flex items-start justify-between">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[rgba(200,169,110,0.08)]">
                <FileText size={20} className="text-[#c8a96e]" />
              </div>
              <div>
                <h2 className="text-lg font-light text-[#c8a96e] font-[family-name:var(--font-display)]">
                  {protocol.name}
                </h2>
                <p className="text-xs text-text-muted mt-0.5">
                  {totalRules} rules extracted · {enabledRules} active
                  {protocol.fileName && ` · ${protocol.fileName}`}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={() => fileInputRef.current?.click()}
                className="text-xs text-text-muted hover:text-text-secondary transition-colors"
              >
                Replace
              </button>
              <button
                onClick={removeProtocol}
                className="flex items-center justify-center h-7 w-7 rounded-lg hover:bg-red-400/10 text-text-muted hover:text-red-400 transition-all"
              >
                <X size={14} />
              </button>
              <input
                ref={fileInputRef}
                type="file"
                accept=".pdf"
                className="hidden"
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (f) handleFile(f);
                }}
              />
            </div>
          </div>
        </GlowPanel>
      )}

      {/* ── Rule Categories ─────────────────────────────────── */}
      {protocol && Object.entries(grouped).map(([category, catRules]) => {
        const meta = CATEGORY_META[category] || { icon: Shield, color: 'text-zinc-400' };
        const CatIcon = meta.icon;
        const isExpanded = expandedCategories.has(category);

        return (
          <GlowPanel key={category} className="overflow-hidden">
            {/* Category header */}
            <button
              onClick={() => toggleCategory(category)}
              className="w-full flex items-center justify-between px-5 py-3 hover:bg-[rgba(200,169,110,0.02)] transition-colors"
            >
              <div className="flex items-center gap-2.5">
                <CatIcon size={16} className={meta.color} />
                <span className="text-sm font-semibold text-text-secondary">{category}</span>
                <span className="text-xs text-text-muted">
                  ({catRules.length} rule{catRules.length !== 1 ? 's' : ''})
                </span>
              </div>
              {isExpanded ? <ChevronDown size={14} className="text-text-muted" /> : <ChevronRight size={14} className="text-text-muted" />}
            </button>

            {/* Rules */}
            {isExpanded && (
              <div className="border-t border-[rgba(200,169,110,0.06)]">
                {catRules.map((rule) => {
                  const status = (rule as ProtocolRule & { status?: string }).status;
                  const badge = status ? STATUS_BADGE[status] : null;
                  const BadgeIcon = badge?.icon;

                  return (
                    <div
                      key={rule.id}
                      className={`px-5 py-4 border-b border-[rgba(200,169,110,0.06)] last:border-b-0 transition-opacity ${!rule.enabled ? 'opacity-40' : ''}`}
                    >
                      {/* Rule header row */}
                      <div className="flex items-center justify-between mb-1">
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-medium text-[#c8a96e]">{rule.name}</span>
                          {badge && BadgeIcon && (
                            <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium border ${badge.color}`}>
                              <BadgeIcon size={10} />
                              {badge.label}
                            </span>
                          )}
                        </div>
                        <button onClick={() => toggleRule(rule.id)} className="transition-colors">
                          {rule.enabled
                            ? <ToggleRight size={22} className="text-[#c8a96e]" />
                            : <ToggleLeft size={22} className="text-[#4a473f]" />
                          }
                        </button>
                      </div>

                      {/* Description */}
                      <p className="text-xs text-text-muted mb-3">{rule.description}</p>

                      {/* Parameters */}
                      {rule.params.length > 0 && (
                        <div className="flex flex-wrap gap-3">
                          {rule.params.map((param: RuleParam) => (
                            <div key={param.key} className="flex items-center gap-1.5">
                              <label className="text-[10px] text-text-muted uppercase tracking-wider">
                                {param.label}
                              </label>
                              {param.type === 'boolean' ? (
                                <button
                                  onClick={() => updateParam(rule.id, param.key, !param.value)}
                                  className={`text-[10px] px-2 py-0.5 rounded-md border font-mono ${param.value ? 'text-[#c8a96e] border-[rgba(200,169,110,0.2)] bg-[rgba(200,169,110,0.06)]' : 'text-[#7a766d] border-[rgba(200,169,110,0.08)] bg-[rgba(200,169,110,0.02)]'}`}
                                >
                                  {param.value ? 'ON' : 'OFF'}
                                </button>
                              ) : param.type === 'number' || param.type === 'percent' ? (
                                <div className="flex items-center gap-1">
                                  <input
                                    type="number"
                                    value={param.value as number}
                                    min={param.min}
                                    max={param.max}
                                    step={param.type === 'percent' ? 1 : param.key.includes('_r') ? 0.1 : 1}
                                    onChange={(e) => updateParam(rule.id, param.key, parseFloat(e.target.value) || 0)}
                                    className="w-16 bg-[rgba(200,169,110,0.03)] backdrop-blur-xl border border-[rgba(200,169,110,0.1)] rounded-md px-2 py-0.5 text-xs text-[#c8a96e] text-center font-mono focus:outline-none focus:border-[rgba(200,169,110,0.3)]"
                                  />
                                  {param.unit && <span className="text-[10px] text-text-muted">{param.unit}</span>}
                                </div>
                              ) : (
                                <input
                                  type="text"
                                  value={param.value as string}
                                  onChange={(e) => updateParam(rule.id, param.key, e.target.value)}
                                  className="w-24 bg-[rgba(200,169,110,0.03)] backdrop-blur-xl border border-[rgba(200,169,110,0.1)] rounded-md px-2 py-0.5 text-xs text-[#c8a96e] font-mono focus:outline-none focus:border-[rgba(200,169,110,0.3)]"
                                />
                              )}
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </GlowPanel>
        );
      })}
    </div>
  );
}
