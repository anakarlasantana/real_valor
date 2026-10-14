/**
 * Os filtros do catálogo: quais existem, quanto cada um tem e o que excluem.
 * Faceta é regra, testável sem DOM sobre entrada estrutural (não `StoreProduct`);
 * valor e contagem saem do catálogo na tela, e faceta sem valor não é desenhada.
 */
import { convertToLocale } from "@lib/ui/money"
import {
  PRODUCT_STATUS_LABELS,
  productStatus,
  type ProductStatus,
} from "./product-availability"
import { coresDoProduto, normalizarTitulo } from "./product-enrichment"

/**
 * As cinco facetas, na ordem do painel: as chaves vão para a **URL**
 * (`?color=Preto&size=P`), em inglês (RV-004); os rótulos pt-BR ficam em
 * `TITULOS`, para mudar o texto do painel sem quebrar link compartilhado.
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

/** O título de uma faceta, para os **chips** (`filter-chips.ts`): eles nomeiam a
 * faceta ("Cor: Preto") mesmo quando a URL traz um valor que o catálogo não tem
 * mais e o painel não é desenhado. */
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

/** O que está marcado, por faceta. **É a URL, não um estado de tela**: um filtro
 * aplicado é um endereço — compartilhável, favoritável e desfeito pelo "voltar". */
export type SelecaoDoCatalogo = Partial<Record<ChaveDeFaceta, string[]>>

/** Os títulos que contam como "o tamanho da peça" (como `TITULOS_DE_COR`); a
 * comparação ignora caixa e acento. */
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

/** A ordem em que os tamanhos se leem, do menor (pp) ao maior (xgg) — sem ela
 * "G" viria antes de "M". O que não está na lista vai para o fim, em ordem
 * alfabética: a lista não conhece, não ordena nem esconde. */
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

/** O valor de uma faixa: "de-até", com as pontas vazias quando abertas (`-370`
 * = "até 370", `630-` = "acima de 630"). Números no endereço, e não um índice:
 * um índice dependeria da ordem das faixas, e uma peça nova mudaria a URL. */
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

/** Arredonda para N algarismos significativos: faz a fronteira parecer preço
 * (R$ 370, não R$ 370,72). Dois algarismos bastam para as três faixas não se
 * colarem num catálogo estreito (990 e 1.000, não 990 e 990). */
export function arredondarSignificativo(valor: number, digitos = 2): number {
  if (!Number.isFinite(valor) || valor === 0) {
    return valor
  }

  const magnitude = Math.floor(Math.log10(Math.abs(valor)))
  const fator = Math.pow(10, digitos - 1 - magnitude)

  return Math.round(valor * fator) / fator
}

/** As **três** faixas de preço saem dos preços que existem (terços entre o menor
 * e o maior), não de fronteiras fixas que apostam no catálogo alheio. A contagem
 * usa `precoNaFaixa`, o mesmo predicado que filtra. */
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

  /* Catálogo de preço único: uma faixa só, aberta nas duas pontas, com o preço no
     rótulo em vez de "até o infinito". */
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


/** Conta quantas peças cada valor tem — **uma vez por valor**, mesmo que o
 * catálogo repita (peça com "Preto" em cinco variantes é uma peça preta): o
 * número é "quantas peças você veria" na grade. */
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
 * As facetas de um conjunto de peças. A contagem sai do que os OUTROS filtros
 * deixaram (a faceta não conta a si mesma): "Preto" faz "P" cair para as peças P
 * pretas e "Preto" fica cheio — se a faceta se filtrasse, o valor marcado
 * apareceria com zero. Opção com zero peças continua na lista, desabilitada
 * ("existe, não neste recorte"); faceta sem nenhum valor não é desenhada.
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

  /** Os valores da faceta, com a contagem do recorte. A **lista sai do catálogo
   * inteiro** e só a contagem sai do recorte: se a lista saísse do recorte, um
   * filtro que não encontra nada apagaria as outras facetas, e a cliente ficaria
   * sem a caixa para desmarcar. */
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

    /* O valor marcado que **o catálogo não tem mais** (link compartilhado, peça
       fora do ar): entra com zero peças e o próprio valor como rótulo, senão o
       filtro seguiria aplicado (a URL diz isso) sem caixa para desmarcar. */
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

/** A seleção que a URL descreve. Cada faceta aceita a chave com vírgulas
 * (`?cor=Preto,Branco`) ou repetida (`?cor=Preto&cor=Branco`) — as duas são a
 * mesma coisa. Valor vazio é ausência: `?cor=` é um filtro limpo. */
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

/** O catálogo filtrado. **Entre facetas soma (E), dentro de uma faceta soma
 * (OU)**. Sem marcação, a lista volta **igual** (a mesma referência): a grade
 * sem filtro não paga pelo filtro. */
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



