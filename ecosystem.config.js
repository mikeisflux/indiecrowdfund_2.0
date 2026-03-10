module.exports = {
  apps: [
    {
      name: 'indiecrowdfund',
      script: 'node_modules/.bin/next',
      args: 'start -p 3000',
      cwd: '/root/indiecrowdfund_2.0',
      instances: 4,
      exec_mode: 'cluster',
      autorestart: true,
      watch: false,
      max_memory_restart: '3072M',
      kill_timeout: 5000,
      listen_timeout: 10000,
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
