/**
 * A fileira dos filtros aplicados.
 * -------------------------------------------------------------------------
 * A referência não desenha chips; quem os pede é a leitura do catálogo filtrado —
 * "por que esta grade tem 4 peças?". O que este módulo decide é **o que cada chip
 * diz**, e não como ele se parece: o desenho é o `.rv-chip` do `brand.css`, a
 * mesma peça do estado da peça no card, com a fileira em `.rv-filter-chips`.
 *
 * Duas regras, e as duas são de dado real:
 *
 *   1. **Todo filtro aplicado tem chip.** A seleção é a URL, e a URL pode nomear um
 *      valor que o catálogo não tem mais (um link compartilhado cuja peça saiu do
 *      ar). O rótulo do valor ausente é o próprio valor — o mesmo critério do
 *      painel, que também injeta a opção ausente com zero peças. Chip nenhum é
 *      inventado: o que não está na URL não aparece.
 *   2. **A ordem é fixa** — a das facetas (`CHAVES_DE_FACETA`), e dentro de cada uma
 *      a ordem em que os valores foram marcados. Ordem que muda entre renders é
 *      uma fileira que dança a cada clique.
 */
import {
  CHAVES_DE_FACETA,
  tituloDaFaceta,
  type ChaveDeFaceta,
  type Faceta,
  type SelecaoDoCatalogo,
} from "./catalog-filters"

export type ChipDeFiltro = {
  key: ChaveDeFaceta
  /** O valor como a URL o escreve — é ele que desfaz o filtro, no próximo lote. */
  valor: string
  /** O que a cliente lê: "Cor: Preto". */
  rotulo: string
}

/**
 * "Cor: Preto".
 *
 * O título da faceta entra junto porque um chip solto ("Preto") não diz de que
 * pergunta ele é resposta quando a grade tem quatro facetas. Valor em branco não
 * deixa dois-pontos pendurado.
 */
export function rotuloDoChip(titulo: string, valor: string): string {
  const limpo = valor.trim()

  return limpo === "" ? titulo.trim() : `${titulo.trim()}: ${limpo}`
}

/**
 * Os chips da seleção atual, na ordem das facetas.
 *
 * As facetas vêm da página (o mesmo array que o painel desenha) para que o rótulo
 * do valor seja o **da loja** — `P` vira "P" e a faixa de preço vira "Até R$ 300",
 * e não o texto cru que está na URL. Faceta que não veio (ou valor que ela não
 * lista) cai para o título padrão e para o valor cru, e é por isso que a fileira
 * nunca perde um filtro que está aplicado.
 */
export function chipsDaSelecao(
  facets: Faceta[],
  selecao: SelecaoDoCatalogo
): ChipDeFiltro[] {
  const porChave = new Map(facets.map((faceta) => [faceta.key, faceta]))
  const chips: ChipDeFiltro[] = []

  for (const key of CHAVES_DE_FACETA) {
    const valores = selecao[key] ?? []

    if (valores.length === 0) {
      continue
    }

    const faceta = porChave.get(key)
    const titulo = faceta?.title ?? tituloDaFaceta(key)

    for (const valor of valores) {
      const opcao = faceta?.options.find((candidata) => candidata.value === valor)

      chips.push({
        key,
        valor,
        rotulo: rotuloDoChip(titulo, opcao?.label ?? valor),
      })
    }
  }

  return chips
}
