# Entropy Testing Guide

## Overview
This document provides comprehensive testing procedures for the Entropy academic community platform.

## Quick Start

### Development Testing
```powershell
# Run quick validation tests
npm run test:quick

# Run comprehensive dev tests
npm run test:dev

# Run production readiness tests
npm run test:prod
```

## Test Scripts

### 1. Quick Test (`quick-test.ps1`)
**Purpose**: Fast validation during active development  
**Duration**: ~30 seconds  
**Use When**: After making code changes, before committing

**Checks**:
- ESLint validation
- TypeScript type checking

```powershell
npm run test:quick
```

### 2. Development Test (`test-dev.ps1`)
**Purpose**: Comprehensive development environment validation  
**Duration**: 2-3 minutes  
**Use When**: Setting up development environment, major changes

**Checks**:
- Node.js version (requires 18+)
- Python version (for AI agent)
- Dependency installation
- Environment variables presence
- ESLint validation
- TypeScript compilation
- Database connectivity
- Production build test

```powershell
npm run test:dev
```

### 3. Production Test (`test-production.ps1`)
**Purpose**: Production deployment readiness  
**Duration**: 3-5 minutes  
**Use When**: Before deploying to production

**Checks**:
- Environment variables validation
- Security audit
- Build optimization
- Database schema validation
- API endpoint availability
- Performance optimizations
- Docker build (if available)
- Accessibility features
- SEO configuration

```powershell
npm run test:prod
```

## Manual Testing Checklist

### Frontend Testing

#### Desktop Testing (1920x1080)
- [ ] Homepage loads correctly
- [ ] Navigation works across all pages
- [ ] Dark mode theme is applied correctly
- [ ] All interactive elements respond
- [ ] Forms submit successfully
- [ ] Authentication flow works

#### Tablet Testing (768x1024)
- [ ] Layout adapts correctly
- [ ] Mobile menu appears and functions
- [ ] Touch interactions work
- [ ] Cards and components stack properly

#### Mobile Testing (375x667)
- [ ] All content is readable
- [ ] Buttons are touch-friendly (44x44px minimum)
- [ ] Forms are usable
- [ ] Navigation is accessible
- [ ] No horizontal scrolling

### Backend Testing

#### API Endpoints
Test each endpoint using tools like Postman or curl:

```powershell
# Test health endpoint
Invoke-WebRequest -Uri "http://localhost:5000/api/health" -Method GET

# Test doubts endpoint
Invoke-WebRequest -Uri "http://localhost:5000/api/doubts" -Method GET
```

#### Database Operations
```powershell
# Generate Prisma client
npm run db:generate

# Push schema to database
npm run db:push

# Open Prisma Studio
npm run db:studio
```

### AI Agent Testing

#### Start AI Agent
```powershell
cd apps/ai-agent
python -m app.main
```

#### Test Endpoints
```powershell
# Test health
Invoke-WebRequest -Uri "http://localhost:8000/health" -Method GET

# Test AI agent response
$body = @{
    query = "What is machine learning?"
    context = ""
} | ConvertTo-Json

Invoke-WebRequest -Uri "http://localhost:8000/api/query" -Method POST -Body $body -ContentType "application/json"
```

## Browser Compatibility Testing

### Supported Browsers
- Chrome/Edge (latest 2 versions)
- Firefox (latest 2 versions)
- Safari (latest 2 versions)

### Test Cases
1. **Visual Rendering**: Ensure consistent appearance across browsers
2. **JavaScript Features**: Test all interactive features
3. **CSS Features**: Verify backdrop-filter, gradients, animations
4. **Performance**: Check load times and responsiveness

## Performance Testing

### Metrics to Monitor
- **First Contentful Paint (FCP)**: < 1.8s
- **Largest Contentful Paint (LCP)**: < 2.5s
- **Time to Interactive (TTI)**: < 3.8s
- **Cumulative Layout Shift (CLS)**: < 0.1

### Tools
```powershell
# Run Lighthouse audit
npx lighthouse http://localhost:5000 --view

# Check bundle size
cd apps/app
npm run build
```

## Accessibility Testing

### Automated Testing
```powershell
# Run axe accessibility tests
npx @axe-core/cli http://localhost:5000
```

### Manual Testing
- [ ] Keyboard navigation works (Tab, Enter, Escape)
- [ ] Screen reader compatibility (NVDA, JAWS)
- [ ] Color contrast meets WCAG AA standards
- [ ] All images have alt text
- [ ] Forms have proper labels
- [ ] Focus indicators are visible

## Security Testing

### Basic Security Checks
```powershell
# Run npm audit
npm audit --production

# Check for known vulnerabilities
npm audit fix
```

### Manual Security Review
- [ ] Environment variables never exposed to client
- [ ] API routes use proper authentication
- [ ] Input validation on all forms
- [ ] SQL injection prevention (Prisma handles this)
- [ ] XSS prevention (React handles this)
- [ ] CSRF protection enabled

## CI/CD Integration

### GitHub Actions Example
```yaml
name: Test Suite
on: [push, pull_request]
jobs:
  test:
    runs-on: windows-latest
    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-node@v3
        with:
          node-version: '18'
      - run: npm install
      - run: npm run test:dev
```

## Troubleshooting

### Common Issues

#### "Database connection failed"
- Verify DATABASE_URL in .env file
- Ensure PostgreSQL is running
- Check network connectivity

#### "Build failed"
- Clear .next directory: `Remove-Item -Recurse -Force apps/app/.next`
- Clear node_modules and reinstall: `npm clean-install`
- Check for TypeScript errors: `npm run lint`

#### "Port already in use"
- Kill process on port 5000: `Stop-Process -Id (Get-NetTCPConnection -LocalPort 5000).OwningProcess`
- Or change port in package.json

## Best Practices

1. **Run quick tests before every commit**
2. **Run dev tests after major changes**
3. **Run production tests before deployment**
4. **Test on multiple browsers regularly**
5. **Test responsive design at different breakpoints**
6. **Keep dependencies updated**
7. **Monitor performance metrics**

## Continuous Monitoring

### Production Monitoring
- Use Vercel Analytics for frontend
- Use error tracking (e.g., Sentry)
- Monitor API response times
- Track user experience metrics

### Development Monitoring
```powershell
# Watch mode for tests
npm run dev

# Watch lint
npm run lint -- --watch
```

## Reporting Issues

When reporting bugs, include:
1. Steps to reproduce
2. Expected behavior
3. Actual behavior
4. Browser/OS information
5. Screenshots/videos
6. Console errors
7. Network tab information

## Resources

- [Next.js Testing Documentation](https://nextjs.org/docs/testing)
- [React Testing Library](https://testing-library.com/react)
- [Prisma Testing Guide](https://www.prisma.io/docs/guides/testing)
- [Web.dev Testing Tools](https://web.dev/testing/)
