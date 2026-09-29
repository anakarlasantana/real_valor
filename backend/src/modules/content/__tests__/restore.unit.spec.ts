/**
 * A posição com que o "Restaurar padrão" cria cada seção que falta.
 *
 * O que este teste protege é a base que **já passou pelo CRM**: a numeração do
 * padrão é a do protótipo (`hero` 20, `lancamentos` 25), e a vitrine de uma base
 * reordenada está em 100, 110, 120…. Copiar a posição do padrão ali fazia a
 * seção nova nascer **antes do hero** — o trilho de lançamentos apareceria
 * acima da fotografia de abertura, e nada na tela apontaria o motivo.
 *
 * O caso da base vazia é o outro lado: sem nenhum vizinho, a numeração do
 * padrão é a ordem certa, e ela vale para a lista inteira.
 */
import { DEFAULT_HOME_SECTIONS } from "../defaults"
import { planRestoredPositions } from "../restore"

/** A ordem em que as seções aparecem, dado o plano. */
const order = (positions: { id: string; position: number }[]) =>
  [...positions].sort((a, b) => a.position - b.position).map(({ id }) => id)

describe("planRestoredPositions", () => {
  it("numa base renumerada, a seção nova entra logo depois do vizinho do padrão", () => {
    // A base como o "Salvar ordem" do CRM a deixa (é o estado do ambiente
    // local): vitrine de 100 em 100, cromo na faixa de baixo. Falta só o
    // `lancamentos`. Repare que a ordem ATUAL não é a do padrão — a coleção
    // veio antes da faixa de benefícios, porque quem arruma é o lojista.
    const existing = [
      { id: "nav", position: 10 },
      { id: "announcement", position: 20 },
      { id: "footer", position: 90 },
      { id: "hero", position: 100 },
      { id: "collections", position: 110 },
      { id: "benefits", position: 120 },
      { id: "featured", position: 130 },
      { id: "editorial", position: 140 },
      { id: "instagram", position: 150 },
    ]

    const plan = planRestoredPositions(existing)

    expect(plan).toEqual([{ id: "lancamentos", position: 105 }])
    // E, na prática: o trilho entre o hero (100) e as coleções (110) — e não
    // antes do hero, que é onde a posição 25 do padrão cairia.
    expect(order([...existing, ...plan])).toEqual([
      "nav",
      "announcement",
      "footer",
      "hero",
      "lancamentos",
      "collections",
      "benefits",
      "featured",
      "editorial",
      "instagram",
    ])
  })

  it("numa base vazia, a ordem é a do padrão (a numeração do protótipo vale)", () => {
    const plan = planRestoredPositions([])

    expect(plan.map(({ id }) => id)).toEqual(
      DEFAULT_HOME_SECTIONS.map(({ id }) => id)
    )
    expect(order(plan)).toEqual(DEFAULT_HOME_SECTIONS.map(({ id }) => id))
    // A primeira é a do padrão (a barra de anúncio não tem vizinho anterior),
    // e nenhuma posição se repete — ordem indefinida é o que a numeração evita.
    expect(plan[0].position).toBe(DEFAULT_HOME_SECTIONS[0].position)
    expect(new Set(plan.map(({ position }) => position)).size).toBe(plan.length)
  })

  it("não mexe em nada quando todas as seções já existem", () => {
    expect(planRestoredPositions(DEFAULT_HOME_SECTIONS)).toEqual([])
  })

  it("a seção que vem antes de um vizinho ausente entra depois do que existe", () => {
    // Base com o cromo e mais nada: o hero (vizinho do padrão é a barra de
    // anúncio) entra depois dela, não na posição 20 do protótipo — que é igual
    // à da barra e daria ordem indefinida.
    const existing = [
      { id: "nav", position: 10 },
      { id: "announcement", position: 20 },
      { id: "footer", position: 90 },
    ]

    const plan = planRestoredPositions(existing)
    const positions = plan.map(({ position }) => position)

    expect(order([...existing, ...plan])).toEqual([
      "nav",
      "announcement",
      "hero",
      "lancamentos",
      "benefits",
      "collections",
      "featured",
      "editorial",
      "instagram",
      "footer",
    ])
    expect(new Set(positions).size).toBe(positions.length)
  })
})
