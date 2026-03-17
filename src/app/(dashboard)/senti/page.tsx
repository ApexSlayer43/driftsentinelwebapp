'use client';

import React, { useState, useRef, useEffect, useMemo, useCallback } from 'react';
import { useChat } from '@ai-sdk/react';
import { TextStreamChatTransport, type UIMessage } from 'ai';
import { Radar, Loader2, RotateCcw, MessageSquare, Clock, Plus, TrendingUp, Flame, Shield } from 'lucide-react';
import { GradientAIChatInput } from '@/components/ui/gradient-ai-chat-input';
import LiveEye from '@/components/live-eye';
import type { StatePayload } from '@/lib/types';

type SentiMode = 'morningBriefing' | 'sessionCompanion' | 'postSessionAAR' | 'onboarding';

interface ConversationSummary {
  id: string;
  title: string;
  mode: string;
  created_at: string;
  updated_at: string;
}

interface SavedMessage {
  id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  created_at: string;
}

const MODE_OPTIONS: { value: SentiMode; label: string; description: string }[] = [
  { value: 'sessionCompanion', label: 'Session Companion', description: 'Ambient companion. Speaks when spoken to.' },
  { value: 'morningBriefing', label: 'Morning Briefing', description: 'Proactive daily brief with key patterns.' },
  { value: 'postSessionAAR', label: 'After Action Review', description: 'Deep post-session behavioral analysis.' },
  { value: 'onboarding', label: 'Onboarding', description: 'First-time orientation. Get oriented.' },
];

const WELCOME_MESSAGES: Record<SentiMode, string> = {
  sessionCompanion: 'Watching. Ask when you need me.',
  morningBriefing: 'Your data from yesterday is ready. Want the briefing?',
  postSessionAAR: 'Session closed. Walk me through what happened.',
  onboarding: "You're here. Let's get oriented. Three things matter at the start — your protocol, your behavioral baseline, and what Drift Sentinel watches for. Which do you want first?",
};

// Mode-specific intelligence strip messages
const MODE_STRIP_LABELS: Record<SentiMode, string> = {
  sessionCompanion: 'Monitoring',
  morningBriefing: 'Yesterday\'s Brief',
  postSessionAAR: 'Session Debrief',
  onboarding: 'Getting Started',
};

function getTextFromMessage(msg: UIMessage): string {
  if (!msg.parts) return '';
  return msg.parts
    .filter((p): p is { type: 'text'; text: string } => p.type === 'text')
    .map((p) => p.text)
    .join('');
}

function formatRelativeDate(dateStr: string): string {
  const date = new Date(dateStr);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHrs = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);

  if (diffMins < 1) return 'Just now';
  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffHrs < 24) return `${diffHrs}h ago`;
  if (diffDays < 7) return `${diffDays}d ago`;
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

/** Group conversations by day for timeline display */
function groupByDay(convos: ConversationSummary[]): { label: string; items: ConversationSummary[] }[] {
  const groups: Map<string, ConversationSummary[]> = new Map();
  const now = new Date();
  const today = now.toDateString();
  const yesterday = new Date(now.getTime() - 86400000).toDateString();

  for (const c of convos) {
    const d = new Date(c.updated_at).toDateString();
    let label: string;
    if (d === today) label = 'Today';
    else if (d === yesterday) label = 'Yesterday';
    else label = new Date(c.updated_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });

    if (!groups.has(label)) groups.set(label, []);
    groups.get(label)!.push(c);
  }
  return Array.from(groups.entries()).map(([label, items]) => ({ label, items }));
}

export default function SentiPage() {
  const [mode, setMode] = useState<SentiMode>('sessionCompanion');
  const [input, setInput] = useState('');
  const [uploadingFile, setUploadingFile] = useState(false);
  const [conversations, setConversations] = useState<ConversationSummary[]>([]);
  const [loadingHistory, setLoadingHistory] = useState(false);
  const [activeConvoId, setActiveConvoId] = useState<string | null>(null);
  const [stateData, setStateData] = useState<StatePayload | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  const transport = useMemo(
    () =>
      new TextStreamChatTransport({
        api: '/api/chat',
        body: { mode },
      }),
    [mode]
  );

  const initialMessages: UIMessage[] = [
    {
      id: 'welcome',
      role: 'assistant',
      parts: [{ type: 'text', text: WELCOME_MESSAGES[mode] }],
    },
  ];

  const { messages, setMessages, sendMessage, status } = useChat({
    transport,
    messages: initialMessages,
  });

  const isBusy = status === 'streaming' || status === 'submitted';
  const isIdleState = messages.length <= 1 && !activeConvoId;

  // Auto-scroll
  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' });
  }, [messages]);

  // Fetch BSS state for intelligence strip
  useEffect(() => {
    async function fetchState() {
      try {
        const res = await fetch('/api/state');
        if (res.ok) {
          const data = await res.json();
          setStateData(data);
        }
      } catch {
        // Silent fail — strip shows graceful empty state
      }
    }
    fetchState();
  }, []);

  // Fetch conversation history
  const fetchHistory = useCallback(async () => {
    setLoadingHistory(true);
    try {
      const res = await fetch('/api/conversations');
      if (res.ok) {
        const data = await res.json();
        setConversations(data.conversations ?? []);
      }
    } catch {
      // Silent fail
    } finally {
      setLoadingHistory(false);
    }
  }, []);

  // Load history on mount
  useEffect(() => {
    fetchHistory();
  }, [fetchHistory]);

  // Load a past conversation
  async function loadConversation(convo: ConversationSummary) {
    try {
      const res = await fetch(`/api/conversations?id=${convo.id}`);
      if (!res.ok) return;
      const data = await res.json();
      const saved: SavedMessage[] = data.messages ?? [];

      if (saved.length === 0) return;

      // Convert saved messages to UIMessage format
      const uiMessages: UIMessage[] = saved
        .filter((m) => m.role === 'user' || m.role === 'assistant')
        .map((m) => ({
          id: m.id,
          role: m.role as 'user' | 'assistant',
          parts: [{ type: 'text' as const, text: m.content }],
        }));

      if (uiMessages.length > 0) {
        setMessages(uiMessages);
        setActiveConvoId(convo.id);
        setMode((convo.mode as SentiMode) || 'sessionCompanion');
      }
    } catch {
      // Silent fail
    }
  }

  function switchMode(newMode: SentiMode) {
    setMode(newMode);
    setActiveConvoId(null);
    const newWelcome: UIMessage[] = [
      {
        id: 'welcome-' + newMode,
        role: 'assistant',
        parts: [{ type: 'text', text: WELCOME_MESSAGES[newMode] }],
      },
    ];
    setMessages(newWelcome);
    setInput('');
  }

  function resetConversation() {
    setActiveConvoId(null);
    const resetWelcome: UIMessage[] = [
      {
        id: 'welcome-reset-' + Date.now(),
        role: 'assistant',
        parts: [{ type: 'text', text: WELCOME_MESSAGES[mode] }],
      },
    ];
    setMessages(resetWelcome);
    setInput('');
  }

  async function handleSend() {
    const trimmed = input.trim();
    if (!trimmed || isBusy) return;
    setInput('');
    await sendMessage({ text: trimmed });
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  }

  // File upload handler — sends PDF/CSV to Senti ingest endpoint and streams analysis
  async function handleFileUpload(file: File) {
    const isPdf = file.name.toLowerCase().endsWith('.pdf');
    const isCsv = file.name.toLowerCase().endsWith('.csv');
    if (!isPdf && !isCsv) return;

    setUploadingFile(true);

    // Add user message showing the upload
    const uploadMsg: UIMessage = {
      id: 'upload-' + Date.now(),
      role: 'user',
      parts: [{ type: 'text', text: `Uploaded: ${file.name}` }],
    };
    setMessages((prev: UIMessage[]) => [...prev, uploadMsg]);

    // Add placeholder for Senti's streaming response
    const sentiMsgId = 'senti-analysis-' + Date.now();
    const placeholderMsg: UIMessage = {
      id: sentiMsgId,
      role: 'assistant',
      parts: [{ type: 'text', text: '' }],
    };
    setMessages((prev: UIMessage[]) => [...prev, placeholderMsg]);

    try {
      const formData = new FormData();
      formData.append('file', file);

      const res = await fetch('/api/chat/ingest', {
        method: 'POST',
        body: formData,
      });

      if (!res.ok) {
        const errBody = await res.json().catch(() => null);
        throw new Error(errBody?.error || `Upload failed: ${res.status}`);
      }

      // Stream the response
      const reader = res.body?.getReader();
      const decoder = new TextDecoder();
      let fullText = '';

      if (reader) {
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          fullText += decoder.decode(value, { stream: true });
          setMessages((prev: UIMessage[]) =>
            prev.map((m: UIMessage) =>
              m.id === sentiMsgId
                ? { ...m, parts: [{ type: 'text' as const, text: fullText }] }
                : m
            )
          );
        }
      }
    } catch (err) {
      const errorText = err instanceof Error ? err.message : 'Failed to analyze file';
      setMessages((prev: UIMessage[]) =>
        prev.map((m: UIMessage) =>
          m.id === sentiMsgId
            ? { ...m, parts: [{ type: 'text' as const, text: `Error: ${errorText}` }] }
            : m
        )
      );
    } finally {
      setUploadingFile(false);
    }
  }

  // Map modes to dropdown options for the gradient input
  const modeDropdownOptions = MODE_OPTIONS.map((opt) => ({
    id: opt.value,
    label: opt.label,
    value: opt.value,
  }));

  const selectedModeOption = modeDropdownOptions.find((o) => o.value === mode) ?? null;

  const dayGroups = useMemo(() => groupByDay(conversations), [conversations]);

  // Derive delta display
  const deltaSign = stateData && stateData.bss_delta > 0 ? '+' : '';
  const deltaColor = stateData && stateData.bss_delta >= 0 ? 'text-[#22D3EE]' : 'text-[#FB923C]';

  return (
    <div className="flex h-full max-h-[calc(100vh-60px)]">
      {/* ═══════════════════════════════════════════════════════ */}
      {/* LEFT SIDEBAR — Timeline History                        */}
      {/* ═══════════════════════════════════════════════════════ */}
      <div className="w-56 shrink-0 flex flex-col overflow-hidden border-r border-[rgba(200,169,110,0.08)]">
        {/* Header */}
        <div className="px-4 pt-4 pb-3">
          <div data-onboard="senti-header" className="flex items-center gap-2 mb-3">
            <Radar size={15} className="text-[#c8a96e]" />
            <span className="font-mono text-[12px] font-bold uppercase tracking-[0.15em] text-[#c8a96e]">
              Senti
            </span>
            <div className="ml-auto flex items-center gap-1.5">
              <div
                className={`h-1.5 w-1.5 rounded-full ${
                  isBusy ? 'bg-warning animate-pulse' : 'bg-[#c8a96e]'
                }`}
              />
              <span className="font-mono text-[9px] text-text-dim">
                {isBusy ? 'Processing' : 'Active'}
              </span>
            </div>
          </div>

          {/* New conversation button */}
          <button
            onClick={resetConversation}
            className="w-full flex items-center justify-center gap-2 rounded-lg px-3 py-2 font-mono text-[10px] font-semibold uppercase tracking-[0.1em] text-[#c8a96e] transition-all hover:bg-[rgba(200,169,110,0.06)] bg-[rgba(200,169,110,0.03)] border border-[rgba(200,169,110,0.1)]"
          >
            <Plus size={11} />
            New conversation
          </button>
        </div>

        {/* Timeline */}
        <div className="flex-1 overflow-auto px-4 pb-4" style={{ scrollbarWidth: 'none' }}>
          {loadingHistory ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 size={14} className="animate-spin text-text-dim" />
            </div>
          ) : conversations.length === 0 ? (
            <div className="text-center py-10">
              <MessageSquare size={18} className="mx-auto text-text-dim mb-2 opacity-30" />
              <p className="font-mono text-[10px] text-text-dim">No conversations yet.</p>
              <p className="font-sans text-[10px] text-text-dim mt-1 opacity-50 italic">
                Start talking to Senti.
              </p>
            </div>
          ) : (
            <div className="relative">
              {/* Vertical gold timeline line */}
              <div
                className="absolute left-[5px] top-2 bottom-2 w-px"
                style={{ background: 'rgba(200,169,110,0.15)' }}
              />

              {dayGroups.map((group, gi) => (
                <div key={group.label} className={gi > 0 ? 'mt-4' : ''}>
                  {/* Day label */}
                  <div className="relative pl-5 mb-2">
                    <div
                      className="absolute left-[2px] top-1/2 -translate-y-1/2 h-[7px] w-[7px] rounded-full border border-[rgba(200,169,110,0.3)]"
                      style={{ background: 'rgba(200,169,110,0.08)' }}
                    />
                    <span className="font-mono text-[8px] font-bold uppercase tracking-[0.2em] text-text-dim">
                      {group.label}
                    </span>
                  </div>

                  {/* Conversation nodes */}
                  {group.items.map((convo) => {
                    const isActive = activeConvoId === convo.id;
                    return (
                      <button
                        key={convo.id}
                        onClick={() => loadConversation(convo)}
                        className={`relative w-full text-left pl-5 pr-1 py-1.5 rounded-r-lg transition-all ${
                          isActive
                            ? 'bg-[rgba(200,169,110,0.05)]'
                            : 'hover:bg-[rgba(200,169,110,0.02)]'
                        }`}
                      >
                        {/* Timeline dot */}
                        <div
                          className={`absolute left-[3px] top-1/2 -translate-y-1/2 rounded-full transition-all ${
                            isActive
                              ? 'h-[5px] w-[5px] bg-[#c8a96e] shadow-[0_0_6px_rgba(200,169,110,0.4)]'
                              : 'h-[3px] w-[3px] bg-[rgba(200,169,110,0.3)]'
                          }`}
                        />
                        <div className="font-sans text-[11px] text-text-muted truncate leading-tight">
                          {convo.title || 'Untitled'}
                        </div>
                        <div className="flex items-center gap-1.5 mt-0.5">
                          <span className="font-mono text-[8px] text-text-dim">
                            {formatRelativeDate(convo.updated_at)}
                          </span>
                          <span className="font-mono text-[8px] text-text-dim opacity-50">
                            {convo.mode}
                          </span>
                        </div>
                      </button>
                    );
                  })}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* ═══════════════════════════════════════════════════════ */}
      {/* MAIN AREA — Intelligence Strip + Dialogue + Input      */}
      {/* ═══════════════════════════════════════════════════════ */}
      <div className="flex-1 flex flex-col min-w-0" data-onboard="senti-chat">

        {/* ── Intelligence Strip ── */}
        <div className="border-b border-[rgba(200,169,110,0.06)] bg-[rgba(200,169,110,0.02)]">
          <div className="max-w-2xl mx-auto flex items-center gap-6 px-6 py-2.5">
            {/* Mode label */}
            <div className="flex items-center gap-2">
              <div className="h-1 w-1 rounded-full bg-[#c8a96e]" />
              <span className="font-mono text-[9px] font-bold uppercase tracking-[0.15em] text-[#c8a96e]">
                {MODE_STRIP_LABELS[mode]}
              </span>
            </div>

            {/* BSS Score */}
            {stateData && (
              <>
                <div className="flex items-center gap-2">
                  <Shield size={10} className="text-[rgba(200,169,110,0.5)]" />
                  <span className="font-mono text-[10px] text-text-dim">BSS</span>
                  <span className="font-display text-[15px] font-light text-[#ede9e1]">
                    {stateData.bss_score}
                  </span>
                  <span className={`font-mono text-[9px] ${deltaColor}`}>
                    {deltaSign}{stateData.bss_delta.toFixed(1)}
                  </span>
                </div>

                {/* Streak */}
                <div className="flex items-center gap-1.5">
                  <Flame size={10} className="text-[rgba(200,169,110,0.5)]" />
                  <span className="font-mono text-[10px] text-text-dim">Streak</span>
                  <span className="font-mono text-[11px] font-semibold text-[#ede9e1]">
                    {stateData.bss_streak}d
                  </span>
                </div>

                {/* Drift state */}
                <div className="ml-auto flex items-center gap-1.5">
                  <div
                    className={`h-1.5 w-1.5 rounded-full ${
                      stateData.drift.state === 'STABLE'
                        ? 'bg-[#c8a96e]'
                        : stateData.drift.state === 'DRIFT_FORMING'
                          ? 'bg-[#F59E0B] animate-pulse'
                          : 'bg-[#FB923C] animate-pulse'
                    }`}
                  />
                  <span className="font-mono text-[9px] text-text-dim">
                    {stateData.drift.state.replace('_', ' ')}
                  </span>
                </div>
              </>
            )}

            {/* Loading state for strip */}
            {!stateData && (
              <div className="flex items-center gap-2">
                <div className="h-2 w-16 rounded bg-[rgba(200,169,110,0.06)] animate-pulse" />
                <div className="h-2 w-12 rounded bg-[rgba(200,169,110,0.04)] animate-pulse" />
              </div>
            )}
          </div>
        </div>

        {/* ── Dialogue Area ── */}
        <div
          ref={scrollRef}
          className="flex-1 overflow-auto px-6 py-6"
          style={{ scrollbarWidth: 'thin' }}
        >
          <div className="max-w-2xl mx-auto">
            {/* Centered Eye — Idle State */}
            {isIdleState && (
              <div className="flex flex-col items-center justify-center pt-12 pb-8">
                <div className={`transition-all duration-700 ${isBusy ? 'senti-eye-active' : 'senti-eye-idle'}`}>
                  <LiveEye size={120} />
                </div>
              </div>
            )}

            {/* Messages — typographic dialogue blocks */}
            <div className={`space-y-6 ${isIdleState ? '' : 'pt-2'}`}>
              {messages.map((msg) => {
                const text = getTextFromMessage(msg);
                const isAssistant = msg.role === 'assistant';

                // Skip rendering the welcome message if we're showing the eye
                if (msg.id.startsWith('welcome') && isIdleState && isAssistant) {
                  return (
                    <div key={msg.id} className="text-center">
                      <p className="font-display text-[17px] font-light italic text-[#bdb8ae] leading-relaxed">
                        {text}
                      </p>
                    </div>
                  );
                }

                return (
                  <div key={msg.id}>
                    {/* Streaming placeholder */}
                    {isAssistant && text === '' && isBusy ? (
                      <div className="flex items-start gap-3">
                        <div className="shrink-0 mt-1.5">
                          <Radar size={12} className="text-[rgba(200,169,110,0.4)]" />
                        </div>
                        <div className="flex items-center gap-2 py-2">
                          <div className="h-1.5 w-1.5 rounded-full bg-[#c8a96e] animate-pulse" style={{ animationDelay: '0ms' }} />
                          <div className="h-1.5 w-1.5 rounded-full bg-[#c8a96e] animate-pulse" style={{ animationDelay: '200ms' }} />
                          <div className="h-1.5 w-1.5 rounded-full bg-[#c8a96e] animate-pulse" style={{ animationDelay: '400ms' }} />
                        </div>
                      </div>
                    ) : isAssistant ? (
                      /* ── Senti's voice: Cormorant italic, gold left border ── */
                      <div className="flex items-start gap-3">
                        <div className="shrink-0 mt-1.5">
                          <Radar size={12} className="text-[rgba(200,169,110,0.4)]" />
                        </div>
                        <div
                          className="border-l-2 border-[rgba(200,169,110,0.15)] pl-4 py-0.5"
                        >
                          <p className="font-display text-[15px] font-light italic text-[#bdb8ae] leading-relaxed whitespace-pre-wrap">
                            {text}
                          </p>
                        </div>
                      </div>
                    ) : (
                      /* ── User's voice: DM Sans, right-aligned, clean ── */
                      <div className="flex justify-end">
                        <p className="font-sans text-[13px] text-[#ede9e1] leading-relaxed whitespace-pre-wrap max-w-[75%] text-right">
                          {text}
                        </p>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* ── Input Area ── */}
        <div className="px-6 pb-4 pt-2" data-onboard="senti-input">
          <div className="max-w-2xl mx-auto">
            <GradientAIChatInput
              placeholder="Ask about your behavioral data..."
              disabled={isBusy}
              uploading={uploadingFile}
              onSend={(msg) => {
                setInput('');
                sendMessage({ text: msg });
              }}
              onFileAttach={handleFileUpload}
              dropdownOptions={modeDropdownOptions}
              selectedOption={selectedModeOption}
              onOptionSelect={(opt) => switchMode(opt.value as SentiMode)}
            />
            <div className="text-center mt-2">
              <span className="font-mono text-[9px] text-text-dim">
                Senti speaks from your data. No trading advice. No predictions.
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
