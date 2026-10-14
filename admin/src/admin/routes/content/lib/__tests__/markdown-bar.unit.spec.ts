/**
 * A barra de marcas do texto formatado: o que cada botão faz com a seleção.
 * -------------------------------------------------------------------------
 * O que estes testes travam é a **regra de inserção**, e não o desenho: o texto
 * gravado tem de ser o mesmo que o parser da loja interpreta
 * (`frontend/src/lib/content/markdown.tsx`), e a seleção tem de sobrar num lugar
 * útil — senão o lojista clica em "Negrito" e perde o lugar onde estava
 * escrevendo.
 *
 * As marcas entram aqui como dado, do jeito que o `schema` as manda: o par
 * `open`/`close`. Nenhum caso deste arquivo sabe o que é negrito — quem sabe é o
 * render da loja, e é o `markdown.spec.tsx` de lá que cobra a paridade.
 */
import { markExample, toggleMark } from "../markdown-bar"

/** Os pares como o contrato os declara (`as const`: são valores literais lá). */
const FORTE = { open: "**", close: "**" } as const
const ITALICO = { open: "_", close: "_" } as const
const LINK = { open: "[", close: "](/rota)" } as const

describe("toggleMark", () => {
  it("sem seleção, insere o par e deixa o cursor no meio", () => {
    expect(toggleMark("", { start: 0, end: 0 }, FORTE)).toEqual({
      text: "****",
      selection: { start: 2, end: 2 },
    })

    expect(toggleMark("o prazo é de 7 dias", { start: 2, end: 2 }, FORTE)).toEqual({
      text: "o ****prazo é de 7 dias",
      selection: { start: 4, end: 4 },
    })
  })

  it("com texto selecionado, envolve e mantém o texto selecionado", () => {
    // O texto continua selecionado para o próximo botão valer sobre ele
    // (negrito e itálico no mesmo trecho): é o gesto de quem acabou de marcar.
    expect(toggleMark("A Real Valor", { start: 2, end: 6 }, FORTE)).toEqual({
      text: "A **Real** Valor",
      selection: { start: 4, end: 8 },
    })
  })

  it("já marcado, desfaz — as marcas saem e o texto fica selecionado", () => {
    expect(toggleMark("A **Real** Valor", { start: 4, end: 8 }, FORTE)).toEqual({
      text: "A Real Valor",
      selection: { start: 2, end: 6 },
    })
  })

  it("apertar o mesmo botão duas vezes devolve o texto de antes", () => {
    const original = "Troca em até 7 dias corridos"
    const inicio = original.indexOf("7 dias")
    const primeiro = toggleMark(
      original,
      { start: inicio, end: inicio + "7 dias".length },
      FORTE
    )
    const segundo = toggleMark(primeiro.text, primeiro.selection, FORTE)

    expect(primeiro.text).toBe("Troca em até **7 dias** corridos")
    expect(segundo.text).toBe(original)
  })

  it("com o cursor entre as marcas, o botão também desfaz", () => {
    // É o caso de quem clica em "Negrito" antes de escrever e desiste — sem
    // isto, sobrariam dois `**` no texto, e o lojista apagaria na mão.
    expect(toggleMark("pra****zo", { start: 5, end: 5 }, FORTE)).toEqual({
      text: "prazo",
      selection: { start: 3, end: 3 },
    })
  })

  it("a marca de link usa um par que não é simétrico", () => {
    expect(toggleMark("ver a política", { start: 4, end: 14 }, LINK)).toEqual({
      text: "ver [a política](/rota)",
      selection: { start: 5, end: 15 },
    })
    // Desfazer: a seleção cobre o rótulo inteiro ("a política", índices 5 a 14)
    // e o par sai junto com ele.
    expect(
      toggleMark("ver [a política](/rota)", { start: 5, end: 15 }, LINK).text
    ).toBe("ver a política")
  })

  it("seleção fora da string não estoura nem marca o lugar errado", () => {
    // O valor pode ter sido trocado por baixo entre o render e o clique; o que
    // não pode é o `slice` marcar um lugar silenciosamente errado.
    expect(toggleMark("curto", { start: 99, end: 120 }, FORTE)).toEqual({
      text: "curto****",
      selection: { start: 7, end: 7 },
    })
  })

  it("a marca é aplicada no meio do texto, e o resto fica intacto", () => {
    expect(
      toggleMark("Prazo de 30 dias no inverno", { start: 9, end: 11 }, ITALICO)
        .text
    ).toBe("Prazo de _30_ dias no inverno")
  })
})

describe("markExample", () => {
  it("escreve a marca como ela vai aparecer no texto", () => {
    expect(markExample(FORTE)).toBe("**texto**")
    expect(markExample(LINK)).toBe("[texto](/rota)")
  })
})
