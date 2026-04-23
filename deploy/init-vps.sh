#!/usr/bin/env bash
# One-time VPS setup script for drbt-profits
# Run as root on a fresh Hetzner VPS (Ubuntu/Debian)
# (deactivate Cloudflare proxy on domaine, at least for the setup)
#
# Usage:
#   Set the GitHub Actions secrets
#   Push to master to images are pushed to GHCR
#   scp deploy/init-vps.sh root@<VPS_IP>:~/init-vps.sh
#   ssh root@<VPS_IP>
#   sudo cp init-vps.sh /root
#   cd root
#   sudo usermod -aG docker tiky
#   sudo DOMAIN=drbt-profits.ansett.xyz GITHUB_REPO=<lowercase user>/<repo> GITHUB_TOKEN=<ghcr_pat> MCP_ADMIN_KEY=<key> EMAIL=<email>  bash init-vps.sh

set -euo pipefail

DOMAIN="${DOMAIN:?Set DOMAIN}"
GITHUB_REPO="${GITHUB_REPO:?Set GITHUB_REPO (owner/repo)}"
GITHUB_TOKEN="${GITHUB_TOKEN:?Set GITHUB_TOKEN (PAT with read:packages scope)}"
MCP_ADMIN_KEY="${MCP_ADMIN_KEY:?Set MCP_ADMIN_KEY}"
EMAIL="${EMAIL:?Set EMAIL (for Lets Encrypt)}"
APP_DIR="/opt/drbt-profits"

echo "==> Installing Docker..."
apt-get update -qq
apt-get install -y -qq ca-certificates curl
install -m 0755 -d /etc/apt/keyrings
curl -fsSL https://download.docker.com/linux/ubuntu/gpg -o /etc/apt/keyrings/docker.asc
chmod a+r /etc/apt/keyrings/docker.asc
echo "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.asc] https://download.docker.com/linux/ubuntu $(. /etc/os-release && echo "$VERSION_CODENAME") stable" > /etc/apt/sources.list.d/docker.list
apt-get update -qq
apt-get install -y -qq docker-ce docker-ce-cli containerd.io docker-compose-plugin
systemctl enable --now docker

echo "==> Logging in to GHCR..."
echo "$GITHUB_TOKEN" | docker login ghcr.io -u "${GITHUB_REPO%%/*}" --password-stdin

echo "==> Setting up app directory..."
mkdir -p "$APP_DIR"
cat > "$APP_DIR/.env" <<EOF
DOMAIN=$DOMAIN
GITHUB_REPO=$GITHUB_REPO
MCP_ADMIN_KEY=$MCP_ADMIN_KEY
EOF

cp deploy/docker-compose.yml "$APP_DIR/docker-compose.yml"

echo "==> Pulling images..."
cd "$APP_DIR"
docker compose pull

echo "==> Starting services..."
docker compose up -d

echo ""
echo "=== Setup complete ==="
echo "Site: https://$DOMAIN"
echo "MCP:  https://$DOMAIN/mcp"
echo ""
echo "GitHub Actions will auto-deploy on push to master."
echo "Make sure these GitHub repo secrets are set:"
echo "  VPS_HOST     — your VPS IP"
echo "  VPS_USER     — ssh user (e.g. root)"
echo "  VPS_SSH_KEY  — ssh private key"
echo "  VITE_BUGSNAP_API — Bugsnag API key"
