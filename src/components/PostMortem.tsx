import { useState } from 'react'
import { Signal } from '@/lib/signalService'
import { ChevronDown, ChevronUp, Lightbulb, AlertTriangle } from 'lucide-react'

interface PostMortemProps {
  signal: Signal
}

function generatePostMortem(signal: Signal): { summary: string; factors: string[] } {
  const isWin = (signal.profit_loss || 0) > 0
  const reasoning = signal.reasoning as any
  const curve = reasoning?.curvePosition || 'unknown'
  const trend = reasoning?.trendDirection || 'unknown'
  const zone = reasoning?.zoneType || 'unknown'
  const action = signal.action
  const exitReason = signal.exit_reason || 'unknown'
  const scores = reasoning?.scores || {}

  const factors: string[] = []

  if (isWin) {
    if (exitReason === 'target') {
      factors.push('Price reached the target level, confirming the setup was valid.')
    } else if (exitReason === 'manual') {
      factors.push('Trade was closed manually before reaching target.')
    }

    if (trend === 'uptrend' && action === 'long') {
      factors.push(`Trading WITH the uptrend gave this ${action} setup a higher probability of success.`)
    } else if (trend === 'downtrend' && action === 'short') {
      factors.push(`Trading WITH the downtrend gave this ${action} setup a higher probability of success.`)
    }

    if (zone === 'demand' && action === 'long') {
      factors.push('Entry was at a demand zone, where buying pressure naturally accumulates.')
    } else if (zone === 'supply' && action === 'short') {
      factors.push('Entry was at a supply zone, where selling pressure naturally accumulates.')
    }

    if (curve === 'low' && action === 'long') {
      factors.push('Price was at the low end of its curve, providing maximum upside room.')
    } else if (curve === 'high' && action === 'short') {
      factors.push('Price was at the high end of its curve, providing maximum downside room.')
    }

    if (scores.strength >= 1.5) {
      factors.push(`Zone strength scored ${scores.strength}/2, indicating a well-formed base.`)
    }
    if (scores.freshness >= 1.5) {
      factors.push('This was a fresh zone with few prior touches, increasing its reliability.')
    }
  } else {
    if (exitReason === 'stop') {
      factors.push('Price moved against the position and hit the stop loss level.')
    } else if (exitReason === 'time') {
      factors.push('Trade was closed due to time expiry without reaching target or stop.')
    }

    if (trend === 'sideways') {
      factors.push('The sideways trend lacked directional momentum to push price to target.')
    }
    if ((trend === 'downtrend' && action === 'long') || (trend === 'uptrend' && action === 'short')) {
      factors.push(`Trading AGAINST the ${trend} significantly reduced the probability of success.`)
    }

    if (scores.strength < 1) {
      factors.push(`Zone strength was weak (${scores.strength}/2), suggesting the base was not well-formed.`)
    }
    if (scores.freshness < 1) {
      factors.push('The zone had been tested multiple times, reducing its reliability.')
    }
    if (curve === 'mid') {
      factors.push('Price was in the middle of its curve, offering less favorable risk/reward.')
    }
  }

  const summary = isWin
    ? `This ${action} trade succeeded because price was at a ${zone} zone in a ${trend} with ${curve} curve positioning.`
    : `This ${action} trade lost because conditions weren't fully aligned: ${curve} curve, ${trend} trend, ${zone} zone.`

  return { summary, factors }
}

export default function PostMortem({ signal }: PostMortemProps) {
  const [expanded, setExpanded] = useState(false)
  const isWin = (signal.profit_loss || 0) > 0
  const { summary, factors } = generatePostMortem(signal)

  return (
    <div className="mt-2">
      <button
        onClick={() => setExpanded(!expanded)}
        className="flex items-center gap-2 text-sm text-slate-400 hover:text-white transition-colors"
      >
        {isWin ? (
          <Lightbulb className="h-4 w-4 text-amber-400" />
        ) : (
          <AlertTriangle className="h-4 w-4 text-amber-400" />
        )}
        <span>Why did this {isWin ? 'work' : 'fail'}?</span>
        {expanded ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
      </button>

      {expanded && (
        <div className="mt-3 bg-slate-900/60 rounded-lg p-4 border border-slate-700/50">
          <p className="text-sm text-white font-medium mb-3">{summary}</p>
          <ul className="space-y-2">
            {factors.map((factor, i) => (
              <li key={i} className="flex items-start gap-2 text-sm text-slate-300">
                <span className={`mt-1 w-1.5 h-1.5 rounded-full flex-shrink-0 ${
                  isWin ? 'bg-green-400' : 'bg-red-400'
                }`} />
                {factor}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  )
}
