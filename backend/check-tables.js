require('dotenv').config();
const { neon } = require('@neondatabase/serverless');
const sql = neon(process.env.DATABASE_URL);

sql`SELECT table_name FROM information_schema.tables WHERE table_schema='public' ORDER BY table_name`
  .then(r => {
    if (r.length === 0) {
      console.log('⚠️  No tables found — database needs to be initialized.');
    } else {
      console.log('✅ Existing tables:');
      r.forEach(t => console.log('  -', t.table_name));
    }
    process.exit(0);
  })
  .catch(e => {
    console.error('❌ Error:', e.message);
    process.exit(1);
  });
