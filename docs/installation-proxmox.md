# PMPlanner — Proxmox Installation Guide

This guide covers deploying PMPlanner on a dedicated Ubuntu/Debian VM inside Proxmox VE. The stack is: **PostgreSQL + FastAPI backend (uvicorn) + React frontend served by nginx**, all on a single VM with systemd managing the backend process.

---

## 1. Create the VM in Proxmox

1. In the Proxmox web UI, click **Create VM**.
2. Recommended specs:
   | Setting | Value |
   |---|---|
   | OS | Ubuntu 24.04 LTS (or Debian 12) |
   | CPU | 2 cores |
   | RAM | 2 GB |
   | Disk | 20 GB (thin-provisioned is fine) |
   | Network | VirtIO, bridge to your LAN bridge (e.g. `vmbr0`) |
3. Assign a static IP either via your router's DHCP reservation or by editing `/etc/netplan/` inside the VM after first boot.
4. Enable the QEMU Guest Agent:
   - In Proxmox: VM → Options → QEMU Guest Agent → Enabled
   - Inside the VM: `sudo apt install -y qemu-guest-agent && sudo systemctl enable --now qemu-guest-agent`

---

## 2. Prepare the VM

SSH into the VM as root or a sudo user and run a system update:

```bash
sudo apt update && sudo apt upgrade -y
```

No other manual prerequisites are needed — the setup script installs everything else.

---

## 3. Run the Setup Script

Copy `setup-prod.sh` from the repo root onto the VM (or clone the repo first and run it from there):

```bash
# Option A — rsync the script from your local machine
rsync -av /home/jasond/Documents/PMPlanner/setup-prod.sh root@<vm-ip>:/root/

# Option B — the script is already on the VM (e.g. after git clone)
```

Then run it as root:

```bash
sudo bash setup-prod.sh
```

When prompted, enter the git repository URL. The script then performs all remaining steps automatically:

| Step | What it does |
|---|---|
| System packages | Python 3.12, PostgreSQL, nginx, Node 20, WeasyPrint libs |
| App user | Creates the `pmplanner` system user |
| PostgreSQL | Creates the `pmplanner` role and database (idempotent) |
| Clone repo | Clones to `/opt/pmplanner` (or pulls if already present) |
| Python venv | Creates `/opt/pmplanner/venv`, installs `requirements.txt` |
| `.env` | Writes `/opt/pmplanner/backend/.env` with a fresh `SECRET_KEY` |
| Migrations | Runs `alembic upgrade head` |
| Admin user | Creates `admin / admin123` |
| Frontend | Runs `npm ci && npm run build` |
| systemd | Installs and starts `pmplanner-backend.service` |
| nginx | Installs config and reloads nginx |

When the script finishes it prints the app URL and login credentials.

> **After first login:** change the admin password via the Users page.

---

## 4. Optional — HTTPS with a Self-Signed Certificate

For internal use with a fixed IP, a self-signed cert is sufficient:

```bash
sudo apt install -y openssl
sudo openssl req -x509 -nodes -days 3650 -newkey rsa:2048 \
  -keyout /etc/ssl/private/pmplanner.key \
  -out /etc/ssl/certs/pmplanner.crt \
  -subj "/CN=pmplanner.local"
```

Replace `/etc/nginx/sites-available/pmplanner` with:

```nginx
server {
    listen 80;
    return 301 https://$host$request_uri;
}

server {
    listen 443 ssl;
    server_name _;

    ssl_certificate     /etc/ssl/certs/pmplanner.crt;
    ssl_certificate_key /etc/ssl/private/pmplanner.key;

    client_max_body_size 20M;

    location /api/ {
        proxy_pass http://127.0.0.1:8000;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    }

    location /uploads/ {
        proxy_pass http://127.0.0.1:8000;
        proxy_set_header Host $host;
    }

    location / {
        root /opt/pmplanner/frontend/dist;
        try_files $uri $uri/ /index.html;
    }
}
```

```bash
sudo nginx -t && sudo systemctl reload nginx
```

---

## 5. Updating PMPlanner

```bash
sudo -u pmplanner bash -c "
  cd /opt/pmplanner
  git pull

  # Backend deps (if requirements.txt changed)
  venv/bin/pip install -r backend/requirements.txt

  # Database migrations
  cd backend && ../venv/bin/alembic upgrade head && cd ..

  # Frontend rebuild
  cd frontend && npm ci && npm run build
"

sudo systemctl restart pmplanner-backend
sudo systemctl reload nginx
```

---

## 6. Backups

The app has a built-in backup feature (Settings → Database Backup & Restore) that exports a `.sql` dump. For automated server-side backups, add a cron job:

```bash
sudo -u pmplanner mkdir -p /opt/pmplanner/backups
sudo -u pmplanner crontab -e
```

```cron
0 2 * * * pg_dump -U pmplanner pmplanner | gzip > /opt/pmplanner/backups/$(date +\%Y-\%m-\%d).sql.gz
```

---

## Troubleshooting

| Symptom | Check |
|---|---|
| White screen / 404 on `/` | Frontend dist not built — re-run `npm ci && npm run build` in `frontend/` |
| API calls return 502 | Backend not running — `systemctl status pmplanner-backend` |
| Database connection error | `.env` `DATABASE_URL` or PostgreSQL user/password mismatch |
| Uploads not served | `systemctl status pmplanner-backend` — the backend serves `/uploads/` via FastAPI |
| Migrations fail | Run `alembic upgrade head` manually from `/opt/pmplanner/backend` and read the error |
| Script fails mid-way | Fix the reported error, then re-run `sudo bash setup-prod.sh` — PostgreSQL and user creation steps are idempotent |
