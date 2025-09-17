# Banking API Assessment

A production-ready banking REST service built with AI-assisted development workflows. This project demonstrates modern banking operations including account management, secure transactions, money transfers, and comprehensive API documentation.

## 📋 Table of Contents

- [Quick Start](#-quick-start)
- [Technology Stack](#-technology-stack)
- [Architecture](#-architecture)
- [API Documentation](#-api-documentation)
- [Development](#-development)
- [Testing](#-testing)
- [Deployment](#-deployment)
- [Security](#-security)
- [Contributing](#-contributing)

## 🚀 Quick Start

### Prerequisites

- Node.js 18+ LTS
- Docker & Docker Compose
- Git

### Installation

1. **Clone and setup**
   ```bash
   git clone <repository-url>
   cd banking-api-assessment
   npm install
   ```

2. **Environment configuration**
   ```bash
   cp .env.example .env
   # Edit .env with your configuration
   ```

3. **Start with Docker (Recommended)**
   ```bash
   # Start PostgreSQL and Redis
   docker-compose up -d postgres redis

   # Run database migrations and seed data
   npm run db:migrate
   npm run db:seed

   # Start development server
   npm run dev
   ```

4. **Verify installation**
   ```bash
   curl http://localhost:3000/health
   # Should return: {"status": "ok"}
   ```

### Alternative: Full Docker Setup

```bash
# Start all services including the API
docker-compose up -d

# API will be available at http://localhost:3000
# Adminer (DB admin) at http://localhost:8080
```

## 🛠️ Technology Stack

### Core Framework
- **Runtime**: Node.js 18+ with TypeScript
- **Web Framework**: Fastify (high-performance, schema validation)
- **Database**: PostgreSQL with Prisma ORM
- **Authentication**: JWT with refresh tokens, Argon2id password hashing

### Development & Operations
- **Testing**: Vitest with comprehensive coverage
- **Validation**: JSON Schema with Fastify integration
- **Logging**: Pino structured logging with correlation IDs
- **Containerization**: Docker with multi-stage builds
- **Documentation**: Swagger/OpenAPI integration

## 🏗️ Architecture

### Project Structure
```
src/
├── app.ts                 # Fastify application setup
├── index.ts              # Server bootstrap
├── config/               # Environment configuration
├── db/                   # Database schema and utilities
├── modules/              # Feature modules
│   ├── auth/            # Authentication & authorization
│   ├── users/           # User management
│   ├── accounts/        # Account operations
│   ├── transactions/    # Transaction processing
│   ├── transfers/       # Money transfers
│   ├── cards/           # Card management (mock)
│   └── statements/      # Account statements
├── plugins/             # Fastify plugins
└── lib/                 # Shared utilities
```

### Database Schema
- **Users**: Account holders with secure authentication
- **Accounts**: Multi-currency accounts with balance tracking
- **Transactions**: Immutable transaction ledger
- **Transfers**: Atomic money transfers between accounts
- **Cards**: Tokenized card management (PCI-compliant)
- **Statements**: Generated account statements

## 📚 API Documentation

### Base URL
- Development: `http://localhost:3000/api/v1`
- Swagger UI: `http://localhost:3000/docs`

### Core Endpoints

#### Authentication
```http
POST /api/v1/auth/signup     # User registration
POST /api/v1/auth/login      # User authentication
POST /api/v1/auth/refresh    # Token refresh
```

#### User Management
```http
GET    /api/v1/users/me      # Current user profile
PATCH  /api/v1/users/me      # Update profile
```

#### Account Operations
```http
POST   /api/v1/accounts              # Create account
GET    /api/v1/accounts              # List user accounts
GET    /api/v1/accounts/:id          # Account details
GET    /api/v1/accounts/:id/transactions  # Transaction history
```

#### Transfers
```http
POST   /api/v1/transfers             # Money transfer
# Supports Idempotency-Key header
```

#### Cards & Statements
```http
POST   /api/v1/accounts/:id/cards    # Issue card (mock)
GET    /api/v1/accounts/:id/cards    # List cards (masked)
POST   /api/v1/accounts/:id/statements/generate  # Generate statement
GET    /api/v1/statements/:id        # Download statement
```

#### Health & Monitoring
```http
GET    /health                       # Service health
GET    /ready                        # Readiness probe
```

### Authentication

All protected endpoints require JWT authentication:

```http
Authorization: Bearer <access_token>
```

Tokens are obtained via login and refreshed using refresh tokens for enhanced security.

## 💻 Development

### Available Scripts

| Command | Description |
|---------|-------------|
| `npm run dev` | Start development server with hot reload |
| `npm run build` | Build TypeScript to production JavaScript |
| `npm run start` | Start production server |
| `npm test` | Run complete test suite |
| `npm run test:watch` | Run tests in watch mode |
| `npm run test:coverage` | Generate test coverage report |
| `npm run lint` | Run ESLint code analysis |
| `npm run format` | Format code with Prettier |
| `npm run typecheck` | TypeScript compilation check |

### Database Operations

| Command | Description |
|---------|-------------|
| `npm run db:migrate` | Apply database migrations |
| `npm run db:reset` | Reset database and apply seed data |
| `npm run db:seed` | Populate database with test data |
| `npm run db:generate` | Generate Prisma client |

### Docker Commands

| Command | Description |
|---------|-------------|
| `npm run docker:up` | Start all services with Docker |
| `npm run docker:down` | Stop all Docker services |
| `npm run docker:build` | Build application Docker image |

### Development Workflow

1. **Start development environment**
   ```bash
   docker-compose up -d postgres redis
   npm run db:migrate
   npm run dev
   ```

2. **Make changes and test**
   ```bash
   npm run test:watch    # Run tests in watch mode
   npm run lint          # Check code quality
   ```

3. **Database changes**
   ```bash
   # Edit prisma/schema.prisma
   npm run db:migrate    # Generate migration
   npm run db:reset      # Reset with new schema
   ```

## 🧪 Testing

### Test Strategy
- **Unit Tests**: Business logic, authentication, monetary calculations
- **Integration Tests**: API endpoints with test database
- **Security Tests**: Authentication flows, authorization checks
- **Coverage Target**: 80%+ statement and branch coverage

### Running Tests

```bash
# Run all tests
npm test

# Run with coverage
npm run test:coverage

# Run specific test file
npx vitest src/modules/auth/auth.test.ts

# Run tests in watch mode
npm run test:watch
```

Coverage report:
- https://cmelion.github.io/banking-api-assessment

### Test Database

Tests use a separate PostgreSQL database that is automatically:
- Migrated before test runs
- Seeded with test data
- Isolated per test suite

### Example Test Data

The seed script creates test users and accounts for development:
- Test users with known credentials
- Sample accounts with various balances
- Transaction history for testing

## 🚀 Deployment

### Docker Production

```bash
# Build production image
docker build -t banking-api .

# Run with docker-compose
docker-compose up -d
```

### Environment Variables

Required environment variables (see `.env.example`):

```env
# Application
NODE_ENV=production
PORT=3000

# Database
DATABASE_URL=postgresql://user:pass@host:5432/db
DIRECT_URL=postgresql://user:pass@host:5432/db

# JWT Secrets
JWT_SECRET=your-super-secret-jwt-key
JWT_REFRESH_SECRET=your-super-secret-refresh-key

# Optional
REDIS_URL=redis://localhost:6379
LOG_LEVEL=info
```

### Vercel Deployment

This project is configured for Vercel deployment:

1. Connect your repository to Vercel
2. Add Vercel Postgres addon
3. Set environment variables:
   - `DATABASE_URL=${POSTGRES_PRISMA_URL}`
   - `DIRECT_URL=${POSTGRES_URL_NON_POOLING}`
4. Deploy automatically on push

### Health Checks

The application provides comprehensive health monitoring:

- **Liveness**: `/health` - Service is running
- **Readiness**: `/ready` - Service can handle requests (includes DB connectivity)
- **Docker**: Built-in container health checks

### Monitoring

- **Structured Logging**: JSON logs with correlation IDs
- **Error Tracking**: Centralized error handling with proper HTTP status codes
- **Performance**: Request/response timing in logs
- **Security**: Authentication events and suspicious activity logging

## 🔒 Security

### Security Features

- **Password Security**: Argon2id hashing with per-user salts
- **JWT Security**: Short-lived access tokens with rotating refresh tokens
- **Input Validation**: Comprehensive JSON schema validation
- **PCI Compliance**: No raw card data storage, tokenized values only
- **Audit Trail**: Complete transaction logging with user context
- **Rate Limiting**: Protection against brute force attacks

### Security Best Practices

- Environment secrets never committed to repository
- Sensitive data redacted from logs
- HTTPS-only in production
- Secure cookie settings
- SQL injection prevention via Prisma ORM
- CORS configuration for API access control

### Known Security Considerations

- Card operations are mocked for assessment purposes
- Real implementation would require proper PCI DSS compliance
- Additional rate limiting and fraud detection needed for production
- Multi-factor authentication not implemented

See [SECURITY.md](docs/SECURITY.md) for detailed security documentation.

## 🤝 Contributing

### Development Guidelines

1. **Code Quality**
   - TypeScript strict mode
   - ESLint and Prettier configuration
   - Comprehensive test coverage
   - Security-first approach

2. **Commit Standards**
   - Meaningful commit messages
   - Document AI assistance usage
   - Frequent commits for iterative development

3. **Pull Request Process**
   - All tests must pass
   - Code coverage maintained
   - Security review required
   - Documentation updated

### AI Development Notes

This project was built using AI-assisted development:
- See [docs/AI_USAGE.md](docs/AI_USAGE.md) for detailed AI development log
- Prompts, tools, and manual interventions documented
- Challenges and solutions recorded for future reference

## 📖 Additional Documentation

- [🛡️ Security Considerations](docs/SECURITY.md)
- [🗺️ Development Roadmap](docs/ROADMAP.md)
- [🤖 AI Development Usage](docs/AI_USAGE.md)
- [⚡ Performance Optimization](docs/PERFORMANCE.md)

## 📞 Support

For questions or issues:
1. Check the documentation in the `docs/` directory
2. Review test examples for usage patterns
3. Check Docker logs: `docker-compose logs banking-api`
4. Use the health endpoints to diagnose service issues

## 📄 License

This project is licensed under the ISC License - see the package.json file for details.

---

Built with ❤️ using AI-assisted development workflows.