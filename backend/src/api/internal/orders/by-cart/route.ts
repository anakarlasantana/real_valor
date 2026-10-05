/**
 * "O pedido deste carrinho já existe?" — a pergunta do storefront ao backend.
 * -------------------------------------------------------------------------
 * `GET /internal/orders/by-cart?cart_id=cart_...`
 *
 * **Por que uma rota interna, e não a Store API.** A Store API é do **cliente**:
 * o carrinho vai no cookie, e a resposta carrega o pedido inteiro. Perguntar por
 * ali "qual é o pedido deste carrinho?" exigiria expor exatamente o que não se
 * quer expor — e qualquer um que descobrisse um `cart_id` leria o pedido alheio,
 * com itens, endereço e total.
 *
 * Então a pergunta é feita por **servidor a servidor**, autenticada por um
 * segredo (`INTERNAL_API_SECRET`), e a resposta é **três campos**: `id`,
 * `display_id` e `status`. Não é o pedido: é o suficiente para o storefront
 * montar o link de confirmação. Buscar o resto, ele busca pela rota normal, já
 * autenticado como a cliente.
 *
 * **Por que `order_cart` e não o cookie.** O pedido nasce do **webhook**, não do
 * navegador. O que liga um ao outro é o link `order_cart` que o
 * `completeCartWorkflow` cria — a mesma âncora que a idempotência do Medusa usa
 * (ver `process-payment.js`). Ler a mesma âncora aqui é o que faz a resposta ser
 * "o pedido que existe de verdade", e não "o pedido que o navegador espera".
 *
 * **Por que 404 indistinto, e não 401/403.** A resposta é a mesma para: segredo
 * ausente, segredo errado, segredo não configurado no backend, `cart_id` em
 * formato inválido, e carrinho sem pedido. Cinco causas, uma resposta — porque
 * distingui-las diria a quem sonda **qual** das cinco tentar de novo. E o
 * formato inválido recebe 404 em vez de 400 pelo mesmo motivo: um 400 confirmaria
 * que o resto do caminho existe.
 */
import type { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { ContainerRegistrationKeys } from "@medusajs/framework/utils"
import { createHash, timingSafeEqual } from "node:crypto"

/** O header que o storefront usa. */
export const HEADER_INTERNO = "x-rv-internal"

/**
 * Um `cart_id` do Medusa é `cart_` + ULID: 26 caracteres em Crockford base32
 * (maiúsculas e dígitos, sem `I`, `L`, `O` e `U`).
 *
 * Validar o **formato** antes de consultar não é preciosismo: sem isso, um
 * `cart_id` de dois kilobytes viraria uma consulta ao banco por tentativa, e o
 * primeiro a descobrir isso ganha uma amplificação barata. A regex faz o mesmo
 * trabalho de uma chave estrangeira, sem custo de banco.
 */
const CARTAO_ULID = /^cart_[0-9A-HJKMNP-TV-Z]{26}$/

/**
 * Comparação em tempo constante, sobre digests.
 *
 * ⚠️ **O motivo de comparar digestos e não as strings cruas.** O
 * `timingSafeEqual` exige buffers do mesmo tamanho, e a checagem de tamanho
 * precisa acontecer antes — o que vazaria o **comprimento** do segredo. Com o
 * SHA-256 dos dois lados, o que se compara tem sempre 32 bytes, e o tempo não
 * depende de quanto o palpite acertou.
 *
 * É a mesma técnica de `frontend/src/app/api/revalidate/route.ts`.
 */
function segredosConferem(recebido: string, esperado: string): boolean {
  const a = createHash("sha256").update(recebido).digest()
  const b = createHash("sha256").update(esperado).digest()

  return timingSafeEqual(new Uint8Array(a), new Uint8Array(b))
}

/** O 404 de todas as causas. Sem corpo útil, de propósito. */
function naoEncontrado(res: MedusaResponse): void {
  res.status(404).json({ message: "Not Found" })
}

export async function GET(
  req: MedusaRequest,
  res: MedusaResponse
): Promise<void> {
  const logger = req.scope.resolve<{ warn: (m: string) => void }>("logger")

  // --- 1. O segredo. Fail-closed quando o backend não o tem. -------------
  const esperado = (process.env.INTERNAL_API_SECRET ?? "").trim()

  if (!esperado) {
    // Sem o segredo configurado a rota **não pode** autenticar ninguém, e
    // aceitar seria abrir a leitura de pedidos para a internet. 404 (e não 500)
    // porque a existência desta rota não é informação para quem chama.
    logger.warn(
      "[internal/by-cart] INTERNAL_API_SECRET não está definido — requisição recusada"
    )

    return naoEncontrado(res)
  }

  const recebido = String(req.headers[HEADER_INTERNO] ?? "").trim()

  if (!recebido || !segredosConferem(recebido, esperado)) {
    // Sem log: um segredo errado pode ser ataque **ou** configuração divergente
    // entre os serviços, e distinguir os dois não muda a resposta.
    return naoEncontrado(res)
  }

  // --- 2. O formato do cart_id. -------------------------------------------
  const cartId = String((req.query as { cart_id?: string })?.cart_id ?? "").trim()

  if (!CARTAO_ULID.test(cartId)) {
    return naoEncontrado(res)
  }

  // --- 3. O link `order_cart` — a âncora do pedido criado pelo webhook. ---
  const query = req.scope.resolve(ContainerRegistrationKeys.QUERY)

  let link: { order_id?: string } | undefined

  try {
    const { data } = await query.graph({
      entity: "order_cart",
      fields: ["order_id"],
      filters: { cart_id: cartId },
    })

    link = (data as { order_id?: string }[] | undefined)?.[0]
  } catch {
    // Um `cart_id` sintaticamente válido e inexistente cai aqui. "Não há
    // pedido" é a resposta, e é a mesma coisa.
    return naoEncontrado(res)
  }

  if (!link?.order_id) {
    // **O caso mais comum, e não é erro:** a cliente pagou e o webhook ainda
    // não processou. O storefront chama de novo em alguns segundos. Responder
    // 200 com `null` seria pior — obrigaria o storefront a distinguir "não
    // existe" de "não ainda" numa resposta de sucesso.
    return naoEncontrado(res)
  }

  // --- 4. O pedido, reduzido ao que o storefront precisa. ------------------
  const pedidos = req.scope.resolve<{
    retrieveOrder: (
      id: string,
      config?: unknown
    ) => Promise<Record<string, unknown>>
  }>("order")

  let pedido: Record<string, unknown>

  try {
    pedido = await pedidos.retrieveOrder(link.order_id, {
      select: ["id", "display_id", "status"],
    })
  } catch {
    return naoEncontrado(res)
  }

  // `no-store`: esta resposta muda no instante em que o webhook processa, e uma
  // cópia em cache faria a página de confirmação esperar por um pedido que já
  // existe.
  res.setHeader("Cache-Control", "no-store, max-age=0")

  res.status(200).json({
    // Só isto. **Nunca** o pedido inteiro: o storefront vai buscá-lo pela rota
    // normal, autenticado como a cliente — é a diferença entre um atalho de
    // servidor e um vazamento de dados pessoais.
    id: pedido.id,
    display_id: pedido.display_id,
    status: pedido.status,
  })
}

/** Um `GET` é a única coisa que esta rota faz. O resto não existe. */
export async function POST(
  _req: MedusaRequest,
  res: MedusaResponse
): Promise<void> {
  naoEncontrado(res)
}
