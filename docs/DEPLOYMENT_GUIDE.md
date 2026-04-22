# Digsan V2 — Panduan Deployment Production

Dokumen ini berisi 3 opsi deployment sesuai budget:

| Tier | Estimasi Biaya/bulan | Cocok Untuk |
|------|---------------------|-------------|
| **🟢 Low Budget / Gratis** | Rp 0 – 50.000 | MVP, demo, testing |
| **🟡 Medium (IDCloudHost)** | Rp 100.000 – 300.000 | Startup awal, 100–1.000 user |
| **🔴 Premium** | Rp 500.000 – 2.000.000+ | Production serius, 1.000+ user |

---

## Arsitektur Digsan V2

```
┌─────────────┐   ┌──────────────┐   ┌───────────────┐
│  Landing     │   │  Web App     │   │  Mobile App   │
│  (Next.js)   │   │  (Next.js)   │   │  (Flutter)    │
│  Port 3001   │   │  Port 3000   │   │  Android/iOS  │
└──────┬───────┘   └──────┬───────┘   └──────┬────────┘
       │                  │                   │
       └──────────────────┼───────────────────┘
                          ▼
                 ┌─────────────────┐
                 │   API Server    │
                 │   (NestJS)      │
                 │   Port 4000     │
                 └────────┬────────┘
                          │
              ┌───────────┼───────────┐
              ▼                       ▼
     ┌─────────────┐        ┌──────────────┐
     │  PostgreSQL  │        │    Redis     │
     │  Port 5432   │        │  Port 6379   │
     └─────────────┘        └──────────────┘
```

### Services yang Perlu Di-deploy

| # | Service | Tech | Build Command | Start Command |
|---|---------|------|---------------|---------------|
| 1 | **API** | NestJS | `pnpm --filter @digsan/api build` | `node apps/api/dist/main` |
| 2 | **Web** | Next.js | `pnpm --filter @digsan/web build` | `pnpm --filter @digsan/web start` |
| 3 | **Landing** | Next.js | `pnpm --filter @digsan/landing build` | `pnpm --filter @digsan/landing start` |
| 4 | **Database** | PostgreSQL 16 | — | Managed service / Docker |
| 5 | **Cache** | Redis 7 | — | Managed service / Docker |
| 6 | **Mobile** | Flutter | `flutter build apk --release` | — (distribute APK/Play Store) |

---

# 🟢 Tier 1: Low Budget / Gratis

**Total: Rp 0 – 50.000/bulan**

Menggunakan free tier dari berbagai layanan cloud. Cocok untuk demo, portofolio, atau testing.

## Arsitektur

| Komponen | Provider | Plan | Biaya |
|----------|----------|------|-------|
| **API (NestJS)** | [Render](https://render.com) | Free Web Service | Gratis |
| **Web (Next.js)** | [Vercel](https://vercel.com) | Hobby | Gratis |
| **Landing (Next.js)** | [Vercel](https://vercel.com) | Hobby | Gratis |
| **PostgreSQL** | [Neon](https://neon.tech) | Free Tier (0.5 GB) | Gratis |
| **Redis** | [Upstash](https://upstash.com) | Free Tier (10.000 cmd/hari) | Gratis |
| **Domain** | Subdomain gratis dari provider | — | Gratis |
| **Domain .id** *(opsional)* | [Rumahweb](https://rumahweb.com) | .my.id | ~Rp 12.000/tahun |

> ⚠️ **Keterbatasan:** Render free tier sleep setelah 15 menit idle (cold start ~30 detik). WebSocket mungkin tidak stabil.

---

### Langkah 1: Setup Database (Neon)

1. Daftar di [neon.tech](https://neon.tech)
2. Buat project baru → pilih region **Singapore** (terdekat)
3. Salin connection string:
   ```
   postgresql://user:password@ep-xxx.ap-southeast-1.aws.neon.tech/digsan_v2?sslmode=require
   ```

### Langkah 2: Setup Redis (Upstash)

1. Daftar di [upstash.com](https://upstash.com)
2. Buat Redis database → region **Singapore**
3. Salin credentials:
   ```
   REDIS_HOST=apn1-xxxxx.upstash.io
   REDIS_PORT=6379
   REDIS_PASSWORD=xxxxxxx
   ```

### Langkah 3: Deploy API ke Render

1. Daftar di [render.com](https://render.com), connect GitHub repo
2. Buat **New Web Service**:
   - **Root Directory**: `apps/api`
   - **Runtime**: Node
   - **Build Command**:
     ```bash
     cd ../.. && pnpm install && pnpm --filter @digsan/api build && cd apps/api && pnpm db:generate
     ```
   - **Start Command**:
     ```bash
     node dist/main
     ```
   - **Instance Type**: Free
3. Tambahkan **Environment Variables**:
   ```env
   NODE_ENV=production
   API_PORT=4000
   DATABASE_URL=postgresql://...neon.tech/digsan_v2?sslmode=require
   REDIS_HOST=apn1-xxxxx.upstash.io
   REDIS_PORT=6379
   REDIS_PASSWORD=xxxxxxx
   JWT_SECRET=your-production-secret-min-32-chars
   JWT_ACCESS_EXPIRATION=15m
   JWT_REFRESH_EXPIRATION=30d
   WEB_URL=https://digsan-web.vercel.app
   LANDING_URL=https://digsan-landing.vercel.app
   ```
4. Deploy. Setelah selesai, catat URL API: `https://digsan-api.onrender.com`

### Langkah 4: Migrate Database

Di Render Shell atau lokal:
```bash
DATABASE_URL="postgresql://...neon.tech/digsan_v2?sslmode=require" npx prisma db push
DATABASE_URL="postgresql://...neon.tech/digsan_v2?sslmode=require" npx prisma db seed
```

### Langkah 5: Deploy Web & Landing ke Vercel

**Web App:**
1. Daftar di [vercel.com](https://vercel.com), import repo
2. Settings:
   - **Root Directory**: `apps/web`
   - **Framework Preset**: Next.js
   - **Build Command**: `pnpm --filter @digsan/web build`
3. Environment Variables:
   ```env
   NEXT_PUBLIC_API_URL=https://digsan-api.onrender.com/api
   ```
4. Deploy → URL: `https://digsan-web.vercel.app`

**Landing Page:**
1. Buat project baru di Vercel, import repo yang sama
2. Settings:
   - **Root Directory**: `apps/landing`
   - **Framework Preset**: Next.js
   - **Build Command**: `pnpm --filter @digsan/landing build`
3. Deploy → URL: `https://digsan-landing.vercel.app`

### Langkah 6: Build Flutter APK

```powershell
cd apps/mobile

# Edit lib/core/constants/api_constants.dart
# Ganti baseUrl ke: https://digsan-api.onrender.com/api

flutter build apk --release
# Output: build/app/outputs/flutter-apk/app-release.apk
```

Distribusi via:
- **Firebase App Distribution** (gratis) — untuk internal testing
- **GitHub Releases** — untuk download langsung
- **Google Play Console** — Rp 375.000 sekali bayar (lifetime)

### Rangkuman URL (Tier Gratis)

| Service | URL |
|---------|-----|
| API | `https://digsan-api.onrender.com/api` |
| Web | `https://digsan-web.vercel.app` |
| Landing | `https://digsan-landing.vercel.app` |
| Database | Neon (managed) |
| Redis | Upstash (managed) |

---

# 🟡 Tier 2: Medium — IDCloudHost

**Total: Rp 100.000 – 300.000/bulan**

Semua di-host di satu VPS IDCloudHost. Fully managed, server Indonesia, latency rendah. Cocok untuk startup awal.

## Arsitektur

| Komponen | Provider | Spec | Biaya |
|----------|----------|------|-------|
| **VPS** | [IDCloudHost](https://idcloudhost.com) | 2 vCPU, 2 GB RAM, 20 GB SSD | ~Rp 100.000/bulan |
| **Domain .id** | IDCloudHost / Rumahweb | digsan.id | ~Rp 150.000/tahun |
| **SSL** | Let's Encrypt (gratis via Certbot) | — | Gratis |
| **Semua service** | Docker di VPS | — | Termasuk VPS |

> ✅ **Keuntungan:** Server di Indonesia, full control, tidak ada cold start, WebSocket stabil, satu bill.

---

### Langkah 1: Buat VPS di IDCloudHost Console

1. Login ke [console.idcloudhost.com](https://console.idcloudhost.com)
2. Buat **Virtual Machine** baru:
   - **Location**: Jakarta
   - **OS**: Ubuntu 22.04 LTS
   - **Plan**: 2 vCPU / 2 GB RAM / 20 GB SSD (~Rp 100.000/bulan)
   - **Username/Password**: Catat credentials
3. Catat **IP Public** server

### Langkah 2: Setup Domain

Di IDCloudHost Console atau domain registrar:
```
A Record:  digsan.id        →  <IP_VPS>
A Record:  api.digsan.id    →  <IP_VPS>
A Record:  app.digsan.id    →  <IP_VPS>
```

### Langkah 3: SSH ke Server & Install Dependencies

```bash
ssh root@<IP_VPS>

# Update system
apt update && apt upgrade -y

# Install Docker & Docker Compose
curl -fsSL https://get.docker.com | sh
apt install -y docker-compose-plugin

# Install Node.js 20 (untuk Prisma migrate)
curl -fsSL https://deb.nodesource.com/setup_20.x | bash -
apt install -y nodejs

# Install pnpm
npm install -g pnpm

# Install Nginx & Certbot
apt install -y nginx certbot python3-certbot-nginx
```

### Langkah 4: Clone & Setup Project

```bash
cd /opt
git clone https://github.com/your-repo/digsan-v2.git
cd digsan-v2

# Install dependencies
pnpm install
```

### Langkah 5: Buat docker-compose.production.yml

```bash
cat > /opt/digsan-v2/docker-compose.production.yml << 'EOF'
version: '3.8'

services:
  postgres:
    image: postgres:16-alpine
    container_name: digsan-postgres
    restart: always
    environment:
      POSTGRES_USER: digsan_user
      POSTGRES_PASSWORD: ${DB_PASSWORD}
      POSTGRES_DB: digsan_v2
    volumes:
      - pgdata:/var/lib/postgresql/data
    ports:
      - "127.0.0.1:5432:5432"

  redis:
    image: redis:7-alpine
    container_name: digsan-redis
    restart: always
    command: redis-server --requirepass ${REDIS_PASSWORD}
    volumes:
      - redisdata:/data
    ports:
      - "127.0.0.1:6379:6379"

volumes:
  pgdata:
  redisdata:
EOF
```

### Langkah 6: Buat .env Production

```bash
cat > /opt/digsan-v2/.env << 'EOF'
# Database
DB_PASSWORD=StrongPassword123!
DATABASE_URL=postgresql://digsan_user:StrongPassword123!@localhost:5432/digsan_v2

# Redis
REDIS_HOST=localhost
REDIS_PORT=6379
REDIS_PASSWORD=RedisStrongPass456!

# JWT
JWT_SECRET=your-super-secret-production-key-min-32-chars
JWT_ACCESS_EXPIRATION=15m
JWT_REFRESH_EXPIRATION=30d

# App
NODE_ENV=production
API_PORT=4000
WEB_PORT=3000
LANDING_PORT=3001

API_URL=https://api.digsan.id
WEB_URL=https://app.digsan.id
LANDING_URL=https://digsan.id

# Google OAuth2
GOOGLE_CLIENT_ID=your-google-client-id
GOOGLE_CLIENT_SECRET=your-google-client-secret
GOOGLE_CALLBACK_URL=https://api.digsan.id/api/auth/google/callback

# SMTP
SMTP_USER=digsanid@gmail.com
SMTP_FROM=Digsan <noreply@digsan.id>
GOOGLE_REFRESH_TOKEN=your-google-refresh-token

# Midtrans
MIDTRANS_SERVER_KEY=your-midtrans-server-key
MIDTRANS_CLIENT_KEY=your-midtrans-client-key
MIDTRANS_IS_PRODUCTION=true

# Cloudinary
CLOUDINARY_CLOUD_NAME=your-cloud-name
CLOUDINARY_API_KEY=your-api-key
CLOUDINARY_API_SECRET=your-api-secret
EOF
```

### Langkah 7: Start Database & Build Apps

```bash
cd /opt/digsan-v2

# Start database containers
docker compose -f docker-compose.production.yml up -d

# Wait for postgres to be ready
sleep 5

# Generate Prisma client & push schema
cd apps/api
pnpm db:generate
pnpm db:push
pnpm db:seed
cd ../..

# Build all apps
pnpm --filter @digsan/api build
pnpm --filter @digsan/web build
pnpm --filter @digsan/landing build
```

### Langkah 8: Setup PM2 Process Manager

```bash
npm install -g pm2

# Buat ecosystem file
cat > /opt/digsan-v2/ecosystem.config.js << 'EOF'
module.exports = {
  apps: [
    {
      name: 'digsan-api',
      cwd: '/opt/digsan-v2/apps/api',
      script: 'dist/main.js',
      env: {
        NODE_ENV: 'production',
      },
      instances: 1,
      max_memory_restart: '500M',
    },
    {
      name: 'digsan-web',
      cwd: '/opt/digsan-v2/apps/web',
      script: 'node_modules/.bin/next',
      args: 'start -p 3000',
      env: {
        NODE_ENV: 'production',
        NEXT_PUBLIC_API_URL: 'https://api.digsan.id/api',
      },
      instances: 1,
      max_memory_restart: '400M',
    },
    {
      name: 'digsan-landing',
      cwd: '/opt/digsan-v2/apps/landing',
      script: 'node_modules/.bin/next',
      args: 'start -p 3001',
      env: {
        NODE_ENV: 'production',
      },
      instances: 1,
      max_memory_restart: '300M',
    },
  ],
};
EOF

# Start semua apps
cd /opt/digsan-v2
pm2 start ecosystem.config.js
pm2 save
pm2 startup  # auto-start saat reboot
```

### Langkah 9: Konfigurasi Nginx Reverse Proxy

```bash
cat > /etc/nginx/sites-available/digsan << 'NGINX'
# Landing Page — digsan.id
server {
    server_name digsan.id www.digsan.id;

    location / {
        proxy_pass http://127.0.0.1:3001;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
    }
}

# Web App — app.digsan.id
server {
    server_name app.digsan.id;

    location / {
        proxy_pass http://127.0.0.1:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
    }
}

# API — api.digsan.id
server {
    server_name api.digsan.id;

    client_max_body_size 10M;

    location / {
        proxy_pass http://127.0.0.1:4000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
    }

    # WebSocket support for Chat
    location /chat {
        proxy_pass http://127.0.0.1:4000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host $host;
        proxy_read_timeout 86400;
    }
}
NGINX

# Enable site & reload
ln -sf /etc/nginx/sites-available/digsan /etc/nginx/sites-enabled/
rm -f /etc/nginx/sites-enabled/default
nginx -t && systemctl reload nginx
```

### Langkah 10: Setup SSL (Let's Encrypt)

```bash
certbot --nginx -d digsan.id -d www.digsan.id -d app.digsan.id -d api.digsan.id

# Auto-renew sudah otomatis via systemd timer
# Verifikasi:
certbot renew --dry-run
```

### Langkah 11: Firewall

```bash
ufw allow OpenSSH
ufw allow 'Nginx Full'
ufw enable
```

### Langkah 12: Script Update / Redeploy

Buat script untuk update mudah:

```bash
cat > /opt/digsan-v2/deploy.sh << 'DEPLOY'
#!/bin/bash
set -e
cd /opt/digsan-v2

echo "📥 Pulling latest code..."
git pull origin main

echo "📦 Installing dependencies..."
pnpm install

echo "🔨 Building apps..."
pnpm --filter @digsan/api build
pnpm --filter @digsan/web build
pnpm --filter @digsan/landing build

echo "🗄️ Migrating database..."
cd apps/api && pnpm db:generate && pnpm db:push && cd ../..

echo "🔄 Restarting services..."
pm2 restart all

echo "✅ Deploy selesai!"
DEPLOY

chmod +x /opt/digsan-v2/deploy.sh
```

Untuk redeploy cukup jalankan:
```bash
/opt/digsan-v2/deploy.sh
```

### Monitoring

```bash
# Lihat status semua apps
pm2 status

# Lihat logs
pm2 logs digsan-api --lines 50

# Monitor real-time
pm2 monit

# Lihat resource usage
htop
```

### Rangkuman URL (Tier Medium)

| Service | URL |
|---------|-----|
| Landing | `https://digsan.id` |
| Web App | `https://app.digsan.id` |
| API | `https://api.digsan.id/api` |
| Swagger | `https://api.digsan.id/api/docs` (matikan di production) |

---

# 🔴 Tier 3: Premium

**Total: Rp 500.000 – 2.000.000+/bulan**

Fully managed services, auto-scaling, high availability. Cocok untuk production serius dengan ratusan hingga ribuan pengguna aktif.

## Opsi A: Full AWS / GCP (International)

| Komponen | Provider | Service | Biaya |
|----------|----------|---------|-------|
| **API** | AWS | ECS Fargate / App Runner | ~$15–30/bulan |
| **Web** | Vercel | Pro Plan | $20/bulan |
| **Landing** | Vercel | Pro Plan (sama) | Termasuk |
| **Database** | AWS RDS / Neon Pro | PostgreSQL | ~$15–25/bulan |
| **Redis** | AWS ElastiCache / Upstash Pro | Redis | ~$10–15/bulan |
| **CDN** | CloudFront | — | ~$5/bulan |
| **Domain** | Route53 / Cloudflare | digsan.id | ~$12/tahun |
| **Monitoring** | Sentry + Better Stack | Error + Uptime | Free–$20/bulan |
| **CI/CD** | GitHub Actions | — | Gratis |

## Opsi B: IDCloudHost Premium + Managed Services

| Komponen | Provider | Service | Biaya |
|----------|----------|---------|-------|
| **VPS** | IDCloudHost | 4 vCPU, 8 GB RAM, 80 GB SSD | ~Rp 400.000/bulan |
| **Database** | IDCloudHost | Managed PostgreSQL | ~Rp 200.000/bulan |
| **Backup** | IDCloudHost | Auto Backup | ~Rp 50.000/bulan |
| **CDN** | Cloudflare | Free/Pro | Gratis – $20/bulan |
| **Domain** | IDCloudHost | digsan.id | ~Rp 150.000/tahun |
| **Monitoring** | Sentry + UptimeRobot | — | Gratis |

---

### Setup Premium (Opsi A — AWS)

#### 1. Database: Neon Pro atau AWS RDS

```
# Neon Pro
DATABASE_URL=postgresql://user:pass@ep-xxx.ap-southeast-1.aws.neon.tech/digsan_v2?sslmode=require

# Atau AWS RDS
DATABASE_URL=postgresql://digsan:pass@digsan-db.xxx.ap-southeast-1.rds.amazonaws.com:5432/digsan_v2
```

#### 2. Redis: Upstash Pro atau AWS ElastiCache

```
REDIS_HOST=apn1-xxx.upstash.io
REDIS_PORT=6379
REDIS_PASSWORD=xxx
```

#### 3. API: AWS App Runner

1. Push Docker image ke ECR:
   ```bash
   # Buat Dockerfile untuk API
   cat > apps/api/Dockerfile << 'DOCKERFILE'
   FROM node:20-alpine AS builder
   WORKDIR /app
   COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
   COPY apps/api/package.json apps/api/
   COPY packages/ packages/
   RUN npm install -g pnpm && pnpm install --frozen-lockfile
   COPY apps/api/ apps/api/
   COPY prisma/ apps/api/prisma/
   RUN cd apps/api && npx prisma generate && pnpm build

   FROM node:20-alpine
   WORKDIR /app
   COPY --from=builder /app/apps/api/dist ./dist
   COPY --from=builder /app/apps/api/node_modules ./node_modules
   COPY --from=builder /app/node_modules/.prisma ./node_modules/.prisma
   EXPOSE 4000
   CMD ["node", "dist/main"]
   DOCKERFILE
   ```

2. Deploy via AWS App Runner:
   - Source: ECR image
   - Port: 4000
   - Auto-scaling: 1–5 instances
   - Environment variables: semua env production

#### 4. Web & Landing: Vercel Pro

```bash
# Install Vercel CLI
npm i -g vercel

# Deploy Web
cd apps/web
vercel --prod

# Deploy Landing
cd apps/landing
vercel --prod
```

#### 5. CI/CD: GitHub Actions

```yaml
# .github/workflows/deploy.yml
name: Deploy Production

on:
  push:
    branches: [main]

jobs:
  test:
    runs-on: ubuntu-latest
    services:
      postgres:
        image: postgres:16-alpine
        env:
          POSTGRES_USER: test
          POSTGRES_PASSWORD: test
          POSTGRES_DB: digsan_test
        ports: ['5432:5432']
      redis:
        image: redis:7-alpine
        ports: ['6379:6379']
    steps:
      - uses: actions/checkout@v4
      - uses: pnpm/action-setup@v2
        with: { version: 9 }
      - uses: actions/setup-node@v4
        with: { node-version: 20, cache: pnpm }
      - run: pnpm install
      - run: cd apps/api && npx prisma generate && npx prisma db push
        env:
          DATABASE_URL: postgresql://test:test@localhost:5432/digsan_test
      - run: cd apps/api && pnpm test
        env:
          DATABASE_URL: postgresql://test:test@localhost:5432/digsan_test
          REDIS_HOST: localhost
          JWT_SECRET: test-secret-for-ci-min-32-chars!!

  deploy-api:
    needs: test
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - name: Deploy to server
        uses: appleboy/ssh-action@v1
        with:
          host: ${{ secrets.SERVER_HOST }}
          username: root
          key: ${{ secrets.SSH_PRIVATE_KEY }}
          script: /opt/digsan-v2/deploy.sh

  deploy-web:
    needs: test
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: amondnet/vercel-action@v25
        with:
          vercel-token: ${{ secrets.VERCEL_TOKEN }}
          vercel-org-id: ${{ secrets.VERCEL_ORG_ID }}
          vercel-project-id: ${{ secrets.VERCEL_WEB_PROJECT_ID }}
          working-directory: apps/web
          vercel-args: '--prod'
```

#### 6. Monitoring & Alerting

```bash
# Sentry (Error Tracking) — gratis sampai 5.000 events/bulan
# Install di API:
pnpm --filter @digsan/api add @sentry/node

# .env
SENTRY_DSN=https://xxx@sentry.io/xxx

# UptimeRobot (gratis 50 monitors)
# Monitor endpoints:
# - https://api.digsan.id/api (health check)
# - https://app.digsan.id
# - https://digsan.id
```

#### 7. Backup Strategy

```bash
# Auto backup PostgreSQL (cron harian)
cat > /etc/cron.d/digsan-backup << 'CRON'
0 2 * * * root pg_dump -h localhost -U digsan_user digsan_v2 | gzip > /backups/digsan_$(date +\%Y\%m\%d).sql.gz
0 3 * * * root find /backups -mtime +30 -delete
CRON

# Atau gunakan pg_dump ke S3:
# pip install aws-cli
# aws s3 cp /backups/digsan_$(date +%Y%m%d).sql.gz s3://digsan-backups/
```

### Rangkuman URL (Tier Premium)

| Service | URL |
|---------|-----|
| Landing | `https://digsan.id` |
| Web App | `https://app.digsan.id` |
| API | `https://api.digsan.id/api` |
| Swagger | Disabled di production |
| Monitoring | Sentry Dashboard |

---

# 📱 Flutter Mobile — Semua Tier

Build & distribusi APK/AAB sama untuk semua tier:

### Build Release APK

```powershell
cd apps/mobile

# Edit API URL ke production
# File: lib/core/constants/api_constants.dart
# Ganti baseUrl sesuai tier:
#   Gratis:  https://digsan-api.onrender.com/api
#   Medium:  https://api.digsan.id/api
#   Premium: https://api.digsan.id/api

# Build APK
flutter build apk --release

# Build AAB (untuk Play Store)
flutter build appbundle --release
```

### Distribusi

| Channel | Biaya | Cocok Untuk |
|---------|-------|-------------|
| **Firebase App Distribution** | Gratis | Internal/beta testing |
| **GitHub Releases** | Gratis | Direct download APK |
| **Google Play Store** | Rp 375.000 (sekali) | Production publik |
| **Apple App Store** | $99/tahun (~Rp 1.5 juta) | iOS users |

---

# Perbandingan Lengkap

| Fitur | 🟢 Gratis | 🟡 Medium | 🔴 Premium |
|-------|-----------|-----------|------------|
| **Biaya/bulan** | Rp 0 | ~Rp 150.000 | ~Rp 800.000+ |
| **Server Location** | Global (US/EU) | 🇮🇩 Jakarta | 🇮🇩 Jakarta / Global |
| **Cold Start** | ⚠️ 30 detik | ✅ Tidak ada | ✅ Tidak ada |
| **WebSocket** | ⚠️ Tidak stabil | ✅ Stabil | ✅ Stabil |
| **SSL** | ✅ Auto | ✅ Let's Encrypt | ✅ Managed |
| **Auto-scaling** | ❌ | ❌ Manual | ✅ Auto |
| **Backup** | ❌ Manual | ⚠️ Manual/script | ✅ Automated |
| **Monitoring** | ❌ Basic | ⚠️ PM2/htop | ✅ Sentry + APM |
| **CI/CD** | ❌ Manual | ⚠️ Script | ✅ GitHub Actions |
| **Uptime SLA** | ❌ | ⚠️ 99% | ✅ 99.9% |
| **Support** | ❌ Community | ✅ IDCloudHost | ✅ Managed |
| **Cocok untuk** | Demo/MVP | Startup awal | Production serius |

---

# Checklist Sebelum Deploy

- [ ] Ganti semua secret di `.env` (JWT_SECRET, DB password, dll)
- [ ] Matikan Swagger di production (`NODE_ENV=production`)
- [ ] Setup CORS hanya untuk domain yang diizinkan
- [ ] Pastikan `GOOGLE_CALLBACK_URL` mengarah ke domain production
- [ ] Test semua endpoint di staging sebelum production
- [ ] Setup backup database (minimal harian)
- [ ] Setup monitoring/alerting (minimal UptimeRobot)
- [ ] Build Flutter APK dengan API URL production
- [ ] Test login, register, dan fitur utama end-to-end
- [ ] Setup rate limiting (sudah built-in di API)
