import { loadEnv, defineConfig } from '@medusajs/framework/utils'

loadEnv(process.env.NODE_ENV || 'development', process.cwd())

module.exports = defineConfig({
  projectConfig: {
    databaseUrl: process.env.DATABASE_URL,
    redisUrl: process.env.REDIS_URL,
    http: {
      storeCors: process.env.STORE_CORS || "http://localhost:3000",
      adminCors: process.env.ADMIN_CORS || "http://localhost:9000,http://localhost:5173",
      authCors: process.env.AUTH_CORS || "http://localhost:3000,http://localhost:9000,http://localhost:5173",
      jwtSecret: process.env.JWT_SECRET || "supersecret_real_valor_jwt",
      cookieSecret: process.env.COOKIE_SECRET || "supersecret_real_valor_cookie",
    }
  },
  admin: {
    disable: false,
    backendUrl: process.env.MEDUSA_BACKEND_URL || "http://localhost:9000",
  },
  modules: [
    // Arquitetura Modular: Novos módulos de pagamento e frete (Mercado Pago, Melhor Envio, etc.)
    // serão registrados aqui de forma plugável e independente.
  ]
})
