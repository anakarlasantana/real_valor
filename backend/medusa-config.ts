import { existsSync } from 'node:fs'
import { resolve } from 'node:path'
import type { ConfigModule } from '@medusajs/framework/types'
import { loadEnv, defineConfig } from '@medusajs/framework/utils'

loadEnv(process.env.NODE_ENV || 'development', process.cwd())

// -----------------------------------------------------------------------------
// As fontes de extensão do admin: os diretórios que o plugin do Vite varre
// procurando `routes/`, `widgets/` e `i18n/`. O CRM deixou `src/admin/` na R7 e
// virou um pacote próprio (`admin/`), irmão de `backend/` — ver
// docs/plano-centralizacao.md.
//
// Duas linhas porque o CRM tem dois endereços, e é o mesmo diretório: no
// repositório ele é IRMÃO de `backend/`; na imagem ele entra em `/app/admin`,
// que é a raiz do container. O motivo é medido: a resolução de import do
// Vite/Rollup parte da árvore do arquivo, então o `node_modules` do backend
// precisa estar ACIMA do CRM — com o CRM em `/admin`, o `medusa build` morre em
// `Rollup failed to resolve import "@medusajs/admin-sdk" from
// "/admin/src/admin/routes/probe/page.tsx"`.
const panelSourceCandidates = [
  resolve(__dirname, "../admin/src/admin"),
  resolve(__dirname, "admin/src/admin"),
]

// O painel COMPILADO — o que o `medusa build` escreve. Na imagem de execução o
// `.medusa/server` é achatado na raiz do container, então o bundle fica em
// `public/admin`; na árvore do repositório ele fica onde o build o deixou. Não
// entra no build: serve só para o guard abaixo reconhecer o host que não precisa
// da fonte (ele já tem o painel pronto, e é o `medusa start` que o serve).
const compiledPanel = [
  resolve(__dirname, "public/admin/index.html"),
  resolve(__dirname, ".medusa/server/public/admin/index.html"),
]

const panelSources = panelSourceCandidates.filter(existsSync)

// FAIL LOUD (R7.1). Sem isto o painel sobe SEM as extensões e sem dizer nada:
// `sources: []` é uma lista VÁLIDA, então o Medusa monta um admin do zero, o
// menu "Conteúdo da vitrine" simplesmente não existe e nenhum log acusa. Foi
// assim que um bind morto de `./admin` passou por "bug do CRM" — a config
// engolia a fonte ausente no `filter(existsSync)` e seguia em frente.
//
// Dispara só quando as TRÊS condições valem juntas: nenhuma fonte, nenhum
// painel compilado e o processo não declarando `production`. Cada pedaço é
// medido, não suposto:
//   - é o `NODE_ENV` que decide QUEM serve o painel: o Vite dev server (que
//     precisa da fonte) ou o bundle compilado. É a mesma divisão que o
//     `docker-compose.override.yml` documenta.
//   - o bundle compilado responde pelos hosts legítimos sem fonte: o runner da
//     imagem (`COPY /app/.medusa/server ./` → `/app/public/admin`) e um
//     `docker run` da imagem sem `NODE_ENV` (que é vazio LÁ: o Dockerfile não
//     fixa o valor de propósito, quem o define é o Compose).
//   - o checkout da CI tem a fonte (`NODE_ENV=development` no job `schema`).
if (
  panelSources.length === 0 &&
  !compiledPanel.some(existsSync) &&
  (process.env.NODE_ENV || "development") !== "production"
) {
  throw new Error(
    [
      "O painel (CRM) não foi encontrado em nenhum dos endereços esperados:",
      ...panelSourceCandidates.map((dir) => `  - ${dir}`),
      "",
      'Sem as fontes o admin sobe SEM as extensões: o menu "Conteúdo da vitrine"',
      "desaparece e nenhum erro é registrado — `sources: []` é uma lista válida.",
      "",
      "Em container, a causa provável é o bind `./admin:/app/admin` preso a um",
      "diretório órfão: o diretório mudou de inode quando o CRM saiu de",
      "`backend/src/admin` na R7, e o container velho continua montando o antigo.",
      "Recrie o container. Medido: `docker compose up -d` sozinho NÃO resolve (o",
      "Compose não recria um serviço cuja configuração não mudou), enquanto a",
      "PARTIDA do container remonta o bind — por isso `restart`/`recreate` valem:",
      "",
      "  make recreate SERVICE=backend           # ou: docker compose restart backend",
      "",
      "Diagnóstico: `make doctor`. Detalhes: README > Troubleshooting 3 e",
      "docs/plano-centralizacao.md > R7.1.",
    ].join("\n")
  )
}

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
    // pelo plugin do admin (`/app/admin/src/admin/...`): o Vite aplica
    // `stripBase("/app/admin/src/...", "/app")` -> `/admin/src/admin/...`, tenta
    // resolve-lo como path de FS inexistente e falha com
    // `Failed to resolve import "/admin/src/admin/i18n/index.ts"` (painel em
    // branco). Um `path` que NAO seja prefixo do WORKDIR elimina a colisao.
    // Ver README > "Enderecos de Acesso".
    // O tipo do admin path e' template literal (`/${string}`); o valor ja vem
    // com "/" (o default "/painel"), entao o cast so resolve o tipo.
    path: (process.env.MEDUSA_ADMIN_PATH ||
      "/painel") as `/${string}`,
    backendUrl: process.env.MEDUSA_BACKEND_URL || "http://localhost:9000",
    // As fontes do painel são derivadas no topo deste arquivo — junto do guard
    // que falha alto quando não existe nenhuma (R7.1) —, e são o MESMO
    // diretório em dois endereços: irmão de `backend/` no repositório,
    // `/app/admin` na imagem. O `filter` mantém só o endereço que existe, então
    // a mesma config serve host e container (e onde não há nenhum dos dois o
    // painel vem do bundle compilado, ver `compiledPanel`).
    //
    // O cast: `sources` não está no tipo público de `admin` (`AdminOptions`, de
    // @medusajs/types); quem o declara é `BundlerOptions`
    // (@medusajs/admin-bundler), o tipo que o `adminLoader` monta e entrega ao
    // Vite. Sem ele, `make types` acusa TS2769 — medido.
    sources: panelSources,
  } as NonNullable<ConfigModule["admin"]> & { sources: string[] },
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
