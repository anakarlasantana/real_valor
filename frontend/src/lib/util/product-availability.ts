/**
 * O estado de uma peça na loja: pronta entrega, sob demanda, últimas ou esgotado.
 * -------------------------------------------------------------------------
 * O chip que aparece no card e na página do produto é **estado do catálogo**,
 * e este módulo é quem decide qual dos quatro. A decisão mora aqui — e não
 * dentro do componente — por três razões:
 *
 *   1. **Ela é usada em dois lugares.** O card (`product-preview`) e a página
 *      do produto (`product-actions`) precisam concordar: um card dizendo
 *      "pronta entrega" que leva a um produto com o botão desabilitado é o
 *      defeito que esta função existe para não ter.
 *   2. **Ela tem precedência.** O lojista escreve `tag_status` no produto
 *      (medido no catálogo real: `metadata.tag_status: "Pronta Entrega"`) e
 *      essa palavra vence; sem ela valem as tags do produto e, sem elas, o
 *      estoque. Precedência é regra, e regra se testa sem renderizar.
 *   3. **Ela lê estoque — e o estoque engana.** Ver `variantIsAvailable`.
 *
 * **O rótulo é da loja, o estado é do catálogo.** As quatro palavras do chip
 * (`PRODUCT_STATUS_LABELS`) são copy da loja, não conteúdo do CRM: quem quiser
 * escrever "Chega em 2 dias" no lugar de "Pronta entrega" mexe neste arquivo.
 * Promover isso a campo editável é trabalho futuro, e não passa pelo contrato
 * hoje — pelo mesmo motivo que o chip "Todos" da vitrine é `ALL_LABEL` na
 * seção, e não um campo.
 *
 * A entrada é um tipo **estrutural**, e não `StoreProduct`: o que se lê são
 * três campos de estoque e dois de texto, e mantê-los declarados aqui é o que
 * permite testar a regra com um objeto de dez linhas, sem SDK e sem API.
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
 * acaba, sem virar urgência artificial. É a única constante de comportamento
 * deste módulo, e ela é do lado da loja — nenhum campo do CRM a controla.
 */
export const LAST_UNITS_THRESHOLD = 3

/**
 * Os rótulos que o lojista escreve — em `metadata.tag_status` ou numa tag —
 * traduzidos para o estado.
 *
 * As chaves são o rótulo **normalizado** (`normalizeStatusLabel`): minúsculas,
 * sem acento, com espaço único. Por isso "Pronta Entrega", "pronta-entrega" e
 * "PRONTA_ENTREGA" não precisam de três entradas — quem iguala as três é a
 * normalização, e é lá que mora a tolerância.
 *
 * Rótulo fora desta lista **não é erro e não inventa estado**: ele cai para a
 * tag, e da tag para o estoque. Um `tag_status` novo ("Feito à mão") que o
 * lojista digite hoje aparece no card como o estoque diz, e entra nesta tabela
 * quando a loja combinar o que ele significa.
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

  if (stock <= 0) {
    return "sob-demanda"
  }

  return stock <= LAST_UNITS_THRESHOLD ? "ultimas" : "pronta-entrega"
}

/**
 * O estado da peça: **o que o lojista escreveu** primeiro, o estoque depois.
 *
 * A ordem é a decisão, e ela não é simétrica:
 *
 *   1. `metadata.tag_status` — a palavra do lojista sobre esta peça;
 *   2. as tags do produto, na ordem em que vierem — a mesma palavra, escrita no
 *      lugar onde o catálogo já tinha tags;
 *   3. o estoque, por `statusFromInventory`.
 *
 * Só a primeira reconhecida vale: duas tags dizendo coisas diferentes não se
 * somam, e "Pronta Entrega" escrito à mão vence um estoque zerado **de
 * propósito** — quem conhece a peça é quem a vende, e o chip é aviso, não
 * trava (quem trava é o botão do carrinho, pela regra de estoque).
 */
export function productStatus(product: AvailabilityProduct): ProductStatus {
  const declared = statusFromLabel(product.metadata?.tag_status)

  if (declared) {
    return declared
  }

  const tagged = (product.tags ?? [])
    .map((tag) => statusFromLabel(tag?.value))
    .find((status): status is ProductStatus => Boolean(status))

  if (tagged) {
    return tagged
  }

  return statusFromInventory(product.variants ?? [])
}
