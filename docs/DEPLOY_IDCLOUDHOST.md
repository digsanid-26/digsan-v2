# Digsan V2 — Deployment Guide: IDCloudHost

Panduan lengkap deployment Digsan V2 ke VPS **IDCloudHost** (Jakarta). Satu VPS menjalankan semua service: API (NestJS), Web (Next.js), Landing (Next.js), PostgreSQL, dan Redis.

---

## Estimasi Biaya

| Item | Biaya | Keterangan |
|------|-------|------------|
| **VPS 2 vCPU / 2 GB / 20 GB SSD** | ~Rp 100.000/bulan | Minimum recommended |
| **VPS 4 vCPU / 4 GB / 40 GB SSD** | ~Rp 200.000/bulan | Untuk 500+ user aktif |
| **Domain .id** | ~Rp 150.000/tahun | IDCloudHost atau Rumahweb |
| **SSL Certificate** | Gratis | Let's Encrypt via Certbot |
| **Total (setup pertama)** | ~Rp 250.000 | VPS + domain 1 tahun |

---

## Arsitektur Deployment

```
┌─────────────────────────────────────────────────────────────┐
│                    VPS IDCloudHost (Jakarta)                 │
│                                                              │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐          │
│  │   Nginx     │  │   Nginx     │  │   Nginx     │          │
│  │   :80       │  │   :443      │  │  (Reverse   │          │
│  │  (HTTP)     │  │  (HTTPS)    │  │   Proxy)    │          │
│  └──────┬──────┘  └──────┬──────┘  └──────┬──────┘          │
│         │                │                │                 │
│         └────────────────┴────────────────┘                 │
│                          │                                  │
│  ┌───────────────────────┼──────────────────────────┐       │
│  │                       ▼                          │       │
│  │  ┌──────────────┐  ┌──────────────┐  ┌────────┐  │       │
│  │  │ API (NestJS) │  │ Web (Next.js)│  │Landing │  │       │
│  │  │ Port 4000    │  │ Port 3000    │  │Port3001│  │       │
│  │  └──────────────┘  └──────────────┘  └────────┘  │       │
│  │       │                  │                       │       │
│  │       └──────────┬───────┘                       │       │
│  │                  ▼                                │       │
│  │  ┌──────────────────────────┐  ┌──────────────┐   │       │
│  │  │  PostgreSQL (Docker)   │  │ Redis (Docker│   │       │
│  │  │  Port 5432 (localhost)   │  │ Port 6379    │   │       │
│  │  └──────────────────────────┘  └──────────────┘   │       │
│  └───────────────────────────────────────────────────┘       │
│                          │                                   │
│                    Firewall (UFW)                             │
│                          │                                   │
└──────────────────────────┼───────────────────────────────────┘
                           │
                    Internet (HTTPS)
                           │
              ┌────────────┼────────────┐
              ▼            ▼            ▼
        digsan.id    app.digsan.id  api.digsan.id
        (Landing)    (Web App)      (API)
```

---

## Langkah 1: Beli VPS di IDCloudHost Console

1. Buka [console.idcloudhost.com](https://console.idcloudhost.com)
2. Login / Register akun baru
3. Klik **"Create Instance"** atau **"Virtual Machine"**
4. Pilih konfigurasi:

| Setting | Rekomendasi |
|---------|-------------|
| **Location** | Jakarta (terdekat, latency ~10-20ms) |
| **Operating System** | Ubuntu 22.04 LTS (64-bit) |
| **Plan** | 2 vCPU / 2 GB RAM / 20 GB SSD |
| **Authentication** | Password (atau SSH Key jika sudah punya) |
| **Hostname** | `digsan-v2` |

5. Klik **Create** dan tunggu ~2-5 menit
6. Catat:
   - **IP Public**: `203.xxx.xxx.xxx`
   - **Username**: `root`
   - **Password**: (yang diberikan saat create)

---

## Langkah 2: Setup Domain & DNS

### A. Beli Domain (via IDCloudHost atau Rumahweb)

1. Di IDCloudHost Console → **Domains** → **Register Domain**
2. Cari domain: `digsan.id`
3. Checkout dan bayar (~Rp 150.000/tahun untuk .id)

### B. Konfigurasi DNS Records

Di **IDCloudHost DNS Management** atau **Cloudflare**:

```
Type    Name              Value (IP VPS)
────────────────────────────────────────
A       @                 203.xxx.xxx.xxx
A       www               203.xxx.xxx.xxx
A       app               203.xxx.xxx.xxx
A       api               203.xxx.xxx.xxx
```

> 💡 **Tips**: Pakai Cloudflare (gratis) untuk CDN + DDoS protection. Setting NS domain ke Cloudflare dulu.

---

## Langkah 3: Initial Server Setup (SSH)

```bash
# SSH ke server
ssh root@103.191.92.37

# 1. Update system
apt update && apt upgrade -y

# 2. Install essential tools
apt install -y curl wget git vim htop ufw

# 3. Set timezone ke Jakarta
timedatectl set-timezone Asia/Jakarta

# 4. Buat user non-root (opsional tapi recommended)
adduser digsan
usermod -aG sudo digsan

# 5. Setup basic firewall
ufw allow OpenSSH
ufw allow 'Nginx Full'
ufw --force enable

# 6. Install Docker
apt install -y ca-certificates gnupg lsb-release
curl -fsSL https://download.docker.com/linux/ubuntu/gpg | gpg --dearmor -o /usr/share/keyrings/docker-archive-keyring.gpg
echo "deb [arch=$(dpkg --print-architecture) signed-by=/usr/share/keyrings/docker-archive-keyring.gpg] https://download.docker.com/linux/ubuntu $(lsb_release -cs) stable" | tee /etc/apt/sources.list.d/docker.list > /dev/null
apt update
apt install -y docker-ce docker-ce-cli containerd.io docker-compose-plugin

# 7. Install Node.js 20 & pnpm
curl -fsSL https://deb.nodesource.com/setup_20.x | bash -
apt install -y nodejs
npm install -g pnpm

# 8. Install Nginx & Certbot
apt install -y nginx certbot python3-certbot-nginx

# 9. Install PM2
npm install -g pm2

# 10. Verify installations
docker --version  # Docker version 24.x.x
node --version    # v20.x.x
pnpm --version    # 9.x.x
pm2 --version     # 5.x.x
```

---

## Langkah 4: Clone Repository & Setup Project

```bash
# Login sebagai user digsan (jika dibuat) atau tetap root
su - digsan  # atau skip jika pakai root

# Clone repo
cd ~
git clone https://github.com/digsanid-26/digsan-v2.git
cd digsan-v2

# Install dependencies
pnpm install
```

---

## Langkah 5: Setup Database (Docker)

```bash
cd ~/digsan-v2

# Buat docker-compose untuk database
cat > docker-compose.db.yml << 'EOF'
version: '3.8'

services:
  postgres:
    image: postgres:16-alpine
    container_name: digsan-postgres
    restart: always
    environment:
      POSTGRES_USER: digsan_prod
      POSTGRES_PASSWORD: DigsanStrongPass123!  # GANTI!
      POSTGRES_DB: digsan_v2
    volumes:
      - postgres_data:/var/lib/postgresql/data
    ports:
      - "127.0.0.1:5432:5432"  # Hanya localhost, tidak publik
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U digsan_prod -d digsan_v2"]
      interval: 10s
      timeout: 5s
      retries: 5

  redis:
    image: redis:7-alpine
    container_name: digsan-redis
    restart: always
    command: >
      redis-server
      --requirepass RedisPass456!
      --maxmemory 256mb
      --maxmemory-policy allkeys-lru
    volumes:
      - redis_data:/data
    ports:
      - "127.0.0.1:6379:6379"  # Hanya localhost

volumes:
  postgres_data:
  redis_data:
EOF

# Start database containers
docker compose -f docker-compose.db.yml up -d

# Verify containers running
docker ps
# Harus muncul: digsan-postgres dan digsan-redis
```

---

## Langkah 6: Konfigurasi Environment Variables

```bash
cd ~/digsan-v2

# Buat .env file
cat > .env << 'EOF'
# ═══════════════════════════════════════════════════════════
# DATABASE
# ═══════════════════════════════════════════════════════════
DATABASE_URL="postgresql://digsan_prod:DigsanStrongPass123!@localhost:5432/digsan_v2"

# ═══════════════════════════════════════════════════════════
# REDIS
# ═══════════════════════════════════════════════════════════
REDIS_HOST=localhost
REDIS_PORT=6379
REDIS_PASSWORD=RedisPass456!

# ═══════════════════════════════════════════════════════════
# JWT (GANTI DENGAN STRING RANDOM 32+ KARAKTER!)
# Generate: openssl rand -base64 32
# ═══════════════════════════════════════════════════════════
JWT_SECRET="IcceuW6mQ6wx5KIMP3V4xI2OoRay6TBNhK7dDsWaOxY="
JWT_ACCESS_EXPIRATION=15m
JWT_REFRESH_EXPIRATION=30d

# ═══════════════════════════════════════════════════════════
# APP SETTINGS
# ═══════════════════════════════════════════════════════════
NODE_ENV=production
API_PORT=4000
WEB_PORT=3000
LANDING_PORT=3001

# URL Production
API_URL=https://api.digsan.id
WEB_URL=https://app.digsan.id
LANDING_URL=https://digsan.id

# ═══════════════════════════════════════════════════════════
# GOOGLE OAUTH2 (Isi jika pakai Google Login)
# ═══════════════════════════════════════════════════════════
GOOGLE_CLIENT_ID="your-google-client-id.apps.googleusercontent.com"
GOOGLE_CLIENT_SECRET="your-google-client-secret"
GOOGLE_CALLBACK_URL=https://api.digsan.id/api/auth/google/callback
GOOGLE_REFRESH_TOKEN="your-google-refresh-token"

# ═══════════════════════════════════════════════════════════
# SMTP / EMAIL
# ═══════════════════════════════════════════════════════════
SMTP_USER="digsanid@gmail.com"
SMTP_FROM="Digsan <noreply@digsan.id>"

# ═══════════════════════════════════════════════════════════
# FONNTE WHATSAPP (Opsional)
# ═══════════════════════════════════════════════════════════
FONNTE_API_KEY="7cpwWzJS1HKeMmMMaehH"
FONNTE_SENDER="6285876832016"

# ═══════════════════════════════════════════════════════════
# IPAYMU PAYMENT (Isi untuk production payment)
# Daftar di: https://ipaymu.com
# ═══════════════════════════════════════════════════════════
IPAYMU_VA="your-ipaymu-va-number"
IPAYMU_API_KEY="your-ipaymu-api-key"
IPAYMU_IS_PRODUCTION=true
IPAYMU_CALLBACK_URL=https://api.digsan.id/api/payment/ipaymu/callback

# ═══════════════════════════════════════════════════════════
# CLOUDINARY (Untuk upload gambar)
# ═══════════════════════════════════════════════════════════
CLOUDINARY_CLOUD_NAME="dp1d7xgvz"
CLOUDINARY_API_KEY="466171199784419"
CLOUDINARY_API_SECRET="uzzYn8tGwTec8m4JZ9Hw6qp4sLA"

# ═══════════════════════════════════════════════════════════
# FIREBASE FCM (Untuk push notification)
# ═══════════════════════════════════════════════════════════
FIREBASE_PROJECT_ID="digsanid-6dbf6"
FIREBASE_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\nMIIEvAIBADANBgkqhkiG9w0BAQEFAASCBKYwggSiAgEAAoIBAQC3e3CEMEHpM8ZA\nDESqvoyk6ir0ULg5feIJZqfIqkcP9qS06qU1i3cK1OafmMtZiPVb4raLt+bMzZpb\nRugHA/niMYl/Kx9F1ae+bWehhy2ufBXs1FEIn0oi57voa8XRe2yZp7j1Em/X7JrA\n/zf8cu3UvB9X5wSkEO6DAjlDbqzcmXy6RA+ICcUX/ycyMmkdLkNm3IKU8c4TR9vE\ndZdDXETp29RhXJoKaRXVrQWXzCA2Yli30MoY+A2URYzrbm4ysDFHLzloAZy+Ytzq\n7DvoSfGbdh5GuEJrHsrl+YckQoXkQdSPO8YhKSeAkdPmNxu1cO4nuplmzOc0GisV\n89M4Iom9AgMBAAECgf8otFTwWPBLgj8iVgME0R9s0RHk+rMpxY564e9rsBekjh6u\newz38bvqGSU01ikLMVMy+9vypFxAlGkkxzpnTEWBu26yBFdCW9yjNQmljzx4AMld\nsqUbiRle+lTdls0USHgBrgka4OOkCcsz3EkkBHT/TvBu1unsIV6FLffRLbNXlLH1\n3SliQ26AsvI555iOW6ad+ULSXzn9kMTA6rMcpTYG6dPeU5+pIgaWzuWw91VUhrXh\nI0iLr8SFOFke8pVC3ZD0r02p9jUAsm1far7t9kis3F/X1+XdKtDDwJZ14G3enFf2\nVIkwybKEIdGHPwSeKJXa0LD4Per6JlogVKCgfPMCgYEA7Mi26n6uZhoJ+qUdzARX\nPxtYknLwMrp2zmwvER5AkyOUlUfV4FHnLb+ZphgQMKXrWpMZijQdjuMl4Lxdy63K\nXeMsGo7Z3jkh2ZTP8pwxO0V3H+Atv1dilyx+c5GGMAf1IX17+B5SZ0kniDKCoRQd\nCDejSIz2LR5Sybx55KOofMsCgYEAxl9ba61bbcBJ15XVphtkdeTlQ6vpwiUY2S9C\nLoEes2km9br30LPvnc2EzseswQnqWGbrVP2B6bDiBh6GR3izG5EMrMS+92PVgrEr\ncAH9nX6ShO/WmeMnza1Qdtn4dMgnfuFc2c0QWjjGpnliSnqx+8dPhYtNdK/e2PfI\n/d2DCpcCgYEAiIF2Il4CAM7GLf9+3B0shy8mstccbsJct8haog3EwI7km+McBARz\nuEYbOEvrGYCt3Dutn6VH3RZKwfMWR9PbNKFAzdbI93oMb7mA4Kb3Iup7MJ83AHZK\nWkjGZa3hpFMSGMqU64ffjbf42GX2NRK5YgFhWvQZAA3ZQIAt7YgEHF0CgYADMX/I\nQPcq0iCeLtRMoz4/w5qJN1hA/tXikScwlnWHD9dHt2XL30mpMajEp2Q5i05Rc/6v\n1JDl0SoiTRV+SwwfEnuwwE4Or3W9b9qyJ+YMRgBX0YCT45s9bV/ROfsM7jfsi/Yx\nr2JnAWj5PxT8+/KnifLWxIJPsZEVzw9WPt2gKwKBgQDhHvyDvLdXtQEcKubRRFN+\nRnxlyV+HYUOUlr7n4kSTTcXN6L9k9SmUL/dDNKlY0NC0p1Ni5vVcnV/zLc+PQcQl\nWTljsOJ/f2/0hek0kaZ5CJ43IwRT+tg4Vv0eNaHqr1ixLTVl5zBOOkXYXqzhJFiO\nZgiFGqtX1dHsseTYe0Xk9Q==\n-----END PRIVATE KEY-----\n-----END PRIVATE KEY-----"
FIREBASE_CLIENT_EMAIL="firebase-adminsdk-fbsvc@digsanid-6dbf6.iam.gserviceaccount.com"
EOF

# Set permissions (hanya owner bisa baca)
chmod 600 .env
```

**Generate JWT Secret yang kuat:**
```bash
openssl rand -base64 32
# Copy output ke JWT_SECRET di .env
```

---

## Langkah 7: Database Migration & Seed

```bash
cd ~/digsan-v2/apps/api

# Generate Prisma Client
pnpm db:generate

# Push schema ke database
pnpm db:push

# Seed data awal (admin user, badges, dll)
pnpm db:seed

# Verifikasi dengan Prisma Studio (opsional, port 5555)
# pnpm db:studio
```

---

## Langkah 8: Build Semua Aplikasi

```bash
cd ~/digsan-v2

# Build API
pnpm --filter @digsan/api build

# Build Web
pnpm --filter @digsan/web build

# Build Landing
pnpm --filter @digsan/landing build

# Verifikasi build berhasil
ls -la apps/api/dist/
ls -la apps/web/.next/
ls -la apps/landing/.next/

# 1. Pull perubahan terbaru
cd ~/digsan-v2
git pull origin master

# 2. Rebuild API (jika perlu)
cd apps/api
pnpm install
pnpm build 
NODE_OPTIONS="--max-old-space-size=3072" pnpm build

# 3. Rebuild Web App
cd ../web
pnpm install
pnpm build

# 4. Restart PM2
pm2 restart digsan-api
pm2 restart digsan-web
pm2 save
---

## Langkah 9: Setup PM2 Process Manager

```bash
cd ~/digsan-v2

# Buat ecosystem file
cat > ecosystem.config.js << 'EOF'
module.exports = {
  apps: [
    {
      name: 'digsan-api',
      cwd: '/home/digsanid/digsan-v2/apps/api',
      script: 'dist/main.js',
      instances: 1,
      exec_mode: 'fork',
      env: {
        NODE_ENV: 'production',
      },
      env_file: '/home/digsanid/digsan-v2/.env',
      max_memory_restart: '500M',
      error_file: '/home/digsanid/digsan-v2/logs/api-error.log',
      out_file: '/home/digsanid/digsan-v2/logs/api-out.log',
      log_date_format: 'YYYY-MM-DD HH:mm:ss Z',
      merge_logs: true,
      autorestart: true,
      watch: false,
    },
    {
      name: 'digsan-web',
      cwd: '/home/digsanid/digsan-v2/apps/web',
      script: 'node_modules/next/dist/bin/next',
      args: 'start -p 3000',
      instances: 1,
      exec_mode: 'fork',
      env: {
        NODE_ENV: 'production',
        NEXT_PUBLIC_API_URL: 'https://api.digsan.id/api',
      },
      env_file: '/home/digsanid/digsan-v2/.env',
      max_memory_restart: '400M',
      error_file: '/home/digsanid/digsan-v2/logs/web-error.log',
      out_file: '/home/digsanid/digsan-v2/logs/web-out.log',
      log_date_format: 'YYYY-MM-DD HH:mm:ss Z',
      autorestart: true,
      watch: false,
    },
    {
      name: 'digsan-landing',
      cwd: '/home/digsanid/digsan-v2/apps/landing',
      script: 'node_modules/next/dist/bin/next',
      args: 'start -p 3001',
      instances: 1,
      exec_mode: 'fork',
      env: {
        NODE_ENV: 'production',
        NEXT_PUBLIC_WEB_URL: 'https://app.digsan.id',
      },
      max_memory_restart: '300M',
      error_file: '/home/digsanid/digsan-v2/logs/landing-error.log',
      out_file: '/home/digsanid/digsan-v2/logs/landing-out.log',
      log_date_format: 'YYYY-MM-DD HH:mm:ss Z',
      autorestart: true,
      watch: false,
    },
  ],
};
EOF

# Buat folder logs
mkdir -p ~/digsan-v2/logs

# Start semua aplikasi
pm2 start ecosystem.config.js

# Save PM2 config agar auto-start saat reboot
pm2 save
pm2 startup systemd

# Jalankan command yang muncul dari pm2 startup, contoh:
# sudo env PATH=$PATH:/usr/bin pm2 startup systemd -u digsan --hp /home/digsan
```

---

## Langkah 10: Konfigurasi Nginx Reverse Proxy

```bash
# Backup default config
cp /etc/nginx/sites-available/default /etc/nginx/sites-available/default.backup

# Buat config baru
cat > /etc/nginx/sites-available/digsan << 'EOF'
# ═══════════════════════════════════════════════════════════
# LANDING PAGE - digsan.id
# ═══════════════════════════════════════════════════════════
server {
    listen 80;
    server_name digsan.id www.digsan.id;
    
    # Redirect HTTP ke HTTPS
    location / {
        return 301 https://$server_name$request_uri;
    }
}

server {
    listen 443 ssl http2;
    server_name digsan.id www.digsan.id;

    # SSL akan diisi oleh Certbot nanti
    ssl_certificate /etc/letsencrypt/live/digsan.id/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/digsan.id/privkey.pem;
    ssl_protocols TLSv1.2 TLSv1.3;
    ssl_ciphers HIGH:!aNULL:!MD5;

    # Security headers
    add_header X-Frame-Options "SAMEORIGIN" always;
    add_header X-Content-Type-Options "nosniff" always;
    add_header X-XSS-Protection "1; mode=block" always;
    add_header Referrer-Policy "strict-origin-when-cross-origin" always;

    # Gzip
    gzip on;
    gzip_vary on;
    gzip_min_length 1024;
    gzip_types text/plain text/css text/xml application/json application/javascript application/xml+rss;

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
        proxy_read_timeout 86400;
    }
}

# ═══════════════════════════════════════════════════════════
# WEB APP - app.digsan.id
# ═══════════════════════════════════════════════════════════
server {
    listen 80;
    server_name app.digsan.id;
    
    location / {
        return 301 https://$server_name$request_uri;
    }
}

server {
    listen 443 ssl http2;
    server_name app.digsan.id;

    ssl_certificate /etc/letsencrypt/live/digsan.id/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/digsan.id/privkey.pem;
    ssl_protocols TLSv1.2 TLSv1.3;
    ssl_ciphers HIGH:!aNULL:!MD5;

    add_header X-Frame-Options "SAMEORIGIN" always;
    add_header X-Content-Type-Options "nosniff" always;

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
        proxy_read_timeout 86400;
    }
}

# ═══════════════════════════════════════════════════════════
# API SERVER - api.digsan.id
# ═══════════════════════════════════════════════════════════
server {
    listen 80;
    server_name api.digsan.id;
    
    location / {
        return 301 https://$server_name$request_uri;
    }
}

server {
    listen 443 ssl http2;
    server_name api.digsan.id;

    ssl_certificate /etc/letsencrypt/live/digsan.id/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/digsan.id/privkey.pem;
    ssl_protocols TLSv1.2 TLSv1.3;

    # Increase max body size untuk upload file
    client_max_body_size 10M;

    location / {
        # Security headers only. CORS is handled entirely by NestJS
        # (app.enableCors() in main.ts). Do NOT add CORS headers here —
        # doing so causes duplicate Access-Control-Allow-Origin headers
        # (one from Nginx, one from Nest), which browsers reject outright
        # with "contains multiple values" CORS errors.
        add_header X-Frame-Options "SAMEORIGIN" always;
        add_header X-Content-Type-Options "nosniff" always;

        proxy_pass http://127.0.0.1:4000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
        proxy_read_timeout 86400;
    }

    # WebSocket endpoint untuk Chat
    location /chat {
        proxy_pass http://127.0.0.1:4000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_read_timeout 86400;
    }
}
EOF

# Enable site
ln -sf /etc/nginx/sites-available/digsan /etc/nginx/sites-enabled/
rm -f /etc/nginx/sites-enabled/default

# Test nginx config
nginx -t

# Reload nginx
systemctl reload nginx
```

---

## Langkah 11: Setup SSL dengan Let's Encrypt

```bash
# Install certbot (sudah di step 3, tapi verify)
apt install -y certbot python3-certbot-nginx

# Generate certificate untuk semua subdomain
certbot --nginx -d digsan.id -d www.digsan.id -d app.digsan.id -d api.digsan.id

# Ikuti instruksi:
# - Masukkan email untuk notifikasi
# - Accept terms
# - Pilih "2: Redirect" (HTTP ke HTTPS)

# Verifikasi auto-renewal
certbot renew --dry-run

# Cek certificate
echo | openssl s_client -servername digsan.id -connect digsan.id:443 2>/dev/null | openssl x509 -noout -dates
```

---

## Langkah 12: Build Flutter Mobile (Production)

```powershell
# Di local machine (Windows)
cd apps/mobile

# Edit API URL ke production
# File: lib/core/constants/api_constants.dart

class ApiConstants {
  // Production
  static const String baseUrl = 'https://api.digsan.id/api';
  
  // Development (comment saat production)
  // static const String baseUrl = 'http://10.0.2.2:4000/api';
}

# Build APK Release
flutter build apk --release

# Atau Build AAB untuk Play Store
flutter build appbundle --release

# Output:
# build/app/outputs/flutter-apk/app-release.apk
# build/app/outputs/bundle/release/app-release.aab
```

### Distribusi APK

```bash
# Upload ke GitHub Releases (gratis)
# Upload ke Firebase App Distribution (gratis, untuk testing)
# Upload ke Google Play Console (Rp 375.000 sekali bayar)
```

---

## Langkah 13: Script Auto-Deploy (Untuk Update)

```bash
cd ~/digsan-v2

# Buat script deploy
cat > deploy.sh << 'EOF'
#!/bin/bash
set -e

PROJECT_DIR="/home/digsanid/digsan-v2"
LOG_FILE="/home/digsanid/digsan-v2/logs/deploy-$(date +%Y%m%d-%H%M%S).log"

exec > >(tee -a "$LOG_FILE")
exec 2>&1

echo "╔══════════════════════════════════════════════════════════╗"
echo "║         DIGSAN V2 — DEPLOYMENT SCRIPT                     ║"
echo "║         $(date '+%Y-%m-%d %H:%M:%S')                              ║"
echo "╚══════════════════════════════════════════════════════════╝"
echo ""

cd "$PROJECT_DIR"

echo "📥 Step 1: Pulling latest code from git..."
git pull origin master

echo "📦 Step 2: Installing dependencies..."
pnpm install

echo "🔨 Step 3: Building applications..."
pnpm --filter @digsan/api build
pnpm --filter @digsan/web build
pnpm --filter @digsan/landing build

echo "🗄️ Step 4: Database migration..."
cd apps/api
pnpm db:generate
pnpm db:push
cd ../..

echo "🔄 Step 5: Restarting PM2 services..."
pm2 restart all

echo "🧹 Step 6: Cleanup old logs..."
find ~/digsan-v2/logs -name "deploy-*.log" -mtime +7 -delete 2>/dev/null || true

echo ""
echo "✅ DEPLOYMENT SUCCESSFUL!"
echo "📊 Service Status:"
pm2 status
echo ""
echo "🌐 URLs:"
echo "   Landing: https://digsan.id"
echo "   Web App: https://app.digsan.id"
echo "   API:     https://api.digsan.id/api"
echo ""
echo "📋 Log file: $LOG_FILE"
EOF

chmod +x deploy.sh
```

**Cara pakai:**
```bash
# SSH ke server lalu jalankan:
~/digsan-v2/deploy.sh
```

---

## Langkah 14: Setup Monitoring & Logging

### A. PM2 Monitoring (Built-in)

```bash
# Lihat status semua apps
pm2 status

# Monitor real-time (CPU, Memory, requests)
pm2 monit

# Lihat logs
pm2 logs digsan-api --lines 50
pm2 logs digsan-web --lines 50

# Flush logs (hati-hati!)
pm2 flush
```

### B. Setup Logrotate (Untuk mencegah disk penuh)

```bash
cat > /etc/logrotate.d/digsan << 'EOF'
/home/digsanid/digsan-v2/logs/*.log {
    daily
    missingok
    rotate 14
    compress
    delaycompress
    notifempty
    create 0640 digsan digsan
    sharedscripts
    postrotate
        pm2 reloadLogs
    endscript
}
EOF

# Test logrotate
logrotate -d /etc/logrotate.d/digsan
```

### C. Setup Uptime Monitoring (Opsional)

Daftar gratis di:
- [UptimeRobot](https://uptimerobot.com) — 50 monitors gratis
- [Better Stack](https://betterstack.com) — 10 monitors gratis

**Endpoints yang perlu di-monitor:**
- `https://digsan.id` (Landing)
- `https://app.digsan.id` (Web)
- `https://api.digsan.id/api` (API Health Check)

---

## Troubleshooting Umum

### 1. Database connection error

```bash
# Cek database jalan
docker ps | grep postgres

# Cek connection
docker exec -it digsan-postgres pg_isready -U digsan_prod

# Cek logs
docker logs digsan-postgres
```

### 2. API tidak bisa diakses

```bash
# Cek PM2 status
pm2 status

# Cek logs
pm2 logs digsan-api --lines 50

# Cek port listening
netstat -tlnp | grep 4000

# Test local
 curl http://localhost:4000/api
```

### 3. WebSocket Chat tidak connect

```bash
# Cek nginx error log
tail -f /var/log/nginx/error.log

# Verifikasi WebSocket headers
curl -i -N -H "Connection: Upgrade" \
     -H "Upgrade: websocket" \
     -H "Host: api.digsan.id" \
     -H "Origin: https://app.digsan.id" \
     https://api.digsan.id/chat
```

### 4. Disk penuh

```bash
# Cek penggunaan disk
df -h

# Cek folder besar
du -sh ~/* | sort -hr

# Cleanup Docker
docker system prune -a

# Cleanup logs
pm2 flush
find ~/digsan-v2/logs -name "*.log" -size +100M -delete
```

### 5. Memory habis (OOM)

```bash
# Cek memory
free -h

# Cek proses
htop

# Restart services (quick fix)
pm2 restart all

# Scale down jika perlu (edit ecosystem.config.js)
# max_memory_restart: '300M'  # turunkan dari 500M
```

---

## Maintenance Rutin

### Harian (via monitoring)
- Cek UptimeRobot alerts (email/Discord)
- Review PM2 logs untuk error

### Mingguan
```bash
# SSH ke server
ssh digsan@203.xxx.xxx.xxx

# Update system
sudo apt update && sudo apt upgrade -y

# Backup database
pg_dump -h localhost -U digsan_prod digsan_v2 | gzip > ~/backups/digsan_$(date +%Y%m%d).sql.gz

# Cek disk space
df -h

# Restart services jika perlu
pm2 restart all
```

### Bulanan
- Review dan hapus backup lama (>30 hari)
- Analisis traffic di Nginx access logs
- Update dependencies: `pnpm update` (test di staging dulu!)

---

## Cheat Sheet Perintah

```bash
# SSH
digsan@203.xxx.xxx.xxx
cd ~/digsan-v2

# Deploy terbaru
~/digsan-v2/deploy.sh

# Restart semua services
pm2 restart all

# Lihat logs real-time
pm2 logs

# Restart database
docker compose -f ~/digsan-v2/docker-compose.db.yml restart

# Database backup manual
docker exec digsan-postgres pg_dump -U digsan_prod digsan_v2 > backup.sql

# SSL renew manual (biasanya auto)
certbot renew

# Cek resource usage
htop
```

---

## Kontak & Support

| Masalah | Solusi |
|---------|--------|
| IDCloudHost VPS | [Helpdesk](https://idcloudhost.com) atau WA: 0857-XXXX-XXXX |
| Domain .id | [PANDI](https://pandi.id) atau registrar |
| SSL/Let's Encrypt | [Certbot docs](https://certbot.eff.org) |
| Digsan App | GitHub Issues atau Discord |

---

**Deploy berhasil! 🎉**

Landing: `https://digsan.id`  
Web App: `https://app.digsan.id`  
API: `https://api.digsan.id/api`
