import { useEffect, useRef, useState } from 'react'
import { useAuth } from '@/hooks/useAuth'
import { supabase } from '@/lib/supabase'
import { trainingAccountService, TrainingAccount } from '@/lib/trainingAccountService'
import {
  isSimulationRunning,
  startAccountSimulation,
  stopAccountSimulation,
  stopAllSimulations,
} from '@/lib/trainingSimulator'

/**
 * Keeps "active" training accounts running across route changes.
 *
 * The training loop is implemented as browser timers (see `trainingSimulator.ts`).
 * Without this, simulations only run while the Training Accounts page is mounted.
 */
export default function TrainingBackgroundRunner() {
  const { user } = useAuth()
  const [watchlistSymbols, setWatchlistSymbols] = useState<string[]>([])
  const syncingRef = useRef(false)

  useEffect(() => {
    if (!user) {
      stopAllSimulations()
      setWatchlistSymbols([])
    }
  }, [user])

  useEffect(() => {
    if (!user) return

    let isCancelled = false

    const loadWatchlist = async () => {
      const { data } = await supabase
        .from('watchlists')
        .select('symbol')
        .eq('user_id', user.id)

      if (isCancelled) return
      setWatchlistSymbols((data || []).map((d) => d.symbol))
    }

    loadWatchlist()
    const timer = window.setInterval(loadWatchlist, 60_000)

    return () => {
      isCancelled = true
      clearInterval(timer)
    }
  }, [user])

  useEffect(() => {
    if (!user) return

    const sync = async () => {
      if (syncingRef.current) return
      syncingRef.current = true
      try {
        const accounts = await trainingAccountService.getAccounts(user.id)
        const activeIds = new Set(accounts.filter((a) => a.status === 'active').map((a) => a.id))

        // Start any newly-active accounts.
        for (const account of accounts) {
          if (account.status === 'active' && !isSimulationRunning(account.id)) {
            startAccountSimulation(account as TrainingAccount, watchlistSymbols)
          }
        }

        // Stop any simulations that should no longer be running.
        // (e.g., account paused/stopped in another tab)
        for (const account of accounts) {
          if (account.status !== 'active' && isSimulationRunning(account.id)) {
            stopAccountSimulation(account.id)
          }
        }

        // If an account was deleted, we won't see it in `accounts` at all.
        // We can't enumerate timers from here, so this is best-effort.
        // (Stop All still works, and logout stops everything.)
        void activeIds
      } finally {
        syncingRef.current = false
      }
    }

    sync()
    const timer = window.setInterval(sync, 10_000)
    return () => clearInterval(timer)
  }, [user, watchlistSymbols])

  return null
}

