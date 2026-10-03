/**
 * O registro de meios de pagamento.
 * -------------------------------------------------------------------------
 * **A inversão.** Antes, o componente perguntava o TIPO do meio e decidia o que
 * fazer (`isStripeLike(id) ? botãoDeCartão : botãoDeManual`). Agora ele pergunta
 * a REGISTRO quem responde por este id, e segue o que o adapter disser.
 *
 * A diferença aparece no quarto provedor. Com o `switch`, o quinto `if` já é
 * um `switch` com cinco caminhos e testes manuais para cada um. Com o registro,
 * o quinto provedor é um arquivo novo e **uma linha** aqui.
 *
 * **Por que um `Map` e não um objeto indexado.** O `Map` aceita qualquer
 * `string`, inclusive um id que ninguém registrou — e o `resolve` trata esse
 * caso devolvendo o adapter `unsupported`, em vez de devolver `undefined` e
 * estourar no `checkout`. Um id vindo do banco não pode derrubar a página.
 */
import type { PaymentAdapter } from "./types"

import { manualAdapter } from "./adapters/manual"
import { stripeAdapter } from "./adapters/stripe"
import { unsupportedAdapter } from "./adapters/unsupported"

/**
 * Os adapters registrados.
 *
 * O Stripe entra aqui **até o RV-048** remover o código dele. A ordem importa:
 * remover o adapter antes de o Mercado Pago existir deixaria o checkout sem
 * nenhum caminho de pagamento — cada etapa precisa ter um meio funcionando.
 */
const adapters: PaymentAdapter[] = [
  // Stripe — TEMPORÁRIO. Sai no RV-048, junto com os arquivos dele. Fica até
  // lá para que nenhuma etapa fique sem um caminho de pagamento funcionando.
  stripeAdapter,
  // Manual — o meio que sempre funciona: sem credencial, sem URL pública, sem
  // provedor externo. É o que mantém a loja atravessando um ambiente sem nada
  // configurado, e o que faz o checkout continuar testável.
  manualAdapter,
  // Por último, porque é o que sobra: nenhum id serve, cai aqui.
  unsupportedAdapter,
]

const byId = new Map<string, PaymentAdapter>(
  adapters.map((adapter) => [adapter.id, adapter])
)

/**
 * Quem responde por este `provider_id`.
 *
 * **Nunca devolve `undefined`.** Um id desconhecido — um provedor gravado no
 * banco por uma versão futura, ou gravado à mão — devolve o adapter
 * `unsupported`, que renderiza uma mensagem clara. A alternativa (devolver
 * `undefined` e deixar o componente decidir) é um `?.[0]` espalhado por todos
 * os call sites, e um dia um deles esquece.
 *
 * A comparação é por `startsWith` porque o Medusa nomeia o provider como
 * `pp_<modulo>_<id>` e devolve o nome inteiro. Um adapter pode declarar
 * `pp_stripe_stripe` e atender `pp_stripe_ideal_stripe` — que é o comportamento
 * desejado: os dois são o mesmo provedor com meios diferentes.
 */
export function resolvePayment(providerId?: string | null): PaymentAdapter {
  if (!providerId) {
    return unsupportedAdapter
  }

  const exato = byId.get(providerId)
  if (exato) {
    return exato
  }

  for (const adapter of adapters) {
    if (providerId.startsWith(adapter.id)) {
      return adapter
    }
  }

  return unsupportedAdapter
}

/** Todos os meios registrados — para a tela de seleção. */
export function listPaymentAdapters(): PaymentAdapter[] {
  return [...adapters]
}

/** Só para os testes: registra um adapter sem tocar no array de produção. */
export function __registerForTest(adapter: PaymentAdapter): () => void {
  adapters.push(adapter)
  byId.set(adapter.id, adapter)

  return () => {
    const i = adapters.findIndex((a) => a.id === adapter.id)
    if (i >= 0) {
      adapters.splice(i, 1)
    }
    byId.delete(adapter.id)
  }
}
