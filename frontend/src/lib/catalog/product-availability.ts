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
 *   2. **A precedência é do estoque para o rótulo.** A loja escreve
 *      `tag_status` no produto, e essa palavra entra só onde o estoque é
 *      ambíguo — nunca para afirmar disponibilidade que não existe (ver
 *      `productStatus`). Precedência é regra, e regra se testa sem renderizar.
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
 * A ordem é a decisão, e ela **mudou** — o texto antigo era "o que o lojista
 * escreveu vence o estoque", e isso produzia exatamente o defeito que a loja
 * viu: "Pronta entrega" num produto sem estoque, com o botão de comprar
 * ligado. O rótulo era escrito pelo seed, e o seed não é a loja — a informação
 * de uma peça tem de vir da API e do que foi cadastrado no painel.
 *
 *   1. **Esgotado vence sempre.** Se nenhum variant é comprável, a peça está
 *      esgotada — e nenhum rótulo escrito à mão pode virar isso. Um chip de
 *      "Pronta entrega" sobre peça sem estoque é promessa que a loja não pode
 *      cumprir, e o card passa a mentir para a cliente.
 *   2. **O estoque decide o resto**, por `statusFromInventory`: soma o que é
 *      comprável e compara com `LAST_UNITS_THRESHOLD`.
 *   3. **O rótulo do lojista** (`metadata.tag_status`, depois as tags) só entra
 *      quando o estoque é **ambíguo** — isto é, quando ele não diz "esgotado"
 *      nem "últimas". "Sob demanda" é o caso que ele resolve: peça com estoque
 *      que a loja fabrica sob encomenda é "pronta entrega" pelo número, e é
 *      "sob demanda" pela palavra, e a palavra é a que sabe.
 *
 * Só a primeira tag reconhecida vale: duas tags dizendo coisas diferentes não
 * se somam.
 *
 * **O que a loja perde, e por quê.** Um `tag_status` que contradiz o estoque
 * agora é ignorado em vez de vencê-lo. É deliberado: o rótulo existe para dizer
 * "esta peça é sob encomenda", e ele continua fazendo isso. O que ele não pode
 * mais fazer é afirmar disponibilidade que não existe.
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
