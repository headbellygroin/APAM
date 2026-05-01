import { TrackRecord, trackRecordService } from '@/lib/signalTrackRecord'
import { BarChart3, TrendingUp, TrendingDown } from 'lucide-react'

interface TrackRecordPanelProps {
  records: TrackRecord[]
}

export default function TrackRecordPanel({ records }: TrackRecordPanelProps) {
  if (records.length === 0) {
    return (
      <div className="bg-slate-800 rounded-lg border border-slate-700 p-6 text-center">
        <BarChart3 className="h-10 w-10 text-slate-600 mx-auto mb-3" />
        <p className="text-slate-400 text-sm">No pattern track records yet. Execute trades from signals to start building the AI's track record.</p>
      </div>
    )
  }

  return (
    <div className="bg-slate-800 rounded-lg border border-slate-700">
      <div className="p-4 border-b border-slate-700">
        <h3 className="text-lg font-bold text-white flex items-center gap-2">
          <BarChart3 className="h-5 w-5 text-sky-400" />
          AI Track Record by Pattern
        </h3>
        <p className="text-xs text-slate-500 mt-1">Performance history for each curve + trend + zone combination</p>
      </div>
      <div className="divide-y divide-slate-700">
        {records.map((record) => {
          const { curve, trend, zone } = trackRecordService.formatPatternKey(record.pattern_key)
          const winRate = trackRecordService.getWinRate(record)
          const expectancy = trackRecordService.getExpectancy(record)
          const pf = trackRecordService.getProfitFactor(record)
          const total = record.wins + record.losses

          const winRateColor = winRate >= 0.6 ? 'text-green-400' : winRate >= 0.5 ? 'text-white' : 'text-red-400'
          const expectancyColor = expectancy >= 0 ? 'text-green-400' : 'text-red-400'

          return (
            <div key={record.id} className="p-4 hover:bg-slate-700/20 transition-colors">
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  <span className="px-2 py-0.5 rounded text-xs font-medium bg-slate-700 text-white uppercase">{curve}</span>
                  <span className="text-slate-600">+</span>
                  <span className={`px-2 py-0.5 rounded text-xs font-medium ${
                    trend === 'uptrend' ? 'bg-green-900/40 text-green-300' :
                    trend === 'downtrend' ? 'bg-red-900/40 text-red-300' :
                    'bg-slate-700 text-slate-300'
                  }`}>{trend}</span>
                  <span className="text-slate-600">+</span>
                  <span className={`px-2 py-0.5 rounded text-xs font-medium ${
                    zone === 'demand' ? 'bg-green-900/40 text-green-300' : 'bg-red-900/40 text-red-300'
                  }`}>{zone}</span>
                </div>
                <div className="flex items-center gap-1">
                  {expectancy >= 0 ? (
                    <TrendingUp className="h-3.5 w-3.5 text-green-400" />
                  ) : (
                    <TrendingDown className="h-3.5 w-3.5 text-red-400" />
                  )}
                </div>
              </div>
              <div className="grid grid-cols-6 gap-3 text-center">
                <div>
                  <p className={`text-sm font-bold ${winRateColor}`}>{(winRate * 100).toFixed(0)}%</p>
                  <p className="text-[10px] text-slate-500">Win Rate</p>
                </div>
                <div>
                  <p className="text-sm font-bold text-white">{record.wins}/{total}</p>
                  <p className="text-[10px] text-slate-500">W / Total</p>
                </div>
                <div>
                  <p className="text-sm font-bold text-green-400">${record.avg_win.toFixed(2)}</p>
                  <p className="text-[10px] text-slate-500">Avg Win</p>
                </div>
                <div>
                  <p className="text-sm font-bold text-red-400">${record.avg_loss.toFixed(2)}</p>
                  <p className="text-[10px] text-slate-500">Avg Loss</p>
                </div>
                <div>
                  <p className={`text-sm font-bold ${expectancyColor}`}>${expectancy.toFixed(2)}</p>
                  <p className="text-[10px] text-slate-500">Expectancy</p>
                </div>
                <div>
                  <p className="text-sm font-bold text-white">{pf > 100 ? '99+' : pf.toFixed(2)}</p>
                  <p className="text-[10px] text-slate-500">Profit Factor</p>
                </div>
              </div>
              <div className="mt-2 flex items-center justify-between text-[10px] text-slate-600">
                <span>{record.total_signals} signals fired</span>
                <span>Best: +${record.best_win.toFixed(2)} | Worst: -${record.worst_loss.toFixed(2)}</span>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
