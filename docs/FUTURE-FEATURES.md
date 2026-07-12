# Future Featurs Roadmap
- [x] Pada sidebar modal Detil Anggota, untuk pertama kalinya perlu disediakan form setup bagan tree dengan Pengelompokan : (heading) Keluarga utama dengan rincian field Nama Family, Jumlah pasangan (suami/istri|default 1), jumlah anak (number | default 2), Kelompok Keluarga Besar dengan rincian field: Nama Family; Jumlah Orang Tua (number | Default 2),Jumlah Saudara (Kakak)(number|default 2), Jumlah Saudara (Adik)(number:default 2), Kelompok Keluarga Simbah dengan rincian field: Jumlah Simbah (Kakek-Nenek) dari pihak Ayah (number|default 2), Jumlah Simbah dari pihak Ibu (number|default 2). Di bawah field di atas perlu ditambahkan bahwa jumlah di atas termasuk yang sudah meninggal
- [x] Ketika field setup awal disimpan, bagan tree akan melakukan struktur ulang bardasarkan pengaturan baru di atas. 
- [x] Bila bagan sudah terisi penuh sampai ke Kelompok Keluarga Simbah, Ada bagan garis ke atas (lurus) muncul di atas lingkaran Simbah baik dari pihak Ayah maupun Ibu yang otomatis dibuat namun hanya terlihat bila expand All diberlakukan lalu discroll ke atas yaitu Buyut, Canggah, Wareng, Udheg-udheg, Gantung siwur, Gropak senthe. 
- [x] User dapat mengisi bagan tree selain dirinya (misal istri, kakak, adik, orang tua, anak) yang dibuatnya sebatas mengisi nama lengkap, jenis kelamin, status kehidupan (hidup/meninggal dunia), dan upload foto profil. Untuk mengisi data lengkap nantinya akan ada fitur invite kepada pemilik identitas dengan cara klik invite dan muncul beberapa metode invitation seperti email, sosmed, whatsapp, dst.  

## Tree Improvisasi
- [x] Ketika user mengklik lingkaran profil orang lain (yang masih memiliki garis penghubung), selain memunculkan modal berisi Detil anggota / user tersebut juga membuat circle/lingkaran terpilih tersorot dan membesar, sementara profil sebelumnya mengecil ke semula.
- [x] Untuk profil yang telah memiliki foto, nama mereka menghilang. Bisakah tetap ada namun ditempatkan di luar lingkaran? Bisa di bawah lingkaran, sedikit menyinggung lingkaran, dilindungi border dan blur background.
- [ ] **Guardianship rekursif & perizinan (silsilah lengkap antar-jaringan).** Saya memiliki orang tua yang salah satunya telah meninggal dunia, yaitu Ayah saya. Selain Ibu saya, seharusnya saya juga bisa mengedit dan mengelola tree Ayah agar tetap memiliki cabang ke keluarganya (saudaranya, orang tuanya = kakek-nenek saya, serta kakek-neneknya = buyut saya). Prinsip umum yang diinginkan:
  - Setiap orang dapat menjadi "akar" sub-tree sendiri.
  - Untuk **siapa pun yang memiliki hubungan langsung dengan saya namun telah meninggal**, saya (sebagai wali yang masih hidup) dapat mengakses setup awal orang tersebut (mengatur jumlah pasangan/saudara/orang tua/anak, dst.) dan mengeditnya. Berlaku **rekursif** — bila di dalam jaringan Ayah terdapat anggota yang juga meninggal, saya bisa mengaksesnya juga (jika memilih mengisinya).
  - Untuk anggota yang **masih hidup** (mis. Ibu), saya **tidak** memiliki akses mengelola jaringannya tanpa izin melalui akun beliau → perlu **fitur perizinan/konsen**.
  - **Wali bersama:** saudara Ayah yang masih hidup dan akunnya aktif juga memiliki akses edit yang sama atas jaringan almarhum.
  - Catatan teknis: layout saat ini masih config-driven (topologi tetap). Rencana bertahap: (1) spesifikasi + model data; (2) layout graf rekursif berbasis relasi `FamilyMember` (parentId/spouseId/children) menggantikan `generateTree`; (3) form setup per-almarhum yang membuat record `FamilyMember` sungguhan; (4) alur perizinan anggota hidup + guardianship bersama.

## Sistem Notifikasi

## Sistem Invitation
- [ ] Sistem mengirim invitation via Whatsapp. Telusuri dan temukan cara bagaimana mengirim pesan undangan yang diteruskan ke nomor whatsapp dengan aman, terhindar dari anggapan spam, dan bisa langsung memberikan hasil signifikan (terundang mengunjungi profil yang dibuat user pengundang dan bisa register memakai nomor whatsappnya);


## Sistem Ai Asisten / Helper
- [ ] Apa yang diperlukan agar digsan.id dapat memunculkan data analisis berbasis database yang dihimpun yang kemudian diikuti dengan aksi merekomendasikan hubungan antar tree yang belum terhubung misalnya keluarga si A direkomendasikan untuk menjalin koneksi dengan keluarga si B (juga sebaliknya) karena memiliki keterkaitan/kesamaan silsilah kakek / nenek atau paman atau buyut, atau lainnya?

*Terakhir diperbarui: Juli 2026*
