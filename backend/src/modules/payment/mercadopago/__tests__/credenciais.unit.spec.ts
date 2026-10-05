/**
 * O switch de ambiente — `MP_AMBIENTE` × a forma do token.
 * -------------------------------------------------------------------------
 * Este arquivo existe por um bug **medido**, e o teste que o prende é o marcado
 * com ⭐ abaixo.
 *
 * A conta do Mercado Pago desta loja respondia:
 *
 * ```
 * MP_ACCESS_TOKEN = "APP_USR-..."              (lido como "produção")
 * GET /users/me   → nickname: TESTUSER7358975069611479993
 *                   tags:     [user_product_seller, test_user, normal]
 * ```
 *
 * O log de boot anunciava "produção" para um token que **não cobra ninguém**,
 * porque o rótulo vinha do prefixo e o prefixo `APP_USR-` é o formato de
 * **qualquer** conta — as de teste inclusive. O erro não aparece no checkout: o
 * pagamento passa, o pedido nasce, e o dinheiro não entra.
 *
 * A correção separa as duas perguntas, e é o que estes testes prendem:
 *
 * - **"esta loja vende de verdade?"** → `MP_AMBIENTE`, declarado pelo operador;
 * - **"qual `init_point` abrir?"** → a forma do token, que é o que a API aceita.
 *
 * O caso **caro** é `MP_AMBIENTE=producao` com token `TEST-`: a loja no ar e
 * nenhuma venda cobrada. Ele passou a **recusar o pagamento** em vez de só
 * avisar — um `warn` num boot barulhento é lido como ruído.
 */
import {
  alertaDaNotificacao,
  AMBIENTE,
  ambienteDeclarado,
  descreverConfiguracao,
  divergenciaDeAmbiente,
  ehTokenDeTeste,
  formaDoToken,
  pagamentoDisponivel,
} from "../credenciais"

/**
 * Um token com a **cara** de produção — e é este o formato que uma conta de
 * teste recebe. Os valores são sintéticos: o comprimento e a forma dos dois
 * prefixos é o que importa, e o token real nunca entra num teste.
 */
const TOKEN_APP_USR =
  "APP_USR-1234567890abcdef-051815-aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa-123456789"

/** O token de **credencial de aplicação** de teste — o único `TEST-` que existe. */
const TOKEN_TEST =
  "TEST-1234567890abcdef-051815-bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb-123456789"

/** As variáveis que este arquivo mexe, e que precisam voltar como estavam. */
const VARIAVEIS = [
  AMBIENTE,
  "MP_ACCESS_TOKEN",
  "MP_NOTIFICATION_URL",
  "MP_WEBHOOK_SECRET",
  "MP_WEBHOOK_SECRET_TEST",
] as const

const guardados = new Map<string, string | undefined>()

// O `loadEnv("test")` do `jest.config.js` carrega `.env.test` antes de tudo, e o
// ambiente do desenvolvedor pode ter as variáveis reais exportadas. Limpar no
// `beforeEach` é o que faz cada caso depender **só** do que ele mesmo declara —
// sem isto, um token real no ambiente faria o teste passar ou falhar por acaso.
beforeEach(() => {
  for (const nome of VARIAVEIS) {
    guardados.set(nome, process.env[nome])
    delete process.env[nome]
  }
})

afterEach(() => {
  for (const [nome, valor] of guardados) {
    if (valor === undefined) {
      delete process.env[nome]
    } else {
      process.env[nome] = valor
    }
  }

  guardados.clear()
})

describe("o ambiente declarado", () => {
  it("ausente → `teste`, e o default é a metade segura", () => {
    // Se o default fosse `producao`, uma loja que esquecesse a variável ficaria
    // esperando um token de produção para subir — e a alternativa (subir com o
    // que tem) é o caso caro. `teste` nunca cobra ninguém por engano.
    expect(ambienteDeclarado()).toBe("teste")
  })

  it("lê `producao` quando é isso que está escrito", () => {
    process.env[AMBIENTE] = "producao"
    expect(ambienteDeclarado()).toBe("producao")
  })

  it("aceita maiúsculas e espaço sobrando", () => {
    // A variável vem de um `.env` editado à mão e de um `docker compose` que
    // repassa strings: `PRODUCAO` e ` producao ` são a mesma intenção.
    process.env[AMBIENTE] = "  PRODUCAO  "
    expect(ambienteDeclarado()).toBe("producao")
  })

  it("valor irreconhecível cai no default, em vez de explodir", () => {
    // `MP_AMBIENTE=homolog` não pode ser a diferença entre cobrar e não cobrar:
    // um enum estrito aqui trocaria um erro de digitação por um boot quebrado.
    for (const lixo of ["homolog", "prod", "true", "1", " "]) {
      process.env[AMBIENTE] = lixo
      expect(ambienteDeclarado()).toBe("teste")
    }
  })
})


describe("a forma do token", () => {
  it("`TEST-` → teste", () => {
    process.env.MP_ACCESS_TOKEN = TOKEN_TEST
    expect(formaDoToken()).toBe("teste")
    expect(ehTokenDeTeste()).toBe(true)
  })

  it("`APP_USR-` → producao — e isso NÃO quer dizer que a loja vende", () => {
    // ⚠️ A confusão que originou este arquivo. `formaDoToken()` responde sobre o
    // **formato da credencial**; a conta de teste desta loja tem exatamente esta
    // forma. Quem responde "a loja está vendendo de verdade" é
    // `ambienteDeclarado()`, e as duas respostas são independentes de propósito.
    process.env.MP_ACCESS_TOKEN = TOKEN_APP_USR

    expect(formaDoToken()).toBe("producao")
    expect(ehTokenDeTeste()).toBe(false)
  })

  it("sem token → `ausente`, que é diferente de `teste`", () => {
    // Sem token não há ambiente a comparar. Devolver `teste` faria a divergência
    // acusar problema de configuração onde o problema é ausência de credencial.
    expect(formaDoToken()).toBe("ausente")
  })
})

describe("a divergência entre o declarado e o token", () => {
  it("⭐ `producao` + token de teste → ERRO (a loja no ar que não cobra)", () => {
    // O caso mais caro do módulo. Com `TEST-`, o Mercado Pago não cobra ninguém:
    // o checkout abre, a cliente "paga", o pedido nasce, e o dinheiro não entra.
    // Nada falha em voz alta — é o erro que este arquivo existe para impedir.
    process.env[AMBIENTE] = "producao"
    process.env.MP_ACCESS_TOKEN = TOKEN_TEST

    const { erro, aviso } = divergenciaDeAmbiente()

    expect(erro).toBeDefined()
    expect(aviso).toBeUndefined()
    // A mensagem tem de dizer **as duas saídas**, senão quem lê sabe que está
    // errado e não sabe o que fazer.
    expect(erro).toContain(AMBIENTE)
    expect(erro).toContain("TEST-")
  })

  it("`teste` + `APP_USR-` → aviso, e não erro", () => {
    // O risco ESPELHADO, e ele não pode recusar: `APP_USR-` de conta de teste é
    // legítimo (é o caso desta loja hoje). Recusar quebraria o ambiente de teste
    // inteiro. O que resta é dizer em voz alta — inclusive porque o outro lado
    // desta mesma combinação é a loja real cobrando enquanto alguém acha que
    // testa.
    process.env[AMBIENTE] = "teste"
    process.env.MP_ACCESS_TOKEN = TOKEN_APP_USR

    const { erro, aviso } = divergenciaDeAmbiente()

    expect(erro).toBeUndefined()
    expect(aviso).toBeDefined()
    expect(aviso).toContain("APP_USR-")
  })

  it("as duas combinações coerentes não dizem nada", () => {
    process.env[AMBIENTE] = "producao"
    process.env.MP_ACCESS_TOKEN = TOKEN_APP_USR
    expect(divergenciaDeAmbiente()).toEqual({})

    process.env[AMBIENTE] = "teste"
    process.env.MP_ACCESS_TOKEN = TOKEN_TEST
    expect(divergenciaDeAmbiente()).toEqual({})
  })

  it("sem token não acusa divergência — quem recusa é `pagamentoDisponivel`", () => {
    // Dois erros diferentes, duas mensagens diferentes. Juntá-los daria "o
    // ambiente está contraditório" para uma loja que só não tem credencial.
    process.env[AMBIENTE] = "producao"
    expect(divergenciaDeAmbiente()).toEqual({})
  })

  it("o default ausente não inventa divergência com `APP_USR-`", () => {
    // Sem `MP_AMBIENTE`, o declarado é `teste` — logo a combinação cai no aviso,
    // e é o comportamento certo: quem não declarou nada precisa saber que o
    // prefixo não responde a pergunta que ele não fez.
    process.env.MP_ACCESS_TOKEN = TOKEN_APP_USR
    expect(divergenciaDeAmbiente().aviso).toBeDefined()
    expect(divergenciaDeAmbiente().erro).toBeUndefined()
  })
})

describe("o pagamento disponível, com a configuração que se contradiz", () => {
  it("sem token → recusa, como sempre recusou", () => {
    const disponivel = pagamentoDisponivel()

    expect(disponivel.ok).toBe(false)
    expect((disponivel as { motivo: string }).motivo).toContain("indisponível")
  })

  it("⭐ `producao` + token de teste → recusa o pagamento", () => {
    // Recusar é o que transforma o erro de configuração num sintoma **visível**.
    // Sem isto, o boot avisa (num log que ninguém lê) e o checkout cobra zero.
    process.env[AMBIENTE] = "producao"
    process.env.MP_ACCESS_TOKEN = TOKEN_TEST

    expect(pagamentoDisponivel().ok).toBe(false)
  })

  it("`teste` + `APP_USR-` → libera: é o caso desta loja, e ele funciona", () => {
    process.env[AMBIENTE] = "teste"
    process.env.MP_ACCESS_TOKEN = TOKEN_APP_USR

    expect(pagamentoDisponivel().ok).toBe(true)
  })

  it("recusa `producao` + `APP_USR-`? NÃO — não há o que recusar", () => {
    // A combinação perfeitamente coerente. Um `if` de divergência escrito largo
    // demais (por exemplo, comparando o declarado com o token em vez de olhar a
    // forma) recusaria esta — e derrubaria a loja de produção de verdade.
    process.env[AMBIENTE] = "producao"
    process.env.MP_ACCESS_TOKEN = TOKEN_APP_USR

    expect(pagamentoDisponivel().ok).toBe(true)
  })

  it("a mensagem da cliente não expõe a configuração da loja", () => {
    // O motivo vai **para a tela do checkout**. "MP_AMBIENTE=producao com token
    // TEST-" ali é ruído para quem só quer comprar, e é informação de
    // infraestrutura numa resposta que qualquer um pode provocar.
    process.env[AMBIENTE] = "producao"
    process.env.MP_ACCESS_TOKEN = TOKEN_TEST

    const motivo = (pagamentoDisponivel() as { motivo: string }).motivo

    expect(motivo).not.toContain(AMBIENTE)
    expect(motivo).not.toContain("TEST-")
    expect(motivo).not.toContain("token")
  })
})

describe("o log de boot", () => {
  it("⭐ NÃO chama de produção um token `APP_USR-` de conta de teste", () => {
    // ⭐⭐ O teste original deste arquivo, e o que falha no código anterior.
    //
    // Antes: `descreverConfiguracao` devolvia "produção · 79 caracteres" para
    // qualquer token sem `TEST-`, e a conta de teste desta loja tem esse
    // prefixo. O log afirmava produção para um token que não cobra ninguém.
    //
    // O que se exige agora é o **dado**, não o veredito: o prefixo literal e o
    // ambiente declarado lado a lado. Quem conclui é quem lê.
    process.env.MP_ACCESS_TOKEN = TOKEN_APP_USR

    const descricao = descreverConfiguracao()

    // Sem `MP_AMBIENTE` declarado, o ambiente é `teste` — e a palavra
    // "produção" não aparece em lugar nenhum da descrição.
    expect(descricao[AMBIENTE]).toContain("teste")
    expect(descricao.MP_ACCESS_TOKEN).toContain("APP_USR-")
    expect(JSON.stringify(descricao)).not.toContain("produção")
  })

  it("reporta o prefixo literal de cada token", () => {
    process.env.MP_ACCESS_TOKEN = TOKEN_TEST
    expect(descreverConfiguracao().MP_ACCESS_TOKEN).toContain("TEST-")

    process.env.MP_ACCESS_TOKEN = TOKEN_APP_USR
    expect(descreverConfiguracao().MP_ACCESS_TOKEN).toContain("APP_USR-")
  })

  it("separa o declarado da forma — são duas linhas, não uma", () => {
    process.env[AMBIENTE] = "producao"
    process.env.MP_ACCESS_TOKEN = TOKEN_APP_USR

    const descricao = descreverConfiguracao()

    expect(descricao[AMBIENTE]).toContain("producao")
    expect(descricao[AMBIENTE]).toContain("declarado")
    expect(descricao.MP_ACCESS_TOKEN).toContain("APP_USR-")
  })

  it("NUNCA imprime o token nem o segredo — só a forma e o comprimento", () => {
    // O token autoriza cobrança e estorno na conta da loja, e o segredo assina o
    // webhook. Um log de boot que os contenha é um log que autoriza.
    process.env.MP_ACCESS_TOKEN = TOKEN_APP_USR
    process.env.MP_WEBHOOK_SECRET = "segredo-de-assinatura-nao-pode-vazar"

    const texto = JSON.stringify(descreverConfiguracao())

    expect(texto).not.toContain(TOKEN_APP_USR)
    expect(texto).not.toContain("segredo-de-assinatura-nao-pode-vazar")
    // O comprimento continua saindo: é o que denuncia um valor truncado.
    expect(texto).toContain(String(TOKEN_APP_USR.length))
  })

  it("o token ausente é declarado como ausente, e não como vazio", () => {
    expect(descreverConfiguracao().MP_ACCESS_TOKEN).toContain("AUSENTE")
  })

  it("descreve as quatro variáveis que o operador precisa conferir", () => {
    // A razão de a função existir: "a variável chegou no container?" precisa ter
    // resposta no boot, e uma variável que não aparece na descrição é uma que
    // ninguém vai lembrar de conferir.
    process.env.MP_ACCESS_TOKEN = TOKEN_TEST

    const descricao = descreverConfiguracao()

    expect(Object.keys(descricao).sort()).toEqual(
      [
        AMBIENTE,
        "MP_ACCESS_TOKEN",
        "MP_BACK_URL",
        "MP_NOTIFICATION_URL",
        "MP_WEBHOOK_SECRET",
      ].sort()
    )
  })
})

/**
 * O endereço de captura do teste, com um **UUID de mentira**.
 * -------------------------------------------------------------------------
 * O UUID de um `webhook.site` é a credencial de leitura daquele canal: quem o
 * tem lê as notificações capturadas ali. Um teste que fixasse o endereço real
 * estaria publicando a credencial no repositório — então o valor aqui é
 * sintético, e o `it` que confere a redação do alerta usa este mesmo.
 */
const ENDERECO_DE_CAPTURA =
  "https://webhook.site/00000000-0000-0000-0000-000000000000"

/**
 * O alerta da URL de notificação.
 * -------------------------------------------------------------------------
 * O caso medido é o marcado com ⭐: a variável foi preenchida com um endereço do
 * `webhook.site` para inspecionar o corpo que o provedor manda. Nada falha —
 * o checkout abre, o pagamento é aprovado, o painel do Mercado Pago registra a
 * notificação **entregue**, e o pedido não nasce, porque quem recebeu foi o
 * `webhook.site`.
 */

describe("o alerta da URL de notificação", () => {
  it("cala quando a URL é a nossa rota", () => {
    const nossas = [
      "https://loja.exemplo.com.br/webhooks/mercadopago",
      // Barra final e query não fazem parte do caminho, e não podem fazer um
      // endereço certo parecer errado.
      "https://loja.exemplo.com.br/webhooks/mercadopago/",
      "https://loja.exemplo.com.br/webhooks/mercadopago?data.id=123",
      // O sufixo por meio é a segunda forma da mesma rota.
      "https://loja.exemplo.com.br/webhooks/mercadopago/pix",
      // O túnel é o caso real de dev — o host muda, o caminho não.
      "https://abcdef-123.trycloudflare.com/webhooks/mercadopago",
    ]

    for (const url of nossas) {
      process.env.MP_NOTIFICATION_URL = url
      expect(alertaDaNotificacao()).toBeUndefined()
    }
  })

  it("cala quando a variável está vazia", () => {
    // Vazio é a configuração declarada de "só confirmação manual" — o
    // `descreverConfiguracao` já anuncia isso, e um alerta aqui seria ruído.
    expect(alertaDaNotificacao()).toBeUndefined()
  })

  it("⭐ acusa o endereço de captura — o caso que engole a venda", () => {
    process.env.MP_NOTIFICATION_URL = ENDERECO_DE_CAPTURA

    const alerta = alertaDaNotificacao()

    expect(alerta).toBeDefined()
    expect(alerta).toContain("nunca nasce")
  })

  it("acusa `http://`, que o provedor não alcança de fora", () => {
    process.env.MP_NOTIFICATION_URL =
      "http://localhost:9000/webhooks/mercadopago"

    expect(alertaDaNotificacao()).toContain("HTTPS")
  })

  it("NÃO repete a URL inteira — o caminho é o token de leitura", () => {
    // O UUID do `webhook.site` é o que autoriza ler as notificações capturadas, e
    // o subdomínio aleatório de um túnel é a credencial dele. Um alerta que os
    // repete é um alerta que os grava no log de boot.
    process.env.MP_NOTIFICATION_URL = ENDERECO_DE_CAPTURA

    const alerta = alertaDaNotificacao() ?? ""

    expect(alerta).toContain("webhook.site")
    expect(alerta).not.toContain("00000000")
  })
})

