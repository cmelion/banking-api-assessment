#!/usr/bin/env tsx
/**
 * Database Configuration Switcher
 *
 * Utility script to easily switch between SQLite and PostgreSQL databases.
 * This allows developers to use SQLite for quick local testing and PostgreSQL
 * for production-like development and deployment.
 */

import fs from 'fs';
import path from 'path';
import { execSync } from 'child_process';

const PRISMA_DIR = path.join(__dirname, '..', 'prisma');
const SCHEMA_FILE = path.join(PRISMA_DIR, 'schema.prisma');
const SQLITE_SCHEMA = path.join(PRISMA_DIR, 'schema.sqlite.prisma');
const POSTGRES_SCHEMA = path.join(PRISMA_DIR, 'schema.postgres.prisma');
const ENV_FILE = path.join(__dirname, '..', '.env');

type DatabaseType = 'sqlite' | 'postgres';

interface Config {
  database: DatabaseType;
  connectionString?: string;
}

function printUsage() {
  console.log(`
Database Configuration Switcher
===============================

Usage: tsx scripts/switch-database.ts [options]

Options:
  --sqlite            Switch to SQLite database
  --postgres          Switch to PostgreSQL database
  --test              Use test database configuration
  --dev               Use development database configuration
  --prod              Use production database configuration
  --help              Show this help message

Examples:
  tsx scripts/switch-database.ts --sqlite --test
    Switch to SQLite for running tests

  tsx scripts/switch-database.ts --postgres --dev
    Switch to PostgreSQL for development

  npm run db:use-sqlite
    Quick command to switch to SQLite

  npm run db:use-postgres
    Quick command to switch to PostgreSQL
`);
}

function switchDatabase(config: Config) {
  const { database } = config;

  console.log(`\nSwitching to ${database.toUpperCase()} database...`);

  // Determine which schema to use
  const sourceSchema = database === 'sqlite' ? SQLITE_SCHEMA : POSTGRES_SCHEMA;

  // Check if source schema exists
  if (!fs.existsSync(sourceSchema)) {
    console.error(`❌ Error: ${sourceSchema} not found!`);
    process.exit(1);
  }

  // Copy the appropriate schema
  try {
    fs.copyFileSync(sourceSchema, SCHEMA_FILE);
    console.log(`✅ Copied ${database} schema to prisma/schema.prisma`);
  } catch (error) {
    console.error(`❌ Error copying schema: ${error}`);
    process.exit(1);
  }

  // Update .env file if needed
  if (config.connectionString) {
    updateEnvFile(config.connectionString, database);
  } else {
    // Provide example connection strings
    if (database === 'sqlite') {
      console.log('\n📝 Update your .env file with:');
      console.log('DATABASE_URL="file:./dev.db"');
      console.log('# DIRECT_URL is not needed for SQLite');
    } else {
      console.log('\n📝 Update your .env file with:');
      console.log('DATABASE_URL="postgresql://banking_user:banking_pass@localhost:5432/banking_db?schema=public"');
      console.log('DIRECT_URL="postgresql://banking_user:banking_pass@localhost:5432/banking_db?schema=public"');
    }
  }

  // Run Prisma generate
  console.log('\n🔄 Running prisma generate...');
  try {
    execSync('npx prisma generate', { stdio: 'inherit' });
    console.log('✅ Prisma client generated successfully');
  } catch (error) {
    console.error('❌ Error generating Prisma client:', error);
    process.exit(1);
  }

  // Provide next steps
  console.log(`
✨ Database switched to ${database.toUpperCase()} successfully!

Next steps:
-----------
${database === 'sqlite' ? `
1. Run migrations:
   npx prisma migrate dev --name init

2. Seed the database:
   npm run db:seed

3. Start development:
   npm run dev
` : `
1. Start PostgreSQL (if using Docker):
   docker-compose up -d postgres

2. Run migrations:
   npm run db:migrate

3. Seed the database:
   npm run db:seed

4. Start development:
   npm run dev
`}

To run tests with ${database}:
  npm test

To switch back:
  npm run db:use-${database === 'sqlite' ? 'postgres' : 'sqlite'}
`);
}

function updateEnvFile(connectionString: string, database: DatabaseType) {
  try {
    let envContent = fs.existsSync(ENV_FILE)
      ? fs.readFileSync(ENV_FILE, 'utf-8')
      : '';

    // Update DATABASE_URL
    const dbUrlRegex = /^DATABASE_URL=.*/m;
    if (dbUrlRegex.test(envContent)) {
      envContent = envContent.replace(dbUrlRegex, `DATABASE_URL="${connectionString}"`);
    } else {
      envContent += `\nDATABASE_URL="${connectionString}"`;
    }

    // Handle DIRECT_URL for PostgreSQL
    if (database === 'postgres') {
      const directUrlRegex = /^DIRECT_URL=.*/m;
      if (directUrlRegex.test(envContent)) {
        envContent = envContent.replace(directUrlRegex, `DIRECT_URL="${connectionString}"`);
      } else {
        envContent += `\nDIRECT_URL="${connectionString}"`;
      }
    }

    fs.writeFileSync(ENV_FILE, envContent);
    console.log('✅ Updated .env file');
  } catch (error) {
    console.error('⚠️  Warning: Could not update .env file:', error);
    console.log('Please update DATABASE_URL manually in your .env file');
  }
}

// Parse command-line arguments
const args = process.argv.slice(2);

if (args.includes('--help') || args.length === 0) {
  printUsage();
  process.exit(0);
}

const config: Config = {
  database: 'postgres', // default
};

// Parse database type
if (args.includes('--sqlite')) {
  config.database = 'sqlite';
} else if (args.includes('--postgres')) {
  config.database = 'postgres';
}

// Parse environment
if (args.includes('--test')) {
  config.connectionString = config.database === 'sqlite'
    ? 'file:./test.db'
    : 'postgresql://banking_user:banking_pass@localhost:5432/banking_test?schema=public';
} else if (args.includes('--dev')) {
  config.connectionString = config.database === 'sqlite'
    ? 'file:./dev.db'
    : 'postgresql://banking_user:banking_pass@localhost:5432/banking_db?schema=public';
}

switchDatabase(config);