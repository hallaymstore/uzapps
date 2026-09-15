(() => {
  const state = { type: 'all', category: 'all', q: new URLSearchParams(location.search).get('q') || '', sort: 'popular', items: [], me: null };
  const $ = s => document.querySelector(s);
  const $$ = s => [...document.querySelectorAll(s)];
  const fmt = n => Intl.NumberFormat('uz-UZ', { notation: n >= 10000 ? 'compact' : 'standard', maximumFractionDigits: 1 }).format(Number(n || 0));
  const esc = s => String(s ?? '').replace(/[&<>'"]/g, c => ({ '&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;' }[c]));
  const typeLabel = t => ({ android:'Android', website:'Web', telegram:'Telegram', extension:'Chrome', windows:'Windows', other:'Boshqa' }[t] || t);
  const toast = msg => { const el = $('#toast'); if (!el) return; el.textContent = msg; el.classList.remove('hidden'); clearTimeout(window.__toast); window.__toast = setTimeout(() => el.classList.add('hidden'), 2200); };
  const scrollToEl = sel => document.querySelector(sel)?.scrollIntoView({ behavior:'smooth', block:'start' });

  function loadTheme(){
    const saved = localStorage.getItem('uzapps-theme');
    if (saved === 'light') document.body.classList.remove('dark');
    else document.body.classList.add('dark');
  }
  loadTheme();
  $('#themeBtn')?.addEventListener('click', () => {
    document.body.classList.toggle('dark');
    localStorage.setItem('uzapps-theme', document.body.classList.contains('dark') ? 'dark' : 'light');
  });
  if ($('#year')) $('#year').textContent = new Date().getFullYear();
  if ($('#searchInput')) $('#searchInput').value = state.q;

  async function api(url, options = {}) {
    const res = await fetch(url, { credentials:'same-origin', headers:{ 'Content-Type':'application/json', ...(options.headers || {}) }, ...options });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.error || 'Xatolik yuz berdi');
    return data;
  }

  async function loadMe(){
    try {
      const { user } = await api('/api/auth/me');
      state.me = user;
      if (!user) return;
      const target = user.role === 'admin' ? '/admin' : '/login';
      const label = user.role === 'admin' ? 'A' : String(user.name || 'U').trim().slice(0,1).toUpperCase();
      const account = $('#accountBtn');
      if (account) { account.textContent = label; account.href = target; account.title = user.role === 'admin' ? 'Admin panel' : user.name; }
      const profile = $('#bottomProfile');
      if (profile) { profile.href = target; profile.querySelector('small').textContent = user.role === 'admin' ? 'Admin' : 'Profil'; }
    } catch {}
  }

  function icon(item, cls='') {
    return `<div class="app-icon ${cls}">${item.iconUrl ? `<img src="${esc(item.iconUrl)}" alt="${esc(item.name)}" loading="lazy">` : esc(item.name.slice(0,2).toUpperCase())}</div>`;
  }
  function rating(item){ return item.ratingCount ? (Number(item.ratingSum || 0) / Number(item.ratingCount || 1)).toFixed(1) : 'Yangi'; }
  function itemCard(item){
    return `<a class="app-card" href="/item/${encodeURIComponent(item.slug)}">${icon(item)}<div><div class="card-title">${esc(item.name)} ${item.verified ? '<span class="verified">✓</span>' : ''}</div><div class="card-tag">${esc(item.tagline || item.category || '')}</div><div class="card-meta"><span>★ ${rating(item)}</span><span>↓ ${fmt(item.downloads)}</span><span>${esc(typeLabel(item.type))}</span></div></div></a>`;
  }
  function featureCard(item){
    return `<a class="feature-card" href="/item/${encodeURIComponent(item.slug)}"><span class="badge">${esc(typeLabel(item.type))} · ${esc(item.category)}</span><h3>${esc(item.name)}</h3><p>${esc(item.tagline || item.description || 'UZ APPS tavsiyasi')}</p></a>`;
  }
  function websiteCard(item){
    const preview = item.coverUrl || item.screenshots?.[0] || '';
    return `<a class="website-card" href="/item/${encodeURIComponent(item.slug)}"><div class="website-preview">${preview ? `<img src="${esc(preview)}" alt="${esc(item.name)} preview" loading="lazy">` : `<div class="preview-fallback">${esc(item.name.slice(0,1).toUpperCase())}</div>`}</div><div class="website-info"><h3>${esc(item.name)} ${item.verified ? '<span class="verified">✓</span>' : ''}</h3><p>${esc(item.tagline || item.category || '')}</p></div></a>`;
  }

  async function loadFeatured(){
    const el = $('#featuredList'); if (!el) return;
    try {
      const { items } = await api('/api/items?featured=1&limit=8&sort=updated');
      el.innerHTML = items.length ? items.map(featureCard).join('') : '<div class="empty">Tavsiya etilgan mahsulotlar tez orada.</div>';
    } catch (e) { el.innerHTML = `<div class="empty">${esc(e.message)}</div>`; }
  }

  async function loadCategories(){
    try {
      const { categories } = await api('/api/categories');
      const el = $('#categoryChips'); if (!el) return;
      el.innerHTML = `<button class="chip ${state.category === 'all' ? 'active' : ''}" data-category="all">Barchasi</button>` + categories.map(c => `<button class="chip ${state.category === c.name ? 'active' : ''}" data-category="${esc(c.name)}">${esc(c.name)} <small>${c.count}</small></button>`).join('');
      bindCategories();
    } catch {}
  }

  async function loadItems(){
    const el = $('#appGrid'); if (!el) return;
    const params = new URLSearchParams({ sort:state.sort, limit:'80' });
    if (state.type !== 'all') params.set('type', state.type);
    if (state.category !== 'all') params.set('category', state.category);
    if (state.q) params.set('q', state.q);
    el.innerHTML = '<div class="loading">Yuklanmoqda…</div>';
    try {
      const { items } = await api('/api/items?' + params.toString());
      state.items = items;
      el.innerHTML = items.length ? items.map(itemCard).join('') : '<div class="empty"><b>Hech narsa topilmadi.</b><br>Filtr yoki qidiruvni o‘zgartiring.</div>';
    } catch (e) { el.innerHTML = `<div class="empty">${esc(e.message)}</div>`; }
  }

  async function loadWebsites(){
    const el = $('#websiteGrid'); if (!el) return;
    try {
      const { items } = await api('/api/items?type=website&sort=updated&limit=8');
      el.innerHTML = items.length ? items.map(websiteCard).join('') : '<div class="empty">Websaytlar hali qo‘shilmagan.</div>';
    } catch (e) { el.innerHTML = `<div class="empty">${esc(e.message)}</div>`; }
  }

  function setType(type, shouldScroll=true){
    state.type = type || 'all';
    $$('.quick-type').forEach(x => x.classList.toggle('active', x.dataset.type === state.type));
    loadItems();
    if (shouldScroll) scrollToEl('#catalog');
  }
  function setBottom(name){ $$('.bottom-item').forEach(x => x.classList.toggle('active', x.dataset.nav === name)); }
  function bindCategories(){
    $$('#categoryChips .chip').forEach(btn => btn.addEventListener('click', () => {
      state.category = btn.dataset.category || 'all';
      $$('#categoryChips .chip').forEach(x => x.classList.toggle('active', x === btn));
      loadItems();
    }));
  }

  $$('.quick-type').forEach(btn => btn.addEventListener('click', () => setType(btn.dataset.type || 'all')));
  $('#sortSelect')?.addEventListener('change', e => { state.sort = e.target.value; loadItems(); });
  $('#searchForm')?.addEventListener('submit', e => {
    e.preventDefault();
    state.q = $('#searchInput').value.trim();
    const u = new URL(location.href);
    if (state.q) u.searchParams.set('q', state.q); else u.searchParams.delete('q');
    history.replaceState(null, '', u);
    loadItems(); setBottom('search'); scrollToEl('#catalog');
  });
  $('#allWebsitesBtn')?.addEventListener('click', () => { setType('website'); setBottom('web'); });
  $$('[data-scroll]').forEach(btn => btn.addEventListener('click', () => scrollToEl(btn.dataset.scroll)));

  $$('.bottom-item[data-scroll]').forEach(btn => btn.addEventListener('click', () => {
    setBottom(btn.dataset.nav); scrollToEl(btn.dataset.scroll);
  }));
  $$('.bottom-item[data-type-nav]').forEach(btn => btn.addEventListener('click', () => {
    setBottom(btn.dataset.nav); setType(btn.dataset.typeNav || 'all');
  }));
  $('#bottomSearch')?.addEventListener('click', () => {
    setBottom('search'); scrollToEl('#home');
    setTimeout(() => $('#searchInput')?.focus({ preventScroll:true }), 320);
  });
  $('#bottomProfile')?.addEventListener('click', () => setBottom('profile'));

  Promise.allSettled([loadMe(), loadFeatured(), loadCategories(), loadItems(), loadWebsites()]);
  if ('serviceWorker' in navigator) window.addEventListener('load', () => navigator.serviceWorker.register('/sw.js').catch(() => {}));
})();
