/**
 * A divisão entre colunas do bloco e conteúdo.
 * -------------------------------------------------------------------------
 * O defeito que estes testes travam é **silencioso**, e por isso está escrito
 * assim: `title` é coluna (`content_block.title`, o rótulo da listagem) e campo
 * de conteúdo em quatro tipos. Enquanto a divisão era por nome de chave, o
 * formulário do CRM mandava `title`, a API gravava a coluna, respondia 200 — e
 * a loja, que lê `data.title`, continuava com o texto antigo. Testar isso exige
 * um teste; ler o código, não: as duas versões são plausíveis.
 */
import { SECTION_FIELDS, type SectionType } from "../contract"
import { splitPayload } from "../payload"

/** Os campos de um tipo, como a rota os monta (`schema.fields[type]`). */
const fieldNames = (type: SectionType) =>
  new Set((SECTION_FIELDS[type] ?? []).map((field) => field.name))

describe("splitPayload", () => {
  it("`title` de um tipo que tem esse campo é CONTEÚDO, não coluna", () => {
    expect(
      splitPayload({ title: "Novo título" }, fieldNames("editorial"))
    ).toEqual({
      columns: {},
      data: { title: "Novo título" },
    })
  })

  it("`title` de um tipo SEM esse campo continua sendo o rótulo do bloco", () => {
    expect(
      splitPayload({ title: "Hero da campanha" }, fieldNames("hero"))
    ).toEqual({
      columns: { title: "Hero da campanha" },
      data: {},
    })
  })

  it("colunas são convertidas para o tipo da linha", () => {
    const { columns, data } = splitPayload(
      { enabled: "true", position: "30", surface: "home" },
      fieldNames("hero")
    )

    expect(columns).toEqual({ enabled: true, position: 30, surface: "home" })
    expect(data).toEqual({})
  })

  it("`enabled: \"false\"` desliga a seção (Boolean(\"false\") seria true)", () => {
    expect(splitPayload({ enabled: "false" }, fieldNames("hero")).columns).toEqual(
      { enabled: false }
    )
  })

  it("campo de conteúdo vai para `data`, inclusive lista e número", () => {
    const body = {
      headline: "Vista o seu valor",
      overlay: 0.6,
      items: [{ title: "Curadoria" }],
    }

    expect(splitPayload(body, fieldNames("hero")).data).toEqual(body)
  })

  it("chave desconhecida vira `data` (é a validação da rota que a reprova)", () => {
    // Descartar aqui seria pior: o CRM diria "salvo" e o campo digitado por
    // engano sumiria sem aviso. A rota responde 400 com o nome do campo.
    expect(
      splitPayload({ inventado: 1 }, fieldNames("hero")).data
    ).toEqual({ inventado: 1 })
  })

  it("`id` e `type` não viram conteúdo nem coluna", () => {
    // Quem os define é a rota: o `id` do query param no PATCH, o `type` já
    // validado no POST.
    expect(splitPayload({ id: "x", type: "hero" }, fieldNames("hero"))).toEqual({
      columns: {},
      data: {},
    })
  })

  it("não muda o corpo recebido (a rota ainda lê o `type` dele)", () => {
    const body = { type: "hero", enabled: false, headline: "h" }

    splitPayload(body, fieldNames("hero"))

    expect(body).toEqual({ type: "hero", enabled: false, headline: "h" })
  })
})
