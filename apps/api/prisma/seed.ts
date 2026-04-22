import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Seeding database...');

  // Create default roles
  const roles = ['user', 'worker', 'admin', 'super_admin'];

  for (const name of roles) {
    await prisma.role.upsert({
      where: { name },
      update: {},
      create: {
        name,
        description: `${name.charAt(0).toUpperCase() + name.slice(1).replace('_', ' ')} role`,
      },
    });
    console.log(`  ✓ Role: ${name}`);
  }

  // Create system settings
  await prisma.systemSettings.upsert({
    where: { key: 'app_name' },
    update: {},
    create: { key: 'app_name', value: 'Digsan', label: 'App Name', description: 'Application name', category: 'general' },
  });

  await prisma.systemSettings.upsert({
    where: { key: 'maintenance_mode' },
    update: {},
    create: { key: 'maintenance_mode', value: 'false', label: 'Maintenance Mode', description: 'Maintenance mode toggle', category: 'general', type: 'boolean' },
  });

  console.log('  ✓ System settings');

  // ─── JOB CATALOG SEED DATA ──────────────────────────────────

  const jobCategories = [
    {
      name: 'Kebersihan',
      slug: 'kebersihan',
      description: 'Layanan kebersihan rumah dan kantor',
      icon: 'cleaning',
      order: 1,
      subCategories: [
        {
          name: 'Bersih Rumah',
          slug: 'bersih-rumah',
          description: 'Pembersihan rumah secara menyeluruh',
          order: 1,
          services: [
            { name: 'Deep Cleaning', slug: 'deep-cleaning', basePrice: 150000, priceUnit: 'per jam', duration: 3, order: 1 },
            { name: 'Regular Cleaning', slug: 'regular-cleaning', basePrice: 75000, priceUnit: 'per jam', duration: 2, order: 2 },
            { name: 'Move In/Out Cleaning', slug: 'move-in-out-cleaning', basePrice: 250000, priceUnit: 'per project', duration: 5, order: 3 },
          ],
        },
        {
          name: 'Bersih Kantor',
          slug: 'bersih-kantor',
          description: 'Pembersihan ruang kantor',
          order: 2,
          services: [
            { name: 'Office Cleaning', slug: 'office-cleaning', basePrice: 100000, priceUnit: 'per jam', duration: 3, order: 1 },
            { name: 'Carpet Cleaning', slug: 'carpet-cleaning', basePrice: 200000, priceUnit: 'per project', duration: 2, order: 2 },
          ],
        },
      ],
    },
    {
      name: 'Perbaikan',
      slug: 'perbaikan',
      description: 'Layanan perbaikan rumah tangga',
      icon: 'repair',
      order: 2,
      subCategories: [
        {
          name: 'Listrik',
          slug: 'listrik',
          description: 'Perbaikan dan instalasi listrik',
          order: 1,
          services: [
            { name: 'Perbaikan Kabel', slug: 'perbaikan-kabel', basePrice: 100000, priceUnit: 'per jam', duration: 2, order: 1 },
            { name: 'Instalasi Listrik', slug: 'instalasi-listrik', basePrice: 200000, priceUnit: 'per project', duration: 4, order: 2 },
            { name: 'Pasang Lampu', slug: 'pasang-lampu', basePrice: 75000, priceUnit: 'per project', duration: 1, order: 3 },
          ],
        },
        {
          name: 'Pipa/Plumbing',
          slug: 'pipa-plumbing',
          description: 'Perbaikan pipa dan saluran air',
          order: 2,
          services: [
            { name: 'Perbaikan Keran', slug: 'perbaikan-keran', basePrice: 80000, priceUnit: 'per jam', duration: 1, order: 1 },
            { name: 'Buka Saluran Mampet', slug: 'buka-saluran-mampet', basePrice: 150000, priceUnit: 'per project', duration: 2, order: 2 },
            { name: 'Instalasi Pipa Baru', slug: 'instalasi-pipa-baru', basePrice: 300000, priceUnit: 'per project', duration: 4, order: 3 },
          ],
        },
      ],
    },
    {
      name: 'Perawatan',
      slug: 'perawatan',
      description: 'Layanan perawatan rumah dan taman',
      icon: 'maintenance',
      order: 3,
      subCategories: [
        {
          name: 'AC',
          slug: 'ac',
          description: 'Perawatan dan perbaikan AC',
          order: 1,
          services: [
            { name: 'Cuci AC', slug: 'cuci-ac', basePrice: 80000, priceUnit: 'per unit', duration: 1, order: 1 },
            { name: 'Isi Freon', slug: 'isi-freon', basePrice: 250000, priceUnit: 'per unit', duration: 1, order: 2 },
            { name: 'Pasang AC Baru', slug: 'pasang-ac-baru', basePrice: 350000, priceUnit: 'per unit', duration: 3, order: 3 },
          ],
        },
        {
          name: 'Taman',
          slug: 'taman',
          description: 'Perawatan taman dan halaman',
          order: 2,
          services: [
            { name: 'Potong Rumput', slug: 'potong-rumput', basePrice: 100000, priceUnit: 'per jam', duration: 2, order: 1 },
            { name: 'Tata Taman', slug: 'tata-taman', basePrice: 200000, priceUnit: 'per project', duration: 4, order: 2 },
          ],
        },
      ],
    },
    {
      name: 'Pindahan',
      slug: 'pindahan',
      description: 'Layanan pindah rumah dan kantor',
      icon: 'moving',
      order: 4,
      subCategories: [
        {
          name: 'Pindah Rumah',
          slug: 'pindah-rumah',
          description: 'Jasa angkut dan pindah rumah',
          order: 1,
          services: [
            { name: 'Pindahan Kecil', slug: 'pindahan-kecil', basePrice: 500000, priceUnit: 'per trip', duration: 4, order: 1 },
            { name: 'Pindahan Besar', slug: 'pindahan-besar', basePrice: 1500000, priceUnit: 'per trip', duration: 8, order: 2 },
          ],
        },
      ],
    },
  ];

  for (const cat of jobCategories) {
    const category = await prisma.jobCategory.upsert({
      where: { slug: cat.slug },
      update: { name: cat.name, description: cat.description, icon: cat.icon, order: cat.order },
      create: { name: cat.name, slug: cat.slug, description: cat.description, icon: cat.icon, order: cat.order },
    });
    console.log(`  ✓ Job Category: ${cat.name}`);

    for (const sub of cat.subCategories) {
      const subCategory = await prisma.jobSubCategory.upsert({
        where: { slug: sub.slug },
        update: { name: sub.name, description: sub.description, order: sub.order, categoryId: category.id },
        create: { name: sub.name, slug: sub.slug, description: sub.description, order: sub.order, categoryId: category.id },
      });
      console.log(`    ✓ SubCategory: ${sub.name}`);

      for (const svc of sub.services) {
        await prisma.jobService.upsert({
          where: { slug: svc.slug },
          update: { name: svc.name, basePrice: svc.basePrice, priceUnit: svc.priceUnit, duration: svc.duration, order: svc.order, subCategoryId: subCategory.id },
          create: { name: svc.name, slug: svc.slug, basePrice: svc.basePrice, priceUnit: svc.priceUnit, duration: svc.duration, order: svc.order, subCategoryId: subCategory.id },
        });
        console.log(`      ✓ Service: ${svc.name}`);
      }
    }
  }

  // ─── GAMIFICATION BADGES ────────────────────────────────────

  const badges = [
    {
      name: 'Newcomer',
      description: 'Selamat datang di Digsan!',
      icon: 'star',
      category: 'general',
      tier: 'bronze',
      requirements: [{ type: 'total_points', value: 1 }],
    },
    {
      name: 'Active Member',
      description: 'Kumpulkan 100 poin',
      icon: 'zap',
      category: 'general',
      tier: 'silver',
      requirements: [{ type: 'total_points', value: 100 }],
    },
    {
      name: 'Power User',
      description: 'Kumpulkan 500 poin',
      icon: 'trophy',
      category: 'general',
      tier: 'gold',
      requirements: [{ type: 'total_points', value: 500 }],
    },
    {
      name: 'Family Builder',
      description: 'Buat pohon keluarga pertama',
      icon: 'tree',
      category: 'tree',
      tier: 'bronze',
      requirements: [{ type: 'trees_created', value: 1 }],
    },
    {
      name: 'First Order',
      description: 'Selesaikan pesanan pertama',
      icon: 'shopping-bag',
      category: 'job',
      tier: 'bronze',
      requirements: [{ type: 'orders_completed', value: 1 }],
    },
    {
      name: 'Loyal Customer',
      description: 'Selesaikan 10 pesanan',
      icon: 'award',
      category: 'job',
      tier: 'gold',
      requirements: [{ type: 'orders_completed', value: 10 }],
    },
    {
      name: 'Social Butterfly',
      description: 'Referensikan 3 teman',
      icon: 'users',
      category: 'social',
      tier: 'silver',
      requirements: [{ type: 'referrals', value: 3 }],
    },
  ];

  for (const badgeData of badges) {
    const { requirements, ...badgeFields } = badgeData;
    const badge = await prisma.badge.upsert({
      where: { name: badgeFields.name },
      update: { description: badgeFields.description, icon: badgeFields.icon, category: badgeFields.category, tier: badgeFields.tier },
      create: badgeFields,
    });

    // Upsert requirements
    for (const req of requirements) {
      const existing = await prisma.badgeRequirement.findFirst({
        where: { badgeId: badge.id, type: req.type },
      });
      if (!existing) {
        await prisma.badgeRequirement.create({
          data: { badgeId: badge.id, type: req.type, value: req.value },
        });
      }
    }

    console.log(`  ✓ Badge: ${badgeData.name}`);
  }

  console.log('✅ Seeding complete!');
}

main()
  .catch((e) => {
    console.error('❌ Seed failed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
