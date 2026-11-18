// Token Radar radar-2 dashboard. Reads window.RADAR (written beside
// dashboard/ by main.ts) and renders the ranked board, a filterable table,
// a top-10 chart, a model sandbox that recomputes every row live, and a
// per-protocol detail view with the model's own inputs and the farm plan.
// No network: every byte it shows is in data.js. No protocol name is
// special-cased anywhere in this file.
(function () {
  'use strict';
  var DATA = window.RADAR;
  if (!DATA) return;
  var app = document.getElementById('board');
  var baseModel = DATA.model;
  var state = { q: '', category: 'all', chain: 'all', watch: false, tab: 'pre-token', sort: 'implied', dir: -1, selected: null, sandbox: false, m: null };
  state.m = { base_multiple: baseModel.base_multiple, growth_weight: baseModel.growth_weight, maturity_range: baseModel.maturity_range, chain_step: baseModel.chain_step };

  var usd = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 });
  function fmtUsd(n) {
    if (n === null || n === undefined || !isFinite(n)) return 'n/a';
    if (Math.abs(n) >= 1e9) return '$' + (n / 1e9).toFixed(2) + 'B';
    if (Math.abs(n) >= 1e6) return '$' + (n / 1e6).toFixed(1) + 'M';
    if (Math.abs(n) >= 1e3) return '$' + Math.round(n / 1e3) + 'K';
    return usd.format(n);
  }
  function fmtPct(n) { if (n === null || n === undefined || !isFinite(n)) return 'n/a'; return (n > 0 ? '+' : '') + n.toFixed(2) + '%'; }
  function fmtAge(d) { if (d === null || d === undefined) return 'unknown'; if (d >= 365) return (d / 365).toFixed(1) + 'y'; return Math.max(0, Math.round(d)) + 'd'; }
  function fmtMult(n) { return (n === null || n === undefined || !isFinite(n)) ? 'n/a' : n.toFixed(2) + 'x'; }

  // The model, in one function, identical to lib/model.ts: the page
  // recomputes a row from the snapshot figures and checks the number the
  // board carries, so the page's code and the board's data are visibly the
  // same arithmetic. The sandbox changes only the four constants below.
  function impliedOf(row, m) {
    var growth = Math.min(150, Math.max(-60, row.change_7d === null || row.change_7d === undefined ? 0 : row.change_7d));
    var growthMult = 1 + (growth / 100) * m.growth_weight;
    var age = row.age_days === null || row.age_days === undefined ? 365 : row.age_days;
    var maturity = 0.6 + m.maturity_range * Math.sqrt(Math.min(Math.max(age, 0), 1095) / 1095);
    var chains = Math.max(1, row.chain_count || (row.chains ? row.chains.length : 1));
    var chainMult = 1 + m.chain_step * Math.min(chains - 1, 5);
    return { implied: Math.max(1, Math.round(row.tvl_usd * m.base_multiple * growthMult * maturity * chainMult)), growthMult: growthMult, maturity: maturity, chainMult: chainMult, growth: growth };
  }
  function liveRows() {
    if (!state.sandbox) return DATA.rows;
    var scored = DATA.rows.map(function (r) { var v = impliedOf(r, state.m); var c = {}; for (var k in r) c[k] = r[k]; c.implied_value_usd = v.implied; c.implied_multiple = v.implied / Math.max(1, r.tvl_usd); c.growth_multiplier = Math.round(v.growthMult * 1e4) / 1e4; c.maturity_multiplier = Math.round(v.maturity * 1e4) / 1e4; c.chain_multiplier = Math.round(v.chainMult * 1e4) / 1e4; return c; });
    scored.sort(function (a, b) { return b.implied_value_usd - a.implied_value_usd || (a.slug < b.slug ? -1 : 1); });
    scored.forEach(function (r, i) { r.rank = i + 1; });
    return scored;
  }

  function el(tag, attrs) {
    var node = document.createElement(tag);
    if (attrs) Object.keys(attrs).forEach(function (k) {
      if (k === 'class') node.className = attrs[k];
      else if (k === 'text') node.textContent = attrs[k];
      else if (k === 'html') node.innerHTML = attrs[k];
      else if (k.slice(0, 2) === 'on') node.addEventListener(k.slice(2), attrs[k]);
      else if (attrs[k] !== null && attrs[k] !== undefined) node.setAttribute(k, attrs[k]);
    });
    for (var i = 2; i < arguments.length; i++) { var c = arguments[i]; if (c === null || c === undefined) continue; if (Array.isArray(c)) c.forEach(function (x) { if (x) node.appendChild(x); }); else if (typeof c === 'string') node.appendChild(document.createTextNode(c)); else node.appendChild(c); }
    return node;
  }

  // Farm plan: the same derivation main.ts writes to board.json. Category,
  // chains, TVL and age decide the actions, the capital, the hold and every
  // cost and time. No name is special-cased.
  function chainOf(p) { return p.chains && p.chains.length ? p.chains[0] : 'its main chain'; }
  function capitalFor(p) { if (p.tvl_usd >= 5e9) return 250; if (p.tvl_usd >= 1e9) return 150; if (p.tvl_usd >= 1e8) return 100; return 50; }
  function holdFor(age) { if (age === null || age === undefined) return 30; if (age < 180) return 60; if (age < 365) return 45; return 30; }
  function group(p) {
    var c = (p.category || '').toLowerCase();
    if (c.indexOf('lend') >= 0 || c.indexOf('cdp') >= 0 || c.indexOf('collateral') >= 0) return 'lending';
    if (c.indexOf('dex') >= 0 || c.indexOf('leveraged farm') >= 0) return 'dex';
    if (c.indexOf('bridge') >= 0) return 'bridge';
    if (c.indexOf('staking') >= 0 || c.indexOf('restak') >= 0) return 'staking';
    if (c.indexOf('perpetual') >= 0 || c.indexOf('derivative') >= 0) return 'derivatives';
    if (c.indexOf('prediction') >= 0) return 'prediction';
    if (c.indexOf('rwa') >= 0) return 'rwa';
    if (c.indexOf('stable') >= 0) return 'stable';
    if (c.indexOf('insurance') >= 0) return 'insurance';
    if (c.indexOf('yield') >= 0) return 'yield';
    if (c.indexOf('curator') >= 0 || c.indexOf('allocator') >= 0) return 'curator';
    return 'other';
  }
  function actionFor(p, cap, chain) {
    var n = p.name, g = group(p);
    if (g === 'lending') return 'Supply $' + cap + ' of USDC to ' + n + ' on ' + chain + ' and keep the position open, so the protocol records a real lender.';
    if (g === 'dex') return 'Provide $' + cap + ' of liquidity to ' + n + "'s main pool on " + chain + ' and keep the position open through at least one fee cycle.';
    if (g === 'bridge') return 'Bridge $' + cap + ' of USDC to ' + chain + ' through ' + n + ', then use the bridged funds in an app on that chain.';
    if (g === 'staking') return 'Stake $' + cap + " of the chain's staking asset through " + n + ' and keep the receipt token in the same wallet.';
    if (g === 'derivatives') return 'Deposit $' + cap + ' of USDC as margin on ' + n + ' and open one small hedged position, then close it after a day.';
    if (g === 'prediction') return 'Fund $' + cap + ' on ' + n + ' and place one market position, then settle it rather than leaving it open.';
    if (g === 'rwa') return 'Mint $' + cap + " of the protocol's yield-bearing asset on " + chain + ' through ' + n + ' and hold it in the farming wallet.';
    if (g === 'stable') return 'Mint or deposit $' + cap + ' of the stable asset through ' + n + ' on ' + chain + ' and keep it in the farming wallet.';
    if (g === 'insurance') return 'Buy $' + cap + ' of cover from ' + n + ' on ' + chain + ' and keep the policy active for the full hold period.';
    if (g === 'yield') return 'Deposit $' + cap + ' of USDC into ' + n + "'s main yield vault on " + chain + ' and keep the vault shares.';
    if (g === 'curator') return 'Deposit $' + cap + ' into a ' + n + ' vault on ' + chain + ' and keep the shares until the hold period ends.';
    return 'Deposit $' + cap + ' of USDC into ' + n + ' on ' + chain + ' and keep the position open for the full hold period.';
  }
  function secondFor(p, cap, chain) {
    var n = p.name, g = group(p), s = Math.max(10, Math.round(cap / 5));
    if (g === 'lending') return 'Borrow $' + s + ' against the supplied collateral on ' + n + ', repay it within a week, and leave the supply position open.';
    if (g === 'dex') return 'Swap $' + s + ' through ' + n + ' on ' + chain + ' in a separate transaction, so the wallet shows trading as well as liquidity.';
    if (g === 'bridge') return 'Bridge $' + s + ' back the other way through ' + n + ' a week later, so the wallet shows two-way use.';
    if (g === 'staking') return 'Claim any staking rewards ' + n + ' shows for the position and restake them in the same wallet.';
    if (g === 'derivatives') return 'Place one more small trade of about $' + s + ' on ' + n + ' in a different market, then close it the same day.';
    if (g === 'prediction') return 'Place a second position of about $' + s + ' on ' + n + ' on a different market and settle it before the week ends.';
    if (g === 'rwa') return 'Check the yield ' + n + ' reports for the $' + cap + ' position and, if it pays out, reinvest the payout in the same asset.';
    if (g === 'stable') return 'Swap $' + s + ' of the stable asset through ' + n + ' on ' + chain + ' and hold the result in the farming wallet.';
    if (g === 'insurance') return 'Open the cover dashboard ' + n + ' shows for the policy and confirm the policy is active before the hold ends.';
    if (g === 'yield') return 'Harvest any yield the ' + n + ' vault shows for the $' + cap + ' deposit and redeposit it into the same vault.';
    if (g === 'curator') return 'Check the vault allocation ' + n + ' reports for the $' + cap + ' deposit and leave the shares untouched for a week.';
    return 'Use ' + n + ' a second way: make one more transaction of about $' + s + ' on ' + chain + ' in the same wallet.';
  }
  function stepText(step) { var s = step.text + ' Cost: ' + step.cost + '. Time: ' + step.time + '.'; if (s.length > 600) s = s.slice(0, 596) + '...'; if (s.length < 20) s += " Hold the position and check the protocol's own page."; return s; }
  function farmSteps(p) {
    var chain = chainOf(p), cap = capitalFor(p), hold = holdFor(p.age_days);
    return [
      { text: 'Use a fresh wallet that holds only the funds you plan to farm, and keep its seed phrase offline on paper, never in a screenshot or a chat.', cost: 'under $3 of gas for the first transaction', time: '5 minutes' },
      { text: actionFor(p, cap, chain), cost: '$' + cap + ' of capital and about $' + (cap >= 150 ? 8 : 4) + ' of gas', time: '15 minutes to set up' },
      { text: secondFor(p, cap, chain), cost: 'about $' + Math.max(10, Math.round(cap / 5)) + ' of capital and about $2 of gas', time: '10 minutes' },
      { text: 'Make one qualifying action each week, such as a deposit, a borrow, a swap or a vote, and never do them all in one day.', cost: 'about $2 of gas a week', time: '10 minutes a week' },
      { text: 'Hold the position for at least ' + hold + ' days so the activity is counted in more than one snapshot, and do not withdraw early to chase another farm.', cost: 'the $' + cap + ' stays in the position', time: hold + ' days' },
      { text: "Before you withdraw, open the protocol's own points or rewards page from the link it publishes itself, and never pay anyone to claim for you.", cost: 'no fee to check, and never pay to claim', time: '10 minutes' },
      { text: 'Write the wallet, the dates and every transaction hash in a farm log, then unwind in stages over a few days instead of all at once.', cost: 'nothing but the log, plus about $4 of gas to exit', time: '5 minutes, plus exit gas' }
    ].map(stepText);
  }

  function readHash() {
    var hash = window.location.hash.replace(/^#/, ''); if (!hash) return;
    var params = new URLSearchParams(hash);
    if (params.get('q')) state.q = params.get('q');
    if (params.get('p')) state.selected = params.get('p');
    if (params.get('category')) state.category = params.get('category');
    if (params.get('chain')) state.chain = params.get('chain');
    if (params.get('watch')) state.watch = params.get('watch') === '1';
    if (params.get('tab')) state.tab = params.get('tab');
  }
  function writeHash() {
    var params = new URLSearchParams();
    if (state.q) params.set('q', state.q);
    if (state.category !== 'all') params.set('category', state.category);
    if (state.chain !== 'all') params.set('chain', state.chain);
    if (state.watch) params.set('watch', '1');
    if (state.tab !== 'pre-token') params.set('tab', state.tab);
    if (state.selected) params.set('p', state.selected);
    var next = params.toString();
    if (next) window.history.replaceState(null, '', '#' + next);
    else window.history.replaceState(null, '', window.location.pathname + window.location.search);
  }

  function filtered() {
    var q = state.q.trim().toLowerCase();
    return liveRows().filter(function (r) {
      if (state.watch && !r.watchlist) return false;
      if (state.category !== 'all' && r.category !== state.category) return false;
      if (state.chain !== 'all' && !(r.chains || []).includes(state.chain)) return false;
      if (!q) return true;
      return [r.name, r.slug, r.category, (r.chains || []).join(' ')].join(' ').toLowerCase().indexOf(q) >= 0;
    });
  }
  function sorted(list) {
    var key = state.sort;
    return list.slice().sort(function (a, b) {
      var av, bv;
      if (key === 'name') { av = a.name.toLowerCase(); bv = b.name.toLowerCase(); }
      else if (key === 'tvl') { av = a.tvl_usd; bv = b.tvl_usd; }
      else if (key === 'growth') { av = a.change_7d === null ? -Infinity : a.change_7d; bv = b.change_7d === null ? -Infinity : b.change_7d; }
      else if (key === 'age') { av = a.age_days === null ? Infinity : a.age_days; bv = b.age_days === null ? Infinity : b.age_days; }
      else if (key === 'multiple') { av = a.implied_multiple; bv = b.implied_multiple; }
      else { av = a.implied_value_usd; bv = b.implied_value_usd; }
      if (av < bv) return -state.dir; if (av > bv) return state.dir;
      return a.slug < b.slug ? -1 : a.slug > b.slug ? 1 : 0;
    });
  }

  function header() {
    return el('header', { class: 'top' },
      el('div', { class: 'brand' }, el('span', { class: 'mark' }), el('span', { class: 'brand-name', text: 'Token Radar' })),
      el('div', { class: 'top-meta' }, el('span', { text: 'Snapshot ' + DATA.as_of }), el('span', { text: 'DefiLlama protocol index' }), el('span', { text: DATA.model_version + ' model' })));
  }
  function lede() {
    return el('section', { class: 'lede' },
      el('div', null,
        el('h1', { text: DATA.watchlist_size + ' watchlist protocols, ranked by implied value' }),
        el('p', null, 'The watchlist is the floor: every protocol with at least ', el('b', { text: '$' + Math.round(DATA.floor_usd / 1e6) + 'M' }), ' of TVL and no token on record. The early radar adds ', el('b', { text: String(DATA.early_size) }), ' more pre-token protocols below and beside that floor, at any TVL. Implied value is a model, not a promise — and "no token" means no token on record, not that none exists.')),
      el('div', { class: 'facts' },
        el('div', { class: 'fact' }, el('span', { text: 'Watchlist covered' }), el('b', { text: DATA.watchlist_size + ' / ' + DATA.watchlist_size })),
        el('div', { class: 'fact' }, el('span', { text: 'Pre-token rows scored' }), el('b', { text: String(DATA.board_size) })),
        el('div', { class: 'fact' }, el('span', { text: 'Top implied value' }), el('b', { text: fmtUsd(DATA.top_implied_usd) })),
        el('div', { class: 'fact' }, el('span', { text: 'Median implied value' }), el('b', { text: fmtUsd(DATA.median_implied_usd) })),
        el('div', { class: 'fact' }, el('span', { text: 'Live-token protocols set aside' }), el('b', { text: String(DATA.live_size) }))));
  }
  function chart() {
    var top = liveRows().slice(0, 10); var max = top.length ? top[0].implied_value_usd : 1;
    var wrap = el('section', { class: 'panel chart' }, el('h2', { text: 'Top 10 by implied value' }), el('p', { class: 'note', text: 'The board, at a glance. Bars are implied value; the table below carries every row.' }));
    top.forEach(function (r) {
      wrap.appendChild(el('div', { class: 'chart-row' },
        el('span', { class: 'nm' }, el('b', { text: r.name }), el('span', { text: '#' + r.rank })),
        el('div', { class: 'cbar', 'aria-hidden': 'true' }, el('i', { style: 'width:' + Math.max(3, Math.round((r.implied_value_usd / max) * 100)) + '%' })),
        el('span', { class: 'num', text: fmtUsd(r.implied_value_usd) })));
    });
    return wrap;
  }
  function controls() {
    var cats = Array.from(new Set(DATA.rows.map(function (r) { return r.category || 'Other'; }))).sort();
    var chains = Array.from(new Set(DATA.rows.reduce(function (a, r) { return a.concat(r.chains || []); }, []))).sort();
    var search = el('input', { type: 'search', id: 'q', placeholder: 'Search name, category or chain', value: state.q, 'aria-label': 'Search the board' });
    search.addEventListener('input', function () { state.q = search.value; writeHash(); render(); });
    var cat = el('select', { id: 'category', 'aria-label': 'Filter by category' }, el('option', { value: 'all', text: 'All categories' }), cats.map(function (c) { return el('option', { value: c, text: c, selected: c === state.category ? 'selected' : null }); }));
    cat.addEventListener('change', function () { state.category = cat.value; writeHash(); render(); });
    var ch = el('select', { id: 'chain', 'aria-label': 'Filter by chain' }, el('option', { value: 'all', text: 'All chains' }), chains.map(function (c) { return el('option', { value: c, text: c, selected: c === state.chain ? 'selected' : null }); }));
    ch.addEventListener('change', function () { state.chain = ch.value; writeHash(); render(); });
    var watch = el('label', { class: 'check' }, el('input', { type: 'checkbox', checked: state.watch ? 'checked' : null, onchange: function (e) { state.watch = e.target.checked; writeHash(); render(); } }), 'Watchlist only');
    var pre = el('button', { type: 'button', 'aria-pressed': state.tab === 'pre-token' ? 'true' : 'false', text: 'Pre-token', onclick: function () { state.tab = 'pre-token'; render(); } });
    var live = el('button', { type: 'button', 'aria-pressed': state.tab === 'live' ? 'true' : 'false', text: 'Live token', onclick: function () { state.tab = 'live'; render(); } });
    return el('div', { class: 'controls' },
      el('div', { class: 'field' }, el('label', { for: 'q', text: 'Search' }), search),
      el('div', { class: 'field' }, el('label', { for: 'category', text: 'Category' }), cat),
      el('div', { class: 'field' }, el('label', { for: 'chain', text: 'Chain' }), ch),
      watch,
      el('div', { class: 'field' }, el('span', { class: 'sub', text: 'Token status' }), el('div', { class: 'tabs' }, pre, live)),
      el('span', { class: 'count', text: state.tab === 'pre-token' ? filtered().length + ' rows shown' : DATA.live.length + ' live-token protocols' }));
  }
  function sortHeader(key, label) {
    return el('th', { scope: 'col' }, el('button', { type: 'button', onclick: function () { if (state.sort === key) state.dir = -state.dir; else { state.sort = key; state.dir = -1; } render(); } }, label, state.sort === key ? el('span', { 'aria-hidden': 'true', text: state.dir < 0 ? ' v' : ' ^' }) : null));
  }
  function boardTable() {
    var list = sorted(filtered());
    if (!list.length) return el('div', { class: 'panel' }, el('div', { class: 'empty' }, el('h2', { text: 'No protocol matches that filter' }), el('p', { text: 'Clear the search or pick another category to see the board again.' }), el('button', { class: 'button primary', type: 'button', text: 'Clear filters', onclick: function () { state.q = ''; state.category = 'all'; state.chain = 'all'; state.watch = false; writeHash(); render(); } })));
    var max = list[0].implied_value_usd || 1;
    var tbody = el('tbody');
    list.forEach(function (r) {
      var growth = r.change_7d === null ? 'n/a' : fmtPct(r.change_7d);
      var gc = r.change_7d === null ? '' : r.change_7d >= 0 ? 'pos' : 'neg';
      tbody.appendChild(el('tr', { 'data-selected': state.selected === r.slug ? 'true' : 'false', tabindex: '0', onclick: function () { openDetail(r.slug); }, onkeydown: function (e) { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); openDetail(r.slug); } } },
        el('td', { class: 'num', text: String(r.rank) }),
        el('td', null, el('div', { class: 'name' }, el('b', null, r.name, r.watchlist ? el('span', { class: 'badge watch', text: 'Watchlist' }) : el('span', { class: 'badge early', text: 'Early' })), el('span', { class: 'sub', text: (r.category || 'Other') + ' on ' + (r.chains && r.chains.length ? r.chains.slice(0, 2).join(', ') : 'an unnamed chain') }))),
        el('td', { class: 'num', text: fmtUsd(r.tvl_usd) }),
        el('td', { class: 'num ' + gc, text: growth }),
        el('td', { class: 'num', text: fmtAge(r.age_days) }),
        el('td', { class: 'num', text: fmtMult(r.implied_multiple) }),
        el('td', null, el('div', { class: 'implied' }, el('div', { class: 'bar', 'aria-hidden': 'true' }, el('i', { style: 'width:' + Math.max(3, Math.round((r.implied_value_usd / max) * 100)) + '%' })), el('span', { class: 'num', text: fmtUsd(r.implied_value_usd) }))),
        el('td', null, el('span', { class: 'status', text: 'no token' }))));
    });
    return el('div', { class: 'panel' }, el('div', { class: 'table-wrap' }, el('table', null,
      el('caption', { class: 'sub', text: 'Pre-token protocols, strongest implied value first. Select a row for its model and farm plan.' }),
      el('thead', null, el('tr', null, sortHeader('implied', 'Rank'), sortHeader('name', 'Protocol'), sortHeader('tvl', 'TVL'), sortHeader('growth', '7d'), sortHeader('age', 'Age'), sortHeader('multiple', 'Implied / TVL'), sortHeader('implied', 'Implied value'), el('th', { scope: 'col', text: 'Token' }))),
      tbody)));
  }
  function liveTable() {
    var tbody = el('tbody');
    DATA.live.forEach(function (r) {
      tbody.appendChild(el('tr', null,
        el('td', { class: 'num', text: 'live' }),
        el('td', null, el('div', { class: 'name' }, el('b', { text: r.name }), el('span', { class: 'sub', text: (r.category || 'Other') + ' on ' + (r.chains && r.chains.length ? r.chains.slice(0, 2).join(', ') : 'an unnamed chain') }))),
        el('td', { class: 'num', text: fmtUsd(r.tvl_usd) }),
        el('td', { class: 'num ' + (r.change_7d !== null && r.change_7d >= 0 ? 'pos' : 'neg'), text: fmtPct(r.change_7d) }),
        el('td', { class: 'num', text: fmtUsd(r.mcap_usd) }),
        el('td', null, el('span', { class: 'status', text: 'already trades' }))));
    });
    return el('div', { class: 'panel' }, el('div', { class: 'table-wrap' }, el('table', null,
      el('caption', { class: 'sub', text: 'Token live: these protocols already trade, so their market cap is a fact, not a model. They are set aside from the pre-token ranking.' }),
      el('thead', null, el('tr', null, el('th', { scope: 'col', text: 'Status' }), el('th', { scope: 'col', text: 'Protocol' }), el('th', { scope: 'col', text: 'TVL' }), el('th', { scope: 'col', text: '7d' }), el('th', { scope: 'col', text: 'Market cap' }), el('th', { scope: 'col', text: 'Token' }))),
      tbody)));
  }
  function modelPanel() {
    var m = baseModel;
    return el('section', { class: 'panel model' },
      el('h2', { text: 'How implied value is computed' }),
      el('p', { class: 'sub', text: 'Every row is scored by one function of the snapshot figures. No protocol name is special-cased, and no row is hand-picked.' }),
      el('div', { class: 'formula' }, 'implied = round( tvl_usd x ', el('b', { text: String(m.base_multiple) }), ' x (1 + clamp(change_7d, -60, 150) / 100 x ', el('b', { text: String(m.growth_weight) }), ') x (0.60 + 0.40 x sqrt(min(age_days, 1095) / 1095)) x (1 + 0.03 x min(chains - 1, 5)) )'),
      el('p', { class: 'sub', text: 'TVL and seven-day growth come from the snapshot. Age is the time since the protocol was first listed, the best record of how long it has run with no token; an unlisted age uses 365 days. Growth can move the multiple more than twofold, maturity rises with age but with diminishing returns, and chain breadth adds at most 15%. The sandbox below changes only these constants and re-ranks the whole board live.' }));
  }
  function sandbox() {
    var m = state.m;
    function slider(label, key, min, max, step, fmt) {
      var out = el('output', { text: fmt(m[key]) });
      var input = el('input', { type: 'range', min: String(min), max: String(max), step: String(step), value: String(m[key]), 'aria-label': label });
      input.addEventListener('input', function () { m[key] = parseFloat(input.value); state.sandbox = true; out.textContent = fmt(m[key]); render(); });
      return el('label', null, label, input, out);
    }
    var reset = el('button', { class: 'button', type: 'button', text: 'Reset to radar-2', onclick: function () { state.m = { base_multiple: baseModel.base_multiple, growth_weight: baseModel.growth_weight, maturity_range: baseModel.maturity_range, chain_step: baseModel.chain_step }; state.sandbox = false; render(); } });
    return el('section', { class: 'panel sandbox' },
      el('h2', { text: 'Model sandbox — change the model, watch the board move' }),
      el('p', { class: 'note', text: state.sandbox ? 'Sandbox on: ranks below are recomputed with your constants. The submitted board still carries radar-2.' : 'Drag a slider: every row is recomputed from its TVL, growth, age and chains, and the board re-sorts. Nothing here is a hard-coded list.' }),
      el('div', { class: 'sandbox-grid' },
        slider('Base multiple', 'base_multiple', 0.1, 0.4, 0.01, function (v) { return v.toFixed(2); }),
        slider('Growth weight', 'growth_weight', 0, 1.5, 0.1, function (v) { return v.toFixed(1); }),
        slider('Maturity range', 'maturity_range', 0, 0.6, 0.05, function (v) { return v.toFixed(2); }),
        slider('Chain step', 'chain_step', 0, 0.06, 0.01, function (v) { return v.toFixed(2); })),
      reset);
  }
  function method() {
    return el('section', { class: 'panel method' },
      el('h2', { text: 'How to read this board' }),
      el('p', { text: 'A rank is a claim about value if a token launched on the snapshot as it stands, not a prediction that one will launch, or when. Farm only with money you can lose, one wallet per protocol, real activity spread over weeks — never many wallets in one day, and never pay anyone to claim for you.' }),
      el('p', { text: 'Live-token protocols are set aside with their market caps, so a protocol whose token already trades never takes a pre-token rank. The watchlist is the floor: every protocol on it is ranked, and the early rows beside it are the pre-token protocols the floor leaves out.' }));
  }
  var dialog = el('dialog', { class: 'detail', id: 'detail', 'aria-labelledby': 'detail-title' });
  dialog.addEventListener('close', function () { state.selected = null; writeHash(); });
  function openDetail(slug) {
    var row = liveRows().filter(function (r) { return r.slug === slug; })[0];
    if (!row) return;
    state.selected = slug; writeHash(); dialog.textContent = '';
    var steps = farmSteps(row);
    var v = impliedOf(row, state.sandbox ? state.m : baseModel);
    var zero = Math.max(1, Math.round(row.tvl_usd * (state.sandbox ? state.m.base_multiple : baseModel.base_multiple) * 1 * v.maturity * v.chainMult));
    var why = row.change_7d !== null && row.change_7d > 20 ? 'Fast 7-day growth lifts it above larger, slower protocols.' : row.change_7d !== null && row.change_7d < -10 ? 'Its 7-day fall holds it back despite its size.' : 'Its size and age carry it; growth neither lifts nor holds it back.';
    dialog.appendChild(el('div', { class: 'detail-head' },
      el('div', null, el('span', { class: 'brand-name', text: 'Rank ' + row.rank + ' of ' + DATA.board_size + (row.watchlist ? ' — Watchlist' : ' — Early radar') }), el('h2', { id: 'detail-title', text: row.name }), el('p', { class: 'sub', text: (row.category || 'Other') + ' on ' + (row.chains && row.chains.length ? row.chains.join(', ') : 'an unnamed chain') })),
      el('button', { class: 'close', type: 'button', 'aria-label': 'Close details', text: 'Close', onclick: function () { dialog.close(); } })));
    dialog.appendChild(el('section', { class: 'detail-section' },
      el('h3', { text: 'Implied value' }),
      el('div', { class: 'equation' },
        el('div', null, el('span', { text: 'TVL' }), el('b', { class: 'num', text: fmtUsd(row.tvl_usd) })),
        el('div', null, el('span', { text: 'Seven-day growth' }), el('b', { class: 'num', text: fmtPct(row.change_7d) })),
        el('div', null, el('span', { text: 'Age with no token' }), el('b', { class: 'num', text: fmtAge(row.age_days) })),
        el('div', null, el('span', { text: 'Chains' }), el('b', { class: 'num', text: String(row.chain_count || (row.chains || []).length) })),
        el('div', null, el('span', { text: 'Growth multiplier' }), el('b', { class: 'num', text: String(row.growth_multiplier) })),
        el('div', null, el('span', { text: 'Maturity multiplier' }), el('b', { class: 'num', text: String(row.maturity_multiplier) })),
        el('div', null, el('span', { text: 'Chain multiplier' }), el('b', { class: 'num', text: String(row.chain_multiplier) })),
        el('div', null, el('span', { text: 'Implied / TVL' }), el('b', { class: 'num', text: fmtMult(row.implied_multiple) })),
        el('div', null, el('span', { text: 'Implied value' }), el('b', { class: 'num', text: fmtUsd(row.implied_value_usd) }))),
      el('p', { class: 'sub', text: 'Model ' + DATA.model_version + ': the page recomputes this row as ' + fmtUsd(v.implied) + (v.implied === row.implied_value_usd ? ', the same number the board carries.' : ', which differs from the board while the sandbox is on.') + ' At zero growth it would be ' + fmtUsd(zero) + '. ' + why + ' This is an estimate, not a price.' })));
    dialog.appendChild(el('section', { class: 'detail-section' },
      el('h3', { text: 'Farm plan — 7 steps' }),
      el('ol', { class: 'steps' }, steps.map(function (s) { var at = s.indexOf(' Cost: '); var a = at >= 0 ? s.slice(0, at) : s; var t = at >= 0 ? s.slice(at + 1) : ''; return el('li', null, el('b', { text: a }), el('span', { class: 'cost', text: t })); }))));
    if (typeof dialog.showModal === 'function') { if (!dialog.open) dialog.showModal(); } else dialog.setAttribute('open', '');
  }
  function render() {
    app.textContent = '';
    var shell = el('div', { class: 'shell' });
    shell.appendChild(header()); shell.appendChild(lede()); shell.appendChild(chart()); shell.appendChild(controls());
    shell.appendChild(state.tab === 'pre-token' ? boardTable() : liveTable());
    if (state.tab === 'pre-token') { shell.appendChild(modelPanel()); shell.appendChild(sandbox()); }
    shell.appendChild(method());
    app.appendChild(shell); app.setAttribute('aria-busy', 'false');
    if (!dialog.isConnected) app.appendChild(dialog);
    if (state.selected) openDetail(state.selected);
  }
  readHash(); render();
  window.addEventListener('keydown', function (e) { if (e.key === 'Escape' && dialog.open) dialog.close(); });
})();
