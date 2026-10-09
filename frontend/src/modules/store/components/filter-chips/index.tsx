import type { ChipDeFiltro } from "@lib/util/filter-chips"

/**
 * A fileira dos filtros aplicados, abaixo da barra de ferramentas do catálogo.
 *
 * Ela responde a pergunta que a grade filtrada abre — "por que só 4 peças?" — e no
 * celular, onde a barra lateral de filtros não existe, é a **única** coisa que
 * lembra a cliente do que ela marcou. Cada chip é um `.rv-chip`: a mesma peça do
 * estado da peça no card, e não uma segunda forma para "etiqueta".
 *
 * Ele é burro de propósito: quem monta os chips — com o título da faceta e o
 * rótulo da loja, na ordem fixa das facetas — é `chipsDaSelecao`
 * (`lib/util/filter-chips.ts`), que se testa sem renderizar nada. Aqui só se
 * desenha a lista, e **sem seleção a lista não existe** (array vazio → `null`).
 *
 * **O chip ainda não é clicável**, e isso é deliberado: desfazer um filtro é
 * escrever na URL, e a sessão que faz isso é a ilha de cliente do próximo lote (a
 * mesma do painel). Até lá a fileira informa; quem desfaz é o painel, que já está
 * na página em cima e embaixo desta linha.
 */
export default function FilterChips({
  chips,
}: {
  chips?: ChipDeFiltro[] | null
}) {
  const lista = chips ?? []

  if (lista.length === 0) {
    return null
  }

  return (
    <ul
      className="rv-filter-chips"
      data-testid="filter-chips"
      aria-label="Filtros aplicados"
    >
      {lista.map((chip) => (
        <li key={`${chip.key}:${chip.valor}`} className="rv-chip">
          {chip.rotulo}
        </li>
      ))}
    </ul>
  )
}
