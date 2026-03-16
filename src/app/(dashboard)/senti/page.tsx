'use client';

import React, { useState, useRef, useEffect, useMemo, useCallback } from 'react';
import { useChat } from '@ai-sdk/react';
import { TextStreamChatTransport, type UIMessage } from 'ai';
import { Bot, Loader2, RotateCcw, MessageSquare, Clock } from 'lucide-react';
import { GlowCard } from '@/components/ui/glow-card';
import { GradientAIChatInput } from '@/components/ui/gradient-ai-chat-input';

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

export default function SentiPage() {
  const [mode, setMode] = useState<SentiMode>('sessionCompanion');
  const [input, setInput] = useState('');
  const [uploadingFile, setUploadingFile] = useState(false);
  const [showHistory, setShowHistory] = useState(false);
  const [conversations, setConversations] = useState<ConversationSummary[]>([]);
  const [loadingHistory, setLoadingHistory] = useState(false);
  const [activeConvoId, setActiveConvoId] = useState<string | null>(null);
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

  // Auto-scroll
  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' });
  }, [messages]);

  // (input auto-focus handled by GradientAIChatInput)

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

  // Load history when panel opens
  useEffect(() => {
    if (showHistory) fetchHistory();
  }, [showHistory, fetchHistory]);

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
        setShowHistory(false);
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

  return (
    <div className="flex h-full max-h-[calc(100vh-60px)]">
      {/* Left sidebar — Mode selector + History */}
      <div className="w-56 shrink-0 p-4 flex flex-col gap-3 overflow-hidden">
        <div className="flex items-center gap-2 mb-1">
          <Bot size={16} className="text-positive" />
          <span className="font-mono text-[13px] font-bold uppercase tracking-[0.15em] text-text-muted">
            Senti
          </span>
          <div className="ml-auto flex items-center gap-1.5">
            <div
              className={`h-1.5 w-1.5 rounded-full ${
                isBusy ? 'bg-warning animate-pulse' : 'bg-stable'
              }`}
            />
            <span className="font-mono text-[10px] text-text-dim">
              {isBusy ? 'Working on it.' : 'Active'}
            </span>
          </div>
        </div>

        {/* Tab toggle: Modes / History */}
        <div className="flex gap-1 rounded-lg p-0.5" style={{ background: 'rgba(255,255,255,0.02)' }}>
          <button
            onClick={() => setShowHistory(false)}
            className={`flex-1 rounded-md px-2 py-1 font-mono text-[10px] transition-all ${
              !showHistory ? 'text-positive bg-white/[0.05]' : 'text-text-dim hover:text-text-muted'
            }`}
          >
            Modes
          </button>
          <button
            onClick={() => setShowHistory(true)}
            className={`flex-1 rounded-md px-2 py-1 font-mono text-[10px] transition-all ${
              showHistory ? 'text-positive bg-white/[0.05]' : 'text-text-dim hover:text-text-muted'
            }`}
          >
            History
          </button>
        </div>

        {/* Panel content */}
        <div className="flex-1 overflow-auto" style={{ scrollbarWidth: 'none' }}>
          {!showHistory ? (
            // Mode cards
            <div className="flex flex-col gap-2">
              {MODE_OPTIONS.map((opt) => (
                <GlowCard
                  key={opt.value}
                  variant={opt.value === mode ? 'teal' : 'gold'}
                  className="rounded-xl"
                >
                  <button
                    onClick={() => switchMode(opt.value)}
                    className={`w-full text-left rounded-xl px-3 py-2.5 transition-all ${
                      opt.value === mode
                        ? 'ring-1 ring-positive/30 bg-raised/60'
                        : 'liquid-glass hover:bg-raised/30'
                    }`}
                  >
                    <div
                      className={`font-mono text-[11px] font-semibold ${
                        opt.value === mode ? 'text-positive' : 'text-text-muted'
                      }`}
                    >
                      {opt.label}
                    </div>
                    <div className="font-mono text-[10px] text-text-dim mt-0.5 leading-snug">
                      {opt.description}
                    </div>
                  </button>
                </GlowCard>
              ))}
            </div>
          ) : (
            // Conversation history
            <div className="flex flex-col gap-1.5">
              {loadingHistory ? (
                <div className="flex items-center justify-center py-8">
                  <Loader2 size={14} className="animate-spin text-text-dim" />
                </div>
              ) : conversations.length === 0 ? (
                <div className="text-center py-8">
                  <MessageSquare size={20} className="mx-auto text-text-dim mb-2 opacity-40" />
                  <p className="font-mono text-[10px] text-text-dim">No conversations yet.</p>
                </div>
              ) : (
                conversations.map((convo) => (
                  <button
                    key={convo.id}
                    onClick={() => loadConversation(convo)}
                    className={`w-full text-left rounded-lg px-3 py-2 transition-all ${
                      activeConvoId === convo.id
                        ? 'bg-white/[0.04] ring-1 ring-positive/20'
                        : 'hover:bg-white/[0.02]'
                    }`}
                  >
                    <div className="font-mono text-[11px] text-text-muted truncate">
                      {convo.title || 'Untitled'}
                    </div>
                    <div className="flex items-center gap-2 mt-0.5">
                      <Clock size={9} className="text-text-dim" />
                      <span className="font-mono text-[9px] text-text-dim">
                        {formatRelativeDate(convo.updated_at)}
                      </span>
                      <span className="font-mono text-[9px] text-text-dim opacity-60">
                        {convo.mode}
                      </span>
                    </div>
                  </button>
                ))
              )}
            </div>
          )}
        </div>

        {/* New conversation button */}
        <button
          onClick={resetConversation}
          className="flex items-center gap-2 rounded-xl px-3 py-2 font-mono text-[11px] text-text-dim transition-colors hover:text-text-muted liquid-glass"
        >
          <RotateCcw size={12} />
          New conversation
        </button>
      </div>

      {/* Main chat area */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Messages */}
        <div
          ref={scrollRef}
          className="flex-1 overflow-auto px-6 py-4"
          style={{ scrollbarWidth: 'thin' }}
        >
          <div className="max-w-2xl mx-auto space-y-4">
            {messages.map((msg) => {
              const text = getTextFromMessage(msg);
              const isAssistant = msg.role === 'assistant';

              return (
                <div
                  key={msg.id}
                  className={`flex ${isAssistant ? 'justify-start' : 'justify-end'}`}
                >
                  {/* Senti avatar */}
                  {isAssistant && (
                    <div className="shrink-0 mr-3 mt-1">
                      <div
                        className="flex h-7 w-7 items-center justify-center rounded-full"
                        style={{
                          background:
                            'radial-gradient(circle at 30% 30%, rgba(34, 211, 238, 0.7), rgba(6, 182, 212, 0.5))',
                        }}
                      >
                        <Bot size={14} className="text-void" />
                      </div>
                    </div>
                  )}

                  {/* Message bubble */}
                  {isAssistant && text === '' && isBusy ? (
                    <div
                      className="rounded-xl px-4 py-3"
                      style={{ background: 'rgba(255,255,255,0.03)' }}
                    >
                      <div className="flex items-center gap-2">
                        <div className="h-1.5 w-1.5 rounded-full bg-positive animate-pulse" style={{ animationDelay: '0ms' }} />
                        <div className="h-1.5 w-1.5 rounded-full bg-positive animate-pulse" style={{ animationDelay: '200ms' }} />
                        <div className="h-1.5 w-1.5 rounded-full bg-positive animate-pulse" style={{ animationDelay: '400ms' }} />
                      </div>
                    </div>
                  ) : (
                    <div
                      className={`max-w-[75%] rounded-xl px-4 py-3 font-mono text-[13px] leading-relaxed whitespace-pre-wrap ${
                        isAssistant ? 'text-text-secondary' : 'text-text-primary'
                      }`}
                      style={{
                        background: isAssistant
                          ? 'rgba(255,255,255,0.03)'
                          : 'rgba(99, 102, 241, 0.12)',
                      }}
                    >
                      {text}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {/* Input area — Gradient AI Chat Input */}
        <div className="px-6 pb-4 pt-2">
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
