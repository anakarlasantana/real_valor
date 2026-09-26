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

/**
 * Where a footer column's items come from.
 *
 *   `links`       → the `links` typed in the admin (the default)
 *   `categories`  → the catalogue categories, live
 *   `collections` → the catalogue collections, live
 *
 * Kept as a list (not a bare union) so the admin editor can offer the
 * options; it is a separate package with its own copy, and
 * `scripts/check-contract-parity.mjs` compares the two.
 */
export const FOOTER_COLUMN_SOURCES = [
  "links",
  "categories",
  "collections",
] as const

export type FooterColumnSource = (typeof FOOTER_COLUMN_SOURCES)[number]

/**
 * Footer column (e.g. "Ajuda").
 *
 * A column is always content: the component has no fixed or automatic
 * column, so the shopkeeper inserts, edits, reorders and removes **all**
 * of them in the same admin editor. Catalogue columns are not a special
 * case in the layout — just one possible `source`, picked per column.
 *
 * With `source: "categories"` or `"collections"` the items come from the
 * catalogue and `links` is ignored; with `"links"` (the default) it is the
 * other way round. Either way the typed `href`s have the same shape and
 * the same resolution as the header ones: `nav-link` is what turns the
 * `href` into behaviour (`/#section` scrolls, `/route` navigates,
 * `https://` opens in a new tab, `mailto:`/`tel:` open the client), so
 * footer and header cannot drift apart.
 */
export type FooterColumn = {
  title: string
  /** Missing/unknown counts as `"links"` (data stored before). */
  source: FooterColumnSource
  links: HeaderLink[]
}

/** Footer social icon. The key resolves through `social-icons.tsx`. */
export type FooterSocial = {
  icon: string
  /** Accessible name — the glyph has no visible text. */
  label: string
  href: string
}

/**
 * Store footer.
 *
 * Like `nav`, it is not a home section: the layout renders it on every
 * route, and the fixed id `footer` is the record the seed creates.
 *
 * The wordmark, the script line and the rights row stay in the component —
 * they are not content. Everything else is: the link columns (in list
 * order, each with its own source) and the social links. There is no
 * default column and no built-in FAQ: a footer with no column at all is a
 * valid state, the store only shows what the shopkeeper inserts in the
 * admin, and a "Perguntas frequentes" column is just another column.
 */
export type FooterSection = SectionBase & {
  type: "footer"
  /**
   * Link columns, in list order. Each item decides where its items come
   * from (`source`), so the component has no fixed column. A column
   * without a title or without items does not show — that is what lets the
   * footer be published before the catalogue exists.
   */
  columns: FooterColumn[]
  social: FooterSocial[]
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
  | FooterSection

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
  // Mesmo caso do `nav`: o rodapé também é cromo do site, não seção da
  // home, e quem o desenha é o layout.
  "footer",
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
  // Item com sub-lista dentro (`links`): o editor do admin desenha os
  // níveis internos recursivamente.
  | "list:column"
  | "list:social"

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
  benefits: [
    {
      name: "items",
      label: "Itens",
      kind: "list:benefit",
      // O layout da faixa acompanha a contagem — o lojista não precisa
      // recorrer a um número "certo" (2 ou 4) para a faixa ficar bonita.
      help: "A faixa se adapta à quantidade: 2 por linha no celular e de 5 a 7 por linha no desktop, conforme a largura da tela. O que sobrar de uma linha ocupa a linha inteira.",
    },
  ],
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
    {
      name: "body",
      label: "Texto (conceito e história)",
      kind: "textarea",
      // A ajuda repete o casamento com o item do menu de propósito: é o
      // que o lojista procura ao abrir o formulário.
      help: 'Conteúdo da seção "Sobre": conceito da marca, história e valores. O item "Sobre" do menu rola até aqui.',
    },
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
  footer: [
    {
      name: "columns",
      label: "Colunas",
      kind: "list:column",
      help: 'Ordem da lista = ordem no rodapé. Cada coluna escolhe a origem dos itens: "links" usa os links digitados, "categories" e "collections" puxam do catálogo. Coluna sem título ou sem itens não aparece na loja.',
    },
    {
      name: "social",
      label: "Redes sociais",
      kind: "list:social",
      help: "Ordem da lista = ordem dos ícones, logo abaixo da marca. O rótulo é o nome acessível do ícone — ele não tem texto visível.",
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
 * Fallback footer, mirroring `backend/src/modules/content/defaults.ts`.
 *
 * Same reasoning as `DEFAULT_HEADER`: the footer is chrome on every
 * route, so it must never render empty — the wordmark, the script line,
 * the social row and the rights row are always there.
 *
 * `columns` ships empty on purpose: a column is content, there is no
 * default column, and the shopkeeper inserts as many as they want (from
 * the catalogue or typed by hand) in the admin. There is no FAQ field
 * either: a "Perguntas frequentes" column is just another column.
 */
export const DEFAULT_FOOTER: FooterSection = {
  id: "footer",
  type: "footer",
  enabled: true,
  position: 80,
  columns: [],
  social: [
    {
      icon: "instagram",
      label: "Instagram",
      href: "https://instagram.com/realvalor",
    },
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
  // O rodapé viaja no mesmo payload do cabeçalho (ver `footerSections`).
  DEFAULT_FOOTER,
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

/**
 * The footer is chrome on every route, same as the header, and its copy
 * is content — so the layout pulls that one block out of the payload it
 * already fetched, and a single request feeds both.
 *
 * Falls back to `DEFAULT_FOOTER` when there is no `footer` block
 * (the seed never ran, the admin hid it, or `/store/content` failed): an
 * empty footer would take the wordmark and the rights line with it.
 */
export function footerSections(
  sections: HomeSection[] = DEFAULT_HOME_SECTIONS
): FooterSection {
  return (
    sections.find(
      (section): section is FooterSection => section.type === "footer"
    ) ?? DEFAULT_FOOTER
  )
}
