(() => {
  const DATA = window.TRACKER_DATA || { reviews: [], validation: [], apps: [] };
  // Shopify can surface the same review twice around a local/UTC date boundary.
  // Keep the most recently observed copy for dashboard reporting.
  DATA.reviews = Array.from(new Map(DATA.reviews.map((r) => [`${r.appId}|${r.merchant}|${String(r.text).slice(0, 160)}`, r])).values());
  const $ = (s) => document.querySelector(s);
  const esc = (v) => String(v ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const date = (v) => new Date(v);
  const iso = (v) => date(v).toISOString().slice(0, 10);
  const reviewDates = DATA.reviews.map((r) => date(r.date)).filter((d) => !Number.isNaN(d));
  const referenceDate = reviewDates.length ? new Date(Math.max(...reviewDates)) : new Date();

  function quarterStart(d, offset = 0) {
    const q = Math.floor(d.getUTCMonth() / 3) + offset;
    return new Date(Date.UTC(d.getUTCFullYear(), q * 3, 1));
  }
  function rangeFor(value) {
    if (value === 'all') return [new Date(0), new Date(8640000000000000)];
    if (value === '90d') return [new Date(referenceDate.getTime() - 90 * 86400000), referenceDate];
    if (value === 'this-quarter') return [quarterStart(referenceDate), referenceDate];
    if (value === 'last-quarter') {
      const end = quarterStart(referenceDate);
      return [quarterStart(referenceDate, -1), end];
    }
    return [new Date(0), new Date(8640000000000000)];
  }
  function within(r, range) { const d = date(r.date); return d >= range[0] && d <= range[1]; }
  function count(rows, key) { return rows.reduce((out, row) => ((out[row[key]] = (out[row[key]] || 0) + 1), out), {}); }
  function pct(num, total) { return total ? Math.round((num / total) * 100) : 0; }
  function labelPeriod(value) { return ({ all: 'All captured history', '90d': 'Last 90 days', 'this-quarter': 'This quarter', 'last-quarter': 'Last quarter' })[value]; }
  function topEntry(object) { return Object.entries(object).sort((a, b) => b[1] - a[1])[0] || ['No signal yet', 0]; }

  function layout() {
    document.body.innerHTML = `<main class="shell">
      <nav class="nav"><a class="brand" href="#top">REVIEW<br>RADAR</a><div class="nav-meta">GO-TO-MARKET SIGNAL SYSTEM <span></span> SHOPIFY CHECKOUT</div><div class="live-dot">DAILY MONITORING</div></nav>
      <header id="top" class="hero"><div><p class="kicker">COMPETITOR INTELLIGENCE, MADE ACTIONABLE</p><h1>Know what<br>merchants <em>feel.</em></h1><p class="intro">A directional view of public review signals across checkout competitors. Filter the evidence, compare the companies, then decide what to investigate or test.</p></div><aside class="hero-note"><p>DATA STANDARD</p><strong>Public Shopify<br>merchant reviews</strong><small>Signals are evidence to investigate, not claims about every merchant.</small></aside></header>
      <section class="controls" aria-label="Dashboard filters"><div><label>COMPANY</label><select id="app-filter"><option value="all">All companies</option>${DATA.apps.map((a) => `<option value="${a.id}">${esc(a.name)}</option>`).join('')}</select></div><div><label>TIME WINDOW</label><select id="period-filter"><option value="all">All captured history</option><option value="this-quarter">This quarter</option><option value="last-quarter">Last quarter</option><option value="90d">Last 90 days</option></select></div><div><label>SENTIMENT</label><select id="sentiment-filter"><option value="all">All sentiment</option><option value="positive">Positive</option><option value="neutral">Neutral</option><option value="negative">Negative</option></select></div><div><label>THEME</label><select id="theme-filter"><option value="all">All themes</option>${[...new Set(DATA.reviews.map((r) => r.theme))].sort().map((t) => `<option value="${esc(t)}">${esc(t)}</option>`).join('')}</select></div><button id="reset">Reset</button></section>
      <section id="snapshot" class="metric-grid"></section>
      <section class="section-head"><div><p class="kicker">COMPANY COMPARISON</p><h2>Who is receiving<br>which signal?</h2></div><p id="comparison-caption" class="caption"></p></section>
      <section id="company-rows" class="company-rows"></section>
      <section class="split"><article class="panel"><div class="panel-heading"><div><p class="kicker">VOLUME OVER TIME</p><h3>Review pulse</h3></div><small>Count by month</small></div><div id="volume-chart" class="volume-chart"></div></article><article class="panel"><div class="panel-heading"><div><p class="kicker">SENTIMENT MIX</p><h3>Per company</h3></div><small>Positive · neutral · negative</small></div><div id="sentiment-chart" class="sentiment-chart"></div></article></section>
      <section class="section-head action-head"><div><p class="kicker">MARKETING LEADER VIEW</p><h2>What deserves<br>attention next?</h2></div><p class="caption">These are campaign hypotheses generated from review patterns. Validate with customer research before using them as claims.</p></section>
      <section id="actions" class="action-grid"></section>
      <section class="evidence"><div class="evidence-title"><p class="kicker">DATED SOURCE REVIEWS</p><h2>Read the<br>evidence.</h2><p>Latest public reviews matching your filters. Source links open Shopify.</p></div><div id="feed" class="feed"></div></section>
      <footer>REVIEW RADAR · PUBLIC SHOPIFY APP STORE SOURCES · GENERATED FROM THE TRACKER</footer>
    </main>`;
    ['app-filter', 'period-filter', 'sentiment-filter', 'theme-filter'].forEach((id) => $("#" + id).addEventListener('change', render));
    $('#reset').addEventListener('click', () => { ['app-filter', 'period-filter', 'sentiment-filter', 'theme-filter'].forEach((id) => { $('#' + id).value = 'all'; }); render(); });
  }

  function render() {
    const app = $('#app-filter').value;
    const period = $('#period-filter').value;
    const sentiment = $('#sentiment-filter').value;
    const theme = $('#theme-filter').value;
    const range = rangeFor(period);
    const scoped = DATA.reviews.filter((r) => (app === 'all' || r.appId === app) && within(r, range));
    const rows = scoped.filter((r) => (sentiment === 'all' || r.sentiment === sentiment) && (theme === 'all' || r.theme === theme));
    const negatives = rows.filter((r) => r.sentiment === 'negative').length;
    const positives = rows.filter((r) => r.sentiment === 'positive').length;
    const [topTheme, topThemeCount] = topEntry(count(rows, 'theme'));
    const stores = new Set(rows.map((r) => r.merchant)).size;
    $('#snapshot').innerHTML = [
      ['REVIEWS IN VIEW', rows.length, labelPeriod(period)],
      ['NEGATIVE SIGNAL', `${pct(negatives, rows.length)}%`, `${negatives} reviews`],
      ['TOP THEME', esc(topTheme), `${topThemeCount} mentions`],
      ['MERCHANT STORES', stores, 'Public reviewer names']
    ].map(([label, value, detail]) => `<article class="metric"><p>${label}</p><strong>${value}</strong><small>${detail}</small></article>`).join('');
    $('#comparison-caption').textContent = `${rows.length} reviews in the selected view · ${labelPeriod(period)}`;

    $('#company-rows').innerHTML = DATA.apps.map((company) => {
      const companyRows = rows.filter((r) => r.appId === company.id);
      const negative = companyRows.filter((r) => r.sentiment === 'negative').length;
      const positive = companyRows.filter((r) => r.sentiment === 'positive').length;
      const [themeName, themeCount] = topEntry(count(companyRows, 'theme'));
      const width = rows.length ? Math.max(4, (companyRows.length / Math.max(...DATA.apps.map((a) => rows.filter((r) => r.appId === a.id).length), 1)) * 100) : 0;
      return `<article class="company-row" style="--accent:${company.accent}"><div class="company-name"><i></i><div><p>${esc(company.name)}</p><small>${companyRows.length} reviews in view</small></div></div><div class="company-bar"><b style="width:${width}%"></b></div><div class="company-stat"><strong>${pct(negative, companyRows.length)}%</strong><span>negative</span></div><div class="company-stat"><strong>${esc(themeName)}</strong><span>${themeCount} mentions</span></div><div class="company-stat"><strong>${pct(positive, companyRows.length)}%</strong><span>positive</span></div></article>`;
    }).join('');

    const months = {};
    scoped.forEach((r) => { const key = iso(r.date).slice(0, 7); months[key] = (months[key] || 0) + 1; });
    const monthEntries = Object.entries(months).sort((a, b) => a[0].localeCompare(b[0])).slice(-10);
    const maxMonth = Math.max(1, ...monthEntries.map((x) => x[1]));
    $('#volume-chart').innerHTML = monthEntries.length ? monthEntries.map(([month, n]) => `<div class="month"><b style="height:${Math.max(8, (n / maxMonth) * 145)}px"></b><small>${month.slice(5)}</small><em>${n}</em></div>`).join('') : '<p class="empty">No review data matches these filters.</p>';

    $('#sentiment-chart').innerHTML = DATA.apps.map((company) => {
      const companyRows = rows.filter((r) => r.appId === company.id); const c = count(companyRows, 'sentiment'); const total = companyRows.length || 1;
      return `<div class="sentiment-row"><p>${esc(company.name)}</p><div class="stack"><b class="positive" style="width:${(c.positive || 0) / total * 100}%"></b><b class="neutral" style="width:${(c.neutral || 0) / total * 100}%"></b><b class="negative" style="width:${(c.negative || 0) / total * 100}%"></b></div><small>${c.positive || 0} positive · ${c.neutral || 0} neutral · ${c.negative || 0} negative</small></div>`;
    }).join('');

    const topThemes = Object.entries(count(rows.filter((r) => r.sentiment === 'negative'), 'theme')).sort((a, b) => b[1] - a[1]).slice(0, 3);
    const actionText = { support: ['Support responsiveness', 'Test proof points around faster resolution, onboarding help, or named support ownership.', 'Merchants reporting unresolved or slow assistance'], setup: ['Friction-free setup', 'Test an onboarding-led message: clear implementation, guided migration, and fast time to value.', 'Merchants discussing installs, integrations, or KYC'], conversion: ['Checkout confidence', 'Test a message around reducing checkout friction. Validate performance claims before publishing.', 'Merchants discussing payments, abandonment, or purchase completion'], pricing: ['Value clarity', 'Test transparent pricing and ROI education rather than unverified price comparisons.', 'Merchants mentioning cost, plans, or charges'], 'COD / RTO': ['COD / RTO control', 'Test practical education around fraud prevention and order-quality workflows.', 'COD merchants and teams managing return-to-origin risk'], 'product / other': ['Product reliability', 'Investigate the concrete product complaint before turning it into a campaign angle.', 'Merchants reporting product issues'] };
    $('#actions').innerHTML = topThemes.length ? topThemes.map(([themeName, n], i) => { const info = actionText[themeName] || actionText['product / other']; return `<article class="action-card"><span>0${i + 1}</span><p class="kicker">${esc(themeName)} · ${n} NEGATIVE REVIEWS</p><h3>${info[0]}</h3><p>${info[1]}</p><footer><b>Audience:</b> ${info[2]}</footer></article>`; }).join('') : '<p class="empty">No negative themes match these filters.</p>';

    $('#feed').innerHTML = rows.slice().sort((a, b) => date(b.date) - date(a.date)).slice(0, 20).map((r) => `<a class="feed-item" href="${esc(r.sourceUrl)}" target="_blank" rel="noreferrer"><div class="feed-meta"><time>${iso(r.date)}</time><span class="tag ${r.sentiment}">${esc(r.sentiment)}</span><span class="tag">${esc(r.theme)}</span></div><p>“${esc(r.text)}”</p><small>${esc(r.app)} · ${esc(r.merchant)} · ${r.rating}/5 <b>Open source ↗</b></small></a>`).join('') || '<p class="empty">No reviews match these filters.</p>';
  }
  layout(); render();
})();
