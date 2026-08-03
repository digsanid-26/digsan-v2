# Catatan Hasil Update

Riwayat perubahan penting beserta alasan arsitekturnya, agar keputusan lama tidak terulang salah.

---

## 2026-08-03 — Sinkronisasi Data Antar Anggota Family Node

**Commit:** `82ad1ba` (didahului `006c14d`)

**Masalah yang dilaporkan:** Di `app.digsan.id/family/nama-keluarga`, sisi istri, suami, dan anak-anak punya slug serta halaman Family Node yang berbeda-beda, padahal seharusnya satu. Jumlah saudara juga salah — istri punya 6 saudara, suami ikut tampil 6 padahal sebenarnya 3.

### Akar Masalah

1. **Satu orang = satu pohon = satu slug.** Setiap `User` punya baris `FamilyTree` sendiri, dan `slug` menempel pada baris pohon **perorangan**, bukan pada grup keluarga. Tidak ada entitas "keluarga" yang dimiliki bersama.
2. **Halaman publik hanya proyeksi SATU baris pohon.** `getPublicFamily(slug)` mencari satu pohon lalu mengembalikan `layoutConfig` + `layoutMembers` milik pemilik itu saja. Pohon anggota lain tidak pernah dibaca — sebab "istri 6 saudara, suami jadi 6 juga".
3. **`sharedFamilySlug` hanya tambal sulam presentasi.** Sekali jalan, satu arah, terpicu manual, tanpa write-back, dan slug masih bisa lahir kembali via `ensureIdentity`.

---

## Yang Diubah

### Fase 1 — Cross-tree read

`apps/api/src/modules/tree/tree.service.ts` — `hydrateLinkedFamilyConfigs()` menelusuri setiap node dengan `linkedUserId`, membaca `layoutConfig` **pohon pribadi** user itu, lalu menyuntikkannya sebagai `familyConfig` per-node. Satu query batch, tidak per-node.

Di frontend `apps/web/src/app/family/[slug]/page.tsx`:

- Ortu pasangan kini memakai `spMember.familyConfig.parentCount`, bukan `cfg.parentCount` pemilik slug.
- Fallback `members['parent-0']` untuk paman/bibi pasangan **dihapus** — itu sumber salah-sisi keluarga.

**Hasil:** istri 6 saudara, suami 3 saudara, masing-masing tampil benar.

### Fase 2 — Slug tunggal

Model baru `FamilyNodeMember` dengan `@@unique([userId])` — **seseorang hanya bisa jadi anggota satu Family Node**. Inilah penegak struktural "satu keluarga = satu slug".

Empat jalur pencetak slug diberi penjagaan keanggotaan:

- `ensureIdentity` — anggota node lain memakai slug anchor, dan slug duplikat miliknya **dipensiunkan** otomatis.
- `recoverSlugs` — melewati pohon anggota node lain.
- Fallback 2 `getPublicFamily` — sama.
- `isTreeMember` — mengenali `FamilyNodeMember` sebagai akses sah.

### Fase 3 — Write-back terarah

`saveFamilyNodeSlice()` + `PUT /trees/family-node/slice`. `collectOwnSlice()` menghitung node yang boleh diedit (node sendiri + seluruh turunannya, iteratif sampai dalam). Node di luar irisan → `403` dengan daftar yang ditolak. Kepala keluarga bebas mengedit semuanya.

### Fase 4 — Hapus duplikasi

`syncLinkedUser` **tidak lagi menyalin** snapshot `layoutMembers` ke pohon anggota. Sekarang hanya mencatat relasi lewat `joinFamilyNode()`; data diresolusi saat baca. Ini menutup sumber data basi yang bikin sisi suami dan istri berbeda isi.

---

## Pembagian Sumber Kebenaran

Prinsip yang harus dipegang ke depan:

| Data | Sumber kebenaran |
|---|---|
| Inti keluarga (suami/istri/anak) | Pohon anchor (pemegang slug) |
| Silsilah ke atas tiap orang (ortu, saudara, simbah) | Pohon pribadi orang itu |
| Identitas & foto | Akun `User` |

**Aturan emas:** *derive, jangan simpan.* Jangan pernah menyalin `layoutMembers` antar pohon — selalu resolve saat baca.

---

## Langkah Deploy — Wajib Berurutan

```bash
cd ~/digsan-v2
git pull origin master

# 1. Migrasi tabel family_node_members
cd apps/api
npx prisma migrate deploy --schema prisma/schema.prisma

# 2. Build & restart
cd ~/digsan-v2
pnpm --filter @digsan/api build
pnpm --filter @digsan/web build
pm2 restart digsan-api digsan-web
```

**3. Jalankan backfill sekali** (login sebagai super user):

```
POST /api/trees/backfill-family-nodes
```

Backfill berjalan tiga tahap: anggota tertaut → penanda `sharedFamilySlug` lama → sisanya jadi kepala node sendiri. Mengembalikan `{ linked, heads, slugsRetired }`.

**Penting:** halaman publik keluarga baru menyatu setelah backfill dijalankan. Sebelum itu, slug lama masih terpisah.

---

## Berkas Terdampak

- `apps/api/prisma/schema.prisma` — model `FamilyNodeMember`, relasi di `User` & `FamilyTree`
- `apps/api/prisma/migrations/20260803000000_family_node_member/migration.sql`
- `apps/api/src/modules/tree/tree.service.ts`
- `apps/api/src/modules/tree/tree.controller.ts`
- `apps/api/src/modules/tree/dto/family-node-slice.dto.ts`
- `apps/web/src/lib/tree.ts` — tipe `FamilyNodeMembership`, metode `saveFamilyNodeSlice`, `leaveFamilyNode`, `backfillFamilyNodes`
- `apps/web/src/app/components/treeTypes.ts` — `parentCount` pada `NodeFamilyConfig`
- `apps/web/src/app/family/[slug]/page.tsx`

## Endpoint Baru

| Method | Path | Keterangan |
|---|---|---|
| `PUT` | `/trees/family-node/slice` | Anggota menulis irisan miliknya di pohon anchor |
| `DELETE` | `/trees/family-node/membership` | Keluar dari Family Node (dapat halaman sendiri lagi) |
| `POST` | `/trees/backfill-family-nodes` | Backfill keanggotaan dari data lama (super user) |

---

## Yang Belum Dikerjakan

UI di `/tree` belum memakai `treeApi.saveFamilyNodeSlice()` — endpoint dan tipe `familyNode` pada respons `getLayout` sudah siap, tapi `TreeExplorer` masih menyimpan ke `PUT /trees/layout` (pohon pribadi). Untuk anggota non-kepala yang ingin mengedit Family Node bersama langsung dari `/tree`, penyambungan UI itu perlu satu langkah lanjutan.

---

## 2026-08-03 — Perbaikan Pendahulu: Jumlah Saudara Pasangan

**Commit:** `006c14d`

- `apps/web/src/app/family/[slug]/page.tsx` — fallback jumlah saudara pasangan diubah dari `cfg.olderCount`/`cfg.youngerCount` (milik `self`) menjadi `0`.
- `apps/web/src/app/components/TreeExplorer.tsx` — bagian "Atur Keluarga" kini juga muncul untuk node `spouse`, tidak hanya `parent`. Pemilik pohon dapat mengatur jumlah kakak/adik pasangan tanpa perlu izin; UI persetujuan disembunyikan untuk kasus pasangan.
