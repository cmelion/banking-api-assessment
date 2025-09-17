# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

This is a production-ready banking REST service assessment built with AI-assisted workflows. The goal is to implement a comprehensive banking API with core financial operations, security, testing, and containerization.

## Technology Stack

- **Runtime**: Node.js (LTS) with TypeScript
- **Web Framework**: Fastify (high performance, built-in schema validation)
- **Database**: Prisma ORM with PostgreSQL (local development & production)
- **Validation**: JSON schemas with Fastify integration
- **Authentication**: JWT (access + refresh tokens), Argon2id password hashing
- **Logging**: Pino (structured JSON logs with correlation IDs)
- **Testing**: Vitest for unit and integration tests
- **Containerization**: Docker with multi-stage builds, docker-compose
- **Configuration**: dotenv with schema validation, 12-factor app principles

## Development Commands

Once fully configured, key commands will be:

```bash
# Development
npm run dev              # Start development server
npm run build           # Build TypeScript to JavaScript
npm run start           # Start production server
npm test                # Run all tests
npm run test:watch      # Run tests in watch mode
npm run test:coverage   # Run tests with coverage report

# Database
npm run db:migrate      # Run database migrations
npm run db:reset        # Reset database and reseed
npm run db:seed         # Seed database with test data

# Code Quality
npm run lint            # Run ESLint
npm run format          # Run Prettier
npm run typecheck       # Run TypeScript compiler check

# Docker
docker-compose up       # Start full stack with database
docker-compose down     # Stop all services
```

## Project Structure

```
/
├── src/
│   ├── app.ts                 # Fastify instance creation, plugins
│   ├── index.ts               # Server bootstrap
│   ├── config/index.ts        # Environment schema, config loader
│   ├── db/
│   │   ├── schema.prisma      # Prisma schema (PostgreSQL)
│   │   └── migrate.ts         # Migration runner
│   ├── modules/
│   │   ├── auth/              # Authentication & authorization
│   │   ├── users/             # User management
│   │   ├── accounts/          # Account management
│   │   ├── transactions/      # Transaction processing
│   │   ├── transfers/         # Money transfers
│   │   ├── cards/             # Card management
│   │   └── statements/        # Account statements
│   ├── plugins/
│   │   ├── logging.ts         # Pino logging configuration
│   │   └── health.ts          # Health check endpoints
│   └── lib/
│       ├── errors.ts          # Custom error classes
│       └── idempotency.ts     # Idempotency key handling
├── tests/                     # Integration/E2E tests
├── Dockerfile                 # Multi-stage Docker build
├── docker-compose.yml         # Local development stack
├── .env.example              # Environment variable template
└── docs/
    ├── README.md             # Setup and API documentation
    ├── SECURITY.md           # Security considerations
    ├── ROADMAP.md           # Future improvements
    └── AI_USAGE.md          # AI development log
```

## Core API Endpoints

### Authentication
- `POST /api/v1/auth/signup` - User registration
- `POST /api/v1/auth/login` - User authentication
- `POST /api/v1/auth/refresh` - Token refresh
- `GET /api/v1/users/me` - Current user profile

### Accounts & Transactions
- `POST /api/v1/accounts` - Create account
- `GET /api/v1/accounts` - List user accounts
- `GET /api/v1/accounts/:id` - Account details
- `GET /api/v1/accounts/:id/transactions` - Transaction history
- `POST /api/v1/transfers` - Money transfer between accounts

### Cards & Statements
- `POST /api/v1/accounts/:id/cards` - Issue card (mock)
- `GET /api/v1/accounts/:id/cards` - List cards (masked)
- `POST /api/v1/accounts/:id/statements:generate` - Generate statement
- `GET /api/v1/statements/:id` - Download statement

### Operations
- `GET /health` - Liveness probe
- `GET /ready` - Readiness probe (DB connectivity)

## Security Requirements

- **Never store raw card PAN** - Only masked/tokenized values
- **Password Security** - Argon2id hashing with per-user salt
- **JWT Security** - Short-lived access tokens, rotating refresh tokens
- **Input Validation** - JSON schemas for all requests
- **Money Precision** - Use Decimal type or integer cents to avoid floating point errors
- **Idempotency** - Support `Idempotency-Key` header for transfers
- **Audit Trail** - Log all mutations with user context
- **Role-Based Access** - User/admin roles for endpoint protection

## Testing Strategy

- **Unit Tests** - Business logic, auth helpers, monetary calculations
- **Integration Tests** - API endpoints with temporary SQLite database
- **Coverage Target** - 80%+ statement/branch coverage
- **Test Isolation** - Database reset/transaction rollback between tests
- **Security Testing** - Authentication flows, authorization checks, edge cases

## Deployment & Operations

- **Health Checks** - Liveness and readiness probes
- **Graceful Shutdown** - Handle SIGTERM, drain connections
- **Structured Logging** - JSON logs with request IDs, redacted sensitive data
- **Error Handling** - Consistent error responses with proper HTTP status codes
- **Database Migrations** - Prisma schema versioning
- **Environment Configuration** - 12-factor app principles

## Development Guidelines

1. **Commit Frequently** - Meaningful commits documenting AI usage
2. **Security First** - Never commit secrets, validate all inputs
3. **Test Coverage** - Write tests before or alongside implementation
4. **Type Safety** - Leverage TypeScript for compile-time safety
5. **Error Handling** - Use custom error classes with proper HTTP mapping
6. **Logging** - Include correlation IDs and structured context
7. **Documentation** - Keep API docs and architectural decisions updated

## AI Development Notes

When using AI assistance:
- Document prompts and iterations in AI_USAGE.md
- Note where manual intervention was required
- Track which tools and models were used
- Record challenges encountered and solutions found

## Critical Implementation Details

- **Transfer Atomicity** - Use database transactions for dual-entry bookkeeping
- **Concurrency Control** - Handle race conditions on account balances
- **Idempotency Keys** - Prevent duplicate transfers with unique constraints
- **Money Handling** - Use Prisma Decimal type for precise monetary calculations
- **PCI Compliance** - Mock card issuance, never store real card data

## Verified Implementation Status

### ✅ Completed and Tested Modules
- **Authentication System**: Signup, login, JWT tokens with refresh capability
- **User Management**: Profile retrieval and updates with proper authorization
- **Database Layer**: SQLite with Prisma ORM, migrations, and proper schema
- **Security**: Argon2id password hashing, JWT authentication, error handling
- **Health Monitoring**: Health and readiness endpoints with database connectivity checks
- **API Documentation**: Swagger/OpenAPI integration available at `/docs`

### 🚧 Placeholder Modules (Ready for Implementation)
- **Account Management**: Routes and controller structure prepared
- **Transaction Processing**: Framework ready for ledger operations
- **Money Transfers**: Idempotency and atomicity patterns established
- **Card Management**: Mock issuance patterns prepared
- **Statement Generation**: Service structure prepared

### 🛠️ Development Optimizations for Claude

#### PostgreSQL Migration (Completed)

This project has been successfully migrated from SQLite to PostgreSQL for better Vercel deployment compatibility:

**Migration Changes:**
- **Database Provider**: Changed Prisma datasource from `sqlite` to `postgresql`
- **Environment Variables**: Added `DIRECT_URL` for migrations alongside `DATABASE_URL` for runtime
- **Docker Configuration**: Updated to use PostgreSQL container with health checks
- **CI/CD**: GitHub Actions now run tests against PostgreSQL services
- **Seed Script**: Enhanced to create initial test data automatically

**Local Development Setup:**
```bash
# Start PostgreSQL with Docker
docker-compose up -d postgres

# Apply migrations and seed data
npm run db:migrate
npm run db:seed

# Start development server
npm run dev
```

**Production (Vercel):**
- Add Vercel Postgres integration
- Set environment variables:
  - `DATABASE_URL` = `${POSTGRES_PRISMA_URL}` (pooled)
  - `DIRECT_URL` = `${POSTGRES_URL_NON_POOLING}` (direct)
- Use GitHub Actions workflow `DB Admin` for migrations and seeding

#### Common Commands
```bash
# Quick Development Setup
npm run dev              # Start development server
docker-compose up -d     # Start all services

# Testing
npm test                 # Run test suite with 10s timeout
npm run test:coverage    # Generate coverage reports

# Database Operations
npm run db:migrate       # Apply new migrations
npm run db:reset         # Reset and reseed database

# Code Quality
npm run lint             # ESLint with TypeScript rules
npm run typecheck        # TypeScript compilation check
```

#### Known Working Patterns
- **Test Structure**: Use unique emails with timestamps to avoid conflicts
- **Error Handling**: Centralized error mapping with proper HTTP status codes
- **Authentication**: Bearer token pattern with `Authorization: Bearer <token>`
- **Response Format**: Consistent `{success: boolean, data: any, error?: any}` structure

#### Fixed Issues Documentation
1. **Prisma Alpine Compatibility**: Set `binaryTargets = ["native", "linux-musl-openssl-3.0.x"]`
2. **Docker OpenSSL**: Use `openssl ca-certificates` packages for Alpine Linux
3. **PostgreSQL Configuration**: Use proper connection strings with `?schema=public` parameter
4. **Test Timeouts**: Set `testTimeout: 10000` in vitest.config.ts to prevent hangs
5. **Status Codes**: Auth signup returns `201` not `200` for new user creation
6. **PostgreSQL Migration**: Remove old migration directory when switching providers

#### API Endpoint Verification Status
- ✅ `POST /api/v1/auth/signup` - Creates user and returns tokens
- ✅ `POST /api/v1/auth/login` - Authenticates and returns tokens
- ✅ `POST /api/v1/auth/refresh` - Token refresh (needs valid refresh token)
- ✅ `GET /api/v1/users/me` - Returns authenticated user profile
- ✅ `PATCH /api/v1/users/me` - Updates authenticated user profile
- ✅ `GET /health` - Service health check
- ✅ `GET /ready` - Service readiness with database connectivity
- ✅ `GET /docs` - Swagger UI documentation
- 🚧 Account, transaction, transfer, card, and statement endpoints (structured but not implemented)