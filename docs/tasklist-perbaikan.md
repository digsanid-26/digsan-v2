# Tasklist Perbaikan — Tumpang Tindih Wewenang & Duplikasi Data Silsilah

> Cakupan scan: `apps/api/prisma/schema.prisma`, `apps/api/src/modules/tree/tree.service.ts` (3.443 baris),
> `tree.controller.ts`, `auth.service.ts` (impersonasi early access), `apps/web/src/lib/tree.ts`,
> `apps/web/src/app/components/TreeExplorer.tsx`, `apps/web/src/app/family/[slug]/page.tsx`.
>
> Referensi baris mengacu ke kode saat dokumen ini ditulis.

---

## 0. Ringkasan Eksekutif

Akar masalahnya **bukan bug tunggal, tapi model data**. Saat ini:

1. **Tidak ada entitas "Orang" (Person) yang kanonik.** Satu manusia disimpan sebagai *salinan JSON* di
   setiap pohon yang menyebutnya (`FamilyTree.layoutMembers`). Kakak-beradik A & B yang saling menambahkan
   menghasilkan minimal 2 salinan A, 2 salinan B, dan 2 salinan masing-masing orang tua mereka.
2. **Hubungan dikodekan relatif terhadap pemilik pohon** lewat nama key (`older-0`, `parent-1`, `gpP-0`,
   `spouse-0-older-2`). Key seperti ini tidak bisa digabung lintas pohon karena maknanya berubah tergantung
   siapa "self"-nya.
3. **Wewenang ditentukan oleh "siapa pemilik blob JSON"**, bukan oleh "siapa pemilik identitas orang itu".
   Akibatnya pemilik pohon bisa menimpa data orang lain yang sudah punya akun, dan propagasi (nama keluarga,
   slug) menimpa pohon user lain.
4. **Ada tiga model paralel yang tidak sinkron**: tabel `FamilyMember` (dipakai `acceptInvitation`,
   `addMember`, `updateMember`), JSON `layoutMembers` (dipakai `/tree` dan halaman publik), dan
   `FamilyNodeMember` + marker legacy `layoutConfig.sharedFamilySlug`. Ketiganya di-dedupe pakai
   **nama lowercase** — rawan salah gabung.
5. **Peran `super_user` diberikan otomatis ke setiap pembuat pohon**, padahal `ensureTreeOwner` memakainya
   sebagai *bypass global* → setiap user bisa mengedit/menghapus pohon siapa pun.

Solusi komprehensif: **pindah ke model graf (Person + Relationship) dengan wewenang per-orang
(stewardship), relasi dua arah berbasis konfirmasi, deteksi & merge duplikat, dan pohon sebagai
"tampilan/perspektif"** — bukan wadah data. Tasklist di bawah dibagi menjadi:

- **Fase 0 — Hotfix keamanan & integritas (wajib, segera, tanpa ubah skema besar)**
- **Fase 1 — Fondasi model graf baru (dual-write)**
- **Fase 2 — Wewenang, konsensus, dan merge**
- **Fase 3 — Migrasi baca, pensiunkan model lama**
- **Fase 4 — Skalabilitas & observability**
- **Fase 5 — Kompleksitas keluarga nyata** (cerai, menikah ulang, poligami, ayah tidak diketahui, adopsi,
  anak asuh, nasab vs hukum vs sosial, tanggal tidak pasti, dll.)
- **Fase 6 — World Tree** (6A: dummy *Future Concept* dengan D3.js, bisa dikerjakan sekarang;
  6B: World Tree dengan data nyata)
- **Fase 7 — Arsitektur hybrid PostgreSQL + Graph DB (Neo4j / Apache AGE)** untuk pencarian hubungan
  super kompleks (mis. sepupu derajat ke-12)

---

## 1. Reproduksi Skenario A ⇄ B (Kakak-Beradik)

Kondisi awal: A punya pohon `TA` (slug `a-fam`), B punya pohon `TB` (slug `b-fam`). Keduanya otomatis
mendapat role `super_user` (`getOrCreateDefaultTree` → `assignSuperUserRole`, `tree.service.ts:347`).

| Langkah | Aksi | Yang terjadi di kode | Dampak |
|---|---|---|---|
| 1 | A membuat lingkaran `younger-0`, cari B, set `linkedUserId=B`, simpan | `saveLayout` (`:989`) menerima `linkedUserId` apa adanya dari klien, hanya kirim notifikasi "konfirmasi" — **link langsung berlaku tanpa persetujuan B** | B "terhubung" tanpa izin |
| 2 | A klik *sync* | `syncLinkedUser` (`:1088`) → `joinFamilyNode(TA, B)` (`:455`) → `FamilyNodeMember` B di-upsert ke TA, **slug `b-fam` di-null-kan** (`:476-478`), `TB.layoutConfig.sharedFamilySlug = a-fam` (`:1142`) | Halaman publik B **hilang**; B jadi "anggota" rumah tangga A |
| 3 | A simpan nama keluarga | `saveLayout` propagasi (`:1044-1072`): `TB.layoutConfig.mainFamilyName` **ditimpa** dengan nama keluarga A, `slug: null` | Identitas keluarga B (yang mungkin sudah menikah & punya rumah tangga sendiri) ditimpa |
| 4 | B membuat `older-0` link ke A, simpan & sync | `ensureIdentity(TB)` (`:656`) melihat B ter-anchor ke TA → `TB.slug` tetap null, `identity.slug = a-fam`. `joinFamilyNode(TB, A)` **ditolak diam-diam** karena A sudah head (`:462`). Tetapi `TA.layoutConfig.sharedFamilySlug = a-fam` → **pohon A menunjuk ke dirinya sendiri** (`:1142-1145`) | `getLayout` A menampilkan "terhubung ke keluarga" dirinya sendiri; hasil bergantung urutan siapa yang sync duluan (race) |
| 5 | B simpan nama keluarga | Propagasi balik menimpa `TA.mainFamilyName` dengan milik B | **Ping-pong**: nama keluarga = siapa yang terakhir simpan |
| 6 | Pengunjung buka `/family/a-fam` | `hydrateLinkedFamilyConfigs` (`:1269`) memproyeksikan leluhur B dari `TB` ke node `younger-0`: `younger-0-parent-0`, `younger-0-parent-1`, `younger-0-older-0` (`projectAncestryRecords`, `:1225`) | **Orang tua A & B tampil dua kali**, dan **A tampil sebagai kakak dirinya sendiri** (`younger-0-older-0` = A). Inilah "data tercampur dan dobel" |

Masalah inti: sistem tidak punya cara untuk tahu bahwa `TA.parent-0`, `TB.parent-0`,
`TA.younger-0-parent-0` adalah **orang yang sama**.

---

## 2. Katalog Temuan

Tingkat: 🔴 Kritis (keamanan/kehilangan data) · 🟠 Tinggi (data salah/duplikat) · 🟡 Sedang · ⚪ Teknis

### A. Wewenang & Keamanan

| # | Tingkat | Temuan | Lokasi |
|---|---|---|---|
| A1 | 🔴 | `ensureTreeOwner` mengizinkan **semua `super_user`** mengakses pohon mana pun. Karena role ini dibagikan otomatis ke setiap pembuat pohon, praktis **setiap user bisa update/hapus pohon orang lain, tambah/ubah member, kirim undangan atas nama pohon lain**. | `tree.service.ts:3363-3370`, `:347`, `:366`; dipakai di `update`, `remove`, `addMember`, `updateMember`, `removeMember`, `createInvitation`, `requestHubConnection`, `setSlugForTree`, `getFamilyNode` |
| A2 | 🔴 | `createEarlyAccess(treeId, memberId)` hanya cek role `super_user`, **tidak cek kepemilikan pohon** → bisa membuat akun & me-link member di pohon orang lain. | `:3064-3141` |
| A3 | 🔴 | `linkedUserId` dari klien diterima mentah di `saveLayout`. Kombinasi dengan `loginAsEarlyAccessNode` (cek hanya `tree.userId === caller` & target `EARLY_ACCESS`) → user X bisa menulis `linkedUserId` = akun early-access milik keluarga Y lalu **login sebagai akun itu (impersonasi)**. | `tree.service.ts:989-1041`, `auth.service.ts:627-660` |
| A4 | 🔴 | Link hubungan tanpa persetujuan pihak yang di-link (hanya notifikasi; tidak ada endpoint konfirmasi/tolak). `syncLinkedUser` langsung memindahkan membership & mematikan slug orang lain. | `:1007-1031`, `:1133` |
| A5 | 🔴 | Propagasi lintas pohon menimpa `mainFamilyName`, `sharedFamilySlug`, dan `slug` milik user lain. `saveLayout` & `setSlugForTree` **tidak punya guard `isFamilyNodeHead`** (hanya `setSlug` yang punya). | `:1044-1072`, `:957-979`, `:895-924` |
| A6 | 🟠 | Consent wali tidak konsisten: `requestConsent` memakai `nodeId` layout (`older-0`), `updateMember` mengecek consent dengan `nodeId = memberId` (id tabel). Jalur `saveLayout` **tidak pernah mengecek consent** sama sekali → pemilik pohon bebas mengedit node milik user aktif. | `:1866`, `:2079-2087`, `:989` |
| A7 | 🟠 | `saveFamilyNodeSlice` memberi bypass penuh ke `super_user`/admin (yang = semua pemilik pohon, lihat A1). | `:543-544` |
| A8 | 🟡 | `respondToClaim` tidak mengecek apakah claimant sudah ter-link di node lain pada pohon yang sama / pohon lain; tidak memanggil `joinFamilyNode` sehingga hasil klaim (field `claimedByUserId`) berbeda jalur dengan link (`linkedUserId`). Dua field untuk konsep yang sama. | `:1532-1566` |
| A9 | 🟡 | Endpoint admin `recover-slugs` & `backfill-family-nodes` dapat dipanggil oleh `super_user` (= semua pemilik pohon). | `tree.controller.ts:68-80` |

### B. Model Data & Duplikasi

| # | Tingkat | Temuan | Lokasi |
|---|---|---|---|
| B1 | 🔴 | Tidak ada entitas Person kanonik; satu orang = N salinan JSON di N pohon. Tidak ada kunci identitas untuk orang tanpa akun. | `schema.prisma:221-250` (`layoutMembers Json?`) |
| B2 | 🔴 | Hubungan ego-relatif lewat nama key (`older-0`, `spouse-0-older-2`). Tidak bisa direkonsiliasi lintas pohon. | `TreeExplorer.tsx:57-116`, `family/[slug]/page.tsx:132-238`, `tree.service.ts:1200` |
| B3 | 🟠 | `hydrateLinkedFamilyConfigs` memproyeksikan leluhur linked user tanpa dedupe → saudara kandung menggandakan orang tua; ego muncul sebagai saudara dirinya sendiri. | `:1225-1328` |
| B4 | 🟠 | Tiga model paralel (`FamilyMember` table, `layoutMembers` JSON, `FamilyNodeMember` + `sharedFamilySlug`) yang di-dedupe dengan **nama lowercase** → dua "Ahmad" berbeda digabung; satu orang dengan ejaan beda jadi dua. | `:276-283`, `:3343-3346`, `:2411-2425` |
| B5 | 🟠 | `FamilyNodeMember @@unique([userId])` → satu orang hanya bisa di **satu** rumah tangga. Padahal orang menikah adalah *anak* di keluarga asal **dan** *pasangan* di keluarga baru. Ini yang memaksa logika "siapa head, siapa retire slug". | `schema.prisma:273-274` |
| B6 | 🟠 | `joinFamilyNode` meng-upsert by `userId` → **membership "dicuri"**: jika C (bukan head) di-link oleh A lalu oleh B, C diam-diam pindah ke rumah tangga B. | `:469-473` |
| B7 | 🟠 | Satu `linkedUserId` bisa muncul di beberapa node dalam pohon yang sama (mis. `older-0` dan `child-1-spouse`) — tidak ada validasi unik. | `saveLayout`, `findLayoutNodeForUser :1778` |
| B8 | 🟡 | `syncLinkedUser` menyalin snapshot nama/foto/email ke node → basi saat user mengubah profil. Tidak ada single source of truth profil. | `:1105-1113` |
| B9 | 🟡 | Kode gender campur `'L'/'P'` vs `'male'/'female'`; statistik menghitung `'male'` saja. | `:3023-3024`, `:3307` |

### C. Alur Undangan / Koneksi (`syncConnectedTree`)

| # | Tingkat | Temuan | Lokasi |
|---|---|---|---|
| C1 | 🔴 | **Menimpa seluruh pohon penerima** (`layoutConfig` & `layoutMembers` diganti total) — data yang sudah dibangun penerima hilang. | `:2816-2823` |
| C2 | 🟠 | Key yang ditulis **tidak cocok** dengan konvensi frontend (0-indexed): pakai `spouse-1`, `child-1`, `parent-1`, `sibling-1`, `grandparent-p-1`, `child-1-spouse`, `older-1-spouse`. Frontend memakai `spouse-0`, `child-0`, `parent-0`, `gpP-0`. Data tidak ter-render / salah posisi. | `:2507-2807` vs `TreeExplorer.tsx:57-116` |
| C3 | 🟠 | Menulis `newMembers['olderCount']` (counter) sebagai **member**. | `:2543` |
| C4 | 🟠 | Menyalin objek member pengundang beserta `linkedUserId`-nya → duplikat link & salinan basi. | `:2528-2531`, `:2545`, `:2591` |
| C5 | 🟡 | Saudara selalu dipasang sebagai `older-1` tanpa melihat tanggal lahir; mapping `cucu`/`kakek-nenek`/default sangat minim. Semantik `relationship` ambigu (`'anak'` = penerima adalah anak?). | `:2715-2806`, `:2352-2363` |
| C6 | 🟡 | `requestFamilyConnection` menyimpan *jenis hubungan* di kolom `nodeId` (overloading). | `:2344` |

### D. Konsistensi, Konkurensi, Performa

| # | Tingkat | Temuan | Lokasi |
|---|---|---|---|
| D1 | 🟠 | `saveLayout` menimpa seluruh blob (last-write-wins). Edit "slice" dari anggota hilang saat head menyimpan dengan salinan lama. Tidak ada versi/optimistic locking. | `:1035-1041`, `:555-563` |
| D2 | 🟠 | Endpoint **GET mengubah data**: `getFamilyNode` backfill `sharedFamilySlug` (`:253`), `getPublicFamily` (publik, tanpa auth) me-regenerate slug & menghapus marker (`:1348-1391`), `ensureIdentity` di `getLayout`. | — |
| D3 | 🟡 | Full table scan semua pohon: `findInviterTree` (`:308`), `getPublicProfileByUsername` (`:1694`), `getPublicFamily` fallback 2 (`:1349`). Hasil "first match" non-deterministik. | — |
| D4 | 🟡 | `findFirst({ where: { userId } })` tanpa `orderBy` saat propagasi → bisa mengenai pohon yang salah jika user punya >1 pohon. | `:909`, `:965`, `:1055` |
| D5 | 🟡 | Tidak ada validasi siklus (A anak B, B anak A) di JSON maupun tabel (hanya cek self-parent). | `:2096-2101` |
| D6 | 🟡 | `leaveFamilyNode` tidak membersihkan `linkedUserId` di pohon head maupun `sharedFamilySlug` → `backfillFamilyNodeMembers` akan memasukkan kembali. Tidak ada alur *unlink*. User dihapus → `linkedUserId` menggantung di JSON. | `:484-487`, `:586-649` |
| D7 | ⚪ | `FamilyHubConnection` ada tapi tidak berdampak pada data apa pun — konsep keempat yang tumpang tindih. | `:2850-2906` |
| D8 | ⚪ | Tidak ada transaksi pada operasi multi-langkah (sync, join, propagate) → state setengah jadi saat gagal di tengah. | `:1115-1156`, `:2817-2830` |

---

## 3. Arsitektur Target

### 3.1 Prinsip

1. **Satu manusia = satu `Person`** di seluruh platform. Akun (`User`) hanya *mengklaim* Person.
2. **Hubungan bersifat absolut**: hanya dua jenis fakta yang disimpan — **`Parentage`** (orang tua → anak,
   dengan *jenis* & *tingkat kepastian*) dan **`Union`** (ikatan pasangan, dengan status & riwayat).
   Saudara (kandung/seayah/seibu/tiri/angkat), paman, sepupu, ipar, mertua, kakek **diturunkan** dari graf —
   tidak disimpan. (Di dokumen ini istilah umum "Relationship" = `Parentage` + `Union`.)
3. **Pohon = perspektif**, bukan wadah data: `ego Person + kedalaman + preferensi layout`. Posisi lingkaran
   disimpan per user, di-key oleh `personId`.
4. **Wewenang melekat pada Person (stewardship)**, bukan pada pohon.
5. **Relasi yang menyentuh Person ber-akun butuh konfirmasi** pemilik Person tersebut.
6. **Duplikat diselesaikan lewat merge yang eksplisit & dapat diaudit**, bukan dedupe nama otomatis.
7. **Semua perubahan tercatat** (revisi + optimistic locking).

### 3.2 Skema (draft Prisma)

```prisma
model Person {
  id           String    @id @default(cuid())
  userId       String?   @unique            // akun yang mengklaim orang ini
  displayName  String
  sex          Sex?                         // MALE | FEMALE | UNKNOWN — buang 'L'/'P'/'male'
  birthDate    DateTime?
  birthDatePrecision DatePrecision @default(UNKNOWN) // EXACT | MONTH | YEAR | CIRCA | BEFORE | AFTER | UNKNOWN
  birthPlace   String?
  deathDate    DateTime?
  deathDatePrecision DatePrecision @default(UNKNOWN)
  vitalStatus  VitalStatus @default(LIVING)  // LIVING | DECEASED | UNKNOWN (hilang kontak / tidak diketahui)
  isPlaceholder Boolean  @default(false)     // orang yang keberadaannya pasti tapi identitasnya belum/tidak diketahui
  placeholderKind PlaceholderKind?           // UNKNOWN_FATHER | UNKNOWN_MOTHER | UNKNOWN_PARENT | UNKNOWN_ANCESTOR
  multipleBirthGroup String?                 // kembar: id grup yang sama untuk saudara kembar
  photo        String?
  privacy      PersonPrivacy @default(FAMILY) // PUBLIC | FAMILY | PRIVATE
  createdById  String                         // user pembuat (steward awal untuk orang tanpa akun)
  mergedIntoId String?                        // tombstone setelah merge
  version      Int       @default(0)          // optimistic locking
  createdAt    DateTime  @default(now())
  updatedAt    DateTime  @updatedAt

  names        PersonName[]
  stewards     PersonSteward[]
  asParent     Parentage[] @relation("ParentSide")
  asChild      Parentage[] @relation("ChildSide")
  @@index([displayName])
  @@index([mergedIntoId])
}

model PersonName {               // nama kecil, nama setelah haji, gelar, marga, nama sebelum menikah, alias
  id       String @id @default(cuid())
  personId String
  kind     String                // BIRTH | MARRIED | NICKNAME | RELIGIOUS | TITLE | CLAN | ALIAS
  value    String
  isPrimary Boolean @default(false)
  @@index([value])
}

/// Fakta orang tua → anak. SATU baris per pasangan (orang tua, anak, jenis).
/// Seorang anak bisa punya >2 baris: mis. ayah biologis + ayah angkat + ayah tiri (wali).
model Parentage {
  id          String   @id @default(cuid())
  parentId    String
  childId     String
  kind        ParentageKind   // BIOLOGICAL | ADOPTIVE | STEP | FOSTER | GUARDIAN | DONOR | SURROGATE
  certainty   Certainty @default(CONFIRMED) // CONFIRMED | PROBABLE | ASSUMED | DISPUTED | UNKNOWN
  unionId     String?         // anak lahir/diasuh dalam ikatan pasangan mana (null = di luar ikatan / tidak diketahui)
  birthOrder  Int?            // urutan kelahiran dari orang tua ini
  startDate   DateTime?       // tgl adopsi / mulai diasuh / mulai jadi wali
  endDate     DateTime?       // akhir pengasuhan / perwalian
  isLegal     Boolean?        // adopsi resmi (penetapan pengadilan) vs adat/sosial
  visibility  PersonPrivacy @default(FAMILY) // fakta sensitif (mis. ayah biologis) bisa PRIVATE
  status      RelStatus @default(PROPOSED)   // PROPOSED | CONFIRMED | DISPUTED | REJECTED | RETRACTED
  proposedById String
  confirmedAt DateTime?
  note        String?
  version     Int      @default(0)
  @@unique([parentId, childId, kind])
  @@index([childId, kind])
  @@index([parentId, kind])
}

/// Ikatan pasangan. Riwayat lengkap: menikah, cerai, rujuk, menikah lagi, poligami.
model Union {
  id          String   @id @default(cuid())
  partnerAId  String
  partnerBId  String?         // null jika pasangan tidak diketahui
  kind        UnionKind       // MARRIAGE_CIVIL | MARRIAGE_RELIGIOUS | MARRIAGE_SIRI | CUSTOMARY | PARTNERSHIP | UNKNOWN
  status      UnionStatus     // ONGOING | DIVORCED | WIDOWED | ANNULLED | SEPARATED | UNKNOWN
  orderForA   Int?            // pernikahan ke-n bagi A (poligami / menikah ulang)
  orderForB   Int?
  startDate   DateTime?
  startDatePrecision DatePrecision @default(UNKNOWN)
  endDate     DateTime?
  endReason   UnionEndReason? // DIVORCE | DEATH_OF_A | DEATH_OF_B | ANNULMENT | UNKNOWN
  visibility  PersonPrivacy @default(FAMILY)
  confirmStatus RelStatus @default(PROPOSED) // PROPOSED | CONFIRMED | DISPUTED | REJECTED | RETRACTED
  proposedById String
  version     Int      @default(0)
  events      UnionEvent[]
  @@index([partnerAId])
  @@index([partnerBId])
}

model UnionEvent {               // rujuk, talak, cerai, pisah ranjang — untuk riwayat
  id       String @id @default(cuid())
  unionId  String
  type     String                // MARRIED | SEPARATED | DIVORCED | RECONCILED | WIDOWED | ANNULLED
  date     DateTime?
  datePrecision DatePrecision @default(UNKNOWN)
  note     String?
}

model PersonSteward {           // siapa berwenang atas Person tanpa akun
  personId String
  userId   String
  role     StewardRole           // OWNER (akun pemilik) | PRIMARY | CO_STEWARD | GUARDIAN
  grantedById String?
  @@id([personId, userId])
}

model ChangeProposal {           // edit oleh non-steward / relasi yang butuh persetujuan
  id         String @id @default(cuid())
  kind       String               // UPDATE_PERSON | ADD_RELATIONSHIP | REMOVE_RELATIONSHIP | MERGE | LINK_ACCOUNT
  payload    Json
  targetPersonIds String[]
  proposerId String
  status     ProposalStatus @default(PENDING)
  approvals  Json                 // { userId: 'APPROVE' | 'REJECT' }
  expiresAt  DateTime
}

model MergeCandidate {           // hasil deteksi duplikat
  personAId String
  personBId String
  score     Float
  reasons   Json                 // ["same_parents", "same_name", "same_birthdate"]
  status    String @default("OPEN")
  @@id([personAId, personBId])
}

model PersonRevision {           // audit trail & undo
  id        String @id @default(cuid())
  personId  String
  actorId   String
  diff      Json
  createdAt DateTime @default(now())
}

model FamilyUnit {               // pengganti "Family Node": halaman publik per Union (atau orang tua tunggal)
  id        String @id @default(cuid())
  slug      String? @unique
  name      String
  unionId   String? @unique      // keluarga dari sebuah ikatan pasangan
  singleParentId String?         // keluarga orang tua tunggal (tanpa Union / pasangan tidak diketahui)
  // anak = Parentage dengan unionId ini (atau parentId = singleParentId), diturunkan, tidak disimpan
  stewardIds String[]           // partner yang ber-akun
}

model TreeView {                 // pohon = perspektif user
  id        String @id @default(cuid())
  ownerId   String               // User
  egoPersonId String
  layout    Json                 // { [personId]: { x, y, collapsed } }
  depthUp   Int @default(3)
  depthDown Int @default(2)
}
```

Catatan:
- Satu Person bisa ada di banyak `FamilyUnit` (anak di unit orang tuanya, partner di unitnya sendiri, partner di
  unit pernikahan kedua). Tidak ada lagi "retire slug" karena setiap ikatan otomatis punya unitnya sendiri.
- Orang yang bercerai lalu menikah lagi = 2 `Union` = 2 `FamilyUnit`; anak dari pernikahan pertama tetap
  tercatat di unit pertama (lewat `Parentage.unionId`) dan tampil sebagai "anak tiri" di unit kedua
  secara terderivasi, **bukan** disalin.
- Saudara kandung / seayah / seibu / tiri / angkat **dihitung** dari kombinasi `Parentage.kind` + orang tua
  yang sama — lihat Fase 5.

### 3.3 Matriks Wewenang

| Objek | Siapa boleh edit langsung | Lainnya |
|---|---|---|
| Person **ber-akun & hidup** | Hanya pemilik akun (`userId`) | Orang lain → `ChangeProposal`, disetujui pemilik |
| Person **ber-akun EARLY_ACCESS** | `GUARDIAN` steward (pembuat) sampai akun diaktifkan; setelah aktif → pemilik | — |
| Person **tanpa akun, hidup** | `PRIMARY` steward (pembuat) + `CO_STEWARD` yang ditunjuk | Kerabat terkonfirmasi lain → proposal; jika steward tidak merespons X hari → eskalasi ke kerabat terdekat ber-akun |
| Person **tanpa akun, wafat** | Semua steward; konflik → `DISPUTED`, diselesaikan kerabat terdekat (anak > pasangan > saudara > cucu) | — |
| `Parentage` / `Union` biasa | Otomatis `CONFIRMED` jika **kedua ujung** dikendalikan oleh proposer (steward/akun sendiri) | Jika salah satu ujung milik akun lain → `PROPOSED` sampai dikonfirmasi pemilik ujung itu |
| `Parentage` **sensitif** (ayah biologis berbeda dari ayah sah/pengasuh, klaim paternitas, anak di luar ikatan) | Hanya anak (jika dewasa & ber-akun) **dan** ibu/orang tua yang bersangkutan; default `visibility = PRIVATE` | Pihak ketiga **tidak bisa** mengusulkan; sengketa → `DISPUTED`, tidak ditampilkan publik sampai selesai |
| `Union` status cerai/batal | Salah satu partner (cukup satu pihak untuk status *DIVORCED*; perubahan lain butuh konfirmasi pihak lain jika ber-akun) | Anak dewasa → proposal; tidak boleh menghapus riwayat, hanya menambah `UnionEvent` |
| `FamilyUnit` (slug, bio, foto) | Partner ber-akun di unit itu | Anak dewasa → proposal |
| `TreeView` (layout) | Hanya pemiliknya — tidak pernah memengaruhi data orang lain | — |
| Admin platform | Role terpisah `platform_admin`; **bukan** `super_user` | Semua aksi admin tercatat di audit log |

`super_user` dihapus sebagai role global; kemampuan "mengelola early access" menjadi atribut steward
(`GUARDIAN`) per-Person.

### 3.4 Skenario A ⇄ B dengan Model Baru

1. A menambahkan "adik" → UI mencari dulu: *"Apakah orang ini sudah ada?"* (cari Person by akun/nama/tgl lahir
   di sekitar graf A). A memilih akun B → sistem membuat `ChangeProposal(ADD_RELATIONSHIP)`:
   karena saudara diturunkan dari orang tua, proposal-nya adalah `Parentage(P_ayahA → Person_B, BIOLOGICAL)`
   dan `Parentage(P_ibuA → Person_B, BIOLOGICAL)`. UI menanyakan jenisnya: *kandung / seayah / seibu / tiri /
   angkat* — masing-masing menghasilkan kombinasi Parentage yang berbeda (lihat F5-03).
2. B menerima notifikasi → **Setuju** → relasi `CONFIRMED`. Jika B sudah punya orang tua placeholder sendiri
   (`P_ayahB`), sistem membuat `MergeCandidate(P_ayahA, P_ayahB, reasons=[shared_child_confirmed, same_name])`.
3. Steward kedua placeholder (A dan B) menyetujui merge → satu Person ayah, edges di-rewire, Person lama jadi
   tombstone (`mergedIntoId`) untuk redirect URL lama.
4. B kemudian mencoba "menambahkan A sebagai kakak" → sistem mendeteksi A **sudah** terhubung (saudara
   terderivasi dari orang tua yang sama) → tampil *"A sudah ada di silsilah Anda sebagai Kakak"*. **Tidak ada
   node baru.**
5. Halaman publik keluarga A (unit A + pasangan) dan keluarga B (unit B + pasangan) **tetap terpisah**,
   keduanya menampilkan orang tua yang sama (Person yang sama), tanpa duplikasi dan tanpa saling menimpa
   nama keluarga.

---

## 4. TASKLIST

Format: `- [ ] ID — tugas` · **File** · **Kriteria selesai (DoD)**.

### Fase 0 — Hotfix Keamanan & Integritas (segera, tanpa migrasi skema besar)

> **Status (2026-10-16): kode selesai & teruji lokal, belum dideploy ke produksi.**
> - Migration `20261015090000_node_link_requests` (tabel `node_link_requests`, kolom `users.created_by_id` + backfill) sudah diterapkan ke DB **lokal**; produksi: `prisma migrate deploy`.
> - Test lokal lulus: `test/tree-authority.e2e-spec.ts` (regresi Fase 0), `test/tree.e2e-spec.ts` (regresi lama), `src/modules/tree/tree-layout.util.spec.ts` — 3 suite, 61/61 test.
> - Setelah deploy, admin menjalankan: `POST /api/trees/repair-family-links` (dry-run) → tinjau → `?apply=true` → `POST /api/trees/recover-slugs`. Audit role: `apps/api/prisma/scripts/audit-super-user.sql` (hanya laporan).
> - Keputusan produk: `super_user` **tetap otomatis** untuk pembuat pohon pertama, tetapi tidak untuk akun EARLY_ACCESS dan tidak lagi hanya karena membuka `/tree`; kewenangannya hanya atas pohon miliknya.
> - Catatan F0-15: pengecekan konsen diterapkan di jalur layout (`saveLayout`); jalur tabel `updateMember` tetap memakai `nodeId = FamilyMember.id` seperti sebelumnya (akan disatukan di Fase 1).
> - Perubahan perilaku: halaman publik tidak lagi "memulihkan" slug yang hilang secara otomatis saat dibuka (dulu menulis DB pada GET) — gunakan `recover-slugs`.

- [ ] **F0-01 — Tutup bypass `super_user` di `ensureTreeOwner`.**
  File: `tree.service.ts:3363`. Ganti pengecekan menjadi `tree.userId === userId || roles includes 'admin'|'super_admin'`.
  DoD: e2e test — user B (punya pohon) mendapat 403 saat `PUT/DELETE /trees/:idPohonA`, `POST /trees/:idPohonA/members`, `POST /trees/:idPohonA/invitations`.
- [ ] **F0-02 — Berhenti memberi `super_user` otomatis.**
  File: `tree.service.ts:347`, `:366`, `assignSuperUserRole`. Kemampuan early-access dicek via "pemilik pohon tempat node berada", bukan role global. Audit & cabut role dari user yang mendapatkannya otomatis (migration SQL + daftar pengecualian manual).
  DoD: user baru tidak memiliki role `super_user`; fitur early access tetap jalan untuk pemilik pohon.
  Catatan: `FUTURE-FEATURES.md` menetapkan super_user otomatis untuk pembuat silsilah pertama, tetapi tidak saat registrasi/early access. Kode lama memberikannya ke siapa pun yang membuka `/tree` (termasuk EARLY_ACCESS) — kini diperbaiki sesuai aturan tersebut.
- [ ] **F0-03 — `createEarlyAccess` wajib cek kepemilikan pohon.**
  File: `:3064`. Panggil `ensureTreeOwner` (yang sudah diperbaiki).
- [ ] **F0-04 — Validasi `linkedUserId` di server (anti-impersonasi).**
  File: `saveLayout :989`. Untuk setiap node yang `linkedUserId`-nya **berubah**: tolak/strip kecuali (a) user itu dibuat oleh pemilik pohon via early access pada node yang sama, atau (b) sudah ada link request yang disetujui. Sama untuk `claimedByUserId` (hanya boleh diset oleh `respondToClaim`).
  File: `auth.service.ts:627` — tambahkan cek bahwa early-access user tersebut **dibuat oleh** caller (simpan `createdByUserId` di user/early-access record).
  DoD: test — menulis `linkedUserId` milik akun early-access keluarga lain lalu `login-as` → 403.
- [ ] **F0-05 — Link butuh persetujuan (LinkRequest sementara).**
  Tambah tabel `LinkRequest { treeId, nodeId, targetUserId, requesterId, status }` + endpoint `POST /trees/link-requests/:id/respond`. `saveLayout` menyimpan link sebagai `pendingLinkUserId`; `syncLinkedUser`/`joinFamilyNode` hanya dijalankan setelah `APPROVED`.
  DoD: link tidak berlaku & slug target tidak berubah sebelum target menyetujui.
- [ ] **F0-06 — Hentikan propagasi yang menimpa pohon user lain.**
  File: `saveLayout :1044-1072`, `setSlug :895-924`, `setSlugForTree :957-979`. Hapus penulisan `mainFamilyName`/`slug: null` ke pohon linked user. Jika masih diperlukan untuk legacy, minimal: guard `isFamilyNodeHead`, hanya untuk user yang `FamilyNodeMember.treeId === tree.id`, dan **jangan pernah** sentuh `mainFamilyName`.
  DoD: A menyimpan nama keluarga tidak mengubah apa pun di `TB`.
- [ ] **F0-07 — Deteksi link resiprokal (A↔B) & cegah self-anchor.**
  Di `syncLinkedUser`/`joinFamilyNode`: jika target sudah me-link balik caller, perlakukan sebagai konfirmasi hubungan, **jangan** pindahkan membership siapa pun. Jangan pernah set `sharedFamilySlug` sama dengan slug pohon itu sendiri. Tambahkan perbaikan data: bersihkan `sharedFamilySlug` yang menunjuk ke diri sendiri.
- [ ] **F0-08 — `joinFamilyNode` tidak boleh "mencuri" membership.**
  File: `:469`. Jika user sudah punya `FamilyNodeMember` di pohon lain, jangan upsert — kembalikan konflik dan minta user memilih.
- [ ] **F0-09 — Dedupe proyeksi leluhur di halaman publik.**
  File: `hydrateLinkedFamilyConfigs :1269`, `projectAncestryRecords :1225`. Lewati record yang (a) `linkedUserId`-nya = pemilik anchor atau user lain yang sudah tampil di anchor, (b) untuk node saudara (`older-*`/`younger-*`) **jangan proyeksikan `parent-*`/`gp*`** (orang tuanya = orang tua ego), (c) jangan proyeksikan `older-*/younger-*` yang menunjuk balik ke ego.
  DoD: test skenario A↔B — halaman publik A menampilkan orang tua satu kali dan A tidak muncul sebagai saudara dirinya sendiri.
- [ ] **F0-10 — `syncConnectedTree`: jangan menimpa pohon yang sudah berisi.**
  File: `:2462`. Jika pohon penerima sudah punya `layoutMembers` non-kosong → **jangan overwrite**; buat proposal/preview "data yang bisa diimpor" untuk dipilih user. Perbaiki indeks key ke konvensi 0-based (`spouse-0`, `child-0`, `parent-0`, `gpP-0`), hapus `newMembers['olderCount']`, jangan salin `linkedUserId` milik pihak ketiga, tentukan kakak/adik dari tanggal lahir.
  DoD: unit test per relasi; key hasil sinkron dirender oleh `TreeExplorer`.
- [ ] **F0-11 — Unik `linkedUserId` per pohon.**
  Validasi di `saveLayout` & `respondToClaim`: satu user hanya boleh ter-link di satu node per pohon.
- [ ] **F0-12 — Optimistic locking pada layout.**
  `PUT /trees/layout` & `/family-node/slice` menerima `baseUpdatedAt` (atau `version`); tolak 409 jika berbeda. Frontend menampilkan dialog "Data telah diubah orang lain — muat ulang/gabungkan". Bungkus read-modify-write slice dalam `$transaction`.
- [ ] **F0-13 — GET tidak boleh menulis.**
  Pindahkan backfill di `getFamilyNode :253`, `getPublicFamily :1348-1391`, `ensureIdentity` (pembuatan slug/username) ke job/endpoint eksplisit atau ke saat `saveLayout`.
- [ ] **F0-14 — Endpoint admin hanya untuk `admin`/`super_admin`.**
  File: `tree.controller.ts:68-80`.
- [ ] **F0-15 — Seragamkan consent.**
  Satu kunci `nodeId` (layout key) untuk `requestConsent`/`updateMember`; `saveLayout` menolak perubahan field profil pada node yang linked ke user `ACTIVE` tanpa consent `GRANTED`.
- [ ] **F0-16 — Test regresi skenario.**
  Tambah di `apps/api/test/tree.e2e-spec.ts`: (1) A↔B saudara, (2) suami-istri saling link, (3) C di-link oleh dua keluarga berbeda, (4) impersonasi early access, (5) pemilik pohon lain mencoba edit/hapus.

### Fase 1 — Fondasi Model Graf (dual-write, di balik feature flag `GRAPH_MODEL`)

> **Status (2026-10-18): kode selesai, belum dideploy.**
> - Modul `apps/api/src/modules/genealogy/`: `layout-graph.util.ts` (F1-03/F1-05), `graph-rules.util.ts` (F1-07/F1-09), `graph.repository.ts` (F1-08, recursive CTE — titik ganti untuk AGE/Neo4j), `graph-sync.service.ts` (F1-04/F1-06), `genealogy.service.ts` + controller.
> - Migration `20261017090000_genealogy_graph` (aditif). Tambahan di luar draf §3.2: `LegacyNodeMap` (tree+key → Person) dan `GraphAssertion` (pohon mana yang menyatakan relasi; relasi dihapus hanya jika tak ada pohon yang menyatakannya lagi).
> - Endpoint baca: `GET /api/genealogy/me/view?up&down&mode=nasab|hukum|sosial`, `GET /api/genealogy/me/relation/:personId`. Admin: `GET /api/genealogy/admin/check`, `POST /api/genealogy/admin/backfill` (dry-run kecuali `?apply=true`). CLI: `pnpm --filter @digsan/api graph:backfill [-- --apply]`.
> - Dual-write aktif hanya bila `GRAPH_MODEL=true`; berjalan di latar (tidak memblokir/menggagalkan penyimpanan lama), diserialisasi per pohon dengan advisory lock. Tanpa flag, perilaku aplikasi tidak berubah.
> - Data lama dipetakan sebagai `BIOLOGICAL` dengan `certainty = ASSUMED`. Slot yang dihitung di form setup tapi belum diberi nama → Person placeholder (`UNFILLED_SLOT`).
> - Orang tua yang digambar ulang oleh tiap saudara **belum digabung** — muncul sebagai `DUPLICATE_PARENT_SUSPECT` di `admin/check` dan menjadi masukan merge di Fase 2 (F2-04/F2-06).
> - Urutan deploy: migrate → backfill **dry-run** di produksi → tinjau laporan → `--apply` → set `GRAPH_MODEL=true` → restart API.

- [x] **F1-01 — Tambah model `Person`, `PersonName`, `Parentage`, `Union`, `UnionEvent`, `PersonSteward`, `PersonRevision`** (lihat §3.2) + migration + semua enum (`Sex`, `DatePrecision`, `VitalStatus`, `ParentageKind`, `Certainty`, `UnionKind`, `UnionStatus`, …). Skema sejak awal sudah mendukung kasus Fase 5 agar tidak perlu migrasi ulang.
- [x] **F1-02 — Modul baru `apps/api/src/modules/genealogy/`** (`person.service`, `parentage.service`, `union.service`, `graph.service`, `kinship.service`) — jangan menambah ke `tree.service.ts` yang sudah 3.4k baris. Akses graf lewat interface `GraphRepository` (implementasi awal: PostgreSQL) supaya Fase 7 tinggal menambah implementasi Neo4j/AGE.
- [x] **F1-03 — Kamus konversi key layout → relasi absolut.**
  Tabel pemetaan: `parent-i` → `Parentage(x → ego)`; `spouse-i` → `Union(ego, x)`; `child-i` → `Parentage(ego → x)` (+ dari spouse & `unionId` jika `parentId` menunjuk spouse); `older-i`/`younger-i` → anak dari orang tua ego (buat placeholder orang tua bila belum ada); `gpP-i` → `Parentage(x → parent-0)`; `gpM-i` → `Parentage(x → parent-1)`; `unclePo/unclePy` → anak dari `gpP`; `spouse-k-<key>` → rekursif dengan ego = `spouse-k`; node rekursif `parentId/spouseId` dipetakan langsung. Hasil backfill default `kind = BIOLOGICAL`, `certainty = ASSUMED` (bukan CONFIRMED) karena data lama tidak membedakan jenis. Field lama `FamilyTree.marriageStatus` (`ONGOING|DIVORCED|WIDOWED|NONE`) → `Union.status`.
  DoD: unit test mencakup semua prefix di `ANCESTRY_KEY_RE` dan pola `family/[slug]/page.tsx:132-238`.
- [x] **F1-04 — Backfill script** `prisma/backfill-graph.ts`: setiap pohon → Person per node; node dengan `linkedUserId`/`claimedByUserId`/pemilik pohon → **reuse** `Person` milik user itu (`Person.userId` unik — inilah yang otomatis menyatukan A di pohon A dan A di pohon B). Simpan mapping `LegacyNodeMap { treeId, nodeKey, personId }`.
- [x] **F1-05 — Backfill tabel `FamilyMember`** ke Person yang sama (cocokkan via `userId`, lalu via `LegacyNodeMap`; **jangan** via nama saja).
- [x] **F1-06 — Dual-write**: `saveLayout`, `saveFamilyNodeSlice`, `syncLinkedUser`, `respondToClaim`, `addMember/updateMember` juga menulis ke graf melalui `LegacyNodeMap`.
- [x] **F1-07 — Invariant di level graf**: tolak siklus `Parentage` (DFS sebelum insert), maksimal 1 ayah & 1 ibu `BIOLOGICAL` berstatus `CONFIRMED` (boleh lebih dari satu `PROBABLE`/`DISPUTED`), tidak boleh `Union` dengan orang tua/anak sendiri, tanggal lahir anak > orang tua (warning, bukan error, untuk data tidak lengkap).
- [x] **F1-08 — Graph query efisien**: recursive CTE PostgreSQL untuk ancestors/descendants/kinship (ganti `getAncestors`/`getDescendants` yang N+1 query, `:2959-3012`). Index `(childId,kind)`, `(parentId,kind)`, `Union(partnerAId)`, `Union(partnerBId)`.
- [x] **F1-09 — Kinship calculator**: fungsi `relationOf(egoId, otherId)` → label Indonesia (kakak/adik/paman/bibi/sepupu/ipar/mertua/besan, sisi ayah/ibu). Dipakai UI untuk menampilkan label, menggantikan key `older-0`.

### Fase 2 — Wewenang, Konsensus, Merge

> **Status (2026-10-24): F2-04 & F2-06 selesai (kode), belum dideploy.**
> - `merge-rules.util.ts`: normalisasi nama (gelar/sapaan dibuang), Jaro-Winkler, deteksi **struktural** (dua orang tua sejenis dari anak yang sama = `SHARED_CHILD`; anak tercatat dua kali di bawah orang tua sama = `SAME_PARENTS`), pemblokir (dua akun, pasangan, leluhur–keturunan, beda jenis kelamin), pemilihan survivor (akun > bernama > tertua).
> - `merge.service.ts`: deteksi otomatis setelah setiap dual-write & setelah backfill `--apply`; usulan dikirim ke **semua steward kedua orang** (notifikasi lonceng: "Ya, gabungkan" / "Bukan orang yang sama"); merge hanya bila semua setuju; satu penolakan menutup usulan dan tidak akan diusulkan ulang. Merge memindahkan relasi, `LegacyNodeMap`, steward, dan `GraphAssertion` ke survivor; nama lain disimpan sebagai alias; yang digabung menjadi tombstone (`mergedIntoId`) + revisi.
> - Sinkron pohon tidak lagi menimpa profil Person yang dipakai beberapa pohon (hanya mengisi yang kosong) → tidak ada "tarik-menarik" nama setelah merge.
> - Migration `20261019090000_merge_candidates`. Endpoint: `GET /api/genealogy/merge-candidates`, `PATCH /api/genealogy/merge-candidates/:id {approve}`, admin `POST /api/genealogy/admin/detect-duplicates`.
> - Catatan: `/tree` masih membaca layout lama (Fase 3), jadi merge baru terlihat di graf (`/genealogy/me/view`, label hubungan, halaman publik nanti) — lingkaran di masing-masing bagan tetap seperti yang digambar pemiliknya.

- [ ] **F2-01 — `PermissionService.can(actor, action, target)`** berdasarkan matriks §3.3. Semua endpoint genealogy memakai ini; tidak ada pengecekan role ad-hoc di service.
- [ ] **F2-02 — `ChangeProposal` workflow**: buat, setujui, tolak, kedaluwarsa; notifikasi in-app/push/email; halaman "Permintaan Keluarga" di web & mobile.
- [ ] **F2-03 — Konfirmasi relasi dua arah**: relasi yang menyentuh Person ber-akun berstatus `PROPOSED` sampai pemiliknya menyetujui. UI menampilkan relasi `PROPOSED` dengan gaya putus-putus.
- [x] **F2-04 — Deteksi duplikat (`MergeCandidate`)**: dijalankan saat Person/relasi dibuat. Sinyal: berbagi anak/orang tua terkonfirmasi, kemiripan nama (normalisasi + Jaro-Winkler), tanggal/tempat lahir, gender. Skor ≥ ambang → kandidat.
- [ ] **F2-05 — "Search before create"** di UI: setiap kali menambah lingkaran, tampilkan kandidat Person yang sudah ada di radius graf (≤ 3 derajat) dan akun user. Ini pencegah utama duplikasi.
- [x] **F2-06 — Merge Person** *(sebagian: unmerge & pilihan per-field belum; `TreeView`/`FamilyUnit` belum ada)*: transaksi yang me-rewire semua `Relationship`, `PersonSteward`, `TreeView.layout`, `FamilyUnit`, `LegacyNodeMap`; set `mergedIntoId`; simpan revisi untuk **unmerge**. Konflik field (nama/tanggal berbeda) → pilih per-field oleh steward.
- [ ] **F2-07 — Sengketa**: jika dua steward bertentangan (mis. tanggal lahir), status `DISPUTED`, tampilkan kedua versi + sumber; resolusi oleh kerabat terdekat ber-akun atau admin.
- [ ] **F2-08 — Unlink & keluar**: user dapat melepas klaim akun dari Person, menolak relasi, atau keluar dari `FamilyUnit`; semua referensi dibersihkan konsisten (ganti `leaveFamilyNode` yang tidak membersihkan apa pun).
- [ ] **F2-09 — Privasi**: `Person.privacy` + aturan orang hidup (data sensitif hanya untuk kerabat terkonfirmasi ≤ N derajat); halaman publik hanya menampilkan field yang diizinkan.
- [ ] **F2-10 — Audit log** semua aksi wewenang (proposal, merge, admin override) — tampil di riwayat Person.

### Fase 3 — Pindah Baca & Pensiunkan Model Lama

- [ ] **F3-01 — `FamilyUnit` menggantikan `FamilyNodeMember` + `sharedFamilySlug`.** Migrasi slug: setiap pohon dengan slug → `FamilyUnit` untuk pasangan `self`+`spouse-0`. Slug yang pernah di-retire karena bug (`recoverSlugs`) dipulihkan sebagai unit milik pasangan tersebut. Redirect slug lama.
- [ ] **F3-02 — API baca baru**: `GET /genealogy/view/:egoPersonId?up=3&down=2` mengembalikan `{ persons, relationships, layout }`. Halaman publik `/family/[slug]` membaca `FamilyUnit` → graf.
- [ ] **F3-03 — Refactor `TreeExplorer.tsx` & `family/[slug]/page.tsx`**: render dari graf (node = `personId`), posisi dari `TreeView.layout`, label dari kinship calculator. Hapus parsing regex key (`page.tsx:132-238`).
- [ ] **F3-04 — Mobile (`apps/mobile/lib/data/models/family_tree_model.dart`, `tree_repository.dart`)** ikut model baru.
- [ ] **F3-05 — Hapus kode legacy** setelah flag 100%: `syncConnectedTree`, `hydrateLinkedFamilyConfigs`, `projectAncestryRecords`, `findInviterTree`, `backfillFamilyNodeMembers`, `recoverSlugs`, fallback slug di `getPublicFamily`, propagasi `sharedFamilySlug`, `FamilyHubConnection` (atau definisikan ulang sebagai relasi antar `FamilyUnit`).
- [ ] **F3-06 — Pecah `tree.service.ts`** menjadi `family-unit.service`, `invitation.service`, `claim.service`, `consent.service`, `public-page.service`.
- [ ] **F3-07 — Drop kolom** `layoutMembers` (setelah arsip JSON ke tabel `legacy_tree_snapshots`), `FamilyMember` (atau jadikan view).

### Fase 4 — Skalabilitas & Observability

> Kasus relasi kompleks (sebelumnya F4-01/F4-02) dipindah & diperluas di **Fase 5**.

- [ ] **F4-03 — Lazy loading graf**: API paginasi per generasi & per cabang; cache Redis untuk view publik (invalidate per Person version).
- [ ] **F4-04 — Konkurensi tinggi**: semua tulis per-Person/per-Relationship (bukan blob), `version` per baris → konflik granular, bukan last-write-wins satu pohon.
- [ ] **F4-05 — Import/Export GEDCOM** (standar silsilah) untuk interoperabilitas & backup; import otomatis melewati deteksi duplikat.
- [ ] **F4-06 — Observability**: metrik jumlah `MergeCandidate` terbuka, proposal kedaluwarsa, relasi `DISPUTED`; job harian rekonsiliasi (siklus, orang tua > 2, tombstone menggantung).
- [ ] **F4-07 — Load test** graf ≥ 50.000 Person / 10 generasi; target `GET view` p95 < 300 ms.

### Fase 5 — Kompleksitas Keluarga Nyata

**Prinsip desain untuk kasus sensitif**

- **Fakta dipisah dari tampilan.** Data menyimpan *apa adanya* (biologis, angkat, asuh, tidak diketahui,
  dirahasiakan); cara menampilkan dipilih lewat **mode tampilan** dan **visibilitas**.
- **Ketidakpastian adalah data yang sah.** "Tidak diketahui", "kira-kira 1920", "diduga" disimpan
  eksplisit (`certainty`, `DatePrecision`, placeholder), bukan dibiarkan kosong atau diisi asal.
- **Pemilik cerita yang berwenang.** Fakta sensitif tentang seseorang (asal-usul, paternitas, adopsi)
  dikendalikan oleh orang itu sendiri (jika dewasa & ber-akun) dan orang tua langsungnya, bukan oleh kerabat
  lain yang kebetulan membuat pohon.
- **Tanpa stigma di ruang publik.** Halaman publik tidak pernah menampilkan label seperti "ayah tidak
  diketahui" atau "anak di luar nikah"; yang tidak boleh/tidak bisa ditampilkan cukup tidak digambar.

**Peta kasus → representasi data**

| Kasus | Representasi | Ditampilkan sebagai |
|---|---|---|
| Menikah | `Union(kind=MARRIAGE_*, status=ONGOING)` | Garis ganda antar pasangan |
| Cerai hidup | `Union.status=DIVORCED` + `UnionEvent(DIVORCED)` | Garis pasangan dengan tanda "//"; anak tetap terhubung ke kedua orang tua |
| Cerai mati / janda / duda | `Union.status=WIDOWED`, `endReason=DEATH_OF_X` | Garis pasangan normal, pasangan wafat diberi penanda |
| Rujuk | `UnionEvent(RECONCILED)` pada Union yang sama | Riwayat di detail pasangan |
| Menikah lagi | `Union` baru dengan `orderForA = 2` | Pasangan ke-2 di samping, anak dikelompokkan per ikatan |
| Poligami | Beberapa `Union` berstatus `ONGOING` bersamaan, berurutan `orderForA` | Pasangan berjajar, anak dikelompokkan per ibu |
| Nikah siri / adat | `Union.kind = MARRIAGE_SIRI / CUSTOMARY`, `visibility` dapat diatur | Seperti menikah; label hanya di tampilan privat |
| Pembatalan nikah | `Union.status = ANNULLED` | Disembunyikan dari publik secara default |
| Ayah/ibu tidak diketahui | `Parentage` ke Person `isPlaceholder=true, placeholderKind=UNKNOWN_FATHER`, `certainty=UNKNOWN` | Privat: lingkaran kosong "Tidak diketahui"; publik: **tidak digambar** |
| Ayah/ibu dirahasiakan | Parentage nyata dengan `visibility = PRIVATE` | Hanya terlihat oleh orang yang diizinkan |
| Orang tua diduga (belum pasti) | `certainty = PROBABLE` (bisa >1 kandidat) | Garis putus-putus berlabel "diduga" (privat saja) |
| Sengketa asal-usul | `certainty/status = DISPUTED` + `Evidence` | Tidak tampil publik sampai selesai |
| Anak angkat (adopsi) | `Parentage(kind=ADOPTIVE, isLegal, startDate)`; Parentage biologis tetap boleh ada (sering `PRIVATE`/`UNKNOWN`) | Garis putus-putus panjang; label "anak angkat" hanya jika steward mengizinkan |
| Anak asuh / dibesarkan kerabat | `Parentage(kind=FOSTER, startDate, endDate)` | Garis titik-titik; **tidak** ikut ditelusuri sebagai leluhur |
| Wali (perwalian) | `Parentage(kind=GUARDIAN)` | Tidak masuk silsilah, hanya di detail |
| Orang tua tiri | **Diturunkan**: pasangan (`Union`) dari orang tua kandung. `kind=STEP` hanya jika ingin mencatat "dibesarkan oleh" | Label "ayah/ibu tiri" |
| Saudara kandung / seayah / seibu / tiri / angkat | **Diturunkan** dari kombinasi orang tua & `kind` | Label otomatis dari kinship calculator |
| Kembar | `multipleBirthGroup` sama | Penanda kembar, urutan lahir sama |
| Donor / ibu pengganti | `kind = DONOR / SURROGATE`, default `PRIVATE` | Tidak tampil publik |
| Pernikahan antar-kerabat (sepupu menikah) | Person yang sama muncul di dua cabang (pedigree collapse) | Satu node + penanda "lihat juga di cabang …" (bukan duplikat) |
| Tanggal tidak pasti | `DatePrecision = YEAR / CIRCA / BEFORE / AFTER` | "± 1920", "sebelum 1945" |
| Hilang kontak / tidak diketahui masih hidup | `vitalStatus = UNKNOWN` | Diperlakukan sebagai orang hidup untuk privasi |
| Nama berganti (nama kecil, nama haji, gelar, marga) | `PersonName[]` | Nama utama + alias di detail; semua dipakai pencarian & deteksi duplikat |

**Tasklist**

- [ ] **F5-01 — Siklus hidup `Union`.** Tambah/ubah pasangan dengan pilihan jenis & status; mendukung beberapa ikatan (berurutan maupun bersamaan); `UnionEvent` untuk cerai/rujuk/wafat/batal; riwayat tidak bisa dihapus, hanya ditambah. Migrasi `FamilyTree.marriageStatus` lama.
  DoD: test — cerai lalu menikah lagi menghasilkan 2 Union & 2 FamilyUnit, anak pernikahan pertama tetap di unit pertama.
- [ ] **F5-02 — Anak terikat ke ikatan pasangan.** Saat menambah anak, pilih "dari pasangan mana" atau "di luar ikatan / tidak diketahui" (`Parentage.unionId`). Renderer menggantungkan anak pada **garis ikatan** (bukan pada satu orang), dikelompokkan per Union.
- [ ] **F5-03 — Derivasi & wizard saudara.** Saat menambah saudara, UI bertanya: *kandung / seayah / seibu / tiri / angkat*. Sistem membuat Parentage yang sesuai (mis. *seayah* = berbagi ayah saja; *tiri* = tidak berbagi orang tua, orang tua masing-masing terikat `Union`). Kinship calculator mengeluarkan label yang benar.
- [ ] **F5-04 — Orang tua tidak diketahui / dirahasiakan / belum diisi** sebagai tiga pilihan berbeda:
  - *Tidak diketahui* → placeholder `UNKNOWN_FATHER/MOTHER`. Placeholder **tidak** otomatis dianggap sama antar saudara; user harus menyatakan "sama dengan ayah kakak".
  - *Dirahasiakan* → Parentage nyata, `visibility=PRIVATE`.
  - *Belum diisi* → tidak ada record (slot kosong yang mengundang untuk diisi).
  Halaman publik tidak menampilkan placeholder maupun label apa pun. Placeholder bisa diganti/di-merge kemudian lewat proposal yang disetujui anak (jika dewasa) dan orang tua yang diketahui.
- [ ] **F5-05 — Adopsi.** `Parentage(kind=ADOPTIVE)` + (opsional) Parentage biologis. Pengaturan: tampilkan label "anak angkat" atau tidak; siapa yang boleh melihat orang tua biologis (default: anak angkat itu sendiri + orang tua angkat). Saat anak angkat dewasa & ber-akun, kendali visibilitas pindah ke dirinya.
- [ ] **F5-06 — Anak asuh & perwalian** (`FOSTER`, `GUARDIAN`) dengan rentang waktu; tidak ikut traversal leluhur/keturunan secara default. Selaras dengan konsep "wali" untuk anak di bawah umur dan almarhum di `FUTURE-FEATURES.md` (Guardianship rekursif).
- [ ] **F5-07 — Mode tampilan silsilah** (filter traversal berdasarkan `Parentage.kind`):
  1. **Nasab / Biologis** — hanya `BIOLOGICAL`.
  2. **Hukum** — `BIOLOGICAL` + `ADOPTIVE(isLegal)`.
  3. **Pengasuhan / Sosial** — semua jenis, termasuk tiri/asuh.
  Opsi "aturan nasab Islam" sebagai preset: anak angkat tidak dinasabkan ke ayah angkat (sejalan dengan KHI Ps. 171 huruf h); anak yang lahir di luar perkawinan dinasabkan ke ibu (KHI Ps. 100; lihat juga Putusan MK 46/PUU-VIII/2010 untuk hubungan perdata dengan ayah biologis). Aplikasi hanya **menampilkan** sesuai preset yang dipilih keluarga; sertakan disclaimer bahwa ini bukan nasihat hukum/agama. Mode lain (adat patrilineal/matrilineal) dapat ditambahkan sebagai preset berikutnya.
- [ ] **F5-08 — Ketidakpastian.** UI input tanggal dengan presisi (tahun saja, kira-kira, sebelum/sesudah); `vitalStatus=UNKNOWN`; orang yang lahir > 110 tahun lalu tanpa tanggal wafat dianggap wafat untuk keperluan privasi (dapat dikoreksi).
- [ ] **F5-09 — Bukti & sumber (`Evidence`).** Model `Evidence { targetType, targetId, kind: DOCUMENT|PHOTO|ORAL|DNA_SUMMARY|OTHER, fileUrl, note, visibility }` untuk mendukung klaim dan penyelesaian sengketa (F2-07). Dokumen sensitif (akta, putusan) default `PRIVATE`.
- [ ] **F5-10 — Varian nama** (`PersonName`) dipakai di pencarian & deteksi duplikat (F2-04).
- [ ] **F5-11 — Kembar & urutan lahir** (`multipleBirthGroup`, `birthOrder`), termasuk saudara dari ikatan berbeda yang diurutkan berdasarkan tanggal lahir.
- [ ] **F5-12 — Pedigree collapse.** Renderer & kinship calculator mendukung satu Person yang muncul di beberapa cabang; kinship dapat mengembalikan beberapa hubungan sekaligus (mis. "sepupu sekaligus ipar").
- [ ] **F5-13 — Perlindungan & keterasingan.** User bisa: menyembunyikan dirinya/cabangnya dari kerabat tertentu (block), menolak & meminta penghapusan klaim hubungan tentang dirinya, mengatur visibilitas kontak/lokasi. Anak di bawah umur yang masih hidup default `PRIVATE`.
- [ ] **F5-14 — Notifikasi aman.** Notifikasi & feed aktivitas tidak boleh membocorkan fakta sensitif ke pihak ketiga (mis. "X menambahkan ayah biologis Y"). Gamification tidak memberi poin per fakta sensitif.
- [ ] **F5-15 — Legenda visual konsisten** di `/tree`, `/family/[slug]`, mobile: garis tegas = biologis, putus panjang = angkat, titik-titik = asuh/wali, garis ganda = menikah, "//" = cerai, abu-abu = wafat, putus pendek = diduga.
- [ ] **F5-16 — Kinship calculator lengkap** (memperluas F1-09): kandung/seayah/seibu/tiri/angkat, ipar, mertua, menantu, besan, sepupu derajat-n & "kali tersingkir", istilah Jawa generasi leluhur yang sudah dipakai aplikasi (Simbah, Buyut, Canggah, Wareng, Udheg-udheg, Gantung siwur, Gropak senthe), sisi ayah/ibu.
- [ ] **F5-17 — Fixture & test matrix** untuk semua baris tabel di atas (unit test kinship + e2e API + snapshot render).

### Fase 6 — World Tree

**Konsep.** Lingkaran pusat bersimbol asal-usul manusia (Adam & Hawa), cincin konsentris = generasi,
cincin terluar = pengguna digsan.id. Setiap pengguna menarik garis ke dalam melalui leluhur yang sudah
diketahui; saat dua keluarga menemukan leluhur yang sama, garisnya **bertemu**. Di antara leluhur terjauh yang
diketahui dan pusat, digambar garis putus-putus *"jalur belum terlacak"*, mengundang pengguna mengisi
slot kosong (ayah, ibu, kakek, nenek, buyut, …).

**Catatan desain yang perlu diputuskan**

- Koneksi ke pusat bersifat **simbolis/ilustratif**, bukan klaim genealogis; tampilkan disclaimer. Label &
  visibilitas simpul pusat sebaiknya dapat diatur admin karena pengguna berasal dari latar keyakinan beragam.
- Data silsilah sebenarnya berbentuk **DAG** (bukan pohon murni) karena pedigree collapse; layout hierarki D3
  butuh pohon, jadi DAG perlu dipotong menjadi pohon tampilan (node ganda dengan penanda) atau memakai
  layout radial kustom.
- Skala: SVG nyaman hingga ±2–5 ribu node; Canvas untuk puluhan ribu; WebGL (PixiJS / deck.gl / sigma.js)
  untuk ratusan ribu ke atas, dengan agregasi (cluster per keluarga/marga/daerah) dan *semantic zoom*.

**Kemampuan D3.js yang relevan:** `d3-hierarchy` (`d3.tree` / `d3.cluster` dengan `size([2π, radius])` untuk
layout radial), `d3.linkRadial` (konektor melengkung), `d3-zoom` (zoom/pan), `d3-transition` (animasi fokus),
`d3-scale` (warna per generasi), `d3-force` (opsional, untuk cluster), `d3-quadtree` (hit-test cepat pada
Canvas). D3 tidak menggambar WebGL; untuk skala sangat besar D3 dipakai untuk layout & matematika, dan
render diserahkan ke Canvas/WebGL.

**6A — Dummy *Future Concept* (frontend saja, bisa dikerjakan sekarang, tidak bergantung Fase 0–5)**

- [ ] **F6-01 — Tambah dependensi** `d3` (pin versi stabil yang sudah lama rilis, mis. `7.9.0`) + `@types/d3` di `apps/web` (saat ini belum ada library visualisasi graf di repo).
- [ ] **F6-02 — Generator data sintetis ber-seed** (deterministik): ±300–1.500 "pengguna" di cincin luar, kedalaman leluhur acak 1–8 generasi, beberapa leluhur bersama untuk memperlihatkan konvergensi, slot kosong.
- [ ] **F6-03 — Komponen `WorldTreeConcept.tsx`** (client-only, `dynamic(..., { ssr: false })`): layout radial, simpul pusat, cincin generasi berlabel (Diri, Orang Tua, Simbah, Buyut, Canggah, …), garis konvergensi, garis putus-putus "belum terlacak", zoom/pan, tooltip saat hover, klik untuk fokus satu cabang (menampilkan slot leluhur kosong 2ⁿ).
- [ ] **F6-04 — Halaman `/world-tree`** dengan heading & badge **"Future Concept"**, penjelasan singkat, legenda, disclaimer simbolis, CTA "Lengkapi leluhur Anda" → `/tree`. Tambahkan kotak status "World Tree — Coming Soon/Inactive" di dashboard, mengikuti pola kotak status yang sudah ada.
- [ ] **F6-05 — Aksesibilitas & tema:** dark mode, `prefers-reduced-motion`, tampilan mobile (versi sederhana/statis), teks alternatif.
- [ ] **F6-06 — (Opsional) Teaser di `apps/landing`** berupa SVG/gambar ringan.
- [ ] **F6-07 — Pengaturan admin** label & tampil/tidaknya simpul pusat (via `AppConfig`).

**6B — World Tree dengan data nyata (setelah Fase 3; skala besar setelah Fase 7)**

- [ ] **F6-08 — Job pra-komputasi layout** dari graf `Person/Parentage` → snapshot layout per tingkat zoom (LOD), disimpan & di-cache (Redis/CDN).
- [ ] **F6-09 — API** `GET /world-tree/overview`, `GET /world-tree/branch/:personId`, `GET /world-tree/viewport?…` (hanya node dalam viewport).
- [ ] **F6-10 — Privasi:** orang hidup ditampilkan anonim (titik) kecuali opt-in publik; anak di bawah umur & Parentage sensitif tidak pernah tampil; hanya agregat untuk cabang privat.
- [ ] **F6-11 — "Temukan tempat saya" & "Apa hubungan saya dengan X?"** (memakai API jalur hubungan Fase 7).
- [ ] **F6-12 — Deteksi konvergensi** (dua keluarga berbagi leluhur) → rekomendasi koneksi (selaras dengan *Asisten/Helper* di `FUTURE-FEATURES.md`) + poin pengabdian untuk mengisi slot leluhur & konvergensi yang terkonfirmasi.
- [ ] **F6-13 — Renderer Canvas/WebGL** saat node terlihat > ±5.000; D3 tetap untuk layout.
- [ ] **F6-14 — Mobile (Flutter):** WebView atau `CustomPainter` dengan data LOD yang sama.

### Fase 7 — Arsitektur Hybrid PostgreSQL + Graph Database

**Rekomendasi:** PostgreSQL tetap **Source of Truth** (profil, foto, akun, transaksi, artikel, langganan,
*dan* fakta silsilah). Graph DB hanya **proyeksi baca** (read model) untuk query multi-hop. Adopsi
dilakukan **bertahap berdasarkan ukuran & benchmark**, bukan sejak awal:

| Tahap | Kapan | Teknologi |
|---|---|---|
| 1 | Sekarang s/d jutaan Person | PostgreSQL recursive CTE + tabel closure leluhur terbatas kedalaman (cepat untuk leluhur/keturunan & leluhur bersama) |
| 2 | Query jalur hubungan mulai lambat, ingin Cypher tanpa server baru | **Apache AGE** (ekstensi PostgreSQL, openCypher; kompatibel PostgreSQL 16 yang dipakai di `docker-compose.yml`) — tetap satu database, tanpa sinkronisasi |
| 3 | Skala sangat besar / beban query graf tinggi | **Neo4j** sebagai microservice silsilah terpisah, disinkronkan dari PostgreSQL |

Catatan pencarian "sepupu derajat ke-12": leluhur bersama berada 13 generasi ke atas (≤ 2¹³ ≈ 8.192 slot
leluhur per orang, sering jauh lebih sedikit karena pedigree collapse & data tidak lengkap). Pencarian
dua arah (leluhur A ∩ leluhur B) masih realistis di PostgreSQL dengan indeks/closure table. Neo4j paling
unggul untuk *shortest path* yang mencampur jalur darah + pernikahan pada graf sangat besar dan pola
multi-hop yang beragam.

**Tasklist**

- [ ] **F7-01 — ADR & benchmark.** Dataset sintetis 1 juta & 10 juta Person. Query: leluhur kedalaman 15, keturunan, leluhur bersama, derajat sepupu, *shortest path* lewat darah+pernikahan. Bandingkan PostgreSQL CTE/closure vs Apache AGE vs Neo4j (latensi p95, RAM, biaya operasional di VPS IDCloudHost). Tetapkan ambang pindah tahap.
- [ ] **F7-02 — Optimasi PostgreSQL dulu:** tabel `PersonAncestor(personId, ancestorId, depth, viaKinds)` dibatasi kedalaman (mis. 15), dipelihara via job/trigger saat `Parentage` berubah; endpoint kinship memakai irisan dua arah.
- [ ] **F7-03 — `GraphRepository` interface** (sudah disiapkan di F1-02) dengan implementasi `PostgresGraphRepository`; tambah `AgeGraphRepository` / `Neo4jGraphRepository` tanpa mengubah service di atasnya.
- [ ] **F7-04 — Skema proyeksi graf (minimal data):** `(:Person {id, sex, birthYear, vitalStatus, privacy, isPlaceholder})`, `(:Union {id, status})`, `[:PARENT_OF {kind, certainty, visibility}]`, `[:PARTNER_IN]` (Person → Union), `[:CHILD_OF_UNION]`. Union dimodelkan sebagai **node** agar anak bisa dikaitkan ke ikatan tertentu. Disarankan **tanpa nama/PII** (pencarian nama tetap di PostgreSQL) supaya permukaan kebocoran data kecil; jika nama tetap disimpan, perlakukan sebagai replika yang ikut aturan privasi.
- [ ] **F7-05 — Sinkronisasi andal:** tabel `GraphOutbox` ditulis dalam **transaksi yang sama** dengan perubahan `Person/Parentage/Union`; worker (berbasis Redis yang sudah ada di stack) mengonsumsi secara idempoten & berurutan per Person; job *full rebuild*; rekonsiliasi harian (hitung & bandingkan checksum); metrik lag.
- [ ] **F7-06 — API silsilah lanjutan:** `GET /genealogy/relation?from=&to=` → jalur + label ("sepupu derajat ke-12, 1 kali tersingkir"), `GET /genealogy/common-ancestors`, `GET /genealogy/cousins?degree=n`. Alur: graph DB mengembalikan ID node & edge → backend mengambil profil dari PostgreSQL dalam **satu batch** (`WHERE id IN (...)`) → filter privasi diterapkan **di backend setelah hidrasi** (selain pre-filter di query graf).
- [ ] **F7-07 — Degradasi aman:** jika graph service tidak tersedia, fallback ke implementasi PostgreSQL (dengan batas kedalaman) alih-alih error.
- [ ] **F7-08 — Infrastruktur:** service baru di `docker/docker-compose.yml` (tidak diekspos publik, auth wajib), variabel di `env.validation.ts`, backup terjadwal, sizing RAM (heap + page cache), update `docs/DEPLOY_IDCLOUDHOST.md`. Catat lisensi: Neo4j Community (GPLv3) tanpa clustering/hot backup; fitur tersebut ada di Enterprise (berbayar). Apache AGE berlisensi Apache 2.0.
- [ ] **F7-09 — Keamanan & privasi graf:** query graf tidak pernah dipanggil langsung dari klien; batas kedalaman & timeout per query; rate limit untuk endpoint pencarian hubungan (mencegah pemetaan massal jaringan keluarga orang lain).
- [ ] **F7-10 — Load test** sesuai target F7-01 sebelum dipakai World Tree (F6-08 dst.).

---

## 5. Rencana Migrasi Data (ringkas)

1. **Snapshot** semua `family_trees.layout_config/layout_members` ke `legacy_tree_snapshots` (rollback).
2. Jalankan perbaikan data Fase 0: bersihkan `sharedFamilySlug` self-reference & yang tidak valid, link yang
   melanggar keunikan, pulihkan slug yang di-retire oleh propagasi.
3. Backfill graf (F1-04/05) dalam mode *dry-run* → laporan: jumlah Person, relasi, konflik, kandidat merge.
4. Review kandidat merge berskor tinggi otomatis hanya jika sinyalnya **struktural** (Person ber-akun yang
   sama); sisanya menjadi `MergeCandidate` untuk disetujui pengguna — **tidak ada merge otomatis berbasis
   nama**.
5. Dual-write minimal 2 minggu, bandingkan output halaman publik lama vs baru (script diff).
6. Alihkan baca bertahap (flag per user → per keluarga → 100%), lalu pensiunkan kode lama (F3-05).

---

## 6. Urutan Prioritas yang Disarankan

1. **Minggu ini**: F0-01, F0-02, F0-03, F0-04, F0-14 (celah keamanan aktif).
2. **Berikutnya**: F0-05 s/d F0-11, F0-16 (menghentikan kerusakan data baru, termasuk skenario A↔B).
3. F0-12, F0-13, F0-15.
4. Fase 1 (skema sudah memuat kebutuhan Fase 5) → Fase 2 → Fase 3.
5. Fase 5 (UI & aturan kasus kompleks) setelah model graf dipakai untuk baca (Fase 3); F5-01 s/d F5-05
   paling mendesak (cerai/menikah ulang, ayah tidak diketahui, adopsi).
6. Fase 4 & F7-01/F7-02 (benchmark + optimasi PostgreSQL) berjalan setelah Fase 3; Neo4j/AGE hanya diadopsi
   jika ambang benchmark terlampaui.
7. **Fase 6A (World Tree dummy) bisa dikerjakan paralel kapan saja** karena murni frontend dengan data
   sintetis. Fase 6B setelah Fase 3 (skala kecil) dan Fase 7 (skala besar).

Fase 0 menghentikan *gejala* dan kerusakan baru, tetapi duplikasi tetap akan muncul selama data orang masih
berupa salinan JSON per pohon. **Fase 1–3 adalah perbaikan akar masalah** dan diperlukan agar jaringan
keluarga yang terus berkembang tetap sinkron. Fase 5–7 memastikan model tersebut sanggup menampung
kerumitan keluarga nyata dan skala jaringan yang sangat besar.
