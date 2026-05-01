import { useState } from 'react'
import { getDecisionMatrixAction, DECISION_MATRIX, CurvePosition, TrendDirection, ZoneType } from '@/utils/surgeStrategy'
import { Grid3x3, TrendingUp, TrendingDown, Minus } from 'lucide-react'

export default function DecisionMatrix() {
  const [curvePosition, setCurvePosition] = useState<CurvePosition>('low')
  const [trendDirection, setTrendDirection] = useState<TrendDirection>('uptrend')
  const [zoneType, setZoneType] = useState<ZoneType>('demand')

  const action = getDecisionMatrixAction({ curvePosition, trendDirection, zoneType })
  const matrixData = DECISION_MATRIX[zoneType][curvePosition][trendDirection]

  const getActionColor = (action: string) => {
    if (action === 'long' || action === 'short') return 'bg-green-900/50 text-green-300 border-green-700'
    if (action === 'long_advanced' || action === 'short_advanced') return 'bg-yellow-900/50 text-yellow-300 border-yellow-700'
    return 'bg-red-900/50 text-red-300 border-red-700'
  }

  const getQualityColor = (quality: string) => {
    if (quality === 'high') return 'text-green-400'
    if (quality === 'medium') return 'text-yellow-400'
    return 'text-red-400'
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-white">Decision Matrix</h1>
        <p className="text-slate-400 mt-2">Analyze trade setups using the Surge Strategy framework</p>
      </div>

      <div className="bg-gradient-to-br from-purple-900/30 to-blue-900/30 rounded-lg p-6 border border-purple-700/50">
        <div className="flex items-start space-x-4">
          <div className="bg-purple-900/50 p-3 rounded-lg">
            <Grid3x3 className="h-8 w-8 text-purple-400" />
          </div>
          <div className="flex-1">
            <h2 className="text-xl font-bold text-white mb-2">About the Decision Matrix</h2>
            <p className="text-slate-300 text-sm leading-relaxed">
              The Decision Matrix is a systematic approach to evaluate trade setups based on three key factors:
              curve position (where price is in its range), trend direction (market momentum), and zone type
              (supply or demand). This framework helps you identify high-probability trade opportunities and
              avoid low-quality setups.
            </p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-slate-800 rounded-lg p-6 border border-slate-700">
          <h2 className="text-xl font-bold text-white mb-6">Select Market Conditions</h2>

          <div className="space-y-6">
            <div>
              <label className="block text-sm font-medium text-slate-300 mb-3">Curve Position</label>
              <div className="grid grid-cols-3 gap-3">
                {(['low', 'middle', 'high'] as CurvePosition[]).map((pos) => (
                  <button
                    key={pos}
                    onClick={() => setCurvePosition(pos)}
                    className={`px-4 py-3 rounded-lg font-medium transition-colors ${
                      curvePosition === pos
                        ? 'bg-blue-600 text-white'
                        : 'bg-slate-700 text-slate-300 hover:bg-slate-600'
                    }`}
                  >
                    {pos.toUpperCase()}
                  </button>
                ))}
              </div>
              <p className="text-xs text-slate-400 mt-2">
                {curvePosition === 'low' && 'Price is in the bottom third of its recent range'}
                {curvePosition === 'middle' && 'Price is in the middle of its recent range'}
                {curvePosition === 'high' && 'Price is in the top third of its recent range'}
              </p>
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-300 mb-3">Trend Direction</label>
              <div className="grid grid-cols-3 gap-3">
                {(['uptrend', 'sideways', 'downtrend'] as TrendDirection[]).map((trend) => (
                  <button
                    key={trend}
                    onClick={() => setTrendDirection(trend)}
                    className={`px-4 py-3 rounded-lg font-medium transition-colors flex items-center justify-center space-x-2 ${
                      trendDirection === trend
                        ? 'bg-blue-600 text-white'
                        : 'bg-slate-700 text-slate-300 hover:bg-slate-600'
                    }`}
                  >
                    {trend === 'uptrend' && <TrendingUp className="h-4 w-4" />}
                    {trend === 'sideways' && <Minus className="h-4 w-4" />}
                    {trend === 'downtrend' && <TrendingDown className="h-4 w-4" />}
                    <span>{trend === 'sideways' ? 'SIDEWAYS' : trend.toUpperCase()}</span>
                  </button>
                ))}
              </div>
              <p className="text-xs text-slate-400 mt-2">
                {trendDirection === 'uptrend' && 'Market is making higher highs and higher lows'}
                {trendDirection === 'sideways' && 'Market is ranging without clear direction'}
                {trendDirection === 'downtrend' && 'Market is making lower highs and lower lows'}
              </p>
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-300 mb-3">Zone Type</label>
              <div className="grid grid-cols-2 gap-3">
                {(['demand', 'supply'] as ZoneType[]).map((zone) => (
                  <button
                    key={zone}
                    onClick={() => setZoneType(zone)}
                    className={`px-4 py-3 rounded-lg font-medium transition-colors ${
                      zoneType === zone
                        ? zone === 'demand'
                          ? 'bg-green-600 text-white'
                          : 'bg-red-600 text-white'
                        : 'bg-slate-700 text-slate-300 hover:bg-slate-600'
                    }`}
                  >
                    {zone.toUpperCase()}
                  </button>
                ))}
              </div>
              <p className="text-xs text-slate-400 mt-2">
                {zoneType === 'demand' && 'Area where buying interest has previously emerged'}
                {zoneType === 'supply' && 'Area where selling pressure has previously emerged'}
              </p>
            </div>
          </div>
        </div>

        <div className="space-y-6">
          <div className={`rounded-lg p-6 border ${getActionColor(action)}`}>
            <h2 className="text-xl font-bold text-white mb-4">Recommended Action</h2>
            <div className="text-center py-8">
              <p className="text-5xl font-bold text-white mb-4">
                {action === 'long' && 'LONG'}
                {action === 'short' && 'SHORT'}
                {action === 'long_advanced' && 'LONG (ADV)'}
                {action === 'short_advanced' && 'SHORT (ADV)'}
                {action === 'no_action' && 'NO ACTION'}
              </p>
              <p className={`text-lg font-medium ${getQualityColor(matrixData.quality)}`}>
                {matrixData.quality === 'high' && 'High Quality Setup'}
                {matrixData.quality === 'medium' && 'Medium Quality Setup (Advanced Traders)'}
                {matrixData.quality === 'none' && 'Low Quality Setup - Avoid'}
              </p>
            </div>
          </div>

          <div className="bg-slate-800 rounded-lg p-6 border border-slate-700">
            <h3 className="text-lg font-bold text-white mb-4">Analysis</h3>
            <div className="space-y-3 text-sm">
              <div className="flex items-center justify-between p-3 bg-slate-700/50 rounded-lg">
                <span className="text-slate-300">Curve Position:</span>
                <span className="text-white font-medium">{curvePosition.toUpperCase()}</span>
              </div>
              <div className="flex items-center justify-between p-3 bg-slate-700/50 rounded-lg">
                <span className="text-slate-300">Trend Direction:</span>
                <span className="text-white font-medium">{trendDirection.toUpperCase()}</span>
              </div>
              <div className="flex items-center justify-between p-3 bg-slate-700/50 rounded-lg">
                <span className="text-slate-300">Zone Type:</span>
                <span className={zoneType === 'demand' ? 'text-green-400' : 'text-red-400'}>
                  {zoneType.toUpperCase()}
                </span>
              </div>
            </div>

            <div className="mt-4 p-4 bg-blue-900/30 rounded-lg border border-blue-700">
              <p className="text-xs text-blue-300 font-medium mb-2">SETUP EXPLANATION</p>
              <p className="text-sm text-slate-300 leading-relaxed">
                {action === 'long' &&
                  'This is a high-quality long setup. Price is at the bottom of the curve in a demand zone with an uptrend. This combination offers the best risk/reward for long positions.'}
                {action === 'short' &&
                  'This is a high-quality short setup. Price is at the top of the curve in a supply zone with a downtrend. This combination offers the best risk/reward for short positions.'}
                {action === 'long_advanced' &&
                  'This is a moderate long setup suitable for advanced traders. While not in the ideal curve position or trend, the demand zone provides support. Use reduced position sizing.'}
                {action === 'short_advanced' &&
                  'This is a moderate short setup suitable for advanced traders. While not in the ideal curve position or trend, the supply zone provides resistance. Use reduced position sizing.'}
                {action === 'no_action' &&
                  'This setup does not meet the criteria for a quality trade. The combination of curve position, trend, and zone type suggests low probability of success. Wait for better opportunities.'}
              </p>
            </div>
          </div>
        </div>
      </div>

      <div className="bg-slate-800 rounded-lg p-6 border border-slate-700">
        <h2 className="text-xl font-bold text-white mb-4">Complete Decision Matrix</h2>
        <div className="overflow-x-auto">
          <div className="grid grid-cols-2 gap-6">
            <div>
              <h3 className="text-lg font-bold text-green-400 mb-3">DEMAND ZONES (Long Setups)</h3>
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-slate-700">
                    <th className="text-left py-2 text-slate-400">Curve / Trend</th>
                    <th className="text-left py-2 text-slate-400">Uptrend</th>
                    <th className="text-left py-2 text-slate-400">Sideways</th>
                    <th className="text-left py-2 text-slate-400">Downtrend</th>
                  </tr>
                </thead>
                <tbody>
                  <tr className="border-b border-slate-700">
                    <td className="py-2 text-slate-300 font-medium">Low</td>
                    <td className="py-2 text-green-400">LONG</td>
                    <td className="py-2 text-yellow-400">LONG (ADV)</td>
                    <td className="py-2 text-red-400">NO ACTION</td>
                  </tr>
                  <tr className="border-b border-slate-700">
                    <td className="py-2 text-slate-300 font-medium">Middle</td>
                    <td className="py-2 text-yellow-400">LONG (ADV)</td>
                    <td className="py-2 text-red-400">NO ACTION</td>
                    <td className="py-2 text-red-400">NO ACTION</td>
                  </tr>
                  <tr>
                    <td className="py-2 text-slate-300 font-medium">High</td>
                    <td className="py-2 text-red-400">NO ACTION</td>
                    <td className="py-2 text-red-400">NO ACTION</td>
                    <td className="py-2 text-red-400">NO ACTION</td>
                  </tr>
                </tbody>
              </table>
            </div>

            <div>
              <h3 className="text-lg font-bold text-red-400 mb-3">SUPPLY ZONES (Short Setups)</h3>
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-slate-700">
                    <th className="text-left py-2 text-slate-400">Curve / Trend</th>
                    <th className="text-left py-2 text-slate-400">Downtrend</th>
                    <th className="text-left py-2 text-slate-400">Sideways</th>
                    <th className="text-left py-2 text-slate-400">Uptrend</th>
                  </tr>
                </thead>
                <tbody>
                  <tr className="border-b border-slate-700">
                    <td className="py-2 text-slate-300 font-medium">High</td>
                    <td className="py-2 text-green-400">SHORT</td>
                    <td className="py-2 text-yellow-400">SHORT (ADV)</td>
                    <td className="py-2 text-red-400">NO ACTION</td>
                  </tr>
                  <tr className="border-b border-slate-700">
                    <td className="py-2 text-slate-300 font-medium">Middle</td>
                    <td className="py-2 text-yellow-400">SHORT (ADV)</td>
                    <td className="py-2 text-red-400">NO ACTION</td>
                    <td className="py-2 text-red-400">NO ACTION</td>
                  </tr>
                  <tr>
                    <td className="py-2 text-slate-300 font-medium">Low</td>
                    <td className="py-2 text-red-400">NO ACTION</td>
                    <td className="py-2 text-red-400">NO ACTION</td>
                    <td className="py-2 text-red-400">NO ACTION</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
