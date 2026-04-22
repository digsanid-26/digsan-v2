# Analisis: Node.js Backend + Flutter Mobile vs Stack Saat Ini

> **Sumber**: Dari digsan-ecosystem — dokumen analisis sebelum keputusan full migration.
> **Status**: Keputusan sudah diambil → Full Migration (Skenario 1).

## Daftar Isi

1. [Stack Saat Ini](#stack-saat-ini)
2. [Alternatif: Node.js Backend + Flutter](#alternatif-nodejs-backend--flutter)
3. [Perbandingan Arsitektur](#perbandingan-arsitektur)
4. [Kelebihan & Kekurangan](#kelebihan--kekurangan)
5. [Probabilitas Keberhasilan Migrasi](#probabilitas-keberhasilan-migrasi)
6. [Skenario Implementasi](#skenario-implementasi)
7. [Estimasi Effort](#estimasi-effort)
8. [Rekomendasi](#rekomendasi)

---

## Stack Saat Ini (digsan-ecosystem)

| Layer | Teknologi |
|-------|-----------|
| **Frontend Web** | Next.js 15 (React 19) + TailwindCSS |
| **Backend/API** | Next.js API Routes (serverless-style) |
| **Database** | PostgreSQL + Prisma ORM |
| **Auth** | NextAuth.js v4 (Credentials + Google OAuth) |
| **Monorepo** | pnpm workspaces + Turborepo |
| **Shared Packages** | `@digsan/database`, `@digsan/utils`, `@digsan/ui`, `@digsan/auth-client`, `@digsan/config` |
| **Rencana Mobile** | Capacitor (wrap web app) / PWA |
| **Services** | 9 micro-frontend apps (landing, auth, dashboard, tree, game, chat, religi, shop, job) |

---

## Perbandingan Arsitektur

### Stack Lama (Next.js Full-Stack + Capacitor)

```
┌──────────────────────────────────────────────────┐
│                    CLIENT                         │
│   Browser ──► Next.js SSR/CSR Pages               │
│   Mobile  ──► Capacitor (WebView wrapper)         │
│         ┌─────────────────────────┐               │
│         │   Next.js API Routes    │ ◄── Backend   │
│         │   (per-app, co-located) │     tersebar  │
│         └────────────┬────────────┘     di 9 app  │
│              ┌───────▼───────┐                    │
│              │  PostgreSQL   │                    │
│              └───────────────┘                    │
└──────────────────────────────────────────────────┘
```

### Stack Baru (digsan-v2: Node.js API + Flutter)

```
┌──────────────────────────────────────────────────┐
│                    CLIENT                         │
│   Browser ──► Next.js (frontend only) ──┐         │
│   Mobile  ──► Flutter (native)     ─────┤         │
│                           ┌─────────────▼──────┐  │
│                           │  NestJS REST API   │  │
│                           │  (centralized)     │  │
│                           └────────┬───────────┘  │
│                            ┌───────▼───────┐      │
│                            │  PostgreSQL   │      │
│                            │  + Redis      │      │
│                            └───────────────┘      │
└──────────────────────────────────────────────────┘
```

---

## Kelebihan & Kekurangan

### A. Flutter (vs Capacitor/PWA untuk Mobile)

| Aspek | Flutter | Capacitor/PWA |
|-------|---------|---------------|
| **Performa UI** | Native 60/120fps | WebView, kadang lag |
| **Look & Feel** | Native feel | Terasa web di-wrap |
| **Akses Native API** | Penuh | Terbatas via plugin |
| **Offline Support** | SQLite/Hive | Service Worker, terbatas |
| **Push Notification** | Firebase native | Via plugin, kurang reliable |
| **App Store Approval** | Native binary | WebView kadang ditolak Apple |
| **Code Reuse (Web)** | Codebase terpisah (Dart) | Satu codebase web = mobile |
| **Development Speed** | Perlu belajar Dart | Langsung wrap web existing |

### B. Dedicated Node.js Backend (vs Next.js API Routes)

| Aspek | Node.js Dedicated API | Next.js API Routes |
|-------|-----------------------|--------------------|
| **Scalability** | Scale backend terpisah | Terikat frontend deployment |
| **API Consistency** | Satu API, satu contract | Tersebar di 9 app |
| **Multi-Client** | Web + Mobile + 3rd party | Tiap app punya API sendiri |
| **WebSocket/Realtime** | Socket.io native | Terbatas di serverless |
| **Testing API** | Mudah unit test | Testing route lebih rumit |
| **Documentation** | Swagger/OpenAPI | Manual |
| **Caching** | Redis, full control | Next.js cache, terbatas |

---

## Keputusan: Full Migration

Dipilih Skenario 1 (Full Migration) karena:
1. Clean separation of concerns
2. Satu API server melayani semua client (web, mobile, 3rd party)
3. Paling scalable untuk long-term
4. Integrasi Medja/PanggilAja sebagai Job module membutuhkan centralized backend
5. Flutter memberikan UX native yang superior

---

## Tech Stack (Terpilih)

### API Server (NestJS)

| Komponen | Teknologi |
|----------|-----------|
| Framework | NestJS |
| ORM | Prisma |
| Auth | Passport.js + JWT |
| Validation | class-validator |
| Documentation | Swagger/OpenAPI |
| Realtime | Socket.io |
| Caching | Redis |
| Rate Limiting | @nestjs/throttler |

### Flutter Mobile

| Komponen | Teknologi |
|----------|-----------|
| State Management | BLoC |
| HTTP Client | Dio |
| Local Storage | Hive |
| Navigation | GoRouter |
| Auth | flutter_secure_storage + JWT |
| Push Notification | Firebase Cloud Messaging |
| UI | Material 3 + custom Digsan theme |
| Tree Visualization | graphview / custom Canvas |

---

*Dokumen ini dibuat: 1 April 2026*
*Status: Keputusan diambil — Full Migration ke digsan-v2*
