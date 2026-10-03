/**
 * O corpo do POST que o painel manda.
 * -------------------------------------------------------------------------
 * O teste que importa aqui é o de **preservação**: salvar a situação do pedido
 * não pode apagar o código de rastreio que a cliente já tinha. É o defeito mais
 * fácil de introduzir e o mais difícil de perceber — a gravação até "funciona",
 * e o efeito aparece dias depois, quando alguém olha a página pública e a
 * cliente que já tinha o rastreio volta a ver "ainda não enviado".
 */
/**
 * O corpo do POST que o painel manda.
 * -------------------------------------------------------------------------
 * O teste que importa aqui é o de **preservação**: salvar a situação do pedido
 * não pode apagar o código de rastreio que a cliente já tinha. É o defeito mais
 * fácil de introduzir e o mais difícil de perceber — a gravação até "funciona",
 * e o efeito aparece dias depois, quando alguém olha a página pública e a
 * cliente que já tinha o rastreio volta a ver "ainda não enviado".
 */
import {
  corpoDoEnvio,
  estadoDoResumo,
  estadoVazio,
  rotuloDaFila,
} from "../envio-form"

const RESUMO = {
  enviado: true,
  carrier: "Correios",
  trackingNumber: "BR123456789BR",
  trackingUrl: "https://rastreios.correios.com.br/x",
  statusLabel: "Em processamento",
}

describe("estadoDoResumo", () => {
  it("leva o resumo da rota para os nomes do formulário", () => {
    expect(estadoDoResumo(RESUMO)).toEqual({
      carrier: "Correios",
      tracking_number: "BR123456789BR",
      tracking_url: "https://rastreios.correios.com.br/x",
      status_label: "Em processamento",
    })
  })

  it("estadoVazio começa tudo em branco", () => {
    expect(estadoVazio()).toEqual({
      carrier: "",
      tracking_number: "",
      tracking_url: "",
      status_label: "",
    })
  })
})

describe("corpoDoEnvio", () => {
  it("não envia nada quando nada mudou", () => {
    const atual = estadoDoResumo(RESUMO)

    expect(corpoDoEnvio(atual, { ...atual })).toEqual({})
  })

  it("PRESERVA o código quando o lojista muda só a situação", () => {
    // O defeito que este arquivo existe para evitar.
    const atual = estadoDoResumo(RESUMO)
    const editado = { ...atual, status_label: "Entregue" }

    const corpo = corpoDoEnvio(atual, editado)

    expect(corpo).toEqual({ status_label: "Entregue" })
    // O que NÃO foi para o corpo não é mexido no pedido.
    expect(corpo).not.toHaveProperty("tracking_number")
    expect(corpo).not.toHaveProperty("carrier")
  })

  it("manda o campo apagado como string vazia, para limpá-lo", () => {
    const atual = estadoDoResumo(RESUMO)
    const editado = { ...atual, tracking_number: "" }

    expect(corpoDoEnvio(atual, editado)).toEqual({ tracking_number: "" })
  })

  it("envia todos os campos de um pedido novo", () => {
    const vazio = estadoVazio()

    expect(
      corpoDoEnvio(vazio, {
        carrier: "Correios",
        tracking_number: "BR123456789BR",
        tracking_url: "",
        status_label: "Em processamento",
      })
    ).toEqual({
      carrier: "Correios",
      tracking_number: "BR123456789BR",
      status_label: "Em processamento",
    })
  })

  it("uma mudança de nada não vira pedido alterado", () => {
    // Salvar sem tocar é um clique que não deve gerar gravação.
    const atual = estadoDoResumo(RESUMO)

    expect(Object.keys(corpoDoEnvio(atual, { ...atual }))).toHaveLength(0)
  })
})

describe("rotuloDaFila", () => {
  it("um pedido sem código está aguardando envio", () => {
    const r = rotuloDaFila({ ...RESUMO, enviado: false, trackingNumber: "" })

    expect(r.texto).toBe("Aguardando envio")
  })

  it("um pedido entregue é marcado como entregue", () => {
    expect(rotuloDaFila({ ...RESUMO, statusLabel: "Entregue" }).texto).toBe(
      "Entregue"
    )
  })

  it("um pedido em trânsito mostra a situação que o lojista escreveu", () => {
    // A situação vem do lojista; a tela não decide o que ela é.
    expect(rotuloDaFila({ ...RESUMO, statusLabel: "Saiu para entrega" }).texto)
      .toBe("Saiu para entrega")
  })

  it("reconhece entregue mesmo sem maiúscula", () => {
    expect(
      rotuloDaFila({ ...RESUMO, statusLabel: "objeto entregue" }).texto
    ).toBe("Entregue")
  })

  it("NÃO chama de entregue o pedido que está a caminho", () => {
    // Regressão: um teste que comparava só um prefixo ("entreg") classificava
    // "Saiu para entrega" e "Em rota de entrega" como entregues. A tela
    // passaria a dizer à loja que a cliente já recebeu o pedido.
    for (const situacao of [
      "Saiu para entrega",
      "Em rota de entrega",
      "Entrega programada",
    ]) {
      expect(rotuloDaFila({ ...RESUMO, statusLabel: situacao }).texto).toBe(
        situacao
      )
    }
  })

  it("um pedido com código e sem situação não é 'aguardando envio'", () => {
    const r = rotuloDaFila({ ...RESUMO, statusLabel: "" })

    expect(r.texto).not.toBe("Aguardando envio")
  })
})