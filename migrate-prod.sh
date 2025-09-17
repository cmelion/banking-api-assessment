#!/bin/bash

# Production Database Migration Script
# Run this to migrate and seed the Prisma Accelerate database

echo "🚀 Starting production database migration..."

# Set environment variables
export PRISMA_DATABASE_URL="postgres://43d1c51684618c91bb3278f979d386161135c7e0cb5bbe0e7181d9217dd4ffb0:sk_nlfaxjCYs91K5m_CqyQhM@db.prisma.io:5432/postgres?sslmode=require"
export POSTGRES_URL="postgres://43d1c51684618c91bb3278f979d386161135c7e0cb5bbe0e7181d9217dd4ffb0:sk_nlfaxjCYs91K5m_CqyQhM@db.prisma.io:5432/postgres?sslmode=require"

# Generate Prisma Client
echo "📦 Generating Prisma Client..."
npx prisma generate

# Run migrations
echo "🔄 Running database migrations..."
npx prisma migrate deploy

# Seed the database
echo "🌱 Seeding database..."
npm run db:seed

echo "✅ Database migration and seeding complete!"

# Test the connection
echo "🔍 Testing database connection..."
npx prisma db execute --stdin <<< "SELECT 1 as health_check;"

echo "🎉 All done! Your production database is ready."