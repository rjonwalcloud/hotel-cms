# Hotel CMS - API Testing Guide

## 🔧 Setup

```bash
# Set your API URL
API_URL="http://localhost:5000/api"

# Store your token after login
TOKEN="your-jwt-token-here"
```

## 1️⃣ Authentication

### Register a new user

```bash
curl -X POST $API_URL/auth/register \
  -H "Content-Type: application/json" \
  -d '{
    "email": "john@example.com",
    "password": "SecurePass123",
    "full_name": "John Doe",
    "phone": "+1234567890"
  }'
```

### Login (Get Token)

```bash
curl -X POST $API_URL/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "admin@hotelcms.com",
    "password": "Admin@123"
  }'
```

**Save the token from response:**

```json
{
  "success": true,
  "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "user": { ... }
}
```

### Get Current User Info

```bash
curl -X GET $API_URL/auth/me \
  -H "Authorization: Bearer $TOKEN"
```

### Change Password

```bash
curl -X POST $API_URL/auth/change-password \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "oldPassword": "Admin@123",
    "newPassword": "NewSecurePass123"
  }'
```

## 2️⃣ Room Management

### Create a Room

```bash
curl -X POST $API_URL/rooms \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "hotel_id": "YOUR_HOTEL_ID",
    "room_type_id": "YOUR_ROOM_TYPE_ID",
    "room_number": "101",
    "floor": 1,
    "status": "AVAILABLE"
  }'
```

### Get All Rooms for a Hotel

```bash
curl -X GET "$API_URL/rooms/hotel/YOUR_HOTEL_ID" \
  -H "Authorization: Bearer $TOKEN"
```

### Filter Rooms by Status

```bash
curl -X GET "$API_URL/rooms/hotel/YOUR_HOTEL_ID?status=AVAILABLE" \
  -H "Authorization: Bearer $TOKEN"
```

### Filter by Floor

```bash
curl -X GET "$API_URL/rooms/hotel/YOUR_HOTEL_ID?floor=1" \
  -H "Authorization: Bearer $TOKEN"
```

### Get Single Room

```bash
curl -X GET "$API_URL/rooms/ROOM_ID?hotel_id=YOUR_HOTEL_ID" \
  -H "Authorization: Bearer $TOKEN"
```

### Update Room Status

```bash
curl -X PATCH $API_URL/rooms/ROOM_ID/status \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "status": "MAINTENANCE",
    "hotel_id": "YOUR_HOTEL_ID"
  }'
```

**Valid statuses:**
- `AVAILABLE`
- `OCCUPIED`
- `MAINTENANCE`
- `BLOCKED`

### Update Room Details

```bash
curl -X PUT $API_URL/rooms/ROOM_ID \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "room_number": "102",
    "floor": 1,
    "hotel_id": "YOUR_HOTEL_ID"
  }'
```

### Delete Room

```bash
curl -X DELETE "$API_URL/rooms/ROOM_ID?hotel_id=YOUR_HOTEL_ID" \
  -H "Authorization: Bearer $TOKEN"
```

## 3️⃣ Error Responses

### 401 Unauthorized (No token)

```json
{
  "error": "Unauthorized",
  "message": "No token provided"
}
```

### 403 Forbidden (No permission)

```json
{
  "error": "Forbidden",
  "message": "Permission 'ROOM_CREATE' required",
  "required": "ROOM_CREATE",
  "available": ["ROOM_VIEW", "BOOKING_VIEW"]
}
```

### 403 Quota Exceeded

```json
{
  "error": "Quota Exceeded",
  "message": "Limit for 'Maximum rooms per hotel' reached",
  "quota": {
    "limit": "room_create",
    "description": "Maximum rooms per hotel",
    "current": 50,
    "max": 50,
    "remaining": 0
  },
  "help": "Contact your administrator to increase limits"
}
```

### 404 Not Found

```json
{
  "error": "Not Found",
  "message": "Room not found or access denied"
}
```

### 409 Conflict (Duplicate)

```json
{
  "error": "Conflict",
  "message": "Room number already exists in this hotel"
}
```

## 4️⃣ Success Responses

### Room Created Successfully

```json
{
  "success": true,
  "message": "Room created successfully",
  "room": {
    "id": "uuid-here",
    "hotel_id": "uuid-here",
    "room_type_id": "uuid-here",
    "room_number": "101",
    "floor": 1,
    "status": "AVAILABLE",
    "created_at": "2024-02-09T12:00:00Z",
    "updated_at": "2024-02-09T12:00:00Z"
  },
  "quota": {
    "hotelId": "uuid-here",
    "limitKey": "room_create",
    "current": 5,
    "max": 50,
    "remaining": 45
  }
}
```

## 5️⃣ Testing Workflow

### Step 1: Login as Super Admin

```bash
TOKEN=$(curl -s -X POST $API_URL/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@hotelcms.com","password":"Admin@123"}' \
  | jq -r '.token')

echo "Token: $TOKEN"
```

### Step 2: Create a Hotel (TODO - module not implemented yet)

```bash
# Once hotel module is done, you'll create a hotel here
```

### Step 3: Create Room Type (TODO - module not implemented yet)

```bash
# Once room module is extended, you'll create room types here
```

### Step 4: Create Rooms

```bash
# Create Room 101
curl -X POST $API_URL/rooms \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "hotel_id": "YOUR_HOTEL_ID",
    "room_type_id": "YOUR_ROOM_TYPE_ID",
    "room_number": "101",
    "floor": 1
  }' | jq

# Create Room 102
curl -X POST $API_URL/rooms \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "hotel_id": "YOUR_HOTEL_ID",
    "room_type_id": "YOUR_ROOM_TYPE_ID",
    "room_number": "102",
    "floor": 1
  }' | jq
```

### Step 5: List All Rooms

```bash
curl -X GET "$API_URL/rooms/hotel/YOUR_HOTEL_ID" \
  -H "Authorization: Bearer $TOKEN" | jq
```

### Step 6: Update Room Status

```bash
curl -X PATCH $API_URL/rooms/ROOM_ID/status \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "status": "OCCUPIED",
    "hotel_id": "YOUR_HOTEL_ID"
  }' | jq
```

## 6️⃣ Health Check

```bash
curl http://localhost:5000/health
```

Expected response:

```json
{
  "status": "OK",
  "timestamp": "2024-02-09T12:00:00.000Z"
}
```

## 7️⃣ Using Postman

### Import as Collection

You can import this as a Postman collection:

1. Create new collection "Hotel CMS"
2. Add environment variables:
   - `API_URL`: `http://localhost:5000/api`
   - `TOKEN`: (will be set after login)
3. Create requests from the examples above
4. Use `{{API_URL}}` and `{{TOKEN}}` variables

### Auto-Set Token

In Postman, add this to the login request's "Tests" tab:

```javascript
if (pm.response.code === 200) {
    const response = pm.response.json();
    pm.environment.set("TOKEN", response.token);
}
```

## 8️⃣ Testing Quota Limits

### Test Quota Enforcement

1. Login as Hotel Admin
2. Create rooms until you hit the limit
3. Try to create one more room
4. Expect 403 Quota Exceeded

```bash
# Create rooms in a loop
for i in {1..51}; do
  curl -X POST $API_URL/rooms \
    -H "Authorization: Bearer $TOKEN" \
    -H "Content-Type: application/json" \
    -d "{
      \"hotel_id\": \"$HOTEL_ID\",
      \"room_type_id\": \"$ROOM_TYPE_ID\",
      \"room_number\": \"$i\",
      \"floor\": 1
    }"
  echo ""
done
```

After room 50, you should get quota exceeded error.

## 9️⃣ Testing Permissions

### Test as Staff (Limited Permissions)

1. Create a staff user
2. Login as staff
3. Try to create a room (should fail - no ROOM_CREATE permission)
4. Try to update room status (should succeed - has ROOM_UPDATE_STATUS)

```bash
# This should FAIL (403 Forbidden)
curl -X POST $API_URL/rooms \
  -H "Authorization: Bearer $STAFF_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{ ... }'

# This should SUCCEED
curl -X PATCH $API_URL/rooms/ROOM_ID/status \
  -H "Authorization: Bearer $STAFF_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"status": "MAINTENANCE", "hotel_id": "..."}'
```

---

## 📝 Notes

- All timestamps are in UTC
- UUIDs are used for all IDs
- JWT tokens expire after 7 days
- Audit logs are created automatically for all mutations
- Usage counters update in real-time

## 🐛 Troubleshooting

### Connection Refused

```bash
# Check if backend is running
docker-compose ps
# or
curl http://localhost:5000/health
```

### Invalid Token

```bash
# Login again to get a fresh token
# Tokens expire after 7 days
```

### Permission Denied

```bash
# Check your user's permissions
curl -X GET $API_URL/auth/me \
  -H "Authorization: Bearer $TOKEN" | jq '.user.roles'
```
