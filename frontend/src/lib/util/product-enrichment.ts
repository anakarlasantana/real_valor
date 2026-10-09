/**
 * O enriquecimento da peça: cuidados, contraindicações, guia e cores.
 * -------------------------------------------------------------------------
 * Isto é o **tradutor** entre o que o painel grava e o que a tela desenha, e ele
 * existe por três razões medidas neste repositório:
 *
 *   1. **O dado bruto é hostil.** `metadata` é `Record<string, unknown>` — pode
 *      ter número, objeto, `null`, string vazia. A tela recebe `string | null` e
 *      decide desenhar ou não. Sem esta camada, cada componente repetiria o
 *      `typeof valor === "string"` e um deles esqueceria.
 *   2. **As cores não estão no `metadata`.** A lista vem da **opção** da peça
 *      (dado do Medusa) e o hex de `variant.metadata.hex`. Juntar as duas coisas
 *      é uma regra só, e ela tem teste aqui.
 *   3. **Hex inválido não é cor.** A chave pode conter qualquer texto (foi
 *      escrita à mão no painel do Medusa). O que não for `#RRGGBB` vira `null`,
 *      e a bolinha cai para o nome da cor — degradação, nunca bolinha preta.
 *
 * A entrada é um tipo **estrutural**, e não `StoreProduct`: o que se lê são dois
 * campos do produto, um da opção e um da variante, e declará-los aqui é o que
 * permite testar a regra com um objeto de quinze linhas — sem SDK, sem API e sem
 * `node_modules` do Medusa dentro do teste (a mesma escolha, pelo mesmo motivo,
 * de `product-availability.ts`).
 */
import type { ProductColor, ProductEnrichment } from "types/global"

/** O que este módulo lê do produto que a Store API devolve. */
export type ProdutoComEnriquecimento = {
  metadata?: Record<string, unknown> | null
  /**
   * As categorias da peça, na ordem em que o catálogo as devolve.
   *
   * A lista chega porque o `fields` do catálogo pede `*categories` — sem isso a
   * faceta "Categoria" do catálogo ficaria com um valor só (ver
   * `data/product-fields.ts`), e o eyebrow do card, que é a **mesma** leitura,
   * não teria de onde sair. Só o primeiro item é lido, como na página da peça.
   *
   * O item pode vir `null` na lista — é o que a Store API devolve quando a
   * relação não é expandida, e é o mesmo formato que `catalog-filters.ts` declara
   * em `ProdutoFiltravel`. O tipo aqui **não** é mais estreito do que o dado:
   * um item nulo é recusado na leitura de `categoriaDaPeca`, não pelo compilador.
   */
  categories?:
    | ({
        name?: string | null
        handle?: string | null
      } | null)[]
    | null
  options?:
    | {
        title?: string | null
        values?: { value?: string | null }[] | null
      }[]
    | null
  variants?:
    | {
        options?: { value?: string | null }[] | null
        metadata?: Record<string, unknown> | null
      }[]
    | null
}

/** As chaves do `metadata` do produto (seção 12.4). Nenhuma a mais é lida. */
export const CHAVE_CUIDADOS = "care"
export const CHAVE_CONTRAINDICACOES = "contraindications"
export const CHAVE_GUIA = "size_guide"

/**
 * Os títulos de opção que contam como "a cor da peça".
 *
 * O lojista digita o título da opção no painel, e ele pode estar em português ou
 * em inglês (o painel do Medusa é inglês por padrão e este projeto é pt-BR). A
 * comparação ignora caixa e acento, e **só** estes títulos contam: uma opção
 * chamada "Tamanho" nunca vira cor, e uma chamada "Cor" nunca deixa de ser —
 * adivinhar pelo conteúdo do `metadata` faria a mesma peça mudar de
 * comportamento quando a primeira variante ganhasse hex.
 */
export const TITULOS_DE_COR = ["cor", "cores", "color", "colour"]

/** Minúsculo, sem acento e sem espaço nas pontas — para comparar título. */
export function normalizarTitulo(valor: string): string {
  return valor
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim()
    .toLowerCase()
}

/**
 * Se o título de uma opção conta como "a cor da peça".
 *
 * É a mesma pergunta que o card faz (`coresDoProduto`) e que o seletor da página
 * da peça faz agora, para decidir se desenha **bolinhas** ou os botões de texto
 * de sempre. Uma função, e não a lista comparada em dois lugares: no dia em que
 * um terceiro título contar como cor, a mudança tem de valer para os dois — e o
 * card e a página não podem discordar sobre a mesma peça.
 *
 * `null`/`undefined` (opção sem título, que o Medusa permite) não é cor.
 */
export function ehTituloDeCor(titulo: string | null | undefined): boolean {
  return TITULOS_DE_COR.includes(normalizarTitulo(titulo ?? ""))
}

/**
 * O texto de uma chave de `metadata`, já aparado.
 *
 * `null` para: chave ausente, valor que não é texto e texto em branco. Os três
 * significam a mesma coisa para quem desenha a página — "não há o que mostrar" —
 * e é por isso que os três saem iguais daqui.
 */
export function textoDoMetadata(
  metadata: Record<string, unknown> | null | undefined,
  chave: string
): string | null {
  const valor = metadata?.[chave]

  if (typeof valor !== "string") {
    return null
  }

  const texto = valor.trim()

  return texto === "" ? null : texto
}

/** O hex da variante, se ele for `#RRGGBB`. Qualquer outro valor vira `null`. */
export function hexDoMetadata(
  metadata: Record<string, unknown> | null | undefined
): string | null {
  const valor = textoDoMetadata(metadata, "hex")

  if (valor === null) {
    return null
  }

  return /^#[0-9a-fA-F]{6}$/.test(valor) ? valor : null
}

/**
 * As cores da peça, na ordem em que o lojista as cadastrou.
 *
 * A lista sai do **valor da opção** (é o que existe mesmo sem hex), e o hex é
 * procurado na primeira variante que tenha aquele valor. Por isso a mesma cor em
 * três tamanhos aparece **uma vez**: o card mostra cores, e não combinações.
 *
 * Devolve `[]` — e não `undefined` — quando não há opção de cor: quem desenha não
 * precisa de dois caminhos para "não tem cor".
 */
export function coresDoProduto(
  produto: ProdutoComEnriquecimento
): ProductColor[] {
  const opcao = (produto.options ?? []).find((candidata) =>
    ehTituloDeCor(candidata.title)
  )

  if (!opcao) {
    return []
  }

  const cores: ProductColor[] = []
  const vistas = new Set<string>()

  for (const valor of opcao.values ?? []) {
    const nome = (valor.value ?? "").trim()

    if (nome === "" || vistas.has(nome)) {
      continue
    }

    vistas.add(nome)
    cores.push({ name: nome, hex: hexDaCor(produto, nome) })
  }

  return cores
}

/**
 * O hex cadastrado para uma cor, na primeira variante que a tenha.
 *
 * Casa por **valor** e não por `option_id`: o que interessa é "a variante desta
 * cor", e a variante da cor x tamanho M serve tão bem quanto a P. Um id a mais na
 * comparação só criaria um jeito novo de não casar quando o campo faltasse.
 */
function hexDaCor(
  produto: ProdutoComEnriquecimento,
  nome: string
): string | null {
  for (const variante of produto.variants ?? []) {
    const temACor = (variante.options ?? []).some(
      (opcao) => (opcao.value ?? "").trim() === nome
    )

    if (!temACor) {
      continue
    }

    const hex = hexDoMetadata(variante.metadata)

    // A primeira variante da cor pode não ter hex (o lojista cadastrou os
    // tamanhos e enriqueceu só um): continua procurando nas outras antes de
    // desistir.
    if (hex !== null) {
      return hex
    }
  }

  return null
}

/**
 * Quantas bolinhas o card mostra antes de resumir o resto em "+n".
 *
 * Cinco cabe numa linha de card de celular sem empurrar o preço; a partir daí o
 * que informa não é a cor em si, é a **quantidade** de opções — e essa o `+n` diz
 * mais rápido e sem quebrar a linha.
 */
export const MAX_BOLINHAS_NO_CARD = 5

export type BolinhasDoCard = {
  visiveis: ProductColor[]
  restantes: number
}

/**
 * O corte da lista de cores para o card.
 *
 * Mora aqui, e não no componente, porque é regra: o componente só desenha o que
 * estas duas listas dizem — e é isso que faz o `+3` bater com o que ficou de fora
 * (contar de novo na tela é como o número mente).
 */
export function bolinhasDoCard(
  cores: ProductColor[],
  maximo: number = MAX_BOLINHAS_NO_CARD
): BolinhasDoCard {
  if (cores.length <= maximo) {
    return { visiveis: cores, restantes: 0 }
  }

  return { visiveis: cores.slice(0, maximo), restantes: cores.length - maximo }
}

/**
 * A categoria da peça — o rótulo que o card escreve acima do nome.
 * -------------------------------------------------------------------------
 * A leitura é a **mesma** da página da peça (`product-info/index.tsx`, o
 * caminho de volta do breadcrumb): a primeira categoria da lista, e o rótulo é
 * o nome, com o `handle` como reserva. O que muda entre os dois é só o destino:
 * lá o rótulo é um link para a categoria, aqui é **texto** — o card inteiro já é
 * um link, e um `<a>` dentro de `<a>` é HTML inválido (o navegador desfaz o de
 * dentro e o mesmo toque passa a ter dois destinos conforme o pixel). É o mesmo
 * motivo pelo qual as bolinhas de cor não são clicáveis; ver
 * `product-preview/color-swatches.tsx`.
 *
 * `null` quando não há categoria utilizável, e as recusas são de dado real: sem
 * lista, lista vazia, ou item sem nome **e** sem handle. Categoria sem nome é
 * dado pela metade no painel — e um `handle` cru (`blusas-e-camisas`) na tela é
 * melhor do que nada, porque é o que a cliente clicou para chegar aqui. Espaço
 * em branco não passa: `"   "` não é um rótulo, é um campo que alguém esvaziou,
 * e reservar linha para ele empurraria o nome da peça para baixo em todo card.
 */
export function categoriaDaPeca(
  produto: ProdutoComEnriquecimento
): string | null {
  const primeira = produto.categories?.[0]

  if (!primeira) {
    return null
  }

  for (const candidato of [primeira.name, primeira.handle]) {
    const texto = candidato?.trim()

    if (texto) {
      return texto
    }
  }

  return null
}

/**
 * Tudo o que a página e o card leem do enriquecimento, numa leitura só.
 *
 * Sem valor padrão: o que o lojista não preencheu é `null`, e quem desenha decide
 * se a seção existe. Texto inventado ("Consulte a etiqueta") seria a loja
 * afirmando o que ninguém escreveu.
 */
export function enriquecimentoDoProduto(
  produto: ProdutoComEnriquecimento
): ProductEnrichment {
  return {
    care: textoDoMetadata(produto.metadata, CHAVE_CUIDADOS),
    contraindications: textoDoMetadata(
      produto.metadata,
      CHAVE_CONTRAINDICACOES
    ),
    sizeGuide: textoDoMetadata(produto.metadata, CHAVE_GUIA),
    colors: coresDoProduto(produto),
  }
}
