const SP500_FULL = [
  'AAPL', 'MSFT', 'GOOGL', 'AMZN', 'NVDA', 'META', 'TSLA', 'BRK.B', 'UNH', 'XOM',
  'JNJ', 'JPM', 'V', 'PG', 'MA', 'HD', 'CVX', 'LLY', 'ABBV', 'MRK',
  'PEP', 'KO', 'AVGO', 'COST', 'WMT', 'MCD', 'CSCO', 'ACN', 'TMO', 'DIS',
  'ABT', 'VZ', 'ADBE', 'CRM', 'NKE', 'NFLX', 'CMCSA', 'ORCL', 'DHR', 'TXN',
  'INTC', 'PM', 'WFC', 'NEE', 'BMY', 'UPS', 'RTX', 'QCOM', 'HON', 'SPGI',
  'COP', 'LOW', 'AMD', 'INTU', 'UNP', 'GS', 'T', 'MS', 'BA', 'ELV',
  'AMAT', 'DE', 'CAT', 'AXP', 'BLK', 'LMT', 'SBUX', 'PLD', 'MDLZ', 'GILD',
  'SYK', 'ADP', 'ADI', 'ISRG', 'TJX', 'MMC', 'CI', 'BKNG', 'VRTX', 'CB',
  'AMT', 'CVS', 'ZTS', 'TMUS', 'MO', 'SCHW', 'DUK', 'PGR', 'C', 'BDX',
  'SO', 'BSX', 'EOG', 'REGN', 'ETN', 'SLB', 'ITW', 'AON', 'CME', 'NOC',
  'PNC', 'ICE', 'CL', 'EMR', 'GD', 'WM', 'MCK', 'APD', 'SHW', 'FDX',
  'HUM', 'NSC', 'AJG', 'ORLY', 'FCX', 'TGT', 'SRE', 'PSX', 'GM', 'SNPS',
  'CDNS', 'ROP', 'KMB', 'MPC', 'VLO', 'AIG', 'AFL', 'TRV', 'OXY', 'F',
  'HAL', 'PSA', 'DLR', 'FTNT', 'KDP', 'MNST', 'AEP', 'D', 'EW', 'PCAR',
  'IDXX', 'CTAS', 'CARR', 'GIS', 'A', 'BK', 'MCO', 'MSCI', 'AMP', 'TEL',
  'STZ', 'HES', 'NUE', 'DVN', 'CMI', 'PAYX', 'IQV', 'HSY', 'WELL', 'PRU',
  'MCHP', 'FAST', 'CTSH', 'DXCM', 'ODFL', 'EXC', 'KHC', 'YUM', 'XEL', 'AZO',
  'EXR', 'BIIB', 'LULU', 'ON', 'KR', 'EA', 'FANG', 'DD', 'IT', 'CPRT',
  'CDW', 'GWW', 'HPQ', 'ED', 'KEYS', 'VRSK', 'RMD', 'DOW', 'ANSS', 'CSGP',
  'AWK', 'WEC', 'MTD', 'ROK', 'BKR', 'ZBH', 'STT', 'GLW', 'TRGP', 'WTW',
  'FIS', 'TSCO', 'PPG', 'APTV', 'EFX', 'EC', 'LH', 'DHI', 'FTV', 'OTIS',
  'AVB', 'EBAY', 'LEN', 'HPE', 'WAB', 'EQR', 'NDAQ', 'K', 'HIG', 'DTE',
  'WDC', 'IRM', 'MTB', 'PEG', 'BR', 'RF', 'URI', 'FITB', 'HBAN', 'PHM',
  'CHD', 'ARE', 'WAT', 'VICI', 'TDY', 'DAL', 'STE', 'PPL', 'ES', 'BAX',
  'CLX', 'CAH', 'CFG', 'NTRS', 'SBAC', 'RJF', 'WRB', 'MKC', 'J', 'SWKS',
  'HOLX', 'TXT', 'IEX', 'FE', 'SWK', 'CINF', 'MAA', 'ESS', 'PKI', 'BALL',
  'IP', 'COO', 'DGX', 'ATO', 'AMCR', 'LUV', 'JBHT', 'POOL', 'ALGN', 'MOH',
  'PFG', 'OMC', 'NTAP', 'LKQ', 'TRMB', 'CF', 'NVR', 'BG', 'AVY', 'DPZ',
  'EXPD', 'SJM', 'CAG', 'MGM', 'CCL', 'BEN', 'AKAM', 'NRG', 'TECH', 'PEAK',
  'HRL', 'UDR', 'KIM', 'REG', 'BWA', 'TPR', 'WYNN', 'CPT', 'AAL', 'FOXA',
  'CZR', 'HST', 'WBA', 'DVA', 'NCLH', 'PARA', 'BBWI', 'CTLT', 'FRT', 'BIO',
  'AIZ', 'GNRC', 'MTCH', 'XRAY', 'SEE', 'AOS', 'IVZ', 'TAP', 'PNR', 'CMA',
  'ZION', 'MHK', 'NWSA', 'NWS', 'DISH', 'LUMN', 'VFC',
  'MPWR', 'SMCI', 'GEV', 'FICO', 'CEG', 'VST', 'DECK', 'AXON', 'PLTR',
  'CRWD', 'NXPI', 'KLAC', 'LRCX', 'MU', 'PANW', 'MELI', 'WDAY', 'ADSK',
  'GEHC', 'SPOT', 'TTD', 'DDOG', 'ZS', 'SNOW', 'NET', 'TEAM', 'VEEV',
  'OKTA', 'DOCU', 'BILL', 'PCOR', 'APP', 'COIN', 'ABNB', 'DASH', 'UBER',
  'LYFT', 'RBLX', 'U', 'ENPH', 'SEDG', 'FSLR', 'RIVN', 'LCID',
]

const NASDAQ_EXTENDED = [
  'AAPL', 'MSFT', 'GOOGL', 'AMZN', 'NVDA', 'META', 'TSLA', 'AVGO', 'COST', 'ASML',
  'NFLX', 'ADBE', 'PEP', 'CSCO', 'CMCSA', 'AMD', 'INTC', 'QCOM', 'INTU', 'TXN',
  'AMAT', 'HON', 'AMGN', 'SBUX', 'GILD', 'ADI', 'BKNG', 'VRTX', 'ISRG', 'ADP',
  'REGN', 'MDLZ', 'MU', 'LRCX', 'PANW', 'MELI', 'SNPS', 'CDNS', 'CSX', 'PYPL',
  'KLAC', 'NXPI', 'ABNB', 'MAR', 'ORLY', 'CRWD', 'MNST', 'WDAY', 'FTNT', 'ADSK',
  'MCHP', 'ON', 'DXCM', 'EA', 'FAST', 'CPRT', 'ODFL', 'CSGP', 'ANSS', 'IDXX',
  'BIIB', 'LULU', 'CDW', 'PCAR', 'CTSH', 'EBAY', 'WDC', 'ALGN', 'POOL', 'SWKS',
  'MPWR', 'SMCI', 'FICO', 'DECK', 'AXON', 'PLTR', 'TTD', 'DDOG', 'ZS', 'SNOW',
  'NET', 'TEAM', 'VEEV', 'OKTA', 'DOCU', 'BILL', 'APP', 'COIN', 'DASH', 'UBER',
  'LYFT', 'RBLX', 'U', 'ENPH', 'FSLR', 'RIVN', 'LCID', 'SPOT', 'ROKU', 'SNAP',
]

const POPULAR_ETFS = [
  'SPY', 'QQQ', 'IWM', 'DIA', 'VOO', 'VTI', 'AGG', 'EEM', 'GLD', 'SLV',
  'TLT', 'HYG', 'XLF', 'XLE', 'XLK', 'XLV', 'XLI', 'XLY', 'XLP', 'XLU',
  'ARKK', 'ARKG', 'ARKF', 'XBI', 'SMH', 'SOXX', 'VNQ', 'KWEB', 'FXI', 'EWZ',
]

const VOLATILE_STOCKS = [
  'GME', 'AMC', 'PLTR', 'SOFI', 'NIO', 'RIVN', 'LCID', 'F', 'AAL', 'CCL',
  'COIN', 'ROKU', 'SNAP', 'PINS', 'UBER', 'LYFT', 'DASH', 'SQ', 'SHOP', 'ZM',
]

const MID_CAP_GROWTH = [
  'CELH', 'DUOL', 'TOST', 'CAVA', 'BROS', 'SHAK', 'WING', 'DKNG', 'PENN', 'RSI',
  'ONON', 'BIRK', 'HIMS', 'ASTS', 'RKLB', 'IONQ', 'RGTI', 'JOBY', 'LUNR', 'IREN',
  'ARM', 'CART', 'INST', 'CFLT', 'MDB', 'ESTC', 'GTLB', 'S', 'TMDX', 'GKOS',
  'RELY', 'XPEL', 'AEHR', 'SOUN', 'AI', 'BBAI', 'UPST', 'AFRM', 'OPEN', 'SOFI',
  'HOOD', 'LMND', 'ROOT', 'ACHR', 'EVTL', 'BLDE', 'LILM', 'SPCE', 'RDW', 'MNDY',
]

export type MarketSegment = 'sp500' | 'sp500_full' | 'nasdaq' | 'etfs' | 'volatile' | 'midcap' | 'all'

export function getMarketSymbols(segment: MarketSegment = 'all'): string[] {
  switch (segment) {
    case 'sp500':
      return SP500_FULL.slice(0, 100)
    case 'sp500_full':
      return SP500_FULL
    case 'nasdaq':
      return NASDAQ_EXTENDED
    case 'etfs':
      return POPULAR_ETFS
    case 'volatile':
      return VOLATILE_STOCKS
    case 'midcap':
      return MID_CAP_GROWTH
    case 'all':
    default:
      const allSymbols = new Set([
        ...SP500_FULL,
        ...NASDAQ_EXTENDED,
        ...POPULAR_ETFS,
        ...VOLATILE_STOCKS,
        ...MID_CAP_GROWTH,
      ])
      return Array.from(allSymbols)
  }
}

export function getSegmentLabel(segment: MarketSegment): string {
  switch (segment) {
    case 'sp500': return 'S&P 500 Top 100'
    case 'sp500_full': return 'Full S&P 500'
    case 'nasdaq': return 'NASDAQ 100'
    case 'etfs': return 'ETFs'
    case 'volatile': return 'Volatile'
    case 'midcap': return 'Mid-Cap Growth'
    case 'all': return 'Full Universe'
  }
}

export function getSegmentCount(segment: MarketSegment): number {
  return getMarketSymbols(segment).length
}

export function getRandomSymbols(count: number, segment: MarketSegment = 'all'): string[] {
  const symbols = getMarketSymbols(segment)
  const shuffled = [...symbols].sort(() => Math.random() - 0.5)
  return shuffled.slice(0, Math.min(count, symbols.length))
}

export function getTopLiquidSymbols(count: number = 50): string[] {
  const combined = [...new Set([...SP500_FULL.slice(0, 30), ...NASDAQ_EXTENDED.slice(0, 20)])]
  return combined.slice(0, count)
}
