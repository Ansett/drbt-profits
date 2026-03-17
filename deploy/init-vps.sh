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
#   sudo DOMAIN=drbt-profits.ansett.xyz GITHUB_REPO=<lowercase user>/<repo> GITHUB_TOKEN=<ghcr_pat> MCP_API_KEY=<key> EMAIL=<email>  bash init-vps.sh

set -euo pipefail

DOMAIN="${DOMAIN:?Set DOMAIN}"
GITHUB_REPO="${GITHUB_REPO:?Set GITHUB_REPO (owner/repo)}"
GITHUB_TOKEN="${GITHUB_TOKEN:?Set GITHUB_TOKEN (PAT with read:packages scope)}"
MCP_API_KEY="${MCP_API_KEY:?Set MCP_API_KEY}"
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
MCP_API_KEY=$MCP_API_KEY
EOF

cat > "$APP_DIR/docker-compose.yml" <<'COMPOSE'
services:
  web:
    image: ghcr.io/${GITHUB_REPO}:web-latest
    restart: unless-stopped
    depends_on:
      - mcp
    volumes:
      - certbot-webroot:/var/www/certbot:ro
      - certbot-certs:/etc/letsencrypt:ro
    ports:
      - "80:80"
      - "443:443"
    environment:
      - DOMAIN=${DOMAIN}

  mcp:
    image: ghcr.io/${GITHUB_REPO}:mcp-latest
    restart: unless-stopped
    environment:
      - PORT=3100
      - MCP_API_KEY=${MCP_API_KEY}
    expose:
      - "3100"

  certbot:
    image: certbot/certbot
    volumes:
      - certbot-webroot:/var/www/certbot
      - certbot-certs:/etc/letsencrypt
    entrypoint: "/bin/sh -c 'trap exit TERM; while :; do certbot renew; sleep 12h & wait $${!}; done;'"

volumes:
  certbot-webroot:
  certbot-certs:
COMPOSE

echo "==> Pulling images..."
cd "$APP_DIR"
docker compose pull

echo "==> Obtaining initial SSL certificate..."
# Start a temporary nginx to serve the ACME challenge
docker run -d --name certbot-init \
  -p 80:80 \
  -v "$(docker volume inspect drbt-profits_certbot-webroot -f '{{ .Mountpoint }}' 2>/dev/null || echo '/tmp/certbot-webroot'):/var/www/certbot" \
  nginx:alpine sh -c "echo 'server { listen 80; location /.well-known/acme-challenge/ { root /var/www/certbot; } location / { return 444; } }' > /etc/nginx/conf.d/default.conf && nginx -g 'daemon off;'" \
  2>/dev/null || true

# Create volumes if they don't exist
docker compose up --no-start 2>/dev/null || true
docker compose down 2>/dev/null || true

# Run certbot to get initial certs
docker run --rm \
  -v drbt-profits_certbot-webroot:/var/www/certbot \
  -v drbt-profits_certbot-certs:/etc/letsencrypt \
  --network host \
  certbot/certbot certonly \
    --webroot -w /var/www/certbot \
    -d "$DOMAIN" \
    --email "$EMAIL" \
    --agree-tos \
    --non-interactive

docker rm -f certbot-init 2>/dev/null || true

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
