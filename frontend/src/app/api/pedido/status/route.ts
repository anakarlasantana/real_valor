/**
 * "O pedido do MEU carrinho já existe?" — a rota do navegador.
 * -------------------------------------------------------------------------
 * `GET /api/pedido/status`
 *
 * **Por que existe uma rota no meio.** O navegador não pode perguntar ao backend
 * interno: o segredo `INTERNAL_API_SECRET` é de servidor, e mandá-lo ao navegador
 * (mesmo por `NEXT_PUBLIC_`, que é só um prefixo de build) o publicaria para
 * qualquer visitante — e com ele qualquer um leria status de pedido alheio.
 *
 * Então o navegador pergunta **aqui**, sem argumento nenhum, e esta rota:
 *
 * 1. lê o `cart_id` do **cookie httpOnly** — que o navegador não consegue
 *    inventar nem ler, e por isso não é um identificador que se adivinhe por
 *    fora;
 * 2. assina a chamada ao backend com o segredo, que nunca sai daqui;
 * 3. devolve **três campos**, e não o pedido.
 *
 * **Por que o `cart_id` não vai na URL.** Uma rota assim, com
 * `/api/pedido/status?cart_id=cart_...`, transformaria o identificador do
 * carrinho numa credencial de leitura de pedido: ele ficaria em histórico de
 * navegador, em log de acesso e em `Referer` — e um `cart_id` é justamente o que
 * um atacante consegue (ele é devolvido pela Store API a quem cria um carrinho).
 * O cookie httpOnly é a única versão dessa informação que **não** vaza por
 * onde passa.
 *
 * **Por que 503 quando falta o segredo, e 404 para o resto.** São coisas
 * diferentes e quem opera precisa saber qual é: 503 é "a loja está
 * mal configurada" (o pedido existe, a consulta não funciona — alguém age
 * agora); 404 é "não há pedido para este carrinho **ainda**" (o normal enquanto
 * o webhook processa — a página tenta de novo sozinha).
 */
import { cookies } from "next/headers"
import { NextResponse } from "next/server"

export const dynamic = "force-dynamic"

const CARTAO_ULID = /^cart_[0-9A-HJKMNP-TV-Z]{26}$/

/** O 404 de todas as causas do lado do storefront. */
function naoEncontrado() {
  return NextResponse.json(
    { encontrado: false },
    { status: 404, headers: { "Cache-Control": "no-store" } }
  )
}

export async function GET() {
  const segredo = (process.env.INTERNAL_API_SECRET ?? "").trim()

  if (!segredo) {
    // Fail-closed: sem segredo não há como autenticar no backend, e chamar
    // assim mesmo gastaria uma requisição para receber 404 — indistinguível de
    // "não há pedido", que é o oposto do que está acontecendo.
    return NextResponse.json(
      { encontrado: false, erro: "configuracao" },
      { status: 503, headers: { "Cache-Control": "no-store" } }
    )
  }

  const cartId = (await cookies()).get("_medusa_cart_id")?.value?.trim() ?? ""

  if (!CARTAO_ULID.test(cartId)) {
    // Sem carrinho no cookie, ou com um formato que o Medusa não produz. Não é
    // erro: é alguém que chegou nesta página sem ter comprado.
    return naoEncontrado()
  }

  const base = (
    process.env.MEDUSA_BACKEND_URL ?? "http://localhost:9000"
  ).replace(/\/+$/, "")

  let resposta: Response

  try {
    resposta = await fetch(
      `${base}/internal/orders/by-cart?cart_id=${encodeURIComponent(cartId)}`,
      {
        headers: { "x-rv-internal": segredo },
        // O status muda no instante em que o webhook processa. Cachear aqui
        // faria a página esperar por um pedido que já existe — e o `fetch` do
        // Next guarda por padrão, o que faz isso ser um erro silencioso.
        cache: "no-store",
      }
    )
  } catch {
    // O backend não respondeu. `502` diz "a pergunta não chegou", que é
    // diferente de "a resposta é não" — e a página trata os dois de formas
    // diferentes (502 espera mais; 404 também, mas é o caso normal).
    return NextResponse.json(
      { encontrado: false, erro: "backend" },
      { status: 502, headers: { "Cache-Control": "no-store" } }
    )
  }

  if (resposta.status === 404) {
    return naoEncontrado()
  }

  if (!resposta.ok) {
    return NextResponse.json(
      { encontrado: false, erro: "backend" },
      { status: 502, headers: { "Cache-Control": "no-store" } }
    )
  }

  const pedido = (await resposta.json()) as Record<string, unknown>

  // Repassa **só** os três campos, mesmo que o backend um dia devolva mais.
  // A lista fechada aqui é o que faz "o que esta rota expõe?" ter resposta sem
  // precisar ler o outro serviço.
  return NextResponse.json(
    {
      encontrado: true,
      id: String(pedido.id ?? ""),
      display_id: pedido.display_id ?? null,
      status: pedido.status ?? null,
    },
    { headers: { "Cache-Control": "no-store" } }
  )
}

/** Esta rota lê; um POST não tem o que fazer aqui. */
export async function POST() {
  return NextResponse.json(
    { encontrado: false, erro: "metodo" },
    { status: 405, headers: { Allow: "GET", "Cache-Control": "no-store" } }
  )
}
