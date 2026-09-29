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
    // O tipo do admin path e' template literal (`/${string}`); o valor ja vem
    // com "/" (o default "/painel"), entao o cast so resolve o tipo.
    path: (process.env.MEDUSA_ADMIN_PATH ||
      "/painel") as `/${string}`,
    backendUrl: process.env.MEDUSA_BACKEND_URL || "http://localhost:9000",
  },
  modules: [
    // Armazenamento dos arquivos que o painel envia: as fotos das seções da
    // vitrine e as imagens de produto.
    //
    // **Não é um módulo, é um PROVIDER.** O que se registra aqui é o módulo
    // `file` do Medusa (o que a loja consulta por `Modules.FILE`) apontando
    // para o provider local: `@medusajs/file-local` exporta
    // `ModuleProvider(Modules.FILE, …)`, então registrá-lo como módulo faz o
    // `defineConfig` estourar (`defaultExport.service` é `undefined`). Com um
    // provider só, ele é o padrão — não há id para escolher em lugar nenhum.
    //
    // O provider local grava em `static/` — a MESMA pasta que o próprio Medusa
    // serve em `/static/...` (ver `express-loader` do framework), então não há
    // rota de arquivos para manter aqui nem CDN para configurar.
    //
    // Em Docker `static/` é o ponto de montagem do volume
    // `real_valor_uploads` (ver docker-compose.yml): sem o volume, todo upload
    // desapareceria na próxima recriação do container. O Dockerfile cria a
    // pasta com dono `medusa` porque um volume nomeado sobre caminho
    // inexistente nasce com dono `root` — e o upload morreria com EACCES.
    //
    // Trocar por S3 depois é trocar o item de `providers` (o pacote e as
    // opções): os valores gravados no banco são a **chave** do arquivo (ver
    // `resolveMediaUrl` no storefront), não a URL — então nada no conteúdo
    // precisa migrar.
    {
      resolve: "@medusajs/medusa/file",
      options: {
        providers: [
          {
            resolve: "@medusajs/file-local",
            id: "local",
            options: {
              upload_dir: "static",
              // Endereço PÚBLICO do backend (o que o navegador usa), e não o
              // endereço interno da rede do Compose: é ele que entra na URL
              // que a API de upload devolve.
              backend_url: `${
                process.env.MEDUSA_BACKEND_URL || "http://localhost:9000"
              }/static`,
            },
          },
        ],
      },
    },
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
