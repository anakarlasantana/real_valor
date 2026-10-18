import { createHmac } from "node:crypto"

import {
  assinaturaConfere,
  entregaDoAviso,
  ehEventoAssinado,
  EVENTOS_ASSINADOS,
  metadataDoAviso,
} from "../webhook"

const SEGREDO = "segredo-do-webhook-app"
const corpoCru = JSON.stringify({ event: "order.posted", data: { id: "etq_1" } })
const assinar = (texto = corpoCru, segredo = SEGREDO) =>
  createHmac("sha256", segredo).update(texto).digest("hex")

const corpo = (extra: Record<string, unknown> = {}) => ({
  ...extra,
  event: (extra.event as string) ?? "order.posted",
  data: {
    id: "etq_1",
    status: "posted",
    tracking: "BR123456789BR",
    tracking_url: "https://rastreio.superfrete.com/#/tracking/etq_1",
    ...((extra.data ?? {}) as object),
  },
})

const aviso = (corpo1 = corpo()) => entregaDoAviso(corpo1)!

describe("assinaturaConfere", () => {
  it("aceita o HMAC-SHA256 do corpo com o segredo do Webhook App", () => {
    expect(assinaturaConfere(corpoCru, assinar(), SEGREDO)).toBe(true)
  })

  it("aceita o corpo como Buffer: é assim que `req.rawBody` chega", () => {
    expect(assinaturaConfere(Buffer.from(corpoCru), assinar(), SEGREDO)).toBe(true)
  })

  // A doc não fixa o prefixo; um `sha256=` na frente não pode virar 401.
  it("aceita o prefixo `sha256=` e o hexadecimal em maiúsculas", () => {
    expect(assinaturaConfere(corpoCru, `sha256=${assinar()}`, SEGREDO)).toBe(true)
    expect(assinaturaConfere(corpoCru, assinar().toUpperCase(), SEGREDO)).toBe(true)
  })

  // O corpo reserializado muda a ordem das chaves; assinar o objeto em vez dos
  // bytes crus reprovaria um aviso legítimo.
  it("recusa quando os bytes não são os assinados", () => {
    const reordenado = JSON.stringify({ data: { id: "etq_1" }, event: "order.posted" })

    expect(assinaturaConfere(reordenado, assinar(), SEGREDO)).toBe(false)
  })

  it("recusa assinatura feita com outro segredo ou corpo alterado", () => {
    expect(assinaturaConfere(corpoCru, assinar(corpoCru, "outro"), SEGREDO)).toBe(false)
    expect(assinaturaConfere(`${corpoCru} `, assinar(), SEGREDO)).toBe(false)
  })

  // Sem `SUPERFRETE_WEBHOOK_SECRET`, a rota seria um POST anônimo escrevendo em
  // pedido de cliente. O segredo vazio recusa tudo, e não "aceita por padrão".
  it("recusa tudo quando não há segredo configurado", () => {
    expect(assinaturaConfere(corpoCru, assinar(corpoCru, ""), "")).toBe(false)
  })

  it("recusa cabeçalho ausente, vazio ou que não é hexadecimal de 64", () => {
    expect(assinaturaConfere(corpoCru, undefined, SEGREDO)).toBe(false)
    expect(assinaturaConfere(corpoCru, "", SEGREDO)).toBe(false)
    expect(assinaturaConfere(corpoCru, "abc", SEGREDO)).toBe(false)
    expect(assinaturaConfere(corpoCru, "z".repeat(64), SEGREDO)).toBe(false)
  })

  it("recusa corpo ausente", () => {
    expect(assinaturaConfere(undefined, assinar(), SEGREDO)).toBe(false)
    expect(assinaturaConfere("", assinar(), SEGREDO)).toBe(false)
  })
})

describe("ehEventoAssinado", () => {
  it("aceita os quatro eventos que mudam o que a loja mostra", () => {
    for (const evento of EVENTOS_ASSINADOS) {
      expect(ehEventoAssinado(evento)).toBe(true)
    }
  })

  // `created`/`released` são da SuperFrete, não da etiqueta: nada no pedido
  // muda por eles, e assiná-los gravaria o mesmo valor a cada aviso.
  it("recusa criado e pago, que não mudam o estado da etiqueta", () => {
    expect(ehEventoAssinado("order.created")).toBe(false)
    expect(ehEventoAssinado("order.released")).toBe(false)
  })

  it("recusa lixo em vez de confiar no corpo", () => {
    expect(ehEventoAssinado("order.entregue")).toBe(false)
    expect(ehEventoAssinado(null)).toBe(false)
    expect(ehEventoAssinado(undefined)).toBe(false)
  })
})

describe("entregaDoAviso", () => {
  it("lê o envelope `event` + `data` da documentação", () => {
    expect(entregaDoAviso(corpo())).toEqual({
      evento: "order.posted",
      etiqueta: "etq_1",
      situacao: "posted",
      codigo: "BR123456789BR",
      urlDoRastreio: "https://rastreio.superfrete.com/#/tracking/etq_1",
    })
  })

  it("traduz o evento na situação, sem depender do `status` do corpo", () => {
    // O `status` do aviso e o do evento podem divergir num aviso atrasado; quem
    // manda é o evento.
    const atrasado = corpo({ data: { status: "delivered" }, event: "order.posted" })

    expect(entregaDoAviso(atrasado)?.situacao).toBe("posted")
  })

  // A doc é explícita: `tracking` e `tracking_url` só vêm a partir do
  // `order.generated`. Antes disso o aviso chega sem eles — e não é erro.
  it("aceita aviso sem rastreio, que é como o `generated` chega", () => {
    const semRastreio = corpo({
      event: "order.generated",
      data: { tracking: null, tracking_url: null },
    })

    expect(entregaDoAviso(semRastreio)).toMatchObject({
      situacao: "released",
      codigo: "",
      urlDoRastreio: "",
    })
  })

  it("descarta aviso sem `data.id`: não aponta para etiqueta nenhuma", () => {
    expect(entregaDoAviso(corpo({ data: { id: "" } }))).toBeNull()
    expect(entregaDoAviso({ event: "order.posted", data: {} })).toBeNull()
  })

  it("descarta evento fora da lista e corpo vazio", () => {
    expect(entregaDoAviso(corpo({ event: "order.created" }))).toBeNull()
    expect(entregaDoAviso(null)).toBeNull()
    expect(entregaDoAviso({})).toBeNull()
  })
})

describe("metadataDoAviso", () => {
  const doPedido = {
    superfrete_id: "etq_1",
    superfrete_preco: 2390,
    cpf: "12345678909",
    carrier: "Correios",
    tracking_url: "https://rastreio.superfrete.com/#/tracking/etq_1",
  }

  it("grava a situação legível e preserva o que não é do aviso", () => {
    const depois = metadataDoAviso(aviso(), doPedido)!

    expect(depois.status_label).toBe("Postada")
    expect(depois.superfrete_situacao).toBe("posted")
    expect(depois.cpf).toBe("12345678909")
    expect(depois.carrier).toBe("Correios")
    expect(depois.superfrete_preco).toBe(2390)
  })

  it("grava o código quando o aviso traz um", () => {
    expect(metadataDoAviso(aviso(), doPedido)!.tracking_number).toBe("BR123456789BR")
  })

  // O `generated` chega sem rastreio; apagar o link que o F2 gravou deixaria a
  // cliente sem para onde clicar.
  it("não apaga o rastreio quando o aviso não traz", () => {
    const depois = metadataDoAviso(
      aviso(corpo({ event: "order.generated", data: { tracking: null } })),
      doPedido
    )!

    expect(depois.tracking_number).toBeUndefined()
    expect(depois.tracking_url).toBe("https://rastreio.superfrete.com/#/tracking/etq_1")
  })

  it("grava o link do aviso quando ele vem, e não o que estava lá", () => {
    const depois = metadataDoAviso(
      aviso(corpo({ data: { tracking_url: "https://outro.example/x" } })),
      doPedido
    )!

    expect(depois.tracking_url).toBe("https://outro.example/x")
  })

  it("marca o cancelamento, que o resto do código já procura", () => {
    const depois = metadataDoAviso(
      aviso(corpo({ event: "order.cancelled" })),
      doPedido
    )!

    expect(depois.superfrete_cancelada).toBe("etq_1")
    expect(depois.status_label).toBe("Cancelada")
  })

  // A SuperFrete reentrega por 15 minutos, até 5 vezes: o mesmo aviso chega
  // várias vezes, e gravar o igual emitiria `order.updated` a cada um.
  it("não grava nada quando o aviso não muda nada", () => {
    const uma = metadataDoAviso(aviso(), doPedido)!

    expect(metadataDoAviso(aviso(), uma)).toBeNull()
  })

  // O CPF é a chave do `/store/orders/track`: um aviso atrasado depois do
  // cancelamento não pode ressuscitar a etiqueta.
  it("ignora aviso que chega depois do cancelamento", () => {
    const cancelado = metadataDoAviso(
      aviso(corpo({ event: "order.cancelled" })),
      doPedido
    )!

    expect(metadataDoAviso(aviso(corpo({ event: "order.delivered" })), cancelado)).toBeNull()
  })

  // O webhook é anônimo na origem: um aviso de outra conta não pode escrever no
  // pedido de uma cliente nossa.
  it("ignora aviso de outra etiqueta", () => {
    expect(metadataDoAviso(aviso(corpo({ data: { id: "etq_9" } })), doPedido)).toBeNull()
  })

  it("ignora pedido sem etiqueta", () => {
    expect(metadataDoAviso(aviso(), { cpf: "12345678909" })).toBeNull()
    expect(metadataDoAviso(aviso(), null)).toBeNull()
  })
})
