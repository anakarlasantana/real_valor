/**
 * A assinatura do webhook, a redação de PII e a leitura das credenciais.
 * -------------------------------------------------------------------------
 * Três arquivos puros, e por isso três coisas que se pode provar sem banco:
 * que uma notificação assinada passa, que ela **não** passa sem a assinatura, e
 * que nenhum dado pessoal do Mercado Pago tem caminho de saída.
 *
 * **Por que os casos de recusa valem mais que o de aceite.** O caso de aceite é
 * o que a loja vê hoje; os de recusa são o que separa a loja de um pedido de
 * graça. Um teste que só cobre "a assinatura certa passa" passaria com
 * `validarAssinatura = () => ({ ok: true })` — o pior código possível, aprovado
 * com louvor.
 */
import { createHmac } from "node:crypto"

import {
  assinar,
  compararSeguro,
  lerAssinatura,
  manifestos,
  validarAssinatura,
} from "../assinatura"
import { REDIGIDO, idMascarado, redigirPagamento, semPii } from "../redigir"

/** Assina como o Mercado Pago faz: HMAC-SHA256 do manifesto, em hexadecimal. */
function assinarComoOProvedor(entrada: {
  id: string
  requestId?: string
  ts: number
  segredo: string
}): string {
  const id = entrada.id.toLowerCase()
  const manifesto = entrada.requestId
    ? `id:${id};request-id:${entrada.requestId};ts:${entrada.ts};`
    : `id:${id};ts:${entrada.ts};`

  return createHmac("sha256", entrada.segredo).update(manifesto).digest("hex")
}

const SEGREDO = "segredo-de-teste-nao-e-o-de-verdade"
const TS = 1_700_000_000

describe("a leitura do header x-signature", () => {
  it("separa ts e v1, em qualquer ordem", () => {
    expect(lerAssinatura("ts=123,v1=abc")).toEqual({ ts: "123", v1: "abc" })
    expect(lerAssinatura("v1=abc, ts=123")).toEqual({ ts: "123", v1: "abc" })
  })

  it("não trunca um v1 que contenha '='", () => {
    // Um `split("=")` ingênuo devolveria "ab" — e a assinatura nunca conferiria,
    // com o log dizendo apenas "assinatura inválida", que não ajuda ninguém.
    expect(lerAssinatura("ts=1,v1=ab=cd")?.v1).toBe("ab=cd")
  })

  it("devolve null para o que não dá para ler", () => {
    expect(lerAssinatura(undefined)).toBeNull()
    expect(lerAssinatura("")).toBeNull()
    expect(lerAssinatura("   ")).toBeNull()
    expect(lerAssinatura("ts=1")).toBeNull()
    expect(lerAssinatura("v1=abc")).toBeNull()
    expect(lerAssinatura(42)).toBeNull()
  })
})

describe("o manifesto", () => {
  it("monta as duas variantes quando o request-id vem", () => {
    expect(manifestos({ dataId: "ABC", requestId: "r1", ts: "5" })).toEqual([
      "id:abc;request-id:r1;ts:5;",
      "id:abc;ts:5;",
    ])
  })

  it("monta só uma variante quando o request-id não vem", () => {
    expect(manifestos({ dataId: "abc", ts: "5" })).toEqual(["id:abc;ts:5;"])
  })

  it("baixa o data.id para minúsculas — é assim que o provedor assina", () => {
    // Sem o toLowerCase aqui, todo webhook de um evento cujo `data.id` chega em
    // maiúsculas falha com o segredo certo na mão. É o erro mais caro do módulo.
    expect(manifestos({ dataId: "ORDER123ABC", ts: "5" })[0]).toBe(
      "id:order123abc;ts:5;"
    )
  })
})

describe("a validação da assinatura", () => {
  const base = {
    segredos: [SEGREDO],
    ts: TS,
    dataId: "12345",
    requestId: "req-9",
  }

  /** O caminho de aceite, com o request-id que o provedor manda. */
  function julgar(assinado: {
    id?: string
    requestId?: string
    segredo: string
  }) {
    const v1 = assinarComoOProvedor({
      id: assinado.id ?? base.dataId,
      requestId: assinado.requestId ?? base.requestId,
      ts: TS,
      segredo: assinado.segredo,
    })

    return validarAssinatura({
      headerAssinatura: `ts=${TS},v1=${v1}`,
      requestId: assinado.requestId ?? base.requestId,
      dataId: assinado.id ?? base.dataId,
      segredos: base.segredos,
      agoraSegundos: TS,
      toleranciaSegundos: 300,
    })
  }

  it("ACEITA a assinatura do provedor", () => {
    expect(julgar({ segredo: SEGREDO })).toMatchObject({ ok: true })
  })

  it("ACEITA quando o request-id não veio no header", () => {
    // A documentação do provedor descreve as duas formas. Recusar esta seria
    // recusar webhook legítimo de um ambiente configurado de outro jeito.
    const v1 = assinarComoOProvedor({
      id: base.dataId,
      ts: TS,
      segredo: SEGREDO,
    })

    expect(
      validarAssinatura({
        headerAssinatura: `ts=${TS},v1=${v1}`,
        dataId: base.dataId,
        segredos: [SEGREDO],
        agoraSegundos: TS,
      })
    ).toMatchObject({ ok: true })
  })

  it("ACEITA quando o data.id chega em MAIÚSCULAS", () => {
    expect(julgar({ id: "ORDER-ABC", segredo: SEGREDO })).toMatchObject({
      ok: true,
    })
  })

  it("ACEITA se qualquer um dos segredos conferir", () => {
    // A troca de um segredo pelo outro não pode ser uma janela de 401.
    const v1 = assinarComoOProvedor({
      id: base.dataId,
      requestId: base.requestId,
      ts: TS,
      segredo: "o-segredo-de-teste",
    })

    expect(
      validarAssinatura({
        headerAssinatura: `ts=${TS},v1=${v1}`,
        requestId: base.requestId,
        dataId: base.dataId,
        segredos: [SEGREDO, "o-segredo-de-teste"],
        agoraSegundos: TS,
      })
    ).toMatchObject({ ok: true })
  })

  it("RECUSA uma assinatura válida feita com OUTRO segredo", () => {
    // O caso que importa: alguém com um segredo qualquer não pode passar.
    expect(julgar({ segredo: "segredo-do-atacante" })).toEqual({
      ok: false,
      motivo: "assinatura_invalida",
    })
  })

  it("RECUSA quando o id do corpo é trocado por outro pagamento", () => {
    // Assinatura legítima de UM pagamento não vale para outro: é o que impede
    // reaproveitar a notificação de um pedido barato num pedido caro. A
    // assinatura aqui é a **correta** para o id 12345, e o corpo diz 999999 —
    // é exatamente o ataque, e ele não pode passar.
    const v1 = assinarComoOProvedor({
      id: base.dataId,
      requestId: base.requestId,
      ts: TS,
      segredo: SEGREDO,
    })

    expect(
      validarAssinatura({
        headerAssinatura: `ts=${TS},v1=${v1}`,
        requestId: base.requestId,
        dataId: "999999",
        segredos: [SEGREDO],
        agoraSegundos: TS,
        toleranciaSegundos: 300,
      })
    ).toEqual({ ok: false, motivo: "assinatura_invalida" })
  })

  it("RECUSA sem o header, e diz que o motivo é esse", () => {
    expect(
      validarAssinatura({
        headerAssinatura: undefined,
        dataId: base.dataId,
        segredos: [SEGREDO],
      })
    ).toEqual({ ok: false, motivo: "sem_header" })
  })

  it("distingue header ausente de header quebrado", () => {
    // Os dois não passam, mas não são o mesmo evento: um é rotina, o outro é
    // alguém tentando. Um 401 que não separa os dois cega quem opera a loja.
    expect(
      validarAssinatura({
        headerAssinatura: "lixo",
        dataId: base.dataId,
        segredos: [SEGREDO],
      })
    ).toEqual({ ok: false, motivo: "header_malformado" })
  })

  it("RECUSA quando não há segredo configurado, em vez de aceitar", () => {
    // Aceitar sem segredo é o bug mais grave possível deste arquivo: sem
    // `MP_WEBHOOK_SECRET`, qualquer POST criaria um pedido pago.
    const v1 = assinarComoOProvedor({
      id: base.dataId,
      requestId: base.requestId,
      ts: TS,
      segredo: SEGREDO,
    })

    expect(
      validarAssinatura({
        headerAssinatura: `ts=${TS},v1=${v1}`,
        requestId: base.requestId,
        dataId: base.dataId,
        segredos: [],
        agoraSegundos: TS,
      })
    ).toEqual({ ok: false, motivo: "sem_segredo" })
  })

  it("RECUSA sem data.id, em vez de validar um manifesto vazio", () => {
    expect(
      validarAssinatura({
        headerAssinatura: `ts=${TS},v1=${assinar("id:;ts:1;", SEGREDO)}`,
        dataId: undefined,
        segredos: [SEGREDO],
      })
    ).toEqual({ ok: false, motivo: "sem_id" })
  })

  it("RECUSA um ts não numérico", () => {
    expect(
      validarAssinatura({
        headerAssinatura: "ts=ontem,v1=abc",
        dataId: base.dataId,
        segredos: [SEGREDO],
      })
    ).toEqual({ ok: false, motivo: "header_malformado" })
  })

  it("RECUSA fora da janela, e ACEITA dentro dela", () => {
    const v1 = assinarComoOProvedor({
      id: base.dataId,
      requestId: base.requestId,
      ts: TS,
      segredo: SEGREDO,
    })

    const julgarEm = (agora: number) =>
      validarAssinatura({
        headerAssinatura: `ts=${TS},v1=${v1}`,
        requestId: base.requestId,
        dataId: base.dataId,
        segredos: [SEGREDO],
        toleranciaSegundos: 300,
        agoraSegundos: agora,
      })

    expect(julgarEm(TS + 301)).toEqual({ ok: false, motivo: "fora_da_janela" })
    expect(julgarEm(TS + 299)).toMatchObject({ ok: true })
  })

  it("tolerância 0 desliga a checagem do relógio", () => {
    // A reentrega tardia do provedor é legítima. Um `ts` antigo não pode ser o
    // motivo de o pedido não existir com o dinheiro já recebido.
    const v1 = assinarComoOProvedor({
      id: base.dataId,
      requestId: base.requestId,
      ts: TS,
      segredo: SEGREDO,
    })

    expect(
      validarAssinatura({
        headerAssinatura: `ts=${TS},v1=${v1}`,
        requestId: base.requestId,
        dataId: base.dataId,
        segredos: [SEGREDO],
        toleranciaSegundos: 0,
        agoraSegundos: TS + 86_400,
      })
    ).toMatchObject({ ok: true })
  })
})

describe("a comparação segura", () => {
  it("é verdadeira só para strings iguais", () => {
    expect(compararSeguro("abc", "abc")).toBe(true)
    expect(compararSeguro("abc", "abd")).toBe(false)
  })

  it("não lança com tamanhos diferentes", () => {
    // `timingSafeEqual` lança, e um throw aqui seria 500 onde precisa ser 401.
    expect(() => compararSeguro("abc", "abcdef")).not.toThrow()
    expect(compararSeguro("abc", "abcdef")).toBe(false)
  })
})

describe("a redação de PII", () => {
  const pagamentoDoProvedor = {
    id: 123456789,
    status: "approved",
    status_detail: "accredited",
    payment_method_id: "pix",
    payment_type_id: "bank_transfer",
    installments: 1,
    transaction_amount: 189.9,
    currency_id: "BRL",
    external_reference: "payses_01H",
    live_mode: false,
    card: {
      first_six_digits: "423564",
      last_four_digits: "4242",
      expiration_year: 2030,
      cardholder: {
        name: "MARIA DA SILVA",
        identification: { type: "CPF", number: "12345678909" },
      },
    },
    payer: {
      email: "maria@exemplo.com.br",
      first_name: "Maria",
      last_name: "da Silva",
      phone: { area_code: "11", number: "999999999" },
      identification: { type: "CPF", number: "12345678909" },
      address: { street_name: "Rua das Flores", zip_code: "01310100" },
    },
    additional_info: { items: [{ title: "Peça sob medida" }] },
    point_of_interaction: { transaction_data: { qr_code: "00020126" } },
  }

  it("guarda o estado da cobrança", () => {
    expect(redigirPagamento(pagamentoDoProvedor)).toMatchObject({
      id: 123456789,
      status: "approved",
      external_reference: "payses_01H",
      transaction_amount: 189.9,
    })
  })

  it("não deixa passar NENHUM dado pessoal do pagador", () => {
    // A asserção é sobre o texto inteiro de propósito: um campo novo que o
    // provedor mandar amanhã já reprova este teste, em vez de vazar calado.
    const saida = JSON.stringify(redigirPagamento(pagamentoDoProvedor))

    for (const pii of [
      "maria@exemplo.com.br",
      "Maria",
      "da Silva",
      "12345678909",
      "999999999",
      "Rua das Flores",
      "01310100",
      "MARIA DA SILVA",
      "423564",
      "Peça sob medida",
      "00020126",
    ]) {
      expect(saida).not.toContain(pii)
    }
  })

  it("do cartão, sai só o final", () => {
    expect(redigirPagamento(pagamentoDoProvedor)?.card).toEqual({
      last_four_digits: "4242",
    })
  })

  it("devolve undefined — e não {} — para o que não é pagamento", () => {
    expect(redigirPagamento(null)).toBeUndefined()
    expect(redigirPagamento("approved")).toBeUndefined()
    expect(redigirPagamento({})).toEqual({})
  })

  it("mascara o id do provedor", () => {
    expect(idMascarado("123456789012")).toBe("…789012")
    expect(idMascarado("123")).toBe("123")
    expect(idMascarado(undefined)).toBe("")
  })
})

describe("a redação por nome de campo (o log de erro)", () => {
  it("redige PII em qualquer profundidade", () => {
    const saida = JSON.stringify(
      semPii({
        payer: {
          email: "a@b.com",
          first_name: "Ana",
          identification: { number: "1" },
        },
        error: { message: "cart_token inválido" },
      })
    )

    expect(saida).not.toContain("a@b.com")
    expect(saida).not.toContain("Ana")
    expect(saida).toContain("cart_token")
  })

  it("preserva o diagnóstico: payment_method_id e transaction_amount ficam", () => {
    // É a razão da exceção das chaves técnicas. Redigir por "number" apagaria
    // o CPF — e, sem a exceção, apagaria o valor da transação junto.
    expect(
      semPii({
        payment_method_id: "pix",
        transaction_amount: 189.9,
        installments: 1,
      })
    ).toEqual({
      payment_method_id: "pix",
      transaction_amount: 189.9,
      installments: 1,
    })
  })

  it("corta profundidade e comprimento em vez de derrubar o log", () => {
    let fundo: Record<string, unknown> = { fim: "ok" }
    for (let i = 0; i < 12; i++) {
      fundo = { nivel: fundo }
    }

    expect(JSON.stringify(semPii(fundo))).toContain(REDIGIDO)
    expect(semPii("x".repeat(500))).toHaveLength(121)
  })
})

