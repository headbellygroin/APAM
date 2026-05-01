# Feature Guide: Master AI & Advanced Systems

## Master AI Tab

### Overview
The Master AI synthesizes insights from all user AI instances to create a collective intelligence. It's only available to admin users.

### Key Features

#### 1. **Snapshot**
- **What it does**: Creates a permanent record of the current Master AI state, including all weight adjustments, boost reports, and synthesis data
- **When to use**: Before major strategy changes, after significant learning periods, or to preserve a well-performing configuration
- **How it works**: Click "Snapshot" to save the current state to the database with a timestamp
- **Access**: View past snapshots in the dropdown to compare how the Master AI has evolved

#### 2. **Sync Now**
- **What it does**: Immediately pulls data from all active training accounts and re-synthesizes the Master AI
- **When to use**: After training accounts complete significant trading sessions, or when you want fresh collective insights
- **How it works**: Aggregates all user AI drift, learned adjustments, and performance data to update Master AI weights
- **Note**: The system auto-syncs every 30 minutes, but manual sync gives you immediate updates

#### 3. **Run Review (End of Day)**
- **What it does**: Comprehensive analysis of all AI performance for the day
- **When to use**: After market close (typically 4:00 PM ET)
- **Process**:
  1. Analyzes all trades executed by training accounts
  2. Identifies top performers and underperformers
  3. Updates Master AI synthesis with strongest patterns
  4. Generates boost reports showing which adjustments worked
  5. Creates snapshot automatically if significant improvements detected
- **Best Practice**: Run this once daily after market close when all positions are settled

---

## Real World Events Tab

### Overview
This system captures external events that caused unusual market behavior the AI didn't predict. It helps the AI learn from "what it missed."

### Three Main Sections

#### 1. **Anomalies Tab**
Shows detected trading anomalies where human traders acted differently than AI recommendations.

**How Anomalies Work**:
- AI recommends action X, but human took action Y
- Human made unexpected profit/loss that AI didn't predict
- Trade occurred during unusual market conditions

**Status Flow**:
- `detected` → Auto-detected by the system
- `investigating` → You're researching what caused it
- `resolved` → Linked to a real-world event
- `dismissed` → False positive or irrelevant

**Usage**:
1. Review detected anomalies daily
2. Click "Investigate" if pattern seems significant
3. Click "Resolve & Log Event" to explain what happened
4. System learns to recognize similar patterns in future

#### 2. **Events Tab**
Manual log of real-world events that impacted markets.

**Event Types**:
- Economic Report (Fed announcements, jobs data, CPI)
- Earnings (company earnings releases)
- Geopolitical (wars, elections, policy changes)
- Market Structure (circuit breakers, system issues)
- Sector News (industry-specific developments)
- Black Swan (unexpected major events)

**When to Log Events**:
- Immediately when you notice unusual market behavior
- After reviewing anomalies to explain the cause
- Proactively for known upcoming events (earnings calendars, Fed meetings)

**+ Log Event Button**:
1. Click "+ Log Event"
2. Select event type
3. Add affected symbols
4. Describe the event and market impact
5. Link to anomalies if relevant
6. Check "Use for Future Prediction" if this is a recurring pattern

#### 3. **Pattern Catalog Tab**
Library of recognized event patterns the AI can now identify.

**"Use for Future Prediction" Checkbox**:
This is the key to proactive AI behavior. When checked:
- AI monitors news/calendar for similar events
- Pre-adjusts expectations before event occurs
- Example: If "Fed Rate Decision" pattern shows 2% volatility spike, AI adjusts position sizing on Fed meeting days
- Example: If earnings releases in tech sector show gap-up tendency, AI prepares for similar patterns

**How to Build Patterns**:
1. Log multiple events of the same type (e.g., 10+ Fed announcements)
2. System automatically groups similar events
3. Identifies consistent market reactions
4. Creates predictive pattern in catalog
5. Enable "Use for Prediction" for reliable patterns

**You're Right - Paradox Solution**:
"I won't know something happened til it happened" - Correct! Here's the workflow:
1. **First occurrence**: Something unexpected happens → You log it as an event → It's now in the system
2. **Similar future events**: System recognizes the pattern BEFORE it fully plays out
3. **Example Timeline**:
   - Event 1: Fed hikes rates unexpectedly → Market drops 3% → You log this after
   - Event 2-5: More Fed announcements → Similar patterns → You log these
   - Event 6+: System now PREDICTS "Fed announcement = likely 2-3% move" → AI adjusts BEFORE the move completes

---

## Scan for Anomalies Button

**What it does**: Scans your recent paper trading history to find trades where:
- You overrode AI recommendations
- Results differed significantly from AI predictions
- Timing was unusual compared to your patterns
- Position sizing deviated from AI suggestions

**When to use**:
- Weekly to catch patterns you might have missed
- After volatile market days
- When you notice your P&L diverges from AI expectations

**Process**:
1. Analyzes last 30 days of trades
2. Compares against AI recommendations
3. Flags statistical outliers
4. Creates anomaly cards for review

---

## Pattern Discovery Tab

### Overview
AI automatically discovers hidden patterns in your trading data that might become new rules.

### How to Use "Run Discovery"

**What it does**:
- Analyzes all training account trades
- Groups similar trade setups
- Identifies if certain patterns consistently outperform
- Creates "observations" of potential edges

**When to run**:
- After 50+ trades per training account
- Weekly or monthly for regular pattern mining
- After enabling new strategy overlays
- Following major market regime changes

**Process**:
1. Click "Run Discovery"
2. System analyzes trades from all training accounts
3. Looks for:
   - Specific time-of-day edges
   - Symbol-specific tendencies
   - Condition combinations that boost win rate
   - Entry/exit timing patterns
4. Creates observations with statistical significance
5. Shows edge percentage and sample size

**Promoting Observations to Rules**:
- Review high-edge observations (>5% edge, 20+ samples)
- Click "Promote to Candidate Rule"
- Give it a name and description
- Choose rule type (score boost, filter, override)
- Test in adaptive training accounts
- If successful after 30+ trades, deploy to main AI

---

## Historical Fleet

### Overview
Run training accounts through past market data at accelerated speed to learn faster than real-time trading allows.

### How Historical Fleet Works

**Purpose**: Test strategies against historical market periods without waiting months/years.

**Market Data Presets**:
- **Dot-Com Bubble (1999-2000)**: Extreme growth → crash
- **Financial Crisis (2008-2009)**: Systemic collapse, high volatility
- **COVID Crash (2020)**: Fastest bear market in history
- **Bull Market (2019)**: Low volatility, steady gains
- **Inflation Era (2022)**: Rate hike cycle, sector rotation

### Creating AI Accounts for Historical Runs

**Where to create**: Historical Fleet page → "New Historical Run" button

**Configuration**:
1. **Select Market Era**: Choose preset or custom date range
2. **Create Fleet Accounts**: Similar to regular training accounts
   - Name each account (e.g., "2008-Crisis-APAM-Strict", "2008-Crisis-TradeSurge-Adaptive")
   - Choose base strategy (Trade Surge or APAM)
   - Add optional overlays (Fibonacci OR, etc.)
   - Set account mode:
     - **Strict**: Follows rules exactly, never drifts
     - **Adaptive**: Can learn and drift from starting rules
3. **Speed Multiplier**: How fast to run (1x = real-time, 100x = 100 days in 1 day)
4. **Starting Capital**: Typically $25,000-$100,000

### Custom Year Ranges (1950s-1970s Example)

**To add custom historical periods**:
1. Click "New Historical Run"
2. Select "Custom Date Range"
3. Enter: Start Date (e.g., 1950-01-01), End Date (e.g., 1979-12-31)
4. System will use available historical data for that period
5. Create fleet accounts with strategies

**Important Notes**:
- Historical data availability varies (most comprehensive from 1990s+)
- Earlier periods have less intraday data
- System adapts to available data granularity

### Strict vs Adaptive Control (Fleet Level vs Individual)

**Two Levels of Control**:

**1. Fleet-Level Tabs (Strict Control / Adaptive Drift)**
- **Purpose**: Filter view to see all strict accounts or all adaptive accounts in the fleet
- **Use**: Quick comparison between control group (strict) and experimental group (adaptive)
- Doesn't change account behavior, just organizes the view

**2. Individual Account Settings**
- **Purpose**: Each account has its own strict/adaptive mode
- **Strict Account**:
  - Locked to starting ruleset
  - Never learns or drifts
  - Perfect for baseline comparison
  - Shows "what would happen with pure strategy"
- **Adaptive Account**:
  - Can learn from results
  - Adjusts weights based on performance
  - May discover better parameters
  - Shows "what AI can improve to"

**Example Fleet Setup for 2008 Crisis**:
```
Strict Accounts:
- 2008-APAM-Strict-1
- 2008-TradeSurge-Strict-1
- 2008-FibOR-Strict-1

Adaptive Accounts:
- 2008-APAM-Adaptive-1
- 2008-APAM-Adaptive-2 (different starting params)
- 2008-TradeSurge-Adaptive-1
- 2008-Hybrid-Adaptive-1 (TradeSurge + FibOR overlay)
```

### Running Accelerated Simulations

**Key Principle**: No Look-Ahead Bias
- Even at 100x speed, AI only knows data up to "current" simulation date
- AI cannot see future candles or results
- Processes data in chronological order
- Decisions made with information available at that moment in history

**Simulation Speed**:
- **1x**: Real-time (slow, but matches live trading exactly)
- **10x**: 10 days in 1 day (good for recent years)
- **50x**: 50 days in 1 day (fast backtesting)
- **100x**: 100 days in 1 day (rapid testing)

**Process**:
1. Create historical run with fleet accounts
2. Click "Start Simulation"
3. System processes market data day by day (at chosen speed)
4. Each account trades according to its rules
5. Adaptive accounts learn and adjust
6. Progress bar shows current simulation date
7. View results in real-time as simulation runs

### Finding Reports

**During Simulation**:
- Expand the run to see live account performance
- Real-time P&L updates
- Trade log shows all executed trades
- Win rate and metrics update continuously

**After Completion**:
- Run status changes to "Completed"
- Click run to expand full results
- **Account Performance Tab**: Shows each account's final results
- **Trade Log**: Every trade with entry/exit details
- **Comparison View**: Strict vs Adaptive performance
- **Pattern Discovery**: Automatically runs on completion to find what worked

**Exporting Results**:
- Performance summaries saved to database
- Compare multiple historical runs
- Identify which strategies work in which market conditions
- Feed learnings back to Master AI

### Iterative Testing Strategy

**First Pass**:
1. Run all current strategies through all market eras
2. Identify weaknesses (e.g., "APAM fails in high-volatility crashes")
3. Note which adaptations helped

**Create Better Rules**:
1. Based on learnings, create new rulesets or overlays
2. Add to strategy registry

**Second Pass**:
1. Run improved strategies through historical data again
2. Compare v1 vs v2 performance
3. Verify improvements are real, not overfitted

**Third Pass+**:
1. Continue refining
2. Test in different historical periods
3. Build robust strategies that work across multiple market regimes

### Best Practices

1. **Always run control groups**: Include strict accounts to measure improvement
2. **Vary parameters**: Create multiple adaptive accounts with different starting configs
3. **Test multiple eras**: Strategy that works in 2019 might fail in 2008
4. **Document learnings**: Use Pattern Discovery to formalize what worked
5. **Avoid overfitting**: If adaptive account is TOO perfect, it might be curve-fitted
6. **Cross-validate**: Test learned patterns in different time periods

---

## Summary Workflow

**Daily Routine**:
1. Morning: Review Live Signals and Real World Events calendar
2. During market: Monitor training accounts, note any anomalies
3. After close: Run "End of Day Review" in Master AI
4. Evening: Scan for Anomalies, log any significant events

**Weekly Routine**:
1. Run Pattern Discovery on all training accounts
2. Review new observations, promote strong patterns
3. Check Historical Fleet for any completed runs
4. Update Master AI with learnings

**Monthly Routine**:
1. Create new Historical Fleet run for different market era
2. Snapshot Master AI state before major changes
3. Review Pattern Catalog, enable prediction for validated patterns
4. Analyze which strategies performed best across eras
