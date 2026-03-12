// ── Canonical protocol rule types ──────────────────────────────
export interface RuleParam {
  key: string;
  label: string;
  value: number | string | boolean;
  unit?: string;
  type: 'number' | 'string' | 'boolean' | 'percent';
  min?: number;
  max?: number;
}

export interface ProtocolRule {
  id: string;
  category: string;
  name: string;
  description: string;
  params: RuleParam[];
  enabled: boolean;
}

export interface ProtocolData {
  name: string;
  fileName: string;
  uploadedAt: string;
  rules: ProtocolRule[];
}

// ── Universal Protocol Canonicalizer ─────────────────────────
// Parses extracted PDF text into structured, toggleable rules.
// Designed to handle ANY structured trading protocol, not just
// The Paladin Protocol. Over-extracts by design — better to show
// 15 rules the user can disable than miss 5 they wanted enforced.

export function canonicalizeProtocol(rawText: string, fileName: string): ProtocolData {
  // Clean text: remove null bytes, normalize unicode quotes/dashes, collapse whitespace artifacts
  const text = rawText
    .replace(/\u0000/g, ' ')           // null bytes from PDF extraction
    .replace(/[\u2018\u2019\u02BC]/g, "'")  // smart quotes / modifier letter apostrophe
    .replace(/[\u2013\u2014]/g, '-')   // en-dash, em-dash
    .replace(/[\u201C\u201D]/g, '"')   // smart double quotes
    .replace(/\s+/g, ' ');             // collapse multiple whitespace

  const rules: ProtocolRule[] = [];
  const usedIds = new Set<string>();

  // Helper: generate unique rule ID
  const uid = (base: string): string => {
    if (!usedIds.has(base)) { usedIds.add(base); return base; }
    let i = 2;
    while (usedIds.has(`${base}-${i}`)) i++;
    const id = `${base}-${i}`;
    usedIds.add(id);
    return id;
  };

  // ─── 1. Max Drawdown / Risk Capital ───────────────────────
  // Paladin: lifebar, drawdown | Universal: risk capital, max loss limit, capital limit
  if (/lifebar|drawdown|max.*draw|risk\s*capital|max\s*loss\s*limit|capital\s*limit|risk\s*limit|maximum\s*loss|account\s*risk/i.test(text)) {
    const amountMatch = text.match(/\$([0-9,]+)\s*(?:lifebar|drawdown|end.?of.?day|max.*loss|risk\s*capital|capital\s*limit)/i)
      || text.match(/(?:lifebar|drawdown|max.*loss|risk\s*capital|capital\s*limit)[^$]*?\$([0-9,]+)/i);
    const pctMatch = text.match(/(\d+)%\s*(?:to\s*(\d+)%)?\s*(?:max\s*)?drawdown/i)
      || text.match(/(\d+)%\s*(?:max\s*)?(?:loss|risk)\s*(?:limit|capital)/i);
    rules.push({
      id: uid('lifebar'),
      category: 'Risk',
      name: 'Max Drawdown (Lifebar)',
      description: 'Maximum drawdown limit that defines your true risk capital',
      enabled: true,
      params: [
        { key: 'amount', label: 'Lifebar Amount', value: amountMatch ? parseInt(amountMatch[1].replace(/,/g, '')) : 2000, unit: '$', type: 'number', min: 100 },
        { key: 'type', label: 'Drawdown Type', value: /end.?of.?day|eod/i.test(text) ? 'EOD' : 'Trailing', type: 'string' },
      ],
    });
  }

  // ─── 2. Risk Tiers / Position Sizing ──────────────────────
  // Paladin: shield/sword/hammer | Universal: risk level, conservative/moderate/aggressive, position size
  if (/tier|shield|sword|hammer|armory|risk\s*level|position\s*siz|lot\s*siz|contract\s*siz|conservative|moderate|aggressive|risk\s*per\s*trade|risk\s*tier|scaling\s*level/i.test(text)) {
    // Try Paladin-specific names first, then generic tier names
    // Note: "standard" excluded from sword — it's too generic and catches "Professional standard: 5%"
    const shieldPct = text.match(/(?:shield|tier\s*1\b|conservative\b)[^%]*?(\d+)%/i);
    const swordPct = text.match(/(?:sword|tier\s*2\b|moderate\b)[^%]*?(\d+)%/i);
    const hammerPct = text.match(/(?:hammer|tier\s*3\b|aggressive\b)[^%]*?(\d+)%/i);

    // Detect naming convention
    const hasShield = /shield/i.test(text);
    const hasSword = /sword/i.test(text);
    const hasHammer = /hammer/i.test(text);

    const tier1Name = hasShield ? 'Tier 1: Shield' : 'Tier 1: Conservative';
    const tier2Name = hasSword ? 'Tier 2: Sword' : 'Tier 2: Standard';
    const tier3Name = hasHammer ? 'Tier 3: Hammer' : 'Tier 3: Aggressive';

    const tier1Desc = hasShield
      ? 'Conservative tier for new strategies or drawdown recovery'
      : 'Low-risk tier for cautious trading or recovery periods';
    const tier2Desc = hasSword
      ? 'Standard tier for proven consistent profitability'
      : 'Medium-risk tier for confident, consistent trading';
    const tier3Desc = hasHammer
      ? 'Aggressive tier reserved for A+ setups with strong edge data'
      : 'High-risk tier reserved for highest-conviction setups';

    rules.push({
      id: uid('tier-shield'),
      category: 'Position Sizing',
      name: tier1Name,
      description: tier1Desc,
      enabled: true,
      params: [
        { key: 'risk_pct', label: 'Lifebar Risk', value: shieldPct ? parseInt(shieldPct[1]) : 25, unit: '%', type: 'percent', min: 1, max: 100 },
        { key: 'max_losses', label: 'Max Consecutive Losses', value: 4, type: 'number', min: 1 },
      ],
    });
    rules.push({
      id: uid('tier-sword'),
      category: 'Position Sizing',
      name: tier2Name,
      description: tier2Desc,
      enabled: true,
      params: [
        { key: 'risk_pct', label: 'Lifebar Risk', value: swordPct ? parseInt(swordPct[1]) : 30, unit: '%', type: 'percent', min: 1, max: 100 },
        { key: 'max_losses', label: 'Max Consecutive Losses', value: 3, type: 'number', min: 1 },
      ],
    });
    rules.push({
      id: uid('tier-hammer'),
      category: 'Position Sizing',
      name: tier3Name,
      description: tier3Desc,
      enabled: true,
      params: [
        { key: 'risk_pct', label: 'Lifebar Risk', value: hammerPct ? parseInt(hammerPct[1]) : 40, unit: '%', type: 'percent', min: 1, max: 100 },
        { key: 'max_losses', label: 'Max Consecutive Losses', value: 2, type: 'number', min: 1 },
      ],
    });
  }

  // ─── 3. Daily Loss Limit ──────────────────────────────────
  // Paladin: one-shot, wounded | Universal: max daily loss, daily loss limit, stop after loss
  if (/one.?shot|wounded|stop\s*trading.*rest\s*of\s*the\s*day|max\s*daily\s*loss|daily\s*loss\s*limit|loss\s*limit\s*per\s*day|stop\s*after.*loss|daily\s*max|max\s*losses?\s*per\s*day|daily\s*stop/i.test(text)) {
    const maxLossMatch = text.match(/(?:max(?:imum)?|no\s*more\s*than)\s*(\d+)\s*(?:full\s*)?loss/i);
    rules.push({
      id: uid('one-shot'),
      category: 'Session Rules',
      name: 'Daily Loss Limit',
      description: 'Stop trading for the day after taking maximum allowed losses',
      enabled: true,
      params: [
        { key: 'max_full_losses', label: 'Max Full Losses Per Day', value: maxLossMatch ? parseInt(maxLossMatch[1]) : 1, type: 'number', min: 1, max: 5 },
      ],
    });
  }

  // ─── 4. Protect Profits ───────────────────────────────────
  // Paladin: protect the green | Universal: lock in profits, protect gains, session stop at breakeven
  if (/protect\s*the\s*green|green\s*day|break.?even.*end.*session|lock\s*in\s*profits?|don.?t\s*give\s*back|protect\s*gains|trailing\s*day\s*stop|session\s*stop.*breakeven|never\s*let.*green.*turn\s*red/i.test(text)) {
    rules.push({
      id: uid('protect-green'),
      category: 'Session Rules',
      name: 'Protect the Green',
      description: 'End session immediately if P&L retraces to breakeven after being green',
      enabled: true,
      params: [
        { key: 'stop_at_breakeven', label: 'Stop at Breakeven', value: true, type: 'boolean' },
      ],
    });
  }

  // ─── 5. Volatility / Size Adjustment ──────────────────────
  // Paladin: volatility filter, reduce size | Universal: adjust size, scale down, high volatility
  if (/volatility.*filter|reduce\s*size|wider\s*stop|adjust\s*size|scale\s*down|high\s*volatility|volatile\s*session|widen\s*stop|reduce\s*position|size\s*adjustment|vol\s*filter/i.test(text)) {
    const reductionMatch = text.match(/(?:reduce.*?|by\s*|cut\s*(?:by\s*)?)~?(\d+)%/i);
    rules.push({
      id: uid('volatility-filter'),
      category: 'Session Rules',
      name: 'Session Volatility Filter',
      description: 'Reduce position size when stop distance expands during high-volatility sessions',
      enabled: true,
      params: [
        { key: 'size_reduction', label: 'Size Reduction', value: reductionMatch ? parseInt(reductionMatch[1]) : 50, unit: '%', type: 'percent', min: 10, max: 90 },
      ],
    });
  }

  // ─── 6. End of Day / Time Stop ────────────────────────────
  // Paladin: ghost equity | Universal: close by, market close, EOD rule, flatten before, no overnight
  if (/ghost\s*equity|close.*positions.*before.*bell|time\s*stop|end\s*of\s*day\s*rule|close\s*by|market\s*close|eod\b|close\s*before.*close|no\s*overnight|flatten\s*before|time.?based\s*exit|session\s*end/i.test(text)) {
    const minutesMatch = text.match(/(\d+)\s*minutes?\s*before/i);
    const timeMatch = text.match(/(?:close|flatten|exit)\s*(?:by|before|at)\s*(\d{1,2}[:.]\d{2})\s*(am|pm)?/i);
    rules.push({
      id: uid('ghost-equity'),
      category: 'Session Rules',
      name: 'End-of-Day Defense',
      description: 'Close all positions before the daily closing bell to avoid floating drawdown at settlement',
      enabled: true,
      params: [
        { key: 'minutes_before_close', label: 'Minutes Before Close', value: minutesMatch ? parseInt(minutesMatch[1]) : 15, unit: 'min', type: 'number', min: 1, max: 60 },
        { key: 'no_carry_floating', label: 'No Floating DD at Close', value: true, type: 'boolean' },
        ...(timeMatch ? [{ key: 'close_time', label: 'Close By', value: timeMatch[1] + (timeMatch[2] || ''), type: 'string' as const }] : []),
      ],
    });
  }

  // ─── 7. Profit Allocation ─────────────────────────────────
  // Paladin: treasury, payout | Universal: profit split, money management, reinvest
  if (/treasury|profit\s*allocation|payout|withdraw|profit\s*split|money\s*management|reinvest|withdrawal\s*rule|profit\s*distribution|payout\s*split|profit\s*bucket/i.test(text)) {
    const growthMatch = text.match(/(\d+)%\s*(?:active\s*)?(?:account\s*growth|reinvest|left\s*in\s*account|growth)/i);
    const armoryMatch = text.match(/(\d+)%\s*(?:armory|business|operat|software|tools|overhead)/i);
    const taxMatch = text.match(/(\d+)%\s*(?:(?:the\s*)?crown|tax|taxes|government|irs)/i);
    const wealthMatch = text.match(/(\d+)%\s*(?:sovereign|wealth|invest|retirement|savings|etf|long.?term)/i);
    rules.push({
      id: uid('profit-allocation'),
      category: 'Capital',
      name: 'Profit Allocation',
      description: 'Split payouts into buckets for sustainability and growth',
      enabled: true,
      params: [
        { key: 'account_growth', label: 'Account Growth', value: growthMatch ? parseInt(growthMatch[1]) : 25, unit: '%', type: 'percent', min: 0, max: 100 },
        { key: 'armory_fund', label: 'Business/Armory Fund', value: armoryMatch ? parseInt(armoryMatch[1]) : 20, unit: '%', type: 'percent', min: 0, max: 100 },
        { key: 'taxes', label: 'Taxes', value: taxMatch ? parseInt(taxMatch[1]) : 30, unit: '%', type: 'percent', min: 0, max: 100 },
        { key: 'wealth', label: 'Long-term Wealth', value: wealthMatch ? parseInt(wealthMatch[1]) : 25, unit: '%', type: 'percent', min: 0, max: 100 },
      ],
    });
  }

  // ─── 8. Yield / Expectancy Model ──────────────────────────
  // Paladin: expectancy, win rate | Universal: risk reward, expected value, edge, R-multiple
  if (/expectancy|win\s*rate|R\s*per|yield|risk\s*reward|expected\s*value|edge|win\s*ratio|avg\s*win|avg\s*loss|trades?\s*per\s*week|expected\s*return|R.?multiple/i.test(text)) {
    const wrMatch = text.match(/win\s*(?:rate|ratio)[:\s]*(\d+)%/i);
    const avgWinMatch = text.match(/(?:average|avg)\s*win[:\s]*\+?([\d.]+)\s*R/i);
    const avgLossMatch = text.match(/(?:average|avg)\s*loss[:\s]*-?([\d.]+)\s*R/i);
    const tradesMatch = text.match(/(\d+)\s*trades?\s*per\s*week/i);
    const rrMatch = text.match(/(?:risk\s*reward|r:r|rr)[:\s]*([\d.]+)\s*(?::|to)\s*([\d.]+)/i);
    rules.push({
      id: uid('yield-model'),
      category: 'Capital',
      name: 'Expected Yield Model',
      description: 'Edge assumptions driving weekly yield projections',
      enabled: true,
      params: [
        { key: 'win_rate', label: 'Win Rate', value: wrMatch ? parseInt(wrMatch[1]) : 80, unit: '%', type: 'percent', min: 1, max: 100 },
        { key: 'avg_win_r', label: 'Avg Win (R)', value: avgWinMatch ? parseFloat(avgWinMatch[1]) : (rrMatch ? parseFloat(rrMatch[2]) / parseFloat(rrMatch[1]) : 0.5), type: 'number', min: 0.1 },
        { key: 'avg_loss_r', label: 'Avg Loss (R)', value: avgLossMatch ? parseFloat(avgLossMatch[1]) : 1.0, type: 'number', min: 0.1 },
        { key: 'trades_per_week', label: 'Trades / Week', value: tradesMatch ? parseInt(tradesMatch[1]) : 10, type: 'number', min: 1 },
      ],
    });
  }

  // ─── 9. Generic Numeric Constraints (catch-all) ───────────
  // Catches any "max/limit/no more than [N] [trading unit]" patterns
  const numericPatterns = [
    // "max X trades per day/session"
    { re: /(?:max(?:imum)?|no\s*more\s*than|limit(?:ed)?\s*to)\s+(\d+)\s+trades?\s+per\s+(day|session|week)/gi, unit: 'trades' },
    // "max X contracts/lots"
    { re: /(?:max(?:imum)?|no\s*more\s*than|limit(?:ed)?\s*to)\s+(\d+)\s+(contracts?|lots?)/gi, unit: 'contracts' },
    // "risk must not exceed X%"
    { re: /risk\s*(?:must\s*not|should\s*not|cannot|can.?t)\s*exceed\s+(\d+)%/gi, unit: '%' },
    // "max X ticks/points stop"
    { re: /(?:max(?:imum)?|no\s*more\s*than)\s+(\d+)\s+(ticks?|points?)\s*(?:stop|loss|risk)/gi, unit: 'ticks' },
  ];

  for (const { re, unit } of numericPatterns) {
    let m;
    while ((m = re.exec(text)) !== null) {
      const val = parseInt(m[1]);
      const period = m[2] || '';
      const ruleId = uid(`max-${unit}-${period}`.replace(/\s+/g, '-').toLowerCase());
      // Avoid duplicating rules we already caught in patterns 1-8
      const desc = `${unit === '%' ? 'Risk' : unit.charAt(0).toUpperCase() + unit.slice(1)} constraint: max ${val}${unit === '%' ? '%' : ' ' + period}`;
      if (!rules.some(r => r.params.some(p => p.value === val && p.unit === unit))) {
        rules.push({
          id: ruleId,
          category: 'Constraints',
          name: `Max ${val} ${unit}${period ? ' per ' + period : ''}`,
          description: desc,
          enabled: true,
          params: [
            { key: 'max', label: 'Maximum', value: val, unit, type: 'number', min: 1 },
            ...(period ? [{ key: 'period', label: 'Period', value: period, type: 'string' as const }] : []),
          ],
        });
      }
    }
  }

  // ─── 10. Generic Time-Based Rules (catch-all) ─────────────
  // Catches "only trade between X and Y", "no trading before/after X"
  const timePatterns = [
    // "only trade between HH:MM and HH:MM"
    { re: /(?:only|must)\s*trade\s*(?:between|from)\s*(\d{1,2}[:.]\d{2})\s*(am|pm)?\s*(?:and|to|-)\s*(\d{1,2}[:.]\d{2})\s*(am|pm)?/gi, type: 'window' },
    // "no trading before/after HH:MM"
    { re: /no\s*trading\s*(before|after)\s*(\d{1,2}[:.]\d{2})\s*(am|pm)?/gi, type: 'cutoff' },
    // "trading hours: HH:MM - HH:MM"
    { re: /trading\s*(?:hours|window|session)[:\s]*(\d{1,2}[:.]\d{2})\s*(am|pm)?\s*[-–to]+\s*(\d{1,2}[:.]\d{2})\s*(am|pm)?/gi, type: 'window' },
  ];

  for (const { re, type } of timePatterns) {
    let m;
    while ((m = re.exec(text)) !== null) {
      if (type === 'window') {
        const start = m[1].replace('.', ':') + (m[2] || '');
        const end = m[3].replace('.', ':') + (m[4] || '');
        rules.push({
          id: uid('session-window-custom'),
          category: 'Session Rules',
          name: `Trading Window: ${start} – ${end}`,
          description: `Only trade during the specified time window`,
          enabled: true,
          params: [
            { key: 'start', label: 'Session Start', value: start, type: 'string' },
            { key: 'end', label: 'Session End', value: end, type: 'string' },
          ],
        });
      } else if (type === 'cutoff') {
        const direction = m[1].toLowerCase();
        const time = m[2].replace('.', ':') + (m[3] || '');
        rules.push({
          id: uid(`no-trading-${direction}`),
          category: 'Session Rules',
          name: `No Trading ${direction.charAt(0).toUpperCase() + direction.slice(1)} ${time}`,
          description: `Do not trade ${direction} ${time}`,
          enabled: true,
          params: [
            { key: 'cutoff_time', label: 'Cutoff Time', value: time, type: 'string' },
            { key: 'direction', label: 'Direction', value: direction, type: 'string' },
          ],
        });
      }
    }
  }

  // ─── Fallback: generic rule if nothing matched ────────────
  if (rules.length === 0) {
    rules.push({
      id: 'generic',
      category: 'General',
      name: 'Trading Protocol',
      description: 'Protocol uploaded — add rules manually or upload a more structured document',
      enabled: true,
      params: [],
    });
  }

  return {
    name: fileName.replace(/\.pdf$/i, '').replace(/[-_]/g, ' '),
    fileName,
    uploadedAt: new Date().toISOString(),
    rules,
  };
}
