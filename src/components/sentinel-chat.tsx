'use client';

import React, { useState, useRef, useEffect } from 'react';
import { Send, Bot, X } from 'lucide-react';

interface Message {
  id: string;
  role: 'sentinel' | 'user';
  text: string;
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
  const scrollRef = useRef<HTMLDivElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);

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

  const handleSend = () => {
    const trimmed = input.trim();
    if (!trimmed) return;

    const userMsg: Message = { id: `u-${Date.now()}`, role: 'user', text: trimmed };
    setMessages((prev) => [...prev, userMsg]);
    setInput('');

    setTimeout(() => {
      const response = deriveResponse(trimmed);
      setMessages((prev) => [...prev, { id: `s-${Date.now()}`, role: 'sentinel', text: response }]);
    }, 600);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  return (
    <div className="fixed bottom-6 right-6 z-50">
      {/* Chat panel */}
      {open && (
        <div
          ref={panelRef}
          className="absolute bottom-16 right-0 w-80 flex flex-col rounded-2xl liquid-glass overflow-hidden"
          style={{
            maxHeight: '400px',
            animation: 'sentinel-pop 0.25s cubic-bezier(0.175, 0.885, 0.32, 1.275) forwards',
            transformOrigin: 'bottom right',
          }}
        >
          {/* Header */}
          <div className="flex items-center gap-2 px-4 py-3 border-b border-border-dim">
            <Bot size={14} className="text-stable" />
            <span className="font-mono text-[9px] font-bold uppercase tracking-[0.15em] text-text-muted">
              Sentinel
            </span>
            <div className="ml-auto flex items-center gap-1.5">
              <div className="h-1.5 w-1.5 rounded-full bg-stable animate-pulse" />
              <span className="font-mono text-[7px] text-text-dim">Active</span>
            </div>
            <button
              onClick={() => setOpen(false)}
              className="ml-2 rounded-md p-1 text-text-dim hover:text-text-muted transition-colors"
            >
              <X size={12} />
            </button>
          </div>

          {/* Messages */}
          <div ref={scrollRef} className="flex-1 overflow-auto px-4 py-3 space-y-3" style={{ scrollbarWidth: 'none' }}>
            {messages.map((msg) => (
              <div key={msg.id} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                <div
                  className={`max-w-[85%] rounded-xl px-3 py-2 font-mono text-[10px] leading-relaxed ${
                    msg.role === 'sentinel'
                      ? 'glass text-text-secondary'
                      : 'liquid-glass-tab-active text-text-primary'
                  }`}
                >
                  {msg.text}
                </div>
              </div>
            ))}
          </div>

          {/* Input */}
          <div className="flex items-center gap-2 border-t border-border-dim px-3 py-2">
            <input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Ask about your data..."
              className="flex-1 bg-transparent font-mono text-[10px] text-text-primary placeholder-text-dim outline-none"
            />
            <button
              onClick={handleSend}
              className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg transition-colors liquid-glass-tab hover:liquid-glass-tab-active text-text-muted hover:text-stable"
            >
              <Send size={12} />
            </button>
          </div>
        </div>
      )}

      {/* Floating green glowing button */}
      <button
        className="sentinel-fab relative flex h-12 w-12 items-center justify-center rounded-full transition-all duration-300 hover:scale-110"
        onClick={() => setOpen(!open)}
        style={{
          background: 'radial-gradient(circle at 30% 30%, rgba(0, 212, 170, 0.9), rgba(0, 184, 148, 0.8))',
          boxShadow: open
            ? '0 0 15px rgba(0, 212, 170, 0.4), 0 0 30px rgba(0, 212, 170, 0.2)'
            : '0 0 20px rgba(0, 212, 170, 0.6), 0 0 40px rgba(0, 212, 170, 0.3), 0 0 60px rgba(0, 212, 170, 0.15)',
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
            style={{ backgroundColor: 'rgba(0, 212, 170, 0.2)' }}
          />
        )}
      </button>

      {/* Keyframes */}
      <style jsx>{`
        @keyframes sentinel-pop {
          0% { opacity: 0; transform: scale(0.85) translateY(8px); }
          100% { opacity: 1; transform: scale(1) translateY(0); }
        }
      `}</style>
    </div>
  );
}

/** Derive a response strictly from behavioral data — never infer or speculate. */
function deriveResponse(query: string): string {
  const q = query.toLowerCase();

  if (q.includes('worst') || q.includes('biggest') || q.includes('highest')) {
    return 'Your highest single deduction is -12 from a CRITICAL Size Escalation violation on Mar 6. That represents 25.5% of your total deductions.';
  }
  if (q.includes('critical')) {
    return 'You have 1 CRITICAL violation: Size Escalation (R-SIZE-02) on Mar 6 at 22:22, costing 12 points. 4 evidence fills were recorded.';
  }
  if (q.includes('pattern') || q.includes('repeat') || q.includes('common')) {
    return 'Your most frequent violation modes are Off-Session Trading (2 occurrences) and Excessive Frequency (2 occurrences). Off-Session accounts for 10 combined deduction points.';
  }
  if (q.includes('today') || q.includes('recent') || q.includes('latest')) {
    return 'Today you recorded 3 violations: Oversize Position (-8, HIGH), Off-Session Trading (-5, MED), and Excessive Frequency (-3, LOW). Total session deductions: -16.';
  }
  if (q.includes('total') || q.includes('score') || q.includes('deduction')) {
    return 'Your total deductions across 8 violations sum to -47 points. Severity breakdown: CRITICAL 1, HIGH 2, MED 2, LOW 3.';
  }
  if (q.includes('revenge')) {
    return 'You have 1 Revenge Entry violation (HIGH, -10 points) from Mar 3 at 20:22. Rule R-REVENGE-01. 3 evidence fills were captured.';
  }
  if (q.includes('improve') || q.includes('better') || q.includes('advice')) {
    return 'I don\'t give advice — I report what happened. Your data shows Off-Session and Oversize are your top deduction sources at -18 combined. That\'s 38% of total deductions.';
  }
  if (q.includes('session') || q.includes('off')) {
    return '2 Off-Session Trading violations recorded: Mar 8 (-5, MED) and Mar 5 (-5, MED). Both triggered rule R-OFF-01 with 2 evidence fills each.';
  }
  if (q.includes('size') || q.includes('oversize')) {
    return 'Size-related violations: Oversize Position (-8, HIGH, Mar 8) and Size Escalation (-12, CRITICAL, Mar 6). Combined: -20 points, 42.5% of total.';
  }

  return 'I can report on your violations, severity breakdown, deduction totals, repeated patterns, and specific violation details. Ask me something specific about your data.';
}
