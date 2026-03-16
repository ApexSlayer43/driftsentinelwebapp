'use client';

import React, { useState, useRef, useEffect, useMemo } from 'react';
import { useChat } from '@ai-sdk/react';
import { TextStreamChatTransport, type UIMessage } from 'ai';
import { Send, Bot, Loader2, RotateCcw } from 'lucide-react';
import { GlowCard } from '@/components/ui/glow-card';

type SentiMode = 'morningBriefing' | 'sessionCompanion' | 'postSessionAAR' | 'onboarding';

const MODE_OPTIONS: {
  value: SentiMode;
  label: string;
  description: string;
}[] = [
  {
    value: 'sessionCompanion',
    label: 'Session Companion',
    description: 'Ambient companion. Speaks when spoken to.',
  },
  {
    value: 'morningBriefing',
    label: 'Morning Briefing',
    description: 'Proactive daily brief with key patterns.',
  },
  {
    value: 'postSessionAAR',
    label: 'After Action Review',
    description: 'Deep post-session behavioral analysis.',
  },
  {
    value: 'onboarding',
    label: 'Onboarding',
    description: 'First-time orientation. Get oriented.',
  },
];

const WELCOME_MESSAGES: Record<SentiMode, string> = {
  sessionCompanion: 'Watching. Ask when you need me.',
  morningBriefing: 'Your data from yesterday is ready. Want the briefing?',
  postSessionAAR: 'Session closed. Walk me through what happened.',
  onboarding:
    "You're here. Let's get oriented. Three things matter at the start — your protocol, your behavioral baseline, and what Drift Sentinel watches for. Which do you want first?",
};

function getTextFromMessage(msg: UIMessage): string {
  if (!msg.parts) return '';
  return msg.parts
    .filter((p): p is { type: 'text'; text: string } => p.type === 'text')
    .map((p) => p.text)
    .join('');
}

export default function SentiPage() {
  const [mode, setMode] = useState<SentiMode>('sessionCompanion');
  const [input, setInput] = useState('');
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

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

  // Auto-focus input
  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  function switchMode(newMode: SentiMode) {
    setMode(newMode);
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

  return (
    <div className="flex h-full max-h-[calc(100vh-60px)]">
      {/* Left sidebar — Mode selector */}
      <div className="w-56 shrink-0 p-4 flex flex-col gap-3">
        <div className="flex items-center gap-2 mb-2">
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

        {/* Mode cards */}
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

        {/* Reset conversation */}
        <button
          onClick={resetConversation}
          className="mt-auto flex items-center gap-2 rounded-xl px-3 py-2 font-mono text-[11px] text-text-dim transition-colors hover:text-text-muted liquid-glass"
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
                        <div
                          className="h-1.5 w-1.5 rounded-full bg-positive animate-pulse"
                          style={{ animationDelay: '0ms' }}
                        />
                        <div
                          className="h-1.5 w-1.5 rounded-full bg-positive animate-pulse"
                          style={{ animationDelay: '200ms' }}
                        />
                        <div
                          className="h-1.5 w-1.5 rounded-full bg-positive animate-pulse"
                          style={{ animationDelay: '400ms' }}
                        />
                      </div>
                    </div>
                  ) : (
                    <div
                      className={`max-w-[75%] rounded-xl px-4 py-3 font-mono text-[13px] leading-relaxed whitespace-pre-wrap ${
                        isAssistant
                          ? 'text-text-secondary'
                          : 'text-text-primary'
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

        {/* Input area */}
        <div className="px-6 pb-4 pt-2">
          <div className="max-w-2xl mx-auto">
            <GlowCard variant="teal" className="rounded-xl">
              <div
                className="flex items-end gap-3 rounded-xl px-4 py-3"
                style={{
                  background: 'rgba(255,255,255,0.02)',
                  border: '1px solid rgba(255,255,255,0.04)',
                }}
              >
                <textarea
                  ref={inputRef}
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyDown={handleKeyDown}
                  placeholder="Ask about your behavioral data..."
                  disabled={isBusy}
                  rows={1}
                  className="flex-1 resize-none bg-transparent font-mono text-[13px] text-text-primary placeholder-text-dim outline-none disabled:opacity-50"
                  style={{
                    minHeight: '24px',
                    maxHeight: '120px',
                  }}
                  onInput={(e) => {
                    const target = e.target as HTMLTextAreaElement;
                    target.style.height = '24px';
                    target.style.height = target.scrollHeight + 'px';
                  }}
                />
                <button
                  onClick={handleSend}
                  disabled={isBusy || !input.trim()}
                  className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg transition-all text-text-muted hover:text-positive disabled:opacity-30 disabled:pointer-events-none"
                  style={{ background: 'rgba(34, 211, 238, 0.08)' }}
                >
                  {isBusy ? (
                    <Loader2 size={14} className="animate-spin text-positive" />
                  ) : (
                    <Send size={14} />
                  )}
                </button>
              </div>
            </GlowCard>
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
