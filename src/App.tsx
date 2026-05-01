import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { AuthProvider, useAuth } from '@/hooks/useAuth'
import Layout from '@/components/Layout'
import Login from '@/pages/Login'
import Dashboard from '@/pages/Dashboard'
import Watchlist from '@/pages/Watchlist'
import AIRecommendations from '@/pages/AIRecommendations'
import PaperTrading from '@/pages/PaperTrading'
import TradePlan from '@/pages/TradePlan'
import DecisionMatrix from '@/pages/DecisionMatrix'
import Journal from '@/pages/Journal'
import Analytics from '@/pages/Analytics'
import Chart from '@/pages/Chart'
import AIRulebook from '@/pages/AIRulebook'
import AINeural from '@/pages/AINeural'
import MarketMonitor from '@/pages/MarketMonitor'
import Settings from '@/pages/Settings'
import AdminDashboard from '@/pages/AdminDashboard'
import MasterAI from '@/pages/MasterAI'
import LiveSignals from '@/pages/LiveSignals'
import TrainingAccounts from '@/pages/TrainingAccounts'
import RealWorldEvents from '@/pages/RealWorldEvents'
import PatternDiscovery from '@/pages/PatternDiscovery'
import HistoricalFleet from '@/pages/HistoricalFleet'
import ExternalDataSources from '@/pages/ExternalDataSources'
import MarketDataArchive from '@/pages/MarketDataArchive'
import APITest from '@/pages/APITest'
import WheelStrategy from '@/pages/WheelStrategy'
import CopyTrading from '@/pages/CopyTrading'
import { isSupabaseConfigured } from '@/lib/supabase'

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth()

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-900 flex items-center justify-center">
        <div className="text-white text-xl">Loading...</div>
      </div>
    )
  }

  if (!user) {
    return <Navigate to="/login" replace />
  }

  return <Layout>{children}</Layout>
}

function AppRoutes() {
  const { user, loading } = useAuth()

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-900 flex items-center justify-center">
        <div className="text-white text-xl">Loading...</div>
      </div>
    )
  }

  return (
    <Routes>
      <Route
        path="/login"
        element={user ? <Navigate to="/dashboard" replace /> : <Login />}
      />
      <Route
        path="/dashboard"
        element={
          <ProtectedRoute>
            <Dashboard />
          </ProtectedRoute>
        }
      />
      <Route
        path="/watchlist"
        element={
          <ProtectedRoute>
            <Watchlist />
          </ProtectedRoute>
        }
      />
      <Route
        path="/ai-recommendations"
        element={
          <ProtectedRoute>
            <AIRecommendations />
          </ProtectedRoute>
        }
      />
      <Route
        path="/live-signals"
        element={
          <ProtectedRoute>
            <LiveSignals />
          </ProtectedRoute>
        }
      />
      <Route
        path="/paper-trading"
        element={
          <ProtectedRoute>
            <PaperTrading />
          </ProtectedRoute>
        }
      />
      <Route
        path="/trade-plan"
        element={
          <ProtectedRoute>
            <TradePlan />
          </ProtectedRoute>
        }
      />
      <Route
        path="/matrix"
        element={
          <ProtectedRoute>
            <DecisionMatrix />
          </ProtectedRoute>
        }
      />
      <Route
        path="/journal"
        element={
          <ProtectedRoute>
            <Journal />
          </ProtectedRoute>
        }
      />
      <Route
        path="/analytics"
        element={
          <ProtectedRoute>
            <Analytics />
          </ProtectedRoute>
        }
      />
      <Route
        path="/chart"
        element={
          <ProtectedRoute>
            <Chart />
          </ProtectedRoute>
        }
      />
      <Route
        path="/ai-rulebook"
        element={
          <ProtectedRoute>
            <AIRulebook />
          </ProtectedRoute>
        }
      />
      <Route
        path="/ai-neural"
        element={
          <ProtectedRoute>
            <AINeural />
          </ProtectedRoute>
        }
      />
      <Route
        path="/market-monitor"
        element={
          <ProtectedRoute>
            <MarketMonitor />
          </ProtectedRoute>
        }
      />
      <Route
        path="/settings"
        element={
          <ProtectedRoute>
            <Settings />
          </ProtectedRoute>
        }
      />
      <Route
        path="/admin"
        element={
          <ProtectedRoute>
            <AdminDashboard />
          </ProtectedRoute>
        }
      />
      <Route
        path="/master-ai"
        element={
          <ProtectedRoute>
            <MasterAI />
          </ProtectedRoute>
        }
      />
      <Route
        path="/training-accounts"
        element={
          <ProtectedRoute>
            <TrainingAccounts />
          </ProtectedRoute>
        }
      />
      <Route
        path="/real-world-events"
        element={
          <ProtectedRoute>
            <RealWorldEvents />
          </ProtectedRoute>
        }
      />
      <Route
        path="/pattern-discovery"
        element={
          <ProtectedRoute>
            <PatternDiscovery />
          </ProtectedRoute>
        }
      />
      <Route
        path="/historical-fleet"
        element={
          <ProtectedRoute>
            <HistoricalFleet />
          </ProtectedRoute>
        }
      />
      <Route
        path="/external-data"
        element={
          <ProtectedRoute>
            <ExternalDataSources />
          </ProtectedRoute>
        }
      />
      <Route
        path="/market-archive"
        element={
          <ProtectedRoute>
            <MarketDataArchive />
          </ProtectedRoute>
        }
      />
      <Route
        path="/api-test"
        element={
          <ProtectedRoute>
            <APITest />
          </ProtectedRoute>
        }
      />
      <Route
        path="/wheel-strategy"
        element={
          <ProtectedRoute>
            <WheelStrategy />
          </ProtectedRoute>
        }
      />
      <Route
        path="/copy-trading"
        element={
          <ProtectedRoute>
            <CopyTrading />
          </ProtectedRoute>
        }
      />
      <Route path="/" element={<Navigate to="/dashboard" replace />} />
    </Routes>
  )
}

function App() {
  if (!isSupabaseConfigured) {
    return (
      <div className="min-h-screen bg-slate-900 text-slate-100 flex flex-col items-center justify-center p-8">
        <h1 className="text-2xl font-semibold text-white mb-3">Supabase env missing</h1>
        <p className="text-slate-400 text-center max-w-lg mb-4">
          Copy <code className="text-sky-300">.env.example</code> to <code className="text-sky-300">.env</code> in{' '}
          <code className="text-sky-300">C:\Bolt Files\APAM</code>, then set{' '}
          <code className="text-sky-300">VITE_SUPABASE_URL</code> and{' '}
          <code className="text-sky-300">VITE_SUPABASE_ANON_KEY</code>. Restart{' '}
          <code className="text-sky-300">npm run dev</code>.
        </p>
      </div>
    )
  }

  return (
    <BrowserRouter>
      <AuthProvider>
        <AppRoutes />
      </AuthProvider>
    </BrowserRouter>
  )
}

export default App
