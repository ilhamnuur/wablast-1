
const { Client } = require('pg');
const dotenv = require('dotenv');
const path = require('path');

dotenv.config({ path: path.join(__dirname, '../.env') });

async function checkGroups() {
  const client = new Client({
    host: process.env.DB_HOST,
    port: process.env.DB_PORT,
    database: process.env.DB_NAME,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
  });

  try {
    await client.connect();
    console.log('--- GROUPS ---');
    const groupsRes = await client.query('SELECT group_name, COUNT(*) as member_count FROM contact_groups GROUP BY group_name');
    console.table(groupsRes.rows);

    console.log('\n--- PENDING SCHEDULED MESSAGES ---');
    const schedRes = await client.query("SELECT id, recipient, type, status, scheduled_at FROM scheduled_messages WHERE status IN ('pending', 'sending', 'failed') ORDER BY id DESC LIMIT 5");
    console.table(schedRes.rows);

  } catch (err) {
    console.error('Error:', err.message);
  } finally {
    await client.end();
  }
}

checkGroups();
