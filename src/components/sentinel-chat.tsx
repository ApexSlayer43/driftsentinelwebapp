'use client';

import React, { useState, useRef, useEffect, useMemo } from 'react';
import { useChat } from '@ai-sdk/react';
import { TextStreamChatTransport, type UIMessage } from 'ai';
import { Send, Bot, X, Loader2, ChevronDown } from 'lucide-react';
import { GlowCard } from '@/components/ui/glow-card';

type SentiMode = 'morningBriefing' | 'sessionCompanion' | 'postSessionAAR' | 'onboarding';

const MODE_OPTIONS: { value: SentiMode; label: string; short: string }[] = [
  { value: 'sessionCompanion', label: 'Session Companion', short: 'Companion' },
  { value: 'morningBriefing', label: 'Morning Briefing', short: 'Briefing' },
  { value: 'postSessionAAR', label: 'After Action Review', short: 'AAR' },
  { value: 'onboarding', label: 'Onboarding', short: 'Onboard' },
];

const WELCOME_MESSAGES: Record<SentiMode, string> = {
  sessionCompanion: 'Watching. Ask when you need me.',
  morningBriefing: 'Your data from yesterday is ready. Want the briefing?',
  postSessionAAR: 'Session closed. Walk me through what happened.',
  onboarding: "You're here. Let's get oriented. Three things matter at the start.",
};

function getTextFromMessage(msg: UIMessage): string {
  if (!msg.parts) return '';
  return msg.parts
    .filter((p): p is { type: 'text'; text: string } => p.type === 'text')
    .map((p) => p.text)
    .join('');
}

export function SentinelChat() {
  const [open, setOpen] = useState(false);
  const [mode, setMode] = useState<SentiMode>('sessionCompanion');
  const [showModeMenu, setShowModeMenu] = useState(false);
  const [input, setInput] = useState('');
  const scrollRef = useRef<HTMLDivElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

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

  // Auto-scroll on new messages
  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' });
  }, [messages]);

  // Focus input when panel opens
  useEffect(() => {
    if (open) {
      setTimeout(() => inputRef.current?.focus(), 200);
    }
  }, [open]);

  // Close on outside click
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (
        panelRef.current &&
        !panelRef.current.contains(e.target as Node) &&
        !(e.target as HTMLElement).closest('.sentinel-fab')
      ) {
        setOpen(false);
        setShowModeMenu(false);
      }
    }
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, []);

  // Mode switch — reset conversation with new welcome
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
    setShowModeMenu(false);
  }

  // Send message handler
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

  const activeMode = MODE_OPTIONS.find((m) => m.value === mode);

  return (
    <div className="fixed bottom-6 right-6 z-50">
      {/* Chat panel */}
      {open && (
        <div
          ref={panelRef}
          className="absolute bottom-16 right-0 w-[340px] flex flex-col rounded-2xl overflow-hidden"
          style={{
            maxHeight: '480px',
            background: 'rgba(13, 15, 21, 0.92)',
            backdropFilter: 'blur(24px) saturate(1.3)',
            border: '1px solid rgba(255,255,255,0.06)',
            boxShadow: '0 24px 48px rgba(0,0,0,0.5), 0 0 0 1px rgba(255,255,255,0.03)',
            animation: 'sentinel-pop 0.25s cubic-bezier(0.175, 0.885, 0.32, 1.275) forwards',
            transformOrigin: 'bottom right',
          }}
        >
          {/* Header */}
          <div className="flex items-center gap-2 px-4 py-3 border-b border-white/[0.04]">
            <Bot size={14} className="text-positive" />
            <span className="font-mono text-[12px] font-bold uppercase tracking-[0.15em] text-text-muted">
              Senti
            </span>

            {/* Mode selector */}
            <div className="relative ml-1">
              <button
                onClick={() => setShowModeMenu(!showModeMenu)}
                className="flex items-center gap-1 rounded-md px-2 py-0.5 font-mono text-[10px] text-text-dim transition-colors hover:text-text-muted"
                style={{ background: 'rgba(255,255,255,0.04)' }}
              >
                {activeMode?.short}
                <ChevronDown size={10} />
              </button>

              {showModeMenu && (
                <div
                  className="absolute left-0 top-full mt-1 w-44 rounded-lg py-1 z-50"
                  style={{
                    background: 'rgba(13, 15, 21, 0.96)',
                    border: '1px solid rgba(255,255,255,0.08)',
                    boxShadow: '0 12px 24px rgba(0,0,0,0.4)',
                  }}
                >
                  {MODE_OPTIONS.map((opt) => (
                    <button
                      key={opt.value}
                      onClick={() => switchMode(opt.value)}
                      className={`w-full text-left px-3 py-1.5 font-mono text-[11px] transition-colors ${
                        opt.value === mode
                          ? 'text-positive bg-white/[0.04]'
                          : 'text-text-muted hover:text-text-primary hover:bg-white/[0.02]'
                      }`}
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>
              )}
            </div>

            <div className="ml-auto flex items-center gap-1.5">
              <div className={`h-1.5 w-1.5 rounded-full ${isBusy ? 'bg-warning animate-pulse' : 'bg-stable'}`} />
              <span className="font-mono text-[10px] text-text-dim">
                {isBusy ? 'Working on it.' : 'Active'}
              </span>
            </div>
            <button
              onClick={() => setOpen(false)}
              className="ml-1 rounded-md p-1 text-text-dim hover:text-text-muted transition-colors"
            >
              <X size={12} />
            </button>
          </div>

          {/* Messages */}
          <div
            ref={scrollRef}
            className="flex-1 overflow-auto px-4 py-3 space-y-3"
            style={{ scrollbarWidth: 'none', maxHeight: '340px' }}
          >
            {messages.map((msg) => {
              const text = getTextFromMessage(msg);
              return (
                <div
                  key={msg.id}
                  className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
                >
                  {/* Streaming indicator for empty assistant message */}
                  {msg.role === 'assistant' && text === '' && isBusy ? (
                    <div
                      className="max-w-[85%] rounded-xl px-3 py-2"
                      style={{ background: 'rgba(255,255,255,0.03)' }}
                    >
                      <div className="flex items-center gap-1.5">
                        <div className="h-1 w-1 rounded-full bg-text-dim animate-pulse" style={{ animationDelay: '0ms' }} />
                        <div className="h-1 w-1 rounded-full bg-text-dim animate-pulse" style={{ animationDelay: '200ms' }} />
                        <div className="h-1 w-1 rounded-full bg-text-dim animate-pulse" style={{ animationDelay: '400ms' }} />
                      </div>
                    </div>
                  ) : (
                    <div
                      className={`max-w-[85%] rounded-xl px-3 py-2 font-mono text-[12px] leading-relaxed whitespace-pre-wrap ${
                        msg.role === 'assistant'
                          ? 'text-text-secondary'
                          : 'text-text-primary'
                      }`}
                      style={{
                        background:
                          msg.role === 'assistant'
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

          {/* Input */}
          <div className="flex items-center gap-2 border-t border-white/[0.04] px-3 py-2.5">
            <input
              ref={inputRef}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Ask about your data..."
              disabled={isBusy}
              className="flex-1 bg-transparent font-mono text-[12px] text-text-primary placeholder-text-dim outline-none disabled:opacity-50"
            />
            <button
              onClick={handleSend}
              disabled={isBusy || !input.trim()}
              className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg transition-colors text-text-muted hover:text-positive disabled:opacity-30 disabled:pointer-events-none"
              style={{ background: 'rgba(255,255,255,0.04)' }}
            >
              {isBusy ? (
                <Loader2 size={12} className="animate-spin" />
              ) : (
                <Send size={12} />
              )}
            </button>
          </div>
        </div>
      )}

      {/* Floating Senti FAB */}
      <GlowCard variant="teal" className="rounded-full">
        <button
          className="sentinel-fab relative flex h-12 w-12 items-center justify-center rounded-full transition-all duration-300 hover:scale-110"
          onClick={() => setOpen(!open)}
          style={{
            background:
              'radial-gradient(circle at 30% 30%, rgba(34, 211, 238, 0.9), rgba(6, 182, 212, 0.8))',
            boxShadow: open
              ? '0 0 15px rgba(34, 211, 238, 0.4), 0 0 30px rgba(34, 211, 238, 0.2)'
              : '0 0 20px rgba(34, 211, 238, 0.6), 0 0 40px rgba(34, 211, 238, 0.3), 0 0 60px rgba(34, 211, 238, 0.15)',
          }}
        >
          <div className="absolute inset-0 rounded-full bg-gradient-to-b from-white/25 to-transparent pointer-events-none" />
          <div className="relative z-10 text-void">
            {open ? <X size={18} /> : <Bot size={20} />}
          </div>
          {!open && (
            <div
              className="absolute inset-0 rounded-full animate-ping pointer-events-none"
              style={{ backgroundColor: 'rgba(34, 211, 238, 0.2)' }}
            />
          )}
        </button>
      </GlowCard>

      <style jsx>{`
        @keyframes sentinel-pop {
          0% {
            opacity: 0;
            transform: scale(0.85) translateY(8px);
          }
          100% {
            opacity: 1;
            transform: scale(1) translateY(0);
          }
        }
      `}</style>
    </div>
  );
}
