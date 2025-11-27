module.exports = {
  apps: [
    {
      name: 'indiecrowdfund',
      script: 'npm',
      args: 'start',
      cwd: '/root/indiecrowdfund_2.0',
      instances: 1,
      autorestart: true,
      watch: false,
      max_memory_restart: '1G',
      env: {
        NODE_ENV: 'production',
        PORT: 3000
      },
      error_file: '/var/log/pm2/indiecrowdfund-error.log',
      out_file: '/var/log/pm2/indiecrowdfund-out.log',
      log_file: '/var/log/pm2/indiecrowdfund-combined.log',
      time: true
    }
  ]
};
