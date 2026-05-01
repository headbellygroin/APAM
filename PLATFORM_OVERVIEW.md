# Trading Platform - AI-Powered Paper Trading Simulator

## Canonical project copy

Use **`C:\Bolt Files\APAM`** as the single source tree for this project (avoid duplicate folders under OneDrive or other sync roots). Documentation in this folder is maintained to match that codebase.

## Overview

This is a complete **AI-powered paper trading platform** that allows traders to practice and learn the Surge Strategy methodology using virtual money. The platform runs as a web application accessible from any computer with internet access.

## Key Features

### 1. Multi-User Web Portal
- Secure authentication system (email/password)
- Each user has their own isolated account and data
- Access from any computer by logging in
- All data stored securely in Supabase cloud database

### 2. Paper Trading Accounts
- Create multiple virtual trading accounts with different starting balances ($50, $200k, or any amount)
- Track performance separately for each account
- Real-time balance updates as trades are executed
- Complete transaction history

### 3. AI Recommendation Engine
The AI analyzes market conditions and recommends trades using registered **base strategies** (e.g. Trade Surge, APAM):
- **Parallel strategies**: On **AI Recommendations** and **Live Signals**, choose **one or more** base strategies; each scans the same universe and results merge (sorted by score). Selection is saved locally (`marketScanStrategies` helper / `localStorage`).
- **Odds Enhancer scoring**: Each setup is scored against that strategy’s rule stack (curve, trend, zones, matrix).
- **Live Signals**: Persisted signals include **`strategy_id`**; duplicates are avoided per **symbol + strategy**, not just symbol.
- **Strategy library (Settings)**: Read-only explanations and guides — **not** a global “switch” that changes how scans behave.
- **One-click execution**: Execute AI recommendations as paper trades when ready.

### 4. Intelligent Trade Simulator
- Automatically executes AI-recommended trades using virtual money
- Monitors open positions in real-time
- Auto-closes trades when they hit targets or stop losses
- Calculates position size based on your risk parameters
- Updates account balance automatically

### 5. AI Learning System
The AI improves over time through:
- **Pattern Recognition**: Learns which setups work best
- **Performance Tracking**: Tracks success rate of each pattern type
- **Adaptive Recommendations**: Adjusts confidence scores based on historical performance
- **Learning History**: Records what the AI has learned from each trade

### 6. Real-Time Market Data
- Live stock quotes from Finnhub API (free tier)
- Historical price data for analysis
- Symbol search functionality
- No cost for basic market data

## How It Works

### For Beginners ($50 Practice Account)

1. **Sign Up**: Create your free account
2. **Create Paper Account**: Start with $50 virtual money
3. **Add Symbols**: Add a few stocks to your watchlist (e.g., AAPL, TSLA, NVDA)
4. **Let AI Scan**: Click "Scan Market" - AI finds good setups for you
5. **Execute Trades**: Click "Execute Paper Trade" on AI recommendations
6. **Watch It Learn**: AI monitors trades, closes them automatically, and learns from results
7. **Review Performance**: Check Analytics to see how you're doing

### For Advanced Traders ($200k Account)

Same process, but with:
- Larger position sizes based on account balance
- Multiple paper accounts for different strategies
- Custom risk parameters (1% risk per trade, etc.)
- Detailed analytics and performance tracking

## AI Training & Learning

### How the AI Gets Better

1. **Initial Setup**: AI uses Surge Strategy rules (curve, trend, zones)
2. **Trade Execution**: When you execute an AI recommendation, it becomes a learning opportunity
3. **Outcome Tracking**: AI tracks whether the trade was a win or loss
4. **Pattern Learning**: AI identifies which combinations work best:
   - Curve Position (high/middle/low)
   - Trend Direction (uptrend/sideways/downtrend)
   - Zone Type (supply/demand)
5. **Confidence Adjustment**: Future recommendations for similar patterns get higher/lower confidence
6. **Continuous Improvement**: The more trades you do, the smarter the AI becomes

### Feedback Loop

```
Scan Market → AI Recommends → Execute Trade → Monitor Position →
Close Trade → Record Outcome → Learn Pattern → Improve Next Recommendation
```

## Core Pages

### Dashboard
- Overview of your trading statistics
- Recent trades
- Quick start guide
- Account performance summary

### Watchlist
- Add/remove symbols to track
- Real-time price quotes
- Quick symbol search

### AI Recommendations
- Scan watchlist or market segments for high-probability setups
- Select **which base strategies** participate (parallel scan)
- View AI confidence scores and **which strategy** produced each row
- See complete analysis (curve, trend, zone)
- One-click trade execution
- Filter by minimum score (7.0+, 8.5+, etc.)

### Paper Trading
- View all virtual accounts
- Monitor open positions
- Review closed trades
- Track profit/loss in real-time
- Create new practice accounts

### Trade Plan
- Calculate position sizes
- Evaluate Odds Enhancer score manually
- Plan S.E.T.S. (Stop, Entry, Target)
- Risk/reward ratio calculator
- 6-step trade checklist

### Decision Matrix
- Interactive tool to determine trade action
- Select curve position, trend, zone type
- Get instant recommendation (LONG/SHORT/NO ACTION)
- View complete matrix tables
- Learn setup quality levels

### Journal
- Document your trades
- Record emotions and thoughts
- Track lessons learned
- Review past decisions
- Build trading discipline

### Analytics
- Win rate and profit factor
- Average win vs average loss
- AI recommendation performance
- Time-based filtering (7d, 30d, all time)
- Performance insights

## Technical Architecture

### Frontend
- React 18 with TypeScript
- Vite for fast development
- Tailwind CSS for styling
- React Router for navigation

### Backend
- Supabase PostgreSQL database
- Row Level Security for data isolation
- Real-time subscriptions
- Automatic schema migrations

### AI Engine
- Pattern recognition algorithms
- Market analysis (trend, curve, zones)
- Automated scanning
- Learning history tracking

### Data Flow

```
User Login → Access Cloud Database → Real-time Market Data →
AI Analysis → Trade Recommendations → Paper Trading Execution →
Performance Tracking → AI Learning
```

## Database Tables

1. **profiles** - User accounts
2. **watchlists** - Tracked symbols
3. **paper_accounts** - Virtual trading accounts
4. **simulated_trades** - Paper trade history
5. **ai_recommendations** - AI trade suggestions
6. **ai_learning_history** - What AI has learned
7. **market_scans** - Historical market scans
8. **zones** - Supply/demand zone analysis
9. **trade_plans** - Risk management settings
10. **journal_entries** - Trading journal

## Surge Strategy Implementation

### Decision Matrix
- **3 Inputs**: Curve Position (HTF), Trend Direction (ITF), Zone Type (LTF)
- **Output**: LONG, SHORT, LONG_ADVANCED, SHORT_ADVANCED, or NO_ACTION

### Odds Enhancer Scorecard (10 points)
1. **Strength** (0-2): Zone breakout quality
2. **Time** (0-1): Base formation time
3. **Freshness** (0-2): Zone test status
4. **Trend** (0-2): Trend alignment
5. **Curve** (0-1): Price position
6. **Profit Zone** (0-2): Risk/reward ratio

### Entry Types
- **8.5-10 points**: Proximal Entry (best)
- **7-8.5 points**: Confirmation Entry
- **<7 points**: No Trade

## Getting Started

### Installation
```bash
npm install
```

### Development
```bash
npm run dev
```

### Production Build
```bash
npm run build
```

### Environment variables

Configure `.env` locally (never commit real secrets). Typical keys:

- `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY` — Supabase client
- Market data keys / proxy URLs — whichever provider your build uses (often Tradier via Supabase Edge Functions)

See **[PROJECT_WORKFLOW.md](./PROJECT_WORKFLOW.md)** for Git, Bolt.new, and applying Supabase migrations.

## User Settings

**Settings** covers preferences (fees, follow mode, evolution notices, **strategy library** text/guides), not the active scan strategy set.

Users also customize elsewhere:

- **Paper accounts**: account size, risk per trade
- **AI Recommendations / Live Signals**: **minimum score** and **which base strategies** scan (saved in browser `localStorage`)
- **Training accounts**: **base `strategy_id`** per account plus optional **overlays** at creation time (`strategy_overlays` table)
- Optional **background market scan** uses `localStorage` key `apam.backgroundScan.v1` (segment, interval, session window, EOD options); strategy list matches AI Recommendations/Live Signals via `apam.marketScanner.strategyIds.v1`

## AI Performance

The AI tracks its own performance:
- Win rate by pattern type
- Confidence score accuracy
- Best performing setups
- Learning curve over time

Users can see in Analytics:
- AI Win Rate percentage
- Number of AI trades taken
- AI vs Manual trade comparison
- Performance improvement trend

## Benefits

### Shortcut Learning Time
Instead of 6-8 months to learn Surge Strategy:
- AI teaches by example
- See what works in real-time
- Practice without financial risk
- Build confidence before real trading

### Risk-Free Practice
- No real money at stake
- Learn from mistakes safely
- Test different account sizes
- Experiment with risk parameters

### Continuous Improvement
- AI gets smarter with every trade
- Your skills improve through journaling
- Analytics show what's working
- Pattern recognition develops naturally

## Future Enhancements

Potential additions:
- Real broker integration (execute real trades)
- Advanced charting with zone drawing
- Mobile app version
- Multi-timeframe analysis
- Automated trade alerts
- Social features (share setups)
- Advanced AI models (machine learning)
- Backtesting on historical data

## Support & Learning

Platform includes:
- Built-in tooltips and explanations
- Interactive decision matrix
- Performance insights
- AI reasoning for each recommendation
- Complete trading journal system

## Conclusion

This platform provides everything needed to learn and practice the Surge Strategy methodology using AI assistance and virtual money. Whether starting with $50 or $200,000, users can practice, learn, and improve their trading skills in a risk-free environment while the AI continuously learns and provides better recommendations over time.

The key innovation is the **AI learning loop**: as users execute trades based on AI recommendations, the system learns which patterns work best and improves future suggestions, creating a positive feedback cycle that accelerates the learning process for both the AI and the trader.
