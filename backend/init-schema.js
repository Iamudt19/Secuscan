require('dotenv').config();
const db = require('./src/db');

console.log('🚀 Initialising Neon PostgreSQL schema...');
db.initDb()
  .then(() => {
    console.log('✅ Schema created successfully!');
    process.exit(0);
  })
  .catch(e => {
    console.error('❌ Schema init failed:', e.message);
    process.exit(1);
  });
