(() => {
  const DATA = window.TRACKER_DATA || { reviews: [], validation: [], apps: [] };
  DATA.reviews = Array.from(new Map(DATA.reviews.map((r) => [`${r.appId}|${r.merchant}|${String(r.text).slice(0, 160)}`, r])).values());
  const $ = (s) => document.querySelector(s);
  const esc = (v) => String(v ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const d = (v) => new Date(v);
  const day = (v) => d(v).toISOString().slice(0, 10);
  const count = (rows, key) => rows.reduce((o, r) => ((o[r[key]] = (o[r[key]] || 0) + 1), o), {});
  const pct = (a, total) => total ? Math.round((a / total) * 100) : 0;
  const top = (input) => (Array.isArray(input) ? input : Object.entries(input)).sort((a, b) => b[1] - a[1])[0] || ['No signal yet', 0];
  const latest = (rows) => rows.slice().sort((a, b) => d(b.date) - d(a.date));
  const byApp = (id) => DATA.reviews.filter((r) => r.appId === id);
  const negativeThemes = (rows) => Object.entries(count(rows.filter((r) => r.sentiment === 'negative'), 'theme')).sort((a, b) => b[1] - a[1]);
  const action = { support: 'Test proof points around responsive support, implementation help, or named ownership.', setup: 'Test an onboarding-led story: guided migration, integration clarity, and fast time to value.', conversion: 'Investigate checkout friction, then test a message around a more confident purchase journey.', pricing: 'Test transparent value education. Do not make price comparisons without current evidence.', 'COD / RTO': 'Test practical education around order-quality, fraud prevention, and RTO workflows.', 'product / other': 'Investigate the exact product issue before turning it into a campaign message.' };

  function reviewList(rows, limit = Infinity) {
    return latest(rows).slice(0, limit).map((r) => `<a class="feed-item" href="${esc(r.sourceUrl)}" target="_blank" rel="noreferrer"><div class="feed-meta"><time>${day(r.date)}</time><span class="tag ${r.sentiment}">${esc(r.sentiment)}</span><span class="tag">${esc(r.theme)}</span></div><p>“${esc(r.text)}”</p><small>${esc(r.merchant)} · ${r.rating}/5 <b>Open Shopify review ↗</b></small></a>`).join('') || '<p class="empty">No captured reviews for this company yet.</p>';
  }
  function themeBars(rows) {
    const themes = Object.entries(count(rows, 'theme')).sort((a, b) => b[1] - a[1]), max = Math.max(1, ...themes.map((x) => x[1]));
    if (!themes.length) return '<p class="empty">No theme data yet.</p>';
    return `<div class="signal-key"><span>👍 praised</span><span>😐 mixed</span><span>👎 poor</span></div>${themes.map(([name, n]) => {
      const signals = count(rows.filter((r) => r.theme === name), 'sentiment');
      const good = signals.positive || 0, mixed = signals.neutral || 0, poor = signals.negative || 0;
      return `<div class="theme-bar rich"><div><strong>${esc(name)}</strong><small>👍 ${good} &nbsp; 😐 ${mixed} &nbsp; 👎 ${poor}</small></div><i><b class="good" style="width:${good / n * 100}%"></b><b class="mixed" style="width:${mixed / n * 100}%"></b><b class="poor" style="width:${poor / n * 100}%"></b></i><em>${n}</em></div>`;
    }).join('')}`;
  }
  function starDistribution(rows) {
    const stars = count(rows, 'rating'), max = Math.max(1, ...[1, 2, 3, 4, 5].map((rating) => stars[rating] || 0));
    return `<div class="star-list">${[5, 4, 3, 2, 1].map((rating) => { const n = stars[rating] || 0; return `<div class="star-row"><span>${'★'.repeat(rating)}${'☆'.repeat(5 - rating)}</span><i><b style="width:${n / max * 100}%"></b></i><em>${n}</em></div>`; }).join('')}</div>`;
  }
  function quickRead(rows) {
    const positives = Object.entries(count(rows.filter((r) => r.sentiment === 'positive'), 'theme')).sort((a, b) => b[1] - a[1]);
    const negatives = negativeThemes(rows), [goodTheme, goodN] = positives[0] || ['No positive theme', 0], [badTheme, badN] = negatives[0] || ['No negative theme', 0];
    const high = rows.filter((r) => r.rating >= 4).length, low = rows.filter((r) => r.rating <= 2).length;
    return `<section class="quick-read"><p class="kicker">MESSAGE ALIGNMENT READOUT</p><h2>What the reviews say to lead with.</h2><ul><li><b>Strongest proof point:</b> ${esc(goodTheme)} is praised in ${goodN} captured review${goodN === 1 ? '' : 's'}.</li><li><b>Biggest message risk:</b> ${esc(badTheme)} is criticised in ${badN} review${badN === 1 ? '' : 's'}; do not make an unsupported claim here.</li><li><b>Star reality:</b> ${pct(high, rows.length)}% are 4–5 star and ${pct(low, rows.length)}% are 1–2 star.</li><li><b>Campaign use:</b> turn recurring positive phrases into landing-page and ad hypotheses, then open the linked reviews before publishing a customer claim.</li></ul></section>`;
  }
  function scanHistory(company) {
    const runs = DATA.runs || [], run = runs[0], perApp = (DATA.runApps || []).find((row) => row.runId === run?.id && row.appId === company.id);
    if (!run) return '<section class="scan-history panel"><p class="kicker">SCAN HISTORY</p><h2>No scan recorded yet</h2></section>';
    const stamp = new Intl.DateTimeFormat('en-GB', { dateStyle: 'medium', timeStyle: 'short', timeZone: 'Asia/Kolkata' }).format(d(run.ranAt));
    const duration = run.durationMs ? `${Math.max(1, Math.round(run.durationMs / 1000))} sec` : 'Not recorded for this historical scan';
    const change = perApp ? (perApp.newReviews ? `+${perApp.newReviews} new review${perApp.newReviews === 1 ? '' : 's'}` : 'No new reviews') : 'Company-level change was not recorded';
    return `<section class="scan-history panel"><div><p class="kicker">SCAN HISTORY</p><h2>Latest collection check</h2><p class="scan-note">The scraper revisits the same public pages. A review is identified by its Shopify date, merchant and text, so repeated cards are updated—not counted twice.</p></div><div class="scan-stats"><article><span>LAST SCAN</span><strong>${esc(stamp)}</strong><small>${esc(run.status)}</small></article><article><span>RUN TIME</span><strong>${esc(duration)}</strong><small>${run.collected} review cards checked</small></article><article class="scan-change"><span>WHAT CHANGED</span><strong>${esc(change)}</strong><small>${esc(perApp?.detail || run.detail || 'Historical scan')}</small></article></div></section>`;
  }
  function heatmap(rows) {
    const keys = [...new Set(rows.map((r) => day(r.date).slice(0, 7)))].sort().slice(-12), themes = Object.entries(count(rows, 'theme')).sort((a,b) => b[1] - a[1]).map(([theme]) => theme);
    if (!keys.length) return '<section class="review-heatmap panel"><p class="kicker">REVIEW WEATHER</p><h2>No dated reviews yet</h2></section>';
    const label = (key) => new Intl.DateTimeFormat('en', { month: 'short', year: '2-digit', timeZone: 'UTC' }).format(new Date(`${key}-01T00:00:00Z`));
    return `<section class="review-heatmap panel"><div><p class="kicker">REVIEW WEATHER</p><h2>Monthly review condition</h2><p>Each square is a theme in a review month. Green means more positive ratings; coral means more negative ratings. Darker squares mean more review volume.</p></div><div class="heat-key"><span class="good"></span> more good <span class="poor"></span> more bad <span class="quiet"></span> no reviews</div><div class="heat-grid" style="grid-template-columns:120px repeat(${keys.length}, minmax(31px, 1fr))"><div></div>${keys.map((key) => `<div class="heat-month">${label(key)}</div>`).join('')}${themes.map((theme) => `<div class="heat-theme">${esc(theme)}</div>${keys.map((key) => { const cell = rows.filter((r) => r.theme === theme && day(r.date).slice(0, 7) === key), good = cell.filter((r) => r.sentiment === 'positive').length, poor = cell.filter((r) => r.sentiment === 'negative').length, total = cell.length; const mood = !total ? 'quiet' : good > poor ? 'good' : poor > good ? 'poor' : 'mixed'; const intensity = total ? Math.min(.95, .22 + total / Math.max(1, rows.length / 18)) : 0; return `<div class="heat-cell ${mood}" style="--heat:${intensity}" title="${esc(`${label(key)} · ${theme}: ${total} review${total === 1 ? '' : 's'}, ${good} good, ${poor} bad`)}">${total || ''}</div>`; }).join('')}`).join('')}</div></section>`;
  }
  function companyProfile(company) {
    const rows = byApp(company.id), neg = rows.filter((r) => r.sentiment === 'negative').length, pos = rows.filter((r) => r.sentiment === 'positive').length;
    const [theme, n] = top(negativeThemes(rows));
    return `<section class="company-profile"><header style="--accent:${company.accent}"><p class="kicker">COMPANY REVIEW INTELLIGENCE</p><h1>${esc(company.name)}</h1><p class="profile-summary">A structured view of public merchant feedback: review volume, sentiment, recurring themes, star ratings, and every captured source review.</p></header>${scanHistory(company)}<div class="profile-metrics"><article><span>CAPTURED REVIEWS</span><strong>${rows.length}</strong><small>Unique public reviews</small></article><article><span>NEGATIVE SHARE</span><strong>${pct(neg, rows.length)}%</strong><small>${neg} negative reviews</small></article><article><span>POSITIVE SHARE</span><strong>${pct(pos, rows.length)}%</strong><small>${pos} positive reviews</small></article><article><span>MAIN NEGATIVE THEME</span><strong>${esc(theme)}</strong><small>${n} mentions</small></article></div><div class="profile-grid"><article class="panel"><p class="kicker">THEME BREAKDOWN</p><h2>Praised or poor?</h2><div class="theme-bars">${themeBars(rows)}</div></article><article class="panel star-panel"><p class="kicker">STAR BREAKDOWN</p><h2>How merchants rate it</h2>${starDistribution(rows)}</article></div>${quickRead(rows)}<section class="profile-evidence"><div><p class="kicker">COMPLETE SOURCE EVIDENCE</p><h2>All ${rows.length} captured reviews</h2><p>Every item links back to the public Shopify review page.</p></div><div>${reviewList(rows)}</div></section>${heatmap(rows)}</section>`;
  }
  function comparison() {
    const cards = DATA.apps.map((company) => {
      const rows = byApp(company.id), neg = rows.filter((r) => r.sentiment === 'negative').length, pos = rows.filter((r) => r.sentiment === 'positive').length;
      const [negTheme, negN] = top(negativeThemes(rows)), newest = latest(rows)[0];
      return `<article class="compare-card" style="--accent:${company.accent}"><header><i></i><h2>${esc(company.name)}</h2></header><dl><div><dt>Captured reviews</dt><dd>${rows.length}</dd></div><div><dt>Negative share</dt><dd class="coral">${pct(neg, rows.length)}%</dd></div><div><dt>Positive share</dt><dd>${pct(pos, rows.length)}%</dd></div><div><dt>Top negative theme</dt><dd>${esc(negTheme)}</dd><small>${negN} mentions</small></div><div><dt>Latest review</dt><dd>${newest ? day(newest.date) : '—'}</dd></div></dl><footer><b>What to investigate</b><p>${action[negTheme] || action['product / other']}</p></footer></article>`;
    }).join('');
    const themes = [...new Set(DATA.reviews.map((r) => r.theme))].sort();
    return `<section class="comparison"><div class="page-heading"><p class="kicker">COMPANY COMPARE</p><h1>Compare the<br>companies.</h1><p>Side-by-side review signals using the same sentiment and theme taxonomy for every brand.</p></div><div class="compare-grid">${cards}</div><section class="panel comparison-table"><p class="kicker">THEME COMPARISON</p><h2>Where negative signals cluster</h2><div class="theme-matrix"><div class="matrix-label">Theme</div>${DATA.apps.map((a) => `<div class="matrix-head">${esc(a.name)}</div>`).join('')}${themes.map((theme) => `<div class="matrix-label">${esc(theme)}</div>${DATA.apps.map((a) => `<div class="matrix-cell">${byApp(a.id).filter((r) => r.sentiment === 'negative' && r.theme === theme).length || '—'}</div>`).join('')}`).join('')}</div></section></section>`;
  }
  function selectCompany(id) {
    const company = DATA.apps.find((a) => a.id === id) || DATA.apps[0];
    $('#company-panel').innerHTML = companyProfile(company);
    $('#company-label').textContent = company.name;
    $('#company-menu').setAttribute('aria-expanded', 'false');
    $('#company-list').hidden = true;
    $('#company-panel').classList.add('active');
    $('#compare-panel').classList.remove('active');
    $('#compare-button').classList.remove('active');
    $('#company-menu').classList.add('active');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }
  function showCompare() {
    $('#company-panel').classList.remove('active');
    $('#compare-panel').classList.add('active');
    $('#company-menu').classList.remove('active');
    $('#compare-button').classList.add('active');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }
  function layout() {
    document.body.innerHTML = `<main class="shell"><nav class="nav"><a class="brand" href="#top">REVIEW<br>RADAR</a><div class="nav-actions"><div class="company-menu-wrap"><button id="company-menu" class="nav-action active" aria-expanded="false"><span id="company-label">Companies</span><b>⌄</b></button><div id="company-list" class="company-list" hidden>${DATA.apps.map((a) => `<button data-company="${a.id}"><i style="background:${a.accent}"></i>${esc(a.name)}</button>`).join('')}</div></div><button id="compare-button" class="nav-action">Company Compare</button></div></nav><div id="top"></div><div id="company-panel" class="tab-panel active"></div><div id="compare-panel" class="tab-panel">${comparison()}</div><footer>REVIEW RADAR · PUBLIC SHOPIFY APP STORE SOURCES</footer></main>`;
    $('#company-menu').addEventListener('click', () => { const open = $('#company-list').hidden; $('#company-list').hidden = !open; $('#company-menu').setAttribute('aria-expanded', String(open)); });
    document.querySelectorAll('[data-company]').forEach((button) => button.addEventListener('click', () => selectCompany(button.dataset.company)));
    $('#compare-button').addEventListener('click', showCompare);
    selectCompany(DATA.apps[0]?.id);
  }
  layout();
})();
