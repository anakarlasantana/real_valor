/**
 * O registro do provider de frete no `medusa-config.ts` — a fiação que **não
 * existe em lugar nenhum do tipo**.
 * -------------------------------------------------------------------------
 * Isto é um teste de regressão de um bug real: o provider `tabela` foi
 * declarado na lista `modules` como `{ resolve: "./src/modules/fulfillment/tabela" }`,
 * e **o backend não subia**. `tsc` passava, os 17 testes da regra passavam, e o
 * `check-boundaries` passava — nada disso vê o formato do `defineConfig`.
 *
 * A causa: `defineConfig` resolve os módulos num reduce que termina em
 * `acc[serviceName] = moduleConfig`, e o **último** registro do mesmo módulo
 * vence. O item declarado não somava um provider: **substituía** a
 * configuração padrão do FULFILLMENT (que traz o `manual`), e um
 * `ModuleProvider` não é um módulo — `defaultExport.service` é `undefined` e o
 * `defineConfig` estoura em `defaultExport.service.prototype`.
 *
 * O segundo perigo, mais silencioso: ao declarar o módulo, a lista
 * `providers` precisa vir **completa**. O loader do FULFILLMENT sincroniza o
 * banco a cada boot e **desabilita** (`providersToDisable`) tudo que está no
 * banco e fora da lista. Esquecer o `manual` desligaria as PAC/SEDEX do seed
 * **sem dar erro nenhum** — a loja abriria sem uma única opção de frete. Um
 * erro que não aparece em log nenhum é o pior tipo de erro, e por isso ele
 * também precisa de teste.
 *
 * Por que os testes não cobriram: unitário testa a regra isolada e o typecheck
 * testa os tipos. O formato do `defineConfig` é um detalhe de runtime do
 * framework, e o único jeito de pegá-lo é **rodando o `defineConfig`** — o que
 * este arquivo faz.
 */
import { readFileSync } from "node:fs"
import { join } from "node:path"

const root = join(__dirname, "../../../../../..")
const read = (...parts: string[]) => readFileSync(join(root, ...parts), "utf8")

const config = read("backend", "medusa-config.ts")

/**
 * O item do FULFILLMENT: o trecho de `modules` que declara o
 * `@medusajs/medusa/fulfillment`. Cortar por `resolve:` e não por
 * comentário, porque é o `resolve` que decide o que o `reduce` sobrescreve.
 */
function fulfillmentItem(): string {
  const at = config.indexOf('resolve: "@medusajs/medusa/fulfillment"')

  // `indexOf` = -1 quando o item sumiu. Devolve a string toda, e a asserção
  // seguinte reprova com uma mensagem utilizável — em vez de o teste estourar
  // num `undefined.slice`, que é o pior lugar para descobrir o que houve.
  if (at === -1) {
    return config
  }

  // O item vai até o próximo `resolve:` de primeiro nível, que é o começo do
  // módulo seguinte (o de conteúdo).
  const next = config.indexOf("\n    {\n      resolve:", at)
  return config.slice(at, next === -1 ? config.length : next)
}

describe("o registro do provider de frete", () => {
  it("declara o MÓDULO FULFILLMENT, e não o provider solto na lista modules", () => {
    // Este é o bug. Um `ModuleProvider` (o que `./src/modules/fulfillment/tabela`
    // exporta) NÃO é um módulo: `ModuleProvider()` devolve `{ module, services,
    // loaders }` — sem `service`. Declarado em `modules`, o `transformModules`
    // acessa `defaultExport.service.prototype` e o processo morre no boot.
    // E, por 지금 vir DEPOIS do padrão no reduce, ele ainda apaga o `manual`.
    expect(fulfillmentItem()).toContain(
      'resolve: "@medusajs/medusa/fulfillment"'
    )
    expect(config).not.toMatch(
      /\{\s*resolve: "\.\/src\/modules\/fulfillment\/tabela"\s*\}/
    )
  })

  it("mantém o manual na lista de providers", () => {
    // O `providersToDisable` desabilita no banco tudo que está fora da lista.
    // Sem o `manual` aqui, as PAC/SEDEX do seed são desligadas sem erro — a
    // loja abre sem nenhuma opção de frete e nada no log denuncia.
    const item = fulfillmentItem()

    expect(item).toContain("providers:")
    expect(item).toContain(
      'resolve: "@medusajs/medusa/fulfillment-manual"'
    )
    expect(item).toContain('id: "manual"')
  })

  it("registra a tabela como provider do fulfillment, com id", () => {
    // O `id` da lista é metade do identificador persistido: o
    // `getRegistrationIdentifier` monta `` `${identifier}_${id}` ``, e é esse
    // o valor que o Admin mostra no seletor e que a shipping option referencia.
    // Sem `id`, o provider fica com identificador `tabela_undefined`.
    const item = fulfillmentItem()

    expect(item).toContain(
      'resolve: "./src/modules/fulfillment/tabela"'
    )
    expect(item).toContain('id: "tabela"')
  })

  it("mantém os outros módulos que a loja já tinha", () => {
    // A correção foi feita re-declarando o FULFILLMENT. O risco óbvio de uma
    // edição nesse ponto é derrubar o resto: file (upload do admin) e conteúdo
    // (seções da vitrine) são o que o painel usa.
    expect(config).toContain('resolve: "@medusajs/medusa/file"')
    expect(config).toContain('resolve: "./src/modules/content"')
  })
})

describe("o defineConfig realmente resolve os módulos", () => {
  // Até aqui a conferência foi de **texto**. Texto não executa o `reduce` do
  // framework, e o bug nasceu justamente num detalhe que só aparece quando ele
  // roda. Este bloco roda o `defineConfig` de verdade, com o mesmo reduce, e
  // reproduz o crash original.
  const { defineConfig } = require("@medusajs/utils") as typeof import("@medusajs/utils")

  it("não estoura ao resolver, e resolve FULFILLMENT para o módulo certo", () => {
    // Reproduz o `transformModules` com o item do FULFILLMENT, que é o que
    // quebrava: `defaultExport.service` é `undefined` num `ModuleProvider`.
    expect(() => defineConfig({ modules: [{ resolve: "@medusajs/medusa/fulfillment" }] })).not.toThrow()
  })

  it("o provider solto como módulo é o que derruba o boot", () => {
    // A prova de que o teste acima não é decorativo: o MESMO `defineConfig`,
    // com a forma antiga, tem de estourar. Se um dia deixar de estourar, é
    // porque o contrato do framework mudou — e aí o teste acima precisa de
    // outra asserção, não de ser apagado.
    expect(() =>
      defineConfig({ modules: [{ resolve: "./src/modules/fulfillment/tabela" }] })
    ).toThrow(/prototype/)
  })

  it("resolve o módulo do config real com os dois providers", () => {
    // O item real, lido do arquivo, passado pelo `defineConfig` de verdade.
    // Confere que a lista `providers` sobrevive e que os dois `resolve` são
    // resolvíveis daqui.
    const resolved = defineConfig({
      modules: [
        {
          resolve: "@medusajs/medusa/fulfillment",
          options: {
            providers: [
              { resolve: "@medusajs/medusa/fulfillment-manual", id: "manual" },
              { resolve: "./src/modules/fulfillment/tabela", id: "tabela" },
            ],
          },
        },
      ],
    })

    const fulfillment = (resolved as { modules?: Record<string, unknown> })
      .modules?.["fulfillment"] as
      | { options?: { providers?: { id: string }[] } }
      | undefined

    expect(fulfillment).toBeDefined()
    expect(fulfillment?.options?.providers?.map((p) => p.id)).toEqual([
      "manual",
      "tabela",
    ])
  })
})