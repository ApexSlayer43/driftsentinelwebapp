'use client';

import React, { useState, useRef, useEffect, useCallback } from 'react';
import { Send, Bot, X, Loader2 } from 'lucide-react';
import { LiquidGlassCard } from '@/components/ui/liquid-glass-card';

interface Message {
  id: string;
  role: 'sentinel' | 'user';
  text: string;
}

interface ApiMessage {
  role: 'user' | 'assistant';
  content: string;
}

const INITIAL_MESSAGE: Message = {
  id: 'welcome',
  role: 'sentinel',
  text: 'I only speak from what your data shows. Ask me about your violations, behavioral patterns, or session history.',
};

export function SentinelChat() {
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<Message[]>([INITIAL_MESSAGE]);
  const [input, setInput] = useState('');
  const [isStreaming, setIsStreaming] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const abortRef = useRef<AbortController | null>(null);

  // Auto-scroll on new messages / streaming updates
  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' });
  }, [messages]);

  // Close on outside click
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (
        panelRef.current &&
        !panelRef.current.contains(e.target as Node) &&
        !(e.target as HTMLElement).closest('.sentinel-fab')
      ) {
        setOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, []);

  // Abort in-flight request when panel closes or component unmounts
  useEffect(() => {
    if (!open && abortRef.current) {
      abortRef.current.abort();
      abortRef.current = null;
    }
  }, [open]);

  useEffect(() => {
    return () => {
      abortRef.current?.abort();
    };
  }, []);

  const handleSend = useCallback(async () => {
    const trimmed = input.trim();
    if (!trimmed || isStreaming) return;

    const userMsg: Message = { id: `u-${Date.now()}`, role: 'user', text: trimmed };
    const sentinelId = `s-${Date.now()}`;
    const placeholderMsg: Message = { id: sentinelId, role: 'sentinel', text: '' };

    setMessages((prev) => [...prev, userMsg, placeholderMsg]);
    setInput('');
    setIsStreaming(true);

    // Build conversation history for the API (exclude welcome message, map roles)
    const history: ApiMessage[] = [...messages, userMsg]
      .filter((m) => m.id !== 'welcome')
      .map((m) => ({
        role: m.role === 'user' ? ('user' as const) : ('assistant' as const),
        content: m.text,
      }));

    // Abort any previous request
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;

    try {
      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ messages: history }),
        signal: controller.signal,
      });

      if (!response.ok) {
        const errorText =
          response.status === 401
            ? 'Session expired. Refresh the page and log in again.'
            : 'Something went wrong. Try again.';
        setMessages((prev) =>
          prev.map((m) => (m.id === sentinelId ? { ...m, text: errorText } : m))
        );
        setIsStreaming(false);
        return;
      }

      const reader = response.body?.getReader();
      if (!reader) {
        setMessages((prev) =>
          prev.map((m) =>
            m.id === sentinelId ? { ...m, text: 'No response stream available.' } : m
          )
        );
        setIsStreaming(false);
        return;
      }

      const decoder = new TextDecoder();
      let accumulated = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        accumulated += decoder.decode(value, { stream: true });
        const currentText = accumulated;
        setMessages((prev) =>
          prev.map((m) => (m.id === sentinelId ? { ...m, text: currentText } : m))
        );
      }

      // If we got nothing back, show a fallback
      if (!accumulated) {
        setMessages((prev) =>
          prev.map((m) =>
            m.id === sentinelId
              ? { ...m, text: 'I don\'t have data on that.' }
              : m
          )
        );
      }
    } catch (err: unknown) {
      if (err instanceof Error && err.name === 'AbortError') {
        // Request was cancelled — remove empty placeholder
        setMessages((prev) => prev.filter((m) => m.id !== sentinelId || m.text !== ''));
      } else {
        setMessages((prev) =>
          prev.map((m) =>
            m.id === sentinelId
              ? { ...m, text: 'Connection error. Try again.' }
              : m
          )
        );
      }
    } finally {
      setIsStreaming(false);
      abortRef.current = null;
    }
  }, [input, isStreaming, messages]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  return (
    <div className="fixed bottom-6 right-6 z-50">
      {/* Chat panel — LiquidGlassCard with SVG distortion */}
      {open && (
        <div
          ref={panelRef}
          className="absolute bottom-16 right-0 w-80"
          style={{
            maxHeight: '400px',
            animation: 'sentinel-pop 0.25s cubic-bezier(0.175, 0.885, 0.32, 1.275) forwards',
            transformOrigin: 'bottom right',
          }}
        >
          <LiquidGlassCard variant="elevated" animate={false} className="flex flex-col overflow-hidden" borderRadius="24px" style={{ maxHeight: '400px' }}>
          {/* Header */}
          <div className="flex items-center gap-2 px-4 py-3 border-b border-white/[0.04]">
            <Bot size={14} className="text-positive" />
            <span className="font-mono text-[12px] font-bold uppercase tracking-[0.15em] text-text-muted">
              Senti
            </span>
            <div className="ml-auto flex items-center gap-1.5">
              <div className="h-1.5 w-1.5 rounded-full bg-stable animate-pulse" />
              <span className="font-mono text-[12px] text-text-dim">
                {isStreaming ? 'Analyzing' : 'Active'}
              </span>
            </div>
            <button
              onClick={() => setOpen(false)}
              className="ml-2 rounded-md p-1 text-text-dim hover:text-text-muted transition-colors"
            >
              <X size={12} />
            </button>
          </div>

          {/* Messages */}
          <div
            ref={scrollRef}
            className="flex-1 overflow-auto px-4 py-3 space-y-3"
            style={{ scrollbarWidth: 'none' }}
          >
            {messages.map((msg) => (
              <div
                key={msg.id}
                className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
              >
                {/* Typing indicator for empty streaming sentinel message */}
                {msg.role === 'sentinel' && msg.text === '' && isStreaming ? (
                  <div className="max-w-[85%] rounded-xl px-3 py-2 glass-inset">
                    <div className="flex items-center gap-1">
                      <span
                        className="h-1.5 w-1.5 rounded-full bg-stable animate-bounce"
                        style={{ animationDelay: '0ms' }}
                      />
                      <span
                        className="h-1.5 w-1.5 rounded-full bg-stable animate-bounce"
                        style={{ animationDelay: '150ms' }}
                      />
                      <span
                        className="h-1.5 w-1.5 rounded-full bg-stable animate-bounce"
                        style={{ animationDelay: '300ms' }}
                      />
                    </div>
                  </div>
                ) : (
                  <div
                    className={`max-w-[85%] rounded-xl px-3 py-2 font-mono text-[12px] leading-relaxed ${
                      msg.role === 'sentinel'
                        ? 'glass-inset text-text-secondary'
                        : 'liquid-glass-tab-active text-text-primary'
                    }`}
                  >
                    {msg.text}
                  </div>
                )}
              </div>
            ))}
          </div>

          {/* Input */}
          <div className="flex items-center gap-2 border-t border-white/[0.04] px-3 py-2">
            <input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Ask about your data..."
              disabled={isStreaming}
              className="flex-1 bg-transparent font-mono text-[12px] text-text-primary placeholder-text-dim outline-none disabled:opacity-50"
            />
            <button
              onClick={handleSend}
              disabled={isStreaming || !input.trim()}
              className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg transition-colors liquid-glass-tab hover:liquid-glass-tab-active text-text-muted hover:text-positive disabled:opacity-30 disabled:pointer-events-none"
            >
              {isStreaming ? (
                <Loader2 size={12} className="animate-spin" />
              ) : (
                <Send size={12} />
              )}
            </button>
          </div>
          </LiquidGlassCard>
        </div>
      )}

      {/* Floating green glowing button */}
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
        {/* Highlight */}
        <div className="absolute inset-0 rounded-full bg-gradient-to-b from-white/25 to-transparent pointer-events-none" />

        {/* Icon */}
        <div className="relative z-10 text-void">
          {open ? <X size={18} /> : <Bot size={20} />}
        </div>

        {/* Pulse ring (only when closed) */}
        {!open && (
          <div
            className="absolute inset-0 rounded-full animate-ping pointer-events-none"
            style={{ backgroundColor: 'rgba(34, 211, 238, 0.2)' }}
          />
        )}
      </button>

      {/* Keyframes */}
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
