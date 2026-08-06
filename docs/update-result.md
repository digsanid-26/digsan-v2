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

~~UI di `/tree` belum memakai `treeApi.saveFamilyNodeSlice()`~~ — **sudah dikerjakan**, lihat bagian *Penyambungan UI `/tree` ke Family Node Slice* di bawah.

---

## 2026-08-03 — Perbaikan Pendahulu: Jumlah Saudara Pasangan

**Commit:** `006c14d`

- `apps/web/src/app/family/[slug]/page.tsx` — fallback jumlah saudara pasangan diubah dari `cfg.olderCount`/`cfg.youngerCount` (milik `self`) menjadi `0`.
- `apps/web/src/app/components/TreeExplorer.tsx` — bagian "Atur Keluarga" kini juga muncul untuk node `spouse`, tidak hanya `parent`. Pemilik pohon dapat mengatur jumlah kakak/adik pasangan tanpa perlu izin; UI persetujuan disembunyikan untuk kasus pasangan.

---

## 2026-08-03 — Klik Arrow untuk Buka/Tutup Cabang (Ganti Hover) — **DIBATALKAN**

> **Status: dibatalkan.** Alur navigasinya terasa tidak mengalir, sehingga dikembalikan ke mode hover. Lihat *Kembali ke Mode Hover + Perbaikan Lingkaran Bertumpuk* di bawah. Bagian ini disimpan sebagai catatan sejarah agar pendekatan yang sama tidak diulang tanpa alasan baru.

**Masalah:** Sistem hover untuk membuka cabang (ortu/saudara/paman) rentan tumpang tindih dan tidak intuitif. User harus meng-hover node untuk melihat cabang samar, lalu klik untuk membuka. Tidak ada kontrol yang jelas untuk menutup.

### Solusi

Mengganti sistem hover dengan **klik arrow berarah** pada node. Arrow kecil muncul di sisi node yang menunjukkan arah cabang yang bisa dibuka (misal arrow ke atas untuk ortu, arrow ke kiri untuk saudara di sisi self). Klik arrow membuka cabang; arrow berbalik arah untuk menutup.

### Yang Diubah

#### `apps/web/src/app/family/[slug]/page.tsx`

- **Dihapus:** State `hoverTarget`, `hoverLevel`, `expandedGroup`, `expandedParent`, `fadeTimerRef`, fungsi `onNodeHover`, dan seluruh mesin state hover.
- **Ditambah:** State `openBranches` (Set berisi key `"nodeId:branch"`) dan `lockedNode` (node yang sedang memiliki cabang terbuka, memblokir node lain).
- **Ditambah:** `toggleBranch(nodeId, branch)` — buka/tutup cabang dengan locking logic (hanya satu node yang boleh punya cabang terbuka dalam satu waktu).
- **Ditambah:** `openBranchTags` memo — menerjemahkan `openBranches` menjadi set tag yang terlihat.
- **Ditulis ulang:** Memo `displayNodes`/`displayLines` — ekspansi Ortu→Ayah/Ibu dan Saudara→lingkaran individu kini didasarkan pada `openBranches`, bukan `expandedParent`/`expandedGroup`.
- **Ditulis ulang:** Memo opacity — menggunakan `openBranchTags` (biner 0/1, tanpa tingkat fade).
- **Disederhanakan:** `onNodeClick` — tanpa fade timer atau toggle Ortu; langsung buka modal untuk node individu.
- **Dihapus:** Helper functions yang tidak terpakai (`getParentTag`, `getGrandparentTag`, `getUncleTag`, `getSiblingTagFromIndividual`) dan import `useRef`.
- **Split uncle tags:** `self-uncles` dipecah menjadi `self-uncles-ayah` + `self-uncles-ibu` (demikian juga untuk spouse), agar cabang paman dari sisi ayah dan ibu bisa dibuka/tutup secara independen.

#### `apps/web/src/app/components/PublicTreeCanvas.tsx`

- **Dihapus:** Props `onNodeHover` dan `hoveredNodeId`, handler `onMouseEnter`/`onMouseLeave`, dan overlay "Buka".
- **Ditambah:** Props `onArrowClick`, `openBranches`, `isOtherNodeLocked`.
- **Ditambah:** Rendering arrow button untuk:
  - **Node self/spouse:** arrow untuk `ortu` (atas), `saudara` (kiri untuk self, kanan untuk spouse), `paman-ayah` (atas-kiri), `paman-ibu` (atas-kanan).
  - **Node Ortu:** arrow atas/bawah untuk ekspansi menjadi Ayah/Ibu.
  - **Node grup Saudara:** arrow kiri/kanan untuk ekspansi menjadi lingkaran individu.
  - **Node grup Paman/Bibi:** arrow kiri/kanan untuk ekspansi.
- Arrow berbalik arah saat cabang terbuka (menunjuk balik = tutup).
- Arrow dinonaktifkan (redup + cursor `not-allowed`) saat node lain sedang locked.
- Klik background menutup semua cabang.

---

## 2026-08-03 — Penyambungan UI `/tree` ke Family Node Slice

**Menutup:** butir "Yang Belum Dikerjakan" pada catatan *Sinkronisasi Data Antar Anggota Family Node*.

**Masalah:** Endpoint `PUT /trees/family-node/slice` dan field `familyNode` pada respons `getLayout` sudah ada sejak fase 3, tapi `TreeExplorer` selalu menyimpan lewat `PUT /trees/layout` — yaitu **pohon pribadi**, bukan pohon anchor. Akibatnya anggota non-kepala yang mengedit dari `/tree` tidak pernah menulis ke halaman Family Node bersama.

### Yang Diubah — `apps/web/src/app/components/TreeExplorer.tsx`

**State baru:**
- `familyNode: FamilyNodeMembership | null` — diisi dari `remote.familyNode` saat `getLayout()`. Berisi `nodeId`, `role`, `slug`, dan `isHead`.
- `saveError: string | null` — menampung pesan penolakan dari server.

**Pemisahan jalur simpan di `pushLayout`:**

| Yang disimpan | Kepala node / tanpa keanggotaan | Anggota non-kepala |
|---|---|---|
| `config` (silsilah pribadi) | `PUT /trees/layout` | `PUT /trees/layout` — tetap pohon pribadi |
| `members` (lingkaran di halaman bersama) | `PUT /trees/layout` | `PUT /trees/family-node/slice` |

Alasan `config` tetap ke pohon pribadi: itu silsilah ke atas milik orang itu sendiri, dan sudah diresolusi lintas pohon oleh `hydrateLinkedFamilyConfigs()` saat halaman publik dibaca. Konsisten dengan tabel *Pembagian Sumber Kebenaran*.

**Parameter `changedIds` pada `saveMembers`:**

Endpoint slice memakai semantik **patch** dan menolak (`403`) node di luar irisan pemanggil. Mengirim seluruh objek `members` otomatis kena tolak. Karena itu `saveMembers(m, changedIds?)` kini menerima daftar node id yang benar-benar disentuh, lalu `pushLayout` menyusun patch hanya dari id tersebut.

Pemanggil yang meneruskan `changedIds`:

- `addRelative` arah `bottom` → `[id]` (anak baru)
- `addRelative` arah `left`/`right` → `[id]` (kakak/adik baru)
- `addRelative` arah `top` → `[id, n.id]` (ortu baru + pointer `parentId` anaknya)
- `MemberForm.onSave` → `[selected.id]`

**Sengaja tidak lewat slice:** `deleteNode` tidak meneruskan `changedIds` sehingga jatuh ke `saveLayout`. Patch bersifat *merge*, jadi tidak bisa menghapus kunci; selain itu tombol hapus sudah dibatasi super user (`canDelete={isSuperUser && ...}`).

**Penanganan `403`:** pesan asli dari server (berisi daftar node yang ditolak) ditampilkan di banner merah top-center yang bisa ditutup. Error non-403 memakai pesan generik dan data lokal tetap dipertahankan.

### Catatan untuk Ke Depan

Kalau nanti ada aksi simpan baru yang menyentuh `members`, **wajib** meneruskan `changedIds` — kalau tidak, anggota non-kepala akan diam-diam menulis ke pohon pribadinya, bukan ke Family Node bersama.

---

## 2026-08-04 — Kembali ke Mode Hover + Perbaikan Lingkaran Bertumpuk

**Membatalkan:** commit `3010e80` dan `fb0a980` (sistem klik arrow).

Mode hover dikembalikan dengan `git checkout c4da4c4 --` pada dua file: `apps/web/src/app/family/[slug]/page.tsx` dan `apps/web/src/app/components/PublicTreeCanvas.tsx`. Pekerjaan Family Node slice (`9e61770`) tidak tersentuh karena berada di file lain.

Lalu kekurangan yang jadi alasan awal pindah ke arrow — **lingkaran antar tree bertumpuk** — diperbaiki di akarnya.

### Akar Masalah

Setiap cabang silsilah digambar pada **offset absolut** dari kolom pemiliknya:

| Cabang | Offset dari kolom pemilik |
|---|---|
| Paman/Bibi | 180 px ke samping |
| Saudara | 180 px ke samping |
| Ayah↔Ibu (saat Ortu dibuka) | ±65 px |

Tapi jarak pasangan dikunci konstan: `spreadX(1 + spouseCount, 160, 0)` → suami dan istri hanya **160 px** terpisah. Karena 180 > 160, cabang satu pihak otomatis masuk ke wilayah pihak lain. Ini bukan kasus tepi — ia **selalu** terjadi begitu kedua pihak punya silsilah.

Terbukti secara numerik pada geometri lama (gap 160), tepat tiga tabrakan:

```
OVERLAP selfAyah      x spPamanAyah   dist 45.0  need 70
OVERLAP selfIbu       x spAyah        dist 30.0  need 74
OVERLAP spIbu         x selfPamanIbu  dist 45.0  need 70
```

Persis dua gejala yang dilaporkan: paman/bibi menimpa ortu pihak lain, dan Ayah pihak satu menimpa Ibu pihak lain.

### Solusi — Jarak Pasangan Dihitung, Bukan Dikunci

Ganti gap konstan dengan pengukuran **envelope horizontal** tiap pihak, lalu tempatkan kolom agar envelope tidak pernah bersentuhan.

`envelopeOf(person)` menghitung jangkauan kiri dan kanan seseorang dari cabang yang benar-benar dimilikinya:

- Lebar Ayah/Ibu **selalu dicadangkan** meski Ortu masih tertutup — membuka Ortu jadi tidak memakan ruang tambahan, sehingga tree tidak bergeser atau tabrakan saat diklik.
- Saudara: `self` mengarah kiri, pasangan mengarah kanan (menjauhi tengah).
- Paman/Bibi ayah ke kiri, ibu ke kanan.
- Semua digerbangi `parentCount > 0`, sama seperti kondisi render aslinya, supaya tidak mencadangkan ruang untuk cabang yang tidak ada.

Penempatan lalu berurutan:

```
gap = max(MIN_COUPLE_GAP, envelope[i-1].right + COUPLE_CLEARANCE + envelope[i].left)
```

Hasilnya diketengahkan pada x = 0 termasuk envelope-nya, jadi kanvas tetap seimbang.

### Konstanta Dijadikan Satu Sumber

`UNCLE_OFFSET`, `SIB_OFFSET`, `PARENT_SPACING`, `COUPLE_CLEARANCE`, `MIN_COUPLE_GAP`, dan `radiusOf()` dipindah ke level modul. Sebelumnya nilai 180 dan 130 ditulis ulang di enam tempat sebagai `const` lokal. **Duplikasi itulah yang membuat bug ini mungkin** — jarak pasangan tidak tahu-menahu soal offset cabang. Sekarang layout dan matematika jarak membaca angka yang sama, jadi tidak bisa lepas sinkron.

Radius diambil dari `STYLE` di `treeStyle.ts`, bukan ditebak, supaya ukuran lingkaran dan perhitungan tabrakan selalu konsisten.

### Hasil

Untuk kasus terberat (kedua pihak punya ortu + saudara + paman/bibi dua sisi), gap pasangan jadi **458 px** dan pemeriksaan seluruh 12 lingkaran cabang melaporkan **nol tumpang tindih**.

Pasangan tanpa silsilah tetap `MIN_COUPLE_GAP` = 160 px seperti sebelumnya — tidak ada regresi untuk tree sederhana.

### Konsekuensi yang Perlu Disadari

Garis pernikahan jadi lebih panjang saat kedua pihak punya silsilah lengkap. Ini **tidak bisa dihindari**: dua kipas cabang selebar 180 px mustahil ditampung di antara dua lingkaran yang hanya 160 px terpisah. Kalau tampilan lebih rapat lebih diutamakan, opsinya adalah mengarahkan **kedua** grup paman/bibi ke sisi luar masing-masing pihak (gap turun ke ~236 px), tapi itu mengorbankan makna "paman dari ayah di kiri ayah, dari ibu di kanan ibu" yang dibangun di `c4da4c4`.

### Belum Diverifikasi

Perubahan sudah lolos `npx tsc --noEmit --incremental false` dan pemeriksaan geometri numerik, tapi **belum dilihat di browser**. Tampilan visual pada data nyata perlu dicek manual.

**Catatan alat:** `npx tsc --noEmit` tanpa `--incremental false` **tidak bisa dipercaya** di repo ini — `tsconfig.json` memakai `"incremental": true`, dan cache `.tsbuildinfo` pernah melaporkan sukses pada kode yang sebenarnya gagal di build produksi.

---

## 2026-08-04 — Perbaikan Nama & Foto Anggota di Halaman Publik

**Commit:** `631ac71`

**Masalah:** Nama lengkap/nama publik dan foto Ayah, Ibu, Saudara, maupun Paman/Bibi tidak muncul di halaman publik keluarga — masih menampilkan label bawaan ("Ayah", "Adik 1", dll.) tanpa foto.

### Akar Masalah

Lingkaran yang dirender di halaman publik memakai **ID layout-specific** (`self-ortu-parent-0`, `sib-self-saudara-2`, `unc-self-paman-ayah-1`), tapi `resolve()` mencari data anggota dengan ID tersebut di `members[id]`. Editor pohon menyimpan record anggota dengan **ID kanonis** (`parent-0`, `older-2`, `unclePo-1`). Karena tidak pernah cocok, `members[id]` selalu `undefined` → fallback ke label generik.

Selain itu, tampilan Familymember (mode "Keluarga Besar") memakai kunci `kakak-${i}` / `adik-${i}` yang tidak ada — seharusnya `older-${i}` / `younger-${i}`.

### Solusi

1. **Fungsi `memberKeyFor(id)`** ditambahkan di `apps/web/src/app/family/[slug]/page.tsx`. Menerjemahkan setiap ID lingkaran yang diperluas kembali ke kunci kanonis:
   - `self-ortu-parent-N` → `parent-N`
   - `sib-self-saudara-N` → `older-N` atau `younger-N` (berdasarkan split older/younger)
   - `unc-self-paman-ayah-N` → `unclePo-N` atau `unclePy-N`
   - `self-simbah-P-parent-N` → `gpP-N` (jalur ayah), `gpM-N` (jalur ibu)
   - Pola yang sama untuk sisi pasangan (`spouse-N-...`)
2. **`resolve()`** kini memanggil `members[memberKeyFor(id)]` bukan `members[id]`.
3. **`selectedMember`** (untuk modal detail) juga dirutekan melalui `memberKeyFor` — sebelumnya `verified` / `linkedUserId` / early-access salah untuk setiap lingkaran yang diperluas.
4. **Familymember view:** `kakak-${i}` → `older-${i}`, `adik-${i}` → `younger-${i}`.
5. **Label fallback saudara** diperbaiki dari generik `Saudara N` menjadi `Kakak N` / `Adik N` sesuai urutan older/younger.

### Keterbatasan Tersisa

Silsilah pasangan (selain node `spouse-N` itu sendiri) tidak di-hydrate lintas-pohon di API. `hydrateLinkedFamilyConfigs` hanya memproyeksikan *counts* ke node `spouse-N`, bukan anggota individual pasangan. Jadi ortu/saudara/simbah dari sisi pasangan tetap memakai label fallback tanpa foto, kecuali jika data tersebut eksplisit ditambahkan ke `layoutMembers` pemilik pohon.

---

## 2026-08-04 — Redesain Simbah & Paman/Bibi: Hitungan Gabungan, Ekspansi Dua Tahap, Paman Sejajar Ortu

**Commit:** `5f257a1`

**Masalah yang dilaporkan:**
1. Lingkaran Simbah belum menunjukkan jumlah total (gabungan jalur ayah + ibu).
2. Hover Simbah belum memunculkan label "Buka" maupun jalur Paman/Bibi.
3. Klik Simbah langsung memunculkan Simbah Kakung + Putri, tanpa memisahkan jalur ayah/ibu terlebih dahulu.
4. Posisi Paman/Bibi terlalu jauh di atas — seharusnya satu baris horizontal dengan Ayah/Ibu.

### Solusi

**1. Simbah sebagai grup berhitungan gabungan.** Lingkaran `self-simbah` kini berperan sebagai group bubble dengan nama `Simbah {simbahP + simbahM}` di `y=-420`, ditandai `expandable: true`. Overlay "Buka" di `PublicTreeCanvas` digeneralisasi untuk semua node `expandable` (sebelumnya hanya `Ortu` dan `Saudara`).

**2. Ekspansi Simbah dua tahap.**
- **Tahap 1:** Klik Simbah utama → pecah menjadi `Simbah Ayah {simbahP}` dan `Simbah Ibu {simbahM}`, masing-masing tepat di atas kolom Ayah (`x - PARENT_SPACING/2`) dan Ibu (`x + PARENT_SPACING/2`) di `y=-420`. Jenis ekspansi baru: `grandparent`.
- **Tahap 2:** Klik salah satu → pecah lagi menjadi `Simbah Kakung` + `Simbah Putri` (atau satu lingkaran jika count=1). Jenis ekspansi: `grandparent-side`. Kedua tahap dilacak di `expansionStack` LIFO.

**3. Paman/Bibi sejajar orang tua.** Group bubble Paman/Bibi dipindah dari `y=-420` ke `y=-210` (sama seperti Ayah/Ibu). Garis koneksi bercabang dari titik tengah (`y=-315`) antara orang tua dan Simbah — yaitu pertengahan garis vertikal Ayah→Simbah atau Ibu→Simbah. Paman ayah di kiri (`x - UNCLE_OFFSET`), paman ibu di kanan (`x + UNCLE_OFFSET`).

**4. Hover Paman/Bibi spesifik per sisi.** Tag paman dipecah: `self-uncles-P` (jalur ayah) dan `self-uncles-M` (jalur ibu), demikian juga untuk pasangan. Uncles **tidak lagi** terungkap saat hover Ortu atau Simbah utama — hanya saat hover `Simbah Ayah` atau `Simbah Ibu` yang bersangkutan, via helper baru `getUncleTagForSimbahSide()`.

**5. `memberKeyFor` diperbarui** untuk ID baru: `self-simbah-P-parent-N` → `gpP-N`, `self-simbah-M-parent-N` → `gpM-N`.

**6. Konstanta baru:** `GP_SPACING = 110` untuk jarak Kakung↔Putri saat Simbah sisi diekspansi.

### Berkas Terdampak

- `apps/web/src/app/components/treeTypes.ts` — `expandable?: boolean` pada `TNode`.
- `apps/web/src/app/components/PublicTreeCanvas.tsx` — overlay "Buka" digeneralisasi.
- `apps/web/src/app/family/[slug]/page.tsx` — logika layout, ekspansi, hover, klik, `memberKeyFor`, `closeButtons`, helper tag.

### Konsekuensi yang Perlu Disadari

- `GP_SPACING` (110) < `PARENT_SPACING` (130), jadi hanya satu sisi Simbah yang bisa diekspansi pada satu waktu tanpa risiko tumpang tindih. Jika kedua sisi dibuka bersamaan, perlu melebar.
- Spouse-side Simbah masih memakai `cfg.simbahP + cfg.simbahM` dari pemilik slug, bukan dari pohon pribadi pasangan — sama seperti keterbatasan pada catatan sebelumnya.
