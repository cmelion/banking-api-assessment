import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function getTestUsers() {
  console.log('🔍 Finding potential test users...');

  // Look for users with test-like email patterns
  const testUsers = await prisma.user.findMany({
    where: {
      OR: [
        { email: { contains: 'test' } },
        { email: { contains: 'demo' } },
        { email: { contains: 'example' } },
        { name: { contains: 'Test' } },
        { name: { contains: 'Demo' } }
      ]
    },
    include: {
      accounts: {
        include: {
          transactions: {
            take: 2,
            orderBy: { createdAt: 'desc' }
          }
        }
      }
    },
    take: 10
  });

  console.log(`\n📋 Found ${testUsers.length} potential test users:\n`);

  for (const user of testUsers) {
    console.log(`Email: ${user.email}`);
    console.log(`Name: ${user.name}`);
    console.log(`Status: ${user.status}`);
    console.log(`Accounts: ${user.accounts.length}`);

    if (user.accounts.length > 0) {
      const totalBalance = user.accounts.reduce((sum, acc) => sum + Number(acc.balance), 0);
      console.log(`Total Balance: $${totalBalance.toFixed(2)}`);

      console.log(`Account Details:`);
      for (const account of user.accounts) {
        console.log(`  - ${account.type} (${account.accountNumber}): $${account.balance}`);
      }
    }

    console.log('---');
  }

  // Also get some regular users for testing
  const regularUsers = await prisma.user.findMany({
    where: {
      AND: [
        { email: { not: { contains: 'test' } } },
        { email: { not: { contains: 'demo' } } },
        { email: { not: { contains: 'example' } } }
      ]
    },
    include: {
      accounts: true
    },
    take: 5
  });

  console.log(`\n👥 Sample regular users (${regularUsers.length}):\n`);

  for (const user of regularUsers) {
    console.log(`Email: ${user.email}`);
    console.log(`Name: ${user.name}`);
    console.log(`Accounts: ${user.accounts.length}`);
    console.log('---');
  }
}

getTestUsers()
  .catch(console.error)
  .finally(() => prisma.$disconnect());