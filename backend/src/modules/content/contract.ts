/**
 * Real Valor — Contrato de conteúdo (fonte da verdade)
 * -----------------------------------------------------------------
 * Este arquivo é a ÚNICA definição do formato de conteúdo da vitrine:
 * os tipos das seções, os campos que o CRM edita (`SECTION_FIELDS`) e as
 * listas fechadas do tema (paleta, papéis de fonte, trilhos).
 *
 * O storefront é outro pacote npm, com `node_modules` próprio, e não tem
 * como importar daqui. Em vez de manter uma cópia digitada à mão (o antigo
 * espelho, que precisava de mil linhas de guarda para não divergir), o
 * storefront recebe o **bloco compartilhado** deste arquivo — tudo o que
 * está acima do marcador "Bloco compartilhado" — mais o conteúdo padrão de
 * `./defaults`, gerados por:
 *
 *     node scripts/gen-content.mjs          # regrava o artefato
 *     node scripts/gen-content.mjs --check  # falha se estiver desatualizado
 *
 * O artefato é `frontend/src/lib/content/contract.generated.ts` e NÃO se
 * edita à mão: `scripts/check-contract-parity.mjs` (`make check`) reprova
 * artefato fora de sincronia, e o mesmo comando roda no hook de commit.
 *
 * Origem do conteúdo: ./Downloads/real-valor-frontend-prototype
 */

// ===========================================================================
// INÍCIO DO BLOCO COMPARTILHADO — copiado para
// `frontend/src/lib/content/contract.generated.ts` por `scripts/gen-content.mjs`.
// Só acrescente aqui o que o storefront precisa em runtime (tipos e listas
// fechadas). O que é só do backend/admin fica abaixo do fim do bloco.
// ===========================================================================

/**
 * Aparência da seção — escolhas do lojista no CRM (opcional).
 *
 * Cada campo guarda o **papel** do tema (`rose`, `dourado`, `display`…),
 * não a cor ou a fonte literal: quem escolhe "Dourado Rosé" gravou
 * `"dourado"`, e o storefront resolve isso para `var(--rv-dourado)`.
 * É o que faz a seção acompanhar um tema sazonal — o Black Friday troca
 * `--rv-rose` e a seção recolore junto, sem ninguém reeditar o conteúdo.
 *
 * Vazio (ou ausente) é o padrão e o valor normal: significa "como o tema
 * da loja manda", e é o que o `NULL` da coluna `data` acaba virando.
 *
 * As listas de valores válidos são `THEME_COLOR_TOKENS` / `FONT_ROLES`
 * abaixo; quem valida em runtime é o `appearanceVars` do storefront
 * (`frontend/src/lib/content/appearance.ts`), porque o que volta do
 * banco é texto livre.
 *
 * Seção não oferece campo que não use: a barra de anúncio, por exemplo,
 * é uma linha só, então não tem título nem detalhe para colorir.
 */
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

export type AnnouncementSection = SectionBase &
  SectionAppearance & {
    type: "announcement"
    text: string
  }

export type HeroSection = SectionBase &
  SectionAppearance & {
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
    /** Chips de filtro acima da vitrine. `"Todos"` significa "todas". */
    filters: string[]
    viewAllLabel: string
  }

export type EditorialSection = SectionBase &
  SectionAppearance & {
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

export type InstagramSection = SectionBase &
  SectionAppearance & {
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
 * que o seed cria (e o "Restaurar padrão" do CRM recria, em
 * `modules/content/restore.ts`).
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

/**
 * De onde vêm os itens de uma coluna do rodapé.
 *
 *   `links`       → os `links` digitados no admin (o padrão)
 *   `categories`  → as categorias do catálogo, ao vivo
 *   `collections` → as coleções do catálogo, ao vivo
 *
 * É uma lista, e não um `union` solto, porque é ela que o editor do admin
 * oferece no `<select>`: as opções do campo de item viajam em `ITEM_FIELDS`
 * (e daí no `schema` do `GET /admin/content`), então o painel não tem cópia
 * nenhuma. `scripts/check-contract-parity.mjs` confere a lista contra o
 * `source` oferecido pelo editor e contra os ramos de `footer-column/index.tsx`.
 */
export const FOOTER_COLUMN_SOURCES = [
  "links",
  "categories",
  "collections",
] as const

export type FooterColumnSource = (typeof FOOTER_COLUMN_SOURCES)[number]

/**
 * Coluna de links do rodapé (ex.: "Ajuda").
 *
 * Coluna é sempre conteúdo: não existe coluna fixa nem automática no
 * componente, e o lojista insere, edita, reordena e remove **todas** pelo
 * mesmo editor do admin. As colunas de catálogo não são um caso especial
 * do layout — são só uma `source` possível, escolhida por coluna.
 *
 * Com `source: "categories"` ou `"collections"` os itens vêm do catálogo
 * e `links` é ignorado; com `"links"` (o padrão) é o contrário. Nos dois
 * casos os `href` digitados têm a mesma forma e a mesma resolução dos
 * links do menu: quem transforma o `href` em comportamento é o `nav-link`
 * (`/#secao` rola, `/rota` navega, `https://` abre em nova aba,
 * `mailto:`/`tel:` abrem o contato), então rodapé e cabeçalho não
 * divergem.
 */
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

/**
 * Rodapé da loja.
 *
 * Como o `nav`, não é uma seção da home: aparece em todas as rotas, quem
 * o desenha é o layout, e o `id` fixo `footer` é o que o seed cria.
 *
 * A marca, a frase manuscrita e a linha de direitos continuam no
 * componente — não são conteúdo. Todo o resto é: as colunas de links (na
 * ordem da lista, cada uma com a sua origem) e as redes sociais. Não
 * existe coluna padrão nem FAQ embutida: rodapé sem coluna nenhuma é um
 * estado válido, e na loja só aparece o que o lojista inserir no admin —
 * uma coluna de "Perguntas frequentes" é uma coluna como qualquer outra.
 */
export type FooterSection = SectionBase & {
  type: "footer"
  /**
   * Colunas de links, na ordem da lista. Cada item decide de onde vêm os
   * itens (`source`), então o componente não tem coluna fixa. Coluna sem
   * título ou sem itens não aparece na loja — é o que permite publicar o
   * rodapé antes de o catálogo existir.
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
 * Tipos que só podem existir **uma vez** por superfície.
 *
 * Os três são cromo do site — barra de anúncio, cabeçalho e rodapé — e o
 * layout os resolve por `find` (`announceSections`, `headerSections` e
 * `footerSections`, em `frontend/src/lib/content/home-sections.ts`): o
 * primeiro bloco do tipo é o que aparece na loja.
 *
 * Um segundo bloco seria o pior defeito possível num CMS: o lojista cria, a
 * lista do CRM mostra, a loja **nunca** desenha. Por isso a API recusa a
 * criação (`POST /admin/content`) e o CRM não oferece um tipo que já existe —
 * as duas pontas leem esta lista, então não há duas opiniões sobre o que é
 * único.
 */
export const SINGLETON_SECTION_TYPES = ["announcement", "nav", "footer"] as const

export type SingletonSectionType = (typeof SINGLETON_SECTION_TYPES)[number]

export function isSingletonSectionType(
  value: unknown
): value is SingletonSectionType {
  return (
    typeof value === "string" &&
    (SINGLETON_SECTION_TYPES as readonly string[]).includes(value)
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

// ===========================================================================
// FIM DO BLOCO COMPARTILHADO. Daqui para baixo é só backend/admin: os
// atalhos dos trilhos de aparência, o `SECTION_FIELDS` que o CRM consome e a
// paleta/fontes de prévia (que o painel recebe pelo `schema` da API).
// ===========================================================================

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
  // Imagem: campo com envio de arquivo. O editor sobe a foto pelo provider de
  // arquivos (`@medusajs/file-local`, ver `medusa-config.ts`) e grava a
  // **chave** do arquivo (`1699999999-hero.jpg`) — nunca a URL absoluta, que
  // amarraria o conteúdo ao endereço do backend. Quem traduz chave → URL é
  // `resolveMediaUrl` no storefront (`frontend/src/lib/util/media.ts`), o que
  // mantém a loja funcionando com o mesmo valor gravado hoje (URL do painel
  // nativo) e depois de trocar o provider por S3.
  | "image"
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
  /**
   * Faixa de um campo `number` (mínimo, máximo e passo do `<input>`), e o que
   * a rota admin usa para reprovar valor fora dela.
   *
   * Declaradas no campo, e não no editor: o formulário do painel é desenhado a
   * partir deste contrato, então um segundo campo numérico — o limite de itens
   * de uma vitrine, por exemplo — herdaria a faixa do `overlay` do hero (0 a 1)
   * se ela estivesse escrita no `field-input.tsx`, e o lojista não conseguiria
   * digitar 8. Campo sem faixa é um número livre.
   */
  min?: number
  max?: number
  /** Passo do `<input type="number">`; ausente vale 1. */
  step?: number
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
    {
      name: "imageUrl",
      label: "Imagem",
      kind: "image",
      help: "Envie a foto pelo botão, ou informe um caminho do site (ex.: /brand/hero.jpg) ou uma URL.",
    },
    { name: "imageAlt", label: "Imagem (alt)", kind: "text" },
    {
      name: "overlay",
      label: "Scrim (0 a 1)",
      kind: "number",
      min: 0,
      max: 1,
      step: 0.01,
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

// ===========================================================================
// O QUE O CRM DESENHA ALÉM DOS CAMPOS DE SEÇÃO
// ===========================================================================
// `SECTION_FIELDS` diz quais campos uma seção tem; falta o resto que o editor
// do admin precisa para desenhar a tela — e que também é dado, não tabela em
// React:
//
//   SECTION_TYPE_LABELS   o nome de cada tipo na listagem ("Sobre", não
//                         "editorial");
//   ITEM_FIELDS           o sub-formulário de cada item de lista (os itens de
//                         `benefits`, os links de uma coluna do rodapé…),
//                         recursivo como o conteúdo é;
//   ICON_LABELS           a tradução das chaves de ícone oferecidas.
//
// Os três viajam no `schema` do `GET /admin/content` e quem os desenha é o
// `field-input.tsx`/`page.tsx`, que não importam nada daqui (o admin é um
// pacote npm separado do backend). Até aqui eles eram espelhos digitados à mão
// no admin, e a guarda de paridade só sabia comparar texto com texto; agora o
// que o editor desenha e o que o contrato declara são o **mesmo objeto**, e a
// guarda confere o que de fato vive em dois pacotes: as chaves de ícone do
// storefront e os campos que ele lê.
//
// Nada disto é gravável por conta própria: o que a API aceita continua saindo
// de `SECTION_FIELDS` (com `options` campo a campo) e sendo validado pelo
// `validateData` da rota admin.

/**
 * Rótulo de cada tipo na listagem do editor.
 *
 * O `type` é o identificador que a API grava e que o storefront casa no
 * `switch` — não muda. O rótulo é o que o lojista lê, e não é uma tradução do
 * `type`: a seção `editorial` se chama **Sobre** na loja (é o item do menu que
 * rola até ela), e `nav`/`footer` são cromo de todas as rotas, não seções da
 * home. Uma tabela dentro do `page.tsx` deixaria um tipo novo aparecendo como
 * jargão até alguém lembrar de mexer no admin.
 */
export const SECTION_TYPE_LABELS: Record<SectionType, string> = {
  announcement: "Barra de anúncio",
  hero: "Hero",
  benefits: "Faixa de benefícios",
  collections: "Coleções em destaque",
  featured: "Peças em destaque",
  editorial: "Sobre",
  instagram: "Instagram",
  nav: "Cabeçalho",
  footer: "Rodapé",
}

/**
 * Tradução de cada chave de ícone oferecida em `ITEM_FIELDS`.
 *
 * O ícone é escolhido por chave (`"quality"`, `"bag"`) porque quem desenha é o
 * registro do storefront (`frontend/src/lib/content/icons.ts`); sem a tradução
 * o `<select>` do admin seria só jargão. Chave oferecida e sem rótulo aparece
 * crua — é o que a guarda de paridade reprova, junto com o rótulo órfão.
 */
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
  // Redes sociais do rodapé (`list:social`), que têm registro próprio
  // (`frontend/src/lib/content/social-icons.tsx`).
  instagram: "Instagram",
  facebook: "Facebook",
  youtube: "YouTube",
}

/**
 * Tradução das origens de uma coluna do rodapé.
 *
 * O rótulo diz de onde os itens **saem**, e não o nome da origem: quem escolhe
 * `categories` precisa saber que a lista passa a ser o catálogo ao vivo, e não
 * o que ele digitou logo abaixo.
 */
export const FOOTER_COLUMN_SOURCE_LABELS: Record<FooterColumnSource, string> = {
  links: "os links digitados abaixo",
  categories: "as categorias do catálogo",
  collections: "as coleções do catálogo",
}

/**
 * Um campo de um item de lista — o que o editor desenha dentro de um item.
 *
 * É um tipo à parte de `FieldSpec` de propósito: item de lista não tem trilho
 * de aparência, nem `attachedTo`, nem campo obrigatório. Oferecer isso aqui
 * sugeriria um recurso que o editor não desenha.
 *
 * `kind` só existe para o item que é lista (hoje, o `links` de uma coluna do
 * rodapé) e `options` para o item que é escolha (`source`, `icon`).
 */
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

/**
 * O mapa `kind` de lista → campos de dentro do item.
 *
 * Nome próprio (e não um `Partial<Record<…>>` escrito em cada lugar) porque o
 * **painel** importa este tipo: ele recebe o mapa no `schema.itemFields` e
 * precisa da mesma forma que o contrato declara. Com o nome, um campo novo no
 * item é erro de compilação nos dois lados, em vez de um espelho que diverge em
 * silêncio.
 */
export type ItemFields = Partial<Record<FieldKind, readonly ItemFieldSpec[]>>

/**
 * Sub-formulário de cada `kind` de lista, na ordem em que o editor o desenha.
 *
 * Só os `kind` de objeto aparecem: `list:text` é um input separado por
 * vírgula, sem sub-campos. Todo `list:*` de `SECTION_FIELDS` precisa estar
 * aqui — sem editor o campo aparece na tela e não dá para preencher —, e a
 * guarda de paridade cobra os dois sentidos (nenhum `kind` sem sub-formulário,
 * nenhuma chave que não seja um `kind` declarado nas seções).
 *
 * Cada `kind` tem um tipo no bloco compartilhado (`BenefitItem`,
 * `CollectionHighlight`, `HeaderLink`, `HeaderAction`, `FooterColumn`,
 * `FooterSocial`), que é o que o storefront lê: a guarda confere que o editor
 * oferece exatamente os campos do tipo, na mesma ordem — campo num lado só
 * deixa o lojista sem como preencher o que a loja renderiza, ou o contrário.
 * `list:image` não tem tipo nomeado (o `images` do Instagram é inline), e
 * `list:column` tem a checagem extra contra o que o render da coluna lê.
 *
 * O ícone é escolha dentro de uma lista fechada, e as chaves são declaradas
 * aqui — o contrato não importa o registro do storefront (pacotes separados) —,
 * conferidas contra `BENEFIT_ICON_KEYS`/`HEADER_ACTION_ICON_KEYS` (`icons.ts`)
 * e `SOCIAL_ICON_KEYS` (`social-icons.tsx`) pela guarda de paridade: chave
 * nova num lado só ofereceria no admin um ícone que a loja não desenha (ou o
 * contrário, um ícone que ninguém consegue escolher).
 *
 * `list:column` é o caso recursivo: a coluna guarda os próprios links
 * (`list:link`), e é por isso que o editor desenha os níveis internos em
 * recursão em vez de um ramo por profundidade.
 */

export const ITEM_FIELDS: ItemFields = {
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
    { name: "href", label: "Link" },
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
    { name: "href", label: "Destino" },
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
    { name: "href", label: "Destino" },
  ],
  // Coluna do rodapé: título, a origem dos itens e — quando a origem é
  // "links" — os links dela, que são uma lista dentro do item.
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
      help: "Ignorados quando a origem é o catálogo.",
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
    { name: "href", label: "Destino" },
  ],
}

