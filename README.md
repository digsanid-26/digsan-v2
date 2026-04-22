# Digsan V2

Platform Keluarga Indonesia — rebuilt with NestJS + Next.js + Flutter.

## Tech Stack

| Layer | Technology |
|-------|-----------|
| **API** | NestJS (Node.js) — REST + WebSocket, 221 E2E tests |
| **Web** | Next.js 15 + TailwindCSS — 18 pages |
| **Mobile** | Flutter 3.38 (BLoC + GoRouter + Dio) — 10 screens |
| **Database** | PostgreSQL + Prisma ORM |
| **Cache** | Redis |
| **Auth** | JWT + Google OAuth2 + Email/WhatsApp OTP |
| **Payment** | Midtrans |

## API Modules

| Module | Endpoints | E2E Tests |
|--------|-----------|-----------|
| Auth | register, login, verify, refresh, logout, Google OAuth | 21 |
| Family Tree | trees CRUD, members, hub connections | 28 |
| Job/Medja | catalog, worker, order, payment, review, search | 49 |
| Notification | CRUD, mark read, bulk operations | 22 |
| Admin | dashboard, users, workers, orders, settings, configs | 32 |
| Gamification | points, badges, leaderboard | 17 |
| Chat | rooms, messages, members, WebSocket gateway | 32 |
| Security | rate limiting, CORS, helmet, exception filter, logging | 20 |
| **Total** | | **221** |

## Structure

```
digsan-v2/
├── apps/
│   ├── api/          # NestJS Centralized API (port 4000)
│   ├── web/          # Next.js Web App (port 3000)
│   ├── mobile/       # Flutter Mobile App (Android + iOS)
│   └── landing/      # Next.js Landing Page (port 3001)
├── docker/           # Docker Compose (PostgreSQL + Redis)
├── docs/             # Migration plan & documentation
└── .env
```

## Quick Start

```powershell
# 1. Install dependencies
pnpm install

# 2. Start PostgreSQL + Redis (requires Docker)
docker compose -f docker/docker-compose.yml up -d

# 3. Generate Prisma client + run migrations + seed
pnpm --filter @digsan/api db:generate
pnpm --filter @digsan/api db:push
pnpm --filter @digsan/api db:seed

# 4. Start dev servers
pnpm dev
```

### Individual servers

```powershell
pnpm dev:api       # NestJS API    → http://localhost:4000
pnpm dev:web       # Next.js Web   → http://localhost:3000
pnpm dev:landing   # Landing Page  → http://localhost:3001
```

### Flutter mobile

```powershell
cd apps/mobile
flutter pub get
flutter run
```

### Run API tests

```powershell
pnpm --filter @digsan/api test:e2e
```

### API Documentation

Swagger UI available at: http://localhost:4000/api/docs

## Ports

| Service | Port |
|---------|------|
| API (NestJS) | 4000 |
| Web (Next.js) | 3000 |
| Landing (Next.js) | 3001 |
| PostgreSQL | 5432 |
| Redis | 6379 |

## Documentation

- **[DEMO_GUIDE.md](docs/DEMO_GUIDE.md)** — Panduan menjalankan di localhost (Windows PowerShell)
- **[DEPLOYMENT_GUIDE.md](docs/DEPLOYMENT_GUIDE.md)** — 3 tier deployment (gratis, medium, premium)
- **[DEPLOY_IDCLOUDHOST.md](docs/DEPLOY_IDCLOUDHOST.md)** — Step-by-step deployment ke VPS IDCloudHost Jakarta

## Repository

**GitHub**: [https://github.com/digsanid-26/digsan-v2](https://github.com/digsanid-26/digsan-v2)

## License

Private — © 2026 Digsan Indonesia
