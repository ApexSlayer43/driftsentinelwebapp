export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  public: {
    Tables: {
      accounts: {
        Row: {
          account_ref: string
          bss_score: number | null
          created_at: string
          source: string
          user_id: string
        }
        Insert: {
          account_ref: string
          bss_score?: number | null
          created_at?: string
          source?: string
          user_id: string
        }
        Update: {
          account_ref?: string
          bss_score?: number | null
          created_at?: string
          source?: string
          user_id?: string
        }
        Relationships: []
      }
      daily_scores: {
        Row: {
          account_ref: string
          computed_at: string
          daily_score_id: string
          dsi_score: number
          fills_count: number
          trading_date: string
          violation_count: number
        }
        Insert: {
          account_ref: string
          computed_at?: string
          daily_score_id?: string
          dsi_score?: number
          fills_count?: number
          trading_date: string
          violation_count?: number
        }
        Update: {
          account_ref?: string
          computed_at?: string
          daily_score_id?: string
          dsi_score?: number
          fills_count?: number
          trading_date?: string
          violation_count?: number
        }
        Relationships: []
      }
      device_tokens: {
        Row: {
          account_ref: string
          created_at: string
          device_id: string
          last_seen: string | null
          status: string
          token_hash: string
          user_id: string
        }
        Insert: {
          account_ref: string
          created_at?: string
          device_id: string
          last_seen?: string | null
          status?: string
          token_hash: string
          user_id: string
        }
        Update: {
          account_ref?: string
          created_at?: string
          device_id?: string
          last_seen?: string | null
          status?: string
          token_hash?: string
          user_id?: string
        }
        Relationships: []
      }
      violations: {
        Row: {
          account_ref: string
          created_at: string
          evidence_event_ids: string[]
          first_seen_utc: string
          mode: string
          mode_instance_id: string
          points: number
          rule_id: string
          severity: string
          violation_id: string
          window_end_utc: string
          window_start_utc: string
        }
        Insert: {
          account_ref: string
          created_at?: string
          evidence_event_ids?: string[]
          first_seen_utc: string
          mode: string
          mode_instance_id: string
          points: number
          rule_id: string
          severity: string
          violation_id?: string
          window_end_utc: string
          window_start_utc: string
        }
        Update: {
          account_ref?: string
          created_at?: string
          evidence_event_ids?: string[]
          first_seen_utc?: string
          mode?: string
          mode_instance_id?: string
          points?: number
          rule_id?: string
          severity?: string
          violation_id?: string
          window_end_utc?: string
          window_start_utc?: string
        }
        Relationships: []
      }
      user_configs: {
        Row: {
          account_ref: string
          baseline_window_fills: number
          max_contracts: number
          max_fills_per_day: number
          scoring_window_fills: number
          sessions_utc: Json
          timezone: string | null
          updated_at: string
        }
        Insert: {
          account_ref: string
          baseline_window_fills?: number
          max_contracts?: number
          max_fills_per_day?: number
          scoring_window_fills?: number
          sessions_utc?: Json
          timezone?: string | null
          updated_at?: string
        }
        Update: {
          account_ref?: string
          baseline_window_fills?: number
          max_contracts?: number
          max_fills_per_day?: number
          scoring_window_fills?: number
          sessions_utc?: Json
          timezone?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      fills_canonical: {
        Row: {
          account_ref: string
          commission: number
          contract: string
          created_at: string
          event_id: string
          ingest_run_id: string
          instrument_root: string
          off_session: boolean
          price: number
          qty: number
          side: string
          timestamp_utc: string
        }
        Insert: {
          account_ref: string
          commission?: number
          contract: string
          created_at?: string
          event_id: string
          ingest_run_id: string
          instrument_root: string
          off_session?: boolean
          price: number
          qty: number
          side: string
          timestamp_utc: string
        }
        Update: {
          account_ref?: string
          commission?: number
          contract?: string
          created_at?: string
          event_id?: string
          ingest_run_id?: string
          instrument_root?: string
          off_session?: boolean
          price?: number
          qty?: number
          side?: string
          timestamp_utc?: string
        }
        Relationships: []
      }
      ingest_runs: {
        Row: {
          accepted_count: number
          account_ref: string
          compute_triggered: boolean
          created_at: string
          device_id: string
          dup_count: number
          file_hash: string
          file_name: string
          ingest_run_id: string
          reject_count: number
          reject_summary: Json
          user_id: string
        }
        Insert: {
          accepted_count?: number
          account_ref: string
          compute_triggered?: boolean
          created_at?: string
          device_id: string
          dup_count?: number
          file_hash: string
          file_name: string
          ingest_run_id?: string
          reject_count?: number
          reject_summary?: Json
          user_id: string
        }
        Update: {
          accepted_count?: number
          account_ref?: string
          compute_triggered?: boolean
          created_at?: string
          device_id?: string
          dup_count?: number
          file_hash?: string
          file_name?: string
          ingest_run_id?: string
          reject_count?: number
          reject_summary?: Json
          user_id?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      [_ in never]: never
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}
