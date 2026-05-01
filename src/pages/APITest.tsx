import { useState } from 'react'
import { AlertCircle, CheckCircle, Loader } from 'lucide-react'
import { tradierClient } from '@/lib/tradierApi'
import { getQuote, getCandles, searchSymbols, getMarketStatus } from '@/lib/marketData'

export default function APITest() {
  const [testResults, setTestResults] = useState<Array<{
    name: string
    status: 'pending' | 'success' | 'error'
    message: string
    details?: any
  }>>([])
  const [isRunning, setIsRunning] = useState(false)

  const runTests = async () => {
    setIsRunning(true)
    const results: typeof testResults = []

    // Test 1: Edge function connectivity
    results.push({
      name: 'Edge Function Connectivity',
      status: 'pending',
      message: 'Testing connection to tradier-proxy edge function...',
    })
    setTestResults([...results])

    try {
      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/tradier-proxy`,
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            endpoint: '/markets/clock',
            method: 'GET',
          }),
        }
      )

      if (response.ok) {
        const data = await response.json()
        results[results.length - 1] = {
          name: 'Edge Function Connectivity',
          status: 'success',
          message: 'Successfully connected to edge function',
          details: data,
        }
      } else {
        const errorText = await response.text()
        results[results.length - 1] = {
          name: 'Edge Function Connectivity',
          status: 'error',
          message: `Edge function returned ${response.status}`,
          details: errorText,
        }
      }
    } catch (error) {
      results[results.length - 1] = {
        name: 'Edge Function Connectivity',
        status: 'error',
        message: error instanceof Error ? error.message : 'Unknown error',
      }
    }
    setTestResults([...results])

    // Test 2: Market clock
    results.push({
      name: 'Market Clock',
      status: 'pending',
      message: 'Fetching market clock...',
    })
    setTestResults([...results])

    try {
      const clock = await tradierClient.getMarketClock()
      if (clock) {
        results[results.length - 1] = {
          name: 'Market Clock',
          status: 'success',
          message: `Market is ${clock.state}`,
          details: clock,
        }
      } else {
        results[results.length - 1] = {
          name: 'Market Clock',
          status: 'error',
          message: 'No clock data returned',
        }
      }
    } catch (error) {
      results[results.length - 1] = {
        name: 'Market Clock',
        status: 'error',
        message: error instanceof Error ? error.message : 'Unknown error',
      }
    }
    setTestResults([...results])

    // Test 3: Quote data
    results.push({
      name: 'Quote Data (AAPL)',
      status: 'pending',
      message: 'Fetching quote for AAPL...',
    })
    setTestResults([...results])

    try {
      const quote = await getQuote('AAPL')
      if (quote) {
        results[results.length - 1] = {
          name: 'Quote Data (AAPL)',
          status: 'success',
          message: `AAPL: $${quote.price.toFixed(2)}`,
          details: quote,
        }
      } else {
        results[results.length - 1] = {
          name: 'Quote Data (AAPL)',
          status: 'error',
          message: 'No quote data returned',
        }
      }
    } catch (error) {
      results[results.length - 1] = {
        name: 'Quote Data (AAPL)',
        status: 'error',
        message: error instanceof Error ? error.message : 'Unknown error',
      }
    }
    setTestResults([...results])

    // Test 4: Historical candles
    results.push({
      name: 'Historical Candles (AAPL)',
      status: 'pending',
      message: 'Fetching historical data...',
    })
    setTestResults([...results])

    try {
      const candles = await getCandles('AAPL', 'D', 30)
      if (candles && candles.length > 0) {
        results[results.length - 1] = {
          name: 'Historical Candles (AAPL)',
          status: 'success',
          message: `Received ${candles.length} candles`,
          details: { count: candles.length, sample: candles[0] },
        }
      } else {
        results[results.length - 1] = {
          name: 'Historical Candles (AAPL)',
          status: 'error',
          message: 'No candle data returned',
        }
      }
    } catch (error) {
      results[results.length - 1] = {
        name: 'Historical Candles (AAPL)',
        status: 'error',
        message: error instanceof Error ? error.message : 'Unknown error',
      }
    }
    setTestResults([...results])

    // Test 5: Symbol search
    results.push({
      name: 'Symbol Search',
      status: 'pending',
      message: 'Searching for AAPL...',
    })
    setTestResults([...results])

    try {
      const searchResults = await searchSymbols('AAPL')
      if (searchResults && searchResults.length > 0) {
        results[results.length - 1] = {
          name: 'Symbol Search',
          status: 'success',
          message: `Found ${searchResults.length} results`,
          details: searchResults,
        }
      } else {
        results[results.length - 1] = {
          name: 'Symbol Search',
          status: 'error',
          message: 'No search results returned',
        }
      }
    } catch (error) {
      results[results.length - 1] = {
        name: 'Symbol Search',
        status: 'error',
        message: error instanceof Error ? error.message : 'Unknown error',
      }
    }
    setTestResults([...results])

    // Test 6: Market status
    results.push({
      name: 'Market Status',
      status: 'pending',
      message: 'Fetching market status...',
    })
    setTestResults([...results])

    try {
      const status = await getMarketStatus()
      if (status) {
        results[results.length - 1] = {
          name: 'Market Status',
          status: 'success',
          message: `Market is ${status.state}`,
          details: status,
        }
      } else {
        results[results.length - 1] = {
          name: 'Market Status',
          status: 'error',
          message: 'No status data returned',
        }
      }
    } catch (error) {
      results[results.length - 1] = {
        name: 'Market Status',
        status: 'error',
        message: error instanceof Error ? error.message : 'Unknown error',
      }
    }
    setTestResults([...results])

    setIsRunning(false)
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-white">API Connection Test</h1>
        <p className="text-slate-400 mt-1">Verify Tradier API connection and data feed</p>
      </div>

      <div className="bg-slate-800 rounded-lg border border-slate-700 p-6">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h2 className="text-xl font-semibold text-white">Connection Diagnostics</h2>
            <p className="text-sm text-slate-400 mt-1">
              This will test all API endpoints to verify your Tradier connection
            </p>
          </div>
          <button
            onClick={runTests}
            disabled={isRunning}
            className="px-6 py-2 bg-sky-600 hover:bg-sky-700 disabled:bg-slate-700 disabled:text-slate-500 text-white font-medium rounded-lg transition-colors flex items-center gap-2"
          >
            {isRunning && <Loader className="h-4 w-4 animate-spin" />}
            {isRunning ? 'Running Tests...' : 'Run Tests'}
          </button>
        </div>

        {testResults.length > 0 && (
          <div className="space-y-3">
            {testResults.map((result, index) => (
              <div
                key={index}
                className="bg-slate-900 rounded-lg p-4 border border-slate-700"
              >
                <div className="flex items-start gap-3">
                  <div className="mt-0.5">
                    {result.status === 'pending' && (
                      <Loader className="h-5 w-5 text-slate-400 animate-spin" />
                    )}
                    {result.status === 'success' && (
                      <CheckCircle className="h-5 w-5 text-emerald-400" />
                    )}
                    {result.status === 'error' && (
                      <AlertCircle className="h-5 w-5 text-red-400" />
                    )}
                  </div>
                  <div className="flex-1">
                    <div className="flex items-center justify-between">
                      <h3 className="font-semibold text-white">{result.name}</h3>
                      <span
                        className={`text-xs px-2 py-1 rounded ${
                          result.status === 'pending'
                            ? 'bg-slate-700 text-slate-300'
                            : result.status === 'success'
                            ? 'bg-emerald-500/20 text-emerald-400'
                            : 'bg-red-500/20 text-red-400'
                        }`}
                      >
                        {result.status.toUpperCase()}
                      </span>
                    </div>
                    <p className="text-sm text-slate-400 mt-1">{result.message}</p>
                    {result.details && (
                      <details className="mt-2">
                        <summary className="text-xs text-sky-400 cursor-pointer hover:text-sky-300">
                          View details
                        </summary>
                        <pre className="mt-2 p-3 bg-slate-950 rounded text-xs text-slate-300 overflow-x-auto">
                          {JSON.stringify(result.details, null, 2)}
                        </pre>
                      </details>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        {testResults.length === 0 && (
          <div className="text-center py-12 text-slate-400">
            Click "Run Tests" to verify your API connection
          </div>
        )}
      </div>

      <div className="bg-slate-800 rounded-lg border border-slate-700 p-6">
        <h3 className="text-lg font-semibold text-white mb-4">Setup Instructions</h3>
        <div className="space-y-4 text-sm text-slate-300">
          <div>
            <h4 className="font-semibold text-white mb-2">1. Get Tradier API Key</h4>
            <ul className="list-disc list-inside space-y-1 text-slate-400">
              <li>Sign up at <a href="https://tradier.com" target="_blank" rel="noopener noreferrer" className="text-sky-400 hover:underline">tradier.com</a></li>
              <li>Go to <a href="https://dashboard.tradier.com/settings/api" target="_blank" rel="noopener noreferrer" className="text-sky-400 hover:underline">API Settings</a></li>
              <li>Create a new API token (Sandbox or Production)</li>
            </ul>
          </div>
          <div>
            <h4 className="font-semibold text-white mb-2">2. Configure Edge Function</h4>
            <p className="text-slate-400">
              The TRADIER_API_KEY should be set in your Supabase edge function secrets.
              Contact your administrator to verify the API key is configured correctly.
            </p>
          </div>
          <div>
            <h4 className="font-semibold text-white mb-2">3. Data Feed Information</h4>
            <p className="text-slate-400">
              Tradier provides 15-minute delayed market data. This system uses Tradier for
              data feed only - all trading is simulated internally.
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}
