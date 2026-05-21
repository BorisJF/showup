#!/usr/bin/env bash
# ─────────────────────────────────────────────────────────────────────────────
# SHOW UP — system smoke test
# Runs a full end-to-end round-trip against a deployed URL.
#
# Usage:
#   ./tests/system/smoke.sh https://boris-showup.netlify.app
#   ./tests/system/smoke.sh https://<deploy-preview-url>--boris-showup.netlify.app
#
# Requires: curl, jq
# Exit code: 0 = all assertions passed, 1 = at least one failed
# ─────────────────────────────────────────────────────────────────────────────

set -euo pipefail

BASE_URL="${1:-}"
if [[ -z "$BASE_URL" ]]; then
  echo "Usage: $0 <base-url>"
  echo "Example: $0 https://boris-showup.netlify.app"
  exit 1
fi

# Strip trailing slash
BASE_URL="${BASE_URL%/}"

# Use a date far in the past so we don't collide with real data.
# Adjust if that date already has a row in your DB.
TEST_DATE="2099-12-31"

PASS=0
FAIL=0

# ─── helpers ─────────────────────────────────────────────────────────────────

green() { echo -e "\033[32m✓ $*\033[0m"; }
red()   { echo -e "\033[31m✗ $*\033[0m"; }

assert_eq() {
  local label="$1" expected="$2" actual="$3"
  if [[ "$actual" == "$expected" ]]; then
    green "$label"
    ((PASS++))
  else
    red "$label  (expected: $expected, got: $actual)"
    ((FAIL++))
  fi
}

assert_not_empty() {
  local label="$1" value="$2"
  if [[ -n "$value" && "$value" != "null" ]]; then
    green "$label"
    ((PASS++))
  else
    red "$label  (expected non-empty, got: $value)"
    ((FAIL++))
  fi
}

# ─── 1. Static page loads ────────────────────────────────────────────────────

echo ""
echo "── Static page ──────────────────────────────────────────────────────────"
HTTP_STATUS=$(curl -s -o /dev/null -w "%{http_code}" "$BASE_URL/")
assert_eq "GET / returns 200" "200" "$HTTP_STATUS"

# ─── 2. Load: no entry for test date ─────────────────────────────────────────

echo ""
echo "── GET /api/load (fresh day) ────────────────────────────────────────────"
LOAD_RESP=$(curl -s "$BASE_URL/api/load?date=$TEST_DATE")
echo "  Response: $LOAD_RESP"

TODAY_NULL=$(echo "$LOAD_RESP" | jq -r '.today')
assert_eq "today is null before commit" "null" "$TODAY_NULL"

STREAK_ZERO=$(echo "$LOAD_RESP" | jq -r '.streak')
assert_eq "streak is 0 before commit" "0" "$STREAK_ZERO"

HISTORY_EMPTY=$(echo "$LOAD_RESP" | jq -r '.history | length')
assert_eq "history is empty before commit" "0" "$HISTORY_EMPTY"

# ─── 3. Submit: create the entry ─────────────────────────────────────────────

echo ""
echo "── POST /api/submit ─────────────────────────────────────────────────────"
SUBMIT_RESP=$(curl -s -X POST "$BASE_URL/api/submit" \
  -H "Content-Type: application/json" \
  -d "{\"date\":\"$TEST_DATE\",\"focus\":\"Smoke test focus\",\"commitment\":\"Smoke test commitment.\"}")
echo "  Response: $SUBMIT_RESP"

ENTRY_DATE=$(echo "$SUBMIT_RESP" | jq -r '.date')
assert_eq "entry date matches" "$TEST_DATE" "$ENTRY_DATE"

ENTRY_FOCUS=$(echo "$SUBMIT_RESP" | jq -r '.focus')
assert_eq "entry focus matches" "Smoke test focus" "$ENTRY_FOCUS"

ENTRY_MSG=$(echo "$SUBMIT_RESP" | jq -r '.daily_message')
assert_not_empty "daily_message is present" "$ENTRY_MSG"

ENTRY_MODE=$(echo "$SUBMIT_RESP" | jq -r '.message_mode')
assert_not_empty "message_mode is present" "$ENTRY_MODE"

# ─── 4. Idempotency: submit again, should return same entry ──────────────────

echo ""
echo "── Idempotency check ────────────────────────────────────────────────────"
SUBMIT2_RESP=$(curl -s -X POST "$BASE_URL/api/submit" \
  -H "Content-Type: application/json" \
  -d "{\"date\":\"$TEST_DATE\",\"focus\":\"Different focus\",\"commitment\":\"Different commitment.\"}")

ENTRY2_FOCUS=$(echo "$SUBMIT2_RESP" | jq -r '.focus')
assert_eq "second submit returns original focus (idempotent)" "Smoke test focus" "$ENTRY2_FOCUS"

# ─── 5. Load after commit: entry + streak ────────────────────────────────────

echo ""
echo "── GET /api/load (after commit) ─────────────────────────────────────────"
LOAD2_RESP=$(curl -s "$BASE_URL/api/load?date=$TEST_DATE")
echo "  Response: $LOAD2_RESP"

TODAY_FOCUS=$(echo "$LOAD2_RESP" | jq -r '.today.focus')
assert_eq "today.focus matches submitted focus" "Smoke test focus" "$TODAY_FOCUS"

# Streak for a date of 2099-12-31 will be 1 (only this one entry exists in that range)
STREAK_AFTER=$(echo "$LOAD2_RESP" | jq -r '.streak')
assert_eq "streak is 1 after single commit" "1" "$STREAK_AFTER"

# ─── 6. Validation: bad requests ─────────────────────────────────────────────

echo ""
echo "── Validation ───────────────────────────────────────────────────────────"
BAD_DATE_STATUS=$(curl -s -o /dev/null -w "%{http_code}" "$BASE_URL/api/load?date=not-a-date")
assert_eq "load with bad date returns 400" "400" "$BAD_DATE_STATUS"

BAD_SUBMIT_STATUS=$(curl -s -o /dev/null -w "%{http_code}" -X POST "$BASE_URL/api/submit" \
  -H "Content-Type: application/json" \
  -d "{\"date\":\"$TEST_DATE\"}")
assert_eq "submit with missing fields returns 400" "400" "$BAD_SUBMIT_STATUS"

# ─── Summary ─────────────────────────────────────────────────────────────────

echo ""
echo "─────────────────────────────────────────────────────────────────────────"
echo "  Passed: $PASS"
echo "  Failed: $FAIL"
echo "─────────────────────────────────────────────────────────────────────────"

if [[ $FAIL -gt 0 ]]; then
  echo ""
  red "Smoke test FAILED — $FAIL assertion(s) did not pass."
  exit 1
else
  green "All smoke tests passed."
  exit 0
fi
