/**
 * Invalidacao sob demanda do cache do storefront.
 *
 * POR QUE ISSO EXISTE
 * As paginas de categoria, colecao e produto deixaram de usar
 * `generateStaticParams()` — aquele hook chamava a Store API durante o
 * `next build` e fazia o build da imagem depender de um backend Medusa no ar
 * (sem ele: "Failed to collect page data for /[countryCode]/..."). Em troca, as
 * paginas usam janela de ISR (`export const revalidate`) e este endpoint e o
 * gatilho para publicar uma alteracao ANTES da janela expirar.
 *
 * COMO USAR
 *   # invalida todas as paginas de produto (qualquer pais/handle)
 *   curl -X POST "http://localhost:8000/api/revalidate?tag=products" \
 *        -H "x-revalidate-secret: $REVALIDATE_SECRET"
 *
 *   # invalida uma URL concreta
 *   curl -X POST "http://localhost:8000/api/revalidate?path=/br/products/camisa-fio-torto" \
 *        -H "x-revalidate-secret: $REVALIDATE_SECRET"
 *
 *   # invalida TODAS as instancias de uma rota dinamica (padrao do sistema de
 *   # arquivos, incluindo grupo de rota) — e o modo mais util para um webhook
 *   # que nao conhece o countryCode
 *   curl -X POST "http://localhost:8000/api/revalidate?route=/%5BcountryCode%5D/(main)/products/%5Bhandle%5D&type=page" \
 *        -H "x-revalidate-secret: $REVALIDATE_SECRET"
 *
 * SEGURANCA
 * Sem `REVALIDATE_SECRET` definido o endpoint responde 500 e NAO invalida nada
 * (fail-closed: um purge nao autenticado e um vetor de DoS trivial). O segredo e
 * lido do header `x-revalidate-secret` ou do parametro `?secret=` (comodo para
 * curl; em producao prefira o header, que nao fica em log de acesso). A
 * comparacao usa digests SHA-256 com `timingSafeEqual`, para nao vazar o segredo
 * por tempo de resposta.
 */
import { timingSafeEqual, createHash } from "node:crypto"

import { revalidatePath, revalidateTag } from "next/cache"
import { NextResponse, type NextRequest } from "next/server"

export const dynamic = "force-dynamic"

const SECRET_HEADER = "x-revalidate-secret"

const SEGMENT_TYPES = ["page", "layout"] as const

type SegmentType = (typeof SEGMENT_TYPES)[number]

/**
 * Comparacao de segredo em tempo constante. Comparamos os digests (tamanho fixo)
 * em vez das strings cruas, porque `timingSafeEqual` exige buffers do mesmo
 * tamanho e comparar os comprimentos antes vazaria o tamanho do segredo.
 */
function secretsMatch(provided: string, expected: string): boolean {
  const providedDigest = createHash("sha256").update(provided).digest()
  const expectedDigest = createHash("sha256").update(expected).digest()

  return timingSafeEqual(providedDigest, expectedDigest)
}

function badRequest(message: string, extra: Record<string, unknown> = {}) {
  return NextResponse.json({ revalidated: false, message, ...extra }, { status: 400 })
}

export async function POST(request: NextRequest) {
  const expectedSecret = process.env.REVALIDATE_SECRET

  if (!expectedSecret) {
    // Fail-closed de proposito: melhor recusar do que expor um purge publico.
    return NextResponse.json(
      {
        revalidated: false,
        message:
          "REVALIDATE_SECRET nao esta definido no ambiente do storefront; invalidacao sob demanda desabilitada.",
      },
      { status: 500 }
    )
  }

  const searchParams = request.nextUrl.searchParams
  const providedSecret =
    request.headers.get(SECRET_HEADER) ?? searchParams.get("secret")

  if (!providedSecret || !secretsMatch(providedSecret, expectedSecret)) {
    return NextResponse.json(
      { revalidated: false, message: "Segredo invalido." },
      { status: 401 }
    )
  }

  const tag = searchParams.get("tag") ?? undefined
  const path = searchParams.get("path") ?? undefined
  const route = searchParams.get("route") ?? undefined
  const type = (searchParams.get("type") ?? "page") as SegmentType

  if (!tag && !path && !route) {
    return badRequest(
      "Informe ao menos um alvo: `tag`, `path` ou `route`.",
      { usage: "POST /api/revalidate?tag=<tag> | ?path=/br/products/<handle> | ?route=/[countryCode]/(main)/products/[handle]&type=page" }
    )
  }

  if (!SEGMENT_TYPES.includes(type)) {
    return badRequest(`\`type\` deve ser um de: ${SEGMENT_TYPES.join(", ")}.`)
  }

  // `revalidatePath` lanca se o caminho nao for absoluto; validar aqui devolve
  // um 400 explicito em vez de um 500 opaco.
  for (const [name, value] of [["path", path], ["route", route]] as const) {
    if (value !== undefined && !value.startsWith("/")) {
      return badRequest(`\`${name}\` deve comecar com "/".`)
    }
  }

  if (tag) {
    revalidateTag(tag)
  }

  if (path) {
    revalidatePath(path, type)
  }

  if (route) {
    revalidatePath(route, type)
  }

  return NextResponse.json({
    revalidated: true,
    tag: tag ?? null,
    path: path ?? null,
    route: route ?? null,
    type: path || route ? type : null,
    now: Date.now(),
  })
}

/**
 * Um GET que invalida cache seria um efeito colateral acionavel por qualquer
 * prefetch/crawler. Respondemos 405 com a documentacao de uso.
 */
export async function GET() {
  return NextResponse.json(
    {
      revalidated: false,
      message:
        "Use POST. Parametros: `tag`, `path` ou `route` (com `type=page|layout`). Segredo no header `x-revalidate-secret`.",
    },
    { status: 405, headers: { Allow: "POST" } }
  )
}
