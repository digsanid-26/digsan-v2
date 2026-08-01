# Digsan — Technical Overview

---

## 1. Arsitektur Sistem

```
┌─────────────┐     ┌─────────────┐     ┌─────────────┐
│   Landing   │     │   Web App   │     │   API       │
│  (digsan.id)│     │(app.digsan) │     │(api.digsan) │
│  Next.js    │     │  Next.js    │     │  NestJS     │
└──────┬──────┘     └──────┬──────┘     └──────┬──────┘
       │                   │                   │
       │                   │     ┌─────────────┤
       │                   │     │             │
       ▼                   ▼     ▼             ▼
  ┌──────────────────────────────────┐  ┌───────────┐
  │         PostgreSQL               │  │   Redis   │
  │     (Prisma ORM)                 │  │ (cache)   │
  └──────────────────────────────────┘  └───────────┘
                                            │
                                       ┌───────────┐
                                       │ Socket.io │
                                       │ (realtime)│
                                       └───────────┘
```

---

## 2. Tech Stack

### 2.1 Frontend (Web App & Landing)

| Teknologi | Versi | Kegunaan |
|-----------|-------|----------|
| Next.js | 15+ | React framework, SSR/SSG |
| React | 19+ | UI library |
| TypeScript | 5+ | Type safety |
| TailwindCSS | 3+ | Styling |
| Lucide Icons | - | Icon set |
| Socket.io Client | - | Real-time updates |

### 2.2 Backend (API)

| Teknologi | Versi | Kegunaan |
|-----------|-------|----------|
| NestJS | 11+ | Backend framework |
| Prisma ORM | 6+ | Database ORM |
| PostgreSQL | 15+ | Database |
| Redis | 7+ | Cache & session |
| Socket.io | 4+ | Real-time |
| JWT | - | Authentication |
| Passport | - | OAuth (Google) |
| Helmet | - | Security headers |
| Swagger | - | API documentation |

### 2.3 Infrastructure

| Komponen | Teknologi | Keterangan |
|----------|-----------|------------|
| Hosting | VPS (IDCloudHost) | Server Indonesia |
| Web Server | Nginx | Reverse proxy |
| Process Manager | PM2 | Node.js process management |
| SSL | Let's Encrypt | HTTPS |
| CI/CD | Git + manual deploy | Roadmap: GitHub Actions |

### 2.4 Third-Party Services

| Service | Kegunaan | Status |
|---------|----------|--------|
| OpenRouter | AI image generation (Ads Builder) | ✅ Active |
| Cloudinary | Image storage (roadmap) | 📋 Configured |
| Firebase FCM | Push notification | 📋 Configured |
| Fonnte | WhatsApp API | 📋 Configured |
| iPaymu | Payment gateway | 📋 Configured |
| Google OAuth | Login dengan Google | 📋 Configured |
| Nodemailer | Email (SMTP) | 📋 Configured |

---

## 3. Database Schema (Key Models)

### 3.1 Core Models

| Model | Deskripsi |
|-------|-----------|
| User | Akun pengguna (email, name, avatar, role) |
| FamilyTree | Pohon keluarga (slug, layoutConfig, layoutMembers) |
| FamilyMember | Anggota keluarga (parentId, spouseId, role) |
| GuardianConsent | Perizinan kelola profil anggota |
| AdSpot | Spot iklan (key, page, position, aspectRatio) |
| AdBanner | Banner iklan (imageUrl, linkUrl, title) |
| AdAssignment | Penugasan banner ke spot |

### 3.2 Auth & Security

| Model | Deskripsi |
|-------|-----------|
| Session | Sesi JWT (access + refresh token) |
| AuditLog | Log aktivitas |

---

## 4. Fitur Teknis Utama

### 4.1 Pohon Keluarga Interaktif

- **Layout engine:** `familyGraph.ts` — algoritma recursive tidy-tree untuk visualisasi silsilah.
- **Graph-driven:** Berbasis relasi (parentId, spouseId, group) dengan merge dari config.
- **Canvas rendering:** Custom canvas dengan zoom, pan, dan interaksi node.
- **Public & private access:** Halaman publik dengan token, privat dengan auth.

### 4.2 Sistem Klaim Anggota

- Anggota yang diundang dapat "mengklaim" posisi mereka di pohon.
- Validasi via token link atau login sebagai anggota.

### 4.3 Guardian Consent

- Sistem perizinan untuk mengelola profil anggota yang telah wafat.
- Status: PENDING, GRANTED, REJECTED, REVOKED.

### 4.4 Ads Builder dengan AI

- Integrasi OpenRouter untuk generate banner dengan AI.
- Support model selection (Gemini, GPT-4o, Claude, dll).
- Upload lampiran gambar referensi (hingga 3 gambar).
- Download & penyimpanan gambar hasil secara lokal.

### 4.5 Real-time

- Socket.io untuk notifikasi real-time.
- Update langsung saat ada perubahan keluarga.

---

## 5. Keamanan

| Aspek | Implementasi |
|-------|--------------|
| Authentication | JWT (access + refresh), Google OAuth |
| Authorization | Role-based (user, admin, super_admin) |
| API Security | Helmet, CORS, rate limiting |
| Data Privacy | UU PDP compliance (roadmap) |
| Password | bcrypt hashing |
| Token | HttpOnly cookies + refresh rotation |

---

## 6. Scalability

### 6.1 Current Architecture (MVP)

- Single VPS, monolithic backend.
- PostgreSQL single instance.
- Redis for cache.
- Cukup untuk _(akan dilengkapi)_ pengguna.

### 6.2 Scaling Plan

| Komponen | Current | Scale-up Plan |
|----------|---------|---------------|
| API | Single instance | Load balancer + multiple instances |
| Database | Single PostgreSQL | Read replica + connection pooling |
| File storage | Local filesystem | Cloudinary/S3 |
| Cache | Single Redis | Redis cluster |
| CDN | None | Cloudflare/CDN for static assets |
| Queue | None | BullMQ for background jobs |

### 6.3 Performance Targets

| Metric | Target |
|--------|--------|
| API response time | < 200ms (p95) |
| Page load (LCP) | < 2.5s |
| Uptime | 99.9% |
| Concurrent users | _(akan dilengkapi)_ |

---

## 7. Development & Deployment

### 7.1 Development Workflow

- **Version control:** Git (GitHub)
- **Branch strategy:** master (production), feature branches
- **Code review:** Pull requests
- **Testing:** Jest (backend), manual (frontend)
- **Roadmap:** Automated testing (Vitest, Playwright)

### 7.2 Deployment Process

```bash
# Full deploy
~/digsan-v2/deploy.sh

# Web only
git pull origin master
pnpm --filter @digsan/web build
pm2 restart digsan-web

# API only
git pull origin master
pnpm --filter @digsan/api build
pm2 restart digsan-api
```

### 7.3 Monitoring

- PM2 logs & monitoring.
- Nginx access logs.
- Roadmap: Sentry (error tracking), Datadog/New Relic (APM).

---

## 8. Technical Debt & Roadmap

| Item | Prioritas | Estimasi |
|------|-----------|----------|
| Automated testing | Tinggi | _(akan dilengkapi)_ |
| CI/CD pipeline | Tinggi | _(akan dilengkapi)_ |
| Cloudinary integration | Sedang | _(akan dilengkapi)_ |
| Mobile app (React Native) | Sedang | _(akan dilengkapi)_ |
| Microservices split | Rendah | _(akan dilengkapi)_ |
| Kubernetes deployment | Rendah | _(akan dilengkapi)_ |

---

_Dokumen ini memberikan gambaran teknis untuk investor non-teknis maupun teknis. Detail implementasi tersedia di codebase._
