'use strict';

const hasMongo = Boolean(process.env.MONGODB_URI || process.env.MONGO_URI);

if (hasMongo) {
  if (process.env.AUTO_ADMIN_PASSWORD === 'true') {
    const crypto = require('crypto');
    const generated = `UZ-${crypto.randomBytes(12).toString('base64url')}`;
    process.env.ADMIN_PASSWORD = generated;
    if (!process.env.ADMIN_EMAIL) process.env.ADMIN_EMAIL = 'owner@uzapps.uz';
    console.log(`[admin-bootstrap-once] email=${process.env.ADMIN_EMAIL} password=${generated}`);
  }
  console.log('[launcher] MongoDB production mode');
  require('./server');
} else {
  console.log('[launcher] MongoDB ENV not found, starting live fallback mode');
  require('./fallback');
}
