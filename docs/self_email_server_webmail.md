# Self-Hosted Email Server & Webmail — Investigasi & Build Guide

Dokumen ini adalah hasil investigasi dan panduan membangun dua fitur pada roadmap
(`FUTURE-FEATURES.md`):

1. **Self-host email server + provider** — kemampuan membuat alamat email `@digsan.id`
   (mis. `arisnwh@digsan.id`) langsung dari platform.
2. **Webmail client** — modul di dalam aplikasi `digsan.id` untuk mengirim, menerima,
   membaca, dan menghapus email/pesan.

Guide ini selaras dengan stack existing (lihat `DEPLOY_IDCLOUDHOST.md`): VPS IDCloudHost
(Jakarta), NestJS API, Next.js web, PostgreSQL + Redis (Docker), Nginx reverse proxy.

---

## 1. Ringkasan Eksekutif (TL;DR)

- Menjalankan mail server sendiri itu **mungkin** dan **hemat biaya jangka panjang**,
  tetapi **deliverability** (agar email tidak masuk spam / tidak ditolak) adalah tantangan
  utama, bukan instalasi software-nya.
- **Rekomendasi**: gunakan **Mailcow (dockerized)** atau **Mailu** sebagai mail server
  lengkap, di **VPS terpisah** dari aplikasi, dengan domain `mail.digsan.id`.
- **Webmail**: dua jalur —
  - **Cepat**: embed **Roundcube** / **SnappyMail** (bawaan Mailcow/Mailu) di subdomain
    `webmail.digsan.id`.
  - **Terintegrasi**: bangun **modul webmail native** di digsan.id (NestJS proxy IMAP/SMTP
    + UI Next.js). Direkomendasikan untuk pengalaman "satu aplikasi".
- **Provisioning**: buat mailbox `@digsan.id` otomatis via **Admin API** mail server saat
  user mengaktifkan fitur email.
- **Peringatan IDCloudHost / VPS Indonesia**: **port 25 sering diblokir** dan **IP VPS
  sering masuk blocklist**. Ini penentu kelayakan self-host (lihat §4).

---

## 2. Tujuan & Ruang Lingkup

| Kebutuhan | Deskripsi |
|-----------|-----------|
| Alamat `@digsan.id` | User bisa punya email `namauser@digsan.id` |
| Kirim/terima | SMTP (kirim) + IMAP (terima/sinkron) |
| Webmail dalam app | Baca, tulis, balas, hapus, folder, lampiran |
| Provisioning otomatis | Buat/suspend/hapus mailbox dari backend digsan.id |
| Deliverability | SPF, DKIM, DMARC, PTR, TLS, reputasi IP |
| Keamanan | Anti-spam, anti-virus, rate limit, enkripsi |

Di luar ruang lingkup awal: mailing list, kalender/kontak (CalDAV/CardDAV),
email marketing massal.

---

## 3. Anatomi Sebuah Mail Server

Sebuah mail server "lengkap" sebenarnya gabungan beberapa komponen:

| Komponen | Fungsi | Software umum |
|----------|--------|---------------|
| **MTA** (Mail Transfer Agent) | Kirim/terima antar server (SMTP :25/:587) | Postfix, Exim |
| **MDA / IMAP-POP** | Simpan & serve mailbox ke klien | Dovecot |
| **Anti-spam** | Filter spam/phishing | Rspamd, SpamAssassin |
| **Anti-virus** | Scan lampiran | ClamAV |
| **DKIM signer** | Tandatangani email keluar | OpenDKIM / Rspamd |
| **Webmail** | UI berbasis browser | Roundcube, SnappyMail |
| **Admin UI/API** | Kelola domain & mailbox | Mailcow/Mailu API |

Membangun ini manual (Postfix + Dovecot + Rspamd + ...) memungkinkan tetapi rawan
salah konfigurasi. **Stack all-in-one** (Mailcow/Mailu/iRedMail) menyatukan semuanya.

---

## 4. Kendala Kritis: Deliverability & IDCloudHost

> Instalasi mail server itu 20% pekerjaan. 80% sisanya adalah membuat email Anda
> **diterima** oleh Gmail/Outlook/Yahoo tanpa masuk spam.

### 4.1 Port 25 diblokir
Sebagian besar provider VPS (termasuk banyak VPS Indonesia/IDCloudHost) **memblokir
port 25 keluar** secara default untuk mencegah spam. Tanpa port 25, server Anda tidak
bisa mengirim langsung ke server lain.

**Aksi**: buka tiket ke IDCloudHost meminta **unblock port 25 outbound** (biasanya perlu
justifikasi penggunaan). Jika ditolak → gunakan **smart host / relay** (lihat §4.4).

### 4.2 PTR / Reverse DNS
Server penerima memeriksa apakah IP Anda punya **PTR record** yang cocok dengan hostname
(`mail.digsan.id`). Tanpa PTR yang benar, email hampir pasti ditolak/spam.

**Aksi**: set PTR/rDNS untuk IP VPS di panel IDCloudHost → arahkan ke `mail.digsan.id`.

### 4.3 Reputasi IP
IP VPS baru sering sudah ada di **blocklist** (Spamhaus, dll.) karena bekas dipakai
orang lain. Cek di [mxtoolbox.com/blacklists.aspx](https://mxtoolbox.com/blacklists.aspx)
dan [multirbl.valli.org](https://multirbl.valli.org/).

**Aksi**: minta delisting bila perlu; lakukan **IP warm-up** (naikkan volume bertahap).

### 4.4 Alternatif: SMTP Relay / Smart Host (SANGAT DIREKOMENDASIKAN untuk kirim)
Agar tidak pusing soal port 25 & reputasi untuk **email keluar**, arahkan email keluar
lewat relay pihak ketiga (murah/gratis di volume kecil):

| Relay | Free tier | Catatan |
|-------|-----------|---------|
| **Amazon SES** | ~$0.10/1000 email | Termurah pada skala, perlu verifikasi domain |
| **Brevo (Sendinblue)** | 300/hari gratis | Mudah, ada API |
| **Mailgun** | Trial | Populer untuk transaksional |
| **Postmark** | Trial | Deliverability sangat baik |
| **Resend** | 3000/bln gratis | Developer-friendly, API modern |

**Pola hybrid ideal**: **terima** email langsung di server sendiri (IMAP milik user),
tapi **kirim** lewat relay. Ini menghilangkan 90% masalah deliverability sambil tetap
punya mailbox `@digsan.id` sendiri.

---

## 5. Pilihan Arsitektur (Perbandingan)

### Opsi A — All-in-one: **Mailcow (dockerized)** ⭐ Rekomendasi
- Postfix + Dovecot + Rspamd + ClamAV + SOGo/SnappyMail + Admin UI + **REST API**.
- Docker Compose, dokumentasi bagus, komunitas besar.
- **API provisioning** lengkap → cocok untuk otomasi dari digsan.id.
- **Kebutuhan**: RAM **min 6 GB** (disarankan), disk cukup. → **butuh VPS terpisah**.

### Opsi B — Ringan: **Mailu**
- Docker Compose, lebih ringan (bisa jalan ~2–3 GB RAM).
- Punya Admin UI + **API** (create user/domain).
- Webmail bawaan: Roundcube / SnappyMail.
- **Cocok** bila ingin footprint kecil dan tetap punya API.

### Opsi C — **iRedMail**
- Installer di atas OS langsung (bukan Docker). Stabil, tetapi kurang cloud-native;
  API/otomasi lebih terbatas pada versi gratis.

### Opsi D — Manual (Postfix + Dovecot + Rspamd)
- Kontrol penuh, footprint kecil, **tetapi** paling rawan salah & mahal waktu maintenance.
- Hanya untuk yang benar-benar paham mail administration.

### Opsi E — **Managed email hosting** (bukan self-host)
- Beli layanan email `@digsan.id` dari provider (Zoho Mail punya free tier untuk domain
  sendiri, Google Workspace, Microsoft 365, atau cPanel email di IDCloudHost).
- **Tercepat & paling andal**; trade-off: biaya per mailbox & kontrol lebih sedikit.
- **Rekomendasi pragmatis** bila prioritas adalah cepat rilis: mulai dari sini, lalu
  migrasi ke self-host saat volume/kebutuhan meningkat.

| Kriteria | Mailcow | Mailu | iRedMail | Manual | Managed |
|----------|:------:|:-----:|:--------:|:------:|:-------:|
| Kemudahan setup | ●●○ | ●●● | ●●○ | ○○○ | ●●● |
| API otomasi | ●●● | ●●○ | ●○○ | ○○○ | ●●●* |
| Kebutuhan RAM | tinggi | sedang | sedang | rendah | - |
| Deliverability effort | tinggi | tinggi | tinggi | tinggi | rendah |
| Biaya jangka panjang | rendah | rendah | rendah | rendah | tinggi |

\* tergantung provider.

---

## 6. Arsitektur Target (Rekomendasi)

```
                    Internet
                        │
        ┌───────────────┼────────────────┐
        ▼               ▼                ▼
  app.digsan.id   api.digsan.id     mail.digsan.id
   (Next.js)       (NestJS)        (Mailcow/Mailu)
        │               │                │
        │   webmail UI  │  IMAP/SMTP      │  MTA (25/465/587)
        │──────────────▶│◀───────────────│  IMAP (993)
        │               │  Admin API      │  Admin API (HTTPS)
        │               │────────────────▶│
        │               │                 │
        │               ▼                 ▼
        │         PostgreSQL         Mail storage (maildir)
        │         (metadata)         + Rspamd + ClamAV
        ▼
   Browser user

  Email KELUAR → via SMTP Relay (SES/Brevo/Resend) untuk deliverability.
  Email MASUK  → langsung ke mail.digsan.id (MX record).
```

**Prinsip**:
- Mail server **terpisah** dari VPS aplikasi (isolasi resource & keamanan).
- digsan.id API berfungsi sebagai **provisioning orchestrator** (buat mailbox) dan
  **webmail gateway** (proxy IMAP/SMTP untuk UI native).

---

## 7. Konfigurasi DNS (Wajib)

Untuk domain `digsan.id`, dengan mail host `mail.digsan.id` dan IP `X.X.X.X`:

| Tipe | Host | Nilai | Fungsi |
|------|------|-------|--------|
| A | `mail` | `X.X.X.X` | Alamat mail server |
| MX | `@` | `10 mail.digsan.id.` | Kemana email masuk dikirim |
| TXT (SPF) | `@` | `v=spf1 mx a:mail.digsan.id include:<relay> -all` | Server sah pengirim |
| TXT (DKIM) | `dkim._domainkey` | `v=DKIM1; k=rsa; p=<public-key>` | Tanda tangan email |
| TXT (DMARC) | `_dmarc` | `v=DMARC1; p=quarantine; rua=mailto:dmarc@digsan.id` | Kebijakan & laporan |
| PTR (rDNS) | (di panel VPS) | `mail.digsan.id` | Reverse DNS IP |
| A | `webmail` | `X.X.X.X` | (opsi) webmail bawaan |
| A | `autoconfig` | `X.X.X.X` | (opsi) auto-config klien mail |

> **Catatan**: SPF `-all` (strict) hanya setelah yakin semua path pengirim tercakup;
> mulai dengan `~all` (softfail) saat pengujian. DKIM key digenerate oleh Mailcow/Mailu.

Verifikasi dengan `dig`, [mail-tester.com](https://www.mail-tester.com/) (target skor 10/10),
dan [dmarcian](https://dmarcian.com/).

---

## 8. Langkah Instalasi — Mailcow (Contoh)

> Jalankan di VPS **terpisah**, min 6 GB RAM, Ubuntu 22.04. Domain `mail.digsan.id`
> sudah mengarah ke IP-nya, port 25/465/587/993/443 terbuka.

```bash
# 1. Prasyarat
apt update && apt install -y docker.io docker-compose-plugin git
timedatectl set-timezone Asia/Jakarta

# 2. Clone Mailcow
cd /opt
git clone https://github.com/mailcow/mailcow-dockerized
cd mailcow-dockerized

# 3. Generate konfigurasi (isi mail hostname: mail.digsan.id)
./generate_config.sh

# 4. (Opsional) sesuaikan mailcow.conf — HTTP_PORT/HTTPS_PORT bila Nginx di depan
nano mailcow.conf

# 5. Jalankan
docker compose pull
docker compose up -d

# 6. Buka https://mail.digsan.id → login admin (admin / moohoo) → GANTI PASSWORD
```

Di Admin UI Mailcow:
1. **Configuration → Domains** → tambah `digsan.id`.
2. **Ambil DKIM key** (Configuration → ARC/DKIM) → tempel ke DNS.
3. **Mailboxes** → buat mailbox uji (mis. `test@digsan.id`).
4. Kirim uji ke [mail-tester.com](https://www.mail-tester.com/) → perbaiki hingga 10/10.
5. **Buat API key** (Configuration → Access → API) untuk provisioning dari digsan.id.

Untuk **Mailu**, alurnya serupa: siapkan `.env` via [setup.mailu.io](https://setup.mailu.io/),
`docker compose up -d`, lalu kelola via Admin UI/API.

---

## 9. Integrasi ke digsan.id

### 9.1 Provisioning mailbox (buat email otomatis)

Tambahkan modul `mail` di NestJS yang memanggil **Admin API** mail server.

Model data (Prisma) — kaitkan mailbox ke user:

```prisma
model Mailbox {
  id        String   @id @default(cuid())
  userId    String   @unique
  user      User     @relation(fields: [userId], references: [id])
  address   String   @unique          // arisnwh@digsan.id
  quotaMb   Int      @default(1024)
  status    String   @default("ACTIVE") // ACTIVE | SUSPENDED | DELETED
  createdAt DateTime @default(now())
}
```

Service (contoh, Mailcow API):

```ts
// apps/api/src/modules/mail/mailbox.service.ts
async createMailbox(localPart: string, password: string, quotaMb = 1024) {
  const res = await fetch(`${this.mailApiBase}/api/v1/add/mailbox`, {
    method: 'POST',
    headers: { 'X-API-Key': this.mailApiKey, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      local_part: localPart,          // "arisnwh"
      domain: 'digsan.id',
      password, password2: password,
      quota: quotaMb, active: '1',
    }),
  });
  if (!res.ok) throw new Error('Gagal membuat mailbox');
  return res.json();
}
```

Endpoint yang perlu disediakan: `create`, `suspend`, `delete`, `update-quota`,
`change-password`. Panggil `create` saat user memilih "Aktifkan email @digsan.id".

> **Keamanan password**: jangan simpan password mailbox plaintext. Simpan credential
> terenkripsi (KMS/secret) atau gunakan token/aplikasi-password khusus untuk webmail.

### 9.2 Webmail native (baca/tulis/hapus di dalam app)

Dua komponen:

**Backend — gateway IMAP/SMTP (NestJS)**
- Library: [`imapflow`](https://imapflow.com/) (IMAP) + `nodemailer` (SMTP, sudah dipakai).
- Endpoint contoh:
  - `GET  /mail/folders` — daftar folder (INBOX, Sent, Trash, ...)
  - `GET  /mail/messages?folder=INBOX&page=1` — daftar pesan (subject, from, date, seen)
  - `GET  /mail/messages/:uid` — detail pesan (body HTML/teks, lampiran)
  - `POST /mail/send` — kirim (to, subject, body, attachments)
  - `PATCH /mail/messages/:uid` — tandai read/unread, pindah folder
  - `DELETE /mail/messages/:uid` — hapus (pindah ke Trash / expunge)

```ts
// Contoh ambil daftar pesan dengan imapflow
const client = new ImapFlow({
  host: 'mail.digsan.id', port: 993, secure: true,
  auth: { user: mailbox.address, pass: appPassword },
});
await client.connect();
const lock = await client.getMailboxLock('INBOX');
try {
  const list = [];
  for await (const msg of client.fetch('1:*', { envelope: true, flags: true })) {
    list.push({ uid: msg.uid, subject: msg.envelope.subject,
                from: msg.envelope.from, date: msg.envelope.date,
                seen: msg.flags.has('\\Seen') });
  }
  return list.reverse();
} finally { lock.release(); await client.logout(); }
```

**Frontend — modul webmail (Next.js)**
- Route mis. `/mail` di area dashboard (`app/(dashboard)/mail/`).
- Layout: sidebar folder + daftar pesan + panel baca + composer.
- Reuse gaya UI existing (Tailwind, dark mode ThemeProvider).
- Fitur MVP: Inbox list, baca pesan, compose/kirim, balas, hapus, tandai dibaca.
- Amankan body HTML email dengan sanitizer (mis. `DOMPurify`/`sanitize-html`) untuk
  cegah XSS dari email masuk.

### 9.3 Jalur cepat: embed Roundcube/SnappyMail
Bila belum ingin bangun UI native, arahkan `webmail.digsan.id` ke webmail bawaan mail
server dan tautkan (SSO opsional via IMAP credential). Cocok sebagai MVP sementara UI
native dikembangkan.

---

## 10. Roadmap Bertahap

| Fase | Fokus | Hasil |
|------|-------|-------|
| **0. Keputusan** | Cek unblock port 25 IDCloudHost, tentukan self-host vs managed | Go/No-go |
| **1. Kirim andal** | Konfigurasi SMTP relay (SES/Resend) + SPF/DKIM/DMARC untuk email transaksional existing | Email app tidak masuk spam |
| **2. Mail server** | Deploy Mailcow/Mailu di VPS terpisah + DNS + PTR + uji mail-tester 10/10 | Bisa terima & buat mailbox manual |
| **3. Provisioning** | Modul `mail` NestJS + Prisma `Mailbox` + Admin API create/suspend/delete | Mailbox `@digsan.id` otomatis |
| **4. Webmail MVP** | Embed Roundcube ATAU gateway IMAP/SMTP + UI list/baca/kirim | User pakai email di app |
| **5. Webmail lengkap** | Folder, lampiran, search, hapus, tandai, balas/teruskan, sanitasi HTML | Pengalaman "satu aplikasi" |
| **6. Ops** | Backup maildir, monitoring, quota, rate limit, warm-up IP | Produksi stabil |

---

## 11. Keamanan & Operasional

- **TLS wajib** untuk SMTP/IMAP/Webmail (Let's Encrypt; Mailcow/Mailu handle otomatis).
- **Anti-abuse**: rate limit pengiriman per mailbox, batasi lampiran, aktifkan Rspamd.
- **Backup**: snapshot volume maildir + DB mail server terjadwal (mis. harian).
- **Monitoring**: uptime port 25/465/587/993, disk usage, antrian mail (queue), skor RBL.
- **Kepatuhan**: sediakan alamat `abuse@` & `postmaster@`; proses laporan DMARC (`rua`).
- **Isolasi**: mail server di VPS terpisah; firewall hanya buka port mail + admin (dibatasi IP).
- **Rahasia**: API key mail server & credential mailbox disimpan sebagai secret (bukan di repo).

---

## 12. Estimasi Biaya

| Item | Perkiraan | Catatan |
|------|-----------|---------|
| VPS mail (4 vCPU / 6–8 GB) | ~Rp 300–500k/bln | Mailcow butuh RAM lebih |
| SMTP relay (opsional) | Gratis–murah | SES ~$0.10/1000, Resend 3000/bln gratis |
| Domain (sudah ada) | - | `digsan.id` |
| SSL | Gratis | Let's Encrypt |
| **Alternatif managed** | ~Rp 15–50k/mailbox/bln | Zoho/Workspace/365 |

---

## 13. Rekomendasi Akhir

1. **Sekarang**: pastikan email transaksional existing andal — pindahkan pengiriman
   Nodemailer ke **SMTP relay** (Resend/SES) + set **SPF/DKIM/DMARC**. Ini prasyarat
   apa pun pilihan berikutnya (dan sudah menyentuh `email.service.ts`).
2. **Validasi kelayakan**: buka tiket **unblock port 25** ke IDCloudHost. Hasilnya menentukan
   apakah self-host penuh layak, atau pakai pola **terima sendiri + kirim via relay**.
3. **MVP mailbox**: deploy **Mailu** (lebih ringan) atau **Mailcow** (fitur lengkap) di VPS
   terpisah, provisioning via Admin API dari modul `mail` NestJS.
4. **Webmail**: mulai dengan **embed SnappyMail/Roundcube** untuk cepat rilis, lalu bangun
   **UI native** `/mail` yang terintegrasi penuh dengan pengalaman digsan.id.
5. **Bila prioritas cepat & minim ops**: pertimbangkan **managed email** untuk `@digsan.id`
   lebih dulu, dan jadikan self-host sebagai target jangka menengah.

---

## 14. Referensi

- Mailcow: https://docs.mailcow.email/
- Mailu: https://mailu.io/ · setup: https://setup.mailu.io/
- iRedMail: https://www.iredmail.org/
- ImapFlow (IMAP client Node): https://imapflow.com/
- Nodemailer: https://nodemailer.com/
- Mail deliverability test: https://www.mail-tester.com/
- Blacklist check: https://mxtoolbox.com/blacklists.aspx
- Amazon SES: https://aws.amazon.com/ses/ · Resend: https://resend.com/ · Brevo: https://www.brevo.com/
