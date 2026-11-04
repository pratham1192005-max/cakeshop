// PM2 process definition.
//   Start:    pm2 start ecosystem.config.js --env production
//   Reload:   pm2 reload cakeshop            (zero-downtime)
//   Persist:  pm2 save && pm2 startup        (restart on reboot)
module.exports = {
  apps: [
    {
      name: 'cakeshop',
      script: 'backend/server.js',
      cwd: __dirname,
      instances: 1,            // use 'max' (cluster mode) on bigger instances
      exec_mode: 'fork',       // switch to 'cluster' together with instances: 'max'
      autorestart: true,
      max_memory_restart: '300M',
      watch: false,
      time: true,              // timestamp log lines
      out_file: './logs/out.log',
      error_file: './logs/error.log',
      merge_logs: true,
      env: { NODE_ENV: 'development' },
      // On the app server the real values come from backend/.env (loaded by dotenv).
      env_production: { NODE_ENV: 'production', SERVE_FRONTEND: 'false' },
    },
  ],
};
