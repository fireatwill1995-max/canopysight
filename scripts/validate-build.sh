#!/bin/bash
set -e

echo "=== Canopy Sight Build Validation ==="
echo "Started at: $(date -u '+%Y-%m-%dT%H:%M:%SZ')"
echo ""

FAILED=0

step() {
  echo "[$1/$2] $3..."
}

pass() {
  echo "  PASS"
  echo ""
}

fail() {
  echo "  FAIL: $1"
  echo ""
  FAILED=1
}

# Step 1: Generate Prisma client (required before type-check)
step 1 6 "Generating Prisma client"
npx prisma generate --schema packages/database/prisma/schema.prisma && pass || fail "Prisma generate failed"

# Step 2: Type checking
step 2 6 "Type checking all packages"
npx turbo run type-check && pass || fail "Type check failed"

# Step 3: Linting
step 3 6 "Linting"
npx turbo run lint && pass || fail "Lint failed"

# Step 4: Running tests
step 4 6 "Running tests"
npm test && pass || fail "Tests failed"

# Step 5: Building all packages
step 5 6 "Building all packages"
npx turbo run build && pass || fail "Build failed"

# Step 6: Checking TypeScript strict mode
step 6 6 "Checking TypeScript strict mode in tsconfigs"
STRICT_CHECK=0
for tsconfig in apps/*/tsconfig.json packages/*/tsconfig.json; do
  if [ -f "$tsconfig" ]; then
    if grep -q '"strict":\s*true\|"strict": true' "$tsconfig" 2>/dev/null; then
      echo "  $tsconfig: strict mode enabled"
    else
      echo "  WARN: $tsconfig may not have strict mode enabled"
    fi
  fi
done
echo ""

echo "=== Build Validation Complete ==="
if [ "$FAILED" -eq 1 ]; then
  echo "STATUS: FAILED - one or more steps failed"
  exit 1
else
  echo "STATUS: ALL VALIDATIONS PASSED"
  exit 0
fi
