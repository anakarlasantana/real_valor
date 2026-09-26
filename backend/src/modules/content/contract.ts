/**
 * Real Valor — Contrato de conteúdo (fonte da verdade)
 * -----------------------------------------------------------------
 * Este arquivo é a ÚNICA definição do formato de conteúdo da vitrine.
 *
 * O frontend mantém um espelho em
 * `frontend/src/lib/content/home-sections.ts`. Os dois precisam
 * continuar idênticos: o frontend tem um teste de paridade
 * (`frontend/src/lib/content/__tests__/contract-parity.test.ts`) que
 * compara campo por campo e falha se alguém alterar só um lado.
 *
 * Necessário porque backend e frontend são pacotes npm separados, com
 * `node_modules` separados — não há como importar um do outro sem
 * publicar um pacote compartilhado.
 *
 * Origem do conteúdo: ./Downloads/real-valor-frontend-prototype
 */

/** Campos comuns a toda seção, independente do tipo. */
export type SectionBase = {
  /** Identificador estável — é o `id` do registro no banco. */
  id: string
  /** Quando false, a seção é omitida inteira pelo renderizador. */
  enabled: boolean
  /** Ordem de renderização, ascendente. */
  position: number
}

export type AnnouncementSection = SectionBase & {
  type: "announcement"
  text: string
}

export type HeroSection = SectionBase & {
  type: "hero"
  eyebrow: string
  /** Renderizado como texto antes da parte enfatizada. */
  headline: string
  /** Renderizado dentro de `<em>` — itálico Playfair, como no protótipo. */
  headlineEmphasis: string
  subtitle: string
  ctaLabel: string
  ctaHref: string
  imageUrl: string
  imageAlt: string
  /**
   * Força do scrim escuro da esquerda para a direita, no lado do texto,
   * de 0 a 1. O protótipo usa .72 caindo para .02 em 75% da largura.
   */
  overlay: number
}

export type BenefitItem = {
  /** Chave de ícone resolvida por `frontend/src/lib/content/icons.ts`. */
  icon: string
  title: string
  subtitle: string
}

export type BenefitsSection = SectionBase & {
  type: "benefits"
  items: BenefitItem[]
}

export type CollectionHighlight = {
  title: string
  subtitle: string
  imageUrl: string
  imageAlt: string
  href: string
  ctaLabel: string
}

export type CollectionsSection = SectionBase & {
  type: "collections"
  eyebrow: string
  title: string
  subtitle: string
  items: CollectionHighlight[]
}

export type FeaturedSection = SectionBase & {
  type: "featured"
  eyebrow: string
  title: string
  subtitle: string
  /** Chips de filtro acima da vitrine. `"Todos"` significa "todas". */
  filters: string[]
  viewAllLabel: string
}

export type EditorialSection = SectionBase & {
  type: "editorial"
  /** Linha manuscrita em Allura. */
  script: string
  title: string
  body: string
  ctaLabel: string
  ctaHref: string
  imageUrl: string
  imageAlt: string
  imagePosition: "left" | "right"
}

export type InstagramSection = SectionBase & {
  type: "instagram"
  handle: string
  title: string
  images: { imageUrl: string; imageAlt: string }[]
}

/**
 * Item do menu principal do cabeçalho.
 *
 * O `href` também define o comportamento, então não existe um campo
 * "modo": a forma do destino basta.
 *   `/#hero` ou `#hero`   → rola até a seção de id `hero` da home
 *   `/store`, `/search`   → página interna (o país é prefixado na loja)
 *   `https://…`           → fora do site, em nova aba
 *   `mailto:…` / `tel:…`  → cliente de e-mail / telefone
 */
export type HeaderLink = {
  label: string
  href: string
}

/** Ação do cluster de ícones à direita do cabeçalho. */
export type HeaderAction = {
  /** Chave de ícone resolvida por `frontend/src/lib/content/icons.ts`. */
  icon: string
  /** Rótulo: nome acessível do ícone e texto no menu mobile. */
  label: string
  href: string
}

/**
 * Menu do cabeçalho.
 *
 * É a única seção que não é da home: como a barra de anúncio, aparece
 * em todas as rotas da loja. Mas, como todo conteúdo da vitrine, mora na
 * mesma tabela e na mesma superfície (`home`) — daí o `id` fixo `nav`,
 * que o `seed-content.ts` cria.
 *
 * A ordem é a ordem dos arrays: `links` no centro do cabeçalho (e no
 * topo do menu mobile), `actions` no cluster da direita. Os itens da
 * lista são editáveis um a um pelo admin (inclusive reordenados), sem
 * um campo de ordem por item.
 */
export type NavSection = SectionBase & {
  type: "nav"
  links: HeaderLink[]
  actions: HeaderAction[]
}

export type HomeSection =
  | AnnouncementSection
  | HeroSection
  | BenefitsSection
  | CollectionsSection
  | FeaturedSection
  | EditorialSection
  | InstagramSection
  | NavSection

/** Todo `type` de seção válido, como valor — para validação em runtime. */
export const SECTION_TYPES = [
  "announcement",
  "hero",
  "benefits",
  "collections",
  "featured",
  "editorial",
  "instagram",
  // Não é uma seção da home: é o cabeçalho da loja, renderizado pelo
  // layout em todas as rotas (como a barra de anúncio).
  "nav",
] as const

export type SectionType = (typeof SECTION_TYPES)[number]

export function isSectionType(value: unknown): value is SectionType {
  return (
    typeof value === "string" &&
    (SECTION_TYPES as readonly string[]).includes(value)
  )
}

/**
 * Contrato por tipo: campos que vivem em `data` (JSON) e o formato
 * esperado de cada um.
 *
 * Serve para duas coisas: validar a entrada da API admin antes de
 * gravar, e derivar o formulário do widget sem repetir a lista de
 * campos em React.
 */
export type FieldKind =
  | "text"
  | "textarea"
  | "number"
  | "select"
  | "list:text"
  | "list:benefit"
  | "list:highlight"
  | "list:image"
  | "list:link"
  | "list:action"

export type FieldSpec = {
  name: string
  label: string
  kind: FieldKind
  required?: boolean
  /** Apenas para `select`. */
  options?: readonly string[]
  help?: string
}

/** Campos de `data` por tipo de seção, na ordem em que o admin os mostra. */
export const SECTION_FIELDS: Record<SectionType, readonly FieldSpec[]> = {
  announcement: [
    { name: "text", label: "Mensagem", kind: "text", required: true },
  ],
  hero: [
    { name: "eyebrow", label: "Eyebrow", kind: "text" },
    { name: "headline", label: "Título", kind: "text", required: true },
    {
      name: "headlineEmphasis",
      label: "Título (parte em itálico)",
      kind: "text",
    },
    { name: "subtitle", label: "Subtítulo", kind: "text" },
    { name: "ctaLabel", label: "Texto do botão", kind: "text" },
    { name: "ctaHref", label: "Link do botão", kind: "text" },
    { name: "imageUrl", label: "Imagem (URL)", kind: "text" },
    { name: "imageAlt", label: "Imagem (alt)", kind: "text" },
    {
      name: "overlay",
      label: "Scrim (0 a 1)",
      kind: "number",
      help: "Opacidade do overlay escuro no lado do texto.",
    },
  ],
  benefits: [{ name: "items", label: "Itens", kind: "list:benefit" }],
  collections: [
    { name: "eyebrow", label: "Eyebrow", kind: "text" },
    { name: "title", label: "Título", kind: "text", required: true },
    { name: "subtitle", label: "Subtítulo", kind: "textarea" },
    { name: "items", label: "Coleções", kind: "list:highlight" },
  ],
  featured: [
    { name: "eyebrow", label: "Eyebrow", kind: "text" },
    { name: "title", label: "Título", kind: "text", required: true },
    { name: "subtitle", label: "Subtítulo", kind: "textarea" },
    {
      name: "filters",
      label: "Filtros",
      kind: "list:text",
      help: 'Separe por vírgula. Inclua "Todos" para o filtro que limpa.',
    },
    { name: "viewAllLabel", label: "Link ver todos", kind: "text" },
  ],
  editorial: [
    { name: "script", label: "Frase manuscrita", kind: "text" },
    { name: "title", label: "Título", kind: "text", required: true },
    { name: "body", label: "Texto", kind: "textarea" },
    { name: "ctaLabel", label: "Texto do botão", kind: "text" },
    { name: "ctaHref", label: "Link do botão", kind: "text" },
    { name: "imageUrl", label: "Imagem (URL)", kind: "text" },
    { name: "imageAlt", label: "Imagem (alt)", kind: "text" },
    {
      name: "imagePosition",
      label: "Posição da imagem",
      kind: "select",
      options: ["left", "right"] as const,
    },
  ],
  instagram: [
    { name: "handle", label: "Perfil", kind: "text" },
    { name: "title", label: "Título", kind: "text", required: true },
    { name: "images", label: "Imagens", kind: "list:image" },
  ],
  nav: [
    {
      name: "links",
      label: "Links do menu",
      kind: "list:link",
      help: 'Ordem da lista = ordem no menu. Use "/#secao" para rolar até uma parte da home, "/rota" para outra página, "https://…" para fora do site e "mailto:…"/"tel:…" para contato.',
    },
    {
      name: "actions",
      label: "Ícones da direita",
      kind: "list:action",
      help: 'Ordem da lista = ordem no cabeçalho. O ícone "bag" usa a sacola do carrinho, com contador — mantenha só um.',
    },
  ],
}
