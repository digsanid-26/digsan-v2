# Future Features Roadmap
- [x] Pada sidebar modal Detil Anggota, untuk pertama kalinya perlu disediakan form setup bagan tree dengan Pengelompokan : (heading) Keluarga utama dengan rincian field Nama Family, Jumlah pasangan (suami/istri|default 1), jumlah anak (number | default 2), Kelompok Keluarga Besar dengan rincian field: Nama Family; Jumlah Orang Tua (number | Default 2),Jumlah Saudara (Kakak)(number|default 2), Jumlah Saudara (Adik)(number:default 2), Kelompok Keluarga Simbah dengan rincian field: Jumlah Simbah (Kakek-Nenek) dari pihak Ayah (number|default 2), Jumlah Simbah dari pihak Ibu (number|default 2). Di bawah field di atas perlu ditambahkan bahwa jumlah di atas termasuk yang sudah meninggal
- [x] Ketika field setup awal disimpan, bagan tree akan melakukan struktur ulang bardasarkan pengaturan baru di atas. 
- [x] Bila bagan sudah terisi penuh sampai ke Kelompok Keluarga Simbah, Ada bagan garis ke atas (lurus) muncul di atas lingkaran Simbah baik dari pihak Ayah maupun Ibu yang otomatis dibuat namun hanya terlihat bila expand All diberlakukan lalu discroll ke atas yaitu Buyut, Canggah, Wareng, Udheg-udheg, Gantung siwur, Gropak senthe. 
- [x] User dapat mengisi bagan tree selain dirinya (misal istri, kakak, adik, orang tua, anak) yang dibuatnya sebatas mengisi nama lengkap, jenis kelamin, status kehidupan (hidup/meninggal dunia), dan upload foto profil. Untuk mengisi data lengkap nantinya akan ada fitur invite kepada pemilik identitas dengan cara klik invite dan muncul beberapa metode invitation seperti email, sosmed, whatsapp, dst.  
- [ ] Fitur self host email server dan email provider (console idcloudhost) yang bisa langsung membuat alamat email di digsan.id dengan alamat email @digsan.id. 
- [ ] Fasilitas webmail client untuk mengirim, menerima, membaca, menghapus pesan dan email yang menjadi satu bagian (modul) atau fitur di aplikasi digsan.id

## Sistem Self Styler
- [ ] Fitur mempercantik tampilan tree masing-masing
- [ ] Fitur mempercantik tampilan digsan idcard

## Tree Improvisasi
- [x] Ketika user mengklik lingkaran profil orang lain (yang masih memiliki garis penghubung), selain memunculkan modal berisi Detil anggota / user tersebut juga membuat circle/lingkaran terpilih tersorot dan membesar, sementara profil sebelumnya mengecil ke semula.
- [x] Untuk profil yang telah memiliki foto, nama mereka menghilang. Bisakah tetap ada namun ditempatkan di luar lingkaran? Bisa di bawah lingkaran, sedikit menyinggung lingkaran, dilindungi border dan blur background.
- [ ] **Guardianship rekursif & perizinan (silsilah lengkap antar-jaringan).** Saya memiliki orang tua yang salah satunya telah meninggal dunia, yaitu Ayah saya. Selain Ibu saya, seharusnya saya juga bisa mengedit dan mengelola tree Ayah agar tetap memiliki cabang ke keluarganya (saudaranya, orang tuanya = kakek-nenek saya, serta kakek-neneknya = buyut saya). Prinsip umum yang diinginkan:
  - Setiap orang dapat menjadi "akar" sub-tree sendiri.
  - Untuk **siapa pun yang memiliki hubungan langsung dengan saya namun telah meninggal**, saya (sebagai wali yang masih hidup) dapat mengakses setup awal orang tersebut (mengatur jumlah pasangan/saudara/orang tua/anak, dst.) dan mengeditnya. Berlaku **rekursif** — bila di dalam jaringan Ayah terdapat anggota yang juga meninggal, saya bisa mengaksesnya juga (jika memilih mengisinya).
  - Untuk anggota yang **masih hidup** (mis. Ibu), saya **tidak** memiliki akses mengelola jaringannya tanpa izin melalui akun beliau → perlu **fitur perizinan/konsen**.
  - **Wali bersama:** saudara Ayah yang masih hidup dan akunnya aktif juga memiliki akses edit yang sama atas jaringan almarhum.
  - Catatan teknis: layout saat ini masih config-driven (topologi tetap). Rencana bertahap: (1) spesifikasi + model data; (2) layout graf rekursif berbasis relasi `FamilyMember` (parentId/spouseId/children) menggantikan `generateTree`; (3) form setup per-almarhum yang membuat record `FamilyMember` sungguhan; (4) alur perizinan anggota hidup + guardianship bersama.

- [ ] node/lingkaran profil yang telah memiliki tree akan memiliki icon tree (berupa lingkaran background hijau dengan icon tree putih) di ujung kanan atas menyentuh garis lingkaran profilnya;
- [ ] Ketika klik node/lingkaran profil yang memiliki icon tree (misal istri, ayah, kakek, anak, dst) yang masih terhubung, muncul tombol di bawah nama LIHAT SILSILAH.


## Detail Anggota (Diri sendiri) Improvement
Pada Sidebar Detil anggota (diri sendiri) tambahkan beberapa area/tombol berikut: 
- [ ] Area Lengkapi Profil | style bordered, hightlight background | Di dalam area terdapat progress bar kecil dengan persentase kelengkapan, diikuti keterangan teks kecil : Melengkapi profil 100% bisa memberikan poin pengabdian sebesar 20 poin, diikuti tombol Lengkapi Profil
- [ ] Badge Area | Heading : Badge Anda | Badge diperoleh dengan mengikuti atau mengaktifkan fitur-fitur keanggotaan, modul, dan usaha/program keluarga di Digsan.id

## Detail Anggota Keluarga (istri/suami, anak-anak, saudara, orang tua, dst)
- [ ] Sidebar Detil Profil, fungsi link tombol Undang Pemilik Identitas alihkan ke Modal Buat Undangan (gambar silsilah) sama seperti tombol Undang di tree, perbedaannya ada di Pesan Undangan terdapat nama terundang. Ganti metode undangan pada Modal Buat Metode undangan dari tombol (download, bagikan, Whatsapp, Telegram) menjadi dropdown field sebelum Judul. Tergantung metode undangan yang dipilih, munculkan field yang perlu diisi sebelum bisa mengklik tombol Kirim / Cetak / Salin Tautan : Whatsapp perlu mengisi nomor whatsapp (+62xxxx), telegram (nomor/id telegram), Email (alamat email). 
- [ ] Untuk keluarga yang telah meninggal dunia, pada bagian modal sidebar bagian Undang pemilik identitas perlu diubah menjadi Undang kerabat edit bersama yang mengacu pada aturan perijinan yang ada (bisa muncul list user(akun telah aktif) yang sesuai atau direkomendasikan)

## Sistem Notifikasi
- [ ] Cek apakah sudah ada sistem notifikasi dibangun? Rekomendasikan sistem notifikasi yang komprehensif dan lengkap (email, push, bell, alarm), bangun dengan sistem yang dapat dikembangkan seiring perkembangan aplikasi (karena saat ini masih proses pembangunan)
- [ ] Cek kemungkinan membangun self-host email server di console idcloudhost (di virtual server lain) yang memungkinkan dengan domain sendiri (@digsan.id), untuk kedepannya juga mendukung multi domain name, terhubung dengan fitur digsan.id di mana user bisa membuat email @digsan.id dengan gratis, membaca dan mengirim email di dashboard email . 

## Sistem navigasi dan halaman detil
- [x] Membuat halaman Family | tree/nama-keluarga (misal tree/farisma-fam) : berisi keluarga kecil ayah, ibu, anak-anak saja dengan konten yang lebih lengkap dan personal (untuk dikembangkan lebih lanjut nanti);
- [x] Membuat halaman profil personal | tree/nama-keluarga/nama-publik-anda (misal tree/farisma-fam/arisnwh) : Halaman profil pribadi untuk diri sendiri yang nantinya bisa dikembangkan lebih lanjut


## Sistem Gamification
- [ ] Buatkan halaman Admin untuk mengatur Sistem Gamification seperti Gami Konfigurasi: tempat membuat tipe poin (default poin pengabdian, poin aktivitas, dan poin produktivitas), Gami Stat & Logs : tempat statistik poin masing-masing tipe, peringkat top 10 member masing-masing tipe, serta listing history poin didapat dari user, action, jumlah poin, waktu, dst yang dilengkapi filter dan view detail (modal);
- [x] Gami Reward dan Redeem yang berisi pengaturan syarat dan hadiah yang diperoleh dari poin yang didapat oleh user, listing redeem request, dst;
- [x] Poin pengabdian : Pengabdian dalam menyelesaikan task, pengabdian dalam mengembangkan jaringan / koneksi keluarga
- [x] Poin aktivitas : Keaktifan dalam aplikasi, keaktifan dalam mengikuti kegiatan online / offline, keaktifan mengisi/mengupdate konten/status
- [x] Poin produktivitas : Keaktifan dalam kegiatan bersifat ekonomis, keaktifan dalam mengikuti keanggotaan, keaktifan dalam wadah usaha/program bersama.

## Sistem Tree Keluarga / Family
- [ ] Ketika kita sudah punya family (keluarga utama dan keluarga besar) dibuat, misalnya https://app.digsan.id/family/farisma perlu dibuat fitur tambahan untuk menambahkan user lain dalam lingkup keluarga utama (suami/istri dan anak) dan keluarga besar (ayah, ibu, kakak, adik) baik yang sudah aktif maupun belum ke dalam family tersebut? 
- [ ] Tree antar kelompok keluarga perlu dibangun. Mungkin perlu layout baru sebagai alternatif layout tree sekarang. Keluarga besar akan terdiri dari beberapa keluarga utama (kecil), Untuk beberapa keluarga besar yang terhubung membentuk keluarga Buyut, untuk keluarga antar buyut yang terhubung membentuk keluarga Canggah, untuk keluarga antar Canggah membentuk keluarga Wareng, dst (Udheg-udheg, Gantung Siwur, Gropak Senthe);
- [ ] Gambaran layout baru (perlu dinamai) bisa dibaca dari skenario berikut : Dari bagan tree user akan hanya ada , bagan tree keluarga utama (lingkaran dengan label nama keluarga utama) seperti berada di belakang (z-index lebih rendah) dengan penampakan agak tersamar. Ada garis tipis yang menghubungkan anggota dari keluarga utama tersebut di mana anggota keluarga utama adalah dirinya, suami atau istrinya, serta anak-anaknya. Ketika lingkaran family disorot, garis dan lingkaran keluarga utama menjadi jelas, setelah diklik maka bagan tree keluarga muncul. Bagan Tree Keluarga memiliki susunan seperti bagan tree user namun berisi koneksi antar bagan keluarga utama lainnya yang membentuk keluarga besar.

## Sistem Invitation
- [x] Mungkinkah membangun sistem build in screen capture pada tree? terdapat fitur capture berdasarkan mouse move dan select, memiliki opsi menyimpannya ke pc, galeri (smartphone), atau langsung ke invitation form (melalui capture button);
- [x] Perlu dibuat format form invitation yang memungkinkan melampirkan gambar (misal screenshot tree) dan kata-kata invitation;
- [x] Gambar tree tidak menangkap kondisi sebenarnya seperti foto profil yg sudah terpasang di lingkaran, demikian juga dengan hasil screen capture;
- [x] Sistem mengirim invitatian via pretty image yaitu gambar hasil dari gabungan image hasil screenshot tree yang diikuti dengan teks cantik ajakan kalimat lainnya (bisa diedit) yang bisa di preview dan didownload . Terdapat tombol Preview dan Download Image di bawahnya. User tinggal melampirkan gambar di sosmed/chat, atau lainnya;  
- [x] Sistem mengirim invitation via Whatsapp, telegram, dan social media. Telusuri dan temukan cara bagaimana mengirim pesan undangan yang diteruskan ke nomor whatsapp dengan aman, terhindar dari anggapan spam, dan bisa langsung memberikan hasil signifikan (terundang mengunjungi profil yang dibuat user pengundang dan bisa register memakai akunnya). Adakah platform pihak ketika yang memiliki fitur menghandle semuanya sekaligus?;
- [x] Pelajari file-file di dalam folder source - wp-mail-smtp (wordpress plugin) terkiat fungsi koneksi mail smtp menggunakan google dan akomodir agar bekerja dan dapat digunakan dengan sistem di dalam digsan.id; (Selesai: `EmailService` kini mendukung koneksi SMTP generik host/port/encryption/auth ala mailer "Other SMTP" wp-mail-smtp — set `SMTP_HOST=smtp.gmail.com`, `SMTP_PORT=465/587`, `SMTP_USER`, `SMTP_PASS` (App Password). Gmail OAuth2 tetap sebagai fallback. Ditambah fitur ala Authorization/Connect wp-mail-smtp: admin isi Client ID/Secret lalu klik **Connect with Google** di `/admin/settings` → refresh token & email terhubung tersimpan di DB (`AppConfig` kategori `email`); endpoint `/api/admin/email/*` (status/credentials/gmail connect+callback/disconnect/test).)
- [x] Sistem mengirim invitation via email. Misal user aktif mendapatkan email manual dari orangnya langsung, lalu menuliskannya di form Invitation via email di akun non-aktif yang akan diaktifkan (otomatis tersimpan). Lalu dari situ user aktif mengklik tombol Invite. Email invitation dikirim dan bila email diterima dan klik terima/accept, maka akun dapat langsung dikelola oleh user yang diundang tersebut.
- [x] Invitation via Whatsapp tidak disertai spesifik link ke family terkait di mana link yang disertakan hanya https://app.digsan.id/ saja, serta lampiran gambar tree tidak ikut disertakan. Perbaiki dan jadikan ini sebagai fitur juga untuk model tipe invitation lainnya seperti juga via email, telegram, dan lainnya. 
- [x] Invitation via Whatsapp atau lainnya masih mengirim hanya https://app.digsan.id, harusnya ada /tree/nama-keluarga/nama-user, apa belum aktif/dibuild?; (Selesai: link undangan kini deep-link spesifik — undang anggota tertentu → `/family/{slug}?m={nodeId}` (node ditandai cincin kuning di halaman publik), share diri/owner → `/family/{slug}/{username}`. Fallback ke `/family/{slug}` lalu origin hanya bila slug belum ada. Slug & username dibuat otomatis via `ensureIdentity` saat layout dibaca/disimpan.)
- [x] Sebenarnya sudahkah seseorang dan family memiliki link publik? bisakah non-user mengakses profil publik tree user/family aktif atau user/family non-aktif yang memang perlu diaktifkan oleh orang yang diberikan undangan tersebut? Misalnya adanya fitur siapapun yang punya link bisa mengakses halaman tersebut. (Sudah ada & publik tanpa login: halaman keluarga `app/family/[slug]` dan profil `app/family/[slug]/[username]` via endpoint tanpa guard `GET /api/public/family/:slug` & `/:slug/:username` (`PublicFamilyController`). Catatan keterbatasan: yang punya username/profil publik per-orang baru **owner** tree; anggota lain tampil di dalam silsilah keluarga dan bisa disorot via `?m={nodeId}`. Aktivasi akun non-aktif tetap lewat alur undangan `/invite/{token}`.)
- [x] Email invitation telah berhasil terkirim ke alamat email tujuan. Namun ketika diklik tombol Terima Undangan dan membuka tab baru (format url halaman tersebut seperti https://app.digsan.id/invite/4c8e11fe43e41f991ca212ff8a5f0f7362e873e7cee07bb8e767bdf5b1f5c590) di halaman itu keterangannya : 404 This page could not be found.
- [ ] User terundang setelah login dihadapkan oleh tree yang masih kosong, padahal dirinya diminta untuk melengkapi tree yang sudah dibuat oleh suami/istri atau kerabatnya misalnya dalam satu kesatuan keluarga/family. Sehingga ketika dicek di Pengaturan Bagan, sudah ada nama Keluarga Utama atau kelompok keluarga besar di sana. Harusnya sudah ada bagan dari keluarga tersebut dan dirinya tinggal menverifikasi bahwa dirinya yang ada di lingkaran atau tree tersebut.
- [ ] Mungkinkah email invitation bisa menyertakan logo digsan.id di header invitationnya, kalau tidak salah di folder apps/web/public/logo-white.svg (sekarang tulisan Digsan) dan bersama pesan invitation disertakan avatar si pengirim (kiri avatar, kanan pesan);


## Sistem Ai Asisten / Helper
- [ ] Apa yang diperlukan agar digsan.id dapat memunculkan data analisis berbasis database yang dihimpun yang kemudian diikuti dengan aksi merekomendasikan hubungan antar tree yang belum terhubung misalnya keluarga si A direkomendasikan untuk menjalin koneksi dengan keluarga si B (juga sebaliknya) karena memiliki keterkaitan/kesamaan silsilah kakek / nenek atau paman atau buyut, atau lainnya?

## Fasilitas Digsan.id
- [ ] Chat Keluarga | Sistem percakapan private antar anggota keluarga yang bisa ditingkatkan dengan pengaturan hingga lintas family.
- [ ] Digital Membercard dengan foto profil, nomor keanggotaan, nama lengkap, alamat, qrcode yang bila discan mengarah ke profil public user tersebut | Aktif ketika satu silsilah keluarga dalam satu Family tree telah aktif semua (terkecuali yang meninggal dunia);
- [ ] Doa Almarhum, berupa susunan nama-nama keluarga yang telah almarhum (nama binti orangtua) dari yang terdekat hingga yang terjauh, yang bisa diatur kedalamannya melalui filter yang komprehensif, bisa di atur font-size, ketebalan, perataan sebelum dicetak/download dalam bentuk print, jpg, maupun pdf | Otomatis aktif ketika lebih dari 5 Family tree terhubung;
- [ ] Personal Channel | Seperti Youtube channel namun lebih luas tidak terbatas hanya video, namun juga blog/artikel, update status, atau share lainnya | Bisa diaktifkan ketika poin aktivitas telah mencapai 1000 poin;
- [ ] Arisan Keluarga. Fasilitas yang otomatis aktif ketika sebuah koneksi telah menghubungkan lebih dari 50 orang dengan user aktif mencapai 70% lebih;
- [ ] Koperasi Keluarga. Fasilitas upgrade keanggotaan yang akan aktif dalam bentuk penawaran kepada user yang telah berusia di atas 20 tahun dan memiliki keanggotaan aktif lebih dari 3 bulan;

## Backend Admin
- [x] Cek apakah ada user role admin dan ketersediaan akses ke dashboard admin dsb; (Sudah ada: role `admin`/`super_admin`/`worker` + `RolesGuard`; backend `AdminController` (`/api/admin/*`: dashboard, users, workers, orders, settings, configs) dan halaman web `app/(dashboard)/admin/` (page, users, workers, settings).)
- [ ] Admin memiliki dashboard relatif sama dengan tampilan app.digsan.id namun memiliki area konten berupa tree yang mencakup perkembangan jaringan semua keluarga dalam satu map besar dengan sistem filter, search, bisa mengklik semua lingkaran yang ada untuk melihat profil atau informasi yang ada.
- [ ] buatkan script untuk menjadikan user dengan alamat email digsanid@gmail.com sebagai superadmin untuk dijalankan di ssh.
*Terakhir diperbarui: Juli 2026*

