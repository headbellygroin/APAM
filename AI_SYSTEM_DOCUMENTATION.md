# AI Trading Platform - System Documentation

## Overview
This is an advanced AI-powered paper trading platform that uses evolutionary algorithms and multi-generational AI systems to discover, test, and optimize trading strategies. The system is built with React/TypeScript frontend, Supabase backend, and integrates with Tradier for market data.

---

## API Configuration

### Market data (Tradier or provider configured in your deployment)
- **Secrets belong only in** `.env` (local), Supabase Edge Function secrets (hosted), or your CI/CD vault — **never commit real keys to Git or markdown.**
- Typical setup: delayed intraday/daily data via an edge proxy; see `supabase/functions` and `src/lib/marketData.ts` / `tradierApi.ts` (names may vary by branch).
- **Paper trading only**: live broker order placement should remain disabled for this product surface.

### Supabase
- `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` in `.env` for the web app.
- **Remote database**: apply SQL migrations under `supabase/migrations` with the Supabase CLI or Dashboard SQL editor so schema matches the app (see [PROJECT_WORKFLOW.md](./PROJECT_WORKFLOW.md)).

### Edge Function secrets (Supabase Dashboard → Project → Edge Functions → Secrets)
Use the same variable names your functions expect (e.g. Tradier API key/account if used). Do not paste production values into documentation files.

---

## Core Architecture

### 1. Data Flow
```
Tradier API (15-min delayed)
  → Edge Function (tradier-proxy)
  → Frontend (tradierApi.ts)
  → AI Engines
  → Paper Trading Simulator
  → Supabase Database
```

### 2. Key Components

#### Market Data Layer (`src/lib/tradierApi.ts`)
- Fetches quotes, historical data, intraday data
- Symbol search functionality
- Market clock and calendar
- **Trading operations are BLOCKED** - throws errors on placeOrder/cancelOrder attempts

#### Trading Layer (`src/lib/tradierTrading.ts`)
- All trading methods return errors/blocked messages
- Only paper trading execution is allowed via `executeAIRecommendation()`
- Integrates with Supabase `paper_accounts` and `simulated_trades` tables

#### Paper Trading Simulator (`src/lib/tradeSimulator.ts`)
- Simulates trade execution with realistic fills
- Tracks P&L, position sizing, and risk management
- Integrates trading fees and slippage

---

## AI System Architecture

### Multi-Tier AI Structure

The platform implements a **multi-account AI evolution model** with:

1. **Training AI accounts**
   - Multiple instances run on paper trading accounts with different strategies and risk parameters.
   - Track record stored in `ai_training_accounts` and related tables.

2. **Evolved rulesets**
   - Patterns that survive validation can be codified in `ai_evolved_rulesets`.
   - Versioned with performance metadata for comparison over time.

Additional orchestration and promotion logic lives in the codebase but is not documented here.

---

## AI Engine Details

### 1. Main AI Engine (`src/lib/aiEngine.ts`)

**Purpose**: Generate trade recommendations from registered **base strategies** and optional per-account drift (personal AI learning).

**Key APIs** (current intent):
- `generateRecommendation(symbol, userId?, strategyId?)` — evaluates **one symbol** with the strategy identified by `strategyId` (defaults to first registered base strategy if omitted/invalid).
- `scanMarket(symbols, minScore?, userId?, onProgress?, options?)` — optional `options.strategyIds`: run **multiple base strategies in parallel** per symbol; results include `recommendation.strategyId`. If `strategyIds` is omitted or empty, **all** registered base strategies are used.
- `analyzeCurvePosition(candles, strategyId?)`, `analyzeTrend(...)`, `detectZones(...)` — chart/analysis helpers; Chart uses the **first** strategy ID from the saved scanner selection (`marketScanStrategies`).

**Design note — Strategy library vs scanners**:
- **Settings** exposes strategies as a **read-only library + guides** (no global “active strategy” switch for the whole app).
- **AI Recommendations** and **Live Signals** own **which base strategies participate in scans** (checkboxes, persisted in `localStorage` via `src/lib/marketScanStrategies.ts`).
- **Background automation** (`MarketScanBackgroundRunner`) uses the **same** saved strategy list as manual scans.

**Output**: `AIRecommendation` includes `strategyId`, structured `reasoning` (curve, trend, zone, scores, R:R, entry type), drift flags when applicable.

### 2. AI Evolution System (`src/lib/aiEvolution.ts`)

**Purpose**: Track AI performance and manage evolution/spawning

**Key Functions**:
- `trackEvolutionState()`: Records AI decisions and parameter changes
- `spawnChildAccount()`: Creates new training AI with mutated parameters
- `rollbackDrift()`: Reverts unsuccessful parameter changes
- Promotion / lifecycle helpers exist in code where configured.

**Evolution Mechanics**:
- Performance thresholds determine promotion eligibility
- Parameter mutation for exploration (learning rate, risk tolerance, etc.)
- Lineage tracking via `account_lineage` table
- A/B testing through parallel training accounts

**Database Tables**:
- `ai_evolution_state`: Current AI configuration and parameters
- `ai_learned_adjustments`: Historical parameter changes
- `ai_drift_rollbacks`: Failed experiments that were reverted

### 3. AI Drift Detection (`src/lib/aiDriftEngine.ts`)

**Purpose**: Monitor AI performance degradation and trigger corrections

**Key Functions**:
- `detectDrift()`: Analyzes recent performance vs baseline
- `shouldRollback()`: Determines if recent changes hurt performance
- `calculateDriftScore()`: Quantifies performance deviation

**Drift Indicators**:
- Win rate decline > 15%
- Average loss > average win
- Consecutive losses > threshold
- Sharpe ratio deterioration

**Actions on Drift Detection**:
1. Log drift event to `ai_drift_rollbacks`
2. Revert to last known good configuration
3. Optionally spawn new training account to test alternative approach

### 4. Pattern Discovery (`src/lib/patternDiscovery.ts`)

**Purpose**: Automatically identify recurring profitable patterns

**Key Functions**:
- `discoverPatterns()`: Analyzes historical trades for commonalities
- `validatePattern()`: Backtests discovered pattern
- `codifyPattern()`: Converts pattern to executable ruleset

**Pattern Types**:
- Price action patterns (breakouts, reversals, consolidations)
- Time-based patterns (day of week, time of day)
- Volume patterns (surge, drying up)
- Correlation patterns (sector rotation, pairs)

**Discovery Process**:
1. Scan profitable trades for common features
2. Statistical validation (minimum sample size, significance)
3. Forward testing on new data
4. If validated → save to `ai_discovered_patterns`
5. If consistently profitable → promote to `ai_evolved_rulesets`

### 5. Signal Tracking (`src/lib/signalTrackRecord.ts`)

**Purpose**: Maintain track record for all AI-generated signals

**Key Functions**:
- `recordSignal()`: Log new signal to database
- `updateOutcome()`: Mark signal as winner/loser after trade completes
- `calculateAccuracy()`: Win rate by signal type/AI instance
- `getSignalHistory()`: Retrieve historical performance

**Metrics Tracked**:
- Signal accuracy by symbol, timeframe, strategy
- Average risk/reward achieved vs predicted
- Time to target/stop hit
- Market condition context (trending, ranging, volatile)

---

## AI Training Account System

### Training Account Lifecycle

**Phase 1: Spawning**
- New training account created with initial capital (typically $10,000 virtual)
- Assigned strategy parameters (randomly mutated or inherited from parent)
- Linked to parent account via `account_lineage` table
- Spawn and lifecycle actions are logged (see spawn log table in schema)

**Phase 2: Training**
- Executes trades based on assigned strategy
- All trades recorded in `simulated_trades` table
- Performance metrics updated continuously
- Evolution state tracked in `ai_evolution_state`

**Phase 3: Evaluation**
- After minimum sample size (e.g., 20 trades or 30 days)
- Metrics analyzed: win rate, profit factor, max drawdown, Sharpe ratio
- Compared against peer training accounts
- Decision: promote, continue, or terminate

**Phase 4: Promotion or Termination**
- **Promote** or **terminate** paths depend on configured thresholds and application logic; outcomes are recorded for auditing.
- **Terminate**: If underperforming → account closed
  - Strategy parameters logged as unsuccessful
  - Logged as action='terminate'

---

## Real-World Event Integration

### Event Tracking System (`src/lib/realWorldEvents.ts`)

**Purpose**: Correlate market moves with real-world events

**Key Functions**:
- `recordEvent()`: Log event with metadata (type, severity, affected sectors)
- `correlateWithTrades()`: Link events to anomalous market behavior
- `predictImpact()`: Use historical event data to forecast market reaction

**Event Types**:
- Earnings reports
- Economic data releases (jobs, CPI, GDP)
- Fed announcements
- Geopolitical events
- Sector-specific news

**AI Learning from Events**:
1. Detect anomalous price movement
2. Search for contemporaneous events
3. Record correlation in `real_world_events` table
4. Build predictive model: event type → expected market reaction
5. Use in future trade decisions (avoid/embrace volatility)

**Anomaly Detection**:
- Price moves > 2 standard deviations
- Volume spikes > 3x average
- Correlation breakdowns
- VIX spikes
- Logged in `ai_anomaly_detection` table

---

## Historical Fleet Backtesting

### Fleet Backtesting System (`src/lib/historicalFleetService.ts`)

**Purpose**: Run multiple AI strategies simultaneously on historical data

**Key Functions**:
- `createFleet()`: Initialize multiple AI instances with different configs
- `runBacktest()`: Execute all AIs on same historical data
- `comparePerformance()`: Rank strategies by various metrics
- `exportWinners()`: Promote successful strategies to live paper trading

**Use Cases**:
- Test new strategy ideas before deploying
- Compare variations of existing strategies
- Identify market regime-specific strategies (trending vs ranging)
- Optimize parameters (stop loss %, position sizing, etc.)

**Database**:
- `historical_fleet_runs`: Backtest metadata
- `historical_fleet_accounts`: Individual AI performance in backtest
- `historical_fleet_trades`: All simulated trades from backtest

**Workflow**:
1. User defines date range and symbols
2. System spawns N AI instances (e.g., 10)
3. Each AI uses different strategy/parameters
4. All run on same historical data in parallel
5. Results compared on dashboard
6. Best performer(s) promoted to live paper trading

---

## Strategy System

### Strategy Registry (`src/lib/strategies/registry.ts`)

**Purpose**: Central registry of all available trading strategies

**Built-in Strategies**:
1. **APAM (Adaptive Price Action Model)** - `src/lib/strategies/apam.ts`
   - Manual trading ruleset based on price action
   - Detailed rules in `src/lib/strategies/apam/` directory
   - Uses support/resistance, trend, and volume

2. **Trade Surge** - `src/lib/strategies/tradeSurge.ts`
   - Momentum-based strategy
   - Identifies volume surges with directional bias
   - Quick entries/exits

3. **AI-Evolved Strategies** - Dynamically created
   - Generated by Pattern Discovery system
   - Stored in `ai_evolved_rulesets` table
   - Loaded at runtime if performance validated

### Strategy interface (`src/lib/strategies/types.ts`)

Concrete implementations extend **`TradingStrategy`**: zone detection, curve/trend analysis, **`generateSetup(candles, price)`**, and configuration (`StrategyConfig`). **Overlay** strategies additionally implement **`analyzeOverlay`** for layering signals on top of a base **`TradeSetup`**.

**Training accounts**: each row uses **`strategy_id`** as its sole base ruleset; optional **`strategy_overlays`** rows (plus UI when creating an account) apply **`applyOverlaysToTradeSetup`** inside **`trainingSimulator`**.

**Signal deduping**: `signal_queue` stores **`strategy_id`** per signal; Live Signals scans and background runs dedupe on **`symbol + strategy_id`** so parallel strategies do not overwrite each other.

---

## Follow Mode (Copy Trading)

### Live Signal Broadcasting (`src/lib/followMode.ts`)

**Purpose**: Allow users to follow successful AI traders

**Key Functions**:
- `publishSignal()`: Broadcast trade signal to followers
- `subscribeToSignals()`: Follow a specific AI/user
- `copyTrade()`: Automatically execute follower's trades

**Database tables** (see migrations for authoritative names):
- **`signal_queue`**: persisted AI signals (`strategy_id`, tiers, expiry)
- **`follow_mode_settings`**: auto-copy preferences
- Older/alternate naming (`live_signals`, etc.) may exist in legacy migrations — confirm against **`supabase/migrations`**

**Signal flow** (simplified):
1. Scan produces **`AIRecommendation`** rows → persisted to **`signal_queue`**
2. Follow Mode reads tier/settings → optional **`tryAutoExecute`** into **`simulated_trades`**
3. Users may manually execute from Live Signals UI
4. Track records aggregate pattern keys over time (`signal_track_record` / related tables per migrations)

**Trust & Safety**:
- Minimum performance threshold to publish signals
- Verified track record (no cherry-picking)
- Follower can set max risk limits
- Automatic unfollow if performance degrades

---

## Database Schema Overview

### User & Accounts
- `users`: (Managed by Supabase Auth)
- `paper_accounts`: Virtual trading accounts with balance
- `user_settings`: User preferences and risk parameters
- `admin_users`: Admin access control

### Trading & Positions
- `simulated_trades`: All paper trades with entry/exit/P&L
- `watchlists`: User-created symbol lists
- `journal_entries`: Trade journal with notes and tags

### AI System Tables
- `strategy_overlays`: Optional overlay rows per **training account** (weights, veto flags)
- `ai_evolution_state`: Current AI configuration per account
- `ai_learned_adjustments`: Historical parameter changes
- `ai_drift_rollbacks`: Reverted changes due to poor performance
- `ai_recommendations`: All AI-generated trade ideas
- `ai_training_accounts`: Training AI metadata and performance
- `ai_discovered_patterns`: Patterns found by discovery engine
- `ai_evolved_rulesets`: Codified strategies ready for production
- `account_lineage`: Parent-child relationships between AIs
- Spawn / lifecycle log table: history of spawns, promotions, terminations (see migrations for exact name)

### Events & Anomalies
- `real_world_events`: External events affecting markets
- `ai_anomaly_detection`: Unusual market behavior

### Backtesting
- `historical_fleet_runs`: Backtest configurations
- `historical_fleet_accounts`: AI instances in backtest
- `historical_fleet_trades`: Simulated trades from backtest

### Signals / follow mode (schema evolves by migration)

Primary persisted signals table used by the app: **`signal_queue`** (includes **`strategy_id`**, strength tier, expiry). Follow-mode metadata appears in **`follow_mode_settings`** and related tables; naming elsewhere (`live_signals`, etc.) may appear in older docs — verify **`supabase/migrations`** for your deployed revision.

---

## How AI Should Work (Operational Flow)

### 1. Initial Setup
1. User creates paper trading account ($10,000 starting balance or chosen size)
2. User selects **which base strategies** participate in scans (AI Recommendations / Live Signals); optional background runner reads the same list
3. Training bots use **per-account `strategy_id`** + optional **`strategy_overlays`**
4. Personal AI drift/evolution state loads when **`generateRecommendation`** runs with `userId`

### 2. Signal Generation Loop (conceptual)
```
On manual Scan or background tick (when enabled):
  1. Refresh cached market data on the app cadence (often ~15 minutes; delayed feed)
  2. For each symbol × each selected base strategy → generateRecommendation(..., strategyId)
  3. Filter by min odds score / action ≠ no_action
  4. Persist to signal_queue (dedupe by symbol + strategy_id when inserting)
  5. Optional Follow Mode auto-execute against paper account
```

### 3. Trade Management Loop
```
Every minute during market hours:
  1. Check all open positions
  2. Compare current price vs stop loss and target
  3. If stop hit → close position, record loss
  4. If target hit → close position, record win
  5. Update P&L in paper_accounts
  6. Log outcome in simulated_trades
```

### 4. Evolution Loop
```
Every 24 hours:
  1. Calculate performance metrics (win rate, profit factor, etc.)
  2. Compare vs baseline (stored in ai_evolution_state)
  3. If performance improved → reinforce current parameters
  4. If performance degraded → check for drift
  5. If drift detected → rollback recent changes
  6. Optionally mutate parameters slightly for exploration
  7. Record in ai_learned_adjustments
```

### 5. Pattern Discovery Loop
```
Every 7 days:
  1. Analyze all closed trades from past week
  2. Group winning trades by common features
  3. Run statistical tests for significance
  4. If pattern found → save to ai_discovered_patterns
  5. Backtest pattern on historical data
  6. If validated → add to strategy rotation
```

---

## AI Decision Making Guidelines

### When to Take a Trade
- Confidence score > 70%
- Odds score > 65%
- Risk/reward ratio > 2:1
- Position size within risk limits (max 2% of account per trade)
- No conflicting signals from other indicators
- Market hours (avoid low liquidity periods)

### When to Avoid a Trade
- Low volume (< 50% of average)
- Wide spread (> 0.5%)
- Major news event imminent
- Max position limit reached
- Recent losses > 3 consecutive
- Drift detected (performance degrading)

### Position Sizing Formula
```
Risk Amount = Account Balance × Risk % (typically 1-2%)
Position Size = Risk Amount / (Entry Price - Stop Loss)
Max Position Size = Account Balance × Max Position % (typically 10%)
Actual Size = min(Calculated Size, Max Position Size)
```

### Stop Loss Placement
- Below recent swing low (long) or above swing high (short)
- Minimum 1% from entry (avoid noise)
- Maximum 5% from entry (cap risk)
- ATR-based: 1.5 × Average True Range

### Target Price Calculation
- Minimum 2× risk distance (if risking $100, target $200 profit)
- Next major support/resistance level
- Fibonacci extension levels
- Previous swing high/low

---

## AI Learning Mechanisms

### 1. Reinforcement Learning (Implicit)
- Winning trades → strengthen similar patterns
- Losing trades → weaken similar patterns
- Parameter adjustments based on reward signal (profit)

### 2. Supervised Learning (Pattern Recognition)
- Historical price patterns → predicted outcomes
- Feature extraction from winning trades
- Build pattern library over time

### 3. Evolutionary Algorithms
- Spawn variations (mutation)
- Select best performers (survival of fittest)
- Cross-breed successful strategies (recombination)

### 4. Meta-Learning
- Learn which strategies work in which market conditions
- Regime detection (trending, ranging, volatile)
- Adaptive strategy selection

---

## Performance Metrics

### Primary Metrics
- **Win Rate**: % of winning trades
- **Profit Factor**: Gross profit / Gross loss
- **Sharpe Ratio**: Risk-adjusted returns
- **Max Drawdown**: Largest peak-to-trough decline
- **Average Win/Loss**: Mean profit vs mean loss

### Secondary Metrics
- Expectancy: (Win% × Avg Win) - (Loss% × Avg Loss)
- Recovery Factor: Net profit / Max drawdown
- Consecutive wins/losses (streak analysis)
- Time in market (exposure)
- Win rate by setup type

### AI-Specific Metrics
- Signal accuracy over time
- Parameter stability (drift score)
- Adaptation speed (time to profitable after spawn)
- Pattern discovery rate (new patterns per month)
- Evolution generations (depth of lineage tree)

---

## User Interface Components

### Key Pages

1. **Dashboard** (`src/pages/Dashboard.tsx`)
   - Account overview, P&L chart, recent trades
   - AI performance summary

2. **Live Signals** (`src/pages/LiveSignals.tsx`)
   - Real-time AI-generated trade signals
   - Follow mode controls

3. **Training Accounts** (`src/pages/TrainingAccounts.tsx`)
   - View all training AI instances
   - Performance comparison
   - Spawn/terminate controls

4. **Pattern Discovery** (`src/pages/PatternDiscovery.tsx`)
   - Discovered patterns library
   - Pattern validation results
   - Promotion to production

5. **Historical Fleet** (`src/pages/HistoricalFleet.tsx`)
   - Backtest configuration
   - Fleet performance comparison
   - Export winners to live

6. **Analytics** (`src/pages/Analytics.tsx`)
   - Deep performance metrics
   - Trade analysis
   - Strategy comparison

7. **AI Rulebook** (`src/pages/AIRulebook.tsx`)
   - View/edit AI decision rules
   - Parameter tuning
   - Strategy selection

---

## Implementation Notes for AI

### Data Delay Handling
- All Tradier data is 15 minutes delayed
- For paper trading, this is acceptable (not trying to front-run)
- Real-time data not required for swing/position trading strategies
- For day trading simulations, account for delay in backtest

### Trade Execution Simulation
- Market orders: filled at current price ± 0.05% slippage
- Limit orders: filled if price reaches limit (with queue modeling)
- Stop orders: filled at stop price ± 0.1% slippage
- Partial fills possible on large orders

### Risk Management
- Hard stop: close position if stop loss hit
- Time stop: close position if no movement after N days
- Correlation limit: max exposure to correlated symbols
- Portfolio heat: max % of account at risk simultaneously

### Error Handling
- Tradier API failures → use cached data or skip cycle
- Database errors → log and retry
- Invalid signals → reject and log reason
- Execution failures → alert user, don't continue

---

## Future Enhancement Ideas

1. **Multi-Asset Support**: Extend beyond stocks to options, crypto, forex
2. **Sentiment Analysis**: Integrate news/social media sentiment
3. **Ensemble Models**: Combine multiple AI approaches (neural nets + rule-based)
4. **Automated Hyperparameter Tuning**: Grid search / Bayesian optimization
5. **Market Regime Classification**: Detect and adapt to market conditions
6. **Portfolio Optimization**: Modern portfolio theory integration
7. **Risk Parity**: Balance risk across positions
8. **Factor Investing**: Integrate factor models (value, momentum, quality)
9. **Backtesting Enhancements**: Walk-forward analysis, Monte Carlo simulation
10. **Live Trading**: Eventually connect to real broker for actual execution

---

## Security Considerations

- All trading operations with Tradier are BLOCKED (data feed only)
- RLS policies ensure users only see their own data
- Admin access controlled via `admin_users` table
- API keys stored in Edge Function secrets (not in code)
- No user data exposed in client-side code
- All database mutations go through Supabase RLS

---

## Development Workflow

1. Make changes to AI logic in `src/lib/`
2. Test with paper trading account
3. Monitor performance in Analytics dashboard
4. If successful, promote to production strategy
5. Deploy edge functions via `mcp__supabase__deploy_edge_function` tool
6. Run `npm run build` to verify no TypeScript errors

---

## Key Files Reference

- **AI Engines**: `src/lib/aiEngine.ts`, `src/lib/aiEvolution.ts`, `src/lib/aiDriftEngine.ts`
- **Additional orchestration**: Other modules under `src/lib/` coordinate multi-account flows as implemented.
- **Pattern Discovery**: `src/lib/patternDiscovery.ts`, `src/lib/signalTrackRecord.ts`
- **Trading**: `src/lib/tradierTrading.ts`, `src/lib/tradeSimulator.ts`
- **Data**: `src/lib/tradierApi.ts`, `src/lib/marketData.ts`
- **Strategies**: `src/lib/strategies/` directory
- **Edge Functions**: `supabase/functions/tradier-proxy/index.ts`
- **Database Migrations**: `supabase/migrations/*.sql`

---

## Contact & Support

This platform is designed to be autonomous and self-improving. The AI should continuously learn, adapt, and evolve strategies without manual intervention. Monitor performance metrics and intervene only when drift is significant or system errors occur.

**Remember**: All trading is simulated. No real money is at risk. The goal is to discover profitable strategies in a safe environment before considering live deployment.
