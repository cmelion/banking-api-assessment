# Security Policy

## Overview

This document outlines the security measures implemented in the Banking API Assessment project and provides guidelines for secure development and deployment.

## Security Features

### 1. Authentication & Authorization

#### Password Security
- **Algorithm**: Argon2id (winner of Password Hashing Competition)
- **Configuration**:
  - Memory cost: 65536 KB
  - Time cost: 3 iterations
  - Parallelism: 4 threads
  - Salt: Unique per-user (automatically generated)
- **Implementation**: `src/modules/auth/password-utils.ts`

#### JWT Token Management
- **Access Tokens**:
  - Short-lived (15 minutes default)
  - RS256 algorithm for production (HS256 for development)
  - Contains minimal user data (id, username, role)
- **Refresh Tokens**:
  - Longer-lived (7 days default)
  - Stored in database with expiration tracking
  - Single-use with rotation on refresh
  - Revocable on logout or security events
- **Security Headers**:
  - Tokens transmitted via `Authorization: Bearer <token>` header
  - No sensitive data in JWT payload

### 2. Data Protection

#### Card Data Security
- **PCI DSS Compliance**:
  - Never store raw PAN (Primary Account Number)
  - Only masked card numbers stored (e.g., `**** **** **** 1234`)
  - Card issuance is mocked - no real card processing
- **Implementation**: `src/modules/cards/service.ts`

#### Monetary Precision
- **Database**: Prisma `Decimal` type for exact monetary calculations
- **API**: String representation to avoid JavaScript floating-point errors
- **Validation**: Input validation for all monetary amounts

#### Database Security
- **Connection Security**:
  - SSL/TLS for production PostgreSQL connections
  - Connection pooling with PgBouncer on Vercel
  - Parameterized queries via Prisma ORM (prevents SQL injection)
- **Data Encryption**:
  - Encryption at rest (provider-dependent)
  - Sensitive fields marked for redaction in logs

### 3. Input Validation & Sanitization

#### Request Validation
- **JSON Schema Validation**: All endpoints use Fastify's built-in schema validation
- **Type Safety**: TypeScript interfaces for compile-time checking
- **Sanitization**: Automatic via Fastify schemas
- **File**: Various `schema.ts` files in module directories

#### SQL Injection Prevention
- **ORM**: Prisma with parameterized queries
- **No Raw SQL**: All database queries use Prisma's type-safe query builder
- **Input Escaping**: Automatic through Prisma

### 4. API Security

#### CORS Configuration
- **Development**: Permissive for local testing
- **Production**: Restrictive origin whitelist
- **Credentials**: Support for credential-based requests
- **Configuration**: `src/app.ts`

#### Rate Limiting
- **Implementation**: Ready for production rate limiting
- **Configuration**: Environment-based (RATE_LIMIT_ENABLED)
- **Strategy**: Token bucket algorithm (when enabled)

#### Idempotency
- **Money Transfers**: Idempotency key support prevents duplicate transfers
- **Database Constraint**: Unique constraint on idempotency keys
- **Expiration**: Keys expire after configured period
- **Implementation**: `src/modules/transfers/service.ts`

### 5. Error Handling & Logging

#### Secure Error Messages
- **Production**: Generic error messages for clients
- **Development**: Detailed errors for debugging
- **Sensitive Data**: Never exposed in error responses
- **Implementation**: `src/plugins/error-handler.ts`

#### Audit Logging
- **Structured Logging**: JSON format with Pino
- **Correlation IDs**: Request tracking across services
- **Sensitive Data Redaction**:
  - Passwords
  - Tokens
  - Authorization headers
  - Card numbers
- **Configuration**: `src/plugins/logging.ts`

#### External Error Reporting
- **Sentry Integration**: Optional external error tracking
- **Data Sanitization**: Automatic PII removal before sending
- **Toggle**: Can be enabled/disabled via environment variables
- **Implementation**: `src/plugins/sentry.ts`

### 6. Infrastructure Security

#### Docker Security
- **Non-root User**: Containers run as `node` user
- **Multi-stage Builds**: Minimal attack surface
- **Alpine Linux**: Security-focused base image
- **Health Checks**: Automated container health monitoring
- **Secret Management**: Environment variables for sensitive data

#### Environment Variables
- **Validation**: Schema validation on startup
- **Required Secrets**:
  - JWT_SECRET (minimum 32 characters)
  - DATABASE_URL (connection string)
- **`.env` Security**:
  - Never commit `.env` files
  - Use `.env.example` as template
  - Different configs for dev/test/prod

#### Dependency Security
- **Regular Updates**: Keep dependencies current
- **Vulnerability Scanning**: `npm audit` in CI/CD
- **Lock Files**: `package-lock.json` for reproducible builds
- **Minimal Dependencies**: Only essential packages

### 7. Session Management

#### Token Lifecycle
1. **Login**: Issue access + refresh tokens
2. **API Calls**: Validate access token on each request
3. **Token Refresh**: Rotate refresh token on use
4. **Logout**: Revoke refresh token
5. **Security Events**: Revoke all user tokens

#### Session Security
- **Stateless**: JWT-based, no server-side sessions
- **Token Storage**: Client-side (localStorage/memory)
- **XSS Protection**: HttpOnly cookies in production
- **CSRF Protection**: Token-based authentication

## Security Best Practices

### Development Guidelines

1. **Never Commit Secrets**
   - Use environment variables
   - Add sensitive files to `.gitignore`
   - Review commits before pushing

2. **Input Validation**
   - Validate all user inputs
   - Use schema validation
   - Sanitize before storage

3. **Authentication Checks**
   - Verify JWT on protected routes
   - Check user permissions
   - Log authentication failures

4. **Error Handling**
   - Don't expose stack traces
   - Log errors server-side
   - Return generic messages

5. **Database Security**
   - Use parameterized queries
   - Validate data types
   - Implement row-level security

### Deployment Checklist

#### Pre-Production
- [ ] Change all default passwords
- [ ] Generate strong JWT secrets
- [ ] Configure HTTPS only
- [ ] Enable rate limiting
- [ ] Set up monitoring/alerting
- [ ] Review CORS settings
- [ ] Enable Sentry (optional)
- [ ] Audit dependencies

#### Production Environment
- [ ] Use environment-specific secrets
- [ ] Enable SSL/TLS everywhere
- [ ] Configure firewall rules
- [ ] Set up backup strategy
- [ ] Implement log aggregation
- [ ] Configure auto-scaling
- [ ] Set up health monitoring
- [ ] Enable security headers

### Security Headers (Production)

```javascript
// Recommended security headers
app.helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      scriptSrc: ["'self'"],
      imgSrc: ["'self'", "data:", "https:"],
    },
  },
  hsts: {
    maxAge: 31536000,
    includeSubDomains: true,
    preload: true,
  },
});
```

## Vulnerability Reporting

If you discover a security vulnerability, please:

1. **Do NOT** create a public GitHub issue
2. Email security concerns to the project maintainer
3. Include:
   - Description of the vulnerability
   - Steps to reproduce
   - Potential impact
   - Suggested fix (if any)

## Incident Response

### Security Incident Checklist

1. **Immediate Actions**
   - [ ] Identify scope of breach
   - [ ] Isolate affected systems
   - [ ] Revoke compromised tokens
   - [ ] Reset affected passwords

2. **Investigation**
   - [ ] Review logs for unauthorized access
   - [ ] Identify attack vector
   - [ ] Assess data exposure
   - [ ] Document timeline

3. **Remediation**
   - [ ] Patch vulnerabilities
   - [ ] Update dependencies
   - [ ] Enhance monitoring
   - [ ] Review security policies

4. **Communication**
   - [ ] Notify affected users
   - [ ] Update security documentation
   - [ ] Post-mortem analysis
   - [ ] Implement preventive measures

## Compliance Considerations

### PCI DSS (Payment Card Industry)
- No real card processing implemented
- Masked PAN storage only
- Mock card issuance for demonstration

### GDPR (General Data Protection Regulation)
- User data deletion capabilities
- Data export functionality (planned)
- Consent management (planned)
- Audit trail for data access

### Financial Regulations
- Transaction atomicity (ACID compliance)
- Audit logging for all monetary operations
- Idempotency for payment operations
- Balance consistency checks

## Security Tools & Resources

### Recommended Tools
- **Dependency Scanning**: `npm audit`, Snyk
- **Static Analysis**: ESLint security plugins
- **Secret Scanning**: git-secrets, truffleHog
- **Container Scanning**: Docker Scout, Trivy
- **SAST**: CodeQL, Semgrep
- **DAST**: OWASP ZAP, Burp Suite

### Security Resources
- [OWASP Top 10](https://owasp.org/www-project-top-ten/)
- [Node.js Security Best Practices](https://nodejs.org/en/docs/guides/security/)
- [Fastify Security](https://www.fastify.io/docs/latest/Guides/Security/)
- [Prisma Security](https://www.prisma.io/docs/guides/security)
- [Docker Security](https://docs.docker.com/engine/security/)

## Version History

| Version | Date | Changes |
|---------|------|---------|
| 1.0.0 | 2024-12-19 | Initial security documentation |

## Contact

For security concerns, please contact the development team through appropriate channels.

---

**Last Updated**: December 19, 2024
**Classification**: Public
**Review Schedule**: Quarterly