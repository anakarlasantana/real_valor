/**
 * A ordem e o resumo dos itens de uma lista do editor de conteúdo.
 * -------------------------------------------------------------------------
 * O que este teste prende é o que o lojista vê na tela do CRM ao abrir uma seção
 * com itens (a capa, os benefícios, as coleções, o rodapé):
 *
 *   - a seta que move **um** item, e não a lista inteira: trocar dois de lugar é
 *     trocar duas posições — a do item da vez e a do vizinho;
 *   - a seta da ponta, que não move nada e por isso não pode marcar a seção como
 *     alterada: o "Salvar" que acende sozinho é o aviso que não merece confiança
 *     (`form-draft.ts`);
 *   - o resumo que diz **qual** item é: o primeiro campo com valor na ordem do
 *     sub-formulário, e não o nome do arquivo de um upload (que é um carimbo de
 *     tempo) só porque o campo da foto vem primeiro no contrato.
 *
 * Como as outras suítes do painel, sem import de framework: quem injeta
 * `describe`/`it`/`expect` é o runner do CRM (`admin/jest.config.js`).
 */
import { itemSummary, move } from "../list-order"

describe("move", () => {
  it("troca o item com o vizinho, e só eles", () => {
    expect(move(["a", "b", "c"], 1, -1)).toEqual(["b", "a", "c"])
    expect(move(["a", "b", "c"], 1, 1)).toEqual(["a", "c", "b"])
  })

  it("a lista devolvida é nova (nada de mexer na que está na tela)", () => {
    const before = ["a", "b"]
    const after = move(before, 0, 1)

    expect(after).not.toBe(before)
    expect(before).toEqual(["a", "b"])
  })

  it("a seta da ponta devolve a mesma lista (não há alteração a salvar)", () => {
    const items = ["a", "b"]

    expect(move(items, 0, -1)).toBe(items)
    expect(move(items, 1, 1)).toBe(items)
  })

  it("índice fora da lista não inventa item", () => {
    const items = ["a", "b"]

    expect(move(items, 5, -1)).toBe(items)
    expect(move(items, -1, 1)).toBe(items)
  })

  it("funciona com os objetos do editor (não só com texto)", () => {
    const items = [{ id: 1 }, { id: 2 }]

    expect(move(items, 0, 1)).toEqual([{ id: 2 }, { id: 1 }])
  })
})

describe("itemSummary", () => {
  // A ordem é do contrato (`ITEM_FIELDS["list:hero-slide"]`): a foto vem
  // primeiro, e é justamente por isso que o resumo não pode ser "o primeiro
  // campo com valor" sem olhar o `kind` — daria o nome do arquivo.
  const SLIDE_FIELDS = [
    { name: "imageUrl", label: "Foto", kind: "image" },
    { name: "eyebrow", label: "Sobretítulo" },
    { name: "headline", label: "Título" },
  ] as const

  it("usa o primeiro texto com valor, na ordem do sub-formulário", () => {
    expect(
      itemSummary(SLIDE_FIELDS, { eyebrow: "Novidades", headline: "Vestidos" })
    ).toBe("Novidades")
  })

  it("pula campo em branco", () => {
    expect(itemSummary(SLIDE_FIELDS, { eyebrow: "   ", headline: "Vestidos" })).toBe(
      "Vestidos"
    )
  })

  it("a foto vem depois do texto: o nome do arquivo é carimbo de tempo", () => {
    expect(
      itemSummary(SLIDE_FIELDS, {
        imageUrl: "1790808700791-2026-04-10.png",
        headline: "Vestidos",
      })
    ).toBe("Vestidos")
  })

  it("item só com foto se apresenta pelo nome do arquivo, sem o caminho", () => {
    expect(
      itemSummary(SLIDE_FIELDS, { imageUrl: "http://backend/uploads/foto.png" })
    ).toBe("foto")
  })

  it("item sem conteúdo não tem resumo (a linha fica só com o numeral)", () => {
    expect(itemSummary(SLIDE_FIELDS, {})).toBe("")
    expect(itemSummary(SLIDE_FIELDS, { headline: "" })).toBe("")
  })

  it("lista dentro do item não é resumo (o rodapé guarda links na coluna)", () => {
    const COLUMN_FIELDS = [
      { name: "links", label: "Links", kind: "list:link" },
      { name: "title", label: "Título" },
    ] as const

    expect(
      itemSummary(COLUMN_FIELDS, { links: [], title: "Institucional" })
    ).toBe("Institucional")
  })

  it("resumo longo corta com reticências", () => {
    const long = "Um título de capa bem longo demais para o cabeçalho do item"
    const summary = itemSummary(SLIDE_FIELDS, { headline: long })

    expect(long.startsWith(summary.replace(/…$/, ""))).toBe(true)
    expect(summary.endsWith("…")).toBe(true)
    expect(summary.length).toBeLessThan(50)
  })

  it("espaço repetido vira espaço simples", () => {
    expect(itemSummary(SLIDE_FIELDS, { headline: "  Vestidos   de festa  " })).toBe(
      "Vestidos de festa"
    )
  })
})
