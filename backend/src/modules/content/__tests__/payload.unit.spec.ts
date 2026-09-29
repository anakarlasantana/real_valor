/**
 * A divisão entre colunas da seção e conteúdo.
 * -------------------------------------------------------------------------
 * A regra é o **nome da coluna**: coluna é o que se filtra ou ordena
 * (`surface`, `enabled`, `position`) — mais o `fixed`, que é o que a tela lê
 * para saber se a seção tem ordem —, e todo o resto do corpo é conteúdo do
 * tipo. O primeiro bloco prende a regra; o segundo é o que evita que ela volte
 * a ter exceção.
 *
 * A exceção custou caro: `title` era coluna **e** campo de conteúdo em quatro
 * tipos (`collections`, `featured`, `editorial`, `instagram`), então a divisão
 * precisava consultar o schema do tipo para desempatar — e quem pagava era o
 * lojista. O PATCH de "Título" ia para a coluna, respondia 200, a vitrine não
 * mudava e o texto digitado ficava numa coluna que nada lê. A coluna `title`
 * saiu em 2026-09-29; o que este arquivo trava agora é a **colisão** (o que
 * faria a regra voltar a precisar de desempate) e o acordo com o modelo (a
 * lista de colunas é conferida contra o `models/content-section.ts`, para uma
 * coluna nova não passar a cair em `data` por esquecimento).
 */
import { readFileSync } from "node:fs"
import { join } from "node:path"

import { SECTION_FIELDS } from "../contract"
import { COLUMN_NAMES, splitPayload } from "../payload"

describe("splitPayload", () => {
  it("`title` é CONTEÚDO, não coluna (a coluna deixou de existir)", () => {
    expect(splitPayload({ title: "Novo título" })).toEqual({
      columns: {},
      data: { title: "Novo título" },
    })
  })

  it("colunas são convertidas para o tipo da linha", () => {
    const { columns, data } = splitPayload({
      enabled: "true",
      position: "30",
      surface: "home",
    })

    expect(columns).toEqual({ enabled: true, position: 30, surface: "home" })
    expect(data).toEqual({})
  })

  it("`enabled: \"false\"` desliga a seção (Boolean(\"false\") seria true)", () => {
    expect(splitPayload({ enabled: "false" }).columns).toEqual({
      enabled: false,
    })
  })

  it("`fixed: \"false\"` não fixa a seção (mesma armadilha do `enabled`)", () => {
    // O CRM não manda esta coluna — a tela decide por ela —, mas o corpo de quem
    // chama a API direto passa por aqui, e `\"false\"` não pode virar `true`:
    // seria a seção do cromo se declarando móvel.
    expect(splitPayload({ fixed: "false" }).columns).toEqual({ fixed: false })
  })

  it("campo de conteúdo vai para `data`, inclusive lista e número", () => {
    const body = {
      headline: "Vista o seu valor",
      overlay: 0.6,
      items: [{ title: "Curadoria" }],
    }

    expect(splitPayload(body).data).toEqual(body)
  })

  it("chave desconhecida vira `data` (é a validação da rota que a reprova)", () => {
    // Descartar aqui seria pior: o CRM diria "salvo" e o campo digitado por
    // engano sumiria sem aviso. A rota responde 400 com o nome do campo.
    expect(splitPayload({ inventado: 1 }).data).toEqual({ inventado: 1 })
  })

  it("`id` e `type` não viram conteúdo nem coluna", () => {
    // Quem os define é a rota: o `id` do query param no PATCH, o `type` já
    // validado no POST.
    expect(splitPayload({ id: "x", type: "hero" })).toEqual({
      columns: {},
      data: {},
    })
  })

  it("não muda o corpo recebido (a rota ainda lê o `type` dele)", () => {
    const body = { type: "hero", enabled: false, headline: "h" }

    splitPayload(body)

    expect(body).toEqual({ type: "hero", enabled: false, headline: "h" })
  })

  it("`filters` é REFERÊNCIA, não `data` (o id sai para o link)", () => {
    // O chip era conteúdo — os rótulos moravam no `data` e a loja os mandava
    // como busca —, e é esse o defeito que a R1 conserta: a chave vai para o
    // destino de referência, e o que ela carrega é o id da categoria.
    expect(splitPayload({ title: "Peças", filters: ["pcat_a"] })).toEqual({
      columns: {},
      data: { title: "Peças" },
      references: { filters: ["pcat_a"] },
    })
  })

  it("`filters` ausente não cria a chave de referência", () => {
    // O PATCH que só mudou um texto não encosta nos chips: sem a chave no
    // corpo, nada de referência sai daqui.
    expect("references" in splitPayload({ title: "Peças" })).toBe(false)
  })
})

describe("colunas da seção × contrato", () => {
  /**
   * As colunas do modelo, lidas do arquivo. Três não contam: `id` e `type` são
   * identidade da seção (a rota resolve os dois antes de dividir o corpo, e um
   * `PATCH` não os muda por aqui) e `data` é o conteúdo inteiro.
   */
  const model = readFileSync(
    join(__dirname, "..", "models/content-section.ts"),
    "utf8"
  )
  const ignored = ["id", "type", "data"]
  const modelColumns = [...model.matchAll(/^ {2}(\w+): model\./gm)]
    .map(([, name]) => name)
    .filter((name) => !ignored.includes(name))

  it("a lista de colunas do `payload.ts` é a do modelo", () => {
    // Se uma coluna nova nascer no modelo sem entrar aqui, o corpo do CRM
    // deixaria de gravar nela e o campo novo cairia em `data` (e a seção nova
    // seria recusada por "campo desconhecido").
    expect([...COLUMN_NAMES].sort()).toEqual([...modelColumns].sort())
  })

  it("nenhum campo do contrato se chama como uma coluna", () => {
    const collisions = Object.entries(SECTION_FIELDS).flatMap(
      ([type, fields]) =>
        fields
          .map((field) => field.name)
          .filter((name) => COLUMN_NAMES.includes(name))
          .map((name) => `${type}.${name}`)
    )

    expect(collisions).toEqual([])
  })
})
