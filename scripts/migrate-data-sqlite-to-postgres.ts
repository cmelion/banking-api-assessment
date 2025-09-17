import Database from 'better-sqlite3';
import { PrismaClient } from '@prisma/client';
import { Prisma } from '@prisma/client';

// SQLite connection
const sqliteDb = new Database('./prisma/dev.db', { readonly: true });

// PostgreSQL connection
const postgresClient = new PrismaClient({
  log: ['info', 'warn', 'error']
});

interface MigrationStats {
  users: number;
  accounts: number;
  transactions: number;
  transfers: number;
  cards: number;
  statements: number;
  refreshTokens: number;
  idempotencyKeys: number;
}

async function clearPostgresData() {
  console.log('🧹 Clearing existing PostgreSQL data...');

  // Delete in proper order to respect foreign key constraints
  await postgresClient.transaction.deleteMany();
  await postgresClient.transfer.deleteMany();
  await postgresClient.card.deleteMany();
  await postgresClient.statement.deleteMany();
  await postgresClient.account.deleteMany();
  await postgresClient.refreshToken.deleteMany();
  await postgresClient.idempotencyKey.deleteMany();
  await postgresClient.user.deleteMany();

  console.log('✅ PostgreSQL data cleared');
}

async function migrateUsers(): Promise<number> {
  console.log('👥 Migrating users...');

  const sqliteUsers = sqliteDb.prepare(`
    SELECT * FROM users ORDER BY created_at ASC
  `).all();

  let migratedCount = 0;
  for (const user of sqliteUsers) {
    try {
      await postgresClient.user.create({
        data: {
          id: user.id,
          email: user.email,
          passwordHash: user.password_hash,
          name: user.name,
          status: user.status,
          createdAt: new Date(user.created_at),
          updatedAt: new Date(user.updated_at)
        }
      });
      migratedCount++;

      if (migratedCount % 100 === 0) {
        console.log(`  📊 Migrated ${migratedCount}/${sqliteUsers.length} users`);
      }
    } catch (error) {
      console.error(`❌ Failed to migrate user ${user.id}:`, error);
    }
  }

  console.log(`✅ Migrated ${migratedCount} users`);
  return migratedCount;
}

async function migrateAccounts(): Promise<number> {
  console.log('🏦 Migrating accounts...');

  const sqliteAccounts = sqliteDb.prepare(`
    SELECT * FROM accounts ORDER BY created_at ASC
  `).all();

  let migratedCount = 0;
  for (const account of sqliteAccounts) {
    try {
      await postgresClient.account.create({
        data: {
          id: account.id,
          accountNumber: account.account_number,
          type: account.type,
          currency: account.currency,
          balance: new Prisma.Decimal(account.balance.toString()),
          ownerId: account.owner_id,
          status: account.status,
          createdAt: new Date(account.created_at),
          updatedAt: new Date(account.updated_at)
        }
      });
      migratedCount++;

      if (migratedCount % 100 === 0) {
        console.log(`  📊 Migrated ${migratedCount}/${sqliteAccounts.length} accounts`);
      }
    } catch (error) {
      console.error(`❌ Failed to migrate account ${account.id}:`, error);
    }
  }

  console.log(`✅ Migrated ${migratedCount} accounts`);
  return migratedCount;
}

async function migrateTransactions(): Promise<number> {
  console.log('💳 Migrating transactions...');

  const sqliteTransactions = sqliteDb.prepare(`
    SELECT * FROM transactions ORDER BY created_at ASC
  `).all();

  let migratedCount = 0;
  for (const transaction of sqliteTransactions) {
    try {
      await postgresClient.transaction.create({
        data: {
          id: transaction.id,
          accountId: transaction.account_id,
          type: transaction.type,
          amount: new Prisma.Decimal(transaction.amount.toString()),
          currency: transaction.currency,
          description: transaction.description,
          counterparty: transaction.counterparty,
          transferId: transaction.transfer_id,
          balanceAfter: new Prisma.Decimal(transaction.balance_after.toString()),
          createdAt: new Date(transaction.created_at)
        }
      });
      migratedCount++;

      if (migratedCount % 200 === 0) {
        console.log(`  📊 Migrated ${migratedCount}/${sqliteTransactions.length} transactions`);
      }
    } catch (error) {
      console.error(`❌ Failed to migrate transaction ${transaction.id}:`, error);
    }
  }

  console.log(`✅ Migrated ${migratedCount} transactions`);
  return migratedCount;
}

async function migrateTransfers(): Promise<number> {
  console.log('🔄 Migrating transfers...');

  const sqliteTransfers = sqliteDb.prepare(`
    SELECT * FROM transfers ORDER BY created_at ASC
  `).all();

  let migratedCount = 0;
  for (const transfer of sqliteTransfers) {
    try {
      await postgresClient.transfer.create({
        data: {
          id: transfer.id,
          fromAccountId: transfer.from_account_id,
          toAccountId: transfer.to_account_id,
          amount: new Prisma.Decimal(transfer.amount.toString()),
          currency: transfer.currency,
          description: transfer.description,
          status: transfer.status,
          idempotencyKey: transfer.idempotency_key,
          createdAt: new Date(transfer.created_at),
          updatedAt: new Date(transfer.updated_at)
        }
      });
      migratedCount++;

      if (migratedCount % 50 === 0) {
        console.log(`  📊 Migrated ${migratedCount}/${sqliteTransfers.length} transfers`);
      }
    } catch (error) {
      console.error(`❌ Failed to migrate transfer ${transfer.id}:`, error);
    }
  }

  console.log(`✅ Migrated ${migratedCount} transfers`);
  return migratedCount;
}

async function migrateCards(): Promise<number> {
  console.log('💳 Migrating cards...');

  const sqliteCards = sqliteDb.prepare(`
    SELECT * FROM cards ORDER BY created_at ASC
  `).all();

  let migratedCount = 0;
  for (const card of sqliteCards) {
    try {
      await postgresClient.card.create({
        data: {
          id: card.id,
          accountId: card.account_id,
          maskedPan: card.masked_pan,
          brand: card.brand,
          last4: card.last4,
          expMonth: card.exp_month,
          expYear: card.exp_year,
          status: card.status,
          createdAt: new Date(card.created_at),
          updatedAt: new Date(card.updated_at)
        }
      });
      migratedCount++;
    } catch (error) {
      console.error(`❌ Failed to migrate card ${card.id}:`, error);
    }
  }

  console.log(`✅ Migrated ${migratedCount} cards`);
  return migratedCount;
}

async function migrateStatements(): Promise<number> {
  console.log('📄 Migrating statements...');

  const sqliteStatements = sqliteDb.prepare(`
    SELECT * FROM statements ORDER BY created_at ASC
  `).all();

  let migratedCount = 0;
  for (const statement of sqliteStatements) {
    try {
      await postgresClient.statement.create({
        data: {
          id: statement.id,
          accountId: statement.account_id,
          periodStart: new Date(statement.period_start),
          periodEnd: new Date(statement.period_end),
          fileUrl: statement.file_url,
          createdAt: new Date(statement.created_at)
        }
      });
      migratedCount++;
    } catch (error) {
      console.error(`❌ Failed to migrate statement ${statement.id}:`, error);
    }
  }

  console.log(`✅ Migrated ${migratedCount} statements`);
  return migratedCount;
}

async function migrateRefreshTokens(): Promise<number> {
  console.log('🔑 Migrating refresh tokens...');

  const sqliteTokens = sqliteDb.prepare(`
    SELECT * FROM refresh_tokens ORDER BY created_at ASC
  `).all();

  let migratedCount = 0;
  for (const token of sqliteTokens) {
    try {
      await postgresClient.refreshToken.create({
        data: {
          id: token.id,
          userId: token.user_id,
          tokenHash: token.token_hash,
          expiresAt: new Date(token.expires_at),
          revokedAt: token.revoked_at ? new Date(token.revoked_at) : null,
          createdAt: new Date(token.created_at)
        }
      });
      migratedCount++;
    } catch (error) {
      console.error(`❌ Failed to migrate refresh token ${token.id}:`, error);
    }
  }

  console.log(`✅ Migrated ${migratedCount} refresh tokens`);
  return migratedCount;
}

async function migrateIdempotencyKeys(): Promise<number> {
  console.log('🔐 Migrating idempotency keys...');

  const sqliteKeys = sqliteDb.prepare(`
    SELECT * FROM idempotency_keys ORDER BY created_at ASC
  `).all();

  let migratedCount = 0;
  for (const key of sqliteKeys) {
    try {
      await postgresClient.idempotencyKey.create({
        data: {
          id: key.id,
          key: key.key,
          response: key.response,
          createdAt: new Date(key.created_at),
          expiresAt: new Date(key.expires_at)
        }
      });
      migratedCount++;
    } catch (error) {
      console.error(`❌ Failed to migrate idempotency key ${key.id}:`, error);
    }
  }

  console.log(`✅ Migrated ${migratedCount} idempotency keys`);
  return migratedCount;
}

async function verifyMigration(): Promise<MigrationStats> {
  console.log('🔍 Verifying migration...');

  const stats: MigrationStats = {
    users: await postgresClient.user.count(),
    accounts: await postgresClient.account.count(),
    transactions: await postgresClient.transaction.count(),
    transfers: await postgresClient.transfer.count(),
    cards: await postgresClient.card.count(),
    statements: await postgresClient.statement.count(),
    refreshTokens: await postgresClient.refreshToken.count(),
    idempotencyKeys: await postgresClient.idempotencyKey.count()
  };

  console.log('📊 Migration results:');
  console.log(`  Users: ${stats.users}`);
  console.log(`  Accounts: ${stats.accounts}`);
  console.log(`  Transactions: ${stats.transactions}`);
  console.log(`  Transfers: ${stats.transfers}`);
  console.log(`  Cards: ${stats.cards}`);
  console.log(`  Statements: ${stats.statements}`);
  console.log(`  Refresh Tokens: ${stats.refreshTokens}`);
  console.log(`  Idempotency Keys: ${stats.idempotencyKeys}`);

  return stats;
}

async function main() {
  try {
    console.log('🚀 Starting SQLite to PostgreSQL data migration...');
    console.log(`📅 Migration started at: ${new Date().toISOString()}`);

    // Clear existing data in PostgreSQL (comment out if you want to keep current data)
    await clearPostgresData();

    // Migrate data in proper order to respect foreign key constraints
    const stats: MigrationStats = {
      users: await migrateUsers(),
      refreshTokens: await migrateRefreshTokens(),
      accounts: await migrateAccounts(),
      transfers: await migrateTransfers(),
      transactions: await migrateTransactions(),
      cards: await migrateCards(),
      statements: await migrateStatements(),
      idempotencyKeys: await migrateIdempotencyKeys()
    };

    // Verify the migration
    const verificationStats = await verifyMigration();

    // Check for any discrepancies
    const discrepancies = [];
    if (stats.users !== verificationStats.users) discrepancies.push('users');
    if (stats.accounts !== verificationStats.accounts) discrepancies.push('accounts');
    if (stats.transactions !== verificationStats.transactions) discrepancies.push('transactions');
    if (stats.transfers !== verificationStats.transfers) discrepancies.push('transfers');
    if (stats.cards !== verificationStats.cards) discrepancies.push('cards');
    if (stats.statements !== verificationStats.statements) discrepancies.push('statements');
    if (stats.refreshTokens !== verificationStats.refreshTokens) discrepancies.push('refresh tokens');
    if (stats.idempotencyKeys !== verificationStats.idempotencyKeys) discrepancies.push('idempotency keys');

    if (discrepancies.length > 0) {
      console.log(`⚠️  Discrepancies found in: ${discrepancies.join(', ')}`);
    } else {
      console.log('✅ Migration verification successful - all data counts match!');
    }

    console.log(`📅 Migration completed at: ${new Date().toISOString()}`);
    console.log('🎉 SQLite to PostgreSQL data migration completed successfully!');

  } catch (error) {
    console.error('❌ Migration failed:', error);
    process.exit(1);
  } finally {
    sqliteDb.close();
    await postgresClient.$disconnect();
  }
}

// Run the migration
main().catch(console.error);