module.exports = {
  apps: [
    {
      name: 'visualdesign',
      script: 'node_modules/.bin/next',
      args: 'start --port 3002',
      cwd: '/home/visualdesign.ao/public_html',
      instances: 1,
      autorestart: true,
      watch: false,
      max_memory_restart: '512M',
      env: {
        NODE_ENV: 'production',
        PORT: 3002,
      },
    },
  ],
};
