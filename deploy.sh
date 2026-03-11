#!/bin/bash
set -euo pipefail

# Configuration 
APP_NAME="node-runner"
DOMAIN="node-runner.thiering.org"
SERVER="root@89.58.39.82"
DEPLOY_DIR="/srv/node-runner"
API_PORT=7999
BRANCH="main"

# Colors 
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

info()  { echo -e "${GREEN}[deploy]${NC} $1"; }
warn()  { echo -e "${YELLOW}[deploy]${NC} $1"; }
error() { echo -e "${RED}[deploy]${NC} $1" >&2; exit 1; }

# Pre-checks 
command -v pnpm >/dev/null 2>&1 || error "pnpm is not installed"
command -v ssh  >/dev/null 2>&1 || error "ssh is not available"
command -v rsync >/dev/null 2>&1 || error "rsync is not installed"

# Build 
info "Installing dependencies..."
pnpm install --frozen-lockfile

info "Building all packages..."
pnpm build

# Verify build outputs exist
[[ -d apps/web/dist ]]       || error "Web build output not found (apps/web/dist)"
[[ -d apps/api/dist ]]       || error "API build output not found (apps/api/dist)"

# Deploy 
info "Deploying to ${SERVER}:${DEPLOY_DIR}..."

# Create directory structure on server (matches pnpm-workspace.yaml: apps/*, packages/*)
ssh "$SERVER" "mkdir -p ${DEPLOY_DIR}/apps/{api,web} ${DEPLOY_DIR}/packages/{shared,schemas,node-runner-core,config,ui}"

# Sync web static files (include package.json so pnpm workspace recognizes it)
info "Uploading frontend..."
rsync -avz --delete apps/web/dist/ apps/web/package.json "${SERVER}:${DEPLOY_DIR}/apps/web/"

# Sync API code
info "Uploading API..."
rsync -avz --delete --exclude='.env' --exclude='data' \
    apps/api/dist/ \
    apps/api/package.json \
    "${SERVER}:${DEPLOY_DIR}/apps/api/"

# Sync workspace packages that the API needs at runtime
info "Uploading shared packages..."
ssh "$SERVER" "mkdir -p ${DEPLOY_DIR}/packages/{shared,schemas,node-runner-core,config,ui}"

for pkg in shared schemas node-runner-core config ui; do
    if [[ -d "packages/${pkg}/dist" ]]; then
        rsync -avz --delete \
            "packages/${pkg}/dist" \
            "packages/${pkg}/package.json" \
            "${SERVER}:${DEPLOY_DIR}/packages/${pkg}/"
    elif [[ -d "packages/${pkg}/src" ]]; then
        rsync -avz --delete \
            "packages/${pkg}/src" \
            "packages/${pkg}/package.json" \
            "packages/${pkg}/tsconfig.json" \
            "${SERVER}:${DEPLOY_DIR}/packages/${pkg}/"
    fi
done

# Sync root workspace files needed for pnpm install
rsync -avz \
    package.json \
    pnpm-lock.yaml \
    pnpm-workspace.yaml \
    "${SERVER}:${DEPLOY_DIR}/"

# Install production dependencies and restart on server
info "Installing production dependencies and restarting..."
ssh "$SERVER" bash <<'REMOTE'
set -euo pipefail
export PATH="$HOME/.local/share/pnpm:$HOME/.nvm/versions/node/$(ls $HOME/.nvm/versions/node/ 2>/dev/null | tail -1)/bin:/usr/local/bin:$PATH"
cd /srv/node-runner

# Install production deps only
pnpm install --frozen-lockfile --prod 2>/dev/null || pnpm install --prod

# Restart the API service
if systemctl is-active --quiet node-runner-api; then
    systemctl restart node-runner-api
    echo "[deploy] Service restarted"
else
    systemctl start node-runner-api 2>/dev/null || echo "[deploy] Warning: Could not start service. Run 'systemctl enable --now node-runner-api' manually."
fi
REMOTE

info "Deploy complete! 🚀"
info "Site: https://${DOMAIN}"
