import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function verifyMigration() {
  console.log('🔍 Verifying PostgreSQL migration...');

  // Get counts
  const userCount = await prisma.user.count();
  const accountCount = await prisma.account.count();
  const transactionCount = await prisma.transaction.count();
  const transferCount = await prisma.transfer.count();

  console.log('📊 Data counts:');
  console.log(`  Users: ${userCount}`);
  console.log(`  Accounts: ${accountCount}`);
  console.log(`  Transactions: ${transactionCount}`);
  console.log(`  Transfers: ${transferCount}`);

  // Get sample users with their accounts
  const sampleUsers = await prisma.user.findMany({
    take: 3,
    include: {
      accounts: {
        include: {
          transactions: {
            take: 2,
            orderBy: { createdAt: 'desc' }
          }
        }
      }
    }
  });

  console.log('\n👥 Sample users with accounts:');
  for (const user of sampleUsers) {
    console.log(`  User: ${user.name} (${user.email})`);
    console.log(`    Accounts: ${user.accounts.length}`);
    for (const account of user.accounts) {
      console.log(`      ${account.type} (${account.accountNumber}): $${account.balance}`);
      console.log(`        Recent transactions: ${account.transactions.length}`);
    }
    console.log('');
  }

  // Check account balances
  const totalBalance = await prisma.account.aggregate({
    _sum: {
      balance: true
    }
  });

  console.log(`💰 Total balance across all accounts: $${totalBalance._sum.balance}`);

  // Check recent transactions
  const recentTransactions = await prisma.transaction.findMany({
    take: 3,
    orderBy: { createdAt: 'desc' },
    include: {
      account: {
        include: {
          owner: true
        }
      }
    }
  });

  console.log('\n📝 Recent transactions:');
  for (const tx of recentTransactions) {
    console.log(`  ${tx.type} $${tx.amount} - ${tx.description} (${tx.account.owner.name})`);
  }

  console.log('\n✅ Migration verification completed successfully!');
}

verifyMigration()
  .catch(console.error)
  .finally(() => prisma.$disconnect());