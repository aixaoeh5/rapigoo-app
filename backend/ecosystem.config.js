module.exports = {
  apps: [{
    name: 'rapigoo-api',
    script: 'server.js',
    instances: 'max',
    exec_mode: 'cluster',
    env: {
      NODE_ENV: 'production',
      PORT: 5000
    },
    env_production: {
      NODE_ENV: 'production',
      PORT: 5000
    },
    // PM2 configuration
    max_memory_restart: '1G',
    error_file: './logs/pm2-error.log',
    out_file: './logs/pm2-out.log',
    log_file: './logs/pm2-combined.log',
    time: true,
    
    // Monitoring
    monitoring: false,
    
    // Restart configuration
    watch: false,
    ignore_watch: ['node_modules', 'logs', 'uploads'],
    max_restarts: 10,
    min_uptime: '10s',
    
    // Advanced configuration
    kill_timeout: 5000,
    wait_ready: true,
    listen_timeout: 8000,
    shutdown_with_message: true,
    
    // Auto restart on file changes (disable in production)
    autorestart: true,
    
    // Environment variables from .env file are automatically loaded
    instance_var: 'INSTANCE_ID'
  }]
};