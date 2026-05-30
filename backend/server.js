require('dotenv').config();
const express = require('express');
const session = require('express-session');
const pgSession = require('connect-pg-simple')(session);
const bcrypt = require('bcryptjs');
const cors = require('cors');
const rateLimit = require('express-rate-limit');
const path = require('path');
const { pool, initDB } = require('./db');

const app = express();
const PORT = process.env.PORT || 3000;

// Trust proxy (important when behind Nginx)
app.set('trust proxy', 1);

// Middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// CORS - only needed if frontend is on a different origin
app.use(cors({
  origin: true,
  credentials: true
}));

// Session store in PostgreSQL (persists across restarts)
app.use(session({
  store: new pgSession({
    pool,
    tableName: 'user_sessions',
    createTableIfMissing: true
  }),
  secret: process.env.SESSION_SECRET || 'fallback-secret-change-this',
  resave: false,
  saveUninitialized: false,
  cookie: {
    secure: process.env.NODE_ENV === 'production',
    httpOnly: true,
    maxAge: 7 * 24 * 60 * 60 * 1000 // 7 days
  }
}));

// Rate limiter for auth routes
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 10,
  message: { error: 'Too many login attempts. Please try again later.' }
});

// Serve static frontend
app.use(express.static(path.join(__dirname, '../frontend')));

// ─── Auth Middleware ───────────────────────────────────────────────────────
function requireAuth(req, res, next) {
  if (req.session && req.session.authenticated) return next();
  return res.status(401).json({ error: 'Unauthorized' });
}

// ─── Auth Routes ──────────────────────────────────────────────────────────
app.post('/api/auth/login', authLimiter, async (req, res) => {
  const { password } = req.body;
  if (!password) return res.status(400).json({ error: 'Password required' });

  const appPassword = process.env.APP_PASSWORD;
  if (!appPassword) return res.status(500).json({ error: 'Server misconfigured' });

  // Support both plain and bcrypt hashed passwords
  let valid = false;
  if (appPassword.startsWith('$2')) {
    valid = await bcrypt.compare(password, appPassword);
  } else {
    valid = password === appPassword;
  }

  if (!valid) return res.status(401).json({ error: 'Invalid password' });

  req.session.authenticated = true;
  req.session.save();
  return res.json({ success: true });
});

app.post('/api/auth/logout', (req, res) => {
  req.session.destroy();
  res.json({ success: true });
});

app.get('/api/auth/check', (req, res) => {
  res.json({ authenticated: !!(req.session && req.session.authenticated) });
});

// ─── Project Routes ────────────────────────────────────────────────────────

// GET all rows
app.get('/api/projects', requireAuth, async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM projects ORDER BY created_at ASC');
    res.json(result.rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Database error' });
  }
});

// GET single row
app.get('/api/projects/:id', requireAuth, async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM projects WHERE id = $1', [req.params.id]);
    if (!result.rows.length) return res.status(404).json({ error: 'Not found' });
    res.json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: 'Database error' });
  }
});

// POST create new row
app.post('/api/projects', requireAuth, async (req, res) => {
  const {
    date, project_id, client_name, lead_source, description,
    sales_owner, stage, proposal_value, probability,
    next_action, last_followup_date, expected_closure_date,
    risk_concern, link, comments
  } = req.body;

  try {
    const result = await pool.query(`
      INSERT INTO projects (
        date, project_id, client_name, lead_source, description,
        sales_owner, stage, proposal_value, probability,
        next_action, last_followup_date, expected_closure_date,
        risk_concern, link, comments
      ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15)
      RETURNING *
    `, [
      date || null, project_id, client_name, lead_source, description,
      sales_owner, stage, proposal_value || null, probability,
      next_action, last_followup_date || null, expected_closure_date || null,
      risk_concern, link, comments
    ]);
    res.status(201).json(result.rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Database error: ' + err.message });
  }
});

// PUT update row
app.put('/api/projects/:id', requireAuth, async (req, res) => {
  const {
    date, project_id, client_name, lead_source, description,
    sales_owner, stage, proposal_value, probability,
    next_action, last_followup_date, expected_closure_date,
    risk_concern, link, comments
  } = req.body;

  try {
    const result = await pool.query(`
      UPDATE projects SET
        date=$1, project_id=$2, client_name=$3, lead_source=$4, description=$5,
        sales_owner=$6, stage=$7, proposal_value=$8, probability=$9,
        next_action=$10, last_followup_date=$11, expected_closure_date=$12,
        risk_concern=$13, link=$14, comments=$15, updated_at=NOW()
      WHERE id=$16
      RETURNING *
    `, [
      date || null, project_id, client_name, lead_source, description,
      sales_owner, stage, proposal_value || null, probability,
      next_action, last_followup_date || null, expected_closure_date || null,
      risk_concern, link, comments, req.params.id
    ]);
    if (!result.rows.length) return res.status(404).json({ error: 'Not found' });
    res.json(result.rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Database error: ' + err.message });
  }
});

// DELETE row
app.delete('/api/projects/:id', requireAuth, async (req, res) => {
  const id = parseInt(req.params.id, 10);
  if (!Number.isInteger(id)) {
    return res.status(400).json({ error: 'Invalid id' });
  }
  try {
    const result = await pool.query('DELETE FROM projects WHERE id=$1 RETURNING id', [id]);
    if (!result.rows.length) return res.status(404).json({ error: 'Not found' });
    res.json({ success: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Database error: ' + err.message });
  }
});

// Catch-all: serve frontend
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, '../frontend/index.html'));
});

// ─── Start ─────────────────────────────────────────────────────────────────
initDB().then(() => {
  app.listen(PORT, () => {
    console.log(`✅ Project Tracker running on http://localhost:${PORT}`);
  });
}).catch(err => {
  console.error('❌ Failed to initialize database:', err);
  process.exit(1);
});
