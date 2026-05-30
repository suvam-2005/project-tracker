# Setup Guide

This guide covers both **local development** and **production server** deployment.

---

## Prerequisites

| Tool        | Minimum Version | Check command         |
|-------------|----------------|-----------------------|
| Node.js     | 18+            | `node -v`             |
| npm         | 9+             | `npm -v`              |
| Docker      | 24+            | `docker -v`           |
| Docker Compose | v2+         | `docker compose version` |

> **Server only:** Nginx and PM2 are also required (see Section 2).

---

## Section 1 — Local Development

### 1.1 Clone / copy the project

```bash
git clone <your-repo-url> project-tracker
cd project-tracker
```

Or simply copy the folder to your machine.

### 1.2 Start PostgreSQL with Docker

```bash
cd docker
cp .env.example .env
```

Edit `docker/.env` and set a strong `DB_PASSWORD`:

```
DB_NAME=project_tracker
DB_USER=tracker_user
DB_PASSWORD=mysecretpassword
DB_PORT=5432
```

Then start the container:

```bash
docker compose up -d
```

Verify it's running:

```bash
docker compose ps
# Should show project-tracker-db as "healthy"
```

### 1.3 Configure the backend

```bash
cd ../backend
cp .env.example .env
```

Edit `backend/.env`:

```env
PORT=3000
NODE_ENV=development

DB_HOST=localhost
DB_PORT=5432
DB_NAME=project_tracker
DB_USER=tracker_user
DB_PASSWORD=mysecretpassword      # same as docker/.env

SESSION_SECRET=replace_with_a_long_random_string_at_least_32_chars
APP_PASSWORD=yourAccessPassword   # this is what users type to log in
```

**Generating a secure SESSION_SECRET:**

```bash
node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"
```

### 1.4 Install dependencies and start

```bash
npm install
npm run dev
```

Open your browser at: **http://localhost:3000**

The database table is created automatically on first run.

### 1.5 Stop everything

```bash
# Stop Node (Ctrl+C in terminal)

# Stop Postgres
cd docker
docker compose down
```

---

## Section 2 — Production Server Deployment

> **Assumption:** Your server already runs Nginx and has other apps hosted.  
> This guide adds Project Tracker without touching your existing setup.

### 2.1 Install Node.js (if not already installed)

```bash
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt-get install -y nodejs
node -v   # should print v20.x.x
```

### 2.2 Install PM2 globally (if not already installed)

```bash
sudo npm install -g pm2
```

### 2.3 Copy the project to the server

```bash
# On your local machine:
scp -r ./project-tracker user@your-server-ip:/opt/project-tracker

# Or on the server, clone from git:
cd /opt
git clone <your-repo-url> project-tracker
```

### 2.4 Start PostgreSQL with Docker

> If you already have a Postgres container running on your server, you can create a new database inside it instead (see note at the end of this section).

```bash
cd /opt/project-tracker/docker
cp .env.example .env
nano .env   # set DB_PASSWORD and other values
```

Start the container:

```bash
docker compose up -d
```

Verify:

```bash
docker compose ps
docker compose logs postgres
```

> **Note — Using an existing Postgres container:**  
> If you already have a Postgres Docker container, create a new database and user inside it:
> ```bash
> docker exec -it <your-existing-postgres-container> psql -U postgres
> CREATE DATABASE project_tracker;
> CREATE USER tracker_user WITH PASSWORD 'yourpassword';
> GRANT ALL PRIVILEGES ON DATABASE project_tracker TO tracker_user;
> \q
> ```
> Then set `DB_HOST=localhost` and the matching credentials in `backend/.env`. Skip running `docker/docker-compose.yml`.

### 2.5 Configure the backend

```bash
cd /opt/project-tracker/backend
cp .env.example .env
nano .env
```

Fill in all values. For `SESSION_SECRET`:

```bash
node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"
```

For a bcrypt-hashed `APP_PASSWORD` (recommended):

```bash
node -e "const b=require('bcryptjs'); b.hash('yourPassword',12).then(h=>console.log(h))"
```

Copy the output hash and paste it as `APP_PASSWORD=...` in `.env`.

### 2.6 Install dependencies

```bash
cd /opt/project-tracker/backend
npm install --omit=dev
```

### 2.7 Create log directory

```bash
sudo mkdir -p /var/log/project-tracker
sudo chown $USER:$USER /var/log/project-tracker
```

### 2.8 Configure PM2

Edit `ecosystem.config.js` and update `cwd` to match your path:

```js
cwd: '/opt/project-tracker',   // ← already set if you used /opt
```

Start with PM2:

```bash
cd /opt/project-tracker
pm2 start ecosystem.config.js
```

Check it's running:

```bash
pm2 status
pm2 logs project-tracker --lines 30
```

Save PM2 process list so it survives reboots:

```bash
pm2 save
pm2 startup    # follow the printed command if prompted
```

### 2.9 Configure Nginx

Copy the example config:

```bash
sudo cp /opt/project-tracker/nginx.conf.example /etc/nginx/sites-available/project-tracker
sudo nano /etc/nginx/sites-available/project-tracker
```

Update `server_name` to your domain or subdomain:

```nginx
server_name tracker.yourdomain.com;
```

Also make sure the `proxy_pass` port matches your `PORT` in `.env` (default `3000`).

Enable the site:

```bash
sudo ln -s /etc/nginx/sites-available/project-tracker /etc/nginx/sites-enabled/
sudo nginx -t       # test config — must say "syntax is ok"
sudo systemctl reload nginx
```

Visit **http://tracker.yourdomain.com** — you should see the login screen.

### 2.10 Add HTTPS with Certbot (recommended)

```bash
sudo apt install -y certbot python3-certbot-nginx
sudo certbot --nginx -d tracker.yourdomain.com
```

Certbot will automatically update your Nginx config for HTTPS. After this, open `nginx.conf.example` and uncomment the HTTPS block as a reference if you need to modify it manually later.

Auto-renewal is set up by Certbot automatically. Test it:

```bash
sudo certbot renew --dry-run
```

---

## Updating the App

```bash
cd /opt/project-tracker

# Pull latest code (if using git)
git pull

# Re-install dependencies if package.json changed
cd backend && npm install --omit=dev && cd ..

# Restart the app
pm2 restart project-tracker
```

---

## Useful Commands

```bash
# View live logs
pm2 logs project-tracker

# Restart app
pm2 restart project-tracker

# Stop app
pm2 stop project-tracker

# Check Postgres container
docker ps | grep project-tracker-db

# View Postgres logs
cd /opt/project-tracker/docker && docker compose logs -f postgres

# Connect to Postgres directly
docker exec -it project-tracker-db psql -U tracker_user -d project_tracker

# Backup the database
docker exec project-tracker-db pg_dump -U tracker_user project_tracker > backup_$(date +%Y%m%d).sql

# Restore from backup
docker exec -i project-tracker-db psql -U tracker_user -d project_tracker < backup_20260101.sql
```

---

## Troubleshooting

| Problem | Check |
|---------|-------|
| Login screen shows but API fails | `pm2 logs project-tracker` — check DB connection error |
| "Connection refused" on DB | `docker ps` — is `project-tracker-db` running and healthy? |
| Nginx 502 Bad Gateway | Is Node running? `pm2 status`. Does port match `.env`? |
| Sessions lost on restart | PM2 is managing restarts; sessions survive in Postgres |
| Password not working | Double-check `APP_PASSWORD` in `backend/.env`. If bcrypt hash, ensure no extra spaces |
| Port conflict on 5432 | Change `DB_PORT` in `docker/.env` and `DB_PORT` in `backend/.env` to e.g. `5433` |
