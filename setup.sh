#!/bin/bash
# Run as root on a fresh Ubuntu 22.04 VM.
set -e

APP_USER="pmplanner"
APP_DIR="/opt/pmplanner"
DB_NAME="pmplanner"
DB_USER="pmplanner"

echo "==> Installing system packages"
apt-get update -q
apt-get install -y python3.11 python3.11-venv python3-pip postgresql postgresql-contrib nginx \
    libpango-1.0-0 libpangoft2-1.0-0 libpangocairo-1.0-0 libcairo2 libgdk-pixbuf2.0-0 libffi-dev

echo "==> Creating app user"
id "$APP_USER" &>/dev/null || useradd -r -s /bin/false -d "$APP_DIR" "$APP_USER"

echo "==> Setting up database"
sudo -u postgres psql -tc "SELECT 1 FROM pg_roles WHERE rolname='$DB_USER'" | grep -q 1 || \
  sudo -u postgres psql -c "CREATE USER $DB_USER WITH PASSWORD 'CHANGE_THIS_PASSWORD';"
sudo -u postgres psql -tc "SELECT 1 FROM pg_database WHERE datname='$DB_NAME'" | grep -q 1 || \
  sudo -u postgres psql -c "CREATE DATABASE $DB_NAME OWNER $DB_USER;"

echo "==> Copying application files"
mkdir -p "$APP_DIR" /opt/pmplanner/uploads/templates
cp -r backend "$APP_DIR/"
chown -R "$APP_USER":"$APP_USER" "$APP_DIR"

echo "==> Creating Python virtual environment"
sudo -u "$APP_USER" python3.11 -m venv "$APP_DIR/venv"
sudo -u "$APP_USER" "$APP_DIR/venv/bin/pip" install --quiet -r "$APP_DIR/backend/requirements.txt"

echo "==> Writing .env"
cat > "$APP_DIR/backend/.env" <<EOF
DATABASE_URL=postgresql://$DB_USER:CHANGE_THIS_PASSWORD@localhost:5432/$DB_NAME
SECRET_KEY=$(python3 -c "import secrets; print(secrets.token_hex(32))")
ACCESS_TOKEN_EXPIRE_MINUTES=480
UPLOADS_DIR=/opt/pmplanner/uploads
EOF
chown "$APP_USER":"$APP_USER" "$APP_DIR/backend/.env"

echo "==> Running Alembic migrations"
cd "$APP_DIR/backend"
sudo -u "$APP_USER" "$APP_DIR/venv/bin/alembic" upgrade head

echo "==> Installing systemd service"
cp /opt/pmplanner/backend/deploy/pmplanner-backend.service /etc/systemd/system/
systemctl daemon-reload
systemctl enable pmplanner-backend
systemctl start pmplanner-backend

echo "==> Installing nginx config"
cp /opt/pmplanner/backend/deploy/nginx-pmplanner.conf /etc/nginx/sites-available/pmplanner
ln -sf /etc/nginx/sites-available/pmplanner /etc/nginx/sites-enabled/pmplanner
nginx -t && systemctl reload nginx

echo ""
echo "Done. Backend running at http://$(hostname -I | awk '{print $1}'):80"
echo "IMPORTANT: Edit $APP_DIR/backend/.env and change CHANGE_THIS_PASSWORD."
