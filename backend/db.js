const { Pool } = require('pg');

const pool = new Pool({
  host: process.env.DB_HOST || 'localhost',
  port: parseInt(process.env.DB_PORT || '5432'),
  database: process.env.DB_NAME || 'project_tracker',
  user: process.env.DB_USER || 'tracker_user',
  password: process.env.DB_PASSWORD,
  max: 10,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 2000,
});

async function initDB() {
  const client = await pool.connect();
  try {
    await client.query(`
      CREATE TABLE IF NOT EXISTS projects (
        id              SERIAL PRIMARY KEY,
        date            DATE,
        project_id      VARCHAR(100),
        client_name     VARCHAR(255),
        lead_source     VARCHAR(255),
        description     TEXT,
        sales_owner     VARCHAR(255),
        stage           VARCHAR(100),
        proposal_value  NUMERIC(15, 2),
        probability     VARCHAR(20),
        next_action     TEXT,
        last_followup_date    DATE,
        expected_closure_date DATE,
        risk_concern    TEXT,
        link            TEXT,
        comments        TEXT,
        created_at      TIMESTAMPTZ DEFAULT NOW(),
        updated_at      TIMESTAMPTZ DEFAULT NOW()
      );
    `);
    console.log('✅ Database table ready');
  } finally {
    client.release();
  }
}

module.exports = { pool, initDB };
