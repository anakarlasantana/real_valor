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
 * Text, ordering, images and visibility are all data here. Colours and
 * fonts are data only as an *override*: each section may carry the theme
 * role the shopkeeper picked in the CRM (see `SectionAppearance` and
 * `lib/content/appearance.ts`), and an unset role means "whatever the
 * active theme says" — so a seasonal theme keeps recolouring every
 * section that was never touched.
 */

/**
 * Per-section appearance (optional), set by the shopkeeper in the CRM.
 *
 * Every value is a theme *role* (`"dourado"`, `"display"`…), never a
 * literal colour: the storefront resolves it to `var(--rv-dourado)` /
 * `var(--rv-font-display)`, which is what keeps a recoloured section
 * following a seasonal theme instead of fighting it.
 *
 * Empty or missing is the normal state and means "the store theme", so
 * a section that was never configured renders exactly like the rest of
 * the site. The catalogue of valid values lives in `THEME_COLOR_TOKENS`
 * / `FONT_ROLES` below, mirrored from
 * `backend/src/modules/content/contract.ts`, and offered to the editor
 * through `SECTION_FIELDS`; `appearanceVars` is what validates them at
 * render time, because what comes back from the database is free text.
 */
export type SectionAppearance = {
  appearanceHeadingFont?: string
  appearanceTextFont?: string
  appearanceHeadingColor?: string
  appearanceTextColor?: string
  appearanceAccentColor?: string
  appearanceBackgroundColor?: string
}

/** Fields shared by every section, regardless of its type. */
type SectionBase = {
  /** Stable identifier — matches the future CMS record id. */
  id: string
  /** When false the section is skipped entirely by the renderer. */
  enabled: boolean
  /** Ascending render order. */
  position: number
}

export type AnnouncementSection = SectionBase &
  SectionAppearance & {
    type: "announcement"
    text: string
  }

export type HeroSection = SectionBase &
  SectionAppearance & {
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

export type BenefitsSection = SectionBase &
  SectionAppearance & {
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

export type CollectionsSection = SectionBase &
  SectionAppearance & {
    type: "collections"
    eyebrow: string
    title: string
    subtitle: string
    items: CollectionHighlight[]
  }

export type FeaturedSection = SectionBase &
  SectionAppearance & {
    type: "featured"
    eyebrow: string
    title: string
    subtitle: string
    /** Filter chips rendered above the rail. `"Todos"` means "all". */
    filters: string[]
    viewAllLabel: string
  }

export type EditorialSection = SectionBase &
  SectionAppearance & {
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

export type InstagramSection = SectionBase &
  SectionAppearance & {
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
 * Papéis de cor do tema (`ThemeColors` de `frontend/src/lib/theme.ts`,
 * os tokens `--rv-*` de `frontend/src/styles/brand.css`).
 *
 * É uma lista, e não só um `union` no tipo, porque as pontas precisam
 * dos mesmos valores em runtime: o `<select>` do admin (via `options`),
 * a validação do storefront (`appearanceVars`) e a guarda de paridade,
 * que compara as duas cópias.
 */
export const THEME_COLOR_TOKENS = [
  "rose",
  "offwhite",
  "cacao",
  "grafite",
  "preto",
  "dourado",
] as const

export type ThemeColorToken = (typeof THEME_COLOR_TOKENS)[number]

/**
 * O hex de cada cor da paleta, como o tema padrão o declara
 * (`frontend/themes/default/theme.json` → `colors`).
 *
 * Serve para o editor do admin desenhar a **bolinha de cor**: o painel é
 * um pacote separado, não lê os `theme.json` (que são do storefront) e sem
 * isto só teria como oferecer a palavra "rose" — que não diz nada a quem
 * está escolhendo uma cor.
 *
 * É **cópia de leitura, só para a prévia**: o que o lojista grava continua
 * sendo o papel (`"rose"`), nunca o hex, então o tema sazonal segue
 * mandando. Num tema de estação (Black Friday) a bolinha mostra a cor do
 * tema padrão, não a da estação — é prévia de paleta, não amostra do que
 * está no ar, e é por isso que a opção continua trazendo o nome do papel
 * no rótulo.
 *
 * `scripts/check-contract-parity.mjs` confere cor por cor contra o
 * `theme.json` e contra o espelho do frontend: uma cópia de prévia que
 * envelhece em silêncio é pior do que não ter prévia.
 */
export const THEME_COLOR_HEXES: Record<ThemeColorToken, string> = {
  rose: "#B97872",
  offwhite: "#F7F1E8",
  cacao: "#4A3531",
  grafite: "#303033",
  preto: "#171717",
  dourado: "#D4B19A",
}

/**
 * Papéis de fonte do tema (`ThemeFonts`): títulos, textos e a frase
 * manuscrita. Mesma razão de lista de `THEME_COLOR_TOKENS`.
 */
export const FONT_ROLES = ["display", "sans", "script"] as const

export type FontRole = (typeof FONT_ROLES)[number]

/**
 * A família e a pilha completa de cada papel de fonte.
 *
 * `family` é o nome declarado no `theme.json` (`fonts`) — o mesmo que o
 * `@font-face` da cópia em `backend/src/admin/routes/content/fonts/` usa —,
 * e `stack` é a pilha que `themeToCSSVariables`
 * (`frontend/src/lib/theme.ts`) escreve em `--rv-font-*`, com o mesmo
 * fallback da loja.
 *
 * Mesma razão de `THEME_COLOR_HEXES`: o `<select>` de fonte do admin
 * desenha cada opção **na própria fonte** — é o que faz "Títulos (Playfair
 * Display)" parecer um título na tela em vez de uma linha de texto igual às
 * outras. Sem a família, o painel não tem como pedir essa fonte ao
 * navegador.
 *
 * A guarda de paridade confere `family` contra o `theme.json`, `stack`
 * contra o `theme.ts` e o md5 dos `.woff2` do admin contra os do storefront:
 * uma família sem arquivo vira prévia em Times New Roman, e um arquivo
 * diferente do da loja vira prévia que mente.
 */
export const THEME_FONTS: Record<FontRole, { family: string; stack: string }> =
  {
    display: {
      family: "Playfair Display",
      stack: '"Playfair Display", Georgia, serif',
    },
    sans: {
      family: "Montserrat",
      stack: '"Montserrat", system-ui, sans-serif',
    },
    script: {
      family: "Allura",
      stack: '"Allura", cursive',
    },
  }

/**
 * Cores do tema que são fundo escuro.
 *
 * Elas não existem para o formulário (nenhum `<select>` as oferece — as
 * opções saem de `THEME_COLOR_TOKENS`): servem para o storefront
 * auto-legibilizar a seção. Fundo escuro escolhido **e** nenhuma cor de
 * texto escolhida significam "não mexi no texto", e aí o texto vira off
 * white — grafite sobre preto seria ilegível, e o lojista que quer preto de
 * fundo não tem por que saber que precisa escolher a cor do texto também.
 *
 * Escolha explícita sempre vence: quem gravar `grafite` de texto num fundo
 * `preto` fica com grafite.
 *
 * Só o lado escuro tem regra: no tema padrão todo texto de seção já é
 * escuro (grafite/muted), então um fundo claro — `offwhite` — continua
 * legível sem ajuda. O caso que sobra é `dourado` de fundo (texto off
 * white fica com pouco contraste), e para esse o lojista tem o campo *Cor
 * dos textos* na mão.
 */
export const THEME_DARK_TOKENS = ["preto", "cacao"] as const

/**
 * Rótulos dos trilhos de aparência no editor do admin.
 *
 * Aparência não é um bloco no fim do formulário: cada trilho aparece
 * **dentro** do conteúdo, logo abaixo do campo que ele veste — a fonte e a
 * cor dos títulos embaixo do campo "Título", a cor do fundo no fim da
 * seção. Quem diz onde cada campo cai é o `attachedTo` do `FieldSpec`; o
 * rótulo do trilho é o `group` dele.
 *
 * A ordem é a ordem dos trilhos quando dois deles caem no mesmo campo (a
 * faixa de benefícios, por exemplo, veste tudo a partir da lista de itens):
 * título, texto, detalhe e, por último, o fundo.
 */
export const APPEARANCE_GROUPS = [
  "Títulos",
  "Textos",
  "Detalhes",
  "Fundo",
] as const

export type AppearanceGroup = (typeof APPEARANCE_GROUPS)[number]

/** Opções de todo campo de cor: o padrão (`""`) na frente dos 6 tokens. */
const APPEARANCE_COLOR_OPTIONS = ["", ...THEME_COLOR_TOKENS] as const

/** Nomes da paleta como o guia de marca os escreve (não `rose`, "Rosa Queimado"). */
const APPEARANCE_COLOR_LABELS: Record<string, string> = {
  "": "Padrão do tema da loja",
  rose: "Rosa Queimado",
  offwhite: "Off White",
  cacao: "Marrom Cacau",
  grafite: "Grafite",
  preto: "Preto",
  dourado: "Dourado Rosé",
}

/** Opções de todo campo de fonte: o padrão (`""`) na frente dos 3 papéis. */
const APPEARANCE_FONT_OPTIONS = ["", ...FONT_ROLES] as const

/** O papel da fonte desambiguado: "Títulos", não "display". */
const APPEARANCE_FONT_LABELS: Record<string, string> = {
  "": "Padrão do tema da loja",
  display: "Títulos (Playfair Display)",
  sans: "Textos (Montserrat)",
  script: "Manuscrita (Allura)",
}

/**
 * Um trilho de aparência: os campos de um mesmo `group`, ancorados no
 * campo de conteúdo que eles vestem (`attachedTo`).
 *
 * Cada trilho é uma função porque o mesmo trilho cai em lugares diferentes
 * conforme a seção: "Títulos" é a fonte e a cor do `headline` no hero, do
 * `title` nas coleções e do `items` na faixa de benefícios. Quem chama
 * informa a âncora, e `SECTION_FIELDS` espalha o retorno logo depois do
 * campo citado — é a ordem do array, e não um mapa à parte, que diz o que
 * aparece onde. O formulário do admin é montado daqui, na ordem daqui.
 *
 * `attachedTo` é âncora de verdade, não comentário: a guarda de paridade
 * confere que o campo citado existe naquela seção e que o trilho vem logo
 * depois dele. Sem isso, um trilho continuaria compilando e aparecendo —
 * só que longe do campo que ele muda.
 *
 * A primeira opção de todo campo é a vazia — "Padrão do tema da loja" —
 * porque vazio significa "não escreve nada no wrapper da seção", que é o
 * que faz o bloco seguir a loja sem override nenhum. A cor livre (hex) foi
 * descartada de propósito: o guia de marca tem 6 cores, e um hex solto
 * venceria o tema sazonal em vez de acompanhá-lo.
 */
function appearanceTitles(attachedTo: string): readonly FieldSpec[] {
  return [
    {
      name: "appearanceHeadingFont",
      label: "Fonte dos títulos",
      kind: "font",
      options: APPEARANCE_FONT_OPTIONS,
      optionLabels: APPEARANCE_FONT_LABELS,
      group: "Títulos",
      attachedTo,
    },
    {
      name: "appearanceHeadingColor",
      label: "Cor dos títulos",
      kind: "color",
      options: APPEARANCE_COLOR_OPTIONS,
      optionLabels: APPEARANCE_COLOR_LABELS,
      group: "Títulos",
      attachedTo,
    },
  ]
}

/** Trilho "Textos": a família e a cor dos textos corridos da seção. */
function appearanceTexts(attachedTo: string): readonly FieldSpec[] {
  return [
    {
      name: "appearanceTextFont",
      label: "Fonte dos textos",
      kind: "font",
      options: APPEARANCE_FONT_OPTIONS,
      optionLabels: APPEARANCE_FONT_LABELS,
      group: "Textos",
      attachedTo,
    },
    {
      name: "appearanceTextColor",
      label: "Cor dos textos",
      kind: "color",
      options: APPEARANCE_COLOR_OPTIONS,
      optionLabels: APPEARANCE_COLOR_LABELS,
      group: "Textos",
      attachedTo,
    },
  ]
}

/**
 * Trilho "Detalhes": a cor de destaque da seção — eyebrow, ícone, frase
 * manuscrita, realce do título, link "ver todos". É uma cor só, mas é a
 * que dá o tom.
 */
function appearanceDetails(attachedTo: string): readonly FieldSpec[] {
  return [
    {
      name: "appearanceAccentColor",
      label: "Cor dos detalhes",
      kind: "color",
      options: APPEARANCE_COLOR_OPTIONS,
      optionLabels: APPEARANCE_COLOR_LABELS,
      group: "Detalhes",
      attachedTo,
      help: "Eyebrow, ícones, frase manuscrita, realces, botões e links — o dourado/rosa da seção.",
    },
  ]
}

/**
 * Trilho "Fundo": a cor do bloco inteiro.
 *
 * Fica sempre no fim do formulário da seção — é a única escolha que vale
 * para o bloco todo, não para um elemento —, e por isso a âncora dele é o
 * último campo de conteúdo da seção.
 *
 * Escolher um fundo escuro (`preto`, `cacao` — `THEME_DARK_TOKENS`) faz o
 * storefront legibilizar o texto em off white por conta própria. A regra é
 * do render, não um campo: por isso o editor a **avisa** no trilho, em vez
 * de oferecer um campo "cor do texto no fundo escuro" que seria um segundo
 * jeito de dizer a mesma coisa.
 */
function appearanceBackground(attachedTo: string): readonly FieldSpec[] {
  return [
    {
      name: "appearanceBackgroundColor",
      label: "Cor de fundo",
      kind: "color",
      options: APPEARANCE_COLOR_OPTIONS,
      optionLabels: APPEARANCE_COLOR_LABELS,
      group: "Fundo",
      attachedTo,
    },
  ]
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
  // Aparência: a paleta e as fontes do tema, desenhadas como bolinhas de cor
  // e como uma lista de fontes com prévia — ver `THEME_COLOR_HEXES` e
  // `THEME_FONTS`. Continuam sendo escolha dentro de uma lista fechada: o
  // `validateData` da rota admin reprova o que estiver fora de `options`.
  | "color"
  | "font"
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
  /**
   * Tradução de cada opção, para o `<select>` do admin não ser só
   * jargão (`"dourado"` → `"Dourado Rosé"`). A chave é a opção; a
   * opção vazia se escreve `"": "…"`.
   *
   * A ordem quem manda é a de `options` — este mapa só traduz.
   */
  optionLabels?: Record<string, string>
  /**
   * Agrupamento visual no editor do admin (ex.: `"Títulos"`). Campo sem
   * grupo é conteúdo e aparece na ordem do contrato; campo com grupo é um
   * **trilho** de aparência e aparece logo abaixo do campo que ele veste.
   * Ver `APPEARANCE_GROUPS`.
   */
  group?: string
  /**
   * Nome do campo de conteúdo que este campo veste — o input debaixo do
   * qual ele é desenhado no editor (`"headline"` para a fonte e a cor dos
   * títulos do hero).
   *
   * Redundante com a posição no array de propósito: a ordem de
   * `SECTION_FIELDS` é o que o admin usa para montar o formulário, e este
   * campo é o que a guarda de paridade cobra para que a ordem não se perca
   * num `sort`, num agrupamento ou num `spread` fora de lugar. Sem ele, um
   * trilho pode acabar a três campos de distância do que ele muda — e nada
   * quebra.
   */
  attachedTo?: string
  help?: string
}

/** Campos de `data` por tipo de seção, na ordem em que o admin os mostra. */
export const SECTION_FIELDS: Record<SectionType, readonly FieldSpec[]> = {
  announcement: [
    { name: "text", label: "Mensagem", kind: "text", required: true },
    // A barra é uma linha só: tem a fonte e a cor do texto e a cor da
    // própria barra. Sem títulos nem detalhes para vestir.
    ...appearanceTexts("text"),
    ...appearanceBackground("text"),
  ],
  hero: [
    { name: "eyebrow", label: "Eyebrow", kind: "text" },
    { name: "headline", label: "Título", kind: "text", required: true },
    ...appearanceTitles("headline"),
    {
      name: "headlineEmphasis",
      label: "Título (parte em itálico)",
      kind: "text",
    },
    // O destaque do hero é a parte em itálico do título — e o botão, que
    // usa a mesma cor cheia.
    ...appearanceDetails("headlineEmphasis"),
    { name: "subtitle", label: "Subtítulo", kind: "text" },
    ...appearanceTexts("subtitle"),
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
    // Sem trilho de fundo: o fundo do hero é a fotografia.
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
    // A faixa veste tudo a partir da lista de itens: o título e o texto são
    // os de cada item, o detalhe é o ícone e o fundo é o da faixa.
    ...appearanceTitles("items"),
    ...appearanceTexts("items"),
    ...appearanceDetails("items"),
    ...appearanceBackground("items"),
  ],
  collections: [
    { name: "eyebrow", label: "Eyebrow", kind: "text" },
    // O destaque das coleções é o eyebrow — e o "ver coleção" do card.
    ...appearanceDetails("eyebrow"),
    { name: "title", label: "Título", kind: "text", required: true },
    ...appearanceTitles("title"),
    { name: "subtitle", label: "Subtítulo", kind: "textarea" },
    ...appearanceTexts("subtitle"),
    { name: "items", label: "Coleções", kind: "list:highlight" },
    // O fundo fecha a seção: é a única escolha que vale para o bloco todo.
    ...appearanceBackground("items"),
  ],
  featured: [
    { name: "eyebrow", label: "Eyebrow", kind: "text" },
    // O destaque da vitrine é o eyebrow — e o "ver todos" do fim.
    ...appearanceDetails("eyebrow"),
    { name: "title", label: "Título", kind: "text", required: true },
    ...appearanceTitles("title"),
    { name: "subtitle", label: "Subtítulo", kind: "textarea" },
    ...appearanceTexts("subtitle"),
    {
      name: "filters",
      label: "Filtros",
      kind: "list:text",
      help: 'Separe por vírgula. Inclua "Todos" para o filtro que limpa.',
    },
    { name: "viewAllLabel", label: "Link ver todos", kind: "text" },
    // O fundo fecha a seção: é a única escolha que vale para o bloco todo.
    ...appearanceBackground("viewAllLabel"),
  ],
  editorial: [
    // A frase manuscrita é o destaque do bloco (a seção "Sobre").
    { name: "script", label: "Frase manuscrita", kind: "text" },
    ...appearanceDetails("script"),
    { name: "title", label: "Título", kind: "text", required: true },
    ...appearanceTitles("title"),
    {
      name: "body",
      label: "Texto (conceito e história)",
      kind: "textarea",
      // A ajuda repete o casamento com o item do menu de propósito: é o
      // que o lojista procura ao abrir o formulário.
      help: 'Conteúdo da seção "Sobre": conceito da marca, história e valores. O item "Sobre" do menu rola até aqui.',
    },
    ...appearanceTexts("body"),
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
    // O fundo fecha a seção: é a única escolha que vale para o bloco todo.
    ...appearanceBackground("imagePosition"),
  ],
  instagram: [
    { name: "handle", label: "Perfil", kind: "text" },
    // O @ do perfil sai em destaque, não como texto corrido.
    ...appearanceDetails("handle"),
    { name: "title", label: "Título", kind: "text", required: true },
    ...appearanceTitles("title"),
    { name: "images", label: "Imagens", kind: "list:image" },
    // Sem trilho de texto: a faixa não tem texto corrido — o perfil é
    // destaque, o título é título e o resto é imagem. A cor de fundo, essa
    // sim, é o que dá o tom do bloco (o padrão é o preto).
    ...appearanceBackground("images"),
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
