/**
 * O estado de uma peça na loja: pronta entrega, sob demanda, últimas ou esgotado.
 *
 * A decisão mora aqui porque o card e a página do produto precisam concordar, e a
 * precedência (estoque antes do rótulo) é regra — e regra se testa sem renderizar.
 */

/** Os quatro estados possíveis — e nenhum a mais. */
export type ProductStatus =
  | "pronta-entrega"
  | "sob-demanda"
  | "ultimas"
  | "esgotado"

/**
 * O que a peça mostra no chip.
 *
 * `ultimas` é o único que fala de quantidade ("últimas **peças**", plural) e
 * não de prazo: o número exato a loja não mostra — 2 unidades anunciadas são um
 * convite a esperar por 1, e o card fica com cara de liquidação.
 */
export const PRODUCT_STATUS_LABELS: Record<ProductStatus, string> = {
  "pronta-entrega": "Pronta entrega",
  "sob-demanda": "Sob demanda",
  ultimas: "Últimas peças",
  esgotado: "Esgotado",
}

/**
 * Quantas peças compráveis ainda são "poucas".
 *
 * Três é o número em que a decisão de compra ainda é a tempo: o chip avisa que
 * acaba, sem virar urgência artificial.
 */
export const LAST_UNITS_THRESHOLD = 3

/**
 * Os rótulos que o lojista escreve — em `metadata.tag_status` ou numa tag —
 * traduzidos para o estado.
 *
 * As chaves são o rótulo **normalizado**: minúsculas, sem acento, com espaço
 * único. Rótulo fora desta lista não é erro e não inventa estado: ele cai para
 * a tag, e da tag para o estoque.
 */
const STATUS_BY_LABEL: Record<string, ProductStatus> = {
  "pronta entrega": "pronta-entrega",
  "pronta para envio": "pronta-entrega",
  "em estoque": "pronta-entrega",
  "sob demanda": "sob-demanda",
  "sob encomenda": "sob-demanda",
  "feito sob encomenda": "sob-demanda",
  ultima: "ultimas",
  ultimas: "ultimas",
  "ultima peca": "ultimas",
  "ultimas pecas": "ultimas",
  "ultimas unidades": "ultimas",
  esgotado: "esgotado",
  esgotada: "esgotado",
  "sem estoque": "esgotado",
}

/** O mínimo de um variant que a decisão de estoque lê. */
export type VariantLike = {
  manage_inventory?: boolean | null
  allow_backorder?: boolean | null
  inventory_quantity?: number | null
}

/** O mínimo de um produto que a decisão de estado lê. */
export type AvailabilityProduct = {
  metadata?: Record<string, unknown> | null
  tags?: ({ value?: string | null } | null)[] | null
  variants?: (VariantLike | null)[] | null
}

/**
 * Texto → chave da tabela: sem acento, minúsculo, com espaço único.
 *
 * `NFD` separa a letra do acento e a faixa seguinte apaga os acentos soltos,
 * então "Últimas Peças" e "ultimas pecas" viram a mesma chave. `_` e `-` viram
 * espaço porque os três aparecem escritos à mão numa planilha de catálogo, e a
 * diferença entre eles não é informação.
 */
export function normalizeStatusLabel(value: unknown): string {
  if (typeof value !== "string") {
    return ""
  }

  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[_-]+/g, " ")
    .replace(/\s+/g, " ")
    .trim()
}

/** O estado de um rótulo solto, ou `undefined` se a loja não o conhece. */
export function statusFromLabel(value: unknown): ProductStatus | undefined {
  return STATUS_BY_LABEL[normalizeStatusLabel(value)]
}

/**
 * O variant pode ser comprado?
 *
 * É a regra da página do produto, **extraída de lá** (ela vivia dentro de um
 * `useMemo` do `product-actions`): não controlar estoque é poder comprar; aceitar
 * encomenda é poder comprar; ter estoque é poder comprar; o resto não.
 *
 * Estar aqui, e não copiada em dois arquivos, é o que impede o card e a página
 * de discordarem — o `product-actions` importa esta função desde então.
 */
export function variantIsAvailable(variant?: VariantLike | null): boolean {
  if (!variant) {
    return false
  }

  // Sem controle de estoque não há o que esgotar.
  if (!variant.manage_inventory) {
    return true
  }

  // Controla estoque e aceita encomenda: a peça é feita depois da compra.
  if (variant.allow_backorder) {
    return true
  }

  return (variant.inventory_quantity ?? 0) > 0
}

export function opcoesDaVariante(
  variantOptions:
    | { option_id?: string | null; value?: string | null }[]
    | null
    | undefined
): Record<string, string> {
  const mapa: Record<string, string> = {}

  for (const opcao of variantOptions ?? []) {
    if (opcao?.option_id) {
      mapa[opcao.option_id] = opcao.value ?? ""
    }
  }

  return mapa
}

export type VarianteEscolhivel = VariantLike & {
  id?: string | null
  options?: { option_id?: string | null; value?: string | null }[] | null
}

export type EscolhaInicial = {
  options: Record<string, string>
  variant: VarianteEscolhivel
}
/** `v_id` da URL, senão a primeira comprável, senão a primeira (RV-030). */
export function escolhaInicial(
  variants: (VarianteEscolhivel | null)[] | null | undefined,
  variantId?: string | null
): EscolhaInicial | null {
  const lista = (variants ?? []).filter(
    (variante): variante is VarianteEscolhivel => Boolean(variante)
  )

  const escolhida =
    lista.find((v) => v.id === variantId) ??
    lista.find(variantIsAvailable) ??
    lista[0]

  return escolhida
    ? { options: opcoesDaVariante(escolhida.options), variant: escolhida }
    : null
}

/**
 * O que o estoque do catálogo diz, quando o lojista não escreveu nada.
 *
 * A conta tem de ser a mesma de `variantIsAvailable`, senão o chip e o botão do
 * carrinho discordam — o card promete o que o botão recusa. As quatro leituras:
 *
 *   nenhum variant comprável               → esgotado
 *   algum comprável sem controle de estoque → pronta entrega (a loja não
 *                                            controla: não há o que contar)
 *   comprável com estoque somado           → últimas até o limite, e pronta
 *                                            entrega acima dele
 *   comprável só por encomenda             → sob demanda (estoque zerado e
 *                                            `allow_backorder`, que é
 *                                            literalmente "aceito sem estoque")
 */
function statusFromInventory(variants: (VariantLike | null)[]): ProductStatus {
  const buyable = variants.filter(variantIsAvailable)

  if (buyable.length === 0) {
    return "esgotado"
  }

  if (buyable.some((variant) => !variant?.manage_inventory)) {
    return "pronta-entrega"
  }

  const stock = buyable.reduce(
    (total, variant) => total + (variant?.inventory_quantity ?? 0),
    0
  )

  if (stock > 0) {
    // **O estoque vem antes do motivo de ser comprável.** Um variant com
    // `allow_backorder` é comprável sem estoque — mas se ele tem peça em mãos,
    // a peça existe e a loja entrega agora. Ler "sob demanda" primeiro (como
    // fazia) rotulava como encomenda uma peça que estava na prateleira: era o
    // que a `Jaqueta` mostrava, com `inventory_quantity: 50` na API.
    //
    // "Sob demanda" aqui significa só isto: comprável, e por nada além de
    // encomenda — nenhum variant tem número. A etiqueta comercialmente
    // correta ("é fabrico sob encomenda") é do lojista, por `tag_status`, e
    // entra em `productStatus`.
    return stock <= LAST_UNITS_THRESHOLD ? "ultimas" : "pronta-entrega"
  }

  return "sob-demanda"
}

/**
 * O estado da peça: **o estoque primeiro**, e a palavra do lojista só onde a
 * peça não pode contradizer o que é verdade.
 *
 *   1. **Esgotado vence sempre.** Nenhum rótulo escrito à mão vira "esgotado".
 *   2. **O estoque decide o resto**, por `statusFromInventory`.
 *   3. **O rótulo do lojista** (`metadata.tag_status`, depois as tags) entra só
 *      quando o estoque é ambíguo — "tem peça", mas não "últimas". Um
 *      `tag_status` que contradiz o estoque é ignorado: ele pode dizer "sob
 *      encomenda", não pode afirmar disponibilidade que não existe.
 *
 * Só a primeira tag reconhecida vale: duas tags dizendo coisas diferentes não
 * se somam.
 */
export function productStatus(product: AvailabilityProduct): ProductStatus {
  // 1. O estoque tem a palavra final sobre estar ou não esgotado.
  const peloEstoque = statusFromInventory(product.variants ?? [])

  if (peloEstoque === "esgotado") {
    return "esgotado"
  }

  // 2. O estoque também decide "últimas peças": é número, não palavra — e é
  // o número que muda sozinho, quando alguém compra.
  if (peloEstoque === "ultimas") {
    return "ultimas"
  }

  // 3. Aqui o estoque é "tem peça". Quem acrescenta o resto é o lojista.
  const declared = statusFromLabel(product.metadata?.tag_status)

  if (declared && declared !== "esgotado") {
    return declared
  }

  const tagged = (product.tags ?? [])
    .map((tag) => statusFromLabel(tag?.value))
    .find(
      (status): status is ProductStatus => Boolean(status) && status !== "esgotado"
    )

  if (tagged) {
    return tagged
  }

  return peloEstoque
}
