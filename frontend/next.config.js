const checkEnvVariables = require("./check-env-variables")

checkEnvVariables()

/**
 * Medusa Cloud-related environment variables
 */
const S3_HOSTNAME = process.env.MEDUSA_CLOUD_S3_HOSTNAME
const S3_PATHNAME = process.env.MEDUSA_CLOUD_S3_PATHNAME

/**
 * O backend visto pelo SERVIDOR do storefront (SSR, route handlers e o
 * otimizador do `next/image`). Dentro do Compose o host é `backend`; rodando
 * o Next fora do Docker, é `http://localhost:9000`.
 *
 * ⚠️ Lida em TEMPO DE BUILD: a lista de `rewrites` é serializada no
 * `routes-manifest.json` do `next build`. O `frontend/Dockerfile` já recebe
 * esta variável como build-arg (e o compose já passa o endereço INTERNO), mas
 * trocar o valor só no `environment:` exige reconstruir a imagem — a mesma
 * regra das `NEXT_PUBLIC_*`.
 */
const MEDUSA_BACKEND_URL =
  process.env.MEDUSA_BACKEND_URL || "http://localhost:9000"

/**
 * @type {import('next').NextConfig}
 */
const nextConfig = {
  // "standalone" empacota o servidor e apenas as dependencias realmente
  // usadas, permitindo uma imagem Docker final enxuta (sem node_modules
  // completo). O `frontend/Dockerfile` depende desta saida.
  output: "standalone",
  reactStrictMode: true,
  // O contrato é um pacote do workspace e chega como TypeScript
  // (`packages/contrato/src/*.ts`): sem isto o Next trataria o que está em
  // `node_modules` como código pronto e não o compilaria. Desde o G5 não há
  // mais cópia gerada — os dois apps importam `@rv/contrato`.
  transpilePackages: ["@rv/contrato"],
  logging: {
    fetches: {
      fullUrl: true,
    },
  },
  eslint: {
    ignoreDuringBuilds: true,
  },
  typescript: {
    ignoreBuildErrors: true,
  },
  images: {
    /**
     * ⚠️ O host de terceiro que aparece no **conteúdo** (a foto que a lojista
     * cola, como a do site antigo da loja) **não** entra aqui: o
     * `mediaImageProps` (`src/lib/util/media.ts`) entrega essa foto sem otimizar,
     * e é o que impede uma imagem de derrubar a página — o `defaultLoader` do
     * `next/image` lança para host não liberado, o erro sobe do SSR e medido com
     * uma foto de `cdn.awsli.com.br` a home respondia **HTTP 500** inteira.
     *
     * Esta lista continua sendo a dos arquivos que o otimizador **busca**: as
     * fotos de produto que a API devolve de S3, por exemplo.
     */
    remotePatterns: [
      {
        protocol: "http",
        hostname: "localhost",
      },
      {
        protocol: "https",
        hostname: "medusa-public-images.s3.eu-west-1.amazonaws.com",
      },
      {
        protocol: "https",
        hostname: "medusa-server-testing.s3.amazonaws.com",
      },
      {
        protocol: "https",
        hostname: "medusa-server-testing.s3.us-east-1.amazonaws.com",
      },
      {
        protocol: "https",
        hostname: "images.unsplash.com",
      },
      ...(S3_HOSTNAME && S3_PATHNAME
        ? [
            {
              protocol: "https",
              hostname: S3_HOSTNAME,
              pathname: S3_PATHNAME,
            },
          ]
        : []),
    ],
  },
  /**
   * As imagens que o CRM envia ficam no backend, que as serve em `/static/...`
   * (`@medusajs/file-local` — ver `backend/medusa-config.ts`). Aqui elas passam
   * a ter o MESMO ORIGEM da vitrine, em `/uploads/...`:
   *
   *     navegador → http://localhost:8000/uploads/<chave>
   *     Next      → http://backend:9000/static/<chave>
   *
   * Mesmo origem é o que faz o otimizador do `next/image` funcionar: ele roda
   * DENTRO do container do storefront e não alcança `http://localhost:9000`
   * (esse `localhost` é o próprio container). De quebra, a foto sai do domínio
   * da página — sem pedido a terceiros e sem host para liberar em
   * `images.remotePatterns`. É o par do `resolveMediaUrl`
   * (`src/lib/util/media.ts`), que é quem decide *quando* usar `/uploads/`.
   *
   * `/static/:path*` também é reescrito porque a API de upload devolve a URL
   * absoluta do backend e o painel nativo grava essa URL em alguns lugares
   * (imagem de produto): assim um valor antigo — ou colado à mão — continua
   * valendo, sem migração.
   *
   * As três entram em `afterFiles` (o array simples): nenhuma rota do site
   * começa por `/uploads`, `/static` ou `/webhooks`, então elas só pegam o que
   * ninguém mais serve.
   *
   * `/webhooks/:path*` é a terceira pelo mesmo motivo de ser invisível, e existe
   * por um motivo diferente das outras duas (ver
   * `docs/real-valor/11-ambiente-local.md` §11.6.1): quando a loja é publicada
   * por um **único endereço** — o caso de uma conta de túnel que só tem um
   * domínio reservado —, o Mercado Pago precisa de uma URL pública que termine
   * em `/webhooks/mercadopago`, e quem está nesse endereço é o storefront. Sem
   * esta linha, `MP_NOTIFICATION_URL` só teria endereços que existem dentro do
   * Compose: o pagamento é aprovado, o dinheiro entra, e o pedido **nunca
   * nasce** — o desfecho que `alertaDaNotificacao`
   * (`backend/src/modules/payment/mercadopago/credenciais.ts`) avisa a cada
   * boot.
   *
   * A reescrita do webhook troca **só o hospedeiro**. Caminho, corpo e
   * cabeçalhos chegam intactos ao backend — inclusive o `x-signature`, o único
   * portão que decide alguma coisa ali. Quem confere isso é o roteiro de §11.6:
   * uma notificação assinada de verdade responde **500 "provedor indisponível"**
   * (a assinatura passou e a consulta ao provedor falhou), em vez do **401** de
   * uma assinatura recusada.
   *
   * `/painel` e `/painel-api` são as duas últimas, e são do PAINEL do admin
   * (ver `docs/real-valor/11-ambiente-local.md` §11.6.2): o painel é servido
   * pelo backend (`:9000/painel`, `admin.path` em `backend/medusa-config.ts`) e
   * quem testa a loja de fora precisa entrar nele pelo MESMO endereço.
   *
   *     navegador → https://<tunel>/painel                  a página do painel
   *     painel    → https://<tunel>/painel-api/admin/...    a API que ele chama
   *
   * A primeira troca só o hospedeiro, de propósito: `admin.path` é o `base` do
   * Vite (`getViteConfig`, `@medusajs/admin-bundler`), então mexer no caminho
   * aqui faria o `stripBase` do painel errar o alvo — a armadilha da §11.6.2.
   * A segunda troca o prefixo: `/painel-api` é um nome de *transporte*, e existe
   * para a API do painel ter um caminho que o `middleware` não confunda com rota
   * de vitrine — é o valor que `MEDUSA_BACKEND_URL` recebe em `make tunnel`. As
   * duas param de casar se `MEDUSA_ADMIN_PATH` deixar de ser `/painel` (ver o
   * bloco correspondente em `docker-compose.yml`).
   *
   * ⚠️ Aqui `MEDUSA_BACKEND_URL` é o endereço INTERNO (`http://backend:9000`,
   * build-arg `MEDUSA_INTERNAL_BACKEND_URL`): as quatro reescritas continuam
   * falando com o backend por dentro do Compose. Quem aponta para o endereço
   * público é o **bundle** do painel, que o backend serve e que lê o
   * `MEDUSA_BACKEND_URL` DELE (`__BACKEND_URL__`, `backend/medusa-config.ts`).
   * São dois valores de mesmo nome com donos diferentes: trocar um pelo outro
   * sobe o painel apontando para `localhost:9000`, e o login morre em
   * `ERR_FAILED` — sem mensagem nenhuma no console do painel.
   */
  async rewrites() {
    return [
      {
        source: "/uploads/:path*",
        destination: `${MEDUSA_BACKEND_URL}/static/:path*`,
      },
      {
        source: "/static/:path*",
        destination: `${MEDUSA_BACKEND_URL}/static/:path*`,
      },
      {
        source: "/webhooks/:path*",
        destination: `${MEDUSA_BACKEND_URL}/webhooks/:path*`,
      },
      {
        // `/painel-api/<caminho>` -> `<backend>/<caminho>`. O prefixo vive só
        // deste lado: `/admin`, `/auth` e `/store` chegam ao backend como o
        // painel os chama.
        source: "/painel-api/:path*",
        destination: `${MEDUSA_BACKEND_URL}/:path*`,
      },
      {
        // A página do painel, caminho intacto. A regra explícita para a rota
        // sem cauda existe porque ela é a PRIMEIRA que a cliente abre: se
        // escapasse para o middleware, viraria `/br/painel` e o painel "não
        // existiria" por 404 — ver o `painel` no `matcher` de
        // `src/middleware.ts`.
        source: "/painel",
        destination: `${MEDUSA_BACKEND_URL}/painel`,
      },
      {
        source: "/painel/:path*",
        destination: `${MEDUSA_BACKEND_URL}/painel/:path*`,
      },
    ]
  },
}

module.exports = nextConfig
