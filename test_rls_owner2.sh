#!/bin/bash
# RLS Owner Policy Test Script v2
# Tests cross-user isolation with owner-based access control
# Uses fresh users (ownerC/ownerD) to avoid stale data from broken first run

BASE="https://vibexe.online/api/apps/bldr_kz6V5Xi_DJt5OeUBGLSEa"
ENTITY="contact_messages"

echo "=========================================="
echo "RLS OWNER POLICY TEST v2"
echo "=========================================="

# Step 1: Set owner policy for contact_messages
echo ""
echo "--- STEP 1: Set owner policy ---"
POLICY_RESULT=$(curl -s -w "\nHTTP:%{http_code}" -X PUT "$BASE/security/policies" \
  -H "Content-Type: application/json" \
  -d '{"entityName":"contact_messages","readAccess":"owner","writeAccess":"owner","deleteAccess":"owner","ownerField":"user_id"}')
echo "$POLICY_RESULT"

# Step 2: Create User C
echo ""
echo "--- STEP 2: Create User C (ownerC@test.com) ---"
SIGNUP_C=$(curl -s -X POST "$BASE/auth/signup" \
  -H "Content-Type: application/json" \
  -d '{"email":"ownerC@test.com","password":"Test1234!","display_name":"Owner C"}')
echo "$SIGNUP_C"

TOKEN_C=$(echo "$SIGNUP_C" | python3 -c "import sys,json; d=json.load(sys.stdin); print(d.get('token',''))" 2>/dev/null)
if [ -z "$TOKEN_C" ]; then
  echo "User C exists, signing in..."
  SIGNIN_C=$(curl -s -X POST "$BASE/auth/signin" \
    -H "Content-Type: application/json" \
    -d '{"email":"ownerC@test.com","password":"Test1234!"}')
  TOKEN_C=$(echo "$SIGNIN_C" | python3 -c "import sys,json; print(json.load(sys.stdin)['token'])" 2>/dev/null)
fi
echo "TOKEN_C=$TOKEN_C"

# Step 3: Create User D
echo ""
echo "--- STEP 3: Create User D (ownerD@test.com) ---"
SIGNUP_D=$(curl -s -X POST "$BASE/auth/signup" \
  -H "Content-Type: application/json" \
  -d '{"email":"ownerD@test.com","password":"Test1234!","display_name":"Owner D"}')
echo "$SIGNUP_D"

TOKEN_D=$(echo "$SIGNUP_D" | python3 -c "import sys,json; d=json.load(sys.stdin); print(d.get('token',''))" 2>/dev/null)
if [ -z "$TOKEN_D" ]; then
  echo "User D exists, signing in..."
  SIGNIN_D=$(curl -s -X POST "$BASE/auth/signin" \
    -H "Content-Type: application/json" \
    -d '{"email":"ownerD@test.com","password":"Test1234!"}')
  TOKEN_D=$(echo "$SIGNIN_D" | python3 -c "import sys,json; print(json.load(sys.stdin)['token'])" 2>/dev/null)
fi
echo "TOKEN_D=$TOKEN_D"

# Step 4: User C creates a record
echo ""
echo "--- STEP 4: User C creates a record ---"
CREATE_C=$(curl -s -X POST "$BASE/data/$ENTITY" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN_C" \
  -d '{"name":"Charlie Record","email":"charlie@test.com","subject":"From Charlie","message":"This is Charlie data","status":"new"}')
echo "$CREATE_C"
RECORD_C_ID=$(echo "$CREATE_C" | python3 -c "import sys,json; print(json.load(sys.stdin)['data']['id'])" 2>/dev/null)
echo "RECORD_C_ID=$RECORD_C_ID"

# Step 5: User D creates a record
echo ""
echo "--- STEP 5: User D creates a record ---"
CREATE_D=$(curl -s -X POST "$BASE/data/$ENTITY" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN_D" \
  -d '{"name":"Diana Record","email":"diana@test.com","subject":"From Diana","message":"This is Diana data","status":"new"}')
echo "$CREATE_D"
RECORD_D_ID=$(echo "$CREATE_D" | python3 -c "import sys,json; print(json.load(sys.stdin)['data']['id'])" 2>/dev/null)
echo "RECORD_D_ID=$RECORD_D_ID"

# Step 6: User C lists records - should ONLY see their own
echo ""
echo "--- STEP 6: User C lists records (should only see Charlie's) ---"
LIST_C=$(curl -s -X GET "$BASE/data/$ENTITY" \
  -H "Authorization: Bearer $TOKEN_C")
echo "$LIST_C"

# Step 7: User D lists records - should ONLY see their own
echo ""
echo "--- STEP 7: User D lists records (should only see Diana's) ---"
LIST_D=$(curl -s -X GET "$BASE/data/$ENTITY" \
  -H "Authorization: Bearer $TOKEN_D")
echo "$LIST_D"

# Step 8: User D tries to GET User C's record - should get 403
echo ""
echo "--- STEP 8: User D tries to GET User C's record (expect 403) ---"
if [ -n "$RECORD_C_ID" ]; then
  GET_CROSS=$(curl -s -w "\nHTTP:%{http_code}" -X GET "$BASE/data/$ENTITY/$RECORD_C_ID" \
    -H "Authorization: Bearer $TOKEN_D")
  echo "$GET_CROSS"
else
  echo "SKIP: No record C ID"
fi

# Step 9: User D tries to UPDATE User C's record - should get 403
echo ""
echo "--- STEP 9: User D tries to UPDATE User C's record (expect 403) ---"
if [ -n "$RECORD_C_ID" ]; then
  PUT_CROSS=$(curl -s -w "\nHTTP:%{http_code}" -X PUT "$BASE/data/$ENTITY/$RECORD_C_ID" \
    -H "Content-Type: application/json" \
    -H "Authorization: Bearer $TOKEN_D" \
    -d '{"status":"hacked"}')
  echo "$PUT_CROSS"
else
  echo "SKIP: No record C ID"
fi

# Step 10: User D tries to DELETE User C's record - should get 403
echo ""
echo "--- STEP 10: User D tries to DELETE User C's record (expect 403) ---"
if [ -n "$RECORD_C_ID" ]; then
  DEL_CROSS=$(curl -s -w "\nHTTP:%{http_code}" -X DELETE "$BASE/data/$ENTITY/$RECORD_C_ID" \
    -H "Authorization: Bearer $TOKEN_D")
  echo "$DEL_CROSS"
else
  echo "SKIP: No record C ID"
fi

# Step 11: No-auth GET should get 401 (owner policy requires auth for read)
echo ""
echo "--- STEP 11: No-auth GET (expect 401) ---"
NOAUTH=$(curl -s -w "\nHTTP:%{http_code}" -X GET "$BASE/data/$ENTITY")
echo "$NOAUTH"

# Step 12: User C can still access their own record
echo ""
echo "--- STEP 12: User C GETs their own record (expect 200) ---"
if [ -n "$RECORD_C_ID" ]; then
  OWN_GET=$(curl -s -w "\nHTTP:%{http_code}" -X GET "$BASE/data/$ENTITY/$RECORD_C_ID" \
    -H "Authorization: Bearer $TOKEN_C")
  echo "$OWN_GET"
else
  echo "SKIP: No record C ID"
fi

echo ""
echo "=========================================="
echo "TEST COMPLETE"
echo "=========================================="
