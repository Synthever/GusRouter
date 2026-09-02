module.exports = {
  apps: [
    {
      name: "gusrouter",
      cwd: "/root/workspace/GusRouter/server",
      script: "dist/index.js",
      env: {
        PORT: "8085",
        OAUTH_PORT: "1456",
        GO_PORT: "20130",
        DATABASE_PATH: "/root/.gusrouter/gusrouter.db",
        DATA_DIR: "/root/.gusrouter",
        RTK_ENABLED: "true",
        SROUTER_CORS_ORIGINS: "https://gusrouter.rkhyg.xyz,http://gusrouter.rkhyg.xyz,https://gorouter.rkhyg.xyz,http://gorouter.rkhyg.xyz"
      }
    }
  ]
};
