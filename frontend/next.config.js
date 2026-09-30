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
   * As duas entram em `afterFiles` (o array simples): nenhuma rota do site
   * começa por `/uploads` ou `/static`, então elas só pegam o que ninguém
   * mais serve.
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
    ]
  },
}

module.exports = nextConfig
