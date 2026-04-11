// ============================================
// PM2 Ecosystem File for Hotel CMS
// Usage: pm2 start ecosystem.config.js
// ============================================

module.exports = {
  apps: [
    {
      name: 'hotel-cms-api',
      script: './src/server.js',
      cwd: '/var/www/hotel-cms/backend',
      instances: 'max', // Use all available CPUs
      exec_mode: 'cluster',
      
      // Environment
      env: {
        NODE_ENV: 'development',
        PORT: 5000
      },
      env_production: {
        NODE_ENV: 'production',
        PORT: 5000
      },
      
      // Logs
      error_file: '/var/log/hotel-cms/pm2-error.log',
      out_file: '/var/log/hotel-cms/pm2-out.log',
      log_date_format: 'YYYY-MM-DD HH:mm:ss Z',
      merge_logs: true,
      
      // Restart policy
      autorestart: true,
      max_restarts: 10,
      min_uptime: '10s',
      max_memory_restart: '500M',
      
      // Monitoring
      listen_timeout: 3000,
      kill_timeout: 5000,
      
      // Watch (disable in production)
      watch: false,
      ignore_watch: ['node_modules', 'logs', '*.log'],
      
      // Advanced
      instance_var: 'INSTANCE_ID',
      combine_logs: true,
      
      // Source maps
      source_map_support: true,
      
      // Graceful shutdown
      wait_ready: true,
      shutdown_with_message: true
    }
  ],

  deploy: {
    production: {
      user: 'hotel-cms',
      host: 'your-server-ip',
      ref: 'origin/main',
      repo: 'git@github.com:your-repo/hotel-cms.git',
      path: '/var/www/hotel-cms',
      'post-deploy': 'cd backend && npm install && pm2 reload ecosystem.config.js --env production',
      'pre-deploy-local': 'echo "Deploying to production..."'
    }
  }
};
