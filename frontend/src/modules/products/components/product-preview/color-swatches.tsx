import {
  bolinhasDoCard,
  coresDoProduto,
  type ProdutoComEnriquecimento,
} from "@lib/util/product-enrichment"

/**
 * As bolinhas de cor do card.
 * -------------------------------------------------------------------------
 * **Elas não são clicáveis, e isso é decisão, não esquecimento.** A raiz do card
 * é um `<LocalizedClientLink>` (`product-preview/index.tsx`), e um `<a>` dentro de
 * outro `<a>` é HTML inválido: o navegador desfaz o de dentro, e o mesmo clique
 * passa a ter dois destinos conforme o pixel. Trocar a foto do card por `onClick`
 * também não resolve — o card é componente de servidor, e **quem sabe escolher a
 * cor é a página da peça**, onde existem estoque, preço e imagem por variante de
 * verdade. Aqui a bolinha é informação ("esta peça tem estas cores"), e o card
 * inteiro continua sendo um alvo só.
 *
 * A cor **sem hex** aparece com a inicial do nome, e não sumindo: o lojista
 * cadastrou a cor na opção (isso é dado do Medusa) e só não enriqueceu o hex.
 * Sumir diria à cliente que a peça tem menos cores do que tem. O nome inteiro
 * fica no `sr-only`, e o `title` o mostra no ponteiro — cor nenhuma é só mancha.
 *
 * A aparência é do `brand.css` (`.rv-card-dot`, `.rv-card-count`): a bolinha de
 * 12px com o anel de superfície e o `+n` em letra miúda são a régua do redesenho,
 * e ela também explica por que o fio de borda continua ali para a cor sem hex. A
 * única coisa que vem por `style` é o hex, porque valor que só existe em tempo de
 * execução não vira classe.
 */
export default function ColorSwatches({
  product,
}: {
  product: ProdutoComEnriquecimento
}) {
  const cores = coresDoProduto(product)

  if (cores.length === 0) {
    // Peça sem cor cadastrada não reserva espaço nenhum — o card de uma peça de
    // cor única não pode ficar mais alto do que o das outras.
    return null
  }

  const { visiveis, restantes } = bolinhasDoCard(cores)

  return (
    <ul
      className="rv-card-colors flex items-center gap-x-2"
      data-testid="color-swatches"
      // O nome de **todas** as cores vai no rótulo da lista: o `+n` é resumo
      // visual, e quem usa leitor de tela não pode receber menos informação do que
      // quem vê a tela.
      aria-label={`Cores disponíveis: ${cores.map((cor) => cor.name).join(", ")}`}
    >
      {visiveis.map((cor) => (
        <li key={cor.name} className="flex items-center" title={cor.name}>
          <span
            aria-hidden="true"
            className="rv-card-dot"
            style={cor.hex ? { backgroundColor: cor.hex } : undefined}
          >
            {cor.hex ? null : cor.name.charAt(0).toUpperCase()}
          </span>
          <span className="sr-only">{cor.name}</span>
        </li>
      ))}

      {restantes > 0 && (
        <li className="rv-eyebrow rv-card-count" aria-hidden="true">
          +{restantes}
        </li>
      )}
    </ul>
  )
}
