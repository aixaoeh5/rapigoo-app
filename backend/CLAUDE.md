# Claude Code Guidelines for Rapigoo Backend

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

## Project-Specific Guidelines

### Database Operations
- Always implement retry logic for MongoDB operations
- Use proper timeouts and error handling
- Monitor connection health and log appropriately

### API Design
- Maintain consistent error response formats
- Include proper logging for debugging
- Use appropriate HTTP status codes

### Security
- Never expose sensitive information in logs
- Validate all inputs thoroughly
- Use proper authentication middleware

### Performance
- Optimize database queries with proper indexing
- Use caching where appropriate
- Monitor and log performance metrics

## Commands to Run After Code Changes

### Development
```bash
npm start
```

### Testing
```bash
npm test
```

### Linting
```bash
npm run lint
```

## Common Issues to Watch For

1. **MongoDB Timeouts** - Implement retry logic with exponential backoff
2. **JWT Token Validation** - Distinguish between token errors and DB errors
3. **Route Ordering** - Ensure specific routes come before generic ones
4. **Memory Leaks** - Proper cleanup of intervals and event listeners
5. **Concurrent Access** - Use appropriate locking mechanisms for shared resources