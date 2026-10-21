/** O limite por requisição, provado sem HTTP: o relógio é argumento. */
import {
  chaveDoPedido,
  criarLimitador,
  regraPara,
} from "../limite-de-requisicoes"

describe("criarLimitador", () => {
  const janela = { limite: 3, janelaMs: 1000 }

  it("deixa passar até o limite e recusa a seguinte", () => {
    const limitador = criarLimitador(janela)
    const vereditos = [0, 1, 2, 3].map((n) => limitador.tentar("ip", 1000 + n))

    expect(vereditos.map((v) => v.permitido)).toEqual([true, true, true, false])
    expect(vereditos.map((v) => v.restantes)).toEqual([2, 1, 0, 0])
  })

  it("diz quantos segundos faltam para liberar (o Retry-After)", () => {
    const limitador = criarLimitador(janela)

    for (const n of [0, 1, 2]) limitador.tentar("ip", 1000 + n)

    // A 3ª marca é de 1002 e a janela fecha em 2002: 999 ms depois de 1003.
    expect(limitador.tentar("ip", 1003).esperarSegundos).toBe(1)
  })

  it("libera de novo quando a marca mais antiga sai da janela", () => {
    const limitador = criarLimitador(janela)

    for (const n of [0, 1, 2]) limitador.tentar("ip", 1000 + n)

    expect(limitador.tentar("ip", 1000).permitido).toBe(false)
    expect(limitador.tentar("ip", 2001).permitido).toBe(true)
  })

  it("a janela é deslizante, e não um balde que zera", () => {
    const limitador = criarLimitador(janela)

    limitador.tentar("ip", 0)
    limitador.tentar("ip", 900)
    limitador.tentar("ip", 950)

    expect(limitador.tentar("ip", 990).permitido).toBe(false)
    expect(limitador.tentar("ip", 1500).permitido).toBe(true)
    expect(limitador.tentar("ip", 1600).permitido).toBe(false)
  })

  it("separa as chaves: um IP não gasta a cota do outro", () => {
    const limitador = criarLimitador(janela)

    for (const n of [0, 1, 2]) limitador.tentar("a", n)

    expect(limitador.tentar("a", 3).permitido).toBe(false)
    expect(limitador.tentar("b", 3).permitido).toBe(true)
  })

  it("varre as chaves vencidas em vez de guardar para sempre", () => {
    const limitador = criarLimitador({ limite: 5, janelaMs: 100 })

    // 499 IPs distintos, um por instante: todos dentro da janela de 100 ms.
    for (let n = 0; n < 499; n++) limitador.tentar(`ip-${n}`, n)

    expect(limitador.tamanho()).toBe(499)

    // A 500ª tentativa varre ANTES de registrar: as 499 venceram, sobra uma.
    limitador.tentar("ultima", 5000)

    expect(limitador.tamanho()).toBe(1)
  })

  it("a varredura não derruba a chave que está tentando agora", () => {
    const limitador = criarLimitador({ limite: 2, janelaMs: 100 })

    for (let n = 0; n < 499; n++) limitador.tentar("mesma", 0)

    // A 500ª é da mesma chave, e a varredura roda antes dela: a cota segue estourada.
    expect(limitador.tentar("mesma", 0).permitido).toBe(false)
  })

  it("limpar() zera o contador", () => {
    const limitador = criarLimitador(janela)

    for (const n of [0, 1, 2]) limitador.tentar("ip", n)
    limitador.limpar()

    expect(limitador.tentar("ip", 4).permitido).toBe(true)
    expect(limitador.tamanho()).toBe(1)
  })
})

describe("chaveDoPedido", () => {
  it("usa o último salto do X-Forwarded-For, e não o primeiro", () => {
    expect(
      chaveDoPedido({ forwarded: "1.2.3.4, 10.0.0.1", ip: "10.0.0.9" })
    ).toBe("10.0.0.1")
  })

  it("ignora espaços e saltos vazios", () => {
    expect(chaveDoPedido({ forwarded: " 1.2.3.4 ,  , 5.6.7.8 " })).toBe(
      "5.6.7.8"
    )
  })

  it("cai no req.ip quando não há cabeçalho", () => {
    expect(chaveDoPedido({ ip: "192.168.1.5" })).toBe("192.168.1.5")
  })

  it("cai em 'desconhecido' quando não há nada", () => {
    expect(chaveDoPedido({})).toBe("desconhecido")
  })

  it("não confia num cabeçalho que não é string", () => {
    expect(chaveDoPedido({ forwarded: ["a", "b"], ip: "10.0.0.1" })).toBe(
      "10.0.0.1"
    )
  })
})

describe("regraPara", () => {
  it("casa a cotação de frete", () => {
    expect(regraPara("/store/shipping/quote")).toEqual({
      limite: 20,
      janelaMs: 5 * 60_000,
    })
  })

  it("casa os dois webhooks", () => {
    const mercadopago = regraPara("/webhooks/mercadopago")
    const superfrete = regraPara("/webhooks/superfrete")

    expect(mercadopago).toBeDefined()
    expect(superfrete).toBe(mercadopago)
  })

  it("casa o checkout e o interno", () => {
    expect(regraPara("/store/checkout/pix")).toBeDefined()
    expect(regraPara("/internal/orders/by-cart")).toBeDefined()
  })

  it("deixa de fora o que é leitura pública", () => {
    expect(regraPara("/store/products")).toBeUndefined()
    expect(regraPara("/store/content")).toBeUndefined()
    expect(regraPara("/health")).toBeUndefined()
  })

  it("o prefixo mais longo vence", () => {
    expect(regraPara("/store/checkout/pix")).toEqual({
      limite: 30,
      janelaMs: 60_000,
    })
  })
})
