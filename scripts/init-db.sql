-- Database initialization script for PostgreSQL
-- This script is automatically executed when the PostgreSQL container starts

-- Create additional databases if needed
-- CREATE DATABASE banking_test;

-- Grant privileges
GRANT ALL PRIVILEGES ON DATABASE banking_db TO banking_user;

-- Enable required extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- Create schema if not exists (Prisma will handle table creation)
-- Schema will be created by Prisma migrations