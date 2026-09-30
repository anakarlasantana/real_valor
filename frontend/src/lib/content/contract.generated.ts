/**
 * Real Valor — Contrato de conteúdo do storefront.
 * -----------------------------------------------------------------
 * ARQUIVO GERADO — NÃO EDITE À MÃO.
 *
 * Copiado de `backend/src/modules/content/contract.ts` (bloco compartilhado)
 * e `defaults.ts` (conteúdo padrão) por `node scripts/gen-content.mjs`.
 * Contrato novo é: editar o backend, rodar o gerador, commitar o diff. O
 * `make check` e o hook de commit reprovam este arquivo fora de sincronia.
 *
 * Aqui só está o que o storefront lê em runtime — tipos das seções, listas
 * fechadas do tema (tipos, paleta, papéis de fonte, trilhos) e o conteúdo
 * padrão. O que é só do backend/CRM (`SECTION_FIELDS`, paleta de prévia,
 * validação) mora em `contract.ts`, abaixo do fim do bloco compartilhado.
 */

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

/**
 * A velocidade do ticker da barra de anúncio, em segundos por volta.
 *
 * Mora no contrato, e não solta no campo, porque a faixa é lida em dois
 * lugares: o `min`/`max` do `SECTION_FIELDS.announcement` (que o CRM desenha e a
 * API admin valida) e o storefront (`frontend/src/lib/util/ticker.ts`), que é a
 * última defesa — o que está gravado no banco pode ser anterior à faixa. É o
 * mesmo arranjo do `limit` do trilho de lançamentos
 * (`frontend/src/lib/util/launches.ts`), e quem confere o espelho é
 * `scripts/check-contract-parity.mjs`.
 *
 * O piso de 8s não é estético: abaixo dele a linha cruza a tela rápido demais
 * para ser lida, e texto que não dá para ler é ruído com movimento. O teto de
 * 60s é o outro extremo — acima dele o ticker parece parado, e o lojista fica
 * com uma barra que ele acha que quebrou.
 */
export const ANNOUNCEMENT_SPEED_MIN = 8
export const ANNOUNCEMENT_SPEED_MAX = 60
export const ANNOUNCEMENT_SPEED_DEFAULT = 24

export type AnnouncementSection = SectionBase &
  SectionAppearance & {
    type: "announcement"
    /**
     * A mensagem única — como a barra nasceu ("Frete seguro para todo o Brasil ·
     * Até 6x sem juros"): uma linha, centrada, parada.
     *
     * Continua valendo **quando não há `messages`** (base antiga, ou seção a que
     * ninguém deu ticker ainda), e é o que faz esta mudança não ter migração:
     * uma base que nunca ouviu falar de ticker desenha o que já desenhava.
     */
    text: string
    /**
     * As mensagens do ticker, na ordem em que aparecem.
     *
     * Com **duas ou mais**, a barra rola sozinha e em laço; com **uma só**, ela
     * fica parada e centrada — a leitura de antes com a redação nova. Vazio é o
     * caso do `text` acima.
     */
    messages?: string[]
    /**
     * Quantos segundos o ticker leva para dar uma volta completa
     * (`ANNOUNCEMENT_SPEED_*`). Ausente é o padrão.
     */
    speedSeconds?: number
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
    /**
     * Slides da capa — o carrossel.
     *
     * Vazio (o padrão) é a capa de sempre: a foto e a cópia dos campos acima.
     * Com um ou mais slides, quem manda é a lista, e cada slide traz a própria
     * foto e a própria cópia — os campos acima ficam de reserva, que é o que
     * permite a base que nunca teve carrossel desenhar a mesma capa de antes.
     */
    slides?: HeroSlide[]
  }

/**
 * Um slide da capa: a foto e a cópia que entram no carrossel.
 *
 * São os mesmos campos do `hero`, **sem** os de bloco (`enabled`, `position`,
 * aparência), que são da seção e não de um slide. A ordem da lista é a ordem do
 * carrossel, e a ordem dos campos daqui é a do sub-formulário no CRM
 * (`ITEM_FIELDS["list:hero-slide"]`) — a guarda de paridade compara as duas.
 *
 * O scrim (`overlay`) **não** é por slide de propósito: ele é a força do escuro
 * sobre a foto, e um valor por slide seria mais um campo num formulário que já
 * repete oito. Quem tem fotos de luminosidade muito diferente acerta o scrim
 * pela média, ou escolhe fotos parecidas.
 */
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
    /**
     * O formato da faixa: `cards` (a grade de três cartões altos, como a seção
     * nasceu) ou `banners` (uma linha de dois banners largos, um ao lado do
     * outro).
     *
     * É escolha de **formato**, então é um `select` e não um booleano: um
     * segundo formato já era previsível, e um terceiro é mais um valor aqui e um
     * ramo no render. Ausente ou desconhecido = `cards`, que é o que a loja
     * desenhava antes deste campo existir — e é o que continua desenhando numa
     * base onde ninguém escolheu nada.
     */
    layout?: "cards" | "banners"
    items: CollectionHighlight[]
  }

/**
 * Uma categoria do catálogo, como a vitrine e o CRM precisam dela.
 *
 * `categoryId` é a **referência** — é ele que filtra, no `category_id` da Store
 * API —, e `label`/`handle` são leitura ao vivo de `product_category`: quem
 * renomeia a categoria no painel vê o chip mudar, porque não há cópia gravada.
 *
 * O tipo é o mesmo nos dois lados (o chip escolhido e o catálogo oferecido): um
 * chip **é** uma entrada do catálogo, com a diferença de estar na lista da
 * seção.
 */
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
    /**
     * Chips de filtro acima da vitrine: **referências** às categorias do
     * catálogo, na ordem em que aparecem (o link `content_section_category`).
     *
     * Não é lista de rótulos, e é essa a diferença que a R1 conserta: os chips
     * eram texto dentro do `data` (`["Todos", "Blazers", "Conjuntos", "Calças"]`)
     * e a loja mandava o rótulo como busca. Medido no banco real, "Blazers" não
     * existe no catálogo — aquele chip devolvia zero peças **em silêncio** —, e
     * renomear uma categoria no painel não mudava chip nenhum, porque a cópia é
     * que era o dado. Aqui o filtro é `categoryId`, e o rótulo é o nome da
     * categoria lido na hora.
     *
     * O chip "Todos" (limpa o filtro) **não** está nesta lista: não existe
     * categoria "todas", e quem o desenha é a loja. Antes era a posição —
     * `filters[0]` — que dizia qual dos chips limpava, então reordenar os chips
     * trocava o significado de cada um sem nada acusar.
     */
    filters?: CategoryRef[]
    viewAllLabel: string
  }

/**
 * Lançamentos — o trilho de novidades logo depois do hero.
 *
 * É a pergunta que a home não respondia: "o que chegou?". O hero apresenta a
 * marca, as coleções mostram o universo e esta seção mostra o que é novo, num
 * trilho horizontal com encaixe (`scroll-snap`) em vez de grade — a mesma
 * largura de card do resto da loja, mas com o gesto de arrastar.
 *
 * **A fonte do conteúdo é a loja, não o CMS.** A seção carrega só a cópia
 * (eyebrow, título, subtítulo, link) e o `limit`; os produtos vêm da Store API,
 * do mais novo para o mais antigo. É o que faz a seção se manter sozinha: o
 * lojista publica uma peça e ela aparece no trilho sem ninguém editar bloco.
 * Escolher *quais* peças é outro assunto — curadoria manual, com um campo
 * `kind: "products"` —, e a decisão registrada é automático primeiro.
 *
 * A cópia padrão (`defaults.ts`) **não** é cópia do protótipo: o protótipo não
 * tem esta seção. Ela está escrita na voz da marca e é toda editável no CRM —
 * o texto de lá é ponto de partida, não redação final.
 */
export type LaunchesSection = SectionBase &
  SectionAppearance & {
    type: "launches"
    eyebrow: string
    title: string
    subtitle: string
    /**
     * Quantos produtos o trilho mostra. A faixa é declarada no campo
     * (`SECTION_FIELDS.launches`): a API recusa fora dela, e o storefront tem o
     * mesmo piso como última defesa (`lib/util/launches.ts`).
     */
    limit: number
    viewAllLabel: string
    viewAllHref: string
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
  | LaunchesSection
  | EditorialSection
  | InstagramSection
  | NavSection
  | FooterSection

/** Todo `type` de seção válido, como valor — para validação em runtime. */
export const SECTION_TYPES = [
  "announcement",
  "hero",
  // A abertura da home vem antes de tudo o que se ordena: a capa (casa 3) e a
  // faixa de benefícios (casa 4) são fixas, e o trilho de novidades cai na
  // primeira casa livre da vitrine (5). A ordem deste array é a ordem do
  // seletor de tipo no CRM e a ordem em que as seções se leem na página — a
  // mesma das casas ancoradas (`FIXED_SECTION_POSITIONS`) e da faixa da
  // vitrine (`order.ts`).
  "benefits",
  "launches",
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
 * Tipos que só podem existir **uma vez** por superfície — e que, por isso, têm
 * **casa ancorada** (`FIXED_SECTION_POSITIONS`): a posição deles não se move.
 *
 * São dois grupos, e os dois aparecem no CRM com a etiqueta **Fixo** (sem
 * setas, sem numeral a recalcular):
 *
 *   cromo do site     `announcement`, `nav` e `footer` — a moldura que a loja
 *                     desenha **em todas as rotas** e resolve por `find`
 *                     (`announceSections`, `headerSections` e `footerSections`,
 *                     em `frontend/src/lib/content/home-sections.ts`): o
 *                     primeiro bloco do tipo é o que aparece;
 *   abertura da home  `hero` e `benefits` — quem os desenha é a vitrine, e não
 *                     a moldura, mas eles são o **começo da página** e não
 *                     conteúdo que se reordena: a capa e a faixa de benefícios
 *                     moram sempre na mesma casa (ver `FIXED_SECTION_POSITIONS`).
 *
 * Um segundo bloco de um tipo destes seria o pior defeito possível num CMS: o
 * lojista cria, a lista do CRM mostra, e a loja **nunca** desenha — o cromo é
 * resolvido por `find` e a abertura está ancorada numa casa só. Por isso a API
 * recusa a criação (`POST /admin/content`) e o CRM não oferece um tipo que já
 * existe — as duas pontas leem esta lista, então não há duas opiniões sobre o
 * que é único.
 *
 * Estar aqui é o que faz a seção nascer **fixa** (`fixed = true`): quem grava a
 * coluna são as duas portas que criam seção (`restore.ts` e
 * `POST /admin/content`), as duas perguntando a `isSingletonSectionType`.
 */
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
 * A paleta do tema padrão — **a origem dos hex**, não mais uma cópia.
 *
 * Serve a dois consumidores, e os dois precisam dos mesmos valores:
 *
 *   1. o editor do admin desenha a **bolinha de cor** (o painel é um pacote
 *      separado, não lê os `theme.json` do storefront e sem isto só teria como
 *      oferecer a palavra "rose" — que não diz nada a quem escolhe uma cor);
 *   2. o gerador (`scripts/gen-content.mjs`) escreve
 *      `frontend/themes/default/theme.json` daqui e os tokens `--rv-*` no
 *      `frontend/src/styles/tokens.generated.css`, que é o fallback do
 *      `brand.css` antes de `themeToCSSVariables` escrever por requisição.
 *
 * Era **cópia de leitura** até a R3-lite, conferida cor por cor contra o
 * `theme.json` por dois arquivos de verificação. Agora o `theme.json` é
 * *seed* (bootstrap do tema no banco, na R4) e sai daqui: não há o que
 * comparar.
 *
 * O que o lojista grava continua sendo o papel (`"rose"`), nunca o hex, então
 * o tema sazonal segue mandando: a bolinha do CRM mostra a cor do **tema
 * padrão**, e é por isso que a opção segue trazendo o nome do papel no rótulo.
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

export type ThemeFont = {
  /** A família declarada no `@font-face` da loja e da prévia do painel. */
  family: string
  /** O que o navegador usa se o `.woff2` não chegar. */
  fallback: string
  /** `family` + `fallback`: a pilha inteira, como o `--rv-font-*` a recebe. */
  stack: string
}

/**
 * Monta uma fonte a partir da família e do fallback dela.
 *
 * A pilha é **derivada** — antes era escrita à mão em três lugares (aqui, no
 * template de `themeToCSSVariables` e no `--rv-font-*` do `brand.css`), e
 * cada cópia podia envelhecer sozinha. As três saem daqui agora: a loja monta
 * a pilha com `family` + `fallback` (`frontend/src/lib/theme.ts`), o
 * `brand.css` declara o fallback, e `scripts/check-contract-parity.mjs`
 * confere que ele é o mesmo.
 */
function themeFont(family: string, fallback: string): ThemeFont {
  return { family, fallback, stack: `"${family}", ${fallback}` }
}

/**
 * A família, o fallback e a pilha completa de cada papel de fonte.
 *
 * `family` é o nome declarado no `theme.json` (`fonts`) — o mesmo que o
 * `@font-face` da cópia em `admin/src/admin/routes/content/fonts/` usa —, e
 * `stack` é a pilha que `themeToCSSVariables` (`frontend/src/lib/theme.ts`)
 * escreve em `--rv-font-*`.
 *
 * Mesma razão de `THEME_COLOR_HEXES`: o `<select>` de fonte do admin
 * desenha cada opção **na própria fonte** — é o que faz "Títulos (Playfair
 * Display)" parecer um título na tela em vez de uma linha de texto igual às
 * outras. Sem a família, o painel não tem como pedir essa fonte ao
 * navegador.
 *
 * A guarda de paridade confere o md5 dos `.woff2` do admin contra os do
 * storefront — uma família sem arquivo vira prévia em Times New Roman, e um
 * arquivo diferente do da loja vira prévia que mente. A família em si não se
 * confere mais contra o `theme.json`: o arquivo é gerado daqui.
 */
export const THEME_FONTS: Record<FontRole, ThemeFont> = {
  display: themeFont("Playfair Display", "Georgia, serif"),
  sans: themeFont("Montserrat", "system-ui, sans-serif"),
  script: themeFont("Allura", "cursive"),
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

/**
 * Nome do campo de `data` que carrega cada cor do tema (`rose` → `colorRose`).
 *
 * O payload é plano — um bloco é `{ id, enabled, position, type, …data }` —,
 * então a paleta editável no CRM não vira um objeto aninhado em `data`: cada
 * cor é um campo, como qualquer outro. O nome sai daqui para o editor e a
 * loja não terem duas convenções de leitura: quem grava é o CRM (via
 * `THEME_FIELDS`) e quem lê é o storefront (`frontend/src/lib/theme.ts`),
 * pacotes diferentes que só concordam pelo artefato gerado.
 */
export function themeColorField(token: ThemeColorToken): string {
  return `color${token[0].toUpperCase()}${token.slice(1)}`
}

/** Nome do campo de `data` que carrega cada papel de fonte (`sans` → `fontSans`). */
export function themeFontField(role: FontRole): string {
  return `font${role[0].toUpperCase()}${role.slice(1)}`
}

/* ---------------------------------------------------------------------------
 * CONTEÚDO PADRÃO
 *
 * Cópia exata de `DEFAULT_HOME_SECTIONS` em `defaults.ts` — mesmos ids, na
 * mesma ordem. A vitrine o usa como fallback quando a API de conteúdo falha,
 * para uma indisponibilidade do CMS não derrubar a home.
 * ------------------------------------------------------------------------- */

export const DEFAULT_HOME_SECTIONS: HomeSection[] = [
  {
    "id": "announcement",
    "type": "announcement",
    "enabled": true,
    "position": 1,
    "text": "Frete seguro para todo o Brasil · Até 6x sem juros",
    "messages": [
      "Frete seguro para todo o Brasil",
      "Até 6x sem juros",
    ],
    "speedSeconds": 24,
  },
  {
    "id": "nav",
    "type": "nav",
    "enabled": true,
    "position": 2,
    "links": [
      {
        "label": "Início",
        "href": "/#hero",
      },
      {
        "label": "Coleções",
        "href": "/#collections",
      },
      {
        "label": "Produtos",
        "href": "/store",
      },
      {
        "label": "Sobre",
        "href": "/#editorial",
      },
      {
        "label": "Contatos",
        "href": "mailto:contato@realvalor.com.br",
      },
    ],
    "actions": [
      {
        "icon": "bag",
        "label": "Sacola",
        "href": "/cart",
      },
      {
        "icon": "account",
        "label": "Conta",
        "href": "/account",
      },
      {
        "icon": "search",
        "label": "Buscar",
        "href": "/search",
      },
    ],
  },
  {
    "id": "hero",
    "type": "hero",
    "enabled": true,
    "position": 3,
    "eyebrow": "Nova coleção",
    "headline": "Você não precisa ser rica para se",
    "headlineEmphasis": "sentir elegante.",
    "subtitle": "Alfaiataria para todas.",
    "ctaLabel": "Conheça a coleção",
    "ctaHref": "/store",
    "imageUrl": "/brand/hero.jpg",
    "imageAlt": "Alfaiataria feminina Real Valor",
    "overlay": 0.72,
  },
  {
    "id": "benefits",
    "type": "benefits",
    "enabled": true,
    "position": 4,
    "items": [
      {
        "icon": "quality",
        "title": "Qualidade",
        "subtitle": "que você sente",
      },
      {
        "icon": "price",
        "title": "Preços acessíveis",
        "subtitle": "para a sua realidade",
      },
      {
        "icon": "sizes",
        "title": "Do PP ao GG",
        "subtitle": "sem limitações",
      },
      {
        "icon": "delivery",
        "title": "Entrega segura",
        "subtitle": "Para todo o Brasil",
      },
    ],
  },
  {
    "id": "lancamentos",
    "type": "launches",
    "enabled": true,
    "position": 5,
    "eyebrow": "Novidades",
    "title": "Chegou agora",
    "subtitle": "As peças que acabaram de entrar na vitrine, na ordem em que chegaram.",
    "limit": 8,
    "viewAllLabel": "Ver tudo",
    "viewAllHref": "/store",
  },
  {
    "id": "collections",
    "type": "collections",
    "enabled": true,
    "position": 6,
    "eyebrow": "Explore",
    "title": "Nossas coleções",
    "subtitle": "Seleções criadas para diferentes momentos, sempre com a assinatura visual da REAL VALOR.",
    "items": [
      {
        "title": "Essência",
        "subtitle": "Para o seu dia a dia",
        "imageUrl": "/brand/collection-1.jpg",
        "imageAlt": "Coleção Essência",
        "href": "/store",
        "ctaLabel": "Comprar agora",
      },
      {
        "title": "Presença",
        "subtitle": "Para grandes momentos",
        "imageUrl": "/brand/collection-2.jpg",
        "imageAlt": "Coleção Presença",
        "href": "/store",
        "ctaLabel": "Comprar agora",
      },
      {
        "title": "Autêntica",
        "subtitle": "Para vestir você",
        "imageUrl": "/brand/collection-3.jpg",
        "imageAlt": "Coleção Autêntica",
        "href": "/store",
        "ctaLabel": "Comprar agora",
      },
    ],
  },
  {
    "id": "featured",
    "type": "featured",
    "enabled": true,
    "position": 7,
    "eyebrow": "Shop",
    "title": "Peças em destaque",
    "subtitle": "Uma vitrine editorial com navegação simples, foco no produto e preço sempre visível.",
    "viewAllLabel": "Ver todos os produtos",
  },
  {
    "id": "editorial",
    "type": "editorial",
    "enabled": true,
    "position": 8,
    "script": "Vista o seu valor.",
    "title": "A alfaiataria que valoriza você, não o seu status.",
    "body": "A REAL VALOR acredita que elegância não é privilégio. É um direito. Criamos peças de alfaiataria feminina com estética sofisticada e preço acessível, para que mais mulheres possam se sentir bem vestidas na vida real.",
    "ctaLabel": "Conheça a nossa história",
    "ctaHref": "/store",
    "imageUrl": "/brand/story-1.jpg",
    "imageAlt": "Detalhes de alfaiataria Real Valor",
    "imagePosition": "left",
  },
  {
    "id": "instagram",
    "type": "instagram",
    "enabled": true,
    "position": 9,
    "handle": "@realvalor",
    "title": "Mais que roupas, é sobre você.",
    "images": [
      {
        "imageUrl": "/brand/story-1.jpg",
        "imageAlt": "Real Valor no Instagram",
      },
      {
        "imageUrl": "/brand/story-2.jpg",
        "imageAlt": "Real Valor no Instagram",
      },
      {
        "imageUrl": "/brand/collection-1.jpg",
        "imageAlt": "Real Valor no Instagram",
      },
      {
        "imageUrl": "/brand/collection-2.jpg",
        "imageAlt": "Real Valor no Instagram",
      },
    ],
  },
  {
    "id": "footer",
    "type": "footer",
    "enabled": true,
    "position": 10,
    "columns": [],
    "social": [
      {
        "icon": "instagram",
        "label": "Instagram",
        "href": "https://instagram.com/realvalor",
      },
    ],
  },
]

/** A primeira seção de um tipo no conteúdo padrão (o cromo `nav`/`footer`). */
function defaultSection<T extends HomeSection["type"]>(
  type: T
): Extract<HomeSection, { type: T }> {
  const found = DEFAULT_HOME_SECTIONS.find((section) => section.type === type)

  if (!found) {
    throw new Error(`Conteúdo padrão sem bloco "${type}".`)
  }

  return found as Extract<HomeSection, { type: T }>
}

/** Cabeçalho padrão (bloco `nav`) — o layout o usa em todas as rotas. */
export const DEFAULT_HEADER = defaultSection("nav")

/** Rodapé padrão (bloco `footer`) — idem. */
export const DEFAULT_FOOTER = defaultSection("footer")
