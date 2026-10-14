/** Real Valor — Contrato de conteúdo (fonte da verdade): a ÚNICA definição
 * do formato da vitrine — os tipos das seções, os campos que o CRM edita
 * (`SECTION_FIELDS`) e as listas fechadas do tema. CRM, backend e storefront
 * importam o pacote `@rv/contrato`; `scripts/gen-content.mjs` só deriva daqui. */

// ===========================================================================
// INÍCIO DO BLOCO COMPARTILHADO — o que a loja lê em runtime: tipos das seções
// e listas fechadas do tema; abaixo do fim do bloco é só backend/CRM.
// ===========================================================================

/** Aparência da seção (opcional): cada campo guarda o **papel** do tema (`"dourado"`
 * → `var(--rv-dourado)`), não a cor literal; vazio é "segue a loja" (`appearanceVars`). */
export type SectionAppearance = {
  /** `FONT_ROLES`. Vazio já é o padrão da seção. */
  appearanceHeadingFont?: string
  appearanceTextFont?: string
  /** `THEME_COLOR_TOKENS`. */
  appearanceHeadingColor?: string
  appearanceTextColor?: string
  appearanceAccentColor?: string
  appearanceBackgroundColor?: string
}

/** Campos comuns a toda seção, independente do tipo. */
export type SectionBase = {
  /** Identificador estável — é o `id` do registro no banco. */
  id: string
  /** Quando false, a seção é omitida inteira pelo renderizador. */
  enabled: boolean
  /** Ordem de renderização, ascendente. */
  position: number
}

/** A velocidade do ticker da barra de anúncio, em segundos por volta: lida pelo
 * `min`/`max` de `SECTION_FIELDS.announcement` e pelo storefront
 * (`frontend/src/lib/util/ticker.ts`), a última defesa — o banco pode ter valor
 * anterior à faixa. Piso de 8s (abaixo não dá para ler), teto de 60s (acima
 * parece parado); quem confere o espelho é `ticker.spec.ts`. */
export const ANNOUNCEMENT_SPEED_MIN = 8
export const ANNOUNCEMENT_SPEED_MAX = 60
export const ANNOUNCEMENT_SPEED_DEFAULT = 24

/** A velocidade da faixa do Instagram, em **segundos por imagem** — unidade na
 * foto, não na volta (a volta é invisível: o storefront repete a lista até cobrir
 * a tela, `lib/util/marquee.ts`), para o ritmo não mudar sozinho quando o lojista
 * sobe uma foto. Espelha o `min`/`max` de `SECTION_FIELDS.instagram`; confere
 * `marquee.spec.ts`. Piso de 3s, teto de 12s. */
export const INSTAGRAM_SPEED_MIN = 3
export const INSTAGRAM_SPEED_MAX = 12
export const INSTAGRAM_SPEED_DEFAULT = 6

export type AnnouncementSection = SectionBase &
  SectionAppearance & {
    type: "announcement"
    /** A mensagem única, uma linha centrada — vale **quando não há `messages`**
     * (base antiga), e é o que faz esta mudança não ter migração. */
    text: string
    /** As mensagens do ticker: com **duas ou mais** a barra rola sozinha em laço;
     * com **uma só**, fica parada e centrada. Vazio é o caso do `text`. */
    messages?: string[]
    /** Quantos segundos o ticker leva para dar uma volta (`ANNOUNCEMENT_SPEED_*`). */
    speedSeconds?: number
  }

/** A capa da home — a abertura da página. Desde a v9 tem **uma forma só**, a lista
 * de slides: quem preenchia a foto de cima não via mudança nenhuma na loja. */
export type HeroSection = SectionBase & {
  type: "hero"
  /** Os slides da capa, na ordem — a capa **é** esta lista: um item é a capa
   * estática, dois ou mais o carrossel, e lista vazia não desenha capa. */
  slides: HeroSlide[]
  /** A nota da capa: a linha do canto, **da faixa** — no carrossel ela não troca
   * junto com a foto. Vazia, não é desenhada. */
  note?: string
}

/** Um slide da capa: a foto e a cópia da capa ou do carrossel. A ordem dos campos é
 * a do sub-formulário no CRM (`ITEM_FIELDS["list:hero-slide"]`); o scrim é desenho. */
export type HeroSlide = {
  imageUrl: string
  imageAlt: string
  eyebrow: string
  headline: string
  headlineEmphasis: string
  subtitle: string
  ctaLabel: string
  ctaHref: string
}

export type BenefitItem = {
  /** Chave de ícone resolvida por `frontend/src/lib/content/icons.ts`. */
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
    /** O formato da faixa: `cards` (grade de três cartões) ou `banners` (dois banners
     * largos). Ausente ou desconhecido = `cards`. */
    layout?: "cards" | "banners"
    items: CollectionHighlight[]
  }

/** Uma categoria do catálogo: `categoryId` é a **referência** (o `category_id` da
 * Store API) e `label`/`handle` são lidos ao vivo, então renomear muda o chip. */
export type CategoryRef = {
  categoryId: string
  label: string
  handle: string
}

export type FeaturedSection = SectionBase &
  SectionAppearance & {
    type: "featured"
    eyebrow: string
    title: string
    subtitle: string
    /** Chips de filtro: **referências** às categorias do catálogo (o link
     * `content_section_category`), na ordem. Não é lista de rótulos: era, e o chip
     * mandava o rótulo como busca — medido no banco real, "Blazers" não existe no
     * catálogo e devolvia zero peças **em silêncio**. O chip "Todos" não entra
     * aqui: quem o desenha é a loja. */
    filters?: CategoryRef[]
    viewAllLabel: string
  }

/** Lançamentos — o trilho de novidades depois do hero, com `scroll-snap` em vez de
 * grade. **A fonte do conteúdo é a loja, não o CMS:** a seção carrega só a cópia e
 * o `limit`, e os produtos vêm da Store API, do mais novo para o mais antigo. */
export type LaunchesSection = SectionBase &
  SectionAppearance & {
    type: "launches"
    eyebrow: string
    title: string
    subtitle: string
    /** Quantos produtos o trilho mostra. A faixa é declarada em
     * `SECTION_FIELDS.launches`; o storefront tem o mesmo piso (`lib/util/launches.ts`). */
    limit: number
    viewAllLabel: string
    viewAllHref: string
  }

export type EditorialSection = SectionBase &
  SectionAppearance & {
    type: "editorial"
    /** Linha manuscrita em Allura. */
    script: string
    /** O eyebrow acima do título — a etiqueta que diz de que o bloco fala. */
    eyebrow?: string
    title: string
    /** O realce do título: a segunda linha dele, em itálico (`<em>`). Vazio, o
     * título é uma linha só. */
    titleEmphasis?: string
    body: string
    ctaLabel: string
    ctaHref: string
    imageUrl: string
    imageAlt: string
    imagePosition: "left" | "right"
  }

/** A faixa editorial: foto larga, cópia por cima e botão para o catálogo — a
 * última faixa da home. **Não é** a `editorial` (o manifesto, foto ao lado do
 * texto) nem o `hero` (que abre a página). A foto **é** o fundo, então não há
 * campo de posição de imagem. */
export type BannerSection = SectionBase &
  SectionAppearance & {
    type: "banner"
    /** O eyebrow acima do título; em branco, a faixa desenha só o título. */
    eyebrow?: string
    title: string
    /** O realce do título: a segunda linha, em itálico (`<em>`) — como no
     * `editorial`. Vazio, o título é uma linha só. */
    titleEmphasis?: string
    imageUrl: string
    imageAlt: string
    ctaLabel: string
    ctaHref: string
  }

/** Como um bloco do texto longo se lê — as opções do `<select>` de `prose.blocks`,
 * que viajam em `ITEM_FIELDS`. O **primeiro** é o `kind` de um bloco novo. */
export const PROSE_BLOCK_KINDS = [
  "paragraph",
  "subtitle",
  "bullets",
] as const

export type ProseBlockKind = (typeof PROSE_BLOCK_KINDS)[number]

/** A tradução de cada `kind` para o `<select>` — `bullets` é "Lista", não jargão. */
export const PROSE_BLOCK_KIND_LABELS: Record<ProseBlockKind, string> = {
  paragraph: "Parágrafo",
  subtitle: "Subtítulo",
  bullets: "Lista",
}

/** O texto longo (`prose`) e um bloco dele. **A estrutura é dado, e não marca:** o
 * campo de texto aceita só as marcas inline de 14.6.3 (`**negrito**`, `_itálico_`,
 * `~~riscado~~`, `[texto](/rota)`) — um `##` no meio do texto não é subtítulo, é
 * dois cerquilhas na tela. Os três campos existem nos três `kind` e o render
 * escolhe: `subtitle`/`paragraph` leem `text`, `bullets` lê `items`. */
export type ProseBlock = {
  /** `subtitle` é um `<h2>` dentro do texto, `paragraph` um `<p>`, `bullets` um `<ul>`. */
  kind: ProseBlockKind
  /** O texto do bloco, com as marcas inline (`markdown`) — vale em `subtitle` e `paragraph`. */
  text: string
  /** As linhas da lista, uma por `<li>` — vale em `bullets`. */
  items: string[]
}

/** A seção de texto longo: um título e a estrutura do texto. Sem trilho de
 * aparência, como o `faq`. Quem desenha é `modules/content/prose.tsx`. */
export type ProseSection = SectionBase & {
  type: "prose"
  /** O `<h2>` da seção. Em branco, o texto começa direto nos blocos. */
  title: string
  /** A estrutura do texto, na ordem em que ela se lê. */
  blocks: ProseBlock[]
  /** O anexo da página (a **chave** do arquivo enviado, ou `""`): o aviso
   * assinado, o contrato de troca. Vazio significa **sem botão**. */
  documentUrl: string
  /** O que o botão de baixar diz. Vazio cai no rótulo genérico "Baixar o
   * documento (PDF)". */
  documentLabel: string
}

/** Uma pergunta frequente: o par pergunta/resposta é a razão do tipo — `faq.tsx`
 * publica só o par completo. A pergunta é `text` e a resposta é `markdown`. */
export type FaqItem = {
  /** A linha clicável — o texto do `<summary>`. */
  question: string
  /** A resposta, com as marcas inline do `prose`. */
  answer: string
}

/** As perguntas frequentes (`faq`): o `<details>/<summary>` nativo é acessível por
 * teclado e indexado, sem JavaScript. Desenha `modules/content/faq.tsx`. */
export type FaqSection = SectionBase & {
  type: "faq"
  /** O `<h2>` da seção. Em branco, a lista começa direto nas perguntas. */
  title: string
  /** As perguntas, na ordem em que elas se leem. */
  items: FaqItem[]
}

export type InstagramSection = SectionBase &
  SectionAppearance & {
    type: "instagram"
    handle: string
    title: string
    images: { imageUrl: string; imageAlt: string }[]
    /** Quantos segundos **cada imagem** leva para atravessar a faixa
     * (`INSTAGRAM_SPEED_*`): com duas ou mais ela rola em laço; com uma, é grade. */
    secondsPerImage?: number
  }

/** Item do menu do cabeçalho: o `href` define o comportamento (não há campo "modo"):
 * `#hero` rola, `/store` navega, `https://` abre em nova aba e `mailto:` o contato. */
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

/** Menu do cabeçalho: não é seção da home, mas mora na mesma tabela e superfície
 * (`home`) — daí o `id` fixo `nav`. Ordem: `links` no centro, `actions` à direita. */
export type NavSection = SectionBase & {
  type: "nav"
  links: HeaderLink[]
  actions: HeaderAction[]
}

/** De onde vêm os itens de uma coluna do rodapé: `links` (o padrão, digitados),
 * `pages` (as páginas **no ar**, as que respondem 200), `categories` e
 * `collections` (do catálogo, ao vivo). `pages` fecha o defeito de 14.16: link
 * digitado respondia 404 — "o link está quebrado", pior que "não existe". A lista
 * sai de `publishedSections`, a régua do `[slug]` e do `sitemap`. */
export const FOOTER_COLUMN_SOURCES = [
  "links",
  "pages",
  "categories",
  "collections",
] as const

export type FooterColumnSource = (typeof FOOTER_COLUMN_SOURCES)[number]

/** Coluna de links do rodapé (ex.: "Institucional"), sempre conteúdo — o lojista
 * insere, edita, reordena e remove todas. `source` de catálogo ignora os `links`. */
export type FooterColumn = {
  title: string
  /** Ausente/desconhecido conta como `"links"` (dado gravado antes). */
  source: FooterColumnSource
  links: HeaderLink[]
}

/** Ícone social do rodapé. */
export type FooterSocial = {
  /** Chave resolvida por `frontend/src/lib/content/social-icons.tsx`. */
  icon: string
  /** Nome acessível do ícone — ele não tem texto visível. */
  label: string
  href: string
}

/** Rodapé da loja: como o `nav`, aparece em todas as rotas (o layout o desenha) e o
 * `id` fixo `footer` vem do seed. A marca e a linha de direitos ficam no componente. */
export type FooterSection = SectionBase & {
  type: "footer"
  /** Colunas de links, na ordem da lista. Cada item decide de onde vêm os itens
   * (`source`); coluna sem título ou sem itens não aparece na loja. */
  columns: FooterColumn[]
  social: FooterSocial[]
}

export type HomeSection =
  | AnnouncementSection
  | HeroSection
  | BenefitsSection
  | CollectionsSection
  | FeaturedSection
  | LaunchesSection
  | EditorialSection
  | BannerSection
  | ProseSection
  | FaqSection
  | InstagramSection
  | NavSection
  | FooterSection

/** Todo `type` de seção válido, como valor — para validação em runtime. */
export const SECTION_TYPES = [
  "announcement",
  "hero",
  // A ordem deste array é a do seletor do CRM e a das casas (`FIXED_SECTION_POSITIONS`,
  // `order.ts`): 5 lançamentos, 6 coleções, 7 Sobre, 8 a faixa, 9 destaques, 11 Instagram.
  "benefits",
  "launches",
  "collections",
  "editorial",
  "banner",
  // O `prose` (F2 do doc 14) é o primeiro tipo que existe só em página: não está
  // no conteúdo padrão da vitrine.
  "prose",
  // O `faq` é o segundo desse caso, e o par do `prose` — vem logo depois para o
  // seletor do CRM deixar os dois lado a lado.
  "faq",
  "featured",
  "instagram",
  // Não é seção da home: é o cabeçalho, desenhado pelo layout em todas as rotas.
  "nav",
  // Mesmo caso do `nav`: o rodapé é cromo do site, não seção da home.
  "footer",
] as const

export type SectionType = (typeof SECTION_TYPES)[number]

export function isSectionType(value: unknown): value is SectionType {
  return (
    typeof value === "string" &&
    (SECTION_TYPES as readonly string[]).includes(value)
  )
}

/** Tipos que só podem existir **uma vez** por superfície e que têm **casa ancorada**
 * (`FIXED_SECTION_POSITIONS`). Dois grupos, os dois com a etiqueta **Fixo** no CRM:
 * o cromo do site (`announcement`, `nav`, `footer` — resolvido por `find` em
 * `lib/content/home-sections.ts`) e a abertura da home (`hero`, `benefits`). Um
 * segundo bloco seria o pior defeito num CMS: o lojista cria, o CRM lista e a loja
 * **nunca** desenha — por isso a API recusa e o CRM não oferece. */
export const SINGLETON_SECTION_TYPES = [
  "announcement",
  "nav",
  "hero",
  "benefits",
  "footer",
] as const

export type SingletonSectionType = (typeof SINGLETON_SECTION_TYPES)[number]

export function isSingletonSectionType(
  value: unknown
): value is SingletonSectionType {
  return (
    typeof value === "string" &&
    (SINGLETON_SECTION_TYPES as readonly string[]).includes(value)
  )
}

/** Papéis de cor do tema (`ThemeColors` de `lib/theme.ts`, os tokens `--rv-*` de
 * `brand.css`). É lista, e não só um union: as pontas precisam dos mesmos valores. */
export const THEME_COLOR_TOKENS = [
  "rose",
  "offwhite",
  "cacao",
  "grafite",
  "preto",
  "dourado",
] as const

export type ThemeColorToken = (typeof THEME_COLOR_TOKENS)[number]

/** A paleta do tema padrão — **a origem dos hex**. Serve ao editor (sem os hex o painel
 * só teria a palavra "rose") e ao gerador (`gen-content.mjs`). O lojista grava o papel. */
export const THEME_COLOR_HEXES: Record<ThemeColorToken, string> = {
  rose: "#B97872",
  offwhite: "#F7F1E8",
  cacao: "#4A3531",
  grafite: "#303033",
  preto: "#171717",
  dourado: "#D4B19A",
}

/** Papéis de fonte do tema (`ThemeFonts`): títulos, textos e a manuscrita. */
export const FONT_ROLES = ["display", "sans", "script"] as const

export type FontRole = (typeof FONT_ROLES)[number]

export type ThemeFont = {
  /** A família declarada no `@font-face` da loja e da prévia do painel. */
  family: string
  /** O que o navegador usa se o `.woff2` não chegar. */
  fallback: string
  /** `family` + `fallback`: a pilha inteira, como o `--rv-font-*` a recebe. */
  stack: string
}

/** Monta uma fonte a partir da família e do fallback. A pilha é **derivada**: as
 * três saem daqui (a loja, o `brand.css` e `assets.unit.spec.ts`, que confere). */
function themeFont(family: string, fallback: string): ThemeFont {
  return { family, fallback, stack: `"${family}", ${fallback}` }
}

/** A família, o fallback e a pilha de cada papel de fonte — mesma razão de
 * `THEME_COLOR_HEXES`: o `<select>` do admin desenha a opção **na própria fonte**. A
 * paridade confere o md5 dos `.woff2` (sem arquivo, a prévia mente). */
export const THEME_FONTS: Record<FontRole, ThemeFont> = {
  display: themeFont("Playfair Display", "Georgia, serif"),
  sans: themeFont("Montserrat", "system-ui, sans-serif"),
  script: themeFont("Allura", "cursive"),
}

/** Cores do tema que são fundo escuro. Nenhum `<select>` as oferece: servem para o
 * storefront auto-legibilizar — fundo escuro **sem** cor de texto escolhida vira off
 * white, porque grafite sobre preto seria ilegível. A escolha explícita vence. */
export const THEME_DARK_TOKENS = ["preto", "cacao"] as const

/** Rótulos dos trilhos de aparência: cada trilho aparece **dentro** do conteúdo,
 * logo abaixo do campo que ele veste (o `attachedTo` do `FieldSpec`; o `group` é o
 * rótulo). A ordem é a dos trilhos quando dois caem no mesmo campo. */
export const APPEARANCE_GROUPS = [
  "Títulos",
  "Textos",
  "Detalhes",
  "Fundo",
] as const

export type AppearanceGroup = (typeof APPEARANCE_GROUPS)[number]

/** Nome do campo de `data` que carrega cada cor do tema (`rose` → `colorRose`): a
 * paleta é campo como outro — grava o CRM (`THEME_FIELDS`), lê a loja (`lib/theme.ts`). */
export function themeColorField(token: ThemeColorToken): string {
  return `color${token[0].toUpperCase()}${token.slice(1)}`
}

/** Nome do campo de `data` que carrega cada papel de fonte (`sans` → `fontSans`). */
export function themeFontField(role: FontRole): string {
  return `font${role[0].toUpperCase()}${role.slice(1)}`
}

// ===========================================================================
// FIM DO BLOCO COMPARTILHADO — daqui para baixo é só backend/admin: os trilhos de
// aparência, o `SECTION_FIELDS` que o CRM consome e a paleta/fontes de prévia.
// ===========================================================================

/** A **casa** de cada seção fixa: a posição que ela ocupa sempre — 1 barra de
 * anúncio, 2 cabeçalho, 3 capa, 4 benefícios e 10 rodapé. A renumeração do
 * "Salvar ordem" não as toca: as ordenáveis caem nas casas livres (5 a 9 e,
 * depois, 11 — a 10 é do rodapé), como em `order.ts`. Mora abaixo do bloco
 * compartilhado porque quem lê as casas é o backend (`defaults.ts`, `restore.ts`). */
export const FIXED_SECTION_POSITIONS: Record<SingletonSectionType, number> = {
  announcement: 1,
  nav: 2,
  hero: 3,
  benefits: 4,
  footer: 10,
}

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

/** Um trilho de aparência: os campos de um mesmo `group`, ancorados no campo de
 * conteúdo que eles vestem (`attachedTo`). Quem chama informa a âncora e
 * `SECTION_FIELDS` espalha o retorno logo depois do campo citado — a ordem do array
 * é a do formulário do admin, e a paridade cobra que o trilho venha depois do campo.
 * A primeira opção de todo campo é a vazia ("Padrão do tema da loja"). */
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

/** Trilho "Detalhes": a cor de destaque da seção — eyebrow, ícone, frase
 * manuscrita, realce do título e link "ver todos". */
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

/** Trilho "Fundo": a cor do bloco inteiro — fica no fim do formulário. Fundo escuro
 * (`THEME_DARK_TOKENS`) legibiliza o texto em off white; o editor só **avisa**. */
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

/** Contrato por tipo: campos que vivem em `data` (JSON) — valida a entrada da API
 * admin antes de gravar e deriva o formulário do widget. */
export type FieldKind =
  | "text"
  // Destino (**href**): o `text` de um endereço com a **lista das rotas conhecidas**
  // ao lado; a lista **sugere**, não tranca (`mailto:`, `tel:`, `https://…`).
  | "href"
  | "textarea"
  // Texto **formatado**: a mesma caixa, com um subconjunto fechado de marcas inline
  // (`MARKDOWN_MARKS`) gravado como **texto**; quem interpreta é `renderInline`.
  | "markdown"
  | "number"
  | "select"
  // Imagem: campo com envio de arquivo. Grava a **chave** (`1699999999-hero.jpg`),
  // nunca a URL; quem traduz é `resolveMediaUrl` (`lib/util/media.ts`).
  | "image"
  // Documento anexo: envio de arquivo, como a imagem — e a loja **não desenha**,
  // publica um botão que baixa. O anexo **complementa** o texto (14.6.3).
  | "document"
  // Aparência: a paleta e as fontes do tema em lista fechada (`validateData`).
  | "color"
  | "font"
  // Cor **literal** (`#RRGGBB`): a paleta de uma estação, o único campo em que o
  // valor gravado é o hex. O formato quem cobra é o `pattern` do campo.
  | "hex"
  // Lista de **referências** a categorias (ids), com a ordem: o campo dos chips da
  // vitrine. `label`/`handle` são lidos da categoria na hora de desenhar.
  | "list:category"
  // Lista de textos simples, uma caixa por texto, sem sub-campos. Era um input único
  // separado por vírgula, e o separador **dentro** do campo era o defeito: a vírgula
  // recém-digitada sumia e as mensagens colavam numa só.
  | "list:text"
  // Lista de textos **formatados**, uma caixa por item — o `list:text` do texto
  // longo. Como ele, não entra em `ITEM_FIELDS`.
  | "list:markdown"
  // O slide da capa (`hero.slides`), o sub-formulário do tipo `HeroSlide` — item de
  // lista como o `list:highlight`, com a mesma forma.
  | "list:hero-slide"
  | "list:benefit"
  | "list:highlight"
  | "list:image"
  | "list:link"
  | "list:action"
  // O bloco do texto longo: o `kind`, o texto e as linhas da lista — o único `list:*`
  // cujo item tem, ele mesmo, uma lista dentro.
  | "list:proseBlock"
  // A pergunta frequente: pergunta (`text`) e resposta (`markdown`). O tipo que ele
  // espelha é o `FaqItem`.
  | "list:faqItem"
  // Item com sub-lista dentro (`links`): o editor desenha os níveis internos.
  | "list:column"
  | "list:social"

export type FieldSpec = {
  name: string
  label: string
  kind: FieldKind
  required?: boolean
  /** Apenas para `select`. */
  options?: readonly string[]
  /** Formato esperado do valor, como **fonte de regex** (`HEX_COLOR_PATTERN`): a rota
   * admin reprova o que não casar — senão um `#B9787` chegaria à loja como variável
   * CSS inválida, e a cor sumiria sem erro. */
  pattern?: string
  /** Tradução de cada opção, para o `<select>` não ser só jargão (`"dourado"` →
   * `"Dourado Rosé"`). A ordem quem manda é a de `options`. */
  optionLabels?: Record<string, string>
  /** Agrupamento visual no editor (ex.: `"Títulos"`): campo com grupo é um
   * **trilho** de aparência, e aparece abaixo do campo que veste. */
  group?: string
  /** Nome do campo de conteúdo que este campo veste — o input debaixo do qual ele é
   * desenhado. Redundante com a posição no array de propósito: é o que a guarda de
   * paridade cobra para que a ordem não se perca num `sort` ou `spread`. */
  attachedTo?: string
  help?: string
  /** Faixa de um campo `number` (mínimo, máximo e passo). Declarada no campo: se
   * estivesse no `field-input.tsx`, todo campo numérico herdaria a faixa do primeiro
   * que a tem. A rota admin reprova o valor fora dela. */
  min?: number
  max?: number
  /** Passo do `<input type="number">`; ausente vale 1. */
  step?: number
}

/** A ajuda dos campos de destino (`kind: "href"`): a frase é a mesma em todos — existe
 * uma lista para escolher, e o texto continua valendo para o que **não** é rota. */
const HREF_HELP =
  "Escolha um destino da lista (as rotas que a loja tem) ou escreva o " +
  "endereço: um caminho do site (ex.: /sobre), uma âncora da vitrine " +
  "(ex.: /#editorial), uma URL completa (https://…) ou um contato " +
  "(mailto:, tel:)."

/** Campos de `data` por tipo de seção, na ordem em que o admin os mostra. */
export const SECTION_FIELDS: Record<SectionType, readonly FieldSpec[]> = {
  announcement: [
    // Deixou de ser obrigatória na v8: quem preenche o ticker pode esvaziar a
    // mensagem única sem a API recusar. Vale **quando não há ticker**.
    {
      name: "text",
      label: "Mensagem única",
      kind: "text",
      help: "A barra fica parada nesta mensagem quando não houver mensagens no ticker abaixo. Foi assim que a barra nasceu.",
    },
    {
      name: "messages",
      label: "Mensagens do ticker",
      kind: "list:text",
      help: "Uma caixa por mensagem — o ticker rola sozinho com duas ou mais e fica parado com uma. O que estiver aqui substitui a mensagem única; colar uma lista separada por vírgulas cria várias caixas de uma vez.",
    },
    // A barra é uma linha só: tem a fonte, a cor do texto e a cor da barra.
    ...appearanceTexts("messages"),
    ...appearanceBackground("messages"),
    // A velocidade vem **depois** dos trilhos de propósito: o `attachedTo` exige o
    // trilho logo abaixo do último campo de conteúdo — aqui, `messages`.
    {
      name: "speedSeconds",
      label: "Segundos por volta",
      kind: "number",
      min: ANNOUNCEMENT_SPEED_MIN,
      max: ANNOUNCEMENT_SPEED_MAX,
      step: 1,
      help: "Quanto tempo o ticker leva para dar uma volta completa. A rolagem para no mouse e no teclado.",
    },
  ],
  hero: [
    // A capa é **só** isto: a lista de slides. Até a v9 havia os campos de um slide
    // fora dela, e quem preenchia a foto de cima não via mudança nenhuma na loja.
    // Sem trilho de fundo (o fundo é a fotografia) nem de títulos.
    {
      name: "slides",
      label: "Slides da capa",
      kind: "list:hero-slide",
      help: "Um item por capa, na ordem em que aparecem. Um item só é a capa estática; dois ou mais viram carrossel automático. Sem nenhum item a capa não é desenhada.",
    },
    // A nota é **da faixa**, não do slide: no carrossel ela não troca com a foto.
    {
      name: "note",
      label: "Nota da capa",
      kind: "text",
      help: 'A linha do canto da capa — o recado que fecha a foto, uma vez só, para a faixa inteira. Ex.: "Peças que acompanham quem você é — e quem está se tornando.". Em branco, a nota não é desenhada.',
    },
  ],
  launches: [
    { name: "eyebrow", label: "Eyebrow", kind: "text" },
    // O destaque do trilho é o eyebrow — e o "ver tudo" do fim.
    ...appearanceDetails("eyebrow"),
    { name: "title", label: "Título", kind: "text", required: true },
    ...appearanceTitles("title"),
    { name: "subtitle", label: "Subtítulo", kind: "textarea" },
    ...appearanceTexts("subtitle"),
    {
      // O `limit` é o número com faixa da seção: os produtos vêm da loja, então o
      // que o lojista escolhe aqui é QUANTOS.
      name: "limit",
      label: "Quantos produtos",
      kind: "number",
      min: 2,
      max: 12,
      step: 1,
      help: "Os mais recentes primeiro. 8 cabem na tela larga sem cortar um card no meio.",
    },
    { name: "viewAllLabel", label: "Link ver tudo", kind: "text" },
    {
      name: "viewAllHref",
      label: "Destino do link",
      kind: "href",
      help: HREF_HELP,
    },
    // O fundo fecha a seção: é a única escolha que vale para o bloco todo.
    ...appearanceBackground("viewAllHref"),
  ],
  benefits: [
    {
      name: "items",
      label: "Itens",
      kind: "list:benefit",
      // O layout acompanha a contagem: o lojista não precisa de um número "certo".
      help: "A faixa se adapta à quantidade: 2 por linha no celular e de 5 a 7 por linha no desktop, conforme a largura da tela. O que sobrar de uma linha ocupa a linha inteira.",
    },
    // A faixa veste tudo a partir da lista: o título e o texto são de cada item.
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
    {
      name: "layout",
      label: "Formato",
      kind: "select",
      options: ["cards", "banners"] as const,
      optionLabels: {
        cards: "Cartões (grade de 3)",
        banners: "Banners largos (linha de 2)",
      },
      help: "Cartões é a grade de três colunas de hoje; banners é a faixa de dois banners largos, um ao lado do outro.",
    },
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
      // Referência, e não texto: o que se escolhe são **categorias do catálogo**,
      // e o rótulo do chip é o nome delas, lido na hora.
      kind: "list:category",
      help: 'Escolha as categorias que viram chips na vitrine. O chip "Todos" (limpa o filtro) a loja desenha sozinha: ele não é uma categoria.',
    },
    { name: "viewAllLabel", label: "Link ver todos", kind: "text" },
    // O fundo fecha a seção: é a única escolha que vale para o bloco todo.
    ...appearanceBackground("viewAllLabel"),
  ],
  editorial: [
    // A frase manuscrita é o destaque do bloco (a seção "Sobre").
    { name: "script", label: "Frase manuscrita", kind: "text" },
    ...appearanceDetails("script"),
    // O eyebrow entra depois do trilho de propósito: a cor de detalhes vale para ele.
    { name: "eyebrow", label: "Eyebrow", kind: "text" },
    { name: "title", label: "Título", kind: "text", required: true },
    {
      name: "titleEmphasis",
      label: "Realce do título",
      kind: "text",
      help: "A segunda linha do título, em itálico — a que a loja desenha em <em>. Em branco, o título é uma linha só.",
    },
    // O trilho dos títulos veste os dois campos do título: fica abaixo do segundo.
    ...appearanceTitles("titleEmphasis"),
    {
      name: "body",
      label: "Texto (conceito e história)",
      kind: "textarea",
    // A ajuda repete o casamento com o item do menu de propósito: é o que se procura.
      help: 'Conteúdo da seção "Sobre": conceito da marca, história e valores. O item "Sobre" do menu rola até aqui.',
    },
    ...appearanceTexts("body"),
    { name: "ctaLabel", label: "Texto do botão", kind: "text" },
    {
      name: "ctaHref",
      label: "Link do botão",
      kind: "href",
      help: HREF_HELP,
    },
    {
      name: "imageUrl",
      label: "Imagem",
      kind: "image",
      help: "Envie a foto pelo botão, ou informe um caminho do site (ex.: /brand/story-1.jpg) ou uma URL.",
    },
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
  banner: [
    {
      name: "imageUrl",
      label: "Imagem",
      kind: "image",
      // A foto é o fundo inteiro: sem ela não há faixa — por isso é obrigatória.
      required: true,
      help: "A foto que ocupa a faixa inteira. Envie pelo botão, ou informe um caminho do site (ex.: /brand/story-2.jpg) ou uma URL.",
    },
    { name: "imageAlt", label: "Imagem (alt)", kind: "text" },
    { name: "eyebrow", label: "Eyebrow", kind: "text" },
    { name: "title", label: "Título", kind: "text", required: true },
    {
      name: "titleEmphasis",
      label: "Realce do título",
      kind: "text",
      help: "A segunda linha do título, em itálico — a que a loja desenha em <em>. Em branco, o título é uma linha só.",
    },
    // Como no hero, o trilho veste a cópia sobre a foto; sem fundo e sem detalhes.
    ...appearanceTitles("titleEmphasis"),
    { name: "ctaLabel", label: "Texto do botão", kind: "text" },
    {
      name: "ctaHref",
      label: "Link do botão",
      kind: "href",
      help: HREF_HELP,
    },
  ],
  prose: [
    {
      name: "title",
      label: "Título",
      kind: "text",
      help: "O título da seção, desenhado em <h2>. Em branco, o texto começa direto no primeiro bloco.",
    },
    {
      name: "blocks",
      label: "Blocos de texto",
      kind: "list:proseBlock",
      help: "Ordem da lista = ordem na página. Cada bloco é um subtítulo, um parágrafo ou uma lista; o texto aceita negrito, itálico, riscado e link pela barra acima da caixa. Bloco sem texto não aparece na loja.",
    },
    {
      name: "documentUrl",
      label: "Documento (PDF)",
      kind: "document",
      help: "O anexo da página — o aviso assinado, o contrato de troca, a tabela de medidas. A loja publica um botão de baixar abaixo do texto; sem arquivo, não há botão.",
    },
    {
      name: "documentLabel",
      label: "Rótulo do documento",
      kind: "text",
      help: 'O que o botão de baixar diz (ex.: "Baixar o aviso assinado (PDF)"). Em branco, o botão diz "Baixar o documento (PDF)".',
    },
  ],
  faq: [
    {
      name: "title",
      label: "Título",
      kind: "text",
      help: "O título da seção, desenhado em <h2>. Em branco, a lista começa direto nas perguntas.",
    },
    {
      name: "items",
      label: "Perguntas",
      kind: "list:faqItem",
      help: "Ordem da lista = ordem na página. Cada item é uma pergunta e a resposta que ela abre; a resposta aceita negrito, itálico, riscado e link pela barra acima da caixa. Item sem pergunta ou sem resposta não aparece na loja.",
    },
  ],
  instagram: [
    { name: "handle", label: "Perfil", kind: "text" },
    // O @ do perfil sai em destaque, não como texto corrido.
    ...appearanceDetails("handle"),
    { name: "title", label: "Título", kind: "text", required: true },
    ...appearanceTitles("title"),
    { name: "images", label: "Imagens", kind: "list:image" },
    // Sem trilho de texto: a faixa não tem texto corrido. O fundo é que dá o tom.
    ...appearanceBackground("images"),
    // A velocidade vem depois dos trilhos de propósito, como na barra de anúncio:
    // o `attachedTo` exige o trilho logo abaixo do último campo de conteúdo.
    {
      name: "secondsPerImage",
      label: "Segundos por imagem",
      kind: "number",
      min: INSTAGRAM_SPEED_MIN,
      max: INSTAGRAM_SPEED_MAX,
      step: 1,
      help: "Quanto tempo cada imagem leva para atravessar a faixa. Com duas ou mais imagens a faixa rola sozinha, em laço, e para no mouse e no teclado; com uma só, ela fica parada.",
    },
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

// ===========================================================================
// O QUE O CRM DESENHA ALÉM DOS CAMPOS DE SEÇÃO — `SECTION_TYPE_LABELS`,
// `ITEM_FIELDS`, `ICON_LABELS` e `MARKDOWN_MARKS`, os quatro no `schema` do
// `GET /admin/content`; quem os desenha é o `field-input.tsx` do admin.
// ===========================================================================

/** Rótulo de cada tipo na listagem: não é tradução do `type` — o `editorial` se chama
 * **Sobre**, e `nav`/`footer` são cromo. Uma tabela no admin mostraria jargão. */
export const SECTION_TYPE_LABELS: Record<SectionType, string> = {
  announcement: "Barra de anúncio",
  hero: "Hero",
  launches: "Lançamentos",
  benefits: "Faixa de benefícios",
  collections: "Coleções em destaque",
  featured: "Peças em destaque",
  editorial: "Sobre",
  banner: "Banner editorial",
  prose: "Texto longo",
  faq: "Perguntas frequentes",
  instagram: "Instagram",
  nav: "Cabeçalho",
  footer: "Rodapé",
}

/** Tradução de cada chave de ícone oferecida em `ITEM_FIELDS` — quem desenha é o
 * registro do storefront (`lib/content/icons.ts`); sem ela o `<select>` é jargão. */
export const ICON_LABELS: Record<string, string> = {
  quality: "qualidade",
  price: "preço",
  sizes: "tamanhos",
  delivery: "entrega",
  bag: "sacola — usa o carrinho, com contador",
  account: "conta",
  search: "busca",
  whatsapp: "WhatsApp",
  mail: "e-mail",
  phone: "telefone",
  pin: "localização",
  // Redes sociais do rodapé (`list:social`), com registro próprio (`social-icons.tsx`).
  instagram: "Instagram",
  facebook: "Facebook",
  youtube: "YouTube",
}

/** As marcas do texto formatado (o campo `markdown`): o que a barra do CRM oferece
 * — `open`/`close` para envolver a seleção, `element` para a spec cobrar o desenho.
 * O valor gravado é **texto**, e quem o interpreta devolve nós React. */
export const MARKDOWN_MARKS = [
  { label: "Negrito", open: "**", close: "**", element: "strong" },
  { label: "Itálico", open: "_", close: "_", element: "em" },
  { label: "Riscado", open: "~~", close: "~~", element: "s" },
  // A única assimétrica, e a única com risco: `[clique](javascript:alert(1))` é XSS
  // **sem HTML nenhum**. O botão insere a forma segura (`](/rota)`) e o `href` é
  // allowlist: o que não passa sai como texto.
  { label: "Link", open: "[", close: "](/rota)", element: "a" },
] as const

export type MarkdownMark = (typeof MARKDOWN_MARKS)[number]

/** O rótulo diz de onde os itens **saem**: quem escolhe `categories` precisa saber
 * que a lista passa a ser o catálogo ao vivo. */
export const FOOTER_COLUMN_SOURCE_LABELS: Record<FooterColumnSource, string> = {
  links: "os links digitados abaixo",
  pages: "as páginas que estão no ar",
  categories: "as categorias do catálogo",
  collections: "as coleções do catálogo",
}

/** Um campo de um item de lista — o que o editor desenha dentro de um item. Tipo à
 * parte de `FieldSpec` de propósito: item não tem trilho de aparência nem `attachedTo`,
 * e `kind` só existe no item que é lista. */
export type ItemFieldSpec = {
  name: string
  label: string
  /** `list:*` desenha uma lista dentro do item; ausente é campo simples. */
  kind?: FieldKind
  /** Opções do `<select>`; a primeira é o valor de um item novo. */
  options?: readonly string[]
  /** Tradução de cada opção, para o `<select>` não ser só jargão. */
  optionLabels?: Record<string, string>
  /** Em branco é um valor válido (o ícone cai no padrão): oferece "—". */
  allowEmpty?: boolean
  /** Explicação curta, abaixo do rótulo. */
  help?: string
}

/** O mapa `kind` de lista → campos de dentro do item. Nome próprio porque o **painel**
 * importa este tipo (`schema.itemFields`): com o nome, um campo novo no item é erro
 * de compilação nos dois lados, em vez de um espelho que diverge calado. */
export type ItemFields = Partial<Record<FieldKind, readonly ItemFieldSpec[]>>

/** Sub-formulário de cada `kind` de lista, na ordem em que o editor o desenha. Só os
 * `kind` de objeto aparecem (`list:text` e `list:category` não têm sub-campos), e
 * todo `list:*` de `SECTION_FIELDS` precisa estar aqui — a paridade cobra os dois
 * sentidos, campo a campo, contra o tipo do bloco compartilhado. `list:column` é o
 * caso recursivo: a coluna guarda os próprios links. */

export const ITEM_FIELDS: ItemFields = {
  // Lista de **referências**, não de objetos: o valor é o id da categoria. A entrada
  // vazia existe porque a paridade cobra editor para todo `list:*`.
  "list:category": [],
  "list:benefit": [
    {
      name: "icon",
      label: "Ícone",
      options: ["quality", "price", "sizes", "delivery"],
      optionLabels: ICON_LABELS,
      allowEmpty: true,
    },
    { name: "title", label: "Título" },
    { name: "subtitle", label: "Subtítulo" },
  ],
  /** O slide da capa: os mesmos oito campos do hero, sem os de bloco. A ordem desta
   * lista **é** a de `HeroSlide` — a paridade compara as duas (`ITEM_TYPES`). */
  "list:hero-slide": [
    {
      name: "imageUrl",
      label: "Imagem",
      kind: "image",
      help: "Envie a foto pelo botão, ou informe um caminho do site (ex.: /brand/hero.jpg) ou uma URL.",
    },
    { name: "imageAlt", label: "Imagem (alt)" },
    { name: "eyebrow", label: "Eyebrow" },
    { name: "headline", label: "Título" },
    { name: "headlineEmphasis", label: "Título (parte em itálico)" },
    { name: "subtitle", label: "Subtítulo" },
    { name: "ctaLabel", label: "Texto do botão" },
    {
      name: "ctaHref",
      label: "Link do botão",
      kind: "href",
      help: HREF_HELP,
    },
  ],
  "list:highlight": [
    { name: "title", label: "Título" },
    { name: "subtitle", label: "Subtítulo" },
    {
      name: "imageUrl",
      label: "Imagem",
      kind: "image",
      help: "Envie a foto pelo botão, ou informe um caminho do site (ex.: /brand/collection-1.jpg) ou uma URL.",
    },
    { name: "imageAlt", label: "Imagem (alt)" },
    {
      name: "href",
      label: "Link",
      kind: "href",
      help: HREF_HELP,
    },
    { name: "ctaLabel", label: "Texto do botão" },
  ],
  "list:image": [
    {
      name: "imageUrl",
      label: "Imagem",
      kind: "image",
      help: "Envie a foto pelo botão, ou informe um caminho do site ou uma URL. A moldura é quadrada: corte a foto nesse formato para ela não ser recortada sozinha.",
    },
    { name: "imageAlt", label: "Imagem (alt)" },
  ],
  "list:link": [
    { name: "label", label: "Rótulo" },
    {
      name: "href",
      label: "Destino",
      kind: "href",
      help: HREF_HELP,
    },
  ],
  "list:action": [
    {
      name: "icon",
      label: "Ícone",
      options: ["bag", "account", "search", "whatsapp", "mail", "phone", "pin"],
      optionLabels: ICON_LABELS,
      allowEmpty: true,
    },
    { name: "label", label: "Rótulo" },
    {
      name: "href",
      label: "Destino",
      kind: "href",
      help: HREF_HELP,
    },
  ],
  // O bloco do texto longo: o `kind` (um `<select>`), o `text` (`markdown`) e as
  // linhas (`list:markdown`). Os três valem nos três `kind`.
  "list:proseBlock": [
    {
      name: "kind",
      label: "Tipo de bloco",
      options: PROSE_BLOCK_KINDS,
      optionLabels: PROSE_BLOCK_KIND_LABELS,
    },
    {
      name: "text",
      label: "Texto",
      kind: "markdown",
      help: "O texto do parágrafo ou do subtítulo — a loja desenha os dois com o negrito, o itálico, o riscado e o link da barra acima.",
    },
    {
      name: "items",
      label: "Linhas da lista",
      kind: "list:markdown",
      help: "Só a lista usa: cada linha é um item. Ignoradas no subtítulo e no parágrafo.",
    },
  ],
  // A pergunta frequente: a pergunta, que é a linha clicável, e a resposta, que é
  // `markdown` — o mesmo campo do texto longo. Sem lista dentro do item.
  "list:faqItem": [
    {
      name: "question",
      label: "Pergunta",
      help: "A linha que a cliente clica para abrir a resposta. Sem pergunta não há o que clicar — e o item não aparece na loja.",
    },
    {
      name: "answer",
      label: "Resposta",
      kind: "markdown",
      help: "A resposta que abre no clique, com o negrito, o itálico, o riscado e o link da barra acima. Item sem resposta não aparece na loja: um botão que não abre nada é pior do que um item a menos.",
    },
  ],
  // Coluna do rodapé: título, a origem dos itens e — quando é "links" — os links dela.
  "list:column": [
    { name: "title", label: "Título" },
    {
      name: "source",
      label: "Origem dos itens",
      options: FOOTER_COLUMN_SOURCES,
      optionLabels: FOOTER_COLUMN_SOURCE_LABELS,
    },
    {
      name: "links",
      label: "Links",
      kind: "list:link",
      help: "Só valem quando a origem dos itens é \"os links digitados abaixo\": a coluna que aponta para o catálogo ou para as páginas no ar tira os itens de lá.",
    },
  ],
  "list:social": [
    {
      name: "icon",
      label: "Ícone",
      options: ["instagram", "facebook", "whatsapp", "youtube"],
      optionLabels: ICON_LABELS,
      allowEmpty: true,
    },
    { name: "label", label: "Rótulo" },
    // A exceção declarada ao `kind: "href"`: o destino de uma rede social é sempre
    // externo, então a lista das rotas da loja não tem o que oferecer.
    // `contract.unit.spec.ts` declara esta exceção pelo nome.
    {
      name: "href",
      label: "Destino",
      kind: "text",
      help: "O endereço do perfil — sempre fora da loja (ex.: https://instagram.com/sualoja).",
    },
  ],
}

// ===========================================================================
// A superfície de tema — o tema como dado, ao lado das seções.
// ===========================================================================

/** A superfície que guarda o tema: um tema **é uma linha de `content_section`** como
 * uma seção — mesma tabela e mesmas colunas —, e é isso que faz o editor do CRM
 * servir para os dois. Sem migração: a coluna `surface` já existia. */
export const THEME_SURFACE = "theme"

/** O `type` de todo bloco da superfície de tema. */
export const THEME_TYPE = "theme"

/** Como o tema aparece na tela do CRM. */
export const THEME_TYPE_LABEL = "Tema da loja"

/** O que uma **página** pode receber: os blocos da home **menos** o cromo e a
 * abertura. Campo derivado, e não digitado: é a fatia de `SECTION_TYPES` que não é
 * única (`isSingletonSectionType`). Três coisas leem daqui: o que a aba da página
 * oferece no CRM, o que a API aceita gravar (`resolveSurface`) e a conferência de que
 * uma página **não tem casa reservada** (`reservedPositions`). */
export const PAGE_SECTION_TYPES: readonly SectionType[] = SECTION_TYPES.filter(
  (type) => !isSingletonSectionType(type)
)

/** Como uma superfície se descreve para o CRM — tudo **dado**, e não um
 * `if (surface === "theme")` no painel: uma superfície nova aparece na tela sem
 * tocar em React. `titleField` nomeia o bloco na listagem (a home pelo `type`, a
 * estação pelo `label`), `enabledLabel` é o interruptor, `types` é o que ela pode
 * criar, `blockLabel` o singular e `order` a faixa da numeração. */
export type ContentSurfaceSpec = {
  id: string
  /** O que a superfície **é** — até a F1 cada uma se explicava pelo `id`, e uma
   * **página** precisava de nome. Três regras dependem dele: quais têm **rota**
   * (`page`), o que o "Restaurar padrão" repõe e onde o bloco único pode existir. */
  kind: "home" | "theme" | "page"
  label: string
  titleField: string | null
  enabledLabel: string
  blockLabel: string
  hint: string
  types: readonly string[]
   /** A faixa da numeração da superfície: onde cai a primeira seção ordenável e de
    * quanto em quanto anda — a vitrine **de 1 em 1** (pulando a casa 10 do rodapé) e o
    * tema **de 10 em 10**; o CRM prevê o numeral como `applyOrder` (`order.ts`). */
  order: { first: number; step: number }
}

export const CONTENT_SURFACES: readonly ContentSurfaceSpec[] = [
  {
    id: "home",
    kind: "home",
    label: "Conteúdo da vitrine",
    titleField: null,
    enabledLabel: "Visível na loja",
    blockLabel: "seção",
    hint:
      "Estas seções montam a página inicial, na ordem das setas — que só vale " +
      "depois de “Salvar ordem”. As seções marcadas como Fixo (a barra de " +
      "anúncio, o cabeçalho, a capa e a faixa de benefícios, que abrem a " +
      "página, mais o rodapé, que a fecha) não têm ordem: elas moram sempre " +
      "nas mesmas casas — 1, 2, 3, 4 e 10 —, e as seções ordenáveis ocupam as " +
      "casas livres do meio: 5 a 9 e, a partir da sexta, 11 (a casa 10 é do " +
      "rodapé). A aparência entra junto do " +
      "campo que ela muda: em branco, a seção segue o tema da loja — inclusive " +
      "quando o tema é sazonal.",
    types: SECTION_TYPES,
    order: { first: 5, step: 1 },
  },
  {
    id: THEME_SURFACE,
    kind: "theme",
    label: THEME_TYPE_LABEL,
    titleField: "label",
    enabledLabel: "Estação no ar",
    blockLabel: "estação",
    hint:
      "Cada linha é uma estação, e a loja escolhe sozinha pelo dia de hoje: a " +
      "janela de datas mais estreita vence (Black Friday ganha do Natal). A " +
      "estação “default” é a base — cor ou fonte em branco numa estação " +
      "sazonal é herdada dela.",
    types: [THEME_TYPE],
    order: { first: 10, step: 10 },
  },
  // As páginas (a F1 do doc 14). A chave (`id`) **é o slug**: é ela que a rota
  // `(main)/[slug]/page.tsx` casa e que o `sitemap` publica. `titleField: null`
  // porque uma página não tem campo que lhe dê nome, e `types:` fecha o defeito 2
  // do doc 14 pelo painel; quem recusa o corpo que insistir é a API. `order.first`
  // é **1** porque a página não tem bloco ancorado nenhum.
  {
    id: "sobre",
    kind: "page",
    label: "Sobre",
    titleField: null,
    enabledLabel: "Publicada",
    blockLabel: "seção",
    hint:
      "Esta página monta o /sobre — a história da marca, em texto, foto e " +
      "botão. Sem nenhuma seção publicada, o endereço responde 404; a página " +
      "nunca cai na vitrine.",
    types: PAGE_SECTION_TYPES,
    order: { first: 1, step: 1 },
  },
  {
    id: "trocas-e-devolucoes",
    kind: "page",
    label: "Trocas e devoluções",
    titleField: null,
    enabledLabel: "Publicada",
    blockLabel: "seção",
    hint:
      "Esta página monta o /trocas-e-devolucoes — a política de troca e " +
      "devolução, que é o que a coluna Institucional do rodapé promete. Sem " +
      "nenhuma seção publicada, o endereço responde 404.",
    types: PAGE_SECTION_TYPES,
    order: { first: 1, step: 1 },
  },
  {
    id: "privacidade",
    kind: "page",
    label: "Privacidade",
    titleField: null,
    enabledLabel: "Publicada",
    blockLabel: "seção",
    hint:
      "Esta página monta o /privacidade — a política de privacidade (LGPD) " +
      "que o link de consentimento do checkout promete. Sem nenhuma seção " +
      "publicada, o endereço responde 404.",
    types: PAGE_SECTION_TYPES,
    order: { first: 1, step: 1 },
  },
  {
    id: "termos",
    kind: "page",
    label: "Termos de uso",
    titleField: null,
    enabledLabel: "Publicada",
    blockLabel: "seção",
    hint:
      "Esta página monta o /termos — os termos de uso, irmãos do link de " +
      "consentimento. Sem nenhuma seção publicada, o endereço responde 404.",
    types: PAGE_SECTION_TYPES,
    order: { first: 1, step: 1 },
  },
  {
    id: "contato",
    kind: "page",
    label: "Contato",
    titleField: null,
    enabledLabel: "Publicada",
    blockLabel: "seção",
    hint:
      "Esta página monta o /contato — os canais de atendimento (telefone, " +
      "e-mail, WhatsApp e horário). Os ícones dela já existem no CRM sem uso. " +
      "Sem nenhuma seção publicada, o endereço responde 404.",
    types: PAGE_SECTION_TYPES,
    order: { first: 1, step: 1 },
  },
  {
    id: "perguntas-frequentes",
    kind: "page",
    label: "Perguntas frequentes",
    titleField: null,
    enabledLabel: "Publicada",
    blockLabel: "seção",
    hint:
      "Esta página monta o /perguntas-frequentes — as dúvidas da cliente, em " +
      "pares de pergunta e resposta, abertos no clique. O texto de abertura " +
      "vem dos blocos de texto (`prose`). Sem nenhuma seção publicada, o " +
      "endereço responde 404.",
    types: PAGE_SECTION_TYPES,
    order: { first: 1, step: 1 },
  },
]

/** As páginas declaradas: a fatia de `CONTENT_SURFACES` com `kind: "page"`. Derivada
 * e não digitada — quem a lê é a rota `[slug]`, o `sitemap.ts` e o guarda de slug. */
export const PAGE_SURFACES: readonly ContentSurfaceSpec[] =
  CONTENT_SURFACES.filter((surface) => surface.kind === "page")

/** Um destino que o painel oferece: a rota e o nome que o lojista lê. `href` é o
 * valor gravado, **sem** o país: quem prefixa é a loja (`LocalizedClientLink`, por
 * `nav-link`), e gravar `/br/sobre` amarraria o conteúdo ao país do dia. */
export type ContentDestination = {
  href: string
  label: string
}

/** As rotas **fixas** da loja — as vizinhas do `[slug]` em `(main)`, escritas à mão
 * (catálogo, sacola, conta, busca, rastreio). Um destino daqui que deixe de existir
 * reprova no guarda (`page-surfaces.spec.ts`); as âncoras são do `nav-link`. */
const STORE_ROUTES: readonly ContentDestination[] = [
  { href: "/", label: "Início (a vitrine)" },
  { href: "/store", label: "Catálogo (todas as peças)" },
  { href: "/cart", label: "Sacola" },
  { href: "/account", label: "Minha conta" },
  { href: "/search", label: "Busca" },
  { href: "/rastreio", label: "Rastrear o pedido" },
]

/** O índice de destinos — as rotas que a loja **tem**, para o seletor do CRM. É a
 * peça que fecha a causa-raiz do doc 13: o painel só oferecia texto livre, e o único
 * endereço que o lojista podia conferir era `/store` — os nove botões apontando para
 * o catálogo eram o resultado disso. Duas metades: `STORE_ROUTES` e as páginas,
 * **derivadas** de `PAGE_SURFACES`. */
export const CONTENT_DESTINATIONS: readonly ContentDestination[] = [
  ...STORE_ROUTES,
  ...PAGE_SURFACES.map((surface) => ({
    href: `/${surface.id}`,
    label: surface.label,
  })),
]

/** A superfície declarada com este `id`, ou `undefined` se ninguém a declarou. */
export function findSurface(id: unknown): ContentSurfaceSpec | undefined {
  return typeof id === "string"
    ? CONTENT_SURFACES.find((surface) => surface.id === id)
    : undefined
}

/** O `id` é uma superfície declarada? É a guarda das duas pontas que recebem uma
 * superfície — a leitura pública e a escrita do CRM —, e existe porque as duas
 * aceitavam **qualquer** string: `?surface=sobreo` respondia 200 com `{"sections":[]}`. */
export function isKnownSurface(id: unknown): id is string {
  return findSurface(id) !== undefined
}

/** A superfície é uma página? Ver `kind`, no `ContentSurfaceSpec`. */
export function isPageSurface(id: unknown): boolean {
  return findSurface(id)?.kind === "page"
}

/** As seções de uma página que põem o endereço **no ar** — a régua do 200: a seção
 * está **ligada** (a coluna `enabled`, "Publicada" no CRM) e o tipo dela é um que a
 * loja **conhece** (`isSectionType` — o render é exaustivo e o `default` lança, a
 * página viraria 500). É a mesma régua que a rota `[slug]` aplica antes do 404. */
export function publishedSections<T extends { type: string; enabled: boolean }>(
  sections: readonly T[]
): T[] {
  return sections.filter(
    (section) => section.enabled && isSectionType(section.type)
  )
}

/** Os estados de uma página declarada — o vocabulário da tela "Páginas". São **três**,
 * e o terceiro existe porque a diferença importa: **despublicada** é a que tem bloco
 * e nenhum no ar (404, e o link do rodapé promete um link quebrado — o defeito
 * medido em 14.16); **sem blocos** é a que ainda não foi montada. Os rótulos viajam
 * no payload do CRM (`pageStates`), e "Publicada" é a palavra do interruptor. */
export type PageState = "published" | "unpublished" | "empty"

/** O que a tela mostra para cada estado: o rótulo, o tom e a frase. */
export type PageStateSpec = {
  id: PageState
  label: string
  /** O `color` do `Badge` do painel (`@medusajs/ui`). */
  tone: "green" | "orange" | "grey"
  meaning: string
}

export const PAGE_STATES: readonly PageStateSpec[] = [
  {
    id: "published",
    label: "Publicada",
    tone: "green",
    meaning: "Tem bloco publicado: o endereço responde.",
  },
  {
    id: "unpublished",
    label: "Despublicada",
    tone: "orange",
    meaning:
      "Tem blocos e nenhum publicado: o endereço responde 404. Se o rodapé " +
      "promete esta página, ele promete um link quebrado.",
  },
  {
    id: "empty",
    label: "Sem blocos",
    tone: "grey",
    meaning:
      "Nenhum bloco montado: o endereço responde 404 até alguém montar a página.",
  },
]

/** O estado de uma página, das seções dela — a régua aplicada. Recebe as seções
 * **cruas** (as desabilitadas inclusive): a conta e a decisão saem da mesma lista. */
export function pageState(
  sections: readonly { type: string; enabled: boolean }[]
): PageState {
  if (publishedSections(sections).length > 0) {
    return "published"
  }

  return sections.length > 0 ? "unpublished" : "empty"
}

/** Todo `type` de conteúdo que o CRM edita: as seções **e** o bloco de tema. Sem
 * `theme` aqui, a primeira gravação de uma estação seria recusada; a paridade confere
 * a união das superfícies contra esta lista. */
export const CONTENT_TYPES: readonly string[] = [...SECTION_TYPES, THEME_TYPE]

/** As famílias que a loja de fato carrega — **derivadas** de `THEME_FONTS`. São as
 * três self-hosted (`frontend/src/app/fonts`): o `<select>` do CRM não pode oferecer
 * outra, porque trocar por "Arial" não faria o navegador baixar Arial nenhuma. */
export const THEME_FONT_FAMILIES: readonly string[] = FONT_ROLES.map(
  (role) => THEME_FONTS[role].family
)

/** O papel de cada família, para a opção do `<select>` não ser só o nome. */
const FONT_ROLE_DESCRIPTIONS: Record<FontRole, string> = {
  display: "títulos, serifada",
  sans: "textos e interface",
  script: "manuscrita",
}

/** Tradução de cada família (e da opção vazia) para o `<select>` do tema. */
export const THEME_FONT_FAMILY_LABELS: Record<string, string> = {
  "": "Padrão do tema da loja",
  ...Object.fromEntries(
    FONT_ROLES.map((role) => [
      THEME_FONTS[role].family,
      FONT_ROLE_DESCRIPTIONS[role],
    ])
  ),
}

/** Opções do `<select>` de fonte do tema: o "herda" na frente das famílias. */
export const THEME_FONT_OPTIONS: readonly string[] = [
  "",
  ...THEME_FONT_FAMILIES,
]

/** Rótulo do campo de cada papel de fonte no editor do tema. */
export const THEME_FONT_ROLE_LABELS: Record<FontRole, string> = {
  display: "Fonte dos títulos",
  sans: "Fonte dos textos",
  script: "Fonte manuscrita",
}

/** `#RRGGBB` — o formato que o storefront consegue usar como variável CSS. */
export const HEX_COLOR_PATTERN = "^#[0-9a-fA-F]{6}$"

/** `MM-DD`, o formato que o storefront compara com a data de hoje. Sem o ano de
 * propósito: a janela é anual, e quem resolve o tema decide se `start > end`. */
export const MONTH_DAY_PATTERN = "^(0[1-9]|1[0-2])-(0[1-9]|[12][0-9]|3[01])$"

/** Campos de `data` de um bloco de tema, na ordem em que o CRM os mostra. Mesma
 * máquina dos campos de seção. Nada além do `label` é obrigatório: uma estação
 * declara só o que muda e o resto é **herdado** do tema padrão. */
export const THEME_FIELDS: readonly FieldSpec[] = [
  {
    name: "label",
    label: "Nome da estação",
    kind: "text",
    required: true,
    help: "Como a estação aparece para você aqui no CRM. A loja não mostra.",
  },
  {
    name: "dateRangeStart",
    label: "Começa em (MM-DD)",
    kind: "text",
    pattern: MONTH_DAY_PATTERN,
    help: "Mês e dia, sem ano: 11-20 para 20 de novembro.",
  },
  {
    name: "dateRangeEnd",
    label: "Termina em (MM-DD)",
    kind: "text",
    pattern: MONTH_DAY_PATTERN,
    help: "Pode terminar no ano seguinte (o Verão vai de 12-27 a 03-20).",
  },
  ...THEME_COLOR_TOKENS.map((token) => ({
    name: themeColorField(token),
    label: APPEARANCE_COLOR_LABELS[token] ?? token,
    kind: "hex" as const,
    pattern: HEX_COLOR_PATTERN,
    help: "Em branco, herda a cor do tema padrão.",
  })),
  ...FONT_ROLES.map((role) => ({
    name: themeFontField(role),
    label: THEME_FONT_ROLE_LABELS[role],
    kind: "select" as const,
    options: THEME_FONT_OPTIONS,
    optionLabels: THEME_FONT_FAMILY_LABELS,
    help: "Em branco, herda a fonte do tema padrão.",
  })),
]

