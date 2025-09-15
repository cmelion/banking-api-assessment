# Docker Setup Guide

This guide explains how to set up and use Docker for the Banking API project with WebStorm debugging support.

## Docker Configuration

### Architecture
- **Production Image**: Multi-stage build using Node.js 20 Alpine for optimal size and security
- **Development Image**: Includes debugging support and live code reloading
- **Database**: SQLite (as per requirements) with persistent volume mounting
- **Redis**: Optional caching layer
- **Adminer**: Database administration tool (can be used with SQLite)
- **PostgreSQL**: Available for future upgrades but not used by default

### Files
- `Dockerfile` - Production-ready multi-stage build
- `Dockerfile.dev` - Development image with debugging support
- `docker-compose.yml` - Complete development stack
- `.dockerignore` - Excludes unnecessary files from Docker context

## Quick Start

### 1. Environment Setup
```bash
# Copy environment template
cp .env.example .env

# Edit .env with your configuration
# The default values work with Docker setup
```

### 2. Start Development Stack
```bash
# Build and start all services
docker-compose up -d

# Or start with logs visible
docker-compose up
```

### 3. Database Setup
```bash
# Run database migrations
docker-compose exec banking-api npm run db:migrate

# Seed with test data
docker-compose exec banking-api npm run db:seed
```

## WebStorm Configuration

### 1. Node.js Remote Interpreter
1. Go to **Settings** → **Languages & Frameworks** → **Node.js**
2. Click **Configure** next to Node interpreter
3. Add **Docker Compose** interpreter:
   - Server: Docker
   - Configuration file: `docker-compose.yml`
   - Service: `banking-api-dev`
   - Node.js version: 20.x
   - Package manager: npm

### 2. Debug Configuration
1. Go to **Run** → **Edit Configurations**
2. Add **Attach to Node.js/Chrome**:
   - Host: `localhost`
   - Port: `9229`
   - Attach to: `Chrome or Node.js > 6.3 started with --inspect`

### 3. Start Development Container
```bash
# Start development container with debugging
docker-compose --profile dev up -d banking-api-dev
```

### 4. Database Connection in WebStorm
1. Go to **Database** tool window
2. Add **PostgreSQL** data source:
   - Host: `localhost`
   - Port: `5432`
   - Database: `banking_db`
   - User: `banking_user`
   - Password: `banking_pass`

## Available Services

| Service | Port | Description |
|---------|------|-------------|
| banking-api | 3000 | Production API server (SQLite) |
| banking-api-dev | 3001 | Development API with debugging (SQLite) |
| postgres | 5432 | PostgreSQL database (available for upgrades) |
| redis | 6379 | Redis cache |
| adminer | 8080 | Database admin interface |

## Development Workflow

### Hot Reloading
The development container mounts your source code as volumes, enabling hot reloading:
```bash
# Start development mode
docker-compose --profile dev up banking-api-dev
```

### Running Tests
```bash
# Run tests in container
docker-compose exec banking-api npm test

# Run with coverage
docker-compose exec banking-api npm run test:coverage
```

### Database Operations
```bash
# Reset database
docker-compose exec banking-api npm run db:reset

# Generate Prisma client
docker-compose exec banking-api npm run db:generate

# View database with Adminer
open http://localhost:8080
```

### Logs and Monitoring
```bash
# View API logs
docker-compose logs -f banking-api

# View database logs
docker-compose logs -f postgres

# View all logs
docker-compose logs -f
```

## Production Deployment

### Build Production Image
```bash
# Build optimized production image
docker build -t banking-api:latest .

# Run production container
docker run -p 3000:3000 --env-file .env.production banking-api:latest
```

### Environment Variables for Production
Create `.env.production` with:
```bash
NODE_ENV=production
DATABASE_URL=postgresql://user:pass@db-host:5432/banking_db
JWT_SECRET=your-production-secret
HTTPS_ONLY=true
SECURE_COOKIES=true
RATE_LIMIT_ENABLED=true
```

## Troubleshooting

### Common Issues

1. **Port conflicts**
   ```bash
   # Check what's using ports
   lsof -i :3000
   lsof -i :5432
   ```

2. **Database connection issues**
   ```bash
   # Check database health
   docker-compose exec postgres pg_isready -U banking_user -d banking_db
   ```

3. **Permission issues**
   ```bash
   # Fix file permissions
   sudo chown -R $USER:$USER .
   ```

4. **Node modules issues**
   ```bash
   # Rebuild containers
   docker-compose down
   docker-compose build --no-cache
   docker-compose up
   ```

### Health Checks
All services include health checks:
```bash
# Check service health
docker-compose ps

# Manual health check
curl http://localhost:3000/health
curl http://localhost:3000/ready
```

## Security Considerations

- Never commit real secrets to repository
- Use Docker secrets in production
- Run containers as non-root user
- Keep base images updated
- Enable security scanning in CI/CD

## Verification Status

### ✅ Successfully Verified
- **Docker Services**: All services start correctly and pass health checks
- **Database**: SQLite database with proper migrations and persistent storage
- **API Endpoints**: Health and readiness endpoints working correctly
- **Authentication**: Signup, login, and JWT token verification working
- **User Management**: User profile retrieval and updates working
- **Swagger Documentation**: Available at http://localhost:3000/docs
- **Prisma Integration**: Fixed engine compatibility issues for Alpine Linux

### 🧪 Testing
- **Unit Tests**: Created for auth and users modules
- **Integration Tests**: API endpoint testing with proper isolation
- **Test Timeouts**: Configured to prevent hanging test runs
- **Coverage**: Configured with 80% thresholds for comprehensive testing

### 🔧 Issues Resolved
- **Prisma Binary Target**: Fixed Alpine Linux compatibility by setting correct binary targets
- **OpenSSL Dependencies**: Updated Dockerfile to use OpenSSL 3.0.x for current Alpine versions
- **Database Configuration**: Properly configured SQLite paths for Docker volume mounting
- **Test Isolation**: Fixed database conflicts between tests with unique identifiers

## Cleanup

```bash
# Stop all services
docker-compose down

# Remove volumes (⚠️ This deletes all data)
docker-compose down -v

# Remove images
docker rmi banking-api banking-api-dev
```