/**
 * parse-performance-pdf.ts
 *
 * Parses Tradovate Performance PDF text (from pdf-parse) into structured data.
 * PDF text has NO whitespace between labels and values — everything is concatenated.
 *
 * Extracts:
 *   1. Summary stats (all trades, winning, losing)
 *   2. Individual trade log (symbol, qty, buy/sell price+time, duration, P&L)
 *   3. Converts trades into fills for the existing ingest pipeline
 */

export interface PerformanceSummary {
  grossPnl: number;
  totalPnl: number;
  tradeCount: number;
  contractCount: number;
  avgTradeTime: string;
  longestTradeTime: string;
  winRate: number;
  expectancy: number;
  fees: number;
  totalProfit: number;
  winningTrades: number;
  winningContracts: number;
  largestWin: number;
  avgWin: number;
  stdDevWin: number;
  totalLoss: number;
  losingTrades: number;
  losingContracts: number;
  largestLoss: number;
  avgLoss: number;
  stdDevLoss: number;
  maxRunUp: number;
  maxDrawdown: number;
  maxDrawdownFrom: string | null;
  maxDrawdownTo: string | null;
  breakEvenPercent: number;
  lossBreakdown: { tradePct: number; commissionPct: number } | null;
}

export interface ParsedTrade {
  symbol: string;
  qty: number;
  buyPrice: number;
  buyTime: string;
  duration: string;
  sellTime: string;
  sellPrice: number;
  pnl: number;
}

export interface PerformanceFill {
  timestamp_utc: string;
  contract: string;
  side: 'BUY' | 'SELL';
  qty: number;
  price: number;
  pnl?: number;
}

export interface PerformancePdfResult {
  summary: PerformanceSummary;
  trades: ParsedTrade[];
  fills: PerformanceFill[];
  tradeCount: number;
  dateRange: { start: string; end: string } | null;
}

/* ── Helpers ── */

function parseMoney(s: string): number {
  const cleaned = s.replace(/[$,\s]/g, '').replace(/\((.+)\)/, '-$1').trim();
  return parseFloat(cleaned) || 0;
}

/** Convert "MM/DD/YYYY HH:MM:SS" → ISO 8601 */
function tradovateToIso(dateStr: string): string {
  const match = dateStr.match(/(\d{2})\/(\d{2})\/(\d{4})\s+(\d{2}):(\d{2}):(\d{2})/);
  if (!match) return dateStr;
  const [, mo, dd, yyyy, hh, mm, ss] = match;
  return `${yyyy}-${mo}-${dd}T${hh}:${mm}:${ss}Z`;
}

/* ── Summary Parser ── */
// PDF text format: "Gross P/L$1,696.50\n# of Trades48\n"
// Labels and values are concatenated with NO whitespace

function parseSummary(text: string): PerformanceSummary {
  // Extract value immediately following a label (no space between)
  const getVal = (label: string): string => {
    const escaped = label.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    // Value is everything after the label until newline
    const re = new RegExp(escaped + '([^\\n]+)', 'i');
    const m = text.match(re);
    return m?.[1]?.trim() ?? '';
  };

  const getMoney = (label: string): number => parseMoney(getVal(label));
  const getNum = (label: string): number => parseFloat(getVal(label).replace(/,/g, '')) || 0;
  const getPct = (label: string): number => parseFloat(getVal(label).replace('%', '')) || 0;

  // Parse time strings like "5min 30sec" or "16min"
  const getTime = (label: string): string => {
    const v = getVal(label);
    // Already looks like a time string
    if (/\d+.*(?:min|sec|h)/.test(v)) return v;
    return v;
  };

  const tradeCount = getNum('# of Trades');
  const winCount = getNum('# of Winning Trades');
  const loseCount = getNum('# of Losing Trades');
  const beCount = tradeCount - winCount - loseCount;

  return {
    grossPnl: getMoney('Gross P/L'),
    totalPnl: getMoney('Total P/L'),
    tradeCount,
    contractCount: getNum('# of Contracts'),
    avgTradeTime: getTime('Avg. Trade Time'),
    longestTradeTime: getTime('Longest Trade Time'),
    winRate: getPct('% Profitable Trades'),
    expectancy: getMoney('Expectancy'),
    fees: getMoney('Trade Fees & Comm.'),

    totalProfit: getMoney('Total Profit'),
    winningTrades: winCount,
    winningContracts: getNum('# of Winning Contracts'),
    largestWin: getMoney('Largest Winning Trade'),
    avgWin: getMoney('Avg. Winning Trade'),
    stdDevWin: getMoney('Std. Dev. Winning Trade'),

    totalLoss: getMoney('Total Loss'),
    losingTrades: loseCount,
    losingContracts: getNum('# of Losing Contracts'),
    largestLoss: getMoney('Largest Losing Trade'),
    avgLoss: getMoney('Avg. Losing Trade'),
    stdDevLoss: getMoney('Std. Dev. Losing Trade'),

    maxRunUp: getMoney('Max Run-up'),
    maxDrawdown: getMoney('Max Drawdown'),
    maxDrawdownFrom: getVal('Max Drawdown, from') || null,
    maxDrawdownTo: getVal('Max Drawdown, to') || null,

    breakEvenPercent: tradeCount > 0 ? (beCount / tradeCount) * 100 : 0,

    lossBreakdown: (() => {
      const tradeMatch = text.match(/Trade:\s*([\d.]+)%/);
      const commMatch = text.match(/Commission:\s*([\d.]+)%/);
      if (tradeMatch && commMatch) {
        return { tradePct: parseFloat(tradeMatch[1]), commissionPct: parseFloat(commMatch[1]) };
      }
      return null;
    })(),
  };
}

/* ── Trade Log Parser ── */
// PDF text format (concatenated, no spaces):
//   MESH656821.2503/02/2026 14:33:0310sec03/02/2026 14:33:136822.00$18.75
// Some durations span lines:
//   MESH626718.7503/12/2026 15:16:3214min
//   26sec
//   03/12/2026 15:02:056719.25$5.00

function parseTrades(text: string): ParsedTrade[] {
  const trades: ParsedTrade[] = [];

  // Find the TRADES section — flexible: case-insensitive, any whitespace/newline after
  const tradesMatch = text.match(/TRADES[\s\r\n]/i);
  if (!tradesMatch || tradesMatch.index === undefined) {
    console.warn('[parseTrades] No TRADES header found in PDF text');
    return trades;
  }
  let tradeText = text.slice(tradesMatch.index);

  // Remove header rows — flexible spacing
  tradeText = tradeText.replace(/Symbol\s*Qty\s*Buy\s*Price\s*Buy\s*Time\s*Duration\s*Sell\s*Time\s*Sell\s*Price\s*P\s*&\s*L/gi, '');

  // Collapse multi-line entries. Pattern:
  //   MESH626718.7503/12/2026 15:16:3214min    ← line 1 (trade start + partial duration)
  //   26sec                                     ← line 2 (rest of duration)
  //   03/12/2026 15:02:056719.25$5.00           ← line 3 (sell side)
  // Join line2 (just digits+sec/min) back to line1, then join line3 (starts with date)
  tradeText = tradeText.replace(/(\d+min)\s*\n\s*(\d+sec)\s*\n?\s*(\d{2}\/)/g, '$1 $2$3');

  // Also handle single-line wrap where just sec is on next line
  tradeText = tradeText.replace(/(\d+min)\s*\n\s*(\d+sec)\s*(\d{2}\/)/g, '$1 $2$3');

  // Also handle duration on next line followed by sell date on same or next line
  tradeText = tradeText.replace(/(\d{2}:\d{2}:\d{2})\s*\n\s*(\d+(?:min|sec|h))/g, '$1$2');

  // Collapse remaining line breaks between sell-side data
  tradeText = tradeText.replace(/((?:min|sec))\s*\n\s*(\d{2}\/)/g, '$1$2');

  // Futures symbol: 2-4 letters + month code (FGHJKMNQUVXZ) + 1-2 year digits
  // Qty: 1-3 digits (1-999)
  // Price: 3-6 whole digits + .2 decimals (covers MES ~5800, NQ ~20000+)
  // Timestamp: MM/DD/YYYY HH:MM:SS
  // Duration: Xmin Xsec | Xmin | Xsec | XhXmin | Xh Xmin
  // Then sell timestamp, sell price, $P&L (possibly negative in parens or with minus)

  const lineRegex = /([A-Z]{2,4}[FGHJKMNQUVXZ]\d{1,2})(\d{1,3})(\d{3,6}\.\d{2})(\d{2}\/\d{2}\/\d{4}\s+\d{2}:\d{2}:\d{2})\s*(\d+(?:min|sec|h)(?:\s*\d+(?:min|sec))?)\s*(\d{2}\/\d{2}\/\d{4}\s+\d{2}:\d{2}:\d{2})(\d{3,6}\.\d{2})\$?([-\d.,()]+)/g;

  let match;
  while ((match = lineRegex.exec(tradeText)) !== null) {
    trades.push({
      symbol: match[1],
      qty: parseInt(match[2], 10),
      buyPrice: parseFloat(match[3]),
      buyTime: match[4],
      duration: match[5].trim(),
      sellTime: match[6],
      sellPrice: parseFloat(match[7]),
      pnl: parseMoney('$' + match[8]),
    });
  }

  if (trades.length === 0) {
    // Log a snippet around the TRADES section for debugging
    console.warn('[parseTrades] Regex matched 0 trades. Trade text snippet (first 800 chars):', tradeText.slice(0, 800));
  }

  return trades;
}

/* ── Convert Trades → Fills ── */

function tradesToFills(trades: ParsedTrade[]): PerformanceFill[] {
  const fills: PerformanceFill[] = [];

  for (const trade of trades) {
    // BUY fill (entry)
    fills.push({
      timestamp_utc: tradovateToIso(trade.buyTime),
      contract: trade.symbol,
      side: 'BUY',
      qty: trade.qty,
      price: trade.buyPrice,
    });

    // SELL fill (exit) — carries the P&L
    fills.push({
      timestamp_utc: tradovateToIso(trade.sellTime),
      contract: trade.symbol,
      side: 'SELL',
      qty: trade.qty,
      price: trade.sellPrice,
      pnl: trade.pnl,
    });
  }

  // Sort by timestamp
  fills.sort((a, b) => a.timestamp_utc.localeCompare(b.timestamp_utc));

  return fills;
}

/* ── Main Export ── */

export function parsePerformancePdf(pdfText: string): PerformancePdfResult {
  const summary = parseSummary(pdfText);
  const trades = parseTrades(pdfText);
  const fills = tradesToFills(trades);

  let dateRange: { start: string; end: string } | null = null;
  if (trades.length > 0) {
    const timestamps = trades.flatMap((t) => [
      tradovateToIso(t.buyTime),
      tradovateToIso(t.sellTime),
    ]);
    timestamps.sort();
    dateRange = {
      start: timestamps[0].slice(0, 10),
      end: timestamps[timestamps.length - 1].slice(0, 10),
    };
  }

  return {
    summary,
    trades,
    fills,
    tradeCount: trades.length,
    dateRange,
  };
}
