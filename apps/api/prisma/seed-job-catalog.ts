import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('Seeding job catalog...');

  // ─── CATEGORIES ──────────────────────────────────────────────
  const categories = [
    { name: 'Pembersihan Rumah', slug: 'pembersihan-rumah', icon: 'home', order: 1 },
    { name: 'Perbaikan Elektronik', slug: 'perbaikan-elektronik', icon: 'wrench', order: 2 },
    { name: 'Jasa Digital', slug: 'jasa-digital', icon: 'monitor', order: 3 },
    { name: 'Jasa Kebersihan Diri', slug: 'jasa-kebersihan-diri', icon: 'scissors', order: 4 },
    { name: 'Jasa Kuliner', slug: 'jasa-kuliner', icon: 'utensils', order: 5 },
    { name: 'Jasa Angkut & Pindah', slug: 'jasa-angkut-pindah', icon: 'truck', order: 6 },
    { name: 'Jasa Taman & Lingkungan', slug: 'jasa-taman-lingkungan', icon: 'leaf', order: 7 },
    { name: 'Jasa Pendidikan', slug: 'jasa-pendidikan', icon: 'book-open', order: 8 },
  ];

  for (const cat of categories) {
    await prisma.jobCategory.upsert({
      where: { slug: cat.slug },
      update: cat,
      create: cat,
    });
  }

  // ─── SUB-CATEGORIES & SERVICES ───────────────────────────────
  const catalog: { categorySlug: string; subs: { name: string; slug: string; services: { name: string; slug: string; basePrice: number; priceUnit: string; description?: string }[] }[] }[] = [
    {
      categorySlug: 'pembersihan-rumah',
      subs: [
        {
          name: 'Pembersihan Umum',
          slug: 'pembersihan-umum',
          services: [
            { name: 'Cleaning Rumah Lengkap', slug: 'cleaning-rumah-lengkap', basePrice: 150000, priceUnit: 'per rumah', description: 'Pembersihan menyeluruh seluruh ruangan rumah' },
            { name: 'Pel & Sapu Lantai', slug: 'pel-sapu-lantai', basePrice: 50000, priceUnit: 'per ruangan', description: 'Menyapu dan mengepel lantai' },
            { name: 'Cuci Jendela & Kaca', slug: 'cuci-jendela-kaca', basePrice: 75000, priceUnit: 'per jendela', description: 'Pembersihan kaca dan jendela hingga kinclong' },
          ],
        },
        {
          name: 'Cuci Sofa & Karpet',
          slug: 'cuci-sofa-karpet',
          services: [
            { name: 'Cuci Sofa', slug: 'cuci-sofa', basePrice: 200000, priceUnit: 'per sofa', description: 'Pencucian sofa dengan alat khusus' },
            { name: 'Cuci Karpet', slug: 'cuci-karpet', basePrice: 100000, priceUnit: 'per meter', description: 'Pencucian karpet rumah dan kantor' },
          ],
        },
      ],
    },
    {
      categorySlug: 'perbaikan-elektronik',
      subs: [
        {
          name: 'Perbaikan AC',
          slug: 'perbaikan-ac',
          services: [
            { name: 'Servis AC Cuci', slug: 'servis-ac-cuci', basePrice: 100000, priceUnit: 'per unit', description: 'Cuci AC dan pembersihan filter' },
            { name: 'Isi Freon AC', slug: 'isi-freon-ac', basePrice: 150000, priceUnit: 'per unit', description: 'Pengisian freon AC' },
            { name: 'Perbaikan AC Tidak Dingin', slug: 'perbaikan-ac-tidak-dingin', basePrice: 200000, priceUnit: 'per unit', description: 'Diagnosa dan perbaikan AC tidak dingin' },
          ],
        },
        {
          name: 'Perbaikan Mesin Cuci',
          slug: 'perbaikan-mesin-cuci',
          services: [
            { name: 'Servis Mesin Cuci Tidak Berputar', slug: 'servis-mesin-cuci-tidak-berputar', basePrice: 150000, priceUnit: 'per unit', description: 'Perbaikan mesin cuci yang tidak berputar' },
            { name: 'Ganti Part Mesin Cuci', slug: 'ganti-part-mesin-cuci', basePrice: 100000, priceUnit: 'per part', description: 'Penggantian sparepart mesin cuci' },
          ],
        },
        {
          name: 'Perbaikan Kulkas',
          slug: 'perbaikan-kulkas',
          services: [
            { name: 'Servis Kulkas Tidak Dingin', slug: 'servis-kulkas-tidak-dingin', basePrice: 200000, priceUnit: 'per unit', description: 'Diagnosa dan perbaikan kulkas tidak dingin' },
          ],
        },
      ],
    },
    {
      categorySlug: 'jasa-digital',
      subs: [
        {
          name: 'Desain Grafis',
          slug: 'desain-grafis',
          services: [
            { name: 'Desain Logo', slug: 'desain-logo', basePrice: 250000, priceUnit: 'per desain', description: 'Pembuatan logo profesional' },
            { name: 'Desain Banner & Flyer', slug: 'desain-banner-flyer', basePrice: 150000, priceUnit: 'per desain', description: 'Desain banner promosi dan flyer' },
            { name: 'Desain Kartu Nama', slug: 'desain-kartu-nama', basePrice: 100000, priceUnit: 'per desain', description: 'Desain kartu nama profesional' },
          ],
        },
        {
          name: 'Web & App Development',
          slug: 'web-app-development',
          services: [
            { name: 'Pembuatan Website Company Profile', slug: 'pembuatan-website-company-profile', basePrice: 1500000, priceUnit: 'per project', description: 'Website company profile responsif' },
            { name: 'Pembuatan Toko Online', slug: 'pembuatan-toko-online', basePrice: 2000000, priceUnit: 'per project', description: 'Toko online dengan fitur keranjang dan pembayaran' },
          ],
        },
        {
          name: 'Sosial Media Management',
          slug: 'sosial-media-management',
          services: [
            { name: 'Manajemen Instagram', slug: 'manajemen-instagram', basePrice: 500000, priceUnit: 'per bulan', description: 'Kelola konten dan engagement Instagram' },
            { name: 'Pembuatan Konten Feed', slug: 'pembuatan-konten-feed', basePrice: 50000, priceUnit: 'per konten', description: 'Desain konten feed Instagram' },
          ],
        },
      ],
    },
    {
      categorySlug: 'jasa-kebersihan-diri',
      subs: [
        {
          name: 'Pangkas Rambut',
          slug: 'pangkas-rambut',
          services: [
            { name: 'Pangkas Rambut Pria', slug: 'pangkas-rambut-pria', basePrice: 30000, priceUnit: 'per sesi', description: 'Pangkas rambut pria di rumah' },
            { name: 'Pangkas Rambut Anak', slug: 'pangkas-rambut-anak', basePrice: 25000, priceUnit: 'per sesi', description: 'Pangkas rambut anak di rumah' },
          ],
        },
        {
          name: 'Perawatan Kulit',
          slug: 'perawatan-kulit',
          services: [
            { name: 'Cuci Wajah / Facial', slug: 'cuci-wajah-facial', basePrice: 100000, priceUnit: 'per sesi', description: 'Facial dan perawatan wajah' },
          ],
        },
      ],
    },
    {
      categorySlug: 'jasa-kuliner',
      subs: [
        {
          name: 'Catering',
          slug: 'catering',
          services: [
            { name: 'Catering Harian', slug: 'catering-harian', basePrice: 25000, priceUnit: 'per porsi', description: 'Catering harian untuk individu' },
            { name: 'Catering Acara', slug: 'catering-acara', basePrice: 50000, priceUnit: 'per porsi', description: 'Catering untuk acara dan rapat' },
          ],
        },
        {
          name: 'Jasa Masak',
          slug: 'jasa-masak',
          services: [
            { name: 'Jasa Masak Harian', slug: 'jasa-masak-harian', basePrice: 100000, priceUnit: 'per hari', description: 'Juru masak untuk kebutuhan harian di rumah' },
          ],
        },
      ],
    },
    {
      categorySlug: 'jasa-angkut-pindah',
      subs: [
        {
          name: 'Pindahan',
          slug: 'pindahan',
          services: [
            { name: 'Jasa Pindah Rumah', slug: 'jasa-pindah-rumah', basePrice: 1000000, priceUnit: 'per pindahan', description: 'Pindah rumah lengkap dengan packing dan transport' },
            { name: 'Jasa Angkut Barang', slug: 'jasa-angkut-barang', basePrice: 300000, priceUnit: 'per trip', description: 'Angkut barang dengan truk' },
          ],
        },
      ],
    },
    {
      categorySlug: 'jasa-taman-lingkungan',
      subs: [
        {
          name: 'Perawatan Taman',
          slug: 'perawatan-taman',
          services: [
            { name: 'Pemangkasan Tanaman', slug: 'pemangkasan-tanaman', basePrice: 75000, priceUnit: 'per sesi', description: 'Pemangkasan tanaman dan pohon' },
            { name: 'Penanaman Rumput', slug: 'penanaman-rumput', basePrice: 150000, priceUnit: 'per meter', description: 'Penanaman rumput baru' },
          ],
        },
        {
          name: 'Pembersihan Lingkungan',
          slug: 'pembersihan-lingkungan',
          services: [
            { name: 'Pembersihan Selokan', slug: 'pembersihan-selokan', basePrice: 100000, priceUnit: 'per sesi', description: 'Pembersihan selokan dan drainase' },
          ],
        },
      ],
    },
    {
      categorySlug: 'jasa-pendidikan',
      subs: [
        {
          name: 'Les Privat',
          slug: 'les-privat',
          services: [
            { name: 'Les Matematika SD', slug: 'les-matematika-sd', basePrice: 50000, priceUnit: 'per jam', description: 'Les privat matematika tingkat SD' },
            { name: 'Les Bahasa Inggris', slug: 'les-bahasa-inggris', basePrice: 75000, priceUnit: 'per jam', description: 'Les privat bahasa Inggris' },
            { name: 'Les Matematika SMP/SMA', slug: 'les-matematika-smp-sma', basePrice: 100000, priceUnit: 'per jam', description: 'Les privat matematika SMP/SMA' },
          ],
        },
        {
          name: 'Pelatihan Komputer',
          slug: 'pelatihan-komputer',
          services: [
            { name: 'Pelatihan Microsoft Office', slug: 'pelatihan-microsoft-office', basePrice: 150000, priceUnit: 'per jam', description: 'Pelatihan Word, Excel, PowerPoint' },
            { name: 'Pelatihan Desain Grafis', slug: 'pelatihan-desain-grafis', basePrice: 200000, priceUnit: 'per jam', description: 'Pelatihan Photoshop, Illustrator, Canva' },
          ],
        },
      ],
    },
  ];

  for (const cat of catalog) {
    const category = await prisma.jobCategory.findUnique({ where: { slug: cat.categorySlug } });
    if (!category) continue;

    for (const sub of cat.subs) {
      const { services: _svc, ...subData } = sub;
      const subCat = await prisma.jobSubCategory.upsert({
        where: { slug: sub.slug },
        update: { ...subData, categoryId: category.id },
        create: { ...subData, categoryId: category.id },
      });

      for (const svc of sub.services) {
        await prisma.jobService.upsert({
          where: { slug: svc.slug },
          update: { ...svc, subCategoryId: subCat.id },
          create: { ...svc, subCategoryId: subCat.id },
        });
      }
    }
  }

  console.log('Job catalog seeded successfully!');
  console.log(`Categories: ${categories.length}`);

  // Count
  const subs = await prisma.jobSubCategory.count();
  const services = await prisma.jobService.count();
  console.log(`Sub-categories: ${subs}`);
  console.log(`Services: ${services}`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
