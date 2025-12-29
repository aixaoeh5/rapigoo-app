# Rapigoo API Documentation

## Overview

The Rapigoo API is a RESTful service built with Node.js and Express that powers the Rapigoo delivery platform. It provides endpoints for user management, merchant services, order processing, and real-time features.

## Base URL

- **Development:** `http://localhost:5000/api`
- **Production:** `https://api.rapigoo.com/api`

## Authentication

The API uses JWT (JSON Web Tokens) for authentication. Include the token in the Authorization header:

```
Authorization: Bearer <your-jwt-token>
```

### Authentication Flow

1. **Register/Login** → Receive JWT token
2. **Include token** in subsequent requests
3. **Token expires** after 7 days (configurable)

## API Endpoints

### Authentication (`/api/auth`)

#### POST `/api/auth/register`
Register a new user account.

**Request Body:**
```json
{
  "name": "John Doe",
  "email": "john@example.com",
  "password": "securepassword123",
  "phone": "+1234567890",
  "userType": "customer"
}
```

**Response:**
```json
{
  "success": true,
  "message": "Usuario registrado exitosamente",
  "data": {
    "user": {
      "id": "64a1b2c3d4e5f6789abc",
      "name": "John Doe",
      "email": "john@example.com",
      "userType": "customer",
      "isVerified": false
    },
    "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
  }
}
```

#### POST `/api/auth/login`
Authenticate user and receive JWT token.

**Request Body:**
```json
{
  "email": "john@example.com",
  "password": "securepassword123"
}
```

**Response:**
```json
{
  "success": true,
  "message": "Login exitoso",
  "data": {
    "user": {
      "id": "64a1b2c3d4e5f6789abc",
      "name": "John Doe",
      "email": "john@example.com",
      "userType": "customer"
    },
    "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
  }
}
```

#### POST `/api/auth/verify-email`
Verify email address with verification code.

**Request Body:**
```json
{
  "email": "john@example.com",
  "code": "123456"
}
```

#### POST `/api/auth/forgot-password`
Request password reset code.

**Request Body:**
```json
{
  "email": "john@example.com"
}
```

#### POST `/api/auth/reset-password`
Reset password with verification code.

**Request Body:**
```json
{
  "email": "john@example.com",
  "code": "123456",
  "newPassword": "newsecurepassword123"
}
```

### User Management (`/api/users`)

All user endpoints require authentication.

#### GET `/api/users/profile`
Get current user profile.

**Response:**
```json
{
  "success": true,
  "data": {
    "user": {
      "id": "64a1b2c3d4e5f6789abc",
      "name": "John Doe",
      "email": "john@example.com",
      "phone": "+1234567890",
      "userType": "customer",
      "isVerified": true,
      "address": {
        "street": "123 Main St",
        "city": "City",
        "state": "State",
        "zipCode": "12345",
        "coordinates": [-74.006, 40.7128]
      },
      "favorites": {
        "merchants": ["64a1b2c3d4e5f6789def"],
        "services": ["64a1b2c3d4e5f6789ghi"]
      }
    }
  }
}
```

#### PUT `/api/users/profile`
Update user profile.

**Request Body:**
```json
{
  "name": "John Updated",
  "phone": "+1234567891",
  "address": {
    "street": "456 New St",
    "city": "New City",
    "state": "New State",
    "zipCode": "54321",
    "coordinates": [-74.007, 40.7129]
  }
}
```

#### POST `/api/users/change-password`
Change user password.

**Request Body:**
```json
{
  "currentPassword": "oldpassword123",
  "newPassword": "newpassword123"
}
```

### Merchant Management (`/api/merchants`)

#### GET `/api/merchants`
Get list of merchants with optional filtering.

**Query Parameters:**
- `category` - Filter by category
- `rating` - Minimum rating filter
- `search` - Search by name or description
- `lat` - Latitude for distance calculation
- `lng` - Longitude for distance calculation
- `radius` - Search radius in kilometers
- `page` - Page number (default: 1)
- `limit` - Results per page (default: 20)

**Response:**
```json
{
  "success": true,
  "data": {
    "merchants": [
      {
        "id": "64a1b2c3d4e5f6789def",
        "name": "Pizza Palace",
        "description": "Best pizza in town",
        "category": "Restaurante",
        "rating": 4.5,
        "totalReviews": 125,
        "business": {
          "address": "789 Business St",
          "phone": "+1234567892",
          "hours": {
            "monday": "09:00-22:00",
            "tuesday": "09:00-22:00"
          },
          "coordinates": [-74.008, 40.7130]
        },
        "deliveryFee": 2.50,
        "minimumOrder": 15.00,
        "estimatedDelivery": "30-45 min",
        "isOpen": true,
        "distance": 2.3
      }
    ],
    "pagination": {
      "page": 1,
      "limit": 20,
      "total": 45,
      "pages": 3
    }
  }
}
```

#### GET `/api/merchants/:id`
Get detailed merchant information.

**Response:**
```json
{
  "success": true,
  "data": {
    "merchant": {
      "id": "64a1b2c3d4e5f6789def",
      "name": "Pizza Palace",
      "description": "Best pizza in town with fresh ingredients",
      "category": "Restaurante",
      "rating": 4.5,
      "totalReviews": 125,
      "business": {
        "address": "789 Business St",
        "phone": "+1234567892",
        "email": "info@pizzapalace.com",
        "website": "https://pizzapalace.com",
        "hours": {
          "monday": "09:00-22:00",
          "tuesday": "09:00-22:00"
        },
        "coordinates": [-74.008, 40.7130]
      },
      "deliveryInfo": {
        "fee": 2.50,
        "minimumOrder": 15.00,
        "radius": 10,
        "estimatedTime": "30-45 min"
      },
      "images": [
        "https://example.com/pizza1.jpg",
        "https://example.com/pizza2.jpg"
      ],
      "services": [
        {
          "id": "64a1b2c3d4e5f6789ghi",
          "name": "Margherita Pizza",
          "price": 12.99,
          "available": true
        }
      ]
    }
  }
}
```

#### POST `/api/merchants/register` *(Auth Required)*
Register as a merchant (upgrade user account).

**Request Body:**
```json
{
  "businessName": "Pizza Palace",
  "category": "Restaurante",
  "description": "Best pizza in town",
  "address": "789 Business St",
  "phone": "+1234567892",
  "businessHours": {
    "monday": "09:00-22:00",
    "tuesday": "09:00-22:00"
  },
  "coordinates": [-74.008, 40.7130]
}
```

### Services (`/api/services`)

#### GET `/api/services`
Get services with filtering options.

**Query Parameters:**
- `merchantId` - Filter by merchant
- `category` - Filter by category
- `available` - Filter by availability
- `minPrice` - Minimum price filter
- `maxPrice` - Maximum price filter
- `search` - Search in name and description

**Response:**
```json
{
  "success": true,
  "data": {
    "services": [
      {
        "id": "64a1b2c3d4e5f6789ghi",
        "name": "Margherita Pizza",
        "description": "Fresh tomatoes, mozzarella, and basil",
        "price": 12.99,
        "category": "Pizza",
        "images": ["https://example.com/margherita.jpg"],
        "available": true,
        "preparationTime": 20,
        "merchant": {
          "id": "64a1b2c3d4e5f6789def",
          "name": "Pizza Palace",
          "rating": 4.5
        },
        "rating": 4.7,
        "totalReviews": 89
      }
    ]
  }
}
```

#### POST `/api/services` *(Auth Required - Merchant)*
Create a new service.

**Request Body:**
```json
{
  "name": "Pepperoni Pizza",
  "description": "Classic pepperoni with cheese",
  "price": 14.99,
  "category": "Pizza",
  "preparationTime": 25,
  "images": ["https://example.com/pepperoni.jpg"],
  "available": true,
  "tags": ["pizza", "pepperoni", "cheese"]
}
```

#### PUT `/api/services/:id` *(Auth Required - Merchant)*
Update service information.

#### DELETE `/api/services/:id` *(Auth Required - Merchant)*
Delete a service.

### Search (`/api/search`)

#### GET `/api/search`
Global search across merchants and services.

**Query Parameters:**
- `q` - Search query (required)
- `type` - Search type: 'merchants', 'services', 'all' (default: 'all')
- `category` - Filter by category
- `lat`, `lng` - Location for distance calculation
- `radius` - Search radius in km
- `limit` - Results limit (default: 20)

**Response:**
```json
{
  "success": true,
  "data": {
    "results": {
      "merchants": [
        {
          "id": "64a1b2c3d4e5f6789def",
          "name": "Pizza Palace",
          "category": "Restaurante",
          "rating": 4.5,
          "distance": 2.3,
          "type": "merchant"
        }
      ],
      "services": [
        {
          "id": "64a1b2c3d4e5f6789ghi",
          "name": "Margherita Pizza",
          "price": 12.99,
          "merchant": "Pizza Palace",
          "type": "service"
        }
      ]
    },
    "total": 15
  }
}
```

### Favorites (`/api/favorites`)

All favorites endpoints require authentication.

#### GET `/api/favorites`
Get user's favorites.

**Response:**
```json
{
  "success": true,
  "data": {
    "favorites": {
      "merchants": [
        {
          "id": "64a1b2c3d4e5f6789def",
          "name": "Pizza Palace",
          "category": "Restaurante",
          "rating": 4.5,
          "addedAt": "2024-01-01T12:00:00.000Z"
        }
      ],
      "services": [
        {
          "id": "64a1b2c3d4e5f6789ghi",
          "name": "Margherita Pizza",
          "price": 12.99,
          "merchant": "Pizza Palace",
          "addedAt": "2024-01-01T13:00:00.000Z"
        }
      ]
    }
  }
}
```

#### POST `/api/favorites`
Add item to favorites.

**Request Body:**
```json
{
  "type": "merchant",
  "itemId": "64a1b2c3d4e5f6789def"
}
```

#### DELETE `/api/favorites`
Remove item from favorites.

**Request Body:**
```json
{
  "type": "merchant",
  "itemId": "64a1b2c3d4e5f6789def"
}
```

### Notifications (`/api/notifications`)

#### POST `/api/notifications/register-device` *(Auth Required)*
Register device for push notifications.

**Request Body:**
```json
{
  "deviceToken": "firebase-device-token",
  "platform": "ios"
}
```

#### POST `/api/notifications/unregister-device` *(Auth Required)*
Unregister device from notifications.

**Request Body:**
```json
{
  "deviceToken": "firebase-device-token"
}
```

### Health Check

#### GET `/health`
Health check endpoint (no authentication required).

**Response:**
```json
{
  "status": "ok",
  "timestamp": "2024-01-01T12:00:00.000Z",
  "uptime": 3600,
  "database": "connected",
  "redis": "connected"
}
```

## Error Responses

All API endpoints return errors in a consistent format:

```json
{
  "success": false,
  "error": {
    "message": "Error description",
    "code": "ERROR_CODE",
    "details": {}
  }
}
```

### Common Error Codes

- `VALIDATION_ERROR` - Invalid request data
- `AUTHENTICATION_ERROR` - Invalid or missing token
- `AUTHORIZATION_ERROR` - Insufficient permissions
- `NOT_FOUND` - Resource not found
- `DUPLICATE_ENTRY` - Resource already exists
- `RATE_LIMIT_EXCEEDED` - Too many requests
- `INTERNAL_SERVER_ERROR` - Server error

### HTTP Status Codes

- `200` - Success
- `201` - Created
- `400` - Bad Request
- `401` - Unauthorized
- `403` - Forbidden
- `404` - Not Found
- `409` - Conflict
- `422` - Validation Error
- `429` - Rate Limit Exceeded
- `500` - Internal Server Error

## Rate Limiting

The API implements rate limiting to prevent abuse:

- **General API**: 100 requests per 15 minutes per IP
- **Authentication**: 5 requests per 15 minutes per IP
- **Search**: 10 requests per second per IP

Rate limit headers are included in responses:
```
X-RateLimit-Limit: 100
X-RateLimit-Remaining: 95
X-RateLimit-Reset: 1640995200
```

## Pagination

List endpoints support pagination with the following parameters:

- `page` - Page number (default: 1)
- `limit` - Items per page (default: 20, max: 100)

Pagination response format:
```json
{
  "pagination": {
    "page": 1,
    "limit": 20,
    "total": 150,
    "pages": 8,
    "hasNext": true,
    "hasPrev": false
  }
}
```

## Filtering and Sorting

### Common Filters
- `category` - Filter by category
- `rating` - Minimum rating
- `price` - Price range (minPrice, maxPrice)
- `available` - Availability status
- `search` - Text search

### Sorting
Use the `sort` parameter with format: `field:direction`

Examples:
- `sort=rating:desc` - Sort by rating descending
- `sort=price:asc` - Sort by price ascending
- `sort=createdAt:desc` - Sort by creation date descending

## Geolocation

For location-based features, provide coordinates:

```json
{
  "lat": 40.7128,
  "lng": -74.0060
}
```

Distance calculations return results in kilometers.

## File Uploads

File upload endpoints (merchant images, service photos) accept:
- **Formats**: JPG, PNG, WebP
- **Max size**: 10MB per file
- **Max files**: 5 per request

Upload to `/api/upload` with multipart/form-data:

```javascript
const formData = new FormData();
formData.append('images', file);
formData.append('type', 'service');

fetch('/api/upload', {
  method: 'POST',
  headers: {
    'Authorization': 'Bearer ' + token
  },
  body: formData
});
```

## WebSocket Events (Future)

Real-time features will use WebSocket connections:
- Order status updates
- Live delivery tracking
- Chat messages
- Notification delivery

## SDK and Libraries

### JavaScript/React Native
```javascript
import RapigooAPI from 'rapigoo-api-client';

const api = new RapigooAPI({
  baseURL: 'https://api.rapigoo.com/api',
  token: 'your-jwt-token'
});

// Usage
const merchants = await api.merchants.list({ category: 'Restaurante' });
const profile = await api.users.getProfile();
```

## Testing

### Postman Collection
Import the Postman collection for easy API testing:
`/docs/Rapigoo-API.postman_collection.json`

### Example Requests

#### cURL Examples

```bash
# Register user
curl -X POST https://api.rapigoo.com/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Test User",
    "email": "test@example.com",
    "password": "password123",
    "userType": "customer"
  }'

# Get merchants
curl -X GET "https://api.rapigoo.com/api/merchants?category=Restaurante" \
  -H "Authorization: Bearer YOUR_TOKEN"

# Search
curl -X GET "https://api.rapigoo.com/api/search?q=pizza&type=all" \
  -H "Authorization: Bearer YOUR_TOKEN"
```

## Environment-Specific Notes

### Development
- CORS enabled for localhost
- Detailed error messages
- Request logging enabled

### Production
- CORS restricted to allowed domains
- Error messages sanitized
- Comprehensive logging
- Rate limiting enforced

## Support

For API support and questions:
- Documentation: This file
- Issues: Create GitHub issue
- Email: api-support@rapigoo.com

## Changelog

### v1.0.0 (Current)
- Initial API release
- User authentication
- Merchant management
- Service catalog
- Search functionality
- Favorites system
- Push notifications
- File uploads

### Planned Features
- Order management
- Real-time tracking
- Payment processing
- Review system
- Chat functionality
- Advanced analytics