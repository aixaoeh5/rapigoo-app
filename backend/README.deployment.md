# Rapigoo Backend - Deployment Guide

## Overview

This guide covers deployment options for the Rapigoo backend API server, from development to production environments.

## Prerequisites

- Docker and Docker Compose installed
- SSL certificates (for production)
- Domain name configured
- Environment variables configured

## Development Deployment

### Using Docker Compose (Recommended)

```bash
# Start development environment
docker-compose -f docker-compose.dev.yml up -d

# View logs
docker-compose -f docker-compose.dev.yml logs -f api

# Stop environment
docker-compose -f docker-compose.dev.yml down
```

Services available in development:
- API Server: http://localhost:5000
- MongoDB: localhost:27017
- Redis: localhost:6379
- Mongo Express: http://localhost:8081 (admin/admin123)
- Redis Commander: http://localhost:8082

### Manual Development Setup

```bash
# Install dependencies
npm install

# Set up environment
cp .env.example .env
# Edit .env with your configuration

# Start MongoDB and Redis
docker run -d --name mongo -p 27017:27017 mongo:6.0
docker run -d --name redis -p 6379:6379 redis:7-alpine

# Start development server
npm run dev
```

## Production Deployment

### Method 1: Docker Compose with Nginx (Recommended)

1. **Prepare the environment:**
```bash
# Clone repository on server
git clone <repository-url>
cd rapigoo-app/backend

# Set up environment variables
cp .env.example .env
# Configure production values in .env
```

2. **Configure SSL certificates:**
```bash
# Create SSL directory
mkdir -p nginx/ssl

# Copy your SSL certificates
cp /path/to/fullchain.pem nginx/ssl/
cp /path/to/privkey.pem nginx/ssl/

# Or use Let's Encrypt
certbot certonly --webroot -w /var/www/certbot -d api.rapigoo.com
```

3. **Deploy with Docker Compose:**
```bash
# Build and start production environment
docker-compose up -d

# View logs
docker-compose logs -f

# Scale API servers if needed
docker-compose up -d --scale api=3
```

### Method 2: Manual Production Setup

1. **Server setup (Ubuntu/Debian):**
```bash
# Update system
sudo apt update && sudo apt upgrade -y

# Install Node.js 18+
curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
sudo apt-get install -y nodejs

# Install PM2 for process management
sudo npm install -g pm2

# Install Nginx
sudo apt install nginx

# Install MongoDB
wget -qO - https://www.mongodb.org/static/pgp/server-6.0.asc | sudo apt-key add -
echo "deb [ arch=amd64,arm64 ] https://repo.mongodb.org/apt/ubuntu focal/mongodb-org/6.0 multiverse" | sudo tee /etc/apt/sources.list.d/mongodb-org-6.0.list
sudo apt-get update
sudo apt-get install -y mongodb-org

# Install Redis
sudo apt install redis-server
```

2. **Deploy application:**
```bash
# Clone and setup
git clone <repository-url>
cd rapigoo-app/backend
npm ci --production

# Configure environment
cp .env.example .env
# Edit .env with production values

# Start with PM2
pm2 start ecosystem.config.js
pm2 save
pm2 startup
```

3. **Configure Nginx:**
```bash
# Copy Nginx configuration
sudo cp nginx/conf.d/api.conf /etc/nginx/sites-available/rapigoo-api
sudo ln -s /etc/nginx/sites-available/rapigoo-api /etc/nginx/sites-enabled/

# Test and reload Nginx
sudo nginx -t
sudo systemctl reload nginx
```

## Environment Configuration

### Required Environment Variables

```bash
# Server
NODE_ENV=production
PORT=5000

# Database
MONGO_URI=mongodb://rapigoo_app:secure_password@localhost:27017/rapigoo

# Security
JWT_SECRET=your-super-secure-jwt-secret-32-chars-minimum
RATE_LIMIT_WINDOW_MS=900000
RATE_LIMIT_MAX_REQUESTS=100

# Email
EMAIL_USER=your-email@gmail.com
EMAIL_PASS=your-app-password

# Firebase
FIREBASE_SERVICE_ACCOUNT_PATH=./firebase-service-account.json
```

### Optional Production Variables

```bash
# External Services
STRIPE_SECRET_KEY=sk_live_your_stripe_key
GOOGLE_MAPS_API_KEY=your_google_maps_key
SENTRY_DSN=your_sentry_dsn

# File Storage (S3)
AWS_ACCESS_KEY_ID=your_aws_key
AWS_SECRET_ACCESS_KEY=your_aws_secret
AWS_S3_BUCKET=rapigoo-uploads
```

## Database Setup

### MongoDB Initialization

```bash
# Connect to MongoDB
mongosh

# Run initialization script
load('scripts/mongo-init.js')

# Or manually:
use rapigoo
db.createUser({
  user: "rapigoo_app",
  pwd: "secure_password",
  roles: [{ role: "readWrite", db: "rapigoo" }]
})
```

### Database Indexes

The initialization script creates optimized indexes for:
- User authentication and search
- Service queries and filtering
- Order management
- Geospatial queries
- Full-text search

## SSL/TLS Configuration

### Let's Encrypt (Free SSL)

```bash
# Install Certbot
sudo apt install certbot python3-certbot-nginx

# Get certificates
sudo certbot --nginx -d api.rapigoo.com -d rapigoo.com

# Auto-renewal
sudo crontab -e
# Add: 0 12 * * * /usr/bin/certbot renew --quiet
```

### Custom SSL Certificates

```bash
# Place certificates in nginx/ssl/
cp your-cert.pem nginx/ssl/fullchain.pem
cp your-key.pem nginx/ssl/privkey.pem

# Update nginx configuration paths if needed
```

## Scaling and Load Balancing

### Horizontal Scaling with Docker

```bash
# Scale API servers
docker-compose up -d --scale api=3

# Nginx automatically load balances between instances
```

### Database Replication

```bash
# MongoDB replica set configuration
# Add to docker-compose.yml:
mongo1:
  image: mongo:6.0
  command: mongod --replSet rs0
  
mongo2:
  image: mongo:6.0
  command: mongod --replSet rs0

# Initialize replica set
mongo --eval "rs.initiate({
  _id: 'rs0',
  members: [
    {_id: 0, host: 'mongo1:27017'},
    {_id: 1, host: 'mongo2:27017'}
  ]
})"
```

## Monitoring and Logging

### Log Management

```bash
# View application logs
docker-compose logs -f api

# PM2 logs (manual deployment)
pm2 logs

# Nginx access logs
sudo tail -f /var/log/nginx/access.log
```

### Health Checks

The API includes a health check endpoint:
```
GET /health
```

Response:
```json
{
  "status": "ok",
  "timestamp": "2024-01-01T00:00:00.000Z",
  "uptime": 3600,
  "database": "connected",
  "redis": "connected"
}
```

### Monitoring Tools

Recommended monitoring stack:
- **Logs**: Docker logs, PM2 logs, or ELK stack
- **Metrics**: Prometheus + Grafana
- **Errors**: Sentry
- **Uptime**: Pingdom or similar
- **APM**: New Relic or DataDog

## Security Checklist

### Pre-deployment Security

- [ ] Environment variables configured securely
- [ ] JWT secret is strong and unique
- [ ] Database authentication enabled
- [ ] SSL certificates installed and valid
- [ ] Firewall configured (only ports 80, 443, 22 open)
- [ ] Regular security updates scheduled

### Post-deployment Security

- [ ] Rate limiting working correctly
- [ ] CORS configured for your domains only
- [ ] Security headers enabled
- [ ] File upload restrictions in place
- [ ] Database backups automated
- [ ] Monitoring and alerting active

## Backup Strategy

### Database Backups

```bash
# Automated MongoDB backup script
#!/bin/bash
DATE=$(date +%Y%m%d_%H%M%S)
mongodump --uri="mongodb://user:pass@localhost:27017/rapigoo" --out="/backups/mongo_$DATE"
tar -czf "/backups/mongo_$DATE.tar.gz" "/backups/mongo_$DATE"
rm -rf "/backups/mongo_$DATE"

# Keep only last 7 days
find /backups -name "mongo_*.tar.gz" -mtime +7 -delete
```

### File Backups

```bash
# Backup uploaded files (if using local storage)
rsync -av /app/uploads/ /backups/uploads/

# Or sync to S3
aws s3 sync /app/uploads/ s3://rapigoo-backups/uploads/
```

## Troubleshooting

### Common Issues

1. **Container won't start:**
   ```bash
   # Check logs
   docker-compose logs api
   
   # Check environment variables
   docker-compose exec api env
   ```

2. **Database connection failed:**
   ```bash
   # Test MongoDB connection
   docker-compose exec mongo mongosh
   
   # Check user permissions
   db.auth("rapigoo_app", "password")
   ```

3. **SSL certificate issues:**
   ```bash
   # Test SSL configuration
   openssl s_client -connect api.rapigoo.com:443
   
   # Check certificate expiry
   openssl x509 -in nginx/ssl/fullchain.pem -text -noout
   ```

4. **High memory usage:**
   ```bash
   # Monitor container resources
   docker stats
   
   # Optimize Node.js memory
   NODE_OPTIONS="--max-old-space-size=1024" npm start
   ```

### Performance Optimization

1. **Enable MongoDB indexes:**
   ```bash
   # Check query performance
   db.users.find({email: "test@example.com"}).explain("executionStats")
   ```

2. **Redis caching:**
   ```bash
   # Monitor Redis usage
   redis-cli info memory
   ```

3. **Nginx optimization:**
   ```nginx
   # Enable compression
   gzip on;
   gzip_types text/plain application/json;
   
   # Enable caching
   location ~* \.(jpg|jpeg|png|gif|ico|css|js)$ {
       expires 1y;
       add_header Cache-Control "public, immutable";
   }
   ```

## Rollback Procedure

### Quick Rollback

```bash
# Using Docker (recommended)
git checkout previous-working-commit
docker-compose build api
docker-compose up -d

# Using PM2
git checkout previous-working-commit
npm ci --production
pm2 restart ecosystem.config.js
```

### Database Rollback

```bash
# Restore from backup
mongorestore --uri="mongodb://user:pass@localhost:27017/rapigoo" /backups/mongo_backup/
```

## Support

For deployment issues:
1. Check the logs first
2. Verify environment configuration
3. Test connectivity to external services
4. Review this guide for similar issues
5. Contact system administrator

## Updates and Maintenance

### Regular Maintenance Tasks

- Weekly: Review logs and performance metrics
- Monthly: Update dependencies and security patches
- Quarterly: SSL certificate renewal check
- Annually: Full security audit

### Update Procedure

```bash
# 1. Backup current state
docker-compose exec mongo mongodump --out /backups/pre-update

# 2. Pull latest code
git pull origin main

# 3. Update containers
docker-compose build
docker-compose up -d

# 4. Run database migrations if needed
docker-compose exec api npm run migrate

# 5. Verify deployment
curl https://api.rapigoo.com/health
```