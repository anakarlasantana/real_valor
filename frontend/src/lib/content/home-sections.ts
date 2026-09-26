/**
 * Real Valor — Home content contract
 * -----------------------------------------------------------------
 * Source of truth: ./Downloads/real-valor-frontend-prototype
 * (`PROMPT_FRONTEND.md` + `index.html`).
 *
 * Every section of the storefront home is described here as data, so
 * the layout can later be driven by the Content Block module in the
 * Medusa backend (admin-editable) without the storefront components
 * having to change: they already receive a section object.
 *
 * Until that module lands, `DEFAULT_HOME_SECTIONS` below is what the
 * home renders — the exact copy from the prototype.
 *
 * Text, ordering, images and visibility are all data here. Colours
 * and fonts are NOT: they keep coming from `lib/theme.ts` +
 * `styles/brand.css`, so a seasonal theme keeps working unchanged.
 */

/** Fields shared by every section, regardless of its type. */
type SectionBase = {
  /** Stable identifier — matches the future CMS record id. */
  id: string
  /** When false the section is skipped entirely by the renderer. */
  enabled: boolean
  /** Ascending render order. */
  position: number
}

export type AnnouncementSection = SectionBase & {
  type: "announcement"
  text: string
}

export type HeroSection = SectionBase & {
  type: "hero"
  eyebrow: string
  /** Rendered as text before the emphasised part. */
  headline: string
  /** Rendered inside `<em>` — italic Playfair, as in the prototype. */
  headlineEmphasis: string
  subtitle: string
  ctaLabel: string
  ctaHref: string
  imageUrl: string
  imageAlt: string
  /**
   * Left-to-right dark scrim strength at the copy side, 0–1.
   * The prototype uses .72 fading to .02 across 75% of the width.
   */
  overlay: number
}

export type BenefitItem = {
  /** Icon key resolved by `lib/content/icons.ts`. */
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
  /** Filter chips rendered above the rail. `"Todos"` means "all". */
  filters: string[]
  viewAllLabel: string
}

export type EditorialSection = SectionBase & {
  type: "editorial"
  /** Allura script line. */
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
 * Entry of the header's primary menu.
 *
 * The `href` also decides the behaviour, so there is no separate "mode"
 * field: the shape of the destination is enough.
 *   `/#hero` or `#hero`   → smooth-scrolls to home section `hero`
 *   `/store`, `/search`   → internal page (country prefix added by the link)
 *   `https://…`           → leaves the site, in a new tab
 *   `mailto:…` / `tel:…`  → email client / phone dialer
 */
export type HeaderLink = {
  label: string
  href: string
}

/** Action of the icon cluster on the right of the header. */
export type HeaderAction = {
  /** Icon key resolved by `lib/content/icons.ts`. */
  icon: string
  /** Label: accessible name of the icon and text in the mobile drawer. */
  label: string
  href: string
}

/**
 * Store header menu.
 *
 * The only section that is not part of the home: like the announcement
 * bar it renders on every route. It still travels in the same content
 * payload (`surface: "home"`), which is why the layout reads it from
 * `getHomeSections()` instead of fetching again.
 *
 * Array order is render order: `links` in the header centre (and at the
 * top of the mobile drawer), `actions` in the right-hand cluster.
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

/* ------------------------------------------------------------------
 * Espelho de backend/src/modules/content/contract.ts
 *
 * Tudo a partir daqui é cópia fiel daquele arquivo. Alterar um lado
 * sem o outro quebra `scripts/check-contract-parity.mjs`.
 * ------------------------------------------------------------------ */

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

/**
 * Fallback imagery. The prototype assets were only 652×1128, so these
 * are stand-ins: the layout must never 404 while real photography is
 * pending, and swapping them is the first job for the CMS.
 */
const FALLBACK_HERO = "/brand/hero.jpg"

/**
 * Fallback header, mirroring `backend/src/modules/content/defaults.ts`.
 *
 * Used whenever the content payload has no `nav` block: the seed never
 * ran, the block was hidden by the admin, or `/store/content` failed.
 * The header is chrome on every route, so it must never render empty.
 */
export const DEFAULT_HEADER: NavSection = {
  id: "nav",
  type: "nav",
  enabled: true,
  position: 5,
  links: [
    { label: "Início", href: "/#hero" },
    { label: "Coleções", href: "/#collections" },
    { label: "Produtos", href: "/store" },
    { label: "Sobre", href: "/#editorial" },
    { label: "Contatos", href: "mailto:contato@realvalor.com.br" },
  ],
  actions: [
    { icon: "bag", label: "Sacola", href: "/cart" },
    { icon: "account", label: "Conta", href: "/account" },
    { icon: "search", label: "Buscar", href: "/search" },
  ],
}

/**
 * Default home — an exact transcription of the prototype, including
 * headings, sub-headings, CTAs and section order.
 */
export const DEFAULT_HOME_SECTIONS: HomeSection[] = [
  // O cabeçalho viaja no mesmo payload da home (ver `headerSections`).
  DEFAULT_HEADER,
  {
    id: "announcement",
    type: "announcement",
    enabled: true,
    position: 10,
    text: "Frete seguro para todo o Brasil · até 6x sem juros",
  },
  {
    id: "hero",
    type: "hero",
    enabled: true,
    position: 20,
    eyebrow: "Nova coleção · Essência",
    headline: "Você não precisa ser rica para se",
    headlineEmphasis: "sentir elegante.",
    subtitle:
      "Alfaiataria para todas. Peças pensadas para vestir sua rotina com presença, conforto e identidade.",
    ctaLabel: "Conheça a coleção",
    ctaHref: "/store",
    imageUrl: FALLBACK_HERO,
    imageAlt: "Editorial Real Valor — alfaiataria feminina",
    overlay: 0.72,
  },
  {
    id: "benefits",
    type: "benefits",
    enabled: true,
    position: 30,
    items: [
      { icon: "quality", title: "Qualidade", subtitle: "Que você sente" },
      {
        icon: "price",
        title: "Preços acessíveis",
        subtitle: "Para a sua realidade",
      },
      { icon: "sizes", title: "Do PP ao GG", subtitle: "Sem limitações" },
      {
        icon: "delivery",
        title: "Entrega segura",
        subtitle: "Para todo o Brasil",
      },
    ],
  },
  {
    id: "collections",
    type: "collections",
    enabled: true,
    position: 40,
    eyebrow: "Explore",
    title: "Nossas coleções",
    subtitle:
      "Seleções criadas para diferentes momentos, sempre com a assinatura visual da REAL VALOR.",
    items: [
      {
        title: "Essência",
        subtitle: "Para o seu dia a dia",
        imageUrl: "/brand/collection-1.jpg",
        imageAlt: "Coleção Essência",
        href: "/store",
        ctaLabel: "Comprar agora",
      },
      {
        title: "Presença",
        subtitle: "Para grandes momentos",
        imageUrl: "/brand/collection-2.jpg",
        imageAlt: "Coleção Presença",
        href: "/store",
        ctaLabel: "Comprar agora",
      },
      {
        title: "Autêntica",
        subtitle: "Para vestir você",
        imageUrl: "/brand/collection-3.jpg",
        imageAlt: "Coleção Autêntica",
        href: "/store",
        ctaLabel: "Comprar agora",
      },
    ],
  },
  {
    id: "featured",
    type: "featured",
    enabled: true,
    position: 50,
    eyebrow: "Shop",
    title: "Peças em destaque",
    subtitle:
      "Uma vitrine editorial com navegação simples, foco no produto e preço sempre visível.",
    filters: ["Todos", "Blazers", "Conjuntos", "Calças"],
    viewAllLabel: "Ver todos os produtos",
  },
  {
    id: "editorial",
    type: "editorial",
    enabled: true,
    position: 60,
    script: "Vista o seu valor.",
    title: "A alfaiataria que valoriza você, não o seu status.",
    body: "A REAL VALOR acredita que elegância não é privilégio. É um direito. Criamos peças de alfaiataria feminina com estética sofisticada e preço acessível, para que mais mulheres possam se sentir bem vestidas na vida real.",
    ctaLabel: "Conheça a nossa história",
    ctaHref: "/store",
    imageUrl: "/brand/story-1.jpg",
    imageAlt: "Detalhes de alfaiataria Real Valor",
    imagePosition: "left",
  },
  {
    id: "instagram",
    type: "instagram",
    enabled: true,
    position: 70,
    handle: "@realvalor",
    title: "Mais que roupas, é sobre você.",
    images: [
      { imageUrl: "/brand/story-1.jpg", imageAlt: "Real Valor no Instagram" },
      { imageUrl: "/brand/story-2.jpg", imageAlt: "Real Valor no Instagram" },
      {
        imageUrl: "/brand/collection-1.jpg",
        imageAlt: "Real Valor no Instagram",
      },
      {
        imageUrl: "/brand/collection-2.jpg",
        imageAlt: "Real Valor no Instagram",
      },
    ],
  },
]

/** Sections sorted by position and with disabled ones removed. */
export function visibleSections(sections: HomeSection[]): HomeSection[] {
  return sections
    .filter((section) => section.enabled)
    .slice()
    .sort((a, b) => a.position - b.position)
}

/**
 * The announcement bar is site chrome (every route), not home content,
 * yet its copy is content. The layout calls this to pull just that one
 * block, so the string still lives in a single place and becomes
 * admin-editable together with the rest of the CMS later.
 */
export function announceSections(
  sections: HomeSection[] = DEFAULT_HOME_SECTIONS
): AnnouncementSection | undefined {
  return sections.find(
    (section): section is AnnouncementSection => section.type === "announcement"
  )
}

/**
 * The header is site chrome (every route), not home content, yet its
 * links are content — same reasoning as `announceSections`, so the
 * layout pulls that one block out of the payload it already fetched.
 *
 * Falls back to `DEFAULT_HEADER` when there is no `nav` block: disabled
 * sections are removed by `visibleSections` before this point, and an
 * empty header is worse than a plain one.
 */
export function headerSections(
  sections: HomeSection[] = DEFAULT_HOME_SECTIONS
): NavSection {
  return (
    sections.find((section): section is NavSection => section.type === "nav") ??
    DEFAULT_HEADER
  )
}
