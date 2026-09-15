'use strict';

const path = require('path');
const crypto = require('crypto');
const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const cookieParser = require('cookie-parser');
const compression = require('compression');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');

const app = express();
const PORT = Number(process.env.PORT || 3000);
const SITE_URL = String(process.env.SITE_URL || `http://localhost:${PORT}`).replace(/\/$/, '');
const COOKIE = 'uzapps_token';
const JWT_SECRET = process.env.JWT_SECRET || crypto.randomBytes(48).toString('base64url');
const publicDir = path.join(__dirname, 'public');

app.set('trust proxy', 1);
app.use(helmet({ contentSecurityPolicy:false, crossOriginResourcePolicy:{policy:'cross-origin'} }));
app.use(compression());
app.use(cookieParser());
app.use(express.json({limit:'2mb'}));
app.use('/api', rateLimit({windowMs:60000,limit:500,standardHeaders:true,legacyHeaders:false}));
app.use(express.static(publicDir,{maxAge:process.env.NODE_ENV==='production'?'1h':0}));

const now = () => new Date().toISOString();
const id = () => crypto.randomUUID();
const slugify = s => String(s||'').trim().toLowerCase().replace(/[’'`]/g,'').replace(/[^a-z0-9\u0400-\u04ff]+/g,'-').replace(/^-+|-+$/g,'').slice(0,90)||`item-${Date.now()}`;
const arr = v => Array.isArray(v) ? v.map(String).map(x=>x.trim()).filter(Boolean) : String(v||'').split(/[,\n]/).map(x=>x.trim()).filter(Boolean);
const esc = v => String(v??'').replace(/[&<>'"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[c]));
const safeUrl = v => { try { const u=new URL(String(v||'')); return ['http:','https:'].includes(u.protocol)?u.toString():''; } catch { return ''; } };

let items = [
  {_id:id(),name:'Lumi',slug:'lumi',type:'website',category:'Ijtimoiy tarmoq',tagline:'Yangi avlod ijtimoiy platformasi',description:'Postlar, hikoyalar va real vaqt muloqoti uchun HALLAYM platformasi.',developer:'HALLAYM',version:'1.0',size:'Web',requirements:'Zamonaviy brauzer',ageRating:'12+',tags:['social','web'],permissions:[],changelog:'UZ APPS katalogiga qo‘shildi.',iconUrl:'',coverUrl:'',screenshots:[],packageUrl:'',packageKey:'',externalUrl:'https://lumi-6yqp.onrender.com/',verified:true,featured:true,published:true,downloads:0,views:0,ratingSum:0,ratingCount:0,seoTitle:'Lumi — UZ APPS',seoDescription:'Lumi ijtimoiy platformasi',lastReleaseAt:now(),createdAt:now(),updatedAt:now()},
  {_id:id(),name:'MD',slug:'md',type:'website',category:'Ta’lim',tagline:'Magistratura jarayonlarini boshqarish platformasi',description:'Magistrantlar, ilmiy rahbarlar va kafedra jarayonlarini yagona tizimda boshqarish.',developer:'HALLAYM',version:'2.9',size:'Web',requirements:'Zamonaviy brauzer',ageRating:'3+',tags:['education','magistratura'],permissions:[],changelog:'Statistika va workflow modullari.',iconUrl:'',coverUrl:'',screenshots:[],packageUrl:'',packageKey:'',externalUrl:'https://md-kstu.onrender.com/',verified:true,featured:true,published:true,downloads:0,views:0,ratingSum:0,ratingCount:0,seoTitle:'MD — UZ APPS',seoDescription:'Magistratura boshqaruv platformasi',lastReleaseAt:now(),createdAt:now(),updatedAt:now()},
  {_id:id(),name:'HALLAYM Taxi',slug:'hallaym-taxi',type:'website',category:'Transport',tagline:'Haydovchi va mijozlar uchun zamonaviy taksi platformasi',description:'Buyurtma, haydovchi va mijoz interfeyslari bilan ishlaydigan responsive taksi web-ilovasi.',developer:'HALLAYM',version:'1.0',size:'Web',requirements:'GPS va zamonaviy brauzer',ageRating:'3+',tags:['taxi','transport'],permissions:['Location'],changelog:'Birinchi public versiya.',iconUrl:'',coverUrl:'',screenshots:[],packageUrl:'',packageKey:'',externalUrl:'https://hallaym-taxi.onrender.com/',verified:true,featured:false,published:true,downloads:0,views:0,ratingSum:0,ratingCount:0,seoTitle:'HALLAYM Taxi — UZ APPS',seoDescription:'Taksi web platformasi',lastReleaseAt:now(),createdAt:now(),updatedAt:now()}
];
let users = [];
let reviews = [];
let events = [];
const demoAdminEmail = process.env.ADMIN_EMAIL || 'admin@uzapps.uz';
const demoAdminPassword = `UZ-${crypto.randomBytes(10).toString('base64url')}`;

function publicUser(u){return u?{id:u._id,name:u.name,email:u.email,role:u.role,favorites:[...(u.favorites||[])]}:null}
function sign(u){return jwt.sign({sub:u._id,role:u.role},JWT_SECRET,{expiresIn:'30d',issuer:'uzapps'})}
function setCookie(res,t){res.cookie(COOKIE,t,{httpOnly:true,secure:process.env.NODE_ENV==='production',sameSite:'lax',maxAge:30*86400000,path:'/'})}
async function auth(req,_res,next){req.user=null;const token=req.cookies?.[COOKIE]||'';if(token){try{const p=jwt.verify(token,JWT_SECRET,{issuer:'uzapps'});req.user=users.find(x=>x._id===p.sub&&x.active!==false)||null}catch{}}next()}
function needAuth(req,res,next){if(!req.user)return res.status(401).json({error:'Kirish talab qilinadi'});next()}
function needAdmin(req,res,next){if(!req.user||req.user.role!=='admin')return res.status(403).json({error:'Admin ruxsati kerak'});next()}
app.use(auth);

function withRating(x){return {...x,rating:x.ratingCount?Math.round((x.ratingSum/x.ratingCount)*10)/10:0,id:x._id}}
function itemPayload(b,old={}){const name=String(b.name||old.name||'').trim().slice(0,100);return {...old,name,slug:slugify(b.slug||old.slug||name),type:['android','website','telegram','extension','windows','other'].includes(b.type)?b.type:(old.type||'android'),category:String(b.category||old.category||'Boshqa').trim().slice(0,80),tagline:String(b.tagline??old.tagline??'').trim().slice(0,180),description:String(b.description??old.description??'').trim().slice(0,12000),developer:String(b.developer||old.developer||'HALLAYM').trim().slice(0,100),version:String(b.version||old.version||'1.0.0').trim().slice(0,40),size:String(b.size??old.size??'').trim().slice(0,40),requirements:String(b.requirements??old.requirements??'').trim().slice(0,400),ageRating:String(b.ageRating||old.ageRating||'3+').trim().slice(0,20),tags:arr(b.tags??old.tags).slice(0,30),permissions:arr(b.permissions??old.permissions).slice(0,30),changelog:String(b.changelog??old.changelog??'').trim().slice(0,5000),iconUrl:safeUrl(b.iconUrl??old.iconUrl),coverUrl:safeUrl(b.coverUrl??old.coverUrl),screenshots:arr(b.screenshots??old.screenshots).map(safeUrl).filter(Boolean).slice(0,15),packageUrl:safeUrl(b.packageUrl??old.packageUrl),packageKey:String(b.packageKey??old.packageKey??''),externalUrl:safeUrl(b.externalUrl??old.externalUrl),verified:b.verified===undefined?(old.verified??true):!(b.verified===false||b.verified==='false'),featured:b.featured===undefined?(old.featured??false):(b.featured===true||b.featured==='true'),published:b.published===undefined?(old.published??true):!(b.published===false||b.published==='false'),seoTitle:String(b.seoTitle??old.seoTitle??'').slice(0,70),seoDescription:String(b.seoDescription??old.seoDescription??'').slice(0,180),lastReleaseAt:now(),updatedAt:now()}}

app.get('/health',(_req,res)=>res.json({ok:true,app:'UZ APPS',db:false,fallback:true,r2:false,time:now()}));
app.get('/api/auth/me',(req,res)=>res.json({user:publicUser(req.user)}));
app.post('/api/auth/register',async(req,res)=>{const name=String(req.body.name||'').trim().slice(0,80),email=String(req.body.email||'').trim().toLowerCase(),password=String(req.body.password||'');if(name.length<2||!/^\S+@\S+\.\S+$/.test(email)||password.length<8)return res.status(400).json({error:'Ism, email va kamida 8 belgili parol kiriting'});if(users.some(x=>x.email===email))return res.status(409).json({error:'Bu email mavjud'});const u={_id:id(),name,email,passwordHash:await bcrypt.hash(password,10),role:'user',favorites:[],active:true};users.push(u);setCookie(res,sign(u));res.status(201).json({user:publicUser(u)})});
app.post('/api/auth/login',async(req,res)=>{const email=String(req.body.email||'').trim().toLowerCase(),u=users.find(x=>x.email===email);if(!u||!(await bcrypt.compare(String(req.body.password||''),u.passwordHash)))return res.status(401).json({error:'Email yoki parol noto‘g‘ri'});setCookie(res,sign(u));res.json({user:publicUser(u)})});
app.post('/api/auth/logout',(_req,res)=>{res.clearCookie(COOKIE,{path:'/'});res.json({ok:true})});

app.get('/api/items',(req,res)=>{let rows=items.filter(x=>x.published);if(req.query.type&&req.query.type!=='all')rows=rows.filter(x=>x.type===req.query.type);if(req.query.category&&req.query.category!=='all')rows=rows.filter(x=>x.category===req.query.category);if(req.query.featured==='1')rows=rows.filter(x=>x.featured);const q=String(req.query.q||'').toLowerCase();if(q)rows=rows.filter(x=>[x.name,x.tagline,x.category,...(x.tags||[])].join(' ').toLowerCase().includes(q));const sort=String(req.query.sort||'');rows.sort((a,b)=>sort==='newest'?new Date(b.createdAt)-new Date(a.createdAt):sort==='updated'?new Date(b.updatedAt)-new Date(a.updatedAt):sort==='rating'?(b.ratingCount-b.ratingCount)||0:(b.downloads-a.downloads)||(b.views-a.views));res.json({items:rows.slice(0,Math.min(100,Number(req.query.limit||60))).map(withRating),total:rows.length})});
app.get('/api/categories',(_req,res)=>{const m={};items.filter(x=>x.published).forEach(x=>m[x.category]=(m[x.category]||0)+1);res.json({categories:Object.entries(m).map(([name,count])=>({name,count})).sort((a,b)=>b.count-a.count)})});
app.get('/api/items/:slug',(req,res)=>{const x=items.find(i=>i.slug===req.params.slug&&i.published);if(!x)return res.status(404).json({error:'Topilmadi'});res.json({item:withRating(x),reviews:reviews.filter(r=>r.itemId===x._id).slice(-20).reverse()})});
app.post('/api/items/:slug/view',(req,res)=>{const x=items.find(i=>i.slug===req.params.slug&&i.published);if(!x)return res.status(404).json({error:'Topilmadi'});x.views++;events.push({itemId:x._id,kind:'view',day:now().slice(0,10),createdAt:now()});res.json({views:x.views})});
app.get('/download/:slug',(req,res)=>{const x=items.find(i=>i.slug===req.params.slug&&i.published);if(!x)return res.status(404).send('Topilmadi');x.downloads++;events.push({itemId:x._id,kind:'download',day:now().slice(0,10),createdAt:now()});const target=x.packageUrl||x.externalUrl;if(!target)return res.status(404).send('Yuklab olish havolasi yo‘q');res.redirect(302,target)});
app.post('/api/favorites/:id',needAuth,(req,res)=>{const has=req.user.favorites.includes(req.params.id);req.user.favorites=has?req.user.favorites.filter(x=>x!==req.params.id):[...req.user.favorites,req.params.id];res.json({favorite:!has,favorites:req.user.favorites})});
app.post('/api/items/:id/rating',needAuth,(req,res)=>{const x=items.find(i=>i._id===req.params.id),value=Number(req.body.value);if(!x)return res.status(404).json({error:'Topilmadi'});if(![1,2,3,4,5].includes(value))return res.status(400).json({error:'1–5 oralig‘ida baholang'});const old=reviews.find(r=>r.itemId===x._id&&r.userId===req.user._id);if(old){x.ratingSum+=value-old.value;old.value=value;old.review=String(req.body.review||'').slice(0,1000)}else{x.ratingSum+=value;x.ratingCount++;reviews.push({id:id(),itemId:x._id,userId:req.user._id,user:req.user.name,value,review:String(req.body.review||'').slice(0,1000),createdAt:now()})}res.json({ok:true,rating:x.ratingSum/x.ratingCount,ratingCount:x.ratingCount})});

app.get('/api/admin/items',needAdmin,(_req,res)=>res.json({items:items.map(withRating)}));
app.post('/api/admin/items',needAdmin,(req,res)=>{let x=itemPayload(req.body);if(!x.name)return res.status(400).json({error:'Nomi kerak'});let base=x.slug,n=2;while(items.some(i=>i.slug===x.slug))x.slug=`${base}-${n++}`;x={_id:id(),downloads:0,views:0,ratingSum:0,ratingCount:0,createdAt:now(),...x};items.unshift(x);res.status(201).json({item:withRating(x)})});
app.patch('/api/admin/items/:id',needAdmin,(req,res)=>{const i=items.findIndex(x=>x._id===req.params.id);if(i<0)return res.status(404).json({error:'Topilmadi'});items[i]=itemPayload(req.body,items[i]);res.json({item:withRating(items[i])})});
app.delete('/api/admin/items/:id',needAdmin,(req,res)=>{const n=items.length;items=items.filter(x=>x._id!==req.params.id);if(items.length===n)return res.status(404).json({error:'Topilmadi'});res.json({ok:true})});
app.get('/api/admin/stats',needAdmin,(_req,res)=>res.json({items:items.length,users:users.length,downloads:items.reduce((s,x)=>s+x.downloads,0),views:items.reduce((s,x)=>s+x.views,0),recent:items.slice(0,5),daily:[],r2:false,fallback:true}));
app.post('/api/admin/upload',needAdmin,(_req,res)=>res.status(503).json({error:'R2 ENV ulanmagan. Hozircha URL maydonidan foydalaning.'}));

app.get('/robots.txt',(_req,res)=>res.type('text/plain').send(`User-agent: *\nAllow: /\nDisallow: /admin\nSitemap: ${SITE_URL}/sitemap.xml\n`));
app.get('/sitemap.xml',(_req,res)=>res.type('application/xml').send(`<?xml version="1.0" encoding="UTF-8"?><urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"><url><loc>${SITE_URL}/</loc></url>${items.filter(x=>x.published).map(x=>`<url><loc>${SITE_URL}/item/${encodeURIComponent(x.slug)}</loc></url>`).join('')}</urlset>`));
app.get('/item/:slug',(req,res,next)=>{const x=items.find(i=>i.slug===req.params.slug&&i.published);if(!x)return next();x.views++;const action=x.type==='website'?'Saytni ochish':x.type==='telegram'?'Botni ochish':'Yuklab olish';res.send(`<!doctype html><html lang="uz"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${esc(x.seoTitle||`${x.name} — UZ APPS`)}</title><meta name="description" content="${esc(x.seoDescription||x.tagline)}"><meta property="og:title" content="${esc(x.name)}"><meta property="og:description" content="${esc(x.tagline)}"><link rel="icon" href="/favicon.svg"><link rel="stylesheet" href="/styles.css"></head><body><header class="topbar"><a class="brand" href="/"><img src="/logo.svg" alt="UZ APPS"><b>UZ APPS</b></a><a class="ghost-btn" href="/">← Bosh sahifa</a></header><main class="detail-wrap"><section class="detail-head"><div class="app-icon xl">${esc(x.name.slice(0,2).toUpperCase())}</div><div><span class="type-pill">${esc(x.type)}</span><h1>${esc(x.name)}</h1><p>${esc(x.tagline)}</p><div class="detail-stats"><span>↓ ${x.downloads}</span><span>👁 ${x.views}</span><span>${esc(x.ageRating)}</span></div></div><a class="primary-btn install-btn" href="/download/${encodeURIComponent(x.slug)}">${action}</a></section><section class="detail-grid"><article class="panel"><h2>Mahsulot haqida</h2><p class="preline">${esc(x.description)}</p></article><aside class="panel meta-list"><div><b>Versiya</b><span>${esc(x.version)}</span></div><div><b>Dasturchi</b><span>${esc(x.developer)}</span></div><div><b>Kategoriya</b><span>${esc(x.category)}</span></div><div><b>Talablar</b><span>${esc(x.requirements)}</span></div></aside></section></main></body></html>`)});
app.get('/admin',(_req,res)=>res.sendFile(path.join(publicDir,'admin.html')));
app.get('/login',(_req,res)=>res.sendFile(path.join(publicDir,'auth.html')));
app.get('/register',(_req,res)=>res.sendFile(path.join(publicDir,'auth.html')));
app.use((req,res)=>{if(req.method==='GET'&&!req.path.startsWith('/api/'))return res.status(404).sendFile(path.join(publicDir,'index.html'));res.status(404).json({error:'Topilmadi'})});

(async()=>{const admin={_id:id(),name:'UZ APPS Admin',email:demoAdminEmail.toLowerCase(),passwordHash:await bcrypt.hash(demoAdminPassword,10),role:'admin',favorites:[],active:true};users.push(admin);console.log(`[demo-mode] MongoDB ENV topilmadi. In-memory fallback ishga tushdi.`);console.log(`[demo-admin] email=${demoAdminEmail} password=${demoAdminPassword}`);app.listen(PORT,'0.0.0.0',()=>console.log(`[uzapps-fallback] ${SITE_URL} on :${PORT}`))})().catch(e=>{console.error('[fallback-fatal]',e);process.exit(1)});
