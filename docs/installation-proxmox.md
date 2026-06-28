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

SSH into the VM as root or a sudo user.

```bash
sudo apt update && sudo apt upgrade -y
sudo apt install -y git python3 python3-pip python3-venv nodejs npm nginx postgresql
```

Verify Node is recent enough (18+):

```bash
node --version   # should be 18+
```

If the distro ships an older Node, install via NodeSource:

```bash
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt install -y nodejs
```

---

## 3. Create a Dedicated System User

```bash
sudo useradd -r -m -d /opt/pmplanner -s /bin/bash pmplanner
```

---

## 4. Set Up PostgreSQL

```bash
sudo -u postgres psql <<'SQL'
CREATE USER pmplanner WITH PASSWORD 'change_this_password';
CREATE DATABASE pmplanner OWNER pmplanner;
SQL
```

> Change `change_this_password` to something strong before deploying.

---

## 5. Deploy the Application Code

```bash
sudo mkdir -p /opt/pmplanner
sudo chown pmplanner:pmplanner /opt/pmplanner
sudo -u pmplanner git clone <your-repo-url> /opt/pmplanner/repo
```

If you are copying from a local machine rather than cloning:

```bash
rsync -av /home/jasond/Documents/PMPlanner/ pmplanner@<vm-ip>:/opt/pmplanner/repo/
```

---

## 6. Backend Setup

```bash
sudo -u pmplanner bash -c "
  python3 -m venv /opt/pmplanner/venv
  /opt/pmplanner/venv/bin/pip install --upgrade pip
  /opt/pmplanner/venv/bin/pip install -r /opt/pmplanner/repo/backend/requirements.txt
"
```

Create the environment file:

```bash
sudo -u pmplanner tee /opt/pmplanner/repo/backend/.env > /dev/null <<'ENV'
DATABASE_URL=postgresql://pmplanner:change_this_password@localhost/pmplanner
SECRET_KEY=replace_with_a_long_random_string_at_least_32_chars
ACCESS_TOKEN_EXPIRE_MINUTES=480
UPLOADS_DIR=/opt/pmplanner/uploads
ENV
```

Generate a proper secret key:

```bash
python3 -c "import secrets; print(secrets.token_hex(32))"
```

Create the uploads directory:

```bash
sudo mkdir -p /opt/pmplanner/uploads/logo
sudo chown -R pmplanner:pmplanner /opt/pmplanner/uploads
```

Run database migrations:

```bash
sudo -u pmplanner bash -c "
  cd /opt/pmplanner/repo/backend
  /opt/pmplanner/venv/bin/alembic upgrade head
"
```

---

## 7. Frontend Build

```bash
sudo -u pmplanner bash -c "
  cd /opt/pmplanner/repo/frontend
  npm ci
  npm run build
"
```

The compiled output lands in `/opt/pmplanner/repo/frontend/dist/`.

---

## 8. Install the systemd Service

Copy the included service file:

```bash
sudo cp /opt/pmplanner/repo/backend/deploy/pmplanner-backend.service /etc/systemd/system/
```

The service file expects:
- App at `/opt/pmplanner/repo/backend`
- Venv at `/opt/pmplanner/venv`
- `.env` at `/opt/pmplanner/repo/backend/.env`

Enable and start:

```bash
sudo systemctl daemon-reload
sudo systemctl enable --now pmplanner-backend
sudo systemctl status pmplanner-backend
```

Check logs if the service fails to start:

```bash
sudo journalctl -u pmplanner-backend -n 50
```

---

## 9. Configure nginx

Copy the included nginx config:

```bash
sudo cp /opt/pmplanner/repo/backend/deploy/nginx-pmplanner.conf /etc/nginx/sites-available/pmplanner
sudo ln -s /etc/nginx/sites-available/pmplanner /etc/nginx/sites-enabled/pmplanner
sudo rm -f /etc/nginx/sites-enabled/default
```

The config serves:
- `/api/*` → proxied to uvicorn on `127.0.0.1:8000`
- `/` → static files from the frontend dist build

Test and reload:

```bash
sudo nginx -t
sudo systemctl enable --now nginx
sudo systemctl reload nginx
```

---

## 10. Create the First Admin User

```bash
sudo -u pmplanner /opt/pmplanner/venv/bin/python3 - <<'PY'
import sys
sys.path.insert(0, '/opt/pmplanner/repo/backend')
import os; os.environ.setdefault('DOTENV_PATH', '/opt/pmplanner/repo/backend/.env')

from app.db.session import SessionLocal
from app.crud.user import create_user
from app.schemas.user import UserCreate

db = SessionLocal()
create_user(db, UserCreate(username='admin', password='changeme', user_role='Admin'))
db.close()
print('Admin user created.')
PY
```

Log in at `http://<vm-ip>/` with `admin` / `changeme` and change the password immediately via the Users page.

---

## 11. Optional — HTTPS with a Self-Signed Certificate

For internal use with a fixed IP, a self-signed cert is sufficient:

```bash
sudo apt install -y openssl
sudo openssl req -x509 -nodes -days 3650 -newkey rsa:2048 \
  -keyout /etc/ssl/private/pmplanner.key \
  -out /etc/ssl/certs/pmplanner.crt \
  -subj "/CN=pmplanner.local"
```

Then update `/etc/nginx/sites-available/pmplanner`:

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
        alias /opt/pmplanner/uploads/;
    }

    location / {
        root /opt/pmplanner/repo/frontend/dist;
        try_files $uri $uri/ /index.html;
    }
}
```

```bash
sudo nginx -t && sudo systemctl reload nginx
```

---

## 12. Updating PMPlanner

```bash
sudo -u pmplanner bash -c "
  cd /opt/pmplanner/repo
  git pull

  # Backend deps (if requirements.txt changed)
  /opt/pmplanner/venv/bin/pip install -r backend/requirements.txt

  # Database migrations
  cd backend && /opt/pmplanner/venv/bin/alembic upgrade head && cd ..

  # Frontend rebuild
  cd frontend && npm ci && npm run build
"

sudo systemctl restart pmplanner-backend
sudo systemctl reload nginx
```

---

## 13. Backups

The app has a built-in backup feature (Settings → Database Backup & Restore) that exports a `.sql` dump. For automated server-side backups, add a cron job:

```bash
sudo -u pmplanner crontab -e
```

```cron
0 2 * * * pg_dump -U pmplanner pmplanner | gzip > /opt/pmplanner/backups/$(date +\%Y-\%m-\%d).sql.gz
```

```bash
sudo -u pmplanner mkdir -p /opt/pmplanner/backups
```

---

## Troubleshooting

| Symptom | Check |
|---|---|
| White screen / 404 on `/` | Frontend dist not built, or nginx root path wrong |
| API calls return 502 | Backend service not running — `systemctl status pmplanner-backend` |
| Database connection error | `.env` `DATABASE_URL` or PostgreSQL user/password mismatch |
| Uploads not served | `/opt/pmplanner/uploads` ownership or nginx `location /uploads/` missing |
| Migrations fail | Run `alembic upgrade head` manually and read the error output |
