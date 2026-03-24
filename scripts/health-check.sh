#!/bin/bash
# Canopy Sight Post-Deploy Health Check
# Usage: ./scripts/health-check.sh [api-url] [web-url]
#
# Examples:
#   ./scripts/health-check.sh                                          # local defaults
#   ./scripts/health-check.sh https://canopy-sight-api.fly.dev         # production API only
#   ./scripts/health-check.sh https://canopy-sight-api.fly.dev https://canopy-sight-web.fly.dev

set -euo pipefail

API_URL="${1:-http://localhost:3001}"
WEB_URL="${2:-http://localhost:3000}"
TIMEOUT=10
WARNINGS=0
FAILURES=0

echo "=== Canopy Sight Health Check ==="
echo "API: $API_URL"
echo "Web: $WEB_URL"
echo "Time: $(date -u '+%Y-%m-%dT%H:%M:%SZ')"
echo ""

check_pass() { echo "  PASS: $1"; }
check_fail() { echo "  FAIL: $1"; FAILURES=$((FAILURES + 1)); }
check_warn() { echo "  WARN: $1"; WARNINGS=$((WARNINGS + 1)); }

# ── 1. API liveness ──────────────────────────────────────────────────
echo "[1/5] API health endpoint..."
API_RESPONSE=$(curl -sf --max-time "$TIMEOUT" "$API_URL/health" 2>/dev/null) && {
  check_pass "API /health returned 200"
  # Parse status from JSON
  API_STATUS=$(echo "$API_RESPONSE" | grep -o '"status":"[^"]*"' | head -1 | cut -d'"' -f4)
  if [ "$API_STATUS" = "ok" ]; then
    check_pass "API status is 'ok'"
  elif [ "$API_STATUS" = "degraded" ]; then
    check_warn "API status is 'degraded' — check database connection"
  else
    check_warn "API status is '$API_STATUS'"
  fi
  # Parse database status
  DB_STATUS=$(echo "$API_RESPONSE" | grep -o '"database":"[^"]*"' | head -1 | cut -d'"' -f4)
  if [ "$DB_STATUS" = "connected" ]; then
    check_pass "Database connected"
  else
    check_warn "Database status: $DB_STATUS"
  fi
} || check_fail "API /health unreachable at $API_URL/health"

# ── 2. Web liveness ──────────────────────────────────────────────────
echo ""
echo "[2/5] Web app health..."
HTTP_CODE=$(curl -so /dev/null -w "%{http_code}" --max-time "$TIMEOUT" "$WEB_URL" 2>/dev/null) && {
  if [ "$HTTP_CODE" -ge 200 ] && [ "$HTTP_CODE" -lt 400 ]; then
    check_pass "Web app returned HTTP $HTTP_CODE"
  else
    check_fail "Web app returned HTTP $HTTP_CODE"
  fi
} || check_fail "Web app unreachable at $WEB_URL"

# ── 3. Web health endpoint ───────────────────────────────────────────
echo ""
echo "[3/5] Web /health endpoint..."
curl -sf --max-time "$TIMEOUT" "$WEB_URL/health" -o /dev/null 2>/dev/null \
  && check_pass "Web /health returned 200" \
  || check_warn "Web /health not accessible (may not be deployed yet)"

# ── 4. API tRPC endpoint ─────────────────────────────────────────────
echo ""
echo "[4/5] API tRPC endpoint..."
TRPC_CODE=$(curl -so /dev/null -w "%{http_code}" --max-time "$TIMEOUT" "$API_URL/trpc" 2>/dev/null)
if [ "$TRPC_CODE" -ge 200 ] && [ "$TRPC_CODE" -lt 500 ]; then
  check_pass "tRPC endpoint responding (HTTP $TRPC_CODE)"
else
  check_warn "tRPC endpoint returned HTTP $TRPC_CODE (may be expected without auth)"
fi

# ── 5. Security headers ──────────────────────────────────────────────
echo ""
echo "[5/5] Security headers..."
HEADERS=$(curl -sI --max-time "$TIMEOUT" "$WEB_URL" 2>/dev/null)
if [ -n "$HEADERS" ]; then
  echo "$HEADERS" | grep -qi "x-frame-options" \
    && check_pass "X-Frame-Options header present" \
    || check_warn "X-Frame-Options header missing"
  echo "$HEADERS" | grep -qi "x-content-type-options" \
    && check_pass "X-Content-Type-Options header present" \
    || check_warn "X-Content-Type-Options header missing"
  echo "$HEADERS" | grep -qi "strict-transport-security" \
    && check_pass "Strict-Transport-Security header present" \
    || check_warn "HSTS header missing"
else
  check_warn "Could not retrieve headers from $WEB_URL"
fi

# ── Summary ───────────────────────────────────────────────────────────
echo ""
echo "=== Health Check Summary ==="
echo "Failures: $FAILURES"
echo "Warnings: $WARNINGS"

if [ "$FAILURES" -gt 0 ]; then
  echo "STATUS: FAILED"
  exit 1
elif [ "$WARNINGS" -gt 0 ]; then
  echo "STATUS: PASSED WITH WARNINGS"
  exit 0
else
  echo "STATUS: ALL CHECKS PASSED"
  exit 0
fi
