# VPS Deployment Guide

This guide explains how to set up automatic deployments to your VPS using GitHub Actions.

## Prerequisites

- A VPS with Docker and Docker Compose installed
- SSH access to your VPS
- A GitHub repository with the build workflow

Optional but required for CI-triggered deploys from inside your network:
- A self-hosted GitHub Actions runner on a host that can reach the private VPS (we use the label `rserver`).
## Setup Instructions

### 1. Prepare Your VPS

SSH into your VPS and create the deployment directory:

```bash
mkdir -p /app
cd /app

# Clone or copy docker-compose.prod.yml here
# Copy necessary environment files
```

### 2. Generate SSH Key for GitHub Actions

On your VPS, generate a dedicated SSH key for deployments:

```bash
ssh-keygen -t ed25519 -f /home/deploy-user/.ssh/github-actions -N "" -C "github-actions"
```

Add the public key to your VPS's authorized_keys:

```bash
cat /home/deploy-user/.ssh/github-actions.pub >> /home/deploy-user/.ssh/authorized_keys
chmod 600 /home/deploy-user/.ssh/authorized_keys
```

### 3. Add GitHub Secrets

Go to your GitHub repository → Settings → Secrets and variables → Actions

Add the following secrets:

#### For Staging (develop branch):
- `VPS_HOST_STAGING`: Your VPS hostname or IP (e.g., `staging.example.com`)
- `VPS_USER_STAGING`: SSH user (e.g., `deploy-user`)
- `VPS_PORT_STAGING`: SSH port (e.g., `22`)
- `VPS_KEY_STAGING`: Contents of `/home/deploy-user/.ssh/github-actions` (private key)

#### For Production (main branch):
- `VPS_HOST_PROD`: Your VPS hostname or IP
- `VPS_USER_PROD`: SSH user
- `VPS_PORT_PROD`: SSH port
- `VPS_KEY_PROD`: Private SSH key

**⚠️ Important**: The SSH keys should contain the full private key content, starting with `-----BEGIN OPENSSH PRIVATE KEY-----` and ending with `-----END OPENSSH PRIVATE KEY-----`.

### 4. Create Environment Files on VPS

Create `.env` files for each environment:

**For staging** (`/app/.env.staging`):
```bash
POSTGRES_USER=gocanopy
POSTGRES_PASSWORD=your-secure-password
POSTGRES_DB=gocanopy
MINIO_ACCESS_KEY=minioadmin
MINIO_SECRET_KEY=your-secure-minio-password
MINIO_BUCKET=assets
FRONTEND_ORIGIN=https://staging.example.com
VITE_API_URL=https://api-staging.example.com
```

**For production** (`/app/.env.prod`):
```bash
POSTGRES_USER=gocanopy
POSTGRES_PASSWORD=your-very-secure-password
POSTGRES_DB=gocanopy
MINIO_ACCESS_KEY=minioadmin
MINIO_SECRET_KEY=your-very-secure-minio-password
MINIO_BUCKET=assets
FRONTEND_ORIGIN=https://example.com
VITE_API_URL=https://api.example.com
```

### 5. Use `docker-compose.prod.yml` on the VPS

Use the production compose file at `/app/docker-compose.prod.yml`. Update the `.env` path in the deploy workflow or symlink it:

```bash
ln -s .env.prod .env
```

### 5.1 Self-hosted runner (recommended for private networks)

If your VPS is on a private network (not reachable from public GitHub runners), install a self-hosted runner on a host that can reach the VPS and give it the label `rserver`. The deploy workflow is configured to run on that label.

Runner registration & start example (run on the runner host):

```bash
mkdir -p ~/actions-runner && cd ~/actions-runner
# download the runner archive (choose the correct asset for your arch)
curl -O -L https://github.com/actions/runner/releases/latest/download/actions-runner-linux-x64-2.334.0.tar.gz
tar xzf actions-runner-linux-x64-2.334.0.tar.gz
# get the registration command/token from GitHub (Settings -> Actions -> Runners -> New self-hosted runner)
./config.sh --url https://github.com/<OWNER>/<REPO> --token <TOKEN> --labels rserver,self-hosted --unattended
nohup ./run.sh > runner.log 2>&1 &
```

Make sure the runner host can reach your image registry (ghcr.io) and Docker is installed.

### 6. Set Up Nginx Reverse Proxy (Optional but Recommended)

To expose your application securely:

```nginx
upstream backend {
    server backend:8000;
}

upstream frontend {
    server frontend:5173;
}

server {
    listen 80;
    server_name example.com api.example.com;
    return 301 https://$server_name$request_uri;
}

server {
    listen 443 ssl http2;
    server_name api.example.com;
    
    ssl_certificate /etc/letsencrypt/live/example.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/example.com/privkey.pem;
    
    location / {
        proxy_pass http://backend;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}

server {
    listen 443 ssl http2;
    server_name example.com;
    
    ssl_certificate /etc/letsencrypt/live/example.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/example.com/privkey.pem;
    
    location / {
        proxy_pass http://frontend;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
```

## Deployment Workflow

1. Push code to `develop` branch → runs the `Build` workflow and publishes images with `-rserver` tags to the registry.
2. Push code to `main` branch → same as above for production.
3. The `Build` workflow builds backend and frontend, runs tests, and pushes Docker images to `ghcr.io` with extra `rserver` tags (eg. `...:rserver`, `...:<branch>-rserver`, `...:<sha>-rserver`).
4. The `Deploy to VPS` workflow is configured to run on a self-hosted runner labeled `rserver` (it will not SSH from the public runner). That runner pulls the `-rserver` image(s) and restarts the compose stack locally.

Triggering the first deployment

- The deploy workflow runs automatically after `Build` completes on `main`/`develop` if a self-hosted runner with label `rserver` is online.
- You can also trigger it manually from GitHub Actions: `Actions -> Deploy to VPS -> Run workflow`.

If you prefer to run the deploy script manually on the runner host, you can pull images and restart the stack yourself:

```bash
# on the runner (must have docker and access to the registry)
REG=ghcr.io
IMG_BASE=<your-org>/<repo>
BRANCH=develop
SHA=<short-sha>
docker pull ${REG}/${IMG_BASE}-backend:${BRANCH}-${SHA}-rserver || docker pull ${REG}/${IMG_BASE}-backend:rserver
docker pull ${REG}/${IMG_BASE}-frontend:${BRANCH}-${SHA}-rserver || docker pull ${REG}/${IMG_BASE}-frontend:rserver
docker compose -f /app/docker-compose.prod.yml down || true
BACKEND_IMAGE=${REG}/${IMG_BASE}-backend:${BRANCH}-${SHA}-rserver \
FRONTEND_IMAGE=${REG}/${IMG_BASE}-frontend:${BRANCH}-${SHA}-rserver \
docker compose -f /app/docker-compose.prod.yml up -d
```

Notes about auto-redeploy

- The build job pushes images with `-rserver` tags so the self-hosted runner can pull the exact image built for the branch/commit.
- The deploy workflow runs on `runs-on: [self-hosted, rserver]` and therefore must be executed on a host that can reach the private network where the VPS is located.

## Monitoring Deployments

View deployment logs in GitHub:
- Go to Actions → Select the workflow run
- Check the "Deploy to VPS" job for logs

SSH into your VPS to check container status:

```bash
docker compose -f /app/docker-compose.prod.yml ps
docker compose -f /app/docker-compose.prod.yml logs -f backend
docker compose -f /app/docker-compose.prod.yml logs -f frontend
```

## Troubleshooting

### SSH Connection Failed
- Verify the IP/hostname is correct
- Check SSH port is accessible: `ssh -p PORT user@host`
- Ensure public key is in `.ssh/authorized_keys`

### Docker Login Failed
- The workflow uses `GITHUB_TOKEN` which has automatic permissions
- Verify your repository is public or the token has `packages:read` scope

### Containers Not Starting
- SSH to VPS and check: `docker compose logs`
- Verify environment variables are set correctly
- Check disk space: `df -h`

### Self-hosted runner not picking up jobs

- Ensure the runner service is installed and running on a host reachable from your network. The runner must have the labels `rserver,self-hosted` (or at least `rserver`).
- On the runner host, the runner can be started with the standard actions-runner scripts:

```bash
cd ~/actions-runner
# use the GitHub-provided config command shown in the repo runner UI
./config.sh --url https://github.com/<OWNER>/<REPO> --token <TOKEN> --labels rserver,self-hosted --unattended
nohup ./run.sh > runner.log 2>&1 &
```

### Nginx and certificate notes

- In this deployment we used a wildcard certificate for `*.nofl.uk` mounted into the nginx container at `/etc/letsencrypt/live/nofl.uk/` so additional names under `.nofl.uk` are already covered (no re-issuance required).
- Example `conf.d/assetviewer.conf` used on the proxy host (adjust upstreams as needed):

```nginx
server {
    listen 80;
    server_name assetviewer.nofl.uk;
    return 301 https://$host$request_uri;
}

server {
    listen 443 ssl;
    server_name assetviewer.nofl.uk;
    ssl_certificate /etc/letsencrypt/live/nofl.uk/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/nofl.uk/privkey.pem;
    include /etc/nginx/conf.d/ssl-params.conf;

    location /api/ { proxy_pass http://192.168.1.98:8000/; }
    location /     { proxy_pass http://192.168.1.98:5173; }
}
```

## Rollback

To rollback to a previous deployment, SSH to your VPS and run:

```bash
docker compose -f /app/docker-compose.prod.yml pull
docker compose -f /app/docker-compose.prod.yml up -d
```

Or revert to a specific image tag in the environment.
