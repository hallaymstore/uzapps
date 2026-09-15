'use strict';

require('dotenv').config();
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');
const express = require('express');
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const cookieParser = require('cookie-parser');
const compression = require('compression');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const multer = require('multer');
const { S3Client, PutObjectCommand, DeleteObjectCommand } = require('@aws-sdk/client-s3');

const app = express();
const PORT = Number(process.env.PORT || 3000);
const SITE_URL = String(process.env.SITE_URL || `http://localhost:${PORT}`).replace(/\/$/, '');
const JWT_SECRET = process.env.JWT_SECRET || 'dev-only-change-me';
const COOKIE_NAME = 'uzapps_token';
const MAX_UPLOAD_MB = Math.max(1, Math.min(500, Number(process.env.MAX_UPLOAD_MB || 250)));

app.set('trust proxy', 1);
app.use(helmet({
  contentSecurityPolicy: false,
  crossOriginResourcePolicy: { policy: 'cross-origin' },
  referrerPolicy: { policy: 'strict-origin-when-cross-origin' }
}));
app.use(compression());
app.use(cookieParser());
app.use(express.json({ limit: '2mb' }));
app.use(express.urlencoded({ extended: true, limit: '2mb' }));
app.use('/api/auth', rateLimit({ windowMs: 15 * 60 * 1000, limit: 100, standardHeaders: true, legacyHeaders: false }));
app.use('/api', rateLimit({ windowMs: 60 * 1000, limit: 500, standardHeaders: true, legacyHeaders: false }));

const publicDir = path.join(__dirname, 'public');
const tempDir = path.join('/tmp', 'uzapps-uploads');
try { fs.mkdirSync(tempDir, { recursive: true }); } catch {}
app.use(express.static(publicDir, { maxAge: process.env.NODE_ENV === 'production' ? '1h' : 0 }));

function slugify(input) {
  return String(input || '')
    .trim().toLowerCase()
    .replace(/[’'`]/g, '')
    .replace(/[^a-z0-9\u0400-\u04ff]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 90) || `item-${Date.now()}`;
}
function esc(v) {
  return String(v ?? '').replace(/[&<>'"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' }[c]));
}
function cleanArray(v, max = 30) {
  if (Array.isArray(v)) return v.map(x => String(x || '').trim()).filter(Boolean).slice(0, max);
  return String(v || '').split(/[,\n]/).map(x => x.trim()).filter(Boolean).slice(0, max);
}
function safeUrl(v) {
  const s = String(v || '').trim();
  if (!s) return '';
  try { const u = new URL(s); return ['http:', 'https:'].includes(u.protocol) ? u.toString() : ''; } catch { return ''; }
}
function compactUser(user) {
  if (!user) return null;
  return { id: String(user._id), name: user.name, email: user.email, role: user.role, favorites: (user.favorites || []).map(String) };
}
function signUser(user) {
  return jwt.sign({ sub: String(user._id), role: user.role }, JWT_SECRET, { expiresIn: '30d', issuer: 'uzapps' });
}
function setAuthCookie(res, token) {
  res.cookie(COOKIE_NAME, token, { httpOnly: true, secure: process.env.NODE_ENV === 'production', sameSite: 'lax', maxAge: 30 * 24 * 3600 * 1000, path: '/' });
}

const userSchema = new mongoose.Schema({
  name: { type: String, required: true, trim: true, maxlength: 80 },
  email: { type: String, required: true, unique: true, lowercase: true, trim: true, index: true },
  passwordHash: { type: String, required: true },
  role: { type: String, enum: ['user', 'admin'], default: 'user', index: true },
  favorites: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Item' }],
  active: { type: Boolean, default: true }
}, { timestamps: true });

const itemSchema = new mongoose.Schema({
  name: { type: String, required: true, trim: true, maxlength: 100 },
  slug: { type: String, required: true, unique: true, trim: true, index: true },
  type: { type: String, enum: ['android', 'website', 'telegram', 'extension', 'windows', 'other'], default: 'android', index: true },
  category: { type: String, default: 'Boshqa', trim: true, index: true },
  tagline: { type: String, default: '', maxlength: 180 },
  description: { type: String, default: '', maxlength: 12000 },
  developer: { type: String, default: 'HALLAYM', maxlength: 100 },
  version: { type: String, default: '1.0.0', maxlength: 40 },
  size: { type: String, default: '', maxlength: 40 },
  requirements: { type: String, default: '', maxlength: 400 },
  ageRating: { type: String, default: '3+', maxlength: 20 },
  tags: [{ type: String, maxlength: 40 }],
  permissions: [{ type: String, maxlength: 100 }],
  changelog: { type: String, default: '', maxlength: 5000 },
  iconUrl: { type: String, default: '' },
  coverUrl: { type: String, default: '' },
  screenshots: [{ type: String }],
  packageUrl: { type: String, default: '' },
  packageKey: { type: String, default: '' },
  externalUrl: { type: String, default: '' },
  verified: { type: Boolean, default: true },
  featured: { type: Boolean, default: false, index: true },
  published: { type: Boolean, default: true, index: true },
  downloads: { type: Number, default: 0 },
  views: { type: Number, default: 0 },
  ratingSum: { type: Number, default: 0 },
  ratingCount: { type: Number, default: 0 },
  seoTitle: { type: String, default: '', maxlength: 70 },
  seoDescription: { type: String, default: '', maxlength: 180 },
  lastReleaseAt: { type: Date, default: Date.now }
}, { timestamps: true });
itemSchema.virtual('rating').get(function () { return this.ratingCount ? Math.round((this.ratingSum / this.ratingCount) * 10) / 10 : 0; });
itemSchema.set('toJSON', { virtuals: true });
itemSchema.set('toObject', { virtuals: true });

const ratingSchema = new mongoose.Schema({
  itemId: { type: mongoose.Schema.Types.ObjectId, ref: 'Item', index: true },
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', index: true },
  value: { type: Number, min: 1, max: 5 },
  review: { type: String, default: '', maxlength: 1000 }
}, { timestamps: true });
ratingSchema.index({ itemId: 1, userId: 1 }, { unique: true });

const eventSchema = new mongoose.Schema({
  itemId: { type: mongoose.Schema.Types.ObjectId, ref: 'Item', index: true },
  kind: { type: String, enum: ['view', 'download'], index: true },
  day: { type: String, index: true },
  ref: { type: String, default: '', maxlength: 120 }
}, { timestamps: true });

const User = mongoose.model('User', userSchema);
const Item = mongoose.model('Item', itemSchema);
const Rating = mongoose.model('Rating', ratingSchema);
const Event = mongoose.model('Event', eventSchema);

const r2Account = process.env.R2_ACCOUNT_ID || '';
const r2Key = process.env.R2_ACCESS_KEY_ID || '';
const r2Secret = process.env.R2_SECRET_ACCESS_KEY || '';
const r2Bucket = process.env.R2_BUCKET || '';
const r2Public = String(process.env.R2_PUBLIC_BASE_URL || '').replace(/\/$/, '');
const r2Endpoint = process.env.R2_S3_ENDPOINT || (r2Account ? `https://${r2Account}.r2.cloudflarestorage.com` : '');
const r2Ready = Boolean(r2Account && r2Key && r2Secret && r2Bucket && r2Public);
const s3 = r2Ready ? new S3Client({ region: 'auto', endpoint: r2Endpoint, credentials: { accessKeyId: r2Key, secretAccessKey: r2Secret } }) : null;

async function optionalAuth(req, _res, next) {
  req.user = null;
  const token = req.cookies?.[COOKIE_NAME] || (String(req.headers.authorization || '').startsWith('Bearer ') ? String(req.headers.authorization).slice(7) : '');
  if (token) {
    try {
      const payload = jwt.verify(token, JWT_SECRET, { issuer: 'uzapps' });
      req.user = await User.findOne({ _id: payload.sub, active: true });
    } catch {}
  }
  next();
}
function requireAuth(req, res, next) { if (!req.user) return res.status(401).json({ error: 'Kirish talab qilinadi' }); next(); }
function requireAdmin(req, res, next) { if (!req.user || req.user.role !== 'admin') return res.status(403).json({ error: 'Admin ruxsati kerak' }); next(); }
app.use(optionalAuth);

app.get('/health', (_req, res) => res.json({ ok: true, app: 'UZ APPS', db: mongoose.connection.readyState === 1, r2: r2Ready, time: new Date().toISOString() }));

app.post('/api/auth/register', async (req, res) => {
  try {
    const name = String(req.body.name || '').trim().slice(0, 80);
    const email = String(req.body.email || '').trim().toLowerCase().slice(0, 180);
    const password = String(req.body.password || '');
    if (name.length < 2 || !/^\S+@\S+\.\S+$/.test(email) || password.length < 8) return res.status(400).json({ error: 'Ism, email va kamida 8 belgili parol kiriting' });
    if (await User.exists({ email })) return res.status(409).json({ error: 'Bu email allaqachon mavjud' });
    const user = await User.create({ name, email, passwordHash: await bcrypt.hash(password, 11) });
    setAuthCookie(res, signUser(user));
    res.status(201).json({ user: compactUser(user) });
  } catch (e) { res.status(500).json({ error: 'Ro‘yxatdan o‘tishda xato' }); }
});

app.post('/api/auth/login', async (req, res) => {
  const email = String(req.body.email || '').trim().toLowerCase();
  const password = String(req.body.password || '');
  const user = await User.findOne({ email, active: true });
  if (!user || !(await bcrypt.compare(password, user.passwordHash))) return res.status(401).json({ error: 'Email yoki parol noto‘g‘ri' });
  setAuthCookie(res, signUser(user));
  res.json({ user: compactUser(user) });
});
app.post('/api/auth/logout', (_req, res) => { res.clearCookie(COOKIE_NAME, { path: '/' }); res.json({ ok: true }); });
app.get('/api/auth/me', async (req, res) => res.json({ user: compactUser(req.user) }));

app.get('/api/items', async (req, res) => {
  const q = { published: true };
  if (req.query.type && req.query.type !== 'all') q.type = String(req.query.type);
  if (req.query.category && req.query.category !== 'all') q.category = String(req.query.category);
  if (req.query.featured === '1') q.featured = true;
  const term = String(req.query.q || '').trim().slice(0, 80);
  if (term) q.$or = [{ name: { $regex: term.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), $options: 'i' } }, { tagline: { $regex: term.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), $options: 'i' } }, { tags: { $in: [new RegExp(term.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i')] } }];
  const sortMap = { popular: { downloads: -1, views: -1 }, newest: { createdAt: -1 }, rating: { ratingCount: -1, ratingSum: -1 }, updated: { lastReleaseAt: -1 } };
  const sort = sortMap[String(req.query.sort || '')] || { featured: -1, downloads: -1, createdAt: -1 };
  const limit = Math.max(1, Math.min(100, Number(req.query.limit || 60)));
  const rows = await Item.find(q).sort(sort).limit(limit).lean({ virtuals: true });
  res.json({ items: rows, total: rows.length });
});

app.get('/api/categories', async (_req, res) => {
  const rows = await Item.aggregate([{ $match: { published: true } }, { $group: { _id: '$category', count: { $sum: 1 } } }, { $sort: { count: -1, _id: 1 } }]);
  res.json({ categories: rows.map(x => ({ name: x._id || 'Boshqa', count: x.count })) });
});

app.get('/api/items/:slug', async (req, res) => {
  const item = await Item.findOne({ slug: req.params.slug, published: true }).lean({ virtuals: true });
  if (!item) return res.status(404).json({ error: 'Topilmadi' });
  const reviews = await Rating.find({ itemId: item._id }).sort({ createdAt: -1 }).limit(20).populate('userId', 'name').lean();
  res.json({ item, reviews: reviews.map(r => ({ id: String(r._id), value: r.value, review: r.review, user: r.userId?.name || 'Foydalanuvchi', createdAt: r.createdAt })) });
});

app.post('/api/items/:slug/view', async (req, res) => {
  const item = await Item.findOneAndUpdate({ slug: req.params.slug, published: true }, { $inc: { views: 1 } }, { new: true });
  if (!item) return res.status(404).json({ error: 'Topilmadi' });
  Event.create({ itemId: item._id, kind: 'view', day: new Date().toISOString().slice(0, 10), ref: String(req.headers.referer || '').slice(0, 120) }).catch(() => {});
  res.json({ views: item.views });
});

app.get('/download/:slug', async (req, res) => {
  const item = await Item.findOneAndUpdate({ slug: req.params.slug, published: true }, { $inc: { downloads: 1 } }, { new: true });
  if (!item) return res.status(404).send('Topilmadi');
  Event.create({ itemId: item._id, kind: 'download', day: new Date().toISOString().slice(0, 10), ref: String(req.headers.referer || '').slice(0, 120) }).catch(() => {});
  const target = item.packageUrl || item.externalUrl;
  if (!target) return res.status(404).send('Yuklab olish havolasi hali qo‘shilmagan');
  res.redirect(302, target);
});

app.post('/api/items/:id/rating', requireAuth, async (req, res) => {
  const value = Number(req.body.value);
  const review = String(req.body.review || '').trim().slice(0, 1000);
  if (![1,2,3,4,5].includes(value)) return res.status(400).json({ error: '1–5 oralig‘ida baho bering' });
  const item = await Item.findById(req.params.id);
  if (!item || !item.published) return res.status(404).json({ error: 'Topilmadi' });
  const old = await Rating.findOne({ itemId: item._id, userId: req.user._id });
  if (old) {
    item.ratingSum += value - old.value;
    old.value = value; old.review = review; await old.save();
  } else {
    await Rating.create({ itemId: item._id, userId: req.user._id, value, review });
    item.ratingSum += value; item.ratingCount += 1;
  }
  await item.save();
  res.json({ ok: true, rating: item.ratingCount ? Math.round((item.ratingSum / item.ratingCount) * 10) / 10 : 0, ratingCount: item.ratingCount });
});

app.post('/api/favorites/:id', requireAuth, async (req, res) => {
  const id = String(req.params.id);
  const has = req.user.favorites.some(x => String(x) === id);
  req.user.favorites = has ? req.user.favorites.filter(x => String(x) !== id) : [...req.user.favorites, id];
  await req.user.save();
  res.json({ favorite: !has, favorites: req.user.favorites.map(String) });
});

const upload = multer({ dest: tempDir, limits: { fileSize: MAX_UPLOAD_MB * 1024 * 1024, files: 1 } });
const allowedExt = new Set(['apk','aab','zip','crx','exe','msi','jpg','jpeg','png','webp','gif','svg','pdf']);
app.post('/api/admin/upload', requireAdmin, upload.single('file'), async (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'Fayl tanlanmagan' });
  try {
    if (!r2Ready) return res.status(503).json({ error: 'Cloudflare R2 sozlanmagan' });
    const original = String(req.file.originalname || 'file');
    const ext = original.toLowerCase().split('.').pop().replace(/[^a-z0-9]/g, '');
    if (!allowedExt.has(ext)) return res.status(415).json({ error: 'Bu fayl turi ruxsat etilmagan' });
    const folder = ['apk','aab','zip','crx','exe','msi'].includes(ext) ? 'packages' : 'media';
    const key = `uzapps/${folder}/${new Date().toISOString().slice(0,10)}/${Date.now()}-${crypto.randomUUID()}.${ext}`;
    await s3.send(new PutObjectCommand({ Bucket: r2Bucket, Key: key, Body: fs.createReadStream(req.file.path), ContentType: req.file.mimetype || 'application/octet-stream', ContentLength: req.file.size, CacheControl: folder === 'media' ? 'public,max-age=31536000,immutable' : 'public,max-age=3600' }));
    const url = `${r2Public}/${key}`;
    res.status(201).json({ url, key, size: req.file.size, name: original });
  } catch (e) {
    console.error('[upload]', e);
    res.status(500).json({ error: 'R2 ga yuklashda xato' });
  } finally { try { fs.unlinkSync(req.file.path); } catch {} }
});

function itemPayload(body) {
  const name = String(body.name || '').trim().slice(0, 100);
  return {
    name,
    slug: slugify(body.slug || name),
    type: ['android','website','telegram','extension','windows','other'].includes(body.type) ? body.type : 'android',
    category: String(body.category || 'Boshqa').trim().slice(0, 80),
    tagline: String(body.tagline || '').trim().slice(0, 180),
    description: String(body.description || '').trim().slice(0, 12000),
    developer: String(body.developer || 'HALLAYM').trim().slice(0, 100),
    version: String(body.version || '1.0.0').trim().slice(0, 40),
    size: String(body.size || '').trim().slice(0, 40),
    requirements: String(body.requirements || '').trim().slice(0, 400),
    ageRating: String(body.ageRating || '3+').trim().slice(0, 20),
    tags: cleanArray(body.tags, 30), permissions: cleanArray(body.permissions, 30),
    changelog: String(body.changelog || '').trim().slice(0, 5000),
    iconUrl: safeUrl(body.iconUrl), coverUrl: safeUrl(body.coverUrl), screenshots: cleanArray(body.screenshots, 15).map(safeUrl).filter(Boolean),
    packageUrl: safeUrl(body.packageUrl), packageKey: String(body.packageKey || '').trim().slice(0, 500), externalUrl: safeUrl(body.externalUrl),
    verified: body.verified !== false && body.verified !== 'false', featured: body.featured === true || body.featured === 'true', published: body.published !== false && body.published !== 'false',
    seoTitle: String(body.seoTitle || '').trim().slice(0, 70), seoDescription: String(body.seoDescription || '').trim().slice(0, 180), lastReleaseAt: new Date()
  };
}

app.get('/api/admin/items', requireAdmin, async (_req, res) => res.json({ items: await Item.find({}).sort({ updatedAt: -1 }).lean({ virtuals: true }) }));
app.post('/api/admin/items', requireAdmin, async (req, res) => {
  try {
    const data = itemPayload(req.body);
    if (!data.name) return res.status(400).json({ error: 'Nomi kerak' });
    let slug = data.slug, n = 2;
    while (await Item.exists({ slug })) slug = `${data.slug}-${n++}`;
    data.slug = slug;
    const item = await Item.create(data);
    res.status(201).json({ item });
  } catch (e) { res.status(400).json({ error: e.code === 11000 ? 'Slug band' : 'Saqlashda xato' }); }
});
app.patch('/api/admin/items/:id', requireAdmin, async (req, res) => {
  const data = itemPayload(req.body);
  if (!data.name) return res.status(400).json({ error: 'Nomi kerak' });
  const item = await Item.findByIdAndUpdate(req.params.id, data, { new: true, runValidators: true });
  if (!item) return res.status(404).json({ error: 'Topilmadi' });
  res.json({ item });
});
app.delete('/api/admin/items/:id', requireAdmin, async (req, res) => {
  const item = await Item.findByIdAndDelete(req.params.id);
  if (!item) return res.status(404).json({ error: 'Topilmadi' });
  await Promise.allSettled([Rating.deleteMany({ itemId: item._id }), Event.deleteMany({ itemId: item._id })]);
  if (item.packageKey && r2Ready) s3.send(new DeleteObjectCommand({ Bucket: r2Bucket, Key: item.packageKey })).catch(() => {});
  res.json({ ok: true });
});
app.get('/api/admin/stats', requireAdmin, async (_req, res) => {
  const [items, users, totals, recent, daily] = await Promise.all([
    Item.countDocuments(), User.countDocuments(),
    Item.aggregate([{ $group: { _id: null, downloads: { $sum: '$downloads' }, views: { $sum: '$views' } } }]),
    Item.find({}).sort({ updatedAt: -1 }).limit(5).select('name type downloads views updatedAt').lean(),
    Event.aggregate([{ $match: { createdAt: { $gte: new Date(Date.now() - 14 * 86400000) } } }, { $group: { _id: { day: '$day', kind: '$kind' }, count: { $sum: 1 } } }, { $sort: { '_id.day': 1 } }])
  ]);
  res.json({ items, users, downloads: totals[0]?.downloads || 0, views: totals[0]?.views || 0, recent, daily, r2: r2Ready });
});

app.get('/robots.txt', (_req, res) => res.type('text/plain').send(`User-agent: *\nAllow: /\nDisallow: /admin\nSitemap: ${SITE_URL}/sitemap.xml\n`));
app.get('/sitemap.xml', async (_req, res) => {
  const items = await Item.find({ published: true }).select('slug updatedAt').lean();
  const urls = [`<url><loc>${SITE_URL}/</loc><changefreq>daily</changefreq><priority>1.0</priority></url>`, ...items.map(x => `<url><loc>${SITE_URL}/item/${encodeURIComponent(x.slug)}</loc><lastmod>${new Date(x.updatedAt).toISOString()}</lastmod><changefreq>weekly</changefreq><priority>0.8</priority></url>`)].join('');
  res.type('application/xml').send(`<?xml version="1.0" encoding="UTF-8"?><urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">${urls}</urlset>`);
});

app.get('/item/:slug', async (req, res, next) => {
  const item = await Item.findOne({ slug: req.params.slug, published: true }).lean({ virtuals: true });
  if (!item) return next();
  Item.updateOne({ _id: item._id }, { $inc: { views: 1 } }).catch(() => {});
  Event.create({ itemId: item._id, kind: 'view', day: new Date().toISOString().slice(0, 10), ref: String(req.headers.referer || '').slice(0, 120) }).catch(() => {});
  const rating = item.ratingCount ? Math.round((item.ratingSum / item.ratingCount) * 10) / 10 : 0;
  const title = esc(item.seoTitle || `${item.name} — UZ APPS`);
  const desc = esc(item.seoDescription || item.tagline || item.description.slice(0, 160) || `${item.name} haqida ma’lumot va yuklab olish.`);
  const image = esc(item.coverUrl || item.iconUrl || `${SITE_URL}/logo.svg`);
  const action = item.type === 'website' ? 'Saytni ochish' : item.type === 'telegram' ? 'Botni ochish' : 'Yuklab olish';
  const shots = (item.screenshots || []).map(x => `<img class="detail-shot" src="${esc(x)}" alt="${esc(item.name)} screenshot" loading="lazy">`).join('');
  const ld = JSON.stringify({ '@context': 'https://schema.org', '@type': 'SoftwareApplication', name: item.name, applicationCategory: item.category, operatingSystem: item.type === 'android' ? 'Android' : item.type === 'extension' ? 'Chrome' : 'Web', description: desc, aggregateRating: item.ratingCount ? { '@type': 'AggregateRating', ratingValue: rating, ratingCount: item.ratingCount } : undefined, offers: { '@type': 'Offer', price: '0', priceCurrency: 'UZS' } }).replace(/</g, '\\u003c');
  res.send(`<!doctype html><html lang="uz"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${title}</title><meta name="description" content="${desc}"><link rel="canonical" href="${SITE_URL}/item/${encodeURIComponent(item.slug)}"><meta property="og:type" content="website"><meta property="og:title" content="${title}"><meta property="og:description" content="${desc}"><meta property="og:image" content="${image}"><meta property="og:url" content="${SITE_URL}/item/${encodeURIComponent(item.slug)}"><meta name="twitter:card" content="summary_large_image"><link rel="icon" href="/favicon.svg" type="image/svg+xml"><link rel="manifest" href="/manifest.webmanifest"><link rel="stylesheet" href="/styles.css"><script type="application/ld+json">${ld}</script></head><body><header class="topbar"><a class="brand" href="/"><img src="/logo.svg" alt="UZ APPS"><b>UZ APPS</b></a><a class="ghost-btn" href="/">← Bosh sahifa</a></header><main class="detail-wrap"><section class="detail-head"><div class="app-icon xl">${item.iconUrl ? `<img src="${esc(item.iconUrl)}" alt="">` : esc(item.name.slice(0,2).toUpperCase())}</div><div><span class="type-pill">${esc(item.type)}</span><h1>${esc(item.name)}</h1><p>${esc(item.tagline)}</p><div class="detail-stats"><span>★ ${rating || 'Yangi'}</span><span>${Number(item.downloads || 0).toLocaleString()} yuklash</span><span>${Number(item.views || 0).toLocaleString()} ko‘rish</span><span>${esc(item.ageRating)}</span></div></div><a class="primary-btn install-btn" href="/download/${encodeURIComponent(item.slug)}" rel="nofollow">${action}</a></section>${item.coverUrl ? `<img class="detail-cover" src="${esc(item.coverUrl)}" alt="${esc(item.name)}">` : ''}${shots ? `<section><h2>Skrinshotlar</h2><div class="shot-row">${shots}</div></section>` : ''}<section class="detail-grid"><article class="panel"><h2>${item.type === 'website' ? 'Sayt haqida' : 'Ilova haqida'}</h2><p class="preline">${esc(item.description)}</p></article><aside class="panel meta-list"><div><b>Versiya</b><span>${esc(item.version)}</span></div><div><b>Hajmi</b><span>${esc(item.size || '—')}</span></div><div><b>Dasturchi</b><span>${esc(item.developer)}</span></div><div><b>Talablar</b><span>${esc(item.requirements || '—')}</span></div><div><b>Yangilangan</b><span>${new Date(item.lastReleaseAt || item.updatedAt).toLocaleDateString('uz-UZ')}</span></div></aside></section>${item.changelog ? `<section class="panel"><h2>Nima yangilik?</h2><p class="preline">${esc(item.changelog)}</p></section>` : ''}</main><footer class="footer">© ${new Date().getFullYear()} UZ APPS · O‘zbekiston ilovalari bir joyda</footer></body></html>`);
});

app.get('/admin', (_req, res) => res.sendFile(path.join(publicDir, 'admin.html')));
app.get('/login', (_req, res) => res.sendFile(path.join(publicDir, 'auth.html')));
app.get('/register', (_req, res) => res.sendFile(path.join(publicDir, 'auth.html')));
app.use((req, res) => {
  if (req.method === 'GET' && !req.path.startsWith('/api/')) return res.status(404).sendFile(path.join(publicDir, 'index.html'));
  res.status(404).json({ error: 'Topilmadi' });
});

async function bootstrap() {
  const uri = process.env.MONGODB_URI || process.env.MONGO_URI;
  if (!uri) throw new Error('MONGODB_URI is required');
  await mongoose.connect(uri, { maxPoolSize: 12, serverSelectionTimeoutMS: 10000 });
  console.log('[db] connected');
  const adminEmail = String(process.env.ADMIN_EMAIL || '').trim().toLowerCase();
  const adminPassword = String(process.env.ADMIN_PASSWORD || '');
  if (adminEmail && adminPassword.length >= 10) {
    const existing = await User.findOne({ email: adminEmail });
    if (!existing) await User.create({ name: process.env.ADMIN_NAME || 'UZ APPS Admin', email: adminEmail, passwordHash: await bcrypt.hash(adminPassword, 12), role: 'admin' });
    else if (existing.role !== 'admin') { existing.role = 'admin'; await existing.save(); }
  }
  if (process.env.SEED_STARTER === 'true' && await Item.countDocuments() === 0) {
    await Item.insertMany([
      { name: 'Lumi', slug: 'lumi', type: 'website', category: 'Ijtimoiy tarmoq', tagline: 'Yangi avlod ijtimoiy platformasi', description: 'Postlar, hikoyalar va real vaqt muloqoti uchun HALLAYM platformasi.', developer: 'HALLAYM', externalUrl: 'https://lumi-6yqp.onrender.com', featured: true, tags: ['social','uzbekistan','web'] },
      { name: 'MD', slug: 'md', type: 'website', category: 'Ta’lim', tagline: 'Magistratura jarayonlarini boshqarish platformasi', description: 'Magistrantlar, ilmiy rahbarlar va kafedra jarayonlarini yagona tizimda boshqarish.', developer: 'HALLAYM', externalUrl: 'https://md-kstu.onrender.com', featured: true, tags: ['education','magistratura'] },
      { name: 'HALLAYM Taxi', slug: 'hallaym-taxi', type: 'website', category: 'Transport', tagline: 'Haydovchi va mijozlar uchun zamonaviy taksi platformasi', description: 'Buyurtma, haydovchi va mijoz interfeyslari bilan ishlaydigan taksi web-ilovasi.', developer: 'HALLAYM', externalUrl: 'https://hallaym-taxi.onrender.com', tags: ['taxi','transport'] }
    ]);
  }
  app.listen(PORT, '0.0.0.0', () => console.log(`[uzapps] ${SITE_URL} on :${PORT} | R2=${r2Ready ? 'on' : 'off'}`));
}
bootstrap().catch(err => { console.error('[fatal]', err); process.exit(1); });
