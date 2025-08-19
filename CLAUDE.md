# Claude Code Guidelines for Rapigoo App

## Core Principles

### Code Quality
- **No artifacts** - Work directly with the codebase
- **Less code is better than more code** - Prioritize simplicity and maintainability
- **Rewrite existing components over adding new ones** - Improve rather than accumulate

### Error Handling
- **No fallback mechanisms** - They hide real failures
- **Avoid race conditions at all costs** - Design for concurrency safety

### Code Display
- **Always output the full component unless told otherwise** - Show complete context
- **Never say "X remains unchanged"** - Always show the code
- **Be explicit on where snippets go** - Use clear positioning (e.g., "below 'abc'", "above 'xyz'")
- **If only one function changes, just show that one** - Focus on what's relevant

### Development Process
- **Flag obsolete files to keep the codebase lightweight** - Maintain clean architecture
- **Take your time to ultrathink when on extended thinking mode** - Thinking is cheaper than fixing bugs

## Project Structure

### Frontend (React Native)
- Components in `/components/`
- Context providers in `/components/context/`
- API configuration in `/config/`
- Utility functions in `/utils/`

### Backend (Node.js/Express)
- Controllers in `/backend/controllers/`
- Models in `/backend/models/`
- Routes in `/backend/routes/`
- Middleware in `/backend/middleware/`
- Services in `/backend/services/`

### Admin Panel
- React app in `/admin/`

## Project-Specific Guidelines

### React Native Frontend
- Use functional components with hooks
- Implement proper navigation with React Navigation
- Handle async state properly with context providers
- Use debounced operations for cart persistence
- Implement proper error boundaries

### Backend API
- Always implement retry logic for MongoDB operations
- Use proper timeouts and error handling
- Monitor connection health and log appropriately
- Maintain consistent error response formats
- Include proper logging for debugging
- Use appropriate HTTP status codes

### Security
- Never expose sensitive information in logs
- Validate all inputs thoroughly
- Use proper authentication middleware
- Sanitize MongoDB queries to prevent injection

### Performance
- Optimize database queries with proper indexing
- Use caching where appropriate
- Monitor and log performance metrics
- Implement compression middleware
- Use proper connection pooling

## Commands to Run After Code Changes

### Frontend Development
```bash
npm start
expo start
```

### Backend Development
```bash
cd backend
npm start
```

### Testing
```bash
npm test
cd backend && npm test
```

### Linting
```bash
npm run lint
cd backend && npm run lint
```

## Common Issues to Watch For

### Frontend
1. **Maximum update depth exceeded** - Fix useEffect dependencies and debounce state updates
2. **Navigation state management** - Ensure proper stack navigation
3. **Animated.Value initialization** - Use useRef instead of useState
4. **API connectivity** - Handle network timeouts and retries

### Backend
1. **MongoDB Timeouts** - Implement retry logic with exponential backoff
2. **JWT Token Validation** - Distinguish between token errors and DB errors
3. **Route Ordering** - Ensure specific routes come before generic ones (e.g., `/history` before `/:id`)
4. **Memory Leaks** - Proper cleanup of intervals and event listeners
5. **Concurrent Access** - Use appropriate locking mechanisms for shared resources

### Database
- Connection pooling configuration
- Query optimization and indexing
- Proper error handling for timeouts
- Monitoring connection health

## API Endpoints

### Key Endpoints
- **Authentication**: `/api/auth/login`, `/api/auth/register`
- **Delivery History**: `/api/delivery/history` (must come before `/api/delivery/:id`)
- **Orders**: `/api/orders`
- **Merchants**: `/api/merchant`

### Route Ordering Rules
- Specific routes before generic ones
- `/history` before `/:id`
- Authentication routes with proper rate limiting