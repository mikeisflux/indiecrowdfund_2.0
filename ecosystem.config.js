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
      // Restart-loop containment. Without these, a worker that crashes
      // on boot (e.g. invalid route tree, missing dep, schema mismatch)
      // gets restarted forever, churning fds and process slots until
      // the box runs out of resources and userspace services like
      // systemd-resolved stop accepting new connections. With them,
      // PM2 marks the app `errored` after 10 fast crashes — site is
      // still down, but the box stays healthy and DNS keeps working.
      max_restarts: 10,
      min_uptime: '10s',
      restart_delay: 5000,
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
