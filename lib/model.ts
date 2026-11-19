// Token Radar model radar-3: one snapshot in, one ranked board out.
//
// The board covers every slug in the snapshot's watchlist (the floor, never a
// ceiling) and every other rankable pre-token protocol in the snapshot, however
// large or small its TVL: the radar exists to find launches early, so a large
// pre-token protocol the watchlist leaves out for its size alone is still a
// subject, and a small one with fast growth can outrank a large stagnant one.
// Wrapped, staked and bridged products are never rankable (see isRankable):
// their token already trades in another form. Live-token protocols are
// kept apart and shown with the market's own value, never mixed into the
// pre-token ranking.
//
// A protocol is pre-token when its record carries no token at all: no market
// cap, no CoinGecko id, no symbol. Say "records no token", never "has no
// token": DefiLlama's record is not proof, and a listed protocol may still
// have a token its record does not carry.
//
// Implied value follows only from the snapshot's own figures, in one function
// that scores every protocol alike. No name is ever special-cased.
//
//   base         = tvl_usd x 0.30
//   size         = (100,000,000 / tvl_usd) ^ 0.25
//                  (a launch's value grows with TVL but with diminishing
//                  returns: doubling TVL does not double the value of a
//                  launch, because the largest protocols are the most mature
//                  and the most crowded, so a mid-size protocol can outrank a
//                  giant on the strength of its growth and seasoning)
//   growth       = clamp(change_7d, -60, 150) per cent
//   growthMult   = 1 + (growth / 100) x 1.0
//   maturity     = 0.50 + 0.50 x sqrt(min(age_days, 1095) / 1095)
//                  (age unknown: 365 days, maturity 0.79)
//   chainMult    = 1 + 0.03 x min(chains - 1, 5)        (1.00 to 1.15)
//   implied      = max(1, round(base x size x growthMult x maturity x chainMult))
//
// Why these shapes: growth is the strongest signal in a 7-day window, so it
// can move the multiple more than twofold; maturity rises with age but with
// diminishing returns, because a protocol that has run two years with no token
// is more seasoned than one listed last month, not twice as valuable; chain
// breadth is a small reach bonus, capped, because a protocol live on five
// chains reaches more farmers than one on a single chain. Size dampening
// keeps the board from being a TVL table: on this snapshot the implied/TVL
// multiple runs from about 0.11 (huge, shrinking, young, single-chain) to
// just over 1.0 (small, fast-growing, seasoned, multi-chain), and the ranking
// is decided by growth and seasoning among protocols of similar size.

export interface SnapshotProtocol {
  slug: string;
  name: string;
  category: string | null;
  chains: string[];
  tvl_usd: number;
  change_7d: number | null;
  mcap_usd: number | null;
  listed_at: string | null;
  gecko_id: string | null;
  symbol: string | null;
}

export interface Snapshot {
  as_of: string;
  source: string;
  floor_usd: number;
  protocols: SnapshotProtocol[];
  watchlist: string[];
}

export interface ModelConstants {
  base_multiple: number;
  growth_weight: number;
  growth_floor: number;
  growth_cap: number;
  maturity_floor: number;
  maturity_range: number;
  maturity_days: number;
  unknown_age_days: number;
  chain_step: number;
  chain_max_chains: number;
  size_reference_usd: number;
  size_exponent: number;
}

export const MODEL: ModelConstants = {
  base_multiple: 0.3,
  growth_weight: 1.0,
  growth_floor: -60,
  growth_cap: 150,
  maturity_floor: 0.5,
  maturity_range: 0.5,
  maturity_days: 1095,
  unknown_age_days: 365,
  chain_step: 0.03,
  chain_max_chains: 5,
  size_reference_usd: 100_000_000,
  size_exponent: 0.25,
};

export const MODEL_VERSION = 'radar-3';
export const LIVE_ROWS = 24;

export interface FarmStep {
  text: string;
  cost: string;
  time: string;
}

export interface BoardRow {
  rank: number;
  slug: string;
  name: string;
  category: string | null;
  chains: string[];
  tvl_usd: number;
  change_7d: number | null;
  mcap_usd: number | null;
  listed_at: string | null;
  gecko_id: string | null;
  symbol: string | null;
  token_status: 'pre-token';
  age_days: number | null;
  implied_value_usd: number;
  watchlist: boolean;
  model: {
    base_multiple: number;
    growth_pct: number;
    growth_multiplier: number;
    maturity_multiplier: number;
    chain_multiplier: number;
    size_multiplier: number;
    implied_multiple: number;
    age_days: number | null;
  };
  farm_steps: string[];
}

export interface RadarRow {
  rank: number;
  slug: string;
  name: string;
  category: string | null;
  chains: string[];
  chain_count: number;
  tvl_usd: number;
  change_7d: number | null;
  mcap_usd: number | null;
  listed_at: string | null;
  age_days: number | null;
  implied_value_usd: number;
  implied_multiple: number;
  growth_multiplier: number;
  maturity_multiplier: number;
  chain_multiplier: number;
  size_multiplier: number;
  watchlist: boolean;
  verdict: 'FARM' | 'MARGINAL' | 'SKIP';
  farm_value_usd: number;
}

/** Every protocol in the snapshot, accounted for in exactly one bucket. */
export interface Disposition {
  total: number;
  ranked: number;
  has_token: number;
  bridge: number;
  liquid_staking: number;
  exchange_custody: number;
  versioned: number;
  wrapped: number;
  other: number;
}

export interface LiveRow {
  slug: string;
  name: string;
  category: string | null;
  chains: string[];
  tvl_usd: number;
  mcap_usd: number | null;
  change_7d: number | null;
}

export interface RadarData {
  as_of: string;
  source: string;
  floor_usd: number;
  model: ModelConstants;
  model_version: string;
  watchlist_size: number;
  board_size: number;
  early_size: number;
  live_size: number;
  top_implied_usd: number;
  median_implied_usd: number;
  implied_total_usd: number;
  implied_top10_low_usd: number;
  multiple_min: number;
  multiple_max: number;
  disposition: Disposition;
  verdict_counts: { farm: number; marginal: number; skip: number };
  best_farm_value_usd: number;
  rows: RadarRow[];
  live: LiveRow[];
}

export class SnapshotError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'SnapshotError';
  }
}

const DAY_MS = 86_400_000;

function finite(value: unknown, fallback: number): number {
  return typeof value === 'number' && Number.isFinite(value) ? value : fallback;
}

export function ageDays(asOf: string, listedAt: string | null): number | null {
  if (listedAt === null) return null;
  const a = Date.parse(`${asOf}T00:00:00Z`);
  const b = Date.parse(`${listedAt}T00:00:00Z`);
  if (!Number.isFinite(a) || !Number.isFinite(b)) return null;
  return Math.max(0, Math.floor((a - b) / DAY_MS));
}

export function impliedValue(
  protocol: SnapshotProtocol,
  asOf: string,
  model: ModelConstants,
): { implied: number; growthPct: number; growthMult: number; maturityMult: number; chainMult: number; sizeMult: number; multiple: number; age: number | null } {
  const age = ageDays(asOf, protocol.listed_at);
  const rawGrowth = finite(protocol.change_7d, 0);
  const growthPct = Math.min(model.growth_cap, Math.max(model.growth_floor, rawGrowth));
  const growthMult = 1 + (growthPct / 100) * model.growth_weight;
  const ageForModel = age ?? model.unknown_age_days;
  const maturityMult =
    model.maturity_floor +
    model.maturity_range * Math.sqrt(Math.min(Math.max(ageForModel, 0), model.maturity_days) / model.maturity_days);
  const chainCount = Math.max(1, protocol.chains.length);
  const chainMult = 1 + model.chain_step * Math.min(chainCount - 1, model.chain_max_chains);
  const sizeMult = Math.pow(model.size_reference_usd / Math.max(1, protocol.tvl_usd), model.size_exponent);
  const base = protocol.tvl_usd * model.base_multiple;
  const implied = Math.max(1, Math.round(base * sizeMult * growthMult * maturityMult * chainMult));
  return { implied, growthPct, growthMult, maturityMult, chainMult, sizeMult, multiple: implied / Math.max(1, protocol.tvl_usd), age };
}

const VERSIONED = /\s(V\d+(\.\d+)?|v\d+(\.\d+)?|\d+\.\d+)$/;

/** Categories the watchlist rule treats as a wrapped, staked or bridged product of a token that already trades. */
const EXCLUDED_CATEGORIES = new Set(['Bridge', 'Canonical Bridge', 'Liquid Staking', 'Liquid Restaking', 'Restaked BTC', 'CEX']);
const WRAPPED_WORD = /\b(wrapped|staked|staking)\b/i;
const EXCHANGE_PREFIX = /^(Binance|Coinbase|Bybit|Kraken|Bitget|OKX|Bitfinex|Gemini)\b/;

export function isPreToken(p: SnapshotProtocol): boolean {
  return p.mcap_usd === null && p.gecko_id === null && p.symbol === null;
}

/**
 * Whether a protocol is one the board may rank: pre-token, and not a
 * wrapped, staked or bridged product of a token that already trades, by the
 * same rule the watchlist uses, applied with only the snapshot's own fields
 * (category, name). A bridge, a liquid-staking receipt or a staked-ETH
 * product is not a protocol still waiting on a launch of its own, however
 * large its TVL, so it never takes a pre-token rank.
 */
export function isRankable(p: SnapshotProtocol): boolean {
  if (!isPreToken(p)) return false;
  if (p.category !== null && EXCLUDED_CATEGORIES.has(p.category)) return false;
  if (VERSIONED.test(p.name)) return false;
  if (WRAPPED_WORD.test(p.name)) return false;
  if (EXCHANGE_PREFIX.test(p.name)) return false;
  return true;
}

function bySlug(protocols: SnapshotProtocol[]): Map<string, SnapshotProtocol> {
  return new Map(protocols.map((p) => [p.slug, p]));
}

export function buildBoard(snapshot: Snapshot, model: ModelConstants = MODEL): BoardRow[] {
  const index = bySlug(snapshot.protocols);
  const watch = new Set(snapshot.watchlist);
  const chosen = new Map<string, SnapshotProtocol>();
  for (const slug of snapshot.watchlist) {
    const p = index.get(slug);
    if (p !== undefined) chosen.set(slug, p);
  }
  // Every other rankable pre-token protocol, at any TVL: the early radar is
  // the whole pre-token universe, not a top-160 cut by TVL.
  const rest = snapshot.protocols
    .filter((p) => !chosen.has(p.slug) && isRankable(p))
    .sort((a, b) => b.tvl_usd - a.tvl_usd || (a.slug < b.slug ? -1 : a.slug > b.slug ? 1 : 0));
  for (const p of rest) chosen.set(p.slug, p);

  const scored = [...chosen.values()].map((p) => {
    const v = impliedValue(p, snapshot.as_of, model);
    return { p, ...v };
  });
  scored.sort((a, b) => b.implied - a.implied || (a.p.slug < b.p.slug ? -1 : a.p.slug > b.p.slug ? 1 : 0));
  return scored.map((s, i) => ({
    rank: i + 1,
    slug: s.p.slug,
    name: s.p.name,
    category: s.p.category,
    chains: s.p.chains,
    tvl_usd: s.p.tvl_usd,
    change_7d: s.p.change_7d,
    mcap_usd: s.p.mcap_usd,
    listed_at: s.p.listed_at,
    gecko_id: s.p.gecko_id,
    symbol: s.p.symbol,
    token_status: 'pre-token',
    age_days: s.age,
    implied_value_usd: s.implied,
    watchlist: watch.has(s.p.slug),
    model: {
      base_multiple: model.base_multiple,
      growth_pct: s.growthPct,
      growth_multiplier: round4(s.growthMult),
      maturity_multiplier: round4(s.maturityMult),
      chain_multiplier: round4(s.chainMult),
      size_multiplier: round4(s.sizeMult),
      implied_multiple: round4(s.multiple),
      age_days: s.age,
    },
    farm_steps: farmSteps(s.p, s.age).map(stepText),
  }));
}

const round4 = (n: number): number => Math.round(n * 1e4) / 1e4;

export function stepText(step: FarmStep): string {
  let s = `${step.text} Cost: ${step.cost}. Time: ${step.time}.`;
  if (s.length > 600) s = `${s.slice(0, 596)}...`;
  if (s.length < 20) s = `${s} Hold the position and check the protocol's own page.`;
  return s;
}

function chainOf(p: SnapshotProtocol): string {
  return p.chains.length > 0 ? p.chains[0]! : 'its main chain';
}

function capitalFor(p: SnapshotProtocol): number {
  const base =
    p.tvl_usd >= 5_000_000_000 ? 250 : p.tvl_usd >= 1_000_000_000 ? 150 : p.tvl_usd >= 100_000_000 ? 100 : 50;
  // TVL falling hard: the farm starts at half size, because the protocol is
  // losing deposits while you would be adding them.
  if (p.change_7d !== null && p.change_7d < -10) return Math.max(25, Math.round(base / 2));
  return base;
}

/** The note a falling protocol's plan carries, or '' when TVL is not falling hard. */
function sizingNote(p: SnapshotProtocol): string {
  if (p.change_7d === null || p.change_7d >= -10) return '';
  return ` TVL fell ${Math.abs(p.change_7d).toFixed(1)}% in the last seven days, so this plan starts at half the usual size.`;
}

/**
 * A row's farm verdict, from the model's own outputs only. FARM is a strong
 * implied multiple on a growing protocol; MARGINAL is a decent multiple or
 * fast growth; the rest is SKIP. The rule never names a protocol.
 */
export function farmVerdict(impliedMultiple: number, change7d: number | null): 'FARM' | 'MARGINAL' | 'SKIP' {
  if (impliedMultiple >= 0.5 && change7d !== null && change7d > 0) return 'FARM';
  if (impliedMultiple >= 0.3 || (change7d !== null && change7d > 5)) return 'MARGINAL';
  return 'SKIP';
}

/**
 * The dollar value a farm plan is chasing: the plan's own capital times the
 * row's implied multiple. A $50 plan on a 1.03x protocol chases $51.50 of
 * launch value; a $250 plan on a 0.11x protocol chases $27.50. It is the
 * value the stake is tied to, not a promised payout.
 */
export function farmValueUsd(p: SnapshotProtocol, impliedMultiple: number): number {
  return Math.round(capitalFor(p) * impliedMultiple * 100) / 100;
}

/**
 * Every protocol in the snapshot, in exactly one bucket. The buckets are
 * the rankable rule's own exclusions, in priority order: ranked first, then
 * already has a token, then the excluded categories and name shapes. The
 * counts sum to the snapshot's protocol count, so nothing is unaccounted for.
 */
export function disposition(snapshot: Snapshot): Disposition {
  const d: Disposition = { total: snapshot.protocols.length, ranked: 0, has_token: 0, bridge: 0, liquid_staking: 0, exchange_custody: 0, versioned: 0, wrapped: 0, other: 0 };
  for (const p of snapshot.protocols) {
    if (isRankable(p)) d.ranked++;
    else if (!isPreToken(p)) d.has_token++;
    else if (p.category === 'Bridge' || p.category === 'Canonical Bridge') d.bridge++;
    else if (p.category === 'Liquid Staking' || p.category === 'Liquid Restaking' || p.category === 'Restaked BTC') d.liquid_staking++;
    else if (p.category === 'CEX') d.exchange_custody++;
    else if (VERSIONED.test(p.name)) d.versioned++;
    else if (WRAPPED_WORD.test(p.name)) d.wrapped++;
    else d.other++;
  }
  return d;
}

function holdDaysFor(age: number | null): number {
  if (age === null) return 30;
  if (age < 180) return 60;
  if (age < 365) return 45;
  return 30;
}

type CatGroup = 'lending' | 'dex' | 'bridge' | 'staking' | 'derivatives' | 'prediction' | 'rwa' | 'stable' | 'insurance' | 'yield' | 'curator' | 'other';

function catGroup(p: SnapshotProtocol): CatGroup {
  const c = (p.category ?? '').toLowerCase();
  if (c.includes('lend') || c.includes('cdp') || c.includes('collateral')) return 'lending';
  if (c.includes('dex') || c.includes('leveraged farm')) return 'dex';
  if (c.includes('bridge')) return 'bridge';
  if (c.includes('staking') || c.includes('restak')) return 'staking';
  if (c.includes('perpetual') || c.includes('derivative')) return 'derivatives';
  if (c.includes('prediction')) return 'prediction';
  if (c.includes('rwa')) return 'rwa';
  if (c.includes('stable')) return 'stable';
  if (c.includes('insurance')) return 'insurance';
  if (c.includes('yield')) return 'yield';
  if (c.includes('curator') || c.includes('allocator')) return 'curator';
  return 'other';
}

/** The main farming action for the category, with its capital and chain. */
function actionFor(p: SnapshotProtocol, capital: number, chain: string): string {
  const name = p.name;
  switch (catGroup(p)) {
    case 'lending':
      return `Supply $${capital} of USDC to ${name} on ${chain} and keep the position open, so the protocol records a real lender.`;
    case 'dex':
      return `Provide $${capital} of liquidity to ${name}'s main pool on ${chain} and keep the position open through at least one fee cycle.`;
    case 'bridge':
      return `Bridge $${capital} of USDC to ${chain} through ${name}, then use the bridged funds in an app on that chain.`;
    case 'staking':
      return `Stake $${capital} of the chain's staking asset through ${name} and keep the receipt token in the same wallet.`;
    case 'derivatives':
      return `Deposit $${capital} of USDC as margin on ${name} and open one small hedged position, then close it after a day.`;
    case 'prediction':
      return `Fund $${capital} on ${name} and place one market position, then settle it rather than leaving it open.`;
    case 'rwa':
      return `Mint $${capital} of the protocol's yield-bearing asset on ${chain} through ${name} and hold it in the farming wallet.`;
    case 'stable':
      return `Mint or deposit $${capital} of the stable asset through ${name} on ${chain} and keep it in the farming wallet.`;
    case 'insurance':
      return `Buy $${capital} of cover from ${name} on ${chain} and keep the policy active for the full hold period.`;
    case 'yield':
      return `Deposit $${capital} of USDC into ${name}'s main yield vault on ${chain} and keep the vault shares.`;
    case 'curator':
      return `Deposit $${capital} into a ${name} vault on ${chain} and keep the shares until the hold period ends.`;
    default:
      return `Deposit $${capital} of USDC into ${name} on ${chain} and keep the position open for the full hold period.`;
  }
}

/** A second, different qualifying action for the same category. */
function secondActionFor(p: SnapshotProtocol, capital: number, chain: string): string {
  const name = p.name;
  const small = Math.max(10, Math.round(capital / 5));
  switch (catGroup(p)) {
    case 'lending':
      return `Borrow $${small} against the supplied collateral on ${name}, repay it within a week, and leave the supply position open.`;
    case 'dex':
      return `Swap $${small} through ${name} on ${chain} in a separate transaction, so the wallet shows trading as well as liquidity.`;
    case 'bridge':
      return `Bridge $${small} back the other way through ${name} a week later, so the wallet shows two-way use.`;
    case 'staking':
      return `Claim any staking rewards ${name} shows for the position and restake them in the same wallet.`;
    case 'derivatives':
      return `Place one more small trade of about $${small} on ${name} in a different market, then close it the same day.`;
    case 'prediction':
      return `Place a second position of about $${small} on ${name} on a different market and settle it before the week ends.`;
    case 'rwa':
      return `Check the yield ${name} reports for the $${capital} position and, if it pays out, reinvest the payout in the same asset.`;
    case 'stable':
      return `Swap $${small} of the stable asset through ${name} on ${chain} and hold the result in the farming wallet.`;
    case 'insurance':
      return `Open the cover dashboard ${name} shows for the policy and confirm the policy is active before the hold ends.`;
    case 'yield':
      return `Harvest any yield the ${name} vault shows for the $${capital} deposit and redeposit it into the same vault.`;
    case 'curator':
      return `Check the vault allocation ${name} reports for the $${capital} deposit and leave the shares untouched for a week.`;
    default:
      return `Use ${name} a second way: make one more transaction of about $${small} on ${chain} in the same wallet.`;
  }
}

/**
 * A protocol's farm plan: seven steps, each an action with a cost and a time.
 * The plan is derived from the protocol's own record (category, chains, TVL,
 * growth and age), never from a hand-written list of names. A protocol whose
 * TVL fell more than 10% in the last seven days farms at half size, and the
 * plan says so.
 */
export function farmSteps(p: SnapshotProtocol, age: number | null): FarmStep[] {
  const chain = chainOf(p);
  const capital = capitalFor(p);
  const hold = holdDaysFor(age);
  return [
    {
      text: `Use a fresh wallet that holds only the funds you plan to farm, and keep its seed phrase offline on paper, never in a screenshot or a chat.`,
      cost: 'under $3 of gas for the first transaction',
      time: '5 minutes',
    },
    { text: `${actionFor(p, capital, chain)}${sizingNote(p)}`, cost: `$${capital} of capital and about $${capital >= 150 ? 8 : 4} of gas`, time: '15 minutes to set up' },
    { text: secondActionFor(p, capital, chain), cost: `about $${Math.max(10, Math.round(capital / 5))} of capital and about $2 of gas`, time: '10 minutes' },
    {
      text: `Make one qualifying action each week, such as a deposit, a borrow, a swap or a vote, and never do them all in one day.`,
      cost: 'about $2 of gas a week',
      time: '10 minutes a week',
    },
    {
      text: `Hold the position for at least ${hold} days so the activity is counted in more than one snapshot, and do not withdraw early to chase another farm.`,
      cost: `the $${capital} stays in the position`,
      time: `${hold} days`,
    },
    {
      text: `Before you withdraw, open the protocol's own points or rewards page from the link it publishes itself, and never pay anyone to claim for you.`,
      cost: 'no fee to check, and never pay to claim',
      time: '10 minutes',
    },
    {
      text: `Write the wallet, the dates and every transaction hash in a farm log, then unwind in stages over a few days instead of all at once.`,
      cost: 'nothing but the log, plus about $4 of gas to exit',
      time: '5 minutes, plus exit gas',
    },
  ];
}

export function liveRows(snapshot: Snapshot): LiveRow[] {
  return snapshot.protocols
    .filter((p) => !isPreToken(p) && p.category !== 'CEX')
    .sort((a, b) => (b.mcap_usd ?? 0) - (a.mcap_usd ?? 0) || b.tvl_usd - a.tvl_usd)
    .slice(0, LIVE_ROWS)
    .map((p) => ({
      slug: p.slug,
      name: p.name,
      category: p.category,
      chains: p.chains,
      tvl_usd: p.tvl_usd,
      mcap_usd: p.mcap_usd,
      change_7d: p.change_7d,
    }));
}

export function radarRow(row: BoardRow): RadarRow {
  return {
    rank: row.rank,
    slug: row.slug,
    name: row.name,
    category: row.category,
    chains: row.chains,
    chain_count: row.chains.length,
    tvl_usd: row.tvl_usd,
    change_7d: row.change_7d,
    mcap_usd: row.mcap_usd,
    listed_at: row.listed_at,
    age_days: row.age_days,
    implied_value_usd: row.implied_value_usd,
    implied_multiple: row.model.implied_multiple,
    growth_multiplier: row.model.growth_multiplier,
    maturity_multiplier: row.model.maturity_multiplier,
    chain_multiplier: row.model.chain_multiplier,
    size_multiplier: row.model.size_multiplier,
    watchlist: row.watchlist,
    verdict: farmVerdict(row.model.implied_multiple, row.change_7d),
    farm_value_usd: farmValueUsd({ slug: row.slug, name: row.name, category: row.category, chains: row.chains, tvl_usd: row.tvl_usd, change_7d: row.change_7d, mcap_usd: row.mcap_usd, listed_at: row.listed_at, gecko_id: row.gecko_id, symbol: row.symbol }, row.model.implied_multiple),
  };
}

export function buildRadar(snapshot: Snapshot, model: ModelConstants = MODEL): { board: BoardRow[]; radar: RadarData } {
  const board = buildBoard(snapshot, model);
  const live = liveRows(snapshot);
  const early = board.filter((r) => !r.watchlist).length;
  const sortedImplied = board.map((r) => r.implied_value_usd).sort((a, b) => a - b);
  const median = sortedImplied.length ? sortedImplied[Math.floor(sortedImplied.length / 2)]! : 0;
  const rows = board.map(radarRow);
  const verdicts = { farm: 0, marginal: 0, skip: 0 };
  for (const r of rows) verdicts[r.verdict === 'FARM' ? 'farm' : r.verdict === 'MARGINAL' ? 'marginal' : 'skip']++;
  const multiples = rows.map((r) => r.implied_multiple);
  const radar: RadarData = {
    as_of: snapshot.as_of,
    source: snapshot.source,
    floor_usd: snapshot.floor_usd,
    model,
    model_version: MODEL_VERSION,
    watchlist_size: snapshot.watchlist.length,
    board_size: board.length,
    early_size: early,
    live_size: live.length,
    top_implied_usd: board.length ? board[0]!.implied_value_usd : 0,
    median_implied_usd: median,
    implied_total_usd: rows.reduce((a, r) => a + r.implied_value_usd, 0),
    implied_top10_low_usd: rows.length >= 10 ? rows[9]!.implied_value_usd : 0,
    multiple_min: multiples.length ? Math.min(...multiples) : 0,
    multiple_max: multiples.length ? Math.max(...multiples) : 0,
    disposition: disposition(snapshot),
    verdict_counts: verdicts,
    best_farm_value_usd: rows.length ? Math.max(...rows.map((r) => r.farm_value_usd)) : 0,
    rows,
    live,
  };
  return { board, radar };
}

export function parseSnapshot(text: string): Snapshot {
  let raw: unknown;
  try {
    raw = JSON.parse(text);
  } catch {
    throw new SnapshotError('snapshot.json is not JSON');
  }
  if (typeof raw !== 'object' || raw === null || Array.isArray(raw)) throw new SnapshotError('snapshot.json is not a JSON object');
  const o = raw as Record<string, unknown>;
  if (typeof o.as_of !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(o.as_of)) throw new SnapshotError('snapshot.json has no as_of date');
  if (typeof o.source !== 'string') throw new SnapshotError('snapshot.json has no source');
  if (typeof o.floor_usd !== 'number' || !Number.isSafeInteger(o.floor_usd) || o.floor_usd <= 0) throw new SnapshotError('snapshot.json has no floor_usd');
  if (!Array.isArray(o.protocols)) throw new SnapshotError('snapshot.json has no protocols array');
  if (!Array.isArray(o.watchlist) || o.watchlist.some((s) => typeof s !== 'string')) throw new SnapshotError('snapshot.json has no watchlist of slugs');
  const protocols = o.protocols.map((v, i) => {
    if (typeof v !== 'object' || v === null || Array.isArray(v)) throw new SnapshotError(`snapshot.json's protocol ${i} is not an object`);
    const p = v as Record<string, unknown>;
    if (typeof p.slug !== 'string' || typeof p.name !== 'string' || typeof p.tvl_usd !== 'number' || !Number.isFinite(p.tvl_usd)) {
      throw new SnapshotError(`snapshot.json's protocol ${i} lacks a slug, a name or a TVL`);
    }
    return {
      slug: p.slug,
      name: p.name,
      category: typeof p.category === 'string' ? p.category : null,
      chains: Array.isArray(p.chains) ? p.chains.filter((c): c is string => typeof c === 'string') : [],
      tvl_usd: p.tvl_usd,
      change_7d: typeof p.change_7d === 'number' && Number.isFinite(p.change_7d) ? p.change_7d : null,
      mcap_usd: typeof p.mcap_usd === 'number' && Number.isFinite(p.mcap_usd) ? p.mcap_usd : null,
      listed_at: typeof p.listed_at === 'string' ? p.listed_at : null,
      gecko_id: typeof p.gecko_id === 'string' ? p.gecko_id : null,
      symbol: typeof p.symbol === 'string' ? p.symbol : null,
    };
  });
  return {
    as_of: o.as_of,
    source: o.source,
    floor_usd: o.floor_usd,
    protocols,
    watchlist: o.watchlist as string[],
  };
}

export function boardIssue(board: BoardRow[], snapshot: Snapshot): string | null {
  const slugs = new Set(board.map((r) => r.slug));
  const missing = snapshot.watchlist.filter((s) => !slugs.has(s));
  if (missing.length > 0) return `the board misses ${missing.length} watchlist slug${missing.length === 1 ? '' : 's'}: ${missing.slice(0, 5).join(', ')}`;
  if (board.length < 100) return `the board holds ${board.length} rows, under the 100-row floor`;
  const ranks = board.map((r) => r.rank).sort((a, b) => a - b);
  for (let i = 0; i < ranks.length; i++) if (ranks[i] !== i + 1) return `rank ${i + 1} is ${ranks[i]}`;
  for (let i = 1; i < board.length; i++) if (board[i]!.implied_value_usd > board[i - 1]!.implied_value_usd) return `row ${i + 1} outranks row ${i} on implied value`;
  if (board.length >= 2 && board[0]!.implied_value_usd === board[board.length - 1]!.implied_value_usd) {
    return `all ${board.length} rows share the same implied value $${board[0]!.implied_value_usd}: a board that ranks nothing by value is not a ranking`;
  }
  for (const r of board) {
    const steps = r.farm_steps;
    if (steps.length < 3 || steps.length > 12) return `${r.slug} has ${steps.length} farm steps`;
    for (const s of steps) if (s.length < 20 || s.length > 600) return `${r.slug} has a farm step of ${s.length} characters`;
    if (!Number.isSafeInteger(r.implied_value_usd) || r.implied_value_usd <= 0) return `${r.slug} has implied value ${r.implied_value_usd}`;
  }
  return null;
}

export function dataScript(radar: RadarData): string {
  return `window.RADAR=${JSON.stringify(radar)};\n`;
}
