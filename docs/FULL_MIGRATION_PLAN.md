# Digsan V2 — Full Migration Plan

## Node.js Centralized API + Flutter Mobile + Integrasi Medja

> **Keputusan**: Full migrasi ke folder baru (`digsan-v2/`) dengan Node.js backend terpusat, Flutter mobile app, dan integrasi aplikasi Medja (PanggilAja) sebagai subapp Kerja/Job di ekosistem Digsan.

---

## Daftar Isi

1. [Ringkasan Eksekutif](#1-ringkasan-eksekutif)
2. [Arsitektur Baru](#2-arsitektur-baru)
3. [Folder Structure](#3-folder-structure)
4. [Unified Database Schema](#4-unified-database-schema)
5. [Backend API — Module Mapping](#5-backend-api--module-mapping)
6. [Flutter Mobile App](#6-flutter-mobile-app)
7. [Web Frontend](#7-web-frontend)
8. [Integrasi Medja → Digsan Job](#8-integrasi-medja--digsan-job)
9. [Auth & SSO Strategy](#9-auth--sso-strategy)
10. [Migration Phases](#10-migration-phases)
11. [Timeline & Estimasi](#11-timeline--estimasi)
12. [Risiko & Mitigasi](#12-risiko--mitigasi)

---

## 1. Ringkasan Eksekutif

### Apa yang Berubah

| Aspek | Sekarang (digsan-ecosystem) | Baru (digsan-v2) |
|-------|---------------------------|-------------------|
| **Backend** | Next.js API Routes (tersebar di 9 app) | Node.js centralized API (NestJS) |
| **Web Frontend** | Next.js micro-frontends (9 app) | Next.js SPA/beberapa app (consume API) |
| **Mobile** | Rencana Capacitor (WebView) | Flutter native (Android + iOS) |
| **Database** | PostgreSQL + Prisma (digsan schema) | PostgreSQL + Prisma (unified: digsan + medja) |
| **Medja/Job** | Belum terintegrasi | Fully integrated sebagai module `job` |
| **Auth** | NextAuth.js per-app | Centralized JWT + Google OAuth via API |
| **Realtime** | Tidak ada | Socket.io (chat, notifications) |
| **Caching** | Tidak ada | Redis |

### Apa yang Dipertahankan

- **PostgreSQL + Prisma** — ORM dan database engine tetap sama
- **Next.js** — Web frontend tetap Next.js (consume centralized API)
- **TailwindCSS** — Styling web tetap
- **Business logic** — Semua logic dari digsan-ecosystem dan medja di-port ke NestJS modules
- **Medja Flutter structure** — Arsitektur BLoC + Clean Architecture dari medja/mobile dipakai sebagai fondasi

---

## 2. Arsitektur Baru

```
┌──────────────────────────────────────────────────────────────────┐
│                         CLIENTS                                   │
│                                                                   │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────────────┐  │
│  │ Flutter  │  │ Next.js  │  │ Next.js  │  │   Admin Panel    │  │
│  │ Mobile   │  │   Web    │  │ Landing  │  │   (Next.js)      │  │
│  │ (Dart)   │  │ (React)  │  │ (React)  │  │                  │  │
│  └────┬─────┘  └────┬─────┘  └────┬─────┘  └────────┬─────────┘  │
│       │              │              │                  │           │
│       └──────────────┼──────────────┼──────────────────┘           │
│                      │              │                              │
│              ┌───────▼──────────────▼───────┐                     │
│              │                              │                     │
│              │    NestJS Centralized API     │                     │
│              │    (REST + WebSocket)         │                     │
│              │                              │                     │
│              │  ┌─────┐ ┌─────┐ ┌────────┐  │                     │
│              │  │Auth │ │Tree │ │  Job   │  │                     │
│              │  │     │ │     │ │(Medja) │  │                     │
│              │  ├─────┤ ├─────┤ ├────────┤  │                     │
│              │  │User │ │Game │ │Payment │  │                     │
│              │  │     │ │     │ │(Midtrans│  │                     │
│              │  ├─────┤ ├─────┤ ├────────┤  │                     │
│              │  │Chat │ │Shop │ │Notif   │  │                     │
│              │  │(WS) │ │     │ │(FCM)   │  │                     │
│              │  └─────┘ └─────┘ └────────┘  │                     │
│              │                              │                     │
│              └──────────┬───────────────────┘                     │
│                         │                                         │
│              ┌──────────▼───────────┐                             │
│              │     PostgreSQL       │                             │
│              │  (Unified Schema)    │                             │
│              │  digsan + medja      │                             │
│              └──────────┬───────────┘                             │
│                         │                                         │
│              ┌──────────▼───────────┐                             │
│              │       Redis          │                             │
│              │  (Cache + Sessions)  │                             │
│              └──────────────────────┘                             │
└──────────────────────────────────────────────────────────────────┘
```

---

## 3. Folder Structure

```
digsan-v2/
│
├── apps/
│   │
│   ├── api/                           # NestJS Centralized Backend
│   │   ├── src/
│   │   │   ├── modules/
│   │   │   │   ├── auth/              # Login, register, verify, Google OAuth, JWT
│   │   │   │   ├── user/              # Profile, settings, avatar
│   │   │   │   ├── tree/              # Family tree CRUD, members, hub
│   │   │   │   ├── gamification/      # Points, badges, leaderboard
│   │   │   │   ├── chat/              # Family chat (WebSocket)
│   │   │   │   ├── religious/         # Doa & religi
│   │   │   │   ├── shop/              # Toko keluarga
│   │   │   │   ├── notification/      # Push notif (FCM), in-app, email, WA
│   │   │   │   ├── admin/             # Admin dashboard API
│   │   │   │   │
│   │   │   │   └── job/               # MEDJA/PANGGILAJA MODULE
│   │   │   │       ├── job.module.ts
│   │   │   │       ├── catalog/       # Jobs, categories, subcategories
│   │   │   │       ├── order/         # Order management
│   │   │   │       ├── worker/        # Worker/provider management
│   │   │   │       ├── payment/       # Midtrans payment
│   │   │   │       ├── review/        # Review & rating
│   │   │   │       └── search/        # Search & filter workers
│   │   │   │
│   │   │   ├── common/               # Shared: guards, interceptors, pipes, decorators
│   │   │   └── main.ts               # Entry point
│   │   │
│   │   ├── prisma/
│   │   │   └── schema.prisma         # UNIFIED SCHEMA (digsan + medja)
│   │   ├── nest-cli.json
│   │   ├── tsconfig.json
│   │   └── package.json
│   │
│   ├── web/                           # Next.js Web App (main consumer app)
│   │   └── src/app/
│   │       ├── (auth)/               # Login, register, verify
│   │       ├── (dashboard)/          # User dashboard
│   │       ├── (tree)/               # Family tree
│   │       ├── (job)/                # Job marketplace (ex-Medja)
│   │       ├── (chat)/               # Family chat
│   │       ├── (gamification)/       # Points, badges
│   │       └── (admin)/              # Admin panel
│   │
│   └── landing/                       # Next.js Marketing/Landing Page
│
├── mobile/                            # Flutter Mobile App
│   ├── lib/
│   │   ├── core/                     # API, auth, config, DI, router, theme
│   │   ├── data/                     # Models, datasources, repositories
│   │   ├── domain/                   # Entities, repositories, usecases
│   │   ├── features/                 # Feature-based UI (auth, tree, job, chat, etc.)
│   │   └── main.dart
│   ├── android/
│   ├── ios/
│   └── pubspec.yaml
│
├── packages/                          # Shared Packages
│   ├── shared-types/
│   ├── api-client/
│   └── ui/
│
├── docker/
│   └── docker-compose.yml
│
├── docs/                              # Documentation
├── .env
├── .gitignore
├── package.json
├── pnpm-workspace.yaml
├── turbo.json
└── README.md
```

---

## 4. Unified Database Schema

### Strategi Penggabungan

Database digsan-ecosystem (373 baris) dan medja (733 baris) akan di-*merge* menjadi satu unified Prisma schema. Berikut mapping-nya:

### A. User & Auth (Merge)

| Digsan Field | Medja Field | Unified | Catatan |
|--------------|-------------|---------|---------|
| `User.id` (cuid) | `User.id` (uuid) | `User.id` (cuid) | Standardize ke cuid |
| `User.email` | `User.email` | `User.email` | Sama |
| `User.phone` | `User.phone` | `User.phone` | Sama |
| `User.passwordHash` | `User.password` | `User.passwordHash` | Rename medja |
| `User.name` | `User.fullName` | `User.name` | Standardize |
| `User.avatar` | `User.avatar` | `User.avatar` | Sama |
| `User.bio` | — | `User.bio` | Keep dari digsan |
| `User.googleId` | — | `User.googleId` | Keep dari digsan |
| `User.provider` | — | `User.provider` | Keep dari digsan |
| `User.emailVerified` (DateTime) | `User.emailVerified` (Boolean) | `User.emailVerified` (DateTime) | Upgrade medja ke DateTime |
| `User.phoneVerified` (DateTime) | `User.phoneVerified` (Boolean) | `User.phoneVerified` (DateTime) | Upgrade medja ke DateTime |
| `User.isWhatsapp` | — | `User.isWhatsapp` | Keep dari digsan |
| `UserStatus` enum | `UserStatus` enum | Gabungan: PENDING, ACTIVE, DORMANT, INACTIVE, SUSPENDED, BANNED, DELETED |
| — | `User.role` (enum) | `UserRole` (many-to-many) | Digsan pattern lebih flexible |
| — | `User.lastLoginAt` | `User.lastLoginAt` | Tambah dari medja |

### B. Model yang Dari Digsan (Tetap)

| Model | Status |
|-------|--------|
| `Role`, `UserRole` | Tetap — RBAC flexible |
| `Session`, `RefreshToken` | Tetap |
| `FamilyTree`, `CardStyle` | Tetap |
| `FamilyMember` | Tetap |
| `FamilyHubConnection` | Tetap |
| `TreeInvitation` | Tetap |
| `Point`, `Badge`, `UserBadge`, `BadgeRequirement` | Tetap |
| `Notification` | Merge (tambah type dari medja) |
| `VerificationToken` | Tetap (replace medja OtpVerification + EmailVerification) |

### C. Model yang Dari Medja (Masuk ke Module Job)

| Medja Model | Digsan V2 Model | Namespace |
|-------------|-----------------|-----------|
| `Profile` | `JobWorkerProfile` | job |
| `ProviderSkill` | `JobWorkerSkill` | job |
| `WorkSchedule` | `JobWorkSchedule` | job |
| `ServiceArea` | `JobServiceArea` | job |
| `Job` (Level 1) | `JobCategory` | job (rename: Job → JobCategory) |
| `Category` (Level 2) | `JobSubCategory` | job |
| `SubCategory` (Level 3) | `JobService` | job |
| `Service` | Merge ke `JobService` | job |
| `Order` | `JobOrder` | job |
| `OrderImage` | `JobOrderImage` | job |
| `Payment` | `JobPayment` | job |
| `Review` | `JobReview` | job |
| `Address` | `Address` | shared (bisa dipakai tree juga) |
| `OtpVerification` | `VerificationToken` | auth (merge ke digsan pattern) |
| `PasswordReset` | `VerificationToken` (type=PASSWORD_RESET) | auth |
| `EmailVerification` | `VerificationToken` (type=EMAIL) | auth |
| `AppConfig` | `AppConfig` | system |
| `SystemSettings` | `SystemSettings` | system |
| `LoginHistory` | `LoginHistory` | auth |

### D. Enum Unifikasi

```prisma
// === AUTH ===
enum UserStatus {
  PENDING       // Belum verifikasi (digsan)
  ACTIVE        // Aktif (both)
  DORMANT       // Family member tanpa akun (digsan)
  INACTIVE      // Non-aktif (both)
  SUSPENDED     // Ditangguhkan (both)
  BANNED        // Diblokir (medja)
  DELETED       // Dihapus (both)
}

enum VerificationType {
  EMAIL
  WHATSAPP
  PHONE
  PASSWORD_RESET
  WORKER_REGISTRATION  // dari medja OtpPurpose
  LOGIN                // dari medja OtpPurpose
}

// === JOB (ex-Medja) ===
enum JobOrderStatus {
  PENDING
  WAITING_WORKER
  CONFIRMED
  IN_PROGRESS
  COMPLETED
  CANCELLED
  REFUNDED
}

enum JobPaymentStatus {
  PENDING
  CONFIRMING
  PAID
  FAILED
  REFUNDED
  EXPIRED
}

enum JobPaymentMethod {
  BANK_TRANSFER
  E_WALLET
  CREDIT_CARD
  CASH
}

enum JobPricingType {
  PER_JAM
  PER_PROJECT
}

enum WorkerStatus {
  PENDING
  APPROVED
  REJECTED
  SUSPENDED
}

// === NOTIFICATION (merged) ===
enum NotificationType {
  // Digsan types
  TREE_INVITATION
  MEMBER_ADDED
  BADGE_EARNED
  POINT_RECEIVED
  SYSTEM
  // Medja types
  ORDER_CREATED
  ORDER_CONFIRMED
  ORDER_COMPLETED
  ORDER_CANCELLED
  PAYMENT_SUCCESS
  PAYMENT_FAILED
  REVIEW_RECEIVED
}
```

---

## 5. Backend API — Module Mapping

### NestJS Module Structure

```
src/modules/
│
├── auth/                    # ← digsan auth + medja auth.service
│   ├── auth.module.ts
│   ├── auth.controller.ts   # POST /auth/register, /auth/login, /auth/google, /auth/verify-email, /auth/verify-whatsapp
│   ├── auth.service.ts      # Merge: digsan register/verify + medja auth.service
│   ├── strategies/
│   │   ├── jwt.strategy.ts
│   │   └── google.strategy.ts
│   ├── guards/
│   │   ├── jwt-auth.guard.ts
│   │   └── roles.guard.ts
│   └── dto/
│
├── user/                    # ← digsan user + medja user.routes
│   ├── user.module.ts
│   ├── user.controller.ts   # GET /users/me, PUT /users/me, GET /users/:id
│   └── user.service.ts
│
├── tree/                    # ← digsan tree app
│   ├── tree.module.ts
│   ├── tree.controller.ts   # CRUD /trees, /trees/:id/members, /trees/:id/hub
│   ├── tree.service.ts
│   ├── member.controller.ts
│   └── member.service.ts
│
├── job/                     # ← MEDJA FULL MODULE
│   ├── job.module.ts
│   ├── catalog/
│   │   ├── catalog.controller.ts  # GET /jobs/categories, /jobs/services
│   │   └── catalog.service.ts
│   ├── worker/
│   │   ├── worker.controller.ts   # GET /jobs/workers, POST /jobs/workers/register
│   │   └── worker.service.ts
│   ├── order/
│   │   ├── order.controller.ts    # POST /jobs/orders, GET /jobs/orders/:id
│   │   └── order.service.ts
│   ├── payment/
│   │   ├── payment.controller.ts  # POST /jobs/payments/create, webhook
│   │   └── payment.service.ts
│   ├── review/
│   │   ├── review.controller.ts
│   │   └── review.service.ts
│   └── search/
│       ├── search.controller.ts   # GET /jobs/search
│       └── search.service.ts
│
├── gamification/            # ← digsan gamification
├── chat/                    # ← baru (WebSocket)
├── notification/            # ← merge digsan + medja notification.service
├── admin/                   # ← merge digsan admin + medja admin.routes
│
└── common/                  # Shared infrastructure
    ├── database/
    ├── redis/
    ├── guards/
    ├── interceptors/
    └── decorators/
```

### Medja → NestJS Migration Mapping

| Medja File (Express.js) | → NestJS Target | Size | Complexity |
|--------------------------|-----------------|------|------------|
| `routes/order.routes.js` | `modules/job/order/` | 60KB | High |
| `routes/worker.routes.js` | `modules/job/worker/` | 59KB | High |
| `routes/admin.routes.js` | `modules/admin/` | 50KB | High |
| `services/email.service.js` | `modules/notification/email.service.ts` | 56KB | Medium |
| `services/notification.service.js` | `modules/notification/notification.service.ts` | 36KB | Medium |
| `routes/payment.routes.js` | `modules/job/payment/` | 20KB | Medium |
| `services/whatsapp.service.js` | `modules/notification/whatsapp.service.ts` | 13KB | Low |
| `routes/otp.routes.js` | `modules/auth/` | 17KB | Medium |
| `services/auth.service.js` | `modules/auth/auth.service.ts` | 14KB | Medium |
| `routes/availability.routes.js` | `modules/job/worker/availability/` | 11KB | Medium |
| `routes/user.routes.js` | `modules/user/` | 11KB | Low |
| `routes/search.routes.js` | `modules/job/search/` | 3KB | Low |
| `controllers/*.js` | Respective modules | ~47KB total | Medium |
| `services/midtrans.service.js` | `modules/job/payment/midtrans.service.ts` | 8KB | Medium |
| `services/token.service.js` | `modules/auth/token.service.ts` | 8KB | Low |

---

## 6. Flutter Mobile App

### Fondasi dari Medja Flutter

Medja sudah memiliki Flutter app (`medja/mobile/panggilaja_user/`) dengan:
- **BLoC** state management
- **GetIt + Injectable** dependency injection
- **GoRouter** navigation
- **Dio** HTTP client
- **Clean Architecture** (data/domain/presentation)
- **Firebase** (FCM)
- **Google Maps** integration

Arsitektur ini akan di-*extend* untuk semua fitur Digsan.

### Feature Mapping (Flutter)

| Feature | Screen Count (Est.) | Dari Medja | Baru |
|---------|--------------------:|:----------:|:----:|
| **Auth** (login, register, verify, Google) | 5 | Partial | Extend |
| **Dashboard** (home, profile, settings) | 4 | Partial | Extend |
| **Family Tree** (viewer, editor, members) | 6 | — | New |
| **Job/Medja** (browse, order, track, pay) | 10 | Full | Reuse |
| **Worker** (profile, register, schedule) | 5 | Full | Reuse |
| **Chat** (family conversations) | 3 | — | New |
| **Gamification** (points, badges, board) | 3 | — | New |
| **Notifications** (list, detail) | 2 | Partial | Extend |
| **Admin** (stats, user mgmt) | 3 | Partial | Extend |
| **Total** | **~41 screens** | | |

---

## 7. Web Frontend

### Konsolidasi dari 9 Apps → 2-3 Apps

| Sekarang (9 apps) | Baru | Alasan |
|-------------------|------|--------|
| `landing` | `apps/landing/` | Tetap terpisah (marketing) |
| `auth` | Route group di `apps/web/(auth)/` | Tidak perlu app terpisah |
| `dashboard` | Route group di `apps/web/(dashboard)/` | Gabung ke web |
| `tree` | Route group di `apps/web/(tree)/` | Gabung ke web |
| `game` | Route group di `apps/web/(gamification)/` | Gabung ke web |
| `chat` | Route group di `apps/web/(chat)/` | Gabung ke web |
| `religi` | Route group di `apps/web/(religious)/` | Gabung ke web |
| `shop` | Route group di `apps/web/(shop)/` | Gabung ke web |
| `job` | Route group di `apps/web/(job)/` | Medja frontend masuk sini |

**Benefit**: Satu domain (`app.digsan.id`), satu build, shared layout & auth state.

---

## 8. Integrasi Medja → Digsan Job

### Branding Transition

| Aspek | Medja/PanggilAja | Digsan Job |
|-------|-----------------|------------|
| **Nama** | PanggilAja | Digsan Kerja / Digsan Job |
| **Domain** | panggilaja.id | digsan.id/kerja atau kerja.digsan.id |
| **Target** | Semua orang | Komunitas keluarga Digsan + publik |
| **Unique Value** | On-demand services | Jasa dari/untuk anggota keluarga + publik |

### Yang Bisa Langsung Dipakai dari Medja

| Komponen | File/Folder | Status |
|----------|-------------|--------|
| Backend API routes | `backend/src/routes/` | Port ke NestJS modules |
| Backend services | `backend/src/services/` | Port ke NestJS services |
| Prisma schema | `backend/prisma/schema.prisma` | Merge ke unified schema |
| Seed data (categories, jobs) | `backend/prisma/seed-*.js` | Convert ke TypeScript |
| Flutter app structure | `mobile/panggilaja_user/lib/` | Extend |
| Midtrans integration | `services/midtrans.service.js` | Port |
| Email service | `services/email.service.js` | Merge dgn digsan email |
| WhatsApp/Fonnte service | `services/fonnte.service.js` | Merge dgn digsan WA |
| Admin panel | `routes/admin.routes.js` + frontend `admin/` | Merge ke digsan admin |

### Family-Specific Job Features (Baru)

1. **Family Worker Directory** — Anggota keluarga yang punya keahlian tertentu bisa ditemukan oleh anggota keluarga lain
2. **Family Discount** — Diskon otomatis jika pemesan dan pekerja dalam satu pohon keluarga
3. **Trust Score** — Worker yang merupakan anggota keluarga mendapat trust badge
4. **Referral** — Anggota keluarga bisa refer worker ke keluarga lain via Silsilah-Hub
5. **Family Points** — Transaksi job menambah poin gamifikasi keluarga

---

## 9. Auth & SSO Strategy

### Unified Auth Flow

```
┌─────────────┐     ┌──────────────────────────────────┐
│ Flutter App  │────>│                                  │
│ Web App      │     │    POST /api/auth/login           │
│ Landing Page │     │    POST /api/auth/register         │
└─────────────┘     │    POST /api/auth/google            │
                     │    POST /api/auth/verify-email      │
                     │    POST /api/auth/verify-whatsapp   │
                     │    POST /api/auth/refresh-token     │
                     │                                  │
                     │    Returns: { accessToken, refreshToken } │
                     └──────────────────────────────────┘
```

- **JWT** (access token: 15min, refresh token: 30 days)
- **Google OAuth2** (web: redirect flow, mobile: Google Sign-In SDK)
- **Email verification** (link) + **WhatsApp OTP** (Fonnte)
- **Redis** untuk session blacklist & rate limiting

---

## 10. Migration Phases

### Phase 0: Setup (Minggu 1)
- Init digsan-v2/ repository
- Setup pnpm workspace + Turborepo
- Init NestJS project (apps/api/)
- Init Next.js project (apps/web/)
- Copy & adapt Flutter project dari medja
- Setup Docker Compose (PostgreSQL + Redis)
- Create unified Prisma schema
- Run prisma migrate dev

### Phase 1: Auth & Core (Minggu 2-3)
- NestJS auth module (register, login, verify, Google OAuth, JWT)
- NestJS user module (profile CRUD)
- Flutter: auth screens (login, register, verify, Google sign-in)
- Web: auth pages ((auth)/ route group)
- Redis session management
- API documentation (Swagger)

### Phase 2: Family Tree (Minggu 3-4)
- NestJS tree module (CRUD trees, members, hub connections)
- Flutter: tree viewer & editor screens
- Web: tree pages ((tree)/ route group)
- Tree invitation system

### Phase 3: Job/Medja Integration (Minggu 4-6)
- Port medja backend → NestJS job module
  - catalog (jobs, categories, subcategories)
  - worker (registration, profile, availability, schedule)
  - order (create, track, complete, cancel)
  - payment (Midtrans integration)
  - review (rating system)
  - search (filter, sort)
- Flutter: job screens (reuse & adapt medja Flutter code)
- Web: job pages ((job)/ route group, port medja frontend)
- Seed data migration (categories, sample workers)

### Phase 4: Gamification & Chat (Minggu 6-7)
- NestJS gamification module (points, badges)
- NestJS chat module (WebSocket gateway)
- Flutter: gamification & chat screens
- Web: gamification & chat pages

### Phase 5: Notification & Admin (Minggu 7-8)
- NestJS notification module (email, WhatsApp, FCM)
- NestJS admin module (merge digsan + medja admin)
- Flutter: notification handler + admin screens
- Web: admin panel ((admin)/ route group)

### Phase 6: Testing & Polish (Minggu 8-10)
- E2E testing (API)
- Flutter integration tests
- Performance optimization
- Security audit
- App Store / Play Store submission prep

---

## 11. Timeline & Estimasi

| Phase | Durasi | Deliverable |
|-------|--------|-------------|
| **Phase 0**: Setup | 1 minggu | Repo, scaffolding, unified schema |
| **Phase 1**: Auth & Core | 2 minggu | Login/register/verify di semua platform |
| **Phase 2**: Family Tree | 1-2 minggu | Tree CRUD di API, web, mobile |
| **Phase 3**: Job/Medja | 2-3 minggu | Full job marketplace (port medja) |
| **Phase 4**: Gamification & Chat | 1-2 minggu | Points, badges, family chat |
| **Phase 5**: Notification & Admin | 1-2 minggu | Push notif, email, admin panel |
| **Phase 6**: Testing & Polish | 2 minggu | QA, store submission |
| **Total** | **10-14 minggu** | Full ecosystem v2 |

### Resource

| Role | Count | Catatan |
|------|-------|---------|
| Fullstack Dev (Node.js + Next.js) | 1 | API + Web |
| Flutter Dev | 1 | Mobile app |
| **Total** | **1-2 dev** | Bisa 1 orang jika sequential |

---

## 12. Risiko & Mitigasi

| Risiko | Probabilitas | Impact | Mitigasi |
|--------|-------------|--------|----------|
| Medja migration complexity (60KB route files) | Medium | High | Port bertahap per-endpoint, test per-module |
| Unified schema conflicts | Low | Medium | Namespace job models dgn prefix `Job` |
| Flutter learning curve (jika baru) | Medium | Medium | Reuse medja Flutter code sebagai template |
| Scope creep | High | High | Strict phase gating, MVP-first per feature |
| Data migration (existing users) | Low | Medium | Script migrasi terpisah, run sekali |
| Breaking changes selama development | Medium | Medium | Versioned API (/api/v1/), feature flags |

---

## Checklist Sebelum Mulai

- [x] Pastikan Node.js >= 20 terinstall
- [x] Pastikan Flutter SDK >= 3.10 terinstall
- [x] Pastikan PostgreSQL dan Redis berjalan
- [x] Buat repo baru `digsan-v2`
- [x] Copy `.env` values dari digsan-ecosystem + medja
- [ ] Setup Google Cloud Console (OAuth client ID untuk web + mobile)
- [ ] Setup Firebase project (FCM untuk push notification)
- [ ] Setup Midtrans sandbox account (untuk testing payment)

---

## Progress Aktual

| Phase | Status | Detail |
|-------|--------|--------|
| **Phase 0**: Setup | ✅ Done | Monorepo (pnpm + Turborepo), Prisma schema, Docker Compose |
| **Phase 1**: Auth & Core | ✅ Done | 21 E2E tests — register, login, verify, JWT, refresh, logout |
| **Phase 2**: Family Tree | ✅ Done | 28 E2E tests — tree CRUD, members, hub connections |
| **Phase 3**: Job/Medja | ✅ Done | 49 E2E tests — catalog, worker, order, payment, review, search |
| **Phase 4**: Notification | ✅ Done | 22 E2E tests — CRUD, mark read, bulk operations |
| **Phase 5**: Admin | ✅ Done | 32 E2E tests — dashboard, users, workers, orders, settings, configs |
| **Phase 6**: Gamification | ✅ Done | 17 E2E tests — points, badges, leaderboard |
| **Phase 7**: Chat | ✅ Done | 32 E2E tests — rooms, messages, members, WebSocket gateway |
| **Phase 8**: Security & Polish | ✅ Done | 20 E2E tests — rate limiting, CORS, helmet, exception filter, logging |
| **Phase 9**: Web Frontend | ✅ Done | 18 pages — auth, dashboard, tree, chat, gamification, notifications, admin |
| **Phase 10**: Flutter Mobile | ✅ Done | BLoC + GoRouter + Dio — splash, auth, home, tree, chat, gamification, notifications, profile |
| **Total API E2E Tests** | **221** | All passing |

*Dokumen ini dibuat: 1 April 2026*
*Status: Phase 0-10 selesai — Siap untuk testing & polish*
