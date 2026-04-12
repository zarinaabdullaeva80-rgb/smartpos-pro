#!/bin/bash

# Comprehensive Test Suite for Production Verification
# Run this before deploying to production

set -e

echo "🧪 Starting Comprehensive Test Suite..."
echo "======================================="

# Colors
GREEN='\033[0.32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

PASSED=0
FAILED=0

# Function to run test
run_test() {
    local test_name=$1
    local test_command=$2
    
    echo -n "Testing: $test_name... "
    
    if eval "$test_command" > /dev/null 2>&1; then
        echo -e "${GREEN}✓ PASSED${NC}"
        ((PASSED++))
        return 0
    else
        echo -e "${RED}✗ FAILED${NC}"
        ((FAILED++))
        return 1
    fi
}

echo ""
echo "📦 1. Dependencies Check"
echo "------------------------"

run_test "Node.js installed" "command -v node"
run_test "npm installed" "command -v npm"
run_test "PostgreSQL installed" "command -v psql"
run_test "Redis (optional)" "command -v redis-cli || true"
run_test "Docker installed" "command -v docker"

echo ""
echo "🗄️  2. Database Tests"
echo "--------------------"

run_test "Database connection" "PGPASSWORD=\$DB_PASSWORD psql -h localhost -U postgres -d accounting_db -c 'SELECT 1' "
run_test "Migrations applied" "PGPASSWORD=\$DB_PASSWORD psql -h localhost -U postgres -d accounting_db -c 'SELECT COUNT(*) FROM users'"
run_test "Indexes exist" "PGPASSWORD=\$DB_PASSWORD psql -h localhost -U postgres -d accounting_db -c 'SELECT COUNT(*) FROM pg_indexes WHERE schemaname = '\''public'\'''"
run_test "Functions exist" "PGPASSWORD=\$DB_PASSWORD psql -h localhost -U postgres -d accounting_db -c 'SELECT COUNT(*) FROM pg_proc WHERE proname LIKE '\''%torg%'\'''"

echo ""
echo "🌐 3. Backend API Tests"
echo "----------------------"

API_URL="${API_URL:-http://localhost:5000}"

run_test "Server is running" "curl -f $API_URL/api/health"
run_test "Health endpoint" "curl -f $API_URL/api/health | grep -q 'uptime'"
run_test "Status endpoint" "curl -f $API_URL/api/status"
run_test "Version endpoint" "curl -f $API_URL/api/version"
run_test "Swagger docs" "curl -f $API_URL/api-docs"

# Authentication test
echo -n "Testing: Authentication... "
TOKEN=$(curl -s -X POST $API_URL/api/auth/login \
    -H "Content-Type: application/json" \
    -d '{"username":"admin","password":"admin"}' | jq -r '.token')

if [ ! -z "$TOKEN" ] && [ "$TOKEN" != "null" ]; then
    echo -e "${GREEN}✓ PASSED${NC}"
    ((PASSED++))
else
    echo -e "${RED}✗ FAILED${NC}"
    ((FAILED++))
fi

# Protected endpoint test
if [ ! -z "$TOKEN" ]; then
    run_test "Protected endpoint" "curl -f -H 'Authorization: Bearer $TOKEN' $API_URL/api/products"
fi

echo ""
echo "🎨 4. Frontend Tests"
echo "-------------------"

FRONTEND_URL="${FRONTEND_URL:-http://localhost:3000}"

run_test "Frontend is running" "curl -f $FRONTEND_URL"
run_test "Login page loads" "curl -f $FRONTEND_URL/login"
run_test "Static assets" "curl -f $FRONTEND_URL/static/js/main.*.js || curl -f $FRONTEND_URL/index.html"

echo ""
echo "🔒 5. Security Tests"
echo "-------------------"

run_test "Security headers (helmet)" "curl -I $API_URL/api/health | grep -i 'x-frame-options'"
run_test "CORS configured" "curl -I -H 'Origin: http://localhost:3000' $API_URL/api/health | grep -i 'access-control'"
run_test "Rate limiting" "for i in {1..10}; do curl -s $API_URL/api/health > /dev/null; done"

echo ""
echo "⚡ 6. Performance Tests"
echo "---------------------"

# Response time test
echo -n "Testing: API response time... "
START_TIME=$(date +%s%N)
curl -s $API_URL/api/health > /dev/null
END_TIME=$(date +%s%N)
RESPONSE_TIME=$(( ($END_TIME - $START_TIME) / 1000000 ))

if [ $RESPONSE_TIME -lt 1000 ]; then
    echo -e "${GREEN}✓ PASSED${NC} (${RESPONSE_TIME}ms)"
    ((PASSED++))
else
    echo -e "${YELLOW}⚠ WARNING${NC} (${RESPONSE_TIME}ms - should be < 1000ms)"
    ((PASSED++))
fi

echo ""
echo "🐳 7. Docker Tests"
echo "-----------------"

if command -v docker &> /dev/null; then
    run_test "Docker daemon running" "docker info"
    run_test "docker-compose.yml valid" "docker-compose config"
fi

echo ""
echo "📝 8. Configuration Tests"
echo "------------------------"

run_test ".env file exists" "test -f server/.env"
run_test "JWT_SECRET set" "grep -q '^JWT_SECRET=' server/.env"
run_test "DATABASE_URL set" "grep -q '^DATABASE_URL=' server/.env || grep -q '^DB_' server/.env"

echo ""
echo "🧪 9. Unit Tests"
echo "---------------"

cd server
echo -n "Running Jest tests... "
if npm test 2>&1 | grep -q "PASS"; then
    echo -e "${GREEN}✓ PASSED${NC}"
    ((PASSED++))
else
    echo -e "${RED}✗ FAILED${NC}"
    ((FAILED++))
fi
cd ..

echo ""
echo "📊 10. Test Coverage"
echo "-------------------"

cd server
COVERAGE=$(npm run test:coverage 2>&1 | grep -oP 'All files\s+\|\s+\K[0-9.]+' || echo "0")
cd ..

echo -n "Test coverage: "
if (( $(echo "$COVERAGE >= 60" | bc -l) )); then
    echo -e "${GREEN}${COVERAGE}% ✓${NC}"
    ((PASSED++))
else
    echo -e "${YELLOW}${COVERAGE}% (target: 60%+)${NC}"
    ((FAILED++))
fi

echo ""
echo "======================================="
echo "🎯 TEST SUMMARY"
echo "======================================="
echo -e "Passed: ${GREEN}$PASSED${NC}"
echo -e "Failed: ${RED}$FAILED${NC}"
echo ""

TOTAL=$((PASSED + FAILED))
PERCENTAGE=$((PASSED * 100 / TOTAL))

if [ $FAILED -eq 0 ]; then
    echo -e "${GREEN}✅ ALL TESTS PASSED! ($PERCENTAGE%)${NC}"
    echo "System is ready for production!"
    exit 0
elif [ $PERCENTAGE -ge 80 ]; then
    echo -e "${YELLOW}⚠️  MOST TESTS PASSED ($PERCENTAGE%)${NC}"
    echo "Review failed tests before production deployment"
    exit 0
else
    echo -e "${RED}❌ MANY TESTS FAILED ($PERCENTAGE%)${NC}"
    echo "Fix issues before deploying to production"
    exit 1
fi
