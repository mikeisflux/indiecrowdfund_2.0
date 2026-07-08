/**
 * User Setup Script
 *
 * This script creates the initial admin and standard user accounts for IndieCrowdfund.
 *
 * Usage: npx ts-node scripts/setup-users.ts
 * Or: npx tsx scripts/setup-users.ts
 */

import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import bcrypt from 'bcryptjs';

// Prisma 7 requires a driver adapter. Match src/lib/db/index.ts.
const prisma = new PrismaClient({
  adapter: new PrismaPg({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false },
  }),
});

interface UserSetup {
  email: string;
  name: string;
  password: string;
  role: 'USER' | 'ADMIN' | 'SUPER_ADMIN';
}

const users: UserSetup[] = [
  // Admin account
  {
    email: 'mikeisflux@indiecrowdfund.com',
    name: 'mikeisflux',
    password: 'z\\kS[JA8`-*Bpl3,',
    role: 'SUPER_ADMIN',
  },
  // Standard user accounts
  {
    email: 'darkgiftcomics@indiecrowdfund.com',
    name: 'darkgiftcomics',
    password: ")f'Q(V'HwMrGvlZ3",
    role: 'USER',
  },
  {
    email: 'imprintcomics@indiecrowdfund.com',
    name: 'imprintcomics',
    password: 'E7iw]Y]Op5ChUxEo',
    role: 'USER',
  },
  {
    email: 'divinitycomics@indiecrowdfund.com',
    name: 'divinitycomics',
    password: 'et}p\\{|nKAYtCLZ`',
    role: 'USER',
  },
  {
    email: 'jdkirby@indiecrowdfund.com',
    name: 'jdkirby',
    password: '2^,I\\?=0HxBI>mkB',
    role: 'USER',
  },
];

async function setupUsers() {
  console.log('Starting user setup...\n');

  for (const userData of users) {
    try {
      // Check if user already exists
      const existingUser = await prisma.user.findUnique({
        where: { email: userData.email },
      });

      // Atomic upsert — avoids the findUnique→create TOCTOU race
      // where a concurrent run could both see "not exists" and both
      // try to create, with the second hitting P2002.
      const hashedPassword = await bcrypt.hash(userData.password, 12);
      await prisma.user.upsert({
        where: { email: userData.email },
        update: {
          name: userData.name,
          password: hashedPassword,
          role: userData.role,
        },
        create: {
          email: userData.email,
          name: userData.name,
          password: hashedPassword,
          role: userData.role,
          emailVerified: new Date(),
        },
      });
      console.log(`${existingUser ? 'Updated' : 'Created'} user: ${userData.name} (${userData.email}) - Role: ${userData.role}`);
    } catch (error) {
      console.error(`Error setting up user ${userData.name}:`, error);
    }
  }

  console.log('\nUser setup complete!');
  console.log('\n--- Account Summary ---');
  console.log('Admin Account:');
  console.log('  Username: mikeisflux');
  console.log('  Email: mikeisflux@indiecrowdfund.com');
  console.log('  Role: SUPER_ADMIN');
  console.log('\nStandard User Accounts:');
  console.log('  - darkgiftcomics (darkgiftcomics@indiecrowdfund.com)');
  console.log('  - imprintcomics (imprintcomics@indiecrowdfund.com)');
  console.log('  - divinitycomics (divinitycomics@indiecrowdfund.com)');
  console.log('  - jdkirby (jdkirby@indiecrowdfund.com)');
}

async function main() {
  try {
    await setupUsers();
  } catch (error) {
    console.error('Setup failed:', error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

main();
