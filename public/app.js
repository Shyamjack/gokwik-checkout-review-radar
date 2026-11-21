(() => {
  const DATA = window.TRACKER_DATA || { reviews: [], validation: [], apps: [] };
  DATA.reviews = Array.from(new Map(DATA.reviews.map((r) => [`${r.appId}|${r.merchant}|${String(r.text).slice(0, 160)}`, r])).values());
  const $ = (s) => document.querySelector(s);
  const esc = (v) => String(v ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const d = (v) => new Date(v);
  const day = (v) => d(v).toISOString().slice(0, 10);
  const count = (rows, key) => rows.reduce((o, r) => ((o[r[key]] = (o[r[key]] || 0) + 1), o), {});
  const pct = (a, total) => total ? Math.round((a / total) * 100) : 0;
  const top = (obj) => (Array.isArray(obj) ? obj : Object.entries(obj)).sort((a, b) => b[1] - a[1])[0] || ['No signal yet', 0];
  const latest = (rows) => rows.slice().sort((a, b) => d(b.date) - d(a.date));
  const byApp = (id) => DATA.reviews.filter((r) => r.appId === id);
  const negativeThemes = (rows) => Object.entries(count(rows.filter((r) => r.sentiment === 'negative'), 'theme')).sort((a, b) => b[1] - a[1]);
  const action = {
    support: 'Test proof points around responsive support, implementation help, or named ownership.',
    setup: 'Test an onboarding-led story: guided migration, integration clarity, and fast time to value.',
    conversion: 'Investigate checkout friction, then test a message around a more confident purchase journey.',
    pricing: 'Test transparent value education. Do not make price comparisons without current evidence.',
    'COD / RTO': 'Test practical education around order-quality, fraud prevention, and RTO workflows.',
    'product / other': 'Investigate the exact product issue before turning it into a campaign message.'
  };

  function companyCard(company) {
    const rows = byApp(company.id), neg = rows.filter((r) => r.sentiment === 'negative').length, pos = rows.filter((r) => r.sentiment === 'positive').length;
    const [theme, n] = top(negativeThemes(rows));
    return `<button class="company-card" data-tab="company-${company.id}" style="--accent:${company.accent}"><span>OPEN COMPANY VIEW ↗</span><h3>${esc(company.name)}</h3><div><strong>${rows.length}</strong><small>captured reviews</small></div><p><b>${pct(neg, rows.length)}%</b> negative · <b>${pct(pos, rows.length)}%</b> positive</p><footer>Top negative theme: ${esc(theme)} · ${n} mentions</footer></button>`;
  }
  function reviewList(rows, limit = 4) {
    return latest(rows).slice(0, limit).map((r) => `<a class="feed-item" href="${esc(r.sourceUrl)}" target="_blank" rel="noreferrer"><div class="feed-meta"><time>${day(r.date)}</time><span class="tag ${r.sentiment}">${esc(r.sentiment)}</span><span class="tag">${esc(r.theme)}</span></div><p>“${esc(r.text)}”</p><small>${esc(r.merchant)} · ${r.rating}/5 <b>Open source ↗</b></small></a>`).join('') || '<p class="empty">No captured reviews yet.</p>';
  }
  function themeBars(rows) {
    const themes = Object.entries(count(rows, 'theme')).sort((a, b) => b[1] - a[1]);
    const max = Math.max(1, ...themes.map((x) => x[1]));
    return themes.map(([name, n]) => `<div class="theme-bar"><span>${esc(name)}</span><i><b style="width:${n / max * 100}%"></b></i><em>${n}</em></div>`).join('') || '<p class="empty">No theme data yet.</p>';
  }
  function profile(company) {
    const rows = byApp(company.id), neg = rows.filter((r) => r.sentiment === 'negative').length, pos = rows.filter((r) => r.sentiment === 'positive').length;
    const [theme, n] = top(negativeThemes(rows));
    return `<section class="company-profile" id="company-${company.id}"><header style="--accent:${company.accent}"><p class="kicker">COMPANY SIGNAL PROFILE</p><h2>${esc(company.name)}</h2><p class="profile-summary">${rows.length} captured public reviews. ${neg} are negative and ${pos} are positive in the current dataset.</p></header><div class="profile-metrics"><article><span>NEGATIVE SHARE</span><strong>${pct(neg, rows.length)}%</strong><small>${neg} reviews</small></article><article><span>POSITIVE SHARE</span><strong>${pct(pos, rows.length)}%</strong><small>${pos} reviews</small></article><article><span>MAIN NEGATIVE THEME</span><strong>${esc(theme)}</strong><small>${n} negative mentions</small></article></div><div class="profile-grid"><article class="panel"><p class="kicker">THEME BREAKDOWN</p><h3>What merchants talk about</h3><div class="theme-bars">${themeBars(rows)}</div></article><article class="panel dark-panel"><p class="kicker">CAMPAIGN HYPOTHESIS</p><h3>${esc(theme)}</h3><p>${action[theme] || action['product / other']}</p><small>This is an evidence-led hypothesis, not a published competitor claim.</small></article></div><section class="profile-evidence"><div><p class="kicker">LATEST EVIDENCE</p><h3>Source reviews</h3></div><div>${reviewList(rows, 5)}</div></section></section>`;
  }
  function comparison() {
    const cells = DATA.apps.map((company) => {
      const rows = byApp(company.id), neg = rows.filter((r) => r.sentiment === 'negative').length, pos = rows.filter((r) => r.sentiment === 'positive').length;
      const [negTheme, negN] = top(negativeThemes(rows)); const newest = latest(rows)[0];
      return `<article class="compare-card" style="--accent:${company.accent}"><header><i></i><h3>${esc(company.name)}</h3></header><dl><div><dt>Captured reviews</dt><dd>${rows.length}</dd></div><div><dt>Negative share</dt><dd class="coral">${pct(neg, rows.length)}%</dd></div><div><dt>Positive share</dt><dd>${pct(pos, rows.length)}%</dd></div><div><dt>Top negative theme</dt><dd>${esc(negTheme)}</dd><small>${negN} mentions</small></div><div><dt>Most recent signal</dt><dd>${newest ? day(newest.date) : '—'}</dd></div></dl><footer><b>What to investigate</b><p>${action[negTheme] || action['product / other']}</p></footer></article>`;
    }).join('');
    return `<section id="compare" class="comparison"><div class="section-head"><div><p class="kicker">SIDE-BY-SIDE VIEW</p><h2>Compare the<br>companies.</h2></div><p class="caption">The same review taxonomy is used for every company. Low review volume should be treated as directional, not conclusive.</p></div><div class="compare-grid">${cells}</div><section class="panel comparison-table"><p class="kicker">THEME COMPARISON</p><h3>Where negative signals cluster</h3><div class="theme-matrix"><div class="matrix-label">Theme</div>${DATA.apps.map((a) => `<div class="matrix-head">${esc(a.name)}</div>`).join('')}${[...new Set(DATA.reviews.map((r) => r.theme))].sort().map((theme) => `<div class="matrix-label">${esc(theme)}</div>${DATA.apps.map((a) => `<div class="matrix-cell">${byApp(a.id).filter((r) => r.sentiment === 'negative' && r.theme === theme).length || '—'}</div>`).join('')}`).join('')}</div></section></section>`;
  }
  function overview() {
    const neg = DATA.reviews.filter((r) => r.sentiment === 'negative').length;
    const [mainTheme, mainCount] = top(negativeThemes(DATA.reviews));
    const checked = DATA.validation.filter((v) => v.manualSentiment === v.sentiment && v.manualTheme === v.theme).length;
    return `<section id="overview" class="overview"><div class="metric-grid"><article class="metric"><p>CAPTURED REVIEWS</p><strong>${DATA.reviews.length}</strong><small>Across three checkout apps</small></article><article class="metric"><p>NEGATIVE SIGNAL</p><strong>${pct(neg, DATA.reviews.length)}%</strong><small>${neg} reviews</small></article><article class="metric"><p>TOP NEGATIVE THEME</p><strong>${esc(mainTheme)}</strong><small>${mainCount} mentions</small></article><article class="metric"><p>TAGGING AUDIT</p><strong>${checked}/${DATA.validation.length}</strong><small>Exact sentiment + theme matches</small></article></div><div class="section-head"><div><p class="kicker">COMPANY SNAPSHOT</p><h2>Three views.<br>One market.</h2></div><p class="caption">Start here for the market picture. Open each company for its own breakdown, or use Compare for the side-by-side view.</p></div><div class="company-card-grid">${DATA.apps.map(companyCard).join('')}</div><section class="overview-grid"><article class="panel"><p class="kicker">MARKET-WIDE THEME MIX</p><h3>What merchants mention</h3><div class="theme-bars">${themeBars(DATA.reviews)}</div></article><article class="panel dark-panel"><p class="kicker">MARKETING LEADER NOTE</p><h3>Most visible friction: ${esc(mainTheme)}</h3><p>${action[mainTheme] || action['product / other']}</p><small>Use review patterns to prioritise research and message testing. Do not turn individual reviews into universal product claims.</small></article></section></section>`;
  }
  function explorer() {
    return `<section id="explore" class="explorer"><div class="section-head"><div><p class="kicker">DEEPER EXPLORATION</p><h2>Slice the<br>evidence.</h2></div><p class="caption">Filters live here so they support investigation without getting in the way of the leadership overview.</p></div><div class="controls"><div><label>COMPANY</label><select id="app-filter"><option value="all">All companies</option>${DATA.apps.map((a) => `<option value="${a.id}">${esc(a.name)}</option>`).join('')}</select></div><div><label>SENTIMENT</label><select id="sentiment-filter"><option value="all">All sentiment</option><option value="positive">Positive</option><option value="neutral">Neutral</option><option value="negative">Negative</option></select></div><div><label>THEME</label><select id="theme-filter"><option value="all">All themes</option>${[...new Set(DATA.reviews.map((r) => r.theme))].sort().map((t) => `<option value="${esc(t)}">${esc(t)}</option>`).join('')}</select></div><button id="reset">Reset</button></div><div id="explore-summary" class="explore-summary"></div><div id="explore-feed" class="feed"></div></section>`;
  }
  function layout() {
    document.body.innerHTML = `<main class="shell"><nav class="nav"><a class="brand" href="#top">REVIEW<br>RADAR</a><div class="tabs" role="tablist"><button class="tab active" data-tab="overview">Overview</button><button class="tab" data-tab="companies">Companies</button><button class="tab" data-tab="compare">Compare</button><button class="tab" data-tab="explore">Explore</button></div><div class="live-dot">DAILY MONITORING</div></nav><header id="top" class="hero"><div><p class="kicker">COMPETITOR INTELLIGENCE, MADE ACTIONABLE</p><h1>Know what<br>merchants <em>feel.</em></h1><p class="intro">A structured view of public checkout reviews for marketing, product, and customer-experience teams.</p></div><aside class="hero-note"><p>DATA STANDARD</p><strong>Public Shopify<br>merchant reviews</strong><small>Signals are evidence to investigate, not claims about every merchant.</small></aside></header><div id="tab-overview" class="tab-panel active">${overview()}</div><div id="tab-companies" class="tab-panel">${DATA.apps.map(profile).join('')}</div><div id="tab-compare" class="tab-panel">${comparison()}</div><div id="tab-explore" class="tab-panel">${explorer()}</div><footer>REVIEW RADAR · PUBLIC SHOPIFY APP STORE SOURCES · GENERATED FROM THE TRACKER</footer></main>`;
    document.querySelectorAll('.tab').forEach((button) => button.addEventListener('click', () => show(button.dataset.tab)));
    document.querySelectorAll('[data-tab^="company-"]').forEach((button) => button.addEventListener('click', () => show('companies')));
    ['app-filter','sentiment-filter','theme-filter'].forEach((id) => $('#' + id).addEventListener('change', renderExplore));
    $('#reset').addEventListener('click', () => { ['app-filter','sentiment-filter','theme-filter'].forEach((id) => { $('#' + id).value = 'all'; }); renderExplore(); });
    renderExplore();
  }
  function show(tab) {
    document.querySelectorAll('.tab').forEach((b) => b.classList.toggle('active', b.dataset.tab === tab));
    document.querySelectorAll('.tab-panel').forEach((p) => p.classList.toggle('active', p.id === 'tab-' + tab));
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }
  function renderExplore() {
    const app = $('#app-filter').value, sentiment = $('#sentiment-filter').value, theme = $('#theme-filter').value;
    const rows = DATA.reviews.filter((r) => (app === 'all' || r.appId === app) && (sentiment === 'all' || r.sentiment === sentiment) && (theme === 'all' || r.theme === theme));
    $('#explore-summary').innerHTML = `<strong>${rows.length}</strong><span>reviews match this investigation</span><span>${rows.filter((r) => r.sentiment === 'negative').length} negative</span>`;
    $('#explore-feed').innerHTML = reviewList(rows, 40);
  }
  layout();
})();
