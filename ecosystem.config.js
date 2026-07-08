module.exports = {
  apps: [
    {
      name: 'indiecrowdfund',
      script: 'node_modules/.bin/next',
      args: 'start -p 3000',
      cwd: '/root/indiecrowdfund_2.0',
      // 8 workers to use all 8 cores. Previously 4, which left half
      // the CPU capacity idle and was the root cause of the Jun 8-9
      // newsletter-blast saturation: with only 4 workers fielding the
      // traffic spike, the TCP accept queue filled and nginx logged
      // "upstream timed out (110: Connection timed out)" because it
      // couldn't even open a socket to localhost:3000. Bumping to 8
      // doubles request capacity. Note: 8 workers * Prisma pool of 10
      // = 80 connections, so Postgres max_connections must be 150+
      // (default 100 won't have headroom for admin/cron sessions on
      // top). See scripts/setup-server-tuning.sh.
      instances: 8,
      exec_mode: 'cluster',
      autorestart: true,
      watch: false,
      // Recycle a worker if RSS crosses 1.5 GB. Tripwire for a
      // genuine leak, not a normal-growth recycle: workers come up
      // at ~370 MB cold, so hitting 1500 MB means something is
      // actually wrong. 8 workers * 1.5 GB = 12 GB peak Node on a
      // 16 GB box, leaves 4 GB for Postgres + nginx + OS + buffers.
      // PM2 recycles one worker at a time so this is invisible to
      // users when it fires.
      max_memory_restart: '1536M',
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
