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

  function reviewList(rows, limit = 7) {
    return latest(rows).slice(0, limit).map((r) => `<a class="feed-item" href="${esc(r.sourceUrl)}" target="_blank" rel="noreferrer"><div class="feed-meta"><time>${day(r.date)}</time><span class="tag ${r.sentiment}">${esc(r.sentiment)}</span><span class="tag">${esc(r.theme)}</span></div><p>“${esc(r.text)}”</p><small>${esc(r.merchant)} · ${r.rating}/5 <b>Open Shopify review ↗</b></small></a>`).join('') || '<p class="empty">No captured reviews for this company yet.</p>';
  }
  function themeBars(rows) {
    const themes = Object.entries(count(rows, 'theme')).sort((a, b) => b[1] - a[1]), max = Math.max(1, ...themes.map((x) => x[1]));
    return themes.map(([name, n]) => `<div class="theme-bar"><span>${esc(name)}</span><i><b style="width:${n / max * 100}%"></b></i><em>${n}</em></div>`).join('') || '<p class="empty">No theme data yet.</p>';
  }
  function companyProfile(company) {
    const rows = byApp(company.id), neg = rows.filter((r) => r.sentiment === 'negative').length, pos = rows.filter((r) => r.sentiment === 'positive').length;
    const [theme, n] = top(negativeThemes(rows));
    return `<section class="company-profile"><header style="--accent:${company.accent}"><p class="kicker">COMPANY REVIEW INTELLIGENCE</p><h1>${esc(company.name)}</h1><p class="profile-summary">A structured view of public merchant feedback: review volume, sentiment, recurring themes, and the source evidence behind each signal.</p></header><div class="profile-metrics"><article><span>CAPTURED REVIEWS</span><strong>${rows.length}</strong><small>Unique public reviews</small></article><article><span>NEGATIVE SHARE</span><strong>${pct(neg, rows.length)}%</strong><small>${neg} negative reviews</small></article><article><span>POSITIVE SHARE</span><strong>${pct(pos, rows.length)}%</strong><small>${pos} positive reviews</small></article><article><span>MAIN NEGATIVE THEME</span><strong>${esc(theme)}</strong><small>${n} mentions</small></article></div><div class="profile-grid"><article class="panel"><p class="kicker">THEME BREAKDOWN</p><h2>What merchants mention</h2><div class="theme-bars">${themeBars(rows)}</div></article><article class="panel dark-panel"><p class="kicker">MARKETING IMPLICATION</p><h2>${esc(theme)}</h2><p>${action[theme] || action['product / other']}</p><small>This is an evidence-led hypothesis to validate before using it as a public campaign claim.</small></article></div><section class="profile-evidence"><div><p class="kicker">SOURCE EVIDENCE</p><h2>Merchant reviews</h2><p>Each item links back to the public Shopify review page.</p></div><div>${reviewList(rows)}</div></section></section>`;
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
