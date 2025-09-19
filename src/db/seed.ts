import { prisma } from './connection';
import { Prisma } from '@prisma/client';
import * as argon2 from 'argon2';

async function main() {
  console.log('🌱 Starting database seeding...');

  // Find or create the test user
  let testUser = await prisma.user.findUnique({
    where: { email: 'test@example.com' }
  });

  if (!testUser) {
    console.log('👤 Creating test user...');
    const hashedPassword = await argon2.hash('password123');
    testUser = await prisma.user.create({
      data: {
        email: 'test@example.com',
        passwordHash: hashedPassword,
        firstName: 'Test',
        lastName: 'User',
        name: 'Test User', // Computed field for backward compatibility
        status: 'ACTIVE'
      }
    });
    console.log('✅ Test user created successfully');
  }

  // Find or create test accounts
  let checkingAccount = await prisma.account.findFirst({
    where: { ownerId: testUser.id, type: 'CHECKING' }
  });

  if (!checkingAccount) {
    console.log('🏦 Creating checking account...');
    checkingAccount = await prisma.account.create({
      data: {
        accountNumber: `1000${Math.floor(Math.random() * 1000000000).toString().padStart(9, '0')}`,
        type: 'CHECKING',
        currency: 'USD',
        balance: new Prisma.Decimal(1000),
        ownerId: testUser.id,
        status: 'ACTIVE'
      }
    });
    console.log(`✅ Created checking account: ${checkingAccount.accountNumber}`);
  }

  let savingsAccount = await prisma.account.findFirst({
    where: { ownerId: testUser.id, type: 'SAVINGS' }
  });

  let creditAccount = await prisma.account.findFirst({
    where: { ownerId: testUser.id, type: 'CREDIT' }
  });

  // Create additional accounts if they don't exist
  if (!savingsAccount) {
    savingsAccount = await prisma.account.create({
      data: {
        accountNumber: `2000${Math.floor(Math.random() * 1000000000).toString().padStart(9, '0')}`,
        type: 'SAVINGS',
        currency: 'USD',
        balance: new Prisma.Decimal(2500),
        ownerId: testUser.id,
        status: 'ACTIVE'
      }
    });
    console.log(`✅ Created savings account: ${savingsAccount.accountNumber}`);
  }

  if (!creditAccount) {
    creditAccount = await prisma.account.create({
      data: {
        accountNumber: `3000${Math.floor(Math.random() * 1000000000).toString().padStart(9, '0')}`,
        type: 'CREDIT',
        currency: 'USD',
        balance: new Prisma.Decimal(-450),
        ownerId: testUser.id,
        status: 'ACTIVE'
      }
    });
    console.log(`✅ Created credit account: ${creditAccount.accountNumber}`);
  }

  // Sample transactions for the checking account
  const sampleTransactions = [
    {
      type: 'DEBIT',
      amount: new Prisma.Decimal(85.50),
      description: 'Grocery Store Purchase',
      counterparty: 'WHOLE FOODS MARKET',
      balanceAfter: new Prisma.Decimal(914.50),
      createdAt: new Date(Date.now() - 6 * 24 * 60 * 60 * 1000) // 6 days ago
    },
    {
      type: 'DEBIT',
      amount: new Prisma.Decimal(45.00),
      description: 'Gas Station',
      counterparty: 'SHELL GAS STATION',
      balanceAfter: new Prisma.Decimal(869.50),
      createdAt: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000) // 5 days ago
    },
    {
      type: 'CREDIT',
      amount: new Prisma.Decimal(2500.00),
      description: 'Salary Deposit',
      counterparty: 'ACME CORP PAYROLL',
      balanceAfter: new Prisma.Decimal(3369.50),
      createdAt: new Date(Date.now() - 4 * 24 * 60 * 60 * 1000) // 4 days ago
    },
    {
      type: 'DEBIT',
      amount: new Prisma.Decimal(1200.00),
      description: 'Rent Payment',
      counterparty: 'OAKWOOD APARTMENTS',
      balanceAfter: new Prisma.Decimal(2169.50),
      createdAt: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000) // 3 days ago
    },
    {
      type: 'DEBIT',
      amount: new Prisma.Decimal(25.99),
      description: 'Streaming Service',
      counterparty: 'NETFLIX',
      balanceAfter: new Prisma.Decimal(2143.51),
      createdAt: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000) // 2 days ago
    },
    {
      type: 'DEBIT',
      amount: new Prisma.Decimal(12.50),
      description: 'Coffee Shop',
      counterparty: 'STARBUCKS',
      balanceAfter: new Prisma.Decimal(2131.01),
      createdAt: new Date(Date.now() - 24 * 60 * 60 * 1000) // 1 day ago
    },
    {
      type: 'CREDIT',
      amount: new Prisma.Decimal(150.00),
      description: 'Refund',
      counterparty: 'AMAZON',
      balanceAfter: new Prisma.Decimal(2281.01),
      createdAt: new Date(Date.now() - 12 * 60 * 60 * 1000) // 12 hours ago
    },
    {
      type: 'DEBIT',
      amount: new Prisma.Decimal(67.89),
      description: 'Restaurant',
      counterparty: 'OLIVE GARDEN',
      balanceAfter: new Prisma.Decimal(2213.12),
      createdAt: new Date(Date.now() - 4 * 60 * 60 * 1000) // 4 hours ago
    }
  ];

  // Add sample transactions for savings account
  const savingsTransactions = [
    {
      type: 'CREDIT',
      amount: new Prisma.Decimal(500.00),
      description: 'Transfer from Checking',
      counterparty: null,
      balanceAfter: new Prisma.Decimal(3000.00),
      createdAt: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) // 7 days ago
    },
    {
      type: 'CREDIT',
      amount: new Prisma.Decimal(2.15),
      description: 'Interest Payment',
      counterparty: 'MONTHLY INTEREST',
      balanceAfter: new Prisma.Decimal(3002.15),
      createdAt: new Date(Date.now() - 24 * 60 * 60 * 1000) // 1 day ago
    }
  ];

  // Add sample transactions for credit account
  const creditTransactions = [
    {
      type: 'DEBIT',
      amount: new Prisma.Decimal(299.99),
      description: 'Online Purchase',
      counterparty: 'AMAZON',
      balanceAfter: new Prisma.Decimal(-299.99),
      createdAt: new Date(Date.now() - 8 * 24 * 60 * 60 * 1000) // 8 days ago
    },
    {
      type: 'DEBIT',
      amount: new Prisma.Decimal(150.00),
      description: 'Hotel Booking',
      counterparty: 'HILTON HOTELS',
      balanceAfter: new Prisma.Decimal(-449.99),
      createdAt: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000) // 2 days ago
    }
  ];

  // Check if transactions already exist (to avoid duplicates)
  const existingTransactionCount = await prisma.transaction.count({
    where: { accountId: checkingAccount.id }
  });

  if (existingTransactionCount > 1) {
    console.log('✅ Sample transactions already exist. Skipping transaction seeding.');
  } else {
    // Create sample transactions for checking account
    for (const transaction of sampleTransactions) {
      await prisma.transaction.create({
        data: {
          accountId: checkingAccount.id,
          currency: 'USD',
          ...transaction
        }
      });
    }

    // Update the account balance to match the last transaction
    await prisma.account.update({
      where: { id: checkingAccount.id },
      data: { balance: new Prisma.Decimal(2213.12) }
    });

    console.log(`✅ Created ${sampleTransactions.length} sample transactions for checking account`);
  }

  // Add transactions for savings account
  const existingSavingsTransactions = await prisma.transaction.count({
    where: { accountId: savingsAccount.id }
  });

  if (existingSavingsTransactions === 0) {
    for (const transaction of savingsTransactions) {
      await prisma.transaction.create({
        data: {
          accountId: savingsAccount.id,
          currency: 'USD',
          ...transaction
        }
      });
    }

    await prisma.account.update({
      where: { id: savingsAccount.id },
      data: { balance: new Prisma.Decimal(3002.15) }
    });

    console.log(`✅ Created ${savingsTransactions.length} sample transactions for savings account`);
  }

  // Add transactions for credit account
  const existingCreditTransactions = await prisma.transaction.count({
    where: { accountId: creditAccount.id }
  });

  if (existingCreditTransactions === 0) {
    for (const transaction of creditTransactions) {
      await prisma.transaction.create({
        data: {
          accountId: creditAccount.id,
          currency: 'USD',
          ...transaction
        }
      });
    }

    await prisma.account.update({
      where: { id: creditAccount.id },
      data: { balance: new Prisma.Decimal(-449.99) }
    });

    console.log(`✅ Created ${creditTransactions.length} sample transactions for credit account`);
  }

  console.log('🎉 Database seeding completed successfully!');
}

main()
  .catch((e) => {
    console.error('❌ Error during seeding:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });