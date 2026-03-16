/**
 * parse-performance-csv.ts
 *
 * Parses Tradovate Performance CSV exports into structured fills.
 *
 * CSV headers:
 *   symbol, _priceFormat, _priceFormatType, _tickSize,
 *   buyFillId, sellFillId, qty, buyPrice, sellPrice,
 *   pnl, boughtTimestamp, soldTimestamp, duration
 *
 * Each row is a completed trade — we emit 2 fills (BUY + SELL) per row.
 * Uses buyFillId/sellFillId as natural unique identifiers for dedup.
 */

export interface PerformanceCsvRow {
  symbol: string;
  buyFillId: string;
  sellFillId: string;
  qty: number;
  buyPrice: number;
  sellPrice: number;
  pnl: number;
  boughtTimestamp: string;
  soldTimestamp: string;
  duration: string;
}

export interface PerformanceCsvFill {
  buy_fill_id: string;  // Tradovate buyFillId (for composite key)
  sell_fill_id: string;  // Tradovate sellFillId (for composite key)
  timestamp_utc: string;
  contract: string;
  side: 'BUY' | 'SELL';
  qty: number;
  price: number;
  pnl?: number;
}

export interface PerformanceCsvResult {
  trades: PerformanceCsvRow[];
  fills: PerformanceCsvFill[];
  tradeCount: number;
  dateRange: { start: string; end: string } | null;
  summary: {
    grossPnl: number;
    totalTrades: number;
    winningTrades: number;
    losingTrades: number;
    winRate: number;
    contracts: string[];
  };
}

/* ── Helpers ── */

/** Parse Tradovate money format: "$18.75" or "$(37.50)" → number */
function parseMoney(s: string): number {
  const cleaned = s.replace(/[$,\s]/g, '').replace(/\((.+)\)/, '-$1').trim();
  return parseFloat(cleaned) || 0;
}

/** Convert "MM/DD/YYYY HH:MM:SS" → ISO 8601 UTC */
function tradovateToIso(dateStr: string): string {
  const match = dateStr.trim().match(/(\d{2})\/(\d{2})\/(\d{4})\s+(\d{2}):(\d{2}):(\d{2})/);
  if (!match) return dateStr;
  const [, mo, dd, yyyy, hh, mm, ss] = match;
  return `${yyyy}-${mo}-${dd}T${hh}:${mm}:${ss}Z`;
}

/** Extract instrument root from contract (e.g., "MESH6" → "MES") */
export function extractRoot(contract: string): string {
  const match = contract.match(/^([A-Z]{2,4})[FGHJKMNQUVXZ]\d{1,2}$/);
  return match ? match[1] : contract;
}

/* ── Main Parser ── */

export function parsePerformanceCsv(csvText: string): PerformanceCsvResult {
  const lines = csvText.trim().split('\n');
  if (lines.length < 2) {
    return { trades: [], fills: [], tradeCount: 0, dateRange: null, summary: { grossPnl: 0, totalTrades: 0, winningTrades: 0, losingTrades: 0, winRate: 0, contracts: [] } };
  }

  // Parse header to find column indices (flexible ordering)
  const header = lines[0].split(',').map((h) => h.trim());
  const col = (name: string): number => {
    const idx = header.indexOf(name);
    if (idx === -1) throw new Error(`Missing required column: "${name}"`);
    return idx;
  };

  const iSymbol = col('symbol');
  const iBuyFillId = col('buyFillId');
  const iSellFillId = col('sellFillId');
  const iQty = col('qty');
  const iBuyPrice = col('buyPrice');
  const iSellPrice = col('sellPrice');
  const iPnl = col('pnl');
  const iBoughtTs = col('boughtTimestamp');
  const iSoldTs = col('soldTimestamp');
  const iDuration = col('duration');

  const trades: PerformanceCsvRow[] = [];
  const fills: PerformanceCsvFill[] = [];

  for (let i = 1; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) continue;

    // Handle commas inside money values like "$(1,234.50)"
    const cols = splitCsvLine(line);
    if (cols.length < header.length) continue;

    const symbol = cols[iSymbol].trim();
    const buyFillId = cols[iBuyFillId].trim();
    const sellFillId = cols[iSellFillId].trim();
    const qty = parseInt(cols[iQty].trim(), 10);
    const buyPrice = parseFloat(cols[iBuyPrice].trim());
    const sellPrice = parseFloat(cols[iSellPrice].trim());
    const pnl = parseMoney(cols[iPnl].trim());
    const boughtTimestamp = cols[iBoughtTs].trim();
    const soldTimestamp = cols[iSoldTs].trim();
    const duration = cols[iDuration].trim();

    // Validate
    if (!symbol || !buyFillId || !sellFillId || !qty || qty <= 0) continue;
    if (isNaN(buyPrice) || buyPrice <= 0 || isNaN(sellPrice) || sellPrice <= 0) continue;

    trades.push({
      symbol,
      buyFillId,
      sellFillId,
      qty,
      buyPrice,
      sellPrice,
      pnl,
      boughtTimestamp,
      soldTimestamp,
      duration,
    });

    // Each row = 1 trade pairing = exactly 2 fills (BUY + SELL).
    // NO dedup here — partial fills share the same buyFillId or sellFillId
    // across multiple rows, but each row is a unique trade pairing.
    // The buyFillId+sellFillId combo is the natural unique key per row.

    // BUY fill
    fills.push({
      buy_fill_id: buyFillId,
      sell_fill_id: sellFillId,
      timestamp_utc: tradovateToIso(boughtTimestamp),
      contract: symbol,
      side: 'BUY',
      qty,
      price: buyPrice,
    });

    // SELL fill
    fills.push({
      buy_fill_id: buyFillId,
      sell_fill_id: sellFillId,
      timestamp_utc: tradovateToIso(soldTimestamp),
      contract: symbol,
      side: 'SELL',
      qty,
      price: sellPrice,
      pnl,
    });
  }

  // Sort fills by timestamp
  fills.sort((a, b) => a.timestamp_utc.localeCompare(b.timestamp_utc));

  // Date range
  let dateRange: { start: string; end: string } | null = null;
  if (fills.length > 0) {
    const timestamps = fills.map((f) => f.timestamp_utc).sort();
    dateRange = {
      start: timestamps[0].slice(0, 10),
      end: timestamps[timestamps.length - 1].slice(0, 10),
    };
  }

  // Summary
  const grossPnl = trades.reduce((sum, t) => sum + t.pnl, 0);
  const winningTrades = trades.filter((t) => t.pnl > 0).length;
  const losingTrades = trades.filter((t) => t.pnl < 0).length;
  const contracts = [...new Set(trades.map((t) => t.symbol))];

  return {
    trades,
    fills,
    tradeCount: trades.length,
    dateRange,
    summary: {
      grossPnl,
      totalTrades: trades.length,
      winningTrades,
      losingTrades,
      winRate: trades.length > 0 ? Math.round((winningTrades / trades.length) * 100) : 0,
      contracts,
    },
  };
}

/**
 * Split a CSV line respecting quoted fields and $() money values.
 * Handles: $18.75 / $(37.50) / "$(1,234.50)" / regular fields
 */
function splitCsvLine(line: string): string[] {
  const cols: string[] = [];
  let current = '';
  let inQuote = false;
  let inParen = false;

  for (let i = 0; i < line.length; i++) {
    const ch = line[i];

    if (ch === '"' && !inParen) {
      inQuote = !inQuote;
      continue;
    }

    if (ch === '(' && !inQuote) {
      inParen = true;
      current += ch;
      continue;
    }

    if (ch === ')' && inParen) {
      inParen = false;
      current += ch;
      continue;
    }

    if (ch === ',' && !inQuote && !inParen) {
      cols.push(current);
      current = '';
      continue;
    }

    current += ch;
  }
  cols.push(current);

  return cols;
}
