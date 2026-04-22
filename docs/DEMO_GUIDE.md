# Digsan V2 — Panduan Demo Localhost (Windows PowerShell)

## Prasyarat

| Tool | Versi Minimum | Cek Versi |
|------|---------------|-----------|
| **Node.js** | 20.x | `node -v` |
| **pnpm** | 9.x | `pnpm -v` |
| **Docker Desktop** | Terbaru | `docker --version` |
| **Flutter SDK** | 3.38+ | `flutter --version` |
| **Android Emulator** | API 33+ | via Android Studio |

---

## 1. Clone & Install Dependencies

```powershell
cd C:\Users\MANAKreatif\CascadeProjects\digsan-v2

# Install semua dependencies (API + Web + Landing)
pnpm install
```

---

## 2. Jalankan Database (PostgreSQL + Redis)

Buka terminal baru, lalu:

```powershell
cd C:\Users\MANAKreatif\CascadeProjects\digsan-v2\docker
docker compose up -d
```

Verifikasi container berjalan:

```powershell
docker ps
# Harus muncul: digsan-v2-postgres (port 5432) dan digsan-v2-redis (port 6379)
```

---

## 3. Setup Environment

```powershell
cd C:\Users\MANAKreatif\CascadeProjects\digsan-v2

# Salin .env.example ke .env (jika belum ada)
Copy-Item .env.example .env -ErrorAction SilentlyContinue

# Edit .env sesuai kebutuhan (minimal pastikan DATABASE_URL dan JWT_SECRET sudah benar)
# Default sudah siap pakai untuk development lokal
```

---

## 4. Setup Database Schema

```powershell
cd C:\Users\MANAKreatif\CascadeProjects\digsan-v2\apps\api

# Generate Prisma Client
pnpm db:generate

# Push schema ke database
pnpm db:push

# (Opsional) Jalankan seed data
pnpm db:seed
```

---

## 5. Jalankan API Server (NestJS — Port 4000)

```powershell
cd C:\Users\MANAKreatif\CascadeProjects\digsan-v2

pnpm dev:api
```

Tunggu sampai muncul pesan:
```
[Nest] ... LOG [NestApplication] Nest application successfully started
```

**Test API**: Buka browser → `http://localhost:4000/api`

**Swagger Docs**: `http://localhost:4000/api/docs` (jika diaktifkan)

---

## 6. Jalankan Web Frontend (Next.js — Port 3000)

Buka **terminal baru**:

```powershell
cd C:\Users\MANAKreatif\CascadeProjects\digsan-v2

pnpm dev:web
```

**Buka di browser**: `http://localhost:3000`

---

## 7. Jalankan Landing Page (Next.js — Port 3001)

Buka **terminal baru**:

```powershell
cd C:\Users\MANAKreatif\CascadeProjects\digsan-v2

pnpm dev:landing
```

**Buka di browser**: `http://localhost:3001`

---

## 8. Jalankan Flutter Mobile App

Buka **terminal baru**:

```powershell
cd C:\Users\MANAKreatif\CascadeProjects\digsan-v2\apps\mobile

# Pastikan emulator Android sudah berjalan
flutter emulators --launch <nama_emulator>
# Contoh: flutter emulators --launch Pixel_7_API_34

# Jalankan app
flutter run
```

> **Catatan:** Flutter mobile terhubung ke API via `http://10.0.2.2:4000/api`
> (alias localhost dari dalam Android Emulator). Pastikan API server sudah berjalan di langkah 5.

Untuk menjalankan di browser (Chrome) sebagai alternatif:

```powershell
flutter run -d chrome
```

---

## 9. Jalankan Semua Tests

### API Tests (E2E)

```powershell
cd C:\Users\MANAKreatif\CascadeProjects\digsan-v2\apps\api

# Pastikan database & redis sudah berjalan
pnpm test
```

### Flutter Tests

```powershell
cd C:\Users\MANAKreatif\CascadeProjects\digsan-v2\apps\mobile

flutter test
```

### Flutter Analyze

```powershell
cd C:\Users\MANAKreatif\CascadeProjects\digsan-v2\apps\mobile

flutter analyze
```

---

## Rangkuman Port & URL

| Service | URL | Port |
|---------|-----|------|
| **API (NestJS)** | http://localhost:4000/api | 4000 |
| **Web (Next.js)** | http://localhost:3000 | 3000 |
| **Landing Page** | http://localhost:3001 | 3001 |
| **PostgreSQL** | localhost | 5432 |
| **Redis** | localhost | 6379 |
| **Flutter Mobile** | via Android Emulator | — |

---

## Troubleshooting

### Docker tidak bisa start
```powershell
# Pastikan Docker Desktop sudah running
# Cek apakah port sudah digunakan
netstat -ano | findstr :5432
netstat -ano | findstr :6379
```

### API error "Cannot connect to database"
```powershell
# Pastikan container postgres berjalan
docker ps | findstr postgres

# Cek koneksi
docker exec digsan-v2-postgres pg_isready
```

### Flutter build gagal (network error)
```powershell
# Hapus cache dan rebuild
cd C:\Users\MANAKreatif\CascadeProjects\digsan-v2\apps\mobile
flutter clean
flutter pub get
flutter run
```

### Port sudah digunakan
```powershell
# Cari proses yang menggunakan port (contoh: 4000)
netstat -ano | findstr :4000

# Matikan proses berdasarkan PID
taskkill /PID <PID> /F
```

---

## Quick Start (Semua Sekaligus)

Jika semua prasyarat sudah terpasang dan `.env` sudah dikonfigurasi, jalankan dalam 4 terminal terpisah:

```powershell
# Terminal 1 — Database
cd C:\Users\MANAKreatif\CascadeProjects\digsan-v2\docker
docker compose up -d

# Terminal 2 — API
cd C:\Users\MANAKreatif\CascadeProjects\digsan-v2
pnpm dev:api

# Terminal 3 — Web Frontend
cd C:\Users\MANAKreatif\CascadeProjects\digsan-v2
pnpm dev:web

# Terminal 4 — Landing Page
cd C:\Users\MANAKreatif\CascadeProjects\digsan-v2
pnpm dev:landing

# Terminal 5 — Flutter Mobile (opsional)
cd C:\Users\MANAKreatif\CascadeProjects\digsan-v2\apps\mobile
flutter run
```

---

## Fitur Flutter Mobile App

| Modul | Screens | Deskripsi |
|-------|---------|-----------|
| **Auth** | Login, Register, Forgot Password | JWT auth dengan secure storage |
| **Dashboard** | Beranda | Stats cards, Kerja banner, quick actions |
| **Silsilah** | List, Detail | CRUD pohon keluarga & anggota |
| **Chat** | List, Room | Real-time chat via WebSocket |
| **Gamifikasi** | Poin, Leaderboard, Badge | Sistem poin & pencapaian |
| **Notifikasi** | List | Baca & tandai semua dibaca |
| **Digsan Kerja** | Home, Kategori, Cari Jasa, Detail Jasa, Cari Pekerja, Detail Pekerja, Riwayat Order, Detail Order | Marketplace jasa/pekerja |
| **Profil** | Profil | Info user & logout |

### Navigasi Digsan Kerja

Dari **Dashboard** → tap banner **"Digsan Kerja"** atau quick action **"Cari Jasa"**:

1. **Job Home** — Kategori jasa grid + search bar
2. **Kategori** — Daftar jasa dalam kategori tertentu
3. **Search** — Pencarian jasa full-text
4. **Detail Jasa** — Info harga + pekerja tersedia
5. **Cari Pekerja** — Browse/search semua pekerja
6. **Detail Pekerja** — Profil, keahlian, review
7. **Riwayat Order** — Tab pelanggan/pekerja + status
8. **Detail Order** — Info lengkap + aksi status (konfirmasi/kerjakan/selesai/batal)

### Test Summary

```
flutter analyze  → No issues found!
flutter test     → 32/32 tests passed
```

- **Model tests (15):** UserModel, ChatModel, NotificationModel, JobModel (category, service, worker, order, review)
- **BLoC tests (13):** TreeBloc, ChatBloc, NotificationBloc
- **Widget tests (4):** Splash, basic widget rendering

---

## Akun Demo (Setelah Seed)

| Role | Email | Password |
|------|-------|----------|
| Admin | admin@digsan.id | Admin123! |
| User | user@digsan.id | User123! |

> **Catatan:** Akun demo hanya tersedia jika `pnpm db:seed` sudah dijalankan.
> Periksa file `apps/api/prisma/seed.ts` untuk detail data seed.
