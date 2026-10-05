/**
 * O `/hooks/payment/:provider` do Medusa, desligado.
 * -------------------------------------------------------------------------
 * **Esta rota é um 404 de propósito, e ela substitui uma rota do framework.**
 *
 * O Medusa publica `POST /hooks/payment/:provider` (`@medusajs/medusa/dist/api/
 * hooks/payment/[provider]/route.js`). Ela **não valida nada**: pega o corpo,
 * monta `{ provider, payload }` e emite o evento. Não há assinatura, não há
 * segredo, não há verificação de origem — porque o framework não conhece
 * provedor nenhum e delega tudo ao provider.
 *
 * **Por que isso não é suficiente, mesmo com o provider validando.** Duas
 * razões, e a segunda é a que motivou esta rota:
 *
 * 1. **A garantia fica num lugar só.** Se `getWebhookActionAndData` algum dia
 *    confiar num campo do corpo — e é o que qualquer provider novo tende a
 *    fazer —, esta rota vira a porta dos fundos. A validação no provider
 *    **continua** (ver o contexto verificado em `contexto.ts`); esta rota é a
 *    segunda tranca, não a única.
 * 2. **No caminho de erro ela responde `400` com `err.message` no corpo**:
 *    ```js
 *    res.status(400).send(`Webhook Error: ${err.message}`)
 *    ```
 *    Uma mensagem de exceção num endpoint público é divulgação de informação —
 *    nomes de módulo, formato de dados, às vezes caminho de arquivo. Um atacante
 *    calibra a tentativa seguinte com o que o erro contou.
 *
 * **Por que "substituir" funciona, e por que não basta confiar nisso.** O
 * carregador de rotas do Medusa registra a última rota que casa com o mesmo
 * caminho, e as rotas do app (`src/api`) entram **depois** das do framework.
 * Mas isso é um detalhe de ordem de carregamento: não é um contrato, e ninguém
 * o lê. Por isso o provider também recusa qualquer evento que chegue sem o
 * contexto verificado — se esta rota deixar de ganhar a disputa um dia, a
 * consequência é um log, e não um pedido de graça.
 *
 * **O que se perde.** Nenhum outro provider está registrado além do
 * `pp_system_default` (que não usa webhook) e dos dois do Mercado Pago — então
 * não há integração legítima perdendo o endpoint. Se um dia houver, ela precisa
 * da própria rota validada, que é justamente o que este arquivo documenta.
 */
import type { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"

/**
 * 404 indistinto: sem mensagem, sem `err.message`, sem pista.
 *
 * Não é `405` nem `403` — os dois diriam "esta rota existe e você não pode
 * usá-la", que é informação sobre a nossa superfície. Para quem sonda, o
 * caminho não existe, que é o que se quer que seja verdade.
 */
export const POST = async (
  req: MedusaRequest,
  res: MedusaResponse
): Promise<void> => {
  const logger = req.scope.resolve<{ warn: (m: string) => void }>("logger")

  logger.warn(
    "[payment-hooks] chamada à rota nativa do Medusa (`/hooks/payment/:provider`) " +
      "— recusada. O webhook do Mercado Pago é `POST /webhooks/mercadopago`."
  )

  res.status(404).json({ message: "Not Found" })
}
