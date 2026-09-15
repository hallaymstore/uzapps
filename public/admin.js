(() => {
  const $ = s => document.querySelector(s);
  const $$ = s => [...document.querySelectorAll(s)];
  const state = { items: [], me: null, editing: null };
  const esc = s => String(s ?? '').replace(/[&<>'"]/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[c]));
  const fmt = n => Intl.NumberFormat('uz-UZ').format(Number(n || 0));
  const toast = msg => { const el = $('#toast'); el.textContent = msg; el.classList.remove('hidden'); clearTimeout(window.__t); window.__t = setTimeout(() => el.classList.add('hidden'), 2600); };
  async function api(url, options = {}) {
    const isForm = options.body instanceof FormData;
    const res = await fetch(url, { credentials:'same-origin', headers: isForm ? {} : {'Content-Type':'application/json', ...(options.headers||{})}, ...options });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.error || `HTTP ${res.status}`);
    return data;
  }
  function typeLabel(t){ return ({android:'Android',website:'Websayt',telegram:'Telegram bot',extension:'Chrome extension',windows:'Windows',other:'Boshqa'}[t] || t); }
  async function ensureAdmin(){
    try { const {user} = await api('/api/auth/me'); if (!user || user.role !== 'admin') return location.href='/login'; state.me=user; }
    catch { return location.href='/login'; }
  }
  async function loadStats(){
    try {
      const s = await api('/api/admin/stats');
      $('#statItems').textContent = fmt(s.items); $('#statUsers').textContent = fmt(s.users); $('#statDownloads').textContent = fmt(s.downloads); $('#statViews').textContent = fmt(s.views);
      $('#storageStatus').textContent = s.r2 ? 'Cloudflare R2 ulangan ✓' : 'R2 ENV hali ulanmagan — URL orqali qo‘shish ishlaydi';
      $('#recentList').innerHTML = s.recent?.length ? s.recent.map(x => `<div style="display:grid;grid-template-columns:1fr auto auto;gap:14px;padding:12px 0;border-bottom:1px solid var(--line)"><b>${esc(x.name)}</b><span style="color:var(--muted)">${esc(typeLabel(x.type))}</span><span style="color:var(--muted)">↓ ${fmt(x.downloads)} · 👁 ${fmt(x.views)}</span></div>`).join('') : '<div class="empty">Hali mahsulot yo‘q.</div>';
    } catch(e){ toast(e.message); }
  }
  async function loadItems(){
    try { const {items} = await api('/api/admin/items'); state.items=items; renderItems(); }
    catch(e){ $('#itemsTableWrap').innerHTML=`<div class="empty">${esc(e.message)}</div>`; }
  }
  function renderItems(){
    const q = ($('#adminSearch')?.value || '').trim().toLowerCase();
    const items = state.items.filter(x => !q || [x.name,x.type,x.category,x.slug].join(' ').toLowerCase().includes(q));
    $('#itemsTableWrap').innerHTML = items.length ? `<table class="admin-table"><thead><tr><th>Nomi</th><th>Turi</th><th>Kategoriya</th><th>Download</th><th>View</th><th>Status</th><th></th></tr></thead><tbody>${items.map(x => `<tr><td><b>${esc(x.name)}</b><br><small style="color:var(--muted)">/${esc(x.slug)}</small></td><td>${esc(typeLabel(x.type))}</td><td>${esc(x.category||'—')}</td><td>${fmt(x.downloads)}</td><td>${fmt(x.views)}</td><td>${x.published?'<span class="type-pill">Published</span>':'Draft'} ${x.featured?'★':''}</td><td><div class="mini-actions"><a class="ghost-btn" style="padding:7px 9px" href="/item/${encodeURIComponent(x.slug)}" target="_blank">↗</a><button data-edit="${x._id}">Tahrir</button><button class="danger" data-del="${x._id}">O‘chirish</button></div></td></tr>`).join('')}</tbody></table>` : '<div class="empty">Mahsulot topilmadi.</div>';
    $$('[data-edit]').forEach(b => b.onclick = () => openModal(state.items.find(x => x._id === b.dataset.edit)));
    $$('[data-del]').forEach(b => b.onclick = () => removeItem(b.dataset.del));
  }
  function val(id,v=''){ const el=$(id); if(el) el.value=v ?? ''; }
  function checked(id,v){ const el=$(id); if(el) el.checked=!!v; }
  function openModal(item=null){
    state.editing=item; $('#modalTitle').textContent=item?'Mahsulotni tahrirlash':'Yangi mahsulot';
    val('#itemId',item?._id); val('#fName',item?.name); val('#fSlug',item?.slug); val('#fType',item?.type||'android'); val('#fCategory',item?.category||'Boshqa'); val('#fTagline',item?.tagline); val('#fDescription',item?.description); val('#fDeveloper',item?.developer||'HALLAYM'); val('#fVersion',item?.version||'1.0.0'); val('#fSize',item?.size); val('#fAge',item?.ageRating||'3+'); val('#fRequirements',item?.requirements); val('#fTags',(item?.tags||[]).join(', ')); val('#fPermissions',(item?.permissions||[]).join(', ')); val('#fChangelog',item?.changelog); val('#fIconUrl',item?.iconUrl); val('#fCoverUrl',item?.coverUrl); val('#fScreenshots',(item?.screenshots||[]).join('\n')); val('#fPackageUrl',item?.packageUrl); val('#fPackageKey',item?.packageKey); val('#fExternalUrl',item?.externalUrl); val('#fSeoTitle',item?.seoTitle); val('#fSeoDescription',item?.seoDescription); checked('#fVerified',item ? item.verified : true); checked('#fFeatured',item?.featured); checked('#fPublished',item ? item.published : true);
    $('#itemModal').classList.remove('hidden'); $('#itemModal').setAttribute('aria-hidden','false');
  }
  function closeModal(){ $('#itemModal').classList.add('hidden'); $('#itemModal').setAttribute('aria-hidden','true'); }
  async function uploadFile(fileInput,target,keyTarget){
    const input=$(fileInput); const file=input?.files?.[0]; if(!file) return toast('Avval fayl tanlang');
    const fd=new FormData(); fd.append('file',file);
    toast('Yuklanmoqda…');
    try { const d=await api('/api/admin/upload',{method:'POST',body:fd}); val(target,d.url); if(keyTarget) val(keyTarget,d.key); toast('R2 ga yuklandi ✓'); }
    catch(e){ toast(e.message); }
  }
  async function removeItem(id){
    const item=state.items.find(x=>x._id===id); if(!confirm(`“${item?.name||'Mahsulot'}” o‘chirilsinmi?`)) return;
    try { await api('/api/admin/items/'+id,{method:'DELETE'}); toast('O‘chirildi'); await Promise.all([loadItems(),loadStats()]); }
    catch(e){ toast(e.message); }
  }
  $('#itemForm').addEventListener('submit', async e => {
    e.preventDefault(); const id=$('#itemId').value;
    const body={name:$('#fName').value,slug:$('#fSlug').value,type:$('#fType').value,category:$('#fCategory').value,tagline:$('#fTagline').value,description:$('#fDescription').value,developer:$('#fDeveloper').value,version:$('#fVersion').value,size:$('#fSize').value,ageRating:$('#fAge').value,requirements:$('#fRequirements').value,tags:$('#fTags').value,permissions:$('#fPermissions').value,changelog:$('#fChangelog').value,iconUrl:$('#fIconUrl').value,coverUrl:$('#fCoverUrl').value,screenshots:$('#fScreenshots').value,packageUrl:$('#fPackageUrl').value,packageKey:$('#fPackageKey').value,externalUrl:$('#fExternalUrl').value,seoTitle:$('#fSeoTitle').value,seoDescription:$('#fSeoDescription').value,verified:$('#fVerified').checked,featured:$('#fFeatured').checked,published:$('#fPublished').checked};
    $('#saveBtn').disabled=true;
    try { await api(id?'/api/admin/items/'+id:'/api/admin/items',{method:id?'PATCH':'POST',body:JSON.stringify(body)}); toast('Saqlandi ✓'); closeModal(); await Promise.all([loadItems(),loadStats()]); }
    catch(e){ toast(e.message); } finally { $('#saveBtn').disabled=false; }
  });
  $$('.uploadBtn').forEach(b => b.onclick = () => uploadFile('#'+b.dataset.file,'#'+b.dataset.target));
  $('#uploadPackageBtn').onclick=()=>uploadFile('#packageFile','#fPackageUrl','#fPackageKey');
  $('#uploadShotBtn').onclick=async()=>{ const file=$('#shotFile').files?.[0]; if(!file)return toast('Screenshot tanlang'); const fd=new FormData(); fd.append('file',file); try{const d=await api('/api/admin/upload',{method:'POST',body:fd}); const old=$('#fScreenshots').value.trim(); $('#fScreenshots').value=(old?old+'\n':'')+d.url; toast('Screenshot qo‘shildi ✓')}catch(e){toast(e.message)} };
  $('#newItemBtn').onclick=$('#newItemTopBtn').onclick=()=>openModal(); $('#closeModalBtn').onclick=$('#cancelBtn').onclick=closeModal; $('#itemModal').addEventListener('click',e=>{if(e.target===$('#itemModal'))closeModal()});
  $('#adminSearch').addEventListener('input',renderItems);
  $$('[data-view]').forEach(b=>b.onclick=()=>{ $$('[data-view]').forEach(x=>x.classList.toggle('active',x===b)); $('#dashboardView').classList.toggle('hidden',b.dataset.view!=='dashboard'); $('#itemsView').classList.toggle('hidden',b.dataset.view!=='items'); if(b.dataset.view==='items')loadItems(); });
  $('#openStoreBtn').onclick=()=>window.open('/','_blank'); $('#logoutBtn').onclick=async()=>{await api('/api/auth/logout',{method:'POST'}).catch(()=>{});location.href='/login'};
  (async()=>{ await ensureAdmin(); await Promise.all([loadStats(),loadItems()]); })();
})();