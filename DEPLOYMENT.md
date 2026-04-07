# Deployment Guide

Dotco is a standard Next.js application backed by PostgreSQL. It runs anywhere that supports Node.js 20+ and a PostgreSQL database.

## Requirements

- **Node.js 20+** (or Docker)
- **PostgreSQL 16+** (any provider: Neon, Supabase, AWS RDS, self-hosted, etc.)
- **Storage** for file uploads (one of):
  - Vercel Blob (`BLOBPRO_READ_WRITE_TOKEN`)
  - S3 or S3-compatible like MinIO, Cloudflare R2 (`S3_BUCKET`, `S3_ACCESS_KEY_ID`, `S3_SECRET_ACCESS_KEY`)
  - Local filesystem (`UPLOAD_DIR`) — not recommended for production unless using a persistent volume

## Environment Variables

Copy `.env.example` to your platform's env var config. Required variables:

| Variable | Required | Description |
|----------|----------|-------------|
| `DATABASE_URL` | Yes | PostgreSQL connection string |
| `AUTH_SECRET` | Yes | Random secret: `openssl rand -base64 32` |
| `AUTH_URL` | Yes | Your app's public URL (e.g. `https://dotco.example.com`) |
| `NEXT_PUBLIC_APP_URL` | Yes | Same as `AUTH_URL` |

Optional (can also be configured in Settings > AI Providers after login):

| Variable | Description |
|----------|-------------|
| `DEEPGRAM_API_KEY` | Audio transcription |
| `OPENAI_API_KEY` | Meeting summarization |
| `RESEND_API_KEY` | Email notifications |
| `RESEND_FROM_EMAIL` | Sender address (e.g. `Dotco <noreply@yourdomain.com>`) |
| `BLOBPRO_READ_WRITE_TOKEN` | Vercel Blob storage |
| `S3_BUCKET` | S3 bucket name |
| `S3_REGION` | S3 region (default: `us-east-1`) |
| `S3_ACCESS_KEY_ID` | S3 access key |
| `S3_SECRET_ACCESS_KEY` | S3 secret key |
| `S3_ENDPOINT` | Custom S3 endpoint (for MinIO, R2, etc.) |
| `UPLOAD_DIR` | Local upload directory (default: `./uploads`) |

## Database Setup

After configuring `DATABASE_URL`, push the schema:

```bash
npx prisma db push
```

The setup wizard at first launch creates the admin user, or use the seed command:

```bash
ADMIN_EMAIL=you@example.com ADMIN_PASSWORD=changeme ORG_NAME="My Org" npx prisma db seed
```

---

## Vercel

The fastest option. One-click or CLI.

### One-click

[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https%3A%2F%2Fgithub.com%2Farmyofme-ai%2Fdotco&env=DATABASE_URL,AUTH_SECRET,AUTH_URL,NEXT_PUBLIC_APP_URL&envDescription=See%20DEPLOYMENT.md%20for%20details&project-name=dotco)

### CLI

```bash
npm i -g vercel
vercel link
vercel env add DATABASE_URL production
vercel env add AUTH_SECRET production    # use: openssl rand -base64 32
vercel env add AUTH_URL production       # your domain, e.g. https://dotco.example.com
vercel env add NEXT_PUBLIC_APP_URL production
npx prisma db push                       # push schema to your database
vercel deploy --prod
```

Storage: add a Vercel Blob store via `vercel blob create-store` or use S3.

---

## Railway

```bash
# Install Railway CLI
npm i -g @railway/cli
railway login

# Create project
railway init
railway add --plugin postgresql

# Set env vars
railway variables set AUTH_SECRET=$(openssl rand -base64 32)
railway variables set AUTH_URL=https://your-app.up.railway.app
railway variables set NEXT_PUBLIC_APP_URL=https://your-app.up.railway.app

# Deploy
railway up

# Push database schema
railway run npx prisma db push
```

Railway auto-detects the Dockerfile and provides `DATABASE_URL` from the PostgreSQL plugin. For storage, use S3 or set `UPLOAD_DIR=/app/uploads` with a persistent volume.

---

## Render

1. Create a **Web Service** from your repo
2. Set **Build Command**: `npm install && npx prisma generate && npm run build`
3. Set **Start Command**: `npm start`
4. Add a **PostgreSQL** database from the Render dashboard
5. Add environment variables:

```
DATABASE_URL        → from Render PostgreSQL (Internal URL)
AUTH_SECRET         → openssl rand -base64 32
AUTH_URL            → https://your-app.onrender.com
NEXT_PUBLIC_APP_URL → https://your-app.onrender.com
PORT                → 3000
```

6. After first deploy: open the **Shell** tab and run `npx prisma db push`

For storage, use S3 or add a **Persistent Disk** mounted at `/app/uploads` and set `UPLOAD_DIR=/app/uploads`.

---

## Fly.io

```bash
# Install Fly CLI and login
curl -L https://fly.io/install.sh | sh
fly auth login

# Launch app (uses the Dockerfile)
fly launch --no-deploy

# Create PostgreSQL
fly postgres create --name dotco-db
fly postgres attach dotco-db

# Set secrets
fly secrets set AUTH_SECRET=$(openssl rand -base64 32)
fly secrets set AUTH_URL=https://your-app.fly.dev
fly secrets set NEXT_PUBLIC_APP_URL=https://your-app.fly.dev

# Create persistent volume for uploads
fly volumes create uploads --size 1 --region iad

# Add to fly.toml:
# [mounts]
#   source = "uploads"
#   destination = "/app/uploads"

# Deploy
fly deploy

# Push database schema
fly ssh console -C "npx prisma db push"
```

---

## Docker Compose (Self-hosted / VPS)

For any VPS (DigitalOcean, Hetzner, Linode, AWS EC2, etc.):

```yaml
# docker-compose.yml
services:
  app:
    build: .
    ports:
      - "3000:3000"
    environment:
      DATABASE_URL: postgresql://dotco:dotco@db:5432/dotco
      AUTH_SECRET: change-me-use-openssl-rand-base64-32
      AUTH_URL: https://your-domain.com
      NEXT_PUBLIC_APP_URL: https://your-domain.com
      UPLOAD_DIR: /app/uploads
    volumes:
      - uploads:/app/uploads
    depends_on:
      db:
        condition: service_healthy

  db:
    image: postgres:16-alpine
    environment:
      POSTGRES_USER: dotco
      POSTGRES_PASSWORD: dotco
      POSTGRES_DB: dotco
    volumes:
      - pgdata:/var/lib/postgresql/data
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U dotco"]
      interval: 5s
      timeout: 5s
      retries: 5

volumes:
  pgdata:
  uploads:
```

```bash
# Start
docker compose up -d

# Push database schema
docker compose exec app npx prisma db push

# Open https://your-domain.com (use a reverse proxy like Caddy or nginx for HTTPS)
```

### Reverse proxy with Caddy (automatic HTTPS)

```
# Caddyfile
your-domain.com {
    reverse_proxy app:3000
}
```

Add Caddy to your docker-compose.yml:

```yaml
  caddy:
    image: caddy:2-alpine
    ports:
      - "80:80"
      - "443:443"
    volumes:
      - ./Caddyfile:/etc/caddy/Caddyfile
      - caddy_data:/data
    depends_on:
      - app
```

---

## Coolify

[Coolify](https://coolify.io) is a self-hosted PaaS (like Heroku on your own server).

1. Add a new **Resource** → **Public Repository** → paste the repo URL
2. Coolify detects the Dockerfile automatically
3. Add a **PostgreSQL** database
4. Set environment variables (same as Docker Compose above)
5. Deploy
6. Run `npx prisma db push` via Coolify's terminal

---

## AWS (ECS / App Runner)

### App Runner (simplest AWS option)

1. Push the Docker image to ECR:
   ```bash
   aws ecr create-repository --repository-name dotco
   docker build -t dotco .
   docker tag dotco:latest <account-id>.dkr.ecr.<region>.amazonaws.com/dotco:latest
   docker push <account-id>.dkr.ecr.<region>.amazonaws.com/dotco:latest
   ```

2. Create an App Runner service pointing to the ECR image
3. Add environment variables in the App Runner console
4. For PostgreSQL, use **RDS** or **Aurora Serverless**
5. For storage, use **S3** with the `S3_*` env vars

### ECS Fargate

Use the Dockerfile with an ECS task definition. Same env vars, backed by RDS for PostgreSQL and S3 for storage. See [AWS ECS docs](https://docs.aws.amazon.com/AmazonECS/latest/developerguide/getting-started.html).

---

## DigitalOcean App Platform

1. Create a new **App** from your GitHub repo
2. DigitalOcean detects the Dockerfile
3. Add a **Dev Database** (PostgreSQL) — it sets `DATABASE_URL` automatically
4. Add environment variables:
   ```
   AUTH_SECRET         → openssl rand -base64 32
   AUTH_URL            → https://your-app.ondigitalocean.app
   NEXT_PUBLIC_APP_URL → https://your-app.ondigitalocean.app
   ```
5. Deploy, then use the console to run `npx prisma db push`

For storage, use **DigitalOcean Spaces** (S3-compatible):
```
S3_BUCKET=your-space-name
S3_REGION=nyc3
S3_ACCESS_KEY_ID=your-key
S3_SECRET_ACCESS_KEY=your-secret
S3_ENDPOINT=https://nyc3.digitaloceanspaces.com
```

---

## Custom Domain & Email DNS

If you use a custom domain with Resend for email, add these DNS records:

| Type | Name | Value |
|------|------|-------|
| A/CNAME | your subdomain | your hosting provider's IP/target |
| TXT | @ | `v=spf1 include:send.resend.com ~all` |
| CNAME | resend._domainkey | *(from Resend dashboard)* |
| TXT | _dmarc | `v=DMARC1; p=none;` |

Get exact DKIM values from https://resend.com/domains after adding your domain.

---

## Troubleshooting

**"There is a problem with the server configuration"**
- `AUTH_SECRET` is missing or invalid. Generate one: `openssl rand -base64 32`
- `AUTH_URL` doesn't match your actual deployment URL

**Database connection errors**
- Check `DATABASE_URL` format: `postgresql://user:password@host:5432/dbname`
- For SSL connections (Neon, Supabase, RDS): append `?sslmode=require` if needed

**File uploads fail**
- No storage backend configured. Set `BLOBPRO_READ_WRITE_TOKEN`, `S3_BUCKET`, or `UPLOAD_DIR`
- For local storage on Docker: ensure the volume is mounted and writable

**Prisma errors on deploy**
- Run `npx prisma generate` before `npm run build` (this happens automatically via `postinstall`)
- Run `npx prisma db push` against your production database after first deploy
