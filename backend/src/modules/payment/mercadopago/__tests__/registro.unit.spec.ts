/**
 * O registro dos providers do Mercado Pago — config, classe e contrato.
 * -------------------------------------------------------------------------
 * Este arquivo existe porque o identificador de um provider de pagamento é
 * montado **em três lugares diferentes**, e nenhum deles vê os outros:
 *
 * ```
 *   medusa-config.ts   { resolve: ".../pix", id: "pix" }
 *          ↓  (o loader)
 *   @medusajs/payment/loaders/providers.js
 *          key = `pp_${klass.identifier}${id ? `_${id}` : ""}`
 *          ↓  (o que fica gravado)
 *   payment_session.provider_id = "pp_mercadopago_pix"
 *          ↑  (o que o storefront pergunta)
 *   @rv/contrato/payment  MERCADOPAGO_PIX_PROVIDER_ID
 * ```
 *
 * `tsc` não vê nada disso: são strings montadas em runtime dentro de um loader.
 * Um erro de digitação em qualquer ponta produz `pp_mercadopago_pixx`, e o
 * sintoma é **o checkout não achar o adapter** — uma tela sem botão de
 * pagamento, sem erro no log, num caminho que só é exercitado pela cliente.
 *
 * **Por que os três lados no mesmo teste.** Cada lado sozinho passa com os
 * outros errados. É a comparação entre eles que tem valor — e é por isso que
 * este arquivo calcula o identificador **como o loader o calcula**, e não lê a
 * constante do contrato e compara com ela mesma.
 */
import { readFileSync } from "node:fs"
import { join } from "node:path"

import {
  MERCADOPAGO_CARTAO_PROVIDER_ID,
  MERCADOPAGO_PIX_PROVIDER_ID,
  MERCADOPAGO_PROVIDER_PREFIX,
} from "@rv/contrato/payment"

import { METODOS } from "../preferencia"
import cartao, { MercadoPagoCartaoService } from "../cartao"
import pix, { MercadoPagoPixService } from "../pix"

const root = join(__dirname, "../../../../../..")
const read = (...parts: string[]) => readFileSync(join(root, ...parts), "utf8")

const config = read("backend", "medusa-config.ts")

/**
 * O identificador que o **loader** monta. Copiado da fonte, não reinventado:
 *
 *   const key = `pp_${klass.identifier}${pluginOptions.id ? `_${pluginOptions.id}` : ""}`
 *
 * — o mesmo `id` que está no item do config.
 */
function identificadorRegistrado(identifier: string, id?: string): string {
  return `pp_${identifier}${id ? `_${id}` : ""}`
}

/**
 * O item do PAYMENT em `modules`, recortado por `resolve:`.
 *
 * Recortar pelo `resolve` e não por comentário é deliberado: é o `resolve` que
 * decide o que o reduce do `defineConfig` sobrescreve. Um comentário a mais não
 * muda o comportamento; um `resolve` repetido, sim.
 */
function itemDoPagamento(): string {
  const at = config.indexOf('resolve: "@medusajs/medusa/payment"')

  if (at === -1) {
    return config
  }

  const proximo = config.indexOf("\n    {\n      resolve:", at)
  return config.slice(at, proximo === -1 ? config.length : proximo)
}

describe("o registro dos providers", () => {
  it("declara o MÓDULO de pagamento, e não o provider solto em modules", () => {
    // O mesmo bug que o fulfillment já teve: um `ModuleProvider` não é um
    // módulo (`ModuleProvider()` devolve `{ module, services, loaders }`, sem
    // `service`), então declarado em `modules` ele derruba o boot — e, vindo
    // depois do padrão no reduce, ainda apaga a configuração do PAYMENT.
    expect(itemDoPagamento()).toContain('resolve: "@medusajs/medusa/payment"')

    expect(config).not.toMatch(
      /\{\s*resolve: "\.\/src\/modules\/payment\/mercadopago\/(pix|cartao)"\s*\}/
    )
  })

  it("registra os DOIS providers, com os dois `id`", () => {
    const item = itemDoPagamento()

    expect(item).toContain('resolve: "./src/modules/payment/mercadopago/pix"')
    expect(item).toContain('id: "pix"')
    expect(item).toContain('resolve: "./src/modules/payment/mercadopago/cartao"')
    expect(item).toContain('id: "cartao"')
  })

  it("não precisa re-declarar o `pp_system_default` — e não deve", () => {
    // ⚠️ O oposto do fulfillment, e a diferença importa. O loader do PAYMENT
    // SOMA: ele registra o `SystemPaymentProvider` com `id: "default"`
    // incondicionalmente, ANTES de ler `options.providers`:
    //
    //   node_modules/@medusajs/payment/dist/loaders/providers.js
    //
    // Re-declarar o sistema aqui criaria uma segunda entrada com a mesma chave
    // (`pp_system_default`), e a leitura de `payment_providers` passaria a ter
    // um id repetido — o tipo de duplicata que só aparece numa conciliação.
    // O teste afirma a **ausência**: é uma decisão, não um esquecimento.
    expect(itemDoPagamento()).not.toContain("pp_system_default")
    expect(itemDoPagamento()).not.toContain("payment-system")
  })

  it("mantém os outros módulos que a loja já tinha", () => {
    // A edição acrescentou um item ao array. O risco óbvio é derrubar o resto:
    // `file` (upload do painel) e `content` (seções da vitrine) são o que o
    // admin usa, e `fulfillment` é o frete.
    expect(config).toContain('resolve: "@medusajs/medusa/file"')
    expect(config).toContain('resolve: "@medusajs/medusa/fulfillment"')
    expect(config).toContain('resolve: "./src/modules/content"')
  })
})

describe("as classes dos providers", () => {
  it("cada módulo exporta um ModuleProvider do PAYMENT com o seu service", () => {
    // `ModuleProvider(modulo, { services })` devolve `{ module, services,
    // loaders }` — e é o `module` que diz a que módulo o provider pertence.
    // Apontar para o módulo errado registraria um provider de pagamento no
    // fulfillment, e o erro apareceria longe daqui.
    expect((pix as { module?: string }).module).toBe("payment")
    expect((cartao as { module?: string }).module).toBe("payment")

    expect((pix as { services?: unknown[] }).services).toContain(
      MercadoPagoPixService
    )
    expect((cartao as { services?: unknown[] }).services).toContain(
      MercadoPagoCartaoService
    )
  })

  it("as duas classes declaram `metodo` e o `identifier` do PROVEDOR", () => {
    // `identifier` é o nome do provedor (`mercadopago`), e é o MESMO nos dois —
    // o que os separa é o `id` do config. Trocar para `mercadopago_cartao`
    // produziria `pp_mercadopago_cartao_cartao`, que ninguém acha.
    expect(MercadoPagoPixService.identifier).toBe("mercadopago")
    expect(MercadoPagoCartaoService.identifier).toBe("mercadopago")

    expect(MercadoPagoPixService.metodo).toBe("pix")
    expect(MercadoPagoCartaoService.metodo).toBe("cartao")
  })

  it("o identificador CALCULADO como o loader calcula bate com o do contrato", () => {
    // ⭐ A asserção central deste arquivo. O `id` sai do **config** (texto), o
    // `identifier` sai da **classe**, o cálculo é o do **loader**, e o
    // resultado é comparado com a **constante que o storefront usa para achar o
    // adapter**. Se qualquer uma das quatro pontas divergir, o checkout fica
    // sem botão de pagamento — e é aqui que se descobre, e não em produção.
    expect(
      identificadorRegistrado(MercadoPagoPixService.identifier, "pix")
    ).toBe(MERCADOPAGO_PIX_PROVIDER_ID)

    expect(
      identificadorRegistrado(MercadoPagoCartaoService.identifier, "cartao")
    ).toBe(MERCADOPAGO_CARTAO_PROVIDER_ID)
  })

  it("os dois identificadores são distintos e têm o prefixo do contrato", () => {
    // Se os dois fossem iguais, o `startsWith` do registry do storefront daria
    // o mesmo adapter para os dois meios — e o segundo provider registrado
    // venceria silenciosamente.
    expect(MERCADOPAGO_PIX_PROVIDER_ID).not.toBe(MERCADOPAGO_CARTAO_PROVIDER_ID)

    for (const id of [
      MERCADOPAGO_PIX_PROVIDER_ID,
      MERCADOPAGO_CARTAO_PROVIDER_ID,
    ]) {
      expect(id.startsWith(MERCADOPAGO_PROVIDER_PREFIX)).toBe(true)
    }
  })

  it("os `providerId` de METODOS são exatamente os dois do contrato", () => {
    expect(METODOS.pix.providerId).toBe(MERCADOPAGO_PIX_PROVIDER_ID)
    expect(METODOS.cartao.providerId).toBe(MERCADOPAGO_CARTAO_PROVIDER_ID)
  })
})

describe("o defineConfig realmente resolve os módulos", () => {
  const { defineConfig } = require("@medusajs/utils") as typeof import("@medusajs/utils")

  it("resolve o módulo de pagamento com os dois providers intactos", () => {
    // Texto não executa o reduce do framework. Este bloco executa.
    const resolved = defineConfig({
      modules: [
        {
          resolve: "@medusajs/medusa/payment",
          options: {
            providers: [
              { resolve: "./src/modules/payment/mercadopago/pix", id: "pix" },
              {
                resolve: "./src/modules/payment/mercadopago/cartao",
                id: "cartao",
              },
            ],
          },
        },
      ],
    })

    const pagamento = (resolved as { modules?: Record<string, unknown> })
      .modules?.["payment"] as
      | { options?: { providers?: { id: string }[] } }
      | undefined

    expect(pagamento).toBeDefined()
    expect(pagamento?.options?.providers?.map((p) => p.id)).toEqual([
      "pix",
      "cartao",
    ])
  })

  it("o provider solto como módulo é o que derruba o boot", () => {
    // A prova de que o teste acima não é decorativo: a forma errada estoura.
    // Se um dia deixar de estourar, é porque o contrato do framework mudou — e
    // aí o teste acima precisa de outra asserção, não de ser apagado.
    expect(() =>
      defineConfig({ modules: [{ resolve: "./src/modules/payment/mercadopago/pix" }] })
    ).toThrow(/prototype/)
  })
})
