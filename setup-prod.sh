#!/bin/bash
# PMPlanner — Production Setup for Ubuntu 24.04
# Run as root: sudo bash setup-prod.sh
set -euo pipefail

# ─── Config ──────────────────────────────────────────────────────────────────
APP_DIR="/opt/pmplanner"
APP_USER="pmplanner"
DB_NAME="pmplanner"
DB_USER="pmplanner"
DB_PASS="pmplanner_dev"
ADMIN_USER="admin"
ADMIN_PASS="admin123"
VENV="$APP_DIR/venv"

# ─── Root check ───────────────────────────────────────────────────────────────
if [[ $EUID -ne 0 ]]; then
  echo "ERROR: Run this script as root (sudo bash $0)" >&2
  exit 1
fi

# ─── Repo URL ─────────────────────────────────────────────────────────────────
read -rp "Git repository URL: " REPO_URL
if [[ -z "$REPO_URL" ]]; then
  echo "ERROR: Repository URL is required." >&2
  exit 1
fi

echo ""
echo "==========================================================="
echo "  PMPlanner Production Setup"
echo "==========================================================="
echo "  Install dir : $APP_DIR"
echo "  App user    : $APP_USER"
echo "  DB name     : $DB_NAME"
echo "  Repo        : $REPO_URL"
echo "==========================================================="
echo ""

# ─── Step 1: System packages ─────────────────────────────────────────────────
echo "==> [1/9] Installing system packages..."
apt-get update -q
apt-get install -y \
  python3.12 python3.12-venv python3-pip \
  postgresql postgresql-contrib \
  nginx \
  nodejs npm \
  git \
  libpango-1.0-0 libpangoft2-1.0-0 libpangocairo-1.0-0 \
  libcairo2 libgdk-pixbuf2.0-0 libffi-dev

# Upgrade Node to 20 if the distro ships something older than 18
NODE_VER=$(node --version 2>/dev/null | grep -oE '[0-9]+' | head -1 || echo 0)
if [[ "$NODE_VER" -lt 18 ]]; then
  echo "  Node $NODE_VER < 18 — installing Node 20 via NodeSource..."
  curl -fsSL https://deb.nodesource.com/setup_20.x | bash -
  apt-get install -y nodejs
fi

# ─── Step 2: App user ────────────────────────────────────────────────────────
echo "==> [2/9] Creating system user '$APP_USER'..."
id "$APP_USER" &>/dev/null || useradd -r -m -d "$APP_DIR" -s /bin/bash "$APP_USER"

# ─── Step 3: PostgreSQL ───────────────────────────────────────────────────────
echo "==> [3/9] Setting up PostgreSQL..."
systemctl start postgresql
systemctl enable postgresql

sudo -u postgres psql -tc "SELECT 1 FROM pg_roles WHERE rolname='$DB_USER'" | grep -q 1 \
  || sudo -u postgres psql -c "CREATE USER $DB_USER WITH PASSWORD '$DB_PASS';"

sudo -u postgres psql -tc "SELECT 1 FROM pg_database WHERE datname='$DB_NAME'" | grep -q 1 \
  || sudo -u postgres psql -c "CREATE DATABASE $DB_NAME OWNER $DB_USER;"

# ─── Step 4: Clone repo ───────────────────────────────────────────────────────
echo "==> [4/9] Cloning repository to $APP_DIR..."
if [[ -d "$APP_DIR/.git" ]]; then
  echo "  Repository already present — pulling latest..."
  sudo -u "$APP_USER" git -C "$APP_DIR" pull
else
  if [[ -d "$APP_DIR" && "$(ls -A "$APP_DIR" 2>/dev/null)" ]]; then
    echo "ERROR: $APP_DIR is non-empty and not a git repo. Remove it first." >&2
    exit 1
  fi
  git clone "$REPO_URL" "$APP_DIR"
  chown -R "$APP_USER":"$APP_USER" "$APP_DIR"
fi

# ─── Step 5: Python venv ─────────────────────────────────────────────────────
echo "==> [5/9] Creating Python 3.12 virtual environment..."
sudo -u "$APP_USER" python3.12 -m venv "$VENV"
sudo -u "$APP_USER" "$VENV/bin/pip" install --quiet --upgrade pip
sudo -u "$APP_USER" "$VENV/bin/pip" install --quiet -r "$APP_DIR/backend/requirements.txt"

# ─── Step 6: Env file + uploads dir ──────────────────────────────────────────
echo "==> [6/9] Writing .env and creating uploads directory..."
SECRET_KEY=$(python3 -c "import secrets; print(secrets.token_hex(32))")
mkdir -p "$APP_DIR/uploads/logo" "$APP_DIR/uploads/templates"
chown -R "$APP_USER":"$APP_USER" "$APP_DIR/uploads"

cat > "$APP_DIR/backend/.env" <<ENV
DATABASE_URL=postgresql://$DB_USER:$DB_PASS@localhost:5432/$DB_NAME
SECRET_KEY=$SECRET_KEY
ACCESS_TOKEN_EXPIRE_MINUTES=480
UPLOADS_DIR=$APP_DIR/uploads
ENV
chown "$APP_USER":"$APP_USER" "$APP_DIR/backend/.env"

# ─── Step 7: Migrations + admin user ─────────────────────────────────────────
echo "==> [7/9] Running database migrations and creating admin user..."
sudo -u "$APP_USER" bash -c "cd '$APP_DIR/backend' && '$VENV/bin/alembic' upgrade head"

sudo -u "$APP_USER" "$VENV/bin/python3" - <<PY
import sys, os
sys.path.insert(0, '$APP_DIR/backend')
os.chdir('$APP_DIR/backend')
from app.db.session import SessionLocal
from app.crud.user import create
from app.schemas.user import UserCreate
db = SessionLocal()
try:
    create(db, UserCreate(username='$ADMIN_USER', password='$ADMIN_PASS', user_role='Admin'))
    print("  Admin user created.")
except Exception as e:
    print(f"  Note: admin user may already exist ({e})")
finally:
    db.close()
PY

# ─── Step 8: Frontend build ───────────────────────────────────────────────────
echo "==> [8/9] Building frontend..."
sudo -u "$APP_USER" bash -c "cd '$APP_DIR/frontend' && npm ci --silent && npm run build"

# ─── Step 9: systemd + nginx ─────────────────────────────────────────────────
echo "==> [9/9] Installing systemd service and nginx..."

cp "$APP_DIR/backend/deploy/pmplanner-backend.service" /etc/systemd/system/
systemctl daemon-reload
systemctl enable --now pmplanner-backend

# Write nginx config (adds /uploads/ proxy missing from the bundled conf)
cat > /etc/nginx/sites-available/pmplanner <<'NGINX'
server {
    listen 80;
    server_name _;

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
NGINX

ln -sf /etc/nginx/sites-available/pmplanner /etc/nginx/sites-enabled/pmplanner
rm -f /etc/nginx/sites-enabled/default
nginx -t
systemctl enable --now nginx
systemctl reload nginx

# ─── Done ─────────────────────────────────────────────────────────────────────
SERVER_IP=$(hostname -I | awk '{print $1}')
echo ""
echo "==========================================================="
echo "  Setup complete!"
echo "==========================================================="
echo "  App URL  : http://$SERVER_IP"
echo "  API docs : http://$SERVER_IP/api/docs"
echo "  Login    : $ADMIN_USER / $ADMIN_PASS"
echo ""
echo "  REMINDER: Change the admin password after first login."
echo "  REMINDER: DB password is '$DB_PASS' — update for"
echo "            production use (edit .env and pg role)."
echo "==========================================================="
