/**
 * As credenciais do Mercado Pago, lidas num lugar só.
 * -------------------------------------------------------------------------
 * **Por que este arquivo existe.** As mesmas variáveis são lidas por
 * **quatro** consumidores com ciclos de vida muito diferentes — o provider de
 * Pix, o de cartão, as rotas de webhook e o `medusa-config.ts`. Sem um ponto
 * único, cada um inventa o seu `?? ""` e a diferença aparece só em produção,
 * quando um deles aceita a variável vazia e o outro não.
 *
 * **Nada aqui tem valor padrão, e isso é deliberado** — a mesma decisão do
 * `REVALIDATE_SECRET` e do `INTERNAL_API_SECRET` (ver `.env.example`). Um
 * default conhecido subiria a loja com o checkout de um provedor que não é o
 * nosso, e a cliente só descobriria no pior momento. Sem credencial, o
 * pagamento fica **indisponível com mensagem**, e é o que `pagamentoDisponivel`
 * responde.
 *
 * **O token nunca é logado, nem em mensagem de erro.** Ele autoriza cobrança e
 * estorno na conta da loja; um log de boot vazando o token é um log que
 * autoriza. `descreverConfiguracao` devolve só o que é seguro dizer em voz alta.
 */

/** O access token (produção `APP_USR-...`, teste `TEST-...`). */
export const TOKEN = "MP_ACCESS_TOKEN"

/** O segredo da assinatura do webhook, de produção. */
export const SEGREDO = "MP_WEBHOOK_SECRET"

/**
 * O segredo da assinatura quando o token é de teste.
 *
 * O painel do Mercado Pago mostra **um** segredo por aplicação, e o ambiente
 * de teste usa o mesmo na maioria dos casos — mas não em todos: quem nunca
 * publicou a aplicação tem só credenciais de teste, e o segredo exibido é o
 * de teste. Por isso os dois são tentados (ver `segredosDoWebhook`), em vez de
 * escolher um pela cara do token: escolher errado derrubaria **todo** webhook
 * com 401, e um 401 é silencioso do lado de quem envia.
 */
export const SEGREDO_TESTE = "MP_WEBHOOK_SECRET_TEST"

/** A URL pública que o Mercado Pago chama. Vazia = só confirmação manual. */
export const NOTIFICACAO = "MP_NOTIFICATION_URL"

/** A URL de volta depois do checkout. Vazia = volta para o checkout. */
export const RETORNO = "MP_BACK_URL"

/**
 * O ambiente que a loja **declara** estar usando: `teste` ou `producao`.
 *
 * **Por que esta variável existe, se o token já diz.** Porque o token não diz —
 * isto foi medido nesta conta, e é a razão de o arquivo ter mudado:
 *
 * ```
 * MP_ACCESS_TOKEN = "APP_USR-..."              (formato de produção)
 * GET /users/me   → nickname: TESTUSER7358975069611479993
 *                   tags:     [user_product_seller, test_user, normal]
 * ```
 *
 * `APP_USR-` é o formato da credencial de **qualquer** conta, e as contas de
 * teste que o painel cria também o recebem. Só `TEST-` é inequivocamente de
 * teste, porque só existe em credencial de aplicação — e a ausência dele **não**
 * prova produção. Ler o prefixo como se provasse foi o que fez um token de
 * conta de teste ser anunciado como "produção" no log de boot.
 *
 * Então as duas perguntas foram separadas:
 *
 * - *"Esta loja está vendendo de verdade?"* é do **operador**, e é o que
 *   `MP_AMBIENTE` declara.
 * - *"Qual `init_point` eu abro?"* é da **API**, e a resposta está no formato do
 *   token (ver `pontoDeInicio`).
 */
export const AMBIENTE = "MP_AMBIENTE"

/**
 * A mensagem que a **cliente** lê quando o pagamento está fora.
 *
 * Deliberadamente genérica, e por dois motivos. Ela aparece no checkout, onde
 * "token ausente" ou "ambiente contraditório" não é informação acionável para
 * quem só quer comprar — e o motivo real é configuração da loja. O detalhe sai
 * no log de boot, por `descreverConfiguracao`, que é onde alguém pode agir.
 */
const INDISPONIVEL =
  "O pagamento está temporariamente indisponível. Se você já escolheu este meio, tente novamente em instantes ou fale com a gente."

/**
 * Quantos segundos de diferença entre o `ts` do Mercado Pago e o nosso relógio
 * ainda são aceitos na validação da assinatura.
 *
 * **Generoso de propósito.** O Mercado Pago reentrega notificações que
 * falharam, às vezes minutos depois, e um `ts` vencido transformaria a
 * reentrega legítima num 401 — o pior resultado possível: o dinheiro entrou e
 * o pedido não existe. A janela serve para limitar a validade de uma
 * assinatura capturada, não para cronometrar o provedor; `0` desliga a
 * checagem, e a integridade continua garantida pela assinatura e pela
 * consulta a `/v1/payments/{id}`, que é onde a decisão mora de verdade.
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
 * O token começa com `TEST-`?
 *
 * **Isto é uma pergunta sobre a API do provedor, e só isso.** `TEST-` pede o
 * `sandbox_init_point` (ver `pontoDeInicio`), e é a única leitura que o prefixo
 * sustenta: `APP_USR-` é o formato de conta de teste também, então o `false`
 * devolvido aqui **não** significa "produção". Quem responde isso é
 * `ambienteDeclarado`; esta função é o *cross-check* de `divergenciaDeAmbiente`
 * e nada mais.
 */
export function ehTokenDeTeste(): boolean {
  return token().startsWith("TEST-")
}

/** Os dois ambientes que a loja pode declarar. */
export type Ambiente = "teste" | "producao"

/**
 * O ambiente **declarado** pelo operador.
 *
 * Ausente (ou irreconhecível) → `"teste"`, e o default cai para a metade segura
 * por um motivo **assimétrico**, não por otimismo:
 *
 * - token de produção declarado como teste: o `init_point` é o mesmo
 *   (`pontoDeInicio` decide pelo token), então declarar errado aqui não cobra
 *   nada — só deixa de bloquear uma venda real por engano de configuração;
 * - token de teste declarado como produção: é o caso caro, e é o que o default
 *   evita. A loja no ar, o checkout abrindo, e nenhuma venda sendo cobrada.
 *
 * Lixo (`MP_AMBIENTE=homolog`) cai no mesmo default, e é deliberado: uma
 * variável que se digita errado não deve ser a diferença entre cobrar e não
 * cobrar.
 */
export function ambienteDeclarado(): Ambiente {
  return ler(AMBIENTE).toLowerCase() === "producao" ? "producao" : "teste"
}

/**
 * Como o token **se parece**.
 *
 * `ausente` é distinto de `teste` de propósito: sem token não há ambiente a
 * comparar, e devolver `"teste"` aqui faria a divergência acusar um problema de
 * configuração que é, na verdade, ausência de credencial — dois erros diferentes
 * com a mesma mensagem.
 */
export function formaDoToken(): "teste" | "producao" | "ausente" {
  const valor = token()

  if (!valor) {
    return "ausente"
  }

  return valor.startsWith("TEST-") ? "teste" : "producao"
}

/**
 * O que a loja **declarou** × o que o token **é**.
 *
 * `erro` e `aviso` são separados porque os dois casos não têm o mesmo peso — um
 * **recusa o pagamento**, o outro só precisa ser dito em voz alta:
 *
 * | declarado | token | desfecho |
 * | --- | --- | --- |
 * | `producao` | `TEST-` | **erro** — a loja está no ar e nenhuma venda é cobrada |
 * | `teste` | `APP_USR-` | aviso — pode ser conta de teste, e pode ser a loja cobrando de verdade |
 * | `producao` | `APP_USR-` | — |
 * | `teste` | `TEST-` | — |
 * | qualquer | ausente | — (é `pagamentoDisponivel` que recusa) |
 *
 * O aviso da segunda linha existe porque é o **risco espelhado**, e ele é mais
 * fácil de ignorar do que o erro: declarar `teste` e ter um token de loja real
 * significa cobrança de verdade acontecendo enquanto alguém acredita estar
 * testando. Não dá para recusar — `APP_USR-` de conta de teste é legítimo e é o
 * caso desta loja hoje — então o que resta é dizer em voz alta, a cada boot.
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
 * Os segredos que podem ter assinado a notificação, em ordem de tentativa.
 *
 * Devolve uma **lista** e não um valor porque a assinatura é verificada por
 * tentativa: um segredo errado não invalida a notificação, ele simplesmente
 * não confere. Isso mantém a loja funcionando durante a troca de um segredo
 * pelo outro — o que, com um valor só, seria uma janela de 401 em todo webhook.
 */
export function segredosDoWebhook(): string[] {
  return [ler(SEGREDO), ler(SEGREDO_TESTE)].filter(Boolean)
}

/** A URL de notificação, ou `""` quando não configurada. */
export function urlDeNotificacao(): string {
  return ler(NOTIFICACAO)
}

/**
 * O alerta da URL de notificação, quando ela não aponta para a rota da loja.
 *
 * **Por que isto é alerta e não validação.** Não há formato a recusar: o provedor
 * aceita qualquer URL que ele consiga alcançar, e a variável é repassada como
 * está. O que existe é um desfecho silencioso dos **dois** lados —
 *
 * - do nosso, porque o webhook simplesmente não chega: nenhuma requisição
 *   rejeitada, nenhum log, nada para procurar;
 * - do lado do provedor, porque o painel mostra a notificação **entregue**, com
 *   sucesso, no endereço que estava lá.
 *
 * O resultado é o pior par possível: o pagamento é aprovado, o dinheiro entra, e
 * o pedido **nunca nasce**. É a venda que fica manual até alguém reparar — o
 * mesmo desfecho que o README descreve em "sem ele o pagamento funciona e o
 * pedido nunca nasce", com a diferença de que ali a variável está *vazia* e aqui
 * está *preenchida*, o que é pior de descobrir.
 *
 * **A captura é um uso legítimo, e é por isso que não é recusa.** Apontar para o
 * `webhook.site` (ou um túnel de inspeção) é a forma barata de ver o corpo e os
 * headers que o provedor realmente manda — a forma do `data.id`, o
 * `x-request-id`, o `x-signature` — antes de confiar na própria implementação da
 * assinatura. Recusar isso obrigaria a descobrir o formato por tentativa e erro,
 * que é o oposto de conferir. O alerta guarda a outra metade: enquanto a URL
 * estiver lá, nenhum pedido nasce.
 */
export function alertaDaNotificacao(): string | undefined {
  const url = urlDeNotificacao()

  // Vazia não é problema: é a configuração declarada de "só confirmação manual",
  // e o `descreverConfiguracao` já diz isso em voz alta a cada boot.
  if (!url) {
    return undefined
  }

  // O provedor exige HTTPS para chamar de fora, e um endereço `http://` é
  // recusado — ou, pior, aceito no cadastro da preferência e nunca chamado.
  if (!/^https:\/\//i.test(url)) {
    return `${NOTIFICACAO} não é HTTPS. O provedor só notifica endereço público com TLS, e um \`http://\` aqui significa que a notificação não vai chegar.`
  }

  // A rota existe em duas formas — `/webhooks/mercadopago` e
  // `/webhooks/mercadopago/<meio>` —, e as duas são nossas: o sufixo por meio é
  // só uma dica de log (ver o comentário na rota). Query e fragmento saem antes,
  // porque não fazem parte do caminho e fariam um endereço certo parecer errado.
  const caminho = url.replace(/[?#].*$/, "").replace(/\/+$/, "")

  if (/\/webhooks\/mercadopago(\/[^/]+)?$/i.test(caminho)) {
    return undefined
  }

  // Só o host entra na mensagem, e não a URL inteira: um endereço de captura
  // costuma carregar no caminho o próprio token de leitura (o UUID do
  // `webhook.site`, o subdomínio aleatório do túnel), e isto é um log.
  const host = caminho.replace(/^https:\/\//i, "").split("/")[0]

  return (
    `${NOTIFICACAO} aponta para \`${host}\`, e não para a rota assinada ` +
    "(`/webhooks/mercadopago`). O provedor vai notificar esse endereço e o " +
    "pedido **nunca nasce** — sem erro aqui e com entrega registrada no painel. " +
    "Se for captura para conferir o corpo do provedor, é intencional: troque " +
    "antes de testar o fluxo completo."
  )
}

/**
 * Lê a tolerância da assinatura, com o padrão por cima.
 *
 * `0` é um valor **válido** e significa "não checar o relógio" — por isso a
 * leitura não pode ser um `||`, que trataria `0` como ausente e reativaria a
 * janela justamente em quem pediu para desligá-la.
 */
export function toleranciaSegundos(): number {
  const bruto = ler("MP_WEBHOOK_TOLERANCIA_SEGUNDOS")

  if (!bruto) {
    return TOLERANCIA_PADRAO_SEGUNDOS
  }

  const valor = Number(bruto)
  return Number.isFinite(valor) && valor >= 0 ? valor : TOLERANCIA_PADRAO_SEGUNDOS
}

/**
 * A base da URL de retorno, sem a barra final.
 *
 * O `{id}` que o `.env.example` documenta não é resolvido aqui: `urlsDeRetorno`
 * monta as três variantes que o Checkout Pro exige, e todas apontam para a
 * mesma página — ver o comentário de lá.
 */
export function urlDeRetorno(): string {
  return ler(RETORNO).replace(/\/+$/, "")
}

/**
 * As três URLs de volta — o Checkout Pro exige as três.
 *
 * O Mercado Pago manda a cliente para `success`, `pending` ou `failure`
 * conforme o desfecho. Apontar as três para a **mesma** página é intencional:
 * a página de confirmação consulta o estado real no nosso backend, e o que o
 * provedor **acha** que aconteceu não é fonte de verdade para nós — é um
 * parâmetro de navegador, e a cliente pode fechar a aba antes de ele chegar.
 *
 * Sem `MP_BACK_URL` devolve `undefined`, e a preferência é montada sem
 * `back_urls`: o Mercado Pago deixa a cliente no próprio checkout. Melhor do
 * que inventar um destino.
 */
export function urlsDeRetorno(): Record<string, string> | undefined {
  const base = urlDeRetorno()

  if (!base) {
    return undefined
  }

  return { success: base, pending: base, failure: base }
}

/**
 * O pagamento pode operar?
 *
 * Devolve **motivo** em vez de `boolean` porque quem consome é uma mensagem
 * para a cliente no checkout, e "indisponível" sozinho não diz se falta
 * configurar ou se o provedor está fora. Um `false` sem motivo vira o pior
 * suporte possível: a loja não sabe o que fazer e a cliente não sabe o que houve.
 *
 * Sem `MP_ACCESS_TOKEN` **não** é erro de boot. O backend sobe, a loja abre, e
 * só o pagamento responde que não dá — a mesma escolha do `REVALIDATE_SECRET`,
 * pelo mesmo motivo: uma loja que não abre por causa de um provedor de
 * pagamento perde mais do que uma loja que abre sem ele.
 *
 * A **divergência de ambiente** recusa junto, e pela mesma razão: `producao` com
 * token de teste é uma loja que aceita o pedido e não cobra ninguém. Diferente do
 * token ausente, aqui existe credencial — só que a errada — e deixar passar
 * transformaria o erro de configuração em venda perdida em silêncio, em vez de
 * um boot barulhento e um checkout que diz "indisponível".
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
 * O que é seguro dizer no log de boot.
 *
 * Devolve a **presença** e a **forma** de cada variável — nunca o valor. É o
 * suficiente para responder "a variável chegou no container?" sem que o arquivo
 * de log passe a conter um segredo. O tamanho entra porque um valor truncado
 * (vírgula, quebra de linha, aspas) é indistinguível de um valor certo numa
 * conferência visual, e erra a assinatura em 100% dos webhooks.
 */
export function descreverConfiguracao(): Record<string, string> {
  const segredos = segredosDoWebhook()

  return {
    // O que é declarado entra **ao lado** da forma do token, e não fundido com
    // ela: são duas informações independentes, e é a comparação entre as duas
    // que `divergenciaDeAmbiente` faz. Fundi-las num rótulo só foi exatamente o
    // bug — o rótulo dizia "produção" para qualquer token sem `TEST-`, e um
    // token de conta de teste foi anunciado como produção.
    [AMBIENTE]: `${ambienteDeclarado()} (declarado)`,
    // O **prefixo literal**, e não um veredito: um log que afirma mais do que
    // sabe é pior do que um log que só mostra o dado. "APP_USR-" é o que o token
    // é; se isso é teste ou produção, quem sabe é quem declarou.
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
