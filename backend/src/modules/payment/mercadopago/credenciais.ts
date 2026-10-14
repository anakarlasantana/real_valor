/**
 * As credenciais do Mercado Pago, lidas num lugar só (os mesmos campos para os
 * quatro consumidores). Sem credencial o pagamento fica **indisponível com
 * mensagem** (`pagamentoDisponivel`); o token nunca é logado.
 */

/** O access token (produção `APP_USR-...`, teste `TEST-...`). */
export const TOKEN = "MP_ACCESS_TOKEN"

/** O segredo da assinatura do webhook, de produção. */
export const SEGREDO = "MP_WEBHOOK_SECRET"

/**
 * O segredo da assinatura quando o token é de teste. O painel mostra **um**
 * segredo por aplicação, por isso os dois são tentados (`segredosDoWebhook`):
 * escolher errado pela cara do token derrubaria todo webhook com 401.
 */
export const SEGREDO_TESTE = "MP_WEBHOOK_SECRET_TEST"

/** A URL pública que o Mercado Pago chama. Vazia = só confirmação manual. */
export const NOTIFICACAO = "MP_NOTIFICATION_URL"

/** A URL de volta depois do checkout. Vazia = volta para o checkout. */
export const RETORNO = "MP_BACK_URL"

/**
 * O ambiente que a loja **declara**: `teste` ou `producao`. O token não diz —
 * `APP_USR-` é o formato de qualquer conta, inclusive teste, e só `TEST-` é
 * inequivocamente teste. Qual `init_point` abrir é da API, pelo token.
 */
export const AMBIENTE = "MP_AMBIENTE"

/**
 * A mensagem que a **cliente** lê quando o pagamento está fora — genérica de
 * propósito: o motivo real sai no log de boot (`descreverConfiguracao`).
 */
const INDISPONIVEL =
  "O pagamento está temporariamente indisponível. Se você já escolheu este meio, tente novamente em instantes ou fale com a gente."

/**
 * Segundos tolerados de diferença entre o `ts` do provedor e o nosso relógio.
 * Generoso de propósito (a reentrega vira 401 = dinheiro entrou, pedido não);
 * `0` desliga a checagem, e a integridade segue na assinatura.
 */
export const TOLERANCIA_PADRAO_SEGUNDOS = 60 * 30

/** A URL base da API. Não é configurável: o token é que decide o ambiente. */
export const API = "https://api.mercadopago.com"

/** Lê uma variável do ambiente, sem espaço sobrando e sem default. */
function ler(nome: string): string {
  return (process.env[nome] ?? "").trim()
}

/** O access token, ou `""`. Quem chama decide o que fazer com a ausência. */
export function token(): string {
  return ler(TOKEN)
}

/**
 * O token começa com `TEST-`? É a única leitura que o prefixo sustenta: `TEST-`
 * pede o `sandbox_init_point`, e `APP_USR-` também é de conta de teste, então o
 * `false` **não** é "produção". É o *cross-check* de `divergenciaDeAmbiente`.
 */
export function ehTokenDeTeste(): boolean {
  return token().startsWith("TEST-")
}

/** Os dois ambientes que a loja pode declarar. */
export type Ambiente = "teste" | "producao"

/**
 * O ambiente **declarado** pelo operador. Ausente ou irreconhecível → `teste`:
 * o default é a metade segura, porque `producao` com token de teste é a loja no
 * ar sem cobrar ninguém. Lixo (`MP_AMBIENTE=homolog`) cai nela.
 */
export function ambienteDeclarado(): Ambiente {
  return ler(AMBIENTE).toLowerCase() === "producao" ? "producao" : "teste"
}

/**
 * Como o token **se parece**. `ausente` é distinto de `teste`: sem token não há
 * ambiente a comparar, e devolver `teste` acusaria configuração onde falta
 * credencial.
 */
export function formaDoToken(): "teste" | "producao" | "ausente" {
  const valor = token()

  if (!valor) {
    return "ausente"
  }

  return valor.startsWith("TEST-") ? "teste" : "producao"
}

/**
 * O que a loja **declarou** × o que o token **é**: `producao`+`TEST-` é `erro`
 * (loja no ar sem cobrar), `teste`+`APP_USR-` é `aviso`. Token ausente não acusa.
 */
export function divergenciaDeAmbiente(): { erro?: string; aviso?: string } {
  const declarado = ambienteDeclarado()
  const forma = formaDoToken()

  if (forma === "ausente") {
    return {}
  }

  if (declarado === "producao" && forma === "teste") {
    return {
      erro:
        `${AMBIENTE}=producao, mas o token começa com \`TEST-\`, que só existe ` +
        "em credencial de teste. Nenhuma venda seria cobrada: o checkout abriria " +
        `e o dinheiro não entraria. Troque o token, ou declare ${AMBIENTE}=teste.`,
    }
  }

  if (declarado === "teste" && forma === "producao") {
    return {
      aviso:
        `${AMBIENTE}=teste com um token \`APP_USR-\`. Numa conta de teste isso é ` +
        "esperado — o prefixo não distingue as duas — mas se este for o token da " +
        "loja de verdade, há venda sendo cobrada enquanto alguém acha que testa.",
    }
  }

  return {}
}

/**
 * Os segredos que podem ter assinado a notificação. Devolve **lista** porque a
 * assinatura é conferida por tentativa: manter os dois evita uma janela de 401
 * em webhook durante a troca de um pelo outro.
 */
export function segredosDoWebhook(): string[] {
  return [ler(SEGREDO), ler(SEGREDO_TESTE)].filter(Boolean)
}

/** A URL de notificação, ou `""` quando não configurada. */
export function urlDeNotificacao(): string {
  return ler(NOTIFICACAO)
}

/**
 * O alerta da URL de notificação fora da rota da loja. Não é validação: o
 * desfecho é silencioso dos dois lados — o pagamento é aprovado, o dinheiro
 * entra e o pedido **nunca nasce**. Captura (`webhook.site`) é uso legítimo.
 */
export function alertaDaNotificacao(): string | undefined {
  const url = urlDeNotificacao()

  // Vazia é a configuração declarada de "só confirmação manual".
  if (!url) {
    return undefined
  }

  // O provedor só notifica endereço público com TLS.
  if (!/^https:\/\//i.test(url)) {
    return `${NOTIFICACAO} não é HTTPS. O provedor só notifica endereço público com TLS, e um \`http://\` aqui significa que a notificação não vai chegar.`
  }

  // As duas formas da rota (com e sem o meio) são nossas; query e fragmento saem.
  const caminho = url.replace(/[?#].*$/, "").replace(/\/+$/, "")

  if (/\/webhooks\/mercadopago(\/[^/]+)?$/i.test(caminho)) {
    return undefined
  }

  // Só o host: uma URL de captura carrega o próprio token de leitura no caminho.
  const host = caminho.replace(/^https:\/\//i, "").split("/")[0]

  return (
    `${NOTIFICACAO} aponta para \`${host}\`, e não para a rota assinada ` +
    "(`/webhooks/mercadopago`). O provedor vai notificar esse endereço e o " +
    "pedido **nunca nasce** — sem erro aqui e com entrega registrada no painel. " +
    "Se for captura para conferir o corpo do provedor, é intencional: troque " +
    "antes de testar o fluxo completo."
  )
}

/** Lê a tolerância da assinatura, com o padrão por cima. `0` é **válido** ("não
 * checar o relógio"), por isso a leitura não pode ser um `||` que o trate como
 * ausente. */
export function toleranciaSegundos(): number {
  const bruto = ler("MP_WEBHOOK_TOLERANCIA_SEGUNDOS")

  if (!bruto) {
    return TOLERANCIA_PADRAO_SEGUNDOS
  }

  const valor = Number(bruto)
  return Number.isFinite(valor) && valor >= 0 ? valor : TOLERANCIA_PADRAO_SEGUNDOS
}

/** A base da URL de retorno, sem a barra final. O `{id}` do `.env.example` não
 * é resolvido aqui: `urlsDeRetorno` monta as três variantes. */
export function urlDeRetorno(): string {
  return ler(RETORNO).replace(/\/+$/, "")
}

/**
 * As três URLs de volta que o Checkout Pro exige. As três apontam para a
 * **mesma** página: a confirmação consulta o estado real no backend. Sem
 * `MP_BACK_URL`, devolve `undefined` e a preferência vai sem `back_urls`.
 */
export function urlsDeRetorno(): Record<string, string> | undefined {
  const base = urlDeRetorno()

  if (!base) {
    return undefined
  }

  return { success: base, pending: base, failure: base }
}

/**
 * O pagamento pode operar? Devolve **motivo** porque quem consome é a mensagem
 * do checkout. Sem `MP_ACCESS_TOKEN` não é erro de boot: a loja abre e só o
 * pagamento recusa. A **divergência de ambiente** também recusa.
 */
export function pagamentoDisponivel():
  | { ok: true }
  | { ok: false; motivo: string } {
  if (!token()) {
    return { ok: false, motivo: INDISPONIVEL }
  }

  if (divergenciaDeAmbiente().erro) {
    return { ok: false, motivo: INDISPONIVEL }
  }

  return { ok: true }
}

/**
 * O que é seguro dizer no log de boot: **presença** e **forma**, nunca o valor.
 * O tamanho entra porque um valor truncado erra 100% dos webhooks.
 */
export function descreverConfiguracao(): Record<string, string> {
  const segredos = segredosDoWebhook()

  return {
    // O declarado entra ao lado da forma do token: é a comparação que o
    // `divergenciaDeAmbiente` faz. `APP_USR-` é o prefixo literal, não um veredito.
    [AMBIENTE]: `${ambienteDeclarado()} (declarado)`,
    [TOKEN]: token()
      ? `${ehTokenDeTeste() ? "TEST-" : "APP_USR-"} · ${token().length} caracteres`
      : "AUSENTE — pagamento indisponível",
    [SEGREDO]: segredos.length
      ? `${segredos.length} segredo(s) de ${segredos
          .map((s) => s.length)
          .join(" e ")} caracteres`
      : "AUSENTE — todo webhook responde 401",
    [NOTIFICACAO]: urlDeNotificacao() || "AUSENTE — só confirmação manual",
    [RETORNO]: urlDeRetorno() || "AUSENTE — a cliente volta para o checkout",
  }
}
