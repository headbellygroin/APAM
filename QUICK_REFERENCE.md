# Quick Reference Guide

## Parallel strategy scans (AI Recommendations & Live Signals)

| Item | Detail |
|------|--------|
| **Where** | AI Recommendations page, Live Signals page (checkboxes under scanner controls) |
| **Persisted** | Browser `localStorage` key `apam.marketScanner.strategyIds.v1` (via `src/lib/marketScanStrategies.ts`) |
| **Behavior** | Each selected **base** strategy evaluates each symbol; rows include **`strategyId`**; scored results merge and sort |
| **Deduping** | Live Signals + background runner skip insert if an **active** signal already exists for same **`symbol` + `strategy_id`** |
| **Charts** | Daily overlays use **first** ID in the saved list for curve/trend/zones |

## Real World Events - Workflow

### 1. Anomalies Tab
**Auto-detected unusual trades**
- Review weekly or after volatile days
- Click "Investigate" → Research the cause
- Click "Resolve & Log Event" → Explain what happened

### 2. Events Tab
**Manual event logging**
- Log major market events immediately
- Link to related anomalies
- ✓ "Use for Future Prediction" = AI learns the pattern

### 3. Pattern Catalog
**Recurring patterns AI can predict**
- View patterns the AI has learned
- Enable prediction for reliable patterns
- AI pre-adjusts for similar future events

### Scan for Anomalies Button
Analyzes last 30 days to find:
- Overridden AI recommendations
- Unexpected profit/loss
- Statistical outliers in your trading

## Pattern Discovery

### Run Discovery Button
**When**: Weekly, or after 50+ trades per account
**Does**: Finds hidden edges in your data
- Time-of-day advantages
- Symbol-specific tendencies
- Winning combinations of conditions
**Result**: Creates observations you can promote to new rules

## Historical Fleet

### Purpose
Test strategies through past market data at 100x speed

### Creating a Run
1. Choose preset era OR enter custom dates (1950-01-01 to 2024-12-31)
2. Add fleet accounts (mix of strict + adaptive)
3. Select speed multiplier (1x to 100x)
4. Click "Create Historical Run"

### Account Types
| Type | Behavior | Use Case |
|------|----------|----------|
| **Strict** | Never drifts, follows base rules exactly | Control group, baseline performance |
| **Adaptive** | Learns and adjusts weights | Experimental group, discover improvements |

### Fleet Tabs vs Individual Settings

**Fleet-Level Tabs** (Strict Control / Adaptive Drift)
- View filter only
- Shows all strict accounts OR all adaptive accounts
- Doesn't change behavior

**Individual Account Mode** (per account)
- Actual behavior setting
- Determines if that specific account can learn
- Set when creating the account

### Best Practice Fleet Setup
```
Strict Accounts:
├─ Strategy-A-Strict-Baseline
├─ Strategy-B-Strict-Baseline

Adaptive Accounts:
├─ Strategy-A-Adaptive-Variation1
├─ Strategy-A-Adaptive-Variation2
├─ Strategy-B-Adaptive-Variation1
└─ Hybrid-Strategy-A+B-Adaptive
```

### No Look-Ahead Guarantee
- Even at 100x speed, AI only knows past data
- Processes chronologically
- Cannot see future results
- Learns as if trading live in that era

## Available Historical Eras

| Era | Period | Description |
|-----|--------|-------------|
| Black Monday 1987 | 1987 | 22% single-day crash |
| 1990s Bull Market | 1990-1999 | Longest bull run, tech boom |
| Dot-Com Bubble | 1998-2000 | NASDAQ +400% |
| Dot-Com Crash | 2000-2002 | NASDAQ -78% |
| 2003-2007 Bull | 2003-2007 | Post dot-com recovery |
| Financial Crisis | 2007-2009 | S&P -57% |
| 2009-2013 Recovery | 2009-2013 | Post-crisis rally |
| 2013-2020 Bull | 2013-2020 | Extended bull market |
| COVID Crash | Feb-Apr 2020 | Fastest bear (-34% in 23 days) |
| COVID Recovery | 2020-2021 | V-shaped recovery |
| 2022 Bear Market | 2022 | Inflation, rate hikes (-25%) |
| 2023-2024 Recovery | 2023-2024 | AI-driven rally |
| **Custom** | Any dates | Enter your own range |

## Iterative Testing Strategy

### Phase 1: Initial Testing
1. Run current strategies through all eras
2. Identify weaknesses
3. Note what worked where

### Phase 2: Improvement
1. Create new rules based on learnings
2. Run improved strategies through same eras
3. Compare v1 vs v2

### Phase 3: Validation
1. Test in different periods not used for training
2. Verify improvements aren't overfitted
3. Deploy best performers to live training

## Daily Workflow

**Morning** (Pre-Market)
- Check Real World Events calendar
- Review any overnight news

**During Market**
- Monitor training accounts
- Note unusual behavior

**After Close** (Post 4 PM)
- Review session trades and any automated scans
- Scan for Anomalies
- Log any significant events

## Weekly Workflow

1. Run Pattern Discovery
2. Review Historical Fleet results
3. Check Pattern Catalog
4. Update enabled overlays

## Monthly Workflow

1. Capture baseline metrics before large strategy changes
2. Launch new Historical Fleet run
3. Review overall strategy performance
4. Adjust based on learnings
