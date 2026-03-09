'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';

function SentinelEye({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 48 48"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
    >
      {/* Almond eye shape */}
      <path
        d="M4 24C4 24 14 10 24 10C34 10 44 24 44 24C44 24 34 38 24 38C14 38 4 24 4 24Z"
        stroke="currentColor"
        strokeWidth="1.5"
        fill="none"
      />
      {/* Center dot */}
      <circle cx="24" cy="24" r="4" fill="currentColor" />
      {/* Left horizontal tick */}
      <line x1="0" y1="24" x2="8" y2="24" stroke="currentColor" strokeWidth="1.5" />
      {/* Right horizontal tick */}
      <line x1="40" y1="24" x2="48" y2="24" stroke="currentColor" strokeWidth="1.5" />
    </svg>
  );
}

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);

    const supabase = createClient();
    const { error: authError } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (authError) {
      setError(authError.message);
      setLoading(false);
      return;
    }

    router.push('/');
    router.refresh();
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-void px-4">
      <div className="w-full max-w-sm">
        {/* Header */}
        <div className="mb-10 text-center">
          <div className="mx-auto mb-5 flex h-14 w-14 items-center justify-center border border-[#1A1D23] bg-surface">
            <SentinelEye className="h-7 w-7 text-stable" />
          </div>
          <p className="font-mono text-[9px] font-medium uppercase tracking-[0.25em] text-text-muted">
            Drift
          </p>
          <h1 className="font-display text-3xl font-extrabold tracking-tight text-stable">
            SENTINEL
          </h1>
          <p className="mt-2 font-mono text-[10px] uppercase tracking-[0.2em] text-text-muted">
            Behavioral Intelligence
          </p>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="mb-1.5 block font-mono text-[9px] font-semibold uppercase tracking-[0.15em] text-text-muted">
              Email
            </label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              className="w-full border border-[#1A1D23] bg-surface px-3 py-2.5 font-mono text-sm text-text-primary placeholder-text-dim outline-none transition-colors focus:border-stable"
              placeholder="trader@example.com"
            />
          </div>
          <div>
            <label className="mb-1.5 block font-mono text-[9px] font-semibold uppercase tracking-[0.15em] text-text-muted">
              Password
            </label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              className="w-full border border-[#1A1D23] bg-surface px-3 py-2.5 font-mono text-sm text-text-primary placeholder-text-dim outline-none transition-colors focus:border-stable"
              placeholder="Enter password"
            />
          </div>

          {error && (
            <p className="font-mono text-xs text-breakdown">{error}</p>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full border border-stable bg-stable py-2.5 font-mono text-sm font-bold uppercase tracking-wider text-void transition-opacity hover:opacity-90 disabled:opacity-50"
          >
            {loading ? 'Authenticating...' : 'Sign In'}
          </button>
        </form>

        <p className="mt-6 text-center font-mono text-[10px] text-text-muted">
          Don&apos;t have an account?{' '}
          <a href="/signup" className="text-stable hover:underline">
            Get started
          </a>
        </p>
      </div>
    </div>
  );
}
