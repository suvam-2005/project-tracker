# Project Tracker

A clean, futuristic web-based CRM/project pipeline tracker for teams. Anyone with the link and password can view, add, edit, or delete rows in a shared live spreadsheet — no Excel, no Google Sheets.

---

## Features

- **Shared live table** — everyone sees the same data in real time
- **Single-password access** — simple gate, no user accounts needed
- **7-day persistent sessions** — stay logged in across browser restarts
- **Calendar date pickers** — for Date, Last Follow-up Date, and Expected Closure Date
- **Stage dropdown** — Bid Submitted, Awaiting Client Response, Meeting Scheduled, Meeting Completed, Proposal/Estimate Sent, Won, Lost, On Hold
- **Probability selector** — Low / Medium / High with colour-coded badges
- **Proposal value in ₹ INR** — formatted with Indian number system
- **Search + filter** — live search across all fields, filter by stage and probability
- **Add / Edit / Delete** rows via a modal form
- **PostgreSQL backend** — data stored in Docker-managed Postgres
- **Rate-limited login** — blocks brute-force attempts

---

## Project Structure

```
project-tracker/
├── backend/
│   ├── server.js          # Express API server
│   ├── db.js              # PostgreSQL pool + schema init
│   ├── package.json
│   └── .env.example       # Environment variable template
├── frontend/
│   └── index.html         # Single-file SPA (no build step)
├── docker/
│   ├── docker-compose.yml # PostgreSQL container
│   └── .env.example       # Docker env template
├── ecosystem.config.js    # PM2 process config
├── nginx.conf.example     # Nginx reverse proxy config
├── README.md
└── Setup.md
```

---

## Tech Stack

| Layer    | Technology                        |
|----------|-----------------------------------|
| Frontend | Vanilla HTML / CSS / JS (no build)|
| Backend  | Node.js + Express                 |
| Database | PostgreSQL 16 (Docker)            |
| Sessions | express-session + connect-pg-simple|
| Process  | PM2                               |
| Proxy    | Nginx                             |

---

## Environment Variables

All configuration lives in `backend/.env`. See `backend/.env.example` for the template.

| Variable        | Description                                  |
|-----------------|----------------------------------------------|
| `PORT`          | Port the Node app listens on (default 3000)  |
| `NODE_ENV`      | `production` or `development`                |
| `DB_HOST`       | Postgres host (usually `localhost`)          |
| `DB_PORT`       | Postgres port (default 5432)                 |
| `DB_NAME`       | Database name                                |
| `DB_USER`       | Database user                                |
| `DB_PASSWORD`   | Database password                            |
| `SESSION_SECRET`| Long random string for session signing       |
| `APP_PASSWORD`  | The single access password for all users     |

---

## Security Notes

- `APP_PASSWORD` in `.env` can be plain text or a **bcrypt hash** (`$2b$...`). Using a bcrypt hash is recommended for production.
- Sessions are stored in PostgreSQL and survive server restarts.
- Login is rate-limited to 10 attempts per 15 minutes per IP.
- The Postgres port is bound to `127.0.0.1` only — not exposed to the internet.
- Nginx is configured as a reverse proxy; Node never faces the internet directly.

---

See **Setup.md** for full installation instructions.
