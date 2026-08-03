module.exports = {
  apps: [{
    name: "trading-signal",
    script: "./server.js",
    cwd: __dirname,
    instances: 1,
    exec_mode: "fork",
    autorestart: true,
    watch: false,
    max_memory_restart: "500M",
    time: true,
    env: {
      NODE_ENV: "production",
      HOST: "127.0.0.1",
      PORT: "3210"
    }
  }]
};
