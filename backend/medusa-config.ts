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
    // ATENCAO: o default do Medusa para o painel e "/app" — exatamente o
    // WORKDIR deste container (ver backend/Dockerfile). Com `path == "/app"`,
    // o `base` do Vite coincide com o prefixo dos caminhos absolutos emitidos
    // pelo plugin do admin (`/app/src/admin/...`): o Vite aplica
    // `stripBase("/app/src/...", "/app")` -> `/src/admin/...`, tenta resolve-lo
    // como path de FS inexistente e falha com
    // `Failed to resolve import "/src/admin/i18n/index.ts"` (painel em branco).
    // Um `path` que NAO seja prefixo do WORKDIR elimina a colisao.
    // Ver README > "Enderecos de Acesso".
    path: process.env.MEDUSA_ADMIN_PATH || "/painel",
    backendUrl: process.env.MEDUSA_BACKEND_URL || "http://localhost:9000",
  },
  modules: [
    // Arquitetura Modular: Novos módulos de pagamento e frete (Mercado Pago, Melhor Envio, etc.)
    // serão registrados aqui de forma plugável e independente.
    //
    // Módulo de conteúdo: guarda as seções da vitrine (home) editáveis
    // pelo admin. Ver src/modules/content.
    {
      resolve: "./src/modules/content",
    },
  ]
})
