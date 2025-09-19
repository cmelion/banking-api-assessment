import { PrismaClient } from '@prisma/client';
import { Prisma } from '@prisma/client';
import * as argon2 from 'argon2';

const prisma = new PrismaClient();

interface TestUser {
  email: string;
  password: string;
  firstName: string;
  lastName: string;
  accountType: string;
  initialBalance: number;
}

const testUsers: TestUser[] = [
  {
    email: 'alice@banking.test',
    password: 'password123',
    firstName: 'Alice',
    lastName: 'Johnson',
    accountType: 'CHECKING',
    initialBalance: 5000.00
  },
  {
    email: 'bob@banking.test',
    password: 'password123',
    firstName: 'Bob',
    lastName: 'Smith',
    accountType: 'SAVINGS',
    initialBalance: 15000.50
  },
  {
    email: 'charlie@banking.test',
    password: 'password123',
    firstName: 'Charlie',
    lastName: 'Brown',
    accountType: 'CHECKING',
    initialBalance: 2500.75
  },
  {
    email: 'diana@banking.test',
    password: 'password123',
    firstName: 'Diana',
    lastName: 'Prince',
    accountType: 'CREDIT',
    initialBalance: -850.00
  },
  {
    email: 'edward@banking.test',
    password: 'password123',
    firstName: 'Edward',
    lastName: 'Wilson',
    accountType: 'SAVINGS',
    initialBalance: 25000.00
  },
  {
    email: 'demo@banking.test',
    password: 'demo123',
    firstName: 'Demo',
    lastName: 'User',
    accountType: 'CHECKING',
    initialBalance: 1000.00
  }
];

async function createTestUsers() {
  console.log('👥 Creating test users for client app testing...');

  for (const testUser of testUsers) {
    try {
      // Check if user already exists
      const existingUser = await prisma.user.findUnique({
        where: { email: testUser.email }
      });

      if (existingUser) {
        console.log(`⚠️  User ${testUser.email} already exists, skipping...`);
        continue;
      }

      // Hash the password
      const hashedPassword = await argon2.hash(testUser.password);

      // Create the user
      const user = await prisma.user.create({
        data: {
          email: testUser.email,
          passwordHash: hashedPassword,
          firstName: testUser.firstName,
          lastName: testUser.lastName,
          name: `${testUser.firstName} ${testUser.lastName}`, // Computed field for backward compatibility
          status: 'ACTIVE'
        }
      });

      // Create an account for the user
      const accountNumber = `${testUser.accountType === 'CHECKING' ? '1000' : testUser.accountType === 'SAVINGS' ? '2000' : '3000'}${Math.floor(Math.random() * 1000000000).toString().padStart(9, '0')}`;

      const account = await prisma.account.create({
        data: {
          accountNumber,
          type: testUser.accountType,
          currency: 'USD',
          balance: new Prisma.Decimal(testUser.initialBalance),
          ownerId: user.id,
          status: 'ACTIVE'
        }
      });

      // Create an initial transaction
      if (testUser.initialBalance !== 0) {
        await prisma.transaction.create({
          data: {
            accountId: account.id,
            type: testUser.initialBalance > 0 ? 'CREDIT' : 'DEBIT',
            amount: new Prisma.Decimal(Math.abs(testUser.initialBalance)),
            currency: 'USD',
            description: 'Initial account funding',
            counterparty: 'BANK TRANSFER',
            balanceAfter: new Prisma.Decimal(testUser.initialBalance)
          }
        });
      }

      console.log(`✅ Created user: ${testUser.firstName} ${testUser.lastName} (${testUser.email})`);
      console.log(`   Account: ${testUser.accountType} (${accountNumber}) - $${testUser.initialBalance}`);

    } catch (error) {
      console.error(`❌ Failed to create user ${testUser.firstName} ${testUser.lastName} (${testUser.email}):`, error);
    }
  }

  console.log('\n🎉 Test user creation completed!');
}

async function displayTestCredentials() {
  console.log('\n📋 TEST USER CREDENTIALS FOR CLIENT APP:\n');
  console.log('═'.repeat(80));

  for (const testUser of testUsers) {
    const user = await prisma.user.findUnique({
      where: { email: testUser.email },
      include: {
        accounts: true
      }
    });

    if (user) {
      console.log(`Name: ${user.name}`);
      console.log(`Email: ${user.email}`);
      console.log(`Password: ${testUser.password}`);
      console.log(`Accounts: ${user.accounts.length}`);

      if (user.accounts.length > 0) {
        const account = user.accounts[0];
        console.log(`Primary Account: ${account.type} (${account.accountNumber}) - $${account.balance}`);
      }

      console.log('─'.repeat(40));
    }
  }

  console.log('\n💡 All users use the same password for easy testing: "password123"');
  console.log('💡 Demo user password: "demo123"');
  console.log('\n🔗 API Base URL: http://localhost:3000');
  console.log('🔗 Login Endpoint: POST /api/v1/auth/login');
  console.log('🔗 Health Check: GET /health');
}

async function main() {
  await createTestUsers();
  await displayTestCredentials();
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());