# UZ APPS

Google Play uslubidagi universal raqamli mahsulotlar katalogi. Android ilovalar, websaytlar, Telegram botlar, Chrome extensions, Windows paketlari va boshqa mahsulotlarni bitta joydan boshqarish mumkin.

## Asosiy imkoniyatlar

- Ro‘yxatdan o‘tmasdan ko‘rish va download/open
- Ixtiyoriy register/login
- Android, Website, Telegram, Chrome Extension, Windows bo‘limlari
- Qidiruv, kategoriya va saralash
- Featured, verified, published statuslari
- Har bir mahsulot uchun alohida SEO URL va Open Graph metadata
- Screenshot galereyasi, icon, cover, changelog, versiya va talablar
- Rating/review va favorites
- Admin panel: CRUD, analytics, download/view statistikasi
- Cloudflare R2 orqali APK/AAB/ZIP/CRX/EXE/MSI va media upload
- MongoDB Atlas
- PWA manifest + service worker
- robots.txt + sitemap.xml + Schema.org SoftwareApplication
- Privacy Policy va Terms of Use

## Stack

Node.js, Express, MongoDB/Mongoose, JWT cookie auth, Cloudflare R2 (AWS S3 SDK), vanilla responsive frontend.

## Ishga tushirish

```bash
npm install
cp .env.example .env
npm start
```

Production secretlarni GitHub ichiga yozmang. `MONGODB_URI`, `JWT_SECRET`, admin login va R2 credentiallarni Render Environment Variables orqali kiriting.

## Admin

`/admin` — admin dashboard. Admin user production ENV orqali birinchi startda bootstrap qilinadi.

## Health

`/health` — database va R2 holatini JSON ko‘rinishida qaytaradi.
