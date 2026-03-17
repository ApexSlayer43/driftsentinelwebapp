'use client';

import { useState, useEffect, useCallback } from 'react';
import type { Strategy } from '@/lib/strategies';

export function useStrategies() {
  const [strategies, setStrategies] = useState<Strategy[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchStrategies = useCallback(async () => {
    try {
      const res = await fetch('/api/strategies');
      if (res.ok) {
        const data = await res.json();
        setStrategies(data.strategies ?? []);
      }
    } catch {
      // Silent fail
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchStrategies();
  }, [fetchStrategies]);

  const createStrategy = useCallback(async (tag: string, description?: string) => {
    const res = await fetch('/api/strategies', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ tag, description }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Failed to create strategy');
    await fetchStrategies();
    return data.strategy as Strategy;
  }, [fetchStrategies]);

  const defaultStrategy = strategies.find((s) => s.is_default) ?? null;

  return { strategies, loading, defaultStrategy, createStrategy, refetch: fetchStrategies };
}
