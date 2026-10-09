/**
 * A avaliação de uma peça: a nota média e quantas pessoas a deram.
 * -------------------------------------------------------------------------
 * O redesenho desenha "★★★★★ 4.9 · 28 avaliações" acima do título. O Medusa **não
 * tem avaliação** — o que existe é o que a loja escreveu no `metadata` do produto,
 * o mesmo canal de `tag_status`, `care` e `hex`. É daí que este módulo lê.
 *
 * A regra mora aqui, e não dentro do componente, pelo mesmo motivo de
 * `product-availability.ts`: ela se testa sem renderizar nada (o vitest deste
 * pacote roda em `node`, sem DOM) e ela é uma só para o card e para a página da
 * peça — dois lugares que não podem discordar sobre a mesma peça.
 *
 * **Nada aqui inventa número.** Faltando a nota ou a contagem, a avaliação é
 * `null` e a tela não desenha o bloco: nota inventada é a loja afirmando o que
 * ninguém disse, e é a primeira coisa que a cliente confere depois de comprar.
 * Meia informação também não serve — estrelas sem "28 avaliações" não dizem se são
 * 28 ou 2.800.
 *
 * A entrada é um tipo **estrutural** (um `metadata`), e não `StoreProduct`: a
 * regra se testa com um objeto de uma linha, sem SDK e sem API.
 */

/** As chaves do `metadata` do produto. Nenhuma a mais é lida. */
export const CHAVE_AVALIACAO_MEDIA = "rating_media"
export const CHAVE_AVALIACAO_TOTAL = "rating_total"

/** A maior nota possível: cinco estrelas. */
export const NOTA_MAXIMA = 5

/** A avaliação de uma peça, já validada. */
export type AvaliacaoDaPeca = {
  /** A nota média, de 0 (exclusive) a 5. */
  media: number
  /** Quantas avaliações a sustentam — inteiro, de 1 para cima. */
  total: number
}

/**
 * Um número de uma chave do `metadata`, ou `null`.
 *
 * Aceita número e **texto numérico**, porque é assim que o dado chega: o painel
 * do Medusa grava `4.9` quando o campo é numérico e `"4,9"` quando alguém digita a
 * nota com a vírgula daqui. Recusar a segunda forma seria uma avaliação que existe
 * e não aparece — e o teste registra as duas.
 *
 * `null` para o resto: chave ausente, texto em branco, `NaN`, `Infinity` e o que
 * não for número nem texto (objeto, booleano, lista).
 */
export function numeroDoMetadata(
  metadata: Record<string, unknown> | null | undefined,
  chave: string
): number | null {
  const valor = metadata?.[chave]

  if (typeof valor === "number") {
    return Number.isFinite(valor) ? valor : null
  }

  if (typeof valor !== "string") {
    return null
  }

  const texto = valor.trim().replace(",", ".")

  if (texto === "") {
    return null
  }

  const numero = Number(texto)

  return Number.isFinite(numero) ? numero : null
}

/**
 * A avaliação a partir dos dois valores soltos, se ela for utilizável.
 *
 * As três recusas são de dado possível, e não teórico:
 *
 *   - **nota fora de 0–5**: campo trocado no painel. "7 de 5" na tela é pior do
 *     que bloco nenhum;
 *   - **nota zero**: `0` aqui significa "não há avaliação", e não "nota péssima" —
 *     quem tem avaliação tem pelo menos uma estrela;
 *   - **contagem não inteira ou menor que 1**: "28,5 avaliações" não existe, e uma
 *     contagem zerada é a mesma ausência da nota.
 */
export function avaliacaoValida(
  media: number | null | undefined,
  total: number | null | undefined
): AvaliacaoDaPeca | null {
  if (media === null || media === undefined || total === null || total === undefined) {
    return null
  }

  if (!Number.isFinite(media) || !Number.isFinite(total)) {
    return null
  }

  if (media <= 0 || media > NOTA_MAXIMA) {
    return null
  }

  if (!Number.isInteger(total) || total < 1) {
    return null
  }

  return { media, total }
}

/** A avaliação que o produto declara no `metadata`, se ela for utilizável. */
export function avaliacaoDoProduto(produto: {
  metadata?: Record<string, unknown> | null
}): AvaliacaoDaPeca | null {
  return avaliacaoValida(
    numeroDoMetadata(produto.metadata, CHAVE_AVALIACAO_MEDIA),
    numeroDoMetadata(produto.metadata, CHAVE_AVALIACAO_TOTAL)
  )
}

/**
 * Quantas das cinco estrelas vêm cheias.
 *
 * A nota é arredondada para a estrela mais próxima (4,9 → 5; 3,4 → 3) e o
 * resultado é limitado à faixa 0–5 — a mesma conta que qualquer vitrine faz, e a
 * única decisão de desenho que sobra numa média. O número exato quem diz é o
 * texto ao lado ("4,9"), e é por isso que ele não pode faltar.
 */
export function estrelasCheiasDaMedia(media: number): number {
  if (!Number.isFinite(media)) {
    return 0
  }

  return Math.min(NOTA_MAXIMA, Math.max(0, Math.round(media)))
}

/**
 * O texto ao lado das estrelas: "4,9 · 28 avaliações".
 *
 * A vírgula decimal é a do `pt-BR` — o mesmo `Intl` de `convertToLocale`, que já
 * corrigiu o ponto decimal herdado do starter na loja inteira. A referência
 * escreve "4.9 · 28 avaliações" com ponto porque é um protótipo em inglês.
 *
 * A concordância é do tamanho da lista: uma avaliação não é "1 avaliações".
 */
export function rotuloDaAvaliacao({ media, total }: AvaliacaoDaPeca): string {
  const nota = new Intl.NumberFormat("pt-BR", {
    minimumFractionDigits: 1,
    maximumFractionDigits: 1,
  }).format(media)

  return `${nota} · ${total} ${total === 1 ? "avaliação" : "avaliações"}`
}
