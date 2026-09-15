'use strict';

if (process.env.MONGODB_URI || process.env.MONGO_URI) {
  console.log('[launcher] MongoDB production mode');
  require('./server');
} else {
  console.log('[launcher] MongoDB ENV not found, starting live fallback mode');
  require('./fallback');
}
