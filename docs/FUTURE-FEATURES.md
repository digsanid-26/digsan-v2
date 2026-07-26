# Future Features Roadmap
- [x] Pada sidebar modal Detil Anggota, untuk pertama kalinya perlu disediakan form setup bagan tree dengan Pengelompokan : (heading) Keluarga utama dengan rincian field Nama Family, Jumlah pasangan (suami/istri|default 1), jumlah anak (number | default 2), Kelompok Keluarga Besar dengan rincian field: Nama Family; Jumlah Orang Tua (number | Default 2),Jumlah Saudara (Kakak)(number|default 2), Jumlah Saudara (Adik)(number:default 2), Kelompok Keluarga Simbah dengan rincian field: Jumlah Simbah (Kakek-Nenek) dari pihak Ayah (number|default 2), Jumlah Simbah dari pihak Ibu (number|default 2). Di bawah field di atas perlu ditambahkan bahwa jumlah di atas termasuk yang sudah meninggal
- [x] Ketika field setup awal disimpan, bagan tree akan melakukan struktur ulang bardasarkan pengaturan baru di atas. 
- [x] Bila bagan sudah terisi penuh sampai ke Kelompok Keluarga Simbah, Ada bagan garis ke atas (lurus) muncul di atas lingkaran Simbah baik dari pihak Ayah maupun Ibu yang otomatis dibuat namun hanya terlihat bila expand All diberlakukan lalu discroll ke atas yaitu Buyut, Canggah, Wareng, Udheg-udheg, Gantung siwur, Gropak senthe. 
- [x] User dapat mengisi bagan tree selain dirinya (misal istri, kakak, adik, orang tua, anak) yang dibuatnya sebatas mengisi nama lengkap, jenis kelamin, status kehidupan (hidup/meninggal dunia), dan upload foto profil. Untuk mengisi data lengkap nantinya akan ada fitur invite kepada pemilik identitas dengan cara klik invite dan muncul beberapa metode invitation seperti email, sosmed, whatsapp, dst. 


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



## Detail Anggota (Diri sendiri) Improvement
Pada Sidebar Detil anggota (diri sendiri) tambahkan beberapa area/tombol berikut: 
- [ ] Area Lengkapi Profil | style bordered, hightlight background | Di dalam area terdapat progress bar kecil dengan persentase kelengkapan, diikuti keterangan teks kecil : Melengkapi profil 100% bisa memberikan poin pengabdian sebesar 20 poin, diikuti tombol Lengkapi Profil
- [ ] Badge Area | Heading : Badge Anda | Badge diperoleh dengan mengikuti atau mengaktifkan fitur-fitur keanggotaan, modul, dan usaha/program keluarga di Digsan.id

## Detail Anggota Keluarga (istri/suami, anak-anak, saudara, orang tua, dst)
- [x] Sidebar Detil Profil, fungsi link tombol Undang Pemilik Identitas alihkan ke Modal Buat Undangan (gambar silsilah) sama seperti tombol Undang di tree, perbedaannya ada di Pesan Undangan terdapat nama terundang. Ganti metode undangan pada Modal Buat Metode undangan dari tombol (download, bagikan, Whatsapp, Telegram) menjadi dropdown field sebelum Judul. Tergantung metode undangan yang dipilih, munculkan field yang perlu diisi sebelum bisa mengklik tombol Kirim / Cetak / Salin Tautan : Whatsapp perlu mengisi nomor whatsapp (+62xxxx), telegram (nomor/id telegram), Email (alamat email). 
- [x] Untuk keluarga yang telah meninggal dunia, pada bagian modal sidebar bagian Undang pemilik identitas perlu diubah menjadi Undang kerabat edit bersama yang mengacu pada aturan perijinan yang ada (bisa muncul list user(akun telah aktif) yang sesuai atau direkomendasikan)
- [x] Ubah layout dari halaman personal user di https://app.digsan.id/family/nama-keluarga/nama-user menjadi 3 kolom dengan kolom pertama ditempati data yang sekarang dimunculkan (id card, dan ajakan bergabung). Untuk kolom kedua nantinya diisi Aktifitas publik user bersangkutan (bisa dummy dulu), sementara kolom ketiga bisa diisi beberapa informasi seperti news dan trend di digsanid (bisa dummy dulu). 
- [x] Cek sudahkah user memiliki form detil profil untuk dilengkapi seperti nama tampilan/display name, tempat tanggal lahir, Short bio, Pendidikan terakhir, Pekerjaan, dst? Informasi itu nantinya bisa dimunculkan di https://app.digsan.id/family/farisma/nama-user kolom pertama di antara id-card dan ajakan bergabung, terlihat oleh user bersangkutan namun dapat disembunyikan di public view, bila belum ada buatkan dan di tempat di mana harusnya dimunculkan tambahkan tombol Lengkapi profil Anda (dibawahnya: Melengkapi profil mendapatkan 5 poin pengabdian). 
- [x] Halaman / link publik seperti https://app.digsan.id/family/nama-keluarga dan https://app.digsan.id/family/nama-keluarga/nama-user perlu perlindungan seperti session / expired dengan menambahkan key-unik/token di belakang link agar hanya bisa dilihat dalam jangka waktu tertentu, default 8 jam, namun bisa diatur secara khusus oleh super admin dari halaman admin, lewat dari itu akan membutuhkan login atau request link baru. Tiap user bila membuat invitation baru otomatis menggenerate token baru. Untuk halaman publik tersebut, untuk user pemilik akun/halaman ketika diri sendiri mengunjungi link publik harusnya tetap dalam kondisi login dengan fasilitas header lengkap;

## Sistem Notifikasi
- [x] Cek apakah sudah ada sistem notifikasi dibangun? Rekomendasikan sistem notifikasi yang komprehensif dan lengkap (email, push, bell, alarm), bangun dengan sistem yang dapat dikembangkan dan dikonfigurasi di admin seiring perkembangan aplikasi (karena saat ini masih proses pembangunan);
- [ ] Aktifkan Push notifikasi dan cek build whatsapp verifikasi dan invitation via whatsapp menggunakan fontee whatsapp gateway;
- [ ] Cek kemungkinan membangun self-host email server di console idcloudhost (di virtual server lain) yang memungkinkan dengan domain sendiri (@digsan.id), untuk kedepannya juga mendukung multi domain name, terhubung dengan fitur digsan.id di mana user bisa membuat email @digsan.id dengan gratis, membaca dan mengirim email di dashboard email .

### Notifikasi Role
#### Notifikasi untuk user
- [ ] Notifikasi bel meminta konfirmasi jalinan keluarga dari user lain dengan tombol Konfirmasi. Isi Notifikasi : Anda dimasukkan sebagai (misal pasangan/istri, adik, kakak, anak, orangtua/ayah) oleh nama user (diikuti nama family);
#### Notifikasi untuk user
- [ ] Notifikasi klaim yang datang dari user terhadap node tree yang dikelolanya. Sediakan halaman Klaim untuk mencocokkan data serta menerima atau menolak klaim;


## Share, Like, Reaction, Comment System

## User Post System
- [ ] Bangun kemampuan user membuat cerita, status, berita dan informasi dengan fasilitas bisa melampirkan link, gambar, video, audio (record/upload), dst;
- [ ]

## Chat System

## Sistem navigasi dan halaman detil
- [x] Membuat halaman Family | tree/nama-keluarga (misal tree/farisma-fam) : berisi keluarga kecil ayah, ibu, anak-anak saja dengan konten yang lebih lengkap dan personal (untuk dikembangkan lebih lanjut nanti);
- [x] Membuat halaman profil personal | tree/nama-keluarga/nama-publik-anda (misal tree/farisma-fam/arisnwh) : Halaman profil pribadi untuk diri sendiri yang nantinya bisa dikembangkan lebih lanjut

## Pengembangan Aktivitas Status
- [ ] Ubah mode dummy aktivitas lini masa ke real. Buat sistemnya dan jelajahi apa saja yang bisa dibangun untuk ditampilkan di lini masa aktivitas;


## Sistem Gamification
- [x] Buatkan halaman Admin untuk mengatur Sistem Gamification seperti Gami Konfigurasi: tempat membuat tipe poin (default poin pengabdian, poin aktivitas, dan poin produktivitas), Gami Stat & Logs : tempat statistik poin masing-masing tipe, peringkat top 10 member masing-masing tipe, serta listing history poin didapat dari user, action, jumlah poin, waktu, dst yang dilengkapi filter dan view detail (modal);
- [x] Gami Reward dan Redeem yang berisi pengaturan syarat dan hadiah yang diperoleh dari poin yang didapat oleh user, listing redeem request, dst;
- [ ] General Poin : Poin yang didapatkan dari sistem yang bisa didistribusikan dengan syarat tertentu ke tipe poin lain seperti poin pengabdian, aktivitas, maupun produktivitas;
- [x] Poin pengabdian : Pengabdian dalam menyelesaikan task, pengabdian dalam mengembangkan jaringan / koneksi keluarga
- [x] Poin aktivitas : Keaktifan dalam aplikasi, keaktifan dalam mengikuti kegiatan online / offline, keaktifan mengisi/mengupdate konten/status
- [x] Poin produktivitas : Keaktifan dalam kegiatan bersifat ekonomis, keaktifan dalam mengikuti keanggotaan, keaktifan dalam wadah usaha/program bersama.
- [ ] Bagaimanakah caranya menambah dan mengubah gamification role?
- [ ] Buatkan metode mendistribusikan poin secara manual dari dashboard admin dari admin ke user tertentu (super admin).

### Gamification Role
- [ ] Login tiap hari sekali mendapatkan aktivitas poin 2;
- [ ] Berturut-turun poin 5 hari mendapatkan bonus poin aktivitas 10 di luar poin login harian;
- [ ] Membuat akun baru (real user) dan mengaktifkannya baik inisiatif sendiri maupun dari undangan/klaim mendapatkan 100 general poin. Tidak termasuk akun ;
- [ ] Mengembangkan jaringan berupa penambahan aktif user di jaringan mendapatkan 10 poin pengabdian; 

## Sistem Tree Keluarga / Family
- [x] Sebelum bisa mengakses pengaturan bagan atau pertama kali seorang user login dan belum memiliki bagan atau tree, perlu ada intro dalam bentuk modal yang berisi step by step Mulai Membangun Silsilah. Modal muncul menutupi bagan tree dan navigasi lainnya tanpa tanda close (tidak bisa diclose) : 
- [x] Step pertama diawali dengan pertanyaan Bagaimana Anda memulai silsilah? terdapat dua opsi : 1. Mencari keluarga (perlu membangun sistem user dan family search serta filter), 2. Mulai dari 0 yang akan memunculkan form pada Pengaturan bagan namun secara terpisah. Berbasis opsi yang dipilih, step 2 dimunculkan : 
- [x] Opsi pertama memunculkan field Cari keluarga (ajax) berbasis 3 huruf sebagai hint/pemanggil yang akan menelusuri pencarian dan memunculkan list nama orang atau nama family (thumbnail user dan nama orang/family). bila user terkait bergabung berdasarkan undangan, terdapat list pengundang langsung muncul di bawah field pencarian dengan keterangan Apakah nama pengundang adalah Anggota keluarga Anda? Demikian juga berlaku bila hasil pencarian memunculkan hasil, terdapat keterangan ketika list dihover: Apakah dia anggota keluarga Anda?Jika jawaban ya, maka step berikutnya dimunculkan : heading Konfirmasi hubungan Anda diikuti list user pengundang/yang dipilih (thumbnail dan nama user) dan peran user sebagai apanya pengundang (sesuai undangan/berdasarkan pilihan). Di bawahnya terdapat tombol Simpan dan Sesuaikan yang berfungsi menyimpan hasil koneksi yaitu menyamakan nama family dengan nama family pengundang dan mengupdate bagan keluarga utama, setelah itu berlanjut ke form Keluarga besar;
- [x] Opsi kedua memunculkan kumpulan field dengan heading Buat Keluarga Utamamu dengan isi field sama seperti field keluarga utama pada Pengaturan Bagan yaitu Nama Family, Jumlah Pasangan (suami/istri), Jumlah Anak. Terdapat tombol Simpan dan Lanjut yang bila diklik akan menyimpan pengaturan keluarga utama dan berlanjut ke Form Keluarga Besar;
- [x] Form Keluarga besar : Berupa form lanjutan dengan headning Buatlah Keluarga Besarmu yang dimaksudkan untuk menyusun keluarga di atas user dengan field sama seperti form pada Pengaturan Bagan Keluarga besar (seperti Nama Family keluarga besar, Jumlah Orang tua, jumlah saudara (kakak), jumlah saudara (adik)) diikuti tombol Simpan dan Lanjut yang bila diklik akan menyimpan konfigurasi dan berlanjut ke Form Keluarga Simbah dengan isi sama seperti form pada Pengaturan Bagan lalu diikuti tombol Simpan dan Bangun yang berfungsi menyimpan hasil pengaturan tree dan menutup modal dengan hasil bagan tree telah diperbarui;
- [x] Pada anggota keluarga baru (selain diri sendiri) yang bisa kita buat sesuai kapasitas/role kita yaitu pasangan (suami/istri), anak, saudara, ayah dan ibu, kita bisa menambahkan identifikasi di form Detail Anggota yang bisa dijadikan acuan pencocokan yaitu melalui Form Nama lengkap yang ditambah fungsi pencarian User (ajax 3 karakter) untuk mencari anggota yang sudah aktif yang bila ditemukan dan dipilih akan diikuti konfirmasi: Anda yakin dia anggota keluarga Anda? Ya akan otomatis menambahkan nama anggota tersebut ke dalam field, yang kedua melalui form email dan nomor whatsapp sebagai form baru di bawah nama lengkap. Sistem akan mempertimbangkan bila dua dari tiga informasi (nama dan email atau nama dan whatsapp) tersebut di atas tepat maka konfirmasi persetujuan akan dikirimkan ke user terkait melalui notifikasi bel dan ketika disetujui maka hubungan keluarga akan terjalin;  

### Tree Improvement
- [ ] Perlu dipastikan bahwa anggota keluarga utama (family) hanya terdiri atas diri sendiri, pasangan (suami/istri), dan anak-anak, baik yang masih ada maupun yang sudah meninggal dunia, role super user dapat menambahkan pasangan dan anak-anaknya ke dalam family yang dia buat;
- [ ] Perlu dipastikan bahwa anggota keluarga besar akan terdiri atas beberapa node family (keluarga utama). Pada tree (app.digsan.id/tree) perlu dibuat opsi tombol dropdown View Mode: Single Mode (1) (yang sekarang) di mana display jaringan atau tree berbasis user dan Family Mode (2) di mana jaringan dibuat antar keluarga utama (diri sendiri, pasangan, dan anak-anak), ke atas akan terhubung dengan family orang tua (yang terdiri atas diri sendiri, orang tua, kakak dan adik sendiri), ke samping (kanan kalau Anda pria/suami, kiri kalau Anda istri/perempuan) terhubung ke family keluarga pasangan (diri pasangan Anda, orang tua pasangan Anda, kakak dan adik pasangan Anda), baik yang masih ada maupun yang sudah meninggal dunia;
- [ ] Perlu dipastikan bahwa anggota keluarga simbah akan terdiri atas keluarga utama kakek-nenek Anda yang terdiri kakek dan nenek dari ibu Anda, juga kakek nenek dari ayah Anda, kemudian keluarga utama kakek dan nenek pasangan Anda yang terdiri atas kakek-nenek dari ayah pasangan Anda serta kakek-nenek dari ibu pasangan Anda. Termasuk juga nantinya garis lurus ke samping kanan kakak-kakak dari ayah dan ibu serta ayah dan ibu pasangan Anda, garis samping kiri adik-adik dari ayah dan ibu Anda serta ayah dan ibu pasangan Anda;
- [ ] Tree antar kelompok keluarga perlu dibangun. Menu Expand akan memunculkan dua pilihan User mode (yang sekarang) dan Family Mode (akan menjadi default kalau sudah jadi) dengan gambaran layout baru Family Mode yang perlu dibuat sebagai berikut : Family Slug perlu memiliki halaman edit yang lebih komprehensif (page family edit) dengan tambahan data (field baru) seperti Family Image dan Family Cover (fitur upload gambar) beserta field yang sebelumnya ada di Pengaturan Bagan (seperti nama family beserta edit slug, jumlah pasangan, jumlah anak), Anggota tergabung, lalu ada text area field untuk Family Bio, tanggal pernikahan (tgl, bulan, tahun), Status Pernikahan (Tanpa Status, Berlangsung, Cerai hidup, Cerai mati) untuk nantinya membentuk profil family yang lebih lengkap (app.digsan.id/family/nama-family). Lingkaran utama akan ditempati family user sebagai family induk. Family Image akan digunakan untuk mengisi lingkaran dengan label nama Family dibawahnya. Ketika diklik muncul lingkaran kecil anggota family mengelilinginya mulai dari kiri Suami/Kepala Keluarga, diikuti Istri/Pasangan, diikuti oleh anak-anaknya (lebih dari 2 anak akan ada lingkaran dengan tanda + yang bisa diexpand). Garis hubungan ke atas akan bercabang dua dengan sebelah kiri nama family Ortu Suami/Kepala Keluarga, sebelah kanan nama family ortu pasangan/istri. Garis ke bawah lurus lalu membuat cabang sesuai jumlah family anak bila anak sudah berkeluarga, namun bila tidak ada dikosongkan karena berarti masih di dalam family induk.

### Node Improvement
- [ ] Node perlu memiliki fitur untuk menambah, mengedit, dan menghapus anggota keluarga dalam bentuk icon kecil yang muncul pada saat sebuah node/lingkaran dihover;
- [ ] Icon + yang muncul di keempat sudut bagian luar node (icon warna putih dibalut lingkaran warna hijau) yang berfungsi membuat node baru sesuai posisi icon (misal klik icon + yang berada di kanan node akan menambah node baru di sebelah kanan node saat ini);
- [ ] Tombol Hapus Profil di sidebar Detil Anggota (dibawah tombol edit profil);

## Role Improvement
Mengatur perijinan dari member / anggota digsan.

### Super User (super_user)
- [ ] Bisa membuat node unlimited dari node-node turunan dari misalnya node paman-pamannya (saudara ayah dan ibu) atau node kakak dan adiknya; 
- [ ] Bisa membuat early access berupa pembuatan username (email) dan password untuk node yang dibuatnya, tidak terbatas pada anak-anak, pasangannya, serta kedua orang tua saja, tapi dari seluruh jaringan yang dibuatnya. Dia akan melihat form pembuatan akses (alamat email dan password) tersedia di sidebar detil anggota node/lingkaran yang dibuatnya;
-[ ] Early access memungkinkan login ke node user terkait tanpa perlu menempuh proses verifikasi akun dengan tujuan mengisi data profil general saja (seperti form di edit profil user); 
- [ ] Memiliki akses ke list / daftar node yang dibuatnya secara lengkap seperti nama lengkap, alamat email, nomor telepon status keanggotaan (aktif/pasif) 
 

### User (user)
- [ ] Setelah berhasil login dan menverifikasi keanggotaannya, otomatis role user didapatkan. Keanggotaan aktif setelah user menverifikasi dengan mengklik verifikasi link (email) atau whatsapp (token). Dari sana dia dapat membuat tree baru atau melakukan klaim terhadap node yang dibuat oleh user lain untuk kemudian bila klaim diterima dia dapat melakukan pengaturan jumlah node keluarga utama miliknya hingga keluarga simbahnya;
- [ ] User dapat menjadi super_user dengan syarat memiliki kemampuan dan kemauan mengembangkan tree yang dibuatnya;
- [ ] Disediakan tombol Upgrade super_user yang akan memunculkan modal request form yang ditujukan ke super admin (via email dan bel notifikasi) untuk menjadikan dirinya sebagai super_user. Di Modal tersebut dijelaskan secara ringkas fungsi dan akses yang dimiliki super_user.

### World Tree
- Pelajari tentang D3.js dan apa saja kemampuan dan yang bisa dilakukannya dan bisakah membangun View Mode World Tree dengan konsep sbb:
- Pelajari Neo4j and PostgreSQL integrasi untuk mengakomodir jaringan rumit dan komplek hubungan keluarga nantinya. Dengan kemungkinan di masa depan aplikasi berkembang sangat masif dan membutuhkan pencarian silsilah yang super kompleks (misalnya: mencari hubungan sepupu derajat ke-12 secara instan), bisa menggunakan arsitektur Hybrid.PostgreSQL / MySQL: Digunakan sebagai database utama (Source of Truth). Menyimpan data pengguna, profil lengkap, foto, modul artikel, sistem langganan, dan data transaksi aplikasi. Neo4j (Graph DB): Digunakan hanya sebagai microservice khusus silsilah. Database ini hanya menyimpan ID, Nama, dan Hubungan (sangat ringan). Cara Kerjanya: Ketika pengguna membuka modul silsilah, backend aplikasi akan meminta peta struktur jaringan (node & edges) dari Neo4j, lalu mencocokkan ID tersebut ke PostgreSQL untuk mengambil data profil lengkap dan fotonya. ;
- Saya ingin membangun mode view World Tree yang secara gambaran kasar menjadikan Adam dan Hawa sebagai node/lingkaran pusat dengan garis-garis konektor membentuk lingkaran ke luar sebagai ilustrasi. Lingkaran terluar akan diisi oleh user-user yang mendaftar di digsan.id yang bisa memperdalam koneksinya dengan mengisi node-node kosong seperti ayah ibu, kakek, nenek, kakek buyut, nenek buyut dan seterusnya. 

### Sistem Perijinan
- [x] Role super-user | Agar tidak bingung dalam menentukan kuasa terhadap silsilah keluarga, buatkan role tambahan dengan nama super-user yang otomatis dimiliki oleh user pembuat silsilah keluarganya yang pertama kali;
- [x] Untuk orang tua, saudara orang tua, dan anak-anak yang secara usia belum cukup umur/belum memiliki identitas ktp, baik yang masih hidup maupun yang sudah meninggal dunia dapat dikelola dan diedit profil dan silsilahnya oleh orang yang membuat silsilah tanpa perlu meminta ijin (super-user) yang bersangkutan. Yang perlu ijin adalah ketika hendak mengedit silsilah atau detil anggota telah berstatus user aktif/menerima invitation; 

### Sistem Labeling
- [x] Pria (suami) di halaman publik tree akan diberi tambahan label Kepala Keluarga
- [x] Anak-anak di halaman publik tree akan diberi tambahan label Anak+angka+jenis kelamin(pa/pi)

### Sistem Invitation
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
- [x] User terundang setelah login dihadapkan oleh tree yang masih kosong, padahal dirinya diminta untuk melengkapi tree yang sudah dibuat oleh suami/istri atau kerabatnya misalnya dalam satu kesatuan keluarga/family. Sehingga ketika dicek di Pengaturan Bagan, sudah ada nama Keluarga Utama atau kelompok keluarga besar di sana. Harusnya sudah ada bagan dari keluarga tersebut dan dirinya tinggal menverifikasi bahwa dirinya yang ada di lingkaran atau tree tersebut.
- [x] Mungkinkah email invitation bisa menyertakan logo digsan.id di header invitationnya, kalau tidak salah di folder apps/web/public/logo-white.svg (sekarang tulisan Digsan) dan bersama pesan invitation disertakan avatar si pengirim (kiri avatar, kanan pesan);
- [ ] Warna background header email invitation perlu dibuat dark (biru gelap) agar logo terlihat. Bila ada teks menyertainya buat menjadi warna putih.

## Sistem Advertising
Sistem untuk admin mengelola spot iklan yang bisa digunakan untuk mempromosikan program, kegiatan, atau ajakan internal hingga disewakan secara komersial baik untuk internal anggota digsanid maupun eksternal seperti Adsense maupun lainnya;

- [x] Admin menu Advertising | Dashboard admin yang mencakup statistik dan informasi total pemasukan iklan, jumlah spot, diikuti list spot, siapa yang pakai, dan durasi atau spot due date;
- [x] Ads Builder | Sebuah panel khusus yang terhubung dengan ai (open router) yang memungkinkan menggenerate gambar dari prompt, dengan fitur bisa diaktifkan/dipilih seperti dengan / tanpa tulisan, bentuk huruf dan jenis font, pewarnaan, mendukung berbagai ukuran banner (aspek rasio), dsb
- [x] Ads Manager | Mengatur tiap spot diisi banner apa, untuk siapa, durasi/due date, tarif, discount role, serta toggle aktif/tidak.

### Spot Advertising
- [ ] Banner id dash-in disediakan untuk dapat menampung banner dengan ratio 3:1 pada app.digsan.id/dashboard box Informasi, diletakkan di bawah tulisan Informasi
- [ ] Banner Modal Left-Tree pada halaman app.digsan.id/tree dengan posisi top-left di bawah navigasi tree yang dapat diisi 3 Banner id ratio 1:1 tree-l-r1/1-01, tree-l-r1/1-02, tree-l-r1/1-03, atau dua banner id aspek rasio 1:2 tree-l-r1/2 dan aspek rasio 1:1 tree-l-1/1-01, atau 1 banner aspek rasio 1:3 tree-l-r1/3;  
- [ ] Ubah spot banner yang tersedia menjadi select / dropdown agar tidak perlu mengisi manual;


## Sistem Ai Asisten / Helper
- [ ] Apa yang diperlukan agar digsan.id dapat memunculkan data analisis berbasis database yang dihimpun yang kemudian diikuti dengan aksi merekomendasikan hubungan antar tree yang belum terhubung misalnya keluarga si A direkomendasikan untuk menjalin koneksi dengan keluarga si B (juga sebaliknya) karena memiliki keterkaitan/kesamaan silsilah kakek / nenek atau paman atau buyut, atau lainnya?

## Digsan Profil
### Digsan Profile Completenest
### Digsan Profile Tree
### Digsan Investment Area

## Fasilitas Digsan.id
- [ ] Chat Keluarga | Sistem percakapan antar anggota keluarga dari yang private antar anggota keluarga, antar anggota keluarga dalam keluarga besar, lintas keluarga besar, hingga keluarga simbah dan buyut, dengan pengaturan privasi dan allow/disallow, block dan unblock, show dan disable;
- [ ] Digital Membercard multifungsi dengan foto profil, nomor keanggotaan, nama lengkap, alamat, qrcode yang bila discan mengarah ke profil public user tersebut atau untuk transaksi tukar poin antar anggota (bila fitur telah tersedia);
- [ ] MMBC Membership | Diberikan gratis kepada anggota yang telah memiliki KTP dan smartphone. MMBC Tour & Travel adalah platform layanan digital yang memungkinkan Anda memesan tiket pesawat, hotel, kereta api, hingga mengurus pembayaran tagihan (PLN, PDAM, pulsa) dan transfer uang dalam satu aplikasi;
- [ ] Doa Almarhum, berupa susunan nama-nama keluarga yang telah almarhum (nama almarhum binti orangtua) dari yang terdekat hingga yang terjauh, yang bisa diatur kedalamannya melalui filter yang komprehensif, bisa di atur font-size, ketebalan, perataan sebelum dicetak/download dalam bentuk print, jpg, maupun pdf | Otomatis aktif ketika lebih dari 5 Family tree terhubung;
- [ ] Personal Channel | Personal Branding seperti Youtube channel namun lebih luas tidak terbatas hanya video, namun juga blog/artikel, update status, upload gambar/galeri, atau share lainnya. Fitur pengembangan halaman profil user;
- [ ] Arisan Keluarga | Fasilitas membuat arisan yang bisa diaktifkan ketika sebuah koneksi telah menghubungkan lebih dari 50 orang dengan user aktif mencapai 70% lebih;
- [ ] Koperasi Keluarga | Fasilitas upgrade keanggotaan yang akan aktif dalam bentuk penawaran kepada user yang telah ber-ktp atau memiliki pekerjaan;
- [ ] Digsan Komunitas | Memadukan kesenangan bersosial media seperti berbagi momen/status, kegiatan, kabar-kabar, informasi, dsb beserta interaksinya seperti like, reaction, share, comment kepada keluarga / lintas keluarga / umum; 
- [ ] Digsan Usaha | Fasilitas mempromosikan atau membangun usaha dan memunculkan dalam bentuk listing dan landingpage profil usaha milik sendiri dengan konten yang dapat diedit;
- [ ] Digsan Kerja | Marketplace jasa dan kerja Keluarga. Fasilitas menawarkan jasa diri sesuai keahlian, definisi pekerjaan, dan waktu kerja yang bisa ditentukan sendiri; 

## Backend Admin
- [x] Cek apakah ada user role admin dan ketersediaan akses ke dashboard admin dsb; (Sudah ada: role `admin`/`super_admin`/`worker` + `RolesGuard`; backend `AdminController` (`/api/admin/*`: dashboard, users, workers, orders, settings, configs) dan halaman web `app/(dashboard)/admin/` (page, users, workers, settings).)
- [x] Admin memiliki dashboard relatif sama dengan tampilan app.digsan.id namun memiliki area konten berupa tree yang mencakup perkembangan jaringan semua keluarga dalam satu map besar dengan sistem filter, search, bisa mengklik semua lingkaran yang ada untuk melihat profil atau informasi yang ada.
- [x] buatkan script untuk menjadikan user dengan alamat email digsanid@gmail.com sebagai superadmin untuk dijalankan di ssh.

*Terakhir diperbarui: Juli 2026*

