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
      // Recycle a worker if RSS crosses 2 GB. On the 16 GB box this
      // is a runaway-worker tripwire, not a normal-growth recycle:
      // workers come up at ~370 MB cold, so hitting 2 GB means
      // something genuinely leaked. 4 workers * 2 GB = 8 GB peak
      // Node, leaves 8 GB headroom for Postgres + buffers + OS, so
      // we still can't swap-thrash even if all 4 hit the cap at once.
      // The earlier 3072M was too high to ever trip in practice
      // because 4 * 3 GB = 12 GB exceeds typical Node growth.
      // PM2 recycles one worker at a time so this is invisible to
      // users when it fires.
      max_memory_restart: '2048M',
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
