# Canopy Sight™ - Testing Guide

## Test Structure

```
apps/
├── api/
│   └── src/
│       └── __tests__/
├── web/
│   └── src/
│       └── __tests__/
└── edge-agent/
    └── src/
        └── __tests__/
```

## Running Tests

```bash
# Run all tests
npm run test

# Watch mode
npm run test:watch

# Coverage report
npm run test:coverage
```

## Test Types

### Unit Tests

Test individual functions and components in isolation.

**Example:**
```typescript
import { describe, it, expect } from "vitest";
import { calculateRisk } from "../risk/scorer";

describe("RiskScorer", () => {
  it("should calculate risk score correctly", () => {
    const risk = calculateRisk(mockDetection, mockTrackedObject);
    expect(risk.overall).toBeGreaterThanOrEqual(0);
    expect(risk.overall).toBeLessThanOrEqual(100);
  });
});
```

### Integration Tests

Test API endpoints and database interactions.

**Example:**
```typescript
import { describe, it, expect } from "vitest";
import { appRouter } from "../router";
import { createContext } from "../trpc/context";

describe("Site Router Integration", () => {
  it("should create a site", async () => {
    const ctx = createTestContext();
    const caller = appRouter.createCaller(ctx);
    
    const site = await caller.site.create({
      name: "Test Site",
      latitude: 40.7128,
      longitude: -74.0060,
      organizationId: "test-org",
    });
    
    expect(site.id).toBeDefined();
    expect(site.name).toBe("Test Site");
  });
});
```

### E2E Tests

Test complete user flows with Playwright.

**Example:**
```typescript
import { test, expect } from "@playwright/test";

test("user can create a site", async ({ page }) => {
  await page.goto("/sites");
  await page.click("text=Add Site");
  await page.fill('input[name="name"]', "Test Site");
  await page.click("button[type=submit]");
  
  await expect(page.locator("text=Test Site")).toBeVisible();
});
```

## Test Utilities

### Mock Prisma Client

```typescript
export function createMockPrisma() {
  return {
    site: {
      create: vi.fn(),
      findMany: vi.fn(),
      findFirst: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
    },
    // ... other models
  };
}
```

### Test Context

```typescript
export function createTestContext(overrides = {}) {
  return {
    userId: "test-user",
    organizationId: "test-org",
    userRole: "admin",
    prisma: createMockPrisma(),
    ...overrides,
  };
}
```

## Coverage Goals

- Unit tests: 80%+ coverage
- Integration tests: Critical paths covered
- E2E tests: Main user flows covered

## CI/CD Integration

Tests run automatically on:
- Pull requests
- Commits to main branch
- Pre-deployment
