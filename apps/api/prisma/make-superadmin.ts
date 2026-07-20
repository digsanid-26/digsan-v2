/**
 * Promote a user to super_admin.
 *
 * Usage (from apps/api):
 *   npx ts-node prisma/make-superadmin.ts digsanid@gmail.com
 *
 * Or after build:
 *   node dist/prisma/make-superadmin.js digsanid@gmail.com
 */
import * as fs from 'fs';
import * as path from 'path';

// Load .env manually (no dotenv dependency)
const envPath = path.resolve(__dirname, '..', '.env');
if (fs.existsSync(envPath)) {
  for (const line of fs.readFileSync(envPath, 'utf8').split('\n')) {
    const m = line.match(/^\s*([A-Z_]+)\s*=\s*(.*)\s*$/);
    if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^["']|["']$/g, '');
  }
}

import { PrismaClient } from '@prisma/client';

async function main() {
  const email = process.argv[2];
  if (!email) {
    console.error('Usage: npx ts-node prisma/make-superadmin.ts <email>');
    process.exit(1);
  }

  const prisma = new PrismaClient();

  try {
    // Ensure super_admin role exists
    const role = await prisma.role.upsert({
      where: { name: 'super_admin' },
      update: {},
      create: { name: 'super_admin', description: 'Super Administrator' },
    });

    // Find the user
    const user = await prisma.user.findUnique({ where: { email } });
    if (!user) {
      console.error(`User with email "${email}" not found.`);
      process.exit(1);
    }

    // Assign role (skip if already assigned)
    const existing = await prisma.userRole.findUnique({
      where: { userId_roleId: { userId: user.id, roleId: role.id } },
    });

    if (existing) {
      console.log(`User ${email} already has super_admin role.`);
    } else {
      await prisma.userRole.create({
        data: { userId: user.id, roleId: role.id },
      });
      console.log(`Assigned super_admin to ${email} (${user.name}).`);
    }

    // Also activate the account if pending
    if (user.status === 'PENDING') {
      await prisma.user.update({
        where: { id: user.id },
        data: { status: 'ACTIVE', emailVerified: user.emailVerified ?? new Date() },
      });
      console.log(`Activated account for ${email}.`);
    }

    console.log('Done.');
  } catch (err) {
    console.error('Error:', err);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

main();
