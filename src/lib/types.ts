// /v1/state response type — the data contract the entire frontend consumes

export interface DriftDriver {
  mode: string;
  points: number;
  onset_utc: string;
}

export interface ViolationToday {
  violation_id: string;
  mode: string;
  rule_id: string;
  severity: 'LOW' | 'MED' | 'HIGH' | 'CRITICAL';
  points: number;
  first_seen_utc: string;
  created_at: string;
}

export interface OnboardingProgress {
  collected: number;
  required: number;
  remaining: number;
}

export interface OnboardingView {
  phase: string;
  status: string;
  is_building: boolean;
  total_fills_seen: number;
  scoring_window_fills: number;
  baseline_window_fills: number;
  scoring_progress: OnboardingProgress;
  baseline_progress: OnboardingProgress;
  note?: string;
}

export interface StatePayload {
  account_ref: string;
  drift: {
    state: 'STABLE' | 'DRIFT_FORMING' | 'COMPROMISED' | 'BREAKDOWN';
    drift_index: number;
    data_stale: boolean;
    computed_at: string | null;
    window_start_utc: string | null;
    window_end_utc: string | null;
    drivers: DriftDriver[];
  };
  last_execution_update_utc: string | null;
  protocol: {
    ref: string;
    version: string;
    activation_utc: null;
    source: string;
  };
  metrics: {
    trades_today_utc: number;
    violations_today_utc: number;
    protocol_breaches_today_utc: number;
    daily_pnl: null;
  };
  bss_score: number;
  bss_tier: 'DORMANT' | 'FORMING' | 'DEVELOPING' | 'CONSISTENT' | 'DISCIPLINED' | 'SOVEREIGN';
  bss_streak: number;
  bss_alpha: number;
  bss_decay_applied: boolean;
  bss_delta: number;
  bss_yesterday: number;
  bss_sparkline: number[];
  dsi_score: number;
  dsi_state: string;
  violations_today: ViolationToday[];
  onboarding: OnboardingView;
}

// Session config from user_configs.sessions_utc
export interface SessionConfig {
  name: string;
  start_utc: string; // "HH:MM" — legacy field name, now treated as local time
  end_utc: string;   // "HH:MM" — legacy field name, now treated as local time
  start_local?: string; // "HH:MM" — preferred alias
  end_local?: string;   // "HH:MM" — preferred alias
  days: string[];     // ["Mon","Tue",...]
  market_tz?: string; // IANA timezone for exchange, e.g. "America/Chicago"
}

// Violation detail (full row from violations table)
export interface ViolationDetail {
  violation_id: string;
  mode_instance_id: string;
  account_ref: string;
  rule_id: string;
  mode: string;
  severity: 'LOW' | 'MED' | 'HIGH' | 'CRITICAL';
  points: number;
  first_seen_utc: string;
  window_start_utc: string;
  window_end_utc: string;
  evidence_event_ids: string[];
  created_at: string;
}

// Fill from fills_canonical
export interface FillCanonical {
  event_id: string;
  account_ref: string;
  ingest_run_id: string;
  timestamp_utc: string;
  instrument_root: string;
  contract: string;
  side: 'BUY' | 'SELL';
  qty: number;
  price: number;
  commission: number;
  off_session: boolean;
  created_at: string;
}

// Daily score from daily_scores
export interface DailyScore {
  daily_score_id: string;
  account_ref: string;
  trading_date: string;
  dsi_score: number;
  violation_count: number;
  fills_count: number;
  bss_score: number;
  bss_previous: number;
  streak_count: number;
  alpha_effective: number;
  computed_at: string;
}

// Session from sessions table (migration 003)
export interface Session {
  session_id: string;
  account_ref: string;
  user_id: string;
  trading_date: string;
  session_start_utc: string;
  session_end_utc: string;
  fills_count: number;
  violation_count: number;
  dsi_score: number | null;
  bss_at_session: number | null;
  bss_delta: number | null;
  first_violation_sequence: number | null;
  max_consecutive_losses: number;
  recovery_attempted: boolean;
  session_extended: boolean;
  session_quality: 'CLEAN' | 'MINOR' | 'DEGRADED' | 'COMPROMISED' | 'BREAKDOWN';
  ingest_run_id: string;
  created_at: string;
}

// Session event from session_events table
export interface SessionEvent {
  session_event_id: string;
  session_id: string;
  account_ref: string;
  user_id: string;
  sequence_number: number;
  elapsed_seconds: number;
  event_type: string;
  metadata: Record<string, any>;
  fill_event_id: string | null;
  violation_id: string | null;
  preceding_event_id: string | null;
  created_at: string;
}

// Upload event from upload_events table
export interface UploadEvent {
  upload_event_id: string;
  user_id: string;
  account_ref: string;
  ingest_run_id: string;
  uploaded_at: string;
  gap_hours: number | null;
  cadence_status: 'SAME_DAY' | 'NEXT_DAY' | 'SHORT_GAP' | 'MEDIUM_GAP' | 'LONG_GAP' | 'DARK_PERIOD' | 'FIRST_UPLOAD';
  detected_platform: string;
  session_count: number;
  trade_count: number;
  date_range_start: string | null;
  date_range_end: string | null;
}

// Ingest run from ingest_runs
export interface IngestRun {
  ingest_run_id: string;
  user_id: string;
  account_ref: string;
  device_id: string;
  file_name: string;
  file_hash: string;
  accepted_count: number;
  dup_count: number;
  reject_count: number;
  reject_summary: Record<string, number>;
  compute_triggered: boolean;
  created_at: string;
}
