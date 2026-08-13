// pm2 — konfiguracja procesu Bridge backend
// Uruchomienie:  pm2 start ecosystem.config.cjs
// Zapis na trwałe (po reboocie): pm2 save && pm2 startup
module.exports = {
  apps: [
    {
      name: "bridge-backend",
      script: "./index.cjs",
      cwd: __dirname,
      instances: 1,
      exec_mode: "fork",
      autorestart: true,
      max_restarts: 10,
      restart_delay: 3000,
      // Limit heapu Node V8 — 2 GB (poprzednio domyślne ~1 GB powodowało OOM
      // przy serializacji /api/staging/paged z setkami snapshotów JSON).
      node_args: "--max-old-space-size=2048",
      // pm2 restartuje proces gdy zużycie pamięci przekroczy 2.5 GB.
      // Wcześniejsze 512M było zdecydowanie za niskie i odpowiada za OOM-y.
      max_memory_restart: "2500M",
      env: {
        NODE_ENV: "production",
      },
      // Logi pm2 — domyślnie ~/.pm2/logs/bridge-backend-*.log
      out_file: "./logs/out.log",
      error_file: "./logs/error.log",
      merge_logs: true,
      time: true,
    },
  ],
};
