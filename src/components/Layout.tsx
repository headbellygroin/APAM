import { ReactNode } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { useAuth } from '@/hooks/useAuth'
import TrainingBackgroundRunner from '@/components/TrainingBackgroundRunner'
import MarketScanBackgroundRunner from '@/components/MarketScanBackgroundRunner'
import {
  LayoutDashboard,
  ListTodo,
  TrendingUp,
  BookOpen,
  BarChart3,
  LogOut,
  Calculator,
  Grid3x3,
  Brain,
  Wallet,
  LineChart,
  Settings,
  Activity,
  ScrollText,
  Cpu,
  Crown,
  Radio,
  UsersRound,
  Globe,
  Sparkles,
  History,
  Wifi,
  Database,
  Archive,
  RotateCcw,
  Copy,
} from 'lucide-react'

interface LayoutProps {
  children: ReactNode
}

export default function Layout({ children }: LayoutProps) {
  const { user, signOut, isAdmin } = useAuth()
  const location = useLocation()
  const navigate = useNavigate()

  const handleSignOut = async () => {
    await signOut()
    navigate('/login')
  }

  const navItems = [
    { path: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
    { path: '/watchlist', label: 'Watchlist', icon: ListTodo },
    { path: '/chart', label: 'Charts', icon: LineChart },
    { path: '/ai-recommendations', label: 'AI Recommendations', icon: Brain },
    { path: '/live-signals', label: 'Live Signals', icon: Radio },
    { path: '/ai-rulebook', label: 'AI Rulebook', icon: ScrollText },
    { path: '/ai-neural', label: 'AI Neural View', icon: Cpu },
    { path: '/market-monitor', label: 'Market Monitor', icon: Activity },
    { path: '/paper-trading', label: 'Paper Trading', icon: Wallet },
    { path: '/wheel-strategy', label: 'Wheel Strategy', icon: RotateCcw },
    { path: '/copy-trading', label: 'Copy Trading', icon: Copy },
    { path: '/training-accounts', label: 'AI Training', icon: UsersRound },
    { path: '/trade-plan', label: 'Trade Plan', icon: Calculator },
    { path: '/matrix', label: 'Decision Matrix', icon: Grid3x3 },
    { path: '/journal', label: 'Journal', icon: BookOpen },
    { path: '/analytics', label: 'Analytics', icon: BarChart3 },
    { path: '/api-test', label: 'API Test', icon: Wifi },
    { path: '/settings', label: 'Settings', icon: Settings },
    ...(isAdmin ? [
      { path: '/master-ai', label: 'Master AI', icon: Crown },
      { path: '/real-world-events', label: 'Real World Events', icon: Globe },
      { path: '/pattern-discovery', label: 'Pattern Discovery', icon: Sparkles },
      { path: '/historical-fleet', label: 'Historical Fleet', icon: History },
      { path: '/external-data', label: 'External Data', icon: Database },
      { path: '/market-archive', label: 'Market Data Archive', icon: Archive },
    ] : []),
  ]

  return (
    <div className="min-h-screen bg-slate-900 text-white">
      <TrainingBackgroundRunner />
      <MarketScanBackgroundRunner />
      <nav className="bg-slate-800 border-b border-slate-700">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center">
              <Link to="/dashboard" className="flex items-center">
                <TrendingUp className="h-8 w-8 text-blue-500" />
                <span className="ml-2 text-xl font-bold">Trading Platform</span>
              </Link>
            </div>
            <div className="flex items-center space-x-4">
              <span className="text-sm text-slate-400">{user?.email}</span>
              <button
                onClick={handleSignOut}
                className="flex items-center space-x-1 px-3 py-2 rounded-md text-sm font-medium text-slate-300 hover:text-white hover:bg-slate-700"
              >
                <LogOut className="h-4 w-4" />
                <span>Sign out</span>
              </button>
            </div>
          </div>
        </div>
      </nav>

      <div className="flex">
        <aside className="w-64 bg-slate-800 min-h-[calc(100vh-4rem)] border-r border-slate-700">
          <nav className="p-4 space-y-2">
            {navItems.map((item) => {
              const Icon = item.icon
              const isActive = location.pathname === item.path
              return (
                <Link
                  key={item.path}
                  to={item.path}
                  className={`flex items-center space-x-3 px-4 py-3 rounded-lg transition-colors ${
                    isActive
                      ? 'bg-blue-600 text-white'
                      : 'text-slate-300 hover:bg-slate-700 hover:text-white'
                  }`}
                >
                  <Icon className="h-5 w-5" />
                  <span className="font-medium">{item.label}</span>
                </Link>
              )
            })}
          </nav>
        </aside>

        <main className="flex-1 p-8">
          <div className="max-w-7xl mx-auto">
            {children}
          </div>
        </main>
      </div>
    </div>
  )
}
