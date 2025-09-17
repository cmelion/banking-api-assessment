import { PrismaClient } from '@prisma/client';
import * as argon2 from 'argon2';

const prisma = new PrismaClient();

async function resetPasswordsForUsersWithData() {
  console.log('🔑 Resetting passwords for users with existing accounts and data...');

  // Find users who have accounts (these are the valuable ones from migration)
  const usersWithAccounts = await prisma.user.findMany({
    where: {
      accounts: {
        some: {} // Has at least one account
      }
    },
    include: {
      accounts: {
        include: {
          transactions: {
            take: 1
          }
        }
      }
    },
    take: 10 // Limit to first 10 users with accounts
  });

  console.log(`Found ${usersWithAccounts.length} users with accounts\n`);

  const resetUsers = [];

  for (const user of usersWithAccounts) {
    const newPassword = 'password123'; // Using consistent password for testing
    const hashedPassword = await argon2.hash(newPassword);

    await prisma.user.update({
      where: { id: user.id },
      data: { passwordHash: hashedPassword }
    });

    const totalBalance = user.accounts.reduce((sum, acc) => sum + Number(acc.balance), 0);
    const totalTransactions = user.accounts.reduce((sum, acc) => sum + acc.transactions.length, 0);

    resetUsers.push({
      email: user.email,
      name: user.name,
      password: newPassword,
      accounts: user.accounts.length,
      totalBalance,
      hasTransactions: totalTransactions > 0
    });

    console.log(`✅ Reset password for: ${user.name} (${user.email})`);
    console.log(`   Accounts: ${user.accounts.length}, Balance: $${totalBalance.toFixed(2)}`);
  }

  console.log('\n📋 UPDATED USER CREDENTIALS WITH EXISTING DATA:\n');
  console.log('═'.repeat(80));

  for (const user of resetUsers) {
    console.log(`Name: ${user.name}`);
    console.log(`Email: ${user.email}`);
    console.log(`Password: ${user.password}`);
    console.log(`Accounts: ${user.accounts}`);
    console.log(`Total Balance: $${user.totalBalance.toFixed(2)}`);
    console.log(`Has Transaction History: ${user.hasTransactions ? 'Yes' : 'No'}`);
    console.log('─'.repeat(40));
  }

  console.log('\n💡 All passwords reset to: "password123"');
  console.log('💡 These users have real account data from your SQLite migration!');

  return resetUsers;
}

resetPasswordsForUsersWithData()
  .catch(console.error)
  .finally(() => prisma.$disconnect());