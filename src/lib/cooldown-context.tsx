'use client';

import {
  createContext,
  useContext,
  useState,
  useCallback,
  type ReactNode,
} from 'react';

interface CooldownState {
  isActive: boolean;
  activationId: string | null;
  prompt: string | null;
  promptType: string | null;
  bssAtActivation: number | null;
}

interface CooldownContextValue extends CooldownState {
  /** Activate cooldown mode — calls API, opens overlay */
  activate: () => Promise<void>;
  /** Close cooldown mode — calls close API, hides overlay */
  deactivate: () => void;
  /** Loading state while API call is in flight */
  loading: boolean;
}

const CooldownContext = createContext<CooldownContextValue | null>(null);

export function CooldownProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<CooldownState>({
    isActive: false,
    activationId: null,
    prompt: null,
    promptType: null,
    bssAtActivation: null,
  });
  const [loading, setLoading] = useState(false);

  const activate = useCallback(async () => {
    if (state.isActive || loading) return;
    setLoading(true);

    try {
      const res = await fetch('/api/cooldown/start', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ template: 'orb' }),
      });

      if (!res.ok) {
        console.error('Cooldown start failed:', res.status);
        setLoading(false);
        return;
      }

      const data = await res.json();

      setState({
        isActive: true,
        activationId: data.activation_id,
        prompt: data.prompt,
        promptType: data.prompt_type,
        bssAtActivation: data.bss_at_activation,
      });
    } catch (err) {
      console.error('Cooldown start error:', err);
    } finally {
      setLoading(false);
    }
  }, [state.isActive, loading]);

  const deactivate = useCallback(() => {
    setState({
      isActive: false,
      activationId: null,
      prompt: null,
      promptType: null,
      bssAtActivation: null,
    });
  }, []);

  return (
    <CooldownContext.Provider
      value={{ ...state, activate, deactivate, loading }}
    >
      {children}
    </CooldownContext.Provider>
  );
}

export function useCooldown() {
  const ctx = useContext(CooldownContext);
  if (!ctx) throw new Error('useCooldown must be inside CooldownProvider');
  return ctx;
}
