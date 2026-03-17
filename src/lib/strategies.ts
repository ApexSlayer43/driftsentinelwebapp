// src/lib/strategies.ts
// Strategy management — client-side types + helpers

export interface Strategy {
  strategy_id: string;
  account_ref: string;
  tag: string;
  description: string | null;
  color: string | null;
  active: boolean;
  is_default: boolean;
  created_at: string;
}

export const STRATEGY_ALL = '__all__' as const;
export type StrategyFilter = string | typeof STRATEGY_ALL;
