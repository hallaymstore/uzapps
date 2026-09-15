(() => {
  const state = { type: 'all', category: 'all', q: new URLSearchParams(location.search).get('q') || '', sort: 'popular', items: [], me: null };
  const $ = s => document.querySelector(s);
  const $$ = s => [...document.querySelectorAll(s)];
  const fmt = n => Intl.NumberFormat('uz-UZ', { notation: n >= 10000 ? 'compact' : 'standard', maximumFractionDigits: 1 }).format(Number(n || 0));
  const esc = s => String(s ?? '').replace(/[&<>'"]/g, c => ({ '&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;' }[c]));
  const typeLabel = t => ({ android:'Android', website:'Websayt', telegram:'Telegram', extension:'Chrome', windows:'Windows', other:'Boshqa' }[t] || t);
  const toast = msg => { const el = $('#toast'); if (!el) return; el.textContent = msg; el.classList.remove('hidden'); clearTimeout(window.__toast); window.__toast = setTimeout(() => el.classList.add('hidden'), 2600); };

  function loadTheme(){
    const t = localStorage.getItem('uzapps-theme');
    if (t === 'dark' || (!t && matchMedia('(prefers-color-scheme: dark)').matches)) document.body.classList.add('dark');
  }
  loadTheme();
  $('#themeBtn')?.addEventListener('click', () => { document.body.classList.toggle('dark'); localStorage.setItem('uzapps-theme', document.body.classList.contains('dark') ? 'dark' : 'light'); });
  $('#year').textContent = new Date().getFullYear();
  if ($('#searchInput')) $('#searchInput').value = state.q;

  async function api(url, options = {}) {
    const res = await fetch(url, { credentials: 'same-origin', headers: { 'Content-Type':'application/json', ...(options.headers || {}) }, ...options });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.error || 'Xatolik yuz berdi');
    return data;
  }

  async function loadMe(){
    try {
      const { user } = await api('/api/auth/me'); state.me = user;
      if (user) {
        $('#accountBtn').textContent = user.role === 'admin' ? 'Admin panel' : user.name.split(' ')[0];
        $('#accountBtn').href = user.role === 'admin' ? '/admin' : '/login';
      }
    } catch {}
  }

  function icon(item, cls = '') {
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
    try {
      const { items } = await api('/api/items?featured=1&limit=8&sort=updated');
      const el = $('#featuredList'); if (!el) return;
      el.innerHTML = items.length ? items.map(featureCard).join('') : '<div class="empty">Tavsiya etilgan mahsulotlar admin paneldan belgilanadi.</div>';
    } catch (e) { $('#featuredList').innerHTML = `<div class="empty">${esc(e.message)}</div>`; }
  }

  async function loadCategories(){
    try {
      const { categories } = await api('/api/categories');
      const el = $('#categoryChips'); if (!el) return;
      el.innerHTML = `<button class="chip ${state.category === 'all' ? 'active' : ''}" data-category="all">Barcha kategoriyalar</button>` + categories.map(c => `<button class="chip ${state.category === c.name ? 'active' : ''}" data-category="${esc(c.name)}">${esc(c.name)} <small>${c.count}</small></button>`).join('');
      bindCategory();
    } catch {}
  }

  async function loadItems(){
    const params = new URLSearchParams({ sort: state.sort, limit:'80' });
    if (state.type !== 'all') params.set('type', state.type);
    if (state.category !== 'all') params.set('category', state.category);
    if (state.q) params.set('q', state.q);
    $('#appGrid').innerHTML = '<div class="loading">Qidirilmoqda…</div>';
    try {
      const { items } = await api('/api/items?' + params.toString());
      state.items = items;
      $('#appGrid').innerHTML = items.length ? items.map(itemCard).join('') : '<div class="empty"><b>Hech narsa topilmadi.</b><br>Qidiruv yoki filtrni o‘zgartirib ko‘ring.</div>';
    } catch (e) { $('#appGrid').innerHTML = `<div class="empty">${esc(e.message)}</div>`; }
  }

  async function loadWebsites(){
    try {
      const { items } = await api('/api/items?type=website&sort=updated&limit=6');
      $('#websiteGrid').innerHTML = items.length ? items.map(websiteCard).join('') : '<div class="empty">Websaytlar hali qo‘shilmagan.</div>';
    } catch (e) { $('#websiteGrid').innerHTML = `<div class="empty">${esc(e.message)}</div>`; }
  }

  function bindCategory(){
    $$('#categoryChips .chip').forEach(btn => btn.addEventListener('click', () => {
      state.category = btn.dataset.category || 'all';
      $$('#categoryChips .chip').forEach(x => x.classList.toggle('active', x === btn));
      loadItems();
    }));
  }

  $$('#typeTabs .type-tab').forEach(btn => btn.addEventListener('click', () => {
    state.type = btn.dataset.type || 'all';
    $$('#typeTabs .type-tab').forEach(x => x.classList.toggle('active', x === btn));
    loadItems();
  }));
  $('#sortSelect')?.addEventListener('change', e => { state.sort = e.target.value; loadItems(); });
  $('#searchForm')?.addEventListener('submit', e => {
    e.preventDefault(); state.q = $('#searchInput').value.trim();
    const u = new URL(location.href); if (state.q) u.searchParams.set('q', state.q); else u.searchParams.delete('q'); history.replaceState(null, '', u);
    loadItems(); document.querySelector('#catalog')?.scrollIntoView({ behavior:'smooth' });
  });
  $('#allWebsitesBtn')?.addEventListener('click', () => {
    state.type = 'website'; $$('#typeTabs .type-tab').forEach(x => x.classList.toggle('active', x.dataset.type === 'website')); loadItems(); document.querySelector('#catalog')?.scrollIntoView({ behavior:'smooth' });
  });

  Promise.allSettled([loadMe(), loadFeatured(), loadCategories(), loadItems(), loadWebsites()]);
  if ('serviceWorker' in navigator) window.addEventListener('load', () => navigator.serviceWorker.register('/sw.js').catch(() => {}));
})();
