# Layered Strategy System Design

## Concept

Each AI has a **BASE STRATEGY** plus optional **OVERLAY STRATEGIES** with implementation weights.

### Example AI Configuration

```
AI Name: "Sniper Bot Alpha"
Base Strategy: APAM (Adaptive Price Action Model) - 100%

Overlays:
├─ Fibonacci OR (Opening Range) - 70% weight
├─ News Catalyst Filter - 40% weight
└─ Volume Surge Detector - 85% weight
```

## How It Works

### 1. Base Strategy (Required)
- **One choice only**: Trade Surge, APAM, or other core strategy
- Provides foundational signal (Long/Short/No Action)
- Generates base odds score (1-10)
- Always runs at 100% influence

### 2. Overlay Strategies (Optional, Multiple)
- **Can add 0 to many**: Fibonacci OR, News Filter, Volume patterns, etc.
- Each has implementation weight (0-100%)
- Modifies/enhances/filters base strategy signals
- Can boost or reduce confidence

### 3. Signal Blending Logic

```typescript
Base Signal: LONG, Odds 7.0
├─ Fibonacci OR (70% weight): CONFIRMS → +0.8 odds
├─ News Filter (40% weight): NEUTRAL → +0.0 odds
└─ Volume Surge (85% weight): CONFIRMS → +1.2 odds

Final Signal: LONG, Odds 9.0
```

**Overlay Actions:**
- **CONFIRM** → Boost odds by (overlay_contribution × weight%)
- **NEUTRAL** → No change
- **CONFLICT** → Reduce odds by (penalty × weight%)
- **VETO** → Override to NO_ACTION (if overlay has veto power)

### 4. Implementation Weights

Each overlay has a weight slider (0-100%):

- **0%** = Overlay disabled, doesn't affect decisions
- **25%** = Minor influence, subtle boost/penalty
- **50%** = Moderate influence
- **75%** = Strong influence
- **100%** = Maximum influence, can veto trades

**Example:**
- Fibonacci OR at 30% = Adds max +0.3 to odds when confirming
- Fibonacci OR at 100% = Adds max +1.0 to odds when confirming

## Database Schema

### Strategy Overlays Table

```sql
CREATE TABLE strategy_overlays (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  training_account_id uuid REFERENCES training_accounts(id) ON DELETE CASCADE,
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE,
  overlay_strategy_id text NOT NULL, -- 'fibonacci-or', 'news-filter', etc.
  implementation_weight integer NOT NULL DEFAULT 50, -- 0-100
  can_veto boolean DEFAULT false, -- Can override base strategy?
  enabled boolean DEFAULT true,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE INDEX idx_overlays_account ON strategy_overlays(training_account_id);
CREATE INDEX idx_overlays_user ON strategy_overlays(user_id);
```

### Updated Training Accounts

Training accounts already have `base_strategy_id`. No changes needed there.

## Strategy Types Classification

### Base Strategies (Choose One)
- **Trade Surge** - Momentum-based with surge detection
- **APAM** - Adaptive Price Action Model with curve positioning
- **Swing Trader** - Multi-day position holding (future)
- **Scalper** - Quick in/out intraday (future)

### Overlay Strategies (Choose Many)
- **Fibonacci OR** - Opening range with Fib retracements
- **Volume Confirmation** - Requires volume surge (future)
- **News Filter** - Blocks trades during earnings/news (future)
- **Sector Rotation** - Prefers leading sectors (future)
- **Market Regime** - Adjusts for volatility conditions (future)

## Code Architecture

### 1. Strategy Type Enum

```typescript
export type StrategyType = 'base' | 'overlay'

export interface StrategyConfig {
  id: string
  name: string
  description: string
  version: string
  type: StrategyType // NEW: 'base' or 'overlay'
  // ... existing fields
}
```

### 2. Overlay Analysis Result

```typescript
export interface OverlayAnalysis {
  overlayId: string
  action: 'confirm' | 'neutral' | 'conflict' | 'veto'
  oddsAdjustment: number // -2.0 to +2.0
  reasoning: string
  confidence: number // 0-1
}
```

### 3. Blended Signal

```typescript
export interface BlendedSignal {
  baseSignal: TradeSetup
  overlayResults: OverlayAnalysis[]
  finalOddsScore: number
  finalAction: TradeAction
  blendingExplanation: string
}
```

### 4. Strategy Blender Service

```typescript
class StrategyBlender {
  blend(
    baseSignal: TradeSetup,
    overlays: Array<{
      strategy: TradingStrategy,
      weight: number,
      canVeto: boolean
    }>,
    candles: Candle[]
  ): BlendedSignal {
    // 1. Get base signal odds
    let finalOdds = baseSignal.oddsScore

    // 2. Apply each overlay
    for (const overlay of overlays) {
      const analysis = overlay.strategy.analyzeOverlay(baseSignal, candles)

      // Check veto
      if (analysis.action === 'veto' && overlay.canVeto) {
        return { action: 'no_action', ... }
      }

      // Apply weighted adjustment
      const weightedAdjustment = analysis.oddsAdjustment * (overlay.weight / 100)
      finalOdds += weightedAdjustment
    }

    // 3. Clamp odds to 0-10
    finalOdds = Math.max(0, Math.min(10, finalOdds))

    // 4. Return blended result
    return { baseSignal, overlayResults, finalOdds, ... }
  }
}
```

## UI/UX Design

### Training Account Creation

```
┌─────────────────────────────────────────────┐
│ Create Training AI                          │
├─────────────────────────────────────────────┤
│                                             │
│ Account Name: [Sniper Alpha            ]   │
│ Starting Balance: [$25,000             ]   │
│                                             │
│ ── BASE STRATEGY (Required) ────────────── │
│                                             │
│ ○ Trade Surge                              │
│   Momentum-based surge detection           │
│                                             │
│ ● APAM                                     │
│   Adaptive Price Action Model              │
│                                             │
│ ○ Future Strategy...                       │
│                                             │
│ ── OVERLAY STRATEGIES (Optional) ────────  │
│                                             │
│ ☑ Fibonacci Opening Range                  │
│   Implementation: [====·····] 70%          │
│   Can veto base: [ ]                       │
│                                             │
│ ☑ Volume Confirmation (Future)             │
│   Implementation: [========·] 85%          │
│   Can veto base: [✓]                       │
│                                             │
│ ☐ News Filter (Future)                     │
│   Implementation: [··········] 0%          │
│   Can veto base: [ ]                       │
│                                             │
│           [Create AI]  [Cancel]            │
└─────────────────────────────────────────────┘
```

### Settings vs overlays (current product behavior)

**Settings** no longer hosts a global “base strategy + overlays” switch. It is a **strategy library**: pick an entry to read its guide.

**Overlays** are configured **per training account** when creating the account (and persisted in **`strategy_overlays`**). The simulator loads enabled overlays and runs **`applyOverlaysToTradeSetup`** after the account’s base **`generateSetup`**.

For **market-wide scans** (AI Recommendations / Live Signals / background runner), behavior is driven by **multiple parallel base strategies**, not overlay toggles on Settings.

## Multi-account overlay behavior (conceptual)

Any account that supports overlays can combine a **base** strategy with weighted layers, for example:

```
Example configuration:
├─ Base: APAM
├─ Fibonacci OR: 60%
├─ Volume Surge: 45%
└─ News Filter: 80% (veto enabled)
```

Overlay influence can shift based on historical performance, drift signals, and regime context—the exact rules live in application code.

## Benefits

1. **Flexibility**: Test different strategy combinations
2. **Gradual Rollout**: Start overlay at 20%, increase if proven
3. **Risk Control**: Overlays can veto dangerous trades
4. **Specialization**: Different accounts can emphasize different overlays
5. **Evolution**: Automated tuning may adjust overlay weights where implemented
6. **Explainability**: Clear reasoning for each signal component

## Implementation Phases

**Phase 1 (This PR):**
- Database schema for overlays
- Update strategy type system
- Basic blending logic
- UI for adding/configuring overlays

**Phase 2 (Future):**
- More overlay strategies (Volume, News, etc.)
- Performance tracking per overlay
- Auto-weight optimization
- Cross-account overlay tuning where configured

**Phase 3 (Advanced):**
- Overlay conflict resolution strategies
- Time-of-day specific overlays
- Market regime detection overlays
- Custom user-defined overlays
