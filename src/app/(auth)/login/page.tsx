'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { SentinelEye } from '@/components/sentinel-eye';

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
          <div className="mx-auto mb-5 flex h-16 w-16 items-center justify-center">
            <SentinelEye className="h-16 w-16 text-stable" />
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
