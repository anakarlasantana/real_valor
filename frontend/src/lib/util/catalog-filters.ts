/**
 * Os filtros do catálogo: quais existem, quanto cada um tem e o que excluem.
 * -------------------------------------------------------------------------
 * O catálogo era uma grade com um seletor de ordem ao lado. O redesenho pede
 * cinco facetas — categoria, tamanho, cor, faixa de preço e disponibilidade —, e
 * **faceta é regra**: o que conta como "tamanho de uma peça", quantas peças cada
 * valor tem, qual peça cada faixa de preço inclui e como duas facetas se somam.
 * Regra mora aqui, e não dentro do componente, pelo mesmo motivo que
 * `product-availability.ts` e `product-enrichment.ts`: ela se testa sem
 * renderizar nada (o vitest deste pacote roda em `node`, sem DOM).
 *
 * A entrada é um tipo **estrutural**, e não `StoreProduct`: são quatro campos, e
 * declará-los aqui é o que permite testar a regra com um objeto de dez linhas.
 *
 * O QUE NÃO FOI PORTADO DA REFERÊNCIA, E POR QUÊ
 * -------------------------------------------------------------------------
 * A referência desenha as facetas com **valores de mentira** e contagens fixas
 * ("Alfaiataria (3)", "PP (4)"), e repete a mesma lista em todos os acordeões.
 * Aqui cada valor e cada contagem saem do catálogo que está na tela, e uma faceta
 * sem nenhum valor **não é desenhada** — um acordeão "Cor" que abre em nada é
 * pior do que não existir.
 *
 * E há uma consequência do catálogo real que vale escrever, porque é visível: os
 * tamanhos saem da opção cujo título é "Tamanho" (a mesma regra declarada de
 * `product-enrichment.ts`, que não adivinha pelo conteúdo), então a peça cujos
 * tamanhos foram cadastrados **como opções separadas** não aparece em "Tamanho"
 * nenhum. A faceta diz o que o catálogo diz — não o que ele deveria dizer.
 */
import { convertToLocale } from "./money"
import {
  PRODUCT_STATUS_LABELS,
  productStatus,
  type ProductStatus,
} from "./product-availability"
import { coresDoProduto, normalizarTitulo } from "./product-enrichment"

/**
 * As cinco facetas, na ordem em que o painel as mostra.
 *
 * As chaves são as que vão para a **URL** (`?color=Preto&size=P`), em inglês,
 * como o resto dos endereços da loja (`/store`, `/search`, `sortBy`, `page`) e
 * como o requisito RV-004 as escreve. Os rótulos que a cliente lê são em pt-BR,
 * em `TITULOS` — separar as duas coisas é o que permite mudar o texto do painel
 * sem quebrar um link compartilhado.
 */
export type ChaveDeFaceta =
  | "category"
  | "size"
  | "color"
  | "price"
  | "availability"

export const CHAVES_DE_FACETA: ChaveDeFaceta[] = [
  "category",
  "size",
  "color",
  "price",
  "availability",
]

const TITULOS: Record<ChaveDeFaceta, string> = {
  category: "Categoria",
  size: "Tamanho",
  color: "Cor",
  price: "Faixa de preço",
  availability: "Disponibilidade",
}

/**
 * O título de uma faceta, pelo lado de fora do painel.
 *
 * Existe para os **chips dos filtros aplicados** (`filter-chips.ts`): eles nomeiam
 * a faceta ("Cor: Preto") e não podem depender de a faceta ter sido desenhada — a
 * URL pode nomear um valor que o catálogo não tem mais, e o painel, nesse caso,
 * não existe. Um título por chave, e um lugar só.
 */
export function tituloDaFaceta(chave: ChaveDeFaceta): string {
  return TITULOS[chave]
}

/** Um valor marcado, com o que ele mostra e quantas peças ele tem. */
export type OpcaoDeFaceta = {
  value: string
  label: string
  count: number
}

export type Faceta = {
  key: ChaveDeFaceta
  title: string
  options: OpcaoDeFaceta[]
}

/**
 * O que está marcado, por faceta. **É a URL, não um estado de tela**: um filtro
 * aplicado é um endereço — compartilhável, favoritável e desfeito pelo botão
 * "voltar" do navegador, uma marcação por vez.
 */
export type SelecaoDoCatalogo = Partial<Record<ChaveDeFaceta, string[]>>

/**
 * Os títulos de opção que contam como "o tamanho da peça", no mesmo espírito de
 * `TITULOS_DE_COR`. A comparação ignora caixa e acento.
 */
export const TITULOS_DE_TAMANHO = ["tamanho", "tamanhos", "size", "sizes"]

/** Se o título de uma opção conta como tamanho. `null` (opção sem título) não. */
export function ehTituloDeTamanho(titulo: string | null | undefined): boolean {
  if (typeof titulo !== "string") {
    return false
  }

  return TITULOS_DE_TAMANHO.includes(normalizarTitulo(titulo))
}

/** O que este módulo lê do produto que a Store API devolve. */
export type ProdutoFiltravel = {
  categories?: ({ name?: string | null; handle?: string | null } | null)[] | null
  options?: {
    title?: string | null
    values?: { value?: string | null }[] | null
  }[] | null
  variants?: {
    options?: { value?: string | null }[] | null
    metadata?: Record<string, unknown> | null
    inventory_quantity?: number | null
    allow_backorder?: boolean | null
    manage_inventory?: boolean | null
    calculated_price?: { calculated_amount?: number | null } | null
  }[] | null
  metadata?: Record<string, unknown> | null
  tags?: ({ value?: string | null } | null)[] | null
}

/** Um valor com o rótulo que o representa — o par que vira uma opção de faceta. */
type ChaveDeValor = { value: string; label: string }

/* --- Leitura do produto ------------------------------------------------- */

/** As categorias da peça, pelo `handle` (valor) e pelo nome (rótulo). */
function categoriasDaPeca(produto: ProdutoFiltravel): ChaveDeValor[] {
  return (produto.categories ?? []).flatMap((categoria) => {
    const handle = (categoria?.handle ?? "").trim()
    const nome = (categoria?.name ?? "").trim()

    return handle === ""
      ? []
      : [{ value: handle, label: nome === "" ? handle : nome }]
  })
}

/** Os tamanhos declarados na opção de tamanho. */
function tamanhosDaPeca(produto: ProdutoFiltravel): ChaveDeValor[] {
  const opcoes = (produto.options ?? []).filter((opcao) =>
    ehTituloDeTamanho(opcao.title)
  )

  return opcoes.flatMap((opcao) =>
    (opcao.values ?? []).flatMap((valor) => {
      const tamanho = (valor.value ?? "").trim()

      return tamanho === "" ? [] : [{ value: tamanho, label: tamanho }]
    })
  )
}

/** As cores da peça — as mesmas que o card desenha como bolinhas. */
function coresDaPeca(produto: ProdutoFiltravel): ChaveDeValor[] {
  return coresDoProduto(produto).map((cor) => ({
    value: cor.name,
    label: cor.name,
  }))
}

/** Todo preço calculado da peça, em número. Preço ausente não vira zero. */
function precosDaPeca(produto: ProdutoFiltravel): number[] {
  return (produto.variants ?? []).flatMap((variante) => {
    const preco = variante?.calculated_price?.calculated_amount

    return typeof preco === "number" && Number.isFinite(preco) ? [preco] : []
  })
}

/** O menor preço da peça, ou `null` quando a região não tem preço para ela. */
export function menorPrecoDaPeca(produto: ProdutoFiltravel): number | null {
  const precos = precosDaPeca(produto)

  return precos.length === 0 ? null : Math.min(...precos)
}

/* --- Ordem dos valores -------------------------------------------------- */

/**
 * A ordem em que os tamanhos se leem numa arruela de roupas: do menor para o
 * maior. Sem esta lista, "G" viria antes de "M" (ordem alfabética), e a faceta
 * seria a única parte da loja a sugerir que G é menor do que M.
 *
 * Tamanho que não está na lista (a numeração "38 (P)") não é jogado fora: ele vai
 * para o fim, em ordem alfabética, ao lado dos outros que também não estão — o
 * que a lista não conhece, ela não ordena nem esconde.
 */
const ORDEM_DE_TAMANHO = ["pp", "p", "m", "g", "gg", "xgg", "u"]

/** A ordem em que os estados da peça se leem: do mais disponível ao menos. */
const ORDEM_DE_DISPONIBILIDADE: ProductStatus[] = [
  "pronta-entrega",
  "ultimas",
  "sob-demanda",
  "esgotado",
]

function porRotulo(a: OpcaoDeFaceta, b: OpcaoDeFaceta): number {
  return a.label.localeCompare(b.label, "pt-BR")
}

function porTamanho(a: OpcaoDeFaceta, b: OpcaoDeFaceta): number {
  const posicaoA = ORDEM_DE_TAMANHO.indexOf(normalizarTitulo(a.label))
  const posicaoB = ORDEM_DE_TAMANHO.indexOf(normalizarTitulo(b.label))

  if (posicaoA === -1 && posicaoB === -1) {
    return porRotulo(a, b)
  }

  if (posicaoA === -1) {
    return 1
  }

  if (posicaoB === -1) {
    return -1
  }

  return posicaoA - posicaoB
}

/* --- Faixa de preço ----------------------------------------------------- */

/**
 * O valor de uma faixa: "de-até", com as pontas vazias quando são abertas.
 *
 * `-370` é "até R$ 370", `370-630` é "de 370 a 630" e `630-` é "acima de 630".
 * Números no endereço, e não um índice ("preco=1"), porque um índice depende da
 * ordem em que as faixas foram geradas: bastaria uma peça nova para a mesma URL
 * passar a mostrar outra faixa.
 */
function faixa(minimo: string, maximo: string): string {
  return `${minimo}-${maximo}`
}

/** O preço está dentro de uma faixa? O teto é exclusivo; a última faixa é aberta. */
export function precoNaFaixa(preco: number | null, valor: string): boolean {
  if (preco === null) {
    return false
  }

  const [de, ate] = valor.split("-")

  const minimo = de === undefined || de === "" ? -Infinity : Number(de)
  const maximo = ate === undefined || ate === "" ? Infinity : Number(ate)

  if (Number.isNaN(minimo) || Number.isNaN(maximo)) {
    return false
  }

  return preco >= minimo && preco < maximo
}

/**
 * Arredonda para N algarismos significativos.
 *
 * É o que faz uma fronteira de faixa parecer preço em vez de conta: R$ 370,72 não
 * se lê, R$ 370 sim. Dois algarismos é a precisão que basta para as três faixas
 * não se colarem num catálogo de faixa estreita (R$ 990 a R$ 1.010 vira 990 e
 * 1.000, e não 990 e 990).
 */
export function arredondarSignificativo(valor: number, digitos = 2): number {
  if (!Number.isFinite(valor) || valor === 0) {
    return valor
  }

  const magnitude = Math.floor(Math.log10(Math.abs(valor)))
  const fator = Math.pow(10, digitos - 1 - magnitude)

  return Math.round(valor * fator) / fator
}

/**
 * As faixas de preço do catálogo que está na tela: **três**, tiradas dos preços
 * que existem.
 *
 * Faixa fixa ("até R$ 300", "R$ 300 a R$ 600") é uma aposta no catálogo alheio:
 * numa loja de vestidos as três faixas ficariam na primeira, e numa de casacos a
 * primeira ficaria vazia. As fronteiras saem do próprio conjunto — terços da
 * distância entre o menor e o maior preço —, então o filtro é útil em qualquer
 * catálogo, e continua útil quando os preços mudam.
 *
 * A contagem de cada faixa usa `precoNaFaixa`, o mesmo predicado que filtra: o
 * número ao lado de uma faixa não pode discordar do que a faixa devolve.
 */
export function faixasDePreco(
  produtos: ProdutoFiltravel[],
  currencyCode: string
): OpcaoDeFaceta[] {
  const precos = produtos.flatMap(precosDaPeca)

  if (precos.length === 0) {
    return []
  }

  const menor = Math.min(...precos)
  const maior = Math.max(...precos)

  const dinheiro = (valor: number) =>
    convertToLocale({ amount: valor, currency_code: currencyCode })

  const corte1 = arredondarSignificativo(menor + (maior - menor) / 3)
  const corte2 = arredondarSignificativo(menor + (2 * (maior - menor)) / 3)

  /*
   * Catálogo de preço único: não há o que partir. A faixa é uma só, aberta nas
   * duas pontas (o valor `-`, que casa com qualquer preço), e o rótulo diz o
   * preço em vez de dizer "até o infinito" — que é o que a fórmula genérica
   * escreveria aqui.
   */
  if (menor === maior) {
    return [
      {
        value: faixa("", ""),
        label: dinheiro(menor),
        count: produtos.filter((produto) => menorPrecoDaPeca(produto) !== null)
          .length,
      },
    ]
  }

  const valores = [
    faixa("", String(corte1)),
    faixa(String(corte1), String(corte2)),
    faixa(String(corte2), ""),
  ]

  return valores.map((valor) => {
    const [de, ate] = valor.split("-")
    const comeco = de === undefined || de === "" ? -Infinity : Number(de)
    const fim = ate === undefined || ate === "" ? Infinity : Number(ate)

    const label =
      comeco === -Infinity
        ? `Até ${dinheiro(fim)}`
        : fim === Infinity
          ? `Acima de ${dinheiro(comeco)}`
          : `${dinheiro(comeco)} a ${dinheiro(fim)}`

    return {
      value: valor,
      label,
      count: produtos.filter((produto) =>
        precoNaFaixa(menorPrecoDaPeca(produto), valor)
      ).length,
    }
  })
}


/* --- Contagem ----------------------------------------------------------- */


/**
 * Conta quantas peças cada valor tem.
 *
 * **Uma peça conta uma vez por valor**, mesmo que o catálogo repita o valor (uma
 * peça com a cor "Preto" em cinco variantes é uma peça preta, não cinco): o
 * número ao lado do valor é "quantas peças você veria", e é o que a cliente
 * compara com a grade depois de filtrar.
 */
function contar(
  produtos: ProdutoFiltravel[],
  extrair: (produto: ProdutoFiltravel) => ChaveDeValor[],
  ordenar: (a: OpcaoDeFaceta, b: OpcaoDeFaceta) => number
): OpcaoDeFaceta[] {
  const contagem = new Map<string, OpcaoDeFaceta>()

  for (const produto of produtos) {
    const vistas = new Set<string>()

    for (const { value, label } of extrair(produto)) {
      if (value === "" || vistas.has(value)) {
        continue
      }

      vistas.add(value)

      const atual = contagem.get(value)

      if (atual) {
        atual.count += 1
      } else {
        contagem.set(value, { value, label, count: 1 })
      }
    }
  }

  return Array.from(contagem.values()).sort(ordenar)
}

/* --- Montagem das facetas ---------------------------------------------- */

export type OpcoesDeFacetas = {
  currencyCode: string
  selecao?: SelecaoDoCatalogo
}

/** A ordem da disponibilidade, para `contar` — do mais disponível ao menos. */
function porDisponibilidade(a: OpcaoDeFaceta, b: OpcaoDeFaceta): number {
  return (
    ORDEM_DE_DISPONIBILIDADE.indexOf(a.value as ProductStatus) -
    ORDEM_DE_DISPONIBILIDADE.indexOf(b.value as ProductStatus)
  )
}

/**
 * As facetas de um conjunto de peças.
 *
 * **A contagem de cada faceta é feita sobre o que os OUTROS filtros deixaram** —
 * a faceta não conta a si mesma. Marcar "Preto" faz a contagem de "P" cair para
 * as peças P pretas, que é a pergunta que a cliente está fazendo naquele instante
 * ("tem P nesse preto?"); e a contagem de "Preto" continua cheia, porque é a
 * lista em que ela acabou de mexer — se ela mesma se filtrasse, o valor marcado
 * apareceria com zero e o filtro pareceria quebrado no mesmo clique em que foi
 * aplicado.
 *
 * **Uma opção com zero peças continua na lista, desabilitada** (o desenho é do
 * painel: o `input` nasce `disabled`). Esconder o valor faria a cliente acreditar
 * que a loja não tem "GG" — quando o que aconteceu é que não tem GG **naquela
 * combinação**. Sumindo, a informação de que existe GG se perde; desabilitado,
 * ela vira a resposta: "existe, não neste recorte".
 *
 * Uma faceta sem nenhum valor (nenhuma peça do catálogo declara tamanho, por
 * exemplo) **não é desenhada**: não há o que mostrar nem o que desabilitar, e um
 * acordeão vazio só ocupa a barra lateral.
 */
export function construirFacetas(
  produtos: ProdutoFiltravel[],
  { currencyCode, selecao }: OpcoesDeFacetas
): Faceta[] {
  const marcados = (chave: ChaveDeFaceta) => new Set(selecao?.[chave] ?? [])

  /** O catálogo como ele fica com todos os filtros **exceto** o desta faceta. */
  const semAFaceta = (chave: ChaveDeFaceta) => {
    const outras: SelecaoDoCatalogo = { ...selecao }
    delete outras[chave]

    return filtrarProdutos(produtos, outras)
  }

  const statusDaPeca = (produto: ProdutoFiltravel): ChaveDeValor[] => {
    const status = productStatus(produto)

    return [{ value: status, label: PRODUCT_STATUS_LABELS[status] }]
  }

  /**
   * Os valores da faceta, com a contagem do recorte.
   *
   * A **lista de valores sai do catálogo inteiro** e só a contagem sai do recorte:
   * os dois papéis são diferentes. Se a lista também saísse do recorte, marcar um
   * filtro que não encontra nada apagaria as outras facetas da tela — e a cliente
   * ficaria sem a caixa para desmarcar o que acabou de marcar. Com a lista
   * inteira, o valor que a combinação não alcança aparece com zero e desabilitado,
   * que é a resposta, e não a ausência dela.
   */
  const facetar = (
    base: ProdutoFiltravel[],
    extrair: (produto: ProdutoFiltravel) => ChaveDeValor[],
    ordenar: (a: OpcaoDeFaceta, b: OpcaoDeFaceta) => number
  ): OpcaoDeFaceta[] => {
    const universo = contar(produtos, extrair, ordenar)
    const contagens = new Map(
      contar(base, extrair, ordenar).map((opcao) => [opcao.value, opcao.count])
    )

    return universo.map((opcao) => ({
      ...opcao,
      count: contagens.get(opcao.value) ?? 0,
    }))
  }

  /** As faixas de preço: fronteiras do catálogo, contagem do recorte. */
  const faixas = (base: ProdutoFiltravel[]): OpcaoDeFaceta[] =>
    faixasDePreco(produtos, currencyCode).map((opcao) => ({
      ...opcao,
      count: base.filter((produto) =>
        precoNaFaixa(menorPrecoDaPeca(produto), opcao.value)
      ).length,
    }))

  const candidatas: Faceta[] = [
    {
      key: "category",
      title: TITULOS.category,
      options: facetar(semAFaceta("category"), categoriasDaPeca, porRotulo),
    },
    {
      key: "size",
      title: TITULOS.size,
      options: facetar(semAFaceta("size"), tamanhosDaPeca, porTamanho),
    },
    {
      key: "color",
      title: TITULOS.color,
      options: facetar(semAFaceta("color"), coresDaPeca, porRotulo),
    },
    {
      key: "price",
      title: TITULOS.price,
      options: faixas(semAFaceta("price")),
    },
    {
      key: "availability",
      title: TITULOS.availability,
      options: facetar(
        semAFaceta("availability"),
        statusDaPeca,
        porDisponibilidade
      ),
    },
  ]

  return candidatas.flatMap((faceta) => {
    const selecionados = marcados(faceta.key)

    /*
     * O valor marcado que **o catálogo não tem mais** — um link compartilhado
     * cuja peça saiu do ar, ou um endereço escrito à mão. Ele entra na lista com
     * zero peças e o próprio valor como rótulo: sem ele, o filtro continuaria
     * aplicado (a URL diz isso) e não haveria caixa para desmarcar. O rótulo
     * feio, no caso da faixa de preço, é o preço honesto de não ter um nome
     * melhor para uma faixa que não existe mais.
     */
    const presentes = new Set(faceta.options.map((opcao) => opcao.value))

    const ausentes = Array.from(selecionados)
      .filter((valor) => !presentes.has(valor))
      .map((valor) => ({ value: valor, label: valor, count: 0 }))

    const options = [...faceta.options, ...ausentes]

    return options.length === 0 ? [] : [{ ...faceta, options }]
  })
}

/* --- Seleção ------------------------------------------------------------ */

/** Lê um parâmetro, aceitando `URLSearchParams` e o `searchParams` do Next. */
function lerParametro(
  input: URLSearchParams | Record<string, string | string[] | undefined>,
  chave: string
): string[] {
  if (input instanceof URLSearchParams) {
    return input.getAll(chave)
  }

  const valor = input[chave]

  if (valor === undefined) {
    return []
  }

  return Array.isArray(valor) ? valor : [valor]
}

/**
 * A seleção que a URL descreve.
 *
 * Cada faceta aceita **uma chave com valores separados por vírgula**
 * (`?cor=Preto,Branco`) e também a chave repetida (`?cor=Preto&cor=Branco`): as
 * duas formas aparecem em links escritos à mão, e as duas são a mesma coisa.
 * Valor vazio é ausência — `?cor=` é um filtro limpo, não um valor em branco.
 */
export function selecaoDaUrl(
  input: URLSearchParams | Record<string, string | string[] | undefined>
): SelecaoDoCatalogo {
  const selecao: SelecaoDoCatalogo = {}

  for (const chave of CHAVES_DE_FACETA) {
    const valores = Array.from(
      new Set(
        lerParametro(input, chave)
          .flatMap((valor) => valor.split(","))
          .map((valor) => valor.trim())
          .filter((valor) => valor !== "")
      )
    )

    if (valores.length > 0) {
      selecao[chave] = valores
    }
  }

  return selecao
}

/** Há marcação ativa? É o que decide entre "a grade" e "a grade filtrada". */
export function temSelecao(selecao: SelecaoDoCatalogo): boolean {
  return CHAVES_DE_FACETA.some((chave) => (selecao[chave]?.length ?? 0) > 0)
}

/* --- Filtro ------------------------------------------------------------- */

/** A peça atende a **esta** faceta? Dentro de uma faceta, os valores somam (OU). */
function atende(
  produto: ProdutoFiltravel,
  chave: ChaveDeFaceta,
  valores: string[]
): boolean {
  switch (chave) {
    case "category":
      return valores.some((valor) =>
        categoriasDaPeca(produto).some((categoria) => categoria.value === valor)
      )
    case "size":
      return valores.some((valor) =>
        tamanhosDaPeca(produto).some((tamanho) => tamanho.value === valor)
      )
    case "color":
      return valores.some((valor) =>
        coresDaPeca(produto).some((cor) => cor.value === valor)
      )
    case "availability":
      return valores.includes(productStatus(produto))
    case "price":
      return valores.some((valor) =>
        precoNaFaixa(menorPrecoDaPeca(produto), valor)
      )
  }
}

/**
 * O catálogo filtrado.
 *
 * **Entre facetas soma (E), dentro de uma faceta soma (OU)** — a única leitura
 * que não surpreende: "Alfaiataria **e** tamanho M" é o que a cliente pediu, e
 * "M **ou** G" também é.
 *
 * Sem marcação nenhuma, a lista volta **igual** (a mesma referência, e não uma
 * cópia): a grade sem filtro não paga pelo filtro.
 */
export function filtrarProdutos<T extends ProdutoFiltravel>(
  produtos: T[],
  selecao: SelecaoDoCatalogo
): T[] {
  const ativas = CHAVES_DE_FACETA.filter(
    (chave) => (selecao[chave]?.length ?? 0) > 0
  )

  if (ativas.length === 0) {
    return produtos
  }

  return produtos.filter((produto) =>
    ativas.every((chave) => atende(produto, chave, selecao[chave]!))
  )
}



