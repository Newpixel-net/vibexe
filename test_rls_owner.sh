#!/bin/bash
# RLS Owner Policy Test Script
# Tests cross-user isolation with owner-based access control

BASE="https://vibexe.online/api/apps/bldr_kz6V5Xi_DJt5OeUBGLSEa"
ENTITY="contact_messages"

echo "=========================================="
echo "RLS OWNER POLICY TEST"
echo "=========================================="

# Step 1: Set owner policy for contact_messages
echo ""
echo "--- STEP 1: Set owner policy ---"
POLICY_RESULT=$(curl -s -w "\nHTTP:%{http_code}" -X PUT "$BASE/security/policies" \
  -H "Content-Type: application/json" \
  -d '{"entityName":"contact_messages","readAccess":"owner","writeAccess":"owner","deleteAccess":"owner","ownerField":"user_id"}')
echo "$POLICY_RESULT"

# Step 2: Create User A
echo ""
echo "--- STEP 2: Create User A (ownerA@test.com) ---"
SIGNUP_A=$(curl -s -w "\nHTTP:%{http_code}" -X POST "$BASE/auth/signup" \
  -H "Content-Type: application/json" \
  -d '{"email":"ownerA@test.com","password":"Test1234!","display_name":"Owner A"}')
echo "$SIGNUP_A"

# Extract token A (try signup response, fall back to signin)
TOKEN_A=$(echo "$SIGNUP_A" | head -1 | python3 -c "import sys,json; d=json.load(sys.stdin); print(d.get('token',''))" 2>/dev/null)
if [ -z "$TOKEN_A" ]; then
  echo "User A exists, signing in..."
  SIGNIN_A=$(curl -s -X POST "$BASE/auth/signin" \
    -H "Content-Type: application/json" \
    -d '{"email":"ownerA@test.com","password":"Test1234!"}')
  TOKEN_A=$(echo "$SIGNIN_A" | python3 -c "import sys,json; print(json.load(sys.stdin)['token'])" 2>/dev/null)
fi
echo "TOKEN_A=$TOKEN_A"

# Step 3: Create User B
echo ""
echo "--- STEP 3: Create User B (ownerB@test.com) ---"
SIGNUP_B=$(curl -s -w "\nHTTP:%{http_code}" -X POST "$BASE/auth/signup" \
  -H "Content-Type: application/json" \
  -d '{"email":"ownerB@test.com","password":"Test1234!","display_name":"Owner B"}')
echo "$SIGNUP_B"

TOKEN_B=$(echo "$SIGNUP_B" | head -1 | python3 -c "import sys,json; d=json.load(sys.stdin); print(d.get('token',''))" 2>/dev/null)
if [ -z "$TOKEN_B" ]; then
  echo "User B exists, signing in..."
  SIGNIN_B=$(curl -s -X POST "$BASE/auth/signin" \
    -H "Content-Type: application/json" \
    -d '{"email":"ownerB@test.com","password":"Test1234!"}')
  TOKEN_B=$(echo "$SIGNIN_B" | python3 -c "import sys,json; print(json.load(sys.stdin)['token'])" 2>/dev/null)
fi
echo "TOKEN_B=$TOKEN_B"

# Step 4: User A creates a record
echo ""
echo "--- STEP 4: User A creates a record ---"
CREATE_A=$(curl -s -w "\nHTTP:%{http_code}" -X POST "$BASE/data/$ENTITY" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN_A" \
  -d '{"name":"Alice Record","email":"alice@test.com","subject":"From Alice","message":"This is Alice data","status":"new"}')
echo "$CREATE_A"
RECORD_A_ID=$(echo "$CREATE_A" | head -1 | python3 -c "import sys,json; print(json.load(sys.stdin)['data']['id'])" 2>/dev/null)
echo "RECORD_A_ID=$RECORD_A_ID"

# Step 5: User B creates a record
echo ""
echo "--- STEP 5: User B creates a record ---"
CREATE_B=$(curl -s -w "\nHTTP:%{http_code}" -X POST "$BASE/data/$ENTITY" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN_B" \
  -d '{"name":"Bob Record","email":"bob@test.com","subject":"From Bob","message":"This is Bob data","status":"new"}')
echo "$CREATE_B"
RECORD_B_ID=$(echo "$CREATE_B" | head -1 | python3 -c "import sys,json; print(json.load(sys.stdin)['data']['id'])" 2>/dev/null)
echo "RECORD_B_ID=$RECORD_B_ID"

# Step 6: User A lists records - should ONLY see their own
echo ""
echo "--- STEP 6: User A lists records (should only see Alice's) ---"
LIST_A=$(curl -s -w "\nHTTP:%{http_code}" -X GET "$BASE/data/$ENTITY" \
  -H "Authorization: Bearer $TOKEN_A")
echo "$LIST_A"

# Step 7: User B lists records - should ONLY see their own
echo ""
echo "--- STEP 7: User B lists records (should only see Bob's) ---"
LIST_B=$(curl -s -w "\nHTTP:%{http_code}" -X GET "$BASE/data/$ENTITY" \
  -H "Authorization: Bearer $TOKEN_B")
echo "$LIST_B"

# Step 8: User B tries to GET User A's record - should get 403
echo ""
echo "--- STEP 8: User B tries to GET User A's record (expect 403) ---"
if [ -n "$RECORD_A_ID" ]; then
  GET_CROSS=$(curl -s -w "\nHTTP:%{http_code}" -X GET "$BASE/data/$ENTITY/$RECORD_A_ID" \
    -H "Authorization: Bearer $TOKEN_B")
  echo "$GET_CROSS"
else
  echo "SKIP: No record A ID"
fi

# Step 9: User B tries to UPDATE User A's record - should get 403
echo ""
echo "--- STEP 9: User B tries to UPDATE User A's record (expect 403) ---"
if [ -n "$RECORD_A_ID" ]; then
  PUT_CROSS=$(curl -s -w "\nHTTP:%{http_code}" -X PUT "$BASE/data/$ENTITY/$RECORD_A_ID" \
    -H "Content-Type: application/json" \
    -H "Authorization: Bearer $TOKEN_B" \
    -d '{"status":"hacked"}')
  echo "$PUT_CROSS"
else
  echo "SKIP: No record A ID"
fi

# Step 10: User B tries to DELETE User A's record - should get 403
echo ""
echo "--- STEP 10: User B tries to DELETE User A's record (expect 403) ---"
if [ -n "$RECORD_A_ID" ]; then
  DEL_CROSS=$(curl -s -w "\nHTTP:%{http_code}" -X DELETE "$BASE/data/$ENTITY/$RECORD_A_ID" \
    -H "Authorization: Bearer $TOKEN_B")
  echo "$DEL_CROSS"
else
  echo "SKIP: No record A ID"
fi

# Step 11: No-auth GET should get 401 (owner policy requires auth for read)
echo ""
echo "--- STEP 11: No-auth GET (expect 401) ---"
NOAUTH=$(curl -s -w "\nHTTP:%{http_code}" -X GET "$BASE/data/$ENTITY")
echo "$NOAUTH"

# Step 12: User A can still access their own record
echo ""
echo "--- STEP 12: User A GETs their own record (expect 200) ---"
if [ -n "$RECORD_A_ID" ]; then
  OWN_GET=$(curl -s -w "\nHTTP:%{http_code}" -X GET "$BASE/data/$ENTITY/$RECORD_A_ID" \
    -H "Authorization: Bearer $TOKEN_A")
  echo "$OWN_GET"
else
  echo "SKIP: No record A ID"
fi

echo ""
echo "=========================================="
echo "TEST COMPLETE"
echo "=========================================="
