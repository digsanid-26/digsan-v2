# Gamification Rules — Dokumentasi

Dokumentasi ini menjelaskan semua **Rule Key** (slug unik) yang tersedia di sistem gamification DigSan, status keterhubungan dengan backend, dan cara menambahkan rule baru.

## Cara Kerja Sistem

### Alur Distribusi Poin

1. **Event terjadi** di aplikasi (user login, verifikasi email, menambah jaringan, dll)
2. **Backend memanggil** `gamificationService.awardByRule(userId, ruleKey, reason, metadata)` atau method spesifik seperti `awardLoginPoints(userId)`
3. **Sistem mencari** `GamiRule` di database dengan `key` yang cocok
4. Jika ditemukan dan `isEnabled = true` serta `amount > 0`, **poin diberikan** sesuai `amount` dan `pointType` dari rule
5. Jika rule tidak ditemukan di DB, sistem menggunakan **fallback default** (hardcoded)
6. Admin dapat **mengubah jumlah poin, tipe poin, dan menonaktifkan** rule tanpa mengubah kode

### Tipe Poin

| Tipe | Deskripsi |
|------|-----------|
| `aktivitas` | Keaktifan dalam aplikasi, kegiatan online/offline, mengisi/mengupdate konten |
| `pengabdian` | Pengabdian dalam menyelesaikan task, mengembangkan jaringan/koneksi keluarga |
| `produktivitas` | Kegiatan ekonomis, keanggotaan, wadah usaha/program bersama |
| `general` | Poin umum dari sistem yang bisa didistribusikan ke tipe poin lain |

---

## Rule Keys — Sudah Terhubung (Wired)

Rule-rule berikut sudah otomatis berjalan saat event terjadi. Admin cukup mengatur jumlah poin dan status aktif/nonaktif.

### `daily_login`
- **Label:** Login Harian
- **Trigger:** User login (email/password atau Google OAuth)
- **Tipe Poin:** `aktivitas`
- **Default:** 2 poin
- **File:** `auth.service.ts` → `awardLoginPoints()`
- **Catatan:** Cek duplikasi per hari — hanya diberikan sekali per hari

### `streak_5_day`
- **Label:** Bonus 5 Hari Berturut
- **Trigger:** Otomatis dicek saat login, jika streak ≥ 5 hari
- **Tipe Poin:** `aktivitas`
- **Default:** Bonus 10 poin
- **Streak Days:** 5
- **File:** `gamification.service.ts` → `awardLoginPoints()` (internal check)
- **Catatan:** Bonus diberikan sekali per siklus 5 hari

### `streak_30_day`
- **Label:** Bonus 30 Hari Berturut
- **Trigger:** Otomatis dicek saat login, jika streak ≥ 30 hari
- **Tipe Poin:** `aktivitas`
- **Default:** Bonus 50 poin
- **Streak Days:** 30
- **File:** `gamification.service.ts` → `awardLoginPoints()` (internal check)
- **Catatan:** Bonus diberikan sekali per siklus 30 hari. **Perlu ditambahkan ke DB secara manual atau seed.**

### `network_add`
- **Label:** Penambahan Jaringan
- **Trigger:** User menghubungkan/meng-link anggota keluarga ke tree-nya
- **Tipe Poin:** `pengabdian`
- **Default:** 5 poin
- **File:** `tree.service.ts` → `syncLinkedUser()` → `awardNetworkAddPoints()`
- **Catatan:** Poin diberikan ke **inviter** (pemilik tree), bukan ke user yang di-link

### `new_account`
- **Label:** Akun Baru Aktif
- **Trigger:** User verifikasi email atau daftar via Google OAuth
- **Tipe Poin:** `general`
- **Default:** 100 poin
- **File:** `auth.service.ts` → `verifyEmail()` dan `googleAuthCallback()` → `awardRegistrationPoints()`
- **Catatan:** Hanya diberikan saat akun menjadi ACTIVE untuk pertama kali

---

## Rule Keys — Belum Terhubung (Not Wired)

Rule-rule berikut tersedia di dropdown admin tetapi **belum otomatis berjalan**. Untuk mengaktifkan, perlu menambahkan kode backend yang memanggil `awardByRule()` saat event tersebut terjadi.

### `profile_complete`
- **Label:** Profil Lengkap
- **Deskripsi:** Melengkapi data profil (foto, bio, telepon)
- **Tipe Poin:** `aktivitas`
- **Default:** 5 poin
- **Saran Implementasi:** Panggil saat user update profil dan semua field terisi
- **File Target:** `user.service.ts` atau `auth.service.ts` di method `updateProfile()`

### `tree_created`
- **Label:** Membuat Family Tree
- **Deskripsi:** Membuat pohon keluarga baru
- **Tipe Poin:** `produktivitas`
- **Default:** 10 poin
- **Saran Implementasi:** Panggil saat `treeService.create()` berhasil
- **File Target:** `tree.service.ts` → `create()` method

### `family_node_created`
- **Label:** Membuat Family Node
- **Deskripsi:** Mengatur family node (profil keluarga)
- **Tipe Poin:** `produktivitas`
- **Default:** 15 poin
- **Saran Implementasi:** Panggil saat user pertama kali mengisi family node (name, coverImage, dll)
- **File Target:** `tree.service.ts` → `update()` method (cek jika sebelumnya kosong)

### `post_created`
- **Label:** Membuat Postingan
- **Deskripsi:** Membuat cerita/status/postingan
- **Tipe Poin:** `aktivitas`
- **Default:** 3 poin
- **Saran Implementasi:** Panggil saat user membuat post baru
- **File Target:** `post.service.ts` (belum ada — buat saat fitur post tersedia)

### `referral`
- **Label:** Referral
- **Deskripsi:** Mengajak orang lain mendaftar melalui referral
- **Tipe Poin:** `pengabdian`
- **Default:** 30 poin
- **Saran Implementasi:** Panggil saat user yang direferensikan verifikasi email
- **File Target:** `auth.service.ts` → `verifyEmail()` (cek jika ada referrer di metadata)

---

## Cara Menambahkan Rule Baru

### 1. Tambahkan ke Dropdown Frontend

Edit `apps/web/src/app/(dashboard)/admin/gamification/page.tsx`, tambahkan entry ke `RULE_KEY_PRESETS`:

```typescript
{
  key: 'nama_rule_baru',
  label: 'Label Rule Baru',
  description: 'Deskripsi rule',
  pointType: 'aktivitas',
  defaultAmount: 5,
  streakDays: null,
  bonusAmount: null,
  wired: false, // true jika sudah ada kode backend yang trigger
},
```

### 2. Tambahkan Fallback Default (opsional)

Edit `apps/api/src/modules/gamification/gamification.service.ts`, tambahkan ke `fallbacks` di method `awardByRule()`:

```typescript
const fallbacks: Record<string, { amount: number; type: string }> = {
  // ... existing
  nama_rule_baru: { amount: 5, type: 'aktivitas' },
};
```

### 3. Wire ke Backend Event

Di service yang sesuai, panggil:

```typescript
this.gamification.awardByRule(userId, 'nama_rule_baru', 'Alasan poin', { metadata: 'value' });
```

Pastikan service tersebut mengimport `GamificationModule` di module-nya.

### 4. Update Dokumentasi

Tambahkan entry baru ke file ini di section yang sesuai (Wired atau Not Wired).

### 5. Seed ke Database (opsional)

Tambahkan ke `apps/api/prisma/seed.ts` agar rule otomatis tersedia saat deploy baru:

```typescript
{
  key: 'nama_rule_baru',
  label: 'Label Rule Baru',
  description: 'Deskripsi rule',
  pointType: 'aktivitas',
  amount: 5,
  isEnabled: true,
},
```

---

## Admin: Mengelola Rule

1. Buka **Admin → Gamification → Role Poin**
2. Klik **Tambah Role** untuk membuat rule baru
3. Pilih **Key** dari dropdown (otomatis mengisi label, deskripsi, tipe poin, dan jumlah default)
4. Sesuaikan **jumlah poin**, **tipe poin**, dan **status aktif**
5. Klik **Simpan**

Untuk rule yang sudah ada, klik **Edit** untuk mengubah jumlah atau menonaktifkan.

### Indikator Status di Dropdown

- **✓ Rule ini sudah terhubung ke sistem** — rule akan otomatis berjalan saat event terjadi
- **⚠ Rule ini belum terhubung ke sistem** — rule ada di DB tetapi tidak akan otomatis trigger

---

## Struktur Database

```
GamiRule {
  id          String   @id
  key         String   @unique   // slug unik, contoh: 'daily_login'
  label       String             // label tampilan
  description String?
  pointType   String             // tipe poin: aktivitas, pengabdian, produktivitas, general
  amount      Int                // jumlah poin
  isEnabled   Boolean            // aktif/nonaktif
  streakDays  Int?               // untuk bonus streak (opsional)
  bonusAmount Int?               // jumlah bonus streak (opsional)
}
```

---

## File Relevan

| File | Fungsi |
|------|--------|
| `apps/api/src/modules/gamification/gamification.service.ts` | Core logic: `awardByRule()`, `awardLoginPoints()`, `awardNetworkAddPoints()`, dll |
| `apps/api/src/modules/gamification/gamification.module.ts` | Module export |
| `apps/api/src/modules/admin/gamification-admin.service.ts` | Admin CRUD untuk rules |
| `apps/api/src/modules/admin/gamification-admin.controller.ts` | Admin API endpoints |
| `apps/web/src/app/(dashboard)/admin/gamification/page.tsx` | Admin UI + `RULE_KEY_PRESETS` |
| `apps/api/prisma/seed.ts` | Seed data untuk rules |
| `apps/api/prisma/schema.prisma` | Model `GamiRule` |
