import { createClient } from '@supabase/supabase-js'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string | undefined
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined

/** False when `.env` is missing — avoids a blank page from throwing at import time. */
export const isSupabaseConfigured = Boolean(supabaseUrl && supabaseAnonKey)

/**
 * Always construct a client so imports don't crash the bundle.
 * When env is missing, calls fail predictably; gate UX with `isSupabaseConfigured`.
 */
export const supabase = createClient(
  supabaseUrl ?? 'https://placeholder.supabase.co',
  supabaseAnonKey ?? 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.e30.'
)

export interface Database {
  public: {
    Tables: {
      profiles: {
        Row: {
          id: string
          email: string
          created_at: string
          updated_at: string
        }
        Insert: {
          id: string
          email: string
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          email?: string
          created_at?: string
          updated_at?: string
        }
      }
      paper_accounts: {
        Row: {
          id: string
          user_id: string
          name: string
          starting_balance: number
          current_balance: number
          total_profit_loss: number
          is_active: boolean
          created_at: string
          updated_at: string
        }
      }
      simulated_trades: {
        Row: {
          id: string
          user_id: string
          paper_account_id: string
          symbol: string
          trade_type: 'long' | 'short'
          is_ai_recommended: boolean
          ai_confidence_score: number | null
          odds_score: number | null
          entry_price: number
          stop_loss: number
          target_price: number
          position_size: number
          risk_amount: number
          reward_amount: number
          status: 'pending' | 'open' | 'closed' | 'cancelled'
          entry_time: string | null
          exit_time: string | null
          exit_price: number | null
          profit_loss: number | null
          exit_reason: 'target' | 'stop' | 'manual' | 'time' | null
          created_at: string
          updated_at: string
        }
      }
      watchlists: {
        Row: {
          id: string
          user_id: string
          symbol: string
          notes: string | null
          created_at: string
        }
      }
      trade_plans: {
        Row: {
          id: string
          user_id: string
          symbol: string
          trade_type: 'long' | 'short'
          entry_price: number
          stop_loss: number
          target_price: number
          risk_reward_ratio: number
          position_size: number | null
          notes: string | null
          status: 'planned' | 'executed' | 'cancelled'
          created_at: string
          updated_at: string
        }
      }
      journal_entries: {
        Row: {
          id: string
          user_id: string
          symbol: string | null
          trade_date: string
          trade_type: 'long' | 'short' | null
          entry_price: number | null
          exit_price: number | null
          profit_loss: number | null
          notes: string | null
          emotions: string | null
          lessons_learned: string | null
          created_at: string
          updated_at: string
        }
      }
      ai_recommendations: {
        Row: {
          id: string
          user_id: string
          symbol: string
          action: 'long' | 'short' | 'no_action'
          confidence_score: number
          odds_score: number
          entry_price: number
          stop_loss: number
          target_price: number
          reasoning: any
          was_taken: boolean
          simulated_trade_id: string | null
          outcome: 'win' | 'loss' | 'pending' | null
          created_at: string
          updated_at: string
        }
      }
      market_scans: {
        Row: {
          id: string
          user_id: string
          scan_type: string
          timeframe: string
          min_score: number
          results: any
          created_at: string
        }
      }
      ai_learning_history: {
        Row: {
          id: string
          user_id: string
          event_type: string
          performance_metric: number
          adjustments: any
          created_at: string
        }
      }
    }
  }
}
