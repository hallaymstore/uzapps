const CACHE='uzapps-v3';
const CORE=['/','/styles.css?v=20260915-3','/app.js?v=20260915-3','/logo.svg?v=3','/favicon.svg?v=3','/manifest.webmanifest?v=3'];
self.addEventListener('install',e=>e.waitUntil(caches.open(CACHE).then(c=>c.addAll(CORE)).then(()=>self.skipWaiting())));
self.addEventListener('activate',e=>e.waitUntil(caches.keys().then(keys=>Promise.all(keys.filter(k=>k!==CACHE).map(k=>caches.delete(k)))).then(()=>self.clients.claim())));
self.addEventListener('fetch',e=>{
  if(e.request.method!=='GET')return;
  const u=new URL(e.request.url);
  if(u.origin!==location.origin||u.pathname.startsWith('/api/')||u.pathname.startsWith('/download/'))return;
  e.respondWith(fetch(e.request,{cache:'no-store'}).then(r=>{
    if(r.ok){const c=r.clone();caches.open(CACHE).then(x=>x.put(e.request,c)).catch(()=>{})}
    return r;
  }).catch(()=>caches.match(e.request).then(r=>r||caches.match('/'))));
});
