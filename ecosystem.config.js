module.exports = {
  apps: [
    {
      name: 'project-tracker',
      script: './backend/server.js',
      cwd: '/opt/project-tracker',   // ← change to your actual path
      instances: 1,
      autorestart: true,
      watch: false,
      max_memory_restart: '300M',
      env_file: './backend/.env',
      env: {
        NODE_ENV: 'production'
      },
      error_file: '/var/log/project-tracker/error.log',
      out_file:   '/var/log/project-tracker/out.log',
      log_date_format: 'YYYY-MM-DD HH:mm:ss'
    }
  ]
};
